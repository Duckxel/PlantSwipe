-- ========== Plant translations (multi-language support) ==========
-- ARCHITECTURE NOTE: As of 2025, ALL translatable content is stored in plant_translations
-- for ALL languages INCLUDING English. The plants table contains only non-translatable
-- base data (IDs, booleans, numbers, timestamps, standardized enum codes).
-- English is treated as a translation just like French or any other language.
--
-- TRANSLATABLE FIELDS (in plant_translations for ALL languages):
--   Core: name, common_names, presentation
--   Identity: origin, allergens, poisoning_symptoms
--   Care: soil_advice, mulch_advice, fertilizer_advice
--   Growth: staking_advice, sowing_advice, transplanting_time, outdoor_planting_time, pruning_advice
--   Danger: pests, diseases
--   Consumption: nutritional_value, recipes_ideas, infusion_benefits, infusion_recipe_ideas,
--     medicinal_benefits, medicinal_usage, medicinal_warning, medicinal_history,
--     aromatherapy_benefits, essential_oil_blends
--   Ecology: beneficial_roles, harmful_roles, symbiosis, symbiosis_notes
--   Misc: plant_tags, biodiversity_tags, source_name, source_url, user_notes
--   Deprecated (kept for backward compat): spice_mixes

create table if not exists public.plant_translations (
  id uuid primary key default gen_random_uuid(),
  plant_id text not null references public.plants(id) on delete cascade,
  language text not null references public.translation_languages(code),

  -- Core translatable fields
  name text not null,
  common_names text[] not null default '{}',
  presentation text,

  -- Identity translatable fields
  origin text[] not null default '{}',
  allergens text[] not null default '{}',
  poisoning_symptoms text,

  -- Care translatable fields
  soil_advice text,
  mulch_advice text,
  fertilizer_advice text,

  -- Growth translatable fields
  staking_advice text,
  sowing_advice text,
  transplanting_time text,
  outdoor_planting_time text,
  pruning_advice text,

  -- Danger translatable fields
  pests text[] not null default '{}',
  diseases text[] not null default '{}',

  -- Consumption translatable fields
  nutritional_value text,
  recipes_ideas text[] not null default '{}',
  infusion_benefits text,
  infusion_recipe_ideas text,
  medicinal_benefits text,
  medicinal_usage text,
  medicinal_warning text,
  medicinal_history text,
  aromatherapy_benefits text,
  essential_oil_blends text,

  -- Ecology translatable fields
  beneficial_roles text[] not null default '{}',
  harmful_roles text[] not null default '{}',
  symbiosis text[] not null default '{}',
  symbiosis_notes text,

  -- Misc translatable fields
  plant_tags text[] not null default '{}',
  biodiversity_tags text[] not null default '{}',
  source_name text,
  source_url text,
  user_notes text,

  -- Deprecated (kept for backward compatibility)
  spice_mixes text[] not null default '{}',

  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plant_id, language)
);

alter table if exists public.plant_translations drop constraint if exists plant_translations_language_check;

-- Index for faster lookups
create index if not exists plant_translations_plant_id_idx on public.plant_translations(plant_id);
create index if not exists plant_translations_language_idx on public.plant_translations(language);

-- Drop obsolete JSON columns from earlier iterations
alter table if exists public.plant_translations drop column if exists identifiers;
alter table if exists public.plant_translations drop column if exists ecology;
alter table if exists public.plant_translations drop column if exists usage;
alter table if exists public.plant_translations drop column if exists meta;
alter table if exists public.plant_translations drop column if exists phenology;
alter table if exists public.plant_translations drop column if exists care;
alter table if exists public.plant_translations drop column if exists planting;
alter table if exists public.plant_translations drop column if exists problems;

