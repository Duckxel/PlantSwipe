# 🌿 PlantSwipe — fall in love with plants, one swipe at a time

PlantSwipe turns plant discovery into a joyful, visual, swipe-first experience — while giving serious growers structured data, care guidance, and collaboration tools. It’s where curiosity meets craftsmanship. 🌱✨

Built with care by **Neolite** & **Five**.

---

## ✨ What makes PlantSwipe special

- **Playful discovery**: swipe cards that feel instant and alive.
- **Structured knowledge**: typed plant data, seasons, rarity, care, and meanings.
- **Search that understands you**: filter by colors, seasons, rarity, and text.
- **Grow together**: gardens, inventories, streaks, and shared activity.
- **Developer‑friendly**: modern, readable stack with clear, safe conventions.

---

## 🚀 Feature overview

| 🌟 Feature | Why it matters |
| --- | --- |
| Swipe‑to‑discover | Explore fast with like/pass gestures and smooth animations |
| Rich plant profiles | Scientific names, meanings, colors, seasons, rarity, care |
| Powerful search | Filter by color, season, rarity; full‑text name search |
| Garden tools | Dashboards, inventories, planting timelines, activity tracking |
| Admin console | Branches, pull latest, restart server, sync schema safely |
| Scalable data | Postgres schema with clear mappings to UI types |
| Production‑ready | Express API + static serving, environment separation |

---

## 🔄 How it works

```mermaid
flowchart LR
  User[🧑‍🌾 User] -->|Swipe / Search| Web[⚡ React + Vite]
  Web -->|/api/*| API[🧩 Express]
  API -->|SQL| DB[(🌳 Postgres via Supabase)]
  API --> Static[📦 Static dist]
  Static --> User
```

Swipe interaction at a glance:

```mermaid
sequenceDiagram
  participant U as User
  participant W as Web (React)
  participant A as API (Express)
  participant D as DB (Postgres)
  U->>W: Drag card ➜ velocity/offset
  W-->>U: Threshold reached ➜ Like/Pass animation
  W->>A: POST /api/interaction
  A->>D: INSERT interaction
  D-->>A: OK
  A-->>W: JSON { status: "saved" }
```

---

## 🖼️ Screens & capabilities

| Page | What you can do |
| --- | --- |
| Swipe | Discover, like/pass, open details |
| Gallery | Browse all plants with filters |
| Search | Combine text + color + season + rarity |
| Garden List | See your gardens and create new ones |
| Garden Dashboard | Track inventory, events, and streaks |
| Profile | Manage your identity and preferences |
| Admin | Branches, pull latest, restart API, sync schema |

---

## 🆚 How PlantSwipe compares

|  | PlantSwipe | Spreadsheet | Generic plant app | Marketplace |
| --- | --- | --- | --- | --- |
| Discovery UX | ✅ Swipe, badges, animations | ❌ Manual, text‑heavy | ➖ Varies | ➖ Catalog‑first |
| Data accuracy | ✅ Typed, normalized | ❌ Error‑prone | ➖ Mixed | ➖ Seller‑biased |
| Collaboration | ✅ Built‑in path | ➖ Difficult | ➖ Varies | ➖ Limited |
| Care guidance | ✅ Clear hints | ❌ None | ➖ Sometimes | ➖ Sales‑oriented |
| Extensibility | ✅ Modern web stack | ❌ Hard | ➖ Limited | ➖ Locked |

---

## 🧪 Quick start

1) Install dependencies
```bash
cd plant-swipe
npm install
```

2) Configure environment
```bash
# plant-swipe/.env (client‑side)
VITE_SUPABASE_URL=YOUR_SUPABASE_URL
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY

# plant-swipe/.env.server (server‑only)
# DATABASE_URL=postgresql://user:pass@host:5432/dbname?sslmode=require
# or use PGHOST/PGUSER/PGPASSWORD/PGDATABASE
# If using Supabase DB:
# SUPABASE_URL=https://<project>.supabase.co
# SUPABASE_DB_PASSWORD=your_password
```

3) Run locally (two terminals)
```bash
# Terminal A: API on http://localhost:3000
npm run --prefix plant-swipe serve

# Terminal B: Web on http://127.0.0.1:5173 (proxied to /api)
npm run --prefix plant-swipe dev
```

---

## 🏗️ Tech, at a glance

- ⚛️ React 19 + TypeScript + Vite 7
- 🎨 Tailwind CSS + shadcn‑inspired UI + lucide icons
- 🎬 Framer Motion for delightful interactions
- 🗄️ Supabase (Postgres + Auth)
- 🧩 Express server for `/api/*` and production static files

For a deeper technical deep‑dive, see `plant-swipe/README.md`.

---

## 🗺️ Roadmap

| Status | Item |
| --- | --- |
| ✅ | Swipe discovery MVP |
| ✅ | Gallery, search, and filters |
| ✅ | Admin console (branches, pull, restart, schema sync) |
| ⏳ | Garden events with reminders |
| ⏳ | Collaborative collections and sharing |
| 🔬 | Advanced recommendations |

---

## ❓ FAQ

- **Is it open‑source?** Yes — use, learn, and adapt.
- **Can I plug in my own database?** Yes — point the server to your Postgres.
- **Does the client leak secrets?** No — only `VITE_*` env vars are exposed to the browser.

---

## 🔧 Production snippet

```bash
cd plant-swipe
npm ci
npm run build
sudo rsync -avh --delete ./dist/ /var/www/plant-swipe/
sudo systemctl reload nginx
```

---

## 👩‍🎨 Creators

Made with love by **Neolite** and **Five** — a duo obsessed with playful UX, clear architecture, and tools that help communities grow. 🌿💚

Happy digital gardening with PlantSwipe! 🌼
