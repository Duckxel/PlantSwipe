-- ═══════════════════════════════════════════════════════════════
-- Easter Egg Hunt 2026 — Full Event Setup
-- ═══════════════════════════════════════════════════════════════
--
-- This script is IDEMPOTENT — safe to run multiple times.
-- It uses ON CONFLICT / DO UPDATE to upsert all data.
-- Re-run after editing descriptions, dates, or adding plants.
--
-- PREREQUISITE: Run badges/event_2026_easter.sql first
--   (or paste it above this script)
--
-- Usage:
--   1. psql -f badges/event_2026_easter.sql
--   2. psql -f events/2026_EASTER/setup.sql
--   OR paste both into Supabase SQL Editor
--
-- ═══════════════════════════════════════════════════════════════


-- ─── 1. BADGE (reference) ───────────────────────────────────
-- The badge is managed in: badges/event_2026_easter.sql
-- Run that file first. This ensures the badge exists:

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM badges WHERE slug = 'easter-2026') THEN
    RAISE EXCEPTION 'Badge "easter-2026" not found. Run badges/event_2026_easter.sql first.';
  END IF;
END $$;


-- ─── 2. EVENT ────────────────────────────────────────────────

-- Upsert by name (unique enough for our purposes)
INSERT INTO events (name, description, event_type, badge_id, starts_at, ends_at, is_active, admin_only)
VALUES (
  'Easter Egg Hunt 2026',
  'Find all hidden eggs across the site to earn a special badge!',
  'egg_hunt',
  (SELECT id FROM badges WHERE slug = 'easter-2026'),
  '2026-04-05T00:00:00Z',   -- Easter Sunday 2026
  '2026-04-12T23:59:59Z',   -- 1 week
  true,                       -- active
  true                        -- admin only (flip to false when ready to go public)
)
ON CONFLICT ON CONSTRAINT events_pkey DO NOTHING;
-- Note: if the event already exists, update it manually via Admin > Events UI
-- or delete and re-insert. We avoid ON CONFLICT here because events has no
-- natural unique key besides the PK.

-- If re-running and the event already exists, update its fields:
UPDATE events SET
  description = 'Find all hidden eggs across the site to earn a special badge!',
  event_type  = 'egg_hunt',
  badge_id    = (SELECT id FROM badges WHERE slug = 'easter-2026'),
  starts_at   = '2026-04-05T00:00:00Z',
  ends_at     = '2026-04-12T23:59:59Z',
  updated_at  = now()
WHERE name = 'Easter Egg Hunt 2026';

-- French translation
INSERT INTO event_translations (event_id, language, name, description)
VALUES (
  (SELECT id FROM events WHERE name = 'Easter Egg Hunt 2026'),
  'fr',
  'Chasse aux oeufs de Paques 2026',
  'Trouvez tous les oeufs caches sur le site pour obtenir un badge special !'
)
ON CONFLICT (event_id, language) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description;


-- ─── 3. EGGS (event items) ───────────────────────────────────
-- We use a DO block to look up plant IDs by name and upsert items.
-- The unique key is (event_id, page_path) enforced by a partial approach:
-- delete existing items for this event then re-insert fresh.

DO $$
DECLARE
  eid  uuid := (SELECT id FROM events WHERE name = 'Easter Egg Hunt 2026');
  pid  uuid;
