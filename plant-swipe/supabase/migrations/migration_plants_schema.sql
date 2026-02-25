-- ============================================================================
-- APHYLIA: Plant Database Migration Script (Old Schema → New Schema)
-- ============================================================================
-- Safe to run multiple times (fully idempotent).
-- Run this BEFORE running the schema sync (sync_parts/03 + 04) to migrate
-- all existing data. The schema sync will then add new columns, update
-- constraints, and drop old columns cleanly.
--
-- COLUMN-LIMIT FIX: This script uses ALTER TABLE RENAME COLUMN instead of
-- ADD COLUMN + copy + DROP to avoid exceeding PostgreSQL's 1600-column limit.
-- Phase 0 drops all columns not needed for the final schema or migration.
--
-- This script migrates:
--   1. plants table: column renames, enum value mappings, type conversions
--   2. plant_translations table: column renames and data copies
--   3. plant_watering_schedules → plants watering frequency fields
--
-- Each section reports how many rows were affected.
-- ============================================================================

-- ============================================================================
-- PHASE 0: Drop obsolete columns to stay under PostgreSQL's 1600-column limit
-- ============================================================================
-- Drops ALL columns not in the final schema whitelist AND not needed as
-- migration sources. Must run first so subsequent phases can add columns.
do $phase0$ declare
  keep_columns constant text[] := array[
    -- Final schema whitelist
    'id','name',
    'scientific_name_species','scientific_name_variety','family','encyclopedia_category','featured_month',
    'climate','season','utility','edible_part','thorny','toxicity_human','toxicity_pets','poisoning_method',
    'life_cycle','average_lifespan','foliage_persistence','living_space','landscaping','plant_habit',
    'multicolor','bicolor',
    'care_level','sunlight','temperature_max','temperature_min','temperature_ideal',
    'watering_frequency_warm','watering_frequency_cold','watering_type','hygrometry','misting_frequency',
    'special_needs','substrate','substrate_mix','mulching_needed','mulch_type','nutrition_need','fertilizer',
    'sowing_month','flowering_month','fruiting_month','height_cm','wingspan_cm','staking',
    'division','cultivation_mode','sowing_method','transplanting','pruning','pruning_month',
    'conservation_status','ecological_status','biotopes','urban_biotopes','ecological_tolerance',
    'biodiversity_role','pollinators_attracted','birds_attracted','mammals_attracted',
    'ecological_management','ecological_impact',
    'infusion','infusion_parts','medicinal','aromatherapy','fragrance','edible_oil',
    'companion_plants','biotope_plants','beneficial_plants','harmful_plants','varieties','sponsored_shop_ids',
    'status','admin_commentary','user_notes','created_by','created_time','updated_by','updated_time',
    -- Old columns preserved as migration sources
    'scientific_name','plant_type','promotion_month','spiked','scent','tutoring',
    'companions','comestible_part','habitat','composition','level_sun','maintenance_level',
    'soil','mulching','sow_type','polenizer','melliferous','be_fertilizer','foliage_persistance'
  ];
  rec record;
  drop_count integer := 0;
begin
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='plants') then
    raise notice '❌ plants table not found — aborting';
    return;
  end if;
  raise notice '════════════════════════════════════════════════════════';
  raise notice '🧹 PHASE 0: Drop obsolete columns';
  raise notice '════════════════════════════════════════════════════════';
  for rec in
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'plants'
  loop
    if not (rec.column_name = any(keep_columns)) then
      execute format('alter table public.plants drop column if exists %I cascade', rec.column_name);
      drop_count := drop_count + 1;
    end if;
  end loop;
  raise notice '  Dropped % obsolete column(s)', drop_count;
end $phase0$;

-- Force a full table rewrite to physically reclaim dropped-column slots.
-- PostgreSQL DROP COLUMN only marks columns as invisible; they still count
-- toward the 1600-column hard limit. This no-op type change forces a rewrite.
alter table public.plants alter column id type text using id;

-- ============================================================================
-- PHASE 1: RENAME old columns to new names (zero net column change)
-- ============================================================================
-- Uses RENAME COLUMN for same-type renames. For type-change renames,
-- maps values in-place first, then renames, then alters the type.
do $phase1$ declare
  cnt integer;
  total_plants integer;
  total_translations integer;
  r record;
