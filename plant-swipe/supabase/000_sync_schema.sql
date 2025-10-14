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
  liked_plant_ids text[] not null default '{}',
  is_admin boolean not null default false
);
-- Remove legacy avatar_url column if present
alter table if exists public.profiles drop column if exists avatar_url;
-- New public profile fields
alter table if exists public.profiles add column if not exists username text;
alter table if exists public.profiles add column if not exists country text;
alter table if exists public.profiles add column if not exists bio text;
alter table if exists public.profiles add column if not exists favorite_plant text;
alter table if exists public.profiles add column if not exists avatar_url text;
alter table if exists public.profiles add column if not exists timezone text;
alter table if exists public.profiles add column if not exists experience_years integer;
-- Accent color preference; default to a green tone for new accounts
alter table if exists public.profiles add column if not exists accent_key text default 'emerald';

-- Drop username-specific constraints/index (no longer used)
do $$ begin
  begin
    alter table public.profiles drop constraint if exists profiles_username_lowercase;
  exception when undefined_object then null; end;
  begin
    alter table public.profiles drop constraint if exists profiles_username_format;
  exception when undefined_object then null; end;
end $$;
drop index if exists public.profiles_username_unique;

-- Unique index on display_name (case-insensitive)
create unique index if not exists profiles_display_name_lower_unique on public.profiles ((lower(display_name)));
alter table public.profiles enable row level security;
-- Helper to avoid RLS self-recursion when checking admin
-- Uses SECURITY DEFINER to bypass RLS on public.profiles
create or replace function public.is_admin_user(_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = _user_id and is_admin = true
  );
$$;
grant execute on function public.is_admin_user(uuid) to anon, authenticated;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_select_self') then
    drop policy profiles_select_self on public.profiles;
  end if;
  create policy profiles_select_self on public.profiles for select to authenticated
    using (
      id = (select auth.uid())
      or public.is_admin_user((select auth.uid()))
    );
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_insert_self') then
    drop policy profiles_insert_self on public.profiles;
  end if;
  create policy profiles_insert_self on public.profiles for insert to authenticated
    with check (
      id = (select auth.uid())
      or public.is_admin_user((select auth.uid()))
    );
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_update_self') then
    drop policy profiles_update_self on public.profiles;
  end if;
  create policy profiles_update_self on public.profiles for update to authenticated
    using (
      id = (select auth.uid())
      or public.is_admin_user((select auth.uid()))
    )
    with check (
      id = (select auth.uid())
      or public.is_admin_user((select auth.uid()))
    );
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_delete_self') then
    drop policy profiles_delete_self on public.profiles;
  end if;
  create policy profiles_delete_self on public.profiles for delete to authenticated
    using (
      id = (select auth.uid())
      or public.is_admin_user((select auth.uid()))
    );
end $$;

-- ========== Purge old web_visits (retention) ==========
-- Keep only the last 35 days of visit data
do $$ begin
  if exists (select 1 from cron.job where jobname = 'purge_old_web_visits') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'purge_old_web_visits';
  end if;
  perform cron.schedule(
    'purge_old_web_visits',
    '0 3 * * *',
    $cron$
    delete from public.web_visits
    where timezone('utc', occurred_at) < ((now() at time zone 'utc')::date - interval '35 days');
    $cron$
  );
end $$;

