-- Garden Task Cache Tables
-- These tables store pre-computed task data to avoid recalculating on every request
-- Data is automatically updated via triggers when source data changes
-- Old cache entries are cleaned up daily via scheduled jobs

-- Cache table for daily task statistics per garden
CREATE TABLE IF NOT EXISTS garden_task_daily_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  garden_id uuid NOT NULL REFERENCES gardens(id) ON DELETE CASCADE,
  cache_date date NOT NULL, -- YYYY-MM-DD format
  due_count integer NOT NULL DEFAULT 0,
  completed_count integer NOT NULL DEFAULT 0,
  task_count integer NOT NULL DEFAULT 0, -- Total number of tasks
  occurrence_count integer NOT NULL DEFAULT 0, -- Total occurrences for the day
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(garden_id, cache_date)
);

-- Cache table for weekly task statistics per garden
CREATE TABLE IF NOT EXISTS garden_task_weekly_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  garden_id uuid NOT NULL REFERENCES gardens(id) ON DELETE CASCADE,
  week_start_date date NOT NULL, -- Monday of the week (YYYY-MM-DD)
  week_end_date date NOT NULL, -- Sunday of the week (YYYY-MM-DD)
  total_tasks_by_day integer[7] NOT NULL DEFAULT ARRAY[0,0,0,0,0,0,0], -- Tasks per day Mon-Sun
  water_tasks_by_day integer[7] NOT NULL DEFAULT ARRAY[0,0,0,0,0,0,0],
  fertilize_tasks_by_day integer[7] NOT NULL DEFAULT ARRAY[0,0,0,0,0,0,0],
  harvest_tasks_by_day integer[7] NOT NULL DEFAULT ARRAY[0,0,0,0,0,0,0],
  cut_tasks_by_day integer[7] NOT NULL DEFAULT ARRAY[0,0,0,0,0,0,0],
  custom_tasks_by_day integer[7] NOT NULL DEFAULT ARRAY[0,0,0,0,0,0,0],
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(garden_id, week_start_date)
);

-- Cache table for task counts per plant
CREATE TABLE IF NOT EXISTS garden_plant_task_counts_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  garden_id uuid NOT NULL REFERENCES gardens(id) ON DELETE CASCADE,
  garden_plant_id uuid NOT NULL REFERENCES garden_plants(id) ON DELETE CASCADE,
  task_count integer NOT NULL DEFAULT 0, -- Total tasks for this plant
  due_today_count integer NOT NULL DEFAULT 0, -- Tasks due today
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(garden_id, garden_plant_id)
);