begin
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='plants') then
    raise notice '❌ plants table not found — aborting';
    return;
  end if;

  select count(*) into total_plants from public.plants;
  select count(*) into total_translations from public.plant_translations;
  raise notice '════════════════════════════════════════════════════════';
  raise notice '🌱 PHASE 1: Rename columns (plants: %, translations: %)', total_plants, total_translations;
  raise notice '════════════════════════════════════════════════════════';

  -- ── Same-type renames ──────────────────────────────────────────────────

  -- 1a. scientific_name (text) → scientific_name_species (text)
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='scientific_name')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='scientific_name_species')
  then
    for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'scientific_name') loop execute 'alter table public.plants drop constraint ' || quote_ident(r.conname); end loop;
    alter table public.plants rename column scientific_name to scientific_name_species;
    raise notice '  RENAME scientific_name → scientific_name_species';
  elsif exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='scientific_name') then
    update public.plants set scientific_name_species = scientific_name
      where scientific_name is not null and trim(scientific_name) <> ''
      and (scientific_name_species is null or trim(scientific_name_species) = '');
    get diagnostics cnt = row_count;
    raise notice '  COPY scientific_name → scientific_name_species: % rows', cnt;
  else
    raise notice '  scientific_name → scientific_name_species: skipped (old column gone)';
  end if;

  -- 1b. spiked (boolean) → thorny (boolean)
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='spiked')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='thorny')
  then
    for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'spiked') loop execute 'alter table public.plants drop constraint ' || quote_ident(r.conname); end loop;
    alter table public.plants rename column spiked to thorny;
    raise notice '  RENAME spiked → thorny';
  elsif exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='spiked') then
    update public.plants set thorny = spiked where spiked is not null and thorny is null;
    get diagnostics cnt = row_count;
    raise notice '  COPY spiked → thorny: % rows', cnt;
  else
    raise notice '  spiked → thorny: skipped';
  end if;

  -- 1c. scent (boolean) → fragrance (boolean)
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='scent')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='fragrance')
  then
    for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'scent') loop execute 'alter table public.plants drop constraint ' || quote_ident(r.conname); end loop;
    alter table public.plants rename column scent to fragrance;
    raise notice '  RENAME scent → fragrance';
  elsif exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='scent') then
    update public.plants set fragrance = scent where scent is not null and fragrance is null;
    get diagnostics cnt = row_count;
    raise notice '  COPY scent → fragrance: % rows', cnt;
  else
    raise notice '  scent → fragrance: skipped';
  end if;

  -- 1d. tutoring (boolean) → staking (boolean)
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='tutoring')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='staking')
  then
    for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'tutoring') loop execute 'alter table public.plants drop constraint ' || quote_ident(r.conname); end loop;
    alter table public.plants rename column tutoring to staking;
    raise notice '  RENAME tutoring → staking';
  elsif exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='tutoring') then
    update public.plants set staking = tutoring where tutoring is not null and staking is null;
    get diagnostics cnt = row_count;
    raise notice '  COPY tutoring → staking: % rows', cnt;
  else
    raise notice '  tutoring → staking: skipped';
  end if;

  -- 1e. companions (text[]) → companion_plants (text[])
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='companions')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='companion_plants')
  then
    for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'companions') loop execute 'alter table public.plants drop constraint ' || quote_ident(r.conname); end loop;
    alter table public.plants rename column companions to companion_plants;
    raise notice '  RENAME companions → companion_plants';
  elsif exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='companions') then
    update public.plants set companion_plants = companions
      where companions is not null and array_length(companions, 1) > 0
      and (companion_plants is null or array_length(companion_plants, 1) is null);
    get diagnostics cnt = row_count;
    raise notice '  COPY companions → companion_plants: % rows', cnt;
  else
    raise notice '  companions → companion_plants: skipped';
  end if;

  -- 1f. comestible_part (text[]) → edible_part (text[])
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='comestible_part')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='edible_part')
  then
    for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'comestible_part') loop execute 'alter table public.plants drop constraint ' || quote_ident(r.conname); end loop;
    alter table public.plants rename column comestible_part to edible_part;
    update public.plants set edible_part = array_replace(edible_part, 'root', 'rhizome')
      where edible_part is not null and 'root' = any(edible_part);
    get diagnostics cnt = row_count;
    raise notice '  RENAME comestible_part → edible_part (root→rhizome: % rows)', cnt;
  elsif exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='comestible_part') then
    update public.plants set edible_part = array_replace(comestible_part, 'root', 'rhizome')
      where comestible_part is not null and array_length(comestible_part, 1) > 0
      and (edible_part is null or array_length(edible_part, 1) is null);
    get diagnostics cnt = row_count;
    raise notice '  COPY comestible_part → edible_part: % rows (root→rhizome)', cnt;
  else
    raise notice '  comestible_part → edible_part: skipped';
  end if;

  -- 1g. habitat (text[]) → climate (text[]) with value mapping
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='habitat')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='climate')
  then
    for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'habitat') loop execute 'alter table public.plants drop constraint ' || quote_ident(r.conname); end loop;
    alter table public.plants rename column habitat to climate;
    update public.plants set climate = (
      select coalesce(array_agg(mapped), '{}'::text[]) from (
        select case
          when v = 'tropical' then 'tropical_humid'
          when v = 'temperate' then 'temperate_continental'
          when v = 'arid' then 'tropical_dry'
          when v = 'mediterranean' then 'mediterranean'
          when v = 'mountain' then 'montane'
          when v = 'coastal' then 'windswept_coastal'
          when v = 'oceanic' then 'oceanic'
          else null
        end as mapped
        from unnest(climate) as v
        where v not in ('aquatic','semi-aquatic','wetland','grassland','forest','urban')
      ) sub where mapped is not null
    )
    where climate is not null and array_length(climate, 1) > 0
      and climate && array['tropical','temperate','arid','mountain','coastal'];
    get diagnostics cnt = row_count;
    raise notice '  RENAME habitat → climate (value-mapped: % rows)', cnt;
  elsif exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='habitat') then
    update public.plants set climate = (
      select coalesce(array_agg(mapped), '{}'::text[]) from (
        select case
          when v = 'tropical' then 'tropical_humid'
          when v = 'temperate' then 'temperate_continental'
          when v = 'arid' then 'tropical_dry'
          when v = 'mediterranean' then 'mediterranean'
          when v = 'mountain' then 'montane'
          when v = 'coastal' then 'windswept_coastal'
          when v = 'oceanic' then 'oceanic'
          else null
        end as mapped
        from unnest(habitat) as v
        where v not in ('aquatic','semi-aquatic','wetland','grassland','forest','urban')
      ) sub where mapped is not null
    )
    where habitat is not null and array_length(habitat, 1) > 0
      and (climate is null or array_length(climate, 1) is null);
    get diagnostics cnt = row_count;
    raise notice '  COPY habitat → climate: % rows', cnt;
  else
    raise notice '  habitat → climate: skipped';
  end if;

  -- 1h. composition (text[]) → landscaping (text[]) with value mapping
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='composition')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='landscaping')
  then
    for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'composition') loop execute 'alter table public.plants drop constraint ' || quote_ident(r.conname); end loop;
    alter table public.plants rename column composition to landscaping;
    update public.plants set landscaping = (
      select coalesce(array_agg(case when v = 'ground cover' then 'ground_cover' else v end), '{}'::text[])
      from unnest(landscaping) as v
    )
    where landscaping is not null and array_length(landscaping, 1) > 0
      and landscaping && array['ground cover'];
    get diagnostics cnt = row_count;
    raise notice '  RENAME composition → landscaping (value-mapped: % rows)', cnt;
  elsif exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='composition') then
    update public.plants set landscaping = (
      select coalesce(array_agg(case when v = 'ground cover' then 'ground_cover' else v end), '{}'::text[])
      from unnest(composition) as v
    )
    where composition is not null and array_length(composition, 1) > 0
      and (landscaping is null or array_length(landscaping, 1) is null);
    get diagnostics cnt = row_count;
    raise notice '  COPY composition → landscaping: % rows', cnt;
  else
    raise notice '  composition → landscaping: skipped';
  end if;

  -- 1i. soil (text[]) → substrate (text[])
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='soil')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='substrate')
  then
    for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'soil') loop execute 'alter table public.plants drop constraint ' || quote_ident(r.conname); end loop;
    alter table public.plants rename column soil to substrate;
    raise notice '  RENAME soil → substrate';
  elsif exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='soil') then
    update public.plants set substrate = soil
      where soil is not null and array_length(soil, 1) > 0
      and (substrate is null or array_length(substrate, 1) is null);
    get diagnostics cnt = row_count;
    raise notice '  COPY soil → substrate: % rows', cnt;
  else
    raise notice '  soil → substrate: skipped';
  end if;

  -- 1j. mulching (text[]) → mulch_type (text[]) + mulching_needed (boolean)
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='mulching')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='mulch_type')
  then
    for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'mulching') loop execute 'alter table public.plants drop constraint ' || quote_ident(r.conname); end loop;
    alter table public.plants rename column mulching to mulch_type;
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='mulching_needed') then
      alter table public.plants add column mulching_needed boolean default false;
    end if;
    update public.plants set mulching_needed = true
      where mulch_type is not null and array_length(mulch_type, 1) > 0
      and (mulching_needed is null or mulching_needed = false);
    get diagnostics cnt = row_count;
    raise notice '  RENAME mulching → mulch_type + mulching_needed: % rows', cnt;
  elsif exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='mulching') then
    begin
      update public.plants set mulch_type = mulching
        where mulching is not null and array_length(mulching, 1) > 0
        and (mulch_type is null or array_length(mulch_type, 1) is null);
      get diagnostics cnt = row_count;
      update public.plants set mulching_needed = true
        where mulching is not null and array_length(mulching, 1) > 0
        and mulching_needed is null;
      raise notice '  COPY mulching → mulch_type + mulching_needed: % rows', cnt;
    exception when others then
      raise notice '  mulching → mulch_type: skipped (type mismatch)';
    end;
  else
    raise notice '  mulching → mulch_type: skipped';
  end if;

  -- 1k. sow_type (text[]) → sowing_method (text[]) with value mapping
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='sow_type')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='sowing_method')
  then
    for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'sow_type') loop execute 'alter table public.plants drop constraint ' || quote_ident(r.conname); end loop;
    alter table public.plants rename column sow_type to sowing_method;
    update public.plants set sowing_method = (
      select coalesce(array_agg(case
        when v = 'direct' then 'open_ground'
        when v = 'indoor' then 'greenhouse'
        when v = 'seed tray' then 'tray'
        when v = 'cell' then 'tray'
        else v
      end), '{}'::text[])
      from unnest(sowing_method) as v
    )
    where sowing_method is not null and array_length(sowing_method, 1) > 0
      and sowing_method && array['direct','indoor','seed tray','cell'];
    get diagnostics cnt = row_count;
    raise notice '  RENAME sow_type → sowing_method (value-mapped: % rows)', cnt;
  elsif exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='sow_type') then
    update public.plants set sowing_method = (
      select coalesce(array_agg(case
        when v = 'direct' then 'open_ground'
        when v = 'indoor' then 'greenhouse'
        when v = 'seed tray' then 'tray'
        when v = 'cell' then 'tray'
        else v
      end), '{}'::text[])
      from unnest(sow_type) as v
    )
    where sow_type is not null and array_length(sow_type, 1) > 0
      and (sowing_method is null or array_length(sowing_method, 1) is null);
    get diagnostics cnt = row_count;
    raise notice '  COPY sow_type → sowing_method: % rows', cnt;
  else
    raise notice '  sow_type → sowing_method: skipped';
  end if;

  -- 1l. polenizer (text[]) → pollinators_attracted (text[])
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='polenizer')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='pollinators_attracted')
  then
    for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'polenizer') loop execute 'alter table public.plants drop constraint ' || quote_ident(r.conname); end loop;
    alter table public.plants rename column polenizer to pollinators_attracted;
    raise notice '  RENAME polenizer → pollinators_attracted';
  elsif exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='polenizer') then
    update public.plants set pollinators_attracted = polenizer
      where polenizer is not null and array_length(polenizer, 1) > 0
      and (pollinators_attracted is null or array_length(pollinators_attracted, 1) is null);
    get diagnostics cnt = row_count;
    raise notice '  COPY polenizer → pollinators_attracted: % rows', cnt;
  else
    raise notice '  polenizer → pollinators_attracted: skipped';
  end if;

  -- 1m. foliage_persistance → foliage_persistence with value mapping
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='foliage_persistance')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='foliage_persistence')
  then
    -- Drop constraints before rename (they reference the old name)
    for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'foliage_persistance') loop
      execute 'alter table public.plants drop constraint ' || quote_ident(r.conname);
    end loop;
    alter table public.plants rename column foliage_persistance to foliage_persistence;
    update public.plants set foliage_persistence = (
      select coalesce(array_agg(case when v = 'semi-evergreen' then 'semi_evergreen' else v end), '{}'::text[])
      from unnest(foliage_persistence) as v
    )
    where foliage_persistence is not null and array_length(foliage_persistence, 1) > 0
      and foliage_persistence && array['semi-evergreen'];
    get diagnostics cnt = row_count;
    raise notice '  RENAME foliage_persistance → foliage_persistence (value-mapped: % rows)', cnt;
  elsif exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='foliage_persistance') then
    update public.plants set foliage_persistence = (
      select coalesce(array_agg(case when v = 'semi-evergreen' then 'semi_evergreen' else v end), '{}'::text[])
      from unnest(foliage_persistance) as v
    )
    where foliage_persistance is not null
      and (foliage_persistence is null or array_length(foliage_persistence, 1) is null);
    get diagnostics cnt = row_count;
    raise notice '  COPY foliage_persistance → foliage_persistence: % rows', cnt;
  else
    raise notice '  foliage_persistance → foliage_persistence: skipped';
  end if;

  -- ── Type-change renames (text → text[]) ────────────────────────────────

  -- 1n. plant_type (text) → encyclopedia_category (text[])
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='plant_type')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='encyclopedia_category')
  then
    update public.plants set plant_type = case
      when plant_type = 'tree' then 'tree'
      when plant_type = 'shrub' then 'shrub'
      when plant_type = 'bamboo' then 'bamboo'
      when plant_type = 'cactus' then 'cactus_succulent'
      when plant_type = 'succulent' then 'cactus_succulent'
      when plant_type = 'flower' then 'perennial_plant'
      when plant_type = 'plant' then 'herbaceous'
      else plant_type
    end where plant_type is not null;
    for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'plant_type') loop
      execute 'alter table public.plants drop constraint ' || quote_ident(r.conname);
    end loop;
    alter table public.plants rename column plant_type to encyclopedia_category;
    alter table public.plants alter column encyclopedia_category type text[]
      using case when encyclopedia_category is not null and trim(encyclopedia_category::text) <> '' then array[encyclopedia_category::text] else '{}'::text[] end;
    alter table public.plants alter column encyclopedia_category set default '{}'::text[];
    begin alter table public.plants alter column encyclopedia_category set not null; exception when others then null; end;
    raise notice '  RENAME+RETYPE plant_type → encyclopedia_category (text → text[])';
  elsif exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='plant_type') then
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='encyclopedia_category') then
      alter table public.plants add column encyclopedia_category text[] not null default '{}'::text[];
    end if;
    update public.plants set encyclopedia_category = case
      when plant_type = 'tree' then array['tree']
      when plant_type = 'shrub' then array['shrub']
      when plant_type = 'bamboo' then array['bamboo']
      when plant_type = 'cactus' then array['cactus_succulent']
      when plant_type = 'succulent' then array['cactus_succulent']
      when plant_type = 'flower' then array['perennial_plant']
      when plant_type = 'plant' then array['herbaceous']
      else '{}'::text[]
    end where plant_type is not null
      and (encyclopedia_category is null or array_length(encyclopedia_category, 1) is null);
    get diagnostics cnt = row_count;
    raise notice '  COPY plant_type → encyclopedia_category: % rows', cnt;
  else
    raise notice '  plant_type → encyclopedia_category: skipped';
  end if;

  -- 1o. promotion_month (text) → featured_month (text[])
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='promotion_month')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='featured_month')
  then
    for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'promotion_month') loop
      execute 'alter table public.plants drop constraint ' || quote_ident(r.conname);
    end loop;
    alter table public.plants rename column promotion_month to featured_month;
    alter table public.plants alter column featured_month type text[]
      using case when featured_month is not null and trim(featured_month::text) <> '' then array[featured_month::text] else '{}'::text[] end;
    alter table public.plants alter column featured_month set default '{}'::text[];
    begin alter table public.plants alter column featured_month set not null; exception when others then null; end;
    raise notice '  RENAME+RETYPE promotion_month → featured_month (text → text[])';
  elsif exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='promotion_month') then
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='featured_month') then
      alter table public.plants add column featured_month text[] not null default '{}'::text[];
    end if;
    update public.plants set featured_month = array[promotion_month]
      where promotion_month is not null
      and (featured_month is null or array_length(featured_month, 1) is null);
    get diagnostics cnt = row_count;
    raise notice '  COPY promotion_month → featured_month: % rows', cnt;
  else
    raise notice '  promotion_month → featured_month: skipped';
  end if;

  -- 1p. level_sun (text) → sunlight (text[])
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='level_sun')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='sunlight')
  then
    update public.plants set level_sun = case
      when level_sun = 'low light' then 'low_light'
      when level_sun = 'shade' then 'deep_shade'
      when level_sun = 'partial sun' then 'partial_sun'
      when level_sun = 'full sun' then 'full_sun'
      else level_sun
    end where level_sun is not null;
    for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'level_sun') loop
      execute 'alter table public.plants drop constraint ' || quote_ident(r.conname);
    end loop;
    alter table public.plants rename column level_sun to sunlight;
    alter table public.plants alter column sunlight type text[]
      using case when sunlight is not null and trim(sunlight::text) <> '' then array[sunlight::text] else '{}'::text[] end;
    alter table public.plants alter column sunlight set default '{}'::text[];
    begin alter table public.plants alter column sunlight set not null; exception when others then null; end;
    raise notice '  RENAME+RETYPE level_sun → sunlight (text → text[])';
  elsif exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='level_sun') then
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='sunlight') then
      alter table public.plants add column sunlight text[] not null default '{}'::text[];
    end if;
    update public.plants set sunlight = array[case
      when level_sun = 'low light' then 'low_light'
      when level_sun = 'shade' then 'deep_shade'
      when level_sun = 'partial sun' then 'partial_sun'
      when level_sun = 'full sun' then 'full_sun'
      else level_sun
    end]
    where level_sun is not null and (sunlight is null or array_length(sunlight, 1) is null);
    get diagnostics cnt = row_count;
    raise notice '  COPY level_sun → sunlight: % rows', cnt;
  else
    raise notice '  level_sun → sunlight: skipped';
  end if;

  -- 1q. maintenance_level (text) → care_level (text[])
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='maintenance_level')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='care_level')
  then
    update public.plants set maintenance_level = case
      when maintenance_level in ('none','low') then 'easy'
      when maintenance_level = 'moderate' then 'moderate'
      when maintenance_level = 'heavy' then 'complex'
      else maintenance_level
    end where maintenance_level is not null;
    for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'maintenance_level') loop
      execute 'alter table public.plants drop constraint ' || quote_ident(r.conname);
    end loop;
    alter table public.plants rename column maintenance_level to care_level;
    alter table public.plants alter column care_level type text[]
      using case when care_level is not null and trim(care_level::text) <> '' then array[care_level::text] else '{}'::text[] end;
    alter table public.plants alter column care_level set default '{}'::text[];
    begin alter table public.plants alter column care_level set not null; exception when others then null; end;
    raise notice '  RENAME+RETYPE maintenance_level → care_level (text → text[])';
  elsif exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='maintenance_level') then
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='care_level') then
      alter table public.plants add column care_level text[] not null default '{}'::text[];
    end if;
    update public.plants set care_level = array[case
      when maintenance_level in ('none','low') then 'easy'
      when maintenance_level = 'moderate' then 'moderate'
      when maintenance_level = 'heavy' then 'complex'
      else maintenance_level
    end]
    where maintenance_level is not null and (care_level is null or array_length(care_level, 1) is null);
    get diagnostics cnt = row_count;
    raise notice '  COPY maintenance_level → care_level: % rows', cnt;
  else
    raise notice '  maintenance_level → care_level: skipped';
  end if;

  -- ── Merge columns ──────────────────────────────────────────────────────

  -- 1r. melliferous + be_fertilizer → biodiversity_role
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='biodiversity_role') then
    alter table public.plants add column biodiversity_role text[] not null default '{}'::text[];
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='melliferous') then
    update public.plants set biodiversity_role = array_append(coalesce(biodiversity_role, '{}'), 'melliferous')
      where melliferous = true and not ('melliferous' = any(coalesce(biodiversity_role, '{}')));
    get diagnostics cnt = row_count;
    raise notice '  melliferous=true → biodiversity_role +melliferous: % rows', cnt;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='be_fertilizer') then
    update public.plants set biodiversity_role = array_append(coalesce(biodiversity_role, '{}'), 'green_manure')
      where be_fertilizer = true and not ('green_manure' = any(coalesce(biodiversity_role, '{}')));
    get diagnostics cnt = row_count;
    raise notice '  be_fertilizer=true → biodiversity_role +green_manure: % rows', cnt;
  end if;

