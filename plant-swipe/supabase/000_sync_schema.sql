-- plantswipe: single idempotent SQL to sync DB schema to current app usage
-- Safe to run multiple times. Creates/updates required objects, and removes unused ones without dropping data rows.
-- NOTE: Requires Postgres + Supabase environment (auth schema present). Uses security definer where needed.

-- ========== Extensions ==========
create extension if not exists pgcrypto;
-- Optional: scheduling support
create extension if not exists pg_cron;

-- ========== Profiles (user profiles) ==========
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(trim(both from display_name)) >= 1 and length(trim(both from display_name)) <= 64),
  avatar_url text,
  liked_plant_ids text[] not null default '{}',
  is_admin boolean not null default false
);
alter table public.profiles enable row level security;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_select_self') then
    drop policy profiles_select_self on public.profiles;
  end if;
  create policy profiles_select_self on public.profiles for select to authenticated
    using (id = (select auth.uid()));
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_insert_self') then
    drop policy profiles_insert_self on public.profiles;
  end if;
  create policy profiles_insert_self on public.profiles for insert to authenticated
    with check (id = (select auth.uid()));
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_update_self') then
    drop policy profiles_update_self on public.profiles;
  end if;
  create policy profiles_update_self on public.profiles for update to authenticated
    using (id = (select auth.uid()))
    with check (id = (select auth.uid()));
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_delete_self') then
    drop policy profiles_delete_self on public.profiles;
  end if;
  create policy profiles_delete_self on public.profiles for delete to authenticated
    using (id = (select auth.uid()));
end $$;

-- ========== Plants (catalog) ==========
create table if not exists public.plants (
  id text primary key,
  name text not null,
  scientific_name text not null,
  colors text[] not null default '{}',
  seasons text[] not null default '{}',
  rarity text not null default 'Common' check (rarity in ('Common','Uncommon','Rare','Legendary')),
  meaning text,
  description text,
  image_url text,
  care_sunlight text not null default 'Low' check (care_sunlight in ('Low','Medium','High')),
  care_water text not null default 'Low' check (care_water in ('Low','Medium','High')),
  care_soil text not null,
  care_difficulty text not null default 'Easy' check (care_difficulty in ('Easy','Moderate','Hard')),
  seeds_available boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  water_freq_unit text check (water_freq_unit in ('day','week','month','year')),
  water_freq_value integer,
  water_freq_period text,
  water_freq_amount integer
);
-- Ensure columns present for legacy/compat fields
alter table if exists public.plants add column if not exists colors text[] not null default '{}';
alter table if exists public.plants add column if not exists seasons text[] not null default '{}';
alter table if exists public.plants add column if not exists seeds_available boolean not null default false;
alter table if exists public.plants add column if not exists water_freq_period text;
alter table if exists public.plants add column if not exists water_freq_amount integer;
alter table if exists public.plants add column if not exists water_freq_unit text;
alter table if exists public.plants add column if not exists water_freq_value integer;
alter table if exists public.plants add column if not exists updated_at timestamptz not null default now();
alter table public.plants enable row level security;
-- Clean up legacy duplicate read policies if present
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plants' and policyname='Allow read plants') then
    drop policy "Allow read plants" on public.plants;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plants' and policyname='Allow select for all') then
    drop policy "Allow select for all" on public.plants;
  end if;
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plants' and policyname='plants_select_all') then
    drop policy plants_select_all on public.plants;
  end if;
  -- Allow anyone (including anon) to read plants
  create policy plants_select_all on public.plants for select to authenticated, anon using (true);
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plants' and policyname='plants_iud_all') then
    drop policy plants_iud_all on public.plants;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plants' and policyname='plants_insert') then
    drop policy plants_insert on public.plants;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plants' and policyname='plants_update') then
    drop policy plants_update on public.plants;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plants' and policyname='plants_delete') then
    drop policy plants_delete on public.plants;
  end if;
  create policy plants_insert on public.plants for insert to authenticated with check (true);
  create policy plants_update on public.plants for update to authenticated using (true) with check (true);
  create policy plants_delete on public.plants for delete to authenticated using (true);
end $$;

-- ========== Core tables ==========
create table if not exists public.gardens (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cover_image_url text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  streak integer not null default 0
);

create table if not exists public.garden_members (
  garden_id uuid not null references public.gardens(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key (garden_id, user_id)
);

-- Also relate members to profiles if available
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'garden_members_user_id_profiles_fk'
  ) then
    -- Only add if public.profiles exists
    if exists (select 1 from information_schema.tables where table_schema='public' and table_name='profiles') then
      alter table public.garden_members
        add constraint garden_members_user_id_profiles_fk
        foreign key (user_id) references public.profiles(id) on delete cascade;
    end if;
  end if;
