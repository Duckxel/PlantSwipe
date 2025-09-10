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

-- Garden members: members can select; owners can insert members; members can delete themselves
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'garden_members' and policyname = 'gm_select') then
    create policy gm_select on public.garden_members for select
      using (user_id = auth.uid() or exists (select 1 from public.garden_members gm2 where gm2.garden_id = garden_id and gm2.user_id = auth.uid()));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'garden_members' and policyname = 'gm_insert') then
    create policy gm_insert on public.garden_members for insert to authenticated
      with check (exists (select 1 from public.gardens g where g.id = garden_id and g.created_by = auth.uid()) and user_id is not null);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'garden_members' and policyname = 'gm_delete') then
    create policy gm_delete on public.garden_members for delete to authenticated
      using (user_id = auth.uid() or exists (select 1 from public.gardens g where g.id = garden_id and g.created_by = auth.uid()));
  end if;
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

