-- ============================================================================
-- Clean bad companion/relation plant data from legacy AI fills
-- Removes entries that are:
--   1. Not valid UUIDs (e.g. text names like "Basil" from old AI autofill)
--   2. Valid UUIDs but don't point to actual plant IDs in the plants table
-- Applies to: companion_plants, biotope_plants, beneficial_plants, harmful_plants
-- ============================================================================

-- Step 1: Diagnostic — show affected rows before cleanup
DO $$
DECLARE
  bad_companion   int;
  bad_biotope     int;
  bad_beneficial  int;
  bad_harmful     int;
BEGIN
  -- Count plants with at least one bad companion_plants entry
  SELECT count(*) INTO bad_companion
  FROM plants p
  WHERE array_length(p.companion_plants, 1) > 0
    AND EXISTS (
      SELECT 1 FROM unnest(p.companion_plants) AS elem
      WHERE elem !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         OR NOT EXISTS (SELECT 1 FROM plants p2 WHERE p2.id = elem)
    );

  SELECT count(*) INTO bad_biotope
  FROM plants p
  WHERE array_length(p.biotope_plants, 1) > 0
    AND EXISTS (
      SELECT 1 FROM unnest(p.biotope_plants) AS elem
      WHERE elem !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         OR NOT EXISTS (SELECT 1 FROM plants p2 WHERE p2.id = elem)
    );

  SELECT count(*) INTO bad_beneficial
  FROM plants p
  WHERE array_length(p.beneficial_plants, 1) > 0
    AND EXISTS (
      SELECT 1 FROM unnest(p.beneficial_plants) AS elem
      WHERE elem !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         OR NOT EXISTS (SELECT 1 FROM plants p2 WHERE p2.id = elem)
    );

  SELECT count(*) INTO bad_harmful
  FROM plants p
  WHERE array_length(p.harmful_plants, 1) > 0
    AND EXISTS (
      SELECT 1 FROM unnest(p.harmful_plants) AS elem
      WHERE elem !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         OR NOT EXISTS (SELECT 1 FROM plants p2 WHERE p2.id = elem)
    );

  RAISE NOTICE '=== BAD COMPANION DATA DIAGNOSTIC ===';
  RAISE NOTICE 'Plants with bad companion_plants entries:  %', bad_companion;
  RAISE NOTICE 'Plants with bad biotope_plants entries:    %', bad_biotope;
  RAISE NOTICE 'Plants with bad beneficial_plants entries: %', bad_beneficial;
  RAISE NOTICE 'Plants with bad harmful_plants entries:    %', bad_harmful;
END
$$;

-- Step 2: Clean companion_plants — keep only valid UUIDs that point to real plants
UPDATE plants p
SET companion_plants = COALESCE((
  SELECT array_agg(elem ORDER BY elem)
  FROM unnest(p.companion_plants) AS elem
  WHERE elem ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND EXISTS (SELECT 1 FROM plants p2 WHERE p2.id = elem)
), '{}'::text[])
WHERE array_length(companion_plants, 1) > 0
  AND EXISTS (
    SELECT 1 FROM unnest(p.companion_plants) AS elem
    WHERE elem !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       OR NOT EXISTS (SELECT 1 FROM plants p2 WHERE p2.id = elem)
  );

-- Step 3: Clean biotope_plants
UPDATE plants p
SET biotope_plants = COALESCE((
  SELECT array_agg(elem ORDER BY elem)
  FROM unnest(p.biotope_plants) AS elem
  WHERE elem ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND EXISTS (SELECT 1 FROM plants p2 WHERE p2.id = elem)
), '{}'::text[])
WHERE array_length(biotope_plants, 1) > 0
  AND EXISTS (
    SELECT 1 FROM unnest(p.biotope_plants) AS elem
    WHERE elem !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       OR NOT EXISTS (SELECT 1 FROM plants p2 WHERE p2.id = elem)
  );

-- Step 4: Clean beneficial_plants
UPDATE plants p
SET beneficial_plants = COALESCE((
  SELECT array_agg(elem ORDER BY elem)
  FROM unnest(p.beneficial_plants) AS elem
  WHERE elem ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND EXISTS (SELECT 1 FROM plants p2 WHERE p2.id = elem)
), '{}'::text[])
WHERE array_length(beneficial_plants, 1) > 0
  AND EXISTS (
    SELECT 1 FROM unnest(p.beneficial_plants) AS elem
    WHERE elem !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       OR NOT EXISTS (SELECT 1 FROM plants p2 WHERE p2.id = elem)
  );

-- Step 5: Clean harmful_plants
UPDATE plants p
SET harmful_plants = COALESCE((
  SELECT array_agg(elem ORDER BY elem)
  FROM unnest(p.harmful_plants) AS elem
  WHERE elem ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND EXISTS (SELECT 1 FROM plants p2 WHERE p2.id = elem)
), '{}'::text[])
WHERE array_length(harmful_plants, 1) > 0
  AND EXISTS (
    SELECT 1 FROM unnest(p.harmful_plants) AS elem
    WHERE elem !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       OR NOT EXISTS (SELECT 1 FROM plants p2 WHERE p2.id = elem)
  );

-- Step 6: Post-cleanup diagnostic
DO $$
DECLARE
  total_companions   int;
  total_biotope      int;
  total_beneficial   int;
  total_harmful      int;
BEGIN
  SELECT count(*) INTO total_companions
  FROM plants WHERE array_length(companion_plants, 1) > 0;

  SELECT count(*) INTO total_biotope
  FROM plants WHERE array_length(biotope_plants, 1) > 0;

  SELECT count(*) INTO total_beneficial
  FROM plants WHERE array_length(beneficial_plants, 1) > 0;

  SELECT count(*) INTO total_harmful
  FROM plants WHERE array_length(harmful_plants, 1) > 0;

  RAISE NOTICE '=== POST-CLEANUP SUMMARY ===';
  RAISE NOTICE 'Plants with companion_plants:  %', total_companions;
  RAISE NOTICE 'Plants with biotope_plants:    %', total_biotope;
  RAISE NOTICE 'Plants with beneficial_plants: %', total_beneficial;
  RAISE NOTICE 'Plants with harmful_plants:    %', total_harmful;
  RAISE NOTICE 'All bad entries have been removed. Only valid plant ID references remain.';
END
$$;
