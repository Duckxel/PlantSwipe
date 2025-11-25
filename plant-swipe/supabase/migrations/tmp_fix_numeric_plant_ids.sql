-- ============================================================================
-- Migration: Fix plants with numeric IDs (0, 1, 2)
-- ============================================================================
-- IMPORTANT: This script MUST be run with service_role or as superuser to bypass RLS
-- 
-- This script will:
-- 1. Create duplicate plants with proper UUIDs for all plants with ID '0', '1', or '2'
-- 2. Update all related tables to use the new UUIDs
-- 3. Delete the original plants with numeric IDs
--
-- All operations are wrapped in a transaction for safety - if anything fails,
-- everything rolls back and no data is lost.
-- ============================================================================

BEGIN;

-- ============================================================================
-- Step 0: Pre-flight checks
-- ============================================================================

-- Check if any plants with numeric IDs exist
DO $$
DECLARE
    plant_count integer;
BEGIN
    SELECT count(*) INTO plant_count
    FROM public.plants
    WHERE id IN ('0', '1', '2');
    
    IF plant_count = 0 THEN
        RAISE NOTICE 'No plants with numeric IDs (0, 1, 2) found. Nothing to migrate.';
    ELSE
        RAISE NOTICE 'Found % plant(s) with numeric IDs to migrate', plant_count;
    END IF;
END $$;

-- ============================================================================
-- Step 1: Create a temporary mapping table to track old -> new IDs
-- ============================================================================
DROP TABLE IF EXISTS plant_id_migration;
CREATE TEMP TABLE plant_id_migration (
    old_id text PRIMARY KEY,
    new_id text NOT NULL,
    -- Store ALL potentially unique fields before renaming
    plant_name text,
    scientific_name text
);

-- Insert mappings for numeric IDs (0, 1, 2) that exist
-- Store original values for all potentially unique fields
INSERT INTO plant_id_migration (old_id, new_id, plant_name, scientific_name)
SELECT id, gen_random_uuid()::text, name, scientific_name
FROM public.plants
WHERE id IN ('0', '1', '2');

-- Log the mappings
DO $$
DECLARE
    rec RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== Plant ID Migration Mappings ===';
    FOR rec IN SELECT * FROM plant_id_migration ORDER BY old_id LOOP
        RAISE NOTICE 'Plant "%": % -> %', rec.plant_name, rec.old_id, rec.new_id;
    END LOOP;
    RAISE NOTICE '';
END $$;

-- Exit early if nothing to migrate
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM plant_id_migration) THEN
        RAISE NOTICE 'No plants to migrate. Committing empty transaction.';
    END IF;
END $$;

-- ============================================================================
-- Step 1.5: Handle unique constraint conflicts
-- ============================================================================
-- The plants table has unique indexes on:
--   - lower(name)
--   - lower(scientific_name)  [may exist in DB]
-- 
-- IMPORTANT ORDER OF OPERATIONS:
-- 1. FIRST rename old plants to free up the unique values
-- 2. THEN check if another plant still uses the same values
-- 3. If conflict exists, modify migration table values

-- Step 1.5a: FIRST - Rename the original plants to free up unique values
DO $$
DECLARE
    affected integer;
BEGIN
    RAISE NOTICE 'Step 1.5a: Renaming original plants to free up unique values...';
    
    UPDATE public.plants p
    SET 
        name = p.name || ' [TO-DELETE-' || p.id || ']',
        scientific_name = CASE 
            WHEN p.scientific_name IS NOT NULL 
            THEN p.scientific_name || ' [TO-DELETE-' || p.id || ']'
            ELSE NULL 
        END
    FROM plant_id_migration m
    WHERE p.id = m.old_id;
    
    GET DIAGNOSTICS affected = ROW_COUNT;
    RAISE NOTICE 'Step 1.5a: Renamed % original plant(s)', affected;
END $$;

