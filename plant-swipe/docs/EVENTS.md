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

- [ ] Create badge: `INSERT INTO badges (slug, name, description, category) VALUES ('easter-2026', 'Easter Egg Hunter 2026', 'Found all hidden Easter eggs!', 'event');`
- [ ] Create event row with `badge_id` linked, `is_active = true`, dates: April 1-7
- [ ] Insert `event_items` for each page (About, Search, Discovery, Blog, etc.)
- [ ] Add `<EasterEgg pagePath="..." />` to each target page component
- [ ] Test: verify eggs show up, click -> modal, counter updates, badge awarded on completion
- [ ] Deploy

### Page/Egg Mapping (Example)

| Page | Path | Description | Seed |
|------|------|-------------|------|
| About | `/about` | test | 42 |
| Search | `/search` | Plants can communicate through fungi! | 17 |
| Discovery | `/discovery` | The oldest tree is over 5,000 years old! | 73 |
| Blog | `/blog` | Bamboo can grow up to 91 cm per day! | 8 |
| Pricing | `/pricing` | There are over 390,000 plant species! | 55 |

### Post-Event Cleanup

```sql
SELECT cleanup_event('<easter-2026-event-id>');
```

Then remove the `<EasterEgg>` components from pages (or leave them — they render nothing when no active event exists).

**What stays permanently:**
- `events` row: "Easter Egg Hunt 2026" entry in event history
- `event_registrations`: record of every user who completed it
- `badges` row: "Easter Egg Hunter 2026" badge definition
- `user_badges`: every user who earned the badge keeps it forever

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