BEGIN
  IF eid IS NULL THEN
    RAISE EXCEPTION 'Event "Easter Egg Hunt 2026" not found. Run steps 1-2 first.';
  END IF;

  -- Clear existing items (and their translations via CASCADE) so we can re-insert cleanly.
  -- This is safe: user progress (event_user_progress) references item IDs,
  -- so this also resets progress — only do this BEFORE the event goes live.
  DELETE FROM event_items WHERE event_id = eid;

  -- ── About page ──
  INSERT INTO event_items (event_id, page_path, description, position_seed)
  VALUES (eid, '/about',
    'Aphylia was born in Montpellier, inspired by the Aphyllante flower native to the region!',
    42);

  -- ── Primevere ──
  INSERT INTO event_items (event_id, page_path, description, position_seed)
  VALUES (eid, '/plants/96c11643-db89-416e-91fb-819443724c56',
    'In Celtic folklore, the primrose is the "fairy flower" — placed on doorsteps, it could either ward off fairies or reveal their hidden realm!',
    17);

  -- ── Jonquille / Narcisse ──
  INSERT INTO event_items (event_id, page_path, description, position_seed)
  VALUES (eid, '/plants/53854638-3128-4ba2-b84c-19742f96f0b6',
    'In Greek mythology, the daffodil is linked to Narcissus, who fell in love with his own reflection in a river!',
    73);

  -- ── Palmier ──
  INSERT INTO event_items (event_id, page_path, description, position_seed)
  VALUES (eid, '/plants/49ced2da-b940-4c4e-82fa-9e36c2a0dc2a',
    'Palm fossils date back over 100 million years! Palm branches were waved at Jesus'' entry into Jerusalem — the origin of Palm Sunday.',
    8);

  -- ── Olivier ──
  SELECT id INTO pid FROM plants WHERE name ILIKE '%olivier%' OR name ILIKE '%olive tree%' LIMIT 1;
  IF pid IS NOT NULL THEN
    INSERT INTO event_items (event_id, page_path, description, position_seed)
    VALUES (eid, '/plants/' || pid,
      'After the Great Flood, Noah''s dove returned with an olive branch — the universal symbol of peace. Olive branches are still blessed every Palm Sunday!',
      55);
  ELSE
    RAISE WARNING 'Plant "Olivier" not found — skipping';
  END IF;

  -- ── Paquerette ──
  SELECT id INTO pid FROM plants WHERE name ILIKE '%paquerette%' OR name ILIKE '%p_querette%' OR name ILIKE '%daisy%' LIMIT 1;
  IF pid IS NOT NULL THEN
    INSERT INTO event_items (event_id, page_path, description, position_seed)
    VALUES (eid, '/plants/' || pid,
      'The daisy''s French name "paquerette" literally comes from "Paques" (Easter)! It symbolizes purity, innocence, and the return of spring.',
      31);
  ELSE
    RAISE WARNING 'Plant "Paquerette" not found — skipping';
  END IF;

  -- ── Ble germe ──
  INSERT INTO event_items (event_id, page_path, description, position_seed)
  VALUES (eid, '/plants/4e69910c-56d3-4202-9370-f7b1b03f09ef',
    'In the Mediterranean, wheat is sprouted before Easter to symbolize rebirth and abundance — a tradition dating back to ancient Rome, where spring rites honored the goddess Demeter.',
    89);

  -- ── Lys blanc ──
  INSERT INTO event_items (event_id, page_path, description, position_seed)
  VALUES (eid, '/plants/b99967c7-a1d8-4616-a978-d35a43bdff94',
    'In the Annunciation paintings, the angel Gabriel holds a white lily when announcing the birth of Jesus to Mary. The lily represents purity, resurrection, and eternal life!',
    64);

  -- ── Buis ──
  SELECT id INTO pid FROM plants WHERE name ILIKE '%buis%' OR name ILIKE '%boxwood%' LIMIT 1;
  IF pid IS NOT NULL THEN
    INSERT INTO event_items (event_id, page_path, description, position_seed)
    VALUES (eid, '/plants/' || pid,
      'In regions where palm trees don''t grow, boxwood branches are used instead on Palm Sunday! As an evergreen, boxwood has symbolized eternal life since ancient times.',
      22);
  ELSE
    RAISE WARNING 'Plant "Buis" not found — skipping';
  END IF;

  RAISE NOTICE 'Inserted % egg(s) for Easter 2026', (SELECT count(*) FROM event_items WHERE event_id = eid);
END $$;


-- ─── 4. FRENCH TRANSLATIONS FOR EGGS ────────────────────────

DO $$
DECLARE
  eid uuid := (SELECT id FROM events WHERE name = 'Easter Egg Hunt 2026');
  rec record;
  fr_text text;
