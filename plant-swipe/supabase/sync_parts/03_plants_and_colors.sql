-- ========== Plants base table ==========
-- ARCHITECTURE NOTE: As of 2024, ALL translatable content is stored ONLY in plant_translations.
-- This table contains ONLY non-translatable base data. No translatable columns exist here
-- except for 'name' which is the canonical English name used for unique constraint.
--
-- NAME HANDLING:
--   plants.name = canonical English name (unique constraint)
--   plant_translations.name = displayed name for each language (including English)
--   When saving in English, BOTH plants.name AND plant_translations.name are updated
--
-- COMPANIONS: The companions array stores plant IDs (not names) for stable references.
--
-- NON-TRANSLATABLE FIELDS (stored in this table):
--   id, name (canonical English), plant_type, utility, comestible_part, fruit_type
--   spiked, scent, multicolor, bicolor
--   temperature_max, temperature_min, temperature_ideal, hygrometry
--   watering_type, division, soil, mulching, nutrition_need, fertilizer
--   sowing_month, flowering_month, fruiting_month
--   height_cm, wingspan_cm, tutoring, sow_type, separation_cm, transplanting
--   infusion, aromatherapy
--   melliferous, polenizer, be_fertilizer, conservation_status
--   companions
--   status, admin_commentary, created_by, created_time, updated_by, updated_time
--
-- TRANSLATABLE FIELDS (stored ONLY in plant_translations):
--   spice_mixes, pests, diseases (also kept in plants table for backward compatibility)
--   name, given_names, scientific_name, family, overview
--   promotion_month, life_cycle, season, foliage_persistance
--   toxicity_human, toxicity_pets, allergens, symbolism
--   living_space, composition, maintenance_level
--   origin, habitat, level_sun
--   advice_soil, advice_mulching, advice_fertilizer
--   advice_tutoring, advice_sowing, cut
--   advice_medicinal, advice_infusion, nutritional_intake, recipes_ideas
--   ground_effect, source_name, source_url, tags

create table if not exists public.plants (
  id text primary key,
  -- Canonical English name (unique constraint). When saving in English, this AND
  -- plant_translations.name (language='en') are both updated.
  name text not null,
  -- Non-translatable classification fields
  plant_type text check (plant_type in ('plant','flower','bamboo','shrub','tree','cactus','succulent')),
  utility text[] not null default '{}'::text[] check (utility <@ array['comestible','ornemental','produce_fruit','aromatic','medicinal','odorous','climbing','cereal','spice']),
  comestible_part text[] not null default '{}'::text[] check (comestible_part <@ array['flower','fruit','seed','leaf','stem','root','bulb','bark','wood']),
  fruit_type text[] not null default '{}'::text[] check (fruit_type <@ array['nut','seed','stone']),
  -- Non-translatable identity fields
  spiked boolean default false,
  scent boolean default false,
  multicolor boolean default false,
  bicolor boolean default false,
  -- Non-translatable plant care fields
  temperature_max integer,
  temperature_min integer,
  temperature_ideal integer,
  hygrometry integer,
  watering_type text[] not null default '{}'::text[] check (watering_type <@ array['surface','buried','hose','drop','drench']),
  division text[] not null default '{}'::text[] check (division <@ array['seed','cutting','division','layering','grafting','tissue separation','bulb separation']),
  soil text[] not null default '{}'::text[] check (soil <@ array['vermiculite','perlite','sphagnum moss','rock wool','sand','gravel','potting soil','peat','clay pebbles','coconut fiber','bark','wood chips']),
  mulching text[] not null default '{}'::text[] check (mulching <@ array['wood chips','bark','green manure','cocoa bean hulls','buckwheat hulls','cereal straw','hemp straw','woven fabric','pozzolana','crushed slate','clay pellets']),
  nutrition_need text[] not null default '{}'::text[] check (nutrition_need <@ array['nitrogen','phosphorus','potassium','calcium','magnesium','sulfur','iron','boron','manganese','molybene','chlorine','copper','zinc','nitrate','phosphate']),
  fertilizer text[] not null default '{}'::text[] check (fertilizer <@ array['granular fertilizer','liquid fertilizer','meat flour','fish flour','crushed bones','crushed horns','slurry','manure','animal excrement','sea fertilizer','yurals','wine','guano','coffee grounds','banana peel','eggshell','vegetable cooking water','urine','grass clippings','vegetable waste','natural mulch']),
  -- Non-translatable growth fields
  sowing_month text[] not null default '{}'::text[] check (sowing_month <@ array['january','february','march','april','may','june','july','august','september','october','november','december']),
  flowering_month text[] not null default '{}'::text[] check (flowering_month <@ array['january','february','march','april','may','june','july','august','september','october','november','december']),
  fruiting_month text[] not null default '{}'::text[] check (fruiting_month <@ array['january','february','march','april','may','june','july','august','september','october','november','december']),
  height_cm integer,
  wingspan_cm integer,
  tutoring boolean default false,
  sow_type text[] not null default '{}'::text[] check (sow_type <@ array['direct','indoor','row','hill','broadcast','seed tray','cell','pot']),
  separation_cm integer,
  transplanting boolean,
  -- Non-translatable usage fields
  infusion boolean default false,
  aromatherapy boolean default false,
  -- DEPRECATED: spice_mixes moved to plant_translations (will be dropped after migration)
  spice_mixes text[] not null default '{}',
  -- Non-translatable ecology fields
  melliferous boolean default false,
  polenizer text[] not null default '{}'::text[] check (polenizer <@ array['bee','wasp','ant','butterfly','bird','mosquito','fly','beetle','ladybug','stagbeetle','cockchafer','dungbeetle','weevil']),
  be_fertilizer boolean default false,
  conservation_status text check (conservation_status in ('safe','at risk','vulnerable','endangered','critically endangered','extinct')),
  -- DEPRECATED: pests and diseases moved to plant_translations (will be dropped after migration)
  pests text[] not null default '{}',
  diseases text[] not null default '{}',
  -- Non-translatable miscellaneous fields
  -- companions stores plant IDs (not names) for stable references
  companions text[] not null default '{}',
  -- Meta (non-translatable)
  status text check (status in ('in progres','rework','review','approved')),
  admin_commentary text,
  created_by text,
  created_time timestamptz not null default now(),
  updated_by text,
  updated_time timestamptz not null default now()
);

