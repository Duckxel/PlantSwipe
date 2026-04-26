-- ========== AI & Scan usage monitoring ==========
-- Tracks OpenAI token spend per feature and per-user plant-scan counts.
-- Used for monitoring abuse; limits are not enforced yet.

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  feature text not null,
  provider text not null default 'openai',
  model text,
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  total_tokens integer not null default 0,
  request_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_usage_events_user_created
  on public.ai_usage_events (user_id, created_at desc);
create index if not exists idx_ai_usage_events_feature_created
  on public.ai_usage_events (feature, created_at desc);
create index if not exists idx_ai_usage_events_created
  on public.ai_usage_events (created_at desc);

alter table public.ai_usage_events enable row level security;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='ai_usage_events' and policyname='ai_usage_events_select_self_or_admin') then
    drop policy ai_usage_events_select_self_or_admin on public.ai_usage_events;
  end if;
  create policy ai_usage_events_select_self_or_admin on public.ai_usage_events
    for select to authenticated
    using (
      user_id = (select auth.uid())
      or public.is_admin_user((select auth.uid()))
    );
end $$;

grant select on public.ai_usage_events to authenticated;

create table if not exists public.scan_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scan_id uuid references public.plant_scans(id) on delete set null,
  provider text not null default 'kindwise',
  tokens integer not null default 1,
  classification_level text,
  success boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_scan_usage_events_user_created
  on public.scan_usage_events (user_id, created_at desc);
create index if not exists idx_scan_usage_events_created
  on public.scan_usage_events (created_at desc);

alter table public.scan_usage_events enable row level security;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='scan_usage_events' and policyname='scan_usage_events_select_self_or_admin') then
    drop policy scan_usage_events_select_self_or_admin on public.scan_usage_events;
  end if;
  create policy scan_usage_events_select_self_or_admin on public.scan_usage_events
    for select to authenticated
    using (
      user_id = (select auth.uid())
      or public.is_admin_user((select auth.uid()))
    );
end $$;

grant select on public.scan_usage_events to authenticated;

-- Defence in depth: RLS already blocks all writes (no INSERT/UPDATE/DELETE
-- policies exist), but explicitly revoke the privileges so a future policy
-- mistake or schema-level grant cannot let a client tamper with their own
-- usage rows or wipe them to dodge limits.
revoke insert, update, delete on public.ai_usage_events from authenticated;
revoke insert, update, delete on public.ai_usage_events from anon;
revoke insert, update, delete on public.scan_usage_events from authenticated;
revoke insert, update, delete on public.scan_usage_events from anon;
