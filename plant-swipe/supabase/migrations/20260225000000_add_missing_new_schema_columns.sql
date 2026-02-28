-- ============================================================================
-- Add missing new-schema columns to plants table
-- ============================================================================
-- This migration ensures all columns required by the new flat schema exist.
-- Safe to run multiple times (uses ADD COLUMN IF NOT EXISTS pattern).
-- Run this if you see errors like:
--   "Could not find the 'average_lifespan' column of 'plants' in the schema cache"
-- ============================================================================

do $add_missing_cols$
declare
  col_defs text[][] := array[
    -- Section 1: Base
    array['plant_type', 'text'],
    array['scientific_name_species', 'text'],
    array['variety', 'text'],
    array['family', 'text'],
    array['encyclopedia_category', 'text[] not null default ''{}''::text[]'],
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
    array['infusion', 'boolean default false'],
    array['infusion_parts', 'text[] not null default ''{}''::text[]'],
    array['medicinal', 'boolean default false'],
    array['aromatherapy', 'boolean default false'],
    array['fragrance', 'boolean default false'],
    array['edible_oil', 'text'],
    -- Section 8: Misc
    array['companion_plants', 'text[] not null default ''{}''::text[]'],
    array['biotope_plants', 'text[] not null default ''{}''::text[]'],
    array['beneficial_plants', 'text[] not null default ''{}''::text[]'],
    array['harmful_plants', 'text[] not null default ''{}''::text[]'],
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
    raise notice 'plants table not found — skipping';
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
        raise notice 'Added column: %', col_defs[i][1];
      end if;
    exception when others then
      raise notice 'Could not add column %: %', col_defs[i][1], sqlerrm;
    end;
  end loop;

  raise notice 'Done — all new-schema columns verified.';
end $add_missing_cols$;

-- Add CHECK constraints for enum columns (safe to re-run)
do $add_checks$
begin
  -- average_lifespan
  begin
    alter table public.plants add constraint plants_average_lifespan_check
      check (average_lifespan <@ array['less_than_1_year','2_years','3_to_10_years','10_to_50_years','over_50_years']);
  exception when duplicate_object then null;
  end;

  -- poisoning_method
  begin
    alter table public.plants add constraint plants_poisoning_method_check
      check (poisoning_method <@ array['touch','ingestion','eye_contact','inhalation','sap_contact']);
  exception when duplicate_object then null;
  end;
end $add_checks$;
