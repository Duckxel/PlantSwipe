-- Gardens schema for Supabase

-- Enable required extension for gen_random_uuid()
create extension if not exists pgcrypto;

create table if not exists public.gardens (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cover_image_url text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.garden_members (
  garden_id uuid not null references public.gardens(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key (garden_id, user_id)
);

-- Also relate members to our public.profiles table for easy joins
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'garden_members_user_id_profiles_fk'
  ) then
    alter table public.garden_members
      add constraint garden_members_user_id_profiles_fk
      foreign key (user_id) references public.profiles(id) on delete cascade;
  end if;
end $$;

-- ===== Watering schedule definitions used by the app =====

-- Per-plant pattern configuration
create table if not exists public.garden_plant_schedule (
  garden_plant_id uuid primary key references public.garden_plants(id) on delete cascade,
  period text not null check (period in ('week','month','year')),
  amount integer not null default 1 check (amount > 0),
  weekly_days integer[],
  monthly_days integer[],
  yearly_days text[],
  monthly_nth_weekdays text[]
);

alter table public.garden_plant_schedule enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'garden_plant_schedule' and policyname = 'gps_select') then
    create policy gps_select on public.garden_plant_schedule for select to authenticated
      using (
        exists (
          select 1 from public.garden_plants gp
          join public.garden_members gm on gm.garden_id = gp.garden_id
          where gp.id = garden_plant_id and gm.user_id = auth.uid()
        )
      );
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'garden_plant_schedule' and policyname = 'gps_iud') then
    create policy gps_iud on public.garden_plant_schedule for all to authenticated
      using (
        exists (
          select 1 from public.garden_plants gp
          join public.garden_members gm on gm.garden_id = gp.garden_id
          where gp.id = garden_plant_id and gm.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1 from public.garden_plants gp
          join public.garden_members gm on gm.garden_id = gp.garden_id
          where gp.id = garden_plant_id and gm.user_id = auth.uid()
        )
      );
  end if;
end $$;

-- Per-day materialized schedule
create table if not exists public.garden_watering_schedule (
  id uuid primary key default gen_random_uuid(),
  garden_plant_id uuid not null references public.garden_plants(id) on delete cascade,
  due_date date not null,
  completed_at timestamptz
);

create index if not exists gws_plant_due_idx on public.garden_watering_schedule (garden_plant_id, due_date);
alter table public.garden_watering_schedule enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'garden_watering_schedule' and policyname = 'gws_select') then
    create policy gws_select on public.garden_watering_schedule for select to authenticated
      using (
        exists (
          select 1 from public.garden_plants gp
          join public.garden_members gm on gm.garden_id = gp.garden_id
          where gp.id = garden_plant_id and gm.user_id = auth.uid()
        )
      );
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'garden_watering_schedule' and policyname = 'gws_iud') then
    create policy gws_iud on public.garden_watering_schedule for all to authenticated
      using (
        exists (
          select 1 from public.garden_plants gp
          join public.garden_members gm on gm.garden_id = gp.garden_id
          where gp.id = garden_plant_id and gm.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1 from public.garden_plants gp
          join public.garden_members gm on gm.garden_id = gp.garden_id
          where gp.id = garden_plant_id and gm.user_id = auth.uid()
        )
      );
  end if;
end $$;

-- Simple server time helper
create or replace function public.get_server_now()
returns timestamptz
language sql
stable
as $$
  select now();
$$;

-- Reseed future schedule entries for a plant
create or replace function public.reseed_watering_schedule(_garden_plant_id uuid, _days_ahead integer default 60)
returns void
language plpgsql
security definer
as $$
declare
  v_gp record;
  v_def record;
  d date := (now() at time zone 'utc')::date;
  end_day date := ((now() at time zone 'utc')::date + make_interval(days => greatest(1, coalesce(_days_ahead, 60))))::date;
  weekday int;
  ymd text;
  week_index int;
