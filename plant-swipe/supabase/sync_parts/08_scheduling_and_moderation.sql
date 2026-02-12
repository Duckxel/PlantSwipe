-- ========== Scheduling (optional) ==========
-- Schedule daily computation at 00:05 UTC to:
-- 1. Create task occurrences for all gardens (for yesterday AND today)
-- 2. Recalculate yesterday's success based on actual task completion
-- 3. Update streaks (users who didn't complete tasks will lose their streak)
-- 4. Initialize today's task records
do $$ begin
  begin
    perform cron.schedule(
      'compute_daily_garden_tasks',
      '5 0 * * *',
      $_cron$select public.compute_daily_tasks_for_all_gardens((now() at time zone 'utc')::date)$_cron$
    );
  exception
    when others then
      null;
  end;
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
-- Expression index to accelerate daily unique IP aggregations in UTC
create index if not exists web_visits_day_utc_ip_idx on public.web_visits (((timezone('utc', occurred_at))::date), ip_address);

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

-- ========== User Reports (Moderation) ==========
-- Files/cases for user reports that admins review
create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reported_user_id uuid not null references public.profiles(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  status text not null default 'review' check (status in ('review', 'classified')),
  created_at timestamptz not null default now(),
  classified_at timestamptz,
  classified_by uuid references public.profiles(id) on delete set null
);
create index if not exists user_reports_reported_user_idx on public.user_reports (reported_user_id);
create index if not exists user_reports_reporter_idx on public.user_reports (reporter_id);
create index if not exists user_reports_status_idx on public.user_reports (status);
create index if not exists user_reports_created_at_idx on public.user_reports (created_at desc);

-- Admin notes on user reports
create table if not exists public.user_report_notes (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.user_reports(id) on delete cascade,
  admin_id uuid not null references public.profiles(id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now()
);
create index if not exists user_report_notes_report_idx on public.user_report_notes (report_id);

-- RLS for user_reports: admins can read all, users can create reports
alter table public.user_reports enable row level security;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='user_reports' and policyname='user_reports_admin_all') then
    drop policy user_reports_admin_all on public.user_reports;
  end if;
  create policy user_reports_admin_all on public.user_reports for all to authenticated
    using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true));
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='user_reports' and policyname='user_reports_user_insert') then
    drop policy user_reports_user_insert on public.user_reports;
  end if;
  create policy user_reports_user_insert on public.user_reports for insert to authenticated
    with check (reporter_id = (select auth.uid()));
end $$;

-- RLS for user_report_notes: admins only
alter table public.user_report_notes enable row level security;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='user_report_notes' and policyname='user_report_notes_admin_all') then
    drop policy user_report_notes_admin_all on public.user_report_notes;
  end if;
  create policy user_report_notes_admin_all on public.user_report_notes for all to authenticated
    using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true));
end $$;

-- ========== User Blocks ==========
-- Users can block other users to prevent friend requests, garden invites, etc.
create table if not exists public.user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists user_blocks_blocker_idx on public.user_blocks (blocker_id);
create index if not exists user_blocks_blocked_idx on public.user_blocks (blocked_id);

-- RLS for user_blocks: users can manage their own blocks
alter table public.user_blocks enable row level security;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='user_blocks' and policyname='user_blocks_own') then
    drop policy user_blocks_own on public.user_blocks;
  end if;
  create policy user_blocks_own on public.user_blocks for all to authenticated
    using (blocker_id = (select auth.uid()) or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true))
    with check (blocker_id = (select auth.uid()));
end $$;

-- Function to check if a user is blocked
create or replace function public.is_user_blocked(_blocker_id uuid, _blocked_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_blocks
    where blocker_id = _blocker_id and blocked_id = _blocked_id
  );
$$;
grant execute on function public.is_user_blocked(uuid, uuid) to authenticated;

-- Function to check if either user has blocked the other (bidirectional)
create or replace function public.are_users_blocked(_user1_id uuid, _user2_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_blocks
    where (blocker_id = _user1_id and blocked_id = _user2_id)
       or (blocker_id = _user2_id and blocked_id = _user1_id)
  );