-- Step 1.5b: THEN - Check for conflicts with OTHER plants (after old ones are renamed)
DO $$
DECLARE
    rec RECORD;
BEGIN
    RAISE NOTICE 'Step 1.5b: Checking for remaining unique constraint conflicts...';
    
    -- Check scientific_name conflicts with other plants (old ones are now renamed, so this checks truly external conflicts)
    FOR rec IN 
        SELECT m.old_id, m.scientific_name
        FROM plant_id_migration m
        WHERE m.scientific_name IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM public.plants p 
            WHERE lower(p.scientific_name) = lower(m.scientific_name)
        )
    LOOP
        RAISE NOTICE 'WARNING: scientific_name "%" conflicts with another plant. Will be set to NULL for new plant (old_id: %)', 
            rec.scientific_name, rec.old_id;
        UPDATE plant_id_migration SET scientific_name = NULL WHERE old_id = rec.old_id;
    END LOOP;
    
    -- Check for duplicate scientific_names WITHIN plants being migrated
    FOR rec IN
        SELECT scientific_name, count(*) as cnt
        FROM plant_id_migration
        WHERE scientific_name IS NOT NULL
        GROUP BY lower(scientific_name)
        HAVING count(*) > 1
    LOOP
        RAISE NOTICE 'WARNING: scientific_name "%" is duplicated among migrated plants. Keeping only first occurrence.', 
            rec.scientific_name;
        -- Keep only the first one (by old_id), set others to NULL
        UPDATE plant_id_migration m1
        SET scientific_name = NULL
        WHERE m1.scientific_name IS NOT NULL
        AND lower(m1.scientific_name) = lower(rec.scientific_name)
        AND m1.old_id != (
            SELECT min(m2.old_id) 
            FROM plant_id_migration m2 
            WHERE lower(m2.scientific_name) = lower(rec.scientific_name)
        );
    END LOOP;
    
    -- Check name conflicts with other plants
    FOR rec IN 
        SELECT m.old_id, m.plant_name
        FROM plant_id_migration m
        WHERE m.plant_name IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM public.plants p 
            WHERE lower(p.name) = lower(m.plant_name)
        )
    LOOP
        RAISE NOTICE 'WARNING: name "%" conflicts with another plant. Will append UUID suffix (old_id: %)', 
            rec.plant_name, rec.old_id;
        UPDATE plant_id_migration 
        SET plant_name = plant_name || ' [' || substring(new_id, 1, 8) || ']' 
        WHERE old_id = rec.old_id;
    END LOOP;
    
    -- Check for duplicate names WITHIN plants being migrated  
    FOR rec IN
        SELECT plant_name, count(*) as cnt
        FROM plant_id_migration
        WHERE plant_name IS NOT NULL
        GROUP BY lower(plant_name)
        HAVING count(*) > 1
    LOOP
        RAISE NOTICE 'WARNING: name "%" is duplicated among migrated plants. Appending suffixes.', 
            rec.plant_name;
        -- Add suffix to all but the first one
        UPDATE plant_id_migration m1
        SET plant_name = plant_name || ' [' || substring(new_id, 1, 8) || ']'
        WHERE m1.plant_name IS NOT NULL
        AND lower(m1.plant_name) = lower(rec.plant_name)
        AND m1.old_id != (
            SELECT min(m2.old_id) 
            FROM plant_id_migration m2 
            WHERE lower(m2.plant_name) = lower(rec.plant_name)
        );
    END LOOP;
    
    RAISE NOTICE 'Step 1.5b: Conflict check complete';
END $$;

