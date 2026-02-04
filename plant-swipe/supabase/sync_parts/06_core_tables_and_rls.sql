-- ========== Core tables ==========
create table if not exists public.gardens (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cover_image_url text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  streak integer not null default 0,
  privacy text not null default 'public' check (privacy in ('public', 'friends_only', 'private')),
  -- Location for weather and contextual advice
  location_city text,
  location_country text,
  location_timezone text,
  location_lat numeric,
  location_lon numeric
);

-- Migration: Add location columns to existing gardens
alter table if exists public.gardens add column if not exists location_city text;
alter table if exists public.gardens add column if not exists location_country text;
alter table if exists public.gardens add column if not exists location_timezone text;
alter table if exists public.gardens add column if not exists location_lat numeric;
alter table if exists public.gardens add column if not exists location_lon numeric;

-- Migration: Add/migrate privacy column (for existing databases)
do $$
begin
  -- If old is_public column exists, migrate data
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'gardens' and column_name = 'is_public'
  ) then
    -- Add privacy column if it doesn't exist
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'gardens' and column_name = 'privacy'
    ) then
      alter table public.gardens add column privacy text not null default 'public' check (privacy in ('public', 'friends_only', 'private'));
      -- Migrate data: is_public=true -> 'public', is_public=false -> 'private'
      update public.gardens set privacy = case when is_public then 'public' else 'private' end;
    end if;
    -- Drop old column
    alter table public.gardens drop column if exists is_public;
  elsif not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'gardens' and column_name = 'privacy'
  ) then
    -- Fresh install without is_public, just add privacy
    alter table public.gardens add column privacy text not null default 'public' check (privacy in ('public', 'friends_only', 'private'));
  end if;
end $$;

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
  sort_index integer,
  created_at timestamptz not null default now()
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
alter table if exists public.garden_plants
  add column if not exists health_status text check (health_status in ('thriving','healthy','okay','struggling','critical'));
alter table if exists public.garden_plants
  add column if not exists notes text;
alter table if exists public.garden_plants
  add column if not exists last_health_update timestamptz;
alter table if exists public.garden_plants
  add column if not exists created_at timestamptz not null default now();

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

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'garden_inventory'
  ) then
    with inventory_duplicates as (
      select id
      from (
        select id,
               row_number() over (
                 partition by garden_id, plant_id
                 order by id desc
               ) as rn
        from public.garden_inventory
      ) ranked
      where ranked.rn > 1
    )
    delete from public.garden_inventory gi
    using inventory_duplicates dup
    where gi.id = dup.id;
  end if;
end $$;

-- Per-instance inventory (by garden_plant)
create table if not exists public.garden_instance_inventory (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  garden_plant_id uuid not null references public.garden_plants(id) on delete cascade,
  seeds_on_hand integer not null default 0,
  plants_on_hand integer not null default 0,
  unique (garden_plant_id)
);

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'garden_instance_inventory'
  ) then
    with instance_duplicates as (
      select id
      from (
        select id,
               row_number() over (
                 partition by garden_plant_id
                 order by id desc
               ) as rn
        from public.garden_instance_inventory
      ) ranked
      where ranked.rn > 1
    )
    delete from public.garden_instance_inventory gii
    using instance_duplicates dup
    where gii.id = dup.id;
  end if;
end $$;

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

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'garden_tasks'
  ) then
    with task_duplicates as (
      select id
      from (
        select id,
               row_number() over (
                 partition by garden_id, day, task_type
                 order by id desc
               ) as rn
        from public.garden_tasks
      ) ranked
      where ranked.rn > 1
    )
    delete from public.garden_tasks gt
    using task_duplicates dup
    where gt.id = dup.id;
  end if;
end $$;

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

-- Ensure type check constraint is correct on existing deployments
alter table if exists public.garden_plant_tasks
  drop constraint if exists garden_plant_tasks_type_check;
alter table if exists public.garden_plant_tasks
  add constraint garden_plant_tasks_type_check
  check (type in ('water','fertilize','harvest','cut','custom'));

create table if not exists public.garden_plant_task_occurrences (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.garden_plant_tasks(id) on delete cascade,
  garden_plant_id uuid not null references public.garden_plants(id) on delete cascade,
  due_at timestamptz not null,
  required_count integer not null default 1 check (required_count > 0),
  completed_count integer not null default 0 check (completed_count >= 0),
  completed_at timestamptz
);