-- Unique constraint on name - canonical English name for the plant
create unique index if not exists plants_name_unique on public.plants (lower(name));

-- Drop the scientific_name unique constraint if it exists
-- Multiple plants can have the same scientific name (different cultivars, varieties, etc.)
drop index if exists plants_scientific_name_unique;
alter table if exists public.plants drop constraint if exists plants_scientific_name_unique;

-- Ensure meta columns exist on older deployments (add columns before referencing them)
-- Using DO blocks to avoid PostgreSQL's "1600 columns" parsing bug with many consecutive ALTER TABLE statements
do $add_plants_cols$ 
declare
  col_def record;
  col_defs text[][] := array[
    -- Meta columns
    array['status', 'text check (status in (''in progres'',''rework'',''review'',''approved''))'],
    array['admin_commentary', 'text'],
    array['given_names', 'text[] not null default ''{}'''],
    array['created_by', 'text'],
    array['created_time', 'timestamptz not null default now()'],
    array['updated_by', 'text'],
    array['updated_time', 'timestamptz not null default now()'],
    -- Classification columns
    array['plant_type', 'text check (plant_type in (''plant'',''flower'',''bamboo'',''shrub'',''tree'',''cactus'',''succulent''))'],
    array['utility', 'text[] not null default ''{}''::text[] check (utility <@ array[''comestible'',''ornemental'',''produce_fruit'',''aromatic'',''medicinal'',''odorous'',''climbing'',''cereal'',''spice''])'],
    array['comestible_part', 'text[] not null default ''{}''::text[] check (comestible_part <@ array[''flower'',''fruit'',''seed'',''leaf'',''stem'',''root'',''bulb'',''bark'',''wood''])'],
    array['fruit_type', 'text[] not null default ''{}''::text[] check (fruit_type <@ array[''nut'',''seed'',''stone''])'],
    -- Identity columns
    array['scientific_name', 'text'],
    array['family', 'text'],
    array['overview', 'text'],
    array['promotion_month', 'text check (promotion_month in (''january'',''february'',''march'',''april'',''may'',''june'',''july'',''august'',''september'',''october'',''november'',''december''))'],
    array['life_cycle', 'text check (life_cycle in (''annual'',''biennials'',''perenials'',''ephemerals'',''monocarpic'',''polycarpic''))'],
    array['season', 'text[] not null default ''{}''::text[] check (season <@ array[''spring'',''summer'',''autumn'',''winter''])'],
    array['foliage_persistance', 'text check (foliage_persistance in (''deciduous'',''evergreen'',''semi-evergreen'',''marcescent''))'],
    array['spiked', 'boolean default false'],
    array['toxicity_human', 'text check (toxicity_human in (''non-toxic'',''midly irritating'',''highly toxic'',''lethally toxic''))'],
    array['toxicity_pets', 'text check (toxicity_pets in (''non-toxic'',''midly irritating'',''highly toxic'',''lethally toxic''))'],
    array['allergens', 'text[] not null default ''{}'''],
    array['scent', 'boolean default false'],
    array['symbolism', 'text[] not null default ''{}'''],
    array['living_space', 'text check (living_space in (''indoor'',''outdoor'',''both''))'],
    array['composition', 'text[] not null default ''{}''::text[] check (composition <@ array[''flowerbed'',''path'',''hedge'',''ground cover'',''pot''])'],
    array['maintenance_level', 'text check (maintenance_level in (''none'',''low'',''moderate'',''heavy''))'],
    array['multicolor', 'boolean default false'],
    array['bicolor', 'boolean default false'],
    array['origin', 'text[] not null default ''{}'''],
    array['habitat', 'text[] not null default ''{}''::text[] check (habitat <@ array[''aquatic'',''semi-aquatic'',''wetland'',''tropical'',''temperate'',''arid'',''mediterranean'',''mountain'',''grassland'',''forest'',''coastal'',''urban''])'],
    -- Environment columns
    array['temperature_max', 'integer'],
    array['temperature_min', 'integer'],
    array['temperature_ideal', 'integer'],
    array['level_sun', 'text check (level_sun in (''low light'',''shade'',''partial sun'',''full sun''))'],
    array['hygrometry', 'integer'],
    array['watering_type', 'text[] not null default ''{}''::text[] check (watering_type <@ array[''surface'',''buried'',''hose'',''drop'',''drench''])'],
    array['division', 'text[] not null default ''{}''::text[] check (division <@ array[''seed'',''cutting'',''division'',''layering'',''grafting'',''tissue separation'',''bulb separation''])'],
    array['soil', 'text[] not null default ''{}''::text[] check (soil <@ array[''vermiculite'',''perlite'',''sphagnum moss'',''rock wool'',''sand'',''gravel'',''potting soil'',''peat'',''clay pebbles'',''coconut fiber'',''bark'',''wood chips''])'],
    array['advice_soil', 'text'],
    array['mulching', 'text[] not null default ''{}''::text[] check (mulching <@ array[''wood chips'',''bark'',''green manure'',''cocoa bean hulls'',''buckwheat hulls'',''cereal straw'',''hemp straw'',''woven fabric'',''pozzolana'',''crushed slate'',''clay pellets''])'],
    array['advice_mulching', 'text'],
    array['nutrition_need', 'text[] not null default ''{}''::text[] check (nutrition_need <@ array[''nitrogen'',''phosphorus'',''potassium'',''calcium'',''magnesium'',''sulfur'',''iron'',''boron'',''manganese'',''molybene'',''chlorine'',''copper'',''zinc'',''nitrate'',''phosphate''])'],
    array['fertilizer', 'text[] not null default ''{}''::text[] check (fertilizer <@ array[''granular fertilizer'',''liquid fertilizer'',''meat flour'',''fish flour'',''crushed bones'',''crushed horns'',''slurry'',''manure'',''animal excrement'',''sea fertilizer'',''yurals'',''wine'',''guano'',''coffee grounds'',''banana peel'',''eggshell'',''vegetable cooking water'',''urine'',''grass clippings'',''vegetable waste'',''natural mulch''])'],
    array['advice_fertilizer', 'text'],
    -- Growth columns
    array['sowing_month', 'text[] not null default ''{}''::text[] check (sowing_month <@ array[''january'',''february'',''march'',''april'',''may'',''june'',''july'',''august'',''september'',''october'',''november'',''december''])'],
    array['flowering_month', 'text[] not null default ''{}''::text[] check (flowering_month <@ array[''january'',''february'',''march'',''april'',''may'',''june'',''july'',''august'',''september'',''october'',''november'',''december''])'],
    array['fruiting_month', 'text[] not null default ''{}''::text[] check (fruiting_month <@ array[''january'',''february'',''march'',''april'',''may'',''june'',''july'',''august'',''september'',''october'',''november'',''december''])'],
    array['height_cm', 'integer'],
    array['wingspan_cm', 'integer'],
    array['tutoring', 'boolean default false'],
    array['advice_tutoring', 'text'],
    array['sow_type', 'text[] not null default ''{}''::text[] check (sow_type <@ array[''direct'',''indoor'',''row'',''hill'',''broadcast'',''seed tray'',''cell'',''pot''])'],
    array['separation_cm', 'integer'],
    array['transplanting', 'boolean'],
    array['advice_sowing', 'text'],
    array['cut', 'text'],
    array['advice_medicinal', 'text'],
    array['nutritional_intake', 'text[] not null default ''{}'''],
    array['infusion', 'boolean default false'],
    array['advice_infusion', 'text'],
    array['recipes_ideas', 'text[] not null default ''{}'''],
    array['aromatherapy', 'boolean default false'],
    array['spice_mixes', 'text[] not null default ''{}'''],
    -- Ecology columns
    array['melliferous', 'boolean default false'],
    array['polenizer', 'text[] not null default ''{}''::text[] check (polenizer <@ array[''bee'',''wasp'',''ant'',''butterfly'',''bird'',''mosquito'',''fly'',''beetle'',''ladybug'',''stagbeetle'',''cockchafer'',''dungbeetle'',''weevil''])'],
    array['be_fertilizer', 'boolean default false'],
    array['ground_effect', 'text'],
    array['conservation_status', 'text check (conservation_status in (''safe'',''at risk'',''vulnerable'',''endangered'',''critically endangered'',''extinct''))'],
    array['pests', 'text[] not null default ''{}'''],
    array['diseases', 'text[] not null default ''{}'''],
    array['companions', 'text[] not null default ''{}'''],
    array['tags', 'text[] not null default ''{}'''],
    array['source_name', 'text'],
    array['source_url', 'text']
  ];
