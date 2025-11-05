# 🌿 PlantSwipe — fall in love with plants, one swipe at a time

<div align="center">

**PlantSwipe turns plant discovery into a joyful, visual, swipe-first experience — while giving serious growers structured data, care guidance, and collaboration tools. It's where curiosity meets craftsmanship.** 🌱✨

[![Features](#features)](#features) • [![Quick Start](#quick-start)](#quick-start) • [![Tech Stack](#tech-stack)](#tech-stack) • [![Roadmap](#roadmap)](#roadmap)

Made with care by **Neolite** & **Five**

</div>

---

## ✨ What makes PlantSwipe special

| Feature | Description |
|---------|-------------|
| 🎯 **Playful Discovery** | Swipe cards that feel instant and alive with smooth animations |
| 📚 **Structured Knowledge** | Typed plant data, seasons, rarity, care, and meanings |
| 🔍 **Smart Search** | Filter by colors, seasons, rarity, and full-text search |
| 👥 **Social Features** | Friends system, public profiles, activity tracking |
| 🌍 **Multi-language** | Built-in i18n (English/French) with DeepL translation support |
| 🌱 **Grow Together** | Gardens, inventories, streaks, and shared activity |
| 🛠️ **Developer-friendly** | Modern, readable stack with clear, safe conventions |

---

## 🚀 Feature Overview

### Core Features

<details>
<summary><strong>🎴 Swipe Discovery</strong> — Explore plants with intuitive gestures</summary>

- **Like/Pass Gestures**: Swipe right to like, left to pass
- **Smooth Animations**: Powered by Framer Motion for delightful interactions
- **Plant Details**: Tap to view comprehensive information
- **Favorites System**: Save your favorite plants for easy access
- **Filtered Swiping**: Only see seeds, favorites, or specific categories

</details>

<details>
<summary><strong>📖 Rich Plant Profiles</strong> — Comprehensive plant information</summary>

- **Scientific Names**: Botanical nomenclature
- **Meanings & Symbolism**: Cultural and emotional significance
- **Visual Attributes**: Color palettes and seasonal information
- **Rarity Classifications**: Common, Uncommon, Rare, Legendary
- **Care Instructions**: Soil, watering, and maintenance guidance
- **Multi-language Support**: View plants in your preferred language

</details>

<details>
<summary><strong>🔍 Powerful Search & Filters</strong> — Find exactly what you're looking for</summary>

| Filter Type | Options |
|------------|---------|
| **Text Search** | Full-text search across plant names and descriptions |
| **Color** | Filter by flower/foliage colors |
| **Season** | Spring, Summer, Autumn, Winter |
| **Rarity** | Common, Uncommon, Rare, Legendary |
| **Type** | Seeds-only filter |
| **Favorites** | Show only liked plants |

</details>

<details>
<summary><strong>🌱 Garden Tools</strong> — Manage your plant collections</summary>

- **Multiple Gardens**: Create and manage multiple garden spaces
- **Dashboard Views**: Track inventory, events, and progress
- **Planting Timelines**: Visual calendar of planting schedules
- **Task Management**: Create, edit, and track plant care tasks
- **Activity Tracking**: Monitor streaks and completion rates
- **Collaboration**: Share gardens with friends
- **Role Management**: Owner/member permissions

</details>

<details>
<summary><strong>👥 Social Features</strong> — Connect with fellow gardeners</summary>

- **Friend System**: Send and accept friend requests
- **Public Profiles**: Share your gardening journey
- **Profile Stats**: Plants owned, gardens count, streaks
- **Activity Heatmap**: GitHub-style contribution graph
- **Privacy Controls**: Private profiles, disable friend requests
- **Profile Customization**: Display name, bio, country, avatar

</details>

<details>
<summary><strong>🌍 Internationalization</strong> — Multi-language support</summary>

| Language | Status | Features |
|----------|--------|----------|
| **English** | ✅ Default | Full UI + Plant translations |
| **French** | ✅ Supported | Full UI + DeepL auto-translation |

- **URL-based Routing**: `/en/...` and `/fr/...` paths
- **Browser Detection**: Auto-detects preferred language
- **Plant Translations**: Separate translations for plant data
- **DeepL Integration**: Auto-translate plant information
- **Persistent Preferences**: Saves language choice

</details>

<details>
<summary><strong>⚙️ Admin Console</strong> — Powerful management tools</summary>

- **Git Integration**: View branches, pull latest changes
- **Service Management**: Restart API and services
- **Schema Sync**: Safe database migration tools
- **Member Management**: Search users, view profiles
- **Analytics Dashboard**: Charts and statistics
- **Action Logging**: Track admin actions
- **Security**: Token-based authentication

</details>

---

## 🔄 How it Works

```mermaid
flowchart TB
    User[👤 User] -->|Swipe / Search| Web[⚡ React + Vite]
    Web -->|/api/*| API[🧩 Express API]
    API -->|SQL Queries| DB[(🌳 Postgres via Supabase)]
    API -->|Static Files| Static[📦 Static dist]
    Static -->|Serve| Web
    DB -->|Auth| Auth[🔐 Supabase Auth]
    Auth -->|User Data| Web
    API -->|DeepL API| DeepL[🌐 DeepL Translation]
    DeepL -->|Translations| API
    Web -->|i18n| Lang[🌍 Language Routing]
    
    style User fill:#e1f5e1
    style Web fill:#fff4e1
    style API fill:#e1f0ff
    style DB fill:#ffe1e1
    style Auth fill:#e1e1ff
    style DeepL fill:#e1ffe1
```

---

## 📊 Application Architecture

<details>
<summary><strong>Frontend Architecture</strong></summary>

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Framework** | React 19 + TypeScript | Modern UI with type safety |
| **Build Tool** | Vite 7 | Fast development and builds |
| **Styling** | Tailwind CSS | Utility-first styling |
| **UI Components** | shadcn/ui inspired | Accessible component library |
| **Animations** | Framer Motion | Smooth interactions |
| **Icons** | Lucide React | Beautiful icon set |
| **Routing** | React Router v7 | Client-side routing |
| **i18n** | react-i18next | Internationalization |
| **Charts** | Recharts | Data visualization |

</details>

<details>
<summary><strong>Backend Architecture</strong></summary>

| Component | Technology | Purpose |
|-----------|------------|---------|
| **API Server** | Express.js | RESTful API endpoints |
| **Database** | PostgreSQL (Supabase) | Relational data storage |
| **Auth** | Supabase Auth | User authentication |
| **Translation** | DeepL API | Automatic translations |
| **Admin API** | Python Flask | Admin operations |
| **Static Serving** | Express | Production file serving |

</details>

---

## 🖼️ Screens & Capabilities

| Page | Route | Features |
|------|-------|----------|
| **🔄 Swipe** | `/` | Discover, like/pass, open details, filters |
| **🖼️ Gallery** | `/gallery` | Browse all plants with advanced filters |
| **🔍 Search** | `/search` | Combine text + color + season + rarity |
| **🌱 Gardens** | `/gardens` | List gardens, create new ones |
| **📊 Dashboard** | `/garden/:id` | Track inventory, events, streaks, tasks |
| **👤 Profile** | `/u/:username` | Public profile with stats and heatmap |
| **👥 Friends** | `/friends` | Manage friends, send requests |
| **⚙️ Settings** | `/settings` | Account, privacy, language preferences |
| **➕ Create Plant** | `/create` | Add new plants with translations |
| **✏️ Edit Plant** | `/edit/:id` | Update plant information |
| **🔧 Admin** | `/admin` | Git, services, schema, analytics |

---

## 🧪 Quick Start

<details>
<summary><strong>📋 Prerequisites</strong></summary>

- Node.js 18+ and npm
- PostgreSQL database (or Supabase account)
- (Optional) DeepL API key for translations

</details>

<details>
<summary><strong>⚙️ Installation</strong></summary>

### 1. Install Dependencies

```bash
cd plant-swipe
npm install
```

### 2. Configure Environment

Create `plant-swipe/.env` (client-side):

```bash
VITE_SUPABASE_URL=YOUR_SUPABASE_URL
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Create `plant-swipe/.env.server` (server-only):

```bash
# Option 1: Direct PostgreSQL connection
DATABASE_URL=postgresql://user:pass@host:5432/dbname?sslmode=require

# Option 2: PostgreSQL via environment variables
PGHOST=your-host
PGUSER=your-user
PGPASSWORD=your-password
PGDATABASE=your-database

# Option 3: Supabase database
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_DB_PASSWORD=your_password

# Optional: DeepL Translation API
DEEPL_API_KEY=your-deepl-api-key
```

### 3. Run Locally

**Terminal A** — API Server (http://localhost:3000):

```bash
npm run --prefix plant-swipe serve
```

**Terminal B** — Development Server (http://127.0.0.1:5173):

```bash
npm run --prefix plant-swipe dev
```

The dev server proxies `/api/*` requests to the API server automatically.

</details>

<details>
<summary><strong>🏗️ Building for Production</strong></summary>

```bash
cd plant-swipe
npm ci
npm run build
```

The `dist/` folder contains the production build. Deploy to your static hosting:

```bash
# Example: Deploy to server
sudo rsync -avh --delete ./dist/ /var/www/plant-swipe/
sudo systemctl reload nginx
```

</details>

---

## 🌟 Who it's for

| Audience | Use Case |
|----------|----------|
| **🌱 Plant Lovers** | Discover new favorites in seconds and learn as you go |
| **👨‍🌾 Gardeners & Clubs** | Plan plantings, track events, and celebrate progress |
| **📚 Educators & Libraries** | Curate collections by meaning, season, and care |
| **🏪 Nurseries & Communities** | Showcase varieties and invite participation |

---

## 💚 Why people love it

- ✨ **Feels magical**: Fluid swipes, gentle animations, instant feedback
- 📖 **Teaches without effort**: Scientific names, meanings, colors — always at hand
- 📈 **Grows with you**: From casual browsing to full garden dashboards
- 🚀 **No heavy setup**: Works locally, deploys cleanly, extends easily
- 🌍 **Multi-language**: Built-in support for multiple languages
- 👥 **Social**: Connect with friends and share your gardening journey

---

## 📦 Popular Use Cases

<details>
<summary><strong>Example Scenarios</strong></summary>

1. **Discover plants** to match a color palette or season
2. **Track seeds and plants** across personal or community gardens
3. **Create themed collections** for workshops or classes
4. **Run a kiosk-style** "plant matcher" at events
5. **Build a community** around shared gardening interests
6. **Learn plant care** through structured, searchable information

</details>

---

## 🗺️ Roadmap

| Status | Feature | Priority |
|--------|---------|----------|
| ✅ | Swipe discovery MVP | Complete |
| ✅ | Gallery, search, and filters | Complete |
| ✅ | Admin console (branches, pull, restart, schema sync) | Complete |
| ✅ | Friends system and public profiles | Complete |
| ✅ | Multi-language support (i18n) | Complete |
| ✅ | Plant translations (DeepL) | Complete |
| ⏳ | Garden events with reminders | In Progress |
| ⏳ | Collaborative collections and sharing | Planned |
| 🔬 | Advanced recommendations | Research |
| 🔬 | Mobile app (React Native) | Future |
| 🔬 | Plant disease identification | Future |

---

## 🛠️ Tech Stack

<details>
<summary><strong>Frontend Technologies</strong></summary>

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.1.1 | UI framework |
| TypeScript | 5.8.3 | Type safety |
| Vite | 7.1.2 | Build tool |
| Tailwind CSS | 3.4.17 | Styling |
| Framer Motion | 12.23.12 | Animations |
| React Router | 7.8.2 | Routing |
| react-i18next | 16.2.4 | i18n |
| Recharts | 3.2.1 | Charts |

</details>

<details>
<summary><strong>Backend Technologies</strong></summary>

| Technology | Version | Purpose |
|------------|---------|---------|
| Express | 4.19.2 | API server |
| PostgreSQL | Via Supabase | Database |
| Supabase JS | 2.57.2 | Database client |
| DeepL API | - | Translations |
| Python Flask | - | Admin API |

</details>

---

## ❓ FAQ

<details>
<summary><strong>Common Questions</strong></summary>

**Q: Is it open-source?**  
A: Yes — use, learn, and adapt freely.

**Q: Can I plug in my own database?**  
A: Yes — point the server to your Postgres instance using environment variables.

**Q: Do I need Supabase?**  
A: No — you can use any PostgreSQL database. Supabase provides auth and hosting convenience.

**Q: How do translations work?**  
A: Plant data can be translated manually or automatically via DeepL API integration.

**Q: Can I add more languages?**  
A: Yes — extend `SUPPORTED_LANGUAGES` in the i18n config and add translation files.

**Q: Is there a mobile app?**  
A: Not yet — the web app is mobile-responsive. A native app is on the roadmap.

</details>

---

## 📚 Documentation

- **[Technical README](./plant-swipe/README.md)** — Deep dive for engineers
- **[DeepL Setup Guide](./plant-swipe/DEEPL_API_SETUP.md)** — Translation API configuration
- **[Admin API](./admin_api/)** — Admin endpoint documentation

---

## 👉 Get Involved

- ⭐ **Star the repo** to follow progress
- 🐛 **Open issues** for bugs or ideas
- 🔧 **Submit PRs** — the codebase is designed to be friendly
- 🌱 **Share PlantSwipe** with a gardener you love
- 📖 **Improve docs** — help others discover and use PlantSwipe

---

## 👩‍🎨 Creators

Made with love by **Neolite** and **Five** — a duo obsessed with playful UX, clear architecture, and tools that help communities grow. 🌿💚

---

<div align="center">

**Happy digital gardening with PlantSwipe!** 🌼

[Get Started](#quick-start) • [View Features](#feature-overview) • [Read Docs](./plant-swipe/README.md)

</div>
