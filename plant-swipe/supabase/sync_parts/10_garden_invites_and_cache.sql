-- ========== Garden Task Cache System ==========
-- Pre-computed task data tables to avoid expensive recalculations
-- Cache is automatically refreshed via triggers when source data changes
-- Old cache entries are cleaned up daily via scheduled jobs

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
  has_remaining_tasks boolean NOT NULL DEFAULT false, -- True if there are tasks still to do today
  all_tasks_done boolean NOT NULL DEFAULT true, -- True if all tasks for today are completed
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(garden_id, cache_date)
);

-- Ensure legacy deployments have no duplicate daily cache rows and enforce uniqueness
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'garden_task_daily_cache'
  ) THEN
    WITH daily_duplicates AS (
      SELECT id
      FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY garden_id, cache_date
                 ORDER BY updated_at DESC, created_at DESC, id DESC
               ) AS rn
        FROM garden_task_daily_cache
      ) ranked
      WHERE ranked.rn > 1
    )
    DELETE FROM garden_task_daily_cache gtdc
    USING daily_duplicates dup
    WHERE gtdc.id = dup.id;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'garden_task_daily_cache_garden_id_cache_date_key'
        AND conrelid = 'garden_task_daily_cache'::regclass
    ) THEN
      ALTER TABLE garden_task_daily_cache
        ADD CONSTRAINT garden_task_daily_cache_garden_id_cache_date_key
        UNIQUE (garden_id, cache_date);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'garden_task_daily_cache'
        AND column_name = 'has_remaining_tasks'
    ) THEN
      ALTER TABLE garden_task_daily_cache
        ADD COLUMN has_remaining_tasks boolean NOT NULL DEFAULT false;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'garden_task_daily_cache'
        AND column_name = 'all_tasks_done'
    ) THEN
      ALTER TABLE garden_task_daily_cache
        ADD COLUMN all_tasks_done boolean NOT NULL DEFAULT true;
    END IF;
  END IF;
END $$;

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

-- Ensure legacy deployments have no duplicate weekly cache rows and enforce uniqueness
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'garden_task_weekly_cache'
  ) THEN
    WITH weekly_duplicates AS (
      SELECT id
      FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY garden_id, week_start_date
                 ORDER BY updated_at DESC, created_at DESC, id DESC
               ) AS rn
        FROM garden_task_weekly_cache
      ) ranked
      WHERE ranked.rn > 1
    )
    DELETE FROM garden_task_weekly_cache gtwc
    USING weekly_duplicates dup
    WHERE gtwc.id = dup.id;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'garden_task_weekly_cache_garden_id_week_start_date_key'
        AND conrelid = 'garden_task_weekly_cache'::regclass
    ) THEN
      ALTER TABLE garden_task_weekly_cache
        ADD CONSTRAINT garden_task_weekly_cache_garden_id_week_start_date_key
        UNIQUE (garden_id, week_start_date);
    END IF;
  END IF;
END $$;

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
SET search_path = public
AS $$
DECLARE
  _start_iso timestamptz;
  _end_iso timestamptz;
  _due_count integer := 0;
  _completed_count integer := 0;
  _task_count integer := 0;
  _occurrence_count integer := 0;
  _has_remaining_tasks boolean := false;
  _all_tasks_done boolean := true;
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
  
  -- Calculate task completion status
  _has_remaining_tasks := (_due_count > 0 AND _completed_count < _due_count);
  _all_tasks_done := (_due_count = 0 OR _completed_count >= _due_count);
  
  INSERT INTO garden_task_daily_cache (garden_id, cache_date, due_count, completed_count, task_count, occurrence_count, has_remaining_tasks, all_tasks_done, updated_at)
  VALUES (_garden_id, _cache_date, _due_count, _completed_count, _task_count, _occurrence_count, _has_remaining_tasks, _all_tasks_done, now())
  ON CONFLICT (garden_id, cache_date) DO UPDATE
    SET due_count = EXCLUDED.due_count,
        completed_count = EXCLUDED.completed_count,
        task_count = EXCLUDED.task_count,
        occurrence_count = EXCLUDED.occurrence_count,
        has_remaining_tasks = EXCLUDED.has_remaining_tasks,
        all_tasks_done = EXCLUDED.all_tasks_done,
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
SET search_path = public
AS $$
DECLARE
  _week_end_date date;
  _day_idx integer;
  _day_date date;
  _totals integer[] := ARRAY[0,0,0,0,0,0,0];
  _water integer[] := ARRAY[0,0,0,0,0,0,0];
  _fertilize integer[] := ARRAY[0,0,0,0,0,0,0];
  _harvest integer[] := ARRAY[0,0,0,0,0,0,0];
  _cut integer[] := ARRAY[0,0,0,0,0,0,0];
  _custom integer[] := ARRAY[0,0,0,0,0,0,0];
  _daily_total integer;
  _daily_water integer;
  _daily_fertilize integer;
  _daily_harvest integer;
  _daily_cut integer;
  _daily_custom integer;