end $phase1$;

-- ============================================================================
-- PHASE 2: In-place enum value migrations (no column changes)
-- ============================================================================
do $phase2$ declare
  cnt integer;
begin
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='plants') then
    return;
  end if;

  raise notice '════════════════════════════════════════════════════════';
  raise notice '🔄 PHASE 2: Enum value migrations';
  raise notice '════════════════════════════════════════════════════════';

  -- utility: comestible→edible, ornemental→ornamental, odorous→fragrant
  update public.plants set utility = (
    select coalesce(array_agg(mapped), '{}'::text[]) from (
      select case
        when v = 'comestible' then 'edible'
        when v = 'ornemental' then 'ornamental'
        when v = 'odorous' then 'fragrant'
        when v in ('produce_fruit','climbing') then null
        else v
      end as mapped
      from unnest(utility) as v
    ) sub where mapped is not null
  )
  where utility is not null and array_length(utility, 1) > 0
    and utility && array['comestible','ornemental','odorous','produce_fruit','climbing'];
  get diagnostics cnt = row_count;
  raise notice '  utility (comestible→edible, ornemental→ornamental, odorous→fragrant): % rows', cnt;

  -- toxicity_human
  update public.plants set toxicity_human = case
    when toxicity_human = 'non-toxic' then 'non_toxic'
    when toxicity_human = 'midly irritating' then 'slightly_toxic'
    when toxicity_human = 'highly toxic' then 'very_toxic'
    when toxicity_human = 'lethally toxic' then 'deadly'
    else toxicity_human
  end where toxicity_human in ('non-toxic','midly irritating','highly toxic','lethally toxic');
  get diagnostics cnt = row_count;
  raise notice '  toxicity_human: % rows', cnt;

  -- toxicity_pets
  update public.plants set toxicity_pets = case
    when toxicity_pets = 'non-toxic' then 'non_toxic'
    when toxicity_pets = 'midly irritating' then 'slightly_toxic'
    when toxicity_pets = 'highly toxic' then 'very_toxic'
    when toxicity_pets = 'lethally toxic' then 'deadly'
    else toxicity_pets
  end where toxicity_pets in ('non-toxic','midly irritating','highly toxic','lethally toxic');
  get diagnostics cnt = row_count;
  raise notice '  toxicity_pets: % rows', cnt;

  -- watering_type
  update public.plants set watering_type = (
    select coalesce(array_agg(case
      when v = 'buried' then 'drip'
      when v = 'drop' then 'drip'
      when v = 'drench' then 'soaking'
      else v
    end), '{}'::text[])
    from unnest(watering_type) as v
  )
  where watering_type is not null and array_length(watering_type, 1) > 0
    and watering_type && array['buried','drop','drench'];
  get diagnostics cnt = row_count;
  raise notice '  watering_type (buried/drop→drip, drench→soaking): % rows', cnt;

  -- division
  update public.plants set division = (
    select coalesce(array_agg(case
      when v = 'division' then 'clump_division'
      when v = 'tissue separation' then 'clump_division'
      when v = 'bulb separation' then 'bulb_division'
      else v
    end), '{}'::text[])
    from unnest(division) as v
  )
  where division is not null and array_length(division, 1) > 0
    and division && array['division','tissue separation','bulb separation'];
  get diagnostics cnt = row_count;
  raise notice '  division: % rows', cnt;

  -- status typo fix
  update public.plants set status = 'in_progress' where status = 'in progres';
  get diagnostics cnt = row_count;
  raise notice '  status ("in progres" → "in_progress"): % rows', cnt;

