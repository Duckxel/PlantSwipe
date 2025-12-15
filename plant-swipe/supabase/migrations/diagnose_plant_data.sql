-- Diagnostic: Check where plant data is stored

-- Check what columns exist in plant_translations
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'plant_translations'
ORDER BY ordinal_position;

-- Check what columns exist in plants table  
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'plants'
ORDER BY ordinal_position;

-- Check if there are JSONB columns that might contain nested data
SELECT 
  id, 
  name,
  -- Check if these columns exist and have data
  level_sun,
  scientific_name,
  promotion_month,
  habitat
FROM public.plants
LIMIT 5;

-- Check plant_translations for any remaining data
SELECT 
  plant_id,
  language,
  -- List any columns that might have the data
  *
FROM public.plant_translations
WHERE language = 'en'
LIMIT 3;

-- Check if there's a care or identity JSONB column
SELECT 
  p.id,
  p.name,
  pt.language
FROM public.plants p
LEFT JOIN public.plant_translations pt ON p.id = pt.plant_id AND pt.language = 'en'
LIMIT 5;
