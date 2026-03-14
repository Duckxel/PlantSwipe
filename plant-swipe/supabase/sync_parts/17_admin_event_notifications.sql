-- ========== Admin Event Notifications ==========
-- Configurable notification settings for special events (user reports, bug reports, etc.)
-- Each event type has its own toggle, message template, and list of admin recipients.

create table if not exists public.admin_event_notifications (
  id uuid primary key default gen_random_uuid(),
  -- Event type key: user_report, bug_report, plant_report, plant_request
  event_type text not null unique check (event_type in ('user_report', 'bug_report', 'plant_report', 'plant_request')),
  -- Whether notifications are enabled for this event
  enabled boolean not null default false,
  -- Custom message template with variable placeholders like {{variable_name}}
  message_template text not null default '',
  -- Array of admin user IDs to notify
  admin_ids uuid[] not null default '{}',
  -- Metadata
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Trigger to auto-update updated_at
create or replace function public.update_admin_event_notifications_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists admin_event_notifications_set_updated_at on public.admin_event_notifications;
create trigger admin_event_notifications_set_updated_at
  before update on public.admin_event_notifications
  for each row
  execute function public.update_admin_event_notifications_updated_at();

-- RLS: only admins can read/write
alter table public.admin_event_notifications enable row level security;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='admin_event_notifications' and policyname='admin_event_notifications_admin_all') then
    drop policy admin_event_notifications_admin_all on public.admin_event_notifications;
  end if;
  create policy admin_event_notifications_admin_all on public.admin_event_notifications for all to authenticated
    using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true))
    with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true));
end $$;

-- Seed default rows for each event type so the UI always has something to display
insert into public.admin_event_notifications (event_type, enabled, message_template)
values
  ('user_report', false, 'New user report: {{reporter_name}} reported {{reported_user_name}} for "{{reason}}"'),
  ('bug_report', false, 'New bug report from {{reporter_name}}: "{{bug_name}}" - {{description}}'),
  ('plant_report', false, 'Plant report from {{reporter_name}}: {{plant_name}} - "{{note}}"'),
  ('plant_request', false, 'New plant request from {{requester_name}}: "{{plant_name}}"')
on conflict (event_type) do nothing;
