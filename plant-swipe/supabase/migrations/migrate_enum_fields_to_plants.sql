-- Migration: Copy non-translatable enum fields from plant_translations to plants table
-- Run this ONCE to migrate data, then the columns will be dropped from plant_translations

-- First, ensure columns exist in plants table
alter table if exists public.plants add column if not exists scientific_name text;
alter table if exists public.plants add column if not exists family text;
alter table if exists public.plants add column if not exists promotion_month text check (promotion_month in ('january','february','march','april','may','june','july','august','september','october','november','december'));
alter table if exists public.plants add column if not exists life_cycle text check (life_cycle in ('annual','biennials','perenials','ephemerals','monocarpic','polycarpic'));
alter table if exists public.plants add column if not exists season text[] not null default '{}'::text[] check (season <@ array['spring','summer','autumn','winter']);
alter table if exists public.plants add column if not exists foliage_persistance text check (foliage_persistance in ('deciduous','evergreen','semi-evergreen','marcescent'));
alter table if exists public.plants add column if not exists toxicity_human text check (toxicity_human in ('non-toxic','midly irritating','highly toxic','lethally toxic'));
alter table if exists public.plants add column if not exists toxicity_pets text check (toxicity_pets in ('non-toxic','midly irritating','highly toxic','lethally toxic'));
alter table if exists public.plants add column if not exists living_space text check (living_space in ('indoor','outdoor','both'));
alter table if exists public.plants add column if not exists composition text[] not null default '{}'::text[] check (composition <@ array['flowerbed','path','hedge','ground cover','pot']);
alter table if exists public.plants add column if not exists maintenance_level text check (maintenance_level in ('none','low','moderate','heavy'));
alter table if exists public.plants add column if not exists level_sun text check (level_sun in ('low light','shade','partial sun','full sun'));
alter table if exists public.plants add column if not exists habitat text[] not null default '{}'::text[] check (habitat <@ array['aquatic','semi-aquatic','wetland','tropical','temperate','arid','mediterranean','mountain','grassland','forest','coastal','urban']);