-- ========== Phase 1: Add new columns if they don't exist ==========
-- Core
alter table if exists public.plant_translations add column if not exists common_names text[] not null default '{}';
alter table if exists public.plant_translations add column if not exists presentation text;
-- Identity
alter table if exists public.plant_translations add column if not exists origin text[] not null default '{}';
alter table if exists public.plant_translations add column if not exists allergens text[] not null default '{}';
alter table if exists public.plant_translations add column if not exists poisoning_symptoms text;
-- Care
alter table if exists public.plant_translations add column if not exists soil_advice text;
alter table if exists public.plant_translations add column if not exists mulch_advice text;
alter table if exists public.plant_translations add column if not exists fertilizer_advice text;
-- Growth
alter table if exists public.plant_translations add column if not exists staking_advice text;
alter table if exists public.plant_translations add column if not exists sowing_advice text;
alter table if exists public.plant_translations add column if not exists transplanting_time text;
alter table if exists public.plant_translations add column if not exists outdoor_planting_time text;
alter table if exists public.plant_translations add column if not exists pruning_advice text;
-- Danger
alter table if exists public.plant_translations add column if not exists pests text[] not null default '{}';
alter table if exists public.plant_translations add column if not exists diseases text[] not null default '{}';
-- Consumption
alter table if exists public.plant_translations add column if not exists nutritional_value text;
alter table if exists public.plant_translations add column if not exists recipes_ideas text[] not null default '{}';
alter table if exists public.plant_translations add column if not exists infusion_benefits text;
alter table if exists public.plant_translations add column if not exists infusion_recipe_ideas text;
alter table if exists public.plant_translations add column if not exists medicinal_benefits text;
alter table if exists public.plant_translations add column if not exists medicinal_usage text;
alter table if exists public.plant_translations add column if not exists medicinal_warning text;
alter table if exists public.plant_translations add column if not exists medicinal_history text;
alter table if exists public.plant_translations add column if not exists aromatherapy_benefits text;
alter table if exists public.plant_translations add column if not exists essential_oil_blends text;
-- Ecology
alter table if exists public.plant_translations add column if not exists beneficial_roles text[] not null default '{}';
alter table if exists public.plant_translations add column if not exists harmful_roles text[] not null default '{}';
alter table if exists public.plant_translations add column if not exists symbiosis text[] not null default '{}';
alter table if exists public.plant_translations add column if not exists symbiosis_notes text;
-- Misc
alter table if exists public.plant_translations add column if not exists plant_tags text[] not null default '{}';
alter table if exists public.plant_translations add column if not exists biodiversity_tags text[] not null default '{}';
alter table if exists public.plant_translations add column if not exists source_name text;
alter table if exists public.plant_translations add column if not exists source_url text;
alter table if exists public.plant_translations add column if not exists user_notes text;
-- Deprecated
alter table if exists public.plant_translations add column if not exists spice_mixes text[] not null default '{}';

-- ========== Phase 2: Migrate data from old columns to new columns ==========
do $migrate_translations$
begin
  -- given_names → common_names
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='given_names') then
    update public.plant_translations set common_names = given_names
      where given_names is not null and array_length(given_names, 1) > 0
      and (common_names is null or array_length(common_names, 1) is null);
  end if;

  -- overview → presentation
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='overview') then
    update public.plant_translations set presentation = overview
      where overview is not null and trim(overview) <> ''
      and (presentation is null or trim(presentation) = '');
  end if;

  -- advice_soil → soil_advice
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='advice_soil') then
    update public.plant_translations set soil_advice = advice_soil
      where advice_soil is not null and trim(advice_soil) <> ''
      and (soil_advice is null or trim(soil_advice) = '');
  end if;

  -- advice_mulching → mulch_advice
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='advice_mulching') then
    update public.plant_translations set mulch_advice = advice_mulching
      where advice_mulching is not null and trim(advice_mulching) <> ''
      and (mulch_advice is null or trim(mulch_advice) = '');
  end if;

  -- advice_fertilizer → fertilizer_advice
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='advice_fertilizer') then
    update public.plant_translations set fertilizer_advice = advice_fertilizer
      where advice_fertilizer is not null and trim(advice_fertilizer) <> ''
      and (fertilizer_advice is null or trim(fertilizer_advice) = '');
  end if;

  -- advice_tutoring → staking_advice
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='advice_tutoring') then
    update public.plant_translations set staking_advice = advice_tutoring
      where advice_tutoring is not null and trim(advice_tutoring) <> ''
      and (staking_advice is null or trim(staking_advice) = '');
  end if;

  -- advice_sowing → sowing_advice
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='advice_sowing') then
    update public.plant_translations set sowing_advice = advice_sowing
      where advice_sowing is not null and trim(advice_sowing) <> ''
      and (sowing_advice is null or trim(sowing_advice) = '');
  end if;

  -- cut → pruning_advice
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='cut') then
    update public.plant_translations set pruning_advice = cut
      where cut is not null and trim(cut) <> ''
      and (pruning_advice is null or trim(pruning_advice) = '');
  end if;

  -- advice_medicinal → medicinal_warning
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='advice_medicinal') then
    update public.plant_translations set medicinal_warning = advice_medicinal
      where advice_medicinal is not null and trim(advice_medicinal) <> ''
      and (medicinal_warning is null or trim(medicinal_warning) = '');
  end if;

  -- advice_infusion → infusion_benefits
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='advice_infusion') then
    update public.plant_translations set infusion_benefits = advice_infusion
      where advice_infusion is not null and trim(advice_infusion) <> ''
      and (infusion_benefits is null or trim(infusion_benefits) = '');
  end if;

  -- nutritional_intake (text[]) → nutritional_value (text)
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='nutritional_intake') then
    update public.plant_translations set nutritional_value = array_to_string(nutritional_intake, ', ')
      where nutritional_intake is not null and array_length(nutritional_intake, 1) > 0
      and (nutritional_value is null or trim(nutritional_value) = '');
  end if;

  -- ground_effect → (dropped, no direct mapping)
  -- symbolism → (dropped, not in new spec)

  -- tags → plant_tags
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='tags') then
    update public.plant_translations set plant_tags = tags
      where tags is not null and array_length(tags, 1) > 0
      and (plant_tags is null or array_length(plant_tags, 1) is null);
  end if;

  -- admin_commentary migration (from translations to plants)
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
    and table_name = 'plant_translations'
    and column_name = 'admin_commentary'
  ) then
    update public.plants p
    set admin_commentary = pt.admin_commentary
    from public.plant_translations pt
    where p.id = pt.plant_id
      and pt.language = 'en'
      and pt.admin_commentary is not null
      and (p.admin_commentary is null or trim(p.admin_commentary) = '');

    update public.plants p
    set admin_commentary = pt.admin_commentary
    from public.plant_translations pt
    where p.id = pt.plant_id
      and pt.admin_commentary is not null
      and (p.admin_commentary is null or trim(p.admin_commentary) = '');
  end if;

  -- Migrate non-translatable columns from plant_translations back to plants
  -- scientific_name → scientific_name_species
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'plant_translations' and column_name = 'scientific_name') then
    update public.plants p set scientific_name_species = pt.scientific_name
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.language = 'en' and pt.scientific_name is not null
      and (p.scientific_name_species is null or trim(p.scientific_name_species) = '');
  end if;

  -- family
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'plant_translations' and column_name = 'family') then
    update public.plants p set family = pt.family
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.language = 'en' and pt.family is not null
      and (p.family is null or trim(p.family) = '');
  end if;

