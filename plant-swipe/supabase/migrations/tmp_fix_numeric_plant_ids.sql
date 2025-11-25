-- ============================================================================
-- Migration: Fix plants with numeric IDs (0, 1, 2)
-- ============================================================================
-- This script will:
-- 1. Create duplicate plants with proper UUIDs for all plants with ID '0', '1', or '2'
-- 2. Update all related tables to use the new UUIDs
-- 3. Delete the original plants with numeric IDs
-- ============================================================================

-- Run in a transaction for safety
BEGIN;

-- ============================================================================
-- Step 1: Create a temporary mapping table to track old -> new IDs
-- ============================================================================
CREATE TEMP TABLE plant_id_migration (
    old_id text PRIMARY KEY,
    new_id text NOT NULL
);

-- Insert mappings for numeric IDs (0, 1, 2)
INSERT INTO plant_id_migration (old_id, new_id)
SELECT id, gen_random_uuid()::text
FROM public.plants
WHERE id IN ('0', '1', '2');

-- Log the mappings
DO $$
DECLARE
    rec RECORD;
BEGIN
    RAISE NOTICE '=== Plant ID Migration Mappings ===';
    FOR rec IN SELECT * FROM plant_id_migration LOOP
        RAISE NOTICE 'Old ID: % -> New ID: %', rec.old_id, rec.new_id;
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Create duplicate plants with new UUIDs
-- ============================================================================
INSERT INTO public.plants (
    id,
    name,
    plant_type,
    utility,
    comestible_part,
    fruit_type,
    given_names,
    scientific_name,
    family,
    overview,
    promotion_month,
    life_cycle,
    season,
    foliage_persistance,
    spiked,
    toxicity_human,
    toxicity_pets,
    allergens,
    scent,
    symbolism,
    living_space,
    composition,
    maintenance_level,
    multicolor,
    bicolor,
    origin,
    habitat,
    temperature_max,
    temperature_min,
    temperature_ideal,
    level_sun,
    hygrometry,
    watering_type,
    division,
    soil,
    advice_soil,
    mulching,
    advice_mulching,
    nutrition_need,
    fertilizer,
    advice_fertilizer,
    sowing_month,
    flowering_month,
    fruiting_month,
    height_cm,
    wingspan_cm
)
SELECT
    m.new_id,
    p.name,
    p.plant_type,
    p.utility,
    p.comestible_part,
    p.fruit_type,
    p.given_names,
    p.scientific_name,
    p.family,
    p.overview,
    p.promotion_month,
    p.life_cycle,
    p.season,
    p.foliage_persistance,
    p.spiked,
    p.toxicity_human,
    p.toxicity_pets,
    p.allergens,
    p.scent,
    p.symbolism,
    p.living_space,
    p.composition,
    p.maintenance_level,
    p.multicolor,
    p.bicolor,
    p.origin,
    p.habitat,
    p.temperature_max,
    p.temperature_min,
    p.temperature_ideal,
    p.level_sun,
    p.hygrometry,
    p.watering_type,
    p.division,
    p.soil,
    p.advice_soil,
    p.mulching,
    p.advice_mulching,
    p.nutrition_need,
    p.fertilizer,
    p.advice_fertilizer,
    p.sowing_month,
    p.flowering_month,
    p.fruiting_month,
    p.height_cm,
    p.wingspan_cm
FROM public.plants p
JOIN plant_id_migration m ON p.id = m.old_id;

RAISE NOTICE 'Created % new plant records with UUIDs', (SELECT count(*) FROM plant_id_migration);

-- ============================================================================
-- Step 3: Update all related tables to use new UUIDs
-- ============================================================================

-- 3.1: plant_watering_schedules
UPDATE public.plant_watering_schedules pws
SET plant_id = m.new_id
FROM plant_id_migration m
WHERE pws.plant_id = m.old_id;

DO $$ BEGIN RAISE NOTICE 'Updated plant_watering_schedules: % rows', (SELECT count(*) FROM public.plant_watering_schedules WHERE plant_id IN (SELECT new_id FROM plant_id_migration)); END $$;

-- 3.2: plant_sources
UPDATE public.plant_sources ps
SET plant_id = m.new_id
FROM plant_id_migration m
WHERE ps.plant_id = m.old_id;

DO $$ BEGIN RAISE NOTICE 'Updated plant_sources: % rows', (SELECT count(*) FROM public.plant_sources WHERE plant_id IN (SELECT new_id FROM plant_id_migration)); END $$;

-- 3.3: plant_infusion_mixes
UPDATE public.plant_infusion_mixes pim
SET plant_id = m.new_id
FROM plant_id_migration m
WHERE pim.plant_id = m.old_id;

DO $$ BEGIN RAISE NOTICE 'Updated plant_infusion_mixes: % rows', (SELECT count(*) FROM public.plant_infusion_mixes WHERE plant_id IN (SELECT new_id FROM plant_id_migration)); END $$;

-- 3.4: plant_images
UPDATE public.plant_images pi
SET plant_id = m.new_id
FROM plant_id_migration m
WHERE pi.plant_id = m.old_id;

DO $$ BEGIN RAISE NOTICE 'Updated plant_images: % rows', (SELECT count(*) FROM public.plant_images WHERE plant_id IN (SELECT new_id FROM plant_id_migration)); END $$;