-- ============================================================================
-- Step 2: Create duplicate plants with new UUIDs (ALL columns)
-- ============================================================================
INSERT INTO public.plants (
    -- Primary key
    id,
    -- Basic info
    name,
    plant_type,
    utility,
    comestible_part,
    fruit_type,
    -- Identity
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
    -- Plant care
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
    -- Growth
    sowing_month,
    flowering_month,
    fruiting_month,
    height_cm,
    wingspan_cm,
    tutoring,
    advice_tutoring,
    sow_type,
    separation_cm,
    transplanting,
    advice_sowing,
    cut,
    -- Usage
    advice_medicinal,
    nutritional_intake,
    infusion,
    advice_infusion,
    recipes_ideas,
    aromatherapy,
    spice_mixes,
    -- Ecology
    melliferous,
    polenizer,
    be_fertilizer,
    ground_effect,
    conservation_status,
    -- Danger
    pests,
    diseases,
    -- Miscellaneous
    companions,
    tags,
    source_name,
    source_url,
    -- Meta
    status,
    admin_commentary,
    created_by,
    created_time,
    updated_by,
    updated_time
)
SELECT
    m.new_id,
    m.plant_name,  -- Use original name from migration table (before rename)
    p.plant_type,
    p.utility,
    p.comestible_part,
    p.fruit_type,
    p.given_names,
    m.scientific_name,  -- Use original from migration table (before rename)
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
    p.wingspan_cm,
    p.tutoring,
    p.advice_tutoring,
    p.sow_type,
    p.separation_cm,
    p.transplanting,
    p.advice_sowing,
    p.cut,
    p.advice_medicinal,
    p.nutritional_intake,
    p.infusion,
    p.advice_infusion,
    p.recipes_ideas,
    p.aromatherapy,
    p.spice_mixes,
    p.melliferous,
    p.polenizer,
    p.be_fertilizer,
    p.ground_effect,
    p.conservation_status,
    p.pests,
    p.diseases,
    p.companions,
    p.tags,
    p.source_name,
    p.source_url,
    p.status,
    p.admin_commentary,
    p.created_by,
    p.created_time,
    p.updated_by,
    now() -- Update the updated_time to now
FROM public.plants p
JOIN plant_id_migration m ON p.id = m.old_id;

DO $$ 
BEGIN 
    RAISE NOTICE 'Step 2 DONE: Created % new plant record(s) with UUIDs', 
        (SELECT count(*) FROM plant_id_migration); 
END $$;

-- ============================================================================
-- Step 3: Update all related tables to use new UUIDs
-- ============================================================================
-- Note: We update BEFORE deleting old plants. The foreign keys have ON DELETE CASCADE,
-- but we want to preserve the data by pointing to the new records.

-- 3.1: plant_watering_schedules
DO $$
DECLARE
    affected integer;
BEGIN
    UPDATE public.plant_watering_schedules pws
    SET plant_id = m.new_id
    FROM plant_id_migration m
    WHERE pws.plant_id = m.old_id;
    
    GET DIAGNOSTICS affected = ROW_COUNT;
    RAISE NOTICE 'Step 3.1: Updated plant_watering_schedules: % row(s)', affected;
END $$;

-- 3.2: plant_sources
DO $$
DECLARE
    affected integer;
BEGIN
    UPDATE public.plant_sources ps
    SET plant_id = m.new_id
    FROM plant_id_migration m
    WHERE ps.plant_id = m.old_id;
    
    GET DIAGNOSTICS affected = ROW_COUNT;
    RAISE NOTICE 'Step 3.2: Updated plant_sources: % row(s)', affected;
END $$;

-- 3.3: plant_infusion_mixes
DO $$
DECLARE
    affected integer;
BEGIN
    UPDATE public.plant_infusion_mixes pim
    SET plant_id = m.new_id
    FROM plant_id_migration m
    WHERE pim.plant_id = m.old_id;
    
    GET DIAGNOSTICS affected = ROW_COUNT;
    RAISE NOTICE 'Step 3.3: Updated plant_infusion_mixes: % row(s)', affected;
END $$;

-- 3.4: plant_images
-- Has unique constraint: (plant_id, use) - direct update is safe
DO $$
DECLARE
    affected integer;
