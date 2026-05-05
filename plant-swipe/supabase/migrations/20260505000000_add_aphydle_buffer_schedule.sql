-- Singleton config row for the Aphydle Buffer scheduler. The runner in
-- plant-swipe/server.js (cron.schedule('* * * * *', ...)) reads this row
-- once per minute on the box where VITE_SERVER_NAME=MAIN, fetches today's
-- Aphydle puzzle, hosts the cards in Supabase storage, and queues per-
-- channel Buffer posts due at the configured publish time.
--
-- Mirrors ensureAphydleScheduleTable() in server.js; idempotent so the
-- runner re-creating the table is a no-op against a database that has
-- already had this migration applied.

create table if not exists public.aphydle_buffer_schedule (
  id text primary key,
  enabled boolean not null default false,
  days_of_week text[] not null default '{}',
  publish_time_local text not null default '13:00',
  run_time_local text not null default '04:00',
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

revoke all on public.aphydle_buffer_schedule from anon;
revoke insert, update, delete on public.aphydle_buffer_schedule from authenticated;
grant select on public.aphydle_buffer_schedule to authenticated;
