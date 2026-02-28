-- ========== Plants base table ==========
-- ARCHITECTURE NOTE: As of 2025, ALL translatable content is stored ONLY in plant_translations.
-- This table contains ONLY non-translatable base data. No translatable columns exist here
-- except for 'name' which is the canonical English name used for unique constraint.
--
-- NAME HANDLING:
--   plants.name = canonical English name (unique constraint)
--   plant_translations.name = displayed name for each language (including English)
--   When saving in English, BOTH plants.name AND plant_translations.name are updated
--
-- SCHEMA SECTIONS:
--   1) Base: Identity & naming, featured months, images
--   2) Identity: Origin, climate, utility, safety, life cycle, habitat, plant form
--   3) Care: Difficulty, watering, substrate, mulch, nutrition
--   4) Growth: Calendar, dimensions, propagation, pruning
--   5) Danger: Pests & diseases (in translations)
--   6) Ecology: Conservation, biotopes, tolerance, biodiversity, fauna
--   7) Consumption: Nutrition, infusion, medicinal, fragrance
--   8) Misc: Tags, companions
--   9) Meta: Status, notes, contributors, sources
--
-- NON-TRANSLATABLE FIELDS (stored in this table):
--   Section 1: id, name, scientific_name_species, variety, family,
--              featured_month
--   Section 2: climate, season, utility, edible_part, thorny, toxicity_human, toxicity_pets,
--              poisoning_method, life_cycle, average_lifespan, foliage_persistence,
--              living_space, landscaping, plant_habit, multicolor, bicolor
--   Section 3: care_level, sunlight, temperature_max/min/ideal, watering_frequency_warm/cold,
--              watering_type, hygrometry, misting_frequency, special_needs,
--              substrate, substrate_mix, mulching_needed, mulch_type, nutrition_need, fertilizer
--   Section 4: sowing_month, flowering_month, fruiting_month, height_cm, wingspan_cm,
--              staking, division, cultivation_mode, sowing_method, transplanting,
--              pruning, pruning_month
--   Section 6: conservation_status, ecological_status, biotopes, urban_biotopes,
--              ecological_tolerance, biodiversity_role, pollinators_attracted,
--              birds_attracted, mammals_attracted, ecological_management, ecological_impact
--   Section 7: infusion_parts, edible_oil
--   Section 8: companion_plants, biotope_plants, beneficial_plants, harmful_plants,
--              sponsored_shop_ids
--   Section 9: status, admin_commentary, created_by, created_time,
--              updated_by, updated_time
--
-- TRANSLATABLE FIELDS (stored ONLY in plant_translations):
--   name, common_names, presentation, origin, allergens, poisoning_symptoms
--   soil_advice, mulch_advice, fertilizer_advice
--   staking_advice, sowing_advice, transplanting_time, outdoor_planting_time, pruning_advice
--   pests, diseases
--   nutritional_value, recipes_ideas, infusion_benefits, infusion_recipe_ideas
--   medicinal_benefits, medicinal_usage, medicinal_warning, medicinal_history
--   aromatherapy_benefits, essential_oil_blends
--   beneficial_roles, harmful_roles, symbiosis, symbiosis_notes
--   plant_tags, biodiversity_tags, source_name, source_url
--   spice_mixes (deprecated)

create table if not exists public.plants (
  id text primary key,
  name text not null,

  -- Section 1: Base — Identity & naming
  plant_type text check (plant_type is null or plant_type in ('plant','flower','bamboo','shrub','tree','cactus','succulent')),
  scientific_name_species text,
  variety text,
  family text,
  featured_month text[] not null default '{}'::text[],

  -- Section 2: Identity — Origin & environment
  climate text[] not null default '{}'::text[] check (climate <@ array[
    'polar','montane','oceanic','degraded_oceanic','temperate_continental',
    'mediterranean','tropical_dry','tropical_humid','tropical_volcanic',
    'tropical_cyclonic','humid_insular','subtropical_humid','equatorial',
    'windswept_coastal'
  ]),
  season text[] not null default '{}'::text[] check (season <@ array['spring','summer','autumn','winter']),

  -- Section 2: Identity — Utility & safety
  utility text[] not null default '{}'::text[] check (utility <@ array['edible','ornamental','aromatic','medicinal','fragrant','cereal','spice','infusion']),
  edible_part text[] not null default '{}'::text[] check (edible_part <@ array['flower','fruit','seed','leaf','stem','bulb','rhizome','bark','wood']),
  thorny boolean default false,
  toxicity_human text check (toxicity_human in ('non_toxic','slightly_toxic','very_toxic','deadly','undetermined')),
  toxicity_pets text check (toxicity_pets in ('non_toxic','slightly_toxic','very_toxic','deadly','undetermined')),
  poisoning_method text[] not null default '{}'::text[] check (poisoning_method <@ array['touch','ingestion','eye_contact','inhalation','sap_contact']),

  -- Section 2: Identity — Life cycle & foliage
  life_cycle text[] not null default '{}'::text[] check (life_cycle <@ array['annual','biennial','perennial','succulent_perennial','monocarpic','short_cycle','ephemeral']),
  average_lifespan text[] not null default '{}'::text[] check (average_lifespan <@ array['less_than_1_year','2_years','3_to_10_years','10_to_50_years','over_50_years']),
  foliage_persistence text[] not null default '{}'::text[] check (foliage_persistence <@ array['deciduous','evergreen','semi_evergreen','marcescent','winter_dormant','dry_season_deciduous']),

  -- Section 2: Identity — Habitat & plant form
  living_space text[] not null default '{}'::text[] check (living_space <@ array['indoor','outdoor','both','terrarium','greenhouse']),
  landscaping text[] not null default '{}'::text[] check (landscaping <@ array[
    'pot','planter','hanging','window_box','green_wall','flowerbed','border',
    'edging','path','tree_base','vegetable_garden','orchard','hedge',
    'free_growing','trimmed_hedge','windbreak','pond_edge','waterside',
    'ground_cover','grove','background','foreground'
  ]),
  plant_habit text[] not null default '{}'::text[] check (plant_habit <@ array[
    'upright','arborescent','shrubby','bushy','clumping','erect',
    'creeping','carpeting','ground_cover','prostrate','spreading',
    'climbing','twining','scrambling','liana',
    'trailing','columnar','conical','fastigiate','globular',
    'spreading_flat','rosette','cushion','ball_shaped',
    'succulent','palmate','rhizomatous','suckering'
  ]),
  multicolor boolean default false,
  bicolor boolean default false,

  -- Section 3: Care — Difficulty & conditions
  care_level text[] not null default '{}'::text[] check (care_level <@ array['easy','moderate','complex']),
  sunlight text[] not null default '{}'::text[] check (sunlight <@ array['full_sun','partial_sun','partial_shade','light_shade','deep_shade','direct_light','bright_indirect_light','medium_light','low_light']),
  temperature_max integer,
  temperature_min integer,
  temperature_ideal integer,

  -- Section 3: Care — Water & humidity
  watering_mode text default 'always',
  watering_frequency_warm integer,
  watering_frequency_cold integer,
  watering_type text[] not null default '{}'::text[] check (watering_type <@ array['hose','surface','drip','soaking','wick']),
  hygrometry integer,
  misting_frequency integer,

  -- Section 3: Care — Special needs
  special_needs text[] not null default '{}'::text[],

  -- Section 3: Care — Substrate & soil
  substrate text[] not null default '{}'::text[] check (substrate <@ array[
    -- Organic: soil & potting mixes
    'garden_soil','topsoil','loam','clay_soil','sandy_soil','silty_soil',
    'universal_potting_mix','horticultural_potting_mix','seed_starting_mix',
    'cutting_mix','vegetable_potting_mix','flowering_plant_mix',
    'foliage_plant_mix','citrus_mix','orchid_mix',
    'cactus_succulent_mix','ericaceous_mix',
    -- Organic: amendments
    'mature_compost','vermicompost','composted_manure','composted_leaves',
    'leaf_mold','forest_humus','ramial_chipped_wood','coconut_coir',
    'blonde_peat','brown_peat','composted_bark',
    -- Mineral: drainage
    'river_sand','horticultural_sand','pozzite','perlite','vermiculite',
    'pumice','gravel','clay_pebbles','zeolite','pumice_stone',
    'schist','crushed_slate',
    -- Mineral: specific soils
    'calcareous_soil','acidic_soil','volcanic_soil',
    'pure_mineral_substrate','draining_cactus_substrate'
  ]),
  substrate_mix text[] not null default '{}'::text[],

  -- Section 3: Care — Mulch
  mulching_needed boolean default false,
  mulch_type text[] not null default '{}'::text[] check (mulch_type <@ array[
    -- Dry plant-based
    'straw','hay','dead_leaves','dried_grass_clippings','pine_needles',
    'dried_fern','crushed_miscanthus','flax_straw','hemp',
    'untreated_wood_shavings','pine_bark','hardwood_bark','ramial_chipped_wood',
    -- Fresh plant-based (use with care)
    'fresh_grass_clippings','shredded_garden_waste','shredded_pruning_waste',
    -- Vegetable garden specific
    'cocoa_shells','buckwheat_hulls','flax_mulch','hemp_mulch',
    'unprinted_brown_cardboard','kraft_paper','newspaper_vegetal_ink',
    -- Natural forest
    'forest_litter','fragmented_deadwood','oak_leaves','hazel_leaves','beech_leaves',
    -- Mineral (non-nourishing, durable)
    'gravel','pebbles','pozzolane','crushed_slate','schist',
    'crushed_brick','decorative_sand','volcanic_rock','surface_clay_pebbles',
    -- Living ground cover
    'clover','ivy','bugle','creeping_thyme','strawberry',
    'vinca','sedum','natural_lawn',
    -- Recycled / ecological
    'cardboard','kraft','burlap','biodegradable_fabric',
    'crushed_eggshell','walnut_shells','hazelnut_shells','mixed_coffee_grounds'
  ]),

  -- Section 3: Care — Nutrition
  nutrition_need text[] not null default '{}'::text[],
  fertilizer text[] not null default '{}'::text[],

  -- Section 4: Growth — Calendar
  sowing_month text[] not null default '{}'::text[],
  flowering_month text[] not null default '{}'::text[],
  fruiting_month text[] not null default '{}'::text[],

  -- Section 4: Growth — Dimensions & support
  height_cm integer,
  wingspan_cm integer,
  separation_cm integer,
  staking boolean default false,

  -- Section 4: Growth — Propagation & cultivation
  division text[] not null default '{}'::text[] check (division <@ array['seed','clump_division','bulb_division','rhizome_division','cutting','layering','stolon','sucker','grafting','spore']),
  cultivation_mode text[] not null default '{}'::text[] check (cultivation_mode <@ array[
    'open_ground','flowerbed','vegetable_garden','raised_bed','orchard',
    'rockery','slope','mound','pot','planter','hanging','greenhouse',
    'indoor','pond','waterlogged_soil','hydroponic','aquaponic',
    'mineral_substrate','permaculture','agroforestry'
  ]),
  sowing_method text[] not null default '{}'::text[] check (sowing_method <@ array['open_ground','pot','tray','greenhouse','mini_greenhouse','broadcast','row']),
  transplanting boolean,

  -- Section 4: Growth — Pruning
  pruning boolean default false,
  pruning_month text[] not null default '{}'::text[],

  -- Section 6: Ecology — Conservation & status
  conservation_status text[] not null default '{}'::text[] check (conservation_status <@ array['least_concern','near_threatened','vulnerable','endangered','critically_endangered','extinct_in_wild','extinct','data_deficient','not_evaluated']),
  ecological_status text[] not null default '{}'::text[] check (ecological_status <@ array[
    'indigenous','endemic','subendemic','introduced','naturalized',
    'subspontaneous','cultivated_only','ecologically_neutral',
    'biodiversity_favorable','potentially_invasive','exotic_invasive',
    'locally_invasive','competitive_dominant','pioneer_species',
    'climax_species','structuring_species','indicator_species',
    'host_species','relict_species','heritage_species','common_species',
    'nitrogen_fixer','hygrophile','heliophile','sciaphile',
    'halophile','calcicole','acidophile'
  ]),

  -- Section 6: Ecology — Habitats
  biotopes text[] not null default '{}'::text[] check (biotopes <@ array[
    -- Forest
    'temperate_deciduous_forest','mixed_forest','coniferous_forest',
    'mediterranean_forest','tropical_rainforest','tropical_dry_forest',
    'shaded_understory','forest_edge','clearing','alluvial_forest',
    -- Open / prairie
    'natural_meadow','wet_meadow','dry_meadow','calcareous_grassland',
    'sandy_grassland','steppe','savanna','garrigue','maquis','wasteland','fallow',
    -- Wetland
    'marsh','peat_bog','wetland','lakeshore','pond','natural_pool',
    'reed_bed','stream','riverbank','swamp_forest','mangrove',
    -- Dry / mineral
    'rockery','scree','cliff','rocky_outcrop','stony_ground',
    'calcareous_terrain','sandy_terrain','inland_dune',
    'arid_steppe','desert','semi_desert',
    -- Coastal
    'coastal_dune','beach','foreshore','lagoon','salt_marsh',
    'sea_cliff','coastal_forest','coastal_meadow',
    -- Mountain
    'alpine_meadow','montane_zone','subalpine_zone','alpine_zone',
    'alpine_tundra','mountain_forest','mountain_edge',
    -- Tropical
    'tropical_humid_forest','tropical_dry_forest_2','primary_forest',
    'secondary_forest','tropical_savanna','mangrove_tropical',
    'cloud_forest','tropical_understory'
  ]),
  urban_biotopes text[] not null default '{}'::text[] check (urban_biotopes <@ array[
    'urban_garden','periurban_garden','park','urban_wasteland',
    'green_wall','green_roof','balcony','agricultural_hedge',
    'cultivated_orchard','vegetable_garden','roadside'
  ]),

  -- Section 6: Ecology — Tolerance & roles
  ecological_tolerance text[] not null default '{}'::text[] check (ecological_tolerance <@ array['drought','scorching_sun','permanent_shade','excess_water','frost','heatwave','wind']),
  biodiversity_role text[] not null default '{}'::text[] check (biodiversity_role <@ array[
    'melliferous','insect_refuge','bird_refuge','mammal_refuge',
    'food_source','host_plant','nitrogen_fixer','soil_improver',
    'ecological_corridor','natural_repellent','green_manure',
    'fertility_improver','crop_shade','vegetable_garden_windbreak',
    'moisture_retention','frost_protection','drought_protection'
  ]),
  pollinators_attracted text[] not null default '{}'::text[],
  birds_attracted text[] not null default '{}'::text[],
  mammals_attracted text[] not null default '{}'::text[],

  -- Section 6: Ecology — Symbiosis & management
  ecological_management text[] not null default '{}'::text[] check (ecological_management <@ array[
    'let_seed','no_winter_pruning','keep_dry_foliage',
    'natural_foliage_mulch','branch_chipping_mulch',
    'improves_microbial_life','promotes_mycorrhizal_fungi',
    'enriches_soil','structures_soil'
  ]),
  ecological_impact text[] not null default '{}'::text[] check (ecological_impact <@ array['neutral','favorable','potentially_invasive','locally_invasive']),

  -- Section 7: Consumption
  infusion_parts text[] not null default '{}'::text[],
  edible_oil text check (edible_oil in ('yes','no','unknown')),

  -- Section 8: Misc
  companion_plants text[] not null default '{}'::text[],
  biotope_plants text[] not null default '{}'::text[],
  beneficial_plants text[] not null default '{}'::text[],
  harmful_plants text[] not null default '{}'::text[],
  sponsored_shop_ids text[] not null default '{}'::text[],

  -- Section 9: Meta
  status text check (status in ('in_progress','rework','review','approved')),
  admin_commentary text,
  created_by text,
  created_time timestamptz not null default now(),
  updated_by text,
  updated_time timestamptz not null default now()
);

