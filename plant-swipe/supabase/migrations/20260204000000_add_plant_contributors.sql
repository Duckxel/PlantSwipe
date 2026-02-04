-- Add plant contributors table (separate table avoids column limits on plants)
create table if not exists public.plant_contributors (
  id uuid primary key default gen_random_uuid(),
  plant_id text not null references public.plants(id) on delete cascade,
  contributor_name text not null,
  created_at timestamptz not null default now()
);

create index if not exists plant_contributors_plant_id_idx on public.plant_contributors(plant_id);
create unique index if not exists plant_contributors_unique_name_idx on public.plant_contributors(plant_id, lower(contributor_name));

alter table public.plant_contributors enable row level security;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_contributors' and policyname='plant_contributors_select_all') then
    drop policy plant_contributors_select_all on public.plant_contributors;
  end if;
  create policy plant_contributors_select_all on public.plant_contributors for select to authenticated, anon using (true);
end $$;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_contributors' and policyname='plant_contributors_all') then
    drop policy plant_contributors_all on public.plant_contributors;
  end if;
  create policy plant_contributors_all on public.plant_contributors for all to authenticated using (true) with check (true);
end $$;

comment on table public.plant_contributors is 'Names of users who requested or edited a plant';
comment on column public.plant_contributors.contributor_name is 'Contributor display name';