begin
  -- Only proceed if the plants table exists
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'plants') then
    return;
  end if;
  
  -- Add each column individually using dynamic SQL to avoid "1600 columns" parsing bug
  for i in 1..array_length(col_defs, 1) loop
    begin
      -- Check if column exists before trying to add
      if not exists (
        select 1 from information_schema.columns 
        where table_schema = 'public' 
        and table_name = 'plants' 
        and column_name = col_defs[i][1]
      ) then
        execute format('alter table public.plants add column %I %s', col_defs[i][1], col_defs[i][2]);
      end if;
    exception when others then
      -- Column may already exist with different constraints, skip silently
      null;
    end;
  end loop;
end $add_plants_cols$;

-- Set status default and backfill null values
alter table if exists public.plants alter column status set default 'in progres';
update public.plants set status = 'in progres' where status is null;
-- Drop obsolete JSON columns from earlier iterations
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

-- Update plant_type check constraint to include all valid types (including 'succulent')
-- This fixes databases where the column was created with an older constraint
do $$ begin
  -- Drop the old constraint if it exists (constraint name may vary)
  if exists (
    select 1 from pg_constraint c
    join pg_namespace n on n.oid = c.connamespace
    where c.conrelid = 'public.plants'::regclass
    and c.contype = 'c'
    and c.conname like '%plant_type%'
  ) then
    execute (
      select 'alter table public.plants drop constraint ' || quote_ident(c.conname)
      from pg_constraint c
      join pg_namespace n on n.oid = c.connamespace
      where c.conrelid = 'public.plants'::regclass
      and c.contype = 'c'
      and c.conname like '%plant_type%'
      limit 1
    );
  end if;
  -- Add the updated constraint with all valid plant types
  alter table public.plants add constraint plants_plant_type_check 
    check (plant_type is null or plant_type in ('plant','flower','bamboo','shrub','tree','cactus','succulent'));
