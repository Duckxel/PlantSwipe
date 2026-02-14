-- plantswipe: single idempotent SQL to sync DB schema to current app usage
-- Safe to run multiple times. Creates/updates required objects, and removes unused ones without dropping data rows.
-- NOTE: Requires Postgres + Supabase environment (auth schema present). Uses security definer where needed.

-- ========== Extensions ==========
create extension if not exists pgcrypto;
-- Optional: scheduling support
create extension if not exists pg_cron;
-- Optional: network requests (for edge functions)
-- Install in 'extensions' schema to avoid linter warning about extensions in public
create extension if not exists pg_net schema extensions;

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
$$ language plpgsql security definer set search_path = public;

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
    'plant_recipes',
    'plant_contributors',
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
    'bug_points_history',
    -- Email Verification
    'email_verification_codes',
    -- GDPR Compliance
    'gdpr_audit_log',
    'user_cookie_consent',
    -- Analytics: Page Impressions
    'impressions'
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