BEGIN
    UPDATE public.plant_images pi
    SET plant_id = m.new_id
    FROM plant_id_migration m
    WHERE pi.plant_id = m.old_id;
    
    GET DIAGNOSTICS affected = ROW_COUNT;
    RAISE NOTICE 'Step 3.4: Updated plant_images: % row(s)', affected;
END $$;

-- 3.5: plant_colors
-- Has composite PK: (plant_id, color_id)
-- Cannot directly update PK columns, must insert new rows then delete old
DO $$
DECLARE
    inserted integer;
    deleted integer;
BEGIN
    -- Insert new rows with new plant_id
    INSERT INTO public.plant_colors (plant_id, color_id, added_at)
    SELECT m.new_id, pc.color_id, pc.added_at
    FROM public.plant_colors pc
    JOIN plant_id_migration m ON pc.plant_id = m.old_id
    ON CONFLICT (plant_id, color_id) DO NOTHING;
    
    GET DIAGNOSTICS inserted = ROW_COUNT;
    
    -- Delete old rows
    DELETE FROM public.plant_colors
    WHERE plant_id IN (SELECT old_id FROM plant_id_migration);
    
    GET DIAGNOSTICS deleted = ROW_COUNT;
    
    RAISE NOTICE 'Step 3.5: Updated plant_colors: inserted % new, deleted % old', inserted, deleted;
END $$;

-- 3.6: plant_translations
-- Has unique constraint: (plant_id, language) - direct update is safe
DO $$
DECLARE
    affected integer;
BEGIN
    UPDATE public.plant_translations pt
    SET plant_id = m.new_id
    FROM plant_id_migration m
    WHERE pt.plant_id = m.old_id;
    
    GET DIAGNOSTICS affected = ROW_COUNT;
    RAISE NOTICE 'Step 3.6: Updated plant_translations: % row(s)', affected;
END $$;

-- 3.7: garden_plants
DO $$
DECLARE
    affected integer;
BEGIN
    UPDATE public.garden_plants gp
    SET plant_id = m.new_id
    FROM plant_id_migration m
    WHERE gp.plant_id = m.old_id;
    
    GET DIAGNOSTICS affected = ROW_COUNT;
    RAISE NOTICE 'Step 3.7: Updated garden_plants: % row(s)', affected;
END $$;

-- 3.8: garden_inventory
-- Has unique constraint: (garden_id, plant_id) - direct update is safe
DO $$
DECLARE
    affected integer;
BEGIN
    UPDATE public.garden_inventory gi
    SET plant_id = m.new_id
    FROM plant_id_migration m
    WHERE gi.plant_id = m.old_id;
    
    GET DIAGNOSTICS affected = ROW_COUNT;
    RAISE NOTICE 'Step 3.8: Updated garden_inventory: % row(s)', affected;
END $$;

-- 3.9: garden_transactions
DO $$
DECLARE
    affected integer;
BEGIN
    UPDATE public.garden_transactions gt
    SET plant_id = m.new_id
    FROM plant_id_migration m
    WHERE gt.plant_id = m.old_id;
    
    GET DIAGNOSTICS affected = ROW_COUNT;
    RAISE NOTICE 'Step 3.9: Updated garden_transactions: % row(s)', affected;
END $$;

-- 3.10: bookmark_items
-- Has unique constraint: (bookmark_id, plant_id) - direct update is safe
-- Note: This table has no FK to plants, but stores plant_id as text
DO $$
DECLARE
    affected integer;
BEGIN
    UPDATE public.bookmark_items bi
    SET plant_id = m.new_id
    FROM plant_id_migration m
    WHERE bi.plant_id = m.old_id;
    
    GET DIAGNOSTICS affected = ROW_COUNT;
    RAISE NOTICE 'Step 3.10: Updated bookmark_items: % row(s)', affected;
END $$;

-- 3.11: profiles.liked_plant_ids (array column)
-- Replace old IDs with new IDs in the liked_plant_ids array
DO $$
DECLARE
    affected integer;
    old_ids text[];