end $$;

create table if not exists public.garden_plants (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  plant_id text not null references public.plants(id) on delete cascade,
  nickname text,
  seeds_planted integer not null default 0,
  planted_at timestamptz,
  expected_bloom_date timestamptz,
  plants_on_hand integer not null default 0,
  override_water_freq_unit text check (override_water_freq_unit in ('day','week','month','year')),
  override_water_freq_value integer,
  sort_index integer
);

-- Ensure new columns exist on existing deployments
alter table if exists public.garden_plants
  add column if not exists plants_on_hand integer not null default 0;
alter table if exists public.garden_plants
  add column if not exists override_water_freq_unit text check (override_water_freq_unit in ('day','week','month','year'));
alter table if exists public.garden_plants
  add column if not exists override_water_freq_value integer;
alter table if exists public.garden_plants
  add column if not exists sort_index integer;

create table if not exists public.garden_plant_events (
  id uuid primary key default gen_random_uuid(),
  garden_plant_id uuid not null references public.garden_plants(id) on delete cascade,
  event_type text not null check (event_type in ('water','fertilize','prune','harvest','note')),
  occurred_at timestamptz not null default now(),
  notes text,
  next_due_at timestamptz
);

-- Species-level inventory
create table if not exists public.garden_inventory (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  plant_id text not null references public.plants(id) on delete cascade,
  seeds_on_hand integer not null default 0,
  plants_on_hand integer not null default 0,
  unique (garden_id, plant_id)
);

-- Per-instance inventory (by garden_plant)
create table if not exists public.garden_instance_inventory (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  garden_plant_id uuid not null references public.garden_plants(id) on delete cascade,
  seeds_on_hand integer not null default 0,
  plants_on_hand integer not null default 0,
  unique (garden_plant_id)
);

-- Transactions
create table if not exists public.garden_transactions (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  plant_id text not null references public.plants(id) on delete cascade,
  type text not null check (type in ('buy_seeds','sell_seeds','buy_plants','sell_plants')),
  quantity integer not null check (quantity >= 0),
  occurred_at timestamptz not null default now(),
  notes text
);

-- Daily garden tasks (watering success per day)
create table if not exists public.garden_tasks (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  day date not null,
  task_type text not null check (task_type in ('watering')),
  garden_plant_ids uuid[] not null default '{}',
  success boolean not null default false,
  unique (garden_id, day, task_type)
);
create index if not exists garden_tasks_garden_day_idx on public.garden_tasks (garden_id, day);

-- Watering schedule pattern per plant
create table if not exists public.garden_plant_schedule (
  garden_plant_id uuid primary key references public.garden_plants(id) on delete cascade,
  period text not null check (period in ('week','month','year')),
  amount integer not null check (amount > 0),
  weekly_days integer[],
  monthly_days integer[],
  yearly_days text[],
  monthly_nth_weekdays text[]
);

-- Materialized watering schedule per day per plant
create table if not exists public.garden_watering_schedule (
  id uuid primary key default gen_random_uuid(),
  garden_plant_id uuid not null references public.garden_plants(id) on delete cascade,
  due_date date not null,
  completed_at timestamptz
);
create index if not exists gws_plant_due_idx on public.garden_watering_schedule (garden_plant_id, due_date);

-- Generic per-plant tasks (v2)
create table if not exists public.garden_plant_tasks (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  garden_plant_id uuid not null references public.garden_plants(id) on delete cascade,
  type text not null check (type in ('water','fertilize','harvest','cut','custom')),
  custom_name text,
  emoji text,
  schedule_kind text not null check (schedule_kind in ('one_time_date','one_time_duration','repeat_duration','repeat_pattern')),
  due_at timestamptz,
  interval_amount integer,
  interval_unit text check (interval_unit in ('hour','day','week','month','year')),
  required_count integer not null default 1 check (required_count > 0),
  period text check (period in ('week','month','year')),
  amount integer check (amount > 0),
  weekly_days integer[],
  monthly_days integer[],
  yearly_days text[],
  monthly_nth_weekdays text[],
  created_at timestamptz not null default now()
);
-- Backfill columns for existing deployments
alter table if exists public.garden_plant_tasks add column if not exists period text check (period in ('week','month','year'));
alter table if exists public.garden_plant_tasks add column if not exists amount integer;
alter table if exists public.garden_plant_tasks add column if not exists weekly_days integer[];
alter table if exists public.garden_plant_tasks add column if not exists monthly_days integer[];
alter table if exists public.garden_plant_tasks add column if not exists yearly_days text[];
alter table if exists public.garden_plant_tasks add column if not exists monthly_nth_weekdays text[];
alter table if exists public.garden_plant_tasks add column if not exists emoji text;

