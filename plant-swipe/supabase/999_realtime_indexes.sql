-- Realtime support indexes for Plant Swipe
-- Keep this file idempotent; safe to rerun.

create index if not exists gp_garden_idx on public.garden_plants (garden_id);
create index if not exists gm_garden_user_idx on public.garden_members (garden_id, user_id);
create index if not exists gpt_garden_idx on public.garden_plant_tasks (garden_id);
create index if not exists gpto_task_due_idx on public.garden_plant_task_occurrences (task_id, due_at);
