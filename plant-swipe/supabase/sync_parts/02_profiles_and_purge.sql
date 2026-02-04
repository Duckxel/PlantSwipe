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
alter table if exists public.profiles add column if not exists city text;
alter table if exists public.profiles add column if not exists bio text;
alter table if exists public.profiles add column if not exists favorite_plant text;
alter table if exists public.profiles add column if not exists avatar_url text;
alter table if exists public.profiles add column if not exists timezone text;
alter table if exists public.profiles add column if not exists experience_years integer;
-- Accent color preference; default to a green tone for new accounts
alter table if exists public.profiles add column if not exists accent_key text default 'emerald';
COMMENT ON COLUMN public.profiles.accent_key IS 'User accent color preference. Valid values: emerald, crimson, royal, purple, gold, coral, neon, turquoise';
-- Privacy setting: when true, profile is only visible to friends
alter table if exists public.profiles add column if not exists is_private boolean not null default false;
-- Friend requests setting: when true, users cannot send friend requests (prevents unwanted invites)
alter table if exists public.profiles add column if not exists disable_friend_requests boolean not null default false;
-- Garden invite privacy: 'anyone' (default) or 'friends_only' to restrict who can send garden invites
alter table if exists public.profiles add column if not exists garden_invite_privacy text default 'anyone' check (garden_invite_privacy in ('anyone', 'friends_only'));
-- Language preference: stores user's preferred language code (e.g., 'en', 'fr')
alter table if exists public.profiles add column if not exists language text default 'en';
-- Notification preferences: push notifications and email campaigns (default to true/enabled)
alter table if exists public.profiles add column if not exists notify_push boolean default true;
alter table if exists public.profiles add column if not exists notify_email boolean default true;
-- User roles: admin, editor, pro, merchant, creator, vip, plus
alter table if exists public.profiles add column if not exists roles text[] default '{}';
-- Threat level: 0=Safe, 1=Sus (1 incident), 2=Danger (multiple incidents), 3=Banned
alter table if exists public.profiles add column if not exists threat_level integer not null default 0 check (threat_level >= 0 and threat_level <= 3);
-- Bug Catcher points: total accumulated bug points for users with bug_catcher role
alter table if exists public.profiles add column if not exists bug_points integer default 0;
-- Create GIN index for efficient role queries
create index if not exists idx_profiles_roles on public.profiles using GIN (roles);
-- Create index for threat level queries
create index if not exists idx_profiles_threat_level on public.profiles (threat_level) where threat_level > 0;

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

-- Role helper functions for policy checks
create or replace function public.has_role(_user_id uuid, _role text)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1 from public.profiles
    where id = _user_id
      and _role = any(coalesce(roles, '{}'))
  );
$$;

create or replace function public.has_any_role(_user_id uuid, _roles text[])
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1 from public.profiles
    where id = _user_id
      and coalesce(roles, '{}') && _roles
  );
$$;

grant execute on function public.has_role(uuid, text) to anon, authenticated;
grant execute on function public.has_any_role(uuid, text[]) to anon, authenticated;

alter table public.profiles enable row level security;
-- Helper to avoid RLS self-recursion when checking admin
-- Uses SECURITY DEFINER to bypass RLS on public.profiles
-- Checks both is_admin flag AND 'admin' role in roles array
create or replace function public.is_admin_user(_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = _user_id and (is_admin = true OR 'admin' = ANY(COALESCE(roles, '{}')))
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
      or exists (
        select 1 from public.friends f
        where (f.user_id = (select auth.uid()) and f.friend_id = profiles.id)
        or (f.friend_id = (select auth.uid()) and f.user_id = profiles.id)
      )
      or exists (
        select 1 from public.friend_requests fr
        where fr.requester_id = profiles.id
        and fr.recipient_id = (select auth.uid())
        and fr.status = 'pending'
      )
      or exists (
        select 1 from public.friend_requests fr
        where fr.recipient_id = profiles.id
        and fr.requester_id = (select auth.uid())
        and fr.status = 'pending'
      )
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

-- Grant permissions on profiles table to authenticated users
-- This ensures users can read/write their own profile data (subject to RLS policies)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;

-- Aggregated like counts (security definer to bypass profiles RLS)
create or replace function public.top_liked_plants(limit_count integer default 5)
returns table (plant_id text, likes bigint)
language sql
security definer
set search_path = public
as $$
  select liked_id as plant_id, count(*)::bigint as likes
  from public.profiles p
  cross join lateral unnest(p.liked_plant_ids) as liked_id
  where coalesce(trim(liked_id), '') <> ''
  group by liked_id
  order by count(*) desc, liked_id asc
  limit greatest(coalesce(limit_count, 5), 0);
$$;
grant execute on function public.top_liked_plants(integer) to anon, authenticated;

-- ========== Purge old web_visits (retention) ==========
-- Keep only the last 35 days of visit data
do $$ begin
  begin
    perform cron.schedule(
      'purge_old_web_visits',
      '0 3 * * *',
      $_cron$
      delete from public.web_visits
      where timezone('utc', occurred_at) < ((now() at time zone 'utc')::date - interval '35 days');
      $_cron$
    );
  exception
    when others then
      null;
  end;
end $$;

-- ========== Purge old completed bug reports (retention) ==========
-- Delete bug reports with status 'completed' that are older than 10 days
-- Runs daily at 4 AM UTC
do $$ begin
  begin
    -- First unschedule if exists to allow updates
    perform cron.unschedule('purge_old_bug_reports');
  exception
    when others then
      null;
  end;
  begin
    perform cron.schedule(
      'purge_old_bug_reports',
      '0 4 * * *',
      $_cron$
      delete from public.bug_reports
      where status = 'completed'
        and timezone('utc', created_at) < ((now() at time zone 'utc')::date - interval '10 days');
      $_cron$
    );
  exception
    when others then
      null;
  end;
end $$;