-- 3.5: plant_colors (has composite PK, need special handling)
-- First insert new rows with new plant_id, then delete old ones
INSERT INTO public.plant_colors (plant_id, color_id, added_at)
SELECT m.new_id, pc.color_id, pc.added_at
FROM public.plant_colors pc
JOIN plant_id_migration m ON pc.plant_id = m.old_id
ON CONFLICT (plant_id, color_id) DO NOTHING;

DELETE FROM public.plant_colors
WHERE plant_id IN (SELECT old_id FROM plant_id_migration);

DO $$ BEGIN RAISE NOTICE 'Updated plant_colors: migrated to new IDs'; END $$;

-- 3.6: plant_translations
UPDATE public.plant_translations pt
SET plant_id = m.new_id
FROM plant_id_migration m
WHERE pt.plant_id = m.old_id;

DO $$ BEGIN RAISE NOTICE 'Updated plant_translations: % rows', (SELECT count(*) FROM public.plant_translations WHERE plant_id IN (SELECT new_id FROM plant_id_migration)); END $$;

-- 3.7: garden_plants
UPDATE public.garden_plants gp
SET plant_id = m.new_id
FROM plant_id_migration m
WHERE gp.plant_id = m.old_id;

DO $$ BEGIN RAISE NOTICE 'Updated garden_plants: % rows', (SELECT count(*) FROM public.garden_plants WHERE plant_id IN (SELECT new_id FROM plant_id_migration)); END $$;

-- 3.8: garden_inventory
UPDATE public.garden_inventory gi
SET plant_id = m.new_id
FROM plant_id_migration m
WHERE gi.plant_id = m.old_id;

DO $$ BEGIN RAISE NOTICE 'Updated garden_inventory: % rows', (SELECT count(*) FROM public.garden_inventory WHERE plant_id IN (SELECT new_id FROM plant_id_migration)); END $$;

-- 3.9: garden_transactions
UPDATE public.garden_transactions gt
SET plant_id = m.new_id
FROM plant_id_migration m
WHERE gt.plant_id = m.old_id;

DO $$ BEGIN RAISE NOTICE 'Updated garden_transactions: % rows', (SELECT count(*) FROM public.garden_transactions WHERE plant_id IN (SELECT new_id FROM plant_id_migration)); END $$;

-- 3.10: bookmark_items (no FK, but stores plant_id)
UPDATE public.bookmark_items bi
SET plant_id = m.new_id
FROM plant_id_migration m
WHERE bi.plant_id = m.old_id;

DO $$ BEGIN RAISE NOTICE 'Updated bookmark_items: % rows', (SELECT count(*) FROM public.bookmark_items WHERE plant_id IN (SELECT new_id FROM plant_id_migration)); END $$;

-- 3.11: profiles.liked_plant_ids (array column - needs special handling)
-- Replace old IDs with new IDs in the liked_plant_ids array
UPDATE public.profiles p
SET liked_plant_ids = (
    SELECT array_agg(
        COALESCE(m.new_id, elem)
    )
    FROM unnest(p.liked_plant_ids) AS elem
    LEFT JOIN plant_id_migration m ON elem = m.old_id
)
WHERE p.liked_plant_ids && (SELECT array_agg(old_id) FROM plant_id_migration);

DO $$ BEGIN RAISE NOTICE 'Updated profiles.liked_plant_ids arrays'; END $$;

-- ============================================================================
-- Step 4: Delete the original plants with numeric IDs
-- ============================================================================
-- Note: Due to ON DELETE CASCADE on FK constraints, this would cascade delete
-- related records if we hadn't already updated them. Since we updated them first,
-- this should only delete the plant records themselves.

DELETE FROM public.plants
WHERE id IN (SELECT old_id FROM plant_id_migration);

DO $$ BEGIN RAISE NOTICE 'Deleted % plants with numeric IDs', (SELECT count(*) FROM plant_id_migration); END $$;

-- ============================================================================
-- Step 5: Verification queries (optional - can be commented out)
-- ============================================================================

-- Verify no numeric IDs remain
DO $$
DECLARE
    remaining_count integer;
BEGIN
    SELECT count(*) INTO remaining_count
    FROM public.plants
    WHERE id IN ('0', '1', '2');
    
    IF remaining_count > 0 THEN
        RAISE EXCEPTION 'Migration failed: % plants still have numeric IDs', remaining_count;
    ELSE
        RAISE NOTICE 'SUCCESS: No plants with numeric IDs (0, 1, 2) remain';
    END IF;
END $$;

-- Verify new plants exist
DO $$
DECLARE
    new_count integer;
    expected_count integer;
BEGIN
    SELECT count(*) INTO expected_count FROM plant_id_migration;
    SELECT count(*) INTO new_count 
    FROM public.plants 
    WHERE id IN (SELECT new_id FROM plant_id_migration);
    
    IF new_count = expected_count THEN
        RAISE NOTICE 'SUCCESS: All % new plants created successfully', new_count;
    ELSE
        RAISE EXCEPTION 'Migration failed: Expected % new plants, found %', expected_count, new_count;
    END IF;
END $$;

-- Output final mapping for reference
DO $$
DECLARE
    rec RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== Final Migration Summary ===';
    FOR rec IN 
        SELECT m.old_id, m.new_id, p.name 
        FROM plant_id_migration m 
        JOIN public.plants p ON p.id = m.new_id 
    LOOP
        RAISE NOTICE 'Plant "%" migrated: % -> %', rec.name, rec.old_id, rec.new_id;
    END LOOP;
    RAISE NOTICE '=== Migration Complete ===';
END $$;

COMMIT;