begin
  delete from public.garden_watering_schedule where garden_plant_id = _garden_plant_id and due_date >= d;

  select gp.id, gp.override_water_freq_unit, gp.override_water_freq_value into v_gp
  from public.garden_plants gp where gp.id = _garden_plant_id;

  select gps.period, gps.amount, gps.weekly_days, gps.monthly_days, gps.yearly_days, gps.monthly_nth_weekdays
  into v_def
  from public.garden_plant_schedule gps where gps.garden_plant_id = _garden_plant_id;

  while d <= end_day loop
    weekday := extract(dow from d);
    ymd := to_char(d, 'MM-DD');
    week_index := floor((extract(day from d) - 1) / 7) + 1;

    if v_def is not null then
      if v_def.period = 'week' then
        if v_def.weekly_days is not null and weekday = any(v_def.weekly_days) then
          insert into public.garden_watering_schedule (garden_plant_id, due_date) values (_garden_plant_id, d);
        end if;
      elsif v_def.period = 'month' then
        if v_def.monthly_days is not null and (extract(day from d))::int = any(v_def.monthly_days) then
          insert into public.garden_watering_schedule (garden_plant_id, due_date) values (_garden_plant_id, d);
        elsif v_def.monthly_nth_weekdays is not null then
          if (week_index >= 1 and week_index <= 4) then
            if (week_index::text || '-' || weekday::text) = any(v_def.monthly_nth_weekdays) then
              insert into public.garden_watering_schedule (garden_plant_id, due_date) values (_garden_plant_id, d);
            end if;
          end if;
        end if;
      elsif v_def.period = 'year' then
        if v_def.yearly_days is not null and ymd = any(v_def.yearly_days) then
          insert into public.garden_watering_schedule (garden_plant_id, due_date) values (_garden_plant_id, d);
        end if;
      end if;
    elsif v_gp.override_water_freq_unit is not null and v_gp.override_water_freq_value is not null then
      if v_gp.override_water_freq_unit = 'day' then
        if ((d - (now() at time zone 'utc')::date) % greatest(1, v_gp.override_water_freq_value)) = 0 then
          insert into public.garden_watering_schedule (garden_plant_id, due_date) values (_garden_plant_id, d);
        end if;
      elsif v_gp.override_water_freq_unit = 'week' then
        if weekday = extract(dow from (now() at time zone 'utc')::date) then
          if (floor(extract(epoch from (d - (now() at time zone 'utc')::date)) / (7*24*3600)))::int % greatest(1, v_gp.override_water_freq_value) = 0 then
            insert into public.garden_watering_schedule (garden_plant_id, due_date) values (_garden_plant_id, d);
          end if;
        end if;
      elsif v_gp.override_water_freq_unit = 'month' then
        if extract(day from d) = extract(day from (now() at time zone 'utc')::date) then
          insert into public.garden_watering_schedule (garden_plant_id, due_date) values (_garden_plant_id, d);
        end if;
      elsif v_gp.override_water_freq_unit = 'year' then
        if to_char(d, 'MM-DD') = to_char((now() at time zone 'utc')::date, 'MM-DD') then
          insert into public.garden_watering_schedule (garden_plant_id, due_date) values (_garden_plant_id, d);
        end if;
      end if;
    end if;

    d := d + 1;
  end loop;
end;
$$;

-- Mark today's schedule complete for a plant
create or replace function public.mark_garden_plant_watered(_garden_plant_id uuid, _at timestamptz default now())
returns void
language plpgsql
security definer
as $$
declare
  v_day date := (_at at time zone 'utc')::date;
  v_id uuid;
begin
  select id into v_id from public.garden_watering_schedule where garden_plant_id = _garden_plant_id and due_date = v_day limit 1;
  if v_id is null then
    insert into public.garden_watering_schedule (garden_plant_id, due_date, completed_at)
    values (_garden_plant_id, v_day, _at);
  else
    update public.garden_watering_schedule set completed_at = _at where id = v_id;
  end if;
end;
$$;

-- Compute per-garden success for a specific day
create or replace function public.compute_garden_task_for_day(_garden_id uuid, _day date)
returns void
language plpgsql
security definer
as $$
declare
  plant_ids uuid[];
  due_count int;
  done_count int;
begin
  select array_agg(gp.id) into plant_ids from public.garden_plants gp where gp.garden_id = _garden_id;
  if plant_ids is null or array_length(plant_ids,1) is null then
    perform public.touch_garden_task(_garden_id, _day, null, true);
    return;
  end if;
  select count(*) into due_count from public.garden_watering_schedule where garden_plant_id = any(plant_ids) and due_date = _day;
  select count(*) into done_count from public.garden_watering_schedule where garden_plant_id = any(plant_ids) and due_date = _day and completed_at is not null;
  perform public.touch_garden_task(_garden_id, _day, null, (done_count >= due_count));
