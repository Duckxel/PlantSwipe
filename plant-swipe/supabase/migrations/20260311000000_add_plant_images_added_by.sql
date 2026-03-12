-- Add added_by column to plant_images to track which admin uploaded each image
alter table public.plant_images add column if not exists added_by uuid references auth.users(id) on delete set null;

-- Add index for querying images by uploader
create index if not exists plant_images_added_by_idx on public.plant_images (added_by) where added_by is not null;