BEGIN
    -- Get all old IDs for the overlap check
    SELECT array_agg(old_id) INTO old_ids FROM plant_id_migration;
    
    -- Only update profiles that have any of the old IDs in their liked_plant_ids
    UPDATE public.profiles p
    SET liked_plant_ids = (
        SELECT COALESCE(
            array_agg(COALESCE(m.new_id, elem) ORDER BY ord),
            '{}'::text[]
        )
        FROM unnest(p.liked_plant_ids) WITH ORDINALITY AS t(elem, ord)
        LEFT JOIN plant_id_migration m ON elem = m.old_id
    )
    WHERE p.liked_plant_ids && old_ids;
    
    GET DIAGNOSTICS affected = ROW_COUNT;
    RAISE NOTICE 'Step 3.11: Updated profiles.liked_plant_ids: % profile(s)', affected;
END $$;

-- ============================================================================
-- Step 4: Delete the original plants with numeric IDs
-- ============================================================================
-- The old plants are now safe to delete. All related data has been migrated
-- to point to the new UUID-based plant records.
DO $$
DECLARE
    deleted integer;
BEGIN
    DELETE FROM public.plants
    WHERE id IN (SELECT old_id FROM plant_id_migration);
    
    GET DIAGNOSTICS deleted = ROW_COUNT;
    RAISE NOTICE '';
    RAISE NOTICE 'Step 4 DONE: Deleted % plant(s) with numeric IDs', deleted;
END $$;

-- ============================================================================
-- Step 5: Verification - Ensure data integrity
-- ============================================================================

-- 5.1: Verify no numeric IDs remain in plants
DO $$
DECLARE
    remaining_count integer;
BEGIN
    SELECT count(*) INTO remaining_count
    FROM public.plants
    WHERE id IN ('0', '1', '2');
    
    IF remaining_count > 0 THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: % plants still have numeric IDs. Rolling back!', remaining_count;
    ELSE
        RAISE NOTICE 'Verification 5.1 PASSED: No plants with numeric IDs (0, 1, 2) remain';
    END IF;
END $$;

-- 5.2: Verify new plants exist with correct data
DO $$
DECLARE
    new_count integer;
    expected_count integer;
BEGIN
    SELECT count(*) INTO expected_count FROM plant_id_migration;
    SELECT count(*) INTO new_count 
    FROM public.plants p
    WHERE p.id IN (SELECT new_id FROM plant_id_migration);
    
    IF new_count != expected_count THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: Expected % new plants, found %. Rolling back!', expected_count, new_count;
    ELSE
        RAISE NOTICE 'Verification 5.2 PASSED: All % new plant(s) created successfully', new_count;
    END IF;
END $$;

-- 5.3: Verify no orphaned references remain
DO $$
DECLARE
    orphan_count integer;