end;
$$;

create table if not exists public.garden_plants (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  plant_id text not null references public.plants(id) on delete cascade,
  nickname text,
  seeds_planted integer not null default 0,
  planted_at timestamptz,
  expected_bloom_date timestamptz,
  plants_on_hand integer not null default 0
);

create table if not exists public.garden_plant_events (
  id uuid primary key default gen_random_uuid(),
  garden_plant_id uuid not null references public.garden_plants(id) on delete cascade,
  event_type text not null check (event_type in ('water','fertilize','prune','harvest','note')),
  occurred_at timestamptz not null default now(),
  notes text,
  next_due_at timestamptz
);

create table if not exists public.garden_inventory (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  plant_id text not null references public.plants(id) on delete cascade,
  seeds_on_hand integer not null default 0,
  plants_on_hand integer not null default 0,
  unique (garden_id, plant_id)
);

-- Per-instance inventory to track counts per garden_plant (not per species)
create table if not exists public.garden_instance_inventory (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  garden_plant_id uuid not null references public.garden_plants(id) on delete cascade,
  seeds_on_hand integer not null default 0,
  plants_on_hand integer not null default 0,
  unique (garden_plant_id)
);

create table if not exists public.garden_transactions (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  plant_id text not null references public.plants(id) on delete cascade,
  type text not null check (type in ('buy_seeds','sell_seeds','buy_plants','sell_plants')),
  quantity integer not null check (quantity >= 0),
  occurred_at timestamptz not null default now(),
  notes text
);

-- Daily garden tasks to drive overview (success per-day per-garden)
create table if not exists public.garden_tasks (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  day date not null,
  task_type text not null check (task_type in ('watering')),
  garden_plant_ids uuid[] not null default '{}',
  success boolean not null default false,
  unique (garden_id, day, task_type)
);

alter table public.garden_tasks enable row level security;

-- RLS for tasks
drop policy if exists gtasks_select on public.garden_tasks;
drop policy if exists gtasks_iud on public.garden_tasks;
create policy gtasks_select on public.garden_tasks for select to authenticated
  using (exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = auth.uid()));
create policy gtasks_iud on public.garden_tasks for all to authenticated
  using (exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = auth.uid()))
  with check (exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = auth.uid()));

-- Helper to upsert/mark success based on schedule completion
create or replace function public.touch_garden_task(_garden_id uuid, _day date, _plant_id uuid default null, _set_success boolean default null)
returns void
language plpgsql
security definer
as $$
declare
  v_id uuid;
  v_ids uuid[];
  v_succ boolean;
begin
  select id, garden_plant_ids, success into v_id, v_ids, v_succ
  from public.garden_tasks
  where garden_id = _garden_id and day = _day and task_type = 'watering';

  if v_id is null then
    insert into public.garden_tasks (garden_id, day, task_type, garden_plant_ids, success)
    values (_garden_id, _day, 'watering', coalesce(array[_plant_id], '{}'::uuid[]), coalesce(_set_success, _plant_id is null));
  else
    if _plant_id is not null then
      update public.garden_tasks
        set garden_plant_ids = (case when not _plant_id = any(garden_plant_ids) then array_append(garden_plant_ids, _plant_id) else garden_plant_ids end),
            success = coalesce(_set_success, success)
      where id = v_id;
    else
      update public.garden_tasks
        set success = coalesce(_set_success, success)
      where id = v_id;
    end if;
  end if;
end;
$$;

-- Backfill: ensure plants_on_hand exists for existing deployments
alter table if exists public.garden_plants
  add column if not exists plants_on_hand integer not null default 0;
-- Additional columns used by the app
alter table if exists public.garden_plants
  add column if not exists override_water_freq_unit text check (override_water_freq_unit in ('day','week','month','year'));
alter table if exists public.garden_plants
  add column if not exists override_water_freq_value integer;
alter table if exists public.garden_plants
  add column if not exists sort_index integer;