end $migrate_translations$;

-- ========== Phase 3: Drop old/renamed columns from plant_translations ==========
-- These have been migrated to new column names above
alter table if exists public.plant_translations drop column if exists given_names;
alter table if exists public.plant_translations drop column if exists overview;
alter table if exists public.plant_translations drop column if exists advice_soil;
alter table if exists public.plant_translations drop column if exists advice_mulching;
alter table if exists public.plant_translations drop column if exists advice_fertilizer;
alter table if exists public.plant_translations drop column if exists advice_tutoring;
alter table if exists public.plant_translations drop column if exists advice_sowing;
alter table if exists public.plant_translations drop column if exists cut;
alter table if exists public.plant_translations drop column if exists advice_medicinal;
alter table if exists public.plant_translations drop column if exists advice_infusion;
alter table if exists public.plant_translations drop column if exists nutritional_intake;
alter table if exists public.plant_translations drop column if exists ground_effect;
alter table if exists public.plant_translations drop column if exists symbolism;
alter table if exists public.plant_translations drop column if exists tags;
alter table if exists public.plant_translations drop column if exists admin_commentary;

-- Drop columns that were moved to plants table (non-translatable enums)
alter table if exists public.plant_translations drop column if exists scientific_name;
alter table if exists public.plant_translations drop column if exists promotion_month;
alter table if exists public.plant_translations drop column if exists level_sun;
alter table if exists public.plant_translations drop column if exists habitat;
alter table if exists public.plant_translations drop column if exists family;
alter table if exists public.plant_translations drop column if exists life_cycle;
alter table if exists public.plant_translations drop column if exists season;
alter table if exists public.plant_translations drop column if exists foliage_persistance;
alter table if exists public.plant_translations drop column if exists toxicity_human;
alter table if exists public.plant_translations drop column if exists toxicity_pets;
alter table if exists public.plant_translations drop column if exists living_space;
alter table if exists public.plant_translations drop column if exists composition;
alter table if exists public.plant_translations drop column if exists maintenance_level;