BEGIN
    -- Check plant_watering_schedules
    SELECT count(*) INTO orphan_count
    FROM public.plant_watering_schedules pws
    WHERE pws.plant_id IN (SELECT old_id FROM plant_id_migration);
    IF orphan_count > 0 THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: % orphaned plant_watering_schedules rows', orphan_count;
    END IF;
    
    -- Check plant_sources
    SELECT count(*) INTO orphan_count
    FROM public.plant_sources ps
    WHERE ps.plant_id IN (SELECT old_id FROM plant_id_migration);
    IF orphan_count > 0 THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: % orphaned plant_sources rows', orphan_count;
    END IF;
    
    -- Check plant_infusion_mixes
    SELECT count(*) INTO orphan_count
    FROM public.plant_infusion_mixes pim
    WHERE pim.plant_id IN (SELECT old_id FROM plant_id_migration);
    IF orphan_count > 0 THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: % orphaned plant_infusion_mixes rows', orphan_count;
    END IF;
    
    -- Check plant_images
    SELECT count(*) INTO orphan_count
    FROM public.plant_images pi
    WHERE pi.plant_id IN (SELECT old_id FROM plant_id_migration);
    IF orphan_count > 0 THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: % orphaned plant_images rows', orphan_count;
    END IF;
    
    -- Check plant_colors
    SELECT count(*) INTO orphan_count
    FROM public.plant_colors pc
    WHERE pc.plant_id IN (SELECT old_id FROM plant_id_migration);
    IF orphan_count > 0 THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: % orphaned plant_colors rows', orphan_count;
    END IF;
    
    -- Check plant_translations
    SELECT count(*) INTO orphan_count
    FROM public.plant_translations pt
    WHERE pt.plant_id IN (SELECT old_id FROM plant_id_migration);
    IF orphan_count > 0 THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: % orphaned plant_translations rows', orphan_count;
    END IF;
    
    -- Check garden_plants
    SELECT count(*) INTO orphan_count
    FROM public.garden_plants gp
    WHERE gp.plant_id IN (SELECT old_id FROM plant_id_migration);
    IF orphan_count > 0 THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: % orphaned garden_plants rows', orphan_count;
    END IF;
    
    -- Check garden_inventory
    SELECT count(*) INTO orphan_count
    FROM public.garden_inventory gi
    WHERE gi.plant_id IN (SELECT old_id FROM plant_id_migration);
    IF orphan_count > 0 THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: % orphaned garden_inventory rows', orphan_count;
    END IF;
    
    -- Check garden_transactions
    SELECT count(*) INTO orphan_count
    FROM public.garden_transactions gt
    WHERE gt.plant_id IN (SELECT old_id FROM plant_id_migration);
    IF orphan_count > 0 THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: % orphaned garden_transactions rows', orphan_count;
    END IF;
    
    -- Check bookmark_items
    SELECT count(*) INTO orphan_count
    FROM public.bookmark_items bi
    WHERE bi.plant_id IN (SELECT old_id FROM plant_id_migration);
    IF orphan_count > 0 THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: % orphaned bookmark_items rows', orphan_count;
    END IF;
    
    RAISE NOTICE 'Verification 5.3 PASSED: No orphaned references to old plant IDs';
END $$;

-- 5.4: Verify no profiles have old IDs in liked_plant_ids
DO $$
DECLARE
    orphan_count integer;
    old_ids text[];
BEGIN
    SELECT array_agg(old_id) INTO old_ids FROM plant_id_migration;
    
    SELECT count(*) INTO orphan_count
    FROM public.profiles p
    WHERE p.liked_plant_ids && old_ids;
    
    IF orphan_count > 0 THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: % profiles still have old plant IDs in liked_plant_ids', orphan_count;
    ELSE
        RAISE NOTICE 'Verification 5.4 PASSED: No profiles have old plant IDs in liked_plant_ids';
    END IF;
END $$;

-- ============================================================================
-- Final Summary
-- ============================================================================
DO $$
DECLARE
    rec RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '╔══════════════════════════════════════════════════════════════╗';
    RAISE NOTICE '║            MIGRATION COMPLETED SUCCESSFULLY                  ║';
    RAISE NOTICE '╠══════════════════════════════════════════════════════════════╣';
    FOR rec IN 
        SELECT m.old_id, m.new_id, m.plant_name
        FROM plant_id_migration m 
        ORDER BY m.old_id
    LOOP
        RAISE NOTICE '║ Plant "%" (ID % -> %)    ║', 
            rpad(rec.plant_name, 20), rec.old_id, substring(rec.new_id, 1, 8) || '...';
    END LOOP;
    RAISE NOTICE '╚══════════════════════════════════════════════════════════════╝';
    RAISE NOTICE '';
    RAISE NOTICE 'All data has been migrated. The transaction will now COMMIT.';
    RAISE NOTICE 'If you see this message, the migration was successful!';
    RAISE NOTICE '';
END $$;

COMMIT;