-- Unique constraint on name — canonical English name for the plant
create unique index if not exists plants_name_unique on public.plants (lower(name));

-- Drop the scientific_name unique constraint if it exists
drop index if exists plants_scientific_name_unique;
alter table if exists public.plants drop constraint if exists plants_scientific_name_unique;

-- ========== Phase 0: Purge zombie columns by recreating the table ==========
-- PostgreSQL DROP COLUMN only marks columns as invisible ("attisdropped") in
-- pg_attribute. These zombies permanently count toward the 1600-column limit
-- and survive table rewrites and VACUUM FULL. The ONLY way to remove them is
-- to recreate the table from scratch.
--
-- Strategy: LIKE ... INCLUDING DEFAULTS copies only visible columns (no zombies),
-- then we swap tables and rebuild all dependent objects.
do $purge_zombies$ declare
  zombie_count integer;
  fk record;
begin
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='plants') then
    return;
  end if;

  select count(*) into zombie_count
    from pg_attribute
    where attrelid = 'public.plants'::regclass and attnum > 0 and attisdropped;

  if zombie_count < 50 then
    return; -- few enough zombies, no rebuild needed
  end if;

  -- 1. Create clean copy (visible columns only, with defaults but no check constraints)
  create table public.plants_clean (like public.plants including defaults);
  insert into public.plants_clean select * from public.plants;

  -- 2. Drop all FK constraints pointing to plants (they block DROP TABLE)
  for fk in
    select tc.constraint_name, tc.table_name
    from information_schema.table_constraints tc
    join information_schema.constraint_column_usage ccu
      on tc.constraint_name = ccu.constraint_name and tc.table_schema = ccu.table_schema
    where tc.constraint_type = 'FOREIGN KEY'
      and ccu.table_schema = 'public' and ccu.table_name = 'plants'
  loop
    execute format('alter table public.%I drop constraint if exists %I', fk.table_name, fk.constraint_name);
  end loop;

  -- 3. Drop old table (indexes, check constraints, policies go with it)
  drop table public.plants;

  -- 4. Rename clean table
  alter table public.plants_clean rename to plants;

  -- 5. Recreate primary key and indexes
  alter table public.plants add primary key (id);
  create unique index if not exists plants_name_unique on public.plants (lower(name));

  -- 6. Recreate FK constraints from dependent tables
  alter table public.garden_inventory      add constraint garden_inventory_plant_id_fkey      foreign key (plant_id) references public.plants(id) on delete cascade;
  alter table public.garden_plants         add constraint garden_plants_plant_id_fkey         foreign key (plant_id) references public.plants(id) on delete cascade;
  alter table public.garden_transactions   add constraint garden_transactions_plant_id_fkey   foreign key (plant_id) references public.plants(id) on delete cascade;
  alter table public.plant_colors          add constraint plant_colors_plant_id_fkey          foreign key (plant_id) references public.plants(id) on delete cascade;
  alter table public.plant_contributors    add constraint plant_contributors_plant_id_fkey    foreign key (plant_id) references public.plants(id) on delete cascade;
  alter table public.plant_images          add constraint plant_images_plant_id_fkey          foreign key (plant_id) references public.plants(id) on delete cascade;
  alter table public.plant_infusion_mixes  add constraint plant_infusion_mixes_plant_id_fkey  foreign key (plant_id) references public.plants(id) on delete cascade;
  alter table public.plant_pro_advices     add constraint plant_pro_advices_plant_id_fkey     foreign key (plant_id) references public.plants(id) on delete cascade;
  alter table public.plant_recipes         add constraint plant_recipes_plant_id_fkey         foreign key (plant_id) references public.plants(id) on delete cascade;
  alter table public.plant_reports         add constraint plant_reports_plant_id_fkey         foreign key (plant_id) references public.plants(id) on delete cascade;
  alter table public.plant_scans           add constraint plant_scans_matched_plant_id_fkey   foreign key (matched_plant_id) references public.plants(id) on delete set null;
  alter table public.plant_sources         add constraint plant_sources_plant_id_fkey         foreign key (plant_id) references public.plants(id) on delete cascade;
  alter table public.plant_stocks          add constraint plant_stocks_plant_id_fkey          foreign key (plant_id) references public.plants(id) on delete cascade;
  alter table public.plant_translations    add constraint plant_translations_plant_id_fkey    foreign key (plant_id) references public.plants(id) on delete cascade;
  alter table public.plant_watering_schedules add constraint plant_watering_schedules_plant_id_fkey foreign key (plant_id) references public.plants(id) on delete cascade;

  -- 7. Enable RLS and recreate policies (sync Phase 3 will finalize these)
  alter table public.plants enable row level security;
  create policy plants_select_all on public.plants for select to authenticated, anon using (true);
  create policy plants_insert on public.plants for insert to authenticated with check (true);
  create policy plants_update on public.plants for update to authenticated using (true) with check (true);
  create policy plants_delete on public.plants for delete to authenticated using (true);

