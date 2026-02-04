-- Add contributors list to plants meta
alter table if exists public.plants
  add column if not exists contributors text[] not null default '{}'::text[];

comment on column public.plants.contributors is 'Names of users who requested or edited this plant';
