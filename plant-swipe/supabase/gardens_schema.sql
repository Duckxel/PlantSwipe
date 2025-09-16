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

create table if not exists public.garden_plants (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  plant_id text not null references public.plants(id) on delete cascade,
  nickname text,
  seeds_planted integer not null default 0,
  planted_at timestamptz,
  expected_bloom_date timestamptz
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
    using (
      exists (
        select 1 from public.garden_members gm2
        where gm2.garden_id = garden_id and gm2.user_id = auth.uid()
      )
    );
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'garden_members' and policyname = 'gm_insert') then
    drop policy gm_insert on public.garden_members;
  end if;
  create policy gm_insert on public.garden_members for insert to authenticated
    with check (
      exists (
        select 1 from public.garden_members gm
        where gm.garden_id = garden_id and gm.user_id = auth.uid() and gm.role = 'owner'
      ) and user_id is not null
    );
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'garden_members' and policyname = 'gm_delete') then
    drop policy gm_delete on public.garden_members;
  end if;
  create policy gm_delete on public.garden_members for delete to authenticated
    using (
      role <> 'owner' and (
        user_id = auth.uid() or exists (
          select 1 from public.garden_members gm
          where gm.garden_id = garden_id and gm.user_id = auth.uid() and gm.role = 'owner'
        )
      )
    );
end $$;

-- Allow owners to update members (e.g., promote to owner)
do $$ begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'garden_members' and policyname = 'gm_update') then
    drop policy gm_update on public.garden_members;
  end if;
  create policy gm_update on public.garden_members for update to authenticated
    using (
      exists (
        select 1 from public.garden_members gm
        where gm.garden_id = garden_id and gm.user_id = auth.uid() and gm.role = 'owner'
      )
    )
    with check (
      exists (
        select 1 from public.garden_members gm
        where gm.garden_id = garden_id and gm.user_id = auth.uid() and gm.role = 'owner'
      )
    );
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
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'garden_transactions' and policyname = 'gt_insert') then
    create policy gt_insert on public.garden_transactions for insert to authenticated
      with check (exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = auth.uid()));
  end if;
end $$;

