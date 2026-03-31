# Event System

Reusable framework for running time-limited interactive events on Aphylia (egg hunts, scavenger hunts, seasonal campaigns, etc.).

---

## Database Architecture

### Naming Convention

| Table | Lifecycle | Purpose |
|-------|-----------|---------|
| `events` | **PERMANENT** | Event catalog — never deleted |
| `event_registrations` | **PERMANENT** | Users who completed an event — never deleted |
| `badges` | **PERMANENT** | Badge catalog — all available badges |
| `user_badges` | **PERMANENT** | Earned badges per user — never deleted |
| `event_items` | **TEMPORARY** | Collectible items per event — deleted on cleanup |
| `event_user_progress` | **TEMPORARY** | Per-user discovery tracking — deleted on cleanup |

> **Rule**: all TEMPORARY tables follow the pattern `event_<concept>`. When cleaning up, all `event_items` and `event_user_progress` rows for the event are deleted. The `events` row, `event_registrations`, and badge records are kept forever.

### Table Details

```
┌──────────────────────────┐
│         events           │  PERMANENT — event definitions
├──────────────────────────┤
│ id            (uuid)     │
│ name          (text)     │  e.g. "Easter Egg Hunt 2026"
│ description   (text)     │  e.g. "Find all hidden eggs!"
│ event_type    (text)     │  e.g. "egg_hunt", "scavenger_hunt"
│ badge_id      (uuid FK)  │  → badges.id (awarded on completion, nullable)
│ starts_at     (tz)       │  null = no start constraint
│ ends_at       (tz)       │  null = no end constraint
│ is_active     (bool)     │  only one should be active at a time
│ created_at    (tz)       │
│ updated_at    (tz)       │
└──────────────────────────┘

┌──────────────────────────┐
│   event_registrations    │  PERMANENT — completion records
├──────────────────────────┤
│ id            (uuid)     │
│ event_id      (uuid FK)  │  → events.id
│ user_id       (uuid FK)  │  → auth.users.id
│ completed_at  (tz)       │
│ UNIQUE(event_id, user_id)│
└──────────────────────────┘

┌──────────────────────────┐
│         badges           │  PERMANENT — badge catalog
├──────────────────────────┤
│ id            (uuid)     │
│ slug          (text)     │  e.g. "easter-2026" (unique)
│ name          (text)     │  e.g. "Easter Egg Hunter 2026"
│ description   (text)     │  e.g. "Found all Easter eggs!"
│ icon_url      (text)     │  URL to badge image (null = default)
│ category      (text)     │  "event", "achievement", "milestone", "special"
│ is_active     (bool)     │
│ created_at    (tz)       │
└──────────────────────────┘

┌──────────────────────────┐
│      user_badges         │  PERMANENT — earned badges
├──────────────────────────┤
│ id            (uuid)     │
│ user_id       (uuid FK)  │  → auth.users.id
│ badge_id      (uuid FK)  │  → badges.id
│ earned_at     (tz)       │
│ UNIQUE(user_id, badge_id)│
└──────────────────────────┘

┌──────────────────────────┐
│      event_items         │  TEMPORARY — collectibles
├──────────────────────────┤
│ id            (uuid)     │
│ event_id      (uuid FK)  │  → events.id
│ page_path     (text)     │  e.g. '/about', '/search'
│ description   (text)     │  fun fact shown on discovery
│ position_seed (int)      │  deterministic placement on page
│ created_at    (tz)       │
└──────────────────────────┘

┌──────────────────────────┐
│   event_user_progress    │  TEMPORARY — user discoveries
├──────────────────────────┤
│ id            (uuid)     │
│ event_id      (uuid FK)  │  → events.id
│ item_id       (uuid FK)  │  → event_items.id
│ user_id       (uuid FK)  │  → auth.users.id
│ found_at      (tz)       │
│ UNIQUE(item_id, user_id) │
└──────────────────────────┘
```

### Relationships

```
badges ──────────── events ──────────── event_items
  │                   │                     │
  │                   │                     │
  ▼                   ▼                     ▼
user_badges    event_registrations    event_user_progress
  │                   │                     │
  └───────── all FK → auth.users ───────────┘
```

