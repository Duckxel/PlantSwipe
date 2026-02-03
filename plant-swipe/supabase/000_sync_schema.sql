-- plantswipe: single idempotent SQL to sync DB schema to current app usage
-- Safe to run multiple times. Creates/updates required objects, and removes unused ones without dropping data rows.
-- NOTE: Requires Postgres + Supabase environment (auth schema present). Uses security definer where needed.

-- ========== Extensions ==========
create extension if not exists pgcrypto;
-- Optional: scheduling support
create extension if not exists pg_cron;
-- Optional: network requests (for edge functions)
create extension if not exists pg_net;

-- ========== Secrets Management (for DB-initiated edge functions) ==========
create table if not exists public.admin_secrets (
  key text primary key,
  value text not null,
  description text,
  updated_at timestamptz default now()
);
alter table public.admin_secrets enable row level security;
-- Only allows service_role to access
drop policy if exists "Service role only" on public.admin_secrets;
create policy "Service role only" on public.admin_secrets for all using (false);

-- ========== Helper: Invoke Edge Function ==========
-- Drop first to allow return type change (uuid -> bigint to match net.http_post)
drop function if exists public.invoke_edge_function(text, jsonb);

create or replace function public.invoke_edge_function(
  function_name text,
  payload jsonb default '{}'::jsonb
) returns bigint as $$
declare
  project_url text;
  service_key text;
  request_id bigint;
begin
  select value into project_url from public.admin_secrets where key = 'SUPABASE_URL';
  select value into service_key from public.admin_secrets where key = 'SUPABASE_SERVICE_ROLE_KEY';

  if project_url is null or service_key is null then
    raise warning '[invoke_edge_function] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in admin_secrets';
    return null;
  end if;

  -- Ensure URL ends with /functions/v1/
  if not project_url like '%/functions/v1%' then
     project_url := trim(both '/' from project_url) || '/functions/v1';
  end if;
  
  select net.http_post(
    url := project_url || '/' || function_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', service_key,
      'Authorization', 'Bearer ' || service_key
    ),
    body := payload
  ) into request_id;

  return request_id;
end;
$$ language plpgsql security definer;

-- ========== Scheduled Tasks ==========
-- Email Campaign Runner (every minute)
select cron.schedule(
  'invoke-email-campaign-runner',
  '* * * * *',
  $$select public.invoke_edge_function('email-campaign-runner')$$
);

-- Aphylia Chat Image Cleanup (hourly)
-- NOTE: The actual file cleanup for chat images stored in uploads/to_delete folder
-- is handled by the Node.js server cron job (server.js) since files are stored on disk.
-- Files older than 1 hour are automatically deleted.
-- This comment serves as documentation for the cleanup mechanism.

-- ========== Public schema hard cleanup (drops rogue tables) ==========
-- IMPORTANT: All tables created in this schema MUST be listed here to avoid data loss!
-- When adding a new table, add it to this list immediately.
do $$ declare
  allowed_tables constant text[] := array[
    -- Core tables
    'admin_secrets',
    'profiles',
    -- Plant data
    'plants',
    'plant_watering_schedules',
    'plant_sources',
    'plant_infusion_mixes',
    'plant_pro_advices',
    'plant_images',
    'colors',
    'plant_colors',
    'color_translations',
    'translation_languages',
    'plant_translations',
    'requested_plants',
    'plant_request_users',
    -- Admin & media
    'admin_media_uploads',
    'admin_activity_logs',
    'admin_email_templates',
    'admin_email_template_translations',
    'admin_email_template_versions',
    'admin_email_campaigns',
    'admin_campaign_sends',
    'admin_email_triggers',
    'admin_automatic_email_sends',
    'team_members',
    -- Gardens
    'gardens',
    'garden_members',
    'garden_plants',
    'garden_plant_events',
    'garden_inventory',
    'garden_instance_inventory',
    'garden_transactions',
    'garden_tasks',
    'garden_plant_schedule',
    'garden_watering_schedule',
    'garden_plant_tasks',
    'garden_plant_task_occurrences',
    'garden_task_user_completions',
    'garden_activity_logs',
    -- Social
    'friend_requests',
    'friends',
    'bookmarks',
    'bookmark_items',
    'garden_invites',
    'user_blocks',
    -- Moderation & analytics
    'web_visits',
    'banned_accounts',
    'banned_ips',
    'broadcast_messages',
    'blog_posts',
    'profile_admin_notes',
    'user_reports',
    'user_report_notes',
    -- Notifications
    'notification_campaigns',
    'notification_templates',
    'notification_template_translations',
    'notification_automations',
    'user_notifications',
    'user_push_subscriptions',
    -- Analytics & AI Advice
    'garden_ai_advice',
    'garden_analytics_snapshots',
    'garden_user_activity',
    'garden_plant_images',
    -- Journal
    'garden_journal_entries',
    'garden_journal_photos',
    -- Messaging
    'conversations',
    'messages',
    'message_reactions',
    -- Landing Page CMS
    'landing_page_settings',
    'landing_hero_cards',
    'landing_stats',
    'landing_stats_translations',
    'landing_testimonials',
    'landing_faq',
    'landing_faq_translations',
    'landing_demo_features',
    'landing_demo_feature_translations',
    'landing_showcase_config',
    -- Plant Scanning
    'plant_scans',
    -- Bug Catcher System
    'bug_actions',
    'bug_action_responses',
    'bug_reports',
    'bug_points_history'
  ];
  rec record;
begin
  for rec in
    select tablename
    from pg_tables
    where schemaname = 'public'
      and tablename not like 'pg_%'
      and tablename not like 'sql_%'
  loop
    if not (rec.tablename = any(allowed_tables)) then
      execute format('drop table if exists public.%I cascade', rec.tablename);
    end if;
  end loop;
end $$;

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

-- ========== Plants base table ==========
-- ARCHITECTURE NOTE: As of 2024, ALL translatable content is stored ONLY in plant_translations.
-- This table contains ONLY non-translatable base data. No translatable columns exist here
-- except for 'name' which is the canonical English name used for unique constraint.
--
-- NAME HANDLING:
--   plants.name = canonical English name (unique constraint)
--   plant_translations.name = displayed name for each language (including English)
--   When saving in English, BOTH plants.name AND plant_translations.name are updated
--
-- COMPANIONS: The companions array stores plant IDs (not names) for stable references.
--
-- NON-TRANSLATABLE FIELDS (stored in this table):
--   id, name (canonical English), plant_type, utility, comestible_part, fruit_type
--   spiked, scent, multicolor, bicolor
--   temperature_max, temperature_min, temperature_ideal, hygrometry
--   watering_type, division, soil, mulching, nutrition_need, fertilizer
--   sowing_month, flowering_month, fruiting_month
--   height_cm, wingspan_cm, tutoring, sow_type, separation_cm, transplanting
--   infusion, aromatherapy
--   melliferous, polenizer, be_fertilizer, conservation_status
--   companions
--   status, admin_commentary, created_by, created_time, updated_by, updated_time
--
-- TRANSLATABLE FIELDS (stored ONLY in plant_translations):
--   spice_mixes, pests, diseases (also kept in plants table for backward compatibility)
--   name, given_names, scientific_name, family, overview
--   promotion_month, life_cycle, season, foliage_persistance
--   toxicity_human, toxicity_pets, allergens, symbolism
--   living_space, composition, maintenance_level
--   origin, habitat, level_sun
--   advice_soil, advice_mulching, advice_fertilizer
--   advice_tutoring, advice_sowing, cut
--   advice_medicinal, advice_infusion, nutritional_intake, recipes_ideas
--   ground_effect, source_name, source_url, tags

create table if not exists public.plants (
  id text primary key,
  -- Canonical English name (unique constraint). When saving in English, this AND
  -- plant_translations.name (language='en') are both updated.
  name text not null,
  -- Non-translatable classification fields
  plant_type text check (plant_type in ('plant','flower','bamboo','shrub','tree','cactus','succulent')),
  utility text[] not null default '{}'::text[] check (utility <@ array['comestible','ornemental','produce_fruit','aromatic','medicinal','odorous','climbing','cereal','spice']),
  comestible_part text[] not null default '{}'::text[] check (comestible_part <@ array['flower','fruit','seed','leaf','stem','root','bulb','bark','wood']),
  fruit_type text[] not null default '{}'::text[] check (fruit_type <@ array['nut','seed','stone']),
  -- Non-translatable identity fields
  spiked boolean default false,
  scent boolean default false,
  multicolor boolean default false,
  bicolor boolean default false,
  -- Non-translatable plant care fields
  temperature_max integer,
  temperature_min integer,
  temperature_ideal integer,
  hygrometry integer,
  watering_type text[] not null default '{}'::text[] check (watering_type <@ array['surface','buried','hose','drop','drench']),
  division text[] not null default '{}'::text[] check (division <@ array['seed','cutting','division','layering','grafting','tissue separation','bulb separation']),
  soil text[] not null default '{}'::text[] check (soil <@ array['vermiculite','perlite','sphagnum moss','rock wool','sand','gravel','potting soil','peat','clay pebbles','coconut fiber','bark','wood chips']),
  mulching text[] not null default '{}'::text[] check (mulching <@ array['wood chips','bark','green manure','cocoa bean hulls','buckwheat hulls','cereal straw','hemp straw','woven fabric','pozzolana','crushed slate','clay pellets']),
  nutrition_need text[] not null default '{}'::text[] check (nutrition_need <@ array['nitrogen','phosphorus','potassium','calcium','magnesium','sulfur','iron','boron','manganese','molybene','chlorine','copper','zinc','nitrate','phosphate']),
  fertilizer text[] not null default '{}'::text[] check (fertilizer <@ array['granular fertilizer','liquid fertilizer','meat flour','fish flour','crushed bones','crushed horns','slurry','manure','animal excrement','sea fertilizer','yurals','wine','guano','coffee grounds','banana peel','eggshell','vegetable cooking water','urine','grass clippings','vegetable waste','natural mulch']),
  -- Non-translatable growth fields
  sowing_month text[] not null default '{}'::text[] check (sowing_month <@ array['january','february','march','april','may','june','july','august','september','october','november','december']),
  flowering_month text[] not null default '{}'::text[] check (flowering_month <@ array['january','february','march','april','may','june','july','august','september','october','november','december']),
  fruiting_month text[] not null default '{}'::text[] check (fruiting_month <@ array['january','february','march','april','may','june','july','august','september','october','november','december']),
  height_cm integer,
  wingspan_cm integer,
  tutoring boolean default false,
  sow_type text[] not null default '{}'::text[] check (sow_type <@ array['direct','indoor','row','hill','broadcast','seed tray','cell','pot']),
  separation_cm integer,
  transplanting boolean,
  -- Non-translatable usage fields
  infusion boolean default false,
  aromatherapy boolean default false,
  -- DEPRECATED: spice_mixes moved to plant_translations (will be dropped after migration)
  spice_mixes text[] not null default '{}',
  -- Non-translatable ecology fields
  melliferous boolean default false,
  polenizer text[] not null default '{}'::text[] check (polenizer <@ array['bee','wasp','ant','butterfly','bird','mosquito','fly','beetle','ladybug','stagbeetle','cockchafer','dungbeetle','weevil']),
  be_fertilizer boolean default false,
  conservation_status text check (conservation_status in ('safe','at risk','vulnerable','endangered','critically endangered','extinct')),
  -- DEPRECATED: pests and diseases moved to plant_translations (will be dropped after migration)
  pests text[] not null default '{}',
  diseases text[] not null default '{}',
  -- Non-translatable miscellaneous fields
  -- companions stores plant IDs (not names) for stable references
  companions text[] not null default '{}',
  -- Meta (non-translatable)
  status text check (status in ('in progres','rework','review','approved')),
  admin_commentary text,
  created_by text,
  created_time timestamptz not null default now(),
  updated_by text,
  updated_time timestamptz not null default now()
);

-- Unique constraint on name - canonical English name for the plant
create unique index if not exists plants_name_unique on public.plants (lower(name));

-- Drop the scientific_name unique constraint if it exists
-- Multiple plants can have the same scientific name (different cultivars, varieties, etc.)
drop index if exists plants_scientific_name_unique;
alter table if exists public.plants drop constraint if exists plants_scientific_name_unique;

-- Ensure meta columns exist on older deployments (add columns before referencing them)
alter table if exists public.plants add column if not exists status text check (status in ('in progres','rework','review','approved'));
alter table if exists public.plants add column if not exists admin_commentary text;
alter table if exists public.plants add column if not exists given_names text[] not null default '{}';
alter table if exists public.plants add column if not exists created_by text;
alter table if exists public.plants add column if not exists created_time timestamptz not null default now();
alter table if exists public.plants add column if not exists updated_by text;
alter table if exists public.plants add column if not exists updated_time timestamptz not null default now();

alter table if exists public.plants alter column status set default 'in progres';
update public.plants set status = 'in progres' where status is null;

-- Backfill all plant attribute columns on existing deployments
alter table if exists public.plants add column if not exists plant_type text check (plant_type in ('plant','flower','bamboo','shrub','tree','cactus','succulent'));
alter table if exists public.plants add column if not exists utility text[] not null default '{}'::text[] check (utility <@ array['comestible','ornemental','produce_fruit','aromatic','medicinal','odorous','climbing','cereal','spice']);
alter table if exists public.plants add column if not exists comestible_part text[] not null default '{}'::text[] check (comestible_part <@ array['flower','fruit','seed','leaf','stem','root','bulb','bark','wood']);
alter table if exists public.plants add column if not exists fruit_type text[] not null default '{}'::text[] check (fruit_type <@ array['nut','seed','stone']);
alter table if exists public.plants add column if not exists given_names text[] not null default '{}';
alter table if exists public.plants add column if not exists scientific_name text;
alter table if exists public.plants add column if not exists family text;
alter table if exists public.plants add column if not exists overview text;
alter table if exists public.plants add column if not exists promotion_month text check (promotion_month in ('january','february','march','april','may','june','july','august','september','october','november','december'));
alter table if exists public.plants add column if not exists life_cycle text check (life_cycle in ('annual','biennials','perenials','ephemerals','monocarpic','polycarpic'));
alter table if exists public.plants add column if not exists season text[] not null default '{}'::text[] check (season <@ array['spring','summer','autumn','winter']);
alter table if exists public.plants add column if not exists foliage_persistance text check (foliage_persistance in ('deciduous','evergreen','semi-evergreen','marcescent'));
alter table if exists public.plants add column if not exists spiked boolean default false;
alter table if exists public.plants add column if not exists toxicity_human text check (toxicity_human in ('non-toxic','midly irritating','highly toxic','lethally toxic'));
alter table if exists public.plants add column if not exists toxicity_pets text check (toxicity_pets in ('non-toxic','midly irritating','highly toxic','lethally toxic'));
alter table if exists public.plants add column if not exists allergens text[] not null default '{}';
alter table if exists public.plants add column if not exists scent boolean default false;
alter table if exists public.plants add column if not exists symbolism text[] not null default '{}';
alter table if exists public.plants add column if not exists living_space text check (living_space in ('indoor','outdoor','both'));
alter table if exists public.plants add column if not exists composition text[] not null default '{}'::text[] check (composition <@ array['flowerbed','path','hedge','ground cover','pot']);
alter table if exists public.plants add column if not exists maintenance_level text check (maintenance_level in ('none','low','moderate','heavy'));
alter table if exists public.plants add column if not exists multicolor boolean default false;
alter table if exists public.plants add column if not exists bicolor boolean default false;
alter table if exists public.plants add column if not exists origin text[] not null default '{}';
alter table if exists public.plants add column if not exists habitat text[] not null default '{}'::text[] check (habitat <@ array['aquatic','semi-aquatic','wetland','tropical','temperate','arid','mediterranean','mountain','grassland','forest','coastal','urban']);
alter table if exists public.plants add column if not exists temperature_max integer;
alter table if exists public.plants add column if not exists temperature_min integer;
alter table if exists public.plants add column if not exists temperature_ideal integer;
alter table if exists public.plants add column if not exists level_sun text check (level_sun in ('low light','shade','partial sun','full sun'));
alter table if exists public.plants add column if not exists hygrometry integer;
alter table if exists public.plants add column if not exists watering_type text[] not null default '{}'::text[] check (watering_type <@ array['surface','buried','hose','drop','drench']);
alter table if exists public.plants add column if not exists division text[] not null default '{}'::text[] check (division <@ array['seed','cutting','division','layering','grafting','tissue separation','bulb separation']);
alter table if exists public.plants add column if not exists soil text[] not null default '{}'::text[] check (soil <@ array['vermiculite','perlite','sphagnum moss','rock wool','sand','gravel','potting soil','peat','clay pebbles','coconut fiber','bark','wood chips']);
alter table if exists public.plants add column if not exists advice_soil text;
alter table if exists public.plants add column if not exists mulching text[] not null default '{}'::text[] check (mulching <@ array['wood chips','bark','green manure','cocoa bean hulls','buckwheat hulls','cereal straw','hemp straw','woven fabric','pozzolana','crushed slate','clay pellets']);
alter table if exists public.plants add column if not exists advice_mulching text;
alter table if exists public.plants add column if not exists nutrition_need text[] not null default '{}'::text[] check (nutrition_need <@ array['nitrogen','phosphorus','potassium','calcium','magnesium','sulfur','iron','boron','manganese','molybene','chlorine','copper','zinc','nitrate','phosphate']);
alter table if exists public.plants add column if not exists fertilizer text[] not null default '{}'::text[] check (fertilizer <@ array['granular fertilizer','liquid fertilizer','meat flour','fish flour','crushed bones','crushed horns','slurry','manure','animal excrement','sea fertilizer','yurals','wine','guano','coffee grounds','banana peel','eggshell','vegetable cooking water','urine','grass clippings','vegetable waste','natural mulch']);
alter table if exists public.plants add column if not exists advice_fertilizer text;
alter table if exists public.plants add column if not exists sowing_month text[] not null default '{}'::text[] check (sowing_month <@ array['january','february','march','april','may','june','july','august','september','october','november','december']);
alter table if exists public.plants add column if not exists flowering_month text[] not null default '{}'::text[] check (flowering_month <@ array['january','february','march','april','may','june','july','august','september','october','november','december']);
alter table if exists public.plants add column if not exists fruiting_month text[] not null default '{}'::text[] check (fruiting_month <@ array['january','february','march','april','may','june','july','august','september','october','november','december']);
alter table if exists public.plants add column if not exists height_cm integer;
alter table if exists public.plants add column if not exists wingspan_cm integer;
alter table if exists public.plants add column if not exists tutoring boolean default false;
alter table if exists public.plants add column if not exists advice_tutoring text;
alter table if exists public.plants add column if not exists sow_type text[] not null default '{}'::text[] check (sow_type <@ array['direct','indoor','row','hill','broadcast','seed tray','cell','pot']);
alter table if exists public.plants add column if not exists separation_cm integer;
alter table if exists public.plants add column if not exists transplanting boolean;
alter table if exists public.plants add column if not exists advice_sowing text;
alter table if exists public.plants add column if not exists cut text;
alter table if exists public.plants add column if not exists advice_medicinal text;
alter table if exists public.plants add column if not exists nutritional_intake text[] not null default '{}';
alter table if exists public.plants add column if not exists infusion boolean default false;
alter table if exists public.plants add column if not exists advice_infusion text;
alter table if exists public.plants add column if not exists recipes_ideas text[] not null default '{}';
alter table if exists public.plants add column if not exists aromatherapy boolean default false;
alter table if exists public.plants add column if not exists spice_mixes text[] not null default '{}';
alter table if exists public.plants add column if not exists melliferous boolean default false;
alter table if exists public.plants add column if not exists polenizer text[] not null default '{}'::text[] check (polenizer <@ array['bee','wasp','ant','butterfly','bird','mosquito','fly','beetle','ladybug','stagbeetle','cockchafer','dungbeetle','weevil']);
alter table if exists public.plants add column if not exists be_fertilizer boolean default false;
alter table if exists public.plants add column if not exists ground_effect text;
alter table if exists public.plants add column if not exists conservation_status text check (conservation_status in ('safe','at risk','vulnerable','endangered','critically endangered','extinct'));
alter table if exists public.plants add column if not exists pests text[] not null default '{}';
alter table if exists public.plants add column if not exists diseases text[] not null default '{}';
alter table if exists public.plants add column if not exists companions text[] not null default '{}';
alter table if exists public.plants add column if not exists tags text[] not null default '{}';
alter table if exists public.plants add column if not exists source_name text;
alter table if exists public.plants add column if not exists source_url text;
-- Drop obsolete JSON columns from earlier iterations
alter table if exists public.plants drop column if exists identity;
alter table if exists public.plants drop column if exists plant_care;
alter table if exists public.plants drop column if exists growth;
alter table if exists public.plants drop column if exists usage;
alter table if exists public.plants drop column if exists ecology;
alter table if exists public.plants drop column if exists danger;
alter table if exists public.plants drop column if exists miscellaneous;
alter table if exists public.plants drop column if exists meta;
alter table if exists public.plants drop column if exists identifiers;
alter table if exists public.plants drop column if exists traits;
alter table if exists public.plants drop column if exists dimensions;
alter table if exists public.plants drop column if exists phenology;
alter table if exists public.plants drop column if exists environment;
alter table if exists public.plants drop column if exists care;
alter table if exists public.plants drop column if exists propagation;
alter table if exists public.plants drop column if exists commerce;
alter table if exists public.plants drop column if exists problems;
alter table if exists public.plants drop column if exists planting;
alter table if exists public.plants drop column if exists photos;
alter table if exists public.plants drop column if exists classification;
alter table if exists public.plants drop column if exists description;
alter table if exists public.plants drop column if exists seasons;
alter table if exists public.plants drop column if exists seeds_available;
alter table if exists public.plants drop column if exists water_freq_period;
alter table if exists public.plants drop column if exists water_freq_amount;
alter table if exists public.plants drop column if exists water_freq_unit;
alter table if exists public.plants drop column if exists water_freq_value;
alter table if exists public.plants drop column if exists updated_at;

-- Update plant_type check constraint to include all valid types (including 'succulent')
-- This fixes databases where the column was created with an older constraint
do $$ begin
  -- Drop the old constraint if it exists (constraint name may vary)
  if exists (
    select 1 from pg_constraint c
    join pg_namespace n on n.oid = c.connamespace
    where c.conrelid = 'public.plants'::regclass
    and c.contype = 'c'
    and c.conname like '%plant_type%'
  ) then
    execute (
      select 'alter table public.plants drop constraint ' || quote_ident(c.conname)
      from pg_constraint c
      join pg_namespace n on n.oid = c.connamespace
      where c.conrelid = 'public.plants'::regclass
      and c.contype = 'c'
      and c.conname like '%plant_type%'
      limit 1
    );
  end if;
  -- Add the updated constraint with all valid plant types
  alter table public.plants add constraint plants_plant_type_check 
    check (plant_type is null or plant_type in ('plant','flower','bamboo','shrub','tree','cactus','succulent'));
exception when duplicate_object then
  -- Constraint already exists with correct definition
  null;
end $$;

-- Strict column whitelist for plants (drops anything not declared above)
do $$ declare
  allowed_columns constant text[] := array[
    'id',
    'name',
    'plant_type',
    'utility',
    'comestible_part',
    'fruit_type',
    'given_names',
    'scientific_name',
    'family',
    'overview',
    'promotion_month',
    'life_cycle',
    'season',
    'foliage_persistance',
    'spiked',
    'toxicity_human',
    'toxicity_pets',
    'allergens',
    'scent',
    'symbolism',
    'living_space',
    'composition',
    'maintenance_level',
    'multicolor',
    'bicolor',
    'origin',
    'habitat',
    'temperature_max',
    'temperature_min',
    'temperature_ideal',
    'level_sun',
    'hygrometry',
    'watering_type',
    'division',
    'soil',
    'advice_soil',
    'mulching',
    'advice_mulching',
    'nutrition_need',
    'fertilizer',
    'advice_fertilizer',
    'sowing_month',
    'flowering_month',
    'fruiting_month',
    'height_cm',
    'wingspan_cm',
    'tutoring',
    'advice_tutoring',
    'sow_type',
    'separation_cm',
    'transplanting',
    'advice_sowing',
    'cut',
    'advice_medicinal',
    'nutritional_intake',
    'infusion',
    'advice_infusion',
    'recipes_ideas',
    'aromatherapy',
    'spice_mixes',
    'melliferous',
    'polenizer',
    'be_fertilizer',
    'ground_effect',
    'conservation_status',
    'pests',
    'diseases',
    'companions',
    'tags',
    'source_name',
    'source_url',
    'status',
    'admin_commentary',
    'created_by',
    'created_time',
    'updated_by',
    'updated_time'
  ];
  rec record;
begin
  for rec in
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'plants'
  loop
    if not (rec.column_name = any(allowed_columns)) then
      execute format('alter table public.%I drop column %I cascade', 'plants', rec.column_name);
    end if;
  end loop;
end $$;

alter table public.plants enable row level security;
-- Clean up legacy duplicate read policies if present
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plants' and policyname='Allow read plants') then
    drop policy "Allow read plants" on public.plants;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plants' and policyname='Allow select for all') then
    drop policy "Allow select for all" on public.plants;
  end if;
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plants' and policyname='plants_select_all') then
    drop policy plants_select_all on public.plants;
  end if;
  -- Allow anyone (including anon) to read plants
  create policy plants_select_all on public.plants for select to authenticated, anon using (true);
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plants' and policyname='plants_iud_all') then
    drop policy plants_iud_all on public.plants;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plants' and policyname='plants_insert') then
    drop policy plants_insert on public.plants;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plants' and policyname='plants_update') then
    drop policy plants_update on public.plants;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plants' and policyname='plants_delete') then
    drop policy plants_delete on public.plants;
  end if;
  create policy plants_insert on public.plants for insert to authenticated with check (true);
  create policy plants_update on public.plants for update to authenticated using (true) with check (true);
  create policy plants_delete on public.plants for delete to authenticated using (true);
end $$;

-- ========== Plant watering schedules ==========
create table if not exists public.plant_watering_schedules (
  id uuid primary key default gen_random_uuid(),
  plant_id text not null references public.plants(id) on delete cascade,
  season text check (season is null or season in ('spring','summer','autumn','winter')),
  quantity integer,
  time_period text check (time_period is null or time_period in ('week','month','year')),
  created_at timestamptz not null default now()
);
alter table public.plant_watering_schedules alter column season drop not null;
alter table public.plant_watering_schedules alter column quantity drop not null;
alter table public.plant_watering_schedules alter column time_period drop not null;
do $$ begin
  if exists (
    select 1
    from information_schema.columns
    where table_name='plant_watering_schedules'
      and column_name='quantity'
      and data_type <> 'integer'
  ) then
    alter table public.plant_watering_schedules alter column quantity type integer using nullif(quantity, '')::integer;
  end if;
end $$;
do $$ begin
  if exists (select 1 from information_schema.constraint_column_usage where table_name='plant_watering_schedules' and constraint_name='plant_watering_schedules_season_check') then
    alter table public.plant_watering_schedules drop constraint plant_watering_schedules_season_check;
  end if;
  if exists (select 1 from information_schema.constraint_column_usage where table_name='plant_watering_schedules' and constraint_name='plant_watering_schedules_time_period_check') then
    alter table public.plant_watering_schedules drop constraint plant_watering_schedules_time_period_check;
  end if;
  alter table public.plant_watering_schedules add constraint plant_watering_schedules_season_check check (season is null or season in ('spring','summer','autumn','winter'));
  alter table public.plant_watering_schedules add constraint plant_watering_schedules_time_period_check check (time_period is null or time_period in ('week','month','year'));
end $$;
create index if not exists plant_watering_schedules_plant_id_idx on public.plant_watering_schedules(plant_id);
alter table public.plant_watering_schedules enable row level security;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_watering_schedules' and policyname='plant_watering_schedules_select_all') then
    drop policy plant_watering_schedules_select_all on public.plant_watering_schedules;
  end if;
  create policy plant_watering_schedules_select_all on public.plant_watering_schedules for select to authenticated, anon using (true);
end $$;

-- ========== Plant sources ==========
create table if not exists public.plant_sources (
  id uuid primary key default gen_random_uuid(),
  plant_id text not null references public.plants(id) on delete cascade,
  name text not null,
  url text,
  created_at timestamptz not null default now()
);
create index if not exists plant_sources_plant_id_idx on public.plant_sources(plant_id);
alter table public.plant_sources enable row level security;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_sources' and policyname='plant_sources_select_all') then
    drop policy plant_sources_select_all on public.plant_sources;
  end if;
  create policy plant_sources_select_all on public.plant_sources for select to authenticated, anon using (true);
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_sources' and policyname='plant_sources_all') then
    drop policy plant_sources_all on public.plant_sources;
  end if;
  create policy plant_sources_all on public.plant_sources for all to authenticated using (true) with check (true);
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_watering_schedules' and policyname='plant_watering_schedules_all') then
    drop policy plant_watering_schedules_all on public.plant_watering_schedules;
  end if;
  create policy plant_watering_schedules_all on public.plant_watering_schedules for all to authenticated using (true) with check (true);
end $$;

-- ========== Plant infusion mixes ==========
create table if not exists public.plant_infusion_mixes (
  id uuid primary key default gen_random_uuid(),
  plant_id text not null references public.plants(id) on delete cascade,
  mix_name text not null,
  benefit text,
  created_at timestamptz not null default now()
);
create index if not exists plant_infusion_mixes_plant_id_idx on public.plant_infusion_mixes(plant_id);
alter table public.plant_infusion_mixes enable row level security;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_infusion_mixes' and policyname='plant_infusion_mixes_select_all') then
    drop policy plant_infusion_mixes_select_all on public.plant_infusion_mixes;
  end if;
  create policy plant_infusion_mixes_select_all on public.plant_infusion_mixes for select to authenticated, anon using (true);
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_infusion_mixes' and policyname='plant_infusion_mixes_all') then
    drop policy plant_infusion_mixes_all on public.plant_infusion_mixes;
  end if;
  create policy plant_infusion_mixes_all on public.plant_infusion_mixes for all to authenticated using (true) with check (true);
end $$;

-- ========== Plant professional advice (Pro/Admin/Editor contributions) ==========
create table if not exists public.plant_pro_advices (
  id uuid primary key default gen_random_uuid(),
  plant_id text not null references public.plants(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  author_display_name text,
  author_username text,
  author_avatar_url text,
  author_roles text[] not null default '{}'::text[],
  content text not null,
  original_language text,
  translations jsonb not null default '{}'::jsonb,
  image_url text,
  reference_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint plant_pro_advices_content_not_blank check (char_length(btrim(content)) > 0),
  constraint plant_pro_advices_metadata_object check (metadata is null or jsonb_typeof(metadata) = 'object')
);

-- Add translation columns if they don't exist (for existing databases)
-- This ensures the columns are added without losing existing data
do $$ begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'plant_pro_advices' 
    and column_name = 'original_language'
  ) then
    alter table public.plant_pro_advices add column original_language text;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'plant_pro_advices' 
    and column_name = 'translations'
  ) then
    alter table public.plant_pro_advices add column translations jsonb not null default '{}'::jsonb;
  end if;
end $$;

-- Add constraint for translations column if it doesn't exist
do $$ begin
  if not exists (
    select 1 from information_schema.table_constraints 
    where table_schema = 'public' 
    and table_name = 'plant_pro_advices' 
    and constraint_name = 'plant_pro_advices_translations_object'
  ) then
    alter table public.plant_pro_advices 
      add constraint plant_pro_advices_translations_object 
      check (translations is null or jsonb_typeof(translations) = 'object');
  end if;
end $$;

-- Create indexes
create index if not exists plant_pro_advices_plant_created_idx on public.plant_pro_advices (plant_id, created_at desc);
create index if not exists plant_pro_advices_original_language_idx on public.plant_pro_advices (original_language);

-- Add column comments
comment on column public.plant_pro_advices.original_language is 'ISO language code of the original content (e.g., en, fr). Detected via DeepL API when advice is created.';
comment on column public.plant_pro_advices.translations is 'JSONB object storing cached translations keyed by language code. Example: {"fr": "Traduit...", "en": "Translated..."}';

alter table public.plant_pro_advices enable row level security;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_pro_advices' and policyname='plant_pro_advices_select_all') then
    drop policy plant_pro_advices_select_all on public.plant_pro_advices;
  end if;
  create policy plant_pro_advices_select_all on public.plant_pro_advices for select to authenticated, anon using (true);
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_pro_advices' and policyname='plant_pro_advices_insert_authorized') then
    drop policy plant_pro_advices_insert_authorized on public.plant_pro_advices;
  end if;
  create policy plant_pro_advices_insert_authorized on public.plant_pro_advices for insert to authenticated
    with check (
      author_id = auth.uid()
      and coalesce(public.has_any_role(auth.uid(), array['admin','editor','pro']), false)
    );
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_pro_advices' and policyname='plant_pro_advices_update_moderate') then
    drop policy plant_pro_advices_update_moderate on public.plant_pro_advices;
  end if;
  create policy plant_pro_advices_update_moderate on public.plant_pro_advices for update to authenticated
    using (
      author_id = auth.uid()
      or coalesce(public.has_any_role(auth.uid(), array['admin','editor']), false)
    )
    with check (
      author_id = auth.uid()
      or coalesce(public.has_any_role(auth.uid(), array['admin','editor']), false)
    );
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_pro_advices' and policyname='plant_pro_advices_delete_moderate') then
    drop policy plant_pro_advices_delete_moderate on public.plant_pro_advices;
  end if;
  create policy plant_pro_advices_delete_moderate on public.plant_pro_advices for delete to authenticated
    using (
      author_id = auth.uid()
      or coalesce(public.has_any_role(auth.uid(), array['admin','editor']), false)
    );
end $$;

-- ========== Plant images ==========
create table if not exists public.plant_images (
  id uuid primary key default gen_random_uuid(),
  plant_id text not null references public.plants(id) on delete cascade,
  link text not null,
  use text not null default 'other' check (use in ('primary','discovery','other')),
  created_at timestamptz not null default now(),
  -- Allow same image URL to be used by different plants (composite unique)
  unique (plant_id, link)
);
-- Drop the old global link uniqueness constraint if it exists (migration)
alter table if exists public.plant_images drop constraint if exists plant_images_link_key;
-- Ensure composite uniqueness on (plant_id, link)
create unique index if not exists plant_images_plant_link_unique on public.plant_images (plant_id, link);
-- Drop old use uniqueness constraint that may have been created without the WHERE clause
-- This is needed because CREATE INDEX IF NOT EXISTS won't update an existing index
drop index if exists public.plant_images_use_unique;
-- Keep uniqueness on (plant_id, use) ONLY for primary/discovery images
-- This allows unlimited 'other' images per plant, but only 1 primary and 1 discovery
create unique index plant_images_use_unique on public.plant_images (plant_id, use) where use in ('primary', 'discovery');
alter table public.plant_images enable row level security;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_images' and policyname='plant_images_select') then
    drop policy plant_images_select on public.plant_images;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_images' and policyname='plant_images_modify') then
    drop policy plant_images_modify on public.plant_images;
  end if;
  create policy plant_images_select on public.plant_images for select to authenticated, anon using (true);
  create policy plant_images_modify on public.plant_images for all to authenticated using (true) with check (true);
end $$;

-- ========== Color catalog and plant links ==========
create table if not exists public.colors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  hex_code text,
  is_primary boolean not null default false,
  parent_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add new columns if they don't exist (for existing databases)
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='colors' and column_name='is_primary') then
    alter table public.colors add column is_primary boolean not null default false;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='colors' and column_name='parent_ids') then
    alter table public.colors add column parent_ids uuid[] not null default '{}';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='colors' and column_name='updated_at') then
    alter table public.colors add column updated_at timestamptz not null default now();
  end if;
  -- Make hex_code nullable (it was previously not null unique, but we want to allow colors without hex)
  alter table public.colors alter column hex_code drop not null;
exception when others then null;
end $$;

-- Drop the unique constraint on hex_code if it exists (allow multiple colors with same hex or null hex)
do $$ begin
  alter table public.colors drop constraint if exists colors_hex_code_key;
exception when others then null;
end $$;

create table if not exists public.plant_colors (
  plant_id text not null references public.plants(id) on delete cascade,
  color_id uuid not null references public.colors(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (plant_id, color_id)
);

-- ========== Color translations ==========
create table if not exists public.color_translations (
  id uuid primary key default gen_random_uuid(),
  color_id uuid not null references public.colors(id) on delete cascade,
  language text not null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (color_id, language)
);

alter table public.colors enable row level security;
alter table public.plant_colors enable row level security;
alter table public.color_translations enable row level security;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='colors' and policyname='colors_read_all') then
    drop policy colors_read_all on public.colors;
  end if;
  create policy colors_read_all on public.colors for select to authenticated, anon using (true);
  if exists (select 1 from pg_policies where schemaname='public' and tablename='colors' and policyname='colors_modify') then
    drop policy colors_modify on public.colors;
  end if;
  create policy colors_modify on public.colors for all to authenticated using (true) with check (true);
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_colors' and policyname='plant_colors_all') then
    drop policy plant_colors_all on public.plant_colors;
  end if;
  create policy plant_colors_all on public.plant_colors for all to authenticated using (true) with check (true);
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_colors' and policyname='plant_colors_read') then
    drop policy plant_colors_read on public.plant_colors;
  end if;
  create policy plant_colors_read on public.plant_colors for select to authenticated, anon using (true);
  -- Color translations policies
  if exists (select 1 from pg_policies where schemaname='public' and tablename='color_translations' and policyname='color_translations_read_all') then
    drop policy color_translations_read_all on public.color_translations;
  end if;
  create policy color_translations_read_all on public.color_translations for select to authenticated, anon using (true);
  if exists (select 1 from pg_policies where schemaname='public' and tablename='color_translations' and policyname='color_translations_modify') then
    drop policy color_translations_modify on public.color_translations;
  end if;
  create policy color_translations_modify on public.color_translations for all to authenticated using (true) with check (true);
end $$;

-- Create index for faster parent lookups
create index if not exists idx_colors_parent_ids on public.colors using gin (parent_ids);
create index if not exists idx_colors_is_primary on public.colors (is_primary) where is_primary = true;
create index if not exists idx_color_translations_color_id on public.color_translations (color_id);
create index if not exists idx_color_translations_language on public.color_translations (language);

-- Language catalog for translations
create table if not exists public.translation_languages (
  code text primary key,
  label text
);

insert into public.translation_languages (code, label)
values
  ('en', 'English'),
  ('fr', 'Français')
on conflict (code) do update set label = excluded.label;

alter table public.translation_languages enable row level security;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='translation_languages' and policyname='translation_languages_all') then
    drop policy translation_languages_all on public.translation_languages;
  end if;
  create policy translation_languages_all on public.translation_languages for all to authenticated using (true) with check (true);
  if exists (select 1 from pg_policies where schemaname='public' and tablename='translation_languages' and policyname='translation_languages_read') then
    drop policy translation_languages_read on public.translation_languages;
  end if;
  create policy translation_languages_read on public.translation_languages for select to authenticated, anon using (true);
end $$;

-- ========== Plant translations (multi-language support) ==========
-- ARCHITECTURE NOTE: As of 2024, ALL translatable content is stored in plant_translations
-- for ALL languages INCLUDING English. The plants table contains only non-translatable
-- base data (IDs, booleans, numbers, timestamps). English is treated as a translation
-- just like French or any other language.
--
-- Translatable fields (in plant_translations for ALL languages):
--   name, given_names, scientific_name, family, overview
--   promotion_month, life_cycle, season, foliage_persistance
--   toxicity_human, toxicity_pets, allergens, symbolism
--   living_space, composition, maintenance_level
--   origin, habitat, level_sun
--   advice_soil, advice_mulching, advice_fertilizer
--   advice_tutoring, advice_sowing, advice_medicinal, advice_infusion
--   ground_effect, cut, nutritional_intake, recipes_ideas
--   source_name, source_url, tags
--
-- Non-translatable fields (in plants table only):
--   id, plant_type, utility, comestible_part, fruit_type
--   spiked, scent, multicolor, bicolor
--   temperature_max, temperature_min, temperature_ideal, hygrometry
--   watering_type, division, soil, mulching, nutrition_need, fertilizer
--   sowing_month, flowering_month, fruiting_month
--   height_cm, wingspan_cm, tutoring, sow_type, separation_cm, transplanting
--   infusion, aromatherapy
--   melliferous, polenizer, be_fertilizer, conservation_status
--   companions
--   status, admin_commentary, created_by, created_time, updated_by, updated_time
--   (spice_mixes, pests, diseases are NOW TRANSLATABLE - stored in both tables for compatibility)

create table if not exists public.plant_translations (
  id uuid primary key default gen_random_uuid(),
  plant_id text not null references public.plants(id) on delete cascade,
  language text not null references public.translation_languages(code),
  -- Core translatable fields
  name text not null,
  given_names text[] not null default '{}',
  scientific_name text,
  family text,
  overview text,
  -- Identity translatable fields
  promotion_month text check (promotion_month in ('january','february','march','april','may','june','july','august','september','october','november','december')),
  life_cycle text check (life_cycle in ('annual','biennials','perenials','ephemerals','monocarpic','polycarpic')),
  season text[] not null default '{}'::text[] check (season <@ array['spring','summer','autumn','winter']),
  foliage_persistance text check (foliage_persistance in ('deciduous','evergreen','semi-evergreen','marcescent')),
  toxicity_human text check (toxicity_human in ('non-toxic','midly irritating','highly toxic','lethally toxic')),
  toxicity_pets text check (toxicity_pets in ('non-toxic','midly irritating','highly toxic','lethally toxic')),
  allergens text[] not null default '{}',
  symbolism text[] not null default '{}',
  living_space text check (living_space in ('indoor','outdoor','both')),
  composition text[] not null default '{}'::text[] check (composition <@ array['flowerbed','path','hedge','ground cover','pot']),
  maintenance_level text check (maintenance_level in ('none','low','moderate','heavy')),
  -- Care translatable fields
  origin text[] not null default '{}',
  habitat text[] not null default '{}'::text[] check (habitat <@ array['aquatic','semi-aquatic','wetland','tropical','temperate','arid','mediterranean','mountain','grassland','forest','coastal','urban']),
  level_sun text check (level_sun in ('low light','shade','partial sun','full sun')),
  advice_soil text,
  advice_mulching text,
  advice_fertilizer text,
  -- Growth translatable fields
  advice_tutoring text,
  advice_sowing text,
  cut text,
  -- Usage translatable fields
  advice_medicinal text,
  advice_infusion text,
  nutritional_intake text[] not null default '{}',
  recipes_ideas text[] not null default '{}',
  -- Ecology translatable fields
  ground_effect text,
  -- Miscellaneous translatable fields
  source_name text,
  source_url text,
  tags text[] not null default '{}',
  -- Translatable array fields (spice mixes, pests, diseases)
  spice_mixes text[] not null default '{}',
  pests text[] not null default '{}',
  diseases text[] not null default '{}',
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plant_id, language)
);

alter table if exists public.plant_translations drop constraint if exists plant_translations_language_check;

-- Index for faster lookups
create index if not exists plant_translations_plant_id_idx on public.plant_translations(plant_id);
create index if not exists plant_translations_language_idx on public.plant_translations(language);
-- Ensure new JSONB translatable columns exist
alter table if exists public.plant_translations drop column if exists identifiers;
alter table if exists public.plant_translations drop column if exists ecology;
alter table if exists public.plant_translations drop column if exists usage;
alter table if exists public.plant_translations drop column if exists meta;
alter table if exists public.plant_translations drop column if exists phenology;
alter table if exists public.plant_translations drop column if exists care;
alter table if exists public.plant_translations drop column if exists planting;
alter table if exists public.plant_translations drop column if exists problems;

-- Translatable text fields only in plant_translations
alter table if exists public.plant_translations add column if not exists overview text;
alter table if exists public.plant_translations add column if not exists given_names text[] not null default '{}';
alter table if exists public.plant_translations add column if not exists allergens text[] not null default '{}';
alter table if exists public.plant_translations add column if not exists symbolism text[] not null default '{}';
alter table if exists public.plant_translations add column if not exists origin text[] not null default '{}';

-- The following are NOT translated - they stay only in plants table (enums/Latin names)
-- Migrate data from plant_translations to plants before dropping columns
do $$
begin
  -- Migrate scientific_name from plant_translations to plants (prefer English, then any)
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'plant_translations' and column_name = 'scientific_name') then
    update public.plants p set scientific_name = pt.scientific_name
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.language = 'en' and pt.scientific_name is not null and (p.scientific_name is null or trim(p.scientific_name) = '');
    
    update public.plants p set scientific_name = pt.scientific_name
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.scientific_name is not null and (p.scientific_name is null or trim(p.scientific_name) = '');
  end if;
  
  -- Migrate promotion_month from plant_translations to plants (prefer English, then any)
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'plant_translations' and column_name = 'promotion_month') then
    update public.plants p set promotion_month = pt.promotion_month
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.language = 'en' and pt.promotion_month is not null and p.promotion_month is null;
    
    update public.plants p set promotion_month = pt.promotion_month
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.promotion_month is not null and p.promotion_month is null;
  end if;
  
  -- Migrate level_sun from plant_translations to plants (prefer English, then any)
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'plant_translations' and column_name = 'level_sun') then
    update public.plants p set level_sun = pt.level_sun
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.language = 'en' and pt.level_sun is not null and p.level_sun is null;
    
    update public.plants p set level_sun = pt.level_sun
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.level_sun is not null and p.level_sun is null;
  end if;
  
  -- Migrate habitat from plant_translations to plants
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'plant_translations' and column_name = 'habitat') then
    update public.plants p set habitat = pt.habitat
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.language = 'en' and pt.habitat is not null and array_length(pt.habitat, 1) > 0 and (p.habitat is null or array_length(p.habitat, 1) = 0);
    
    update public.plants p set habitat = pt.habitat
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.habitat is not null and array_length(pt.habitat, 1) > 0 and (p.habitat is null or array_length(p.habitat, 1) = 0);
  end if;
  
  -- Migrate family from plant_translations to plants
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'plant_translations' and column_name = 'family') then
    update public.plants p set family = pt.family
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.language = 'en' and pt.family is not null and (p.family is null or trim(p.family) = '');
    
    update public.plants p set family = pt.family
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.family is not null and (p.family is null or trim(p.family) = '');
  end if;
  
  -- Migrate life_cycle from plant_translations to plants
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'plant_translations' and column_name = 'life_cycle') then
    update public.plants p set life_cycle = pt.life_cycle
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.language = 'en' and pt.life_cycle is not null and p.life_cycle is null;
    
    update public.plants p set life_cycle = pt.life_cycle
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.life_cycle is not null and p.life_cycle is null;
  end if;
  
  -- Migrate season from plant_translations to plants
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'plant_translations' and column_name = 'season') then
    update public.plants p set season = pt.season
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.language = 'en' and pt.season is not null and array_length(pt.season, 1) > 0 and (p.season is null or array_length(p.season, 1) = 0);
    
    update public.plants p set season = pt.season
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.season is not null and array_length(pt.season, 1) > 0 and (p.season is null or array_length(p.season, 1) = 0);
  end if;
  
  -- Migrate foliage_persistance from plant_translations to plants
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'plant_translations' and column_name = 'foliage_persistance') then
    update public.plants p set foliage_persistance = pt.foliage_persistance
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.language = 'en' and pt.foliage_persistance is not null and p.foliage_persistance is null;
    
    update public.plants p set foliage_persistance = pt.foliage_persistance
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.foliage_persistance is not null and p.foliage_persistance is null;
  end if;
  
  -- Migrate toxicity_human from plant_translations to plants
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'plant_translations' and column_name = 'toxicity_human') then
    update public.plants p set toxicity_human = pt.toxicity_human
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.language = 'en' and pt.toxicity_human is not null and p.toxicity_human is null;
    
    update public.plants p set toxicity_human = pt.toxicity_human
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.toxicity_human is not null and p.toxicity_human is null;
  end if;
  
  -- Migrate toxicity_pets from plant_translations to plants
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'plant_translations' and column_name = 'toxicity_pets') then
    update public.plants p set toxicity_pets = pt.toxicity_pets
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.language = 'en' and pt.toxicity_pets is not null and p.toxicity_pets is null;
    
    update public.plants p set toxicity_pets = pt.toxicity_pets
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.toxicity_pets is not null and p.toxicity_pets is null;
  end if;
  
  -- Migrate living_space from plant_translations to plants
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'plant_translations' and column_name = 'living_space') then
    update public.plants p set living_space = pt.living_space
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.language = 'en' and pt.living_space is not null and p.living_space is null;
    
    update public.plants p set living_space = pt.living_space
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.living_space is not null and p.living_space is null;
  end if;
  
  -- Migrate composition from plant_translations to plants
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'plant_translations' and column_name = 'composition') then
    update public.plants p set composition = pt.composition
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.language = 'en' and pt.composition is not null and array_length(pt.composition, 1) > 0 and (p.composition is null or array_length(p.composition, 1) = 0);
    
    update public.plants p set composition = pt.composition
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.composition is not null and array_length(pt.composition, 1) > 0 and (p.composition is null or array_length(p.composition, 1) = 0);
  end if;
  
  -- Migrate maintenance_level from plant_translations to plants
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'plant_translations' and column_name = 'maintenance_level') then
    update public.plants p set maintenance_level = pt.maintenance_level
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.language = 'en' and pt.maintenance_level is not null and p.maintenance_level is null;
    
    update public.plants p set maintenance_level = pt.maintenance_level
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.maintenance_level is not null and p.maintenance_level is null;
  end if;
end $$;

-- Now drop the non-translatable columns from plant_translations
alter table if exists public.plant_translations drop column if exists scientific_name;
alter table if exists public.plant_translations drop column if exists promotion_month;
alter table if exists public.plant_translations drop column if exists level_sun;
alter table if exists public.plant_translations drop column if exists habitat;
alter table if exists public.plant_translations drop column if exists family;
alter table if exists public.plant_translations drop column if exists life_cycle;
alter table if exists public.plant_translations drop column if exists season;
alter table if exists public.plant_translations drop column if exists foliage_persistance;
alter table if exists public.plant_translations drop column if exists toxicity_human;
alter table if exists public.plant_translations drop column if exists toxicity_pets;
alter table if exists public.plant_translations drop column if exists living_space;
alter table if exists public.plant_translations drop column if exists composition;
alter table if exists public.plant_translations drop column if exists maintenance_level;
-- habitat is NOT translated - it stays only in plants table (dropped above)
alter table if exists public.plant_translations add column if not exists advice_soil text;
alter table if exists public.plant_translations add column if not exists advice_mulching text;
alter table if exists public.plant_translations add column if not exists advice_fertilizer text;
alter table if exists public.plant_translations add column if not exists advice_tutoring text;
alter table if exists public.plant_translations add column if not exists advice_sowing text;
alter table if exists public.plant_translations add column if not exists advice_medicinal text;
alter table if exists public.plant_translations add column if not exists advice_infusion text;
alter table if exists public.plant_translations add column if not exists ground_effect text;
-- admin_commentary migrated to main table
alter table if exists public.plant_translations add column if not exists source_name text;

-- Migrate admin_commentary from translations to plants and drop column from translations
do $$
begin
  -- Only migrate if the column exists in plant_translations
  if exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'plant_translations' 
    and column_name = 'admin_commentary'
  ) then
    -- Update plants with admin_commentary from english translation if plant has none
    update public.plants p
    set admin_commentary = pt.admin_commentary
    from public.plant_translations pt
    where p.id = pt.plant_id
      and pt.language = 'en'
      and pt.admin_commentary is not null
      and (p.admin_commentary is null or trim(p.admin_commentary) = '');
      
    -- Update plants with admin_commentary from ANY translation if plant still has none
    update public.plants p
    set admin_commentary = pt.admin_commentary
    from public.plant_translations pt
    where p.id = pt.plant_id
      and pt.admin_commentary is not null
      and (p.admin_commentary is null or trim(p.admin_commentary) = '');

    -- Drop the column from translations
    alter table public.plant_translations drop column admin_commentary;
  end if;
end $$;
alter table if exists public.plant_translations add column if not exists source_url text;
alter table if exists public.plant_translations add column if not exists tags text[] not null default '{}';
alter table if exists public.plant_translations add column if not exists nutritional_intake text[] not null default '{}';
alter table if exists public.plant_translations add column if not exists recipes_ideas text[] not null default '{}';
alter table if exists public.plant_translations add column if not exists cut text;
-- Translatable array fields (moved from plants table to support translation)
alter table if exists public.plant_translations add column if not exists spice_mixes text[] not null default '{}';
alter table if exists public.plant_translations add column if not exists pests text[] not null default '{}';
alter table if exists public.plant_translations add column if not exists diseases text[] not null default '{}';
-- level_sun is NOT translated - it stays only in plants table (dropped above)

-- ========== Migrate English data from plants to plant_translations ==========
-- This migration ensures all plants have English translations in the new architecture
-- where ALL translatable fields (including English) are stored in plant_translations.
-- This is idempotent - it only creates translations for plants that don't have one yet.
-- NOTE: scientific_name, promotion_month, habitat, and level_sun are NOT migrated here
-- because they stay in the plants table only (not translated).
do $$
declare
  migrated_count integer := 0;
begin
  -- Insert English translations for plants that don't have one yet
  -- NOTE: The following columns are NOT included because they stay in plants table only (not translated):
  -- scientific_name, promotion_month, level_sun, habitat, family, life_cycle, season,
  -- foliage_persistance, toxicity_human, toxicity_pets, living_space, composition, maintenance_level
  with inserted as (
    insert into public.plant_translations (
      plant_id,
      language,
      name,
      given_names,
      overview,
      allergens,
      symbolism,
      origin,
      advice_soil,
      advice_mulching,
      advice_fertilizer,
      advice_tutoring,
      advice_sowing,
      cut,
      advice_medicinal,
      advice_infusion,
      nutritional_intake,
      recipes_ideas,
      ground_effect,
      source_name,
      source_url,
      tags,
      spice_mixes,
      pests,
      diseases
    )
    select
      p.id,
      'en',
      p.name,
      coalesce(p.given_names, '{}'),
      p.overview,
      coalesce(p.allergens, '{}'),
      coalesce(p.symbolism, '{}'),
      coalesce(p.origin, '{}'),
      p.advice_soil,
      p.advice_mulching,
      p.advice_fertilizer,
      p.advice_tutoring,
      p.advice_sowing,
      p.cut,
      p.advice_medicinal,
      p.advice_infusion,
      coalesce(p.nutritional_intake, '{}'),
      coalesce(p.recipes_ideas, '{}'),
      p.ground_effect,
      p.source_name,
      p.source_url,
      coalesce(p.tags, '{}'),
      coalesce(p.spice_mixes, '{}'),
      coalesce(p.pests, '{}'),
      coalesce(p.diseases, '{}')
    from public.plants p
    where not exists (
      select 1 from public.plant_translations pt 
      where pt.plant_id = p.id and pt.language = 'en'
    )
    returning 1
  )
  select count(*) into migrated_count from inserted;
  
  if migrated_count > 0 then
    raise notice '[plant_translations] Migrated % plants to English translations', migrated_count;
  end if;
end $$;

-- ========== Remove translatable columns from plants table ==========
-- These columns have been migrated to plant_translations and are no longer needed
-- in the plants table. Only 'name' is kept as the canonical English name.
-- 
-- The following columns stay in plants table (NOT translated - they are enums, Latin names, or non-text):
--   promotion_month, scientific_name, family, life_cycle, season, foliage_persistance,
--   toxicity_human, toxicity_pets, living_space, composition, maintenance_level,
--   habitat, level_sun
--
-- The following columns ARE translated and only exist in plant_translations:
alter table if exists public.plants drop column if exists given_names;
alter table if exists public.plants drop column if exists overview;
alter table if exists public.plants drop column if exists allergens;
alter table if exists public.plants drop column if exists symbolism;
alter table if exists public.plants drop column if exists origin;
-- habitat and level_sun are enums - NOT translated, stay in plants table
alter table if exists public.plants drop column if exists advice_soil;
alter table if exists public.plants drop column if exists advice_mulching;
alter table if exists public.plants drop column if exists advice_fertilizer;
alter table if exists public.plants drop column if exists advice_tutoring;
alter table if exists public.plants drop column if exists advice_sowing;
alter table if exists public.plants drop column if exists cut;
alter table if exists public.plants drop column if exists advice_medicinal;
alter table if exists public.plants drop column if exists nutritional_intake;
alter table if exists public.plants drop column if exists advice_infusion;
alter table if exists public.plants drop column if exists recipes_ideas;
alter table if exists public.plants drop column if exists ground_effect;
alter table if exists public.plants drop column if exists source_name;
alter table if exists public.plants drop column if exists source_url;
alter table if exists public.plants drop column if exists tags;

-- Migrate spice_mixes, pests, diseases from plants to plant_translations for existing English translations
-- This handles plants that already have English translations but the new columns are empty
do $$
begin
  -- Only run if spice_mixes column still exists in plants table
  if exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'plants' and column_name = 'spice_mixes'
  ) then
    -- Update English translations with data from plants table where translation fields are empty
    update public.plant_translations pt
    set 
      spice_mixes = coalesce(p.spice_mixes, '{}'),
      pests = coalesce(p.pests, '{}'),
      diseases = coalesce(p.diseases, '{}')
    from public.plants p
    where pt.plant_id = p.id
      and pt.language = 'en'
      and (array_length(pt.spice_mixes, 1) is null or array_length(pt.spice_mixes, 1) = 0)
      and (
        array_length(p.spice_mixes, 1) > 0 
        or array_length(p.pests, 1) > 0 
        or array_length(p.diseases, 1) > 0
      );
    
    raise notice '[plant_translations] Migrated spice_mixes, pests, diseases to English translations';
  end if;
end $$;

-- spice_mixes, pests, diseases are now translatable - drop from plants table
alter table if exists public.plants drop column if exists spice_mixes;
alter table if exists public.plants drop column if exists pests;
alter table if exists public.plants drop column if exists diseases;

-- RLS policies for plant_translations
alter table public.plant_translations enable row level security;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_translations' and policyname='plant_translations_select_all') then
    drop policy plant_translations_select_all on public.plant_translations;
  end if;
  create policy plant_translations_select_all on public.plant_translations for select to authenticated, anon using (true);
end $$;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_translations' and policyname='plant_translations_insert') then
    drop policy plant_translations_insert on public.plant_translations;
  end if;
  create policy plant_translations_insert on public.plant_translations for insert to authenticated with check (true);
end $$;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_translations' and policyname='plant_translations_update') then
    drop policy plant_translations_update on public.plant_translations;
  end if;
  create policy plant_translations_update on public.plant_translations for update to authenticated using (true) with check (true);
end $$;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_translations' and policyname='plant_translations_delete') then
    drop policy plant_translations_delete on public.plant_translations;
  end if;
  create policy plant_translations_delete on public.plant_translations for delete to authenticated using (true);
end $$;

-- ========== Requested plants (user requests for new plants) ==========
create table if not exists public.requested_plants (
  id uuid primary key default gen_random_uuid(),
  plant_name text not null,
  plant_name_normalized text not null,
  requested_by uuid not null references auth.users(id) on delete cascade,
  request_count integer not null default 1 check (request_count > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null
);

-- Ensure columns exist for existing deployments
alter table if exists public.requested_plants add column if not exists plant_name text;
alter table if exists public.requested_plants add column if not exists plant_name_normalized text;
alter table if exists public.requested_plants add column if not exists requested_by uuid references auth.users(id) on delete cascade;
alter table if exists public.requested_plants add column if not exists request_count integer not null default 1;
alter table if exists public.requested_plants add column if not exists created_at timestamptz not null default now();
alter table if exists public.requested_plants add column if not exists updated_at timestamptz not null default now();
alter table if exists public.requested_plants add column if not exists completed_at timestamptz;
alter table if exists public.requested_plants add column if not exists completed_by uuid;

do $$ begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'requested_plants'
      and column_name = 'plant_name_normalized'
  ) then
    update public.requested_plants
      set plant_name_normalized = lower(trim(plant_name))
      where plant_name_normalized is null and plant_name is not null;

    begin
      alter table public.requested_plants
        alter column plant_name_normalized set not null;
    exception
      when others then
        null;
    end;
  end if;
end $$;

-- Add constraints if they don't exist
do $$ begin
  -- Add check constraint for request_count
  if not exists (
    select 1 from pg_constraint 
    where conname = 'requested_plants_request_count_check'
  ) then
    alter table public.requested_plants 
      add constraint requested_plants_request_count_check 
      check (request_count > 0);
  end if;
  
    -- Add foreign key constraint if it doesn't exist
    if not exists (
      select 1 from pg_constraint 
      where conname = 'requested_plants_requested_by_fkey'
    ) then
      alter table public.requested_plants 
        add constraint requested_plants_requested_by_fkey 
        foreign key (requested_by) references auth.users(id) on delete cascade;
    end if;
    if not exists (
      select 1 from pg_constraint
      where conname = 'requested_plants_completed_by_fkey'
    ) then
      alter table public.requested_plants
        add constraint requested_plants_completed_by_fkey
        foreign key (completed_by) references auth.users(id) on delete set null;
    end if;
end $$;

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
$$ language plpgsql;

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

-- ========== Core tables ==========
create table if not exists public.gardens (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cover_image_url text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  streak integer not null default 0,
  privacy text not null default 'public' check (privacy in ('public', 'friends_only', 'private')),
  -- Location for weather and contextual advice
  location_city text,
  location_country text,
  location_timezone text,
  location_lat numeric,
  location_lon numeric
);

-- Migration: Add location columns to existing gardens
alter table if exists public.gardens add column if not exists location_city text;
alter table if exists public.gardens add column if not exists location_country text;
alter table if exists public.gardens add column if not exists location_timezone text;
alter table if exists public.gardens add column if not exists location_lat numeric;
alter table if exists public.gardens add column if not exists location_lon numeric;

-- Migration: Add/migrate privacy column (for existing databases)
do $$
begin
  -- If old is_public column exists, migrate data
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'gardens' and column_name = 'is_public'
  ) then
    -- Add privacy column if it doesn't exist
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'gardens' and column_name = 'privacy'
    ) then
      alter table public.gardens add column privacy text not null default 'public' check (privacy in ('public', 'friends_only', 'private'));
      -- Migrate data: is_public=true -> 'public', is_public=false -> 'private'
      update public.gardens set privacy = case when is_public then 'public' else 'private' end;
    end if;
    -- Drop old column
    alter table public.gardens drop column if exists is_public;
  elsif not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'gardens' and column_name = 'privacy'
  ) then
    -- Fresh install without is_public, just add privacy
    alter table public.gardens add column privacy text not null default 'public' check (privacy in ('public', 'friends_only', 'private'));
  end if;
end $$;

create table if not exists public.garden_members (
  garden_id uuid not null references public.gardens(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key (garden_id, user_id)
);

-- Also relate members to profiles if available
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'garden_members_user_id_profiles_fk'
  ) then
    -- Only add if public.profiles exists
    if exists (select 1 from information_schema.tables where table_schema='public' and table_name='profiles') then
      alter table public.garden_members
        add constraint garden_members_user_id_profiles_fk
        foreign key (user_id) references public.profiles(id) on delete cascade;
    end if;
  end if;
end $$;

create table if not exists public.garden_plants (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  plant_id text not null references public.plants(id) on delete cascade,
  nickname text,
  seeds_planted integer not null default 0,
  planted_at timestamptz,
  expected_bloom_date timestamptz,
  plants_on_hand integer not null default 0,
  override_water_freq_unit text check (override_water_freq_unit in ('day','week','month','year')),
  override_water_freq_value integer,
  sort_index integer,
  created_at timestamptz not null default now()
);

-- Ensure new columns exist on existing deployments
alter table if exists public.garden_plants
  add column if not exists plants_on_hand integer not null default 0;
alter table if exists public.garden_plants
  add column if not exists override_water_freq_unit text check (override_water_freq_unit in ('day','week','month','year'));
alter table if exists public.garden_plants
  add column if not exists override_water_freq_value integer;
alter table if exists public.garden_plants
  add column if not exists sort_index integer;
alter table if exists public.garden_plants
  add column if not exists health_status text check (health_status in ('thriving','healthy','okay','struggling','critical'));
alter table if exists public.garden_plants
  add column if not exists notes text;
alter table if exists public.garden_plants
  add column if not exists last_health_update timestamptz;
alter table if exists public.garden_plants
  add column if not exists created_at timestamptz not null default now();

create table if not exists public.garden_plant_events (
  id uuid primary key default gen_random_uuid(),
  garden_plant_id uuid not null references public.garden_plants(id) on delete cascade,
  event_type text not null check (event_type in ('water','fertilize','prune','harvest','note')),
  occurred_at timestamptz not null default now(),
  notes text,
  next_due_at timestamptz
);

-- Species-level inventory
create table if not exists public.garden_inventory (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  plant_id text not null references public.plants(id) on delete cascade,
  seeds_on_hand integer not null default 0,
  plants_on_hand integer not null default 0,
  unique (garden_id, plant_id)
);

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'garden_inventory'
  ) then
    with inventory_duplicates as (
      select id
      from (
        select id,
               row_number() over (
                 partition by garden_id, plant_id
                 order by id desc
               ) as rn
        from public.garden_inventory
      ) ranked
      where ranked.rn > 1
    )
    delete from public.garden_inventory gi
    using inventory_duplicates dup
    where gi.id = dup.id;
  end if;
end $$;

-- Per-instance inventory (by garden_plant)
create table if not exists public.garden_instance_inventory (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  garden_plant_id uuid not null references public.garden_plants(id) on delete cascade,
  seeds_on_hand integer not null default 0,
  plants_on_hand integer not null default 0,
  unique (garden_plant_id)
);

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'garden_instance_inventory'
  ) then
    with instance_duplicates as (
      select id
      from (
        select id,
               row_number() over (
                 partition by garden_plant_id
                 order by id desc
               ) as rn
        from public.garden_instance_inventory
      ) ranked
      where ranked.rn > 1
    )
    delete from public.garden_instance_inventory gii
    using instance_duplicates dup
    where gii.id = dup.id;
  end if;
end $$;

-- Transactions
create table if not exists public.garden_transactions (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  plant_id text not null references public.plants(id) on delete cascade,
  type text not null check (type in ('buy_seeds','sell_seeds','buy_plants','sell_plants')),
  quantity integer not null check (quantity >= 0),
  occurred_at timestamptz not null default now(),
  notes text
);

-- Daily garden tasks (watering success per day)
create table if not exists public.garden_tasks (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  day date not null,
  task_type text not null check (task_type in ('watering')),
  garden_plant_ids uuid[] not null default '{}',
  success boolean not null default false,
  unique (garden_id, day, task_type)
);
create index if not exists garden_tasks_garden_day_idx on public.garden_tasks (garden_id, day);

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'garden_tasks'
  ) then
    with task_duplicates as (
      select id
      from (
        select id,
               row_number() over (
                 partition by garden_id, day, task_type
                 order by id desc
               ) as rn
        from public.garden_tasks
      ) ranked
      where ranked.rn > 1
    )
    delete from public.garden_tasks gt
    using task_duplicates dup
    where gt.id = dup.id;
  end if;
end $$;

-- Watering schedule pattern per plant
create table if not exists public.garden_plant_schedule (
  garden_plant_id uuid primary key references public.garden_plants(id) on delete cascade,
  period text not null check (period in ('week','month','year')),
  amount integer not null check (amount > 0),
  weekly_days integer[],
  monthly_days integer[],
  yearly_days text[],
  monthly_nth_weekdays text[]
);

-- Materialized watering schedule per day per plant
create table if not exists public.garden_watering_schedule (
  id uuid primary key default gen_random_uuid(),
  garden_plant_id uuid not null references public.garden_plants(id) on delete cascade,
  due_date date not null,
  completed_at timestamptz
);
create index if not exists gws_plant_due_idx on public.garden_watering_schedule (garden_plant_id, due_date);

-- Generic per-plant tasks (v2)
create table if not exists public.garden_plant_tasks (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  garden_plant_id uuid not null references public.garden_plants(id) on delete cascade,
  type text not null check (type in ('water','fertilize','harvest','cut','custom')),
  custom_name text,
  emoji text,
  schedule_kind text not null check (schedule_kind in ('one_time_date','one_time_duration','repeat_duration','repeat_pattern')),
  due_at timestamptz,
  interval_amount integer,
  interval_unit text check (interval_unit in ('hour','day','week','month','year')),
  required_count integer not null default 1 check (required_count > 0),
  period text check (period in ('week','month','year')),
  amount integer check (amount > 0),
  weekly_days integer[],
  monthly_days integer[],
  yearly_days text[],
  monthly_nth_weekdays text[],
  created_at timestamptz not null default now()
);
-- Backfill columns for existing deployments
alter table if exists public.garden_plant_tasks add column if not exists period text check (period in ('week','month','year'));
alter table if exists public.garden_plant_tasks add column if not exists amount integer;
alter table if exists public.garden_plant_tasks add column if not exists weekly_days integer[];
alter table if exists public.garden_plant_tasks add column if not exists monthly_days integer[];
alter table if exists public.garden_plant_tasks add column if not exists yearly_days text[];
alter table if exists public.garden_plant_tasks add column if not exists monthly_nth_weekdays text[];
alter table if exists public.garden_plant_tasks add column if not exists emoji text;

-- Ensure schedule_kind check constraint is correct on existing deployments
alter table if exists public.garden_plant_tasks
  drop constraint if exists garden_plant_tasks_schedule_kind_check;
alter table if exists public.garden_plant_tasks
  add constraint garden_plant_tasks_schedule_kind_check
  check (schedule_kind in ('one_time_date','one_time_duration','repeat_duration','repeat_pattern'));

-- Ensure type check constraint is correct on existing deployments
alter table if exists public.garden_plant_tasks
  drop constraint if exists garden_plant_tasks_type_check;
alter table if exists public.garden_plant_tasks
  add constraint garden_plant_tasks_type_check
  check (type in ('water','fertilize','harvest','cut','custom'));

create table if not exists public.garden_plant_task_occurrences (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.garden_plant_tasks(id) on delete cascade,
  garden_plant_id uuid not null references public.garden_plants(id) on delete cascade,
  due_at timestamptz not null,
  required_count integer not null default 1 check (required_count > 0),
  completed_count integer not null default 0 check (completed_count >= 0),
  completed_at timestamptz
);

-- Track per-user increments against task occurrences to attribute completions
create table if not exists public.garden_task_user_completions (
  id uuid primary key default gen_random_uuid(),
  occurrence_id uuid not null references public.garden_plant_task_occurrences(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  increment integer not null check (increment > 0),
  occurred_at timestamptz not null default now()
);
create index if not exists gtuc_occ_user_time_idx on public.garden_task_user_completions (occurrence_id, user_id, occurred_at desc);
alter table public.garden_task_user_completions enable row level security;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_task_user_completions' and policyname='gtuc_select') then
    drop policy gtuc_select on public.garden_task_user_completions;
  end if;
  create policy gtuc_select on public.garden_task_user_completions for select to authenticated
    using (
      -- Allow members of the garden for the occurrence's task to read attribution rows
      exists (
        select 1 from public.garden_plant_task_occurrences o
        join public.garden_plant_tasks t on t.id = o.task_id
        join public.garden_members gm on gm.garden_id = t.garden_id
        where o.id = occurrence_id and gm.user_id = (select auth.uid())
      )
      or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    );
end $$;

-- ========== RLS ==========
alter table public.gardens enable row level security;
alter table public.garden_members enable row level security;
alter table public.garden_plants enable row level security;

-- Garden plants policies
-- Drop and recreate to ensure policies are always up-to-date
drop policy if exists gp_iud on public.garden_plants;
drop policy if exists gp_select on public.garden_plants;
create policy gp_select on public.garden_plants for select to authenticated
  using (
    exists (select 1 from public.garden_members gm where gm.garden_id = garden_plants.garden_id and gm.user_id = (select auth.uid()))
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
  );

drop policy if exists gp_insert on public.garden_plants;
create policy gp_insert on public.garden_plants for insert to authenticated
  with check (
    exists (select 1 from public.garden_members gm where gm.garden_id = garden_plants.garden_id and gm.user_id = (select auth.uid()))
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
  );

drop policy if exists gp_update on public.garden_plants;
create policy gp_update on public.garden_plants for update to authenticated
  using (
    exists (select 1 from public.garden_members gm where gm.garden_id = garden_plants.garden_id and gm.user_id = (select auth.uid()))
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
  )
  with check (
    exists (select 1 from public.garden_members gm where gm.garden_id = garden_plants.garden_id and gm.user_id = (select auth.uid()))
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
  );

drop policy if exists gp_delete on public.garden_plants;
create policy gp_delete on public.garden_plants for delete to authenticated
  using (
    exists (select 1 from public.garden_members gm where gm.garden_id = garden_plants.garden_id and gm.user_id = (select auth.uid()))
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
  );

-- ========== PUBLIC GARDEN ACCESS FOR ANONYMOUS USERS ==========
-- Helper function to check if a garden is public (SECURITY DEFINER to bypass RLS)
-- Defined early so it can be used by anon policies below
create or replace function public.is_public_garden(_garden_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.gardens
    where id = _garden_id and privacy = 'public'
  );
$$;
grant execute on function public.is_public_garden(uuid) to anon, authenticated;

-- Allow anon users to read garden_plants for public gardens
drop policy if exists gp_select_anon_public on public.garden_plants;
create policy gp_select_anon_public on public.garden_plants for select to anon
  using (public.is_public_garden(garden_id));

alter table public.garden_plant_events enable row level security;
alter table public.garden_inventory enable row level security;
alter table public.garden_instance_inventory enable row level security;
alter table public.garden_transactions enable row level security;
alter table public.garden_tasks enable row level security;
alter table public.garden_plant_schedule enable row level security;
alter table public.garden_watering_schedule enable row level security;
alter table public.garden_plant_tasks enable row level security;
alter table public.garden_plant_task_occurrences enable row level security;

-- Helper functions to avoid RLS self-recursion on garden_members
create or replace function public.is_garden_member_bypass(_garden_id uuid, _user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.garden_members
    where garden_id = _garden_id and user_id = _user_id
  );
$$;

create or replace function public.is_garden_owner_bypass(_garden_id uuid, _user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.garden_members
    where garden_id = _garden_id and user_id = _user_id and role = 'owner'
  );
$$;

-- Check if a user is the creator (owner in gardens.created_by) of a garden.
-- SECURITY DEFINER ensures the query bypasses RLS on public.gardens and avoids policy recursion.
create or replace function public.is_garden_creator_bypass(_garden_id uuid, _user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.gardens
    where id = _garden_id and created_by = _user_id
  );
$$;

-- Gardens policies
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='gardens' and policyname='gardens_select') then
    drop policy gardens_select on public.gardens;
  end if;
  create policy gardens_select on public.gardens for select
    using (
      created_by = (select auth.uid())
      or public.is_garden_member_bypass(id, (select auth.uid()))
      or exists (
        select 1 from public.profiles p
        where p.id = (select auth.uid()) and p.is_admin = true
      )
    );
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='gardens' and policyname='gardens_insert') then
    create policy gardens_insert on public.gardens for insert to authenticated
      with check (
        created_by = (select auth.uid())
        or exists (
          select 1 from public.profiles p
          where p.id = (select auth.uid()) and p.is_admin = true
        )
      );
  end if;
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='gardens' and policyname='gardens_update') then
    drop policy gardens_update on public.gardens;
  end if;
  create policy gardens_update on public.gardens for update to authenticated
    using (
      created_by = (select auth.uid())
      or public.is_garden_owner_bypass(id, (select auth.uid()))
      or exists (
        select 1 from public.profiles p
        where p.id = (select auth.uid()) and p.is_admin = true
      )
    );
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='gardens' and policyname='gardens_delete') then
    create policy gardens_delete on public.gardens for delete to authenticated
      using (
        created_by = (select auth.uid())
        or exists (
          select 1 from public.profiles p
          where p.id = (select auth.uid()) and p.is_admin = true
        )
      );
  end if;
end $$;

-- Allow anon users to read public gardens
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='gardens' and policyname='gardens_select_anon_public') then
    drop policy gardens_select_anon_public on public.gardens;
  end if;
  create policy gardens_select_anon_public on public.gardens for select to anon
    using (privacy = 'public');
end $$;

alter table public.garden_members disable row level security;

do $$
declare r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'garden_members'
  loop
    execute format('drop policy %I on public.garden_members', r.policyname);
  end loop;
end $$;

drop function if exists public.is_garden_member(uuid) cascade;
drop function if exists public.is_member(uuid) cascade;
drop function if exists public.is_garden_owner(uuid) cascade;
drop function if exists public.is_owner(uuid) cascade;

drop policy if exists "__gm_temp_all" on public.garden_members;
create policy "__gm_temp_all" on public.garden_members for all to authenticated
  using (true) with check (true);

alter table public.garden_members enable row level security;

drop policy if exists "__gm_temp_all" on public.garden_members;

drop policy if exists gm_select on public.garden_members;
  create policy gm_select on public.garden_members for select to authenticated
    using (
      -- Any member of the garden can read all memberships for that garden
      public.is_garden_member_bypass(garden_id, (select auth.uid()))
      or public.is_garden_creator_bypass(garden_id, (select auth.uid()))
      or exists (
        select 1 from public.profiles p
        where p.id = (select auth.uid()) and p.is_admin = true
      )
    );

drop policy if exists gm_insert on public.garden_members;
  create policy gm_insert on public.garden_members for insert to authenticated
    with check (
      public.is_garden_creator_bypass(garden_id, (select auth.uid()))
      or exists (
        select 1 from public.profiles p
        where p.id = (select auth.uid()) and p.is_admin = true
      )
    );

drop policy if exists gm_update on public.garden_members;
  create policy gm_update on public.garden_members for update to authenticated
    using (
      -- Allow garden creator, any current owner of the garden, or admins
      public.is_garden_creator_bypass(garden_id, (select auth.uid()))
      or public.is_garden_owner_bypass(garden_id, (select auth.uid()))
      or exists (
        select 1 from public.profiles p
        where p.id = (select auth.uid()) and p.is_admin = true
      )
    )
    with check (
      public.is_garden_creator_bypass(garden_id, (select auth.uid()))
      or public.is_garden_owner_bypass(garden_id, (select auth.uid()))
      or exists (
        select 1 from public.profiles p
        where p.id = (select auth.uid()) and p.is_admin = true
      )
    );

drop policy if exists gm_delete on public.garden_members;
  create policy gm_delete on public.garden_members for delete to authenticated
    using (
      -- A user can always remove themselves; creators and owners can remove others
      user_id = (select auth.uid())
      or public.is_garden_creator_bypass(garden_id, (select auth.uid()))
      or public.is_garden_owner_bypass(garden_id, (select auth.uid()))
      or exists (
        select 1 from public.profiles p
        where p.id = (select auth.uid()) and p.is_admin = true
      )
    );

-- Allow anon users to read garden_members for public gardens
drop policy if exists gm_select_anon_public on public.garden_members;
create policy gm_select_anon_public on public.garden_members for select to anon
  using (public.is_public_garden(garden_id));

-- Garden tasks policies
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_tasks' and policyname='gtasks_select') then
    drop policy gtasks_select on public.garden_tasks;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_tasks' and policyname='gtasks_iud') then
    drop policy gtasks_iud on public.garden_tasks;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_tasks' and policyname='gtasks_insert') then
    drop policy gtasks_insert on public.garden_tasks;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_tasks' and policyname='gtasks_update') then
    drop policy gtasks_update on public.garden_tasks;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_tasks' and policyname='gtasks_delete') then
    drop policy gtasks_delete on public.garden_tasks;
  end if;
  create policy gtasks_select on public.garden_tasks for select to authenticated
    using (
      exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
      or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    );
  create policy gtasks_insert on public.garden_tasks for insert to authenticated
    with check (
      exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
      or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    );
  create policy gtasks_update on public.garden_tasks for update to authenticated
    using (
      exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
      or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    )
    with check (
      exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
      or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    );
  create policy gtasks_delete on public.garden_tasks for delete to authenticated
    using (
      exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
      or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    );
end $$;

-- ========== Ownership invariants ==========
-- Enforce: There cannot be no owner for a garden. If an update/delete would remove the last
-- owner from a garden, delete the garden (cascades) instead of leaving it ownerless.
create or replace function public.enforce_owner_presence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remaining int;
  v_garden uuid;
  v_user uuid;
begin
  if TG_OP = 'DELETE' then
    if OLD.role = 'owner' then
      v_garden := OLD.garden_id;
      v_user := OLD.user_id;
      select count(*)::int into v_remaining
      from public.garden_members
      where garden_id = v_garden and role = 'owner' and user_id <> v_user;
      if coalesce(v_remaining, 0) = 0 then
        -- This delete would remove the last owner; delete the garden instead
        delete from public.gardens where id = v_garden;
        return OLD;
      end if;
    end if;
    return OLD;
  elsif TG_OP = 'UPDATE' then
    if OLD.role = 'owner' and NEW.role <> 'owner' then
      v_garden := NEW.garden_id;
      v_user := NEW.user_id;
      select count(*)::int into v_remaining
      from public.garden_members
      where garden_id = v_garden and role = 'owner' and user_id <> v_user;
      if coalesce(v_remaining, 0) = 0 then
        -- This update would demote the last owner; delete the garden
        delete from public.gardens where id = v_garden;
        return NEW;
      end if;
    end if;
    return NEW;
  end if;
  return coalesce(NEW, OLD);
end;
$$;

-- Attach triggers idempotently
do $$ begin
  begin
    drop trigger if exists trg_gm_owner_update on public.garden_members;
  exception when undefined_object then null; end;
  begin
    drop trigger if exists trg_gm_owner_delete on public.garden_members;
  exception when undefined_object then null; end;
  create trigger trg_gm_owner_update
    before update on public.garden_members
    for each row execute function public.enforce_owner_presence();
  create trigger trg_gm_owner_delete
    before delete on public.garden_members
    for each row execute function public.enforce_owner_presence();
end $$;

-- Schedule tables policies
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plant_schedule' and policyname='gps_select') then
    create policy gps_select on public.garden_plant_schedule for select to authenticated
      using (
        exists (
          select 1 from public.garden_plants gp
          join public.garden_members gm on gm.garden_id = gp.garden_id
          where gp.id = garden_plant_id and gm.user_id = (select auth.uid())
        )
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plant_schedule' and policyname='gps_iud') then
    drop policy gps_iud on public.garden_plant_schedule;
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plant_schedule' and policyname='gps_insert') then
    create policy gps_insert on public.garden_plant_schedule for insert to authenticated
      with check (
        exists (
          select 1 from public.garden_plants gp
          join public.garden_members gm on gm.garden_id = gp.garden_id
          where gp.id = garden_plant_id and gm.user_id = (select auth.uid())
        )
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plant_schedule' and policyname='gps_update') then
    create policy gps_update on public.garden_plant_schedule for update to authenticated
      using (
        exists (
          select 1 from public.garden_plants gp
          join public.garden_members gm on gm.garden_id = gp.garden_id
          where gp.id = garden_plant_id and gm.user_id = (select auth.uid())
        )
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      )
      with check (
        exists (
          select 1 from public.garden_plants gp
          join public.garden_members gm on gm.garden_id = gp.garden_id
          where gp.id = garden_plant_id and gm.user_id = (select auth.uid())
        )
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plant_schedule' and policyname='gps_delete') then
    create policy gps_delete on public.garden_plant_schedule for delete to authenticated
      using (
        exists (
          select 1 from public.garden_plants gp
          join public.garden_members gm on gm.garden_id = gp.garden_id
          where gp.id = garden_plant_id and gm.user_id = (select auth.uid())
        )
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_watering_schedule' and policyname='gws_select') then
    create policy gws_select on public.garden_watering_schedule for select to authenticated
      using (
        exists (
          select 1 from public.garden_plants gp
          join public.garden_members gm on gm.garden_id = gp.garden_id
          where gp.id = garden_plant_id and gm.user_id = (select auth.uid())
        )
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_watering_schedule' and policyname='gws_iud') then
    drop policy gws_iud on public.garden_watering_schedule;
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_watering_schedule' and policyname='gws_insert') then
    create policy gws_insert on public.garden_watering_schedule for insert to authenticated
      with check (
        exists (
          select 1 from public.garden_plants gp
          join public.garden_members gm on gm.garden_id = gp.garden_id
          where gp.id = garden_plant_id and gm.user_id = (select auth.uid())
        )
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_watering_schedule' and policyname='gws_update') then
    create policy gws_update on public.garden_watering_schedule for update to authenticated
      using (
        exists (
          select 1 from public.garden_plants gp
          join public.garden_members gm on gm.garden_id = gp.garden_id
          where gp.id = garden_plant_id and gm.user_id = (select auth.uid())
        )
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      )
      with check (
        exists (
          select 1 from public.garden_plants gp
          join public.garden_members gm on gm.garden_id = gp.garden_id
          where gp.id = garden_plant_id and gm.user_id = (select auth.uid())
        )
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_watering_schedule' and policyname='gws_delete') then
    create policy gws_delete on public.garden_watering_schedule for delete to authenticated
      using (
        exists (
          select 1 from public.garden_plants gp
          join public.garden_members gm on gm.garden_id = gp.garden_id
          where gp.id = garden_plant_id and gm.user_id = (select auth.uid())
        )
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
end $$;

-- Events policies
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plant_events' and policyname='gpe_select') then
    create policy gpe_select on public.garden_plant_events for select to authenticated
      using (
        exists (
          select 1 from public.garden_plants gp
          where gp.id = garden_plant_id
            and exists (select 1 from public.garden_members gm where gm.garden_id = gp.garden_id and gm.user_id = (select auth.uid()))
        )
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plant_events' and policyname='gpe_insert') then
    create policy gpe_insert on public.garden_plant_events for insert to authenticated
      with check (
        exists (
          select 1 from public.garden_plants gp
          where gp.id = garden_plant_id
            and exists (select 1 from public.garden_members gm where gm.garden_id = gp.garden_id and gm.user_id = (select auth.uid()))
        )
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
end $$;

-- Inventory policies
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_inventory' and policyname='gi_select') then
    create policy gi_select on public.garden_inventory for select
      using (
        exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_inventory' and policyname='gi_iud') then
    drop policy gi_iud on public.garden_inventory;
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_inventory' and policyname='gi_insert') then
    create policy gi_insert on public.garden_inventory for insert to authenticated
      with check (
        exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_inventory' and policyname='gi_update') then
    create policy gi_update on public.garden_inventory for update to authenticated
      using (
        exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      )
      with check (
        exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_inventory' and policyname='gi_delete') then
    create policy gi_delete on public.garden_inventory for delete to authenticated
      using (
        exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
end $$;

-- Instance inventory policies
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_instance_inventory' and policyname='gii_select') then
    create policy gii_select on public.garden_instance_inventory for select
      using (
        exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_instance_inventory' and policyname='gii_iud') then
    drop policy gii_iud on public.garden_instance_inventory;
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_instance_inventory' and policyname='gii_insert') then
    create policy gii_insert on public.garden_instance_inventory for insert to authenticated
      with check (
        exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_instance_inventory' and policyname='gii_update') then
    create policy gii_update on public.garden_instance_inventory for update to authenticated
      using (
        exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      )
      with check (
        exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_instance_inventory' and policyname='gii_delete') then
    create policy gii_delete on public.garden_instance_inventory for delete to authenticated
      using (
        exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
end $$;

-- Transactions policies
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_transactions' and policyname='gt_select') then
    create policy gt_select on public.garden_transactions for select
      using (
        exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_transactions' and policyname='gt_insert') then
    create policy gt_insert on public.garden_transactions for insert to authenticated
      with check (
        exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
end $$;

-- Task tables policies
-- Drop and recreate to ensure policies are always up-to-date
drop policy if exists gpt_iud on public.garden_plant_tasks;
drop policy if exists gpt_select on public.garden_plant_tasks;
create policy gpt_select on public.garden_plant_tasks for select to authenticated
  using (
    exists (select 1 from public.garden_members gm where gm.garden_id = garden_plant_tasks.garden_id and gm.user_id = (select auth.uid()))
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
  );

drop policy if exists gpt_insert on public.garden_plant_tasks;
create policy gpt_insert on public.garden_plant_tasks for insert to authenticated
  with check (
    exists (select 1 from public.garden_members gm where gm.garden_id = garden_plant_tasks.garden_id and gm.user_id = (select auth.uid()))
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
  );

drop policy if exists gpt_update on public.garden_plant_tasks;
create policy gpt_update on public.garden_plant_tasks for update to authenticated
  using (
    exists (select 1 from public.garden_members gm where gm.garden_id = garden_plant_tasks.garden_id and gm.user_id = (select auth.uid()))
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
  )
  with check (
    exists (select 1 from public.garden_members gm where gm.garden_id = garden_plant_tasks.garden_id and gm.user_id = (select auth.uid()))
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
  );

drop policy if exists gpt_delete on public.garden_plant_tasks;
create policy gpt_delete on public.garden_plant_tasks for delete to authenticated
  using (
    exists (select 1 from public.garden_members gm where gm.garden_id = garden_plant_tasks.garden_id and gm.user_id = (select auth.uid()))
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
  );

-- Allow anon users to read garden_plant_tasks for public gardens
drop policy if exists gpt_select_anon_public on public.garden_plant_tasks;
create policy gpt_select_anon_public on public.garden_plant_tasks for select to anon
  using (public.is_public_garden(garden_id));

-- garden_plant_task_occurrences policies
drop policy if exists gpto_iud on public.garden_plant_task_occurrences;
drop policy if exists gpto_select on public.garden_plant_task_occurrences;
create policy gpto_select on public.garden_plant_task_occurrences for select to authenticated
  using (
    exists (
      select 1 from public.garden_plants gp
      join public.garden_members gm on gm.garden_id = gp.garden_id
      where gp.id = garden_plant_task_occurrences.garden_plant_id and gm.user_id = (select auth.uid())
    )
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
  );

drop policy if exists gpto_insert on public.garden_plant_task_occurrences;
create policy gpto_insert on public.garden_plant_task_occurrences for insert to authenticated
  with check (
    exists (
      select 1 from public.garden_plants gp
      join public.garden_members gm on gm.garden_id = gp.garden_id
      where gp.id = garden_plant_task_occurrences.garden_plant_id and gm.user_id = (select auth.uid())
    )
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
  );

drop policy if exists gpto_update on public.garden_plant_task_occurrences;
create policy gpto_update on public.garden_plant_task_occurrences for update to authenticated
  using (
    exists (
      select 1 from public.garden_plants gp
      join public.garden_members gm on gm.garden_id = gp.garden_id
      where gp.id = garden_plant_task_occurrences.garden_plant_id and gm.user_id = (select auth.uid())
    )
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
  )
  with check (
    exists (
      select 1 from public.garden_plants gp
      join public.garden_members gm on gm.garden_id = gp.garden_id
      where gp.id = garden_plant_task_occurrences.garden_plant_id and gm.user_id = (select auth.uid())
    )
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
  );

drop policy if exists gpto_delete on public.garden_plant_task_occurrences;
create policy gpto_delete on public.garden_plant_task_occurrences for delete to authenticated
  using (
    exists (
      select 1 from public.garden_plants gp
      join public.garden_members gm on gm.garden_id = gp.garden_id
      where gp.id = garden_plant_task_occurrences.garden_plant_id and gm.user_id = (select auth.uid())
    )
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
  );

-- Allow anon users to read garden_plant_task_occurrences for public gardens
drop policy if exists gpto_select_anon_public on public.garden_plant_task_occurrences;
create policy gpto_select_anon_public on public.garden_plant_task_occurrences for select to anon
  using (
    exists (
      select 1 from public.garden_plants gp
      where gp.id = garden_plant_task_occurrences.garden_plant_id
      and public.is_public_garden(gp.garden_id)
    )
  );

-- ========== RPCs used by the app ==========
-- Public profile fetch by display name (safe columns only) with admin flag, joined_at, and presence
drop function if exists public.get_profile_public_by_username(text);
drop function if exists public.get_profile_public_by_display_name(text);
create or replace function public.get_profile_public_by_display_name(_name text)
returns table(
  id uuid,
  display_name text,
  country text,
  bio text,
  avatar_url text,
  accent_key text,
  is_admin boolean,
  roles text[],
  is_private boolean,
  disable_friend_requests boolean,
  joined_at timestamptz,
  last_seen_at timestamptz,
  is_online boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select p.id, p.display_name, p.country, p.bio, p.avatar_url, p.accent_key, p.is_admin, coalesce(p.roles, '{}') as roles, coalesce(p.is_private, false) as is_private, coalesce(p.disable_friend_requests, false) as disable_friend_requests
    from public.profiles p
    where lower(p.display_name) = lower(_name)
    limit 1
  ),
  auth_meta as (
    select u.id, u.created_at as joined_at
    from auth.users u
    where exists (select 1 from base b where b.id = u.id)
  ),
  ls as (
    select v.user_id, max(v.occurred_at) as last_seen_at
    from public.web_visits v
    where exists (select 1 from base b where b.id = v.user_id)
    group by v.user_id
  )
  select b.id,
         b.display_name,
         b.country,
         b.bio,
         b.avatar_url,
         b.accent_key,
         b.is_admin,
         b.roles,
         b.is_private,
         b.disable_friend_requests,
         a.joined_at,
         l.last_seen_at,
         coalesce((l.last_seen_at is not null and (now() - l.last_seen_at) <= make_interval(mins => 10)), false) as is_online
  from base b
  left join auth_meta a on a.id = b.id
  left join ls l on l.user_id = b.id
  limit 1;
$$;
grant execute on function public.get_profile_public_by_display_name(text) to anon, authenticated;

-- Compute user's current streak across ALL their gardens (AND across gardens)
drop function if exists public.compute_user_current_streak(uuid, date) cascade;
create or replace function public.compute_user_current_streak(_user_id uuid, _anchor_day date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  d date := _anchor_day;
  s integer := 0;
  v_gardens_count integer := 0;
  ok boolean;
begin
  -- Count gardens user belongs to (owner or member)
  select count(*)::int into v_gardens_count
  from (
    select id as gid from public.gardens where created_by = _user_id
    union
    select garden_id as gid from public.garden_members where user_id = _user_id
  ) g;

  if coalesce(v_gardens_count, 0) = 0 then
    return 0; -- no gardens => no streak
  end if;

  loop
    -- For this day, require ALL gardens to be successful
    select bool_and(
      exists (
        select 1
        from public.garden_tasks t
        where t.garden_id = ug.gid
          and t.day = d
          and t.task_type = 'watering'
          and coalesce(t.success, false) = true
      )
    ) into ok
    from (
      select id as gid from public.gardens where created_by = _user_id
      union
      select garden_id as gid from public.garden_members where user_id = _user_id
    ) ug;

    if not coalesce(ok, false) then
      exit;
    end if;

    s := s + 1;
    d := (d - interval '1 day')::date;
  end loop;

  return s;
end;
$$;
grant execute on function public.compute_user_current_streak(uuid, date) to anon, authenticated;

-- Aggregate public stats for a user's gardens/membership
drop function if exists public.get_user_profile_public_stats(uuid) cascade;
create or replace function public.get_user_profile_public_stats(_user_id uuid)
returns table(plants_total integer, gardens_count integer, current_streak integer, longest_streak integer)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_plants int := 0;
  v_gardens int := 0;
  v_current int := 0;
  v_longest int := 0;
  v_anchor date := ((now() at time zone 'utc')::date - interval '1 day')::date;
begin
  -- Sum plants across gardens the user is currently a member of
  select coalesce(sum(gp.plants_on_hand), 0)::int into v_plants
  from public.garden_plants gp
  where gp.garden_id in (
    select garden_id from public.garden_members where user_id = _user_id
  );

  -- Count only gardens the user is currently a member of (owner or member)
  select count(*)::int into v_gardens
  from (
    select distinct garden_id
    from public.garden_members
    where user_id = _user_id
  ) g;

  -- Current streak across all user's gardens
  v_current := case when v_gardens > 0 then public.compute_user_current_streak(_user_id, v_anchor) else 0 end;

  -- Longest historical streak across user's gardens
  with user_gardens as (
    -- Only gardens where the user is currently a member (owner or member)
    select garden_id as gid from public.garden_members where user_id = _user_id
  ),
  successes as (
    select g.garden_id, g.day
    from public.garden_tasks g
    where g.garden_id in (select gid from user_gardens)
      and g.task_type = 'watering'
      and coalesce(g.success, false) = true
  ),
  grouped as (
    select garden_id,
           day,
           (day - ((row_number() over (partition by garden_id order by day))::int * interval '1 day'))::date as grp
    from successes
  ),
  runs as (
    select garden_id, grp, count(*)::int as len
    from grouped
    group by garden_id, grp
  )
  select coalesce(max(len), 0)::int into v_longest from runs;

  return query select v_plants, v_gardens, v_current, v_longest;
end;
$$;
grant execute on function public.get_user_profile_public_stats(uuid) to anon, authenticated;

-- Daily completed task counts and success flags across all user's gardens
create or replace function public.get_user_daily_tasks(
  _user_id uuid,
  _start date,
  _end date
)
returns table(day date, completed integer, any_success boolean)
language sql
stable
security definer
set search_path = public
as $$
  with days as (
    select generate_series(_start, _end, interval '1 day')::date as d
  ),
  user_gardens as (
    -- Only gardens where the user is currently a member (owner or member)
    select garden_id as gid from public.garden_members where user_id = _user_id
  ),
  due_day as (
    -- Total required counts due on each day across user's gardens
    select (o.due_at at time zone 'utc')::date as d, sum(greatest(1, o.required_count))::int as total_required
    from public.garden_plant_task_occurrences o
    join public.garden_plant_tasks t on t.id = o.task_id
    where t.garden_id in (select gid from user_gardens)
      and (o.due_at at time zone 'utc')::date between _start and _end
    group by 1
  ),
  user_done as (
    -- Sum of increments done by the user per occurrence capped at that occurrence's required_count
    select (o.due_at at time zone 'utc')::date as d,
           sum(
             least(
               greatest(1, o.required_count),
               coalesce((select sum(greatest(1, c.increment)) from public.garden_task_user_completions c where c.occurrence_id = o.id and c.user_id = _user_id), 0)
             )
           )::int as completed
    from public.garden_plant_task_occurrences o
    join public.garden_plant_tasks t on t.id = o.task_id
    where t.garden_id in (select gid from user_gardens)
      and (o.due_at at time zone 'utc')::date between _start and _end
    group by 1
  )
  select d.d as day,
         coalesce((select completed from user_done where user_done.d = d.d), 0) as completed,
         (
           coalesce((select total_required from due_day where due_day.d = d.d), 0) = 0
           or
           coalesce((select completed from user_done where user_done.d = d.d), 0) >= coalesce((select total_required from due_day where due_day.d = d.d), 0)
         ) as any_success
  from days d
  order by d.d asc;
$$;
grant execute on function public.get_user_daily_tasks(uuid, date, date) to anon, authenticated;

-- Public display name availability check
drop function if exists public.is_username_available(text);
create or replace function public.is_display_name_available(_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.profiles p where lower(p.display_name) = lower(_name)
  );
$$;
grant execute on function public.is_display_name_available(text) to anon, authenticated;

-- Resolve email by display name (for username-style login)
create or replace function public.get_email_by_display_name(_name text)
returns text
language sql
security definer
set search_path = public
as $$
  select u.email
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(p.display_name) = lower(_name)
  limit 1;
$$;
grant execute on function public.get_email_by_display_name(text) to anon, authenticated;

-- Resolve user id by display name (for adding members by username)
create or replace function public.get_user_id_by_display_name(_name text)
returns uuid
language sql
security definer
set search_path = public
as $$
  select u.id
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(p.display_name) = lower(_name)
  limit 1;
$$;
grant execute on function public.get_user_id_by_display_name(text) to anon, authenticated;

-- Private info fetch (self or admin only)
create or replace function public.get_user_private_info(_user_id uuid)
returns table(id uuid, email text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_caller uuid;
begin
  v_caller := auth.uid();
  if v_caller is null then
    return;
  end if;
  if v_caller = _user_id or public.is_admin_user(v_caller) then
    return query select u.id, u.email from auth.users u where u.id = _user_id limit 1;
  else
    return;
  end if;
end;
$$;
grant execute on function public.get_user_private_info(uuid) to authenticated;
create or replace function public.get_server_now()
returns timestamptz
language sql
stable
set search_path = public
as $$ select now(); $$;

create or replace function public.reseed_watering_schedule(_garden_plant_id uuid, _days_ahead integer default 60)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gp record;
  v_def record;
  d date := (now() at time zone 'utc')::date;
  end_day date := ((now() at time zone 'utc')::date + make_interval(days => greatest(1, coalesce(_days_ahead, 60))))::date;
  weekday int;
  ymd text;
  week_index int;
begin
  delete from public.garden_watering_schedule where garden_plant_id = _garden_plant_id and due_date >= d;

  select gp.id, gp.override_water_freq_unit, gp.override_water_freq_value into v_gp
  from public.garden_plants gp where gp.id = _garden_plant_id;

  select gps.period, gps.amount, gps.weekly_days, gps.monthly_days, gps.yearly_days, gps.monthly_nth_weekdays
  into v_def
  from public.garden_plant_schedule gps where gps.garden_plant_id = _garden_plant_id;

  while d <= end_day loop
    weekday := extract(dow from d);
    ymd := to_char(d, 'MM-DD');
    week_index := floor((extract(day from d) - 1) / 7) + 1;

    if v_def is not null then
      if v_def.period = 'week' then
        if v_def.weekly_days is not null and weekday = any(v_def.weekly_days) then
          insert into public.garden_watering_schedule (garden_plant_id, due_date) values (_garden_plant_id, d);
        end if;
      elsif v_def.period = 'month' then
        if v_def.monthly_days is not null and (extract(day from d))::int = any(v_def.monthly_days) then
          insert into public.garden_watering_schedule (garden_plant_id, due_date) values (_garden_plant_id, d);
        elsif v_def.monthly_nth_weekdays is not null then
          if (week_index >= 1 and week_index <= 4) then
            if (week_index::text || '-' || weekday::text) = any(v_def.monthly_nth_weekdays) then
              insert into public.garden_watering_schedule (garden_plant_id, due_date) values (_garden_plant_id, d);
            end if;
          end if;
        end if;
      elsif v_def.period = 'year' then
        if v_def.yearly_days is not null and ymd = any(v_def.yearly_days) then
          insert into public.garden_watering_schedule (garden_plant_id, due_date) values (_garden_plant_id, d);
        end if;
      end if;
    elsif v_gp.override_water_freq_unit is not null and v_gp.override_water_freq_value is not null then
      if v_gp.override_water_freq_unit = 'day' then
        if ((d - (now() at time zone 'utc')::date) % greatest(1, v_gp.override_water_freq_value)) = 0 then
          insert into public.garden_watering_schedule (garden_plant_id, due_date) values (_garden_plant_id, d);
        end if;
      elsif v_gp.override_water_freq_unit = 'week' then
        if weekday = extract(dow from (now() at time zone 'utc')::date) then
          if (floor(extract(epoch from (d - (now() at time zone 'utc')::date)) / (7*24*3600)))::int % greatest(1, v_gp.override_water_freq_value) = 0 then
            insert into public.garden_watering_schedule (garden_plant_id, due_date) values (_garden_plant_id, d);
          end if;
        end if;
      elsif v_gp.override_water_freq_unit = 'month' then
        if extract(day from d) = extract(day from (now() at time zone 'utc')::date) then
          insert into public.garden_watering_schedule (garden_plant_id, due_date) values (_garden_plant_id, d);
        end if;
      elsif v_gp.override_water_freq_unit = 'year' then
        if to_char(d, 'MM-DD') = to_char((now() at time zone 'utc')::date, 'MM-DD') then
          insert into public.garden_watering_schedule (garden_plant_id, due_date) values (_garden_plant_id, d);
        end if;
      end if;
    end if;

    d := d + 1;
  end loop;
end;
$$;

create or replace function public.mark_garden_plant_watered(_garden_plant_id uuid, _at timestamptz default now())
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := (_at at time zone 'utc')::date;
  v_id uuid;
begin
  select id into v_id from public.garden_watering_schedule where garden_plant_id = _garden_plant_id and due_date = v_day limit 1;
  if v_id is null then
    insert into public.garden_watering_schedule (garden_plant_id, due_date, completed_at)
    values (_garden_plant_id, v_day, _at);
  else
    update public.garden_watering_schedule set completed_at = _at where id = v_id;
  end if;
end;
$$;

create or replace function public.touch_garden_task(_garden_id uuid, _day date, _plant_id uuid default null, _set_success boolean default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_yesterday date := ((now() at time zone 'utc')::date - interval '1 day')::date;
begin
  select id into v_id
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

  -- After any change to day's record, refresh base streak up to yesterday
  perform public.update_garden_streak(_garden_id, v_yesterday);
end;
$$;
drop function if exists public.compute_daily_tasks_for_all_gardens(date);
drop function if exists public.compute_garden_task_for_day(uuid, date);
create or replace function public.compute_garden_task_for_day(_garden_id uuid, _day date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  task_ids uuid[];
  due_count int := 0;
  done_count int := 0;
begin
  select array_agg(t.id) into task_ids from public.garden_plant_tasks t where t.garden_id = _garden_id;
  if task_ids is null or array_length(task_ids,1) is null then
    perform public.touch_garden_task(_garden_id, _day, null, true);
    return;
  end if;
  select coalesce(sum(gpto.required_count), 0) into due_count
  from public.garden_plant_task_occurrences gpto
  where gpto.task_id = any(task_ids)
    and (gpto.due_at at time zone 'utc')::date = _day;

  select coalesce(sum(least(gpto.required_count, gpto.completed_count)), 0) into done_count
  from public.garden_plant_task_occurrences gpto
  where gpto.task_id = any(task_ids)
    and (gpto.due_at at time zone 'utc')::date = _day;

  perform public.touch_garden_task(_garden_id, _day, null, (due_count = 0) or (done_count >= due_count));
end;
$$;

create or replace function public.ensure_daily_tasks_for_gardens(_day date default now()::date)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.garden_tasks (garden_id, day, task_type, garden_plant_ids, success)
  select g.id, _day, 'watering', '{}'::uuid[], true
  from public.gardens g
  on conflict (garden_id, day, task_type) do nothing;
  update public.garden_tasks
    set success = true
  where day = _day and task_type = 'watering' and coalesce(array_length(garden_plant_ids, 1), 0) = 0;
$$;

create or replace function public.get_user_id_by_email(_email text)
returns uuid
language sql
security definer
set search_path = public
as $$ select id from auth.users where email ilike _email limit 1; $$;

-- Suggest users by email prefix (security definer to bypass RLS on auth schema)
create or replace function public.suggest_users_by_email_prefix(_prefix text, _limit int default 5)
returns table(id uuid, email text, created_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select u.id, u.email, u.created_at
  from auth.users u
  where u.email ilike _prefix || '%'
  order by u.created_at desc
  limit greatest(1, coalesce(_limit, 5));
$$;

-- Suggest users by display_name prefix (username), joining to auth.users for ordering/metadata
create or replace function public.suggest_users_by_display_name_prefix(_prefix text, _limit int default 5)
returns table(id uuid, display_name text, created_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select u.id, p.display_name, u.created_at
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.display_name ilike _prefix || '%'
  order by u.created_at desc
  limit greatest(1, coalesce(_limit, 5));
$$;

create or replace function public.get_recent_members(
  _limit int default 20,
  _offset int default 0,
  _sort text default 'newest'
)
returns table(
  id uuid,
  email text,
  display_name text,
  created_at timestamptz,
  is_admin boolean,
  rpm5m numeric
)
language sql
security definer
set search_path = public
as $$
  with base as (
    select
      u.id,
      u.email,
      p.display_name,
      u.created_at,
      coalesce(p.is_admin, false) as is_admin,
      coalesce(rpm.c, 0)::numeric / 5 as rpm5m
    from auth.users u
    left join public.profiles p on p.id = u.id
    left join lateral (
      select count(*)::int as c
      from public.web_visits v
      where v.user_id = u.id
        and v.occurred_at >= now() - interval '5 minutes'
    ) rpm on true
  )
  select *
  from base
  order by
    case when coalesce(lower(_sort), 'newest') = 'oldest' then created_at end asc,
    case when coalesce(lower(_sort), 'newest') = 'rpm' then rpm5m end desc nulls last,
    created_at desc
  limit greatest(1, coalesce(_limit, 20))
  offset greatest(0, coalesce(_offset, 0));
$$;

grant execute on function public.get_recent_members(int, int, text) to anon, authenticated;

-- Count helpers for Admin API fallbacks via Supabase REST RPC
create or replace function public.count_profiles_total()
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::int from public.profiles;
$$;

create or replace function public.count_auth_users_total()
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::int from auth.users;
$$;

-- Drop and recreate to allow return type changes
drop function if exists public.get_profiles_for_garden(uuid) cascade;
create function public.get_profiles_for_garden(_garden_id uuid)
returns table(user_id uuid, display_name text, email text, accent_key text, avatar_url text)
language sql
security definer
set search_path = public
as $$
  select p.id as user_id, p.display_name, u.email, p.accent_key, p.avatar_url
  from public.garden_members gm
  join public.profiles p on p.id = gm.user_id
  join auth.users u on u.id = gm.user_id
  where gm.garden_id = _garden_id;
$$;

create or replace function public.ensure_instance_inventory_for_garden(_garden_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.garden_instance_inventory (garden_id, garden_plant_id, seeds_on_hand, plants_on_hand)
  select gp.garden_id, gp.id, 0, 0
  from public.garden_plants gp
  where gp.garden_id = _garden_id
    and not exists (select 1 from public.garden_instance_inventory gii where gii.garden_plant_id = gp.id);
$$;

-- Set species-level inventory counts (idempotent upsert)
create or replace function public.set_inventory_counts(
  _garden_id uuid,
  _plant_id text,
  _seeds_on_hand integer default null,
  _plants_on_hand integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.garden_inventory (garden_id, plant_id, seeds_on_hand, plants_on_hand)
  values (
    _garden_id,
    _plant_id,
    greatest(0, coalesce(_seeds_on_hand, 0)),
    greatest(0, coalesce(_plants_on_hand, 0))
  )
  on conflict (garden_id, plant_id) do update
    set seeds_on_hand = coalesce(excluded.seeds_on_hand, public.garden_inventory.seeds_on_hand),
        plants_on_hand = coalesce(excluded.plants_on_hand, public.garden_inventory.plants_on_hand);
end;
$$;

-- Set per-instance inventory counts (idempotent upsert)
create or replace function public.set_instance_inventory_counts(
  _garden_id uuid,
  _garden_plant_id uuid,
  _seeds_on_hand integer default null,
  _plants_on_hand integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.garden_instance_inventory (garden_id, garden_plant_id, seeds_on_hand, plants_on_hand)
  values (
    _garden_id,
    _garden_plant_id,
    greatest(0, coalesce(_seeds_on_hand, 0)),
    greatest(0, coalesce(_plants_on_hand, 0))
  )
  on conflict (garden_plant_id) do update
    set seeds_on_hand = coalesce(excluded.seeds_on_hand, public.garden_instance_inventory.seeds_on_hand),
        plants_on_hand = coalesce(excluded.plants_on_hand, public.garden_instance_inventory.plants_on_hand);
end;
$$;

create or replace function public.create_default_watering_task(_garden_id uuid, _garden_plant_id uuid, _unit text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  insert into public.garden_plant_tasks (garden_id, garden_plant_id, type, schedule_kind, interval_amount, interval_unit, required_count)
  values (_garden_id, _garden_plant_id, 'water', 'repeat_duration', 1, _unit, 2)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.upsert_one_time_task(
  _garden_id uuid, _garden_plant_id uuid, _type text, _custom_name text,
  _kind text, _due_at timestamptz, _amount integer, _unit text, _required integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  insert into public.garden_plant_tasks (
    garden_id, garden_plant_id, type, custom_name, schedule_kind, due_at, interval_amount, interval_unit, required_count
  ) values (
    _garden_id, _garden_plant_id, _type, nullif(_custom_name,''), _kind,
    _due_at,
    case when _kind = 'one_time_duration' then _amount else null end,
    case when _kind = 'one_time_duration' then _unit else null end,
    greatest(1, coalesce(_required,1))
  ) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.progress_task_occurrence(_occurrence_id uuid, _increment integer default 1)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_occ record;
  v_day date;
  v_yesterday date := ((now() at time zone 'utc')::date - interval '1 day')::date;
  v_actor uuid := (select auth.uid());
begin
  -- Update the occurrence progress and completion timestamp when reaching required count
  update public.garden_plant_task_occurrences
    set completed_count = least(required_count, completed_count + greatest(1, _increment)),
        completed_at = case when completed_count + greatest(1, _increment) >= required_count then now() else completed_at end
  where id = _occurrence_id;

  -- Attribute progress to the current user
  begin
    if v_actor is not null then
      insert into public.garden_task_user_completions (occurrence_id, user_id, increment)
      values (_occurrence_id, v_actor, greatest(1, _increment));
    end if;
  exception when others then
    -- ignore attribution errors to not block core progress
    null;
  end;

  -- Resolve garden and day for this occurrence to recompute day success and streak
  select o.id,
         o.due_at,
         t.garden_id
  into v_occ
  from public.garden_plant_task_occurrences o
  join public.garden_plant_tasks t on t.id = o.task_id
  where o.id = _occurrence_id
  limit 1;

  if v_occ is null then
    return;
  end if;

  v_day := (v_occ.due_at at time zone 'utc')::date;

  -- Recompute the aggregated garden_tasks success for that day based on all occurrences
  perform public.compute_garden_task_for_day(v_occ.garden_id, v_day);

  -- Refresh the base streak up to yesterday so UI can add today's preview if successful
  perform public.update_garden_streak(v_occ.garden_id, v_yesterday);
end;
$$;

-- Streak helpers (used by server jobs or manual runs)
create or replace function public.compute_garden_streak(_garden_id uuid, _anchor_day date)
returns integer
language plpgsql
set search_path = public
as $$
declare d date := _anchor_day; s integer := 0; t record; begin
  loop
    select g.day, g.success into t from public.garden_tasks g where g.garden_id = _garden_id and g.day = d and g.task_type = 'watering' limit 1;
    if t is null then exit; end if;
    if not coalesce(t.success, false) then exit; end if;
    s := s + 1; d := (d - interval '1 day')::date;
  end loop;
  return s;
end; $$;

create or replace function public.update_garden_streak(_garden_id uuid, _anchor_day date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare s integer; begin
  s := public.compute_garden_streak(_garden_id, _anchor_day);
  update public.gardens set streak = s where id = _garden_id;
end; $$;

create or replace function public.compute_daily_tasks_for_all_gardens(_day date)
returns void
language plpgsql
set search_path = public
as $$
declare 
  g record; 
  anchor date := (_day - interval '1 day')::date;
  yesterday date := (_day - interval '1 day')::date;
begin
  -- CRITICAL: First, ensure task occurrences exist for YESTERDAY (for accurate streak calculation)
  -- This catches gardens where users didn't log in yesterday - their tasks still need to be created
  -- so we can accurately determine if they missed any tasks and should lose their streak
  perform public.ensure_all_gardens_tasks_occurrences_for_day(yesterday);
  
  -- Also ensure task occurrences exist for TODAY (so streak calculation tomorrow will be accurate)
  perform public.ensure_all_gardens_tasks_occurrences_for_day(_day);
  
  -- Now process each garden: update streak based on yesterday, compute today's task status
  for g in select id from public.gardens loop
    -- Recompute yesterday's success based on now-existing occurrences
    perform public.compute_garden_task_for_day(g.id, yesterday);
    -- Update streak using yesterday as anchor (checks consecutive successful days ending yesterday)
    perform public.update_garden_streak(g.id, anchor);
    -- Compute today's task status (will show 0/X until user completes tasks)
    perform public.compute_garden_task_for_day(g.id, _day);
  end loop;
end; $$;

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

-- ========== Admin activity logs ==========
-- Records admin actions for auditing; auto-purge older than 30 days
create table if not exists public.admin_activity_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles(id) on delete set null,
  admin_name text,
  action text not null,
  target text,
  detail jsonb not null default '{}',
  occurred_at timestamptz not null default now()
);

create index if not exists aal_time_idx on public.admin_activity_logs (occurred_at desc);
create index if not exists aal_admin_idx on public.admin_activity_logs (admin_id, occurred_at desc);

alter table public.admin_activity_logs enable row level security;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='admin_activity_logs' and policyname='aal_admin_select') then
    drop policy aal_admin_select on public.admin_activity_logs;
  end if;
  create policy aal_admin_select on public.admin_activity_logs for select to authenticated
    using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true));
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='admin_activity_logs' and policyname='aal_admin_insert') then
    drop policy aal_admin_insert on public.admin_activity_logs;
  end if;
  create policy aal_admin_insert on public.admin_activity_logs for insert to authenticated
    with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true));
end $$;

-- Purge admin logs older than 30 days daily
do $$ begin
  if exists (select 1 from pg_proc where proname = 'schedule_admin_logs_purge') then
    drop function schedule_admin_logs_purge();
  end if;
end $$;
create or replace function public.schedule_admin_logs_purge()
returns void language plpgsql as $$
begin
  begin
    perform cron.schedule('purge_admin_activity_logs', '0 3 * * *', $cron$
      delete from public.admin_activity_logs
      where timezone('utc', occurred_at) < ((now() at time zone 'utc')::date - interval '30 days');
    $cron$);
  exception
    when others then
      null;
  end;
end$$;
select public.schedule_admin_logs_purge();

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='profile_admin_notes' and policyname='pan_admin_insert') then
    drop policy pan_admin_insert on public.profile_admin_notes;
  end if;
  create policy pan_admin_insert on public.profile_admin_notes for insert to authenticated
    with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true));
end $$;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='profile_admin_notes' and policyname='pan_admin_delete') then
    drop policy pan_admin_delete on public.profile_admin_notes;
  end if;
  create policy pan_admin_delete on public.profile_admin_notes for delete to authenticated
    using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true));
end $$;

-- Admin Email Templates
create table if not exists public.admin_email_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject text not null,
  description text,
  preview_text text,
  body_html text not null,
  body_json jsonb,
  variables text[] default '{}',
  is_active boolean default true,
  version integer default 1,
  last_used_at timestamptz,
  campaign_count integer default 0,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Ensure columns exist if table was already created
alter table public.admin_email_templates add column if not exists created_by uuid references public.profiles(id) on delete set null;
alter table public.admin_email_templates add column if not exists updated_by uuid references public.profiles(id) on delete set null;

alter table public.admin_email_templates enable row level security;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='admin_email_templates' and policyname='aet_admin_all') then
    drop policy aet_admin_all on public.admin_email_templates;
  end if;
  create policy aet_admin_all on public.admin_email_templates for all to authenticated
    using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true))
    with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true));
end $$;

-- Admin Email Template Translations (stores translated versions of email templates)
create table if not exists public.admin_email_template_translations (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.admin_email_templates(id) on delete cascade,
  language text not null,
  subject text not null,
  preview_text text,
  body_html text not null,
  body_json jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(template_id, language)
);

create index if not exists aett_template_lang_idx on public.admin_email_template_translations (template_id, language);

alter table public.admin_email_template_translations enable row level security;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='admin_email_template_translations' and policyname='aett_admin_all') then
    drop policy aett_admin_all on public.admin_email_template_translations;
  end if;
  create policy aett_admin_all on public.admin_email_template_translations for all to authenticated
    using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true))
    with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true));
end $$;

-- Admin Email Template Versions (stores version history for templates)
create table if not exists public.admin_email_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.admin_email_templates(id) on delete cascade,
  version integer not null,
  title text not null,
  subject text not null,
  description text,
  preview_text text,
  body_html text not null,
  body_json jsonb,
  variables text[] default '{}',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  unique(template_id, version)
);

create index if not exists aetv_template_version_idx on public.admin_email_template_versions (template_id, version desc);

alter table public.admin_email_template_versions enable row level security;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='admin_email_template_versions' and policyname='aetv_admin_all') then
    drop policy aetv_admin_all on public.admin_email_template_versions;
  end if;
  create policy aetv_admin_all on public.admin_email_template_versions for all to authenticated
    using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true))
    with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true));
end $$;

-- Admin Email Campaigns
create table if not exists public.admin_email_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text not null default 'draft',
  template_id uuid references public.admin_email_templates(id) on delete set null,
  template_version integer,
  template_title text,
  subject text not null,
  preview_text text,
  body_html text,
  body_json jsonb,
  variables text[] default '{}',
  timezone text default 'UTC',
  scheduled_for timestamptz,
  total_recipients integer default 0,
  sent_count integer default 0,
  failed_count integer default 0,
  send_error text,
  send_started_at timestamptz,
  send_completed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Ensure columns exist if table was already created
alter table public.admin_email_campaigns add column if not exists template_version integer;
alter table public.admin_email_campaigns add column if not exists body_html text;
alter table public.admin_email_campaigns add column if not exists body_json jsonb;
alter table public.admin_email_campaigns add column if not exists created_by uuid references public.profiles(id) on delete set null;
alter table public.admin_email_campaigns add column if not exists updated_by uuid references public.profiles(id) on delete set null;
alter table public.admin_email_campaigns add column if not exists test_mode boolean default false;
alter table public.admin_email_campaigns add column if not exists test_email text;
alter table public.admin_email_campaigns add column if not exists is_marketing boolean default false; -- If true, only send to users with marketing_consent=true
alter table public.admin_email_campaigns add column if not exists send_summary jsonb;

alter table public.admin_email_campaigns enable row level security;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='admin_email_campaigns' and policyname='aec_admin_all') then
    drop policy aec_admin_all on public.admin_email_campaigns;
  end if;
  create policy aec_admin_all on public.admin_email_campaigns for all to authenticated
    using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true))
    with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true));
end $$;

-- Admin Campaign Sends (tracks which users have been sent each campaign)
create table if not exists public.admin_campaign_sends (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.admin_email_campaigns(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  sent_at timestamptz default now(),
  status text default 'sent',
  error text
);

create index if not exists idx_admin_campaign_sends_campaign_user 
  on public.admin_campaign_sends(campaign_id, user_id);

alter table public.admin_campaign_sends enable row level security;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='admin_campaign_sends' and policyname='acs_admin_all') then
    drop policy acs_admin_all on public.admin_campaign_sends;
  end if;
  create policy acs_admin_all on public.admin_campaign_sends for all to authenticated
    using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true))
    with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true));
end $$;

-- Admin Automatic Email Triggers (configuration for automatic emails like welcome emails)
create table if not exists public.admin_email_triggers (
  id uuid primary key default gen_random_uuid(),
  trigger_type text not null unique, -- e.g., 'WELCOME_EMAIL', 'PASSWORD_RESET', etc.
  display_name text not null,        -- e.g., 'New User Welcome Email'
  description text,                  -- e.g., 'Sent when a new user creates an account'
  is_enabled boolean default false,  -- Whether this trigger is active
  template_id uuid references public.admin_email_templates(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Insert default trigger types
insert into public.admin_email_triggers (trigger_type, display_name, description, is_enabled)
values 
  ('WELCOME_EMAIL', 'New User Welcome Email', 'Automatically sent when a new user creates an account', false),
  ('BAN_USER', 'User Ban Notification', 'Sent when a user is marked as threat level 3 (ban)', false)
on conflict (trigger_type) do nothing;

alter table public.admin_email_triggers enable row level security;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='admin_email_triggers' and policyname='aetrig_admin_all') then
    drop policy aetrig_admin_all on public.admin_email_triggers;
  end if;
  create policy aetrig_admin_all on public.admin_email_triggers for all to authenticated
    using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true))
    with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true));
end $$;

-- Allow service role to read triggers (for edge functions)
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='admin_email_triggers' and policyname='aetrig_service_select') then
    drop policy aetrig_service_select on public.admin_email_triggers;
  end if;
  create policy aetrig_service_select on public.admin_email_triggers for select to service_role using (true);
end $$;

-- Tracking table for automatic email sends (to prevent duplicates)
create table if not exists public.admin_automatic_email_sends (
  id uuid primary key default gen_random_uuid(),
  trigger_type text not null,
  user_id uuid references auth.users(id) on delete cascade,
  template_id uuid references public.admin_email_templates(id) on delete set null,
  sent_at timestamptz default now(),
  status text default 'sent',
  error text,
  unique(trigger_type, user_id)
);

create index if not exists idx_admin_auto_sends_trigger_user 
  on public.admin_automatic_email_sends(trigger_type, user_id);

alter table public.admin_automatic_email_sends enable row level security;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='admin_automatic_email_sends' and policyname='aaes_admin_all') then
    drop policy aaes_admin_all on public.admin_automatic_email_sends;
  end if;
  create policy aaes_admin_all on public.admin_automatic_email_sends for all to authenticated
    using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true))
    with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true));
end $$;

-- Allow service role full access (for edge functions)
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='admin_automatic_email_sends' and policyname='aaes_service_all') then
    drop policy aaes_service_all on public.admin_automatic_email_sends;
  end if;
  create policy aaes_service_all on public.admin_automatic_email_sends for all to service_role using (true) with check (true);
end $$;

-- Function to check if a user is eligible for a timezone-aware campaign
-- Returns true if now() >= scheduled_time adjusted for user timezone
create or replace function public.is_campaign_due_for_user(
  _scheduled_for timestamptz,
  _campaign_tz text,
  _user_tz text
) returns boolean language plpgsql as $$
declare
  _target_time timestamptz;
  _user_offset interval;
  _campaign_offset interval;
begin
  -- Default timezones if null
  _campaign_tz := coalesce(_campaign_tz, 'UTC');
  _user_tz := coalesce(_user_tz, 'UTC');
  
  -- Calculate offsets
  -- We want to find the moment when User's Wall Clock Time == Campaign Scheduled Wall Clock Time
  -- Formula: Target_UTC = Scheduled_UTC - (User_Offset - Camp_Offset)
  
  return now() >= (
    _scheduled_for - (
      (now() at time zone _user_tz at time zone 'UTC') - (now() at time zone 'UTC')
    ) + (
      (now() at time zone _campaign_tz at time zone 'UTC') - (now() at time zone 'UTC')
    )
  );
exception when others then
  -- Fallback to immediate send if timezone math fails (invalid TZ strings)
  return true;
end;
$$;

-- Captures per-garden human-readable activity events for the current day view
create table if not exists public.garden_activity_logs (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_name text,
  actor_color text,
  kind text not null check (kind in ('plant_added','plant_updated','plant_deleted','task_completed','task_progressed','note')),
  message text not null,
  plant_name text,
  task_name text,
  occurred_at timestamptz not null default now()
);

create index if not exists gal_garden_time_idx on public.garden_activity_logs (garden_id, occurred_at desc);

alter table public.garden_activity_logs enable row level security;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_activity_logs' and policyname='gal_select') then
    drop policy gal_select on public.garden_activity_logs;
  end if;
  create policy gal_select on public.garden_activity_logs for select to authenticated
    using (
      exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
      or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    );
end $$;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_activity_logs' and policyname='gal_insert') then
    drop policy gal_insert on public.garden_activity_logs;
  end if;
  create policy gal_insert on public.garden_activity_logs for insert to authenticated
    with check (
      exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
      or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    );
end $$;

-- Allow anon users to read garden_activity_logs for public gardens
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_activity_logs' and policyname='gal_select_anon_public') then
    drop policy gal_select_anon_public on public.garden_activity_logs;
  end if;
  create policy gal_select_anon_public on public.garden_activity_logs for select to anon
    using (public.is_public_garden(garden_id));
end $$;

-- Helper RPC to write an activity log with best-effort actor name
create or replace function public.log_garden_activity(
  _garden_id uuid,
  _kind text,
  _message text,
  _plant_name text default null,
  _task_name text default null,
  _actor_color text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_actor uuid := (select auth.uid()); v_name text; v_email text; begin
  select display_name into v_name from public.profiles where id = v_actor;
  -- Fallback to email username if display_name is not set
  if v_name is null or v_name = '' then
    select email into v_email from auth.users where id = v_actor;
    v_name := coalesce(split_part(v_email, '@', 1), 'User');
  end if;
  insert into public.garden_activity_logs (garden_id, actor_id, actor_name, actor_color, kind, message, plant_name, task_name, occurred_at)
  values (_garden_id, v_actor, v_name, nullif(_actor_color,''), _kind, _message, nullif(_plant_name,''), nullif(_task_name,''), now());
end; $$;

grant execute on function public.log_garden_activity(uuid, text, text, text, text, text) to anon, authenticated;

-- Fix existing activity logs with null actor_name by populating from profiles/auth.users
do $$
declare r record; v_name text; begin
  for r in (
    select id, actor_id from public.garden_activity_logs
    where actor_id is not null and (actor_name is null or actor_name = '')
  ) loop
    -- Try display_name first
    select display_name into v_name from public.profiles where id = r.actor_id;
    -- Fallback to email username
    if v_name is null or v_name = '' then
      select split_part(email, '@', 1) into v_name from auth.users where id = r.actor_id;
    end if;
    -- Update if we found a name
    if v_name is not null and v_name <> '' then
      update public.garden_activity_logs set actor_name = v_name where id = r.id;
    end if;
  end loop;
exception when others then
  -- Ignore errors (table might not exist yet during first run)
  null;
end $$;

-- ========== Realtime support indexes (merged from 999_realtime_indexes.sql) ==========
-- Keep these idempotent to safely re-run during sync
create index if not exists gp_garden_idx on public.garden_plants (garden_id);
create index if not exists gm_garden_user_idx on public.garden_members (garden_id, user_id);
create index if not exists gpt_garden_idx on public.garden_plant_tasks (garden_id);
-- Dedupe any accidental duplicate occurrences before enforcing uniqueness
do $$
declare r record; v_keep uuid; v_req int; v_done int; has_user_compl boolean; begin
  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'garden_task_user_completions'
  ) into has_user_compl;
  for r in (
    select task_id, due_at, array_agg(id order by id) as ids
    from public.garden_plant_task_occurrences
    group by task_id, due_at
    having count(*) > 1
  ) loop
    v_keep := (r.ids)[1];
    select max(required_count), sum(least(required_count, coalesce(completed_count,0)))
      into v_req, v_done
    from public.garden_plant_task_occurrences where id = any(r.ids);
    v_req := greatest(1, coalesce(v_req, 1));
    v_done := least(v_req, greatest(0, coalesce(v_done, 0)));
    update public.garden_plant_task_occurrences
      set required_count = v_req,
          completed_count = v_done
      where id = v_keep;
    -- Reattach user completion attributions to keeper to preserve history (if table exists)
    if has_user_compl then
      update public.garden_task_user_completions
        set occurrence_id = v_keep
        where occurrence_id = any(r.ids) and occurrence_id <> v_keep;
    end if;
    -- Remove the rest
    delete from public.garden_plant_task_occurrences where id = any(r.ids) and id <> v_keep;
  end loop;
end $$;

-- Replace non-unique index with a unique index to enforce idempotency
drop index if exists gpto_task_due_idx;
create unique index if not exists gpto_task_due_unq on public.garden_plant_task_occurrences (task_id, due_at);

-- Performance index for date range queries on task occurrences (speeds up daily/weekly progress queries)
create index if not exists idx_gpto_due_at_task on public.garden_plant_task_occurrences (due_at, task_id);

-- Composite index for garden plants lookup by garden (speeds up species count and plant listing)
create index if not exists idx_garden_plants_garden_sort on public.garden_plants (garden_id, sort_index NULLS LAST);

-- ========== Friends system ==========
-- Friend requests table
create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  unique(requester_id, recipient_id),
  check (requester_id <> recipient_id)
);

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'friend_requests'
  ) then
    with friend_request_duplicates as (
      select id
      from (
        select id,
               row_number() over (
                 partition by requester_id, recipient_id
                 order by id desc
               ) as rn
        from public.friend_requests
      ) ranked
      where ranked.rn > 1
    )
    delete from public.friend_requests fr
    using friend_request_duplicates dup
    where fr.id = dup.id;

  end if;
end $$;

-- Friends table (bidirectional friendships)
create table if not exists public.friends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, friend_id),
  check (user_id <> friend_id)
);

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'friends'
  ) then
    with friend_duplicates as (
      select id
      from (
        select id,
               row_number() over (
                 partition by user_id, friend_id
                 order by id desc
               ) as rn
        from public.friends
      ) ranked
      where ranked.rn > 1
    )
    delete from public.friends f
    using friend_duplicates dup
    where f.id = dup.id;

  end if;
end $$;

-- Indexes for efficient queries
create index if not exists friend_requests_requester_idx on public.friend_requests(requester_id);
create index if not exists friend_requests_recipient_idx on public.friend_requests(recipient_id);
create index if not exists friend_requests_status_idx on public.friend_requests(status);
create index if not exists friends_user_idx on public.friends(user_id);
create index if not exists friends_friend_idx on public.friends(friend_id);

-- Enable RLS
alter table public.friend_requests enable row level security;
alter table public.friends enable row level security;

-- RLS policies for friend_requests
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='friend_requests' and policyname='friend_requests_select_own') then
    drop policy friend_requests_select_own on public.friend_requests;
  end if;
  create policy friend_requests_select_own on public.friend_requests for select to authenticated
    using (
      requester_id = (select auth.uid())
      or recipient_id = (select auth.uid())
      or public.is_admin_user((select auth.uid()))
    );
end $$;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='friend_requests' and policyname='friend_requests_insert_own') then
    drop policy friend_requests_insert_own on public.friend_requests;
  end if;
  create policy friend_requests_insert_own on public.friend_requests for insert to authenticated
    with check (requester_id = (select auth.uid()));
end $$;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='friend_requests' and policyname='friend_requests_update_own') then
    drop policy friend_requests_update_own on public.friend_requests;
  end if;
  create policy friend_requests_update_own on public.friend_requests for update to authenticated
    using (
      recipient_id = (select auth.uid())
      or public.is_admin_user((select auth.uid()))
    )
    with check (
      recipient_id = (select auth.uid())
      or public.is_admin_user((select auth.uid()))
    );
end $$;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='friend_requests' and policyname='friend_requests_delete_own') then
    drop policy friend_requests_delete_own on public.friend_requests;
  end if;
  create policy friend_requests_delete_own on public.friend_requests for delete to authenticated
    using (
      requester_id = (select auth.uid())
      or recipient_id = (select auth.uid())
      or public.is_admin_user((select auth.uid()))
    );
end $$;

-- RLS policies for friends
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='friends' and policyname='friends_select_own') then
    drop policy friends_select_own on public.friends;
  end if;
  create policy friends_select_own on public.friends for select to authenticated
    using (
      user_id = (select auth.uid())
      or friend_id = (select auth.uid())
      or public.is_admin_user((select auth.uid()))
    );
end $$;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='friends' and policyname='friends_insert_own') then
    drop policy friends_insert_own on public.friends;
  end if;
  create policy friends_insert_own on public.friends for insert to authenticated
    with check (
      user_id = (select auth.uid())
      or public.is_admin_user((select auth.uid()))
    );
end $$;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='friends' and policyname='friends_delete_own') then
    drop policy friends_delete_own on public.friends;
  end if;
  create policy friends_delete_own on public.friends for delete to authenticated
    using (
      user_id = (select auth.uid())
      or friend_id = (select auth.uid())
      or public.is_admin_user((select auth.uid()))
    );
end $$;

-- Function to accept a friend request (creates bidirectional friendship)
create or replace function public.accept_friend_request(_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requester uuid;
  v_recipient uuid;
begin
  -- Get request details
  select requester_id, recipient_id into v_requester, v_recipient
  from public.friend_requests
  where id = _request_id and status = 'pending' and recipient_id = (select auth.uid());
  
  if v_requester is null or v_recipient is null then
    raise exception 'Friend request not found or not authorized';
  end if;
  
  -- Create bidirectional friendship
  insert into public.friends (user_id, friend_id) values (v_requester, v_recipient)
  on conflict do nothing;
  insert into public.friends (user_id, friend_id) values (v_recipient, v_requester)
  on conflict do nothing;
  
  -- Update request status
  update public.friend_requests set status = 'accepted' where id = _request_id;
end;
$$;

grant execute on function public.accept_friend_request(uuid) to authenticated;

-- Function to get friend count for a user
create or replace function public.get_friend_count(_user_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::int from public.friends where user_id = _user_id;
$$;

grant execute on function public.get_friend_count(uuid) to authenticated, anon;

-- Function to get email for users who sent friend requests to you
create or replace function public.get_friend_request_requester_email(_requester_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid;
  v_has_request boolean;
begin
  v_caller := auth.uid();
  if v_caller is null then
    return null;
  end if;
  -- Check if this requester sent a friend request to the caller
  select exists (
    select 1 from public.friend_requests
    where requester_id = _requester_id
    and recipient_id = v_caller
    and status = 'pending'
  ) into v_has_request;
  
  if v_has_request then
    return (select email from auth.users where id = _requester_id);
  else
    return null;
  end if;
end;
$$;

grant execute on function public.get_friend_request_requester_email(uuid) to authenticated;

-- Function to get email for users who are your friends
create or replace function public.get_friend_email(_friend_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid;
  v_is_friend boolean;
begin
  v_caller := auth.uid();
  if v_caller is null then
    return null;
  end if;
  -- Check if this user is a friend of the caller
  select exists (
    select 1 from public.friends
    where (user_id = v_caller and friend_id = _friend_id)
    or (user_id = _friend_id and friend_id = v_caller)
  ) into v_is_friend;
  
  if v_is_friend then
    return (select email from auth.users where id = _friend_id);
  else
    return null;
  end if;
end;
$$;

grant execute on function public.get_friend_email(uuid) to authenticated;

-- ========== Garden Invites (invitation system for gardens) ==========
create table if not exists public.garden_invites (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  invitee_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  message text,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique(garden_id, invitee_id),
  check (inviter_id <> invitee_id)
);

-- Indexes for garden_invites
create index if not exists garden_invites_garden_idx on public.garden_invites(garden_id);
create index if not exists garden_invites_inviter_idx on public.garden_invites(inviter_id);
create index if not exists garden_invites_invitee_idx on public.garden_invites(invitee_id);
create index if not exists garden_invites_status_idx on public.garden_invites(status);

-- Enable RLS for garden_invites
alter table public.garden_invites enable row level security;

-- RLS policies for garden_invites
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_invites' and policyname='garden_invites_select_own') then
    drop policy garden_invites_select_own on public.garden_invites;
  end if;
  create policy garden_invites_select_own on public.garden_invites for select to authenticated
    using (
      inviter_id = (select auth.uid())
      or invitee_id = (select auth.uid())
      or public.is_admin_user((select auth.uid()))
    );
end $$;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_invites' and policyname='garden_invites_insert_own') then
    drop policy garden_invites_insert_own on public.garden_invites;
  end if;
  -- Only garden owners/members can send invites
  create policy garden_invites_insert_own on public.garden_invites for insert to authenticated
    with check (
      inviter_id = (select auth.uid())
      and exists (
        select 1 from public.garden_members gm
        where gm.garden_id = garden_invites.garden_id
        and gm.user_id = (select auth.uid())
      )
    );
end $$;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_invites' and policyname='garden_invites_update_own') then
    drop policy garden_invites_update_own on public.garden_invites;
  end if;
  -- Invitee can update (accept/decline), inviter can update (cancel)
  create policy garden_invites_update_own on public.garden_invites for update to authenticated
    using (
      invitee_id = (select auth.uid())
      or inviter_id = (select auth.uid())
      or public.is_admin_user((select auth.uid()))
    )
    with check (
      invitee_id = (select auth.uid())
      or inviter_id = (select auth.uid())
      or public.is_admin_user((select auth.uid()))
    );
end $$;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_invites' and policyname='garden_invites_delete_own') then
    drop policy garden_invites_delete_own on public.garden_invites;
  end if;
  create policy garden_invites_delete_own on public.garden_invites for delete to authenticated
    using (
      inviter_id = (select auth.uid())
      or invitee_id = (select auth.uid())
      or public.is_admin_user((select auth.uid()))
    );
end $$;

-- Function to search user profiles with friend prioritization and privacy metadata
create or replace function public.search_user_profiles(_term text, _limit integer default 3)
returns table (
  id uuid,
  display_name text,
  username text,
  country text,
  avatar_url text,
  is_private boolean,
  is_friend boolean,
  is_self boolean,
  can_view boolean
  )
  language sql
  security definer
  set search_path = public
  as $$
    with params as (
      select
        trim(coalesce(_term, '')) as term,
        least(3, greatest(1, coalesce(_limit, 3))) as limit_value
    ),
    viewer as (
      select auth.uid() as viewer_id
    ),
    base as (
      select
        p.id,
        p.display_name,
        p.username,
        p.country,
        p.avatar_url,
        coalesce(p.is_private, false) as is_private,
        u.created_at,
        params.term,
        params.limit_value,
        v.viewer_id
      from public.profiles p
      left join auth.users u on u.id = p.id
      cross join params
      cross join viewer v
      where v.viewer_id is not null
    ),
  relation as (
    select
      b.*,
      exists (
        select 1
        from public.friends f
        where (f.user_id = b.viewer_id and f.friend_id = b.id)
           or (f.user_id = b.id and f.friend_id = b.viewer_id)
      ) as is_friend,
      (b.viewer_id = b.id) as is_self
    from base b
  ),
  filtered as (
    select
      r.*,
        case
          when r.term = '' then (not r.is_private or r.is_self or r.is_friend)
          else (
            lower(coalesce(r.display_name, '')) like '%' || lower(r.term) || '%'
            or lower(coalesce(r.username, '')) like '%' || lower(r.term) || '%'
          )
        end as matches_term
    from relation r
  ),
  matched as (
    select
      f.*,
      (not f.is_private) or f.is_self or f.is_friend as can_view,
        case
          when f.term = '' then 0
          when lower(coalesce(f.display_name, '')) = lower(f.term) then 0
          when lower(coalesce(f.username, '')) = lower(f.term) then 0
          when lower(coalesce(f.display_name, '')) like lower(f.term) || '%' then 1
          when lower(coalesce(f.username, '')) like lower(f.term) || '%' then 1
          when lower(coalesce(f.display_name, '')) like '%' || lower(f.term) || '%' then 2
          when lower(coalesce(f.username, '')) like '%' || lower(f.term) || '%' then 2
          else 3
        end as match_rank,
      lower(coalesce(f.display_name, f.username, '')) as sort_name
    from filtered f
    where f.matches_term
  )
  select
    m.id,
    m.display_name,
    m.username,
    m.country,
    m.avatar_url,
    m.is_private,
    m.is_friend,
    m.is_self,
    m.can_view
  from matched m
  order by
    case when m.is_self then -1 else 0 end,
    case when m.is_friend then 0 else 1 end,
    m.match_rank,
      case
        when m.term = '' and not m.is_friend and not m.is_self then -extract(epoch from coalesce(m.created_at, now()))
        else 0
      end,
    m.sort_name asc,
    m.id
  limit (select limit_value from params);
$$;

grant execute on function public.search_user_profiles(text, integer) to authenticated;

-- ========== Garden Task Cache System ==========
-- Pre-computed task data tables to avoid expensive recalculations
-- Cache is automatically refreshed via triggers when source data changes
-- Old cache entries are cleaned up daily via scheduled jobs

-- Garden Task Cache Tables
-- These tables store pre-computed task data to avoid recalculating on every request
-- Data is automatically updated via triggers when source data changes
-- Old cache entries are cleaned up daily via scheduled jobs

-- Cache table for daily task statistics per garden
CREATE TABLE IF NOT EXISTS garden_task_daily_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  garden_id uuid NOT NULL REFERENCES gardens(id) ON DELETE CASCADE,
  cache_date date NOT NULL, -- YYYY-MM-DD format
  due_count integer NOT NULL DEFAULT 0,
  completed_count integer NOT NULL DEFAULT 0,
  task_count integer NOT NULL DEFAULT 0, -- Total number of tasks
  occurrence_count integer NOT NULL DEFAULT 0, -- Total occurrences for the day
  has_remaining_tasks boolean NOT NULL DEFAULT false, -- True if there are tasks still to do today
  all_tasks_done boolean NOT NULL DEFAULT true, -- True if all tasks for today are completed
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(garden_id, cache_date)
);

-- Ensure legacy deployments have no duplicate daily cache rows and enforce uniqueness
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'garden_task_daily_cache'
  ) THEN
    WITH daily_duplicates AS (
      SELECT id
      FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY garden_id, cache_date
                 ORDER BY updated_at DESC, created_at DESC, id DESC
               ) AS rn
        FROM garden_task_daily_cache
      ) ranked
      WHERE ranked.rn > 1
    )
    DELETE FROM garden_task_daily_cache gtdc
    USING daily_duplicates dup
    WHERE gtdc.id = dup.id;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'garden_task_daily_cache_garden_id_cache_date_key'
        AND conrelid = 'garden_task_daily_cache'::regclass
    ) THEN
      ALTER TABLE garden_task_daily_cache
        ADD CONSTRAINT garden_task_daily_cache_garden_id_cache_date_key
        UNIQUE (garden_id, cache_date);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'garden_task_daily_cache'
        AND column_name = 'has_remaining_tasks'
    ) THEN
      ALTER TABLE garden_task_daily_cache
        ADD COLUMN has_remaining_tasks boolean NOT NULL DEFAULT false;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'garden_task_daily_cache'
        AND column_name = 'all_tasks_done'
    ) THEN
      ALTER TABLE garden_task_daily_cache
        ADD COLUMN all_tasks_done boolean NOT NULL DEFAULT true;
    END IF;
  END IF;
END $$;

-- Cache table for weekly task statistics per garden
CREATE TABLE IF NOT EXISTS garden_task_weekly_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  garden_id uuid NOT NULL REFERENCES gardens(id) ON DELETE CASCADE,
  week_start_date date NOT NULL, -- Monday of the week (YYYY-MM-DD)
  week_end_date date NOT NULL, -- Sunday of the week (YYYY-MM-DD)
  total_tasks_by_day integer[7] NOT NULL DEFAULT ARRAY[0,0,0,0,0,0,0], -- Tasks per day Mon-Sun
  water_tasks_by_day integer[7] NOT NULL DEFAULT ARRAY[0,0,0,0,0,0,0],
  fertilize_tasks_by_day integer[7] NOT NULL DEFAULT ARRAY[0,0,0,0,0,0,0],
  harvest_tasks_by_day integer[7] NOT NULL DEFAULT ARRAY[0,0,0,0,0,0,0],
  cut_tasks_by_day integer[7] NOT NULL DEFAULT ARRAY[0,0,0,0,0,0,0],
  custom_tasks_by_day integer[7] NOT NULL DEFAULT ARRAY[0,0,0,0,0,0,0],
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(garden_id, week_start_date)
);

-- Ensure legacy deployments have no duplicate weekly cache rows and enforce uniqueness
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'garden_task_weekly_cache'
  ) THEN
    WITH weekly_duplicates AS (
      SELECT id
      FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY garden_id, week_start_date
                 ORDER BY updated_at DESC, created_at DESC, id DESC
               ) AS rn
        FROM garden_task_weekly_cache
      ) ranked
      WHERE ranked.rn > 1
    )
    DELETE FROM garden_task_weekly_cache gtwc
    USING weekly_duplicates dup
    WHERE gtwc.id = dup.id;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'garden_task_weekly_cache_garden_id_week_start_date_key'
        AND conrelid = 'garden_task_weekly_cache'::regclass
    ) THEN
      ALTER TABLE garden_task_weekly_cache
        ADD CONSTRAINT garden_task_weekly_cache_garden_id_week_start_date_key
        UNIQUE (garden_id, week_start_date);
    END IF;
  END IF;
END $$;

-- Cache table for task counts per plant
CREATE TABLE IF NOT EXISTS garden_plant_task_counts_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  garden_id uuid NOT NULL REFERENCES gardens(id) ON DELETE CASCADE,
  garden_plant_id uuid NOT NULL REFERENCES garden_plants(id) ON DELETE CASCADE,
  task_count integer NOT NULL DEFAULT 0, -- Total tasks for this plant
  due_today_count integer NOT NULL DEFAULT 0, -- Tasks due today
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(garden_id, garden_plant_id)
);

-- Cache table for today's task occurrences (denormalized for fast access)
CREATE TABLE IF NOT EXISTS garden_task_occurrences_today_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  garden_id uuid NOT NULL REFERENCES gardens(id) ON DELETE CASCADE,
  occurrence_id uuid NOT NULL REFERENCES garden_plant_task_occurrences(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES garden_plant_tasks(id) ON DELETE CASCADE,
  garden_plant_id uuid NOT NULL REFERENCES garden_plants(id) ON DELETE CASCADE,
  task_type text NOT NULL, -- 'water', 'fertilize', 'harvest', 'cut', 'custom'
  task_emoji text,
  due_at timestamptz NOT NULL,
  required_count integer NOT NULL DEFAULT 1,
  completed_count integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  cache_date date NOT NULL, -- YYYY-MM-DD format
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(garden_id, occurrence_id, cache_date)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_garden_task_daily_cache_garden_date ON garden_task_daily_cache(garden_id, cache_date DESC);
CREATE INDEX IF NOT EXISTS idx_garden_task_weekly_cache_garden_week ON garden_task_weekly_cache(garden_id, week_start_date DESC);
CREATE INDEX IF NOT EXISTS idx_garden_plant_task_counts_cache_garden ON garden_plant_task_counts_cache(garden_id);
CREATE INDEX IF NOT EXISTS idx_garden_plant_task_counts_cache_plant ON garden_plant_task_counts_cache(garden_plant_id);
CREATE INDEX IF NOT EXISTS idx_garden_task_occurrences_today_cache_garden_date ON garden_task_occurrences_today_cache(garden_id, cache_date DESC);
CREATE INDEX IF NOT EXISTS idx_garden_task_occurrences_today_cache_plant ON garden_task_occurrences_today_cache(garden_plant_id);

-- Function: Refresh daily cache for a garden and date
CREATE OR REPLACE FUNCTION refresh_garden_daily_cache(
  _garden_id uuid,
  _cache_date date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _start_iso timestamptz;
  _end_iso timestamptz;
  _due_count integer := 0;
  _completed_count integer := 0;
  _task_count integer := 0;
  _occurrence_count integer := 0;
  _has_remaining_tasks boolean := false;
  _all_tasks_done boolean := true;
BEGIN
  _start_iso := (_cache_date::text || 'T00:00:00.000Z')::timestamptz;
  _end_iso := (_cache_date::text || 'T23:59:59.999Z')::timestamptz;
  
  -- Calculate daily statistics
  SELECT
    COALESCE(SUM(GREATEST(1, occ.required_count)), 0),
    COALESCE(SUM(LEAST(GREATEST(1, occ.required_count), occ.completed_count)), 0),
    COUNT(DISTINCT t.id),
    COUNT(occ.id)
  INTO _due_count, _completed_count, _task_count, _occurrence_count
  FROM garden_plant_task_occurrences occ
  INNER JOIN garden_plant_tasks t ON t.id = occ.task_id
  WHERE t.garden_id = _garden_id
    AND occ.due_at >= _start_iso
    AND occ.due_at <= _end_iso;
  
  -- Calculate task completion status
  _has_remaining_tasks := (_due_count > 0 AND _completed_count < _due_count);
  _all_tasks_done := (_due_count = 0 OR _completed_count >= _due_count);
  
  INSERT INTO garden_task_daily_cache (garden_id, cache_date, due_count, completed_count, task_count, occurrence_count, has_remaining_tasks, all_tasks_done, updated_at)
  VALUES (_garden_id, _cache_date, _due_count, _completed_count, _task_count, _occurrence_count, _has_remaining_tasks, _all_tasks_done, now())
  ON CONFLICT (garden_id, cache_date) DO UPDATE
    SET due_count = EXCLUDED.due_count,
        completed_count = EXCLUDED.completed_count,
        task_count = EXCLUDED.task_count,
        occurrence_count = EXCLUDED.occurrence_count,
        has_remaining_tasks = EXCLUDED.has_remaining_tasks,
        all_tasks_done = EXCLUDED.all_tasks_done,
        updated_at = now();

END;
$$;

-- Function: Refresh weekly cache for a garden and week
CREATE OR REPLACE FUNCTION refresh_garden_weekly_cache(
  _garden_id uuid,
  _week_start_date date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _week_end_date date;
  _day_idx integer;
  _day_date date;
  _totals integer[] := ARRAY[0,0,0,0,0,0,0];
  _water integer[] := ARRAY[0,0,0,0,0,0,0];
  _fertilize integer[] := ARRAY[0,0,0,0,0,0,0];
  _harvest integer[] := ARRAY[0,0,0,0,0,0,0];
  _cut integer[] := ARRAY[0,0,0,0,0,0,0];
  _custom integer[] := ARRAY[0,0,0,0,0,0,0];
  _daily_total integer;
  _daily_water integer;
  _daily_fertilize integer;
  _daily_harvest integer;
  _daily_cut integer;
  _daily_custom integer;
BEGIN
  _week_end_date := _week_start_date + INTERVAL '6 days';
  
  -- Calculate weekly statistics by day and type
  FOR _day_idx IN 0..6 LOOP
    _day_date := (_week_start_date + (_day_idx || ' days')::interval)::date;

    SELECT
      COALESCE(SUM(GREATEST(1, occ.required_count)), 0),
      COALESCE(SUM(CASE WHEN t.type = 'water' THEN GREATEST(1, occ.required_count) ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN t.type = 'fertilize' THEN GREATEST(1, occ.required_count) ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN t.type = 'harvest' THEN GREATEST(1, occ.required_count) ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN t.type = 'cut' THEN GREATEST(1, occ.required_count) ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN t.type = 'custom' THEN GREATEST(1, occ.required_count) ELSE 0 END), 0)
    INTO
      _daily_total,
      _daily_water,
      _daily_fertilize,
      _daily_harvest,
      _daily_cut,
      _daily_custom
    FROM garden_plant_task_occurrences occ
    INNER JOIN garden_plant_tasks t ON t.id = occ.task_id
    WHERE t.garden_id = _garden_id
      AND occ.due_at >= (_day_date::text || 'T00:00:00.000Z')::timestamptz
      AND occ.due_at <= (_day_date::text || 'T23:59:59.999Z')::timestamptz;

    _totals[_day_idx + 1] := COALESCE(_daily_total, 0);
    _water[_day_idx + 1] := COALESCE(_daily_water, 0);
    _fertilize[_day_idx + 1] := COALESCE(_daily_fertilize, 0);
    _harvest[_day_idx + 1] := COALESCE(_daily_harvest, 0);
    _cut[_day_idx + 1] := COALESCE(_daily_cut, 0);
    _custom[_day_idx + 1] := COALESCE(_daily_custom, 0);
  END LOOP;

  INSERT INTO garden_task_weekly_cache (
    garden_id, week_start_date, week_end_date,
    total_tasks_by_day, water_tasks_by_day, fertilize_tasks_by_day,
    harvest_tasks_by_day, cut_tasks_by_day, custom_tasks_by_day,
    updated_at
  )
  VALUES (
    _garden_id, _week_start_date, _week_end_date,
    _totals, _water, _fertilize, _harvest, _cut, _custom,
    now()
  )
  ON CONFLICT (garden_id, week_start_date) DO UPDATE
    SET week_end_date = EXCLUDED.week_end_date,
        total_tasks_by_day = EXCLUDED.total_tasks_by_day,
        water_tasks_by_day = EXCLUDED.water_tasks_by_day,
        fertilize_tasks_by_day = EXCLUDED.fertilize_tasks_by_day,
        harvest_tasks_by_day = EXCLUDED.harvest_tasks_by_day,
        cut_tasks_by_day = EXCLUDED.cut_tasks_by_day,
        custom_tasks_by_day = EXCLUDED.custom_tasks_by_day,
        updated_at = now();

END;
$$;

-- Function: Refresh plant task counts cache
CREATE OR REPLACE FUNCTION refresh_garden_plant_task_counts_cache(
  _garden_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _today date := CURRENT_DATE;
  _start_iso timestamptz;
  _end_iso timestamptz;
BEGIN
  _start_iso := (_today::text || 'T00:00:00.000Z')::timestamptz;
  _end_iso := (_today::text || 'T23:59:59.999Z')::timestamptz;
  
  -- Delete old cache for this garden
  DELETE FROM garden_plant_task_counts_cache WHERE garden_id = _garden_id;

  -- Insert fresh cache
  INSERT INTO garden_plant_task_counts_cache (garden_id, garden_plant_id, task_count, due_today_count)
  SELECT
    t.garden_id,
    t.garden_plant_id,
    COUNT(DISTINCT t.id)::integer as task_count,
    COUNT(DISTINCT CASE
      WHEN occ.due_at >= _start_iso AND occ.due_at <= _end_iso
        AND (occ.required_count - occ.completed_count) > 0
      THEN occ.id
    END)::integer as due_today_count
  FROM garden_plant_tasks t
  LEFT JOIN garden_plant_task_occurrences occ ON occ.task_id = t.id
  WHERE t.garden_id = _garden_id
  GROUP BY t.garden_id, t.garden_plant_id
  ON CONFLICT (garden_id, garden_plant_id) DO UPDATE
    SET task_count = EXCLUDED.task_count,
        due_today_count = EXCLUDED.due_today_count,
        updated_at = now();

END;
$$;

-- Function: Refresh today's occurrences cache
CREATE OR REPLACE FUNCTION refresh_garden_today_occurrences_cache(
  _garden_id uuid,
  _cache_date date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _start_iso timestamptz;
  _end_iso timestamptz;
BEGIN
  _start_iso := (_cache_date::text || 'T00:00:00.000Z')::timestamptz;
  _end_iso := (_cache_date::text || 'T23:59:59.999Z')::timestamptz;
  
  -- Delete old cache for this garden and date
  DELETE FROM garden_task_occurrences_today_cache
  WHERE garden_id = _garden_id AND cache_date = _cache_date;

  -- Insert fresh cache
  INSERT INTO garden_task_occurrences_today_cache (
    garden_id, occurrence_id, task_id, garden_plant_id,
    task_type, task_emoji, due_at, required_count, completed_count, completed_at, cache_date
  )
  SELECT
    t.garden_id,
    occ.id as occurrence_id,
    occ.task_id,
    occ.garden_plant_id,
    t.type as task_type,
    t.emoji as task_emoji,
    occ.due_at,
    occ.required_count,
    occ.completed_count,
    occ.completed_at,
    _cache_date
  FROM garden_plant_task_occurrences occ
  INNER JOIN garden_plant_tasks t ON t.id = occ.task_id
  WHERE t.garden_id = _garden_id
    AND occ.due_at >= _start_iso
    AND occ.due_at <= _end_iso
  ON CONFLICT (garden_id, occurrence_id, cache_date) DO UPDATE
    SET task_id = EXCLUDED.task_id,
        garden_plant_id = EXCLUDED.garden_plant_id,
        task_type = EXCLUDED.task_type,
        task_emoji = EXCLUDED.task_emoji,
        due_at = EXCLUDED.due_at,
        required_count = EXCLUDED.required_count,
        completed_count = EXCLUDED.completed_count,
        completed_at = EXCLUDED.completed_at,
        updated_at = now();

END;
$$;

-- Function: Refresh all cache for a garden (convenience function)
CREATE OR REPLACE FUNCTION refresh_garden_task_cache(
  _garden_id uuid,
  _cache_date date DEFAULT CURRENT_DATE
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _week_start_date date;
BEGIN
  -- Calculate week start (Monday)
  _week_start_date := date_trunc('week', _cache_date::timestamp)::date;
  
  -- Refresh all caches
  PERFORM refresh_garden_daily_cache(_garden_id, _cache_date);
  PERFORM refresh_garden_weekly_cache(_garden_id, _week_start_date);
  PERFORM refresh_garden_plant_task_counts_cache(_garden_id);
  PERFORM refresh_garden_today_occurrences_cache(_garden_id, _cache_date);
END;
$$;

-- Function: Batched occurrence loader used by Garden List/Dashboard views
CREATE OR REPLACE FUNCTION get_task_occurrences_batch(
  _task_ids uuid[],
  _start_iso timestamptz,
  _end_iso timestamptz,
  _limit_per_task integer DEFAULT 1000
)
RETURNS TABLE (
  id uuid,
  task_id uuid,
  garden_plant_id uuid,
  due_at timestamptz,
  required_count integer,
  completed_count integer,
  completed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    occ.id,
    occ.task_id,
    occ.garden_plant_id,
    occ.due_at,
    occ.required_count,
    occ.completed_count,
    occ.completed_at
  FROM (
    SELECT
      o.id,
      o.task_id,
      o.garden_plant_id,
      o.due_at,
      o.required_count,
      o.completed_count,
      o.completed_at,
      ROW_NUMBER() OVER (PARTITION BY o.task_id ORDER BY o.due_at ASC, o.id ASC) AS rn
    FROM garden_plant_task_occurrences o
    WHERE o.task_id = ANY(_task_ids)
      AND o.due_at >= _start_iso
      AND o.due_at <= _end_iso
  ) occ
  WHERE occ.rn <= GREATEST(COALESCE(_limit_per_task, 1000), 1);
END;
$$;

GRANT EXECUTE ON FUNCTION get_task_occurrences_batch(uuid[], timestamptz, timestamptz, integer) TO authenticated;

-- Function: Aggregated progress for a single garden using cache when available
DROP FUNCTION IF EXISTS public.get_garden_today_progress(uuid, timestamptz, timestamptz);
CREATE OR REPLACE FUNCTION public.get_garden_today_progress(
  _garden_id uuid,
  _start_iso timestamptz,
  _end_iso timestamptz
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cache_date date := date_trunc('day', _start_iso)::date;
  _due integer;
  _completed integer;
BEGIN
  SELECT c.due_count, c.completed_count
  INTO _due, _completed
  FROM garden_task_daily_cache c
  WHERE c.garden_id = _garden_id
    AND c.cache_date = _cache_date
  LIMIT 1;

  IF _due IS NULL THEN
    SELECT
      COALESCE(SUM(GREATEST(1, occ.required_count)), 0)::integer,
      COALESCE(SUM(LEAST(GREATEST(1, occ.required_count), COALESCE(occ.completed_count, 0))), 0)::integer
    INTO _due, _completed
    FROM garden_plant_task_occurrences occ
    INNER JOIN garden_plant_tasks t ON t.id = occ.task_id
    WHERE t.garden_id = _garden_id
      AND occ.due_at >= _start_iso
      AND occ.due_at <= _end_iso;
  END IF;

  RETURN json_build_object(
    'due', COALESCE(_due, 0),
    'completed', COALESCE(_completed, 0)
  );
END;
$$;

-- Function: Aggregated progress for multiple gardens (cache-first fallback to live data)
DROP FUNCTION IF EXISTS public.get_gardens_today_progress_batch(uuid[], timestamptz, timestamptz);
CREATE OR REPLACE FUNCTION public.get_gardens_today_progress_batch(
  _garden_ids uuid[],
  _start_iso timestamptz,
  _end_iso timestamptz
)
RETURNS TABLE (
  garden_id uuid,
  due integer,
  completed integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cache_date date := date_trunc('day', _start_iso)::date;
BEGIN
  RETURN QUERY
  WITH input_gardens AS (
    SELECT DISTINCT gid
    FROM unnest(_garden_ids) AS gid
  ),
    cache_available AS (
      SELECT
        ig.gid AS garden_id,
        c.due_count,
        c.completed_count
      FROM input_gardens ig
      LEFT JOIN garden_task_daily_cache c
        ON c.garden_id = ig.gid
       AND c.cache_date = _cache_date
    ),
    gardens_missing_cache AS (
      SELECT ca.garden_id AS missing_garden_id
      FROM cache_available ca
      WHERE ca.due_count IS NULL AND ca.completed_count IS NULL
    ),
  live_totals AS (
    SELECT
      t.garden_id,
      COALESCE(SUM(GREATEST(1, occ.required_count)), 0)::integer AS due_total,
      COALESCE(SUM(LEAST(GREATEST(1, occ.required_count), COALESCE(occ.completed_count, 0))), 0)::integer AS completed_total
    FROM garden_plant_task_occurrences occ
    INNER JOIN garden_plant_tasks t ON t.id = occ.task_id
      WHERE t.garden_id IN (SELECT gmc.missing_garden_id FROM gardens_missing_cache gmc)
      AND occ.due_at >= _start_iso
      AND occ.due_at <= _end_iso
    GROUP BY t.garden_id
  )
  SELECT
    ig.gid AS garden_id,
    COALESCE(ca.due_count, lt.due_total, 0)::integer AS due,
    COALESCE(ca.completed_count, lt.completed_total, 0)::integer AS completed
  FROM input_gardens ig
  LEFT JOIN cache_available ca ON ca.garden_id = ig.gid
  LEFT JOIN live_totals lt ON lt.garden_id = ig.gid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_garden_today_progress(uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_gardens_today_progress_batch(uuid[], timestamptz, timestamptz) TO authenticated;

-- Function: Cleanup old cache entries (delete entries older than 1 day to prevent accumulation)
CREATE OR REPLACE FUNCTION cleanup_old_garden_task_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _cutoff_date date := CURRENT_DATE - INTERVAL '1 day'; -- Keep only today and yesterday
BEGIN
  -- Delete old daily cache (keep only today and yesterday)
  DELETE FROM garden_task_daily_cache WHERE cache_date < _cutoff_date;
  
  -- Delete old weekly cache (keep only current and last week)
  DELETE FROM garden_task_weekly_cache WHERE week_end_date < _cutoff_date;
  
  -- Delete old today occurrences cache (keep only today and yesterday)
  DELETE FROM garden_task_occurrences_today_cache WHERE cache_date < _cutoff_date;
  
  -- Delete old user cache (keep only today and yesterday)
  DELETE FROM user_task_daily_cache WHERE cache_date < _cutoff_date;
  
  -- Also clean up stale plant task counts (older than 1 day)
  DELETE FROM garden_plant_task_counts_cache 
  WHERE updated_at < (CURRENT_TIMESTAMP - INTERVAL '1 day');
END;
$$;

-- Schedule daily cleanup job to run at 2 AM UTC every day
-- This prevents cache accumulation and keeps database clean
DO $$
BEGIN
  BEGIN
    PERFORM cron.schedule(
      'cleanup-old-task-cache',
      '0 2 * * *',
        $_cron$SELECT cleanup_old_garden_task_cache();$_cron$
    );
  EXCEPTION
    WHEN others THEN
      NULL;
  END;
END $$;

-- Function: Initialize cache for all gardens AND users (run on startup/periodically)
CREATE OR REPLACE FUNCTION initialize_all_task_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _garden_record RECORD;
  _user_record RECORD;
  _today date := CURRENT_DATE;
BEGIN
  -- Refresh cache for all gardens first
  FOR _garden_record IN SELECT id FROM gardens LOOP
    BEGIN
      PERFORM refresh_garden_task_cache(_garden_record.id, _today);
    EXCEPTION WHEN OTHERS THEN
      -- Continue on error
      NULL;
    END;
  END LOOP;
  
  -- Then refresh user cache for all users
  FOR _user_record IN SELECT DISTINCT user_id FROM garden_members LOOP
    BEGIN
      PERFORM refresh_user_task_daily_cache(_user_record.user_id, _today);
    EXCEPTION WHEN OTHERS THEN
      -- Continue on error
      NULL;
    END;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION initialize_all_task_cache() TO authenticated;
GRANT EXECUTE ON FUNCTION initialize_all_task_cache() TO service_role;

-- Trigger function: Auto-refresh cache when task occurrences change
CREATE OR REPLACE FUNCTION trigger_refresh_garden_task_cache()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  _garden_id uuid;
  _cache_date date := CURRENT_DATE;
  _due_at date;
BEGIN
  -- Get garden_id and date from task/occurrence
  IF TG_OP = 'DELETE' THEN
    SELECT t.garden_id, (OLD.due_at::date) INTO _garden_id, _due_at
    FROM garden_plant_tasks t
    WHERE t.id = OLD.task_id;
    _cache_date := COALESCE(_due_at, CURRENT_DATE);
  ELSE
    SELECT t.garden_id, (NEW.due_at::date) INTO _garden_id, _due_at
    FROM garden_plant_tasks t
    WHERE t.id = NEW.task_id;
    _cache_date := COALESCE(_due_at, CURRENT_DATE);
  END IF;
  
  IF _garden_id IS NOT NULL THEN
    -- Refresh cache SYNCHRONOUSLY to ensure it's always available
    -- This is critical for performance - cache must be ready immediately
    PERFORM refresh_garden_task_cache(_garden_id, _cache_date);
    
    -- Also notify for async user cache refresh
    PERFORM pg_notify('garden_task_cache_refresh', _garden_id::text || '|' || _cache_date::text);
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger function: Auto-refresh cache when tasks change
CREATE OR REPLACE FUNCTION trigger_refresh_garden_task_cache_on_task_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  _garden_id uuid;
  _cache_date date := CURRENT_DATE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _garden_id := OLD.garden_id;
  ELSE
    _garden_id := NEW.garden_id;
  END IF;
  
  IF _garden_id IS NOT NULL THEN
    -- Refresh cache SYNCHRONOUSLY to ensure it's always available
    PERFORM refresh_garden_task_cache(_garden_id, _cache_date);
    
    -- Also notify for async operations
    PERFORM pg_notify('garden_task_cache_refresh', _garden_id::text || '|' || _cache_date::text);
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create triggers to auto-refresh cache
DROP TRIGGER IF EXISTS trigger_refresh_cache_on_occurrence_change ON garden_plant_task_occurrences;
CREATE TRIGGER trigger_refresh_cache_on_occurrence_change
  AFTER INSERT OR UPDATE OR DELETE ON garden_plant_task_occurrences
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refresh_garden_task_cache();

DROP TRIGGER IF EXISTS trigger_refresh_cache_on_task_change ON garden_plant_tasks;
CREATE TRIGGER trigger_refresh_cache_on_task_change
  AFTER INSERT OR UPDATE OR DELETE ON garden_plant_tasks
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refresh_garden_task_cache_on_task_change();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON garden_task_daily_cache TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON garden_task_weekly_cache TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON garden_plant_task_counts_cache TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON garden_task_occurrences_today_cache TO authenticated;

-- Enable RLS on cache tables for security
ALTER TABLE garden_task_daily_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE garden_task_weekly_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE garden_plant_task_counts_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE garden_task_occurrences_today_cache ENABLE ROW LEVEL SECURITY;

-- RLS policies for cache tables - users can only see cache for gardens they're members of
DO $$
BEGIN
  -- Policy for garden_task_daily_cache
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='garden_task_daily_cache' AND policyname='cache_select_member') THEN
    CREATE POLICY cache_select_member ON garden_task_daily_cache FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1 FROM garden_members gm
        WHERE gm.garden_id = garden_task_daily_cache.garden_id
        AND gm.user_id = auth.uid()
      ));
  END IF;
  
  -- Policy for garden_task_weekly_cache
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='garden_task_weekly_cache' AND policyname='cache_select_member') THEN
    CREATE POLICY cache_select_member ON garden_task_weekly_cache FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1 FROM garden_members gm
        WHERE gm.garden_id = garden_task_weekly_cache.garden_id
        AND gm.user_id = auth.uid()
      ));
  END IF;
  
  -- Policy for garden_plant_task_counts_cache
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='garden_plant_task_counts_cache' AND policyname='cache_select_member') THEN
    CREATE POLICY cache_select_member ON garden_plant_task_counts_cache FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1 FROM garden_members gm
        WHERE gm.garden_id = garden_plant_task_counts_cache.garden_id
        AND gm.user_id = auth.uid()
      ));
  END IF;
  
  -- Policy for garden_task_occurrences_today_cache
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='garden_task_occurrences_today_cache' AND policyname='cache_select_member') THEN
    CREATE POLICY cache_select_member ON garden_task_occurrences_today_cache FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1 FROM garden_members gm
        WHERE gm.garden_id = garden_task_occurrences_today_cache.garden_id
        AND gm.user_id = auth.uid()
      ));
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION refresh_garden_daily_cache(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_garden_weekly_cache(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_garden_plant_task_counts_cache(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_garden_today_occurrences_cache(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_garden_task_cache(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_garden_task_cache() TO authenticated;

-- Create a view for easy querying of today's cache
-- Use security_invoker to enforce RLS policies of the querying user, not the view owner
CREATE OR REPLACE VIEW garden_task_cache_today
WITH (security_invoker = true)
AS
SELECT
  c.garden_id,
  c.cache_date,
  c.due_count,
  c.completed_count,
  c.task_count,
  c.occurrence_count,
  c.has_remaining_tasks,
  c.all_tasks_done,
  c.updated_at
FROM garden_task_daily_cache c
WHERE c.cache_date = CURRENT_DATE;

GRANT SELECT ON garden_task_cache_today TO authenticated;

-- Function: Quick check if garden has remaining tasks (uses cache)
CREATE OR REPLACE FUNCTION garden_has_remaining_tasks(_garden_id uuid, _cache_date date DEFAULT CURRENT_DATE)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  _has_remaining boolean;
BEGIN
  SELECT has_remaining_tasks INTO _has_remaining
  FROM garden_task_daily_cache
  WHERE garden_id = _garden_id AND cache_date = _cache_date
  LIMIT 1;
  
  -- If cache exists, return cached value
  IF _has_remaining IS NOT NULL THEN
    RETURN _has_remaining;
  END IF;
  
  -- Fallback: compute on the fly if cache missing
  SELECT EXISTS (
    SELECT 1
    FROM garden_plant_task_occurrences occ
    INNER JOIN garden_plant_tasks t ON t.id = occ.task_id
    WHERE t.garden_id = _garden_id
      AND occ.due_at >= (_cache_date::text || 'T00:00:00.000Z')::timestamptz
      AND occ.due_at <= (_cache_date::text || 'T23:59:59.999Z')::timestamptz
      AND occ.required_count > occ.completed_count
    LIMIT 1
  ) INTO _has_remaining;
  
  RETURN COALESCE(_has_remaining, false);
END;
$$;

-- Function: Quick check if all garden tasks are done (uses cache)
CREATE OR REPLACE FUNCTION garden_all_tasks_done(_garden_id uuid, _cache_date date DEFAULT CURRENT_DATE)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  _all_done boolean;
BEGIN
  SELECT all_tasks_done INTO _all_done
  FROM garden_task_daily_cache
  WHERE garden_id = _garden_id AND cache_date = _cache_date
  LIMIT 1;
  
  -- If cache exists, return cached value
  IF _all_done IS NOT NULL THEN
    RETURN _all_done;
  END IF;
  
  -- Fallback: compute on the fly if cache missing
  SELECT NOT EXISTS (
    SELECT 1
    FROM garden_plant_task_occurrences occ
    INNER JOIN garden_plant_tasks t ON t.id = occ.task_id
    WHERE t.garden_id = _garden_id
      AND occ.due_at >= (_cache_date::text || 'T00:00:00.000Z')::timestamptz
      AND occ.due_at <= (_cache_date::text || 'T23:59:59.999Z')::timestamptz
      AND occ.required_count > occ.completed_count
    LIMIT 1
  ) INTO _all_done;
  
  RETURN COALESCE(_all_done, true);
END;
$$;

-- Function: Batch check remaining tasks for multiple gardens (uses cache)
CREATE OR REPLACE FUNCTION gardens_have_remaining_tasks(_garden_ids uuid[], _cache_date date DEFAULT CURRENT_DATE)
RETURNS TABLE (
  garden_id uuid,
  has_remaining_tasks boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.garden_id,
    c.has_remaining_tasks
  FROM garden_task_daily_cache c
  WHERE c.garden_id = ANY(_garden_ids)
    AND c.cache_date = _cache_date;
  
  -- Fill in missing gardens with computed values
  RETURN QUERY
  SELECT
    g.id as garden_id,
    EXISTS (
      SELECT 1
      FROM garden_plant_task_occurrences occ
      INNER JOIN garden_plant_tasks t ON t.id = occ.task_id
      WHERE t.garden_id = g.id
        AND occ.due_at >= (_cache_date::text || 'T00:00:00.000Z')::timestamptz
        AND occ.due_at <= (_cache_date::text || 'T23:59:59.999Z')::timestamptz
        AND occ.required_count > occ.completed_count
      LIMIT 1
    ) as has_remaining_tasks
  FROM unnest(_garden_ids) g(id)
  WHERE NOT EXISTS (
    SELECT 1 FROM garden_task_daily_cache c2
    WHERE c2.garden_id = g.id AND c2.cache_date = _cache_date
  );
END;
$$;

GRANT EXECUTE ON FUNCTION garden_has_remaining_tasks(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION garden_all_tasks_done(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION gardens_have_remaining_tasks(uuid[], date) TO authenticated;

-- ========== User-level task cache (aggregates across all user's gardens) ==========

-- Cache table for user-level task statistics (total tasks across all gardens)
CREATE TABLE IF NOT EXISTS user_task_daily_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cache_date date NOT NULL, -- YYYY-MM-DD format
  total_due_count integer NOT NULL DEFAULT 0, -- Total tasks due across all gardens
  total_completed_count integer NOT NULL DEFAULT 0, -- Total completed across all gardens
  gardens_with_remaining_tasks integer NOT NULL DEFAULT 0, -- Number of gardens with remaining tasks
  total_gardens integer NOT NULL DEFAULT 0, -- Total number of gardens user is member of
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, cache_date)
);

-- Ensure legacy deployments have no duplicate user cache rows
WITH user_duplicates AS (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY user_id, cache_date
             ORDER BY updated_at DESC, created_at DESC, id DESC
           ) AS rn
    FROM user_task_daily_cache
  ) ranked
  WHERE ranked.rn > 1
)
DELETE FROM user_task_daily_cache utdc
USING user_duplicates dup
WHERE utdc.id = dup.id;

-- Ensure uniqueness for user cache rows on legacy deployments
CREATE UNIQUE INDEX IF NOT EXISTS user_task_daily_cache_user_id_cache_date_key
  ON user_task_daily_cache (user_id, cache_date);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_task_daily_cache_user_date ON user_task_daily_cache(user_id, cache_date DESC);

-- Function: Refresh user-level cache for a user and date
CREATE OR REPLACE FUNCTION refresh_user_task_daily_cache(
  _user_id uuid,
  _cache_date date DEFAULT CURRENT_DATE
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _total_due integer := 0;
  _total_completed integer := 0;
  _gardens_with_remaining integer := 0;
  _total_gardens integer := 0;
BEGIN
  -- Get all gardens user is a member of
  SELECT COUNT(*) INTO _total_gardens
  FROM garden_members
  WHERE user_id = _user_id;
  
  -- Aggregate task counts from garden cache
  SELECT 
    COALESCE(SUM(due_count), 0),
    COALESCE(SUM(completed_count), 0),
    COUNT(*) FILTER (WHERE has_remaining_tasks = true)
  INTO _total_due, _total_completed, _gardens_with_remaining
  FROM garden_task_daily_cache c
  INNER JOIN garden_members gm ON gm.garden_id = c.garden_id
  WHERE gm.user_id = _user_id
    AND c.cache_date = _cache_date;
  
  INSERT INTO user_task_daily_cache (
    user_id,
    cache_date,
    total_due_count,
    total_completed_count,
    gardens_with_remaining_tasks,
    total_gardens,
    updated_at
  )
  VALUES (
    _user_id,
    _cache_date,
    _total_due,
    _total_completed,
    _gardens_with_remaining,
    _total_gardens,
    now()
  )
  ON CONFLICT (user_id, cache_date) DO UPDATE
    SET total_due_count = EXCLUDED.total_due_count,
        total_completed_count = EXCLUDED.total_completed_count,
        gardens_with_remaining_tasks = EXCLUDED.gardens_with_remaining_tasks,
        total_gardens = EXCLUDED.total_gardens,
        updated_at = now();

END;
$$;

-- Function: Get user's cached task counts (ONLY reads from cache, never computes)
CREATE OR REPLACE FUNCTION get_user_tasks_today_cached(
  _user_id uuid,
  _cache_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  total_due_count integer,
  total_completed_count integer,
  gardens_with_remaining_tasks integer,
  total_gardens integer
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  _cached RECORD;
BEGIN
  -- ONLY read from cache - never compute
  SELECT 
    total_due_count,
    total_completed_count,
    gardens_with_remaining_tasks,
    total_gardens
  INTO _cached
  FROM user_task_daily_cache
  WHERE user_id = _user_id AND cache_date = _cache_date
  LIMIT 1;
  
  -- If cache exists, return it (even if stale - we'll refresh in background)
  IF _cached IS NOT NULL THEN
    RETURN QUERY SELECT 
      _cached.total_due_count,
      _cached.total_completed_count,
      _cached.gardens_with_remaining_tasks,
      _cached.total_gardens;
    RETURN;
  END IF;
  
  -- If cache doesn't exist, return zeros and trigger background refresh
  -- This ensures instant response even if cache is missing
  PERFORM pg_notify('user_task_cache_refresh', _user_id::text || '|' || _cache_date::text);
  
  RETURN QUERY SELECT 
    0::integer as total_due_count,
    0::integer as total_completed_count,
    0::integer as gardens_with_remaining_tasks,
    0::integer as total_gardens;
END;
$$;

-- Function: Get per-garden task counts for a user (ONLY reads from cache, never computes)
CREATE OR REPLACE FUNCTION get_user_gardens_tasks_today_cached(
  _user_id uuid,
  _cache_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  garden_id uuid,
  garden_name text,
  due_count integer,
  completed_count integer,
  has_remaining_tasks boolean,
  all_tasks_done boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- ONLY read from cache - never compute
  -- Join with gardens to get names, but only return cached data
  RETURN QUERY
  SELECT 
    g.id as garden_id,
    g.name as garden_name,
    COALESCE(c.due_count, 0)::integer as due_count,
    COALESCE(c.completed_count, 0)::integer as completed_count,
    COALESCE(c.has_remaining_tasks, false) as has_remaining_tasks,
    COALESCE(c.all_tasks_done, true) as all_tasks_done
  FROM garden_members gm
  INNER JOIN gardens g ON g.id = gm.garden_id
  LEFT JOIN garden_task_daily_cache c ON c.garden_id = g.id AND c.cache_date = _cache_date
  WHERE gm.user_id = _user_id
  ORDER BY g.name;
  
  -- If any gardens don't have cache, trigger background refresh
  -- But don't block - return what we have
  IF EXISTS (
    SELECT 1 FROM garden_members gm2
    LEFT JOIN garden_task_daily_cache c2 ON c2.garden_id = gm2.garden_id AND c2.cache_date = _cache_date
    WHERE gm2.user_id = _user_id AND c2.garden_id IS NULL
  ) THEN
    PERFORM pg_notify('garden_task_cache_refresh', _user_id::text || '|' || _cache_date::text);
  END IF;
END;
$$;

-- Trigger function: Refresh user cache when garden cache changes
CREATE OR REPLACE FUNCTION trigger_refresh_user_task_cache()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  _user_record RECORD;
  _cache_date date;
BEGIN
  -- Get cache date from the change
  IF TG_OP = 'DELETE' THEN
    _cache_date := OLD.cache_date;
  ELSE
    _cache_date := NEW.cache_date;
  END IF;
  
  -- Refresh cache for all users who are members of this garden
  -- Do this SYNCHRONOUSLY to ensure cache is always ready
  FOR _user_record IN 
    SELECT DISTINCT user_id 
    FROM garden_members 
    WHERE garden_id = COALESCE(NEW.garden_id, OLD.garden_id)
  LOOP
    -- Refresh immediately (synchronous) to ensure cache is ready
    PERFORM refresh_user_task_daily_cache(_user_record.user_id, _cache_date);
    
    -- Also notify for async operations
    PERFORM pg_notify('user_task_cache_refresh', _user_record.user_id::text || '|' || _cache_date::text);
  END LOOP;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger to refresh user cache when garden cache changes
DROP TRIGGER IF EXISTS trigger_refresh_user_cache_on_garden_cache_change ON garden_task_daily_cache;
CREATE TRIGGER trigger_refresh_user_cache_on_garden_cache_change
  AFTER INSERT OR UPDATE ON garden_task_daily_cache
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refresh_user_task_cache();

-- Trigger to refresh user cache when garden membership changes
CREATE OR REPLACE FUNCTION trigger_refresh_user_cache_on_membership_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  _user_id uuid;
  _cache_date date := CURRENT_DATE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _user_id := OLD.user_id;
  ELSE
    _user_id := NEW.user_id;
  END IF;
  
  IF _user_id IS NOT NULL THEN
    -- Refresh SYNCHRONOUSLY to ensure cache is ready
    PERFORM refresh_user_task_daily_cache(_user_id, _cache_date);
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_refresh_user_cache_on_membership_change ON garden_members;
CREATE TRIGGER trigger_refresh_user_cache_on_membership_change
  AFTER INSERT OR DELETE ON garden_members
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refresh_user_cache_on_membership_change();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON user_task_daily_cache TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_user_task_daily_cache(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_tasks_today_cached(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_gardens_tasks_today_cached(uuid, date) TO authenticated;

-- Enable RLS on user cache table
ALTER TABLE user_task_daily_cache ENABLE ROW LEVEL SECURITY;

-- RLS policy for user_task_daily_cache - users can only see their own cache
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_task_daily_cache' AND policyname='user_cache_select_self') THEN
    CREATE POLICY user_cache_select_self ON user_task_daily_cache FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

-- Initialize cache for all gardens and users (runs automatically when script executes)
-- This ensures cache is populated immediately after schema setup
SELECT initialize_all_task_cache();

-- ========== Notification campaigns & delivery infrastructure ==========
create table if not exists public.notification_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  delivery_mode text not null default 'send_now' check (delivery_mode in ('send_now','planned','scheduled')),
  state text not null default 'draft' check (state in ('draft','scheduled','processing','paused','completed','cancelled')),
  audience text not null default 'all' check (audience in ('all','tasks_open','inactive_week','admins','custom')),
  filters jsonb not null default '{}'::jsonb,
  message_variants text[] not null default '{}',
  randomize boolean not null default true,
  timezone text default 'UTC',
  planned_for timestamptz,
  schedule_start_at timestamptz,
  schedule_interval text check (schedule_interval in ('daily','weekly','monthly')),
  cta_url text,
  custom_user_ids uuid[] not null default '{}',
  run_count integer not null default 0,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  last_run_at timestamptz,
  next_run_at timestamptz,
  last_run_summary jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists notification_campaigns_next_run_idx
  on public.notification_campaigns (next_run_at)
  where deleted_at is null;
create index if not exists notification_campaigns_state_idx on public.notification_campaigns (state);
alter table public.notification_campaigns enable row level security;
do $$ begin
  if exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='notification_campaigns' and policyname='notification_campaigns_admins'
  ) then
    drop policy notification_campaigns_admins on public.notification_campaigns;
  end if;
  create policy notification_campaigns_admins on public.notification_campaigns
    for all to authenticated
    using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true))
    with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true));
end $$;

-- ========== Notification Templates (reusable message templates with variations) ==========
create table if not exists public.notification_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  message_variants text[] not null default '{}',
  randomize boolean not null default true,
  is_active boolean not null default true,
  usage_count integer not null default 0,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists notification_templates_active_idx
  on public.notification_templates (is_active)
  where is_active = true;
alter table public.notification_templates enable row level security;
do $$ begin
  if exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='notification_templates' and policyname='notification_templates_admins'
  ) then
    drop policy notification_templates_admins on public.notification_templates;
  end if;
  create policy notification_templates_admins on public.notification_templates
    for all to authenticated
    using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true))
    with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true));
end $$;

-- Notification Template Translations (stores translated message variants for each language)
create table if not exists public.notification_template_translations (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.notification_templates(id) on delete cascade,
  language text not null references public.translation_languages(code),
  message_variants text[] not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(template_id, language)
);

create index if not exists ntt_template_lang_idx on public.notification_template_translations (template_id, language);

alter table public.notification_template_translations enable row level security;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='notification_template_translations' and policyname='ntt_admin_all') then
    drop policy ntt_admin_all on public.notification_template_translations;
  end if;
  create policy ntt_admin_all on public.notification_template_translations for all to authenticated
    using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true))
    with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true));
end $$;

-- Add template_id to notification_campaigns
alter table public.notification_campaigns add column if not exists template_id uuid references public.notification_templates(id) on delete set null;

-- ========== Notification Automations (recurring automated notifications) ==========
create table if not exists public.notification_automations (
  id uuid primary key default gen_random_uuid(),
  trigger_type text not null unique check (trigger_type in ('weekly_inactive_reminder', 'daily_task_reminder', 'journal_continue_reminder')),
  display_name text not null,
  description text,
  is_enabled boolean not null default false,
  template_id uuid references public.notification_templates(id) on delete set null,
  send_hour integer not null default 9 check (send_hour >= 0 and send_hour <= 23),
  cta_url text,
  last_run_at timestamptz,
  last_run_summary jsonb,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists notification_automations_enabled_idx
  on public.notification_automations (is_enabled)
  where is_enabled = true;
alter table public.notification_automations enable row level security;
do $$ begin
  if exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='notification_automations' and policyname='notification_automations_admins'
  ) then
    drop policy notification_automations_admins on public.notification_automations;
  end if;
  create policy notification_automations_admins on public.notification_automations
    for all to authenticated
    using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true))
    with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true));
end $$;

-- Seed default automation triggers (only insert if they don't exist - never overwrite user settings)
do $$
begin
  -- Weekly Inactive User Reminder
  insert into public.notification_automations (trigger_type, display_name, description, send_hour)
  values ('weekly_inactive_reminder', 'Weekly Inactive User Reminder', 'Sends a reminder to users who have been inactive for 7+ days', 10)
  on conflict (trigger_type) do nothing;
  
  -- Daily Remaining Task Reminder
  insert into public.notification_automations (trigger_type, display_name, description, send_hour)
  values ('daily_task_reminder', 'Daily Remaining Task Reminder', 'Sends a reminder about incomplete tasks for today', 18)
  on conflict (trigger_type) do nothing;
  
  -- Journal Continue Reminder
  insert into public.notification_automations (trigger_type, display_name, description, send_hour)
  values ('journal_continue_reminder', 'Journal Continue Reminder', 'Encourages users who wrote in their journal yesterday to continue', 9)
  on conflict (trigger_type) do nothing;
end $$;

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.notification_campaigns(id) on delete set null,
  iteration integer not null default 1,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  message text not null,
  payload jsonb not null default '{}'::jsonb,
  cta_url text,
  scheduled_for timestamptz not null default now(),
  delivered_at timestamptz,
  delivery_status text not null default 'pending' check (delivery_status in ('pending','sent','failed','cancelled')),
  delivery_attempts integer not null default 0,
  delivery_error text,
  seen_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);

-- Add automation_id column if it doesn't exist (for existing tables)
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'user_notifications' 
    and column_name = 'automation_id'
  ) then
    alter table public.user_notifications 
      add column automation_id uuid references public.notification_automations(id) on delete set null;
  end if;
end $$;

create index if not exists user_notifications_user_idx on public.user_notifications (user_id, scheduled_for desc);
create index if not exists user_notifications_campaign_idx on public.user_notifications (campaign_id);

-- Create automation indexes only if column exists
do $$
begin
  if exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'user_notifications' 
    and column_name = 'automation_id'
  ) then
    if not exists (select 1 from pg_indexes where indexname = 'user_notifications_automation_idx') then
      create index user_notifications_automation_idx on public.user_notifications (automation_id);
    end if;
    -- Index for looking up automation notifications by user and date
    if not exists (select 1 from pg_indexes where indexname = 'user_notifications_automation_user_idx') then
      create index user_notifications_automation_user_idx 
        on public.user_notifications (automation_id, user_id, scheduled_for)
        where automation_id is not null;
    end if;
  end if;
end $$;

create unique index if not exists user_notifications_unique_delivery
  on public.user_notifications (campaign_id, iteration, user_id)
  where campaign_id is not null;
grant select, insert, update, delete on public.user_notifications to authenticated;
alter table public.user_notifications enable row level security;
do $$ begin
  if exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='user_notifications' and policyname='user_notifications_select_self'
  ) then
    drop policy user_notifications_select_self on public.user_notifications;
  end if;
  create policy user_notifications_select_self on public.user_notifications
    for select to authenticated
    using (user_id = (select auth.uid()));
  if exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='user_notifications' and policyname='user_notifications_update_self'
  ) then
    drop policy user_notifications_update_self on public.user_notifications;
  end if;
  create policy user_notifications_update_self on public.user_notifications
    for update to authenticated
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));
end $$;

create table if not exists public.user_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  auth_key text,
  p256dh_key text,
  user_agent text,
  subscription jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz
);
create unique index if not exists user_push_subscriptions_endpoint_idx
  on public.user_push_subscriptions (endpoint);
create index if not exists user_push_subscriptions_user_idx
  on public.user_push_subscriptions (user_id);
grant select, insert, update, delete on public.user_push_subscriptions to authenticated;
alter table public.user_push_subscriptions enable row level security;
do $$ begin
  if exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='user_push_subscriptions' and policyname='user_push_subscriptions_self'
  ) then
    drop policy user_push_subscriptions_self on public.user_push_subscriptions;
  end if;
  create policy user_push_subscriptions_self on public.user_push_subscriptions
    for all to authenticated
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));
end $$;

-- Optimization: server-side task occurrence generation (fast path for dashboard)
CREATE OR REPLACE FUNCTION public.ensure_gardens_tasks_occurrences(
  _garden_ids uuid[],
  _start_iso timestamptz,
  _end_iso timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _start_date date := date(_start_iso);
  _end_date date := date(_end_iso);
  _task record;
  _curr date;
  _curr_ts timestamptz;
  _occurrence_due timestamptz;
  _match boolean;
  _ymd text;
  _mm text;
  _dd text;
  _weekday int;
  _week_index int;
  _key text;
  _interval interval;
BEGIN
  -- Loop through all relevant tasks in the given gardens
  FOR _task IN
    SELECT *
    FROM garden_plant_tasks
    WHERE garden_id = ANY(_garden_ids)
      -- Only active tasks (if archived_at exists, otherwise ignore)
      -- AND (archived_at IS NULL) 
  LOOP
    -- One time date
    IF _task.schedule_kind = 'one_time_date' THEN
      IF _task.due_at IS NOT NULL THEN
         _occurrence_due := (_task.due_at::date || 'T12:00:00.000Z')::timestamptz;
         IF _occurrence_due >= _start_iso AND _occurrence_due <= _end_iso THEN
           INSERT INTO garden_plant_task_occurrences (task_id, garden_plant_id, due_at, required_count)
           VALUES (_task.id, _task.garden_plant_id, _occurrence_due, GREATEST(1, _task.required_count))
           ON CONFLICT (task_id, due_at) DO NOTHING;
         END IF;
      END IF;

    -- One time duration
    ELSIF _task.schedule_kind = 'one_time_duration' THEN
       _occurrence_due := (_task.created_at + (_task.interval_amount || ' ' || _task.interval_unit)::interval);
       _occurrence_due := (_occurrence_due::date || 'T12:00:00.000Z')::timestamptz;
       IF _occurrence_due >= _start_iso AND _occurrence_due <= _end_iso THEN
         INSERT INTO garden_plant_task_occurrences (task_id, garden_plant_id, due_at, required_count)
         VALUES (_task.id, _task.garden_plant_id, _occurrence_due, GREATEST(1, _task.required_count))
         ON CONFLICT (task_id, due_at) DO NOTHING;
       END IF;

    -- Repeat duration
    ELSIF _task.schedule_kind = 'repeat_duration' THEN
       IF _task.interval_amount > 0 THEN
         _interval := (_task.interval_amount || ' ' || _task.interval_unit)::interval;
         _curr_ts := _task.created_at;
         
         -- Optimization: if start date is far ahead, we could skip loops, but for now simple loop to ensure correctness
         -- JS logic does the same loop
         WHILE _curr_ts < _start_iso LOOP
            _curr_ts := _curr_ts + _interval;
         END LOOP;
         
         WHILE _curr_ts <= _end_iso LOOP
            _occurrence_due := (_curr_ts::date || 'T12:00:00.000Z')::timestamptz;
            -- Only insert if valid date (sanity check)
            IF _occurrence_due IS NOT NULL THEN
              INSERT INTO garden_plant_task_occurrences (task_id, garden_plant_id, due_at, required_count)
              VALUES (_task.id, _task.garden_plant_id, _occurrence_due, GREATEST(1, _task.required_count))
              ON CONFLICT (task_id, due_at) DO NOTHING;
            END IF;
            _curr_ts := _curr_ts + _interval;
         END LOOP;
       END IF;

    -- Repeat pattern
    ELSIF _task.schedule_kind = 'repeat_pattern' THEN
       -- Start from the later of: window start OR task creation date
       -- This prevents creating occurrences for dates before the task existed
       _curr := GREATEST(_start_date, (_task.created_at AT TIME ZONE 'UTC')::date);
       WHILE _curr <= _end_date LOOP
          _match := false;
          _weekday := extract(dow from _curr); -- 0-6 (Sun-Sat)
          _dd := to_char(_curr, 'DD');
          _mm := to_char(_curr, 'MM');
          _ymd := to_char(_curr, 'MM-DD');

          IF _task.period = 'week' THEN
             IF _task.weekly_days IS NOT NULL AND _weekday = ANY(_task.weekly_days) THEN
                _match := true;
             END IF;
          ELSIF _task.period = 'month' THEN
             IF _task.monthly_days IS NOT NULL AND extract(day from _curr)::int = ANY(_task.monthly_days) THEN
                _match := true;
             END IF;
             IF NOT _match AND _task.monthly_nth_weekdays IS NOT NULL THEN
                _week_index := floor((extract(day from _curr) - 1) / 7) + 1;
                _key := _week_index || '-' || _weekday;
                IF _key = ANY(_task.monthly_nth_weekdays) THEN
                   _match := true;
                END IF;
             END IF;
          ELSIF _task.period = 'year' THEN
             IF _task.yearly_days IS NOT NULL AND _ymd = ANY(_task.yearly_days) THEN
                _match := true;
             END IF;
             IF NOT _match AND _task.yearly_days IS NOT NULL THEN
                _week_index := floor((extract(day from _curr) - 1) / 7) + 1;
                _key := _mm || '-' || _week_index || '-' || _weekday;
                IF _key = ANY(_task.yearly_days) THEN
                   _match := true;
                END IF;
             END IF;
          END IF;

          IF _match THEN
             _occurrence_due := (_curr || 'T12:00:00.000Z')::timestamptz;
             INSERT INTO garden_plant_task_occurrences (task_id, garden_plant_id, due_at, required_count)
             VALUES (_task.id, _task.garden_plant_id, _occurrence_due, GREATEST(1, _task.required_count))
             ON CONFLICT (task_id, due_at) DO NOTHING;
          END IF;

          _curr := _curr + 1;
       END LOOP;

    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_gardens_tasks_occurrences(uuid[], timestamptz, timestamptz) TO authenticated;

-- ========== Ensure task occurrences for ALL gardens (used by cron job) ==========
-- This function creates task occurrences for all gardens for a given day.
-- It must run BEFORE streak calculation to ensure accurate task tracking.
-- Without this, users who don't log in don't have their task occurrences created,
-- and the system incorrectly thinks they have no tasks, allowing streaks to continue.
CREATE OR REPLACE FUNCTION public.ensure_all_gardens_tasks_occurrences_for_day(_day date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _all_garden_ids uuid[];
  _start_iso timestamptz;
  _end_iso timestamptz;
BEGIN
  -- Get all garden IDs that have at least one task defined
  SELECT array_agg(DISTINCT t.garden_id)
  INTO _all_garden_ids
  FROM garden_plant_tasks t;
  
  -- If no gardens have tasks, nothing to do
  IF _all_garden_ids IS NULL OR array_length(_all_garden_ids, 1) IS NULL THEN
    RETURN;
  END IF;
  
  -- Define the day window
  _start_iso := (_day::text || 'T00:00:00.000Z')::timestamptz;
  _end_iso := (_day::text || 'T23:59:59.999Z')::timestamptz;
  
  -- Create task occurrences for all gardens using the existing batch function
  PERFORM public.ensure_gardens_tasks_occurrences(_all_garden_ids, _start_iso, _end_iso);
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_all_gardens_tasks_occurrences_for_day(date) TO authenticated;

-- Optimization: Batch fetch member counts for gardens
CREATE OR REPLACE FUNCTION public.get_garden_member_counts(_garden_ids uuid[])
RETURNS TABLE (garden_id uuid, count integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT garden_id, count(*)::integer
  FROM garden_members
  WHERE garden_id = ANY(_garden_ids)
  GROUP BY garden_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_garden_member_counts(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_garden_member_counts(uuid[]) TO anon;

-- ============================================================================
-- TASK VALIDATION IMPROVEMENTS - Best Practices Implementation
-- ============================================================================

-- ========== 1. DATA VALIDATION CONSTRAINTS ==========

-- Add constraint: weekly_days must be valid day numbers (0=Sunday to 6=Saturday)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'garden_plant_tasks' 
    AND constraint_name = 'valid_weekly_days'
  ) THEN
    ALTER TABLE public.garden_plant_tasks
      ADD CONSTRAINT valid_weekly_days
      CHECK (
        weekly_days IS NULL 
        OR (
          array_length(weekly_days, 1) > 0 
          AND array_length(weekly_days, 1) <= 7
          AND NOT EXISTS (
            SELECT 1 FROM unnest(weekly_days) AS d WHERE d < 0 OR d > 6
          )
        )
      );
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Add constraint: monthly_days must be valid day numbers (1-31)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'garden_plant_tasks' 
    AND constraint_name = 'valid_monthly_days'
  ) THEN
    ALTER TABLE public.garden_plant_tasks
      ADD CONSTRAINT valid_monthly_days
      CHECK (
        monthly_days IS NULL 
        OR (
          array_length(monthly_days, 1) > 0 
          AND array_length(monthly_days, 1) <= 31
          AND NOT EXISTS (
            SELECT 1 FROM unnest(monthly_days) AS d WHERE d < 1 OR d > 31
          )
        )
      );
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Add constraint: interval_amount must be positive when interval_unit is set
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'garden_plant_tasks' 
    AND constraint_name = 'valid_interval'
  ) THEN
    ALTER TABLE public.garden_plant_tasks
      ADD CONSTRAINT valid_interval
      CHECK (
        (interval_unit IS NULL AND interval_amount IS NULL)
        OR (interval_unit IS NOT NULL AND interval_amount IS NOT NULL AND interval_amount > 0)
      );
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Add constraint: completed_count cannot exceed required_count on occurrences
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'garden_plant_task_occurrences' 
    AND constraint_name = 'completed_within_required'
  ) THEN
    ALTER TABLE public.garden_plant_task_occurrences
      ADD CONSTRAINT completed_within_required
      CHECK (completed_count <= required_count);
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- ========== 2. VALIDATION TRIGGER FOR SCHEDULE CONSISTENCY ==========

-- Function to validate task schedule data consistency
CREATE OR REPLACE FUNCTION public.validate_task_schedule()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Validate one_time_date schedule
  IF NEW.schedule_kind = 'one_time_date' THEN
    IF NEW.due_at IS NULL THEN
      RAISE EXCEPTION 'one_time_date schedule requires due_at to be set';
    END IF;
  
  -- Validate one_time_duration schedule
  ELSIF NEW.schedule_kind = 'one_time_duration' THEN
    IF NEW.interval_amount IS NULL OR NEW.interval_unit IS NULL THEN
      RAISE EXCEPTION 'one_time_duration schedule requires interval_amount and interval_unit';
    END IF;
    IF NEW.interval_amount <= 0 THEN
      RAISE EXCEPTION 'interval_amount must be positive';
    END IF;
  
  -- Validate repeat_duration schedule
  ELSIF NEW.schedule_kind = 'repeat_duration' THEN
    IF NEW.interval_amount IS NULL OR NEW.interval_unit IS NULL THEN
      RAISE EXCEPTION 'repeat_duration schedule requires interval_amount and interval_unit';
    END IF;
    IF NEW.interval_amount <= 0 THEN
      RAISE EXCEPTION 'interval_amount must be positive';
    END IF;
  
  -- Validate repeat_pattern schedule
  ELSIF NEW.schedule_kind = 'repeat_pattern' THEN
    IF NEW.period IS NULL THEN
      RAISE EXCEPTION 'repeat_pattern schedule requires period to be set';
    END IF;
    
    -- Validate period-specific requirements
    IF NEW.period = 'week' AND (NEW.weekly_days IS NULL OR array_length(NEW.weekly_days, 1) IS NULL) THEN
      RAISE EXCEPTION 'weekly repeat_pattern requires at least one day in weekly_days';
    END IF;
    
    IF NEW.period = 'month' AND (
      (NEW.monthly_days IS NULL OR array_length(NEW.monthly_days, 1) IS NULL) 
      AND (NEW.monthly_nth_weekdays IS NULL OR array_length(NEW.monthly_nth_weekdays, 1) IS NULL)
    ) THEN
      RAISE EXCEPTION 'monthly repeat_pattern requires monthly_days or monthly_nth_weekdays';
    END IF;
    
    IF NEW.period = 'year' AND (NEW.yearly_days IS NULL OR array_length(NEW.yearly_days, 1) IS NULL) THEN
      RAISE EXCEPTION 'yearly repeat_pattern requires at least one day in yearly_days';
    END IF;
  END IF;
  
  -- Validate custom task has a name
  IF NEW.type = 'custom' AND (NEW.custom_name IS NULL OR trim(NEW.custom_name) = '') THEN
    RAISE EXCEPTION 'custom task type requires a custom_name';
  END IF;
  
  -- Ensure garden_plant belongs to the garden
  IF NOT EXISTS (
    SELECT 1 FROM public.garden_plants gp 
    WHERE gp.id = NEW.garden_plant_id AND gp.garden_id = NEW.garden_id
  ) THEN
    RAISE EXCEPTION 'garden_plant_id must belong to the specified garden_id';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for task validation
DROP TRIGGER IF EXISTS validate_task_schedule_trigger ON public.garden_plant_tasks;
CREATE TRIGGER validate_task_schedule_trigger
  BEFORE INSERT OR UPDATE ON public.garden_plant_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_task_schedule();

-- ========== 3. OCCURRENCE VALIDATION TRIGGER ==========

-- Function to validate and normalize occurrence data
CREATE OR REPLACE FUNCTION public.validate_task_occurrence()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Ensure required_count is positive
  IF NEW.required_count IS NULL OR NEW.required_count < 1 THEN
    NEW.required_count := 1;
  END IF;
  
  -- Ensure completed_count is non-negative
  IF NEW.completed_count IS NULL OR NEW.completed_count < 0 THEN
    NEW.completed_count := 0;
  END IF;
  
  -- Cap completed_count at required_count
  IF NEW.completed_count > NEW.required_count THEN
    NEW.completed_count := NEW.required_count;
  END IF;
  
  -- Set completed_at when task is fully completed
  IF NEW.completed_count >= NEW.required_count AND NEW.completed_at IS NULL THEN
    NEW.completed_at := now();
  END IF;
  
  -- Clear completed_at if task is no longer complete (edge case: required_count increased)
  IF NEW.completed_count < NEW.required_count AND NEW.completed_at IS NOT NULL THEN
    NEW.completed_at := NULL;
  END IF;
  
  -- Validate garden_plant_id matches the task's garden_plant_id
  IF TG_OP = 'INSERT' THEN
    DECLARE
      _task_garden_plant_id uuid;
    BEGIN
      SELECT garden_plant_id INTO _task_garden_plant_id
      FROM public.garden_plant_tasks WHERE id = NEW.task_id;
      
      IF _task_garden_plant_id IS NOT NULL AND _task_garden_plant_id != NEW.garden_plant_id THEN
        -- Auto-correct to match task's garden_plant_id
        NEW.garden_plant_id := _task_garden_plant_id;
      END IF;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for occurrence validation
DROP TRIGGER IF EXISTS validate_task_occurrence_trigger ON public.garden_plant_task_occurrences;
CREATE TRIGGER validate_task_occurrence_trigger
  BEFORE INSERT OR UPDATE ON public.garden_plant_task_occurrences
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_task_occurrence();

-- ========== 4. PERFORMANCE INDEXES ==========

-- Composite index for finding tasks by garden and type
CREATE INDEX IF NOT EXISTS idx_tasks_garden_type 
  ON public.garden_plant_tasks (garden_id, type);

-- Composite index for finding tasks by plant
CREATE INDEX IF NOT EXISTS idx_tasks_garden_plant 
  ON public.garden_plant_tasks (garden_plant_id, schedule_kind);

-- Index for occurrence lookups by task and date range
CREATE INDEX IF NOT EXISTS idx_occurrences_task_due 
  ON public.garden_plant_task_occurrences (task_id, due_at);

-- Partial index for incomplete occurrences (most common query)
CREATE INDEX IF NOT EXISTS idx_occurrences_incomplete 
  ON public.garden_plant_task_occurrences (task_id, due_at) 
  WHERE completed_count < required_count;

-- Index for user completions lookup
CREATE INDEX IF NOT EXISTS idx_user_completions_user_time 
  ON public.garden_task_user_completions (user_id, occurred_at DESC);

-- ========== 5. CLEANUP FUNCTIONS ==========

-- Function to clean up old task occurrences (older than retention period)
CREATE OR REPLACE FUNCTION public.cleanup_old_task_occurrences(_retention_days integer DEFAULT 90)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _deleted_count integer;
  _cutoff_date timestamptz;
BEGIN
  _cutoff_date := (CURRENT_DATE - (_retention_days || ' days')::interval)::timestamptz;
  
  -- Delete old occurrences (cascades to user completions)
  WITH deleted AS (
    DELETE FROM public.garden_plant_task_occurrences
    WHERE due_at < _cutoff_date
    RETURNING id
  )
  SELECT count(*) INTO _deleted_count FROM deleted;
  
  RETURN _deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_old_task_occurrences(integer) TO authenticated;

-- Function to remove orphaned occurrences (task was deleted but cascade failed)
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_occurrences()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _deleted_count integer;
BEGIN
  WITH deleted AS (
    DELETE FROM public.garden_plant_task_occurrences o
    WHERE NOT EXISTS (
      SELECT 1 FROM public.garden_plant_tasks t WHERE t.id = o.task_id
    )
    RETURNING o.id
  )
  SELECT count(*) INTO _deleted_count FROM deleted;
  
  RETURN _deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_orphaned_occurrences() TO authenticated;

-- Function to fix inconsistent occurrence data
CREATE OR REPLACE FUNCTION public.fix_inconsistent_occurrences()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _fixed_count integer := 0;
BEGIN
  -- Fix occurrences where completed_count > required_count
  UPDATE public.garden_plant_task_occurrences
  SET completed_count = required_count
  WHERE completed_count > required_count;
  GET DIAGNOSTICS _fixed_count = ROW_COUNT;
  
  -- Fix occurrences marked complete but completed_count < required_count
  UPDATE public.garden_plant_task_occurrences
  SET completed_at = NULL
  WHERE completed_at IS NOT NULL AND completed_count < required_count;
  
  -- Fix occurrences not marked complete but completed_count >= required_count
  UPDATE public.garden_plant_task_occurrences
  SET completed_at = now()
  WHERE completed_at IS NULL AND completed_count >= required_count;
  
  RETURN _fixed_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fix_inconsistent_occurrences() TO authenticated;

-- ========== 6. IMPROVED STREAK CALCULATION ==========

-- Enhanced streak calculation that handles edge cases
CREATE OR REPLACE FUNCTION public.compute_garden_streak_v2(_garden_id uuid, _anchor_day date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _d date := _anchor_day;
  _streak integer := 0;
  _task_record record;
  _garden_created_at date;
  _has_tasks boolean;
BEGIN
  -- Get garden creation date (don't count days before garden existed)
  SELECT (created_at AT TIME ZONE 'UTC')::date INTO _garden_created_at
  FROM public.gardens WHERE id = _garden_id;
  
  IF _garden_created_at IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Check if garden has any tasks at all
  SELECT EXISTS(
    SELECT 1 FROM public.garden_plant_tasks WHERE garden_id = _garden_id
  ) INTO _has_tasks;
  
  -- No tasks = no streak (can't maintain a streak without tasks)
  IF NOT _has_tasks THEN
    RETURN 0;
  END IF;
  
  -- Calculate streak going backwards from anchor day
  LOOP
    -- Don't count days before garden was created
    IF _d < _garden_created_at THEN
      EXIT;
    END IF;
    
    -- Check garden_tasks table for this day's success
    SELECT day, success INTO _task_record
    FROM public.garden_tasks
    WHERE garden_id = _garden_id 
      AND day = _d 
      AND task_type = 'watering'
    LIMIT 1;
    
    -- If no record exists for this day, check if tasks were due
    IF _task_record IS NULL THEN
      -- Check if any tasks existed and had occurrences due on this day
      DECLARE
        _had_tasks_due boolean;
        _all_completed boolean;
      BEGIN
        SELECT 
          EXISTS(
            SELECT 1 FROM public.garden_plant_task_occurrences o
            JOIN public.garden_plant_tasks t ON t.id = o.task_id
            WHERE t.garden_id = _garden_id
              AND (o.due_at AT TIME ZONE 'UTC')::date = _d
          ),
          NOT EXISTS(
            SELECT 1 FROM public.garden_plant_task_occurrences o
            JOIN public.garden_plant_tasks t ON t.id = o.task_id
            WHERE t.garden_id = _garden_id
              AND (o.due_at AT TIME ZONE 'UTC')::date = _d
              AND o.completed_count < o.required_count
          )
        INTO _had_tasks_due, _all_completed;
        
        IF _had_tasks_due THEN
          IF _all_completed THEN
            _streak := _streak + 1;
          ELSE
            -- Had tasks but didn't complete them - streak broken
            EXIT;
          END IF;
        ELSE
          -- No tasks due this day - check if we should continue
          -- Only continue if the garden had tasks defined before this date
          IF EXISTS(
            SELECT 1 FROM public.garden_plant_tasks 
            WHERE garden_id = _garden_id 
              AND (created_at AT TIME ZONE 'UTC')::date <= _d
          ) THEN
            -- Garden had tasks but none were due - day is a "pass"
            _streak := _streak + 1;
          ELSE
            -- No tasks defined yet - don't count this day
            EXIT;
          END IF;
        END IF;
      END;
    ELSIF NOT COALESCE(_task_record.success, false) THEN
      -- Day failed - streak broken
      EXIT;
    ELSE
      -- Day successful - increment streak
      _streak := _streak + 1;
    END IF;
    
    -- Move to previous day
    _d := (_d - interval '1 day')::date;
    
    -- Safety limit to prevent infinite loops
    IF _streak > 3650 THEN -- Max 10 years
      EXIT;
    END IF;
  END LOOP;
  
  RETURN _streak;
END;
$$;

GRANT EXECUTE ON FUNCTION public.compute_garden_streak_v2(uuid, date) TO authenticated;

-- ========== 7. SCHEDULED CLEANUP CRON JOB ==========

-- Schedule weekly cleanup of old task data (Sundays at 3:00 UTC)
DO $$ BEGIN
  BEGIN
    PERFORM cron.schedule(
      'cleanup_old_task_data',
      '0 3 * * 0',
      $_cron$
        SELECT public.cleanup_old_task_occurrences(90);
        SELECT public.cleanup_orphaned_occurrences();
        SELECT public.fix_inconsistent_occurrences();
      $_cron$
    );
  EXCEPTION
    WHEN others THEN NULL;
  END;
END $$;

-- ========== 8. HELPER FUNCTION FOR TASK STATUS SUMMARY ==========

-- Get comprehensive task status for a garden on a specific day
CREATE OR REPLACE FUNCTION public.get_garden_task_status(_garden_id uuid, _day date DEFAULT CURRENT_DATE)
RETURNS TABLE (
  total_tasks_due integer,
  total_completed integer,
  total_remaining integer,
  is_all_done boolean,
  task_types_breakdown jsonb,
  completion_percentage numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _start_iso timestamptz := (_day::text || 'T00:00:00.000Z')::timestamptz;
  _end_iso timestamptz := (_day::text || 'T23:59:59.999Z')::timestamptz;
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(o.required_count), 0)::integer AS total_tasks_due,
    COALESCE(SUM(LEAST(o.completed_count, o.required_count)), 0)::integer AS total_completed,
    COALESCE(SUM(GREATEST(0, o.required_count - o.completed_count)), 0)::integer AS total_remaining,
    (COALESCE(SUM(o.required_count), 0) = 0 OR 
     COALESCE(SUM(LEAST(o.completed_count, o.required_count)), 0) >= COALESCE(SUM(o.required_count), 0)) AS is_all_done,
    jsonb_object_agg(
      COALESCE(t.type, 'unknown'),
      jsonb_build_object(
        'due', COALESCE(SUM(o.required_count) FILTER (WHERE t.type IS NOT NULL), 0),
        'completed', COALESCE(SUM(LEAST(o.completed_count, o.required_count)) FILTER (WHERE t.type IS NOT NULL), 0)
      )
    ) AS task_types_breakdown,
    CASE 
      WHEN COALESCE(SUM(o.required_count), 0) = 0 THEN 100.0
      ELSE ROUND(
        (COALESCE(SUM(LEAST(o.completed_count, o.required_count)), 0)::numeric / 
         COALESCE(SUM(o.required_count), 1)::numeric) * 100, 
        1
      )
    END AS completion_percentage
  FROM public.garden_plant_task_occurrences o
  JOIN public.garden_plant_tasks t ON t.id = o.task_id
  WHERE t.garden_id = _garden_id
    AND o.due_at >= _start_iso
    AND o.due_at <= _end_iso;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_garden_task_status(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_garden_task_status(uuid, date) TO anon;

-- ========== 9. AUDIT LOGGING FOR TASK CHANGES ==========

-- Create audit log table for task changes (optional - enable if debugging needed)
CREATE TABLE IF NOT EXISTS public.garden_task_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation text NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  old_data jsonb,
  new_data jsonb,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

-- Index for efficient audit log queries
CREATE INDEX IF NOT EXISTS idx_task_audit_record ON public.garden_task_audit_log (table_name, record_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_audit_time ON public.garden_task_audit_log (changed_at DESC);

-- Enable RLS on audit log
ALTER TABLE public.garden_task_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='garden_task_audit_log' AND policyname='audit_admin_only') THEN
    CREATE POLICY audit_admin_only ON public.garden_task_audit_log FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true));
  END IF;
END $$;

-- Audit trigger function
CREATE OR REPLACE FUNCTION public.audit_task_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.garden_task_audit_log (operation, table_name, record_id, old_data, changed_by)
    VALUES (TG_OP, TG_TABLE_NAME, OLD.id, to_jsonb(OLD), auth.uid());
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.garden_task_audit_log (operation, table_name, record_id, old_data, new_data, changed_by)
    VALUES (TG_OP, TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.garden_task_audit_log (operation, table_name, record_id, new_data, changed_by)
    VALUES (TG_OP, TG_TABLE_NAME, NEW.id, to_jsonb(NEW), auth.uid());
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

-- Create audit triggers (disabled by default - enable for debugging)
-- DROP TRIGGER IF EXISTS audit_tasks_trigger ON public.garden_plant_tasks;
-- CREATE TRIGGER audit_tasks_trigger
--   AFTER INSERT OR UPDATE OR DELETE ON public.garden_plant_tasks
--   FOR EACH ROW EXECUTE FUNCTION public.audit_task_changes();

-- DROP TRIGGER IF EXISTS audit_occurrences_trigger ON public.garden_plant_task_occurrences;
-- CREATE TRIGGER audit_occurrences_trigger
--   AFTER INSERT OR UPDATE OR DELETE ON public.garden_plant_task_occurrences
--   FOR EACH ROW EXECUTE FUNCTION public.audit_task_changes();

-- ========== 10. STATS FUNCTION FOR DEBUGGING ==========

-- Get task system health statistics
CREATE OR REPLACE FUNCTION public.get_task_system_stats()
RETURNS TABLE (
  stat_name text,
  stat_value bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'total_gardens' AS stat_name, count(*)::bigint FROM public.gardens
  UNION ALL
  SELECT 'gardens_with_tasks', count(DISTINCT garden_id)::bigint FROM public.garden_plant_tasks
  UNION ALL
  SELECT 'total_tasks', count(*)::bigint FROM public.garden_plant_tasks
  UNION ALL
  SELECT 'total_occurrences', count(*)::bigint FROM public.garden_plant_task_occurrences
  UNION ALL
  SELECT 'completed_occurrences', count(*)::bigint FROM public.garden_plant_task_occurrences WHERE completed_count >= required_count
  UNION ALL
  SELECT 'pending_occurrences', count(*)::bigint FROM public.garden_plant_task_occurrences WHERE completed_count < required_count
  UNION ALL
  SELECT 'occurrences_today', count(*)::bigint FROM public.garden_plant_task_occurrences 
    WHERE (due_at AT TIME ZONE 'UTC')::date = CURRENT_DATE
  UNION ALL
  SELECT 'orphaned_occurrences', count(*)::bigint FROM public.garden_plant_task_occurrences o
    WHERE NOT EXISTS (SELECT 1 FROM public.garden_plant_tasks t WHERE t.id = o.task_id)
  UNION ALL
  SELECT 'inconsistent_occurrences', count(*)::bigint FROM public.garden_plant_task_occurrences
    WHERE completed_count > required_count
  ORDER BY stat_name;
$$;

GRANT EXECUTE ON FUNCTION public.get_task_system_stats() TO authenticated;

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

-- Grant access
grant select, insert, update, delete on public.bookmarks to authenticated;
grant select on public.bookmarks to anon;
grant select, insert, update, delete on public.bookmark_items to authenticated;
grant select on public.bookmark_items to anon;

-- Policies for bookmarks
drop policy if exists "Bookmarks are viewable by everyone if public" on public.bookmarks;
create policy "Bookmarks are viewable by everyone if public"
  on public.bookmarks for select
  using ( visibility = 'public' );

drop policy if exists "Users can view their own bookmarks" on public.bookmarks;
create policy "Users can view their own bookmarks"
  on public.bookmarks for select
  using ( auth.uid() = user_id );

drop policy if exists "Users can insert their own bookmarks" on public.bookmarks;
create policy "Users can insert their own bookmarks"
  on public.bookmarks for insert
  with check ( auth.uid() = user_id );

drop policy if exists "Users can update their own bookmarks" on public.bookmarks;
create policy "Users can update their own bookmarks"
  on public.bookmarks for update
  using ( auth.uid() = user_id );

drop policy if exists "Users can delete their own bookmarks" on public.bookmarks;
create policy "Users can delete their own bookmarks"
  on public.bookmarks for delete
  using ( auth.uid() = user_id );

-- Policies for bookmark_items
-- Users can view items if they can view the bookmark
drop policy if exists "Bookmark items are viewable if bookmark is viewable" on public.bookmark_items;
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
drop policy if exists "Users can insert items into their own bookmarks" on public.bookmark_items;
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
drop policy if exists "Users can delete items from their own bookmarks" on public.bookmark_items;
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

-- ========== Garden Analytics & AI Advice ==========

-- Weekly AI-generated gardener advice stored per garden
create table if not exists public.garden_ai_advice (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  week_start date not null,
  advice_text text not null,
  advice_summary text,
  focus_areas text[] not null default '{}',
  plant_specific_tips jsonb not null default '[]'::jsonb,
  improvement_score integer check (improvement_score >= 0 and improvement_score <= 100),
  images_analyzed text[] not null default '{}',
  model_used text,
  tokens_used integer,
  generated_at timestamptz not null default now(),
  unique (garden_id, week_start)
);

alter table if exists public.garden_ai_advice add column if not exists advice_summary text;
alter table if exists public.garden_ai_advice add column if not exists focus_areas text[] not null default '{}';
alter table if exists public.garden_ai_advice add column if not exists plant_specific_tips jsonb not null default '[]'::jsonb;
alter table if exists public.garden_ai_advice add column if not exists improvement_score integer check (improvement_score >= 0 and improvement_score <= 100);
alter table if exists public.garden_ai_advice add column if not exists images_analyzed text[] not null default '{}';
alter table if exists public.garden_ai_advice add column if not exists model_used text;
alter table if exists public.garden_ai_advice add column if not exists tokens_used integer;

create index if not exists gaia_garden_week_idx on public.garden_ai_advice (garden_id, week_start desc);

alter table public.garden_ai_advice enable row level security;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_ai_advice' and policyname='gaia_select') then
    drop policy gaia_select on public.garden_ai_advice;
  end if;
  create policy gaia_select on public.garden_ai_advice for select to authenticated
    using (
      exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
      or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    );
end $$;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_ai_advice' and policyname='gaia_insert') then
    drop policy gaia_insert on public.garden_ai_advice;
  end if;
  create policy gaia_insert on public.garden_ai_advice for insert to authenticated
    with check (
      exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
      or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    );
end $$;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_ai_advice' and policyname='gaia_update') then
    drop policy gaia_update on public.garden_ai_advice;
  end if;
  create policy gaia_update on public.garden_ai_advice for update to authenticated
    using (
      exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
      or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    )
    with check (
      exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
      or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    );
end $$;

-- Garden analytics snapshots - stores daily/weekly aggregates for historical charts
create table if not exists public.garden_analytics_snapshots (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  snapshot_date date not null,
  snapshot_type text not null check (snapshot_type in ('daily', 'weekly', 'monthly')),
  -- Task metrics
  tasks_due integer not null default 0,
  tasks_completed integer not null default 0,
  tasks_water integer not null default 0,
  tasks_fertilize integer not null default 0,
  tasks_harvest integer not null default 0,
  tasks_cut integer not null default 0,
  tasks_custom integer not null default 0,
  -- Plant metrics
  plants_count integer not null default 0,
  species_count integer not null default 0,
  plants_added integer not null default 0,
  plants_removed integer not null default 0,
  -- Member activity metrics
  active_members integer not null default 0,
  total_actions integer not null default 0,
  -- Streak and health
  streak_maintained boolean not null default false,
  completion_rate numeric(5,2) not null default 0,
  -- Member breakdown (for multi-member gardens)
  member_actions jsonb not null default '{}'::jsonb,
  -- Metadata
  created_at timestamptz not null default now(),
  unique (garden_id, snapshot_date, snapshot_type)
);

alter table if exists public.garden_analytics_snapshots add column if not exists tasks_water integer not null default 0;
alter table if exists public.garden_analytics_snapshots add column if not exists tasks_fertilize integer not null default 0;
alter table if exists public.garden_analytics_snapshots add column if not exists tasks_harvest integer not null default 0;
alter table if exists public.garden_analytics_snapshots add column if not exists tasks_cut integer not null default 0;
alter table if exists public.garden_analytics_snapshots add column if not exists tasks_custom integer not null default 0;
alter table if exists public.garden_analytics_snapshots add column if not exists plants_added integer not null default 0;
alter table if exists public.garden_analytics_snapshots add column if not exists plants_removed integer not null default 0;
alter table if exists public.garden_analytics_snapshots add column if not exists active_members integer not null default 0;
alter table if exists public.garden_analytics_snapshots add column if not exists total_actions integer not null default 0;
alter table if exists public.garden_analytics_snapshots add column if not exists member_actions jsonb not null default '{}'::jsonb;

create index if not exists gas_garden_date_type_idx on public.garden_analytics_snapshots (garden_id, snapshot_date desc, snapshot_type);

alter table public.garden_analytics_snapshots enable row level security;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_analytics_snapshots' and policyname='gas_select') then
    drop policy gas_select on public.garden_analytics_snapshots;
  end if;
  create policy gas_select on public.garden_analytics_snapshots for select to authenticated
    using (
      exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
      or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    );
end $$;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_analytics_snapshots' and policyname='gas_insert') then
    drop policy gas_insert on public.garden_analytics_snapshots;
  end if;
  create policy gas_insert on public.garden_analytics_snapshots for insert to authenticated
    with check (
      exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
      or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    );
end $$;

-- User activity tracking for detailed analytics
create table if not exists public.garden_user_activity (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_date date not null,
  activity_type text not null check (activity_type in ('task_complete', 'plant_add', 'plant_remove', 'task_create', 'task_edit', 'note', 'visit', 'share')),
  activity_count integer not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (garden_id, user_id, activity_date, activity_type)
);

create index if not exists gua_garden_date_idx on public.garden_user_activity (garden_id, activity_date desc);
create index if not exists gua_user_date_idx on public.garden_user_activity (user_id, activity_date desc);

alter table public.garden_user_activity enable row level security;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_user_activity' and policyname='gua_select') then
    drop policy gua_select on public.garden_user_activity;
  end if;
  create policy gua_select on public.garden_user_activity for select to authenticated
    using (
      exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
      or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    );
end $$;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_user_activity' and policyname='gua_insert') then
    drop policy gua_insert on public.garden_user_activity;
  end if;
  create policy gua_insert on public.garden_user_activity for insert to authenticated
    with check (
      user_id = (select auth.uid())
      or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    );
end $$;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_user_activity' and policyname='gua_update') then
    drop policy gua_update on public.garden_user_activity;
  end if;
  create policy gua_update on public.garden_user_activity for update to authenticated
    using (
      user_id = (select auth.uid())
      or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    )
    with check (
      user_id = (select auth.uid())
      or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    );
end $$;

-- Helper function to track user activity (upserts the count for the day)
create or replace function public.track_garden_activity(
  _garden_id uuid,
  _activity_type text,
  _metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := (select auth.uid());
  v_today date := current_date;
begin
  insert into public.garden_user_activity (garden_id, user_id, activity_date, activity_type, activity_count, metadata)
  values (_garden_id, v_user, v_today, _activity_type, 1, _metadata)
  on conflict (garden_id, user_id, activity_date, activity_type)
  do update set
    activity_count = garden_user_activity.activity_count + 1,
    metadata = garden_user_activity.metadata || _metadata;
end;
$$;

grant execute on function public.track_garden_activity(uuid, text, jsonb) to authenticated;

-- Helper function to compute analytics for a garden on a specific date
create or replace function public.compute_garden_daily_analytics(
  _garden_id uuid,
  _date date
)
returns table (
  tasks_due integer,
  tasks_completed integer,
  tasks_water integer,
  tasks_fertilize integer,
  tasks_harvest integer,
  tasks_cut integer,
  tasks_custom integer,
  plants_count integer,
  species_count integer,
  active_members integer,
  total_actions integer,
  completion_rate numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tasks_due integer := 0;
  v_tasks_completed integer := 0;
  v_tasks_water integer := 0;
  v_tasks_fertilize integer := 0;
  v_tasks_harvest integer := 0;
  v_tasks_cut integer := 0;
  v_tasks_custom integer := 0;
  v_plants_count integer := 0;
  v_species_count integer := 0;
  v_active_members integer := 0;
  v_total_actions integer := 0;
  v_completion_rate numeric := 0;
  v_date_start timestamptz;
  v_date_end timestamptz;
begin
  v_date_start := (_date || 'T00:00:00.000Z')::timestamptz;
  v_date_end := (_date || 'T23:59:59.999Z')::timestamptz;

  -- Get task occurrences for the date
  select
    coalesce(sum(o.required_count), 0)::integer,
    coalesce(sum(least(o.completed_count, o.required_count)), 0)::integer,
    coalesce(sum(case when t.type = 'water' then o.required_count else 0 end), 0)::integer,
    coalesce(sum(case when t.type = 'fertilize' then o.required_count else 0 end), 0)::integer,
    coalesce(sum(case when t.type = 'harvest' then o.required_count else 0 end), 0)::integer,
    coalesce(sum(case when t.type = 'cut' then o.required_count else 0 end), 0)::integer,
    coalesce(sum(case when t.type = 'custom' then o.required_count else 0 end), 0)::integer
  into v_tasks_due, v_tasks_completed, v_tasks_water, v_tasks_fertilize, v_tasks_harvest, v_tasks_cut, v_tasks_custom
  from public.garden_plant_task_occurrences o
  join public.garden_plant_tasks t on t.id = o.task_id
  where t.garden_id = _garden_id
    and o.due_at >= v_date_start
    and o.due_at <= v_date_end;

  -- Get plant counts
  select count(distinct id)::integer, count(distinct plant_id)::integer
  into v_plants_count, v_species_count
  from public.garden_plants
  where garden_id = _garden_id;

  -- Get active members (users who completed tasks or logged activity on this date)
  select count(distinct user_id)::integer
  into v_active_members
  from public.garden_user_activity
  where garden_id = _garden_id and activity_date = _date;

  -- Get total actions
  select coalesce(sum(activity_count), 0)::integer
  into v_total_actions
  from public.garden_user_activity
  where garden_id = _garden_id and activity_date = _date;

  -- Compute completion rate
  if v_tasks_due > 0 then
    v_completion_rate := round((v_tasks_completed::numeric / v_tasks_due::numeric) * 100, 2);
  else
    v_completion_rate := 100.00;
  end if;

  return query select
    v_tasks_due,
    v_tasks_completed,
    v_tasks_water,
    v_tasks_fertilize,
    v_tasks_harvest,
    v_tasks_cut,
    v_tasks_custom,
    v_plants_count,
    v_species_count,
    v_active_members,
    v_total_actions,
    v_completion_rate;
end;
$$;

grant execute on function public.compute_garden_daily_analytics(uuid, date) to authenticated;

-- Custom plant images table for user-uploaded photos of their garden plants
create table if not exists public.garden_plant_images (
  id uuid primary key default gen_random_uuid(),
  garden_plant_id uuid not null references public.garden_plants(id) on delete cascade,
  image_url text not null,
  caption text,
  taken_at timestamptz,
  uploaded_by uuid references auth.users(id) on delete set null,
  uploaded_at timestamptz not null default now()
);

create index if not exists gpi_garden_plant_idx on public.garden_plant_images (garden_plant_id, uploaded_at desc);

alter table public.garden_plant_images enable row level security;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plant_images' and policyname='gpi_select') then
    drop policy gpi_select on public.garden_plant_images;
  end if;
  create policy gpi_select on public.garden_plant_images for select to authenticated
    using (
      exists (
        select 1 from public.garden_plants gp
        join public.garden_members gm on gm.garden_id = gp.garden_id
        where gp.id = garden_plant_id and gm.user_id = (select auth.uid())
      )
      or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    );
end $$;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plant_images' and policyname='gpi_insert') then
    drop policy gpi_insert on public.garden_plant_images;
  end if;
  create policy gpi_insert on public.garden_plant_images for insert to authenticated
    with check (
      exists (
        select 1 from public.garden_plants gp
        join public.garden_members gm on gm.garden_id = gp.garden_id
        where gp.id = garden_plant_id and gm.user_id = (select auth.uid())
      )
      or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    );
end $$;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plant_images' and policyname='gpi_delete') then
    drop policy gpi_delete on public.garden_plant_images;
  end if;
  create policy gpi_delete on public.garden_plant_images for delete to authenticated
    using (
      uploaded_by = (select auth.uid())
      or exists (
        select 1 from public.garden_plants gp
        join public.garden_members gm on gm.garden_id = gp.garden_id
        where gp.id = garden_plant_id and gm.user_id = (select auth.uid()) and gm.role = 'owner'
      )
      or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    );
end $$;

-- Add garden_ai_advice and garden_analytics_snapshots and garden_user_activity and garden_plant_images to allowed tables
-- (This is handled by the whitelist at the top of the file - update the allowed_tables array if needed)

-- ========== Garden Journal System ==========
-- Journal entries for daily observations, notes, and reflections
create table if not exists public.garden_journal_entries (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null,
  title text,
  content text not null,
  mood text check (mood is null or mood in ('blooming', 'thriving', 'sprouting', 'resting', 'wilting')),
  weather_snapshot jsonb default '{}'::jsonb,
  -- Metadata
  plants_mentioned uuid[] default '{}',
  tags text[] default '{}',
  is_private boolean not null default false,
  -- AI feedback
  ai_feedback text,
  ai_feedback_generated_at timestamptz,
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gje_garden_date_idx on public.garden_journal_entries (garden_id, entry_date desc);
create index if not exists gje_user_date_idx on public.garden_journal_entries (user_id, entry_date desc);

alter table public.garden_journal_entries enable row level security;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_journal_entries' and policyname='gje_select') then
    drop policy gje_select on public.garden_journal_entries;
  end if;
  create policy gje_select on public.garden_journal_entries for select to authenticated
    using (
      -- Own entries
      user_id = (select auth.uid())
      -- Other members can see non-private entries
      or (
        not is_private
        and exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
      )
      -- Admins can see all
      or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    );
end $$;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_journal_entries' and policyname='gje_insert') then
    drop policy gje_insert on public.garden_journal_entries;
  end if;
  create policy gje_insert on public.garden_journal_entries for insert to authenticated
    with check (
      user_id = (select auth.uid())
      and exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
    );
end $$;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_journal_entries' and policyname='gje_update') then
    drop policy gje_update on public.garden_journal_entries;
  end if;
  create policy gje_update on public.garden_journal_entries for update to authenticated
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));
end $$;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_journal_entries' and policyname='gje_delete') then
    drop policy gje_delete on public.garden_journal_entries;
  end if;
  create policy gje_delete on public.garden_journal_entries for delete to authenticated
    using (
      user_id = (select auth.uid())
      or exists (
        select 1 from public.garden_members gm 
        where gm.garden_id = garden_id and gm.user_id = (select auth.uid()) and gm.role = 'owner'
      )
      or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    );
end $$;

-- Journal photos - attached to journal entries
-- Stored in: PHOTO/{garden_id}/journal/{entry_id}/{filename}
create table if not exists public.garden_journal_photos (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.garden_journal_entries(id) on delete cascade,
  garden_plant_id uuid references public.garden_plants(id) on delete set null,
  image_url text not null,
  thumbnail_url text,
  caption text,
  -- Plant health observation
  plant_health text check (plant_health is null or plant_health in ('thriving', 'healthy', 'okay', 'struggling', 'critical')),
  observations text,
  -- Timestamps
  taken_at timestamptz,
  uploaded_at timestamptz not null default now()
);

create index if not exists gjp_entry_idx on public.garden_journal_photos (entry_id, uploaded_at desc);
create index if not exists gjp_plant_idx on public.garden_journal_photos (garden_plant_id, uploaded_at desc);

alter table public.garden_journal_photos enable row level security;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_journal_photos' and policyname='gjp_select') then
    drop policy gjp_select on public.garden_journal_photos;
  end if;
  create policy gjp_select on public.garden_journal_photos for select to authenticated
    using (
      exists (
        select 1 from public.garden_journal_entries e
        join public.garden_members gm on gm.garden_id = e.garden_id
        where e.id = entry_id and (
          e.user_id = (select auth.uid())
          or (not e.is_private and gm.user_id = (select auth.uid()))
        )
      )
      or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    );
end $$;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_journal_photos' and policyname='gjp_insert') then
    drop policy gjp_insert on public.garden_journal_photos;
  end if;
  create policy gjp_insert on public.garden_journal_photos for insert to authenticated
    with check (
      exists (
        select 1 from public.garden_journal_entries e
        where e.id = entry_id and e.user_id = (select auth.uid())
      )
    );
end $$;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_journal_photos' and policyname='gjp_delete') then
    drop policy gjp_delete on public.garden_journal_photos;
  end if;
  create policy gjp_delete on public.garden_journal_photos for delete to authenticated
    using (
      exists (
        select 1 from public.garden_journal_entries e
        where e.id = entry_id and e.user_id = (select auth.uid())
      )
      or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    );
end $$;

-- Add weather and context columns to garden_ai_advice
alter table if exists public.garden_ai_advice add column if not exists weather_context jsonb default '{}'::jsonb;
alter table if exists public.garden_ai_advice add column if not exists journal_context jsonb default '{}'::jsonb;
alter table if exists public.garden_ai_advice add column if not exists avg_completion_time text;
alter table if exists public.garden_ai_advice add column if not exists location_context jsonb default '{}'::jsonb;

-- Add translations column to store translated versions of advice (keyed by language code)
-- Structure: { "fr": { "adviceText": "...", "adviceSummary": "...", "focusAreas": [...], ... }, ... }
alter table if exists public.garden_ai_advice add column if not exists translations jsonb default '{}'::jsonb;

-- Add language preference to gardens for advice translation
alter table if exists public.gardens add column if not exists preferred_language text default 'en';

-- Migration: Add hide_ai_chat column to gardens (default false = chat visible by default)
alter table if exists public.gardens add column if not exists hide_ai_chat boolean not null default false;

-- ========== Plant Stocks Management ==========
-- Table to manage plant seed/plant availability, quantity, and pricing for the shop
create table if not exists public.plant_stocks (
  id uuid primary key default gen_random_uuid(),
  plant_id text not null references public.plants(id) on delete cascade,
  quantity integer not null default 0 check (quantity >= 0),
  price numeric(10,2) not null default 0.00 check (price >= 0),
  is_available boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(plant_id)
);

create index if not exists plant_stocks_plant_id_idx on public.plant_stocks(plant_id);
create index if not exists plant_stocks_available_idx on public.plant_stocks(is_available) where is_available = true;

alter table public.plant_stocks enable row level security;

-- Anyone can read plant stocks (for shop display)
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_stocks' and policyname='plant_stocks_select_all') then
    drop policy plant_stocks_select_all on public.plant_stocks;
  end if;
  create policy plant_stocks_select_all on public.plant_stocks for select to authenticated using (true);
end $$;

-- Only admins can insert/update/delete plant stocks
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_stocks' and policyname='plant_stocks_insert_admin') then
    drop policy plant_stocks_insert_admin on public.plant_stocks;
  end if;
  create policy plant_stocks_insert_admin on public.plant_stocks for insert to authenticated
    with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true));
end $$;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_stocks' and policyname='plant_stocks_update_admin') then
    drop policy plant_stocks_update_admin on public.plant_stocks;
  end if;
  create policy plant_stocks_update_admin on public.plant_stocks for update to authenticated
    using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true));
end $$;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_stocks' and policyname='plant_stocks_delete_admin') then
    drop policy plant_stocks_delete_admin on public.plant_stocks;
  end if;
  create policy plant_stocks_delete_admin on public.plant_stocks for delete to authenticated
    using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true));
end $$;

-- ========== Messaging System ==========
-- This adds a complete messaging system with:
-- - Conversations (1:1 between friends)
-- - Messages with text content and optional link sharing
-- - Message reactions (emoji reactions)
-- - Reply threading support

-- ========== Conversations Table ==========
-- A conversation is a 1:1 chat between two friends
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  participant_2 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Last message timestamp for ordering conversations
  last_message_at TIMESTAMPTZ,
  -- Each participant can mute the conversation
  muted_by_1 BOOLEAN NOT NULL DEFAULT FALSE,
  muted_by_2 BOOLEAN NOT NULL DEFAULT FALSE,
  -- Ensure unique conversation between two users (order-independent)
  CONSTRAINT unique_conversation UNIQUE (participant_1, participant_2),
  CONSTRAINT different_participants CHECK (participant_1 <> participant_2),
  -- Normalize order: participant_1 < participant_2 to avoid duplicates
  CONSTRAINT ordered_participants CHECK (participant_1 < participant_2)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_conversations_participant_1 ON public.conversations(participant_1);
CREATE INDEX IF NOT EXISTS idx_conversations_participant_2 ON public.conversations(participant_2);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON public.conversations(last_message_at DESC NULLS LAST);

-- ========== Messages Table ==========
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Message content
  content TEXT NOT NULL CHECK (length(content) > 0 AND length(content) <= 4000),
  -- Optional link sharing (plant, garden, bookmark, etc.)
  link_type TEXT CHECK (link_type IN ('plant', 'garden', 'bookmark', 'profile', 'external')),
  link_id TEXT, -- ID of the linked resource
  link_url TEXT, -- URL for external links
  link_preview JSONB, -- Cached preview data: { title, description, image }
  -- Reply threading
  reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Soft delete (allows sender to delete their own messages)
  deleted_at TIMESTAMPTZ,
  -- Edit tracking
  edited_at TIMESTAMPTZ,
  -- Read receipt: null = unread, timestamp = when read
  read_at TIMESTAMPTZ
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON public.messages(reply_to_id) WHERE reply_to_id IS NOT NULL;

-- ========== Message Reactions Table ==========
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL CHECK (length(emoji) > 0 AND length(emoji) <= 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Each user can only react once with the same emoji to a message
  CONSTRAINT unique_reaction UNIQUE (message_id, user_id, emoji)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON public.message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user_id ON public.message_reactions(user_id);

-- ========== Enable RLS ==========
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- ========== Grant Access ==========
GRANT SELECT, INSERT, UPDATE ON public.conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.message_reactions TO authenticated;

-- ========== RLS Policies for Conversations ==========
-- Users can only see conversations they are part of
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='conversations' AND policyname='conversations_select_own') THEN
    DROP POLICY conversations_select_own ON public.conversations;
  END IF;
  CREATE POLICY conversations_select_own ON public.conversations FOR SELECT TO authenticated
    USING (
      participant_1 = (SELECT auth.uid())
      OR participant_2 = (SELECT auth.uid())
      OR public.is_admin_user((SELECT auth.uid()))
    );
END $$;

-- Users can create conversations (handled by function to normalize order)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='conversations' AND policyname='conversations_insert_own') THEN
    DROP POLICY conversations_insert_own ON public.conversations;
  END IF;
  CREATE POLICY conversations_insert_own ON public.conversations FOR INSERT TO authenticated
    WITH CHECK (
      participant_1 = (SELECT auth.uid()) OR participant_2 = (SELECT auth.uid())
    );
END $$;

-- Users can update their own mute settings
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='conversations' AND policyname='conversations_update_own') THEN
    DROP POLICY conversations_update_own ON public.conversations;
  END IF;
  CREATE POLICY conversations_update_own ON public.conversations FOR UPDATE TO authenticated
    USING (
      participant_1 = (SELECT auth.uid())
      OR participant_2 = (SELECT auth.uid())
      OR public.is_admin_user((SELECT auth.uid()))
    )
    WITH CHECK (
      participant_1 = (SELECT auth.uid())
      OR participant_2 = (SELECT auth.uid())
      OR public.is_admin_user((SELECT auth.uid()))
    );
END $$;

-- ========== RLS Policies for Messages ==========
-- Users can see messages in their conversations
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='messages' AND policyname='messages_select_own') THEN
    DROP POLICY messages_select_own ON public.messages;
  END IF;
  CREATE POLICY messages_select_own ON public.messages FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = messages.conversation_id
        AND (c.participant_1 = (SELECT auth.uid()) OR c.participant_2 = (SELECT auth.uid()))
      )
      OR public.is_admin_user((SELECT auth.uid()))
    );
END $$;

-- Users can send messages in their conversations
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='messages' AND policyname='messages_insert_own') THEN
    DROP POLICY messages_insert_own ON public.messages;
  END IF;
  CREATE POLICY messages_insert_own ON public.messages FOR INSERT TO authenticated
    WITH CHECK (
      sender_id = (SELECT auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = messages.conversation_id
        AND (c.participant_1 = (SELECT auth.uid()) OR c.participant_2 = (SELECT auth.uid()))
      )
    );
END $$;

-- Users can update their own messages (edit/delete)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='messages' AND policyname='messages_update_own') THEN
    DROP POLICY messages_update_own ON public.messages;
  END IF;
  CREATE POLICY messages_update_own ON public.messages FOR UPDATE TO authenticated
    USING (
      sender_id = (SELECT auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = messages.conversation_id
        AND (c.participant_1 = (SELECT auth.uid()) OR c.participant_2 = (SELECT auth.uid()))
      )
      OR public.is_admin_user((SELECT auth.uid()))
    )
    WITH CHECK (
      sender_id = (SELECT auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = messages.conversation_id
        AND (c.participant_1 = (SELECT auth.uid()) OR c.participant_2 = (SELECT auth.uid()))
      )
      OR public.is_admin_user((SELECT auth.uid()))
    );
END $$;

-- ========== RLS Policies for Reactions ==========
-- Users can see reactions on messages they can see
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='message_reactions' AND policyname='reactions_select_own') THEN
    DROP POLICY reactions_select_own ON public.message_reactions;
  END IF;
  CREATE POLICY reactions_select_own ON public.message_reactions FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.messages m
        JOIN public.conversations c ON c.id = m.conversation_id
        WHERE m.id = message_reactions.message_id
        AND (c.participant_1 = (SELECT auth.uid()) OR c.participant_2 = (SELECT auth.uid()))
      )
      OR public.is_admin_user((SELECT auth.uid()))
    );
END $$;

-- Users can add reactions to messages they can see
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='message_reactions' AND policyname='reactions_insert_own') THEN
    DROP POLICY reactions_insert_own ON public.message_reactions;
  END IF;
  CREATE POLICY reactions_insert_own ON public.message_reactions FOR INSERT TO authenticated
    WITH CHECK (
      user_id = (SELECT auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.messages m
        JOIN public.conversations c ON c.id = m.conversation_id
        WHERE m.id = message_reactions.message_id
        AND (c.participant_1 = (SELECT auth.uid()) OR c.participant_2 = (SELECT auth.uid()))
      )
    );
END $$;

-- Users can remove their own reactions
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='message_reactions' AND policyname='reactions_delete_own') THEN
    DROP POLICY reactions_delete_own ON public.message_reactions;
  END IF;
  CREATE POLICY reactions_delete_own ON public.message_reactions FOR DELETE TO authenticated
    USING (
      user_id = (SELECT auth.uid())
      OR public.is_admin_user((SELECT auth.uid()))
    );
END $$;

-- ========== Helper Functions ==========

-- Function to get or create a conversation between two users (with rate limiting for new conversations)
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(_user1_id UUID, _user2_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID;
  v_p1 UUID;
  v_p2 UUID;
  v_conversation_id UUID;
  v_are_friends BOOLEAN;
  v_are_blocked BOOLEAN;
  v_conversation_count INTEGER;
  v_rate_limit INTEGER := 30; -- Max new conversations per hour
  v_window_interval INTERVAL := '1 hour';
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Caller must be one of the participants
  IF v_caller <> _user1_id AND v_caller <> _user2_id THEN
    RAISE EXCEPTION 'Cannot create conversation for other users';
  END IF;
  
  -- Normalize order
  IF _user1_id < _user2_id THEN
    v_p1 := _user1_id;
    v_p2 := _user2_id;
  ELSE
    v_p1 := _user2_id;
    v_p2 := _user1_id;
  END IF;
  
  -- Check if they are friends
  SELECT EXISTS (
    SELECT 1 FROM public.friends
    WHERE (user_id = v_p1 AND friend_id = v_p2)
    OR (user_id = v_p2 AND friend_id = v_p1)
  ) INTO v_are_friends;
  
  IF NOT v_are_friends THEN
    RAISE EXCEPTION 'You can only message your friends';
  END IF;
  
  -- Check if blocked
  SELECT EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE (blocker_id = v_p1 AND blocked_id = v_p2)
    OR (blocker_id = v_p2 AND blocked_id = v_p1)
  ) INTO v_are_blocked;
  
  IF v_are_blocked THEN
    RAISE EXCEPTION 'Cannot message this user';
  END IF;
  
  -- Try to find existing conversation
  SELECT id INTO v_conversation_id
  FROM public.conversations
  WHERE participant_1 = v_p1 AND participant_2 = v_p2;
  
  IF v_conversation_id IS NOT NULL THEN
    RETURN v_conversation_id;
  END IF;
  
  -- Rate limiting for NEW conversation creation only
  SELECT COUNT(*)::INTEGER INTO v_conversation_count
  FROM public.conversations
  WHERE participant_1 = v_caller
    AND created_at > NOW() - v_window_interval;
  
  IF v_conversation_count >= v_rate_limit THEN
    RAISE EXCEPTION 'Rate limit exceeded. Please wait before starting more conversations.';
  END IF;
  
  -- Create new conversation
  INSERT INTO public.conversations (participant_1, participant_2)
  VALUES (v_p1, v_p2)
  RETURNING id INTO v_conversation_id;
  
  RETURN v_conversation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_conversation(UUID, UUID) TO authenticated;

-- Function to send a message (with rate limiting)
CREATE OR REPLACE FUNCTION public.send_message(
  _conversation_id UUID,
  _content TEXT,
  _link_type TEXT DEFAULT NULL,
  _link_id TEXT DEFAULT NULL,
  _link_url TEXT DEFAULT NULL,
  _link_preview JSONB DEFAULT NULL,
  _reply_to_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID;
  v_message_id UUID;
  v_recipient_id UUID;
  v_p1 UUID;
  v_p2 UUID;
  v_is_muted BOOLEAN;
  v_message_count INTEGER;
  v_rate_limit INTEGER := 300; -- Max messages per hour (5/min sustained)
  v_window_interval INTERVAL := '1 hour';
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Rate limiting: Count messages sent by this user in the last hour
  SELECT COUNT(*)::INTEGER INTO v_message_count
  FROM public.messages
  WHERE sender_id = v_caller
    AND created_at > NOW() - v_window_interval;
  
  IF v_message_count >= v_rate_limit THEN
    RAISE EXCEPTION 'Rate limit exceeded. Please wait before sending more messages.';
  END IF;
  
  -- Verify caller is participant
  SELECT participant_1, participant_2 INTO v_p1, v_p2
  FROM public.conversations
  WHERE id = _conversation_id;
  
  IF v_p1 IS NULL THEN
    RAISE EXCEPTION 'Conversation not found';
  END IF;
  
  IF v_caller <> v_p1 AND v_caller <> v_p2 THEN
    RAISE EXCEPTION 'Not a participant of this conversation';
  END IF;
  
  -- Get recipient ID
  IF v_caller = v_p1 THEN
    v_recipient_id := v_p2;
    SELECT muted_by_2 INTO v_is_muted FROM public.conversations WHERE id = _conversation_id;
  ELSE
    v_recipient_id := v_p1;
    SELECT muted_by_1 INTO v_is_muted FROM public.conversations WHERE id = _conversation_id;
  END IF;
  
  -- Insert message
  INSERT INTO public.messages (
    conversation_id,
    sender_id,
    content,
    link_type,
    link_id,
    link_url,
    link_preview,
    reply_to_id
  )
  VALUES (
    _conversation_id,
    v_caller,
    _content,
    _link_type,
    _link_id,
    _link_url,
    _link_preview,
    _reply_to_id
  )
  RETURNING id INTO v_message_id;
  
  -- Update conversation's last_message_at
  UPDATE public.conversations
  SET last_message_at = NOW(), updated_at = NOW()
  WHERE id = _conversation_id;
  
  RETURN v_message_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_message(UUID, TEXT, TEXT, TEXT, TEXT, JSONB, UUID) TO authenticated;

-- Function to get unread message count for a user
CREATE OR REPLACE FUNCTION public.get_unread_message_count(_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.messages m
  JOIN public.conversations c ON c.id = m.conversation_id
  WHERE (c.participant_1 = _user_id OR c.participant_2 = _user_id)
  AND m.sender_id <> _user_id
  AND m.read_at IS NULL
  AND m.deleted_at IS NULL;
$$;

GRANT EXECUTE ON FUNCTION public.get_unread_message_count(UUID) TO authenticated;

-- Function to mark messages as read
CREATE OR REPLACE FUNCTION public.mark_messages_as_read(_conversation_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID;
  v_count INTEGER;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Mark all unread messages from the other user as read
  UPDATE public.messages
  SET read_at = NOW()
  WHERE conversation_id = _conversation_id
  AND sender_id <> v_caller
  AND read_at IS NULL
  AND deleted_at IS NULL;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_messages_as_read(UUID) TO authenticated;

-- Function to get conversation with last message and unread count
CREATE OR REPLACE FUNCTION public.get_user_conversations(_user_id UUID)
RETURNS TABLE (
  conversation_id UUID,
  other_user_id UUID,
  other_user_display_name TEXT,
  other_user_avatar_url TEXT,
  last_message_content TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_sender_id UUID,
  unread_count BIGINT,
  is_muted BOOLEAN,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH conv_data AS (
    SELECT 
      c.id,
      CASE WHEN c.participant_1 = _user_id THEN c.participant_2 ELSE c.participant_1 END AS other_id,
      CASE WHEN c.participant_1 = _user_id THEN c.muted_by_1 ELSE c.muted_by_2 END AS is_muted,
      c.last_message_at,
      c.created_at
    FROM public.conversations c
    WHERE c.participant_1 = _user_id OR c.participant_2 = _user_id
  ),
  last_msgs AS (
    SELECT DISTINCT ON (m.conversation_id)
      m.conversation_id,
      m.content,
      m.created_at,
      m.sender_id
    FROM public.messages m
    WHERE m.deleted_at IS NULL
    ORDER BY m.conversation_id, m.created_at DESC
  ),
  unread_counts AS (
    SELECT 
      m.conversation_id,
      COUNT(*) AS cnt
    FROM public.messages m
    WHERE m.sender_id <> _user_id
    AND m.read_at IS NULL
    AND m.deleted_at IS NULL
    GROUP BY m.conversation_id
  )
  SELECT 
    cd.id AS conversation_id,
    cd.other_id AS other_user_id,
    p.display_name AS other_user_display_name,
    p.avatar_url AS other_user_avatar_url,
    lm.content AS last_message_content,
    COALESCE(lm.created_at, cd.created_at) AS last_message_at,
    lm.sender_id AS last_message_sender_id,
    COALESCE(uc.cnt, 0) AS unread_count,
    cd.is_muted,
    cd.created_at
  FROM conv_data cd
  LEFT JOIN public.profiles p ON p.id = cd.other_id
  LEFT JOIN last_msgs lm ON lm.conversation_id = cd.id
  LEFT JOIN unread_counts uc ON uc.conversation_id = cd.id
  ORDER BY COALESCE(lm.created_at, cd.created_at) DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_conversations(UUID) TO authenticated;

-- ========== Landing Page CMS Tables ==========
-- These tables store configurable content for the landing page

-- Landing Page Settings: Global settings for the landing page (single row)
create table if not exists public.landing_page_settings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- Hero Section Settings
  hero_badge_text text default 'Your Personal Plant Care Expert',
  hero_title text default 'Grow Your',
  hero_title_highlight text default 'Green Paradise',
  hero_title_end text default 'with Confidence',
  hero_description text default 'Discover, track, and nurture your plants with personalized care reminders, smart identification, and expert tips – all in one beautiful app.',
  hero_cta_primary_text text default 'Download App',
  hero_cta_primary_link text default '/download',
  hero_cta_secondary_text text default 'Try in Browser',
  hero_cta_secondary_link text default '/discovery',
  hero_social_proof_text text default '10,000+ plant lovers',
  
  -- Section Visibility
  show_hero_section boolean default true,
  show_stats_section boolean default true,
  show_beginner_section boolean default true,
  show_features_section boolean default true,
  show_demo_section boolean default true,
  show_how_it_works_section boolean default true,
  show_showcase_section boolean default true,
  show_testimonials_section boolean default true,
  show_faq_section boolean default true,
  show_final_cta_section boolean default true,
  
  -- Social Links
  instagram_url text default 'https://instagram.com/aphylia.app',
  twitter_url text default 'https://twitter.com/aphylia_app',
  support_email text default 'hello@aphylia.app',
  
  -- Final CTA Section
  final_cta_badge text default 'No experience needed',
  final_cta_title text default 'Ready to Start Your Plant Journey?',
  final_cta_subtitle text default 'Whether it''s your first succulent or you''re building a jungle, Aphylia grows with you.',
  final_cta_button_text text default 'Start Growing',
  final_cta_secondary_text text default 'Explore Plants',
  
  -- Beginner Section
  beginner_badge text default 'Perfect for Beginners',
  beginner_title text default 'Know Nothing About Gardening?',
  beginner_title_highlight text default 'That''s Exactly Why We Built This',
  beginner_subtitle text default 'Everyone starts somewhere. Aphylia turns complete beginners into confident plant parents with gentle guidance.',
  
  -- Meta/SEO
  meta_title text default 'Aphylia – Your Personal Plant Care Expert',
  meta_description text default 'Discover, track, and nurture your plants with personalized care reminders, smart identification, and expert tips.'
);

-- Create index for landing_page_settings
create index if not exists idx_landing_page_settings_id on public.landing_page_settings(id);

-- Ensure only one row exists for settings
create or replace function public.ensure_single_landing_page_settings()
returns trigger as $$
begin
  if (select count(*) from public.landing_page_settings) > 0 and TG_OP = 'INSERT' then
    raise exception 'Only one landing_page_settings row allowed';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists ensure_single_landing_page_settings_trigger on public.landing_page_settings;
create trigger ensure_single_landing_page_settings_trigger
  before insert on public.landing_page_settings
  for each row execute function public.ensure_single_landing_page_settings();

-- Hero Cards: Multiple plant cards shown in the hero section
create table if not exists public.landing_hero_cards (
  id uuid primary key default gen_random_uuid(),
  position integer not null default 0,
  plant_name text not null,
  plant_scientific_name text,
  plant_description text,
  image_url text,
  water_frequency text default '2x/week',
  light_level text default 'Bright indirect',
  reminder_text text default 'Water in 2 days',
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Add indexes
create index if not exists idx_landing_hero_cards_position on public.landing_hero_cards(position);
create index if not exists idx_landing_hero_cards_active on public.landing_hero_cards(is_active);

-- Landing Stats: Single row containing all stats displayed on the landing page
create table if not exists public.landing_stats (
  id uuid primary key default gen_random_uuid(),
  plants_count text not null default '10K+',
  plants_label text not null default 'Plant Species',
  users_count text not null default '50K+',
  users_label text not null default 'Happy Gardeners',
  tasks_count text not null default '100K+',
  tasks_label text not null default 'Care Tasks Done',
  rating_value text not null default '4.9',
  rating_label text not null default 'App Store Rating',
  updated_at timestamptz default now()
);

-- Ensure only one row exists for stats
create or replace function public.ensure_single_landing_stats()
returns trigger as $$
begin
  if (select count(*) from public.landing_stats) > 0 and TG_OP = 'INSERT' then
    raise exception 'Only one landing_stats row allowed';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists ensure_single_landing_stats_trigger on public.landing_stats;
create trigger ensure_single_landing_stats_trigger
  before insert on public.landing_stats
  for each row execute function public.ensure_single_landing_stats();

-- Landing Stats Translations: Stores translations for stats labels
create table if not exists public.landing_stats_translations (
  id uuid primary key default gen_random_uuid(),
  stats_id uuid not null references public.landing_stats(id) on delete cascade,
  language text not null,
  plants_label text not null,
  users_label text not null,
  tasks_label text not null,
  rating_label text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(stats_id, language)
);

create index if not exists idx_landing_stats_translations_stats_id on public.landing_stats_translations(stats_id);
create index if not exists idx_landing_stats_translations_language on public.landing_stats_translations(language);

-- Landing Testimonials: Customer reviews/testimonials
create table if not exists public.landing_testimonials (
  id uuid primary key default gen_random_uuid(),
  position integer not null default 0,
  author_name text not null,
  author_role text,
  author_avatar_url text,
  author_website_url text,
  linked_user_id uuid references public.profiles(id) on delete set null,
  quote text not null,
  rating integer not null default 5 check (rating >= 1 and rating <= 5),
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_landing_testimonials_position on public.landing_testimonials(position);
create index if not exists idx_landing_testimonials_active on public.landing_testimonials(is_active);

-- Add new columns to landing_testimonials if they don't exist (for existing tables)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'landing_testimonials' AND column_name = 'author_website_url') THEN
    ALTER TABLE public.landing_testimonials ADD COLUMN author_website_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'landing_testimonials' AND column_name = 'linked_user_id') THEN
    ALTER TABLE public.landing_testimonials ADD COLUMN linked_user_id uuid references public.profiles(id) on delete set null;
  END IF;
END $$;

-- Landing FAQ: Frequently asked questions (base content in English)
create table if not exists public.landing_faq (
  id uuid primary key default gen_random_uuid(),
  position integer not null default 0,
  question text not null,
  answer text not null,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_landing_faq_position on public.landing_faq(position);
create index if not exists idx_landing_faq_active on public.landing_faq(is_active);

-- Landing FAQ Translations: Stores translations for FAQ items
create table if not exists public.landing_faq_translations (
  id uuid primary key default gen_random_uuid(),
  faq_id uuid not null references public.landing_faq(id) on delete cascade,
  language text not null,
  question text not null,
  answer text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(faq_id, language)
);

create index if not exists idx_landing_faq_translations_faq_id on public.landing_faq_translations(faq_id);
create index if not exists idx_landing_faq_translations_language on public.landing_faq_translations(language);

-- Landing Demo Features: Features shown in the interactive demo wheel
create table if not exists public.landing_demo_features (
  id uuid primary key default gen_random_uuid(),
  position integer not null default 0,
  icon_name text not null default 'Leaf',
  label text not null,
  color text not null default 'emerald',
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_landing_demo_features_position on public.landing_demo_features(position);
create index if not exists idx_landing_demo_features_active on public.landing_demo_features(is_active);

-- Landing Demo Feature Translations: Stores translations for demo features
create table if not exists public.landing_demo_feature_translations (
  id uuid primary key default gen_random_uuid(),
  feature_id uuid not null references public.landing_demo_features(id) on delete cascade,
  language text not null,
  label text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(feature_id, language)
);

create index if not exists idx_landing_demo_feature_translations_feature_id on public.landing_demo_feature_translations(feature_id);
create index if not exists idx_landing_demo_feature_translations_language on public.landing_demo_feature_translations(language);

-- Insert default demo features if table is empty
insert into public.landing_demo_features (position, icon_name, label, color)
select * from (values
  (0, 'Leaf', 'Discover Plants', 'emerald'),
  (1, 'Clock', 'Schedule Care', 'blue'),
  (2, 'TrendingUp', 'Track Growth', 'purple'),
  (3, 'Shield', 'Get Alerts', 'rose'),
  (4, 'Camera', 'Identify Plants', 'pink'),
  (5, 'NotebookPen', 'Keep Journal', 'amber'),
  (6, 'Users', 'Join Community', 'teal'),
  (7, 'Sparkles', 'Smart Assistant', 'indigo')
) as v(position, icon_name, label, color)
where not exists (select 1 from public.landing_demo_features limit 1);

-- Landing Showcase Config: Configuration for the landing page showcase section
create table if not exists public.landing_showcase_config (
  id uuid primary key default gen_random_uuid(),
  
  -- Garden Card Settings
  garden_name text not null default 'My Indoor Jungle',
  plants_count integer not null default 12,
  species_count integer not null default 8,
  streak_count integer not null default 7,
  progress_percent integer not null default 85 check (progress_percent >= 0 and progress_percent <= 100),
  cover_image_url text,
  
  -- Tasks (JSONB array of {id, text, completed})
  tasks jsonb not null default '[
    {"id": "1", "text": "Water your Pothos", "completed": true},
    {"id": "2", "text": "Fertilize Monstera", "completed": false},
    {"id": "3", "text": "Mist your Fern", "completed": false}
  ]'::jsonb,
  
  -- Members (JSONB array of {id, name, role, avatar_url, color})
  members jsonb not null default '[
    {"id": "1", "name": "Sophie", "role": "owner", "avatar_url": null, "color": "#10b981"},
    {"id": "2", "name": "Marcus", "role": "member", "avatar_url": null, "color": "#3b82f6"}
  ]'::jsonb,
  
  -- Plant Cards (JSONB array of {id, plant_id, name, image_url, gradient, tasks_due})
  plant_cards jsonb not null default '[
    {"id": "1", "plant_id": null, "name": "Monstera", "image_url": null, "gradient": "from-emerald-400 to-teal-500", "tasks_due": 1},
    {"id": "2", "plant_id": null, "name": "Pothos", "image_url": null, "gradient": "from-lime-400 to-green-500", "tasks_due": 2},
    {"id": "3", "plant_id": null, "name": "Snake Plant", "image_url": null, "gradient": "from-green-400 to-emerald-500", "tasks_due": 0},
    {"id": "4", "plant_id": null, "name": "Fern", "image_url": null, "gradient": "from-teal-400 to-cyan-500", "tasks_due": 0},
    {"id": "5", "plant_id": null, "name": "Peace Lily", "image_url": null, "gradient": "from-emerald-500 to-green-600", "tasks_due": 0},
    {"id": "6", "plant_id": null, "name": "Calathea", "image_url": null, "gradient": "from-green-500 to-teal-600", "tasks_due": 0}
  ]'::jsonb,
  
  -- Analytics Card Settings
  completion_rate integer not null default 92 check (completion_rate >= 0 and completion_rate <= 100),
  analytics_streak integer not null default 14,
  chart_data jsonb not null default '[3, 5, 2, 6, 4, 5, 6]'::jsonb,
  
  -- Calendar (30 days history: array of {date, status})
  calendar_data jsonb not null default '[]'::jsonb,
  
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure only one row exists for showcase config
create or replace function public.ensure_single_landing_showcase_config()
returns trigger as $$
begin
  if (select count(*) from public.landing_showcase_config) > 0 and TG_OP = 'INSERT' then
    raise exception 'Only one landing_showcase_config row allowed';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists ensure_single_landing_showcase_config_trigger on public.landing_showcase_config;
create trigger ensure_single_landing_showcase_config_trigger
  before insert on public.landing_showcase_config
  for each row execute function public.ensure_single_landing_showcase_config();

-- ========== Updated_at Triggers for Landing Page Tables ==========
-- Create a generic updated_at trigger function
create or replace function public.update_landing_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Add updated_at triggers for all landing tables that have the column
drop trigger if exists landing_page_settings_updated_at on public.landing_page_settings;
create trigger landing_page_settings_updated_at
  before update on public.landing_page_settings
  for each row execute function public.update_landing_updated_at();

drop trigger if exists landing_hero_cards_updated_at on public.landing_hero_cards;
create trigger landing_hero_cards_updated_at
  before update on public.landing_hero_cards
  for each row execute function public.update_landing_updated_at();

drop trigger if exists landing_stats_updated_at on public.landing_stats;
create trigger landing_stats_updated_at
  before update on public.landing_stats
  for each row execute function public.update_landing_updated_at();

drop trigger if exists landing_stats_translations_updated_at on public.landing_stats_translations;
create trigger landing_stats_translations_updated_at
  before update on public.landing_stats_translations
  for each row execute function public.update_landing_updated_at();

drop trigger if exists landing_testimonials_updated_at on public.landing_testimonials;
create trigger landing_testimonials_updated_at
  before update on public.landing_testimonials
  for each row execute function public.update_landing_updated_at();

drop trigger if exists landing_faq_updated_at on public.landing_faq;
create trigger landing_faq_updated_at
  before update on public.landing_faq
  for each row execute function public.update_landing_updated_at();

drop trigger if exists landing_faq_translations_updated_at on public.landing_faq_translations;
create trigger landing_faq_translations_updated_at
  before update on public.landing_faq_translations
  for each row execute function public.update_landing_updated_at();

drop trigger if exists landing_demo_features_updated_at on public.landing_demo_features;
create trigger landing_demo_features_updated_at
  before update on public.landing_demo_features
  for each row execute function public.update_landing_updated_at();

drop trigger if exists landing_demo_feature_translations_updated_at on public.landing_demo_feature_translations;
create trigger landing_demo_feature_translations_updated_at
  before update on public.landing_demo_feature_translations
  for each row execute function public.update_landing_updated_at();

drop trigger if exists landing_showcase_config_updated_at on public.landing_showcase_config;
create trigger landing_showcase_config_updated_at
  before update on public.landing_showcase_config
  for each row execute function public.update_landing_updated_at();

-- ========== RLS Policies for Landing Page Tables ==========
-- All landing tables are publicly readable but only admin-writable
-- Using separate policies for INSERT, UPDATE, DELETE with proper WITH CHECK clauses

-- Helper function to check if user is admin (cached for performance)
create or replace function public.is_landing_admin()
returns boolean as $$
begin
  return exists (
    select 1 from public.profiles 
    where id = auth.uid() and is_admin = true
  );
end;
$$ language plpgsql security definer stable;

-- ========== landing_page_settings RLS ==========
alter table public.landing_page_settings enable row level security;

drop policy if exists "Landing page settings are publicly readable" on public.landing_page_settings;
create policy "Landing page settings are publicly readable" 
  on public.landing_page_settings for select using (true);

drop policy if exists "Admins can manage landing page settings" on public.landing_page_settings;
drop policy if exists "Admins can insert landing page settings" on public.landing_page_settings;
create policy "Admins can insert landing page settings" 
  on public.landing_page_settings for insert 
  with check (public.is_landing_admin());

drop policy if exists "Admins can update landing page settings" on public.landing_page_settings;
create policy "Admins can update landing page settings" 
  on public.landing_page_settings for update 
  using (public.is_landing_admin())
  with check (public.is_landing_admin());

drop policy if exists "Admins can delete landing page settings" on public.landing_page_settings;
create policy "Admins can delete landing page settings" 
  on public.landing_page_settings for delete 
  using (public.is_landing_admin());

-- Insert default settings row if not exists
insert into public.landing_page_settings (id)
select gen_random_uuid()
where not exists (select 1 from public.landing_page_settings limit 1);

-- ========== landing_hero_cards RLS ==========
alter table public.landing_hero_cards enable row level security;

drop policy if exists "Landing hero cards are publicly readable" on public.landing_hero_cards;
create policy "Landing hero cards are publicly readable" 
  on public.landing_hero_cards for select using (true);

drop policy if exists "Admins can manage landing hero cards" on public.landing_hero_cards;
drop policy if exists "Admins can insert landing hero cards" on public.landing_hero_cards;
create policy "Admins can insert landing hero cards" 
  on public.landing_hero_cards for insert 
  with check (public.is_landing_admin());

drop policy if exists "Admins can update landing hero cards" on public.landing_hero_cards;
create policy "Admins can update landing hero cards" 
  on public.landing_hero_cards for update 
  using (public.is_landing_admin())
  with check (public.is_landing_admin());

drop policy if exists "Admins can delete landing hero cards" on public.landing_hero_cards;
create policy "Admins can delete landing hero cards" 
  on public.landing_hero_cards for delete 
  using (public.is_landing_admin());

-- ========== landing_stats RLS ==========
alter table public.landing_stats enable row level security;

drop policy if exists "Landing stats are publicly readable" on public.landing_stats;
create policy "Landing stats are publicly readable" 
  on public.landing_stats for select using (true);

drop policy if exists "Admins can manage landing stats" on public.landing_stats;
drop policy if exists "Admins can insert landing stats" on public.landing_stats;
create policy "Admins can insert landing stats" 
  on public.landing_stats for insert 
  with check (public.is_landing_admin());

drop policy if exists "Admins can update landing stats" on public.landing_stats;
create policy "Admins can update landing stats" 
  on public.landing_stats for update 
  using (public.is_landing_admin())
  with check (public.is_landing_admin());

drop policy if exists "Admins can delete landing stats" on public.landing_stats;
create policy "Admins can delete landing stats" 
  on public.landing_stats for delete 
  using (public.is_landing_admin());

-- Insert default stats row if not exists
insert into public.landing_stats (id)
select gen_random_uuid()
where not exists (select 1 from public.landing_stats limit 1);

-- ========== landing_stats_translations RLS ==========
alter table public.landing_stats_translations enable row level security;

drop policy if exists "Landing stats translations are publicly readable" on public.landing_stats_translations;
create policy "Landing stats translations are publicly readable" 
  on public.landing_stats_translations for select using (true);

drop policy if exists "Admins can manage landing stats translations" on public.landing_stats_translations;
drop policy if exists "Admins can insert landing stats translations" on public.landing_stats_translations;
create policy "Admins can insert landing stats translations" 
  on public.landing_stats_translations for insert 
  with check (public.is_landing_admin());

drop policy if exists "Admins can update landing stats translations" on public.landing_stats_translations;
create policy "Admins can update landing stats translations" 
  on public.landing_stats_translations for update 
  using (public.is_landing_admin())
  with check (public.is_landing_admin());

drop policy if exists "Admins can delete landing stats translations" on public.landing_stats_translations;
create policy "Admins can delete landing stats translations" 
  on public.landing_stats_translations for delete 
  using (public.is_landing_admin());

-- ========== landing_testimonials RLS ==========
alter table public.landing_testimonials enable row level security;

drop policy if exists "Landing testimonials are publicly readable" on public.landing_testimonials;
create policy "Landing testimonials are publicly readable" 
  on public.landing_testimonials for select using (true);

drop policy if exists "Admins can manage landing testimonials" on public.landing_testimonials;
drop policy if exists "Admins can insert landing testimonials" on public.landing_testimonials;
create policy "Admins can insert landing testimonials" 
  on public.landing_testimonials for insert 
  with check (public.is_landing_admin());

drop policy if exists "Admins can update landing testimonials" on public.landing_testimonials;
create policy "Admins can update landing testimonials" 
  on public.landing_testimonials for update 
  using (public.is_landing_admin())
  with check (public.is_landing_admin());

drop policy if exists "Admins can delete landing testimonials" on public.landing_testimonials;
create policy "Admins can delete landing testimonials" 
  on public.landing_testimonials for delete 
  using (public.is_landing_admin());

-- ========== landing_faq RLS ==========
alter table public.landing_faq enable row level security;

drop policy if exists "Landing FAQ are publicly readable" on public.landing_faq;
create policy "Landing FAQ are publicly readable" 
  on public.landing_faq for select using (true);

drop policy if exists "Admins can manage landing FAQ" on public.landing_faq;
drop policy if exists "Admins can insert landing FAQ" on public.landing_faq;
create policy "Admins can insert landing FAQ" 
  on public.landing_faq for insert 
  with check (public.is_landing_admin());

drop policy if exists "Admins can update landing FAQ" on public.landing_faq;
create policy "Admins can update landing FAQ" 
  on public.landing_faq for update 
  using (public.is_landing_admin())
  with check (public.is_landing_admin());

drop policy if exists "Admins can delete landing FAQ" on public.landing_faq;
create policy "Admins can delete landing FAQ" 
  on public.landing_faq for delete 
  using (public.is_landing_admin());

-- ========== landing_faq_translations RLS ==========
alter table public.landing_faq_translations enable row level security;

drop policy if exists "Landing FAQ translations are publicly readable" on public.landing_faq_translations;
create policy "Landing FAQ translations are publicly readable" 
  on public.landing_faq_translations for select using (true);

drop policy if exists "Admins can manage landing FAQ translations" on public.landing_faq_translations;
drop policy if exists "Admins can insert landing FAQ translations" on public.landing_faq_translations;
create policy "Admins can insert landing FAQ translations" 
  on public.landing_faq_translations for insert 
  with check (public.is_landing_admin());

drop policy if exists "Admins can update landing FAQ translations" on public.landing_faq_translations;
create policy "Admins can update landing FAQ translations" 
  on public.landing_faq_translations for update 
  using (public.is_landing_admin())
  with check (public.is_landing_admin());

drop policy if exists "Admins can delete landing FAQ translations" on public.landing_faq_translations;
create policy "Admins can delete landing FAQ translations" 
  on public.landing_faq_translations for delete 
  using (public.is_landing_admin());

-- ========== landing_demo_features RLS ==========
alter table public.landing_demo_features enable row level security;

drop policy if exists "Landing demo features are publicly readable" on public.landing_demo_features;
create policy "Landing demo features are publicly readable" 
  on public.landing_demo_features for select using (true);

drop policy if exists "Admins can manage landing demo features" on public.landing_demo_features;
drop policy if exists "Admins can insert landing demo features" on public.landing_demo_features;
create policy "Admins can insert landing demo features" 
  on public.landing_demo_features for insert 
  with check (public.is_landing_admin());

drop policy if exists "Admins can update landing demo features" on public.landing_demo_features;
create policy "Admins can update landing demo features" 
  on public.landing_demo_features for update 
  using (public.is_landing_admin())
  with check (public.is_landing_admin());

drop policy if exists "Admins can delete landing demo features" on public.landing_demo_features;
create policy "Admins can delete landing demo features" 
  on public.landing_demo_features for delete 
  using (public.is_landing_admin());

-- ========== landing_demo_feature_translations RLS ==========
alter table public.landing_demo_feature_translations enable row level security;

drop policy if exists "Landing demo feature translations are publicly readable" on public.landing_demo_feature_translations;
create policy "Landing demo feature translations are publicly readable" 
  on public.landing_demo_feature_translations for select using (true);

drop policy if exists "Admins can manage landing demo feature translations" on public.landing_demo_feature_translations;
drop policy if exists "Admins can insert landing demo feature translations" on public.landing_demo_feature_translations;
create policy "Admins can insert landing demo feature translations" 
  on public.landing_demo_feature_translations for insert 
  with check (public.is_landing_admin());

drop policy if exists "Admins can update landing demo feature translations" on public.landing_demo_feature_translations;
create policy "Admins can update landing demo feature translations" 
  on public.landing_demo_feature_translations for update 
  using (public.is_landing_admin())
  with check (public.is_landing_admin());

drop policy if exists "Admins can delete landing demo feature translations" on public.landing_demo_feature_translations;
create policy "Admins can delete landing demo feature translations" 
  on public.landing_demo_feature_translations for delete 
  using (public.is_landing_admin());

-- ========== landing_showcase_config RLS ==========
alter table public.landing_showcase_config enable row level security;

drop policy if exists "Landing showcase config is publicly readable" on public.landing_showcase_config;
create policy "Landing showcase config is publicly readable" 
  on public.landing_showcase_config for select using (true);

drop policy if exists "Admins can manage landing showcase config" on public.landing_showcase_config;
drop policy if exists "Admins can insert landing showcase config" on public.landing_showcase_config;
create policy "Admins can insert landing showcase config" 
  on public.landing_showcase_config for insert 
  with check (public.is_landing_admin());

drop policy if exists "Admins can update landing showcase config" on public.landing_showcase_config;
create policy "Admins can update landing showcase config" 
  on public.landing_showcase_config for update 
  using (public.is_landing_admin())
  with check (public.is_landing_admin());

drop policy if exists "Admins can delete landing showcase config" on public.landing_showcase_config;
create policy "Admins can delete landing showcase config" 
  on public.landing_showcase_config for delete 
  using (public.is_landing_admin());

-- Insert default showcase config row if not exists
insert into public.landing_showcase_config (id)
select gen_random_uuid()
where not exists (select 1 from public.landing_showcase_config limit 1);

-- =============================================
-- PLANT SCANS TABLE
-- Stores plant identification scans using Kindwise API
-- =============================================

-- ========== Plant Scans Table ==========
-- Use CREATE TABLE IF NOT EXISTS to preserve existing data
CREATE TABLE IF NOT EXISTS public.plant_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Image information
  image_url TEXT NOT NULL,
  image_path TEXT,  -- Storage path if stored in Supabase
  image_bucket TEXT DEFAULT 'PHOTOS',
  
  -- API request/response
  api_access_token TEXT,  -- Kindwise API access token for the request
  api_model_version TEXT,  -- e.g., 'plant_id:3.1.0'
  api_status TEXT DEFAULT 'pending',  -- pending, processing, completed, failed
  api_response JSONB,  -- Full API response stored for reference
  
  -- Identification results
  is_plant BOOLEAN,
  is_plant_probability NUMERIC(5,4),  -- 0.0000 to 1.0000
  
  -- Top match result (denormalized for easy querying)
  top_match_name TEXT,
  top_match_scientific_name TEXT,
  top_match_probability NUMERIC(5,4),
  top_match_entity_id TEXT,
  
  -- All suggestions stored as JSONB array
  suggestions JSONB DEFAULT '[]'::jsonb,
  
  -- Similar images from API
  similar_images JSONB DEFAULT '[]'::jsonb,
  
  -- Location data (optional)
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  
  -- Link to our database plant (if matched)
  matched_plant_id TEXT REFERENCES public.plants(id) ON DELETE SET NULL,
  
  -- User notes
  user_notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ  -- Soft delete
);

-- Add columns if they don't exist (safe migration for existing tables)
ALTER TABLE public.plant_scans ADD COLUMN IF NOT EXISTS image_path TEXT;
ALTER TABLE public.plant_scans ADD COLUMN IF NOT EXISTS image_bucket TEXT DEFAULT 'PHOTOS';
ALTER TABLE public.plant_scans ADD COLUMN IF NOT EXISTS api_access_token TEXT;
ALTER TABLE public.plant_scans ADD COLUMN IF NOT EXISTS api_model_version TEXT;
ALTER TABLE public.plant_scans ADD COLUMN IF NOT EXISTS api_status TEXT DEFAULT 'pending';
ALTER TABLE public.plant_scans ADD COLUMN IF NOT EXISTS api_response JSONB;
ALTER TABLE public.plant_scans ADD COLUMN IF NOT EXISTS is_plant BOOLEAN;
ALTER TABLE public.plant_scans ADD COLUMN IF NOT EXISTS is_plant_probability NUMERIC(5,4);
ALTER TABLE public.plant_scans ADD COLUMN IF NOT EXISTS top_match_name TEXT;
ALTER TABLE public.plant_scans ADD COLUMN IF NOT EXISTS top_match_scientific_name TEXT;
ALTER TABLE public.plant_scans ADD COLUMN IF NOT EXISTS top_match_probability NUMERIC(5,4);
ALTER TABLE public.plant_scans ADD COLUMN IF NOT EXISTS top_match_entity_id TEXT;
ALTER TABLE public.plant_scans ADD COLUMN IF NOT EXISTS suggestions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.plant_scans ADD COLUMN IF NOT EXISTS similar_images JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.plant_scans ADD COLUMN IF NOT EXISTS latitude NUMERIC(9,6);
ALTER TABLE public.plant_scans ADD COLUMN IF NOT EXISTS longitude NUMERIC(9,6);
ALTER TABLE public.plant_scans ADD COLUMN IF NOT EXISTS matched_plant_id TEXT;
ALTER TABLE public.plant_scans ADD COLUMN IF NOT EXISTS user_notes TEXT;
ALTER TABLE public.plant_scans ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.plant_scans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.plant_scans ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add foreign key constraint if it doesn't exist (for matched_plant_id)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'plant_scans_matched_plant_id_fkey' 
    AND table_name = 'plant_scans'
  ) THEN
    ALTER TABLE public.plant_scans 
    ADD CONSTRAINT plant_scans_matched_plant_id_fkey 
    FOREIGN KEY (matched_plant_id) REFERENCES public.plants(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Indexes for plant_scans
CREATE INDEX IF NOT EXISTS idx_plant_scans_user_id ON public.plant_scans(user_id);
CREATE INDEX IF NOT EXISTS idx_plant_scans_created_at ON public.plant_scans(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_plant_scans_top_match ON public.plant_scans(top_match_name);
CREATE INDEX IF NOT EXISTS idx_plant_scans_matched_plant ON public.plant_scans(matched_plant_id);

-- Enable RLS
ALTER TABLE public.plant_scans ENABLE ROW LEVEL SECURITY;

-- Grant access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plant_scans TO authenticated;

-- ========== RLS Policies for Plant Scans ==========
-- Users can only see their own scans
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='plant_scans' AND policyname='plant_scans_select_own') THEN
    DROP POLICY plant_scans_select_own ON public.plant_scans;
  END IF;
  CREATE POLICY plant_scans_select_own ON public.plant_scans FOR SELECT TO authenticated
    USING (auth.uid() = user_id);
END $$;

-- Users can insert their own scans
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='plant_scans' AND policyname='plant_scans_insert_own') THEN
    DROP POLICY plant_scans_insert_own ON public.plant_scans;
  END IF;
  CREATE POLICY plant_scans_insert_own ON public.plant_scans FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);
END $$;

-- Users can update their own scans
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='plant_scans' AND policyname='plant_scans_update_own') THEN
    DROP POLICY plant_scans_update_own ON public.plant_scans;
  END IF;
  CREATE POLICY plant_scans_update_own ON public.plant_scans FOR UPDATE TO authenticated
    USING (auth.uid() = user_id);
END $$;

-- Users can delete their own scans
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='plant_scans' AND policyname='plant_scans_delete_own') THEN
    DROP POLICY plant_scans_delete_own ON public.plant_scans;
  END IF;
  CREATE POLICY plant_scans_delete_own ON public.plant_scans FOR DELETE TO authenticated
    USING (auth.uid() = user_id);
END $$;

-- ========== Storage Bucket for Scan Images ==========
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'plant-scans',
  'plant-scans',
  true,
  10485760,  -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/avif']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for plant-scans bucket
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='plant_scans_upload_own') THEN
    CREATE POLICY plant_scans_upload_own ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'plant-scans' 
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='plant_scans_view_public') THEN
    CREATE POLICY plant_scans_view_public ON storage.objects FOR SELECT TO public
      USING (bucket_id = 'plant-scans');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='plant_scans_delete_own') THEN
    CREATE POLICY plant_scans_delete_own ON storage.objects FOR DELETE TO authenticated
      USING (
        bucket_id = 'plant-scans'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;

-- ========== Trigger for updated_at ==========
CREATE OR REPLACE FUNCTION public.update_plant_scan_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_plant_scan_updated_at ON public.plant_scans;
CREATE TRIGGER trigger_plant_scan_updated_at
  BEFORE UPDATE ON public.plant_scans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_plant_scan_updated_at();

-- Comments for documentation
COMMENT ON TABLE public.plant_scans IS 'Stores plant identification scans from users using Kindwise Plant.id API';
COMMENT ON COLUMN public.plant_scans.api_response IS 'Full JSON response from Kindwise API for reference';
COMMENT ON COLUMN public.plant_scans.suggestions IS 'Array of plant identification suggestions with probabilities';
COMMENT ON COLUMN public.plant_scans.matched_plant_id IS 'Reference to our plants table if a match was found';

-- =============================================
-- BUG CATCHER SYSTEM
-- Tables and functions for bug catcher actions, responses, reports, and points
-- =============================================

-- ========== Bug Actions Table ==========
-- Tasks that bug catchers can complete to earn points
CREATE TABLE IF NOT EXISTS public.bug_actions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text,
    points_reward integer NOT NULL DEFAULT 10,
    status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'planned', 'active', 'closed')),
    release_date timestamptz,  -- When the action becomes available (for planned status)
    questions jsonb DEFAULT '[]',  -- Array of questions: [{id, title, required, type}]
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    completed_count integer DEFAULT 0  -- Cached count of completions
);

CREATE INDEX IF NOT EXISTS idx_bug_actions_status ON public.bug_actions(status);
CREATE INDEX IF NOT EXISTS idx_bug_actions_release_date ON public.bug_actions(release_date) WHERE status = 'planned';

COMMENT ON TABLE public.bug_actions IS 'Tasks/actions that bug catchers can complete to earn points';
COMMENT ON COLUMN public.bug_actions.questions IS 'Array of question objects: [{id: string, title: string, required: boolean, type: "text"|"textarea"|"boolean"}]';

-- ========== Bug Action Responses Table ==========
-- User responses to actions
CREATE TABLE IF NOT EXISTS public.bug_action_responses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    action_id uuid NOT NULL REFERENCES public.bug_actions(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    answers jsonb DEFAULT '{}',  -- {questionId: answer}
    points_earned integer DEFAULT 0,
    completed_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(action_id, user_id)  -- Each user can only complete an action once
);

CREATE INDEX IF NOT EXISTS idx_bug_action_responses_user ON public.bug_action_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_bug_action_responses_action ON public.bug_action_responses(action_id);

COMMENT ON TABLE public.bug_action_responses IS 'User responses to bug catcher actions';

-- ========== Bug Reports Table ==========
-- Bugs reported by bug catchers
CREATE TABLE IF NOT EXISTS public.bug_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    bug_name text NOT NULL,
    description text NOT NULL,
    steps_to_reproduce text,
    screenshots jsonb DEFAULT '[]',  -- Array of image URLs
    user_info jsonb DEFAULT '{}',  -- {username, role, server, device}
    console_logs text,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'closed', 'completed')),
    points_earned integer DEFAULT 0,
    admin_notes text,
    reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    resolved_at timestamptz
);

-- Add foreign key to profiles for Supabase PostgREST joins
-- This enables the profiles:user_id embed syntax in queries
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'bug_reports_user_id_profiles_fkey' 
        AND table_name = 'bug_reports'
    ) THEN
        ALTER TABLE public.bug_reports 
        ADD CONSTRAINT bug_reports_user_id_profiles_fkey 
        FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bug_reports_user ON public.bug_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON public.bug_reports(status);
CREATE INDEX IF NOT EXISTS idx_bug_reports_created ON public.bug_reports(created_at DESC);

COMMENT ON TABLE public.bug_reports IS 'Bug reports submitted by bug catchers';

-- ========== Bug Points History Table ==========
-- Track point transactions
CREATE TABLE IF NOT EXISTS public.bug_points_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    points integer NOT NULL,
    reason text NOT NULL,  -- 'action_completed', 'bug_report_accepted', 'bonus', 'adjustment'
    reference_id uuid,  -- Reference to action_response or bug_report
    reference_type text,  -- 'action' or 'bug_report'
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bug_points_history_user ON public.bug_points_history(user_id);
CREATE INDEX IF NOT EXISTS idx_bug_points_history_created ON public.bug_points_history(created_at DESC);

COMMENT ON TABLE public.bug_points_history IS 'History of all point transactions for bug catchers';

-- ========== Bug Catcher Functions ==========

-- Function to get bug catcher leaderboard (top N)
CREATE OR REPLACE FUNCTION public.get_bug_catcher_leaderboard(_limit integer DEFAULT 10)
RETURNS TABLE(
    rank bigint,
    user_id uuid,
    display_name text,
    avatar_url text,
    bug_points integer,
    actions_completed bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        ROW_NUMBER() OVER (ORDER BY COALESCE(p.bug_points, 0) DESC, p.id) as rank,
        p.id as user_id,
        p.display_name,
        p.avatar_url,
        COALESCE(p.bug_points, 0) as bug_points,
        COUNT(DISTINCT bar.id) as actions_completed
    FROM public.profiles p
    LEFT JOIN public.bug_action_responses bar ON bar.user_id = p.id
    WHERE 'bug_catcher' = ANY(COALESCE(p.roles, '{}'))
    GROUP BY p.id, p.display_name, p.avatar_url, p.bug_points
    ORDER BY COALESCE(p.bug_points, 0) DESC, p.id
    LIMIT _limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_bug_catcher_leaderboard(integer) TO authenticated;

-- Function to get user's bug catcher rank
CREATE OR REPLACE FUNCTION public.get_bug_catcher_rank(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        (SELECT rank::integer FROM (
            SELECT 
                p.id,
                ROW_NUMBER() OVER (ORDER BY COALESCE(p.bug_points, 0) DESC, p.id) as rank
            FROM public.profiles p
            WHERE 'bug_catcher' = ANY(COALESCE(p.roles, '{}'))
        ) ranked WHERE id = _user_id),
        0
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_bug_catcher_rank(uuid) TO authenticated;

-- Function to get available actions for a bug catcher (max N uncompleted)
CREATE OR REPLACE FUNCTION public.get_available_bug_actions(_user_id uuid, _limit integer DEFAULT 5)
RETURNS TABLE(
    id uuid,
    title text,
    description text,
    points_reward integer,
    questions jsonb,
    created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        ba.id,
        ba.title,
        ba.description,
        ba.points_reward,
        ba.questions,
        ba.created_at
    FROM public.bug_actions ba
    WHERE ba.status = 'active'
    AND NOT EXISTS (
        SELECT 1 FROM public.bug_action_responses bar 
        WHERE bar.action_id = ba.id AND bar.user_id = _user_id
    )
    ORDER BY ba.created_at DESC
    LIMIT _limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_available_bug_actions(uuid, integer) TO authenticated;

-- Function to get completed actions for a user
CREATE OR REPLACE FUNCTION public.get_completed_bug_actions(_user_id uuid)
RETURNS TABLE(
    id uuid,
    action_id uuid,
    title text,
    description text,
    points_earned integer,
    answers jsonb,
    completed_at timestamptz,
    action_status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        bar.id,
        bar.action_id,
        ba.title,
        ba.description,
        bar.points_earned,
        bar.answers,
        bar.completed_at,
        ba.status as action_status
    FROM public.bug_action_responses bar
    JOIN public.bug_actions ba ON ba.id = bar.action_id
    WHERE bar.user_id = _user_id
    ORDER BY bar.completed_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_completed_bug_actions(uuid) TO authenticated;

-- Function to submit action response
CREATE OR REPLACE FUNCTION public.submit_bug_action_response(
    _user_id uuid,
    _action_id uuid,
    _answers jsonb
)
RETURNS TABLE(success boolean, points_earned integer, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_action_status text;
    v_points_reward integer;
    v_response_id uuid;
BEGIN
    -- Check if action exists and is active
    SELECT status, points_reward INTO v_action_status, v_points_reward
    FROM public.bug_actions WHERE id = _action_id;
    
    IF v_action_status IS NULL THEN
        RETURN QUERY SELECT false, 0, 'Action not found'::text;
        RETURN;
    END IF;
    
    IF v_action_status != 'active' THEN
        RETURN QUERY SELECT false, 0, 'Action is not active'::text;
        RETURN;
    END IF;
    
    -- Check if user has bug_catcher role
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND 'bug_catcher' = ANY(COALESCE(roles, '{}'))) THEN
        RETURN QUERY SELECT false, 0, 'User is not a bug catcher'::text;
        RETURN;
    END IF;
    
    -- Check if already completed
    IF EXISTS (SELECT 1 FROM public.bug_action_responses WHERE action_id = _action_id AND user_id = _user_id) THEN
        RETURN QUERY SELECT false, 0, 'Action already completed'::text;
        RETURN;
    END IF;
    
    -- Insert response
    INSERT INTO public.bug_action_responses (action_id, user_id, answers, points_earned)
    VALUES (_action_id, _user_id, _answers, v_points_reward)
    RETURNING id INTO v_response_id;
    
    -- Update user's bug points
    UPDATE public.profiles 
    SET bug_points = COALESCE(bug_points, 0) + v_points_reward
    WHERE id = _user_id;
    
    -- Add to points history
    INSERT INTO public.bug_points_history (user_id, points, reason, reference_id, reference_type)
    VALUES (_user_id, v_points_reward, 'action_completed', v_response_id, 'action');
    
    -- Update action completed count
    UPDATE public.bug_actions 
    SET completed_count = COALESCE(completed_count, 0) + 1
    WHERE id = _action_id;
    
    RETURN QUERY SELECT true, v_points_reward, 'Action completed successfully'::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_bug_action_response(uuid, uuid, jsonb) TO authenticated;

-- Function to update an action response (if action not closed)
CREATE OR REPLACE FUNCTION public.update_bug_action_response(
    _user_id uuid,
    _response_id uuid,
    _answers jsonb
)
RETURNS TABLE(success boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_action_status text;
BEGIN
    -- Check if response exists and belongs to user
    SELECT ba.status INTO v_action_status
    FROM public.bug_action_responses bar
    JOIN public.bug_actions ba ON ba.id = bar.action_id
    WHERE bar.id = _response_id AND bar.user_id = _user_id;
    
    IF v_action_status IS NULL THEN
        RETURN QUERY SELECT false, 'Response not found'::text;
        RETURN;
    END IF;
    
    IF v_action_status = 'closed' THEN
        RETURN QUERY SELECT false, 'Cannot update response for closed action'::text;
        RETURN;
    END IF;
    
    -- Update response
    UPDATE public.bug_action_responses 
    SET answers = _answers, updated_at = now()
    WHERE id = _response_id AND user_id = _user_id;
    
    RETURN QUERY SELECT true, 'Response updated successfully'::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_bug_action_response(uuid, uuid, jsonb) TO authenticated;

-- Function to submit a bug report (auto-fills user info from profile)
-- Drop the old version with _user_info parameter to avoid ambiguity
DROP FUNCTION IF EXISTS public.submit_bug_report(uuid, text, text, text, jsonb, jsonb, text);
CREATE OR REPLACE FUNCTION public.submit_bug_report(
    _user_id uuid,
    _bug_name text,
    _description text,
    _steps_to_reproduce text DEFAULT NULL,
    _screenshots jsonb DEFAULT '[]',
    _console_logs text DEFAULT NULL
)
RETURNS TABLE(success boolean, report_id uuid, points_earned integer, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_report_id uuid;
    v_base_points integer := 5;  -- Base points for submitting a bug report
    v_user_info jsonb;
    v_display_name text;
    v_roles text[];
BEGIN
    -- Check if user has bug_catcher role and get profile info
    SELECT display_name, roles INTO v_display_name, v_roles
    FROM public.profiles 
    WHERE id = _user_id AND 'bug_catcher' = ANY(COALESCE(roles, '{}'));
    
    IF v_display_name IS NULL AND v_roles IS NULL THEN
        RETURN QUERY SELECT false, NULL::uuid, 0, 'User is not a bug catcher'::text;
        RETURN;
    END IF;
    
    -- Auto-populate user info from profile
    v_user_info := jsonb_build_object(
        'username', COALESCE(v_display_name, ''),
        'roles', COALESCE(array_to_string(v_roles, ', '), 'bug_catcher'),
        'user_id', _user_id::text
    );
    
    -- Insert bug report
    INSERT INTO public.bug_reports (
        user_id, bug_name, description, steps_to_reproduce, 
        screenshots, user_info, console_logs, points_earned
    )
    VALUES (
        _user_id, _bug_name, _description, _steps_to_reproduce,
        _screenshots, v_user_info, _console_logs, v_base_points
    )
    RETURNING id INTO v_report_id;
    
    -- Award base points for submission
    UPDATE public.profiles 
    SET bug_points = COALESCE(bug_points, 0) + v_base_points
    WHERE id = _user_id;
    
    -- Add to points history
    INSERT INTO public.bug_points_history (user_id, points, reason, reference_id, reference_type)
    VALUES (_user_id, v_base_points, 'bug_report_submitted', v_report_id, 'bug_report');
    
    RETURN QUERY SELECT true, v_report_id, v_base_points, 'Bug report submitted successfully'::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_bug_report(uuid, text, text, text, jsonb, text) TO authenticated;

-- Function for admin to complete a bug report (awards bonus points)
CREATE OR REPLACE FUNCTION public.admin_complete_bug_report(
    _report_id uuid,
    _admin_id uuid,
    _bonus_points integer DEFAULT 15,
    _admin_notes text DEFAULT NULL
)
RETURNS TABLE(success boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_current_status text;
BEGIN
    -- Get report info
    SELECT user_id, status INTO v_user_id, v_current_status
    FROM public.bug_reports WHERE id = _report_id;
    
    IF v_user_id IS NULL THEN
        RETURN QUERY SELECT false, 'Bug report not found'::text;
        RETURN;
    END IF;
    
    IF v_current_status IN ('closed', 'completed') THEN
        RETURN QUERY SELECT false, 'Bug report already resolved'::text;
        RETURN;
    END IF;
    
    -- Update report
    UPDATE public.bug_reports 
    SET status = 'completed',
        points_earned = COALESCE(points_earned, 0) + _bonus_points,
        admin_notes = _admin_notes,
        reviewed_by = _admin_id,
        resolved_at = now(),
        updated_at = now()
    WHERE id = _report_id;
    
    -- Award bonus points to user
    UPDATE public.profiles 
    SET bug_points = COALESCE(bug_points, 0) + _bonus_points
    WHERE id = v_user_id;
    
    -- Add to points history
    INSERT INTO public.bug_points_history (user_id, points, reason, reference_id, reference_type)
    VALUES (v_user_id, _bonus_points, 'bug_report_accepted', _report_id, 'bug_report');
    
    RETURN QUERY SELECT true, 'Bug report completed and bonus points awarded'::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_complete_bug_report(uuid, uuid, integer, text) TO authenticated;

-- Function for admin to close a bug report (duplicate or invalid - no bonus points)
CREATE OR REPLACE FUNCTION public.admin_close_bug_report(
    _report_id uuid,
    _admin_id uuid,
    _admin_notes text DEFAULT NULL
)
RETURNS TABLE(success boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_status text;
BEGIN
    -- Get report status
    SELECT status INTO v_current_status
    FROM public.bug_reports WHERE id = _report_id;
    
    IF v_current_status IS NULL THEN
        RETURN QUERY SELECT false, 'Bug report not found'::text;
        RETURN;
    END IF;
    
    IF v_current_status IN ('closed', 'completed') THEN
        RETURN QUERY SELECT false, 'Bug report already resolved'::text;
        RETURN;
    END IF;
    
    -- Update report
    UPDATE public.bug_reports 
    SET status = 'closed',
        admin_notes = _admin_notes,
        reviewed_by = _admin_id,
        resolved_at = now(),
        updated_at = now()
    WHERE id = _report_id;
    
    RETURN QUERY SELECT true, 'Bug report closed'::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_close_bug_report(uuid, uuid, text) TO authenticated;

-- Function to get bug catcher stats for admin
CREATE OR REPLACE FUNCTION public.get_bug_catcher_stats()
RETURNS TABLE(
    total_bug_catchers bigint,
    total_actions bigint,
    active_actions bigint,
    total_responses bigint,
    pending_bug_reports bigint,
    total_points_awarded bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        (SELECT COUNT(*) FROM public.profiles WHERE 'bug_catcher' = ANY(COALESCE(roles, '{}'))) as total_bug_catchers,
        (SELECT COUNT(*) FROM public.bug_actions) as total_actions,
        (SELECT COUNT(*) FROM public.bug_actions WHERE status = 'active') as active_actions,
        (SELECT COUNT(*) FROM public.bug_action_responses) as total_responses,
        (SELECT COUNT(*) FROM public.bug_reports WHERE status = 'pending') as pending_bug_reports,
        (SELECT COALESCE(SUM(bug_points), 0) FROM public.profiles WHERE 'bug_catcher' = ANY(COALESCE(roles, '{}'))) as total_points_awarded;
$$;

GRANT EXECUTE ON FUNCTION public.get_bug_catcher_stats() TO authenticated;

-- Function to get user bug reports
CREATE OR REPLACE FUNCTION public.get_user_bug_reports(_user_id uuid)
RETURNS TABLE(
    id uuid,
    bug_name text,
    description text,
    status text,
    points_earned integer,
    created_at timestamptz,
    resolved_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        br.id,
        br.bug_name,
        br.description,
        br.status,
        br.points_earned,
        br.created_at,
        br.resolved_at
    FROM public.bug_reports br
    WHERE br.user_id = _user_id
    ORDER BY br.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_bug_reports(uuid) TO authenticated;

-- ========== Bug Catcher RLS Policies ==========

-- Enable RLS on all bug catcher tables
ALTER TABLE public.bug_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bug_action_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bug_points_history ENABLE ROW LEVEL SECURITY;

-- Bug Actions policies
-- Uses is_admin_user() SECURITY DEFINER function to bypass profiles RLS
-- Note: Using (select auth.uid()) pattern for consistent RLS evaluation
DROP POLICY IF EXISTS "Bug catchers can view active actions" ON public.bug_actions;
CREATE POLICY "Bug catchers can view active actions" ON public.bug_actions
    FOR SELECT
    TO authenticated
    USING (status = 'active' OR public.is_admin_user((select auth.uid())));

DROP POLICY IF EXISTS "Admins can manage all actions" ON public.bug_actions;
CREATE POLICY "Admins can manage all actions" ON public.bug_actions
    FOR ALL
    TO authenticated
    USING (public.is_admin_user((select auth.uid())))
    WITH CHECK (public.is_admin_user((select auth.uid())));

-- Bug Action Responses policies
-- Uses is_admin_user() SECURITY DEFINER function to bypass profiles RLS
-- Note: Using (select auth.uid()) pattern for consistent RLS evaluation
DROP POLICY IF EXISTS "Users can view own responses" ON public.bug_action_responses;
CREATE POLICY "Users can view own responses" ON public.bug_action_responses
    FOR SELECT
    TO authenticated
    USING (user_id = (select auth.uid()) OR public.is_admin_user((select auth.uid())));

DROP POLICY IF EXISTS "Users can insert own responses" ON public.bug_action_responses;
CREATE POLICY "Users can insert own responses" ON public.bug_action_responses
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own responses" ON public.bug_action_responses;
CREATE POLICY "Users can update own responses" ON public.bug_action_responses
    FOR UPDATE
    TO authenticated
    USING (user_id = (select auth.uid()))
    WITH CHECK (user_id = (select auth.uid()));

-- Bug Reports policies
-- Allow users to view their own reports, admins can view all
-- Uses is_admin_user() SECURITY DEFINER function to bypass profiles RLS
-- Note: Using (select auth.uid()) pattern for consistent RLS evaluation
DROP POLICY IF EXISTS "Users can view own reports" ON public.bug_reports;
CREATE POLICY "Users can view own reports" ON public.bug_reports
    FOR SELECT
    TO authenticated
    USING (
        user_id = (select auth.uid()) 
        OR public.is_admin_user((select auth.uid()))
    );

DROP POLICY IF EXISTS "Users can insert own reports" ON public.bug_reports;
CREATE POLICY "Users can insert own reports" ON public.bug_reports
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = (select auth.uid()));

-- Allow admins to update any report (for reviewing, completing, closing)
-- Uses is_admin_user() SECURITY DEFINER function to bypass profiles RLS
DROP POLICY IF EXISTS "Admins can update reports" ON public.bug_reports;
CREATE POLICY "Admins can update reports" ON public.bug_reports
    FOR UPDATE
    TO authenticated
    USING (public.is_admin_user((select auth.uid())))
    WITH CHECK (public.is_admin_user((select auth.uid())));

-- Bug Points History policies
-- Uses is_admin_user() SECURITY DEFINER function to bypass profiles RLS
-- Note: Using (select auth.uid()) pattern for consistent RLS evaluation
DROP POLICY IF EXISTS "Users can view own points history" ON public.bug_points_history;
CREATE POLICY "Users can view own points history" ON public.bug_points_history
    FOR SELECT
    TO authenticated
    USING (
        user_id = (select auth.uid()) 
        OR public.is_admin_user((select auth.uid()))
    );

DROP POLICY IF EXISTS "System can insert points history" ON public.bug_points_history;
CREATE POLICY "System can insert points history" ON public.bug_points_history
    FOR INSERT
    TO authenticated
    WITH CHECK (true);  -- Controlled by functions

-- Grant authenticated users access to tables (needed for RLS to work)
GRANT SELECT ON public.bug_actions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.bug_action_responses TO authenticated;
GRANT SELECT, INSERT ON public.bug_reports TO authenticated;
GRANT SELECT, INSERT ON public.bug_points_history TO authenticated;

-- Admins need full access
GRANT ALL ON public.bug_actions TO authenticated;
GRANT ALL ON public.bug_reports TO authenticated;

-- =============================================================================
-- RATE LIMITING TRIGGERS AND INDEXES
-- =============================================================================

-- Plant Request Rate Limiting
CREATE OR REPLACE FUNCTION public.check_plant_request_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request_count INTEGER;
  v_rate_limit INTEGER := 10; -- Max plant requests per hour
  v_window_interval INTERVAL := '1 hour';
BEGIN
  -- Count requests by this user in the last hour
  SELECT COUNT(*)::INTEGER INTO v_request_count
  FROM public.plant_request_users
  WHERE user_id = NEW.user_id
    AND created_at > NOW() - v_window_interval;
  
  IF v_request_count >= v_rate_limit THEN
    RAISE EXCEPTION 'Rate limit exceeded. Please wait before requesting more plants.';
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS plant_request_rate_limit_trigger ON public.plant_request_users;
CREATE TRIGGER plant_request_rate_limit_trigger
  BEFORE INSERT ON public.plant_request_users
  FOR EACH ROW
  EXECUTE FUNCTION public.check_plant_request_rate_limit();

-- Friend Request Rate Limiting
CREATE OR REPLACE FUNCTION public.check_friend_request_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request_count INTEGER;
  v_rate_limit INTEGER := 50; -- Max friend requests per hour
  v_window_interval INTERVAL := '1 hour';
BEGIN
  -- Only check for new pending requests (not status updates)
  IF NEW.status = 'pending' THEN
    -- Count pending friend requests sent by this user in the last hour
    SELECT COUNT(*)::INTEGER INTO v_request_count
    FROM public.friends
    WHERE user_id = NEW.user_id
      AND status = 'pending'
      AND created_at > NOW() - v_window_interval;
    
    IF v_request_count >= v_rate_limit THEN
      RAISE EXCEPTION 'Rate limit exceeded. Please wait before sending more friend requests.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS friend_request_rate_limit_trigger ON public.friends;
CREATE TRIGGER friend_request_rate_limit_trigger
  BEFORE INSERT ON public.friends
  FOR EACH ROW
  EXECUTE FUNCTION public.check_friend_request_rate_limit();

-- Reaction Rate Limiting
CREATE OR REPLACE FUNCTION public.check_reaction_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reaction_count INTEGER;
  v_rate_limit INTEGER := 500; -- Max reactions per hour
  v_window_interval INTERVAL := '1 hour';
BEGIN
  -- Count reactions added by this user in the last hour
  SELECT COUNT(*)::INTEGER INTO v_reaction_count
  FROM public.message_reactions
  WHERE user_id = NEW.user_id
    AND created_at > NOW() - v_window_interval;
  
  IF v_reaction_count >= v_rate_limit THEN
    RAISE EXCEPTION 'Rate limit exceeded. Please wait before adding more reactions.';
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reaction_rate_limit_trigger ON public.message_reactions;
CREATE TRIGGER reaction_rate_limit_trigger
  BEFORE INSERT ON public.message_reactions
  FOR EACH ROW
  EXECUTE FUNCTION public.check_reaction_rate_limit();

-- Rate Limiting Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_messages_sender_created 
  ON public.messages(sender_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_plant_request_users_user_created
  ON public.plant_request_users(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_participant1_created
  ON public.conversations(participant_1, created_at DESC);

-- Note: friends table doesn't have a status column (it only contains accepted friendships)
-- The status column is on friend_requests table, not friends
CREATE INDEX IF NOT EXISTS idx_friends_user_created
  ON public.friends(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_message_reactions_user_created
  ON public.message_reactions(user_id, created_at DESC);


-- ========== GDPR COMPLIANCE ==========
-- Added for GDPR compliance requirements including consent tracking and audit logging

-- Add consent tracking columns to profiles
ALTER TABLE IF EXISTS public.profiles
ADD COLUMN IF NOT EXISTS marketing_consent boolean DEFAULT false;

ALTER TABLE IF EXISTS public.profiles
ADD COLUMN IF NOT EXISTS marketing_consent_date timestamptz;

ALTER TABLE IF EXISTS public.profiles
ADD COLUMN IF NOT EXISTS terms_accepted_date timestamptz;

ALTER TABLE IF EXISTS public.profiles
ADD COLUMN IF NOT EXISTS privacy_policy_accepted_date timestamptz;

-- Track which version of legal documents user accepted
ALTER TABLE IF EXISTS public.profiles
ADD COLUMN IF NOT EXISTS terms_version_accepted text DEFAULT '1.0.0';

ALTER TABLE IF EXISTS public.profiles
ADD COLUMN IF NOT EXISTS privacy_version_accepted text DEFAULT '1.0.0';

-- User Setup/Onboarding Preferences
-- Stores user preferences from the initial setup wizard after signup
ALTER TABLE IF EXISTS public.profiles
ADD COLUMN IF NOT EXISTS setup_completed boolean DEFAULT false;

ALTER TABLE IF EXISTS public.profiles
ADD COLUMN IF NOT EXISTS garden_type text CHECK (garden_type IS NULL OR garden_type IN ('inside', 'outside', 'both'));

ALTER TABLE IF EXISTS public.profiles
ADD COLUMN IF NOT EXISTS experience_level text CHECK (experience_level IS NULL OR experience_level IN ('novice', 'intermediate', 'expert'));

ALTER TABLE IF EXISTS public.profiles
ADD COLUMN IF NOT EXISTS looking_for text CHECK (looking_for IS NULL OR looking_for IN ('eat', 'ornamental', 'various'));

ALTER TABLE IF EXISTS public.profiles
ADD COLUMN IF NOT EXISTS notification_time text DEFAULT '10h' CHECK (notification_time IS NULL OR notification_time IN ('6h', '10h', '14h', '17h'));

-- Create index for quick lookups on setup_completed
CREATE INDEX IF NOT EXISTS idx_profiles_setup_completed ON public.profiles(setup_completed);

COMMENT ON COLUMN public.profiles.setup_completed IS 'Whether the user has completed the initial setup wizard';
COMMENT ON COLUMN public.profiles.garden_type IS 'Garden location preference: inside, outside, or both';
COMMENT ON COLUMN public.profiles.experience_level IS 'User gardening experience: novice, intermediate, or expert';
COMMENT ON COLUMN public.profiles.looking_for IS 'User gardening goal: eat (vegetables/fruits), ornamental (flowers), or various (diverse plants)';
COMMENT ON COLUMN public.profiles.notification_time IS 'Preferred notification time: 6h, 10h, 14h, or 17h';

-- Email Verification
-- Add email_verified column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_profiles_email_verified ON public.profiles(email_verified);
COMMENT ON COLUMN public.profiles.email_verified IS 'Whether the user has verified their email address via OTP code';

-- Email verification codes table for OTP-based email verification
CREATE TABLE IF NOT EXISTS public.email_verification_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code VARCHAR(8) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ DEFAULT NULL,
  CONSTRAINT unique_active_code_per_user UNIQUE (user_id, code)
);

CREATE INDEX IF NOT EXISTS idx_verification_codes_expires_at ON public.email_verification_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_verification_codes_user_id ON public.email_verification_codes(user_id);

COMMENT ON TABLE public.email_verification_codes IS 'Stores temporary verification codes for email verification. Codes expire after 5 minutes.';
COMMENT ON COLUMN public.email_verification_codes.user_id IS 'The user who requested the verification code';
COMMENT ON COLUMN public.email_verification_codes.code IS 'The 6-character alphanumeric verification code';
COMMENT ON COLUMN public.email_verification_codes.created_at IS 'When the code was generated';
COMMENT ON COLUMN public.email_verification_codes.expires_at IS 'When the code expires (5 minutes after creation)';
COMMENT ON COLUMN public.email_verification_codes.used_at IS 'When the code was successfully used (null if not used yet)';

-- Function to clean up expired verification codes (to be called by daily job)
CREATE OR REPLACE FUNCTION cleanup_expired_verification_codes()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.email_verification_codes
  WHERE expires_at < NOW()
  OR used_at IS NOT NULL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_verification_codes() IS 'Removes expired or already-used verification codes. Should be called periodically by a daily cleanup job.';

-- Enable RLS on the verification codes table
ALTER TABLE public.email_verification_codes ENABLE ROW LEVEL SECURITY;

-- RLS policy: Users can only see their own verification codes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_verification_codes' AND policyname = 'Users can view their own verification codes') THEN
    CREATE POLICY "Users can view their own verification codes"
      ON public.email_verification_codes
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- GDPR Audit Log Table
CREATE TABLE IF NOT EXISTS public.gdpr_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.gdpr_audit_log IS 'GDPR compliance audit log tracking data access, exports, and deletions';
COMMENT ON COLUMN public.gdpr_audit_log.action IS 'Type of GDPR action: DATA_EXPORT, ACCOUNT_DELETION, CONSENT_UPDATE, DATA_ACCESS';

CREATE INDEX IF NOT EXISTS gdpr_audit_log_user_id_idx ON public.gdpr_audit_log(user_id);
CREATE INDEX IF NOT EXISTS gdpr_audit_log_action_idx ON public.gdpr_audit_log(action);
CREATE INDEX IF NOT EXISTS gdpr_audit_log_created_at_idx ON public.gdpr_audit_log(created_at DESC);

ALTER TABLE public.gdpr_audit_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='gdpr_audit_log' AND policyname='gdpr_audit_log_admin_select') THEN
    DROP POLICY gdpr_audit_log_admin_select ON public.gdpr_audit_log;
  END IF;
  CREATE POLICY gdpr_audit_log_admin_select ON public.gdpr_audit_log FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.is_admin = true));
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='gdpr_audit_log' AND policyname='gdpr_audit_log_insert_all') THEN
    DROP POLICY gdpr_audit_log_insert_all ON public.gdpr_audit_log;
  END IF;
  CREATE POLICY gdpr_audit_log_insert_all ON public.gdpr_audit_log FOR INSERT TO public
    WITH CHECK (true);
END $$;

GRANT SELECT ON public.gdpr_audit_log TO authenticated;
GRANT INSERT ON public.gdpr_audit_log TO authenticated;

-- Cookie Consent Tracking Table (optional server-side tracking)
CREATE TABLE IF NOT EXISTS public.user_cookie_consent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id text,
  consent_level text NOT NULL CHECK (consent_level IN ('essential', 'analytics', 'all', 'rejected')),
  consent_version text DEFAULT '1.0',
  consented_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  ip_address inet,
  user_agent text
);

CREATE INDEX IF NOT EXISTS user_cookie_consent_user_idx ON public.user_cookie_consent(user_id);
CREATE INDEX IF NOT EXISTS user_cookie_consent_session_idx ON public.user_cookie_consent(session_id);

ALTER TABLE public.user_cookie_consent ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_cookie_consent' AND policyname='cookie_consent_own') THEN
    DROP POLICY cookie_consent_own ON public.user_cookie_consent;
  END IF;
  CREATE POLICY cookie_consent_own ON public.user_cookie_consent FOR ALL TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_cookie_consent' AND policyname='cookie_consent_insert_anon') THEN
    DROP POLICY cookie_consent_insert_anon ON public.user_cookie_consent;
  END IF;
  CREATE POLICY cookie_consent_insert_anon ON public.user_cookie_consent FOR INSERT TO public
    WITH CHECK (true);
END $$;

GRANT SELECT, INSERT, UPDATE ON public.user_cookie_consent TO authenticated;
GRANT INSERT ON public.user_cookie_consent TO anon;

-- ========== Granular Communication Preferences ==========
-- Email notification preferences
ALTER TABLE IF EXISTS public.profiles
ADD COLUMN IF NOT EXISTS email_product_updates boolean DEFAULT true;

ALTER TABLE IF EXISTS public.profiles
ADD COLUMN IF NOT EXISTS email_tips_advice boolean DEFAULT true;

ALTER TABLE IF EXISTS public.profiles
ADD COLUMN IF NOT EXISTS email_community_highlights boolean DEFAULT true;

ALTER TABLE IF EXISTS public.profiles
ADD COLUMN IF NOT EXISTS email_promotions boolean DEFAULT false;

-- Push notification preferences
ALTER TABLE IF EXISTS public.profiles
ADD COLUMN IF NOT EXISTS push_task_reminders boolean DEFAULT true;

ALTER TABLE IF EXISTS public.profiles
ADD COLUMN IF NOT EXISTS push_friend_activity boolean DEFAULT true;

ALTER TABLE IF EXISTS public.profiles
ADD COLUMN IF NOT EXISTS push_messages boolean DEFAULT true;

ALTER TABLE IF EXISTS public.profiles
ADD COLUMN IF NOT EXISTS push_garden_updates boolean DEFAULT true;

-- Personalization preferences
ALTER TABLE IF EXISTS public.profiles
ADD COLUMN IF NOT EXISTS personalized_recommendations boolean DEFAULT true;

ALTER TABLE IF EXISTS public.profiles
ADD COLUMN IF NOT EXISTS analytics_improvement boolean DEFAULT true;
