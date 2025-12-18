-- Ensure role helper functions exist for policy checks
create or replace function public.has_role(_user_id uuid, _role text)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1 from public.profiles
    where id = _user_id
      and _role = any(coalesce(roles, '{}'))
  );
$$;

create or replace function public.has_any_role(_user_id uuid, _roles text[])
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1 from public.profiles
    where id = _user_id
      and coalesce(roles, '{}') && _roles
  );
$$;

grant execute on function public.has_role(uuid, text) to authenticated;
grant execute on function public.has_any_role(uuid, text[]) to authenticated;

-- Professional advice posted by Admin/Editor/Pro users on plant pages
create table if not exists public.plant_pro_advices (
  id uuid primary key default gen_random_uuid(),
  plant_id text not null references public.plants(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  author_display_name text,
  author_username text,
  author_avatar_url text,
  author_roles text[] not null default '{}'::text[],
  content text not null,
  image_url text,
  reference_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint plant_pro_advices_content_not_blank check (char_length(btrim(content)) > 0),
  constraint plant_pro_advices_metadata_object check (metadata is null or jsonb_typeof(metadata) = 'object')
);

create index if not exists plant_pro_advices_plant_created_idx on public.plant_pro_advices (plant_id, created_at desc);
alter table public.plant_pro_advices enable row level security;

-- Allow anyone to read pro advice attached to plants
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_pro_advices' and policyname='plant_pro_advices_select_all') then
    drop policy plant_pro_advices_select_all on public.plant_pro_advices;
  end if;
  create policy plant_pro_advices_select_all on public.plant_pro_advices for select to authenticated, anon using (true);
end $$;

-- Only Admin/Editor/Pro users can post, and the author_id must match the caller
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_pro_advices' and policyname='plant_pro_advices_insert_authorized') then
    drop policy plant_pro_advices_insert_authorized on public.plant_pro_advices;
  end if;
  create policy plant_pro_advices_insert_authorized on public.plant_pro_advices for insert to authenticated
    with check (
      author_id = auth.uid()
      and coalesce(public.has_any_role(auth.uid(), array['admin','editor','pro']), false)
    );
end $$;

-- Allow authors to update/delete their own advice; Admin/Editor can moderate everything
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_pro_advices' and policyname='plant_pro_advices_update_moderate') then
    drop policy plant_pro_advices_update_moderate on public.plant_pro_advices;
  end if;
  create policy plant_pro_advices_update_moderate on public.plant_pro_advices for update to authenticated
    using (
      author_id = auth.uid()
      or coalesce(public.has_any_role(auth.uid(), array['admin','editor']), false)
    )
    with check (
      author_id = auth.uid()
      or coalesce(public.has_any_role(auth.uid(), array['admin','editor']), false)
    );
end $$;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_pro_advices' and policyname='plant_pro_advices_delete_moderate') then
    drop policy plant_pro_advices_delete_moderate on public.plant_pro_advices;
  end if;
  create policy plant_pro_advices_delete_moderate on public.plant_pro_advices for delete to authenticated
    using (
      author_id = auth.uid()
      or coalesce(public.has_any_role(auth.uid(), array['admin','editor']), false)
    );
end $$;