-- Ensure schedule_kind check constraint is correct on existing deployments
alter table if exists public.garden_plant_tasks
  drop constraint if exists garden_plant_tasks_schedule_kind_check;
alter table if exists public.garden_plant_tasks
  add constraint garden_plant_tasks_schedule_kind_check
  check (schedule_kind in ('one_time_date','one_time_duration','repeat_duration','repeat_pattern'));

create table if not exists public.garden_plant_task_occurrences (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.garden_plant_tasks(id) on delete cascade,
  garden_plant_id uuid not null references public.garden_plants(id) on delete cascade,
  due_at timestamptz not null,
  required_count integer not null default 1 check (required_count > 0),
  completed_count integer not null default 0 check (completed_count >= 0),
  completed_at timestamptz
);

-- ========== RLS ==========
alter table public.gardens enable row level security;
alter table public.garden_members enable row level security;
alter table public.garden_plants enable row level security;
alter table public.garden_plant_events enable row level security;
alter table public.garden_inventory enable row level security;
alter table public.garden_instance_inventory enable row level security;
alter table public.garden_transactions enable row level security;
alter table public.garden_tasks enable row level security;
alter table public.garden_plant_schedule enable row level security;
alter table public.garden_watering_schedule enable row level security;
alter table public.garden_plant_tasks enable row level security;
alter table public.garden_plant_task_occurrences enable row level security;

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

-- Check if a user is the creator (owner in gardens.created_by) of a garden.
-- SECURITY DEFINER ensures the query bypasses RLS on public.gardens and avoids policy recursion.
create or replace function public.is_garden_creator_bypass(_garden_id uuid, _user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.gardens
    where id = _garden_id and created_by = _user_id
  );
$$;

-- Gardens policies
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='gardens' and policyname='gardens_select') then
    drop policy gardens_select on public.gardens;
  end if;
  create policy gardens_select on public.gardens for select
    using (
      created_by = (select auth.uid())
      or public.is_garden_member_bypass(id, (select auth.uid()))
    );
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='gardens' and policyname='gardens_insert') then
    create policy gardens_insert on public.gardens for insert to authenticated
      with check (created_by = (select auth.uid()));
  end if;
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='gardens' and policyname='gardens_update') then
    drop policy gardens_update on public.gardens;
  end if;
  create policy gardens_update on public.gardens for update to authenticated
    using (
      created_by = (select auth.uid())
      or public.is_garden_owner_bypass(id, (select auth.uid()))
    );
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='gardens' and policyname='gardens_delete') then
    create policy gardens_delete on public.gardens for delete to authenticated
      using (created_by = (select auth.uid()));
  end if;
end $$;

alter table public.garden_members disable row level security;

do $$
declare r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'garden_members'
  loop
    execute format('drop policy %I on public.garden_members', r.policyname);
  end loop;
end $$;

drop function if exists public.is_garden_member(uuid) cascade;
drop function if exists public.is_member(uuid) cascade;
drop function if exists public.is_garden_owner(uuid) cascade;
drop function if exists public.is_owner(uuid) cascade;

drop policy if exists "__gm_temp_all" on public.garden_members;
create policy "__gm_temp_all" on public.garden_members for all to authenticated
  using (true) with check (true);

alter table public.garden_members enable row level security;

drop policy if exists "__gm_temp_all" on public.garden_members;

drop policy if exists gm_select on public.garden_members;
create policy gm_select on public.garden_members for select to authenticated
  using (
    -- Any member of the garden can read all memberships for that garden
    public.is_garden_member_bypass(garden_id, (select auth.uid()))
    or public.is_garden_creator_bypass(garden_id, (select auth.uid()))
  );

drop policy if exists gm_insert on public.garden_members;
create policy gm_insert on public.garden_members for insert to authenticated
  with check (
    public.is_garden_creator_bypass(garden_id, (select auth.uid()))
  );

drop policy if exists gm_update on public.garden_members;
create policy gm_update on public.garden_members for update to authenticated
  using (
    public.is_garden_creator_bypass(garden_id, (select auth.uid()))
  )
  with check (
    public.is_garden_creator_bypass(garden_id, (select auth.uid()))
  );

