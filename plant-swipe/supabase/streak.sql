-- Add streak column to gardens (idempotent)
alter table public.gardens
  add column if not exists streak integer not null default 0;

-- Optional: index to speed up lookups
create index if not exists garden_tasks_garden_day_idx
  on public.garden_tasks (garden_id, day);

-- Compute consecutive success streak up to and including _anchor_day.
-- Missing garden_tasks rows are treated as failures.
create or replace function public.compute_garden_streak(_garden_id uuid, _anchor_day date)
returns integer
language plpgsql
as $$
declare
  d date := _anchor_day;
  s integer := 0;
  t record;
begin
  loop
    select g.day, g.success
    into t
    from public.garden_tasks g
    where g.garden_id = _garden_id
      and g.day = d
      and g.task_type = 'watering'
    limit 1;

    if t is null then
      exit; -- missing row => failed
    end if;

    if not coalesce(t.success, false) then
      exit; -- explicit failure => stop
    end if;

    s := s + 1;
    d := (d - interval '1 day')::date;
  end loop;

  return s;
end;
$$;

-- Update a single garden's streak
create or replace function public.update_garden_streak(_garden_id uuid, _anchor_day date)
returns void
language plpgsql
as $$
declare
  s integer;
begin
  s := public.compute_garden_streak(_garden_id, _anchor_day);
  update public.gardens set streak = s where id = _garden_id;
end;
$$;

-- Daily job: first update streaks (based on yesterday), then compute today's tasks
create or replace function public.compute_daily_tasks_for_all_gardens(_day date)
returns void
language plpgsql
as $$
declare
  g record;
  anchor date := (_day - interval '1 day')::date;
begin
  for g in select id from public.gardens loop
    perform public.update_garden_streak(g.id, anchor);
    perform public.compute_garden_task_for_day(g.id, _day);
  end loop;
end;
$$;

