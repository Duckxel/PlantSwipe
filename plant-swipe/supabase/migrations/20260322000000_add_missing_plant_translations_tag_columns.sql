-- ============================================================================
-- Add missing tag columns to plant_translations table
-- ============================================================================
-- These columns were defined in the schema (04_translations_and_requests.sql)
-- but never had a migration to add them to the production database.
-- Fixes: "Could not find the 'biotopes' column of 'plant_translations' in the schema cache"
-- ============================================================================

ALTER TABLE public.plant_translations ADD COLUMN IF NOT EXISTS mulch_type text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.plant_translations ADD COLUMN IF NOT EXISTS nutrition_need text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.plant_translations ADD COLUMN IF NOT EXISTS fertilizer text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.plant_translations ADD COLUMN IF NOT EXISTS special_needs text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.plant_translations ADD COLUMN IF NOT EXISTS biotopes text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.plant_translations ADD COLUMN IF NOT EXISTS pollinators_attracted text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.plant_translations ADD COLUMN IF NOT EXISTS birds_attracted text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.plant_translations ADD COLUMN IF NOT EXISTS mammals_attracted text[] NOT NULL DEFAULT '{}';