end $phase2$;

-- ============================================================================
-- PHASE 3: Type conversions (text → text[]) for columns keeping the same name
-- ============================================================================
do $phase3$ declare
  r record;
begin
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='plants') then
    return;
  end if;

  raise notice '════════════════════════════════════════════════════════';
  raise notice '🔀 PHASE 3: Type conversions (text → text[])';
  raise notice '════════════════════════════════════════════════════════';

  -- conservation_status text → text[]
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='plants' and column_name='conservation_status'
    and data_type = 'text' and udt_name = 'text'
  ) then
    for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'conservation_status') loop
      execute 'alter table public.plants drop constraint ' || quote_ident(r.conname);
    end loop;
    update public.plants set conservation_status = case
      when conservation_status::text = 'safe' then 'least_concern'
      when conservation_status::text = 'at risk' then 'near_threatened'
      when conservation_status::text = 'critically endangered' then 'critically_endangered'
      else conservation_status::text
    end where conservation_status is not null;
    alter table public.plants alter column conservation_status type text[]
      using case when conservation_status is not null then array[conservation_status::text] else '{}'::text[] end;
    alter table public.plants alter column conservation_status set default '{}'::text[];
    alter table public.plants alter column conservation_status set not null;
    raise notice '  conservation_status: text → text[] (safe→least_concern, at risk→near_threatened)';
  else
    raise notice '  conservation_status: skipped (already text[] or missing)';
  end if;

  -- life_cycle text → text[]
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='plants' and column_name='life_cycle'
    and data_type = 'text' and udt_name = 'text'
  ) then
    for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'life_cycle') loop
      execute 'alter table public.plants drop constraint ' || quote_ident(r.conname);
    end loop;
    update public.plants set life_cycle = case
      when life_cycle::text = 'biennials' then 'biennial'
      when life_cycle::text = 'perenials' then 'perennial'
      when life_cycle::text = 'ephemerals' then 'ephemeral'
      when life_cycle::text = 'polycarpic' then 'perennial'
      else life_cycle::text
    end where life_cycle is not null;
    alter table public.plants alter column life_cycle type text[]
      using case when life_cycle is not null then array[life_cycle::text] else '{}'::text[] end;
    alter table public.plants alter column life_cycle set default '{}'::text[];
    alter table public.plants alter column life_cycle set not null;
    raise notice '  life_cycle: text → text[] (biennials→biennial, perenials→perennial)';
  else
    raise notice '  life_cycle: skipped (already text[] or missing)';
  end if;

  -- living_space text → text[]
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='plants' and column_name='living_space'
    and data_type = 'text' and udt_name = 'text'
  ) then
    for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'living_space') loop
      execute 'alter table public.plants drop constraint ' || quote_ident(r.conname);
    end loop;
    alter table public.plants alter column living_space type text[]
      using case when living_space is not null then array[living_space::text] else '{}'::text[] end;
    alter table public.plants alter column living_space set default '{}'::text[];
    alter table public.plants alter column living_space set not null;
    raise notice '  living_space: text → text[]';
  else
    raise notice '  living_space: skipped (already text[] or missing)';
  end if;

