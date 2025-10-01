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



---

## 🌟 Who it's for

- **Plant lovers**: discover new favorites in seconds and learn as you go.
- **Gardeners & clubs**: plan plantings, track events, and celebrate progress.
- **Educators & libraries**: curate collections by meaning, season, and care.
- **Nurseries & communities**: showcase varieties and invite participation.

---

## 💚 Why people love it

- **Feels magical**: fluid swipes, gentle animations, instant feedback.
- **Teaches without effort**: scientific names, meanings, colors — always at hand.
- **Grows with you**: from casual browsing to full garden dashboards.
- **No heavy setup**: works locally, deploys cleanly, extends easily.

---

## 📦 Popular use cases

- Discover plants to match a color palette or season.
- Track seeds and plants across personal or community gardens.
- Create themed collections for workshops or classes.
- Run a kiosk‑style “plant matcher” at events.

---

## 💬 What early users say

> “I found three plants I’d never heard of in five minutes.” — A.

> “Our club finally tracks garden tasks without spreadsheets.” — M.

> “The swipe UI makes learning plant names actually fun.” — R.

---

## 👉 Get involved

- ⭐ Star the repo to follow progress
- 🐛 Open issues for bugs or ideas
- 🔧 Submit PRs — the codebase is designed to be friendly
- 🌱 Share PlantSwipe with a gardener you love

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