end $purge_zombies$;

-- ========== Phase 0.5: Rename old columns to new names (avoids add+copy+drop) ==========
-- For same-type renames this is a zero-cost metadata-only change that keeps column count stable.
do $rename_cols$ declare
  renames constant text[][] := array[
    -- array['old_name', 'new_name']
    array['scientific_name', 'scientific_name_species'],
    array['spiked', 'thorny'],
    array['scent', 'fragrance'],
    array['tutoring', 'staking'],
    array['companions', 'companion_plants'],
    array['comestible_part', 'edible_part'],
    array['habitat', 'climate'],
    array['composition', 'landscaping'],
    array['soil', 'substrate'],
    array['mulching', 'mulch_type'],
    array['sow_type', 'sowing_method'],
    array['polenizer', 'pollinators_attracted']
  ];
  r record;
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'plants') then
    return;
  end if;
  for i in 1..array_length(renames, 1) loop
    if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name = renames[i][1])
       and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name = renames[i][2])
    then
      -- Drop check constraints on the old column before renaming (they block new values)
      for r in (
        select c.conname from pg_constraint c
        join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid
        where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = renames[i][1]
      ) loop
        execute 'alter table public.plants drop constraint ' || quote_ident(r.conname);
      end loop;
      execute format('alter table public.plants rename column %I to %I', renames[i][1], renames[i][2]);
    end if;
  end loop;
end $rename_cols$;

-- For text→text[] type-change renames, rename first then alter type in Phase 2.
-- promotion_month→featured_month, level_sun→sunlight, maintenance_level→care_level
do $rename_and_retype$ declare
  r record;
begin
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='plants') then
    return;
  end if;

  -- promotion_month (text) → featured_month (text[])
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
  end if;

  -- level_sun (text) → sunlight (text[])
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
  end if;

  -- maintenance_level (text) → care_level (text[])
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
  end if;

  -- foliage_persistance (text) → foliage_persistence (text[])
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='foliage_persistance')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='foliage_persistence')
  then
    update public.plants set foliage_persistance = case
      when foliage_persistance = 'semi-evergreen' then 'semi_evergreen'
      else foliage_persistance
    end where foliage_persistance is not null;
    for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'foliage_persistance') loop
      execute 'alter table public.plants drop constraint ' || quote_ident(r.conname);
    end loop;
    alter table public.plants rename column foliage_persistance to foliage_persistence;
    alter table public.plants alter column foliage_persistence type text[]
      using case when foliage_persistence is not null and trim(foliage_persistence::text) <> '' then array[foliage_persistence::text] else '{}'::text[] end;
    alter table public.plants alter column foliage_persistence set default '{}'::text[];
    begin alter table public.plants alter column foliage_persistence set not null; exception when others then null; end;
  end if;
  -- scientific_name_variety → variety (simple rename, same type)
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='scientific_name_variety')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='variety')
  then
    alter table public.plants rename column scientific_name_variety to variety;
  end if;
end $rename_and_retype$;

-- ========== Phase 1: Add new columns for upgrades from older schema ==========
do $add_plants_cols$
declare
  col_defs text[][] := array[
    -- Section 1: Base
    array['plant_type', 'text'],
    array['scientific_name_species', 'text'],
    array['variety', 'text'],
    array['family', 'text'],
    array['featured_month', 'text[] not null default ''{}''::text[]'],
    -- Section 2: Identity
    array['climate', 'text[] not null default ''{}''::text[]'],
    array['season', 'text[] not null default ''{}''::text[]'],
    array['utility', 'text[] not null default ''{}''::text[]'],
    array['edible_part', 'text[] not null default ''{}''::text[]'],
    array['thorny', 'boolean default false'],
    array['toxicity_human', 'text'],
    array['toxicity_pets', 'text'],
    array['poisoning_method', 'text[] not null default ''{}''::text[]'],
    array['life_cycle', 'text[] not null default ''{}''::text[]'],
    array['average_lifespan', 'text[] not null default ''{}''::text[]'],
    array['foliage_persistence', 'text[] not null default ''{}''::text[]'],
    array['living_space', 'text[] not null default ''{}''::text[]'],
    array['landscaping', 'text[] not null default ''{}''::text[]'],
    array['plant_habit', 'text[] not null default ''{}''::text[]'],
    array['multicolor', 'boolean default false'],
    array['bicolor', 'boolean default false'],
    -- Section 3: Care
    array['care_level', 'text[] not null default ''{}''::text[]'],
    array['sunlight', 'text[] not null default ''{}''::text[]'],
    array['temperature_max', 'integer'],
    array['temperature_min', 'integer'],
    array['temperature_ideal', 'integer'],
    array['watering_mode', 'text default ''always'''],
    array['watering_frequency_warm', 'integer'],
    array['watering_frequency_cold', 'integer'],
    array['watering_type', 'text[] not null default ''{}''::text[]'],
    array['hygrometry', 'integer'],
    array['misting_frequency', 'integer'],
    array['special_needs', 'text[] not null default ''{}''::text[]'],
    array['substrate', 'text[] not null default ''{}''::text[]'],
    array['substrate_mix', 'text[] not null default ''{}''::text[]'],
    array['mulching_needed', 'boolean default false'],
    array['mulch_type', 'text[] not null default ''{}''::text[]'],
    array['nutrition_need', 'text[] not null default ''{}''::text[]'],
    array['fertilizer', 'text[] not null default ''{}''::text[]'],
    -- Section 4: Growth
    array['sowing_month', 'text[] not null default ''{}''::text[]'],
    array['flowering_month', 'text[] not null default ''{}''::text[]'],
    array['fruiting_month', 'text[] not null default ''{}''::text[]'],
    array['height_cm', 'integer'],
    array['wingspan_cm', 'integer'],
    array['separation_cm', 'integer'],
    array['staking', 'boolean default false'],
    array['division', 'text[] not null default ''{}''::text[]'],
    array['cultivation_mode', 'text[] not null default ''{}''::text[]'],
    array['sowing_method', 'text[] not null default ''{}''::text[]'],
    array['transplanting', 'boolean'],
    array['pruning', 'boolean default false'],
    array['pruning_month', 'text[] not null default ''{}''::text[]'],
    -- Section 6: Ecology
    array['conservation_status', 'text[] not null default ''{}''::text[]'],
    array['ecological_status', 'text[] not null default ''{}''::text[]'],
    array['biotopes', 'text[] not null default ''{}''::text[]'],
    array['urban_biotopes', 'text[] not null default ''{}''::text[]'],
    array['ecological_tolerance', 'text[] not null default ''{}''::text[]'],
    array['biodiversity_role', 'text[] not null default ''{}''::text[]'],
    array['pollinators_attracted', 'text[] not null default ''{}''::text[]'],
    array['birds_attracted', 'text[] not null default ''{}''::text[]'],
    array['mammals_attracted', 'text[] not null default ''{}''::text[]'],
    array['ecological_management', 'text[] not null default ''{}''::text[]'],
    array['ecological_impact', 'text[] not null default ''{}''::text[]'],
    -- Section 7: Consumption
    array['infusion_parts', 'text[] not null default ''{}''::text[]'],
    array['edible_oil', 'text'],
    -- Section 8: Misc
    array['companion_plants', 'text[] not null default ''{}''::text[]'],
    array['biotope_plants', 'text[] not null default ''{}''::text[]'],
    array['beneficial_plants', 'text[] not null default ''{}''::text[]'],
    array['harmful_plants', 'text[] not null default ''{}''::text[]'],
    array['sponsored_shop_ids', 'text[] not null default ''{}''::text[]'],
    -- Section 9: Meta
    array['status', 'text'],
    array['admin_commentary', 'text'],
    array['created_by', 'text'],
    array['created_time', 'timestamptz not null default now()'],
    array['updated_by', 'text'],
    array['updated_time', 'timestamptz not null default now()']
  ];
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'plants') then
    return;
  end if;

  for i in 1..array_length(col_defs, 1) loop
    begin
      if not exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
        and table_name = 'plants'
        and column_name = col_defs[i][1]
      ) then
        execute format('alter table public.plants add column %I %s', col_defs[i][1], col_defs[i][2]);
      end if;
    exception when others then
      null;
    end;
  end loop;
end $add_plants_cols$;

