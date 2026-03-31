-- ═══════════════════════════════════════════════════════════════
-- Badge: Easter Egg Hunter 2026
-- Category: event
-- Linked to: Easter Egg Hunt 2026 event
-- ═══════════════════════════════════════════════════════════════
--
-- IDEMPOTENT — safe to re-run. Updates existing data in place.
--
-- Naming: event_2026_easter.sql
--   Format: {category}_{year}_{name}.sql
--   Examples:
--     event_2026_easter.sql
--     event_2026_halloween.sql
--     achievement_first_plant.sql
--     milestone_100_scans.sql
--     special_beta_tester.sql
--
-- ═══════════════════════════════════════════════════════════════

-- ─── Badge definition ────────────────────────────────────────

INSERT INTO badges (slug, name, description, icon_url, category, is_active)
VALUES (
  'easter-2026',
  'Easter Egg Hunter 2026',
  'Found all hidden Easter eggs during the 2026 hunt!',
  NULL,  -- Replace with URL after uploading art via Admin > Upload and Media
  'event',
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  icon_url    = EXCLUDED.icon_url,
  category    = EXCLUDED.category,
  is_active   = EXCLUDED.is_active;

-- ─── Translations ────────────────────────────────────────────

-- French
INSERT INTO badge_translations (badge_id, language, name, description)
VALUES (
  (SELECT id FROM badges WHERE slug = 'easter-2026'),
  'fr',
  'Chasseur d''oeufs de Paques 2026',
  'A trouve tous les oeufs de Paques caches lors de la chasse 2026 !'
)
ON CONFLICT (badge_id, language) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description;

-- Add more languages here as needed:
-- INSERT INTO badge_translations (badge_id, language, name, description)
-- VALUES ((SELECT id FROM badges WHERE slug = 'easter-2026'), 'es', '...', '...')
-- ON CONFLICT (badge_id, language) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- ─── Verify ──────────────────────────────────────────────────

SELECT
  b.slug,
  b.name,
  b.category,
  b.icon_url,
  b.is_active,
  bt.language,
  bt.name AS translated_name
FROM badges b
LEFT JOIN badge_translations bt ON bt.badge_id = b.id
WHERE b.slug = 'easter-2026';
