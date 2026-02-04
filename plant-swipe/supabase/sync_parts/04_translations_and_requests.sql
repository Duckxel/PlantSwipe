-- ========== Plant translations (multi-language support) ==========
-- ARCHITECTURE NOTE: As of 2024, ALL translatable content is stored in plant_translations
-- for ALL languages INCLUDING English. The plants table contains only non-translatable
-- base data (IDs, booleans, numbers, timestamps). English is treated as a translation
-- just like French or any other language.
--
-- Translatable fields (in plant_translations for ALL languages):
--   name, given_names, scientific_name, family, overview
--   promotion_month, life_cycle, season, foliage_persistance
--   toxicity_human, toxicity_pets, allergens, symbolism
--   living_space, composition, maintenance_level
--   origin, habitat, level_sun
--   advice_soil, advice_mulching, advice_fertilizer
--   advice_tutoring, advice_sowing, advice_medicinal, advice_infusion
--   ground_effect, cut, nutritional_intake, recipes_ideas
--   source_name, source_url, tags
--
-- Non-translatable fields (in plants table only):
--   id, plant_type, utility, comestible_part, fruit_type
--   spiked, scent, multicolor, bicolor
--   temperature_max, temperature_min, temperature_ideal, hygrometry
--   watering_type, division, soil, mulching, nutrition_need, fertilizer
--   sowing_month, flowering_month, fruiting_month
--   height_cm, wingspan_cm, tutoring, sow_type, separation_cm, transplanting
--   infusion, aromatherapy
--   melliferous, polenizer, be_fertilizer, conservation_status
--   companions
--   status, admin_commentary, created_by, created_time, updated_by, updated_time
--   (spice_mixes, pests, diseases are NOW TRANSLATABLE - stored in both tables for compatibility)

create table if not exists public.plant_translations (
  id uuid primary key default gen_random_uuid(),
  plant_id text not null references public.plants(id) on delete cascade,
  language text not null references public.translation_languages(code),
  -- Core translatable fields
  name text not null,
  given_names text[] not null default '{}',
  scientific_name text,
  family text,
  overview text,
  -- Identity translatable fields
  promotion_month text check (promotion_month in ('january','february','march','april','may','june','july','august','september','october','november','december')),
  life_cycle text check (life_cycle in ('annual','biennials','perenials','ephemerals','monocarpic','polycarpic')),
  season text[] not null default '{}'::text[] check (season <@ array['spring','summer','autumn','winter']),
  foliage_persistance text check (foliage_persistance in ('deciduous','evergreen','semi-evergreen','marcescent')),
  toxicity_human text check (toxicity_human in ('non-toxic','midly irritating','highly toxic','lethally toxic')),
  toxicity_pets text check (toxicity_pets in ('non-toxic','midly irritating','highly toxic','lethally toxic')),
  allergens text[] not null default '{}',
  symbolism text[] not null default '{}',
  living_space text check (living_space in ('indoor','outdoor','both')),
  composition text[] not null default '{}'::text[] check (composition <@ array['flowerbed','path','hedge','ground cover','pot']),
  maintenance_level text check (maintenance_level in ('none','low','moderate','heavy')),
  -- Care translatable fields
  origin text[] not null default '{}',
  habitat text[] not null default '{}'::text[] check (habitat <@ array['aquatic','semi-aquatic','wetland','tropical','temperate','arid','mediterranean','mountain','grassland','forest','coastal','urban']),
  level_sun text check (level_sun in ('low light','shade','partial sun','full sun')),
  advice_soil text,
  advice_mulching text,
  advice_fertilizer text,
  -- Growth translatable fields
  advice_tutoring text,
  advice_sowing text,
  cut text,
  -- Usage translatable fields
  advice_medicinal text,
  advice_infusion text,
  nutritional_intake text[] not null default '{}',
  recipes_ideas text[] not null default '{}',
  -- Ecology translatable fields
  ground_effect text,
  -- Miscellaneous translatable fields
  source_name text,
  source_url text,
  tags text[] not null default '{}',
  -- Translatable array fields (spice mixes, pests, diseases)
  spice_mixes text[] not null default '{}',
  pests text[] not null default '{}',
  diseases text[] not null default '{}',
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plant_id, language)
);

