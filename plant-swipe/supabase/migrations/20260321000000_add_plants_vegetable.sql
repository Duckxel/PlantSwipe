-- Add vegetable boolean column to plants table
-- Distinguishes vegetables from other edible plants (separate from edible_part)
alter table if exists public.plants
  add column if not exists vegetable boolean not null default false;