-- Track per-user increments against task occurrences to attribute completions
create table if not exists public.garden_task_user_completions (
  id uuid primary key default gen_random_uuid(),
  occurrence_id uuid not null references public.garden_plant_task_occurrences(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  increment integer not null check (increment > 0),
  occurred_at timestamptz not null default now()
);
create index if not exists gtuc_occ_user_time_idx on public.garden_task_user_completions (occurrence_id, user_id, occurred_at desc);
alter table public.garden_task_user_completions enable row level security;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_task_user_completions' and policyname='gtuc_select') then
    drop policy gtuc_select on public.garden_task_user_completions;
  end if;
  create policy gtuc_select on public.garden_task_user_completions for select to authenticated
    using (
      -- Allow members of the garden for the occurrence's task to read attribution rows
      exists (
        select 1 from public.garden_plant_task_occurrences o
        join public.garden_plant_tasks t on t.id = o.task_id
        join public.garden_members gm on gm.garden_id = t.garden_id
        where o.id = occurrence_id and gm.user_id = (select auth.uid())
      )
      or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    );
end $$;

-- ========== RLS ==========
alter table public.gardens enable row level security;
alter table public.garden_members enable row level security;
alter table public.garden_plants enable row level security;

-- Garden plants policies
-- Drop and recreate to ensure policies are always up-to-date
drop policy if exists gp_iud on public.garden_plants;
drop policy if exists gp_select on public.garden_plants;
create policy gp_select on public.garden_plants for select to authenticated
  using (
    exists (select 1 from public.garden_members gm where gm.garden_id = garden_plants.garden_id and gm.user_id = (select auth.uid()))
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
  );

drop policy if exists gp_insert on public.garden_plants;
create policy gp_insert on public.garden_plants for insert to authenticated
  with check (
    exists (select 1 from public.garden_members gm where gm.garden_id = garden_plants.garden_id and gm.user_id = (select auth.uid()))
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
  );

drop policy if exists gp_update on public.garden_plants;
create policy gp_update on public.garden_plants for update to authenticated
  using (
    exists (select 1 from public.garden_members gm where gm.garden_id = garden_plants.garden_id and gm.user_id = (select auth.uid()))
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
  )
  with check (
    exists (select 1 from public.garden_members gm where gm.garden_id = garden_plants.garden_id and gm.user_id = (select auth.uid()))
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
  );

drop policy if exists gp_delete on public.garden_plants;
create policy gp_delete on public.garden_plants for delete to authenticated
  using (
    exists (select 1 from public.garden_members gm where gm.garden_id = garden_plants.garden_id and gm.user_id = (select auth.uid()))
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
  );

-- ========== PUBLIC GARDEN ACCESS FOR ANONYMOUS USERS ==========
-- Helper function to check if a garden is public (SECURITY DEFINER to bypass RLS)
-- Defined early so it can be used by anon policies below
create or replace function public.is_public_garden(_garden_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.gardens
    where id = _garden_id and privacy = 'public'
  );
$$;
grant execute on function public.is_public_garden(uuid) to anon, authenticated;

-- Allow anon users to read garden_plants for public gardens
drop policy if exists gp_select_anon_public on public.garden_plants;
create policy gp_select_anon_public on public.garden_plants for select to anon
  using (public.is_public_garden(garden_id));

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
      or exists (
        select 1 from public.profiles p
        where p.id = (select auth.uid()) and p.is_admin = true
      )
    );
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='gardens' and policyname='gardens_insert') then
    create policy gardens_insert on public.gardens for insert to authenticated
      with check (
        created_by = (select auth.uid())
        or exists (
          select 1 from public.profiles p
          where p.id = (select auth.uid()) and p.is_admin = true
        )
      );
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
      or exists (
        select 1 from public.profiles p
        where p.id = (select auth.uid()) and p.is_admin = true
      )
    );
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='gardens' and policyname='gardens_delete') then
    create policy gardens_delete on public.gardens for delete to authenticated
      using (
        created_by = (select auth.uid())
        or exists (
          select 1 from public.profiles p
          where p.id = (select auth.uid()) and p.is_admin = true
        )
      );
  end if;
end $$;

-- Allow anon users to read public gardens
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='gardens' and policyname='gardens_select_anon_public') then
    drop policy gardens_select_anon_public on public.gardens;
  end if;
  create policy gardens_select_anon_public on public.gardens for select to anon
    using (privacy = 'public');
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
      or exists (
        select 1 from public.profiles p
        where p.id = (select auth.uid()) and p.is_admin = true
      )
    );

drop policy if exists gm_insert on public.garden_members;
  create policy gm_insert on public.garden_members for insert to authenticated
    with check (
      public.is_garden_creator_bypass(garden_id, (select auth.uid()))
      or exists (
        select 1 from public.profiles p
        where p.id = (select auth.uid()) and p.is_admin = true
      )
    );

drop policy if exists gm_update on public.garden_members;
  create policy gm_update on public.garden_members for update to authenticated
    using (
      -- Allow garden creator, any current owner of the garden, or admins
      public.is_garden_creator_bypass(garden_id, (select auth.uid()))
      or public.is_garden_owner_bypass(garden_id, (select auth.uid()))
      or exists (
        select 1 from public.profiles p
        where p.id = (select auth.uid()) and p.is_admin = true
      )
    )
    with check (
      public.is_garden_creator_bypass(garden_id, (select auth.uid()))
      or public.is_garden_owner_bypass(garden_id, (select auth.uid()))
      or exists (
        select 1 from public.profiles p
        where p.id = (select auth.uid()) and p.is_admin = true
      )
    );

drop policy if exists gm_delete on public.garden_members;
  create policy gm_delete on public.garden_members for delete to authenticated
    using (
      -- A user can always remove themselves; creators and owners can remove others
      user_id = (select auth.uid())
      or public.is_garden_creator_bypass(garden_id, (select auth.uid()))
      or public.is_garden_owner_bypass(garden_id, (select auth.uid()))
      or exists (
        select 1 from public.profiles p
        where p.id = (select auth.uid()) and p.is_admin = true
      )
    );

-- Allow anon users to read garden_members for public gardens
drop policy if exists gm_select_anon_public on public.garden_members;
create policy gm_select_anon_public on public.garden_members for select to anon
  using (public.is_public_garden(garden_id));

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
    using (
      exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
      or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    );
  create policy gtasks_insert on public.garden_tasks for insert to authenticated
    with check (
      exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
      or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    );
  create policy gtasks_update on public.garden_tasks for update to authenticated
    using (
      exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
      or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    )
    with check (
      exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
      or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    );
  create policy gtasks_delete on public.garden_tasks for delete to authenticated
    using (
      exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
      or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    );
end $$;