---

## Lifecycle of an Event

### 1. Create the Badge (Optional)

If the event awards a badge on completion:

```sql
INSERT INTO badges (slug, name, description, category)
VALUES (
  'easter-2026',
  'Easter Egg Hunter 2026',
  'Found all hidden Easter eggs during the 2026 hunt!',
  'event'
);
```

### 2. Create the Event

```sql
INSERT INTO events (name, description, event_type, badge_id, starts_at, ends_at, is_active)
VALUES (
  'Easter Egg Hunt 2026',
  'Find all hidden eggs across the site for a surprise!',
  'egg_hunt',
  (SELECT id FROM badges WHERE slug = 'easter-2026'),  -- or NULL for no badge
  '2026-04-01T00:00:00Z',
  '2026-04-07T23:59:59Z',
  true
);
```

### 3. Add Items (Eggs)

Each item is tied to a page path and has a description (fun fact) shown when found.

```sql
-- Replace <event_id> with the actual UUID from step 2

INSERT INTO event_items (event_id, page_path, description, position_seed) VALUES
  ('<event_id>', '/about',     'test',                                     42),
  ('<event_id>', '/search',    'Plants can communicate through fungi!',    17),
  ('<event_id>', '/discovery', 'The oldest tree is over 5,000 years old!', 73),
  ('<event_id>', '/blog',      'Bamboo can grow up to 91 cm per day!',     8),
  ('<event_id>', '/pricing',   'There are over 390,000 plant species!',    55);
```

> **position_seed** controls where the egg appears on the page. Use any integer — the component maps it to a percentage position deterministically.

### 4. Add the `<EasterEgg>` Component to Pages

In each page component where an egg should appear:

```tsx
import { EasterEgg } from '@/components/events/EasterEgg'

export default function SomePage() {
  return (
    <div className="relative"> {/* must be relative for absolute positioning */}
      <EasterEgg pagePath="/some-page" />
      {/* ... rest of page ... */}
    </div>
  )
}
```

The component automatically:
- Checks if there's an active event with an item for that page
- Renders nothing if no event/item exists
- Shows the egg icon at a position derived from `position_seed`
- Handles click -> modal with fun fact
- Tracks found state (DB for logged-in, localStorage for guests)
- **Awards the event's badge when all items are found** (logged-in users only)

### 5. Monitor Progress

```sql
-- How many users are participating?
SELECT count(DISTINCT user_id) FROM event_user_progress WHERE event_id = '<event_id>';

-- How many completed the event?
SELECT count(*) FROM event_registrations WHERE event_id = '<event_id>';

-- How many earned the badge?
SELECT count(*) FROM user_badges
WHERE badge_id = (SELECT id FROM badges WHERE slug = 'easter-2026');

-- Leaderboard: who found the most?
SELECT user_id, count(*) as found
FROM event_user_progress
WHERE event_id = '<event_id>'
GROUP BY user_id
ORDER BY found DESC
LIMIT 20;
```

### 6. Clean Up (Event Ends)

Use the built-in cleanup function:

```sql
-- Removes all TEMPORARY data, deactivates the event.
-- KEEPS: events row, event_registrations, badges, user_badges.
SELECT cleanup_event('<event_id>');
```

What this does:
1. `DELETE FROM event_user_progress WHERE event_id = ...`
2. `DELETE FROM event_items WHERE event_id = ...`
3. `UPDATE events SET is_active = false WHERE id = ...`

What is **preserved forever**:
- The `events` row (event history)
- All `event_registrations` (who completed it)
- The `badges` row (badge definition)
- All `user_badges` rows (earned badges stay on user profiles)

### 7. Full Deletion (Optional)

If you want to remove everything including the event definition and completion records:

```sql
SELECT delete_event_completely('<event_id>');
```

---

## Badge System

### Badge Categories