BEGIN
  _week_end_date := _week_start_date + INTERVAL '6 days';
  
  -- Calculate weekly statistics by day and type
  FOR _day_idx IN 0..6 LOOP
    _day_date := (_week_start_date + (_day_idx || ' days')::interval)::date;

    SELECT
      COALESCE(SUM(GREATEST(1, occ.required_count)), 0),
      COALESCE(SUM(CASE WHEN t.type = 'water' THEN GREATEST(1, occ.required_count) ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN t.type = 'fertilize' THEN GREATEST(1, occ.required_count) ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN t.type = 'harvest' THEN GREATEST(1, occ.required_count) ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN t.type = 'cut' THEN GREATEST(1, occ.required_count) ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN t.type = 'custom' THEN GREATEST(1, occ.required_count) ELSE 0 END), 0)
    INTO
      _daily_total,
      _daily_water,
      _daily_fertilize,
      _daily_harvest,
      _daily_cut,
      _daily_custom
    FROM garden_plant_task_occurrences occ
    INNER JOIN garden_plant_tasks t ON t.id = occ.task_id
    WHERE t.garden_id = _garden_id
      AND occ.due_at >= (_day_date::text || 'T00:00:00.000Z')::timestamptz
      AND occ.due_at <= (_day_date::text || 'T23:59:59.999Z')::timestamptz;

    _totals[_day_idx + 1] := COALESCE(_daily_total, 0);
    _water[_day_idx + 1] := COALESCE(_daily_water, 0);
    _fertilize[_day_idx + 1] := COALESCE(_daily_fertilize, 0);
    _harvest[_day_idx + 1] := COALESCE(_daily_harvest, 0);
    _cut[_day_idx + 1] := COALESCE(_daily_cut, 0);
    _custom[_day_idx + 1] := COALESCE(_daily_custom, 0);
  END LOOP;

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
  ON CONFLICT (garden_id, week_start_date) DO UPDATE
    SET week_end_date = EXCLUDED.week_end_date,
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
SET search_path = public
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
  GROUP BY t.garden_id, t.garden_plant_id
  ON CONFLICT (garden_id, garden_plant_id) DO UPDATE
    SET task_count = EXCLUDED.task_count,
        due_today_count = EXCLUDED.due_today_count,
        updated_at = now();

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
SET search_path = public
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
    AND occ.due_at <= _end_iso
  ON CONFLICT (garden_id, occurrence_id, cache_date) DO UPDATE
    SET task_id = EXCLUDED.task_id,
        garden_plant_id = EXCLUDED.garden_plant_id,
        task_type = EXCLUDED.task_type,
        task_emoji = EXCLUDED.task_emoji,
        due_at = EXCLUDED.due_at,
        required_count = EXCLUDED.required_count,
        completed_count = EXCLUDED.completed_count,
        completed_at = EXCLUDED.completed_at,
        updated_at = now();

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
SET search_path = public
AS $$
DECLARE
  _week_start_date date;
BEGIN
  -- Calculate week start (Monday)
  _week_start_date := date_trunc('week', _cache_date::timestamp)::date;
  
  -- Refresh all caches
  PERFORM refresh_garden_daily_cache(_garden_id, _cache_date);
  PERFORM refresh_garden_weekly_cache(_garden_id, _week_start_date);
  PERFORM refresh_garden_plant_task_counts_cache(_garden_id);
  PERFORM refresh_garden_today_occurrences_cache(_garden_id, _cache_date);
