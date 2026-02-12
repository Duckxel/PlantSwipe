-- ========== Ownership invariants ==========
-- Enforce: There cannot be no owner for a garden. If an update/delete would remove the last
-- owner from a garden, delete the garden (cascades) instead of leaving it ownerless.
create or replace function public.enforce_owner_presence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remaining int;
  v_garden uuid;
  v_user uuid;
begin
  if TG_OP = 'DELETE' then
    if OLD.role = 'owner' then
      v_garden := OLD.garden_id;
      v_user := OLD.user_id;
      select count(*)::int into v_remaining
      from public.garden_members
      where garden_id = v_garden and role = 'owner' and user_id <> v_user;
      if coalesce(v_remaining, 0) = 0 then
        -- This delete would remove the last owner; delete the garden instead
        delete from public.gardens where id = v_garden;
        return OLD;
      end if;
    end if;
    return OLD;
  elsif TG_OP = 'UPDATE' then
    if OLD.role = 'owner' and NEW.role <> 'owner' then
      v_garden := NEW.garden_id;
      v_user := NEW.user_id;
      select count(*)::int into v_remaining
      from public.garden_members
      where garden_id = v_garden and role = 'owner' and user_id <> v_user;
      if coalesce(v_remaining, 0) = 0 then
        -- This update would demote the last owner; delete the garden
        delete from public.gardens where id = v_garden;
        return NEW;
      end if;
    end if;
    return NEW;
  end if;
  return coalesce(NEW, OLD);
end;
$$;

-- Attach triggers idempotently
do $$ begin
  begin
    drop trigger if exists trg_gm_owner_update on public.garden_members;
  exception when undefined_object then null; end;
  begin
    drop trigger if exists trg_gm_owner_delete on public.garden_members;
  exception when undefined_object then null; end;
  create trigger trg_gm_owner_update
    before update on public.garden_members
    for each row execute function public.enforce_owner_presence();
  create trigger trg_gm_owner_delete
    before delete on public.garden_members
    for each row execute function public.enforce_owner_presence();
end $$;

