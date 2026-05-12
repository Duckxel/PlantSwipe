-- Prevent non-admin users from granting themselves admin privileges.
--
-- HISTORY NOTE: This file was originally named
--   20260422000000_prevent_self_admin_escalation.sql
-- which collided with 20260422000000_migrate_admin_commentary_to_notes.sql.
-- Supabase tracks applied migrations by their timestamp prefix, so the second
-- file with the same version was silently skipped on `supabase db push`.
-- Renamed to 20260422000003 on 2026-05-12. On linked environments where the
-- original 20260422000000 version is already registered as applied for THIS
-- file's body, run:
--     supabase migration repair --status applied 20260422000003
-- so the new version is recognized as already applied and not re-run.
-- The body below is fully idempotent (create or replace function /
-- drop trigger if exists), so a re-run on environments where the original
-- timestamp was skipped is safe.
--
-- The RLS policy `profiles_update_self` permits authenticated users to update
-- any column on their own row, including `is_admin` and `roles`. That means a
-- malicious user could bypass the UI and call the Supabase client directly to
-- flip `is_admin = true` or push 'admin' into `roles`. RLS in Postgres is
-- row-based, not column-based, so we enforce column protection via a trigger.
--
-- The trigger allows the change only when:
--   * the caller is already an admin (is_admin_user(auth.uid()) returns true), or
--   * auth.uid() is null, which is the case for service_role / server-side
--     connections that do not carry an end-user JWT. Our admin promote/demote
--     endpoints in server.js run with the service role and must keep working.

create or replace function public.prevent_self_admin_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  caller_is_admin boolean := false;
  old_has_admin_role boolean;
  new_has_admin_role boolean;
begin
  -- Service role / server-side calls have no JWT and auth.uid() is null.
  if caller is null then
    return new;
  end if;

  caller_is_admin := public.is_admin_user(caller);
  if caller_is_admin then
    return new;
  end if;

  -- is_admin column must not change for non-admin callers.
  if tg_op = 'INSERT' then
    if coalesce(new.is_admin, false) is distinct from false then
      raise exception 'Only admins can set is_admin'
        using errcode = '42501';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.is_admin is distinct from old.is_admin then
      raise exception 'Only admins can modify is_admin'
        using errcode = '42501';
    end if;
  end if;

  -- 'admin' role in the roles array is treated the same as is_admin.
  old_has_admin_role := case
    when tg_op = 'UPDATE' then 'admin' = any(coalesce(old.roles, '{}'))
    else false
  end;
  new_has_admin_role := 'admin' = any(coalesce(new.roles, '{}'));

  if new_has_admin_role and not old_has_admin_role then
    raise exception 'Only admins can grant the admin role'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_prevent_self_admin_escalation on public.profiles;
create trigger profiles_prevent_self_admin_escalation
  before insert or update on public.profiles
  for each row
  execute function public.prevent_self_admin_escalation();
