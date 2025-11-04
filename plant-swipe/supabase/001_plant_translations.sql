-- Plant translations table for multi-language support
create table if not exists public.plant_translations (
  id uuid primary key default gen_random_uuid(),
  plant_id text not null references public.plants(id) on delete cascade,
  language text not null check (language in ('en', 'fr')),
  name text not null,
  scientific_name text,
  meaning text,
  description text,
  care_soil text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(plant_id, language)
);

-- Index for faster lookups
create index if not exists plant_translations_plant_id_idx on public.plant_translations(plant_id);
create index if not exists plant_translations_language_idx on public.plant_translations(language);

-- RLS policies for plant_translations
alter table public.plant_translations enable row level security;

create policy plant_translations_select_all on public.plant_translations for select to authenticated, anon using (true);
create policy plant_translations_insert on public.plant_translations for insert to authenticated with check (true);
create policy plant_translations_update on public.plant_translations for update to authenticated using (true) with check (true);
create policy plant_translations_delete on public.plant_translations for delete to authenticated using (true);