-- Ensure an empty task exists for all gardens for a given day
create or replace function public.ensure_daily_tasks_for_gardens(_day date default now()::date)
returns void
language sql
security definer
as $$
  insert into public.garden_tasks (garden_id, day, task_type, garden_plant_ids, success)
  select g.id, _day, 'watering', '{}'::uuid[], true
  from public.gardens g
  on conflict (garden_id, day, task_type) do nothing;
  -- For any existing empty tasks on that day, ensure they are marked successful
  update public.garden_tasks
    set success = true
  where day = _day and task_type = 'watering' and coalesce(array_length(garden_plant_ids, 1), 0) = 0;
$$;

-- RLS
alter table public.gardens enable row level security;
alter table public.garden_members enable row level security;
alter table public.garden_plants enable row level security;
alter table public.garden_plant_events enable row level security;
alter table public.garden_inventory enable row level security;
alter table public.garden_transactions enable row level security;

-- Helper functions to avoid RLS self-recursion on garden_members
create or replace function public.is_garden_member_bypass(_garden_id uuid, _user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.garden_members
    where garden_id = _garden_id and user_id = _user_id
  );
$$;

create or replace function public.is_garden_owner_bypass(_garden_id uuid, _user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.garden_members
    where garden_id = _garden_id and user_id = _user_id and role = 'owner'
  );
$$;

-- Policies
-- Gardens: members can select; owners can update/delete; authenticated can insert own garden
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'gardens' and policyname = 'gardens_select') then
    create policy gardens_select on public.gardens for select
      using (exists (select 1 from public.garden_members gm where gm.garden_id = id and gm.user_id = auth.uid()));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'gardens' and policyname = 'gardens_insert') then
    create policy gardens_insert on public.gardens for insert to authenticated
      with check (created_by = auth.uid());
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'gardens' and policyname = 'gardens_update') then
    create policy gardens_update on public.gardens for update to authenticated
      using (created_by = auth.uid());
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'gardens' and policyname = 'gardens_delete') then
    create policy gardens_delete on public.gardens for delete to authenticated
      using (created_by = auth.uid());
  end if;
end $$;

-- Non-recursive policies for garden_members
do $$ begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'garden_members' and policyname = 'gm_select') then
    drop policy gm_select on public.garden_members;
  end if;
  create policy gm_select on public.garden_members for select to authenticated
    using (public.is_garden_member_bypass(garden_id, auth.uid()));
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'garden_members' and policyname = 'gm_insert') then
    drop policy gm_insert on public.garden_members;
  end if;
  create policy gm_insert on public.garden_members for insert to authenticated
    with check (public.is_garden_owner_bypass(garden_id, auth.uid()) and user_id is not null);
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'garden_members' and policyname = 'gm_delete') then
    drop policy gm_delete on public.garden_members;
  end if;
  create policy gm_delete on public.garden_members for delete to authenticated
    using (role <> 'owner' and (user_id = auth.uid() or public.is_garden_owner_bypass(garden_id, auth.uid())));
end $$;

-- Allow owners to update members (e.g., promote to owner)
do $$ begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'garden_members' and policyname = 'gm_update') then
    drop policy gm_update on public.garden_members;
  end if;
  create policy gm_update on public.garden_members for update to authenticated
    using (public.is_garden_owner_bypass(garden_id, auth.uid()))
    with check (public.is_garden_owner_bypass(garden_id, auth.uid()));
end $$;

-- Garden plants: members can select; members can insert/update/delete
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'garden_plants' and policyname = 'gp_select') then
    create policy gp_select on public.garden_plants for select
      using (exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = auth.uid()));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'garden_plants' and policyname = 'gp_iud') then
    create policy gp_iud on public.garden_plants for all to authenticated
      using (exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = auth.uid()))
      with check (exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = auth.uid()));
  end if;
end $$;

-- Helper RPCs
-- Resolve an auth user id by email (case-insensitive)
create or replace function public.get_user_id_by_email(_email text)
returns uuid
language sql
security definer
set search_path = public
as $$
  select id from auth.users where email ilike _email limit 1;
$$;

-- Return profiles (id, display_name) for all members of a garden
create or replace function public.get_profiles_for_garden(_garden_id uuid)
returns table(user_id uuid, display_name text)
language sql
security definer
set search_path = public
as $$
  select p.id as user_id, p.display_name
  from public.garden_members gm
  join public.profiles p on p.id = gm.user_id
  where gm.garden_id = _garden_id;