drop policy if exists gm_delete on public.garden_members;
create policy gm_delete on public.garden_members for delete to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_garden_creator_bypass(garden_id, (select auth.uid()))
  );

-- Garden tasks policies
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_tasks' and policyname='gtasks_select') then
    drop policy gtasks_select on public.garden_tasks;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_tasks' and policyname='gtasks_iud') then
    drop policy gtasks_iud on public.garden_tasks;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_tasks' and policyname='gtasks_insert') then
    drop policy gtasks_insert on public.garden_tasks;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_tasks' and policyname='gtasks_update') then
    drop policy gtasks_update on public.garden_tasks;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_tasks' and policyname='gtasks_delete') then
    drop policy gtasks_delete on public.garden_tasks;
  end if;
  create policy gtasks_select on public.garden_tasks for select to authenticated
    using (exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid())));
  create policy gtasks_insert on public.garden_tasks for insert to authenticated
    with check (exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid())));
  create policy gtasks_update on public.garden_tasks for update to authenticated
    using (exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid())))
    with check (exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid())));
  create policy gtasks_delete on public.garden_tasks for delete to authenticated
    using (exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid())));
end $$;

-- Schedule tables policies
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plant_schedule' and policyname='gps_select') then
    create policy gps_select on public.garden_plant_schedule for select to authenticated
      using (exists (
        select 1 from public.garden_plants gp
        join public.garden_members gm on gm.garden_id = gp.garden_id
        where gp.id = garden_plant_id and gm.user_id = (select auth.uid())
      ));
  end if;
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plant_schedule' and policyname='gps_iud') then
    drop policy gps_iud on public.garden_plant_schedule;
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plant_schedule' and policyname='gps_insert') then
    create policy gps_insert on public.garden_plant_schedule for insert to authenticated
      with check (exists (
        select 1 from public.garden_plants gp
        join public.garden_members gm on gm.garden_id = gp.garden_id
        where gp.id = garden_plant_id and gm.user_id = (select auth.uid())
      ));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plant_schedule' and policyname='gps_update') then
    create policy gps_update on public.garden_plant_schedule for update to authenticated
      using (exists (
        select 1 from public.garden_plants gp
        join public.garden_members gm on gm.garden_id = gp.garden_id
        where gp.id = garden_plant_id and gm.user_id = (select auth.uid())
      ))
      with check (exists (
        select 1 from public.garden_plants gp
        join public.garden_members gm on gm.garden_id = gp.garden_id
        where gp.id = garden_plant_id and gm.user_id = (select auth.uid())
      ));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plant_schedule' and policyname='gps_delete') then
    create policy gps_delete on public.garden_plant_schedule for delete to authenticated
      using (exists (
        select 1 from public.garden_plants gp
        join public.garden_members gm on gm.garden_id = gp.garden_id
        where gp.id = garden_plant_id and gm.user_id = (select auth.uid())
      ));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_watering_schedule' and policyname='gws_select') then
    create policy gws_select on public.garden_watering_schedule for select to authenticated
      using (exists (
        select 1 from public.garden_plants gp
        join public.garden_members gm on gm.garden_id = gp.garden_id
        where gp.id = garden_plant_id and gm.user_id = (select auth.uid())
      ));
  end if;
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_watering_schedule' and policyname='gws_iud') then
    drop policy gws_iud on public.garden_watering_schedule;
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_watering_schedule' and policyname='gws_insert') then
    create policy gws_insert on public.garden_watering_schedule for insert to authenticated
      with check (exists (
        select 1 from public.garden_plants gp
        join public.garden_members gm on gm.garden_id = gp.garden_id
        where gp.id = garden_plant_id and gm.user_id = (select auth.uid())
      ));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_watering_schedule' and policyname='gws_update') then
    create policy gws_update on public.garden_watering_schedule for update to authenticated
      using (exists (
        select 1 from public.garden_plants gp
        join public.garden_members gm on gm.garden_id = gp.garden_id
        where gp.id = garden_plant_id and gm.user_id = (select auth.uid())
      ))
      with check (exists (
        select 1 from public.garden_plants gp
        join public.garden_members gm on gm.garden_id = gp.garden_id
        where gp.id = garden_plant_id and gm.user_id = (select auth.uid())
      ));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_watering_schedule' and policyname='gws_delete') then
    create policy gws_delete on public.garden_watering_schedule for delete to authenticated
      using (exists (
        select 1 from public.garden_plants gp
        join public.garden_members gm on gm.garden_id = gp.garden_id
        where gp.id = garden_plant_id and gm.user_id = (select auth.uid())
      ));
  end if;
