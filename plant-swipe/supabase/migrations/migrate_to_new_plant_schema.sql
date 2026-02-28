-- ============================================================================
-- APHYLIA: Plant Database Migration Script (Old Schema → New Schema)
-- ============================================================================
-- Safe to run multiple times (fully idempotent).
-- Run this BEFORE running the schema sync (sync_parts/03 + 04) to migrate
-- all existing data. The schema sync will then add new columns, update
-- constraints, and drop old columns cleanly.
--
-- This script migrates:
--   1. plants table: column renames, enum value mappings, type conversions
--   2. plant_translations table: column renames and data copies
--   3. plant_watering_schedules → plants watering frequency fields
--
-- Each section reports how many rows were affected.
-- ============================================================================

do $full_migration$
declare
  cnt integer;
  total_plants integer;
  total_translations integer;
begin
  -- Verify tables exist
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='plants') then
    raise notice '❌ plants table not found — aborting migration';
    return;
  end if;

  select count(*) into total_plants from public.plants;
  select count(*) into total_translations from public.plant_translations;
  raise notice '========================================================';
  raise notice '🌱 APHYLIA PLANT SCHEMA MIGRATION';
  raise notice '========================================================';
  raise notice 'Plants to migrate: %', total_plants;
  raise notice 'Translations to migrate: %', total_translations;
  raise notice '========================================================';

  -- ======================================================================
  -- SECTION 1: PLANTS TABLE — Column renames (old → new)
  -- ======================================================================
  raise notice '';
  raise notice '── PLANTS TABLE: Column Renames ──';

  -- 1a. scientific_name → scientific_name_species
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='scientific_name') then
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='scientific_name_species') then
      alter table public.plants add column scientific_name_species text;
    end if;
    get diagnostics cnt = row_count;
    update public.plants set scientific_name_species = scientific_name
      where scientific_name is not null and trim(scientific_name) <> ''
      and (scientific_name_species is null or trim(scientific_name_species) = '');
    get diagnostics cnt = row_count;
    raise notice '  scientific_name → scientific_name_species: % rows', cnt;
  else
    raise notice '  scientific_name → scientific_name_species: skipped (old column gone)';
  end if;

  -- 1b. plant_type → encyclopedia_category
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='plant_type') then
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
    raise notice '  plant_type → encyclopedia_category: % rows', cnt;
  else
    raise notice '  plant_type → encyclopedia_category: skipped (old column gone)';
  end if;

  -- 1c. promotion_month (text) → featured_month (text[])
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='promotion_month') then
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='featured_month') then
      alter table public.plants add column featured_month text[] not null default '{}'::text[];
    end if;
    update public.plants set featured_month = array[promotion_month]
      where promotion_month is not null
      and (featured_month is null or array_length(featured_month, 1) is null);
    get diagnostics cnt = row_count;
    raise notice '  promotion_month → featured_month: % rows', cnt;
  else
    raise notice '  promotion_month → featured_month: skipped (old column gone)';
  end if;

  -- 1d. spiked → thorny
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='spiked') then
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='thorny') then
      alter table public.plants add column thorny boolean default false;
    end if;
    update public.plants set thorny = spiked where spiked is not null and thorny is null;
    get diagnostics cnt = row_count;
    raise notice '  spiked → thorny: % rows', cnt;
  else
    raise notice '  spiked → thorny: skipped (old column gone)';
  end if;

  -- 1e. scent → fragrance
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='scent') then
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='fragrance') then
      alter table public.plants add column fragrance boolean default false;
    end if;
    update public.plants set fragrance = scent where scent is not null and fragrance is null;
    get diagnostics cnt = row_count;
    raise notice '  scent → fragrance: % rows', cnt;
  else
    raise notice '  scent → fragrance: skipped (old column gone)';
  end if;

  -- 1f. tutoring → staking
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='tutoring') then
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='staking') then
      alter table public.plants add column staking boolean default false;
    end if;
    update public.plants set staking = tutoring where tutoring is not null and staking is null;
    get diagnostics cnt = row_count;
    raise notice '  tutoring → staking: % rows', cnt;
  else
    raise notice '  tutoring → staking: skipped (old column gone)';
  end if;

  -- 1g. companions → companion_plants
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='companions') then
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='companion_plants') then
      alter table public.plants add column companion_plants text[] not null default '{}'::text[];
    end if;
    update public.plants set companion_plants = companions
      where companions is not null and array_length(companions, 1) > 0
      and (companion_plants is null or array_length(companion_plants, 1) is null);
    get diagnostics cnt = row_count;
    raise notice '  companions → companion_plants: % rows', cnt;
  else
    raise notice '  companions → companion_plants: skipped (old column gone)';
  end if;

  -- 1h. comestible_part → edible_part (root → rhizome)
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='comestible_part') then
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='edible_part') then
      alter table public.plants add column edible_part text[] not null default '{}'::text[];
    end if;
    update public.plants set edible_part = array_replace(comestible_part, 'root', 'rhizome')
      where comestible_part is not null and array_length(comestible_part, 1) > 0
      and (edible_part is null or array_length(edible_part, 1) is null);
    get diagnostics cnt = row_count;
    raise notice '  comestible_part → edible_part: % rows (root→rhizome)', cnt;
  else
    raise notice '  comestible_part → edible_part: skipped (old column gone)';
  end if;

  -- 1i. habitat → climate (value mapping)
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='habitat') then
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='climate') then
      alter table public.plants add column climate text[] not null default '{}'::text[];
    end if;
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
    raise notice '  habitat → climate: % rows', cnt;
  else
    raise notice '  habitat → climate: skipped (old column gone)';
  end if;

  -- 1j. composition → landscaping (value mapping)
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='composition') then
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='landscaping') then
      alter table public.plants add column landscaping text[] not null default '{}'::text[];
    end if;
    update public.plants set landscaping = (
      select coalesce(array_agg(case
        when v = 'ground cover' then 'ground_cover'
        else v
      end), '{}'::text[])
      from unnest(composition) as v
    )
    where composition is not null and array_length(composition, 1) > 0
      and (landscaping is null or array_length(landscaping, 1) is null);
    get diagnostics cnt = row_count;
    raise notice '  composition → landscaping: % rows', cnt;
  else
    raise notice '  composition → landscaping: skipped (old column gone)';
  end if;

  -- 1k. level_sun (text) → sunlight (text[])
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='level_sun') then
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
    raise notice '  level_sun → sunlight: % rows', cnt;
  else
    raise notice '  level_sun → sunlight: skipped (old column gone)';
  end if;

  -- 1l. maintenance_level (text) → care_level (text[])
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='maintenance_level') then
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
    raise notice '  maintenance_level → care_level: % rows', cnt;
  else
    raise notice '  maintenance_level → care_level: skipped (old column gone)';
  end if;

  -- 1m. soil → substrate
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='soil') then
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='substrate') then
      alter table public.plants add column substrate text[] not null default '{}'::text[];
    end if;
    update public.plants set substrate = soil
      where soil is not null and array_length(soil, 1) > 0
      and (substrate is null or array_length(substrate, 1) is null);
    get diagnostics cnt = row_count;
    raise notice '  soil → substrate: % rows', cnt;
  else
    raise notice '  soil → substrate: skipped (old column gone)';
  end if;

  -- 1n. mulching (text[]) → mulch_type + mulching_needed
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='mulching') then
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='mulch_type') then
      alter table public.plants add column mulch_type text[] not null default '{}'::text[];
    end if;
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='mulching_needed') then
      alter table public.plants add column mulching_needed boolean default false;
    end if;
    begin
      update public.plants set mulch_type = mulching
        where mulching is not null and array_length(mulching, 1) > 0
        and (mulch_type is null or array_length(mulch_type, 1) is null);
      get diagnostics cnt = row_count;
      update public.plants set mulching_needed = true
        where mulching is not null and array_length(mulching, 1) > 0
        and mulching_needed is null;
      raise notice '  mulching → mulch_type + mulching_needed: % rows', cnt;
    exception when others then
      raise notice '  mulching → mulch_type: skipped (type mismatch)';
    end;
  else
    raise notice '  mulching → mulch_type: skipped (old column gone)';
  end if;

  -- 1o. sow_type → sowing_method
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='sow_type') then
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='sowing_method') then
      alter table public.plants add column sowing_method text[] not null default '{}'::text[];
    end if;
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
    raise notice '  sow_type → sowing_method: % rows', cnt;
  else
    raise notice '  sow_type → sowing_method: skipped (old column gone)';
  end if;

  -- 1p. polenizer → pollinators_attracted
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='polenizer') then
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='pollinators_attracted') then
      alter table public.plants add column pollinators_attracted text[] not null default '{}'::text[];
    end if;
    update public.plants set pollinators_attracted = polenizer
      where polenizer is not null and array_length(polenizer, 1) > 0
      and (pollinators_attracted is null or array_length(pollinators_attracted, 1) is null);
    get diagnostics cnt = row_count;
    raise notice '  polenizer → pollinators_attracted: % rows', cnt;
  else
    raise notice '  polenizer → pollinators_attracted: skipped (old column gone)';
  end if;

  -- 1q. melliferous + be_fertilizer → biodiversity_role
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

  -- 1r. foliage_persistance (text, typo) → foliage_persistence (text[])
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='foliage_persistance') then
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='foliage_persistence') then
      alter table public.plants add column foliage_persistence text[] not null default '{}'::text[];
    end if;
    update public.plants set foliage_persistence = array[case
      when foliage_persistance = 'semi-evergreen' then 'semi_evergreen'
      else foliage_persistance
    end]
    where foliage_persistance is not null
      and (foliage_persistence is null or array_length(foliage_persistence, 1) is null);
    get diagnostics cnt = row_count;
    raise notice '  foliage_persistance → foliage_persistence: % rows', cnt;
  else
    raise notice '  foliage_persistance → foliage_persistence: skipped (old column gone)';
  end if;

  -- ======================================================================
  -- SECTION 2: PLANTS TABLE — Enum value migrations (in-place updates)
  -- ======================================================================
  raise notice '';
  raise notice '── PLANTS TABLE: Enum Value Mappings ──';

  -- 2a. utility: comestible→edible, ornemental→ornamental, odorous→fragrant
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

  -- 2b. toxicity_human
  update public.plants set toxicity_human = case
    when toxicity_human = 'non-toxic' then 'non_toxic'
    when toxicity_human = 'midly irritating' then 'slightly_toxic'
    when toxicity_human = 'highly toxic' then 'very_toxic'
    when toxicity_human = 'lethally toxic' then 'deadly'
    else toxicity_human
  end where toxicity_human in ('non-toxic','midly irritating','highly toxic','lethally toxic');
  get diagnostics cnt = row_count;
  raise notice '  toxicity_human (non-toxic→non_toxic, midly→slightly, etc.): % rows', cnt;

  -- 2c. toxicity_pets
  update public.plants set toxicity_pets = case
    when toxicity_pets = 'non-toxic' then 'non_toxic'
    when toxicity_pets = 'midly irritating' then 'slightly_toxic'
    when toxicity_pets = 'highly toxic' then 'very_toxic'
    when toxicity_pets = 'lethally toxic' then 'deadly'
    else toxicity_pets
  end where toxicity_pets in ('non-toxic','midly irritating','highly toxic','lethally toxic');
  get diagnostics cnt = row_count;
  raise notice '  toxicity_pets: % rows', cnt;

  -- 2d. watering_type: buried→drip, drop→drip, drench→soaking
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

  -- 2e. division: division→clump_division, tissue separation→clump_division, bulb separation→bulb_division
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
  raise notice '  division (division→clump_division, bulb separation→bulb_division): % rows', cnt;

  -- 2f. status: "in progres" → "in_progress"
  update public.plants set status = 'in_progress' where status = 'in progres';
  get diagnostics cnt = row_count;
  raise notice '  status ("in progres" → "in_progress"): % rows', cnt;

  -- ======================================================================
  -- SECTION 3: PLANTS TABLE — Type conversions (text → text[])
  -- ======================================================================
  raise notice '';
  raise notice '── PLANTS TABLE: Type Conversions (text → text[]) ──';

  -- 3a. conservation_status text → text[]
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='plants' and column_name='conservation_status'
    and data_type = 'text' and udt_name = 'text'
  ) then
    declare r record;
    begin
      for r in (
        select c.conname from pg_constraint c
        join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid
        where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'conservation_status'
      ) loop
        execute 'alter table public.plants drop constraint ' || quote_ident(r.conname);
      end loop;
    end;
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

  -- 3b. life_cycle text → text[]
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='plants' and column_name='life_cycle'
    and data_type = 'text' and udt_name = 'text'
  ) then
    declare r record;
    begin
      for r in (
        select c.conname from pg_constraint c
        join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid
        where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'life_cycle'
      ) loop
        execute 'alter table public.plants drop constraint ' || quote_ident(r.conname);
      end loop;
    end;
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

  -- 3c. living_space text → text[]
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='plants' and column_name='living_space'
    and data_type = 'text' and udt_name = 'text'
  ) then
    declare r record;
    begin
      for r in (
        select c.conname from pg_constraint c
        join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid
        where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'living_space'
      ) loop
        execute 'alter table public.plants drop constraint ' || quote_ident(r.conname);
      end loop;
    end;
    alter table public.plants alter column living_space type text[]
      using case when living_space is not null then array[living_space::text] else '{}'::text[] end;
    alter table public.plants alter column living_space set default '{}'::text[];
    alter table public.plants alter column living_space set not null;
    raise notice '  living_space: text → text[]';
  else
    raise notice '  living_space: skipped (already text[] or missing)';
  end if;

  -- ======================================================================
  -- SECTION 4: PLANTS TABLE — Watering schedules → frequency fields
  -- ======================================================================
  raise notice '';
  raise notice '── PLANTS TABLE: Watering Schedules → Frequency Fields ──';

  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='watering_frequency_warm') then
    alter table public.plants add column watering_frequency_warm integer;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='watering_frequency_cold') then
    alter table public.plants add column watering_frequency_cold integer;
  end if;

  -- Migrate from plant_watering_schedules: summer/spring → warm, winter/autumn → cold
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

  -- ======================================================================
  -- SECTION 5: PLANT_TRANSLATIONS TABLE — Column renames
  -- ======================================================================
  raise notice '';
  raise notice '── PLANT_TRANSLATIONS TABLE: Column Renames ──';

  -- 5a. given_names → common_names
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='given_names') then
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='common_names') then
      alter table public.plant_translations add column common_names text[] not null default '{}';
    end if;
    update public.plant_translations set common_names = given_names
      where given_names is not null and array_length(given_names, 1) > 0
      and (common_names is null or array_length(common_names, 1) is null);
    get diagnostics cnt = row_count;
    raise notice '  given_names → common_names: % rows', cnt;
  else
    raise notice '  given_names → common_names: skipped (old column gone)';
  end if;

  -- 5b. overview → presentation
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='overview') then
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='presentation') then
      alter table public.plant_translations add column presentation text;
    end if;
    update public.plant_translations set presentation = overview
      where overview is not null and trim(overview) <> ''
      and (presentation is null or trim(presentation) = '');
    get diagnostics cnt = row_count;
    raise notice '  overview → presentation: % rows', cnt;
  else
    raise notice '  overview → presentation: skipped (old column gone)';
  end if;

  -- 5c. advice_soil → soil_advice
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='advice_soil') then
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='soil_advice') then
      alter table public.plant_translations add column soil_advice text;
    end if;
    update public.plant_translations set soil_advice = advice_soil
      where advice_soil is not null and trim(advice_soil) <> ''
      and (soil_advice is null or trim(soil_advice) = '');
    get diagnostics cnt = row_count;
    raise notice '  advice_soil → soil_advice: % rows', cnt;
  else
    raise notice '  advice_soil → soil_advice: skipped';
  end if;

  -- 5d. advice_mulching → mulch_advice
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='advice_mulching') then
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='mulch_advice') then
      alter table public.plant_translations add column mulch_advice text;
    end if;
    update public.plant_translations set mulch_advice = advice_mulching
      where advice_mulching is not null and trim(advice_mulching) <> ''
      and (mulch_advice is null or trim(mulch_advice) = '');
    get diagnostics cnt = row_count;
    raise notice '  advice_mulching → mulch_advice: % rows', cnt;
  else
    raise notice '  advice_mulching → mulch_advice: skipped';
  end if;

  -- 5e. advice_fertilizer → fertilizer_advice
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='advice_fertilizer') then
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='fertilizer_advice') then
      alter table public.plant_translations add column fertilizer_advice text;
    end if;
    update public.plant_translations set fertilizer_advice = advice_fertilizer
      where advice_fertilizer is not null and trim(advice_fertilizer) <> ''
      and (fertilizer_advice is null or trim(fertilizer_advice) = '');
    get diagnostics cnt = row_count;
    raise notice '  advice_fertilizer → fertilizer_advice: % rows', cnt;
  else
    raise notice '  advice_fertilizer → fertilizer_advice: skipped';
  end if;

  -- 5f. advice_tutoring → staking_advice
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='advice_tutoring') then
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='staking_advice') then
      alter table public.plant_translations add column staking_advice text;
    end if;
    update public.plant_translations set staking_advice = advice_tutoring
      where advice_tutoring is not null and trim(advice_tutoring) <> ''
      and (staking_advice is null or trim(staking_advice) = '');
    get diagnostics cnt = row_count;
    raise notice '  advice_tutoring → staking_advice: % rows', cnt;
  else
    raise notice '  advice_tutoring → staking_advice: skipped';
  end if;

  -- 5g. advice_sowing → sowing_advice
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='advice_sowing') then
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='sowing_advice') then
      alter table public.plant_translations add column sowing_advice text;
    end if;
    update public.plant_translations set sowing_advice = advice_sowing
      where advice_sowing is not null and trim(advice_sowing) <> ''
      and (sowing_advice is null or trim(sowing_advice) = '');
    get diagnostics cnt = row_count;
    raise notice '  advice_sowing → sowing_advice: % rows', cnt;
  else
    raise notice '  advice_sowing → sowing_advice: skipped';
  end if;

  -- 5h. cut → pruning_advice
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='cut') then
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='pruning_advice') then
      alter table public.plant_translations add column pruning_advice text;
    end if;
    update public.plant_translations set pruning_advice = cut
      where cut is not null and trim(cut) <> ''
      and (pruning_advice is null or trim(pruning_advice) = '');
    get diagnostics cnt = row_count;
    raise notice '  cut → pruning_advice: % rows', cnt;
  else
    raise notice '  cut → pruning_advice: skipped';
  end if;

  -- 5i. advice_medicinal → medicinal_warning
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='advice_medicinal') then
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='medicinal_warning') then
      alter table public.plant_translations add column medicinal_warning text;
    end if;
    update public.plant_translations set medicinal_warning = advice_medicinal
      where advice_medicinal is not null and trim(advice_medicinal) <> ''
      and (medicinal_warning is null or trim(medicinal_warning) = '');
    get diagnostics cnt = row_count;
    raise notice '  advice_medicinal → medicinal_warning: % rows', cnt;
  else
    raise notice '  advice_medicinal → medicinal_warning: skipped';
  end if;

  -- 5j. advice_infusion → infusion_benefits
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='advice_infusion') then
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='infusion_benefits') then
      alter table public.plant_translations add column infusion_benefits text;
    end if;
    update public.plant_translations set infusion_benefits = advice_infusion
      where advice_infusion is not null and trim(advice_infusion) <> ''
      and (infusion_benefits is null or trim(infusion_benefits) = '');
    get diagnostics cnt = row_count;
    raise notice '  advice_infusion → infusion_benefits: % rows', cnt;
  else
    raise notice '  advice_infusion → infusion_benefits: skipped';
  end if;

  -- 5k. nutritional_intake (text[]) → nutritional_value (text)
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

  -- 5l. tags → plant_tags
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='tags') then
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plant_translations' and column_name='plant_tags') then
      alter table public.plant_translations add column plant_tags text[] not null default '{}';
    end if;
    update public.plant_translations set plant_tags = tags
      where tags is not null and array_length(tags, 1) > 0
      and (plant_tags is null or array_length(plant_tags, 1) is null);
    get diagnostics cnt = row_count;
    raise notice '  tags → plant_tags: % rows', cnt;
  else
    raise notice '  tags → plant_tags: skipped';
  end if;

  -- ======================================================================
  -- DONE
  -- ======================================================================
  raise notice '';
  raise notice '========================================================';
  raise notice '✅ MIGRATION COMPLETE';
  raise notice '========================================================';
  raise notice 'Next step: Run schema sync (sync_parts 01-15) to finalize';
  raise notice '  - New columns will be created';
  raise notice '  - New check constraints will be applied';
  raise notice '  - Old columns will be dropped by the column whitelist';
  raise notice '========================================================';

end $full_migration$;