| Category | Description | Examples |
|----------|-------------|---------|
| `event` | Awarded for completing a seasonal event | Easter 2026, Halloween 2026 |
| `achievement` | Awarded for user accomplishments | First plant added, 100 plants scanned |
| `milestone` | Awarded for reaching milestones | 1-year anniversary, 50 gardens |
| `special` | One-off or admin-awarded badges | Beta tester, Bug hunter |

### How Badges are Awarded

1. **Event completion** (automatic): When a user finds all items in an event, the badge linked via `events.badge_id` is automatically awarded.
2. **By slug** (programmatic): `await awardBadge(userId, 'badge-slug')` from anywhere in the codebase.
3. **By SQL** (manual/admin): `SELECT award_badge('<user-id>', 'badge-slug');`

### Fetching User Badges

```typescript
import { getUserBadges } from '@/lib/badges'

// Returns badges with full details (name, description, icon, earned_at)
const badges = await getUserBadges(userId)
```

### Badge SQL Helpers

```sql
-- Award a badge to a user (idempotent)
SELECT award_badge('<user-uuid>', 'easter-2026');

-- List all badges for a user
SELECT b.name, b.description, b.icon_url, ub.earned_at
FROM user_badges ub
JOIN badges b ON b.id = ub.badge_id
WHERE ub.user_id = '<user-uuid>'
ORDER BY ub.earned_at DESC;

-- List all users who earned a specific badge
SELECT ub.user_id, p.display_name, ub.earned_at
FROM user_badges ub
JOIN profiles p ON p.id = ub.user_id
JOIN badges b ON b.id = ub.badge_id
WHERE b.slug = 'easter-2026'
ORDER BY ub.earned_at ASC;
```

---

## Example: Easter 2026

### Setup Checklist

- [ ] Run the SQL below in order (badge, event, items, translations)
- [ ] Deploy the branch (code already has `<EasterEgg>` on About + PlantInfoPage)
- [ ] In Admin > Events, toggle "Admin Only" + "Active" to test
- [ ] Verify: eggs appear on the 9 pages, click shows fun fact, counter works
- [ ] When ready to go public: turn off "Admin Only" in Admin > Events
- [ ] After event ends: click "Cleanup" in Admin > Events

### Complete SQL Setup

Run these in order on your Supabase SQL editor:

