# 🔬 PlantSwipe — Technical Deep‑Dive

This directory contains the PlantSwipe web app (React + Vite) and the lightweight API server (Express). It documents how the pieces work together, how to configure environments, and how to extend the system. Built with love by Neolite & Five. 🌿

---

## 🧭 Architecture Overview

```mermaid
flowchart TB
  subgraph Web[⚡ Web (Vite + React)]
    UI[UI Components (Tailwind + shadcn-inspired)]
    Router[react-router-dom]
    Auth[Supabase Auth (anon key)]
  end

  subgraph API[🧩 Express Server]
    Routes[/api/* routes/]
    Admin[Admin endpoints]
  end

  DB[(🌳 Postgres via Supabase)]

  UI --> Router
  Router --> Routes
  Auth --> Routes
  Routes --> DB
  API -->|serves| Dist[📦 /dist static]
```

- ⚛️ Frontend: React 19 + TypeScript + Vite 7, Tailwind CSS, Framer Motion, Radix primitives, lucide icons.
- 🧩 Backend: Express (ESM) with `postgres` client. Serves `/api/*` and static assets in production.
- 🗄️ Data: Supabase Postgres, with Supabase Auth used both on client and server.
- 🔐 Env safety: Only `VITE_*` variables are exposed to the browser.

---

## 📁 Directory Layout

```
plant-swipe/
  src/                # React app source
    components/       # UI (button, card, dialog), layout (TopBar, BottomBar), plant views
    pages/            # Routes: Gallery, Swipe, GardenList, GardenDashboard, Admin, etc.
    context/          # AuthContext (session lifecycle)
    lib/              # supabaseClient, utils, gardens helpers
    constants/        # UI badge mappings, constants
    types/            # Type definitions (plant, garden, ambient)
  supabase/           # SQL for schema sync and features
  server.js           # Express API + static serving
  vite.config.ts      # Dev proxy and build config
  index.html          # App shell
```

---

## 🧰 Environment Configuration

- Client runtime (browser) reads ONLY vars prefixed with `VITE_`.
- Server runtime can read `DATABASE_URL`/`PG*` and Supabase service keys.

Create `.env` (client):
```env
# Required for the browser client
VITE_SUPABASE_URL=YOUR_SUPABASE_URL
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Create `.env.server` (server-only, not exposed):
```env
# Option A: Single URL
# DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require

# Option B: Discrete PG vars
# PGHOST=host
# PGUSER=user
# PGPASSWORD=password
# PGPORT=5432
# PGDATABASE=postgres

# Supabase managed Postgres convenience
# SUPABASE_URL=https://<project>.supabase.co
# SUPABASE_DB_PASSWORD=your_db_password

# Express listen port
# PORT=3000
```

Notes:
- The server attempts to build a connection string from `DATABASE_URL`, `PG*` vars, or Supabase project host + `SUPABASE_DB_PASSWORD`. For non-local hosts, `sslmode=require` is appended automatically.
- Vite is configured with `envPrefix: ['VITE_']` to protect server secrets.

---

## ▶️ Run & Build

Dev (two terminals):
```bash
# API server (http://localhost:3000)
npm run serve

# Web dev server (http://127.0.0.1:5173) with /api proxy
npm run dev
```

Build & preview:
```bash
npm run build
npm run preview
```

Production (sample):
```bash
npm ci && npm run build
# Serve /dist via Express or your web server
```

---

## 🔌 API Endpoints

Base URL in dev: `http://localhost:3000`

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/health` | none | Health probe |
| GET | `/api/plants` | none | List plants (structured mapping to UI model) |
| POST | `/api/admin/restart-server` | Supabase JWT (admin) | Detached self-reexec restart |
| POST | `/api/admin/sync-schema` | Supabase JWT (admin) | Executes `supabase/000_sync_schema.sql` |
| POST | `/api/admin/pull-code` | Supabase JWT (admin) | `git fetch/prune/ff-only pull` (optional `?branch=`) |
| GET | `/api/admin/branches` | Supabase JWT (admin) | List remote branches + current |

Admin check strategy:
- `Authorization: Bearer <supabase_access_token>` is verified server-side.
- Admin is derived from `public.profiles.is_admin = true`, or allow-lists via `ADMIN_EMAILS`/`ADMIN_USER_IDS`.

Sequence (plants fetch):
```mermaid
sequenceDiagram
  participant UI as UI (React)
  participant API as Express API
  participant DB as Postgres
  UI->>API: GET /api/plants
  API->>DB: SELECT * FROM plants ORDER BY name
  DB-->>API: rows (snake_case)
  API-->>UI: mapped JSON (camelCase, care, flags)