END;
$$;

-- Function: Batched occurrence loader used by Garden List/Dashboard views
CREATE OR REPLACE FUNCTION get_task_occurrences_batch(
  _task_ids uuid[],
  _start_iso timestamptz,
  _end_iso timestamptz,
  _limit_per_task integer DEFAULT 1000
)
RETURNS TABLE (
  id uuid,
  task_id uuid,
  garden_plant_id uuid,
  due_at timestamptz,
  required_count integer,
  completed_count integer,
  completed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    occ.id,
    occ.task_id,
    occ.garden_plant_id,
    occ.due_at,
    occ.required_count,
    occ.completed_count,
    occ.completed_at
  FROM (
    SELECT
      o.id,
      o.task_id,
      o.garden_plant_id,
      o.due_at,
      o.required_count,
      o.completed_count,
      o.completed_at,
      ROW_NUMBER() OVER (PARTITION BY o.task_id ORDER BY o.due_at ASC, o.id ASC) AS rn
    FROM garden_plant_task_occurrences o
    WHERE o.task_id = ANY(_task_ids)
      AND o.due_at >= _start_iso
      AND o.due_at <= _end_iso
  ) occ
  WHERE occ.rn <= GREATEST(COALESCE(_limit_per_task, 1000), 1);
END;
$$;

GRANT EXECUTE ON FUNCTION get_task_occurrences_batch(uuid[], timestamptz, timestamptz, integer) TO authenticated;

-- Function: Aggregated progress for a single garden using cache when available
DROP FUNCTION IF EXISTS public.get_garden_today_progress(uuid, timestamptz, timestamptz);
CREATE OR REPLACE FUNCTION public.get_garden_today_progress(
  _garden_id uuid,
  _start_iso timestamptz,
  _end_iso timestamptz
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cache_date date := date_trunc('day', _start_iso)::date;
  _due integer;
  _completed integer;
BEGIN
  SELECT c.due_count, c.completed_count
  INTO _due, _completed
  FROM garden_task_daily_cache c
  WHERE c.garden_id = _garden_id
    AND c.cache_date = _cache_date
  LIMIT 1;

  IF _due IS NULL THEN
    SELECT
      COALESCE(SUM(GREATEST(1, occ.required_count)), 0)::integer,
      COALESCE(SUM(LEAST(GREATEST(1, occ.required_count), COALESCE(occ.completed_count, 0))), 0)::integer
    INTO _due, _completed
    FROM garden_plant_task_occurrences occ
    INNER JOIN garden_plant_tasks t ON t.id = occ.task_id
    WHERE t.garden_id = _garden_id
      AND occ.due_at >= _start_iso
      AND occ.due_at <= _end_iso;
  END IF;

  RETURN json_build_object(
    'due', COALESCE(_due, 0),
    'completed', COALESCE(_completed, 0)
  );
END;
$$;

-- Function: Aggregated progress for multiple gardens (cache-first fallback to live data)
DROP FUNCTION IF EXISTS public.get_gardens_today_progress_batch(uuid[], timestamptz, timestamptz);
CREATE OR REPLACE FUNCTION public.get_gardens_today_progress_batch(
  _garden_ids uuid[],
  _start_iso timestamptz,
  _end_iso timestamptz
)
RETURNS TABLE (
  garden_id uuid,
  due integer,
  completed integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cache_date date := date_trunc('day', _start_iso)::date;
BEGIN
  RETURN QUERY
  WITH input_gardens AS (
    SELECT DISTINCT gid
    FROM unnest(_garden_ids) AS gid
  ),
    cache_available AS (
      SELECT
        ig.gid AS garden_id,
        c.due_count,
        c.completed_count
      FROM input_gardens ig
      LEFT JOIN garden_task_daily_cache c
        ON c.garden_id = ig.gid
       AND c.cache_date = _cache_date
    ),
    gardens_missing_cache AS (
      SELECT ca.garden_id AS missing_garden_id
      FROM cache_available ca
      WHERE ca.due_count IS NULL AND ca.completed_count IS NULL
    ),
  live_totals AS (
    SELECT
      t.garden_id,
      COALESCE(SUM(GREATEST(1, occ.required_count)), 0)::integer AS due_total,
      COALESCE(SUM(LEAST(GREATEST(1, occ.required_count), COALESCE(occ.completed_count, 0))), 0)::integer AS completed_total
    FROM garden_plant_task_occurrences occ
    INNER JOIN garden_plant_tasks t ON t.id = occ.task_id
      WHERE t.garden_id IN (SELECT gmc.missing_garden_id FROM gardens_missing_cache gmc)
      AND occ.due_at >= _start_iso
      AND occ.due_at <= _end_iso
    GROUP BY t.garden_id
  )
  SELECT
    ig.gid AS garden_id,
    COALESCE(ca.due_count, lt.due_total, 0)::integer AS due,
    COALESCE(ca.completed_count, lt.completed_total, 0)::integer AS completed
  FROM input_gardens ig
  LEFT JOIN cache_available ca ON ca.garden_id = ig.gid
  LEFT JOIN live_totals lt ON lt.garden_id = ig.gid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_garden_today_progress(uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_gardens_today_progress_batch(uuid[], timestamptz, timestamptz) TO authenticated;

-- Function: Cleanup old cache entries (delete entries older than 1 day to prevent accumulation)
CREATE OR REPLACE FUNCTION cleanup_old_garden_task_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cutoff_date date := CURRENT_DATE - INTERVAL '1 day'; -- Keep only today and yesterday
BEGIN
  -- Delete old daily cache (keep only today and yesterday)
  DELETE FROM garden_task_daily_cache WHERE cache_date < _cutoff_date;
  
  -- Delete old weekly cache (keep only current and last week)
  DELETE FROM garden_task_weekly_cache WHERE week_end_date < _cutoff_date;
  
  -- Delete old today occurrences cache (keep only today and yesterday)
  DELETE FROM garden_task_occurrences_today_cache WHERE cache_date < _cutoff_date;
  
  -- Delete old user cache (keep only today and yesterday)
  DELETE FROM user_task_daily_cache WHERE cache_date < _cutoff_date;
  
  -- Also clean up stale plant task counts (older than 1 day)
  DELETE FROM garden_plant_task_counts_cache 
  WHERE updated_at < (CURRENT_TIMESTAMP - INTERVAL '1 day');
END;
$$;

-- Schedule daily cleanup job to run at 2 AM UTC every day
-- This prevents cache accumulation and keeps database clean
DO $$
BEGIN
  BEGIN
    PERFORM cron.schedule(
      'cleanup-old-task-cache',
      '0 2 * * *',
        $_cron$SELECT cleanup_old_garden_task_cache();$_cron$
    );
  EXCEPTION
    WHEN others THEN
      NULL;
  END;
END $$;

-- Function: Initialize cache for all gardens AND users (run on startup/periodically)
CREATE OR REPLACE FUNCTION initialize_all_task_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _garden_record RECORD;
  _user_record RECORD;
  _today date := CURRENT_DATE;
BEGIN
  -- Refresh cache for all gardens first
  FOR _garden_record IN SELECT id FROM gardens LOOP
    BEGIN
      PERFORM refresh_garden_task_cache(_garden_record.id, _today);
    EXCEPTION WHEN OTHERS THEN
      -- Continue on error
      NULL;
    END;
  END LOOP;
  
  -- Then refresh user cache for all users
  FOR _user_record IN SELECT DISTINCT user_id FROM garden_members LOOP
    BEGIN
      PERFORM refresh_user_task_daily_cache(_user_record.user_id, _today);
    EXCEPTION WHEN OTHERS THEN
      -- Continue on error
      NULL;
    END;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION initialize_all_task_cache() TO authenticated;
GRANT EXECUTE ON FUNCTION initialize_all_task_cache() TO service_role;

-- Trigger function: Auto-refresh cache when task occurrences change
CREATE OR REPLACE FUNCTION trigger_refresh_garden_task_cache()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _garden_id uuid;
  _cache_date date := CURRENT_DATE;
  _due_at date;
  _garden_exists boolean;
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
    -- Skip cache refresh if the garden is being deleted (session flag set by server)
    IF current_setting('app.deleting_garden', true) = _garden_id::text THEN
      RETURN COALESCE(NEW, OLD);
    END IF;

    PERFORM refresh_garden_task_cache(_garden_id, _cache_date);
    PERFORM pg_notify('garden_task_cache_refresh', _garden_id::text || '|' || _cache_date::text);
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger function: Auto-refresh cache when tasks change
CREATE OR REPLACE FUNCTION trigger_refresh_garden_task_cache_on_task_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
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
    -- Skip cache refresh if the garden is being deleted (session flag set by server)
    IF current_setting('app.deleting_garden', true) = _garden_id::text THEN
      RETURN COALESCE(NEW, OLD);
    END IF;

    PERFORM refresh_garden_task_cache(_garden_id, _cache_date);
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

-- Enable RLS on cache tables for security
ALTER TABLE garden_task_daily_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE garden_task_weekly_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE garden_plant_task_counts_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE garden_task_occurrences_today_cache ENABLE ROW LEVEL SECURITY;

-- RLS policies for cache tables - users can only see cache for gardens they're members of
DO $$
BEGIN
  -- Policy for garden_task_daily_cache
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='garden_task_daily_cache' AND policyname='cache_select_member') THEN
    CREATE POLICY cache_select_member ON garden_task_daily_cache FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1 FROM garden_members gm
        WHERE gm.garden_id = garden_task_daily_cache.garden_id
        AND gm.user_id = auth.uid()
      ));
  END IF;
  
  -- Policy for garden_task_weekly_cache
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='garden_task_weekly_cache' AND policyname='cache_select_member') THEN
    CREATE POLICY cache_select_member ON garden_task_weekly_cache FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1 FROM garden_members gm
        WHERE gm.garden_id = garden_task_weekly_cache.garden_id
        AND gm.user_id = auth.uid()
      ));
  END IF;
  
  -- Policy for garden_plant_task_counts_cache
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='garden_plant_task_counts_cache' AND policyname='cache_select_member') THEN
    CREATE POLICY cache_select_member ON garden_plant_task_counts_cache FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1 FROM garden_members gm
        WHERE gm.garden_id = garden_plant_task_counts_cache.garden_id
        AND gm.user_id = auth.uid()
      ));
  END IF;
  
  -- Policy for garden_task_occurrences_today_cache
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='garden_task_occurrences_today_cache' AND policyname='cache_select_member') THEN
    CREATE POLICY cache_select_member ON garden_task_occurrences_today_cache FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1 FROM garden_members gm
        WHERE gm.garden_id = garden_task_occurrences_today_cache.garden_id
        AND gm.user_id = auth.uid()
      ));
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION refresh_garden_daily_cache(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_garden_weekly_cache(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_garden_plant_task_counts_cache(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_garden_today_occurrences_cache(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_garden_task_cache(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_garden_task_cache() TO authenticated;

-- Create a view for easy querying of today's cache
-- Use security_invoker to enforce RLS policies of the querying user, not the view owner
CREATE OR REPLACE VIEW garden_task_cache_today
WITH (security_invoker = true)
AS
SELECT
  c.garden_id,
  c.cache_date,
  c.due_count,
  c.completed_count,
  c.task_count,
  c.occurrence_count,
  c.has_remaining_tasks,
  c.all_tasks_done,
  c.updated_at
FROM garden_task_daily_cache c
WHERE c.cache_date = CURRENT_DATE;

GRANT SELECT ON garden_task_cache_today TO authenticated;

-- Function: Quick check if garden has remaining tasks (uses cache)
CREATE OR REPLACE FUNCTION garden_has_remaining_tasks(_garden_id uuid, _cache_date date DEFAULT CURRENT_DATE)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  _has_remaining boolean;
BEGIN
  SELECT has_remaining_tasks INTO _has_remaining
  FROM garden_task_daily_cache
  WHERE garden_id = _garden_id AND cache_date = _cache_date
  LIMIT 1;
  
  -- If cache exists, return cached value
  IF _has_remaining IS NOT NULL THEN
    RETURN _has_remaining;
  END IF;
  
  -- Fallback: compute on the fly if cache missing
  SELECT EXISTS (
    SELECT 1
    FROM garden_plant_task_occurrences occ
    INNER JOIN garden_plant_tasks t ON t.id = occ.task_id
    WHERE t.garden_id = _garden_id
      AND occ.due_at >= (_cache_date::text || 'T00:00:00.000Z')::timestamptz
      AND occ.due_at <= (_cache_date::text || 'T23:59:59.999Z')::timestamptz
      AND occ.required_count > occ.completed_count
    LIMIT 1
  ) INTO _has_remaining;
  
  RETURN COALESCE(_has_remaining, false);
END;
$$;

-- Function: Quick check if all garden tasks are done (uses cache)
CREATE OR REPLACE FUNCTION garden_all_tasks_done(_garden_id uuid, _cache_date date DEFAULT CURRENT_DATE)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  _all_done boolean;
BEGIN
  SELECT all_tasks_done INTO _all_done
  FROM garden_task_daily_cache
  WHERE garden_id = _garden_id AND cache_date = _cache_date
  LIMIT 1;
  
  -- If cache exists, return cached value
  IF _all_done IS NOT NULL THEN
    RETURN _all_done;
  END IF;
  
  -- Fallback: compute on the fly if cache missing
  SELECT NOT EXISTS (
    SELECT 1
    FROM garden_plant_task_occurrences occ
    INNER JOIN garden_plant_tasks t ON t.id = occ.task_id
    WHERE t.garden_id = _garden_id
      AND occ.due_at >= (_cache_date::text || 'T00:00:00.000Z')::timestamptz
      AND occ.due_at <= (_cache_date::text || 'T23:59:59.999Z')::timestamptz
      AND occ.required_count > occ.completed_count
    LIMIT 1
  ) INTO _all_done;
  
  RETURN COALESCE(_all_done, true);
END;
$$;

-- Function: Batch check remaining tasks for multiple gardens (uses cache)
CREATE OR REPLACE FUNCTION gardens_have_remaining_tasks(_garden_ids uuid[], _cache_date date DEFAULT CURRENT_DATE)
RETURNS TABLE (
  garden_id uuid,
  has_remaining_tasks boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.garden_id,
    c.has_remaining_tasks
  FROM garden_task_daily_cache c
  WHERE c.garden_id = ANY(_garden_ids)
    AND c.cache_date = _cache_date;
  
  -- Fill in missing gardens with computed values
  RETURN QUERY
  SELECT
    g.id as garden_id,
    EXISTS (
      SELECT 1
      FROM garden_plant_task_occurrences occ
      INNER JOIN garden_plant_tasks t ON t.id = occ.task_id
      WHERE t.garden_id = g.id
        AND occ.due_at >= (_cache_date::text || 'T00:00:00.000Z')::timestamptz
        AND occ.due_at <= (_cache_date::text || 'T23:59:59.999Z')::timestamptz
        AND occ.required_count > occ.completed_count
      LIMIT 1
    ) as has_remaining_tasks
  FROM unnest(_garden_ids) g(id)
  WHERE NOT EXISTS (
    SELECT 1 FROM garden_task_daily_cache c2
    WHERE c2.garden_id = g.id AND c2.cache_date = _cache_date
  );
END;
$$;

GRANT EXECUTE ON FUNCTION garden_has_remaining_tasks(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION garden_all_tasks_done(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION gardens_have_remaining_tasks(uuid[], date) TO authenticated;

-- ========== User-level task cache (aggregates across all user's gardens) ==========

-- Cache table for user-level task statistics (total tasks across all gardens)
CREATE TABLE IF NOT EXISTS user_task_daily_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cache_date date NOT NULL, -- YYYY-MM-DD format
  total_due_count integer NOT NULL DEFAULT 0, -- Total tasks due across all gardens
  total_completed_count integer NOT NULL DEFAULT 0, -- Total completed across all gardens
  gardens_with_remaining_tasks integer NOT NULL DEFAULT 0, -- Number of gardens with remaining tasks
  total_gardens integer NOT NULL DEFAULT 0, -- Total number of gardens user is member of
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, cache_date)
);

-- Ensure legacy deployments have no duplicate user cache rows
WITH user_duplicates AS (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY user_id, cache_date
             ORDER BY updated_at DESC, created_at DESC, id DESC
           ) AS rn
    FROM user_task_daily_cache
  ) ranked
  WHERE ranked.rn > 1
)
DELETE FROM user_task_daily_cache utdc
USING user_duplicates dup
WHERE utdc.id = dup.id;

-- Ensure uniqueness for user cache rows on legacy deployments
CREATE UNIQUE INDEX IF NOT EXISTS user_task_daily_cache_user_id_cache_date_key
  ON user_task_daily_cache (user_id, cache_date);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_task_daily_cache_user_date ON user_task_daily_cache(user_id, cache_date DESC);

-- Function: Refresh user-level cache for a user and date
CREATE OR REPLACE FUNCTION refresh_user_task_daily_cache(
  _user_id uuid,
  _cache_date date DEFAULT CURRENT_DATE
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _total_due integer := 0;
  _total_completed integer := 0;
  _gardens_with_remaining integer := 0;
  _total_gardens integer := 0;
BEGIN
  -- Get all gardens user is a member of
  SELECT COUNT(*) INTO _total_gardens
  FROM garden_members
  WHERE user_id = _user_id;
  
  -- Aggregate task counts from garden cache
  SELECT 
    COALESCE(SUM(due_count), 0),
    COALESCE(SUM(completed_count), 0),
    COUNT(*) FILTER (WHERE has_remaining_tasks = true)
  INTO _total_due, _total_completed, _gardens_with_remaining
  FROM garden_task_daily_cache c
  INNER JOIN garden_members gm ON gm.garden_id = c.garden_id
  WHERE gm.user_id = _user_id
    AND c.cache_date = _cache_date;
  
  INSERT INTO user_task_daily_cache (
    user_id,
    cache_date,
    total_due_count,
    total_completed_count,
    gardens_with_remaining_tasks,
    total_gardens,
    updated_at
  )
  VALUES (
    _user_id,
    _cache_date,
    _total_due,
    _total_completed,
    _gardens_with_remaining,
    _total_gardens,
    now()
  )
  ON CONFLICT (user_id, cache_date) DO UPDATE
    SET total_due_count = EXCLUDED.total_due_count,
        total_completed_count = EXCLUDED.total_completed_count,
        gardens_with_remaining_tasks = EXCLUDED.gardens_with_remaining_tasks,
        total_gardens = EXCLUDED.total_gardens,
        updated_at = now();

END;
$$;

-- Function: Get user's cached task counts (ONLY reads from cache, never computes)
CREATE OR REPLACE FUNCTION get_user_tasks_today_cached(
  _user_id uuid,
  _cache_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  total_due_count integer,
  total_completed_count integer,
  gardens_with_remaining_tasks integer,
  total_gardens integer
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  _cached RECORD;
BEGIN
  -- ONLY read from cache - never compute
  SELECT 
    total_due_count,
    total_completed_count,
    gardens_with_remaining_tasks,
    total_gardens
  INTO _cached
  FROM user_task_daily_cache
  WHERE user_id = _user_id AND cache_date = _cache_date
  LIMIT 1;
  
  -- If cache exists, return it (even if stale - we'll refresh in background)
  IF _cached IS NOT NULL THEN
    RETURN QUERY SELECT 
      _cached.total_due_count,
      _cached.total_completed_count,
      _cached.gardens_with_remaining_tasks,
      _cached.total_gardens;
    RETURN;
  END IF;
  
  -- If cache doesn't exist, return zeros and trigger background refresh
  -- This ensures instant response even if cache is missing
  PERFORM pg_notify('user_task_cache_refresh', _user_id::text || '|' || _cache_date::text);
  
  RETURN QUERY SELECT 
    0::integer as total_due_count,
    0::integer as total_completed_count,
    0::integer as gardens_with_remaining_tasks,
    0::integer as total_gardens;
END;
$$;

-- Function: Get per-garden task counts for a user (ONLY reads from cache, never computes)
CREATE OR REPLACE FUNCTION get_user_gardens_tasks_today_cached(
  _user_id uuid,
  _cache_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  garden_id uuid,
  garden_name text,
  due_count integer,
  completed_count integer,
  has_remaining_tasks boolean,
  all_tasks_done boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  -- ONLY read from cache - never compute
  -- Join with gardens to get names, but only return cached data
  RETURN QUERY
  SELECT 
    g.id as garden_id,
    g.name as garden_name,
    COALESCE(c.due_count, 0)::integer as due_count,
    COALESCE(c.completed_count, 0)::integer as completed_count,
    COALESCE(c.has_remaining_tasks, false) as has_remaining_tasks,
    COALESCE(c.all_tasks_done, true) as all_tasks_done
  FROM garden_members gm
  INNER JOIN gardens g ON g.id = gm.garden_id
  LEFT JOIN garden_task_daily_cache c ON c.garden_id = g.id AND c.cache_date = _cache_date
  WHERE gm.user_id = _user_id
  ORDER BY g.name;
  
  -- If any gardens don't have cache, trigger background refresh
  -- But don't block - return what we have
  IF EXISTS (
    SELECT 1 FROM garden_members gm2
    LEFT JOIN garden_task_daily_cache c2 ON c2.garden_id = gm2.garden_id AND c2.cache_date = _cache_date
    WHERE gm2.user_id = _user_id AND c2.garden_id IS NULL
  ) THEN
    PERFORM pg_notify('garden_task_cache_refresh', _user_id::text || '|' || _cache_date::text);
  END IF;
END;
$$;

-- Trigger function: Refresh user cache when garden cache changes
CREATE OR REPLACE FUNCTION trigger_refresh_user_task_cache()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _user_record RECORD;
  _cache_date date;
BEGIN
  -- Get cache date from the change
  IF TG_OP = 'DELETE' THEN
    _cache_date := OLD.cache_date;
  ELSE
    _cache_date := NEW.cache_date;
  END IF;
  
  -- Refresh cache for all users who are members of this garden
  -- Do this SYNCHRONOUSLY to ensure cache is always ready
  FOR _user_record IN 
    SELECT DISTINCT user_id 
    FROM garden_members 
    WHERE garden_id = COALESCE(NEW.garden_id, OLD.garden_id)
  LOOP
    -- Refresh immediately (synchronous) to ensure cache is ready
    PERFORM refresh_user_task_daily_cache(_user_record.user_id, _cache_date);
    
    -- Also notify for async operations
    PERFORM pg_notify('user_task_cache_refresh', _user_record.user_id::text || '|' || _cache_date::text);
  END LOOP;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger to refresh user cache when garden cache changes
DROP TRIGGER IF EXISTS trigger_refresh_user_cache_on_garden_cache_change ON garden_task_daily_cache;
CREATE TRIGGER trigger_refresh_user_cache_on_garden_cache_change
  AFTER INSERT OR UPDATE ON garden_task_daily_cache
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refresh_user_task_cache();

-- Trigger to refresh user cache when garden membership changes
CREATE OR REPLACE FUNCTION trigger_refresh_user_cache_on_membership_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _garden_id uuid;
  _cache_date date := CURRENT_DATE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _user_id := OLD.user_id;
    _garden_id := OLD.garden_id;
  ELSE
    _user_id := NEW.user_id;
    _garden_id := NEW.garden_id;
  END IF;
  
  -- Skip cache refresh if the garden is being deleted
  IF current_setting('app.deleting_garden', true) = _garden_id::text THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF _user_id IS NOT NULL THEN
    PERFORM refresh_user_task_daily_cache(_user_id, _cache_date);
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_refresh_user_cache_on_membership_change ON garden_members;
CREATE TRIGGER trigger_refresh_user_cache_on_membership_change
  AFTER INSERT OR DELETE ON garden_members
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refresh_user_cache_on_membership_change();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON user_task_daily_cache TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_user_task_daily_cache(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_tasks_today_cached(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_gardens_tasks_today_cached(uuid, date) TO authenticated;

-- Enable RLS on user cache table
ALTER TABLE user_task_daily_cache ENABLE ROW LEVEL SECURITY;

-- RLS policy for user_task_daily_cache - users can only see their own cache
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_task_daily_cache' AND policyname='user_cache_select_self') THEN
    CREATE POLICY user_cache_select_self ON user_task_daily_cache FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

-- Initialize cache for all gardens and users (runs automatically when script executes)
-- This ensures cache is populated immediately after schema setup
SELECT initialize_all_task_cache();