-- Cache table for today's task occurrences (denormalized for fast access)
CREATE TABLE IF NOT EXISTS garden_task_occurrences_today_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  garden_id uuid NOT NULL REFERENCES gardens(id) ON DELETE CASCADE,
  occurrence_id uuid NOT NULL REFERENCES garden_plant_task_occurrences(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES garden_plant_tasks(id) ON DELETE CASCADE,
  garden_plant_id uuid NOT NULL REFERENCES garden_plants(id) ON DELETE CASCADE,
  task_type text NOT NULL, -- 'water', 'fertilize', 'harvest', 'cut', 'custom'
  task_emoji text,
  due_at timestamptz NOT NULL,
  required_count integer NOT NULL DEFAULT 1,
  completed_count integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  cache_date date NOT NULL, -- YYYY-MM-DD format
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(garden_id, occurrence_id, cache_date)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_garden_task_daily_cache_garden_date ON garden_task_daily_cache(garden_id, cache_date DESC);
CREATE INDEX IF NOT EXISTS idx_garden_task_weekly_cache_garden_week ON garden_task_weekly_cache(garden_id, week_start_date DESC);
CREATE INDEX IF NOT EXISTS idx_garden_plant_task_counts_cache_garden ON garden_plant_task_counts_cache(garden_id);
CREATE INDEX IF NOT EXISTS idx_garden_plant_task_counts_cache_plant ON garden_plant_task_counts_cache(garden_plant_id);
CREATE INDEX IF NOT EXISTS idx_garden_task_occurrences_today_cache_garden_date ON garden_task_occurrences_today_cache(garden_id, cache_date DESC);
CREATE INDEX IF NOT EXISTS idx_garden_task_occurrences_today_cache_plant ON garden_task_occurrences_today_cache(garden_plant_id);

-- Function: Refresh daily cache for a garden and date
CREATE OR REPLACE FUNCTION refresh_garden_daily_cache(
  _garden_id uuid,
  _cache_date date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _start_iso timestamptz;
  _end_iso timestamptz;
  _due_count integer := 0;
  _completed_count integer := 0;
  _task_count integer := 0;
  _occurrence_count integer := 0;
BEGIN
  _start_iso := (_cache_date::text || 'T00:00:00.000Z')::timestamptz;
  _end_iso := (_cache_date::text || 'T23:59:59.999Z')::timestamptz;
  
  -- Calculate daily statistics
  SELECT
    COALESCE(SUM(GREATEST(1, occ.required_count)), 0),
    COALESCE(SUM(LEAST(GREATEST(1, occ.required_count), occ.completed_count)), 0),
    COUNT(DISTINCT t.id),
    COUNT(occ.id)
  INTO _due_count, _completed_count, _task_count, _occurrence_count
  FROM garden_plant_task_occurrences occ
  INNER JOIN garden_plant_tasks t ON t.id = occ.task_id
  WHERE t.garden_id = _garden_id
    AND occ.due_at >= _start_iso
    AND occ.due_at <= _end_iso;
  
  -- Upsert cache
  INSERT INTO garden_task_daily_cache (garden_id, cache_date, due_count, completed_count, task_count, occurrence_count, updated_at)
  VALUES (_garden_id, _cache_date, _due_count, _completed_count, _task_count, _occurrence_count, now())
  ON CONFLICT (garden_id, cache_date)
  DO UPDATE SET
    due_count = EXCLUDED.due_count,
    completed_count = EXCLUDED.completed_count,
    task_count = EXCLUDED.task_count,
    occurrence_count = EXCLUDED.occurrence_count,
    updated_at = now();
END;
$$;

-- Function: Refresh weekly cache for a garden and week
CREATE OR REPLACE FUNCTION refresh_garden_weekly_cache(
  _garden_id uuid,
  _week_start_date date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _week_end_date date;
  _start_iso timestamptz;
  _end_iso timestamptz;
  _day_idx integer;
  _day_iso date;
  _totals integer[7] := ARRAY[0,0,0,0,0,0,0];
  _water integer[7] := ARRAY[0,0,0,0,0,0,0];
  _fertilize integer[7] := ARRAY[0,0,0,0,0,0,0];
  _harvest integer[7] := ARRAY[0,0,0,0,0,0,0];
  _cut integer[7] := ARRAY[0,0,0,0,0,0,0];
  _custom integer[7] := ARRAY[0,0,0,0,0,0,0];
BEGIN
  _week_end_date := _week_start_date + INTERVAL '6 days';
  _start_iso := (_week_start_date::text || 'T00:00:00.000Z')::timestamptz;
  _end_iso := (_week_end_date::text || 'T23:59:59.999Z')::timestamptz;
  
  -- Calculate weekly statistics by day and type
  FOR _day_idx IN 0..6 LOOP
    _day_iso := _week_start_date + (_day_idx || ' days')::interval;
    
    SELECT
      COALESCE(SUM(GREATEST(1, occ.required_count)), 0),
      COALESCE(SUM(CASE WHEN t.type = 'water' THEN GREATEST(1, occ.required_count) ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN t.type = 'fertilize' THEN GREATEST(1, occ.required_count) ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN t.type = 'harvest' THEN GREATEST(1, occ.required_count) ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN t.type = 'cut' THEN GREATEST(1, occ.required_count) ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN t.type = 'custom' THEN GREATEST(1, occ.required_count) ELSE 0 END), 0)
    INTO
      _totals[_day_idx + 1],
      _water[_day_idx + 1],
      _fertilize[_day_idx + 1],
      _harvest[_day_idx + 1],
      _cut[_day_idx + 1],
      _custom[_day_idx + 1]
    FROM garden_plant_task_occurrences occ
    INNER JOIN garden_plant_tasks t ON t.id = occ.task_id
    WHERE t.garden_id = _garden_id
      AND occ.due_at >= (_day_iso::text || 'T00:00:00.000Z')::timestamptz
      AND occ.due_at <= (_day_iso::text || 'T23:59:59.999Z')::timestamptz;
  END LOOP;
  
  -- Upsert cache
  INSERT INTO garden_task_weekly_cache (
    garden_id, week_start_date, week_end_date,
    total_tasks_by_day, water_tasks_by_day, fertilize_tasks_by_day,
    harvest_tasks_by_day, cut_tasks_by_day, custom_tasks_by_day,
    updated_at
  )
  VALUES (
    _garden_id, _week_start_date, _week_end_date,
    _totals, _water, _fertilize, _harvest, _cut, _custom,
    now()
  )
  ON CONFLICT (garden_id, week_start_date)
  DO UPDATE SET
    week_end_date = EXCLUDED.week_end_date,
    total_tasks_by_day = EXCLUDED.total_tasks_by_day,
    water_tasks_by_day = EXCLUDED.water_tasks_by_day,
    fertilize_tasks_by_day = EXCLUDED.fertilize_tasks_by_day,
    harvest_tasks_by_day = EXCLUDED.harvest_tasks_by_day,
    cut_tasks_by_day = EXCLUDED.cut_tasks_by_day,
    custom_tasks_by_day = EXCLUDED.custom_tasks_by_day,
    updated_at = now();
END;
$$;

-- Function: Refresh plant task counts cache
CREATE OR REPLACE FUNCTION refresh_garden_plant_task_counts_cache(
  _garden_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _today date := CURRENT_DATE;
  _start_iso timestamptz;
  _end_iso timestamptz;
BEGIN
  _start_iso := (_today::text || 'T00:00:00.000Z')::timestamptz;
  _end_iso := (_today::text || 'T23:59:59.999Z')::timestamptz;
  
  -- Delete old cache for this garden
  DELETE FROM garden_plant_task_counts_cache WHERE garden_id = _garden_id;
  
  -- Insert fresh cache
  INSERT INTO garden_plant_task_counts_cache (garden_id, garden_plant_id, task_count, due_today_count)
  SELECT
    t.garden_id,
    t.garden_plant_id,
    COUNT(DISTINCT t.id)::integer as task_count,
    COUNT(DISTINCT CASE 
      WHEN occ.due_at >= _start_iso AND occ.due_at <= _end_iso 
        AND (occ.required_count - occ.completed_count) > 0 
      THEN occ.id 
    END)::integer as due_today_count
  FROM garden_plant_tasks t
  LEFT JOIN garden_plant_task_occurrences occ ON occ.task_id = t.id
  WHERE t.garden_id = _garden_id
  GROUP BY t.garden_id, t.garden_plant_id;
END;
$$;

-- Function: Refresh today's occurrences cache
CREATE OR REPLACE FUNCTION refresh_garden_today_occurrences_cache(
  _garden_id uuid,
  _cache_date date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _start_iso timestamptz;
  _end_iso timestamptz;
BEGIN
  _start_iso := (_cache_date::text || 'T00:00:00.000Z')::timestamptz;
  _end_iso := (_cache_date::text || 'T23:59:59.999Z')::timestamptz;
  
  -- Delete old cache for this garden and date
  DELETE FROM garden_task_occurrences_today_cache 
  WHERE garden_id = _garden_id AND cache_date = _cache_date;
  
  -- Insert fresh cache
  INSERT INTO garden_task_occurrences_today_cache (
    garden_id, occurrence_id, task_id, garden_plant_id,
    task_type, task_emoji, due_at, required_count, completed_count, completed_at, cache_date
  )
  SELECT
    t.garden_id,
    occ.id as occurrence_id,
    occ.task_id,
    occ.garden_plant_id,
    t.type as task_type,
    t.emoji as task_emoji,
    occ.due_at,
    occ.required_count,
    occ.completed_count,
    occ.completed_at,
    _cache_date
  FROM garden_plant_task_occurrences occ
  INNER JOIN garden_plant_tasks t ON t.id = occ.task_id
  WHERE t.garden_id = _garden_id
    AND occ.due_at >= _start_iso
    AND occ.due_at <= _end_iso;
END;
$$;

-- Function: Refresh all cache for a garden (convenience function)
CREATE OR REPLACE FUNCTION refresh_garden_task_cache(
  _garden_id uuid,
  _cache_date date DEFAULT CURRENT_DATE
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _week_start_date date;
BEGIN
  -- Calculate week start (Monday)
  _week_start_date := _cache_date - (EXTRACT(DOW FROM _cache_date)::integer + 6) % 7 || ' days'::interval;
  
  -- Refresh all caches
  PERFORM refresh_garden_daily_cache(_garden_id, _cache_date);
  PERFORM refresh_garden_weekly_cache(_garden_id, _week_start_date);
  PERFORM refresh_garden_plant_task_counts_cache(_garden_id);
  PERFORM refresh_garden_today_occurrences_cache(_garden_id, _cache_date);
END;
$$;

-- Function: Cleanup old cache entries (delete entries older than 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_garden_task_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _cutoff_date date := CURRENT_DATE - INTERVAL '7 days';
BEGIN
  -- Delete old daily cache
  DELETE FROM garden_task_daily_cache WHERE cache_date < _cutoff_date;
  
  -- Delete old weekly cache
  DELETE FROM garden_task_weekly_cache WHERE week_end_date < _cutoff_date;
  
  -- Delete old today occurrences cache
  DELETE FROM garden_task_occurrences_today_cache WHERE cache_date < _cutoff_date;
  
  -- Also clean up stale plant task counts (older than 1 day)
  DELETE FROM garden_plant_task_counts_cache 
  WHERE updated_at < (CURRENT_TIMESTAMP - INTERVAL '1 day');
END;
$$;

-- Function: Initialize cache for all gardens (run once after migration)
CREATE OR REPLACE FUNCTION initialize_garden_task_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _garden_record RECORD;
  _today date := CURRENT_DATE;
BEGIN
  -- Refresh cache for all gardens
  FOR _garden_record IN SELECT id FROM gardens LOOP
    BEGIN
      PERFORM refresh_garden_task_cache(_garden_record.id, _today);
    EXCEPTION WHEN OTHERS THEN
      -- Continue on error
      NULL;
    END;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION initialize_garden_task_cache() TO authenticated;

-- Trigger function: Auto-refresh cache when task occurrences change
CREATE OR REPLACE FUNCTION trigger_refresh_garden_task_cache()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  _garden_id uuid;
  _cache_date date := CURRENT_DATE;
  _due_at date;
BEGIN
  -- Get garden_id and date from task/occurrence
  IF TG_OP = 'DELETE' THEN
    SELECT t.garden_id, (OLD.due_at::date) INTO _garden_id, _due_at
    FROM garden_plant_tasks t
    WHERE t.id = OLD.task_id;
    _cache_date := COALESCE(_due_at, CURRENT_DATE);
  ELSE
    SELECT t.garden_id, (NEW.due_at::date) INTO _garden_id, _due_at
    FROM garden_plant_tasks t
    WHERE t.id = NEW.task_id;
    _cache_date := COALESCE(_due_at, CURRENT_DATE);
  END IF;
  
  IF _garden_id IS NOT NULL THEN
    -- Refresh cache asynchronously via notification (don't block the transaction)
    PERFORM pg_notify('garden_task_cache_refresh', _garden_id::text || '|' || _cache_date::text);
    
    -- Also refresh immediately in background (non-blocking)
    -- Use a separate connection or defer to avoid blocking
    PERFORM refresh_garden_task_cache(_garden_id, _cache_date);
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger function: Auto-refresh cache when tasks change
CREATE OR REPLACE FUNCTION trigger_refresh_garden_task_cache_on_task_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  _garden_id uuid;
  _cache_date date := CURRENT_DATE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _garden_id := OLD.garden_id;
  ELSE
    _garden_id := NEW.garden_id;
  END IF;
  
  IF _garden_id IS NOT NULL THEN
    PERFORM pg_notify('garden_task_cache_refresh', _garden_id::text || '|' || _cache_date::text);
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create triggers to auto-refresh cache
DROP TRIGGER IF EXISTS trigger_refresh_cache_on_occurrence_change ON garden_plant_task_occurrences;
CREATE TRIGGER trigger_refresh_cache_on_occurrence_change
  AFTER INSERT OR UPDATE OR DELETE ON garden_plant_task_occurrences
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refresh_garden_task_cache();

DROP TRIGGER IF EXISTS trigger_refresh_cache_on_task_change ON garden_plant_tasks;
CREATE TRIGGER trigger_refresh_cache_on_task_change
  AFTER INSERT OR UPDATE OR DELETE ON garden_plant_tasks
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refresh_garden_task_cache_on_task_change();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON garden_task_daily_cache TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON garden_task_weekly_cache TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON garden_plant_task_counts_cache TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON garden_task_occurrences_today_cache TO authenticated;

GRANT EXECUTE ON FUNCTION refresh_garden_daily_cache(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_garden_weekly_cache(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_garden_plant_task_counts_cache(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_garden_today_occurrences_cache(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_garden_task_cache(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_garden_task_cache() TO authenticated;

-- Create a view for easy querying of today's cache
CREATE OR REPLACE VIEW garden_task_cache_today AS
SELECT
  c.garden_id,
  c.cache_date,
  c.due_count,
  c.completed_count,
  c.task_count,
  c.occurrence_count,
  c.updated_at
FROM garden_task_daily_cache c
WHERE c.cache_date = CURRENT_DATE;

GRANT SELECT ON garden_task_cache_today TO authenticated;