```

---

## 🌱 Data Model (Core)

The API expects a `plants` table and optionally a `profiles` table for admin checks, along with garden-related tables. The code maps snake_case DB fields to camelCase UI fields.

### `plants` (expected columns)

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid/text | primary key |
| `name` | text | common name |
| `scientific_name` | text | binomial |
| `colors` | text[] | color badges |
| `seasons` | text[] | e.g. `spring`, `summer` |
| `rarity` | text | used for tone badge |
| `meaning` | text | optional |
| `description` | text | optional |
| `image_url` | text | image path/URL |
| `care_sunlight` | text | e.g. `Full sun` |
| `care_water` | text | optional; UI may derive from frequency |
| `care_soil` | text | e.g. `Well‑drained` |
| `care_difficulty` | text | e.g. `Easy` |
| `seeds_available` | boolean | availability flag |

### Profiles and Gardens (selected)

| Table | Purpose (selected columns) |
| --- | --- |
| `profiles` | `id`, `display_name`, `avatar_url`, `liked_plant_ids[]`, `is_admin` |
| `gardens` | `id`, `name`, `cover_image_url`, `created_by`, `created_at` |
| `garden_members` | `garden_id`, `user_id`, `role`, `joined_at` |
| `garden_plants` | `id`, `garden_id`, `plant_id`, `nickname`, `seeds_planted`, `planted_at`, `expected_bloom_date` |
| `garden_plant_events` | `id`, `garden_plant_id`, `event_type`, `occurred_at`, `notes`, `next_due_at` |
| `garden_inventory` | `id`, `garden_id`, `plant_id`, `seeds_on_hand`, `plants_on_hand` |
| `garden_transactions` | `id`, `garden_id`, `plant_id`, `type`, `quantity`, `occurred_at`, `notes` |

ER overview:
```mermaid
classDiagram
  class profiles { id uuid; is_admin bool }
  class plants { id; name; scientific_name; ... }
  class gardens { id; created_by }
  class garden_members { garden_id; user_id; role }
  class garden_plants { id; garden_id; plant_id }
  class garden_plant_events { id; garden_plant_id; event_type }
  class garden_inventory { id; garden_id; plant_id }
  class garden_transactions { id; garden_id; plant_id }
  profiles <|-- gardens : created_by
  gardens <|-- garden_members : members
  gardens <|-- garden_plants : plants
  garden_plants <|-- garden_plant_events : events
  gardens <|-- garden_inventory : inventory
  gardens <|-- garden_transactions : transactions
```

SQL utilities live in `supabase/` and `000_sync_schema.sql` is executed by the admin sync endpoint.

---

## 🧠 Frontend Concepts

- Routing: `react-router-dom@7` under `src/App.tsx`, mounting `src/PlantSwipe.tsx`.
- Auth: `src/context/AuthContext.tsx` wraps the app; client uses `@supabase/supabase-js` with `persistSession: true` and storage key `plantswipe.auth`.
- Animations: `framer-motion` powers swipe interactions and transitions.
- UI System: Tailwind utility classes + shadcn-inspired components in `src/components/ui`.
- Accessibility: Buttons, focus styles, and ARIA attributes in key interactions (e.g., like/unlike buttons).

Swipe interaction sketch:
```mermaid
flowchart LR
  Drag[Pointer drag x] --> Threshold{Velocity/offset}
  Threshold -- pass --> Left[Dismiss card]
  Threshold -- info --> Right[Open details]
```

---

## 🔐 Security & Safety

- Client env is restricted via `envPrefix: ['VITE_']` in `vite.config.ts`.
- Server adds `sslmode=require` to non-local Postgres connections.
- Admin endpoints require a valid Supabase JWT and admin check (`profiles.is_admin` or allow-lists).

---

## 🛠️ Developer Experience

- Linting: `npm run lint` (ESLint 9).
- Types: TypeScript 5; strict configs via `tsconfig.app.json` and `tsconfig.node.json`.
- Scripts:
  - `dev`: Vite dev server (proxy `/api`).
  - `serve`: Express API.
  - `build`: Type-check + Vite build.
  - `preview`: Preview built site.

---

## 🧪 Troubleshooting

- Missing plants? Ensure the `plants` table exists and contains data with expected columns.
- Admin calls fail? Verify `Authorization: Bearer <access_token>` is present and `profiles.is_admin = true` (or set `ADMIN_EMAILS`).
- Browser 401s? Check `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` values.
- DB SSL errors? Use `?sslmode=require` for remote Postgres or rely on the server’s auto-append.

---

## 🤝 Credits

Created by **Neolite** and **Five** — a duo obsessed with delightful UX and robust, clear architecture. 🌱💚

