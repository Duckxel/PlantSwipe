-- PostgreSQL RPC functions to minimize Supabase egress
-- These functions perform aggregations server-side, returning only minimal data

-- Function: Get garden today progress (single garden)
-- Returns only 2 numbers instead of fetching all occurrence rows
CREATE OR REPLACE FUNCTION get_garden_today_progress(
  _garden_id uuid,
  _start_iso timestamptz,
  _end_iso timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _due integer := 0;
  _completed integer := 0;
BEGIN
  SELECT
    COALESCE(SUM(GREATEST(1, required_count)), 0),
    COALESCE(SUM(LEAST(GREATEST(1, required_count), completed_count)), 0)
  INTO _due, _completed
  FROM garden_plant_task_occurrences occ
  INNER JOIN garden_plant_tasks t ON t.id = occ.task_id
  WHERE t.garden_id = _garden_id
    AND occ.due_at >= _start_iso
    AND occ.due_at <= _end_iso;
  
  RETURN jsonb_build_object(
    'due', _due,
    'completed', _completed
  );
END;
$$;

-- Function: Get gardens today progress (batched for multiple gardens)
-- Returns minimal data: garden_id, due, completed for each garden
CREATE OR REPLACE FUNCTION get_gardens_today_progress_batch(
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
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.garden_id,
    COALESCE(SUM(GREATEST(1, occ.required_count)), 0)::integer as due,
    COALESCE(SUM(LEAST(GREATEST(1, occ.required_count), occ.completed_count)), 0)::integer as completed
  FROM garden_plant_task_occurrences occ
  INNER JOIN garden_plant_tasks t ON t.id = occ.task_id
  WHERE t.garden_id = ANY(_garden_ids)
    AND occ.due_at >= _start_iso
    AND occ.due_at <= _end_iso
  GROUP BY t.garden_id;
END;
$$;

-- Function: Get task occurrences batch (optimized for multiple tasks)
-- Returns only essential fields with limit per task
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
      occ.*,
      ROW_NUMBER() OVER (PARTITION BY occ.task_id ORDER BY occ.due_at ASC) as rn
    FROM garden_plant_task_occurrences occ
    WHERE occ.task_id = ANY(_task_ids)
      AND occ.due_at >= _start_iso
      AND occ.due_at <= _end_iso
  ) occ
  WHERE occ.rn <= _limit_per_task
  ORDER BY occ.due_at ASC;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_garden_today_progress(uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION get_gardens_today_progress_batch(uuid[], timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION get_task_occurrences_batch(uuid[], timestamptz, timestamptz, integer) TO authenticated;