-- ========== Plants (catalog) ==========
create table if not exists public.plants (
  id text primary key,
  name text not null,
  scientific_name text,
  colors text[] not null default '{}',
  seasons text[] not null default '{}',
  rarity text not null default 'Common' check (rarity in ('Common','Uncommon','Rare','Legendary')),
  meaning text,
  description text,
  image_url text,
  care_sunlight text not null default 'Low' check (care_sunlight in ('Low','Medium','High')),
  care_water text not null default 'Low' check (care_water in ('Low','Medium','High')),
  care_soil text,
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
-- Relax NOT NULL constraints to support Simplified Add Plant flow
alter table if exists public.plants alter column scientific_name drop not null;
alter table if exists public.plants alter column care_soil drop not null;
-- Allow omitting care_water from inserts; keep sane default
alter table if exists public.plants alter column care_water drop not null;
alter table if exists public.plants alter column care_water set default 'Low';
-- Ensure watering frequency fields are optional (some DBs may still have NOT NULL)
do $$ begin
  begin
    alter table if exists public.plants alter column water_freq_period drop not null;
  exception when undefined_column then null; end;
  begin
    alter table if exists public.plants alter column water_freq_amount drop not null;
  exception when undefined_column then null; end;
  begin
    alter table if exists public.plants alter column water_freq_unit drop not null;
  exception when undefined_column then null; end;
  begin
    alter table if exists public.plants alter column water_freq_value drop not null;
  exception when undefined_column then null; end;
end $$;
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
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plants' and policyname='gp_select') then
    create policy gp_select on public.garden_plants for select to authenticated
      using (
        exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plants' and policyname='gp_iud') then
    drop policy gp_iud on public.garden_plants;
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plants' and policyname='gp_insert') then
    create policy gp_insert on public.garden_plants for insert to authenticated
      with check (
        exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plants' and policyname='gp_update') then
    create policy gp_update on public.garden_plants for update to authenticated
      using (
        exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      )
      with check (
        exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plants' and policyname='gp_delete') then
    create policy gp_delete on public.garden_plants for delete to authenticated
      using (
        exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
end $$;
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

-- ========== Ownership invariants ==========
-- Enforce: There cannot be no owner for a garden. If an update/delete would remove the last
-- owner from a garden, delete the garden (cascades) instead of leaving it ownerless.
create or replace function public.enforce_owner_presence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remaining int;
  v_garden uuid;
  v_user uuid;
begin
  if TG_OP = 'DELETE' then
    if OLD.role = 'owner' then
      v_garden := OLD.garden_id;
      v_user := OLD.user_id;
      select count(*)::int into v_remaining
      from public.garden_members
      where garden_id = v_garden and role = 'owner' and user_id <> v_user;
      if coalesce(v_remaining, 0) = 0 then
        -- This delete would remove the last owner; delete the garden instead
        delete from public.gardens where id = v_garden;
        return OLD;
      end if;
    end if;
    return OLD;
  elsif TG_OP = 'UPDATE' then
    if OLD.role = 'owner' and NEW.role <> 'owner' then
      v_garden := NEW.garden_id;
      v_user := NEW.user_id;
      select count(*)::int into v_remaining
      from public.garden_members
      where garden_id = v_garden and role = 'owner' and user_id <> v_user;
      if coalesce(v_remaining, 0) = 0 then
        -- This update would demote the last owner; delete the garden
        delete from public.gardens where id = v_garden;
        return NEW;
      end if;
    end if;
    return NEW;
  end if;
  return coalesce(NEW, OLD);
end;
$$;

-- Attach triggers idempotently
do $$ begin
  begin
    drop trigger if exists trg_gm_owner_update on public.garden_members;
  exception when undefined_object then null; end;
  begin
    drop trigger if exists trg_gm_owner_delete on public.garden_members;
  exception when undefined_object then null; end;
  create trigger trg_gm_owner_update
    before update on public.garden_members
    for each row execute function public.enforce_owner_presence();
  create trigger trg_gm_owner_delete
    before delete on public.garden_members
    for each row execute function public.enforce_owner_presence();
end $$;

-- Schedule tables policies
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plant_schedule' and policyname='gps_select') then
    create policy gps_select on public.garden_plant_schedule for select to authenticated
      using (
        exists (
          select 1 from public.garden_plants gp
          join public.garden_members gm on gm.garden_id = gp.garden_id
          where gp.id = garden_plant_id and gm.user_id = (select auth.uid())
        )
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plant_schedule' and policyname='gps_iud') then
    drop policy gps_iud on public.garden_plant_schedule;
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plant_schedule' and policyname='gps_insert') then
    create policy gps_insert on public.garden_plant_schedule for insert to authenticated
      with check (
        exists (
          select 1 from public.garden_plants gp
          join public.garden_members gm on gm.garden_id = gp.garden_id
          where gp.id = garden_plant_id and gm.user_id = (select auth.uid())
        )
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plant_schedule' and policyname='gps_update') then
    create policy gps_update on public.garden_plant_schedule for update to authenticated
      using (
        exists (
          select 1 from public.garden_plants gp
          join public.garden_members gm on gm.garden_id = gp.garden_id
          where gp.id = garden_plant_id and gm.user_id = (select auth.uid())
        )
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      )
      with check (
        exists (
          select 1 from public.garden_plants gp
          join public.garden_members gm on gm.garden_id = gp.garden_id
          where gp.id = garden_plant_id and gm.user_id = (select auth.uid())
        )
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plant_schedule' and policyname='gps_delete') then
    create policy gps_delete on public.garden_plant_schedule for delete to authenticated
      using (
        exists (
          select 1 from public.garden_plants gp
          join public.garden_members gm on gm.garden_id = gp.garden_id
          where gp.id = garden_plant_id and gm.user_id = (select auth.uid())
        )
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_watering_schedule' and policyname='gws_select') then
    create policy gws_select on public.garden_watering_schedule for select to authenticated
      using (
        exists (
          select 1 from public.garden_plants gp
          join public.garden_members gm on gm.garden_id = gp.garden_id
          where gp.id = garden_plant_id and gm.user_id = (select auth.uid())
        )
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_watering_schedule' and policyname='gws_iud') then
    drop policy gws_iud on public.garden_watering_schedule;
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_watering_schedule' and policyname='gws_insert') then
    create policy gws_insert on public.garden_watering_schedule for insert to authenticated
      with check (
        exists (
          select 1 from public.garden_plants gp
          join public.garden_members gm on gm.garden_id = gp.garden_id
          where gp.id = garden_plant_id and gm.user_id = (select auth.uid())
        )
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_watering_schedule' and policyname='gws_update') then
    create policy gws_update on public.garden_watering_schedule for update to authenticated
      using (
        exists (
          select 1 from public.garden_plants gp
          join public.garden_members gm on gm.garden_id = gp.garden_id
          where gp.id = garden_plant_id and gm.user_id = (select auth.uid())
        )
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      )
      with check (
        exists (
          select 1 from public.garden_plants gp
          join public.garden_members gm on gm.garden_id = gp.garden_id
          where gp.id = garden_plant_id and gm.user_id = (select auth.uid())
        )
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_watering_schedule' and policyname='gws_delete') then
    create policy gws_delete on public.garden_watering_schedule for delete to authenticated
      using (
        exists (
          select 1 from public.garden_plants gp
          join public.garden_members gm on gm.garden_id = gp.garden_id
          where gp.id = garden_plant_id and gm.user_id = (select auth.uid())
        )
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
end $$;

-- Events policies
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plant_events' and policyname='gpe_select') then
    create policy gpe_select on public.garden_plant_events for select to authenticated
      using (
        exists (
          select 1 from public.garden_plants gp
          where gp.id = garden_plant_id
            and exists (select 1 from public.garden_members gm where gm.garden_id = gp.garden_id and gm.user_id = (select auth.uid()))
        )
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plant_events' and policyname='gpe_insert') then
    create policy gpe_insert on public.garden_plant_events for insert to authenticated
      with check (
        exists (
          select 1 from public.garden_plants gp
          where gp.id = garden_plant_id
            and exists (select 1 from public.garden_members gm where gm.garden_id = gp.garden_id and gm.user_id = (select auth.uid()))
        )
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
end $$;

-- Inventory policies
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_inventory' and policyname='gi_select') then
    create policy gi_select on public.garden_inventory for select
      using (
        exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_inventory' and policyname='gi_iud') then
    drop policy gi_iud on public.garden_inventory;
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_inventory' and policyname='gi_insert') then
    create policy gi_insert on public.garden_inventory for insert to authenticated
      with check (
        exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_inventory' and policyname='gi_update') then
    create policy gi_update on public.garden_inventory for update to authenticated
      using (
        exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      )
      with check (
        exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_inventory' and policyname='gi_delete') then
    create policy gi_delete on public.garden_inventory for delete to authenticated
      using (
        exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
end $$;

-- Instance inventory policies
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_instance_inventory' and policyname='gii_select') then
    create policy gii_select on public.garden_instance_inventory for select
      using (
        exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_instance_inventory' and policyname='gii_iud') then
    drop policy gii_iud on public.garden_instance_inventory;
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_instance_inventory' and policyname='gii_insert') then
    create policy gii_insert on public.garden_instance_inventory for insert to authenticated
      with check (
        exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_instance_inventory' and policyname='gii_update') then
    create policy gii_update on public.garden_instance_inventory for update to authenticated
      using (
        exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      )
      with check (
        exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_instance_inventory' and policyname='gii_delete') then
    create policy gii_delete on public.garden_instance_inventory for delete to authenticated
      using (
        exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
end $$;

-- Transactions policies
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_transactions' and policyname='gt_select') then
    create policy gt_select on public.garden_transactions for select
      using (
        exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_transactions' and policyname='gt_insert') then
    create policy gt_insert on public.garden_transactions for insert to authenticated
      with check (
        exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
end $$;

-- Task tables policies
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plant_tasks' and policyname='gpt_select') then
  create policy gpt_select on public.garden_plant_tasks for select to authenticated
    using (
      exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
      or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    );
  end if;
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plant_tasks' and policyname='gpt_iud') then
    drop policy gpt_iud on public.garden_plant_tasks;
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plant_tasks' and policyname='gpt_insert') then
  create policy gpt_insert on public.garden_plant_tasks for insert to authenticated
    with check (
      exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
      or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plant_tasks' and policyname='gpt_update') then
  create policy gpt_update on public.garden_plant_tasks for update to authenticated
    using (
      exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
      or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    )
    with check (
      exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
      or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plant_tasks' and policyname='gpt_delete') then
  create policy gpt_delete on public.garden_plant_tasks for delete to authenticated
    using (
      exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
      or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plant_task_occurrences' and policyname='gpto_select') then
  create policy gpto_select on public.garden_plant_task_occurrences for select to authenticated
    using (
      exists (
        select 1 from public.garden_plants gp
        join public.garden_members gm on gm.garden_id = gp.garden_id
        where gp.id = garden_plant_id and gm.user_id = (select auth.uid())
      )
      or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    );
  end if;
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plant_task_occurrences' and policyname='gpto_iud') then
    drop policy gpto_iud on public.garden_plant_task_occurrences;
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plant_task_occurrences' and policyname='gpto_insert') then
  create policy gpto_insert on public.garden_plant_task_occurrences for insert to authenticated
    with check (
      exists (
        select 1 from public.garden_plants gp
        join public.garden_members gm on gm.garden_id = gp.garden_id
        where gp.id = garden_plant_id and gm.user_id = (select auth.uid())
      )
      or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plant_task_occurrences' and policyname='gpto_update') then
  create policy gpto_update on public.garden_plant_task_occurrences for update to authenticated
    using (
      exists (
        select 1 from public.garden_plants gp
        join public.garden_members gm on gm.garden_id = gp.garden_id
        where gp.id = garden_plant_id and gm.user_id = (select auth.uid())
      )
      or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    )
    with check (
      exists (
        select 1 from public.garden_plants gp
        join public.garden_members gm on gm.garden_id = gp.garden_id
        where gp.id = garden_plant_id and gm.user_id = (select auth.uid())
      )
      or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plant_task_occurrences' and policyname='gpto_delete') then
  create policy gpto_delete on public.garden_plant_task_occurrences for delete to authenticated
    using (
      exists (
        select 1 from public.garden_plants gp
        join public.garden_members gm on gm.garden_id = gp.garden_id
        where gp.id = garden_plant_id and gm.user_id = (select auth.uid())
      )
      or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    );
  end if;
end $$;

-- ========== RPCs used by the app ==========
-- Public profile fetch by display name (safe columns only) with admin flag, joined_at, and presence
drop function if exists public.get_profile_public_by_username(text);
drop function if exists public.get_profile_public_by_display_name(text);
create or replace function public.get_profile_public_by_display_name(_name text)
returns table(
  id uuid,
  display_name text,
  country text,
  bio text,
  avatar_url text,
  accent_key text,
  is_admin boolean,
  joined_at timestamptz,
  last_seen_at timestamptz,
  is_online boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select p.id, p.display_name, p.country, p.bio, p.avatar_url, p.accent_key, p.is_admin
    from public.profiles p
    where lower(p.display_name) = lower(_name)
    limit 1
  ),
  auth_meta as (
    select u.id, u.created_at as joined_at
    from auth.users u
    where exists (select 1 from base b where b.id = u.id)
  ),
  ls as (
    select v.user_id, max(v.occurred_at) as last_seen_at
    from public.web_visits v
    where exists (select 1 from base b where b.id = v.user_id)
    group by v.user_id
  )
  select b.id,
         b.display_name,
         b.country,
         b.bio,
         b.avatar_url,
         b.accent_key,
         b.is_admin,
         a.joined_at,
         l.last_seen_at,
         coalesce((l.last_seen_at is not null and (now() - l.last_seen_at) <= make_interval(mins => 10)), false) as is_online
  from base b
  left join auth_meta a on a.id = b.id
  left join ls l on l.user_id = b.id
  limit 1;
$$;
grant execute on function public.get_profile_public_by_display_name(text) to anon, authenticated;

-- Compute user's current streak across ALL their gardens (AND across gardens)
drop function if exists public.compute_user_current_streak(uuid, date) cascade;
create or replace function public.compute_user_current_streak(_user_id uuid, _anchor_day date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  d date := _anchor_day;
  s integer := 0;
  v_gardens_count integer := 0;
  ok boolean;
begin
  -- Count gardens user belongs to (owner or member)
  select count(*)::int into v_gardens_count
  from (
    select id as gid from public.gardens where created_by = _user_id
    union
    select garden_id as gid from public.garden_members where user_id = _user_id
  ) g;

  if coalesce(v_gardens_count, 0) = 0 then
    return 0; -- no gardens => no streak
  end if;

  loop
    -- For this day, require ALL gardens to be successful
    select bool_and(
      exists (
        select 1
        from public.garden_tasks t
        where t.garden_id = ug.gid
          and t.day = d
          and t.task_type = 'watering'
          and coalesce(t.success, false) = true
      )
    ) into ok
    from (
      select id as gid from public.gardens where created_by = _user_id
      union
      select garden_id as gid from public.garden_members where user_id = _user_id
    ) ug;

    if not coalesce(ok, false) then
      exit;
    end if;

    s := s + 1;
    d := (d - interval '1 day')::date;
  end loop;

  return s;
end;
$$;
grant execute on function public.compute_user_current_streak(uuid, date) to anon, authenticated;

-- Aggregate public stats for a user's gardens/membership
drop function if exists public.get_user_profile_public_stats(uuid) cascade;
create or replace function public.get_user_profile_public_stats(_user_id uuid)
returns table(plants_total integer, gardens_count integer, current_streak integer, longest_streak integer)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_plants int := 0;
  v_gardens int := 0;
  v_current int := 0;
  v_longest int := 0;
  v_anchor date := ((now() at time zone 'utc')::date - interval '1 day')::date;
begin
  -- Sum plants across gardens the user is currently a member of
  select coalesce(sum(gp.plants_on_hand), 0)::int into v_plants
  from public.garden_plants gp
  where gp.garden_id in (
    select garden_id from public.garden_members where user_id = _user_id
  );

  -- Count only gardens the user is currently a member of (owner or member)
  select count(*)::int into v_gardens
  from (
    select distinct garden_id
    from public.garden_members
    where user_id = _user_id
  ) g;

  -- Current streak across all user's gardens
  v_current := case when v_gardens > 0 then public.compute_user_current_streak(_user_id, v_anchor) else 0 end;

  -- Longest historical streak across user's gardens
  with user_gardens as (
    -- Only gardens where the user is currently a member (owner or member)
    select garden_id as gid from public.garden_members where user_id = _user_id
  ),
  successes as (
    select g.garden_id, g.day
    from public.garden_tasks g
    where g.garden_id in (select gid from user_gardens)
      and g.task_type = 'watering'
      and coalesce(g.success, false) = true
  ),
  grouped as (
    select garden_id,
           day,
           (day - ((row_number() over (partition by garden_id order by day))::int * interval '1 day'))::date as grp
    from successes
  ),
  runs as (
    select garden_id, grp, count(*)::int as len
    from grouped
    group by garden_id, grp
  )
  select coalesce(max(len), 0)::int into v_longest from runs;

  return query select v_plants, v_gardens, v_current, v_longest;
end;
$$;
grant execute on function public.get_user_profile_public_stats(uuid) to anon, authenticated;

-- Daily completed task counts and success flags across all user's gardens
create or replace function public.get_user_daily_tasks(
  _user_id uuid,
  _start date,
  _end date
)
returns table(day date, completed integer, any_success boolean)
language sql
stable
security definer
set search_path = public
as $$
  with days as (
    select generate_series(_start, _end, interval '1 day')::date as d
  ),
  user_gardens as (
    -- Only gardens where the user is currently a member (owner or member)
    select garden_id as gid from public.garden_members where user_id = _user_id
  ),
  due_day as (
    -- Total required counts due on each day across user's gardens
    select (o.due_at at time zone 'utc')::date as d, sum(greatest(1, o.required_count))::int as total_required
    from public.garden_plant_task_occurrences o
    join public.garden_plant_tasks t on t.id = o.task_id
    where t.garden_id in (select gid from user_gardens)
      and (o.due_at at time zone 'utc')::date between _start and _end
    group by 1
  ),
  user_done as (
    -- Sum of increments done by the user per occurrence capped at that occurrence's required_count
    select (o.due_at at time zone 'utc')::date as d,
           sum(
             least(
               greatest(1, o.required_count),
               coalesce((select sum(greatest(1, c.increment)) from public.garden_task_user_completions c where c.occurrence_id = o.id and c.user_id = _user_id), 0)
             )
           )::int as completed
    from public.garden_plant_task_occurrences o
    join public.garden_plant_tasks t on t.id = o.task_id
    where t.garden_id in (select gid from user_gardens)
      and (o.due_at at time zone 'utc')::date between _start and _end
    group by 1
  )
  select d.d as day,
         coalesce((select completed from user_done where user_done.d = d.d), 0) as completed,
         (
           coalesce((select total_required from due_day where due_day.d = d.d), 0) = 0
           or
           coalesce((select completed from user_done where user_done.d = d.d), 0) >= coalesce((select total_required from due_day where due_day.d = d.d), 0)
         ) as any_success
  from days d
  order by d.d asc;
$$;
grant execute on function public.get_user_daily_tasks(uuid, date, date) to anon, authenticated;

-- Public display name availability check
drop function if exists public.is_username_available(text);
create or replace function public.is_display_name_available(_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.profiles p where lower(p.display_name) = lower(_name)
  );
$$;
grant execute on function public.is_display_name_available(text) to anon, authenticated;

-- Resolve email by display name (for username-style login)
create or replace function public.get_email_by_display_name(_name text)
returns text
language sql
security definer
set search_path = public
as $$
  select u.email
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(p.display_name) = lower(_name)
  limit 1;
$$;
grant execute on function public.get_email_by_display_name(text) to anon, authenticated;

-- Resolve user id by display name (for adding members by username)
create or replace function public.get_user_id_by_display_name(_name text)
returns uuid
language sql
security definer
set search_path = public
as $$
  select u.id
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(p.display_name) = lower(_name)
  limit 1;
$$;
grant execute on function public.get_user_id_by_display_name(text) to anon, authenticated;

-- Private info fetch (self or admin only)
create or replace function public.get_user_private_info(_user_id uuid)
returns table(id uuid, email text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_caller uuid;
begin
  v_caller := auth.uid();
  if v_caller is null then
    return;
  end if;
  if v_caller = _user_id or public.is_admin_user(v_caller) then
    return query select u.id, u.email from auth.users u where u.id = _user_id limit 1;
  else
    return;
  end if;
end;
$$;
grant execute on function public.get_user_private_info(uuid) to authenticated;
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

-- Suggest users by email prefix (security definer to bypass RLS on auth schema)
create or replace function public.suggest_users_by_email_prefix(_prefix text, _limit int default 5)
returns table(id uuid, email text, created_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select u.id, u.email, u.created_at
  from auth.users u
  where u.email ilike _prefix || '%'
  order by u.created_at desc
  limit greatest(1, coalesce(_limit, 5));
$$;

-- Suggest users by display_name prefix (username), joining to auth.users for ordering/metadata
create or replace function public.suggest_users_by_display_name_prefix(_prefix text, _limit int default 5)
returns table(id uuid, display_name text, created_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select u.id, p.display_name, u.created_at
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.display_name ilike _prefix || '%'
  order by u.created_at desc
  limit greatest(1, coalesce(_limit, 5));
$$;

-- Count helpers for Admin API fallbacks via Supabase REST RPC
create or replace function public.count_profiles_total()
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::int from public.profiles;
$$;

create or replace function public.count_auth_users_total()
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::int from auth.users;
$$;

-- Drop and recreate to allow return type changes
drop function if exists public.get_profiles_for_garden(uuid) cascade;
create function public.get_profiles_for_garden(_garden_id uuid)
returns table(user_id uuid, display_name text, email text, accent_key text)
language sql
security definer
set search_path = public
as $$
  select p.id as user_id, p.display_name, u.email, p.accent_key
  from public.garden_members gm
  join public.profiles p on p.id = gm.user_id
  join auth.users u on u.id = gm.user_id
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
  v_actor uuid := (select auth.uid());
begin
  -- Update the occurrence progress and completion timestamp when reaching required count
  update public.garden_plant_task_occurrences
    set completed_count = least(required_count, completed_count + greatest(1, _increment)),
        completed_at = case when completed_count + greatest(1, _increment) >= required_count then now() else completed_at end
  where id = _occurrence_id;

  -- Attribute progress to the current user
  begin
    if v_actor is not null then
      insert into public.garden_task_user_completions (occurrence_id, user_id, increment)
      values (_occurrence_id, v_actor, greatest(1, _increment));
    end if;
  exception when others then
    -- ignore attribution errors to not block core progress
    null;
  end;

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
  extra jsonb not null default '{}'::jsonb
);

-- New structured fields for counters and common marketing metadata
alter table if exists public.web_visits add column if not exists visit_num integer;
alter table if exists public.web_visits add column if not exists page_title text;
alter table if exists public.web_visits add column if not exists language text;
-- Remove deprecated marketing and coordinate columns
alter table if exists public.web_visits drop column if exists utm_source;
alter table if exists public.web_visits drop column if exists utm_medium;
alter table if exists public.web_visits drop column if exists utm_campaign;
alter table if exists public.web_visits drop column if exists utm_term;
alter table if exists public.web_visits drop column if exists utm_content;
alter table if exists public.web_visits drop column if exists latitude;
alter table if exists public.web_visits drop column if exists longitude;

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

-- Aggregation RPCs for visitor analytics (used by server REST fallback)
-- Count unique IPs in the last N minutes
create or replace function public.count_unique_ips_last_minutes(_minutes integer default 60)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select count(distinct v.ip_address)::int
      from public.web_visits v
      where v.ip_address is not null
        and v.occurred_at >= (now() - make_interval(mins => greatest(0, coalesce(_minutes, 0))))
    ),
    0
  );
$$;
grant execute on function public.count_unique_ips_last_minutes(integer) to anon, authenticated;

-- Count total visits (rows) in the last N minutes
create or replace function public.count_visits_last_minutes(_minutes integer default 60)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select count(*)::int
      from public.web_visits v
      where v.occurred_at >= (now() - make_interval(mins => greatest(0, coalesce(_minutes, 0))))
    ),
    0
  );
$$;
grant execute on function public.count_visits_last_minutes(integer) to anon, authenticated;

-- Count unique IPs across the last N calendar days in UTC (default 7)
create or replace function public.count_unique_ips_last_days(_days integer default 7)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select count(distinct v.ip_address)::int
      from public.web_visits v
      where v.ip_address is not null
        and timezone('utc', v.occurred_at) >= ((now() at time zone 'utc')::date - make_interval(days => greatest(0, coalesce(_days, 0) - 1)))
    ),
    0
  );
$$;
grant execute on function public.count_unique_ips_last_days(integer) to anon, authenticated;

-- Admin helpers: fetch emails for a list of user IDs (uses auth.users)
create or replace function public.get_emails_by_user_ids(_ids uuid[])
returns table(id uuid, email text)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, u.email
  from auth.users u
  where u.id = any(_ids)
  order by u.created_at desc
$$;
grant execute on function public.get_emails_by_user_ids(uuid[]) to anon, authenticated;

-- Admin helpers: return distinct IPs for a given user id
create or replace function public.get_user_distinct_ips(_user_id uuid)
returns table(ip text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct v.ip_address::text as ip
  from public.web_visits v
  where v.user_id = _user_id and v.ip_address is not null
  order by ip asc
$$;
grant execute on function public.get_user_distinct_ips(uuid) to anon, authenticated;

-- Admin helpers: list distinct users by IP with last seen
create or replace function public.get_users_by_ip(_ip text)
returns table(id uuid, last_seen_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select v.user_id as id,
         max(v.occurred_at) as last_seen_at
  from public.web_visits v
  where v.ip_address = _ip::inet
    and v.user_id is not null
  group by v.user_id
  order by last_seen_at desc
$$;
grant execute on function public.get_users_by_ip(text) to anon, authenticated;

-- Admin helpers: aggregates for a given IP
create or replace function public.count_ip_connections(_ip text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select count(*)::int from public.web_visits where ip_address = _ip::inet), 0);
$$;
grant execute on function public.count_ip_connections(text) to anon, authenticated;

create or replace function public.count_ip_unique_users(_ip text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select count(distinct user_id)::int from public.web_visits where ip_address = _ip::inet and user_id is not null), 0);
$$;
grant execute on function public.count_ip_unique_users(text) to anon, authenticated;

create or replace function public.get_ip_last_seen(_ip text)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select max(occurred_at) from public.web_visits where ip_address = _ip::inet;
$$;
grant execute on function public.get_ip_last_seen(text) to anon, authenticated;
-- Daily unique visitors series for the last N days in UTC (default 7)
create or replace function public.get_visitors_series_days(_days integer default 7)
returns table(date text, unique_visitors integer)
language sql
stable
security definer
set search_path = public
as $$
  with days as (
    select generate_series(
      (now() at time zone 'utc')::date - make_interval(days => greatest(0, coalesce(_days, 7) - 1)),
      (now() at time zone 'utc')::date,
      interval '1 day'
    )::date as d
  )
  select to_char(d, 'YYYY-MM-DD') as date,
         coalesce((
           select count(distinct v.ip_address)
           from public.web_visits v
           where v.ip_address is not null
             and timezone('utc', v.occurred_at)::date = d
         ), 0)::int as unique_visitors
  from days
  order by d asc;
$$;
grant execute on function public.get_visitors_series_days(integer) to anon, authenticated;

-- Top countries in last N days (default 30)
create or replace function public.get_top_countries(_days integer default 30, _limit integer default 10)
returns table(country text, visits integer)
language sql
stable
security definer
set search_path = public
as $$
  with cutoff as (
    select (now() at time zone 'utc')::date - make_interval(days => greatest(0, coalesce(_days, 30) - 1)) as d
  )
  select upper(v.geo_country) as country,
         count(distinct v.ip_address)::int as visits
  from public.web_visits v
  where timezone('utc', v.occurred_at) >= (select d from cutoff)
    and v.geo_country is not null and v.geo_country <> ''
  group by 1
  order by visits desc
  limit greatest(1, coalesce(_limit, 10));
$$;
grant execute on function public.get_top_countries(integer, integer) to anon, authenticated;

-- Top referrers (domains) in last N days (default 30)
create or replace function public.get_top_referrers(_days integer default 30, _limit integer default 10)
returns table(source text, visits integer)
language sql
stable
security definer
set search_path = public
as $$
  with cutoff as (
    select (now() at time zone 'utc')::date - make_interval(days => greatest(0, coalesce(_days, 30) - 1)) as d
  )
  select case
           when v.referrer is null or v.referrer = '' then 'direct'
           when v.referrer ilike 'http%' then split_part(split_part(v.referrer, '://', 2), '/', 1)
           else v.referrer
         end as source,
         count(distinct v.ip_address)::int as visits
  from public.web_visits v
  where timezone('utc', v.occurred_at) >= (select d from cutoff)
  group by 1
  order by visits desc
  limit greatest(1, coalesce(_limit, 10));
$$;
grant execute on function public.get_top_referrers(integer, integer) to anon, authenticated;

-- User-specific daily visit counts for last N days (default 30)
create or replace function public.get_user_visits_series_days(_user_id uuid, _days integer default 30)
returns table(date text, visits integer)
language sql
stable
security definer
set search_path = public
as $$
  with days as (
    select generate_series(
      (now() at time zone 'utc')::date - make_interval(days => greatest(0, coalesce(_days, 30) - 1)),
      (now() at time zone 'utc')::date,
      interval '1 day'
    )::date as d
  )
  select to_char(d, 'YYYY-MM-DD') as date,
         coalesce((
           select count(*)
           from public.web_visits v
           where v.user_id = _user_id
             and (timezone('utc', v.occurred_at))::date = d
         ), 0)::int as visits
  from days
  order by d asc;
$$;
grant execute on function public.get_user_visits_series_days(uuid, integer) to anon, authenticated;

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


-- ========== Activity logs ==========

-- ========== Admin notes on profiles ==========
-- Store admin-authored notes against user profiles for auditing and collaboration
create table if not exists public.profile_admin_notes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  admin_id uuid,
  admin_name text,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists pan_profile_time_idx on public.profile_admin_notes (profile_id, created_at desc);
create index if not exists pan_admin_time_idx on public.profile_admin_notes (admin_id, created_at desc);

alter table public.profile_admin_notes enable row level security;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='profile_admin_notes' and policyname='pan_admin_select') then
    drop policy pan_admin_select on public.profile_admin_notes;
  end if;
  create policy pan_admin_select on public.profile_admin_notes for select to authenticated
    using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true));
end $$;

-- ========== Admin activity logs ==========
-- Records admin actions for auditing; auto-purge older than 30 days
create table if not exists public.admin_activity_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles(id) on delete set null,
  admin_name text,
  action text not null,
  target text,
  detail jsonb not null default '{}',
  occurred_at timestamptz not null default now()
);

create index if not exists aal_time_idx on public.admin_activity_logs (occurred_at desc);
create index if not exists aal_admin_idx on public.admin_activity_logs (admin_id, occurred_at desc);

alter table public.admin_activity_logs enable row level security;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='admin_activity_logs' and policyname='aal_admin_select') then
    drop policy aal_admin_select on public.admin_activity_logs;
  end if;
  create policy aal_admin_select on public.admin_activity_logs for select to authenticated
    using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true));
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='admin_activity_logs' and policyname='aal_admin_insert') then
    drop policy aal_admin_insert on public.admin_activity_logs;
  end if;
  create policy aal_admin_insert on public.admin_activity_logs for insert to authenticated
    with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true));
end $$;

-- Purge admin logs older than 30 days daily
do $$ begin
  if exists (select 1 from pg_proc where proname = 'schedule_admin_logs_purge') then
    drop function schedule_admin_logs_purge();
  end if;
end $$;
create or replace function public.schedule_admin_logs_purge()
returns void language plpgsql as $$
begin
  perform cron.schedule('purge_admin_activity_logs', '0 3 * * *', $$
    delete from public.admin_activity_logs where occurred_at < now() - interval '30 days'$$);
end$$;
select public.schedule_admin_logs_purge();

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='profile_admin_notes' and policyname='pan_admin_insert') then
    drop policy pan_admin_insert on public.profile_admin_notes;
  end if;
  create policy pan_admin_insert on public.profile_admin_notes for insert to authenticated
    with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true));
end $$;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='profile_admin_notes' and policyname='pan_admin_delete') then
    drop policy pan_admin_delete on public.profile_admin_notes;
  end if;
  create policy pan_admin_delete on public.profile_admin_notes for delete to authenticated
    using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true));
end $$;

-- Captures per-garden human-readable activity events for the current day view
create table if not exists public.garden_activity_logs (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_name text,
  actor_color text,
  kind text not null check (kind in ('plant_added','plant_updated','plant_deleted','task_completed','task_progressed','note')),
  message text not null,
  plant_name text,
  task_name text,
  occurred_at timestamptz not null default now()
);

create index if not exists gal_garden_time_idx on public.garden_activity_logs (garden_id, occurred_at desc);

alter table public.garden_activity_logs enable row level security;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_activity_logs' and policyname='gal_select') then
    drop policy gal_select on public.garden_activity_logs;
  end if;
  create policy gal_select on public.garden_activity_logs for select to authenticated
    using (
      exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
      or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    );
end $$;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_activity_logs' and policyname='gal_insert') then
    drop policy gal_insert on public.garden_activity_logs;
  end if;
  create policy gal_insert on public.garden_activity_logs for insert to authenticated
    with check (
      exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
      or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    );
end $$;

-- Helper RPC to write an activity log with best-effort actor name
create or replace function public.log_garden_activity(
  _garden_id uuid,
  _kind text,
  _message text,
  _plant_name text default null,
  _task_name text default null,
  _actor_color text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_actor uuid := (select auth.uid()); v_name text; begin
  select display_name into v_name from public.profiles where id = v_actor;
  insert into public.garden_activity_logs (garden_id, actor_id, actor_name, actor_color, kind, message, plant_name, task_name, occurred_at)
  values (_garden_id, v_actor, v_name, nullif(_actor_color,''), _kind, _message, nullif(_plant_name,''), nullif(_task_name,''), now());
end; $$;

grant execute on function public.log_garden_activity(uuid, text, text, text, text, text) to anon, authenticated;