```sql
-- ═══════════════════════════════════════════════════════
-- STEP 1: Create the Easter badge
-- ═══════════════════════════════════════════════════════
INSERT INTO badges (slug, name, description, category)
VALUES ('easter-2026', 'Easter Egg Hunter 2026', 'Found all hidden Easter eggs during the 2026 hunt!', 'event')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO badge_translations (badge_id, language, name, description)
VALUES (
  (SELECT id FROM badges WHERE slug = 'easter-2026'),
  'fr',
  'Chasseur d''oeufs de Paques 2026',
  'A trouve tous les oeufs de Paques caches lors de la chasse 2026 !'
) ON CONFLICT (badge_id, language) DO NOTHING;

-- ═══════════════════════════════════════════════════════
-- STEP 2: Create the Easter event
-- ═══════════════════════════════════════════════════════
INSERT INTO events (name, description, event_type, badge_id, starts_at, ends_at, is_active, admin_only)
VALUES (
  'Easter Egg Hunt 2026',
  'Find all hidden eggs across the site to earn a special badge!',
  'egg_hunt',
  (SELECT id FROM badges WHERE slug = 'easter-2026'),
  '2026-04-05T00:00:00Z',
  '2026-04-12T23:59:59Z',
  true,
  true  -- admin only for testing, set to false when ready to go public
);

INSERT INTO event_translations (event_id, language, name, description)
VALUES (
  (SELECT id FROM events WHERE name = 'Easter Egg Hunt 2026'),
  'fr',
  'Chasse aux oeufs de Paques 2026',
  'Trouvez tous les oeufs caches sur le site pour obtenir un badge special !'
) ON CONFLICT (event_id, language) DO NOTHING;

-- ═══════════════════════════════════════════════════════
-- STEP 3: Add eggs (9 total: 1 About page + 8 plant pages)
-- ═══════════════════════════════════════════════════════
-- The plant pages use /plants/<uuid>, so we look up IDs by name.
-- Adjust the ILIKE patterns if your plant names differ.

DO $$
DECLARE
  eid uuid := (SELECT id FROM events WHERE name = 'Easter Egg Hunt 2026');
  pid uuid;
BEGIN
  -- 1. About page
  INSERT INTO event_items (event_id, page_path, description, position_seed)
  VALUES (eid, '/about', 'Aphylia was born in Montpellier, inspired by the Aphyllante flower native to the region!', 42);

  -- 2. Primevere
  SELECT id INTO pid FROM plants WHERE name ILIKE '%primev%' LIMIT 1;
  IF pid IS NOT NULL THEN
    INSERT INTO event_items (event_id, page_path, description, position_seed)
    VALUES (eid, '/plants/' || pid, 'In Celtic folklore, the primrose is called the "fairy flower" — it was believed to open the doors to the supernatural world!', 17);
  END IF;

  -- 3. Jonquille / Narcisse
  SELECT id INTO pid FROM plants WHERE name ILIKE '%jonquille%' OR name ILIKE '%narciss%' LIMIT 1;
  IF pid IS NOT NULL THEN
    INSERT INTO event_items (event_id, page_path, description, position_seed)
    VALUES (eid, '/plants/' || pid, 'In Greek mythology, the daffodil is linked to Narcissus, who fell in love with his own reflection in a river!', 73);
  END IF;

  -- 4. Palmier
  SELECT id INTO pid FROM plants WHERE name ILIKE '%palmier%' OR name ILIKE '%palm tree%' LIMIT 1;
  IF pid IS NOT NULL THEN
    INSERT INTO event_items (event_id, page_path, description, position_seed)
    VALUES (eid, '/plants/' || pid, 'Palm fossils date back over 100 million years! Palm branches were waved at Jesus'' entry into Jerusalem — the origin of Palm Sunday.', 8);
  END IF;

  -- 5. Olivier
  SELECT id INTO pid FROM plants WHERE name ILIKE '%olivier%' OR name ILIKE '%olive%' LIMIT 1;
  IF pid IS NOT NULL THEN
    INSERT INTO event_items (event_id, page_path, description, position_seed)
    VALUES (eid, '/plants/' || pid, 'After the Great Flood, Noah''s dove returned with an olive branch — the universal symbol of peace. Olive branches are still blessed every Palm Sunday!', 55);
  END IF;

  -- 6. Paquerette
  SELECT id INTO pid FROM plants WHERE name ILIKE '%paquerette%' OR name ILIKE '%daisy%' LIMIT 1;
  IF pid IS NOT NULL THEN
    INSERT INTO event_items (event_id, page_path, description, position_seed)
    VALUES (eid, '/plants/' || pid, 'The daisy''s French name "paquerette" literally comes from "Paques" (Easter)! It symbolizes purity, innocence, and the return of spring.', 31);
  END IF;

  -- 7. Ble germe
  SELECT id INTO pid FROM plants WHERE name ILIKE '%ble germ%' OR name ILIKE '%ble%germ%' OR name ILIKE '%sprouted wheat%' LIMIT 1;
  IF pid IS NOT NULL THEN
    INSERT INTO event_items (event_id, page_path, description, position_seed)
    VALUES (eid, '/plants/' || pid, 'Ancient Romans sprouted wheat for spring festivals to honor Demeter and Persephone. This Mediterranean Easter tradition symbolizes rebirth and abundance!', 89);
  END IF;

  -- 8. Lys blanc
  SELECT id INTO pid FROM plants WHERE name ILIKE '%lys blanc%' OR name ILIKE '%white lily%' OR name ILIKE '%lys%' LIMIT 1;
  IF pid IS NOT NULL THEN
    INSERT INTO event_items (event_id, page_path, description, position_seed)
    VALUES (eid, '/plants/' || pid, 'In the Annunciation paintings, the angel Gabriel holds a white lily when announcing the birth of Jesus to Mary. The lily represents purity, resurrection, and eternal life!', 64);
  END IF;

  -- 9. Buis
  SELECT id INTO pid FROM plants WHERE name ILIKE '%buis%' OR name ILIKE '%boxwood%' LIMIT 1;
  IF pid IS NOT NULL THEN
    INSERT INTO event_items (event_id, page_path, description, position_seed)
    VALUES (eid, '/plants/' || pid, 'In regions where palm trees don''t grow, boxwood branches are used instead on Palm Sunday! As an evergreen, boxwood has symbolized eternal life since ancient times.', 22);
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════
-- STEP 4: Add French translations for each egg
-- ═══════════════════════════════════════════════════════
DO $$
DECLARE
  eid uuid := (SELECT id FROM events WHERE name = 'Easter Egg Hunt 2026');
  rec record;
BEGIN
  FOR rec IN
    SELECT id, page_path FROM event_items WHERE event_id = eid
  LOOP
    INSERT INTO event_item_translations (item_id, language, description)
    VALUES (
      rec.id,
      'fr',
      CASE
        WHEN rec.page_path = '/about'
          THEN 'Aphylia est nee a Montpellier, inspiree par l''Aphyllante, une fleur native de la region !'
        WHEN rec.page_path LIKE '%' || (SELECT id FROM plants WHERE name ILIKE '%primev%' LIMIT 1)::text || '%'
          THEN 'Dans le folklore celtique, la primevere est appelee "fleur des fees" — on croyait qu''elle ouvrait les portes du monde surnaturel !'
        WHEN rec.page_path LIKE '%' || (SELECT id FROM plants WHERE (name ILIKE '%jonquille%' OR name ILIKE '%narciss%') LIMIT 1)::text || '%'
          THEN 'Dans la mythologie grecque, la jonquille est liee au mythe de Narcisse, qui tomba amoureux de son propre reflet dans une riviere !'
        WHEN rec.page_path LIKE '%' || (SELECT id FROM plants WHERE (name ILIKE '%palmier%' OR name ILIKE '%palm tree%') LIMIT 1)::text || '%'
          THEN 'Des fossiles de palmier datent de plus de 100 millions d''annees ! Les rameaux de palmier furent agites a l''entree de Jesus a Jerusalem — l''origine du Dimanche des Rameaux.'
        WHEN rec.page_path LIKE '%' || (SELECT id FROM plants WHERE (name ILIKE '%olivier%' OR name ILIKE '%olive%') LIMIT 1)::text || '%'
          THEN 'Apres le Deluge, la colombe de Noe rapporta une branche d''olivier — le symbole universel de paix. Les rameaux d''olivier sont encore benis chaque Dimanche des Rameaux !'
        WHEN rec.page_path LIKE '%' || (SELECT id FROM plants WHERE (name ILIKE '%paquerette%' OR name ILIKE '%daisy%') LIMIT 1)::text || '%'
          THEN 'Le nom "paquerette" vient directement de "Paques" ! Elle symbolise la purete, l''innocence et le retour du printemps.'
        WHEN rec.page_path LIKE '%' || (SELECT id FROM plants WHERE (name ILIKE '%ble germ%' OR name ILIKE '%ble%germ%') LIMIT 1)::text || '%'
          THEN 'Les Romains faisaient germer du ble lors des fetes de printemps en l''honneur de Demeter et Persephone. Cette tradition mediterraneenne de Paques symbolise la renaissance et l''abondance !'
        WHEN rec.page_path LIKE '%' || (SELECT id FROM plants WHERE (name ILIKE '%lys blanc%' OR name ILIKE '%lys%') LIMIT 1)::text || '%'
          THEN 'Dans les tableaux de l''Annonciation, l''ange Gabriel tient un lys blanc pour annoncer la naissance de Jesus a Marie. Le lys represente la purete, la resurrection et la vie eternelle !'
        WHEN rec.page_path LIKE '%' || (SELECT id FROM plants WHERE (name ILIKE '%buis%' OR name ILIKE '%boxwood%') LIMIT 1)::text || '%'
          THEN 'Dans les regions ou le palmier ne pousse pas, on utilise des branches de buis le Dimanche des Rameaux ! Plante a feuilles persistantes, le buis symbolise la vie eternelle depuis l''Antiquite.'
        ELSE 'Oeuf de Paques trouve !'
      END
    ) ON CONFLICT (item_id, language) DO NOTHING;
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════
-- VERIFY: Check what was created
-- ═══════════════════════════════════════════════════════
SELECT ei.page_path, ei.description AS en_description, eit.description AS fr_description, ei.position_seed
FROM event_items ei
LEFT JOIN event_item_translations eit ON eit.item_id = ei.id AND eit.language = 'fr'
WHERE ei.event_id = (SELECT id FROM events WHERE name = 'Easter Egg Hunt 2026')
ORDER BY ei.created_at;
```

