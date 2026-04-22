-- ============================================================================
-- Backfill public.plant_contributors.contributor_id by matching the existing
-- contributor_name (free text) against profiles.display_name case-insensitively.
--
-- Rows whose name doesn't match any profile are left alone — they keep the
-- legacy contributor_name and render as "Unknown" avatars on the UI.
--
-- Idempotent: only touches rows where contributor_id is still null.
-- ============================================================================

do $$
declare
  updated integer := 0;
  collisions integer := 0;
begin
  with candidates as (
    select pc.id as row_id,
           pc.plant_id,
           pc.contributor_name,
           (
             select p.id
               from public.profiles p
              where lower(p.display_name) = lower(btrim(pc.contributor_name))
              limit 1
           ) as matched_id
      from public.plant_contributors pc
     where pc.contributor_id is null
       and pc.contributor_name is not null
       and length(btrim(pc.contributor_name)) > 0
  ),
  resolved as (
    select row_id, plant_id, matched_id
      from candidates
     where matched_id is not null
  ),
  -- A plant could already have a row for the matched profile (e.g. the admin
  -- was added by id earlier). Drop would-be duplicates before updating.
  to_delete as (
    select r.row_id
      from resolved r
      join public.plant_contributors existing
        on existing.plant_id = r.plant_id
       and existing.contributor_id = r.matched_id
       and existing.id <> r.row_id
  ),
  deleted as (
    delete from public.plant_contributors pc
     using to_delete d
     where pc.id = d.row_id
    returning 1
  ),
  upd as (
    update public.plant_contributors pc
       set contributor_id = r.matched_id
      from resolved r
     where pc.id = r.row_id
       and pc.id not in (select row_id from to_delete)
    returning 1
  )
  select
    (select count(*) from upd),
    (select count(*) from deleted)
    into updated, collisions;

  raise notice '[backfill_plant_contributor_ids] updated=%, duplicates_removed=%', updated, collisions;
end
$$;
