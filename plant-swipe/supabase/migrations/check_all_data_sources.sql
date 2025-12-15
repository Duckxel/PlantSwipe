-- COMPREHENSIVE CHECK: Find where data exists for each field

-- Check plants table current state
SELECT 'PLANTS TABLE - Current data status:' as info;
SELECT 
  id,
  name,
  level_sun,
  scientific_name,
  habitat,
  promotion_month
FROM public.plants
WHERE level_sun IS NOT NULL 
   OR scientific_name IS NOT NULL 
   OR array_length(habitat, 1) > 0
   OR promotion_month IS NOT NULL
LIMIT 10;

-- Check plant_translations table current state  
SELECT 'PLANT_TRANSLATIONS TABLE - Check if columns still exist and have data:' as info;

-- Check if level_sun column exists in plant_translations
SELECT 
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'plant_translations' 
    AND column_name = 'level_sun'
  ) THEN 'level_sun column EXISTS in plant_translations'
  ELSE 'level_sun column DOES NOT EXIST in plant_translations'
  END as column_check;

-- Check if habitat column exists
SELECT 
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'plant_translations' 
    AND column_name = 'habitat'
  ) THEN 'habitat column EXISTS in plant_translations'
  ELSE 'habitat column DOES NOT EXIST in plant_translations'
  END as column_check;

-- Check if scientific_name column exists  
SELECT 
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'plant_translations' 
    AND column_name = 'scientific_name'
  ) THEN 'scientific_name column EXISTS in plant_translations'
  ELSE 'scientific_name column DOES NOT EXIST in plant_translations'
  END as column_check;

-- Check if promotion_month column exists
SELECT 
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'plant_translations' 
    AND column_name = 'promotion_month'
  ) THEN 'promotion_month column EXISTS in plant_translations'
  ELSE 'promotion_month column DOES NOT EXIST in plant_translations'
  END as column_check;

-- If columns exist, check for data
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'plant_translations' 
    AND column_name = 'level_sun'
  ) THEN
    RAISE NOTICE 'Checking plant_translations.level_sun for data...';
  END IF;
END $$;

-- Show a sample of plant_translations data (all columns)
SELECT 'SAMPLE PLANT_TRANSLATIONS (en):' as info;
SELECT * FROM public.plant_translations WHERE language = 'en' LIMIT 2;

-- Final status summary
SELECT 'FINAL STATUS SUMMARY:' as info;
WITH plant_counts AS (
  SELECT 
    COUNT(*) as total_plants,
    COUNT(*) FILTER (WHERE level_sun IS NOT NULL) as has_level_sun,
    COUNT(*) FILTER (WHERE scientific_name IS NOT NULL AND scientific_name != '') as has_scientific_name,
    COUNT(*) FILTER (WHERE array_length(habitat, 1) > 0) as has_habitat,
    COUNT(*) FILTER (WHERE promotion_month IS NOT NULL) as has_promotion_month,
    COUNT(*) FILTER (WHERE toxicity_human IS NOT NULL) as has_toxicity_human,
    COUNT(*) FILTER (WHERE family IS NOT NULL AND family != '') as has_family
  FROM public.plants
)
SELECT 
  total_plants,
  has_level_sun as "level_sun (" || (has_level_sun::float / total_plants * 100)::int || "%)",
  has_scientific_name as "scientific_name (" || (has_scientific_name::float / total_plants * 100)::int || "%)",
  has_habitat as "habitat (" || (has_habitat::float / total_plants * 100)::int || "%)",
  has_promotion_month as "promotion_month (" || (has_promotion_month::float / total_plants * 100)::int || "%)",
  has_toxicity_human as "toxicity_human (" || (has_toxicity_human::float / total_plants * 100)::int || "%)",
  has_family as "family (" || (has_family::float / total_plants * 100)::int || "%)"
FROM plant_counts;
