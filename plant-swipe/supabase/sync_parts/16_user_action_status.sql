-- ========== User Action Status ==========
-- Tracks profile onboarding action completion and skip state across devices.
-- Once completed_at is set for a row it is NEVER cleared — even if the user
-- later deletes the underlying resource (e.g. removes their garden).

create table if not exists public.user_action_status (
  user_id      uuid   not null references auth.users(id) on delete cascade,
  action_id    text   not null,
  completed_at timestamptz,
  skipped_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (user_id, action_id)
);

-- Index for fast user lookups
create index if not exists uas_user_idx on public.user_action_status (user_id);

-- Enable RLS
alter table public.user_action_status enable row level security;

-- Grant access to authenticated users
grant select, insert, update on public.user_action_status to authenticated;

-- RLS policies — users can only touch their own rows
drop policy if exists "Users can view their own action status" on public.user_action_status;
create policy "Users can view their own action status"
  on public.user_action_status for select
  using ( auth.uid() = user_id );

drop policy if exists "Users can insert their own action status" on public.user_action_status;
create policy "Users can insert their own action status"
  on public.user_action_status for insert
  with check ( auth.uid() = user_id );

drop policy if exists "Users can update their own action status" on public.user_action_status;
create policy "Users can update their own action status"
  on public.user_action_status for update
  using ( auth.uid() = user_id );

-- ========== RPCs ==========
-- Each RPC is focused: it only modifies the column it is responsible for
-- and preserves the other column. All use security definer with an explicit
-- auth check so ON CONFLICT handling is clean.

-- Mark a single action as completed (sticky — never overwrites existing
-- completed_at).  Preserves skipped_at.
create or replace function public.mark_action_completed(
  _user_id   uuid,
  _action_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if _user_id <> (select auth.uid()) then
    raise exception 'Not authorized';
  end if;

  insert into public.user_action_status (user_id, action_id, completed_at, updated_at)
  values (_user_id, _action_id, now(), now())
  on conflict (user_id, action_id) do update set
    completed_at = coalesce(user_action_status.completed_at, now()),
    updated_at   = now();
end;
$$;

-- Batch-mark multiple actions as completed in one query.
-- Used by the client-side sync that detects live completions.
create or replace function public.bulk_mark_actions_completed(
  _user_id    uuid,
  _action_ids text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if _user_id <> (select auth.uid()) then
    raise exception 'Not authorized';
  end if;

  if array_length(_action_ids, 1) is null then
    return;
  end if;

  insert into public.user_action_status (user_id, action_id, completed_at, updated_at)
  select _user_id, unnest(_action_ids), now(), now()
  on conflict (user_id, action_id) do update set
    completed_at = coalesce(user_action_status.completed_at, now()),
    updated_at   = now();
end;
$$;

-- Skip an action.  Preserves completed_at.
create or replace function public.skip_action(
  _user_id   uuid,
  _action_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if _user_id <> (select auth.uid()) then
    raise exception 'Not authorized';
  end if;

  insert into public.user_action_status (user_id, action_id, skipped_at, updated_at)
  values (_user_id, _action_id, now(), now())
  on conflict (user_id, action_id) do update set
    skipped_at = now(),
    updated_at = now();
end;
$$;

-- Unskip an action.  Preserves completed_at.
create or replace function public.unskip_action(
  _user_id   uuid,
  _action_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if _user_id <> (select auth.uid()) then
    raise exception 'Not authorized';
  end if;

  update public.user_action_status
  set skipped_at = null, updated_at = now()
  where user_id = _user_id and action_id = _action_id;
end;
$$;