-- ========== Phase 2: Migrate data from old columns to new columns ==========
-- This handles renames, value mappings, and type conversions for upgrades
do $migrate_plants$
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'plants') then
    return;
  end if;

  -- scientific_name → scientific_name_species
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='scientific_name') then
    update public.plants set scientific_name_species = scientific_name
      where scientific_name is not null and (scientific_name_species is null or trim(scientific_name_species) = '');
  end if;

  -- promotion_month (text) → featured_month (text[])
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='promotion_month') then
    update public.plants set featured_month = array[promotion_month]
      where promotion_month is not null and (featured_month is null or array_length(featured_month, 1) is null);
  end if;

  -- spiked → thorny
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='spiked') then
    update public.plants set thorny = spiked where spiked is not null and thorny is null;
  end if;

  -- scent → fragrance
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='scent') then
    update public.plants set fragrance = scent where scent is not null and fragrance is null;
  end if;

  -- tutoring → staking
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='tutoring') then
    update public.plants set staking = tutoring where tutoring is not null and staking is null;
  end if;

  -- companions → companion_plants
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='companions') then
    update public.plants set companion_plants = companions
      where companions is not null and array_length(companions, 1) > 0
      and (companion_plants is null or array_length(companion_plants, 1) is null);
  end if;

  -- comestible_part → edible_part (with value mapping)
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='comestible_part') then
    update public.plants set edible_part = array_replace(comestible_part, 'root', 'rhizome')
      where comestible_part is not null and array_length(comestible_part, 1) > 0
      and (edible_part is null or array_length(edible_part, 1) is null);
  end if;

  -- habitat → climate
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='habitat') then
    update public.plants set climate = case
      when habitat is not null and array_length(habitat, 1) > 0 then (
        select array_agg(case
          when v = 'tropical' then 'tropical_humid'
          when v = 'temperate' then 'temperate_continental'
          when v = 'arid' then 'tropical_dry'
          when v = 'mediterranean' then 'mediterranean'
          when v = 'mountain' then 'montane'
          when v = 'coastal' then 'windswept_coastal'
          when v = 'oceanic' then 'oceanic'
          else v
        end)
        from unnest(habitat) as v
        where v not in ('aquatic','semi-aquatic','wetland','grassland','forest','urban')
      )
      else '{}'::text[]
    end where habitat is not null and array_length(habitat, 1) > 0
      and (climate is null or array_length(climate, 1) is null);
  end if;

  -- composition → landscaping (with value mapping)
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='composition') then
    update public.plants set landscaping = (
      select array_agg(case
        when v = 'flowerbed' then 'flowerbed'
        when v = 'path' then 'path'
        when v = 'hedge' then 'hedge'
        when v = 'ground cover' then 'ground_cover'
        when v = 'pot' then 'pot'
        else v
      end)
      from unnest(composition) as v
    )
    where composition is not null and array_length(composition, 1) > 0
      and (landscaping is null or array_length(landscaping, 1) is null);
  end if;

  -- level_sun (text) → sunlight (text[])
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='level_sun') then
    update public.plants set sunlight = array[case
      when level_sun = 'low light' then 'low_light'
      when level_sun = 'shade' then 'deep_shade'
      when level_sun = 'partial sun' then 'partial_sun'
      when level_sun = 'full sun' then 'full_sun'
      else level_sun
    end]
    where level_sun is not null and (sunlight is null or array_length(sunlight, 1) is null);
  end if;

  -- maintenance_level (text) → care_level (text[])
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='maintenance_level') then
    update public.plants set care_level = array[case
      when maintenance_level in ('none','low') then 'easy'
      when maintenance_level = 'moderate' then 'moderate'
      when maintenance_level = 'heavy' then 'complex'
      else maintenance_level
    end]
    where maintenance_level is not null and (care_level is null or array_length(care_level, 1) is null);
  end if;

  -- soil → substrate
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='soil') then
    update public.plants set substrate = soil
      where soil is not null and array_length(soil, 1) > 0
      and (substrate is null or array_length(substrate, 1) is null);
  end if;

  -- mulching (text[]) → mulch_type (text[]) + mulching_needed (boolean)
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='mulching'
    and data_type = 'ARRAY') then
    update public.plants set mulch_type = mulching
      where mulching is not null and array_length(mulching, 1) > 0
      and (mulch_type is null or array_length(mulch_type, 1) is null);
    update public.plants set mulching_needed = true
      where mulching is not null and array_length(mulching, 1) > 0 and mulching_needed is null;
  end if;

  -- sow_type → sowing_method (with value mapping)
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='sow_type') then
    update public.plants set sowing_method = (
      select array_agg(case
        when v = 'direct' then 'open_ground'
        when v = 'indoor' then 'greenhouse'
        when v = 'seed tray' then 'tray'
        when v = 'cell' then 'tray'
        else v
      end)
      from unnest(sow_type) as v
    )
    where sow_type is not null and array_length(sow_type, 1) > 0
      and (sowing_method is null or array_length(sowing_method, 1) is null);
  end if;

  -- polenizer → pollinators_attracted
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='polenizer') then
    update public.plants set pollinators_attracted = polenizer
      where polenizer is not null and array_length(polenizer, 1) > 0
      and (pollinators_attracted is null or array_length(pollinators_attracted, 1) is null);
  end if;

  -- melliferous → biodiversity_role (add 'melliferous' to role list)
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='melliferous') then
    update public.plants set biodiversity_role = array_append(coalesce(biodiversity_role, '{}'), 'melliferous')
      where melliferous = true and not ('melliferous' = any(coalesce(biodiversity_role, '{}')));
  end if;

  -- be_fertilizer → biodiversity_role (add 'green_manure' to role list)
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='be_fertilizer') then
    update public.plants set biodiversity_role = array_append(coalesce(biodiversity_role, '{}'), 'green_manure')
      where be_fertilizer = true and not ('green_manure' = any(coalesce(biodiversity_role, '{}')));
  end if;

  -- Migrate utility enum values (old → new)
  begin
    update public.plants set utility = (
      select array_agg(case
        when v = 'comestible' then 'edible'
        when v = 'ornemental' then 'ornamental'
        when v = 'odorous' then 'fragrant'
        when v in ('produce_fruit','climbing') then null
        else v
      end)
      from unnest(utility) as v
      where case
        when v = 'comestible' then 'edible'
        when v = 'ornemental' then 'ornamental'
        when v = 'odorous' then 'fragrant'
        when v in ('produce_fruit','climbing') then null
        else v
      end is not null
    )
    where utility is not null and array_length(utility, 1) > 0
      and utility && array['comestible','ornemental','odorous','produce_fruit','climbing'];
  exception when others then null;
  end;

  -- Migrate toxicity enum values (old → new)
  begin
    update public.plants set toxicity_human = case
      when toxicity_human = 'non-toxic' then 'non_toxic'
      when toxicity_human = 'midly irritating' then 'slightly_toxic'
      when toxicity_human = 'highly toxic' then 'very_toxic'
      when toxicity_human = 'lethally toxic' then 'deadly'
      else toxicity_human
    end where toxicity_human is not null and toxicity_human in ('non-toxic','midly irritating','highly toxic','lethally toxic');
  exception when others then null;
  end;

  begin
    update public.plants set toxicity_pets = case
      when toxicity_pets = 'non-toxic' then 'non_toxic'
      when toxicity_pets = 'midly irritating' then 'slightly_toxic'
      when toxicity_pets = 'highly toxic' then 'very_toxic'
      when toxicity_pets = 'lethally toxic' then 'deadly'
      else toxicity_pets
    end where toxicity_pets is not null and toxicity_pets in ('non-toxic','midly irritating','highly toxic','lethally toxic');
  exception when others then null;
  end;

  -- Migrate watering_type enum values (old → new)
  begin
    update public.plants set watering_type = (
      select array_agg(case
        when v = 'buried' then 'drip'
        when v = 'drop' then 'drip'
        when v = 'drench' then 'soaking'
        else v
      end)
      from unnest(watering_type) as v
    )
    where watering_type is not null and array_length(watering_type, 1) > 0
      and watering_type && array['buried','drop','drench'];
  exception when others then null;
  end;

  -- Migrate division enum values (old → new)
  begin
    update public.plants set division = (
      select array_agg(case
        when v = 'division' then 'clump_division'
        when v = 'tissue separation' then 'clump_division'
        when v = 'bulb separation' then 'bulb_division'
        else v
      end)
      from unnest(division) as v
    )
    where division is not null and array_length(division, 1) > 0
      and division && array['division','tissue separation','bulb separation'];
  exception when others then null;
  end;

  -- Migrate status values (fix typo)
  begin
    update public.plants set status = 'in_progress' where status = 'in progres';
  exception when others then null;
  end;

  -- Value-map renamed columns (needed when Phase 0.5 renamed old→new but values are still old)
  begin
    update public.plants set edible_part = array_replace(edible_part, 'root', 'rhizome')
      where edible_part is not null and array_length(edible_part, 1) > 0
      and 'root' = any(edible_part);
  exception when others then null;
  end;

  begin
    update public.plants set climate = (
      select coalesce(array_agg(case
        when v = 'tropical' then 'tropical_humid'
        when v = 'temperate' then 'temperate_continental'
        when v = 'arid' then 'tropical_dry'
        when v = 'mediterranean' then 'mediterranean'
        when v = 'mountain' then 'montane'
        when v = 'coastal' then 'windswept_coastal'
        when v = 'oceanic' then 'oceanic'
        else v
      end), '{}'::text[])
      from unnest(climate) as v
      where v not in ('aquatic','semi-aquatic','wetland','grassland','forest','urban')
    )
    where climate is not null and array_length(climate, 1) > 0
      and climate && array['tropical','temperate','arid','mountain','coastal'];
  exception when others then null;
  end;

  begin
    update public.plants set landscaping = (
      select coalesce(array_agg(case
        when v = 'ground cover' then 'ground_cover'
        else v
      end), '{}'::text[])
      from unnest(landscaping) as v
    )
    where landscaping is not null and array_length(landscaping, 1) > 0
      and landscaping && array['ground cover'];
  exception when others then null;
  end;

  begin
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
  exception when others then null;
  end;

  -- foliage_persistence value-mapping is handled in Phase 0.5 $rename_and_retype$ block

  -- Backfill mulching_needed from mulch_type (for Phase 0.5 rename of mulching→mulch_type)
  begin
    update public.plants set mulching_needed = true
      where mulch_type is not null and array_length(mulch_type, 1) > 0
      and (mulching_needed is null or mulching_needed = false);
  exception when others then null;
  end;

  -- Migrate conservation_status from text to text[] (if still text type)
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='plants' and column_name='conservation_status'
    and data_type = 'text' and udt_name = 'text'
  ) then
    begin
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

      -- Map old values to new
      update public.plants set conservation_status = case
        when conservation_status::text = 'safe' then 'least_concern'
        when conservation_status::text = 'at risk' then 'near_threatened'
        when conservation_status::text = 'critically endangered' then 'critically_endangered'
        else conservation_status::text
      end where conservation_status is not null;

      -- Change type from text to text[]
      alter table public.plants alter column conservation_status type text[]
        using case when conservation_status is not null then array[conservation_status::text] else '{}'::text[] end;
      alter table public.plants alter column conservation_status set default '{}'::text[];
      alter table public.plants alter column conservation_status set not null;
    exception when others then null;
    end;
  end if;

  -- Migrate life_cycle from text to text[] (if still text type)
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='plants' and column_name='life_cycle'
    and data_type = 'text' and udt_name = 'text'
  ) then
    begin
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
    exception when others then null;
    end;
  end if;

  -- Migrate foliage_persistance (text) → foliage_persistence (text[])
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='foliage_persistance') then
    begin
      declare r record;
      begin
        for r in (
          select c.conname from pg_constraint c
          join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid
          where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'foliage_persistance'
        ) loop
          execute 'alter table public.plants drop constraint ' || quote_ident(r.conname);
        end loop;
      end;

      update public.plants set foliage_persistence = array[case
        when foliage_persistance = 'semi-evergreen' then 'semi_evergreen'
        else foliage_persistance
      end]
      where foliage_persistance is not null
        and (foliage_persistence is null or array_length(foliage_persistence, 1) is null);
    exception when others then null;
    end;
  end if;

  -- Migrate living_space from text to text[] (if still text type)
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='plants' and column_name='living_space'
    and data_type = 'text' and udt_name = 'text'
  ) then
    begin
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
    exception when others then null;
    end;
  end if;

