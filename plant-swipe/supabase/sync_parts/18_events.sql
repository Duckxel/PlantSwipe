-- ============================================================
-- 18 · Events system (egg hunts, seasonal events, etc.)
-- ============================================================
-- Design notes:
--   • `events` stores reusable event metadata (name, description, dates).
--   • `event_eggs` stores the individual collectibles per event (page, description).
--   • `event_user_eggs` tracks which user found which egg (the "clearable" data).
--   • `event_completions` permanently records users who completed an event.
--   • Cleanup: DELETE FROM event_user_eggs WHERE event_id = '…'; DELETE FROM event_eggs WHERE event_id = '…';
--     This preserves the event row and all completion records.

-- 1. Events table --------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  description   text,
  starts_at     timestamptz,
  ends_at       timestamptz,
  is_active     boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Everyone can read active events
CREATE POLICY "events_select_all" ON events
  FOR SELECT USING (true);

-- 2. Event eggs (collectible items per event) -----------------------------
CREATE TABLE IF NOT EXISTS event_eggs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  page_path     text NOT NULL,          -- e.g. '/about'
  description   text NOT NULL DEFAULT '',-- fun fact shown on discovery
  position_seed int NOT NULL DEFAULT 0, -- deterministic random placement
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_eggs_event ON event_eggs(event_id);

ALTER TABLE event_eggs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_eggs_select_all" ON event_eggs
  FOR SELECT USING (true);

-- 3. User egg discoveries (clearable per-event) ---------------------------
CREATE TABLE IF NOT EXISTS event_user_eggs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  egg_id        uuid NOT NULL REFERENCES event_eggs(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  found_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(egg_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_user_eggs_user ON event_user_eggs(user_id, event_id);

ALTER TABLE event_user_eggs ENABLE ROW LEVEL SECURITY;

-- Users can read their own discoveries
CREATE POLICY "event_user_eggs_select_own" ON event_user_eggs
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own discoveries
CREATE POLICY "event_user_eggs_insert_own" ON event_user_eggs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 4. Event completions (permanent record) ---------------------------------
CREATE TABLE IF NOT EXISTS event_completions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completed_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_completions_event ON event_completions(event_id);

ALTER TABLE event_completions ENABLE ROW LEVEL SECURITY;

-- Users can read their own completions
CREATE POLICY "event_completions_select_own" ON event_completions
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own completion
CREATE POLICY "event_completions_insert_own" ON event_completions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
