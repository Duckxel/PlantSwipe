-- Admin Email Template Versions (stores version history for templates)
create table if not exists public.admin_email_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.admin_email_templates(id) on delete cascade,
  version integer not null,
  title text not null,
  subject text not null,
  description text,
  preview_text text,
  body_html text not null,
  body_json jsonb,
  variables text[] default '{}',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  unique(template_id, version)
);

create index if not exists aetv_template_version_idx on public.admin_email_template_versions (template_id, version desc);

alter table public.admin_email_template_versions enable row level security;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='admin_email_template_versions' and policyname='aetv_admin_all') then
    drop policy aetv_admin_all on public.admin_email_template_versions;
  end if;
  create policy aetv_admin_all on public.admin_email_template_versions for all to authenticated
    using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true))
    with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true));
end $$;