end $migrate_plants$;

-- ========== Phase 3: Drop old check constraints and add new ones ==========
-- Uses robust pattern: find constraints by column attribute, not name pattern
do $update_constraints$
declare
  r record;
  _col text;
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'plants') then
    return;
  end if;

  -- Drop and recreate constraints for columns with updated enum values
  -- Each block: drop all check constraints on the column, then add the new one

  -- climate
  for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'climate') loop
    execute 'alter table public.plants drop constraint ' || quote_ident(r.conname);
  end loop;
  begin
    alter table public.plants add constraint plants_climate_check check (climate <@ array['polar','montane','oceanic','degraded_oceanic','temperate_continental','mediterranean','tropical_dry','tropical_humid','tropical_volcanic','tropical_cyclonic','humid_insular','subtropical_humid','equatorial','windswept_coastal']) not valid;
  exception when duplicate_object then null; when check_violation then null;
  end;

  -- Drop encyclopedia_category column if it still exists (removed from schema)
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='encyclopedia_category') then
    for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'encyclopedia_category') loop
      execute 'alter table public.plants drop constraint ' || quote_ident(r.conname);
    end loop;
    alter table public.plants drop column encyclopedia_category;
  end if;

  -- plant_type
  for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'plant_type') loop
    execute 'alter table public.plants drop constraint ' || quote_ident(r.conname);
  end loop;
  begin
    alter table public.plants add constraint plants_plant_type_check check (plant_type is null or plant_type in ('plant','flower','bamboo','shrub','tree','cactus','succulent')) not valid;
  exception when duplicate_object then null; when check_violation then null;
  end;

  -- Drop utility check constraints first, before any UPDATEs to the utility column
  -- (existing data may contain values not in the allowed set)
  for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'utility') loop
    execute 'alter table public.plants drop constraint ' || quote_ident(r.conname);
  end loop;

  -- Drop duplicate boolean columns (infusion, medicinal, aromatherapy, fragrance) — now driven by utility enum
  for _col in select unnest(array['infusion','medicinal','aromatherapy','fragrance']) loop
    if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name=_col) then
      -- Migrate boolean true → add equivalent to utility array before dropping
      if _col = 'infusion' then
        update public.plants set utility = array_append(utility, 'infusion')
          where infusion = true and not ('infusion' = any(utility));
      elsif _col = 'aromatherapy' then
        update public.plants set utility = array_append(utility, 'aromatic')
          where aromatherapy = true and not ('aromatic' = any(utility));
      elsif _col = 'fragrance' then
        update public.plants set utility = array_append(utility, 'fragrant')
          where fragrance = true and not ('fragrant' = any(utility));
      elsif _col = 'medicinal' then
        update public.plants set utility = array_append(utility, 'medicinal')
          where medicinal = true and not ('medicinal' = any(utility));
      end if;
      execute 'alter table public.plants drop column ' || quote_ident(_col);
    end if;
  end loop;

  -- Drop user_notes from plants table — replaced by plant_reports
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='user_notes') then
    alter table public.plants drop column user_notes;
  end if;

  -- Drop varieties from plants table — auto-detected from scientific_name_species
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='plants' and column_name='varieties') then
    alter table public.plants drop column varieties;
  end if;

  -- utility
  for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'utility') loop
    execute 'alter table public.plants drop constraint ' || quote_ident(r.conname);
  end loop;
  begin
    alter table public.plants add constraint plants_utility_check check (utility <@ array['edible','ornamental','aromatic','medicinal','fragrant','cereal','spice','infusion']) not valid;
  exception when duplicate_object then null; when check_violation then null;
  end;

  -- edible_part
  for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'edible_part') loop
    execute 'alter table public.plants drop constraint ' || quote_ident(r.conname);
  end loop;
  begin
    alter table public.plants add constraint plants_edible_part_check check (edible_part <@ array['flower','fruit','seed','leaf','stem','bulb','rhizome','bark','wood']) not valid;
  exception when duplicate_object then null; when check_violation then null;
  end;

  -- toxicity_human
  for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'toxicity_human') loop
    execute 'alter table public.plants drop constraint ' || quote_ident(r.conname);
  end loop;
  begin
    alter table public.plants add constraint plants_toxicity_human_check check (toxicity_human in ('non_toxic','slightly_toxic','very_toxic','deadly','undetermined')) not valid;
  exception when duplicate_object then null; when check_violation then null;
  end;

  -- toxicity_pets
  for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'toxicity_pets') loop
    execute 'alter table public.plants drop constraint ' || quote_ident(r.conname);
  end loop;
  begin
    alter table public.plants add constraint plants_toxicity_pets_check check (toxicity_pets in ('non_toxic','slightly_toxic','very_toxic','deadly','undetermined')) not valid;
  exception when duplicate_object then null; when check_violation then null;
  end;

  -- poisoning_method
  for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'poisoning_method') loop
    execute 'alter table public.plants drop constraint ' || quote_ident(r.conname);
  end loop;
  begin
    alter table public.plants add constraint plants_poisoning_method_check check (poisoning_method <@ array['touch','ingestion','eye_contact','inhalation','sap_contact']) not valid;
  exception when duplicate_object then null; when check_violation then null;
  end;

  -- life_cycle
  for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'life_cycle') loop
    execute 'alter table public.plants drop constraint ' || quote_ident(r.conname);
  end loop;
  begin
    alter table public.plants add constraint plants_life_cycle_check check (life_cycle <@ array['annual','biennial','perennial','succulent_perennial','monocarpic','short_cycle','ephemeral']) not valid;
  exception when duplicate_object then null; when check_violation then null;
  end;

  -- average_lifespan
  for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'average_lifespan') loop
    execute 'alter table public.plants drop constraint ' || quote_ident(r.conname);
  end loop;
  begin
    alter table public.plants add constraint plants_average_lifespan_check check (average_lifespan <@ array['less_than_1_year','2_years','3_to_10_years','10_to_50_years','over_50_years']) not valid;
  exception when duplicate_object then null; when check_violation then null;
  end;

  -- foliage_persistence
  for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'foliage_persistence') loop
    execute 'alter table public.plants drop constraint ' || quote_ident(r.conname);
  end loop;
  begin
    alter table public.plants add constraint plants_foliage_persistence_check check (foliage_persistence <@ array['deciduous','evergreen','semi_evergreen','marcescent','winter_dormant','dry_season_deciduous']) not valid;
  exception when duplicate_object then null; when check_violation then null;
  end;

  -- living_space
  for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'living_space') loop
    execute 'alter table public.plants drop constraint ' || quote_ident(r.conname);
  end loop;
  begin
    alter table public.plants add constraint plants_living_space_check check (living_space <@ array['indoor','outdoor','both','terrarium','greenhouse']) not valid;
  exception when duplicate_object then null; when check_violation then null;
  end;

  -- landscaping
  for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'landscaping') loop
    execute 'alter table public.plants drop constraint ' || quote_ident(r.conname);
  end loop;
  begin
    alter table public.plants add constraint plants_landscaping_check check (landscaping <@ array['pot','planter','hanging','window_box','green_wall','flowerbed','border','edging','path','tree_base','vegetable_garden','orchard','hedge','free_growing','trimmed_hedge','windbreak','pond_edge','waterside','ground_cover','grove','background','foreground']) not valid;
  exception when duplicate_object then null; when check_violation then null;
  end;

  -- plant_habit
  for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'plant_habit') loop
    execute 'alter table public.plants drop constraint ' || quote_ident(r.conname);
  end loop;
  begin
    alter table public.plants add constraint plants_plant_habit_check check (plant_habit <@ array['upright','arborescent','shrubby','bushy','clumping','erect','creeping','carpeting','ground_cover','prostrate','spreading','climbing','twining','scrambling','liana','trailing','columnar','conical','fastigiate','globular','spreading_flat','rosette','cushion','ball_shaped','succulent','palmate','rhizomatous','suckering']) not valid;
  exception when duplicate_object then null; when check_violation then null;
  end;

  -- care_level
  for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'care_level') loop
    execute 'alter table public.plants drop constraint ' || quote_ident(r.conname);
  end loop;
  begin
    alter table public.plants add constraint plants_care_level_check check (care_level <@ array['easy','moderate','complex']) not valid;
  exception when duplicate_object then null; when check_violation then null;
  end;

  -- sunlight
  for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'sunlight') loop
    execute 'alter table public.plants drop constraint ' || quote_ident(r.conname);
  end loop;
  begin
    alter table public.plants add constraint plants_sunlight_check check (sunlight <@ array['full_sun','partial_sun','partial_shade','light_shade','deep_shade','direct_light','bright_indirect_light','medium_light','low_light']) not valid;
  exception when duplicate_object then null; when check_violation then null;
  end;

  -- watering_type
  for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'watering_type') loop
    execute 'alter table public.plants drop constraint ' || quote_ident(r.conname);
  end loop;
  begin
    alter table public.plants add constraint plants_watering_type_check check (watering_type <@ array['hose','surface','drip','soaking','wick']) not valid;
  exception when duplicate_object then null; when check_violation then null;
  end;

  -- division
  for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'division') loop
    execute 'alter table public.plants drop constraint ' || quote_ident(r.conname);
  end loop;
  begin
    alter table public.plants add constraint plants_division_check check (division <@ array['seed','clump_division','bulb_division','rhizome_division','cutting','layering','stolon','sucker','grafting','spore']) not valid;
  exception when duplicate_object then null; when check_violation then null;
  end;

  -- sowing_method
  for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'sowing_method') loop
    execute 'alter table public.plants drop constraint ' || quote_ident(r.conname);
  end loop;
  begin
    alter table public.plants add constraint plants_sowing_method_check check (sowing_method <@ array['open_ground','pot','tray','greenhouse','mini_greenhouse','broadcast','row']) not valid;
  exception when duplicate_object then null; when check_violation then null;
  end;

  -- conservation_status
  for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'conservation_status') loop
    execute 'alter table public.plants drop constraint ' || quote_ident(r.conname);
  end loop;
  begin
    alter table public.plants add constraint plants_conservation_status_check check (conservation_status <@ array['least_concern','near_threatened','vulnerable','endangered','critically_endangered','extinct_in_wild','extinct','data_deficient','not_evaluated']) not valid;
  exception when duplicate_object then null; when check_violation then null;
  end;

  -- ecological_tolerance
  for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'ecological_tolerance') loop
    execute 'alter table public.plants drop constraint ' || quote_ident(r.conname);
  end loop;
  begin
    alter table public.plants add constraint plants_ecological_tolerance_check check (ecological_tolerance <@ array['drought','scorching_sun','permanent_shade','excess_water','frost','heatwave','wind']) not valid;
  exception when duplicate_object then null; when check_violation then null;
  end;

  -- ecological_impact
  for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'ecological_impact') loop
    execute 'alter table public.plants drop constraint ' || quote_ident(r.conname);
  end loop;
  begin
    alter table public.plants add constraint plants_ecological_impact_check check (ecological_impact <@ array['neutral','favorable','potentially_invasive','locally_invasive']) not valid;
  exception when duplicate_object then null; when check_violation then null;
  end;

  -- substrate (tag[] — free-form, drop constraint)
  for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'substrate') loop
    execute 'alter table public.plants drop constraint ' || quote_ident(r.conname);
  end loop;

  -- mulch_type (tag[] — free-form, drop constraint)
  for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'mulch_type') loop
    execute 'alter table public.plants drop constraint ' || quote_ident(r.conname);
  end loop;

  -- cultivation_mode
  for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'cultivation_mode') loop
    execute 'alter table public.plants drop constraint ' || quote_ident(r.conname);
  end loop;
  begin
    alter table public.plants add constraint plants_cultivation_mode_check check (cultivation_mode <@ array['open_ground','flowerbed','vegetable_garden','raised_bed','orchard','rockery','slope','mound','pot','planter','hanging','greenhouse','indoor','pond','waterlogged_soil','hydroponic','aquaponic','mineral_substrate','permaculture','agroforestry']) not valid;
  exception when duplicate_object then null; when check_violation then null;
  end;

  -- ecological_status (tag[] — free-form, drop constraint)
  for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'ecological_status') loop
    execute 'alter table public.plants drop constraint ' || quote_ident(r.conname);
  end loop;

  -- biotopes (tag[] — free-form, drop constraint)
  for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'biotopes') loop
    execute 'alter table public.plants drop constraint ' || quote_ident(r.conname);
  end loop;

  -- urban_biotopes (tag[] — free-form, drop constraint)
  for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'urban_biotopes') loop
    execute 'alter table public.plants drop constraint ' || quote_ident(r.conname);
  end loop;

  -- biodiversity_role (tag[] — free-form, drop constraint)
  for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'biodiversity_role') loop
    execute 'alter table public.plants drop constraint ' || quote_ident(r.conname);
  end loop;

  -- ecological_management (tag[] — free-form, drop constraint)
  for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'ecological_management') loop
    execute 'alter table public.plants drop constraint ' || quote_ident(r.conname);
  end loop;

  -- season
  for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'season') loop
    execute 'alter table public.plants drop constraint ' || quote_ident(r.conname);
  end loop;
  begin
    alter table public.plants add constraint plants_season_check check (season <@ array['spring','summer','autumn','winter']) not valid;
  exception when duplicate_object then null; when check_violation then null;
  end;

  -- edible_oil
  for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'edible_oil') loop
    execute 'alter table public.plants drop constraint ' || quote_ident(r.conname);
  end loop;
  begin
    alter table public.plants add constraint plants_edible_oil_check check (edible_oil in ('yes','no','unknown')) not valid;
  exception when duplicate_object then null; when check_violation then null;
  end;

  -- status
  for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'status') loop
    execute 'alter table public.plants drop constraint ' || quote_ident(r.conname);
  end loop;
  begin
    alter table public.plants add constraint plants_status_check check (status in ('in_progress','rework','review','approved')) not valid;
  exception when duplicate_object then null; when check_violation then null;
  end;

  -- Drop old check constraints on removed columns (nutrition_need, fertilizer — now unconstrained)
  for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'nutrition_need') loop
    execute 'alter table public.plants drop constraint ' || quote_ident(r.conname);
  end loop;
  for r in (select c.conname from pg_constraint c join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid where c.conrelid = 'public.plants'::regclass and c.contype = 'c' and a.attname = 'fertilizer') loop
    execute 'alter table public.plants drop constraint ' || quote_ident(r.conname);
  end loop;

