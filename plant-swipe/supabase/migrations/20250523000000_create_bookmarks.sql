-- Create bookmarks table
create table if not exists public.bookmarks (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  visibility text not null check (visibility in ('public', 'private')) default 'public',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookmarks_pkey primary key (id)
);

-- Create bookmark_items table
create table if not exists public.bookmark_items (
  id uuid not null default gen_random_uuid(),
  bookmark_id uuid not null references public.bookmarks(id) on delete cascade,
  plant_id text not null, -- Assuming plant IDs are text strings
  created_at timestamptz not null default now(),
  constraint bookmark_items_pkey primary key (id),
  constraint bookmark_items_unique_plant unique (bookmark_id, plant_id)
);

-- Enable RLS
alter table public.bookmarks enable row level security;
alter table public.bookmark_items enable row level security;

-- Policies for bookmarks
create policy "Bookmarks are viewable by everyone if public"
  on public.bookmarks for select
  using ( visibility = 'public' );

create policy "Users can view their own bookmarks"
  on public.bookmarks for select
  using ( auth.uid() = user_id );

create policy "Users can insert their own bookmarks"
  on public.bookmarks for insert
  with check ( auth.uid() = user_id );

create policy "Users can update their own bookmarks"
  on public.bookmarks for update
  using ( auth.uid() = user_id );

create policy "Users can delete their own bookmarks"
  on public.bookmarks for delete
  using ( auth.uid() = user_id );

-- Policies for bookmark_items
-- Users can view items if they can view the bookmark
create policy "Bookmark items are viewable if bookmark is viewable"
  on public.bookmark_items for select
  using (
    exists (
      select 1 from public.bookmarks
      where bookmarks.id = bookmark_items.bookmark_id
      and (bookmarks.visibility = 'public' or bookmarks.user_id = auth.uid())
    )
  );

-- Users can insert items if they own the bookmark
create policy "Users can insert items into their own bookmarks"
  on public.bookmark_items for insert
  with check (
    exists (
      select 1 from public.bookmarks
      where bookmarks.id = bookmark_items.bookmark_id
      and bookmarks.user_id = auth.uid()
    )
  );

-- Users can delete items from their own bookmarks
create policy "Users can delete items from their own bookmarks"
  on public.bookmark_items for delete
  using (
    exists (
      select 1 from public.bookmarks
      where bookmarks.id = bookmark_items.bookmark_id
      and bookmarks.user_id = auth.uid()
    )
  );

-- Function to handle new user creation
create or replace function public.handle_new_user_bookmark()
returns trigger as $$
begin
  insert into public.bookmarks (user_id, name, visibility)
  values (new.id, 'Default', 'public');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for new user
-- Check if trigger exists first to avoid error (optional but good practice)
drop trigger if exists on_auth_user_created_bookmark on auth.users;
create trigger on_auth_user_created_bookmark
  after insert on auth.users
  for each row execute procedure public.handle_new_user_bookmark();

-- Optional: Backfill for existing users (careful with large user bases)
-- insert into public.bookmarks (user_id, name, visibility)
-- select id, 'Default', 'public' from auth.users
-- where not exists (select 1 from public.bookmarks where user_id = auth.users.id);
