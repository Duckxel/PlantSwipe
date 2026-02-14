-- ========== Global Image Database (admin_media_uploads) ==========
-- Tracks ALL images uploaded across the platform: admin uploads, blog images, 
-- garden covers, message attachments, pro advice images, email images, etc.
create table if not exists public.admin_media_uploads (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid,                    -- User ID who uploaded (despite the name, can be any user)
  admin_email text,                 -- Email of uploader
  admin_name text,                  -- Display name of uploader
  bucket text not null,             -- Storage bucket name
  path text not null,               -- Path within the bucket
  public_url text,                  -- Public URL to access the image
  mime_type text,                   -- Final MIME type after optimization
  original_mime_type text,          -- Original MIME type before optimization
  size_bytes integer,               -- Final size in bytes
  original_size_bytes integer,      -- Original size before optimization
  quality integer,                  -- Quality setting used for optimization
  compression_percent integer,      -- Percentage of space saved
  metadata jsonb,                   -- Additional metadata (original name, garden info, etc.)
  upload_source text,               -- Function/purpose: admin, blog, garden_cover, messages, pro_advice, email
  created_at timestamptz not null default now()
);
create index if not exists admin_media_uploads_created_idx on public.admin_media_uploads (created_at desc);
create index if not exists admin_media_uploads_admin_idx on public.admin_media_uploads (admin_id);
create unique index if not exists admin_media_uploads_bucket_path_idx on public.admin_media_uploads (bucket, path);
create index if not exists admin_media_uploads_source_idx on public.admin_media_uploads (upload_source);
-- GIN index for efficient JSONB queries on metadata (tag, device filtering)
create index if not exists admin_media_uploads_metadata_idx on public.admin_media_uploads using gin (metadata jsonb_path_ops);

-- Add upload_source column to existing installations (safe to run multiple times)
do $$ begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'admin_media_uploads' 
    and column_name = 'upload_source'
  ) then
    alter table public.admin_media_uploads add column upload_source text;
  end if;
end $$;

-- Backfill upload_source from metadata for existing records
update public.admin_media_uploads
set upload_source = coalesce(
  metadata->>'scope',
  metadata->>'source',
  case 
    when path like '%garden%cover%' then 'garden_cover'
    when path like '%blog%' then 'blog'
    when path like '%messages%' then 'messages'
    when path like '%pro-advice%' or path like '%pro_advice%' then 'pro_advice'
    when path like '%contact%' then 'contact_screenshot'
    when path like '%journal%' then 'garden_journal'
    else 'admin'
  end
)
where upload_source is null;

-- ========== admin_media_uploads RLS ==========
alter table public.admin_media_uploads enable row level security;

-- Select: admins see all, users see their own uploads
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='admin_media_uploads' and policyname='amu_select') then
    drop policy amu_select on public.admin_media_uploads;
  end if;
  create policy amu_select on public.admin_media_uploads for select to authenticated
    using (
      admin_id = (select auth.uid())
      or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    );
end $$;

-- Insert: authenticated users can insert their own uploads
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='admin_media_uploads' and policyname='amu_insert') then
    drop policy amu_insert on public.admin_media_uploads;
  end if;
  create policy amu_insert on public.admin_media_uploads for insert to authenticated
    with check (
      admin_id = (select auth.uid())
      or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    );
end $$;

-- Delete: users can delete their own uploads, admins can delete any
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='admin_media_uploads' and policyname='amu_delete') then
    drop policy amu_delete on public.admin_media_uploads;
  end if;
  create policy amu_delete on public.admin_media_uploads for delete to authenticated
    using (
      admin_id = (select auth.uid())
      or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    );
end $$;

-- ========== Team Members (About page) ==========
create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  display_name text not null,
  role text not null,
  tag text,
  image_url text,
  position integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_team_members_position on public.team_members(position);
create index if not exists idx_team_members_active on public.team_members(is_active) where is_active = true;

alter table public.team_members enable row level security;

-- Policies: anyone can read active team members, only admins can modify
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'team_members' and policyname = 'team_members_select_public') then
    create policy team_members_select_public on public.team_members 
      for select to authenticated, anon 
      using (is_active = true);
  end if;
  
  if not exists (select 1 from pg_policies where tablename = 'team_members' and policyname = 'team_members_admin_all') then
    create policy team_members_admin_all on public.team_members 
      for all to authenticated 
      using (
        exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
      )
      with check (
        exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
      );
  end if;
end $$;

-- Trigger to update updated_at timestamp
create or replace function public.update_team_members_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql set search_path = public;

drop trigger if exists team_members_updated_at on public.team_members;
create trigger team_members_updated_at
  before update on public.team_members
  for each row
  execute function public.update_team_members_updated_at();

-- Insert initial team members (only if table is empty)
insert into public.team_members (name, display_name, role, tag, image_url, position, is_active)
select * from (values 
  ('lauryne', 'Lauryne Gaignard', 'CEO', null::text, null::text, 0, true),
  ('xavier', 'Xavier Sabar', 'Co-Founder', 'Psychokwak', 'https://media.aphylia.app/UTILITY/admin/uploads/webp/img-0151-ab46ee91-19d9-4c9f-9694-8c975c084cf1.webp', 1, true),
  ('five', 'Chan AH-HONG', 'Co-Founder', 'Five', 'https://media.aphylia.app/UTILITY/admin/uploads/webp/img-0414-2-low-0a499a50-08a7-4615-834d-288b179e628e.webp', 2, true)
) as t(name, display_name, role, tag, image_url, position, is_active)
where not exists (select 1 from public.team_members limit 1);