$$;

-- Ensure per-instance inventory rows exist for all garden_plants in a garden
create or replace function public.ensure_instance_inventory_for_garden(_garden_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.garden_instance_inventory (garden_id, garden_plant_id, seeds_on_hand, plants_on_hand)
  select gp.garden_id, gp.id, 0, 0
  from public.garden_plants gp
  where gp.garden_id = _garden_id
    and not exists (
      select 1 from public.garden_instance_inventory gii where gii.garden_plant_id = gp.id
    );
$$;

-- Events: members can select/insert
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'garden_plant_events' and policyname = 'gpe_select') then
    create policy gpe_select on public.garden_plant_events for select
      using (exists (select 1 from public.garden_plants gp where gp.id = garden_plant_id and exists (select 1 from public.garden_members gm where gm.garden_id = gp.garden_id and gm.user_id = auth.uid())));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'garden_plant_events' and policyname = 'gpe_insert') then
    create policy gpe_insert on public.garden_plant_events for insert to authenticated
      with check (exists (select 1 from public.garden_plants gp where gp.id = garden_plant_id and exists (select 1 from public.garden_members gm where gm.garden_id = gp.garden_id and gm.user_id = auth.uid())));
  end if;
end $$;

-- Inventory: members can select/insert/update
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'garden_inventory' and policyname = 'gi_select') then
    create policy gi_select on public.garden_inventory for select
      using (exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = auth.uid()));
  end if;
end $$;

-- Instance inventory policies
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'garden_instance_inventory' and policyname = 'gii_select') then
    create policy gii_select on public.garden_instance_inventory for select
      using (exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = auth.uid()));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'garden_instance_inventory' and policyname = 'gii_iud') then
    create policy gii_iud on public.garden_instance_inventory for all to authenticated
      using (exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = auth.uid()))
      with check (exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = auth.uid()));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'garden_inventory' and policyname = 'gi_iud') then
    create policy gi_iud on public.garden_inventory for all to authenticated
      using (exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = auth.uid()))
      with check (exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = auth.uid()));
  end if;
end $$;

-- Transactions: members can select; insert allowed for members
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'garden_transactions' and policyname = 'gt_select') then
    create policy gt_select on public.garden_transactions for select
      using (exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = auth.uid()));
  end if;
end $$;

-- ===== Generic per-plant Tasks (v2) =====

-- Task definitions per garden plant
create table if not exists public.garden_plant_tasks (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  garden_plant_id uuid not null references public.garden_plants(id) on delete cascade,
  type text not null check (type in ('water','fertilize','harvest','custom')),
  custom_name text,
  schedule_kind text not null check (schedule_kind in ('one_time_date','one_time_duration','repeat_duration','repeat_pattern')),
  due_at timestamptz,
  interval_amount integer,
  interval_unit text check (interval_unit in ('hour','day','week','month','year')),
  required_count integer not null default 1 check (required_count > 0),
  -- Pattern-based repetition fields (for schedule_kind = 'repeat_pattern')
  period text check (period in ('week','month','year')),
  amount integer check (amount > 0),
  weekly_days integer[],
  monthly_days integer[],
  yearly_days text[],
  monthly_nth_weekdays text[],
  created_at timestamptz not null default now()
);

alter table public.garden_plant_tasks enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'garden_plant_tasks' and policyname = 'gpt_select') then
    create policy gpt_select on public.garden_plant_tasks for select to authenticated
      using (exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = auth.uid()));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'garden_plant_tasks' and policyname = 'gpt_iud') then
    create policy gpt_iud on public.garden_plant_tasks for all to authenticated
      using (exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = auth.uid()))
      with check (exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = auth.uid()));
  end if;
end $$;

-- Task occurrences (instances) derived from definitions or one-offs
create table if not exists public.garden_plant_task_occurrences (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.garden_plant_tasks(id) on delete cascade,
  garden_plant_id uuid not null references public.garden_plants(id) on delete cascade,
  due_at timestamptz not null,
  required_count integer not null default 1 check (required_count > 0),
  completed_count integer not null default 0 check (completed_count >= 0),
  completed_at timestamptz
);

