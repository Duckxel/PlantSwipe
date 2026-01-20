-- Migration: Add translation support for Pro Advice
-- Adds columns to store original language and cached translations

-- Add original_language column to store the detected language of the content
ALTER TABLE public.plant_pro_advices
  ADD COLUMN IF NOT EXISTS original_language text;

-- Add translations column as JSONB to store translated content
-- Structure: { "en": "translated text...", "fr": "texte traduit..." }
ALTER TABLE public.plant_pro_advices
  ADD COLUMN IF NOT EXISTS translations jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Add constraint to ensure translations is a valid JSON object
ALTER TABLE public.plant_pro_advices
  ADD CONSTRAINT plant_pro_advices_translations_object 
  CHECK (translations IS NULL OR jsonb_typeof(translations) = 'object');

-- Create index for efficient language-based queries
CREATE INDEX IF NOT EXISTS plant_pro_advices_original_language_idx 
  ON public.plant_pro_advices (original_language);

-- Comment on columns for documentation
COMMENT ON COLUMN public.plant_pro_advices.original_language IS 'ISO language code of the original content (e.g., en, fr). Detected via DeepL API when advice is created.';
COMMENT ON COLUMN public.plant_pro_advices.translations IS 'JSONB object storing cached translations keyed by language code. Example: {"fr": "Traduit...", "en": "Translated..."}';