end $phase3$;

-- ============================================================================
-- PHASE 4: Watering schedules → frequency fields
-- ============================================================================
do $phase4$ declare
  cnt integer;
begin
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='plants') then
    return;
  end if;

  raise notice '════════════════════════════════════════════════════════';
  raise notice '💧 PHASE 4: Watering schedules → frequency fields';
  raise notice '════════════════════════════════════════════════════════';

  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='watering_frequency_warm') then
    alter table public.plants add column watering_frequency_warm integer;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='watering_frequency_cold') then
    alter table public.plants add column watering_frequency_cold integer;
  end if;

  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='plant_watering_schedules') then
    update public.plants p set watering_frequency_warm = sub.qty
    from (
      select plant_id, avg(quantity)::integer as qty
      from public.plant_watering_schedules
      where season in ('spring','summer') and quantity is not null and time_period = 'week'
      group by plant_id
    ) sub
    where p.id = sub.plant_id and p.watering_frequency_warm is null;
    get diagnostics cnt = row_count;
    raise notice '  watering_schedules (spring/summer) → watering_frequency_warm: % rows', cnt;

    update public.plants p set watering_frequency_cold = sub.qty
    from (
      select plant_id, avg(quantity)::integer as qty
      from public.plant_watering_schedules
      where season in ('autumn','winter') and quantity is not null and time_period = 'week'
      group by plant_id
    ) sub
    where p.id = sub.plant_id and p.watering_frequency_cold is null;
    get diagnostics cnt = row_count;
    raise notice '  watering_schedules (autumn/winter) → watering_frequency_cold: % rows', cnt;
  else
    raise notice '  plant_watering_schedules table not found, skipping';
  end if;