end $update_constraints$;

-- Set status default and backfill null values
alter table if exists public.plants alter column status set default 'in_progress';
update public.plants set status = 'in_progress' where status is null;

-- Drop obsolete JSON/old columns
alter table if exists public.plants drop column if exists identity;
alter table if exists public.plants drop column if exists plant_care;
alter table if exists public.plants drop column if exists growth;
alter table if exists public.plants drop column if exists usage;
alter table if exists public.plants drop column if exists ecology;
alter table if exists public.plants drop column if exists danger;
alter table if exists public.plants drop column if exists miscellaneous;
alter table if exists public.plants drop column if exists meta;
alter table if exists public.plants drop column if exists identifiers;
alter table if exists public.plants drop column if exists traits;
alter table if exists public.plants drop column if exists dimensions;
alter table if exists public.plants drop column if exists phenology;
alter table if exists public.plants drop column if exists environment;
alter table if exists public.plants drop column if exists care;
alter table if exists public.plants drop column if exists propagation;
alter table if exists public.plants drop column if exists commerce;
alter table if exists public.plants drop column if exists problems;
alter table if exists public.plants drop column if exists planting;
alter table if exists public.plants drop column if exists photos;
alter table if exists public.plants drop column if exists classification;
alter table if exists public.plants drop column if exists description;
alter table if exists public.plants drop column if exists seasons;
alter table if exists public.plants drop column if exists seeds_available;
alter table if exists public.plants drop column if exists water_freq_period;
alter table if exists public.plants drop column if exists water_freq_amount;
alter table if exists public.plants drop column if exists water_freq_unit;
alter table if exists public.plants drop column if exists water_freq_value;
alter table if exists public.plants drop column if exists updated_at;

-- ========== Phase 4: Column whitelist — drops any column not in the new schema ==========
do $$ declare
  allowed_columns constant text[] := array[
    'id',
    'name',
    -- Section 1: Base
    'plant_type',
    'scientific_name_species',
    'variety',
    'family',
    'featured_month',
    -- Section 2: Identity
    'climate',
    'season',
    'utility',
    'edible_part',
    'thorny',
    'toxicity_human',
    'toxicity_pets',
    'poisoning_method',
    'life_cycle',
    'average_lifespan',
    'foliage_persistence',
    'living_space',
    'landscaping',
    'plant_habit',
    'multicolor',
    'bicolor',
    -- Section 3: Care
    'care_level',
    'sunlight',
    'temperature_max',
    'temperature_min',
    'temperature_ideal',
    'watering_mode',
    'watering_frequency_warm',
    'watering_frequency_cold',
    'watering_type',
    'hygrometry',
    'misting_frequency',
    'special_needs',
    'substrate',
    'substrate_mix',
    'mulching_needed',
    'mulch_type',
    'nutrition_need',
    'fertilizer',
    -- Section 4: Growth
    'sowing_month',
    'flowering_month',
    'fruiting_month',
    'height_cm',
    'wingspan_cm',
    'separation_cm',
    'staking',
    'division',
    'cultivation_mode',
    'sowing_method',
    'transplanting',
    'pruning',
    'pruning_month',
    -- Section 6: Ecology
    'conservation_status',
    'ecological_status',
    'biotopes',
    'urban_biotopes',
    'ecological_tolerance',
    'biodiversity_role',
    'pollinators_attracted',
    'birds_attracted',
    'mammals_attracted',
    'ecological_management',
    'ecological_impact',
    -- Section 7: Consumption
    'infusion_parts',
    'edible_oil',
    -- Section 8: Misc
    'companion_plants',
    'biotope_plants',
    'beneficial_plants',
    'harmful_plants',
    'sponsored_shop_ids',
    -- Section 9: Meta
    'status',
    'admin_commentary',
    'created_by',
    'created_time',
    'updated_by',
    'updated_time'
  ];
  rec record;
begin
  for rec in
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'plants'
  loop
    if not (rec.column_name = any(allowed_columns)) then
      execute format('alter table public.%I drop column %I cascade', 'plants', rec.column_name);
    end if;
  end loop;
end $$;

alter table public.plants enable row level security;
-- Clean up legacy duplicate read policies if present
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plants' and policyname='Allow read plants') then
    drop policy "Allow read plants" on public.plants;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plants' and policyname='Allow select for all') then
    drop policy "Allow select for all" on public.plants;
  end if;
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plants' and policyname='plants_select_all') then
    drop policy plants_select_all on public.plants;
  end if;
  create policy plants_select_all on public.plants for select to authenticated, anon using (true);
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plants' and policyname='plants_iud_all') then
    drop policy plants_iud_all on public.plants;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plants' and policyname='plants_insert') then
    drop policy plants_insert on public.plants;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plants' and policyname='plants_update') then
    drop policy plants_update on public.plants;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plants' and policyname='plants_delete') then
    drop policy plants_delete on public.plants;
  end if;
  create policy plants_insert on public.plants for insert to authenticated with check (true);
  create policy plants_update on public.plants for update to authenticated using (true) with check (true);
  create policy plants_delete on public.plants for delete to authenticated using (true);
