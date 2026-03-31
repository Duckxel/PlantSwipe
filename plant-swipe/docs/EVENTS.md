# Event System

Reusable framework for running time-limited interactive events on Aphylia (egg hunts, scavenger hunts, seasonal campaigns, etc.).

---

## Event Folder Structure

Each event lives in its own folder under `events/`:

```
events/
  2026_EASTER/
    index.ts        — Barrel export of all event components
    components/     — Event-specific UI components
    setup.sql       — Idempotent SQL to create/update the event
    clean.sql       — SQL to remove all temporary data after event ends
    README.md       — Event details, descriptions, removal guide
  2027_HALLOWEEN/   — (future example)
    index.ts
    components/
    setup.sql
    clean.sql
    README.md

badges/
  event_2026_easter.sql  — Badge definition (per-badge SQL file)
```

- **`setup.sql`** — run to create/update the event. Idempotent, safe to re-run.
- **`clean.sql`** — run after the event ends. Removes items + progress, keeps registrations + badges.
- **`index.ts`** — barrel export. Pages import from `@events/2026_EASTER`.
- **`components/`** — event-specific UI. Easily deleted without touching core code.

---

## Database Architecture

### Table Naming Convention

| Table | Lifecycle | Purpose |
|-------|-----------|---------|
| `events` | **PERMANENT** | Event catalog — never deleted |
| `event_translations` | **PERMANENT** | Multilingual event name/description |
| `event_registrations` | **PERMANENT** | Users who completed an event — never deleted |
| `badges` | **PERMANENT** | Badge catalog |
| `badge_translations` | **PERMANENT** | Multilingual badge name/description |
| `user_badges` | **PERMANENT** | Earned badges — never deleted |
| `event_items` | **TEMPORARY** | Collectible items per event — deleted on cleanup |
| `event_item_translations` | **TEMPORARY** | Multilingual item descriptions — cascades on cleanup |
| `event_user_progress` | **TEMPORARY** | Per-user discovery tracking — deleted on cleanup |

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

## Admin UI

### Admin > Events (`/admin/events`)

- Create/edit events with name, description, type, badge, dates
- **Admin Only** toggle — test events before going public
- Activate/deactivate, cleanup (two-step confirm)
- Stats per event: items, participants, completions, completion %

### Admin > Advanced > Badges (`/admin/advanced/badges`)

- Create/edit badges with slug, name, description, icon, category
- Multilingual support with DeepL auto-translate
- Earned count per badge

---

## Lifecycle

### 1. Create event folder

```
mkdir events/YYYY_EVENT_NAME/
```

### 2. Write `setup.sql`

Use `ON CONFLICT DO UPDATE` for all inserts so the script is re-runnable. Look up plant IDs by name. See `events/2026_EASTER/setup.sql` as a template.

### 3. Run the SQL

```bash
psql $DATABASE_URL -f events/YYYY_EVENT_NAME/setup.sql
```

### 4. Deploy code

Add `<EasterEgg pagePath="..." />` to target pages. The component renders nothing when no active event exists, so it's safe to leave permanently.

### 5. Test (admin only)

Set `admin_only = true` + `is_active = true`. Only admin users see the event.

### 6. Go public

Admin > Events > toggle off "Admin Only".

### 7. Cleanup

Admin > Events > Cleanup button (two-step confirm).

Or via SQL:
```sql
SELECT cleanup_event((SELECT id FROM events WHERE name = 'Your Event Name'));
```

This deletes: `event_items`, `event_item_translations`, `event_user_progress`.
This keeps: `events`, `event_translations`, `event_registrations`, `badges`, `user_badges`.

---

## Frontend Architecture

```
src/
├── context/EggHuntContext.tsx       — Provider: loads active event, tracks progress, awards badge
├── lib/events.ts                    — Supabase queries for event tables
├── lib/badges.ts                    — Supabase queries for badge tables
├── types/event.ts                   — TypeScript types for event tables
├── types/badge.ts                   — TypeScript types for badge tables
├── components/events/
│   ├── EasterEgg.tsx               — Clickable egg icon (positioned by seed)
│   ├── EggFoundModal.tsx           — Modal shown when egg is found
│   └── EggHuntCounter.tsx          — Floating progress widget (bottom-right)
├── components/profile/
│   └── ProfileBadges.tsx           — Badge showcase on user profiles
├── components/admin/
│   ├── AdminEventsPanel.tsx        — Event management panel
│   └── AdminBadgesPanel.tsx        — Badge management panel
└── pages/
    ├── AboutPage.tsx               — Has <EasterEgg pagePath="/about" />
    └── PlantInfoPage.tsx           — Has <EasterEgg pagePath={"/plants/" + id} />
```

### Key Design Decisions

- **`EggHuntProvider`** wraps the entire app — loads once, available everywhere
- **`admin_only` mode** — admins can test events before public launch
- **Guest support** — localStorage fallback for logged-out users
- **Badge auto-award** — on completion if `events.badge_id` is set
- **Idempotent** — clicking an already-found egg re-shows the description
- **i18n** — all UI text + DB content supports EN/FR

---

## Current Events

| Event | Folder | Status |
|-------|--------|--------|
| Easter Egg Hunt 2026 | `events/2026_EASTER/` | Ready |
