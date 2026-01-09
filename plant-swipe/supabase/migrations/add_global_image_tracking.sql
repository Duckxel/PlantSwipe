-- Migration: Add global image tracking enhancements
-- This migration enhances the admin_media_uploads table to serve as a global image database

-- Add upload_source column to track the function/purpose of each upload
alter table public.admin_media_uploads 
  add column if not exists upload_source text;

-- Add index for filtering by upload source
create index if not exists admin_media_uploads_source_idx 
  on public.admin_media_uploads (upload_source);

-- Add composite index for source + date filtering
create index if not exists admin_media_uploads_source_date_idx 
  on public.admin_media_uploads (upload_source, created_at desc);

-- Add index for user ID lookups
create index if not exists admin_media_uploads_user_idx 
  on public.admin_media_uploads (admin_id) where admin_id is not null;

-- Update existing records to populate upload_source from metadata.scope or metadata.source
update public.admin_media_uploads
set upload_source = coalesce(
  metadata->>'scope',
  metadata->>'source',
  case 
    when path like '%garden%cover%' then 'garden_cover'
    when path like '%blog%' then 'blog'
    when path like '%messages%' then 'messages'
    when path like '%pro-advice%' then 'pro_advice'
    else 'admin'
  end
)
where upload_source is null;

-- Add a comment describing the table's purpose
comment on table public.admin_media_uploads is 
  'Global image database tracking all uploads across the platform. Tracks admin uploads, blog images, garden covers, message attachments, and more.';

comment on column public.admin_media_uploads.upload_source is 
  'The function/purpose of the upload: admin, blog, garden_cover, messages, pro_advice, email, etc.';
