-- ====================================================
-- Plant Image Dump: bulk upload staging tables
-- ====================================================

-- Groups for organizing dump images that belong to the same plant
create table if not exists public.plant_dump_groups (
  id uuid primary key default gen_random_uuid(),
  name text,
  plant_id text references public.plants(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Individual images uploaded to the dump staging area
create table if not exists public.plant_dump_images (
  id uuid primary key default gen_random_uuid(),
  bucket text not null default 'PLANTS',
  path text not null,
  url text not null,
  original_name text,
  size_bytes integer,
  group_id uuid references public.plant_dump_groups(id) on delete set null,
  plant_id text references public.plants(id) on delete set null,
  uploaded_by uuid references auth.users(id) on delete set null,
  uploaded_at timestamptz not null default now(),
  status text not null default 'pending'
    check (status in ('pending', 'submitted', 'deleted')),
  submitted_at timestamptz,
  deleted_at timestamptz
);

create index if not exists pdi_status_idx on public.plant_dump_images (status) where status = 'pending';
create index if not exists pdi_group_idx  on public.plant_dump_images (group_id);
create index if not exists pdi_plant_idx  on public.plant_dump_images (plant_id);
create index if not exists pdi_upload_idx on public.plant_dump_images (uploaded_at desc);

alter table public.plant_dump_images enable row level security;
alter table public.plant_dump_groups  enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='plant_dump_images' and policyname='pdi_admin') then
    create policy pdi_admin on public.plant_dump_images for all to authenticated
      using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='plant_dump_groups' and policyname='pdg_admin') then
    create policy pdg_admin on public.plant_dump_groups for all to authenticated
      using (true) with check (true);
  end if;
end $$;