alter table public.garden_plant_task_occurrences enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'garden_plant_task_occurrences' and policyname = 'gpto_select') then
    create policy gpto_select on public.garden_plant_task_occurrences for select to authenticated
      using (exists (
        select 1 from public.garden_plants gp
        join public.garden_members gm on gm.garden_id = gp.garden_id
        where gp.id = garden_plant_id and gm.user_id = auth.uid()
      ));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'garden_plant_task_occurrences' and policyname = 'gpto_iud') then
    create policy gpto_iud on public.garden_plant_task_occurrences for all to authenticated
      using (exists (
        select 1 from public.garden_plants gp
        join public.garden_members gm on gm.garden_id = gp.garden_id
        where gp.id = garden_plant_id and gm.user_id = auth.uid()
      ))
      with check (exists (
        select 1 from public.garden_plants gp
        join public.garden_members gm on gm.garden_id = gp.garden_id
        where gp.id = garden_plant_id and gm.user_id = auth.uid()
      ));
  end if;
end $$;

-- RPC: create default watering task (2 per chosen unit) for a garden plant
create or replace function public.create_default_watering_task(_garden_id uuid, _garden_plant_id uuid, _unit text)
returns uuid
language plpgsql
security definer
as $$
declare
  v_id uuid;
begin
  insert into public.garden_plant_tasks (garden_id, garden_plant_id, type, schedule_kind, interval_amount, interval_unit, required_count)
  values (_garden_id, _garden_plant_id, 'water', 'repeat_duration', 1, _unit, 2)
  returning id into v_id;
  return v_id;
end;
$$;

-- Ensure new columns exist for pattern-based schedules in existing deployments
alter table if exists public.garden_plant_tasks
  add column if not exists period text check (period in ('week','month','year'));
alter table if exists public.garden_plant_tasks
  add column if not exists amount integer;
alter table if exists public.garden_plant_tasks
  add column if not exists weekly_days integer[];
alter table if exists public.garden_plant_tasks
  add column if not exists monthly_days integer[];
alter table if exists public.garden_plant_tasks
  add column if not exists yearly_days text[];
alter table if exists public.garden_plant_tasks
  add column if not exists monthly_nth_weekdays text[];

-- Broaden schedule_kind constraint if needed
do $$ begin
  if exists (
    select 1 from information_schema.constraint_column_usage ccu
    join information_schema.table_constraints tc on tc.constraint_name = ccu.constraint_name
    where ccu.table_schema = 'public' and ccu.table_name = 'garden_plant_tasks' and tc.constraint_type = 'CHECK'
  ) then
    -- no-op; rely on create table definition above for new deployments
    null;
  end if;
end $$;

-- RPC: upsert one-time task for a plant (date or duration)
create or replace function public.upsert_one_time_task(
  _garden_id uuid, _garden_plant_id uuid, _type text, _custom_name text,
  _kind text, _due_at timestamptz, _amount integer, _unit text, _required integer
)
returns uuid
language plpgsql
security definer
as $$
declare v_id uuid;
begin
  -- always insert new one-time task
  insert into public.garden_plant_tasks (
    garden_id, garden_plant_id, type, custom_name, schedule_kind, due_at, interval_amount, interval_unit, required_count
  ) values (
    _garden_id, _garden_plant_id, _type, nullif(_custom_name,''), _kind,
    _due_at,
    case when _kind = 'one_time_duration' then _amount else null end,
    case when _kind = 'one_time_duration' then _unit else null end,
    greatest(1, coalesce(_required,1))
  ) returning id into v_id;
  return v_id;
end;
$$;

-- RPC: mark an occurrence progress and optionally complete
create or replace function public.progress_task_occurrence(_occurrence_id uuid, _increment integer default 1)
returns void
language plpgsql
security definer
as $$
begin
  update public.garden_plant_task_occurrences
    set completed_count = least(required_count, completed_count + greatest(1, _increment)),
        completed_at = case when completed_count + greatest(1, _increment) >= required_count then now() else completed_at end
  where id = _occurrence_id;
end;
$$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'garden_transactions' and policyname = 'gt_insert') then
    create policy gt_insert on public.garden_transactions for insert to authenticated
      with check (exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = auth.uid()));
  end if;
end $$;

