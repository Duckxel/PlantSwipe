-- Fix RLS on admin_event_notifications: allow all authenticated users to SELECT
-- so that non-admin users can trigger event notifications (plant requests, bug reports, etc.)
-- Previously the admin-only policy blocked non-admins from reading the config,
-- silently preventing any event notifications from being sent.

do $$ begin
  -- Drop the old combined admin-only policy
  if exists (select 1 from pg_policies where schemaname='public' and tablename='admin_event_notifications' and policyname='admin_event_notifications_admin_all') then
    drop policy admin_event_notifications_admin_all on public.admin_event_notifications;
  end if;
  -- Drop new policies if they already exist (idempotent re-run)
  if exists (select 1 from pg_policies where schemaname='public' and tablename='admin_event_notifications' and policyname='admin_event_notifications_select_authenticated') then
    drop policy admin_event_notifications_select_authenticated on public.admin_event_notifications;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='admin_event_notifications' and policyname='admin_event_notifications_admin_write') then
    drop policy admin_event_notifications_admin_write on public.admin_event_notifications;
  end if;

  -- SELECT: all authenticated users can read (so non-admin event triggers can fetch config)
  create policy admin_event_notifications_select_authenticated on public.admin_event_notifications
    for select to authenticated
    using (true);

  -- INSERT/UPDATE/DELETE: admin-only
  create policy admin_event_notifications_admin_write on public.admin_event_notifications
    for all to authenticated
    using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true))
    with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true));
end $$;