### Egg Locations (9 total)

| # | Page | Plant | Seed | Description (EN) |
|---|------|-------|------|------------------|
| 1 | About | — | 42 | Aphylia born in Montpellier, inspired by Aphyllante |
| 2 | Primevere | Fairy flower in Celtic folklore | 17 | Opens doors to supernatural world |
| 3 | Jonquille | Narcissus myth | 73 | Fell in love with his reflection |
| 4 | Palmier | Palm Sunday origin | 8 | 100M year old fossils, Jerusalem entry |
| 5 | Olivier | Noah's dove | 55 | Olive branch = peace, blessed on Palm Sunday |
| 6 | Paquerette | Name = Easter | 31 | French name literally from "Paques" |
| 7 | Ble germe | Ancient spring rites | 89 | Romans honored Demeter & Persephone |
| 8 | Lys blanc | Annunciation art | 64 | Gabriel holds lily announcing Jesus to Mary |
| 9 | Buis | Palm Sunday substitute | 22 | Evergreen = eternal life since antiquity |

### Post-Event Cleanup

In **Admin > Events**, click the event card, then **Cleanup** > **Confirm Cleanup**.

Or via SQL:
```sql
SELECT cleanup_event((SELECT id FROM events WHERE name = 'Easter Egg Hunt 2026'));
```

