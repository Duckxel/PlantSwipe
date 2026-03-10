-- Indexes to speed up task occurrence queries that filter by due_at date range
-- and look for incomplete tasks.  These are the hottest query patterns in the
-- task notification system and garden task views.

-- Composite index on (due_at, completed_at) – covers the "incomplete tasks today" query
CREATE INDEX IF NOT EXISTS idx_task_occurrences_due_completed
  ON public.garden_plant_task_occurrences (due_at, completed_at);

-- Index on garden_plant_task_id for the inner-join to garden_plant_tasks
CREATE INDEX IF NOT EXISTS idx_task_occurrences_task_id
  ON public.garden_plant_task_occurrences (garden_plant_task_id);

-- Index on garden_plant_tasks(garden_id) used in task queries joining to gardens
CREATE INDEX IF NOT EXISTS idx_garden_plant_tasks_garden_id
  ON public.garden_plant_tasks (garden_id);