alter table if exists public.plant_translations drop constraint if exists plant_translations_language_check;

-- Index for faster lookups
create index if not exists plant_translations_plant_id_idx on public.plant_translations(plant_id);
create index if not exists plant_translations_language_idx on public.plant_translations(language);
-- Ensure new JSONB translatable columns exist
alter table if exists public.plant_translations drop column if exists identifiers;
alter table if exists public.plant_translations drop column if exists ecology;
alter table if exists public.plant_translations drop column if exists usage;
alter table if exists public.plant_translations drop column if exists meta;
alter table if exists public.plant_translations drop column if exists phenology;
alter table if exists public.plant_translations drop column if exists care;
alter table if exists public.plant_translations drop column if exists planting;
alter table if exists public.plant_translations drop column if exists problems;

-- Translatable text fields only in plant_translations
alter table if exists public.plant_translations add column if not exists overview text;
alter table if exists public.plant_translations add column if not exists given_names text[] not null default '{}';
alter table if exists public.plant_translations add column if not exists allergens text[] not null default '{}';
alter table if exists public.plant_translations add column if not exists symbolism text[] not null default '{}';
alter table if exists public.plant_translations add column if not exists origin text[] not null default '{}';

-- The following are NOT translated - they stay only in plants table (enums/Latin names)
-- Migrate data from plant_translations to plants before dropping columns
do $$
begin
  -- Migrate scientific_name from plant_translations to plants (prefer English, then any)
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'plant_translations' and column_name = 'scientific_name') then
    update public.plants p set scientific_name = pt.scientific_name
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.language = 'en' and pt.scientific_name is not null and (p.scientific_name is null or trim(p.scientific_name) = '');
    
    update public.plants p set scientific_name = pt.scientific_name
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.scientific_name is not null and (p.scientific_name is null or trim(p.scientific_name) = '');
  end if;
  
  -- Migrate promotion_month from plant_translations to plants (prefer English, then any)
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'plant_translations' and column_name = 'promotion_month') then
    update public.plants p set promotion_month = pt.promotion_month
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.language = 'en' and pt.promotion_month is not null and p.promotion_month is null;
    
    update public.plants p set promotion_month = pt.promotion_month
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.promotion_month is not null and p.promotion_month is null;
  end if;
  
  -- Migrate level_sun from plant_translations to plants (prefer English, then any)
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'plant_translations' and column_name = 'level_sun') then
    update public.plants p set level_sun = pt.level_sun
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.language = 'en' and pt.level_sun is not null and p.level_sun is null;
    
    update public.plants p set level_sun = pt.level_sun
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.level_sun is not null and p.level_sun is null;
  end if;
  
  -- Migrate habitat from plant_translations to plants
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'plant_translations' and column_name = 'habitat') then
    update public.plants p set habitat = pt.habitat
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.language = 'en' and pt.habitat is not null and array_length(pt.habitat, 1) > 0 and (p.habitat is null or array_length(p.habitat, 1) = 0);
    
    update public.plants p set habitat = pt.habitat
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.habitat is not null and array_length(pt.habitat, 1) > 0 and (p.habitat is null or array_length(p.habitat, 1) = 0);
  end if;
  
  -- Migrate family from plant_translations to plants
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'plant_translations' and column_name = 'family') then
    update public.plants p set family = pt.family
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.language = 'en' and pt.family is not null and (p.family is null or trim(p.family) = '');
    
    update public.plants p set family = pt.family
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.family is not null and (p.family is null or trim(p.family) = '');
  end if;
  
  -- Migrate life_cycle from plant_translations to plants
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'plant_translations' and column_name = 'life_cycle') then
    update public.plants p set life_cycle = pt.life_cycle
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.language = 'en' and pt.life_cycle is not null and p.life_cycle is null;
    
    update public.plants p set life_cycle = pt.life_cycle
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.life_cycle is not null and p.life_cycle is null;
  end if;
  
  -- Migrate season from plant_translations to plants
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'plant_translations' and column_name = 'season') then
    update public.plants p set season = pt.season
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.language = 'en' and pt.season is not null and array_length(pt.season, 1) > 0 and (p.season is null or array_length(p.season, 1) = 0);
    
    update public.plants p set season = pt.season
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.season is not null and array_length(pt.season, 1) > 0 and (p.season is null or array_length(p.season, 1) = 0);
  end if;
  
  -- Migrate foliage_persistance from plant_translations to plants
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'plant_translations' and column_name = 'foliage_persistance') then
    update public.plants p set foliage_persistance = pt.foliage_persistance
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.language = 'en' and pt.foliage_persistance is not null and p.foliage_persistance is null;
    
    update public.plants p set foliage_persistance = pt.foliage_persistance
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.foliage_persistance is not null and p.foliage_persistance is null;
  end if;
  
  -- Migrate toxicity_human from plant_translations to plants
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'plant_translations' and column_name = 'toxicity_human') then
    update public.plants p set toxicity_human = pt.toxicity_human
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.language = 'en' and pt.toxicity_human is not null and p.toxicity_human is null;
    
    update public.plants p set toxicity_human = pt.toxicity_human
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.toxicity_human is not null and p.toxicity_human is null;
  end if;
  
  -- Migrate toxicity_pets from plant_translations to plants
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'plant_translations' and column_name = 'toxicity_pets') then
    update public.plants p set toxicity_pets = pt.toxicity_pets
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.language = 'en' and pt.toxicity_pets is not null and p.toxicity_pets is null;
    
    update public.plants p set toxicity_pets = pt.toxicity_pets
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.toxicity_pets is not null and p.toxicity_pets is null;
  end if;
  
  -- Migrate living_space from plant_translations to plants
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'plant_translations' and column_name = 'living_space') then
    update public.plants p set living_space = pt.living_space
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.language = 'en' and pt.living_space is not null and p.living_space is null;
    
    update public.plants p set living_space = pt.living_space
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.living_space is not null and p.living_space is null;
  end if;
  
  -- Migrate composition from plant_translations to plants
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'plant_translations' and column_name = 'composition') then
    update public.plants p set composition = pt.composition
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.language = 'en' and pt.composition is not null and array_length(pt.composition, 1) > 0 and (p.composition is null or array_length(p.composition, 1) = 0);
    
    update public.plants p set composition = pt.composition
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.composition is not null and array_length(pt.composition, 1) > 0 and (p.composition is null or array_length(p.composition, 1) = 0);
  end if;
  
  -- Migrate maintenance_level from plant_translations to plants
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'plant_translations' and column_name = 'maintenance_level') then
    update public.plants p set maintenance_level = pt.maintenance_level
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.language = 'en' and pt.maintenance_level is not null and p.maintenance_level is null;
    
    update public.plants p set maintenance_level = pt.maintenance_level
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.maintenance_level is not null and p.maintenance_level is null;
  end if;
