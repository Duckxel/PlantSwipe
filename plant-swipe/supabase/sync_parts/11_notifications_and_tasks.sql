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
  trigger_type text not null unique check (trigger_type in ('weekly_inactive_reminder', 'daily_task_reminder', 'journal_continue_reminder', 'plant_request_fulfilled')),
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

-- Update trigger_type CHECK constraint to include plant_request_fulfilled (for existing tables)
-- This MUST run BEFORE the seed block so that new trigger types can be inserted
do $$
begin
  -- Drop old constraint that may not include plant_request_fulfilled
  if exists (
    select 1 from pg_constraint
    where conname = 'notification_automations_trigger_type_check'
    and conrelid = 'public.notification_automations'::regclass
  ) then
    alter table public.notification_automations drop constraint notification_automations_trigger_type_check;
  end if;
  
  -- Add updated constraint with all valid trigger types
  alter table public.notification_automations
    add constraint notification_automations_trigger_type_check
    check (trigger_type in ('weekly_inactive_reminder', 'daily_task_reminder', 'journal_continue_reminder', 'plant_request_fulfilled'));
exception when others then
  null; -- Constraint might already be correct or table structure differs
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

  -- Plant Request Fulfilled (event-driven, not cron-based)
  insert into public.notification_automations (trigger_type, display_name, description, send_hour)
  values ('plant_request_fulfilled', 'Plant Request Fulfilled', 'Notifies users when a plant they requested has been added to the encyclopedia (triggered automatically after AI prefill or manual plant creation)', 9)
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
    -- UNIQUE index for deduplicating automation notifications per user per day.
    -- This is required by the ON CONFLICT clause in processDueAutomations() (server.js).
    -- Without this index, every INSERT fails with "no unique or exclusion constraint
    -- matching the ON CONFLICT specification" and NO automation notifications are ever delivered.
    if not exists (select 1 from pg_indexes where indexname = 'user_notifications_automation_unique_daily') then
      create unique index user_notifications_automation_unique_daily
        on public.user_notifications (automation_id, user_id, (scheduled_for::date))
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

