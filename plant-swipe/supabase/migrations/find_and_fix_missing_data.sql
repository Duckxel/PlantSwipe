-- DIAGNOSTIC: Find where plant data is stored and recover it if possible

-- Step 1: Check what columns exist in plant_translations
SELECT 'plant_translations columns:' as info;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'plant_translations'
ORDER BY ordinal_position;

-- Step 2: Check what columns exist in plants table
SELECT 'plants columns:' as info;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'plants'
ORDER BY ordinal_position;

-- Step 3: Sample the actual data in plants table for key fields
SELECT 'Sample plants data:' as info;
SELECT 
  id, 
  name,
  scientific_name,
  level_sun,
  toxicity_human,
  toxicity_pets,
  family,
  life_cycle,
  season,
  habitat,
  living_space,
  maintenance_level,
  promotion_month,
  foliage_persistance,
  composition
FROM public.plants
LIMIT 5;

-- Step 4: Sample plant_translations data
SELECT 'Sample plant_translations data:' as info;
SELECT *
FROM public.plant_translations
WHERE language = 'en'
LIMIT 3;

-- Step 5: Check if there's historical data in any backup columns or alternative sources
-- Sometimes data is stored with slightly different column names
SELECT 'Checking for alternative column names in plants:' as info;
SELECT column_name 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'plants'
  AND (
    column_name LIKE '%sun%' OR
    column_name LIKE '%light%' OR
    column_name LIKE '%scientific%' OR
    column_name LIKE '%latin%' OR
    column_name LIKE '%promo%' OR
    column_name LIKE '%habitat%'
  );

-- Step 6: Count how many plants have data in each critical field
SELECT 'Data population counts:' as info;
SELECT 
  'level_sun' as field_name,
  COUNT(*) FILTER (WHERE level_sun IS NOT NULL) as has_data,
  COUNT(*) as total
FROM public.plants
UNION ALL
SELECT 'scientific_name', COUNT(*) FILTER (WHERE scientific_name IS NOT NULL AND scientific_name != ''), COUNT(*) FROM public.plants
UNION ALL
SELECT 'habitat', COUNT(*) FILTER (WHERE habitat IS NOT NULL AND array_length(habitat, 1) > 0), COUNT(*) FROM public.plants
UNION ALL
SELECT 'promotion_month', COUNT(*) FILTER (WHERE promotion_month IS NOT NULL), COUNT(*) FROM public.plants
UNION ALL
SELECT 'toxicity_human', COUNT(*) FILTER (WHERE toxicity_human IS NOT NULL), COUNT(*) FROM public.plants
UNION ALL
SELECT 'toxicity_pets', COUNT(*) FILTER (WHERE toxicity_pets IS NOT NULL), COUNT(*) FROM public.plants
UNION ALL
SELECT 'family', COUNT(*) FILTER (WHERE family IS NOT NULL AND family != ''), COUNT(*) FROM public.plants
UNION ALL
SELECT 'life_cycle', COUNT(*) FILTER (WHERE life_cycle IS NOT NULL), COUNT(*) FROM public.plants
UNION ALL
SELECT 'season', COUNT(*) FILTER (WHERE season IS NOT NULL AND array_length(season, 1) > 0), COUNT(*) FROM public.plants
UNION ALL
SELECT 'living_space', COUNT(*) FILTER (WHERE living_space IS NOT NULL), COUNT(*) FROM public.plants
UNION ALL
SELECT 'maintenance_level', COUNT(*) FILTER (WHERE maintenance_level IS NOT NULL), COUNT(*) FROM public.plants
UNION ALL
SELECT 'composition', COUNT(*) FILTER (WHERE composition IS NOT NULL AND array_length(composition, 1) > 0), COUNT(*) FROM public.plants
UNION ALL
SELECT 'foliage_persistance', COUNT(*) FILTER (WHERE foliage_persistance IS NOT NULL), COUNT(*) FROM public.plants;
