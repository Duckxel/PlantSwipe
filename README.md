# 🌿 PlantSwipe — swipe to discover plants you’ll love

Fall in love with plants, one delightful swipe at a time. PlantSwipe turns plant discovery into a playful, visual experience while keeping serious growers happy with accurate data, care guides, and collaborative tools. 🌱✨

Built with care by Neolite & Five.

---

## 💡 Why PlantSwipe?

- 🌸 Fun first: a smooth, card-based swipe UI that feels instantly familiar.
- 🌍 Community-powered: a shared catalog of plants and seeds you can browse and enrich.
- 🔎 Powerful search: filter by name, colors, seasons, rarity, and more.
- 📚 Learn as you go: scientific names, meanings, and practical care advice.
- 🧑‍🤝‍🧑 Grow together: gardens, inventories, and activity tracking (designed to scale).

---

## 🚀 Highlights at a glance

| 🌟 Feature | What you get |
| --- | --- |
| Swipe-to-discover | Fast, visual exploration with like/pass interactions |
| Rich plant profiles | Images, seasons, rarity, care guides, and meanings |
| Smart search | Filter by colors, seasons, rarity, and text queries |
| Collaborative data | A community-enriched catalog of plants and seeds |
| Admin tooling | Branch listing, pull latest, restart server, sync schema |
| Modern stack | React + Vite + Tailwind + Supabase + Express |

---

## 🔄 How it works (at a glance)

```mermaid
flowchart LR
  User[🧑‍🌾 User] -->|Swipe / Search| Web[⚡ React + Vite]
  Web -->|/api/*| API[🧩 Express]
  API -->|SQL| DB[(🌳 Postgres via Supabase)]
  API --> Static[📦 Static dist]
  Static --> User
```

---

## 🆚 Comparison

| | PlantSwipe | Spreadsheet | Generic plant app |
| --- | --- | --- | --- |
| Discovery UX | ✅ Swipe, badges, animations | ❌ Manual, text-heavy | ➖ Varies |
| Data accuracy | ✅ Structured, typed | ❌ Error-prone | ➖ Mixed |
| Collaboration | ✅ Built-in path | ➖ Difficult | ➖ Varies |
| Care guidance | ✅ Clear, human + derived hints | ❌ None | ➖ Sometimes |
| Extensibility | ✅ Modern web stack | ❌ Hard | ➖ Limited |

---

## 🧪 Quick start

1) Install dependencies
```bash
cd plant-swipe
npm install
```

2) Configure environment
```bash
# plant-swipe/.env (client-side)
VITE_SUPABASE_URL=YOUR_SUPABASE_URL
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY

# plant-swipe/.env.server (server-only)
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

## 🏗️ Tech stack

- ⚛️ React 19 + TypeScript + Vite
- 🎨 Tailwind CSS + shadcn-inspired UI components
- 🗄️ Supabase (Postgres + Auth)
- 🧩 Express server (serves `/api/*` and production static files)

For a deeper technical deep-dive, see `plant-swipe/README.md`.

---

## 🔧 Production deployment (snippet)

```bash
cd plant-swipe
npm ci
npm run build
sudo rsync -avh --delete ./dist/ /var/www/plant-swipe/
sudo systemctl reload nginx
```

---

## 👩‍🎨 Creators

Made with love by **Neolite** and **Five** — builders who care about playful design, clear architecture, and tools that help communities grow. 🌿

---

Happy digital gardening with PlantSwipe! 🌼
