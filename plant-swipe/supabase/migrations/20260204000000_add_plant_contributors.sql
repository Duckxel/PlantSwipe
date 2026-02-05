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
  -- Drop the old overly-permissive policy that allowed any authenticated user full access
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_contributors' and policyname='plant_contributors_all') then
    drop policy plant_contributors_all on public.plant_contributors;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_contributors' and policyname='plant_contributors_write') then
    drop policy plant_contributors_write on public.plant_contributors;
  end if;
  -- Only admins and editors can insert, update, or delete contributor records
  create policy plant_contributors_write on public.plant_contributors
    for all to authenticated
    using (
      exists (
        select 1 from public.profiles
        where id = auth.uid()
          and (is_admin = true or coalesce(public.has_any_role(auth.uid(), array['admin','editor']), false))
      )
    )
    with check (
      exists (
        select 1 from public.profiles
        where id = auth.uid()
          and (is_admin = true or coalesce(public.has_any_role(auth.uid(), array['admin','editor']), false))
      )
    );
end $$;

comment on table public.plant_contributors is 'Names of users who requested or edited a plant';
comment on column public.plant_contributors.contributor_name is 'Contributor display name';