$$;
grant execute on function public.are_users_blocked(uuid, uuid) to authenticated;

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

-- ========== Broadcast messages ==========
-- A simple table to store a single active broadcast at a time.
-- The Node server enforces single-active via API; schema remains minimal.
create table if not exists public.broadcast_messages (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  -- Severity of the broadcast for client rendering: info | warning | danger
  severity text not null default 'info' check (severity in ('info','warning','danger')),
  created_at timestamptz not null default now(),
  expires_at timestamptz null,
  removed_at timestamptz null,
  created_by uuid references public.profiles(id) on delete set null
);
create index if not exists broadcast_messages_created_at_idx on public.broadcast_messages (created_at desc);
create index if not exists broadcast_messages_active_idx on public.broadcast_messages (expires_at) where removed_at is null;
alter table public.broadcast_messages enable row level security;
-- Only admins can select/insert/update/delete via Supabase REST
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='broadcast_messages' and policyname='broadcast_admin_select') then
    drop policy broadcast_admin_select on public.broadcast_messages;
  end if;
  create policy broadcast_admin_select on public.broadcast_messages for select to authenticated
    using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true));
end $$;

-- Backfill for existing deployments where table existed without severity
alter table if exists public.broadcast_messages
  add column if not exists severity text;
update public.broadcast_messages set severity = 'info' where severity is null;
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'broadcast_messages_severity_chk'
  ) then
    alter table public.broadcast_messages
      add constraint broadcast_messages_severity_chk check (severity in ('info','warning','danger'));
  end if;
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='broadcast_messages' and policyname='broadcast_admin_write') then
    drop policy broadcast_admin_write on public.broadcast_messages;
  end if;
  create policy broadcast_admin_write on public.broadcast_messages for all to authenticated
    using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true))
    with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true));
end $$;

-- ========== Blog posts ==========
create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(both from title)) between 4 and 200),
  slug text not null,
  body_html text not null,
  editor_data jsonb,
  author_id uuid not null references public.profiles(id) on delete restrict,
  author_name text,
  cover_image_url text,
  excerpt text,
  is_published boolean not null default true,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  show_cover_image boolean not null default false,
  updated_by_name text,
  seo_title text,
  seo_description text,
  tags text[] default '{}',
  unique(slug)
);

-- Add new columns if they don't exist (for existing deployments)
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'blog_posts' and column_name = 'show_cover_image') then
    alter table public.blog_posts add column show_cover_image boolean not null default false;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'blog_posts' and column_name = 'updated_by_name') then
    alter table public.blog_posts add column updated_by_name text;
  end if;
end $$;

-- Add SEO metadata columns if they don't exist (for existing deployments)
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'blog_posts' and column_name = 'seo_title') then
    alter table public.blog_posts add column seo_title text;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'blog_posts' and column_name = 'seo_description') then
    alter table public.blog_posts add column seo_description text;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'blog_posts' and column_name = 'tags') then
    alter table public.blog_posts add column tags text[] default '{}';
  end if;
end $$;

create index if not exists blog_posts_published_idx on public.blog_posts (is_published desc, published_at desc nulls last, created_at desc);
create index if not exists blog_posts_tags_idx on public.blog_posts using gin (tags);
create index if not exists blog_posts_author_idx on public.blog_posts (author_id, created_at desc);

create or replace function public.update_blog_posts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  if new.published_at is null then
    new.published_at = old.published_at;
  end if;
  return new;
end;
$$;

drop trigger if exists blog_posts_set_updated_at on public.blog_posts;
create trigger blog_posts_set_updated_at
  before update on public.blog_posts
  for each row
  execute function public.update_blog_posts_updated_at();

alter table public.blog_posts enable row level security;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='blog_posts' and policyname='blog_posts_public_select') then
    drop policy blog_posts_public_select on public.blog_posts;
  end if;
  create policy blog_posts_public_select on public.blog_posts for select to authenticated, anon
    using (
      is_published = true
      or public.is_admin_user((select auth.uid()))
    );
