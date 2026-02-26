-- ============================================================================
-- Add watering_mode column to plants and expand season values in
-- plant_watering_schedules to support 'hot' and 'cold' environment-based
-- watering schedules.
-- ============================================================================
-- Safe to run multiple times (fully idempotent).
-- ============================================================================

-- 1. Add watering_mode column to plants table
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'plants'
      and column_name = 'watering_mode'
  ) then
    alter table public.plants add column watering_mode text default 'always';
    raise notice 'Added column: watering_mode';
  end if;
end $$;

-- 2. Update season CHECK constraint on plant_watering_schedules to also allow 'hot' and 'cold'
do $$
begin
  -- Drop old constraint if it exists
  if exists (
    select 1 from information_schema.constraint_column_usage
    where table_name = 'plant_watering_schedules'
      and constraint_name = 'plant_watering_schedules_season_check'
  ) then
    alter table public.plant_watering_schedules
      drop constraint plant_watering_schedules_season_check;
  end if;

  -- Create new constraint that allows hot/cold in addition to old season values
  alter table public.plant_watering_schedules
    add constraint plant_watering_schedules_season_check
    check (season is null or season in ('spring','summer','autumn','winter','hot','cold'));

  raise notice 'Updated season constraint to include hot/cold';
end $$;

-- 3. Migrate existing data: plants that have wateringFrequencyWarm/Cold but no schedules
-- get their watering_mode set to 'seasonal', others default to 'always'.
do $$
declare
  migrated_count integer;
begin
  -- Set watering_mode = 'seasonal' for plants that have different warm/cold frequencies
  update public.plants
  set watering_mode = 'seasonal'
  where watering_mode is null or watering_mode = 'always'
    and watering_frequency_warm is not null
    and watering_frequency_cold is not null
    and watering_frequency_warm <> watering_frequency_cold;

  get diagnostics migrated_count = row_count;
  raise notice 'Set watering_mode=seasonal for % plants with differing warm/cold frequencies', migrated_count;

  -- For plants that already have entries in plant_watering_schedules with spring/summer/autumn/winter,
  -- migrate them to hot/cold model:
  -- spring + summer → hot, autumn + winter → cold
  -- Only migrate if plant doesn't already have hot/cold entries
  update public.plant_watering_schedules
  set season = 'hot'
  where season in ('spring', 'summer')
    and plant_id not in (
      select plant_id from public.plant_watering_schedules where season = 'hot'
    );
  get diagnostics migrated_count = row_count;
  raise notice 'Migrated % spring/summer schedule rows to hot', migrated_count;

  update public.plant_watering_schedules
  set season = 'cold'
  where season in ('autumn', 'winter')
    and plant_id not in (
      select plant_id from public.plant_watering_schedules where season = 'cold'
    );
  get diagnostics migrated_count = row_count;
  raise notice 'Migrated % autumn/winter schedule rows to cold', migrated_count;

  -- Set watering_mode = 'seasonal' for plants that now have hot/cold schedule entries
  update public.plants
  set watering_mode = 'seasonal'
  where id in (
    select distinct plant_id from public.plant_watering_schedules
    where season in ('hot', 'cold')
  )
  and (watering_mode is null or watering_mode = 'always');
  get diagnostics migrated_count = row_count;
  raise notice 'Set watering_mode=seasonal for % plants with hot/cold schedules', migrated_count;
end $$;
