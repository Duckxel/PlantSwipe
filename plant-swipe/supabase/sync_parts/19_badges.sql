-- ============================================================
-- 19 · Badges & achievements system
-- ============================================================
--
-- TABLES:
--   • badges       — badge catalog (name, description, icon, category)
--   • user_badges  — which user earned which badge and when
--
-- Badges can be awarded:
--   • Automatically on event completion (events.badge_id FK)
--   • Manually via admin / SQL
--   • Programmatically from any feature (garden milestones, streaks, etc.)
--
-- ============================================================

-- ── 1. badges ────────────────────────────────────────────────
-- Master catalog of all badges. Rows are never deleted.
CREATE TABLE IF NOT EXISTS badges (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL UNIQUE,        -- machine-readable key, e.g. 'easter-2026'
  name          text NOT NULL,               -- display name, e.g. 'Easter Egg Hunter 2026'
  description   text,                        -- e.g. 'Found all Easter eggs during the 2026 hunt'
  icon_url      text,                        -- URL to badge image (PNG/SVG), null = use default
  category      text NOT NULL DEFAULT 'event', -- 'event', 'achievement', 'milestone', 'special'
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE badges ENABLE ROW LEVEL SECURITY;

-- Everyone can read badges
CREATE POLICY "badges_select_all" ON badges
  FOR SELECT USING (true);

-- ── 2. user_badges ───────────────────────────────────────────
-- Records which user earned which badge and when.
CREATE TABLE IF NOT EXISTS user_badges (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id      uuid NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  earned_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user  ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge ON user_badges(badge_id);

ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

-- Users can read their own badges
CREATE POLICY "user_badges_select_own" ON user_badges
  FOR SELECT USING (auth.uid() = user_id);

-- Anyone can see any user's badges (for public profiles)
CREATE POLICY "user_badges_select_public" ON user_badges
  FOR SELECT USING (true);

-- Users can earn badges (insert own)
CREATE POLICY "user_badges_insert_own" ON user_badges
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── 3. award_badge RPC ──────────────────────────────────────
-- Awards a badge to a user. Idempotent (ignores duplicates).
-- Usage: SELECT award_badge('<user-uuid>', '<badge-slug>');
CREATE OR REPLACE FUNCTION award_badge(target_user_id uuid, badge_slug text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_badge_id uuid;
BEGIN
  SELECT id INTO target_badge_id FROM badges WHERE slug = badge_slug AND is_active = true;
  IF target_badge_id IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO user_badges (user_id, badge_id)
  VALUES (target_user_id, target_badge_id)
  ON CONFLICT (user_id, badge_id) DO NOTHING;

  RETURN true;
END;
$$;