end $$;

-- ========== Plant watering schedules ==========
create table if not exists public.plant_watering_schedules (
  id uuid primary key default gen_random_uuid(),
  plant_id text not null references public.plants(id) on delete cascade,
  season text check (season is null or season in ('spring','summer','autumn','winter','hot','cold')),
  quantity integer,
  time_period text check (time_period is null or time_period in ('week','month','year')),
  created_at timestamptz not null default now()
);
alter table public.plant_watering_schedules alter column season drop not null;
alter table public.plant_watering_schedules alter column quantity drop not null;
alter table public.plant_watering_schedules alter column time_period drop not null;
do $$ begin
  if exists (
    select 1
    from information_schema.columns
    where table_name='plant_watering_schedules'
      and column_name='quantity'
      and data_type <> 'integer'
  ) then
    alter table public.plant_watering_schedules alter column quantity type integer using nullif(quantity, '')::integer;
  end if;
end $$;
do $$ begin
  if exists (select 1 from information_schema.constraint_column_usage where table_name='plant_watering_schedules' and constraint_name='plant_watering_schedules_season_check') then
    alter table public.plant_watering_schedules drop constraint plant_watering_schedules_season_check;
  end if;
  if exists (select 1 from information_schema.constraint_column_usage where table_name='plant_watering_schedules' and constraint_name='plant_watering_schedules_time_period_check') then
    alter table public.plant_watering_schedules drop constraint plant_watering_schedules_time_period_check;
  end if;
  alter table public.plant_watering_schedules add constraint plant_watering_schedules_season_check check (season is null or season in ('spring','summer','autumn','winter','hot','cold'));
  alter table public.plant_watering_schedules add constraint plant_watering_schedules_time_period_check check (time_period is null or time_period in ('week','month','year'));
end $$;
create index if not exists plant_watering_schedules_plant_id_idx on public.plant_watering_schedules(plant_id);
alter table public.plant_watering_schedules enable row level security;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_watering_schedules' and policyname='plant_watering_schedules_select_all') then
    drop policy plant_watering_schedules_select_all on public.plant_watering_schedules;
  end if;
  create policy plant_watering_schedules_select_all on public.plant_watering_schedules for select to authenticated, anon using (true);
end $$;

-- ========== Plant sources ==========
create table if not exists public.plant_sources (
  id uuid primary key default gen_random_uuid(),
  plant_id text not null references public.plants(id) on delete cascade,
  name text not null,
  url text,
  created_at timestamptz not null default now()
);
create index if not exists plant_sources_plant_id_idx on public.plant_sources(plant_id);
alter table public.plant_sources enable row level security;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_sources' and policyname='plant_sources_select_all') then
    drop policy plant_sources_select_all on public.plant_sources;
  end if;
  create policy plant_sources_select_all on public.plant_sources for select to authenticated, anon using (true);
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_sources' and policyname='plant_sources_all') then
    drop policy plant_sources_all on public.plant_sources;
  end if;
  create policy plant_sources_all on public.plant_sources for all to authenticated using (true) with check (true);
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_watering_schedules' and policyname='plant_watering_schedules_all') then
    drop policy plant_watering_schedules_all on public.plant_watering_schedules;
  end if;
  create policy plant_watering_schedules_all on public.plant_watering_schedules for all to authenticated using (true) with check (true);
end $$;

-- ========== Plant contributors ==========
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
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_contributors' and policyname='plant_contributors_write') then
    drop policy plant_contributors_write on public.plant_contributors;
  end if;
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

-- ========== Substrate recipes (admin-managed mix formulas) ==========
-- Stores reusable substrate mix recipes that can be referenced by plants.
-- Each recipe has a canonical English name, a category, and a list of ingredients.
-- Recipes are managed by admins/editors; readable by everyone.
-- Plants reference recipes via the substrate_mix text[] column (stores recipe IDs).
create table if not exists public.substrate_recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text not null check (category in (
    'orchid','cactus_succulent','carnivorous','seedling',
    'tropical','aroid','bonsai','aquatic','general'
  )),
  ingredients text[] not null default '{}'::text[],
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists substrate_recipes_category_idx on public.substrate_recipes(category);
alter table public.substrate_recipes enable row level security;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='substrate_recipes' and policyname='substrate_recipes_select_all') then
    drop policy substrate_recipes_select_all on public.substrate_recipes;
  end if;
  create policy substrate_recipes_select_all on public.substrate_recipes for select to authenticated, anon using (true);
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='substrate_recipes' and policyname='substrate_recipes_write') then
    drop policy substrate_recipes_write on public.substrate_recipes;
  end if;
  create policy substrate_recipes_write on public.substrate_recipes
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

comment on table public.substrate_recipes is 'Admin-managed substrate mix recipes. Referenced by plants.substrate_mix (stores recipe IDs).';
comment on column public.substrate_recipes.name is 'Canonical English name (unique). e.g. Orchid Bark Mix';
comment on column public.substrate_recipes.category is 'Recipe category for grouping';
comment on column public.substrate_recipes.ingredients is 'List of ingredient keys (free text, not constrained to substrate enum since recipe ingredients can be more specific)';

-- ========== Substrate recipe translations ==========
create table if not exists public.substrate_recipe_translations (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.substrate_recipes(id) on delete cascade,
  language text not null references public.translation_languages(code),
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recipe_id, language)
);

create index if not exists substrate_recipe_translations_recipe_id_idx on public.substrate_recipe_translations(recipe_id);
alter table public.substrate_recipe_translations enable row level security;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='substrate_recipe_translations' and policyname='substrate_recipe_translations_select_all') then
    drop policy substrate_recipe_translations_select_all on public.substrate_recipe_translations;
  end if;
  create policy substrate_recipe_translations_select_all on public.substrate_recipe_translations for select to authenticated, anon using (true);
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='substrate_recipe_translations' and policyname='substrate_recipe_translations_write') then
    drop policy substrate_recipe_translations_write on public.substrate_recipe_translations;
  end if;
  create policy substrate_recipe_translations_write on public.substrate_recipe_translations
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

-- ========== Pre-populate substrate recipes from Notion spec ==========
insert into public.substrate_recipes (name, category, ingredients) values
  -- Orchid recipes
  ('Pine Bark Mix', 'orchid', array['pine_bark','sphagnum_moss','horticultural_charcoal']),
  ('Bark & Perlite Mix', 'orchid', array['pine_bark','perlite']),
  -- Cactus & succulent recipes
  ('Cactus Draining Mix', 'cactus_succulent', array['river_sand','pozzite','universal_potting_mix']),
  ('Highly Draining Substrate', 'cactus_succulent', array['perlite','pumice','gravel']),
  ('Mineral-Heavy Substrate', 'cactus_succulent', array['pumice','pozzite','crushed_slate']),
  -- Carnivorous plant recipes
  ('Carnivorous Peat Mix', 'carnivorous', array['blonde_peat','river_sand']),
  ('Pure Sphagnum', 'carnivorous', array['sphagnum_moss']),
  ('Acidic Poor Substrate', 'carnivorous', array['blonde_peat','perlite']),
  -- Seedling recipes
  ('Fine Seedling Mix', 'seedling', array['seed_starting_mix']),
  ('Light Sterile Substrate', 'seedling', array['perlite','vermiculite']),
  ('Sifted Coconut Coir', 'seedling', array['coconut_coir'])
on conflict (name) do nothing;

-- ========== Plant infusion mixes ==========
create table if not exists public.plant_infusion_mixes (
  id uuid primary key default gen_random_uuid(),
  plant_id text not null references public.plants(id) on delete cascade,
  mix_name text not null,
  benefit text,
  created_at timestamptz not null default now()
);
create index if not exists plant_infusion_mixes_plant_id_idx on public.plant_infusion_mixes(plant_id);
alter table public.plant_infusion_mixes enable row level security;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_infusion_mixes' and policyname='plant_infusion_mixes_select_all') then
    drop policy plant_infusion_mixes_select_all on public.plant_infusion_mixes;
  end if;
  create policy plant_infusion_mixes_select_all on public.plant_infusion_mixes for select to authenticated, anon using (true);
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_infusion_mixes' and policyname='plant_infusion_mixes_all') then
    drop policy plant_infusion_mixes_all on public.plant_infusion_mixes;
  end if;
  create policy plant_infusion_mixes_all on public.plant_infusion_mixes for all to authenticated using (true) with check (true);
end $$;

-- ========== Plant recipes (structured recipe ideas with category and time) ==========
create table if not exists public.plant_recipes (
  id uuid primary key default gen_random_uuid(),
  plant_id text not null references public.plants(id) on delete cascade,
  name text not null,
  name_fr text,
  category text not null default 'other' check (category in ('breakfast_brunch','starters_appetizers','soups_salads','main_courses','side_dishes','desserts','drinks','other')),
  time text not null default 'undefined' check (time in ('quick','30_plus','slow_cooking','undefined')),
  link text,
  created_at timestamptz not null default now()
);

do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'plant_recipes' and column_name = 'link'
  ) then
    alter table public.plant_recipes add column link text;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'plant_recipes' and column_name = 'name_fr'
  ) then
    alter table public.plant_recipes add column name_fr text;
  end if;
end $$;
create index if not exists plant_recipes_plant_id_idx on public.plant_recipes(plant_id);
alter table public.plant_recipes enable row level security;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_recipes' and policyname='plant_recipes_select_all') then
    drop policy plant_recipes_select_all on public.plant_recipes;
  end if;
  create policy plant_recipes_select_all on public.plant_recipes for select to authenticated, anon using (true);
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_recipes' and policyname='plant_recipes_all') then
    drop policy plant_recipes_all on public.plant_recipes;
  end if;
  create policy plant_recipes_all on public.plant_recipes for all to authenticated using (true) with check (true);
end $$;

