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
SET search_path = public
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
$$ language plpgsql security definer set search_path = public;

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

-- ========== Page Impressions Tracking ==========
-- Tracks page view counts (impressions) for plants and blog posts.
-- Only admins can read the counts; the server increments via service role.

CREATE TABLE IF NOT EXISTS public.impressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('plant', 'blog')),
  entity_id text NOT NULL,
  count bigint NOT NULL DEFAULT 0,
  last_viewed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS impressions_entity_idx ON public.impressions (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS impressions_count_idx ON public.impressions (entity_type, count DESC);

COMMENT ON TABLE public.impressions IS 'Tracks page view impressions for plant info pages and blog posts. Admin-only read access.';
COMMENT ON COLUMN public.impressions.entity_type IS 'Type of entity: plant or blog';
COMMENT ON COLUMN public.impressions.entity_id IS 'ID of the plant or blog post';
COMMENT ON COLUMN public.impressions.count IS 'Number of page views';

ALTER TABLE public.impressions ENABLE ROW LEVEL SECURITY;

-- Only admins can SELECT impression data
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='impressions' AND policyname='impressions_admin_select') THEN
    DROP POLICY impressions_admin_select ON public.impressions;
  END IF;
  CREATE POLICY impressions_admin_select ON public.impressions FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.is_admin = true));
END $$;

-- Only admins can manage impressions (insert/update handled by server via service role)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='impressions' AND policyname='impressions_admin_write') THEN
    DROP POLICY impressions_admin_write ON public.impressions;
  END IF;
  CREATE POLICY impressions_admin_write ON public.impressions FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.is_admin = true))
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.is_admin = true));
END $$;

-- Function to atomically increment impression count (used by server via service role)
CREATE OR REPLACE FUNCTION public.increment_impression(
  _entity_type text,
  _entity_id text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count bigint;
BEGIN
  INSERT INTO public.impressions (entity_type, entity_id, count, last_viewed_at)
  VALUES (_entity_type, _entity_id, 1, now())
  ON CONFLICT (entity_type, entity_id)
  DO UPDATE SET
    count = impressions.count + 1,
    last_viewed_at = now()
  RETURNING count INTO v_count;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_impression(text, text) TO authenticated;

-- ========== Messaging System ==========
-- This adds a complete messaging system with:
-- - Conversations (1:1 between friends)
-- - Messages with text content and optional link sharing
