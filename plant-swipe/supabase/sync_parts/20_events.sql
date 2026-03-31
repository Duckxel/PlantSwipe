-- ============================================================
-- 20 · Events system (egg hunts, seasonal events, etc.)
-- ============================================================
--
-- NAMING CONVENTION:
--   PERMANENT tables (kept forever):
--     • events              — event definitions
--     • event_registrations — users who completed/participated in an event
--
--   TEMPORARY tables (cleared after event ends, prefixed with event_{id} concept):
--     • event_items         — collectible items (eggs, tokens, etc.)
--     • event_user_progress — per-user tracking of found items
--
--   To clean up after an event:
--     SELECT cleanup_event('<event_id>');
--   This deletes all rows from TEMPORARY tables for that event
--   while preserving the event definition and registration records.
--
-- ============================================================

-- ── 1. PERMANENT: events ─────────────────────────────────────
-- Stores the event catalog. Never deleted.
CREATE TABLE IF NOT EXISTS events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  description   text,
  event_type    text NOT NULL DEFAULT 'egg_hunt',  -- 'egg_hunt', 'scavenger_hunt', etc.
  badge_id      uuid REFERENCES badges(id) ON DELETE SET NULL, -- badge awarded on completion (null = no badge)
  starts_at     timestamptz,
  ends_at       timestamptz,
  is_active     boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "events_select_all" ON events;
CREATE POLICY "events_select_all" ON events
  FOR SELECT USING (true);

-- ── 2. PERMANENT: event_registrations ─────────────────────────
-- Records users who completed or participated in an event. Never deleted.
CREATE TABLE IF NOT EXISTS event_registrations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completed_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_registrations_event ON event_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_user  ON event_registrations(user_id);

ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_registrations_select_own" ON event_registrations;
CREATE POLICY "event_registrations_select_own" ON event_registrations
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "event_registrations_insert_own" ON event_registrations;
CREATE POLICY "event_registrations_insert_own" ON event_registrations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── 3. TEMPORARY: event_items ─────────────────────────────────
-- Collectible items for an event (eggs, tokens, clues, etc.).
-- Deleted when the event is cleaned up.
CREATE TABLE IF NOT EXISTS event_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  page_path     text NOT NULL,            -- e.g. '/about', '/search'
  description   text NOT NULL DEFAULT '', -- fun fact / clue shown on discovery
  position_seed int NOT NULL DEFAULT 0,   -- deterministic placement on page
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_items_event ON event_items(event_id);

ALTER TABLE event_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_items_select_all" ON event_items;
CREATE POLICY "event_items_select_all" ON event_items
  FOR SELECT USING (true);

-- ── 3b. TEMPORARY: event_item_translations ───────────────────
-- Multilingual descriptions for event items.
-- Deleted when the event is cleaned up (CASCADE from event_items).
CREATE TABLE IF NOT EXISTS event_item_translations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id       uuid NOT NULL REFERENCES event_items(id) ON DELETE CASCADE,
  language      text NOT NULL,
  description   text NOT NULL DEFAULT '',
  UNIQUE(item_id, language)
);

CREATE INDEX IF NOT EXISTS idx_event_item_translations_item ON event_item_translations(item_id);

ALTER TABLE event_item_translations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_item_translations_select_all" ON event_item_translations;
CREATE POLICY "event_item_translations_select_all" ON event_item_translations
  FOR SELECT USING (true);

-- ── 3c. PERMANENT: event_translations ────────────────────────
-- Multilingual name & description for events themselves.
CREATE TABLE IF NOT EXISTS event_translations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  language      text NOT NULL,
  name          text NOT NULL DEFAULT '',
  description   text NOT NULL DEFAULT '',
  UNIQUE(event_id, language)
);

CREATE INDEX IF NOT EXISTS idx_event_translations_event ON event_translations(event_id);

ALTER TABLE event_translations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_translations_select_all" ON event_translations;
CREATE POLICY "event_translations_select_all" ON event_translations
  FOR SELECT USING (true);

-- ── 4. TEMPORARY: event_user_progress ─────────────────────────
-- Tracks which user found which item. Deleted when the event is cleaned up.
CREATE TABLE IF NOT EXISTS event_user_progress (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  item_id       uuid NOT NULL REFERENCES event_items(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  found_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(item_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_user_progress_user ON event_user_progress(user_id, event_id);

ALTER TABLE event_user_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_user_progress_select_own" ON event_user_progress;
CREATE POLICY "event_user_progress_select_own" ON event_user_progress
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "event_user_progress_insert_own" ON event_user_progress;
CREATE POLICY "event_user_progress_insert_own" ON event_user_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── 5. CLEANUP FUNCTION ──────────────────────────────────────
-- Removes all TEMPORARY data for a given event.
-- Preserves: events row, event_registrations rows.
-- Usage: SELECT cleanup_event('<event-uuid>');
CREATE OR REPLACE FUNCTION cleanup_event(target_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Delete user progress (must go first due to FK on event_items)
  DELETE FROM event_user_progress WHERE event_id = target_event_id;

  -- 2. Delete event items
  DELETE FROM event_items WHERE event_id = target_event_id;

  -- 3. Deactivate the event
  UPDATE events SET is_active = false, updated_at = now() WHERE id = target_event_id;
END;
$$;

-- ── 6. FULL EVENT DELETION (optional) ────────────────────────
-- Removes EVERYTHING including permanent records for an event.
-- Usage: SELECT delete_event_completely('<event-uuid>');
CREATE OR REPLACE FUNCTION delete_event_completely(target_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- CASCADE on the FK handles event_items, event_user_progress, event_registrations
  DELETE FROM events WHERE id = target_event_id;
END;
$$;
