-- ========== 18. DISCOVERY SEEN-PLANTS HISTORY ==========
-- Tracks which plants each user has seen in the discovery/swipe feed.
-- Used by the personalized discovery scoring algorithm to deprioritize
-- already-seen plants and surface fresh content.

create table if not exists public.discovery_seen_plants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plant_id text not null references public.plants(id) on delete cascade,
  seen_at timestamptz not null default now(),
  seen_count int not null default 1,
  unique(user_id, plant_id)
);

-- Indexes for fast lookups
create index if not exists idx_discovery_seen_user on public.discovery_seen_plants(user_id);
create index if not exists idx_discovery_seen_user_plant on public.discovery_seen_plants(user_id, plant_id);
create index if not exists idx_discovery_seen_at on public.discovery_seen_plants(seen_at);

-- RLS: users can only read/write their own seen history
alter table public.discovery_seen_plants enable row level security;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='discovery_seen_plants' AND policyname='discovery_seen_select') THEN
    CREATE POLICY discovery_seen_select ON public.discovery_seen_plants
      FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='discovery_seen_plants' AND policyname='discovery_seen_insert') THEN
    CREATE POLICY discovery_seen_insert ON public.discovery_seen_plants
      FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='discovery_seen_plants' AND policyname='discovery_seen_update') THEN
    CREATE POLICY discovery_seen_update ON public.discovery_seen_plants
      FOR UPDATE TO authenticated USING (user_id = auth.uid());
  END IF;
END $$;

-- ========== Atomic upsert function for seen-plant tracking ==========
-- Inserts a new row or increments seen_count atomically in the DB,
-- so the client doesn't need to know the current count.
create or replace function public.upsert_discovery_seen_plant(
  p_user_id uuid,
  p_plant_id text
) returns void
language sql
security invoker
as $$
  insert into public.discovery_seen_plants (user_id, plant_id, seen_at, seen_count)
  values (p_user_id, p_plant_id, now(), 1)
  on conflict (user_id, plant_id)
  do update set
    seen_at = now(),
    seen_count = discovery_seen_plants.seen_count + 1;
$$;
grant execute on function public.upsert_discovery_seen_plant(uuid, text) to authenticated;

-- ========== Purge expired discovery seen-plants (30-day retention) ==========
-- Rows older than 30 days are no longer used by the scoring algorithm.
-- Runs daily at 3:30 AM UTC.
do $$ begin
  begin
    perform cron.unschedule('purge_old_discovery_seen_plants');
  exception
    when others then
      null;
  end;
  begin
    perform cron.schedule(
      'purge_old_discovery_seen_plants',
      '30 3 * * *',
      $_cron$
      delete from public.discovery_seen_plants
      where seen_at < (now() at time zone 'utc') - interval '30 days';
      $_cron$
    );
  exception
    when others then
      null;
  end;
end $$;
