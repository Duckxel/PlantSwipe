-- ============================================================================
-- Migrate legacy plants.admin_commentary free-text into the new
-- public.plant_admin_notes thread.
--
-- Rules (per product request):
--   • One note per newline-separated chunk of the existing commentary.
--   • Blank chunks skipped.
--   • author_id = Xavier Sabar's profile id (hardcoded below).
--   • created_at / updated_at = migration run time (now()).
--   • The plant_admin_notes / plant_history tables do NOT store a snapshot
--     display name — the UI resolves names from profiles at read time.
--
-- Idempotent: per-plant we skip if a Xavier-authored note already exists for
-- that plant (prevents duplicating on re-run).
-- ============================================================================

do $$
declare
  v_xavier_id constant uuid := '007f393d-7627-4e2d-929a-97584ecf74fc';
  r record;
  raw_line text;
  trimmed_line text;
  inserted integer := 0;
  plants_touched integer := 0;
begin
  if not exists (select 1 from public.profiles where id = v_xavier_id) then
    raise warning '[migrate_admin_commentary] Xavier profile % not found; aborting.', v_xavier_id;
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
        (plant_id, author_id, body, created_at, updated_at)
      values
        (r.plant_id, v_xavier_id, trimmed_line, now(), now());
      inserted := inserted + 1;
    end loop;
  end loop;

  raise notice '[migrate_admin_commentary] Xavier id=%, plants_migrated=%, notes_inserted=%',
    v_xavier_id, plants_touched, inserted;
end
$$;