-- Schedule tables policies
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plant_schedule' and policyname='gps_select') then
    create policy gps_select on public.garden_plant_schedule for select to authenticated
      using (
        exists (
          select 1 from public.garden_plants gp
          join public.garden_members gm on gm.garden_id = gp.garden_id
          where gp.id = garden_plant_id and gm.user_id = (select auth.uid())
        )
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plant_schedule' and policyname='gps_iud') then
    drop policy gps_iud on public.garden_plant_schedule;
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plant_schedule' and policyname='gps_insert') then
    create policy gps_insert on public.garden_plant_schedule for insert to authenticated
      with check (
        exists (
          select 1 from public.garden_plants gp
          join public.garden_members gm on gm.garden_id = gp.garden_id
          where gp.id = garden_plant_id and gm.user_id = (select auth.uid())
        )
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plant_schedule' and policyname='gps_update') then
    create policy gps_update on public.garden_plant_schedule for update to authenticated
      using (
        exists (
          select 1 from public.garden_plants gp
          join public.garden_members gm on gm.garden_id = gp.garden_id
          where gp.id = garden_plant_id and gm.user_id = (select auth.uid())
        )
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      )
      with check (
        exists (
          select 1 from public.garden_plants gp
          join public.garden_members gm on gm.garden_id = gp.garden_id
          where gp.id = garden_plant_id and gm.user_id = (select auth.uid())
        )
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plant_schedule' and policyname='gps_delete') then
    create policy gps_delete on public.garden_plant_schedule for delete to authenticated
      using (
        exists (
          select 1 from public.garden_plants gp
          join public.garden_members gm on gm.garden_id = gp.garden_id
          where gp.id = garden_plant_id and gm.user_id = (select auth.uid())
        )
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_watering_schedule' and policyname='gws_select') then
    create policy gws_select on public.garden_watering_schedule for select to authenticated
      using (
        exists (
          select 1 from public.garden_plants gp
          join public.garden_members gm on gm.garden_id = gp.garden_id
          where gp.id = garden_plant_id and gm.user_id = (select auth.uid())
        )
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_watering_schedule' and policyname='gws_iud') then
    drop policy gws_iud on public.garden_watering_schedule;
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_watering_schedule' and policyname='gws_insert') then
    create policy gws_insert on public.garden_watering_schedule for insert to authenticated
      with check (
        exists (
          select 1 from public.garden_plants gp
          join public.garden_members gm on gm.garden_id = gp.garden_id
          where gp.id = garden_plant_id and gm.user_id = (select auth.uid())
        )
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_watering_schedule' and policyname='gws_update') then
    create policy gws_update on public.garden_watering_schedule for update to authenticated
      using (
        exists (
          select 1 from public.garden_plants gp
          join public.garden_members gm on gm.garden_id = gp.garden_id
          where gp.id = garden_plant_id and gm.user_id = (select auth.uid())
        )
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      )
      with check (
        exists (
          select 1 from public.garden_plants gp
          join public.garden_members gm on gm.garden_id = gp.garden_id
          where gp.id = garden_plant_id and gm.user_id = (select auth.uid())
        )
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_watering_schedule' and policyname='gws_delete') then
    create policy gws_delete on public.garden_watering_schedule for delete to authenticated
      using (
        exists (
          select 1 from public.garden_plants gp
          join public.garden_members gm on gm.garden_id = gp.garden_id
          where gp.id = garden_plant_id and gm.user_id = (select auth.uid())
        )
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
end $$;

-- Events policies
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plant_events' and policyname='gpe_select') then
    create policy gpe_select on public.garden_plant_events for select to authenticated
      using (
        exists (
          select 1 from public.garden_plants gp
          where gp.id = garden_plant_id
            and exists (select 1 from public.garden_members gm where gm.garden_id = gp.garden_id and gm.user_id = (select auth.uid()))
        )
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_plant_events' and policyname='gpe_insert') then
    create policy gpe_insert on public.garden_plant_events for insert to authenticated
      with check (
        exists (
          select 1 from public.garden_plants gp
          where gp.id = garden_plant_id
            and exists (select 1 from public.garden_members gm where gm.garden_id = gp.garden_id and gm.user_id = (select auth.uid()))
        )
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
end $$;

-- Inventory policies
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_inventory' and policyname='gi_select') then
    create policy gi_select on public.garden_inventory for select
      using (
        exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_inventory' and policyname='gi_iud') then
    drop policy gi_iud on public.garden_inventory;
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_inventory' and policyname='gi_insert') then
    create policy gi_insert on public.garden_inventory for insert to authenticated
      with check (
        exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_inventory' and policyname='gi_update') then
    create policy gi_update on public.garden_inventory for update to authenticated
      using (
        exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      )
      with check (
        exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_inventory' and policyname='gi_delete') then
    create policy gi_delete on public.garden_inventory for delete to authenticated
      using (
        exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
end $$;

-- Instance inventory policies
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_instance_inventory' and policyname='gii_select') then
    create policy gii_select on public.garden_instance_inventory for select
      using (
        exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
end $$;
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='garden_instance_inventory' and policyname='gii_iud') then
    drop policy gii_iud on public.garden_instance_inventory;
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_instance_inventory' and policyname='gii_insert') then
    create policy gii_insert on public.garden_instance_inventory for insert to authenticated
      with check (
        exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_instance_inventory' and policyname='gii_update') then
    create policy gii_update on public.garden_instance_inventory for update to authenticated
      using (
        exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      )
      with check (
        exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_instance_inventory' and policyname='gii_delete') then
    create policy gii_delete on public.garden_instance_inventory for delete to authenticated
      using (
        exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
end $$;

-- Transactions policies
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_transactions' and policyname='gt_select') then
    create policy gt_select on public.garden_transactions for select
      using (
        exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='garden_transactions' and policyname='gt_insert') then
    create policy gt_insert on public.garden_transactions for insert to authenticated
      with check (
        exists (select 1 from public.garden_members gm where gm.garden_id = garden_id and gm.user_id = (select auth.uid()))
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
      );
  end if;
end $$;

-- Task tables policies
-- Drop and recreate to ensure policies are always up-to-date
drop policy if exists gpt_iud on public.garden_plant_tasks;
drop policy if exists gpt_select on public.garden_plant_tasks;
create policy gpt_select on public.garden_plant_tasks for select to authenticated
  using (
    exists (select 1 from public.garden_members gm where gm.garden_id = garden_plant_tasks.garden_id and gm.user_id = (select auth.uid()))
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
  );

drop policy if exists gpt_insert on public.garden_plant_tasks;
create policy gpt_insert on public.garden_plant_tasks for insert to authenticated
  with check (
    exists (select 1 from public.garden_members gm where gm.garden_id = garden_plant_tasks.garden_id and gm.user_id = (select auth.uid()))
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
  );

drop policy if exists gpt_update on public.garden_plant_tasks;
create policy gpt_update on public.garden_plant_tasks for update to authenticated
  using (
    exists (select 1 from public.garden_members gm where gm.garden_id = garden_plant_tasks.garden_id and gm.user_id = (select auth.uid()))
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
  )
  with check (
    exists (select 1 from public.garden_members gm where gm.garden_id = garden_plant_tasks.garden_id and gm.user_id = (select auth.uid()))
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
  );

drop policy if exists gpt_delete on public.garden_plant_tasks;
create policy gpt_delete on public.garden_plant_tasks for delete to authenticated
  using (
    exists (select 1 from public.garden_members gm where gm.garden_id = garden_plant_tasks.garden_id and gm.user_id = (select auth.uid()))
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
  );

-- Allow anon users to read garden_plant_tasks for public gardens
drop policy if exists gpt_select_anon_public on public.garden_plant_tasks;
create policy gpt_select_anon_public on public.garden_plant_tasks for select to anon
  using (public.is_public_garden(garden_id));

-- garden_plant_task_occurrences policies
drop policy if exists gpto_iud on public.garden_plant_task_occurrences;
drop policy if exists gpto_select on public.garden_plant_task_occurrences;
create policy gpto_select on public.garden_plant_task_occurrences for select to authenticated
  using (
    exists (
      select 1 from public.garden_plants gp
      join public.garden_members gm on gm.garden_id = gp.garden_id
      where gp.id = garden_plant_task_occurrences.garden_plant_id and gm.user_id = (select auth.uid())
    )
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
  );

drop policy if exists gpto_insert on public.garden_plant_task_occurrences;
create policy gpto_insert on public.garden_plant_task_occurrences for insert to authenticated
  with check (
    exists (
      select 1 from public.garden_plants gp
      join public.garden_members gm on gm.garden_id = gp.garden_id
      where gp.id = garden_plant_task_occurrences.garden_plant_id and gm.user_id = (select auth.uid())
    )
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
  );

drop policy if exists gpto_update on public.garden_plant_task_occurrences;
create policy gpto_update on public.garden_plant_task_occurrences for update to authenticated
  using (
    exists (
      select 1 from public.garden_plants gp
      join public.garden_members gm on gm.garden_id = gp.garden_id
      where gp.id = garden_plant_task_occurrences.garden_plant_id and gm.user_id = (select auth.uid())
    )
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
  )
  with check (
    exists (
      select 1 from public.garden_plants gp
      join public.garden_members gm on gm.garden_id = gp.garden_id
      where gp.id = garden_plant_task_occurrences.garden_plant_id and gm.user_id = (select auth.uid())
    )
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
  );

drop policy if exists gpto_delete on public.garden_plant_task_occurrences;
create policy gpto_delete on public.garden_plant_task_occurrences for delete to authenticated
  using (
    exists (
      select 1 from public.garden_plants gp
      join public.garden_members gm on gm.garden_id = gp.garden_id
      where gp.id = garden_plant_task_occurrences.garden_plant_id and gm.user_id = (select auth.uid())
    )
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)
  );

-- Allow anon users to read garden_plant_task_occurrences for public gardens
drop policy if exists gpto_select_anon_public on public.garden_plant_task_occurrences;
create policy gpto_select_anon_public on public.garden_plant_task_occurrences for select to anon
  using (
    exists (
      select 1 from public.garden_plants gp
      where gp.id = garden_plant_task_occurrences.garden_plant_id
      and public.is_public_garden(gp.garden_id)
    )
  );

-- ========== RPCs used by the app ==========
-- Public profile fetch by display name (safe columns only) with admin flag, joined_at, and presence
drop function if exists public.get_profile_public_by_username(text);
drop function if exists public.get_profile_public_by_display_name(text);
create or replace function public.get_profile_public_by_display_name(_name text)
returns table(
  id uuid,
  display_name text,
  country text,
  bio text,
  avatar_url text,
  accent_key text,
  is_admin boolean,
  roles text[],
  is_private boolean,
  disable_friend_requests boolean,
  joined_at timestamptz,
  last_seen_at timestamptz,
  is_online boolean,
  experience_level text,
  job text,
  profile_link text,
  show_country boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select p.id, p.display_name, p.country, p.bio, p.avatar_url, p.accent_key, p.is_admin, coalesce(p.roles, '{}') as roles, coalesce(p.is_private, false) as is_private, coalesce(p.disable_friend_requests, false) as disable_friend_requests, p.experience_level, p.job, p.profile_link, coalesce(p.show_country, true) as show_country
    from public.profiles p
    where lower(p.display_name) = lower(_name)
      and coalesce(p.threat_level, 0) < 3  -- Exclude shadow-banned users from public profile lookups
    limit 1
  ),
  auth_meta as (
    select u.id, u.created_at as joined_at
    from auth.users u
    where exists (select 1 from base b where b.id = u.id)
  ),
  ls as (
    select v.user_id, max(v.occurred_at) as last_seen_at
    from public.web_visits v
    where exists (select 1 from base b where b.id = v.user_id)
    group by v.user_id
  )
  select b.id,
         b.display_name,
         b.country,
         b.bio,
         b.avatar_url,
         b.accent_key,
         b.is_admin,
         b.roles,
         b.is_private,
         b.disable_friend_requests,
         a.joined_at,
         l.last_seen_at,
         coalesce((l.last_seen_at is not null and (now() - l.last_seen_at) <= make_interval(mins => 10)), false) as is_online,
         b.experience_level,
         b.job,
         b.profile_link,
         b.show_country
  from base b
  left join auth_meta a on a.id = b.id
  left join ls l on l.user_id = b.id
  limit 1;
$$;
grant execute on function public.get_profile_public_by_display_name(text) to anon, authenticated;

-- Compute user's current streak across ALL their gardens (AND across gardens)
drop function if exists public.compute_user_current_streak(uuid, date) cascade;
create or replace function public.compute_user_current_streak(_user_id uuid, _anchor_day date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  d date := _anchor_day;
  s integer := 0;
  v_gardens_count integer := 0;
  ok boolean;
begin
  -- Count gardens user belongs to (owner or member)
  select count(*)::int into v_gardens_count
  from (
    select id as gid from public.gardens where created_by = _user_id
    union
    select garden_id as gid from public.garden_members where user_id = _user_id
  ) g;

  if coalesce(v_gardens_count, 0) = 0 then
    return 0; -- no gardens => no streak
  end if;

  loop
    -- For this day, require ALL gardens to be successful
    select bool_and(
      exists (
        select 1
        from public.garden_tasks t
        where t.garden_id = ug.gid
          and t.day = d
          and t.task_type = 'watering'
          and coalesce(t.success, false) = true
      )
    ) into ok
    from (
      select id as gid from public.gardens where created_by = _user_id
      union
      select garden_id as gid from public.garden_members where user_id = _user_id
    ) ug;

    if not coalesce(ok, false) then
      exit;
    end if;

    s := s + 1;
    d := (d - interval '1 day')::date;
  end loop;

  return s;
end;
$$;
grant execute on function public.compute_user_current_streak(uuid, date) to anon, authenticated;

-- Aggregate public stats for a user's gardens/membership
drop function if exists public.get_user_profile_public_stats(uuid) cascade;
create or replace function public.get_user_profile_public_stats(_user_id uuid)
returns table(plants_total integer, gardens_count integer, current_streak integer, longest_streak integer)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_plants int := 0;
  v_gardens int := 0;
  v_current int := 0;
  v_longest int := 0;
  v_anchor date := ((now() at time zone 'utc')::date - interval '1 day')::date;
begin
  -- Sum plants across gardens the user is currently a member of
  select coalesce(sum(gp.plants_on_hand), 0)::int into v_plants
  from public.garden_plants gp
  where gp.garden_id in (
    select garden_id from public.garden_members where user_id = _user_id
  );

  -- Count only gardens the user is currently a member of (owner or member)
  select count(*)::int into v_gardens
  from (
    select distinct garden_id
    from public.garden_members
    where user_id = _user_id
  ) g;

  -- Current streak across all user's gardens
  v_current := case when v_gardens > 0 then public.compute_user_current_streak(_user_id, v_anchor) else 0 end;

  -- Longest historical streak across user's gardens
  with user_gardens as (
    -- Only gardens where the user is currently a member (owner or member)
    select garden_id as gid from public.garden_members where user_id = _user_id
  ),
  successes as (
    select g.garden_id, g.day
    from public.garden_tasks g
    where g.garden_id in (select gid from user_gardens)
      and g.task_type = 'watering'
      and coalesce(g.success, false) = true
  ),
  grouped as (
    select garden_id,
           day,
           (day - ((row_number() over (partition by garden_id order by day))::int * interval '1 day'))::date as grp
    from successes
  ),
  runs as (
    select garden_id, grp, count(*)::int as len
    from grouped
    group by garden_id, grp
  )
  select coalesce(max(len), 0)::int into v_longest from runs;

  return query select v_plants, v_gardens, v_current, v_longest;
end;
$$;
grant execute on function public.get_user_profile_public_stats(uuid) to anon, authenticated;

-- Daily completed task counts and success flags across all user's gardens
create or replace function public.get_user_daily_tasks(
  _user_id uuid,
  _start date,
  _end date
)
returns table(day date, completed integer, any_success boolean)
language sql
stable
security definer
set search_path = public
as $$
  with days as (
    select generate_series(_start, _end, interval '1 day')::date as d
  ),
  user_gardens as (
    -- Only gardens where the user is currently a member (owner or member)
    select garden_id as gid from public.garden_members where user_id = _user_id
  ),
  due_day as (
    -- Total required counts due on each day across user's gardens
    select (o.due_at at time zone 'utc')::date as d, sum(greatest(1, o.required_count))::int as total_required
    from public.garden_plant_task_occurrences o
    join public.garden_plant_tasks t on t.id = o.task_id
    where t.garden_id in (select gid from user_gardens)
      and (o.due_at at time zone 'utc')::date between _start and _end
    group by 1
  ),
  user_done as (
    -- Sum of increments done by the user per occurrence capped at that occurrence's required_count
    select (o.due_at at time zone 'utc')::date as d,
           sum(
             least(
               greatest(1, o.required_count),
               coalesce((select sum(greatest(1, c.increment)) from public.garden_task_user_completions c where c.occurrence_id = o.id and c.user_id = _user_id), 0)
             )
           )::int as completed
    from public.garden_plant_task_occurrences o
    join public.garden_plant_tasks t on t.id = o.task_id
    where t.garden_id in (select gid from user_gardens)
      and (o.due_at at time zone 'utc')::date between _start and _end
    group by 1
  )
  select d.d as day,
         coalesce((select completed from user_done where user_done.d = d.d), 0) as completed,
         (
           coalesce((select total_required from due_day where due_day.d = d.d), 0) = 0
           or
           coalesce((select completed from user_done where user_done.d = d.d), 0) >= coalesce((select total_required from due_day where due_day.d = d.d), 0)
         ) as any_success
  from days d
  order by d.d asc;
$$;
grant execute on function public.get_user_daily_tasks(uuid, date, date) to anon, authenticated;

-- Public display name availability check
drop function if exists public.is_username_available(text);
create or replace function public.is_display_name_available(_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.profiles p where lower(p.display_name) = lower(_name)
  );
$$;
grant execute on function public.is_display_name_available(text) to anon, authenticated;

-- Resolve email by display name (for username-style login)
create or replace function public.get_email_by_display_name(_name text)
returns text
language sql
security definer
set search_path = public
as $$
  select u.email
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(p.display_name) = lower(_name)
  limit 1;
$$;
grant execute on function public.get_email_by_display_name(text) to anon, authenticated;

-- Resolve user id by display name (for adding members by username)
create or replace function public.get_user_id_by_display_name(_name text)
returns uuid
language sql
security definer
set search_path = public
as $$
  select u.id
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(p.display_name) = lower(_name)
  limit 1;
$$;
grant execute on function public.get_user_id_by_display_name(text) to anon, authenticated;

-- Private info fetch (self or admin only)
create or replace function public.get_user_private_info(_user_id uuid)
returns table(id uuid, email text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_caller uuid;
begin
  v_caller := auth.uid();
  if v_caller is null then
    return;
  end if;
  if v_caller = _user_id or public.is_admin_user(v_caller) then
    return query select u.id, u.email from auth.users u where u.id = _user_id limit 1;
  else
    return;
  end if;
end;
$$;
grant execute on function public.get_user_private_info(uuid) to authenticated;
create or replace function public.get_server_now()
returns timestamptz
language sql
stable
set search_path = public
as $$ select now(); $$;

create or replace function public.reseed_watering_schedule(_garden_plant_id uuid, _days_ahead integer default 60)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gp record;
  v_def record;
  d date := (now() at time zone 'utc')::date;
  end_day date := ((now() at time zone 'utc')::date + make_interval(days => greatest(1, coalesce(_days_ahead, 60))))::date;
  weekday int;
  ymd text;
  week_index int;
begin
  delete from public.garden_watering_schedule where garden_plant_id = _garden_plant_id and due_date >= d;

  select gp.id, gp.override_water_freq_unit, gp.override_water_freq_value into v_gp
  from public.garden_plants gp where gp.id = _garden_plant_id;

  select gps.period, gps.amount, gps.weekly_days, gps.monthly_days, gps.yearly_days, gps.monthly_nth_weekdays
  into v_def
  from public.garden_plant_schedule gps where gps.garden_plant_id = _garden_plant_id;

  while d <= end_day loop
    weekday := extract(dow from d);
    ymd := to_char(d, 'MM-DD');
    week_index := floor((extract(day from d) - 1) / 7) + 1;

    if v_def is not null then
      if v_def.period = 'week' then
        if v_def.weekly_days is not null and weekday = any(v_def.weekly_days) then
          insert into public.garden_watering_schedule (garden_plant_id, due_date) values (_garden_plant_id, d);
        end if;
      elsif v_def.period = 'month' then
        if v_def.monthly_days is not null and (extract(day from d))::int = any(v_def.monthly_days) then
          insert into public.garden_watering_schedule (garden_plant_id, due_date) values (_garden_plant_id, d);
        elsif v_def.monthly_nth_weekdays is not null then
          if (week_index >= 1 and week_index <= 4) then
            if (week_index::text || '-' || weekday::text) = any(v_def.monthly_nth_weekdays) then
              insert into public.garden_watering_schedule (garden_plant_id, due_date) values (_garden_plant_id, d);
            end if;
          end if;
        end if;
      elsif v_def.period = 'year' then
        if v_def.yearly_days is not null and ymd = any(v_def.yearly_days) then
          insert into public.garden_watering_schedule (garden_plant_id, due_date) values (_garden_plant_id, d);
        end if;
      end if;
    elsif v_gp.override_water_freq_unit is not null and v_gp.override_water_freq_value is not null then
      if v_gp.override_water_freq_unit = 'day' then
        if ((d - (now() at time zone 'utc')::date) % greatest(1, v_gp.override_water_freq_value)) = 0 then
          insert into public.garden_watering_schedule (garden_plant_id, due_date) values (_garden_plant_id, d);
        end if;
      elsif v_gp.override_water_freq_unit = 'week' then
        if weekday = extract(dow from (now() at time zone 'utc')::date) then
          if (floor(extract(epoch from (d - (now() at time zone 'utc')::date)) / (7*24*3600)))::int % greatest(1, v_gp.override_water_freq_value) = 0 then
            insert into public.garden_watering_schedule (garden_plant_id, due_date) values (_garden_plant_id, d);
          end if;
        end if;
      elsif v_gp.override_water_freq_unit = 'month' then
        if extract(day from d) = extract(day from (now() at time zone 'utc')::date) then
          insert into public.garden_watering_schedule (garden_plant_id, due_date) values (_garden_plant_id, d);
        end if;
      elsif v_gp.override_water_freq_unit = 'year' then
        if to_char(d, 'MM-DD') = to_char((now() at time zone 'utc')::date, 'MM-DD') then
          insert into public.garden_watering_schedule (garden_plant_id, due_date) values (_garden_plant_id, d);
        end if;
      end if;
    end if;

    d := d + 1;
  end loop;
end;
$$;

create or replace function public.mark_garden_plant_watered(_garden_plant_id uuid, _at timestamptz default now())
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := (_at at time zone 'utc')::date;
  v_id uuid;
begin
  select id into v_id from public.garden_watering_schedule where garden_plant_id = _garden_plant_id and due_date = v_day limit 1;
  if v_id is null then
    insert into public.garden_watering_schedule (garden_plant_id, due_date, completed_at)
    values (_garden_plant_id, v_day, _at);
  else
    update public.garden_watering_schedule set completed_at = _at where id = v_id;
  end if;
end;
$$;

create or replace function public.touch_garden_task(_garden_id uuid, _day date, _plant_id uuid default null, _set_success boolean default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_yesterday date := ((now() at time zone 'utc')::date - interval '1 day')::date;
begin
  select id into v_id
  from public.garden_tasks
  where garden_id = _garden_id and day = _day and task_type = 'watering';

  if v_id is null then
    insert into public.garden_tasks (garden_id, day, task_type, garden_plant_ids, success)
    values (_garden_id, _day, 'watering', coalesce(array[_plant_id], '{}'::uuid[]), coalesce(_set_success, _plant_id is null));
  else
    if _plant_id is not null then
      update public.garden_tasks
        set garden_plant_ids = (case when not _plant_id = any(garden_plant_ids) then array_append(garden_plant_ids, _plant_id) else garden_plant_ids end),
            success = coalesce(_set_success, success)
      where id = v_id;
    else
      update public.garden_tasks
        set success = coalesce(_set_success, success)
      where id = v_id;
    end if;
  end if;

  -- After any change to day's record, refresh base streak up to yesterday
  perform public.update_garden_streak(_garden_id, v_yesterday);
end;
$$;
drop function if exists public.compute_daily_tasks_for_all_gardens(date);
drop function if exists public.compute_garden_task_for_day(uuid, date);
create or replace function public.compute_garden_task_for_day(_garden_id uuid, _day date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  task_ids uuid[];
  due_count int := 0;
  done_count int := 0;
begin
  select array_agg(t.id) into task_ids from public.garden_plant_tasks t where t.garden_id = _garden_id;
  if task_ids is null or array_length(task_ids,1) is null then
    perform public.touch_garden_task(_garden_id, _day, null, true);
    return;
  end if;
  select coalesce(sum(gpto.required_count), 0) into due_count
  from public.garden_plant_task_occurrences gpto
  where gpto.task_id = any(task_ids)
    and (gpto.due_at at time zone 'utc')::date = _day;

  select coalesce(sum(least(gpto.required_count, gpto.completed_count)), 0) into done_count
  from public.garden_plant_task_occurrences gpto
  where gpto.task_id = any(task_ids)
    and (gpto.due_at at time zone 'utc')::date = _day;

  perform public.touch_garden_task(_garden_id, _day, null, (due_count = 0) or (done_count >= due_count));
end;
$$;

create or replace function public.ensure_daily_tasks_for_gardens(_day date default now()::date)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.garden_tasks (garden_id, day, task_type, garden_plant_ids, success)
  select g.id, _day, 'watering', '{}'::uuid[], true
  from public.gardens g
  on conflict (garden_id, day, task_type) do nothing;
  update public.garden_tasks
    set success = true
  where day = _day and task_type = 'watering' and coalesce(array_length(garden_plant_ids, 1), 0) = 0;
$$;

create or replace function public.get_user_id_by_email(_email text)
returns uuid
language sql
security definer
set search_path = public
as $$ select id from auth.users where email ilike _email limit 1; $$;

-- Suggest users by email prefix (security definer to bypass RLS on auth schema)
create or replace function public.suggest_users_by_email_prefix(_prefix text, _limit int default 5)
returns table(id uuid, email text, created_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select u.id, u.email, u.created_at
  from auth.users u
  where u.email ilike _prefix || '%'
  order by u.created_at desc
  limit greatest(1, coalesce(_limit, 5));
$$;

-- Suggest users by display_name prefix (username), joining to auth.users for ordering/metadata
create or replace function public.suggest_users_by_display_name_prefix(_prefix text, _limit int default 5)
returns table(id uuid, display_name text, created_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select u.id, p.display_name, u.created_at
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.display_name ilike _prefix || '%'
  order by u.created_at desc
  limit greatest(1, coalesce(_limit, 5));
$$;

create or replace function public.get_recent_members(
  _limit int default 20,
  _offset int default 0,
  _sort text default 'newest'
)
returns table(
  id uuid,
  email text,
  display_name text,
  created_at timestamptz,
  is_admin boolean,
  rpm5m numeric
)
language sql
security definer
set search_path = public
as $$
  with base as (
    select
      u.id,
      u.email,
      p.display_name,
      u.created_at,
      coalesce(p.is_admin, false) as is_admin,
      coalesce(rpm.c, 0)::numeric / 5 as rpm5m
    from auth.users u
    left join public.profiles p on p.id = u.id
    left join lateral (
      select count(*)::int as c
      from public.web_visits v
      where v.user_id = u.id
        and v.occurred_at >= now() - interval '5 minutes'
    ) rpm on true
  )
  select *
  from base
  order by
    case when coalesce(lower(_sort), 'newest') = 'oldest' then created_at end asc,
    case when coalesce(lower(_sort), 'newest') = 'rpm' then rpm5m end desc nulls last,
    created_at desc
  limit greatest(1, coalesce(_limit, 20))
  offset greatest(0, coalesce(_offset, 0));
$$;

grant execute on function public.get_recent_members(int, int, text) to anon, authenticated;

-- Count helpers for Admin API fallbacks via Supabase REST RPC
create or replace function public.count_profiles_total()
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::int from public.profiles;
$$;

create or replace function public.count_auth_users_total()
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::int from auth.users;
$$;

-- Drop and recreate to allow return type changes
drop function if exists public.get_profiles_for_garden(uuid) cascade;
create function public.get_profiles_for_garden(_garden_id uuid)
returns table(user_id uuid, display_name text, email text, accent_key text, avatar_url text)
language sql
security definer
set search_path = public
as $$
  select p.id as user_id, p.display_name, u.email, p.accent_key, p.avatar_url
  from public.garden_members gm
  join public.profiles p on p.id = gm.user_id
  join auth.users u on u.id = gm.user_id
  where gm.garden_id = _garden_id;
$$;

create or replace function public.ensure_instance_inventory_for_garden(_garden_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.garden_instance_inventory (garden_id, garden_plant_id, seeds_on_hand, plants_on_hand)
  select gp.garden_id, gp.id, 0, 0
  from public.garden_plants gp
  where gp.garden_id = _garden_id
    and not exists (select 1 from public.garden_instance_inventory gii where gii.garden_plant_id = gp.id);
$$;

-- Set species-level inventory counts (idempotent upsert)
create or replace function public.set_inventory_counts(
  _garden_id uuid,
  _plant_id text,
  _seeds_on_hand integer default null,
  _plants_on_hand integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.garden_inventory (garden_id, plant_id, seeds_on_hand, plants_on_hand)
  values (
    _garden_id,
    _plant_id,
    greatest(0, coalesce(_seeds_on_hand, 0)),
    greatest(0, coalesce(_plants_on_hand, 0))
  )
  on conflict (garden_id, plant_id) do update
    set seeds_on_hand = coalesce(excluded.seeds_on_hand, public.garden_inventory.seeds_on_hand),
        plants_on_hand = coalesce(excluded.plants_on_hand, public.garden_inventory.plants_on_hand);
end;
$$;

-- Set per-instance inventory counts (idempotent upsert)
create or replace function public.set_instance_inventory_counts(
  _garden_id uuid,
  _garden_plant_id uuid,
  _seeds_on_hand integer default null,
  _plants_on_hand integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.garden_instance_inventory (garden_id, garden_plant_id, seeds_on_hand, plants_on_hand)
  values (
    _garden_id,
    _garden_plant_id,
    greatest(0, coalesce(_seeds_on_hand, 0)),
    greatest(0, coalesce(_plants_on_hand, 0))
  )
  on conflict (garden_plant_id) do update
    set seeds_on_hand = coalesce(excluded.seeds_on_hand, public.garden_instance_inventory.seeds_on_hand),
        plants_on_hand = coalesce(excluded.plants_on_hand, public.garden_instance_inventory.plants_on_hand);
end;
$$;

create or replace function public.create_default_watering_task(_garden_id uuid, _garden_plant_id uuid, _unit text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  insert into public.garden_plant_tasks (garden_id, garden_plant_id, type, schedule_kind, interval_amount, interval_unit, required_count)
  values (_garden_id, _garden_plant_id, 'water', 'repeat_duration', 1, _unit, 2)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.upsert_one_time_task(
  _garden_id uuid, _garden_plant_id uuid, _type text, _custom_name text,
  _kind text, _due_at timestamptz, _amount integer, _unit text, _required integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  insert into public.garden_plant_tasks (
    garden_id, garden_plant_id, type, custom_name, schedule_kind, due_at, interval_amount, interval_unit, required_count
  ) values (
    _garden_id, _garden_plant_id, _type, nullif(_custom_name,''), _kind,
    _due_at,
    case when _kind = 'one_time_duration' then _amount else null end,
    case when _kind = 'one_time_duration' then _unit else null end,
    greatest(1, coalesce(_required,1))
  ) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.progress_task_occurrence(_occurrence_id uuid, _increment integer default 1)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_occ record;
  v_day date;
  v_yesterday date := ((now() at time zone 'utc')::date - interval '1 day')::date;
  v_actor uuid := (select auth.uid());
begin
  -- Update the occurrence progress and completion timestamp when reaching required count
  update public.garden_plant_task_occurrences
    set completed_count = least(required_count, completed_count + greatest(1, _increment)),
        completed_at = case when completed_count + greatest(1, _increment) >= required_count then now() else completed_at end
  where id = _occurrence_id;

  -- Attribute progress to the current user
  begin
    if v_actor is not null then
      insert into public.garden_task_user_completions (occurrence_id, user_id, increment)
      values (_occurrence_id, v_actor, greatest(1, _increment));
    end if;
  exception when others then
    -- ignore attribution errors to not block core progress
    null;
  end;

  -- Resolve garden and day for this occurrence to recompute day success and streak
  select o.id,
         o.due_at,
         t.garden_id
  into v_occ
  from public.garden_plant_task_occurrences o
  join public.garden_plant_tasks t on t.id = o.task_id
  where o.id = _occurrence_id
  limit 1;

  if v_occ is null then
    return;
  end if;

  v_day := (v_occ.due_at at time zone 'utc')::date;

  -- Recompute the aggregated garden_tasks success for that day based on all occurrences
  perform public.compute_garden_task_for_day(v_occ.garden_id, v_day);

  -- Refresh the base streak up to yesterday so UI can add today's preview if successful
  perform public.update_garden_streak(v_occ.garden_id, v_yesterday);
end;
$$;

-- Streak helpers (used by server jobs or manual runs)
create or replace function public.compute_garden_streak(_garden_id uuid, _anchor_day date)
returns integer
language plpgsql
set search_path = public
as $$
declare d date := _anchor_day; s integer := 0; t record; begin
  loop
    select g.day, g.success into t from public.garden_tasks g where g.garden_id = _garden_id and g.day = d and g.task_type = 'watering' limit 1;
    if t is null then exit; end if;
    if not coalesce(t.success, false) then exit; end if;
    s := s + 1; d := (d - interval '1 day')::date;
  end loop;
  return s;
end; $$;

create or replace function public.update_garden_streak(_garden_id uuid, _anchor_day date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare s integer; begin
  s := public.compute_garden_streak(_garden_id, _anchor_day);
  update public.gardens set streak = s where id = _garden_id;
end; $$;

create or replace function public.compute_daily_tasks_for_all_gardens(_day date)
returns void
language plpgsql
set search_path = public
as $$
declare 
  g record; 
  anchor date := (_day - interval '1 day')::date;
  yesterday date := (_day - interval '1 day')::date;
begin
  -- CRITICAL: First, ensure task occurrences exist for YESTERDAY (for accurate streak calculation)
  -- This catches gardens where users didn't log in yesterday - their tasks still need to be created
  -- so we can accurately determine if they missed any tasks and should lose their streak
  perform public.ensure_all_gardens_tasks_occurrences_for_day(yesterday);
  
  -- Also ensure task occurrences exist for TODAY (so streak calculation tomorrow will be accurate)
  perform public.ensure_all_gardens_tasks_occurrences_for_day(_day);
  
  -- Now process each garden: update streak based on yesterday, compute today's task status
  for g in select id from public.gardens loop
    -- Recompute yesterday's success based on now-existing occurrences
    perform public.compute_garden_task_for_day(g.id, yesterday);
    -- Update streak using yesterday as anchor (checks consecutive successful days ending yesterday)
    perform public.update_garden_streak(g.id, anchor);
    -- Compute today's task status (will show 0/X until user completes tasks)
    perform public.compute_garden_task_for_day(g.id, _day);
  end loop;
end; $$;