comment on table public.plant_recipes is 'Structured recipe ideas linked to plants, with meal category and preparation time';
comment on column public.plant_recipes.category is 'Meal category: breakfast_brunch, starters_appetizers, soups_salads, main_courses, side_dishes, desserts, drinks, other';
comment on column public.plant_recipes.time is 'Preparation time: quick (Quick and Effortless), 30_plus (30+ minutes), slow_cooking (Slow Cooking), undefined';
comment on column public.plant_recipes.link is 'Optional external URL to a recipe page (not filled by AI)';
comment on column public.plant_recipes.name_fr is 'French translation of recipe name (populated by DeepL during translate step)';

-- Migrate existing recipes_ideas from plant_translations to plant_recipes
do $migrate_recipes$
declare
  migrated_count integer := 0;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
    and table_name = 'plant_translations'
    and column_name = 'recipes_ideas'
  ) then
    return;
  end if;

  with recipe_entries as (
    select pt.plant_id, unnest(pt.recipes_ideas) as recipe_name
    from public.plant_translations pt
    where pt.language = 'en'
      and array_length(pt.recipes_ideas, 1) > 0
      and not exists (
        select 1 from public.plant_recipes pr where pr.plant_id = pt.plant_id
      )
  ),
  inserted as (
    insert into public.plant_recipes (plant_id, name, category, time)
    select plant_id, recipe_name, 'other', 'undefined'
    from recipe_entries
    where recipe_name is not null and trim(recipe_name) <> ''
    returning 1
  )
  select count(*) into migrated_count from inserted;

  if migrated_count > 0 then
    raise notice '[plant_recipes] Migrated % recipe entries from plant_translations', migrated_count;
  end if;
end $migrate_recipes$;

-- ========== Plant professional advice (Pro/Admin/Editor contributions) ==========
create table if not exists public.plant_pro_advices (
  id uuid primary key default gen_random_uuid(),
  plant_id text not null references public.plants(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  author_display_name text,
  author_username text,
  author_avatar_url text,
  author_roles text[] not null default '{}'::text[],
  content text not null,
  original_language text,
  translations jsonb not null default '{}'::jsonb,
  image_url text,
  reference_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint plant_pro_advices_content_not_blank check (char_length(btrim(content)) > 0),
  constraint plant_pro_advices_metadata_object check (metadata is null or jsonb_typeof(metadata) = 'object')
);

do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
    and table_name = 'plant_pro_advices'
    and column_name = 'original_language'
  ) then
    alter table public.plant_pro_advices add column original_language text;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
    and table_name = 'plant_pro_advices'
    and column_name = 'translations'
  ) then
    alter table public.plant_pro_advices add column translations jsonb not null default '{}'::jsonb;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public'
    and table_name = 'plant_pro_advices'
    and constraint_name = 'plant_pro_advices_translations_object'
  ) then
    alter table public.plant_pro_advices
      add constraint plant_pro_advices_translations_object
      check (translations is null or jsonb_typeof(translations) = 'object');
  end if;
end $$;

create index if not exists plant_pro_advices_plant_created_idx on public.plant_pro_advices (plant_id, created_at desc);
create index if not exists plant_pro_advices_original_language_idx on public.plant_pro_advices (original_language);

comment on column public.plant_pro_advices.original_language is 'ISO language code of the original content (e.g., en, fr). Detected via DeepL API when advice is created.';
comment on column public.plant_pro_advices.translations is 'JSONB object storing cached translations keyed by language code. Example: {"fr": "Traduit...", "en": "Translated..."}';

alter table public.plant_pro_advices enable row level security;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_pro_advices' and policyname='plant_pro_advices_select_all') then
    drop policy plant_pro_advices_select_all on public.plant_pro_advices;
  end if;
  create policy plant_pro_advices_select_all on public.plant_pro_advices for select to authenticated, anon using (true);
end $$;
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

-- ========== Plant images ==========
create table if not exists public.plant_images (
  id uuid primary key default gen_random_uuid(),
  plant_id text not null references public.plants(id) on delete cascade,
  link text not null,
  use text not null default 'other' check (use in ('primary','discovery','other')),
  created_at timestamptz not null default now(),
  unique (plant_id, link)
);
alter table if exists public.plant_images drop constraint if exists plant_images_link_key;
create unique index if not exists plant_images_plant_link_unique on public.plant_images (plant_id, link);
drop index if exists public.plant_images_use_unique;
create unique index plant_images_use_unique on public.plant_images (plant_id, use) where use in ('primary', 'discovery');
alter table public.plant_images enable row level security;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_images' and policyname='plant_images_select') then
    drop policy plant_images_select on public.plant_images;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_images' and policyname='plant_images_modify') then
    drop policy plant_images_modify on public.plant_images;
  end if;
  create policy plant_images_select on public.plant_images for select to authenticated, anon using (true);
  create policy plant_images_modify on public.plant_images for all to authenticated using (true) with check (true);
end $$;

-- ========== Color catalog and plant links ==========
create table if not exists public.colors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  hex_code text,
  is_primary boolean not null default false,
  parent_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='colors' and column_name='is_primary') then
    alter table public.colors add column is_primary boolean not null default false;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='colors' and column_name='parent_ids') then
    alter table public.colors add column parent_ids uuid[] not null default '{}';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='colors' and column_name='updated_at') then
    alter table public.colors add column updated_at timestamptz not null default now();
  end if;
  alter table public.colors alter column hex_code drop not null;
exception when others then null;
end $$;

do $$ begin
  alter table public.colors drop constraint if exists colors_hex_code_key;
exception when others then null;
end $$;

create table if not exists public.plant_colors (
  plant_id text not null references public.plants(id) on delete cascade,
  color_id uuid not null references public.colors(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (plant_id, color_id)
);

-- ========== Color translations ==========
create table if not exists public.color_translations (
  id uuid primary key default gen_random_uuid(),
  color_id uuid not null references public.colors(id) on delete cascade,
  language text not null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (color_id, language)
);

alter table public.colors enable row level security;
alter table public.plant_colors enable row level security;
alter table public.color_translations enable row level security;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='colors' and policyname='colors_read_all') then
    drop policy colors_read_all on public.colors;
  end if;
  create policy colors_read_all on public.colors for select to authenticated, anon using (true);
  if exists (select 1 from pg_policies where schemaname='public' and tablename='colors' and policyname='colors_modify') then
    drop policy colors_modify on public.colors;
  end if;
  create policy colors_modify on public.colors for all to authenticated using (true) with check (true);
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_colors' and policyname='plant_colors_all') then
    drop policy plant_colors_all on public.plant_colors;
  end if;
  create policy plant_colors_all on public.plant_colors for all to authenticated using (true) with check (true);
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_colors' and policyname='plant_colors_read') then
    drop policy plant_colors_read on public.plant_colors;
  end if;
  create policy plant_colors_read on public.plant_colors for select to authenticated, anon using (true);
  if exists (select 1 from pg_policies where schemaname='public' and tablename='color_translations' and policyname='color_translations_read_all') then
    drop policy color_translations_read_all on public.color_translations;
  end if;
  create policy color_translations_read_all on public.color_translations for select to authenticated, anon using (true);
  if exists (select 1 from pg_policies where schemaname='public' and tablename='color_translations' and policyname='color_translations_modify') then
    drop policy color_translations_modify on public.color_translations;
  end if;
  create policy color_translations_modify on public.color_translations for all to authenticated using (true) with check (true);
end $$;

create index if not exists idx_colors_parent_ids on public.colors using gin (parent_ids);
create index if not exists idx_colors_is_primary on public.colors (is_primary) where is_primary = true;
create index if not exists idx_color_translations_color_id on public.color_translations (color_id);
create index if not exists idx_color_translations_language on public.color_translations (language);

-- Language catalog for translations
create table if not exists public.translation_languages (
  code text primary key,
  label text
);

insert into public.translation_languages (code, label)
values
  ('en', 'English'),
  ('fr', 'Français')
on conflict (code) do update set label = excluded.label;

alter table public.translation_languages enable row level security;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='translation_languages' and policyname='translation_languages_all') then
    drop policy translation_languages_all on public.translation_languages;
  end if;
  create policy translation_languages_all on public.translation_languages for all to authenticated using (true) with check (true);
  if exists (select 1 from pg_policies where schemaname='public' and tablename='translation_languages' and policyname='translation_languages_read') then
    drop policy translation_languages_read on public.translation_languages;
  end if;
  create policy translation_languages_read on public.translation_languages for select to authenticated, anon using (true);
end $$;

-- ========== Plant information reports ==========
create table if not exists public.plant_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plant_id text not null references public.plants(id) on delete cascade,
  note text not null,
  image_url text,
  created_at timestamptz not null default now()
);
comment on table public.plant_reports is 'User-submitted reports about incorrect or outdated plant information';
create index if not exists plant_reports_plant_id_idx on public.plant_reports(plant_id);
create index if not exists plant_reports_user_id_idx on public.plant_reports(user_id);
create index if not exists plant_reports_created_at_idx on public.plant_reports(created_at desc);
alter table public.plant_reports enable row level security;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_reports' and policyname='plant_reports_select_admin') then
    drop policy plant_reports_select_admin on public.plant_reports;
  end if;
  create policy plant_reports_select_admin on public.plant_reports
    for select to authenticated
    using (
      exists (
        select 1 from public.profiles
        where id = auth.uid()
          and (is_admin = true or coalesce(public.has_any_role(auth.uid(), array['admin','editor']), false))
      )
    );
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_reports' and policyname='plant_reports_insert_auth') then
    drop policy plant_reports_insert_auth on public.plant_reports;
  end if;
  create policy plant_reports_insert_auth on public.plant_reports
    for insert to authenticated
    with check (auth.uid() = user_id);
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_reports' and policyname='plant_reports_delete_admin') then
    drop policy plant_reports_delete_admin on public.plant_reports;
  end if;
  create policy plant_reports_delete_admin on public.plant_reports
    for delete to authenticated
    using (
      exists (
        select 1 from public.profiles
        where id = auth.uid()
          and (is_admin = true or coalesce(public.has_any_role(auth.uid(), array['admin','editor']), false))
      )
    );
end $$;
