-- Migration: Update accent_key values to new balanced palette
-- Old palette: emerald, rose, sky, amber, violet, lime, teal, cyan, orange, fuchsia
-- New palette: emerald, crimson, royal, purple, gold, coral, neon, turquoise

-- Mapping:
-- emerald -> emerald (keep)
-- rose -> crimson
-- sky -> royal
-- amber -> gold
-- violet -> purple
-- lime -> neon
-- teal -> turquoise
-- cyan -> royal (close to the new blue)
-- orange -> coral
-- fuchsia -> crimson

-- Update existing accent_key values to map to new palette
UPDATE public.profiles SET accent_key = 'crimson' WHERE accent_key = 'rose';
UPDATE public.profiles SET accent_key = 'royal' WHERE accent_key = 'sky';
UPDATE public.profiles SET accent_key = 'gold' WHERE accent_key = 'amber';
UPDATE public.profiles SET accent_key = 'purple' WHERE accent_key = 'violet';
UPDATE public.profiles SET accent_key = 'neon' WHERE accent_key = 'lime';
UPDATE public.profiles SET accent_key = 'turquoise' WHERE accent_key = 'teal';
UPDATE public.profiles SET accent_key = 'royal' WHERE accent_key = 'cyan';
UPDATE public.profiles SET accent_key = 'coral' WHERE accent_key = 'orange';
UPDATE public.profiles SET accent_key = 'crimson' WHERE accent_key = 'fuchsia';

-- Add comment explaining the valid accent_key values
COMMENT ON COLUMN public.profiles.accent_key IS 'User accent color preference. Valid values: emerald, crimson, royal, purple, gold, coral, neon, turquoise';