end $$;

-- Events policies
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plant_events' and policyname='gpe_select') then
    create policy gpe_select on public.garden_plant_events for select to authenticated
      using (exists (select 1 from public.garden_plants gp where gp.id = garden_plant_id and exists (select 1 from public.garden_members gm where gm.garden_id = gp.garden_id and gm.user_id = (select auth.uid()))));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plant_events' and policyname='gpe_insert') then
    create policy gpe_insert on public.garden_plant_events for insert to authenticated
      with check (exists (select 1 from public.garden_plants gp where gp.id = garden_plant_id and exists (select 1 from public.garden_members gm where gm.garden_id = gp.garden_id and gm.user_id = (select auth.uid()))));
  end if;
end $$;

-- Inventory policies
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_inventory' and policyname='gi_select') then
    create policy gi_select on public.garden_inventory for select
      using (exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid())));
  end if;
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_inventory' and policyname='gi_iud') then
    drop policy gi_iud on public.garden_inventory;
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_inventory' and policyname='gi_insert') then
    create policy gi_insert on public.garden_inventory for insert to authenticated
      with check (exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid())));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_inventory' and policyname='gi_update') then
    create policy gi_update on public.garden_inventory for update to authenticated
      using (exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid())))
      with check (exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid())));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_inventory' and policyname='gi_delete') then
    create policy gi_delete on public.garden_inventory for delete to authenticated
      using (exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid())));
  end if;
end $$;

-- Instance inventory policies
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_instance_inventory' and policyname='gii_select') then
    create policy gii_select on public.garden_instance_inventory for select
      using (exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid())));
  end if;
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_instance_inventory' and policyname='gii_iud') then
    drop policy gii_iud on public.garden_instance_inventory;
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_instance_inventory' and policyname='gii_insert') then
    create policy gii_insert on public.garden_instance_inventory for insert to authenticated
      with check (exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid())));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_instance_inventory' and policyname='gii_update') then
    create policy gii_update on public.garden_instance_inventory for update to authenticated
      using (exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid())))
      with check (exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid())));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_instance_inventory' and policyname='gii_delete') then
    create policy gii_delete on public.garden_instance_inventory for delete to authenticated
      using (exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid())));
  end if;
end $$;

-- Transactions policies
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_transactions' and policyname='gt_select') then
    create policy gt_select on public.garden_transactions for select
      using (exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid())));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_transactions' and policyname='gt_insert') then
    create policy gt_insert on public.garden_transactions for insert to authenticated
      with check (exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid())));
  end if;
end $$;

-- Task tables policies
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plant_tasks' and policyname='gpt_select') then
    create policy gpt_select on public.garden_plant_tasks for select to authenticated
      using (exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid())));
  end if;
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plant_tasks' and policyname='gpt_iud') then
    drop policy gpt_iud on public.garden_plant_tasks;
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plant_tasks' and policyname='gpt_insert') then
    create policy gpt_insert on public.garden_plant_tasks for insert to authenticated
      with check (exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid())));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plant_tasks' and policyname='gpt_update') then
    create policy gpt_update on public.garden_plant_tasks for update to authenticated
      using (exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid())))
      with check (exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid())));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plant_tasks' and policyname='gpt_delete') then
    create policy gpt_delete on public.garden_plant_tasks for delete to authenticated
      using (exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid())));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plant_task_occurrences' and policyname='gpto_select') then
    create policy gpto_select on public.garden_plant_task_occurrences for select to authenticated
      using (exists (
        select 1 from public.garden_plants gp
        join public.garden_members gm on gm.garden_id = gp.garden_id
        where gp.id = garden_plant_id and gm.user_id = (select auth.uid())
      ));
  end if;
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plant_task_occurrences' and policyname='gpto_iud') then
    drop policy gpto_iud on public.garden_plant_task_occurrences;
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plant_task_occurrences' and policyname='gpto_insert') then
    create policy gpto_insert on public.garden_plant_task_occurrences for insert to authenticated
      with check (exists (
        select 1 from public.garden_plants gp
        join public.garden_members gm on gm.garden_id = gp.garden_id
        where gp.id = garden_plant_id and gm.user_id = (select auth.uid())
      ));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plant_task_occurrences' and policyname='gpto_update') then
    create policy gpto_update on public.garden_plant_task_occurrences for update to authenticated
      using (exists (
        select 1 from public.garden_plants gp
        join public.garden_members gm on gm.garden_id = gp.garden_id
        where gp.id = garden_plant_id and gm.user_id = (select auth.uid())
      ))
      with check (exists (
        select 1 from public.garden_plants gp
        join public.garden_members gm on gm.garden_id = gp.garden_id
        where gp.id = garden_plant_id and gm.user_id = (select auth.uid())
      ));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plant_task_occurrences' and policyname='gpto_delete') then
    create policy gpto_delete on public.garden_plant_task_occurrences for delete to authenticated
      using (exists (
        select 1 from public.garden_plants gp
        join public.garden_members gm on gm.garden_id = gp.garden_id
        where gp.id = garden_plant_id and gm.user_id = (select auth.uid())
      ));
  end if;
