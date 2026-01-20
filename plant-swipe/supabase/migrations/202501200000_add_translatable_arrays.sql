-- Migration: Add translatable array fields to plant_translations
-- These fields contain user-visible text that should be translated
-- Previously stored only in plants table (non-translatable)

-- Add spice_mixes, pests, diseases to plant_translations for translation support
alter table if exists public.plant_translations add column if not exists spice_mixes text[] not null default '{}';
alter table if exists public.plant_translations add column if not exists pests text[] not null default '{}';
alter table if exists public.plant_translations add column if not exists diseases text[] not null default '{}';

-- Migrate existing data from plants table to English translations
-- Only migrate if the plant has data and the translation doesn't already have it
update public.plant_translations pt
set 
  spice_mixes = coalesce(p.spice_mixes, '{}'),
  pests = coalesce(p.pests, '{}'),
  diseases = coalesce(p.diseases, '{}')
from public.plants p
where pt.plant_id = p.id
  and pt.language = 'en'
  and (array_length(pt.spice_mixes, 1) is null or array_length(pt.spice_mixes, 1) = 0)
  and (array_length(p.spice_mixes, 1) > 0 or array_length(p.pests, 1) > 0 or array_length(p.diseases, 1) > 0);

-- NOTE: We keep the columns in plants table for backward compatibility
-- The translation system will prefer plant_translations values when available
-- and fall back to plants table values if not
