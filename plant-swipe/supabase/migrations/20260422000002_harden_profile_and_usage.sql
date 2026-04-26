-- Harden public.profiles against client tampering of sensitive fields, and
-- explicitly revoke write privileges on the usage-monitoring tables so a
-- malicious client cannot delete or rewrite their tokens.
--
-- The previous trigger only protected `is_admin` and the 'admin' role. Extend
-- it to cover every column that a user must not be able to flip themselves:
--
--   * is_admin           - already covered, unchanged
--   * roles              - any change is admin-only (no client code writes it)
--   * threat_level       - non-admins may only INCREASE (self-ban from legal
--                          decline is allowed; lowering a shadow ban is not)
--   * bug_points         - awarded server-side, must not be self-mutated
--   * shadow_ban_backup  - moderation internal, server/admin only
--   * last_active_at     - heartbeat written by the server only
--
-- Service-role/server connections (auth.uid() is null) and existing admins
-- continue to bypass the trigger so admin endpoints still work.

create or replace function public.prevent_self_admin_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  old_has_admin_role boolean;
  new_has_admin_role boolean;
begin
  if caller is null then
    return new;
  end if;
  if public.is_admin_user(caller) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if coalesce(new.is_admin, false) is distinct from false then
      raise exception 'Only admins can set is_admin' using errcode = '42501';
    end if;
    if 'admin' = any(coalesce(new.roles, '{}')) then
      raise exception 'Only admins can grant the admin role' using errcode = '42501';
    end if;
    -- INSERT during signup: enforce that protected counters/state start at
    -- their defaults. We compare against the column defaults so a user
    -- cannot pre-seed bug_points or a fake shadow_ban_backup at signup.
    if coalesce(new.bug_points, 0) <> 0 then
      raise exception 'Only the server can set bug_points' using errcode = '42501';
    end if;
    if coalesce(new.threat_level, 0) <> 0 then
      raise exception 'Only the server can set threat_level on insert' using errcode = '42501';
    end if;
    if new.shadow_ban_backup is not null then
      raise exception 'Only admins can set shadow_ban_backup' using errcode = '42501';
    end if;
    if new.last_active_at is not null then
      raise exception 'Only the server can set last_active_at' using errcode = '42501';
    end if;
    return new;
  end if;

  -- UPDATE branch
  if new.is_admin is distinct from old.is_admin then
    raise exception 'Only admins can modify is_admin' using errcode = '42501';
  end if;

  old_has_admin_role := 'admin' = any(coalesce(old.roles, '{}'));
  new_has_admin_role := 'admin' = any(coalesce(new.roles, '{}'));
  if new_has_admin_role and not old_has_admin_role then
    raise exception 'Only admins can grant the admin role' using errcode = '42501';
  end if;
  -- Lock the entire roles array. No client-side flow writes roles today; any
  -- change must come from the server (service role) or an admin.
  if coalesce(new.roles, '{}') is distinct from coalesce(old.roles, '{}') then
    raise exception 'Only admins can modify roles' using errcode = '42501';
  end if;

  -- threat_level may only increase. The legal-decline flow self-bans by
  -- setting it to 3; we must not let a banned user set it back to 0.
  if coalesce(new.threat_level, 0) < coalesce(old.threat_level, 0) then
    raise exception 'Only admins can lower threat_level' using errcode = '42501';
  end if;

  if coalesce(new.bug_points, 0) is distinct from coalesce(old.bug_points, 0) then
    raise exception 'Only admins can modify bug_points' using errcode = '42501';
  end if;

  if new.shadow_ban_backup is distinct from old.shadow_ban_backup then
    raise exception 'Only admins can modify shadow_ban_backup' using errcode = '42501';
  end if;

  if new.last_active_at is distinct from old.last_active_at then
    raise exception 'Only the server can update last_active_at' using errcode = '42501';
  end if;

  return new;
end;
$$;

-- The trigger from the previous migration already binds this function; no
-- need to redefine it. CREATE OR REPLACE on the function above is enough.

-- ========== Lock down usage-monitoring tables ==========
-- RLS already blocks all writes (no INSERT/UPDATE/DELETE policies exist), but
-- revoke the privileges as well so even with a misconfigured policy a client
-- cannot tamper with their own usage rows or wipe them to dodge limits.
revoke insert, update, delete on public.ai_usage_events from authenticated;
revoke insert, update, delete on public.ai_usage_events from anon;
revoke insert, update, delete on public.scan_usage_events from authenticated;
revoke insert, update, delete on public.scan_usage_events from anon;
