-- Add separation_cm column to plants table
-- Recommended spacing between two plants of a species in centimeters

alter table public.plants
  add column if not exists separation_cm integer;

comment on column public.plants.separation_cm is 'Recommended spacing between two plants of this species (cm)';