-- Now migrate data from plant_translations to plants
do $$
begin
  -- Migrate scientific_name
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'plant_translations' and column_name = 'scientific_name') then
    raise notice 'Migrating scientific_name...';
    update public.plants p set scientific_name = pt.scientific_name
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.language = 'en' and pt.scientific_name is not null and pt.scientific_name != '' and (p.scientific_name is null or trim(p.scientific_name) = '');
    
    update public.plants p set scientific_name = pt.scientific_name
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.scientific_name is not null and pt.scientific_name != '' and (p.scientific_name is null or trim(p.scientific_name) = '');
  end if;
  
  -- Migrate promotion_month
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'plant_translations' and column_name = 'promotion_month') then
    raise notice 'Migrating promotion_month...';
    update public.plants p set promotion_month = pt.promotion_month
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.language = 'en' and pt.promotion_month is not null and p.promotion_month is null;
    
    update public.plants p set promotion_month = pt.promotion_month
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.promotion_month is not null and p.promotion_month is null;
  end if;
  
  -- Migrate level_sun
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'plant_translations' and column_name = 'level_sun') then
    raise notice 'Migrating level_sun...';
    update public.plants p set level_sun = pt.level_sun
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.language = 'en' and pt.level_sun is not null and p.level_sun is null;
    
    update public.plants p set level_sun = pt.level_sun
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.level_sun is not null and p.level_sun is null;
  end if;
  
  -- Migrate habitat
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'plant_translations' and column_name = 'habitat') then
    raise notice 'Migrating habitat...';
    update public.plants p set habitat = pt.habitat
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.language = 'en' and pt.habitat is not null and array_length(pt.habitat, 1) > 0 and (p.habitat is null or array_length(p.habitat, 1) = 0);
    
    update public.plants p set habitat = pt.habitat
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.habitat is not null and array_length(pt.habitat, 1) > 0 and (p.habitat is null or array_length(p.habitat, 1) = 0);
  end if;
  
  -- Migrate family
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'plant_translations' and column_name = 'family') then
    raise notice 'Migrating family...';
    update public.plants p set family = pt.family
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.language = 'en' and pt.family is not null and pt.family != '' and (p.family is null or trim(p.family) = '');
    
    update public.plants p set family = pt.family
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.family is not null and pt.family != '' and (p.family is null or trim(p.family) = '');
  end if;
  
  -- Migrate life_cycle
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'plant_translations' and column_name = 'life_cycle') then
    raise notice 'Migrating life_cycle...';
    update public.plants p set life_cycle = pt.life_cycle
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.language = 'en' and pt.life_cycle is not null and p.life_cycle is null;
    
    update public.plants p set life_cycle = pt.life_cycle
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.life_cycle is not null and p.life_cycle is null;
  end if;
  
  -- Migrate season
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'plant_translations' and column_name = 'season') then
    raise notice 'Migrating season...';
    update public.plants p set season = pt.season
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.language = 'en' and pt.season is not null and array_length(pt.season, 1) > 0 and (p.season is null or array_length(p.season, 1) = 0);
    
    update public.plants p set season = pt.season
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.season is not null and array_length(pt.season, 1) > 0 and (p.season is null or array_length(p.season, 1) = 0);
  end if;
  
  -- Migrate foliage_persistance
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'plant_translations' and column_name = 'foliage_persistance') then
    raise notice 'Migrating foliage_persistance...';
    update public.plants p set foliage_persistance = pt.foliage_persistance
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.language = 'en' and pt.foliage_persistance is not null and p.foliage_persistance is null;
    
    update public.plants p set foliage_persistance = pt.foliage_persistance
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.foliage_persistance is not null and p.foliage_persistance is null;
  end if;
  
  -- Migrate toxicity_human
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'plant_translations' and column_name = 'toxicity_human') then
    raise notice 'Migrating toxicity_human...';
    update public.plants p set toxicity_human = pt.toxicity_human
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.language = 'en' and pt.toxicity_human is not null and p.toxicity_human is null;
    
    update public.plants p set toxicity_human = pt.toxicity_human
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.toxicity_human is not null and p.toxicity_human is null;
  end if;
  
  -- Migrate toxicity_pets
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'plant_translations' and column_name = 'toxicity_pets') then
    raise notice 'Migrating toxicity_pets...';
    update public.plants p set toxicity_pets = pt.toxicity_pets
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.language = 'en' and pt.toxicity_pets is not null and p.toxicity_pets is null;
    
    update public.plants p set toxicity_pets = pt.toxicity_pets
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.toxicity_pets is not null and p.toxicity_pets is null;
  end if;
  
  -- Migrate living_space
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'plant_translations' and column_name = 'living_space') then
    raise notice 'Migrating living_space...';
    update public.plants p set living_space = pt.living_space
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.language = 'en' and pt.living_space is not null and p.living_space is null;
    
    update public.plants p set living_space = pt.living_space
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.living_space is not null and p.living_space is null;
  end if;
  
  -- Migrate composition
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'plant_translations' and column_name = 'composition') then
    raise notice 'Migrating composition...';
    update public.plants p set composition = pt.composition
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.language = 'en' and pt.composition is not null and array_length(pt.composition, 1) > 0 and (p.composition is null or array_length(p.composition, 1) = 0);
    
    update public.plants p set composition = pt.composition
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.composition is not null and array_length(pt.composition, 1) > 0 and (p.composition is null or array_length(p.composition, 1) = 0);
  end if;
  
  -- Migrate maintenance_level
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'plant_translations' and column_name = 'maintenance_level') then
    raise notice 'Migrating maintenance_level...';
    update public.plants p set maintenance_level = pt.maintenance_level
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.language = 'en' and pt.maintenance_level is not null and p.maintenance_level is null;
    
    update public.plants p set maintenance_level = pt.maintenance_level
    from public.plant_translations pt
    where p.id = pt.plant_id and pt.maintenance_level is not null and p.maintenance_level is null;
  end if;
  
  raise notice 'Migration complete!';
end $$;

-- Verify migration results
select 
  'plants with level_sun' as field,
  count(*) filter (where level_sun is not null) as populated,
  count(*) as total
from public.plants
union all
select 
  'plants with toxicity_human',
  count(*) filter (where toxicity_human is not null),
  count(*)
from public.plants
union all
select 
  'plants with family',
  count(*) filter (where family is not null and family != ''),
  count(*)
from public.plants
union all
select 
  'plants with habitat',
  count(*) filter (where habitat is not null and array_length(habitat, 1) > 0),
  count(*)
from public.plants
union all
select 
  'plants with scientific_name',
  count(*) filter (where scientific_name is not null and scientific_name != ''),
  count(*)
from public.plants
union all
select 
  'plants with promotion_month',
  count(*) filter (where promotion_month is not null),
  count(*)
from public.plants;
