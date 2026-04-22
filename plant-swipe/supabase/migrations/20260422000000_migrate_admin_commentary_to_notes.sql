-- ============================================================================
-- Migrate legacy plants.admin_commentary free-text into the new
-- public.plant_admin_notes thread.
--
-- Rules (per product request):
--   • One note per newline-separated chunk of the existing commentary.
--   • Blank chunks skipped.
--   • author_id  = Xavier Sabar's profile id (looked up by display_name).
--   • author_name = 'Xavier Sabar' (snapshot).
--   • created_at / updated_at = migration run time (now()).
--
-- Idempotent: per-plant we skip if a Xavier-authored note already exists for
-- that plant (prevents duplicating on re-run). Plants whose commentary has
-- changed since the last run will still be migrated only if no Xavier note
-- exists for that plant yet.
-- ============================================================================

do $$
declare
  v_xavier_id uuid;
  r record;
  raw_line text;
  trimmed_line text;
  inserted integer := 0;
  plants_touched integer := 0;
begin
  select p.id
    into v_xavier_id
    from public.profiles p
    where lower(p.display_name) = lower('Xavier Sabar')
    limit 1;

  if v_xavier_id is null then
    raise warning '[migrate_admin_commentary] Xavier Sabar profile not found; aborting migration.';
    return;
  end if;

  for r in
    select p.id as plant_id, p.admin_commentary as body
      from public.plants p
     where p.admin_commentary is not null
       and length(btrim(p.admin_commentary)) > 0
       and not exists (
         select 1
           from public.plant_admin_notes n
          where n.plant_id = p.id
            and n.author_id = v_xavier_id
       )
  loop
    plants_touched := plants_touched + 1;
    foreach raw_line in array regexp_split_to_array(coalesce(r.body, ''), E'\r?\n')
    loop
      trimmed_line := btrim(raw_line);
      if length(trimmed_line) = 0 then
        continue;
      end if;
      insert into public.plant_admin_notes
        (plant_id, author_id, author_name, body, created_at, updated_at)
      values
        (r.plant_id, v_xavier_id, 'Xavier Sabar', trimmed_line, now(), now());
      inserted := inserted + 1;
    end loop;
  end loop;

  raise notice '[migrate_admin_commentary] Xavier id=%, plants_migrated=%, notes_inserted=%',
    v_xavier_id, plants_touched, inserted;
end
$$;