end $phase4$;

-- ============================================================================
-- PHASE 5: plant_translations column renames
-- ============================================================================
do $phase5$ declare
  cnt integer;
begin
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='plant_translations') then
    raise notice '  plant_translations table not found, skipping';
    return;
  end if;

  raise notice '════════════════════════════════════════════════════════';
  raise notice '🌐 PHASE 5: plant_translations column renames';
  raise notice '════════════════════════════════════════════════════════';

  -- given_names → common_names
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='given_names')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='common_names')
  then
    alter table public.plant_translations rename column given_names to common_names;
    raise notice '  RENAME given_names → common_names';
  elsif exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='given_names') then
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='common_names') then
      alter table public.plant_translations add column common_names text[] not null default '{}';
    end if;
    update public.plant_translations set common_names = given_names
      where given_names is not null and array_length(given_names, 1) > 0
      and (common_names is null or array_length(common_names, 1) is null);
    get diagnostics cnt = row_count;
    raise notice '  COPY given_names → common_names: % rows', cnt;
  else
    raise notice '  given_names → common_names: skipped';
  end if;

  -- overview → presentation
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='overview')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='presentation')
  then
    alter table public.plant_translations rename column overview to presentation;
    raise notice '  RENAME overview → presentation';
  elsif exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='overview') then
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='presentation') then
      alter table public.plant_translations add column presentation text;
    end if;
    update public.plant_translations set presentation = overview
      where overview is not null and trim(overview) <> ''
      and (presentation is null or trim(presentation) = '');
    get diagnostics cnt = row_count;
    raise notice '  COPY overview → presentation: % rows', cnt;
  else
    raise notice '  overview → presentation: skipped';
  end if;

  -- advice_soil → soil_advice
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='advice_soil')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='soil_advice')
  then
    alter table public.plant_translations rename column advice_soil to soil_advice;
    raise notice '  RENAME advice_soil → soil_advice';
  elsif exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='advice_soil') then
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='soil_advice') then
      alter table public.plant_translations add column soil_advice text;
    end if;
    update public.plant_translations set soil_advice = advice_soil
      where advice_soil is not null and trim(advice_soil) <> ''
      and (soil_advice is null or trim(soil_advice) = '');
    get diagnostics cnt = row_count;
    raise notice '  COPY advice_soil → soil_advice: % rows', cnt;
  else
    raise notice '  advice_soil → soil_advice: skipped';
  end if;

  -- advice_mulching → mulch_advice
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='advice_mulching')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='mulch_advice')
  then
    alter table public.plant_translations rename column advice_mulching to mulch_advice;
    raise notice '  RENAME advice_mulching → mulch_advice';
  elsif exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='advice_mulching') then
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='mulch_advice') then
      alter table public.plant_translations add column mulch_advice text;
    end if;
    update public.plant_translations set mulch_advice = advice_mulching
      where advice_mulching is not null and trim(advice_mulching) <> ''
      and (mulch_advice is null or trim(mulch_advice) = '');
    get diagnostics cnt = row_count;
    raise notice '  COPY advice_mulching → mulch_advice: % rows', cnt;
  else
    raise notice '  advice_mulching → mulch_advice: skipped';
  end if;

  -- advice_fertilizer → fertilizer_advice
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='advice_fertilizer')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='fertilizer_advice')
  then
    alter table public.plant_translations rename column advice_fertilizer to fertilizer_advice;
    raise notice '  RENAME advice_fertilizer → fertilizer_advice';
  elsif exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='advice_fertilizer') then
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='fertilizer_advice') then
      alter table public.plant_translations add column fertilizer_advice text;
    end if;
    update public.plant_translations set fertilizer_advice = advice_fertilizer
      where advice_fertilizer is not null and trim(advice_fertilizer) <> ''
      and (fertilizer_advice is null or trim(fertilizer_advice) = '');
    get diagnostics cnt = row_count;
    raise notice '  COPY advice_fertilizer → fertilizer_advice: % rows', cnt;
  else
    raise notice '  advice_fertilizer → fertilizer_advice: skipped';
  end if;

  -- advice_tutoring → staking_advice
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='advice_tutoring')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='staking_advice')
  then
    alter table public.plant_translations rename column advice_tutoring to staking_advice;
    raise notice '  RENAME advice_tutoring → staking_advice';
  elsif exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='advice_tutoring') then
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='staking_advice') then
      alter table public.plant_translations add column staking_advice text;
    end if;
    update public.plant_translations set staking_advice = advice_tutoring
      where advice_tutoring is not null and trim(advice_tutoring) <> ''
      and (staking_advice is null or trim(staking_advice) = '');
    get diagnostics cnt = row_count;
    raise notice '  COPY advice_tutoring → staking_advice: % rows', cnt;
  else
    raise notice '  advice_tutoring → staking_advice: skipped';
  end if;

  -- advice_sowing → sowing_advice
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='advice_sowing')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='sowing_advice')
  then
    alter table public.plant_translations rename column advice_sowing to sowing_advice;
    raise notice '  RENAME advice_sowing → sowing_advice';
  elsif exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='advice_sowing') then
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='sowing_advice') then
      alter table public.plant_translations add column sowing_advice text;
    end if;
    update public.plant_translations set sowing_advice = advice_sowing
      where advice_sowing is not null and trim(advice_sowing) <> ''
      and (sowing_advice is null or trim(sowing_advice) = '');
    get diagnostics cnt = row_count;
    raise notice '  COPY advice_sowing → sowing_advice: % rows', cnt;
  else
    raise notice '  advice_sowing → sowing_advice: skipped';
  end if;

  -- cut → pruning_advice
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='cut')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='pruning_advice')
  then
    alter table public.plant_translations rename column cut to pruning_advice;
    raise notice '  RENAME cut → pruning_advice';
  elsif exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='cut') then
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='pruning_advice') then
      alter table public.plant_translations add column pruning_advice text;
    end if;
    update public.plant_translations set pruning_advice = cut
      where cut is not null and trim(cut) <> ''
      and (pruning_advice is null or trim(pruning_advice) = '');
    get diagnostics cnt = row_count;
    raise notice '  COPY cut → pruning_advice: % rows', cnt;
  else
    raise notice '  cut → pruning_advice: skipped';
  end if;

  -- advice_medicinal → medicinal_warning
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='advice_medicinal')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='medicinal_warning')
  then
    alter table public.plant_translations rename column advice_medicinal to medicinal_warning;
    raise notice '  RENAME advice_medicinal → medicinal_warning';
  elsif exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='advice_medicinal') then
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='medicinal_warning') then
      alter table public.plant_translations add column medicinal_warning text;
    end if;
    update public.plant_translations set medicinal_warning = advice_medicinal
      where advice_medicinal is not null and trim(advice_medicinal) <> ''
      and (medicinal_warning is null or trim(medicinal_warning) = '');
    get diagnostics cnt = row_count;
    raise notice '  COPY advice_medicinal → medicinal_warning: % rows', cnt;
  else
    raise notice '  advice_medicinal → medicinal_warning: skipped';
  end if;

  -- advice_infusion → infusion_benefits
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='advice_infusion')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='infusion_benefits')
  then
    alter table public.plant_translations rename column advice_infusion to infusion_benefits;
    raise notice '  RENAME advice_infusion → infusion_benefits';
  elsif exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='advice_infusion') then
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='infusion_benefits') then
      alter table public.plant_translations add column infusion_benefits text;
    end if;
    update public.plant_translations set infusion_benefits = advice_infusion
      where advice_infusion is not null and trim(advice_infusion) <> ''
      and (infusion_benefits is null or trim(infusion_benefits) = '');
    get diagnostics cnt = row_count;
    raise notice '  COPY advice_infusion → infusion_benefits: % rows', cnt;
  else
    raise notice '  advice_infusion → infusion_benefits: skipped';
  end if;

  -- nutritional_intake (text[]) → nutritional_value (text)
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='nutritional_intake') then
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='nutritional_value') then
      alter table public.plant_translations add column nutritional_value text;
    end if;
    update public.plant_translations set nutritional_value = array_to_string(nutritional_intake, ', ')
      where nutritional_intake is not null and array_length(nutritional_intake, 1) > 0
      and (nutritional_value is null or trim(nutritional_value) = '');
    get diagnostics cnt = row_count;
    raise notice '  nutritional_intake → nutritional_value (text[] → text): % rows', cnt;
  else
    raise notice '  nutritional_intake → nutritional_value: skipped';
  end if;

  -- tags → plant_tags
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='tags')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='plant_tags')
  then
    alter table public.plant_translations rename column tags to plant_tags;
    raise notice '  RENAME tags → plant_tags';
  elsif exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='tags') then
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='plant_tags') then
      alter table public.plant_translations add column plant_tags text[] not null default '{}';
    end if;
    update public.plant_translations set plant_tags = tags
      where tags is not null and array_length(tags, 1) > 0
      and (plant_tags is null or array_length(plant_tags, 1) is null);
    get diagnostics cnt = row_count;
    raise notice '  COPY tags → plant_tags: % rows', cnt;
  else
    raise notice '  tags → plant_tags: skipped';
  end if;

end $phase5$;

-- ============================================================================
-- DONE
-- ============================================================================
do $done$
begin
  raise notice '════════════════════════════════════════════════════════';
  raise notice '✅ MIGRATION COMPLETE';
  raise notice '════════════════════════════════════════════════════════';
  raise notice 'Next step: Run schema sync (sync_parts 01-15) to finalize';
  raise notice '  - New columns will be created';
  raise notice '  - New check constraints will be applied';
  raise notice '  - Old columns will be dropped by the column whitelist';
  raise notice '════════════════════════════════════════════════════════';
end $done$;