exception when duplicate_object then
  -- Constraint already exists with correct definition
  null;
end $$;

-- Strict column whitelist for plants (drops anything not declared above)
do $$ declare
  allowed_columns constant text[] := array[
    'id',
    'name',
    'plant_type',
    'utility',
    'comestible_part',
    'fruit_type',
    'given_names',
    'scientific_name',
    'family',
    'overview',
    'promotion_month',
    'life_cycle',
    'season',
    'foliage_persistance',
    'spiked',
    'toxicity_human',
    'toxicity_pets',
    'allergens',
    'scent',
    'symbolism',
    'living_space',
    'composition',
    'maintenance_level',
    'multicolor',
    'bicolor',
    'origin',
    'habitat',
    'temperature_max',
    'temperature_min',
    'temperature_ideal',
    'level_sun',
    'hygrometry',
    'watering_type',
    'division',
    'soil',
    'advice_soil',
    'mulching',
    'advice_mulching',
    'nutrition_need',
    'fertilizer',
    'advice_fertilizer',
    'sowing_month',
    'flowering_month',
    'fruiting_month',
    'height_cm',
    'wingspan_cm',
    'tutoring',
    'advice_tutoring',
    'sow_type',
    'separation_cm',
    'transplanting',
    'advice_sowing',
    'cut',
    'advice_medicinal',
    'nutritional_intake',
    'infusion',
    'advice_infusion',
    'recipes_ideas',
    'aromatherapy',
    'spice_mixes',
    'melliferous',
    'polenizer',
    'be_fertilizer',
    'ground_effect',
    'conservation_status',
    'pests',
    'diseases',
    'companions',
    'tags',
    'source_name',
    'source_url',
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
  -- Allow anyone (including anon) to read plants
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
  season text check (season is null or season in ('spring','summer','autumn','winter')),
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
  alter table public.plant_watering_schedules add constraint plant_watering_schedules_season_check check (season is null or season in ('spring','summer','autumn','winter'));
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
  create policy plant_contributors_all on public.plant_contributors for all to authenticated using (true) with check (true);
end $$;

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

-- Add translation columns if they don't exist (for existing databases)
-- This ensures the columns are added without losing existing data
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

-- Add constraint for translations column if it doesn't exist
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

-- Create indexes
create index if not exists plant_pro_advices_plant_created_idx on public.plant_pro_advices (plant_id, created_at desc);
create index if not exists plant_pro_advices_original_language_idx on public.plant_pro_advices (original_language);

-- Add column comments
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
  -- Allow same image URL to be used by different plants (composite unique)
  unique (plant_id, link)
);
-- Drop the old global link uniqueness constraint if it exists (migration)
alter table if exists public.plant_images drop constraint if exists plant_images_link_key;
-- Ensure composite uniqueness on (plant_id, link)
create unique index if not exists plant_images_plant_link_unique on public.plant_images (plant_id, link);
-- Drop old use uniqueness constraint that may have been created without the WHERE clause
-- This is needed because CREATE INDEX IF NOT EXISTS won't update an existing index
drop index if exists public.plant_images_use_unique;
-- Keep uniqueness on (plant_id, use) ONLY for primary/discovery images
-- This allows unlimited 'other' images per plant, but only 1 primary and 1 discovery
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

-- Add new columns if they don't exist (for existing databases)
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
  -- Make hex_code nullable (it was previously not null unique, but we want to allow colors without hex)
  alter table public.colors alter column hex_code drop not null;
exception when others then null;
end $$;

-- Drop the unique constraint on hex_code if it exists (allow multiple colors with same hex or null hex)
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
  -- Color translations policies
  if exists (select 1 from pg_policies where schemaname='public' and tablename='color_translations' and policyname='color_translations_read_all') then
    drop policy color_translations_read_all on public.color_translations;
  end if;
  create policy color_translations_read_all on public.color_translations for select to authenticated, anon using (true);
  if exists (select 1 from pg_policies where schemaname='public' and tablename='color_translations' and policyname='color_translations_modify') then
    drop policy color_translations_modify on public.color_translations;
  end if;
  create policy color_translations_modify on public.color_translations for all to authenticated using (true) with check (true);
end $$;

-- Create index for faster parent lookups
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