---

## Adding a New Event Type

The system is generic. To add a different kind of event (e.g., a quiz, a scavenger hunt with different items):

1. Create a badge (optional): `INSERT INTO badges ...`
2. Insert a new `events` row with a different `event_type` and link the badge
3. Insert `event_items` with your content
4. Optionally create a new component (like `EasterEgg` but with a different icon/style)
5. The context (`EggHuntContext`) and counter work with any event type

---

## Frontend Architecture

```
src/
├── context/EggHuntContext.tsx    — Provider: loads active event, tracks progress, awards badge
├── lib/events.ts                — Supabase queries for event tables
├── lib/badges.ts                — Supabase queries for badge tables
├── types/event.ts               — TypeScript types for event tables
├── types/badge.ts               — TypeScript types for badge tables
└── components/events/
    ├── EasterEgg.tsx            — Clickable egg icon (positioned by seed)
    ├── EggFoundModal.tsx        — Modal shown when egg is found
    └── EggHuntCounter.tsx       — Floating progress widget (bottom-right)
```

### Key Design Decisions

- **`EggHuntProvider`** wraps the entire app in `App.tsx` — loads once, available everywhere
- **`EggHuntCounter`** is rendered globally — shows only when an active event has items
- **`EasterEgg`** components are placed per-page — render nothing if no item for that page
- **Guest support**: localStorage fallback when user is not logged in
- **Completion**: automatically recorded in `event_registrations` when all items found
- **Badge award**: automatic on completion if `events.badge_id` is set
- **Idempotent**: clicking an already-found egg re-shows the fun fact, doesn't duplicate DB rows

---

## DB Cleanup Automation (Future)

To automate cleanup, you could add a Supabase cron job:

```sql
-- Runs daily, cleans up events that ended more than 7 days ago
SELECT cron.schedule('cleanup-ended-events', '0 3 * * *', $$
  SELECT cleanup_event(id)
  FROM events
  WHERE is_active = true
    AND ends_at IS NOT NULL
    AND ends_at < now() - interval '7 days';
$$);
```

This keeps the DB clean automatically while giving a 7-day grace period after events end.
