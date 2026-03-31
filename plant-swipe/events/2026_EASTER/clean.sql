-- ═══════════════════════════════════════════════════════════════
-- Easter Egg Hunt 2026 — Cleanup
-- ═══════════════════════════════════════════════════════════════
--
-- Removes all TEMPORARY event data (items, progress, translations).
-- KEEPS: event row, event_registrations, badge, user_badges.
--
-- Safe to run multiple times.
--
-- Usage:
--   psql -f events/2026_EASTER/clean.sql
--   OR paste into Supabase SQL Editor
--   OR use Admin > Events > Cleanup button
--
-- ═══════════════════════════════════════════════════════════════

DO $$
DECLARE
  eid uuid := (SELECT id FROM events WHERE name = 'Easter Egg Hunt 2026');
BEGIN
  IF eid IS NULL THEN
    RAISE NOTICE 'Event "Easter Egg Hunt 2026" not found — nothing to clean.';
    RETURN;
  END IF;

  -- 1. Delete user progress (must go first due to FK on event_items)
  DELETE FROM event_user_progress WHERE event_id = eid;
  RAISE NOTICE 'Deleted user progress';

  -- 2. Delete item translations (cascades from event_items, but be explicit)
  DELETE FROM event_item_translations
  WHERE item_id IN (SELECT id FROM event_items WHERE event_id = eid);
  RAISE NOTICE 'Deleted item translations';

  -- 3. Delete event items
  DELETE FROM event_items WHERE event_id = eid;
  RAISE NOTICE 'Deleted event items';

  -- 4. Delete event translations
  DELETE FROM event_translations WHERE event_id = eid;
  RAISE NOTICE 'Deleted event translations';

  -- 5. Deactivate the event
  UPDATE events SET is_active = false, admin_only = false, updated_at = now() WHERE id = eid;
  RAISE NOTICE 'Event deactivated';

  RAISE NOTICE '✓ Easter Egg Hunt 2026 cleaned up. Event row and registrations preserved.';
END $$;

-- ─── Verify ──────────────────────────────────────────────────

SELECT
  e.name,
  e.is_active,
  (SELECT count(*) FROM event_items WHERE event_id = e.id) AS remaining_items,
  (SELECT count(*) FROM event_user_progress WHERE event_id = e.id) AS remaining_progress,
  (SELECT count(*) FROM event_registrations WHERE event_id = e.id) AS completions_preserved
FROM events e
WHERE e.name = 'Easter Egg Hunt 2026';
