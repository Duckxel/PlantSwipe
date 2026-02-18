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
returns void language plpgsql set search_path = public as $$
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
alter table public.admin_email_campaigns add column if not exists target_roles text[] default '{}'; -- Empty array = all users, non-empty = only users with ANY of these roles

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
  ('BAN_USER', 'User Ban Notification', 'Sent when a user is marked as threat level 3 (ban)', true)
on conflict (trigger_type) do update set is_enabled = true where admin_email_triggers.trigger_type = 'BAN_USER';

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
) returns boolean language plpgsql set search_path = public as $$
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
  -- Users can send friend requests only from themselves, and CANNOT target shadow-banned users (threat_level = 3)
  -- Also prevent shadow-banned users from sending friend requests themselves
  create policy friend_requests_insert_own on public.friend_requests for insert to authenticated
    with check (
      requester_id = (select auth.uid())
      and not exists (
        select 1 from public.profiles p
        where p.id = recipient_id and coalesce(p.threat_level, 0) >= 3
      )
      and not exists (
        select 1 from public.profiles p
        where p.id = requester_id and coalesce(p.threat_level, 0) >= 3
      )
    );
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
-- Prevents accepting requests involving shadow-banned users (threat_level = 3)
create or replace function public.accept_friend_request(_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requester uuid;
  v_recipient uuid;
  v_requester_threat integer;
  v_recipient_threat integer;
begin
  -- Get request details
  select requester_id, recipient_id into v_requester, v_recipient
  from public.friend_requests
  where id = _request_id and status = 'pending' and recipient_id = (select auth.uid());
  
  if v_requester is null or v_recipient is null then
    raise exception 'Friend request not found or not authorized';
  end if;

  -- Check if either user is shadow-banned
  select coalesce(threat_level, 0) into v_requester_threat from public.profiles where id = v_requester;
  select coalesce(threat_level, 0) into v_recipient_threat from public.profiles where id = v_recipient;
  if v_requester_threat >= 3 or v_recipient_threat >= 3 then
    -- Silently reject - delete the request instead of accepting
    delete from public.friend_requests where id = _request_id;
    return;
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
  -- Cannot invite shadow-banned users (threat_level >= 3), and shadow-banned users cannot send invites
  create policy garden_invites_insert_own on public.garden_invites for insert to authenticated
    with check (
      inviter_id = (select auth.uid())
      and exists (
        select 1 from public.garden_members gm
        where gm.garden_id = garden_invites.garden_id
        and gm.user_id = (select auth.uid())
      )
      and not exists (
        select 1 from public.profiles p
        where p.id = invitee_id and coalesce(p.threat_level, 0) >= 3
      )
      and not exists (
        select 1 from public.profiles p
        where p.id = inviter_id and coalesce(p.threat_level, 0) >= 3
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
-- Shadow-banned users (threat_level >= 3) are excluded from results UNLESS the viewer is an admin.
-- Returns is_banned flag so the frontend can display a distinct icon for banned users.
drop function if exists public.search_user_profiles(text, integer);
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
  can_view boolean,
  is_banned boolean
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
    viewer_admin as (
      select exists (
        select 1 from public.profiles p
        where p.id = (select viewer_id from viewer)
          and (p.is_admin = true or 'admin' = any(coalesce(p.roles, '{}')))
      ) as is_admin
    ),
    base as (
      select
        p.id,
        p.display_name,
        p.username,
        p.country,
        p.avatar_url,
        coalesce(p.is_private, false) as is_private,
        coalesce(p.threat_level, 0) >= 3 as is_banned,
        u.created_at,
        params.term,
        params.limit_value,
        v.viewer_id
      from public.profiles p
      left join auth.users u on u.id = p.id
      cross join params
      cross join viewer v
      where v.viewer_id is not null
        -- Exclude shadow-banned users from search results UNLESS viewer is admin
        and (
          coalesce(p.threat_level, 0) < 3
          or (select is_admin from viewer_admin)
        )
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
    m.can_view,
    m.is_banned
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