comment on table public.team_members is 'Team members displayed on the About page, managed via Admin panel';

-- Indexes for requested plant lookups
create index if not exists requested_plants_plant_name_normalized_idx on public.requested_plants(plant_name_normalized);
create unique index if not exists requested_plants_active_name_unique_idx on public.requested_plants(plant_name_normalized) where completed_at is null;
create index if not exists requested_plants_completed_at_idx on public.requested_plants(completed_at);
create index if not exists requested_plants_requested_by_idx on public.requested_plants(requested_by);
create index if not exists requested_plants_created_at_idx on public.requested_plants(created_at desc);

-- Trigger function to automatically update updated_at timestamp
create or replace function update_requested_plants_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Create trigger to update updated_at on row update
drop trigger if exists update_requested_plants_updated_at_trigger on public.requested_plants;
create trigger update_requested_plants_updated_at_trigger
  before update on public.requested_plants
  for each row
  execute function update_requested_plants_updated_at();

-- RLS policies for requested_plants
alter table public.requested_plants enable row level security;

-- Add table comment for documentation
comment on table public.requested_plants is 'Stores user requests for plants to be added to the encyclopedia. Similar requests increment the count instead of creating duplicates.';
comment on column public.requested_plants.plant_name is 'Display plant name requested by users (original casing preserved)';
comment on column public.requested_plants.plant_name_normalized is 'Lowercase, trimmed plant name used for deduplication and search';
comment on column public.requested_plants.requested_by is 'User ID of the person who made the request';
comment on column public.requested_plants.request_count is 'Number of times this plant has been requested (incremented for similar names)';
comment on column public.requested_plants.created_at is 'Timestamp when the first request for this plant was created';
comment on column public.requested_plants.updated_at is 'Timestamp when the request was last updated or incremented';
comment on column public.requested_plants.completed_at is 'Timestamp when the request was marked as completed by an admin';
comment on column public.requested_plants.completed_by is 'Admin user who completed the request';

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='requested_plants' and policyname='requested_plants_select_all') then
    drop policy requested_plants_select_all on public.requested_plants;
  end if;
  -- Allow authenticated users to read all requests (for admin purposes)
  -- Allow users to see their own requests
  create policy requested_plants_select_all on public.requested_plants for select to authenticated
    using (
      true
      or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    );
end $$;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='requested_plants' and policyname='requested_plants_insert') then
    drop policy requested_plants_insert on public.requested_plants;
  end if;
  -- Allow authenticated users to insert requests
  create policy requested_plants_insert on public.requested_plants for insert to authenticated
    with check (
      requested_by = (select auth.uid())
      or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    );
end $$;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='requested_plants' and policyname='requested_plants_update') then
    drop policy requested_plants_update on public.requested_plants;
  end if;
  -- Allow authenticated users to update request counts (for incrementing)
  create policy requested_plants_update on public.requested_plants for update to authenticated
    using (true)
    with check (true);
end $$;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='requested_plants' and policyname='requested_plants_delete') then
    drop policy requested_plants_delete on public.requested_plants;
  end if;
  -- Only admins can delete requests
  create policy requested_plants_delete on public.requested_plants for delete to authenticated
    using (
      exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    );
end $$;

-- Junction table to track all users who requested each plant
create table if not exists public.plant_request_users (
  id uuid primary key default gen_random_uuid(),
  requested_plant_id uuid not null references public.requested_plants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(requested_plant_id, user_id)
);

-- Indexes for plant_request_users
create index if not exists plant_request_users_requested_plant_id_idx on public.plant_request_users(requested_plant_id);
create index if not exists plant_request_users_user_id_idx on public.plant_request_users(user_id);
create index if not exists plant_request_users_created_at_idx on public.plant_request_users(created_at desc);

-- RLS policies for plant_request_users
alter table public.plant_request_users enable row level security;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_request_users' and policyname='plant_request_users_select_all') then
    drop policy plant_request_users_select_all on public.plant_request_users;
  end if;
  -- Allow admins to read all request users
  -- Also allow users to see their own requests
  create policy plant_request_users_select_all on public.plant_request_users for select to authenticated
    using (
      exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      or user_id = (select auth.uid())
    );
end $$;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_request_users' and policyname='plant_request_users_insert') then
    drop policy plant_request_users_insert on public.plant_request_users;
  end if;
  -- Allow authenticated users to insert their own requests
  create policy plant_request_users_insert on public.plant_request_users for insert to authenticated
    with check (
      user_id = (select auth.uid())
      or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    );
end $$;

-- Function to sync request_count from plant_request_users count
create or replace function public.sync_request_count()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.requested_plants
  set request_count = (
    select count(*)::integer
    from public.plant_request_users
    where requested_plant_id = coalesce(new.requested_plant_id, old.requested_plant_id)
  ),
  updated_at = now()
  where id = coalesce(new.requested_plant_id, old.requested_plant_id);
  return coalesce(new, old);
end;
$$;

-- Trigger to sync request_count when plant_request_users changes
drop trigger if exists sync_request_count_trigger on public.plant_request_users;
create trigger sync_request_count_trigger
  after insert or delete on public.plant_request_users
  for each row
  execute function public.sync_request_count();

comment on table public.plant_request_users is 'Junction table tracking all users who requested each plant. Used to maintain accurate request counts and list of requesters.';