-- ========== Migrate English data from plants to plant_translations ==========
-- Ensures all plants have English translations in the new architecture
do $migrate_en_translations$
declare
  migrated_count integer := 0;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'plant_translations' and column_name = 'presentation'
  ) then
    raise notice '[plant_translations] Skipping migration - required columns not yet present';
    return;
  end if;

  with inserted as (
    insert into public.plant_translations (
      plant_id,
      language,
      name,
      common_names,
      origin,
      allergens,
      source_name,
      source_url,
      plant_tags,
      spice_mixes,
      pests,
      diseases
    )
    select
      p.id,
      'en',
      p.name,
      '{}',
      '{}',
      '{}',
      null,
      null,
      '{}',
      '{}',
      '{}',
      '{}'
    from public.plants p
    where not exists (
      select 1 from public.plant_translations pt
      where pt.plant_id = p.id and pt.language = 'en'
    )
    returning 1
  )
  select count(*) into migrated_count from inserted;

  if migrated_count > 0 then
    raise notice '[plant_translations] Created % English translations for plants without one', migrated_count;
  end if;
end $migrate_en_translations$;

-- Migrate spice_mixes, pests, diseases from plants to plant_translations
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'plants' and column_name = 'spice_mixes'
  ) then
    update public.plant_translations pt
    set
      spice_mixes = coalesce(p.spice_mixes, '{}'),
      pests = coalesce(p.pests, '{}'),
      diseases = coalesce(p.diseases, '{}')
    from public.plants p
    where pt.plant_id = p.id
      and pt.language = 'en'
      and (array_length(pt.spice_mixes, 1) is null or array_length(pt.spice_mixes, 1) = 0)
      and (
        array_length(p.spice_mixes, 1) > 0
        or array_length(p.pests, 1) > 0
        or array_length(p.diseases, 1) > 0
      );
  end if;
end $$;

-- Drop deprecated translatable columns from plants table
alter table if exists public.plants drop column if exists spice_mixes;
alter table if exists public.plants drop column if exists pests;
alter table if exists public.plants drop column if exists diseases;

-- RLS policies for plant_translations
alter table public.plant_translations enable row level security;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_translations' and policyname='plant_translations_select_all') then
    drop policy plant_translations_select_all on public.plant_translations;
  end if;
  create policy plant_translations_select_all on public.plant_translations for select to authenticated, anon using (true);
end $$;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_translations' and policyname='plant_translations_insert') then
    drop policy plant_translations_insert on public.plant_translations;
  end if;
  create policy plant_translations_insert on public.plant_translations for insert to authenticated with check (true);
end $$;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_translations' and policyname='plant_translations_update') then
    drop policy plant_translations_update on public.plant_translations;
  end if;
  create policy plant_translations_update on public.plant_translations for update to authenticated using (true) with check (true);
end $$;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_translations' and policyname='plant_translations_delete') then
    drop policy plant_translations_delete on public.plant_translations;
  end if;
  create policy plant_translations_delete on public.plant_translations for delete to authenticated using (true);
end $$;

-- ========== Requested plants (user requests for new plants) ==========
create table if not exists public.requested_plants (
  id uuid primary key default gen_random_uuid(),
  plant_name text not null,
  plant_name_normalized text not null,
  requested_by uuid not null references auth.users(id) on delete cascade,
  request_count integer not null default 1 check (request_count > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null
);

alter table if exists public.requested_plants add column if not exists plant_name text;
alter table if exists public.requested_plants add column if not exists plant_name_normalized text;
alter table if exists public.requested_plants add column if not exists requested_by uuid references auth.users(id) on delete cascade;
alter table if exists public.requested_plants add column if not exists request_count integer not null default 1;
alter table if exists public.requested_plants add column if not exists created_at timestamptz not null default now();
alter table if exists public.requested_plants add column if not exists updated_at timestamptz not null default now();
alter table if exists public.requested_plants add column if not exists completed_at timestamptz;
alter table if exists public.requested_plants add column if not exists completed_by uuid;

do $$ begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'requested_plants'
      and column_name = 'plant_name_normalized'
  ) then
    update public.requested_plants
      set plant_name_normalized = lower(trim(plant_name))
      where plant_name_normalized is null and plant_name is not null;

    begin
      alter table public.requested_plants
        alter column plant_name_normalized set not null;
    exception
      when others then
        null;
    end;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'requested_plants_request_count_check'
  ) then
    alter table public.requested_plants
      add constraint requested_plants_request_count_check
      check (request_count > 0);
  end if;

    if not exists (
      select 1 from pg_constraint
      where conname = 'requested_plants_requested_by_fkey'
    ) then
      alter table public.requested_plants
        add constraint requested_plants_requested_by_fkey
        foreign key (requested_by) references auth.users(id) on delete cascade;
    end if;
    if not exists (
      select 1 from pg_constraint
      where conname = 'requested_plants_completed_by_fkey'
    ) then
      alter table public.requested_plants
        add constraint requested_plants_completed_by_fkey
        foreign key (completed_by) references auth.users(id) on delete set null;
    end if;
end $$;
