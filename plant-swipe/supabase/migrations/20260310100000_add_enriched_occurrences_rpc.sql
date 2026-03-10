-- RPC function that returns task occurrences pre-enriched with task metadata
-- (type, emoji) in a single query.  This eliminates the need for the client
-- to first fetch all tasks, then fetch occurrences, then merge them in JS.
-- Used by GardenListPage to collapse 3 sequential round-trips into 1.

CREATE OR REPLACE FUNCTION public.get_enriched_occurrences_for_gardens(
  _garden_ids uuid[],
  _start_iso timestamptz,
  _end_iso timestamptz
)
RETURNS TABLE (
  id uuid,
  task_id uuid,
  garden_plant_id uuid,
  garden_id uuid,
  due_at timestamptz,
  required_count integer,
  completed_count integer,
  completed_at timestamptz,
  task_type text,
  task_emoji text
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
    t.garden_id,
    occ.due_at,
    occ.required_count,
    occ.completed_count,
    occ.completed_at,
    t.type::text AS task_type,
    t.emoji::text AS task_emoji
  FROM garden_plant_task_occurrences occ
  INNER JOIN garden_plant_tasks t ON t.id = occ.task_id
  WHERE t.garden_id = ANY(_garden_ids)
    AND occ.due_at >= _start_iso
    AND occ.due_at <= _end_iso
  ORDER BY occ.due_at ASC, occ.id ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_enriched_occurrences_for_gardens(uuid[], timestamptz, timestamptz) TO authenticated;