end $$;

-- Now drop the non-translatable columns from plant_translations
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
-- habitat is NOT translated - it stays only in plants table (dropped above)
alter table if exists public.plant_translations add column if not exists advice_soil text;
alter table if exists public.plant_translations add column if not exists advice_mulching text;
alter table if exists public.plant_translations add column if not exists advice_fertilizer text;
alter table if exists public.plant_translations add column if not exists advice_tutoring text;
alter table if exists public.plant_translations add column if not exists advice_sowing text;
alter table if exists public.plant_translations add column if not exists advice_medicinal text;
alter table if exists public.plant_translations add column if not exists advice_infusion text;
alter table if exists public.plant_translations add column if not exists ground_effect text;
-- admin_commentary migrated to main table
alter table if exists public.plant_translations add column if not exists source_name text;

-- Migrate admin_commentary from translations to plants and drop column from translations
do $$
begin
  -- Only migrate if the column exists in plant_translations
  if exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'plant_translations' 
    and column_name = 'admin_commentary'
  ) then
    -- Update plants with admin_commentary from english translation if plant has none
    update public.plants p
    set admin_commentary = pt.admin_commentary
    from public.plant_translations pt
    where p.id = pt.plant_id
      and pt.language = 'en'
      and pt.admin_commentary is not null
      and (p.admin_commentary is null or trim(p.admin_commentary) = '');
      
    -- Update plants with admin_commentary from ANY translation if plant still has none
    update public.plants p
    set admin_commentary = pt.admin_commentary
    from public.plant_translations pt
    where p.id = pt.plant_id
      and pt.admin_commentary is not null
      and (p.admin_commentary is null or trim(p.admin_commentary) = '');

    -- Drop the column from translations
    alter table public.plant_translations drop column admin_commentary;
  end if;