end $$;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='blog_posts' and policyname='blog_posts_admin_write') then
    drop policy blog_posts_admin_write on public.blog_posts;
  end if;
  create policy blog_posts_admin_write on public.blog_posts for all to authenticated
    using (public.is_admin_user((select auth.uid())))
    with check (public.is_admin_user((select auth.uid())));
end $$;

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

-- ========== Shadow Ban System (Threat Level 3) ==========
-- When a user's threat level is set to 3, they become a "shadow" on the platform:
-- their account is NOT deleted, but all public-facing settings are locked down.
-- The shadow_ban_backup column stores pre-ban settings so changes are fully reversible.

-- Apply shadow ban: saves current settings, then locks everything down
create or replace function public.apply_shadow_ban(_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile record;
  v_garden_backups jsonb;
  v_bookmark_backups jsonb;
begin
  -- 1. Read current profile settings before overwriting
  select
    is_private,
    disable_friend_requests,
    notify_email,
    notify_push,
    marketing_consent,
    email_product_updates,
    email_tips_advice,
    email_community_highlights,
    email_promotions,
    push_task_reminders,
    push_friend_activity,
    push_messages,
    push_garden_updates,
    personalized_recommendations,
    analytics_improvement
  into v_profile
  from public.profiles
  where id = _user_id;

  if v_profile is null then
    raise exception 'User % not found', _user_id;
  end if;

  -- 2. Collect current garden privacy settings
  select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'privacy', g.privacy)), '[]'::jsonb)
  into v_garden_backups
  from public.gardens g
  join public.garden_members gm on gm.garden_id = g.id
  where gm.user_id = _user_id and gm.role = 'owner';

  -- 3. Collect current bookmark visibility settings
  select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'visibility', b.visibility)), '[]'::jsonb)
  into v_bookmark_backups
  from public.bookmarks b
  where b.user_id = _user_id;

  -- 4. Store backup in profile (only if not already shadow-banned, to avoid overwriting original backup)
  update public.profiles
  set shadow_ban_backup = jsonb_build_object(
    'profile', jsonb_build_object(
      'is_private', v_profile.is_private,
      'disable_friend_requests', v_profile.disable_friend_requests,
      'notify_email', v_profile.notify_email,
      'notify_push', v_profile.notify_push,
      'marketing_consent', v_profile.marketing_consent,
      'email_product_updates', v_profile.email_product_updates,
      'email_tips_advice', v_profile.email_tips_advice,
      'email_community_highlights', v_profile.email_community_highlights,
      'email_promotions', v_profile.email_promotions,
      'push_task_reminders', v_profile.push_task_reminders,
      'push_friend_activity', v_profile.push_friend_activity,
      'push_messages', v_profile.push_messages,
      'push_garden_updates', v_profile.push_garden_updates,
      'personalized_recommendations', v_profile.personalized_recommendations,
      'analytics_improvement', v_profile.analytics_improvement
    ),
    'gardens', v_garden_backups,
    'bookmarks', v_bookmark_backups,
    'applied_at', to_jsonb(now())
  )
  where id = _user_id
    and shadow_ban_backup is null; -- Don't overwrite existing backup

  -- 5. Lock down profile: private, no friend requests, no emails/push
  update public.profiles
  set
    is_private = true,
    disable_friend_requests = true,
    notify_email = false,
    notify_push = false,
    marketing_consent = false,
    email_product_updates = false,
    email_tips_advice = false,
    email_community_highlights = false,
    email_promotions = false,
    push_task_reminders = false,
    push_friend_activity = false,
    push_messages = false,
    push_garden_updates = false,
    personalized_recommendations = false,
    analytics_improvement = false
  where id = _user_id;

  -- 6. Make all gardens owned by this user private
  update public.gardens
  set privacy = 'private'
  where id in (
    select gm.garden_id
    from public.garden_members gm
    where gm.user_id = _user_id and gm.role = 'owner'
  );

  -- 7. Make all bookmarks private
  update public.bookmarks
  set visibility = 'private'
  where user_id = _user_id;

  -- 8. Delete pending friend requests TO this user (others can't add them)
  delete from public.friend_requests
  where recipient_id = _user_id and status = 'pending';

  -- 9. Delete pending friend requests FROM this user
  delete from public.friend_requests
  where requester_id = _user_id and status = 'pending';

  -- 10. Cancel pending garden invites to/from this user
  update public.garden_invites
  set status = 'cancelled', responded_at = now()
  where (invitee_id = _user_id or inviter_id = _user_id)
    and status = 'pending';

end;
$$;

-- Revert shadow ban: restores pre-ban settings from backup
create or replace function public.revert_shadow_ban(_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_backup jsonb;
  v_profile_backup jsonb;
  v_garden record;
  v_bookmark record;
begin
  -- 1. Read backup
  select shadow_ban_backup into v_backup
  from public.profiles
  where id = _user_id;

  if v_backup is null then
    -- No backup to restore; just ensure private settings are reasonable defaults
    update public.profiles
    set
      is_private = false,
      disable_friend_requests = false,
      notify_email = true,
      notify_push = true
    where id = _user_id;
    return;
  end if;

  v_profile_backup := v_backup -> 'profile';

  -- 2. Restore profile settings from backup
  update public.profiles
  set
    is_private = coalesce((v_profile_backup ->> 'is_private')::boolean, false),
    disable_friend_requests = coalesce((v_profile_backup ->> 'disable_friend_requests')::boolean, false),
    notify_email = coalesce((v_profile_backup ->> 'notify_email')::boolean, true),
    notify_push = coalesce((v_profile_backup ->> 'notify_push')::boolean, true),
    marketing_consent = coalesce((v_profile_backup ->> 'marketing_consent')::boolean, false),
    email_product_updates = coalesce((v_profile_backup ->> 'email_product_updates')::boolean, true),
    email_tips_advice = coalesce((v_profile_backup ->> 'email_tips_advice')::boolean, true),
    email_community_highlights = coalesce((v_profile_backup ->> 'email_community_highlights')::boolean, true),
    email_promotions = coalesce((v_profile_backup ->> 'email_promotions')::boolean, false),
    push_task_reminders = coalesce((v_profile_backup ->> 'push_task_reminders')::boolean, true),
    push_friend_activity = coalesce((v_profile_backup ->> 'push_friend_activity')::boolean, true),
    push_messages = coalesce((v_profile_backup ->> 'push_messages')::boolean, true),
    push_garden_updates = coalesce((v_profile_backup ->> 'push_garden_updates')::boolean, true),
    personalized_recommendations = coalesce((v_profile_backup ->> 'personalized_recommendations')::boolean, true),
    analytics_improvement = coalesce((v_profile_backup ->> 'analytics_improvement')::boolean, true),
    shadow_ban_backup = null  -- Clear backup after restore
  where id = _user_id;

  -- 3. Restore garden privacy settings
  if v_backup -> 'gardens' is not null then
    for v_garden in select * from jsonb_array_elements(v_backup -> 'gardens') loop
      update public.gardens
      set privacy = coalesce(v_garden.value ->> 'privacy', 'private')
      where id = (v_garden.value ->> 'id')::uuid;
    end loop;
  end if;

  -- 4. Restore bookmark visibility settings
  if v_backup -> 'bookmarks' is not null then
    for v_bookmark in select * from jsonb_array_elements(v_backup -> 'bookmarks') loop
      update public.bookmarks
      set visibility = coalesce(v_bookmark.value ->> 'visibility', 'public')
      where id = (v_bookmark.value ->> 'id')::uuid;
    end loop;
  end if;

end;
$$;

-- Grant execute to authenticated (admin will call these via service role anyway)
grant execute on function public.apply_shadow_ban(uuid) to authenticated;
grant execute on function public.revert_shadow_ban(uuid) to authenticated;

