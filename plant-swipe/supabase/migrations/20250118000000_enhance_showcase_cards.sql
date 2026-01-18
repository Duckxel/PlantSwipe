-- Enhance landing showcase cards with additional fields for garden preview
-- This adds support for cover images, plant gallery images, and garden stats

-- Add cover_image_url for the main background of showcase cards
alter table public.landing_showcase_cards 
  add column if not exists cover_image_url text;

-- Add plant_images as a JSON array for multiple plant images in the garden preview
alter table public.landing_showcase_cards 
  add column if not exists plant_images jsonb default '[]'::jsonb;

-- Add garden-specific stats
alter table public.landing_showcase_cards 
  add column if not exists garden_name text;

alter table public.landing_showcase_cards 
  add column if not exists plants_count integer default 12;

alter table public.landing_showcase_cards 
  add column if not exists species_count integer default 8;

alter table public.landing_showcase_cards 
  add column if not exists streak_count integer default 7;

alter table public.landing_showcase_cards 
  add column if not exists progress_percent integer default 85;

-- Add link_url for cards that should link somewhere
alter table public.landing_showcase_cards 
  add column if not exists link_url text;

-- Comment on the new columns
comment on column public.landing_showcase_cards.cover_image_url is 'Background/cover image for the showcase card';
comment on column public.landing_showcase_cards.plant_images is 'JSON array of plant image objects [{url, name}]';
comment on column public.landing_showcase_cards.garden_name is 'Display name for garden preview cards';
comment on column public.landing_showcase_cards.plants_count is 'Number of plants to display in garden stats';
comment on column public.landing_showcase_cards.species_count is 'Number of species to display in garden stats';
comment on column public.landing_showcase_cards.streak_count is 'Streak count to display in garden stats';
comment on column public.landing_showcase_cards.progress_percent is 'Progress percentage to display (0-100)';
comment on column public.landing_showcase_cards.link_url is 'Optional URL the card should link to';