end $$;
alter table if exists public.plant_translations add column if not exists source_url text;
alter table if exists public.plant_translations add column if not exists tags text[] not null default '{}';
alter table if exists public.plant_translations add column if not exists nutritional_intake text[] not null default '{}';
alter table if exists public.plant_translations add column if not exists recipes_ideas text[] not null default '{}';
alter table if exists public.plant_translations add column if not exists cut text;
-- Translatable array fields (moved from plants table to support translation)
alter table if exists public.plant_translations add column if not exists spice_mixes text[] not null default '{}';
alter table if exists public.plant_translations add column if not exists pests text[] not null default '{}';
alter table if exists public.plant_translations add column if not exists diseases text[] not null default '{}';
-- level_sun is NOT translated - it stays only in plants table (dropped above)

-- ========== Migrate English data from plants to plant_translations ==========
-- This migration ensures all plants have English translations in the new architecture
-- where ALL translatable fields (including English) are stored in plant_translations.
-- This is idempotent - it only creates translations for plants that don't have one yet.
-- NOTE: scientific_name, promotion_month, habitat, and level_sun are NOT migrated here
-- because they stay in the plants table only (not translated).
do $migrate_translations$
declare
  migrated_count integer := 0;
  has_overview boolean := false;
  has_required_cols boolean := false;
begin
  -- Check if required source columns exist in plants table before attempting migration
  -- If the plants table schema hasn't been fully updated yet, skip this migration
  select exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'plants' 
    and column_name = 'overview'
  ) into has_overview;
  
  -- Also check for a few other key columns to be safe
  select exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'plants' 
    and column_name in ('given_names', 'allergens', 'symbolism', 'advice_soil')
    having count(*) >= 4
  ) into has_required_cols;
  
  -- Only run migration if required columns exist
  if not has_overview or not has_required_cols then
    raise notice '[plant_translations] Skipping migration - required columns not yet present in plants table';
    return;
  end if;

  -- Insert English translations for plants that don't have one yet
  -- NOTE: The following columns are NOT included because they stay in plants table only (not translated):
  -- scientific_name, promotion_month, level_sun, habitat, family, life_cycle, season,
  -- foliage_persistance, toxicity_human, toxicity_pets, living_space, composition, maintenance_level
  with inserted as (
    insert into public.plant_translations (
      plant_id,
      language,
      name,
      given_names,
      overview,
      allergens,
      symbolism,
      origin,
      advice_soil,
      advice_mulching,
      advice_fertilizer,
      advice_tutoring,
      advice_sowing,
      cut,
      advice_medicinal,
      advice_infusion,
      nutritional_intake,
      recipes_ideas,
      ground_effect,
      source_name,
      source_url,
      tags,
      spice_mixes,
      pests,
      diseases
    )
    select
      p.id,
      'en',
      p.name,
      coalesce(p.given_names, '{}'),
      p.overview,
      coalesce(p.allergens, '{}'),
      coalesce(p.symbolism, '{}'),
      coalesce(p.origin, '{}'),
      p.advice_soil,
      p.advice_mulching,
      p.advice_fertilizer,
      p.advice_tutoring,
      p.advice_sowing,
      p.cut,
      p.advice_medicinal,
      p.advice_infusion,
      coalesce(p.nutritional_intake, '{}'),
      coalesce(p.recipes_ideas, '{}'),
      p.ground_effect,
      p.source_name,
      p.source_url,
      coalesce(p.tags, '{}'),
      coalesce(p.spice_mixes, '{}'),
      coalesce(p.pests, '{}'),
      coalesce(p.diseases, '{}')
    from public.plants p
    where not exists (
      select 1 from public.plant_translations pt 
      where pt.plant_id = p.id and pt.language = 'en'
    )
    returning 1
  )
  select count(*) into migrated_count from inserted;
  
  if migrated_count > 0 then
    raise notice '[plant_translations] Migrated % plants to English translations', migrated_count;
  end if;
