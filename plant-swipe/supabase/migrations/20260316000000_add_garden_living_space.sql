-- Add living_space column to gardens table
-- Mirrors the LivingSpace type from plants: 'indoor', 'outdoor', 'terrarium', 'greenhouse'
-- Stored as a text array so gardens can support multiple living spaces.
alter table if exists public.gardens
  add column if not exists living_space text[] not null default '{}'::text[];

-- Constraint: values must be a subset of the known living-space enum
-- (uses same values as the plants.living_space column)
do $$
begin
  if not exists (
    select 1 from information_schema.check_constraints
    where constraint_name = 'gardens_living_space_values'
  ) then
    alter table public.gardens
      add constraint gardens_living_space_values
      check (living_space <@ array['indoor','outdoor','terrarium','greenhouse']::text[]);
  end if;
end $$;

-- ========== Garden Roadmap Completions ==========
-- Tracks beginner roadmap step completions per garden (persistent, survives across devices).
-- Once completed_at is set it is NEVER cleared.

create table if not exists public.garden_roadmap_completions (
  garden_id   uuid   not null references public.gardens(id) on delete cascade,
  step_key    text   not null,
  completed_at timestamptz not null default now(),
  completed_by uuid  references auth.users(id) on delete set null,
  primary key (garden_id, step_key)
);

-- Index for fast garden lookups
create index if not exists grc_garden_idx on public.garden_roadmap_completions (garden_id);

-- Enable RLS
alter table public.garden_roadmap_completions enable row level security;

-- Grant access
grant select, insert on public.garden_roadmap_completions to authenticated;

-- RLS: members of the garden can view completions
drop policy if exists "Garden members can view roadmap completions" on public.garden_roadmap_completions;
create policy "Garden members can view roadmap completions"
  on public.garden_roadmap_completions for select
  using (
    exists (
      select 1 from public.garden_members gm
      where gm.garden_id = garden_roadmap_completions.garden_id
        and gm.user_id = auth.uid()
    )
  );

-- RLS: members can insert completions for their garden
drop policy if exists "Garden members can insert roadmap completions" on public.garden_roadmap_completions;
create policy "Garden members can insert roadmap completions"
  on public.garden_roadmap_completions for insert
  with check (
    exists (
      select 1 from public.garden_members gm
      where gm.garden_id = garden_roadmap_completions.garden_id
        and gm.user_id = auth.uid()
    )
  );

-- RPC: mark a roadmap step as completed (idempotent - won't overwrite existing)
create or replace function public.complete_roadmap_step(
  _garden_id uuid,
  _step_key  text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Verify caller is a member
  if not exists (
    select 1 from public.garden_members
    where garden_id = _garden_id and user_id = auth.uid()
  ) then
    raise exception 'Not a member of this garden';
  end if;

  insert into public.garden_roadmap_completions (garden_id, step_key, completed_by)
  values (_garden_id, _step_key, auth.uid())
  on conflict (garden_id, step_key) do nothing;
end;
$$;