end $$;

-- ========== RPCs used by the app ==========
create or replace function public.get_server_now()
returns timestamptz
language sql
stable
set search_path = public
as $$ select now(); $$;

create or replace function public.reseed_watering_schedule(_garden_plant_id uuid, _days_ahead integer default 60)
returns void
language plpgsql
security definer
set search_path = public
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

create or replace function public.mark_garden_plant_watered(_garden_plant_id uuid, _at timestamptz default now())
returns void
language plpgsql
security definer
set search_path = public
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

create or replace function public.touch_garden_task(_garden_id uuid, _day date, _plant_id uuid default null, _set_success boolean default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_yesterday date := ((now() at time zone 'utc')::date - interval '1 day')::date;
begin
  select id into v_id
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

  -- After any change to day's record, refresh base streak up to yesterday
  perform public.update_garden_streak(_garden_id, v_yesterday);
end;
$$;
drop function if exists public.compute_daily_tasks_for_all_gardens(date);
drop function if exists public.compute_garden_task_for_day(uuid, date);
create or replace function public.compute_garden_task_for_day(_garden_id uuid, _day date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  task_ids uuid[];
  due_count int := 0;
  done_count int := 0;
begin
  select array_agg(t.id) into task_ids from public.garden_plant_tasks t where t.garden_id = _garden_id;
  if task_ids is null or array_length(task_ids,1) is null then
    perform public.touch_garden_task(_garden_id, _day, null, true);
    return;
  end if;
  select coalesce(sum(gpto.required_count), 0) into due_count
  from public.garden_plant_task_occurrences gpto
  where gpto.task_id = any(task_ids)
    and (gpto.due_at at time zone 'utc')::date = _day;

  select coalesce(sum(least(gpto.required_count, gpto.completed_count)), 0) into done_count
  from public.garden_plant_task_occurrences gpto
  where gpto.task_id = any(task_ids)
    and (gpto.due_at at time zone 'utc')::date = _day;

  perform public.touch_garden_task(_garden_id, _day, null, (due_count = 0) or (done_count >= due_count));
end;
$$;

create or replace function public.ensure_daily_tasks_for_gardens(_day date default now()::date)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.garden_tasks (garden_id, day, task_type, garden_plant_ids, success)
  select g.id, _day, 'watering', '{}'::uuid[], true
  from public.gardens g
  on conflict (garden_id, day, task_type) do nothing;
  update public.garden_tasks
    set success = true
  where day = _day and task_type = 'watering' and coalesce(array_length(garden_plant_ids, 1), 0) = 0;
$$;

create or replace function public.get_user_id_by_email(_email text)
returns uuid
language sql
security definer
set search_path = public
as $$ select id from auth.users where email ilike _email limit 1; $$;

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
    and not exists (select 1 from public.garden_instance_inventory gii where gii.garden_plant_id = gp.id);
$$;

-- Set species-level inventory counts (idempotent upsert)
create or replace function public.set_inventory_counts(
  _garden_id uuid,
  _plant_id text,
  _seeds_on_hand integer default null,
  _plants_on_hand integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.garden_inventory (garden_id, plant_id, seeds_on_hand, plants_on_hand)
  values (
    _garden_id,
    _plant_id,
    greatest(0, coalesce(_seeds_on_hand, 0)),
    greatest(0, coalesce(_plants_on_hand, 0))
  )
  on conflict (garden_id, plant_id) do update
    set seeds_on_hand = coalesce(excluded.seeds_on_hand, public.garden_inventory.seeds_on_hand),
        plants_on_hand = coalesce(excluded.plants_on_hand, public.garden_inventory.plants_on_hand);
end;
$$;

-- Set per-instance inventory counts (idempotent upsert)
create or replace function public.set_instance_inventory_counts(
  _garden_id uuid,
  _garden_plant_id uuid,
  _seeds_on_hand integer default null,
  _plants_on_hand integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.garden_instance_inventory (garden_id, garden_plant_id, seeds_on_hand, plants_on_hand)
  values (
    _garden_id,
    _garden_plant_id,
    greatest(0, coalesce(_seeds_on_hand, 0)),
    greatest(0, coalesce(_plants_on_hand, 0))
  )
  on conflict (garden_plant_id) do update
    set seeds_on_hand = coalesce(excluded.seeds_on_hand, public.garden_instance_inventory.seeds_on_hand),
        plants_on_hand = coalesce(excluded.plants_on_hand, public.garden_instance_inventory.plants_on_hand);
end;
$$;

create or replace function public.create_default_watering_task(_garden_id uuid, _garden_plant_id uuid, _unit text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  insert into public.garden_plant_tasks (garden_id, garden_plant_id, type, schedule_kind, interval_amount, interval_unit, required_count)
  values (_garden_id, _garden_plant_id, 'water', 'repeat_duration', 1, _unit, 2)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.upsert_one_time_task(
  _garden_id uuid, _garden_plant_id uuid, _type text, _custom_name text,
  _kind text, _due_at timestamptz, _amount integer, _unit text, _required integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
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

create or replace function public.progress_task_occurrence(_occurrence_id uuid, _increment integer default 1)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_occ record;
  v_day date;
  v_yesterday date := ((now() at time zone 'utc')::date - interval '1 day')::date;
begin
  -- Update the occurrence progress and completion timestamp when reaching required count
  update public.garden_plant_task_occurrences
    set completed_count = least(required_count, completed_count + greatest(1, _increment)),
        completed_at = case when completed_count + greatest(1, _increment) >= required_count then now() else completed_at end
  where id = _occurrence_id;

  -- Resolve garden and day for this occurrence to recompute day success and streak
  select o.id,
         o.due_at,
         t.garden_id
  into v_occ
  from public.garden_plant_task_occurrences o
  join public.garden_plant_tasks t on t.id = o.task_id
  where o.id = _occurrence_id
  limit 1;

  if v_occ is null then
    return;
  end if;

  v_day := (v_occ.due_at at time zone 'utc')::date;

  -- Recompute the aggregated garden_tasks success for that day based on all occurrences
  perform public.compute_garden_task_for_day(v_occ.garden_id, v_day);

  -- Refresh the base streak up to yesterday so UI can add today's preview if successful
  perform public.update_garden_streak(v_occ.garden_id, v_yesterday);
end;
$$;

-- Streak helpers (used by server jobs or manual runs)
create or replace function public.compute_garden_streak(_garden_id uuid, _anchor_day date)
returns integer
language plpgsql
set search_path = public
as $$
declare d date := _anchor_day; s integer := 0; t record; begin
  loop
    select g.day, g.success into t from public.garden_tasks g where g.garden_id = _garden_id and g.day = d and g.task_type = 'watering' limit 1;
    if t is null then exit; end if;
    if not coalesce(t.success, false) then exit; end if;
    s := s + 1; d := (d - interval '1 day')::date;
  end loop;
  return s;
end; $$;

create or replace function public.update_garden_streak(_garden_id uuid, _anchor_day date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare s integer; begin
  s := public.compute_garden_streak(_garden_id, _anchor_day);
  update public.gardens set streak = s where id = _garden_id;
end; $$;

create or replace function public.compute_daily_tasks_for_all_gardens(_day date)
returns void
language plpgsql
set search_path = public
as $$
declare g record; anchor date := (_day - interval '1 day')::date; begin
  for g in select id from public.gardens loop
    perform public.update_garden_streak(g.id, anchor);
    perform public.compute_garden_task_for_day(g.id, _day);
  end loop;
end; $$;

-- ========== Scheduling (optional) ==========
-- Schedule daily computation at 00:05 UTC to update streaks and create daily tasks
do $$ begin
  if exists (select 1 from cron.job where jobname = 'compute_daily_garden_tasks') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'compute_daily_garden_tasks';
  end if;
  perform cron.schedule(
    'compute_daily_garden_tasks',
    '5 0 * * *',
    $cron$select public.compute_daily_tasks_for_all_gardens((now() at time zone 'utc')::date)$cron$
  );
end $$;

-- ========== Web visits tracking ==========
-- Track anonymous and authenticated page visits for analytics
create table if not exists public.web_visits (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  session_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  page_path text not null,
  referrer text,
  user_agent text,
  ip_address inet,
  geo_country text,
  geo_region text,
  geo_city text,
  latitude double precision,
  longitude double precision,
  extra jsonb not null default '{}'::jsonb
);

-- New structured fields for counters and common marketing metadata
alter table if exists public.web_visits add column if not exists visit_num integer;
alter table if exists public.web_visits add column if not exists page_title text;
alter table if exists public.web_visits add column if not exists language text;
alter table if exists public.web_visits add column if not exists utm_source text;
alter table if exists public.web_visits add column if not exists utm_medium text;
alter table if exists public.web_visits add column if not exists utm_campaign text;
alter table if exists public.web_visits add column if not exists utm_term text;
alter table if exists public.web_visits add column if not exists utm_content text;

-- Helpful indexes
create index if not exists web_visits_occurred_at_idx on public.web_visits (occurred_at desc);
create index if not exists web_visits_session_idx on public.web_visits (session_id);
create index if not exists web_visits_user_idx on public.web_visits (user_id);
create index if not exists web_visits_page_idx on public.web_visits (page_path);
create index if not exists web_visits_ip_idx on public.web_visits (ip_address);

-- RLS: restrict reads to admins only; writes are server-side (bypass RLS)
alter table public.web_visits enable row level security;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='web_visits' and policyname='web_visits_admin_select') then
    drop policy web_visits_admin_select on public.web_visits;
  end if;
  create policy web_visits_admin_select on public.web_visits for select to authenticated
    using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true));
end $$;

-- Allow inserts into web_visits so server/API can log visits even with RLS enabled
-- This addresses cases where server connects as a non-superuser role and inserts were being blocked silently
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='web_visits' and policyname='web_visits_insert_all') then
    drop policy web_visits_insert_all on public.web_visits;
  end if;
  -- Permit insert for all roles (PUBLIC); the app only writes via server/API
  create policy web_visits_insert_all on public.web_visits for insert to public
    with check (true);
end $$;

-- ========== Ban system ==========
-- Records account-level bans and IP-level bans, including metadata for auditing
create table if not exists public.banned_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  email text not null,
  ip_addresses text[] not null default '{}',
  reason text,
  banned_by uuid,
  banned_at timestamptz not null default now()
);
create index if not exists banned_accounts_email_idx on public.banned_accounts (lower(email));
create index if not exists banned_accounts_user_idx on public.banned_accounts (user_id);

create table if not exists public.banned_ips (
  ip_address inet primary key,
  reason text,
  banned_by uuid,
  banned_at timestamptz not null default now(),
  user_id uuid,
  email text
);
create index if not exists banned_ips_banned_at_idx on public.banned_ips (banned_at desc);

-- RLS: only admins can read; inserts/updates are performed by server using privileged role
alter table public.banned_accounts enable row level security;
alter table public.banned_ips enable row level security;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='banned_accounts' and policyname='banned_accounts_admin_select') then
    drop policy banned_accounts_admin_select on public.banned_accounts;
  end if;
  create policy banned_accounts_admin_select on public.banned_accounts for select to authenticated
    using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true));
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='banned_ips' and policyname='banned_ips_admin_select') then
    drop policy banned_ips_admin_select on public.banned_ips;
  end if;
  create policy banned_ips_admin_select on public.banned_ips for select to authenticated
    using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true));
end $$;

-- ========== Cleanup of unused objects ==========
-- The app does not use these legacy functions; drop if present to declutter.
-- Safe: functions only (no data rows dropped)
drop view if exists public.garden_plants_with_water_eval;
drop function if exists public.every_between_smallint(smallint[], integer, integer) cascade;
drop function if exists public.every_matches_mmdd(text[]) cascade;
drop function if exists public.is_valid_monthly_nth_weekdays(text[]) cascade;
drop function if exists public.nth_weekday_of_month(integer, integer, integer, integer) cascade;
drop function if exists public.get_garden_plant_water_evaluation(uuid) cascade;
drop function if exists public.get_water_evaluation(text, integer) cascade;
drop function if exists public.upsert_garden_plant_schedule_weekly(uuid, integer, smallint[]) cascade;
drop function if exists public.is_garden_member(uuid) cascade;
drop function if exists public.is_garden_owner(uuid) cascade;
drop function if exists public.is_member(uuid) cascade;
drop function if exists public.is_owner(uuid) cascade;
drop function if exists public.mark_garden_plant_done_today(uuid, uuid, date) cascade;
drop function if exists public.set_plant_care_water_from_freq() cascade;
drop function if exists public.set_updated_at() cascade;