end $migrate_translations$;

-- ========== Remove translatable columns from plants table ==========
-- These columns have been migrated to plant_translations and are no longer needed
-- in the plants table. Only 'name' is kept as the canonical English name.
-- 
-- The following columns stay in plants table (NOT translated - they are enums, Latin names, or non-text):
--   promotion_month, scientific_name, family, life_cycle, season, foliage_persistance,
--   toxicity_human, toxicity_pets, living_space, composition, maintenance_level,
--   habitat, level_sun
--
-- The following columns ARE translated and only exist in plant_translations:
alter table if exists public.plants drop column if exists given_names;
alter table if exists public.plants drop column if exists overview;
alter table if exists public.plants drop column if exists allergens;
alter table if exists public.plants drop column if exists symbolism;
alter table if exists public.plants drop column if exists origin;
-- habitat and level_sun are enums - NOT translated, stay in plants table
alter table if exists public.plants drop column if exists advice_soil;
alter table if exists public.plants drop column if exists advice_mulching;
alter table if exists public.plants drop column if exists advice_fertilizer;
alter table if exists public.plants drop column if exists advice_tutoring;
alter table if exists public.plants drop column if exists advice_sowing;
alter table if exists public.plants drop column if exists cut;
alter table if exists public.plants drop column if exists advice_medicinal;
alter table if exists public.plants drop column if exists nutritional_intake;
alter table if exists public.plants drop column if exists advice_infusion;
alter table if exists public.plants drop column if exists recipes_ideas;
alter table if exists public.plants drop column if exists ground_effect;
alter table if exists public.plants drop column if exists source_name;
alter table if exists public.plants drop column if exists source_url;
alter table if exists public.plants drop column if exists tags;

-- Migrate spice_mixes, pests, diseases from plants to plant_translations for existing English translations
-- This handles plants that already have English translations but the new columns are empty
do $$
begin
  -- Only run if spice_mixes column still exists in plants table
  if exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'plants' and column_name = 'spice_mixes'
  ) then
    -- Update English translations with data from plants table where translation fields are empty
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
    
    raise notice '[plant_translations] Migrated spice_mixes, pests, diseases to English translations';
  end if;
end $$;

-- spice_mixes, pests, diseases are now translatable - drop from plants table
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

-- Ensure columns exist for existing deployments
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

-- Add constraints if they don't exist
do $$ begin
  -- Add check constraint for request_count
  if not exists (
    select 1 from pg_constraint 
    where conname = 'requested_plants_request_count_check'
  ) then
    alter table public.requested_plants 
      add constraint requested_plants_request_count_check 
      check (request_count > 0);
  end if;
  
    -- Add foreign key constraint if it doesn't exist
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