BEGIN
  FOR rec IN SELECT id, page_path FROM event_items WHERE event_id = eid
  LOOP
    fr_text := CASE
      WHEN rec.page_path = '/about'
        THEN 'Aphylia est nee a Montpellier, inspiree par l''Aphyllante, une fleur native de la region !'
      WHEN rec.page_path LIKE '%96c11643-db89-416e-91fb-819443724c56%'
        THEN 'Dans le folklore celtique, la primevere est la "fleur des fees" — placee sur le seuil, elle pouvait repousser les fees ou reveler leur royaume cache !'
      WHEN rec.page_path LIKE '%53854638-3128-4ba2-b84c-19742f96f0b6%'
        THEN 'Dans la mythologie grecque, la jonquille est liee au mythe de Narcisse, qui tomba amoureux de son propre reflet dans une riviere !'
      WHEN rec.page_path LIKE '%49ced2da-b940-4c4e-82fa-9e36c2a0dc2a%'
        THEN 'Des fossiles de palmier datent de plus de 100 millions d''annees ! Les rameaux de palmier furent agites a l''entree de Jesus a Jerusalem — l''origine du Dimanche des Rameaux.'
      WHEN rec.page_path LIKE '%' || COALESCE((SELECT id FROM plants WHERE (name ILIKE '%olivier%' OR name ILIKE '%olive tree%') LIMIT 1)::text, 'NONE') || '%'
        THEN 'Apres le Deluge, la colombe de Noe rapporta une branche d''olivier — le symbole universel de paix. Les rameaux d''olivier sont encore benis chaque Dimanche des Rameaux !'
      WHEN rec.page_path LIKE '%' || COALESCE((SELECT id FROM plants WHERE (name ILIKE '%paquerette%' OR name ILIKE '%p_querette%' OR name ILIKE '%daisy%') LIMIT 1)::text, 'NONE') || '%'
        THEN 'Le nom "paquerette" vient directement de "Paques" ! Elle symbolise la purete, l''innocence et le retour du printemps.'
      WHEN rec.page_path LIKE '%4e69910c-56d3-4202-9370-f7b1b03f09ef%'
        THEN 'En Mediterranee, le ble est fait germer avant Paques pour symboliser la renaissance et l''abondance — une tradition remontant a la Rome antique, ou les rites de printemps honoraient la deesse Demeter.'
      WHEN rec.page_path LIKE '%b99967c7-a1d8-4616-a978-d35a43bdff94%'
        THEN 'Dans les tableaux de l''Annonciation, l''ange Gabriel tient un lys blanc pour annoncer la naissance de Jesus a Marie. Le lys represente la purete, la resurrection et la vie eternelle !'
      WHEN rec.page_path LIKE '%' || COALESCE((SELECT id FROM plants WHERE (name ILIKE '%buis%' OR name ILIKE '%boxwood%') LIMIT 1)::text, 'NONE') || '%'
        THEN 'Dans les regions ou le palmier ne pousse pas, on utilise des branches de buis le Dimanche des Rameaux ! Plante a feuilles persistantes, le buis symbolise la vie eternelle depuis l''Antiquite.'
      ELSE 'Oeuf de Paques trouve !'
    END;

    INSERT INTO event_item_translations (item_id, language, description)
    VALUES (rec.id, 'fr', fr_text)
    ON CONFLICT (item_id, language) DO UPDATE SET description = EXCLUDED.description;
  END LOOP;
END $$;


-- ─── 5. VERIFY ──────────────────────────────────────────────

SELECT
  ei.page_path,
  ei.position_seed,
  LEFT(ei.description, 60) || '...' AS en_preview,
  LEFT(eit.description, 60) || '...' AS fr_preview
FROM event_items ei
LEFT JOIN event_item_translations eit ON eit.item_id = ei.id AND eit.language = 'fr'
WHERE ei.event_id = (SELECT id FROM events WHERE name = 'Easter Egg Hunt 2026')
ORDER BY ei.created_at;
