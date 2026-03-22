-- Add climate column to gardens table
-- Uses the same climate values as the plants.climate column for filtering recommendations
alter table if exists public.gardens
  add column if not exists climate text[] not null default '{}'::text[];

-- Constraint: values must match plant climate enum
do $$
begin
  if not exists (
    select 1 from information_schema.check_constraints
    where constraint_name = 'gardens_climate_values'
  ) then
    alter table public.gardens
      add constraint gardens_climate_values
      check (climate <@ array[
        'polar','montane','oceanic','degraded_oceanic',
        'temperate_continental','mediterranean','tropical_dry',
        'tropical_humid','tropical_volcanic','tropical_cyclonic',
        'humid_insular','subtropical_humid','equatorial',
        'windswept_coastal'
      ]::text[]);
  end if;
end $$;

-- Add usage column to gardens table
-- Describes the purpose/usage of the garden for better plant recommendations
alter table if exists public.gardens
  add column if not exists usage text[] not null default '{}'::text[];

-- Constraint: values must be one of the known usage types
do $$
begin
  if not exists (
    select 1 from information_schema.check_constraints
    where constraint_name = 'gardens_usage_values'
  ) then
    alter table public.gardens
      add constraint gardens_usage_values
      check (usage <@ array[
        'decorative','edible','medicinal','aromatic',
        'pollinator_friendly','air_purifying'
      ]::text[]);
  end if;
end $$;
