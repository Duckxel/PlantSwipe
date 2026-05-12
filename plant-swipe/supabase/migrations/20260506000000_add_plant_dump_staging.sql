-- Plant Image Dump bulk-upload staging tables. Mirrors
-- plant-swipe/supabase/sync_parts/23_plant_dump.sql exactly so applying the
-- migration on a database that has already been synced is a no-op.
--
-- Rows here are scratch state — once an image is matched to a plant and
-- promoted, it cascades into plant_images and the staging row is marked
-- status='submitted'. The HTTP layer in server.js gates
-- /api/admin/plant-dump/* behind ensureEditor/ensureAdmin, but the
-- policies below also enforce admin-only access at the table level so
-- direct PostgREST calls can't read or mutate staging rows.

create table if not exists public.plant_dump_groups (
  id uuid primary key default gen_random_uuid(),
  name text,
  plant_id text references public.plants(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_dump_images' and policyname='pdi_admin') then
    drop policy pdi_admin on public.plant_dump_images;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_dump_groups' and policyname='pdg_admin') then
    drop policy pdg_admin on public.plant_dump_groups;
  end if;

  create policy pdi_admin on public.plant_dump_images for all to authenticated
    using (public.is_admin_user((select auth.uid())))
    with check (public.is_admin_user((select auth.uid())));

  create policy pdg_admin on public.plant_dump_groups for all to authenticated
    using (public.is_admin_user((select auth.uid())))
    with check (public.is_admin_user((select auth.uid())));
end $$;

revoke all on public.plant_dump_images from anon;
revoke all on public.plant_dump_groups from anon;
revoke insert, update, delete on public.plant_dump_images from authenticated;
revoke insert, update, delete on public.plant_dump_groups from authenticated;
grant select on public.plant_dump_images to authenticated;
grant select on public.plant_dump_groups to authenticated;
