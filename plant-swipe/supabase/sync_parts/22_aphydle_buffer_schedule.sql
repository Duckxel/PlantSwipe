-- ========== Aphydle Buffer scheduler (singleton config) ==========
-- Singleton config row consumed by the recurring "Aphydle automation"
-- runner in plant-swipe/server.js. The runner uses the Supabase service
-- role (bypasses RLS), so this table is admin-read / admin-write only
-- from authenticated clients; no anon access.
--
-- The id column is intentionally `text` so the upsert path can pin the
-- row to a known constant ('default') instead of generating UUIDs the
-- runner would have to discover before reading. There is exactly one
-- row in production.
--
-- Mirrors the runtime table-creation block in server.js'
-- ensureAphydleScheduleTable(); kept idempotent so applying the
-- migration on a database that already has the table is a no-op.

create table if not exists public.aphydle_buffer_schedule (
  id text primary key,
  enabled boolean not null default false,
  days_of_week text[] not null default '{}',
  publish_time_local text not null default '13:00',
  run_time_local text not null default '04:00',
  -- IANA timezone snapshot taken when the row was last saved. The runner
  -- uses its OWN process timezone at runtime; this column is for audit /
  -- display only ("which box's clock did the operator save against?").
  timezone text not null default 'UTC',
  organization_id text,
  channel_ids text[] not null default '{}',
  last_run_at timestamptz,
  last_run_for_date date,
  last_run_status text,
  last_run_results jsonb,
  updated_at timestamptz not null default now()
);

alter table public.aphydle_buffer_schedule enable row level security;

-- Admins read + write. Service-role traffic from server.js bypasses RLS
-- entirely, so this policy only matters when an authenticated admin user
-- pokes the row directly via PostgREST (ad-hoc admin tooling).
do $$ begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'aphydle_buffer_schedule'
      and policyname = 'aphydle_buffer_schedule_admin_all'
  ) then
    drop policy aphydle_buffer_schedule_admin_all on public.aphydle_buffer_schedule;
  end if;
  create policy aphydle_buffer_schedule_admin_all on public.aphydle_buffer_schedule
    for all to authenticated
    using (public.is_admin_user((select auth.uid())))
    with check (public.is_admin_user((select auth.uid())));
end $$;

-- Make sure the anon role can't see or touch it. RLS already blocks all
-- access since we only define one policy gated by is_admin_user, but
-- revoking the privileges as well removes any chance of a later schema-
-- level grant flipping things accidentally.
revoke all on public.aphydle_buffer_schedule from anon;
revoke insert, update, delete on public.aphydle_buffer_schedule from authenticated;
grant select on public.aphydle_buffer_schedule to authenticated;
