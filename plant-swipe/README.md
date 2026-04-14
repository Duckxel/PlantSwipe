# 🔬 Aphylia — Technical Documentation

<div align="center">

![Build](https://img.shields.io/badge/Build-Passing-brightgreen?style=flat-square)
![Bun](https://img.shields.io/badge/Bun-1.x-f9f1e1?style=flat-square&logo=bun)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-3178c6?style=flat-square&logo=typescript)
![React](https://img.shields.io/badge/React-19.1.1-61dafb?style=flat-square&logo=react)
![Vite](https://img.shields.io/badge/Vite-7.1.2-646cff?style=flat-square&logo=vite)

**Comprehensive technical documentation for developers and engineers working with Aphylia**

[**Architecture**](#-architecture) • [**Setup**](#-setup--configuration) • [**API**](#-api-reference) • [**Database**](#-database-schema)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Architecture](#-architecture)
- [Project Structure](#-project-structure)
- [Setup & Configuration](#-setup--configuration)
- [Development Workflow](#-development-workflow)
- [Database Schema](#-database-schema)
- [API Reference](#-api-reference)
- [Internationalization](#-internationalization)
- [Translation System](#-translation-system)
- [Authentication](#-authentication)
- [Progressive Web App](#-progressive-web-app)
- [Performance](#-performance)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)

---

## 📖 Overview

Aphylia is a modern Progressive Web Application built with **React 19**, **TypeScript**, **Vite 7**, and **Express.js**, connecting to a **PostgreSQL** database via **Supabase**. It features a swipe-first UI for plant discovery, comprehensive garden management, social features with real-time messaging, AI-powered plant scanning, content moderation tools, and multi-language support.

### Key Technologies

| Layer | Technology | Version |
|-------|------------|---------|
| **Package Manager** | Bun | 1.x |
| **Frontend** | React | 19.1.1 |
| **Language** | TypeScript | 5.8.3 |
| **Build Tool** | Vite | 7.1.2 |
| **Styling** | Tailwind CSS | 3.4.17 |
| **Backend** | Express.js | 4.19.2 |
| **Database** | PostgreSQL | Via Supabase |
| **Auth** | Supabase Auth | 2.57.2 |
| **i18n** | react-i18next | 16.2.4 |
| **PWA** | vite-plugin-pwa | 1.1.0 |

> 💡 **Bun** is used as the primary package manager and runtime, offering ~7x faster package installation compared to npm. See [BUN_MIGRATION.md](./BUN_MIGRATION.md) for details.

---

## 🏗️ Architecture

### System Architecture

```mermaid
flowchart TB
    subgraph Client["🌐 Client Browser"]
        PWA[Progressive Web App]
        SW[Service Worker]
        React[React App]
        Vite[Vite Dev Server]
    end
    
    subgraph Server["🖥️ Express Server"]
        ExpressAPI[Express API]
        StaticServe[Static File Server]
    end
    
    subgraph AdminServer["🔧 Admin Server"]
        Flask[Python Flask API]
    end
    
    subgraph Database["💾 Database Layer"]
        Supabase[(Supabase/Postgres)]
        Auth[Supabase Auth]
        Realtime[Supabase Realtime]
        Cache[Task Cache Tables]
    end
    
    subgraph External["🌍 External Services"]
        DeepL[DeepL Translation API]
        Resend[Resend Email API]
        OpenAI[OpenAI API]
        Sentry[Sentry Monitoring]
    end
    
    PWA --> SW
    SW --> React
    React -->|HTTP Requests| ExpressAPI
    React -->|WebSocket| Realtime
    Vite -->|Proxy /api/*| ExpressAPI
    ExpressAPI -->|SQL Queries| Supabase
    ExpressAPI -->|Auth Requests| Auth
    ExpressAPI -->|Translation| DeepL
    ExpressAPI -->|Static Files| StaticServe
    StaticServe -->|Production Build| React
    Flask -->|Admin Ops| Supabase
    Flask -->|Emails| Resend
    ExpressAPI -->|AI Features| OpenAI
    ExpressAPI -->|Error Tracking| Sentry
    
    style React fill:#61dafb
    style ExpressAPI fill:#339933
    style Supabase fill:#3ecf8e
    style DeepL fill:#0f2b46
    style PWA fill:#5a0fc8
```

### Request Flow

```mermaid
sequenceDiagram
    participant User
    participant SW as Service Worker
    participant React
    participant Vite
    participant Express
    participant Supabase
    
    User->>React: Interact with UI
    React->>SW: Check Cache
    alt Cache Hit
        SW-->>React: Cached Response
    else Cache Miss
        SW->>Vite: API Request (/api/*)
        Vite->>Express: Proxy Request
        Express->>Supabase: SQL Query
        Supabase-->>Express: Data Response
        Express-->>Vite: JSON Response
        Vite-->>SW: Response
        SW->>SW: Cache Response
        SW-->>React: Fresh Response
    end
    React->>User: Update UI
```

---

## 📁 Project Structure

```
plant-swipe/
├── src/
│   ├── components/           # Reusable UI components
│   │   ├── admin/           # Admin console components
│   │   ├── aphylia/         # Aphylia AI chat components
│   │   ├── blog/            # Blog editor and cards
│   │   ├── email/           # Email template components
│   │   ├── garden/          # Garden management components
│   │   ├── i18n/            # i18n-aware Link, Navigate, NavLink
│   │   ├── layout/          # Layout (TopBar, BottomBar, Footer)
│   │   ├── messaging/       # Private messaging & conversations
│   │   ├── moderation/      # User reporting, blocking, banning
│   │   ├── plant/           # Plant-related components
│   │   ├── profile/         # Profile and bookmarks
│   │   ├── pwa/             # PWA components (ServiceWorkerToast)
│   │   ├── seedling-tray/   # Seedling tray management components
│   │   ├── tiptap-*/        # TipTap rich text editor components
│   │   ├── tutorial/        # Onboarding tutorial overlay
│   │   └── ui/              # shadcn-inspired UI primitives (incl. pixel-sprite/)
│   ├── constants/           # Constants and configuration
│   │   ├── badges.ts        # Badge definitions
│   │   ├── classification.ts # Plant classifications
│   │   ├── plantStatus.ts   # Plant status enums
│   │   ├── seo.ts           # SEO constants
│   │   └── userRoles.ts     # User role definitions
│   ├── context/             # React context providers
│   │   ├── AuthContext.tsx   # Authentication state
│   │   ├── AuthActionsContext.tsx # Auth actions (login, signup, etc.)
│   │   ├── EggHuntContext.tsx # Event system provider (active events, progress, badge awards)
│   │   ├── ThemeContext.tsx  # Theme (dark/light) state
│   │   └── TutorialContext.tsx # Onboarding tutorial state and navigation
│   ├── hooks/               # Custom React hooks
│   │   ├── use-*.ts         # Various utility hooks
│   │   ├── useAphyliaChat.ts # AI chat assistant hook
│   │   ├── useMessageNotifications.ts # Message notification handling
│   │   ├── usePageMetadata.ts # Page SEO metadata
│   │   ├── usePushSubscription.ts # Push notification handling
│   │   ├── useSentry.ts     # Error tracking hook
│   │   └── useTaskNotification.ts # Task reminder notifications
│   ├── platform/            # Device abstraction layer (web-first, Capacitor fallback)
│   ├── lib/                 # Utility libraries (40+ modules)
│   │   ├── i18n.ts          # i18n configuration
│   │   ├── i18nRouting.ts   # Language routing helpers
│   │   ├── supabaseClient.ts # Supabase client setup
│   │   ├── gardens.ts       # Garden API functions
│   │   ├── messaging.ts     # Messaging API functions
│   │   ├── moderation.ts    # Moderation API functions
│   │   ├── photos.ts        # Photo handling
│   │   ├── plantTranslations.ts # Plant translation utilities
│   │   ├── plantScan.ts     # AI plant scanning
│   │   ├── deepl.ts         # DeepL API integration
│   │   ├── pushNotifications.ts # Push notification logic
│   │   ├── realtime.ts      # Realtime subscriptions
│   │   ├── sentry.ts        # Error tracking setup
│   │   ├── gdprAnalytics.ts # GDPR-compliant analytics
│   │   ├── recaptcha.ts     # reCAPTCHA integration
│   │   └── ...              # Other utilities
│   ├── pages/               # Page components (30+ route pages)
│   ├── styles/              # Global styles and variables
│   ├── types/               # TypeScript type definitions (plant, garden, blog, messaging, moderation, scan, etc.)
│   ├── App.tsx              # Root component with routing
│   ├── PlantSwipe.tsx       # Main app wrapper
│   ├── sw.ts                # Service worker source
│   └── main.tsx             # Entry point
├── public/
│   ├── locales/             # Translation files
│   │   ├── en/              # English translations
│   │   └── fr/              # French translations
│   ├── icons/               # PWA icons
│   ├── env-loader.js        # Runtime environment loader
│   ├── env.js               # Environment variables
│   ├── offline.html         # Offline fallback page
│   └── robots.txt           # Robots configuration
├── scripts/
│   ├── apply_migration.js    # Apply database migrations
│   ├── assert-capacitor-store-bundle.mjs # Verify no server.url in store builds
│   ├── cap-ci-sync.mjs       # CI-aware Capacitor sync
│   ├── check-translations.js # Validate translation files
│   ├── generate-sitemap.js   # Generate sitemap.xml
│   ├── sync-email-template.sh # Sync email templates
│   ├── sync-native-version.mjs # Propagate version to native projects
│   └── verify_email_sanitization.ts # Email sanitization verification
├── supabase/
│   ├── functions/           # Supabase Edge Functions
│   │   ├── _shared/        # Shared utilities for Edge Functions
│   │   ├── contact-support/ # Contact form handler
│   │   └── email-campaign-runner/ # Email campaigns
│   ├── sync_parts/          # Schema definition files (20 SQL files)
│   └── migrations/          # Database migrations
├── android/                 # Android native project (Capacitor)
├── ios/                     # iOS native project (Capacitor)
├── capacitor.config.json    # Capacitor configuration
├── server.js                # Express API server
├── vite.config.ts           # Vite configuration
├── tailwind.config.js       # Tailwind configuration
├── tsconfig.json            # TypeScript configuration
└── package.json             # Dependencies
```

---

## ⚙️ Setup & Configuration

<details>
<summary><strong>📦 Environment Variables</strong></summary>

### Client-Side (`plant-swipe/.env`)

```bash
# Supabase Configuration (required)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# App Configuration (optional)
VITE_APP_BASE_PATH=/               # Base path for sub-path deployments
VITE_SITE_URL=https://aphylia.app  # Canonical site URL

# PWA Configuration (optional)
VITE_ENABLE_PWA=false              # Enable PWA in development
VITE_DISABLE_PWA=false             # Disable PWA completely
```

### Server-Side (`plant-swipe/.env.server`)

```bash
# Database Connection (choose one method)

# Method 1: PostgreSQL Connection String
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require

# Method 2: Individual PostgreSQL Variables
PGHOST=your-host
PGUSER=your-user
PGPASSWORD=your-password
PGDATABASE=your-database

# Method 3: Supabase Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_DB_PASSWORD=your-db-password
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Translation API (optional)
DEEPL_API_KEY=your-deepl-api-key
DEEPL_API_URL=https://api.deepl.com/v2/translate

# Email API (optional)
RESEND_API_KEY=your-resend-api-key

# AI Features (optional)
OPENAI_API_KEY=your-openai-api-key

# Sitemap Generation (optional)
PLANTSWIPE_SITE_URL=https://aphylia.app
SITEMAP_DEFAULT_LANGUAGE=en
SITEMAP_MAX_PLANT_URLS=1000
```

</details>

<details>
<summary><strong>🚀 Development Scripts</strong></summary>

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `bun run dev` | Start Vite dev server (port 5173) |
| `serve` | `bun run serve` | Start Express API server (port 3000) |
| `build` | `bun run build` | Build production bundle |
| `build:low-mem` | `bun run build:low-mem` | Build with reduced memory usage |
| `preview` | `bun run preview` | Preview production build |
| `lint` | `bun run lint` | Run ESLint |
| `check-translations` | `bun run check-translations` | Validate translation files |
| `generate:sitemap` | `bun run generate:sitemap` | Generate sitemap.xml |
| `sync-email-template` | `bun run sync-email-template` | Sync email templates |

> 💡 All commands use Bun for faster execution. You can also use `npm run` as a fallback.

</details>

---

## 🔧 Development Workflow

### Installing Dependencies

```bash
# Install Bun if not already installed
curl -fsSL https://bun.sh/install | bash

# Install dependencies (7x faster than npm)
bun install
```

### Running Locally

1. **Start API Server** (Terminal 1):

```bash
bun run serve
# Runs on http://localhost:3000
```

2. **Start Dev Server** (Terminal 2):

```bash
bun run dev
# Runs on http://127.0.0.1:5173
# Proxies /api/* requests to port 3000
```

### Building for Production

```bash
bun install              # Install dependencies
bun run build            # TypeScript compilation + Vite build
# Output: dist/
```

### PWA Development

```bash
# Enable PWA in development
VITE_ENABLE_PWA=true bun run dev

# Disable PWA for fast iteration
VITE_DISABLE_PWA=true bun run build
```

---

## 💾 Database Schema

<details>
<summary><strong>🌱 Core Tables</strong></summary>

### `plants`

Stores base plant information.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `name` | TEXT | Plant name (default language) |
| `scientific_name` | TEXT | Botanical name |
| `color` | TEXT | Flower/foliage color |
| `season` | TEXT | Blooming season |
| `rarity` | TEXT | Rarity classification |
| `meaning` | TEXT | Symbolic meaning |
| `description` | TEXT | Plant description |
| `care_soil` | TEXT | Soil requirements |
| `care_water` | TEXT | Watering needs |
| `care_light` | TEXT | Light requirements |
| `image_url` | TEXT | Primary image URL |
| `created_at` | TIMESTAMP | Creation timestamp |

### `plant_translations`

Stores translations for plant data.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `plant_id` | UUID | Foreign key to `plants` |
| `language` | TEXT | Language code (en, fr) |
| `name` | TEXT | Translated name |
| `scientific_name` | TEXT | Translated scientific name |
| `meaning` | TEXT | Translated meaning |
| `description` | TEXT | Translated description |
| `care_soil` | TEXT | Translated soil care |
| `care_water` | TEXT | Translated water care |
| `care_light` | TEXT | Translated light care |

### `profiles`

User profile information.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key (matches auth.users.id) |
| `display_name` | TEXT | Unique display name |
| `country` | TEXT | User's country |
| `bio` | TEXT | Profile biography |
| `avatar_url` | TEXT | Avatar image URL |
| `is_admin` | BOOLEAN | Admin flag |
| `accent_key` | TEXT | UI accent color preference |
| `is_private` | BOOLEAN | Privacy setting |
| `disable_friend_requests` | BOOLEAN | Friend request control |
| `push_subscription` | JSONB | Push notification subscription |
| `created_at` | TIMESTAMP | Account creation |

</details>

<details>
<summary><strong>🌻 Garden Tables</strong></summary>

### `gardens`

Garden collections.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `name` | TEXT | Garden name |
| `owner_id` | UUID | Foreign key to `profiles` |
| `location` | TEXT | Garden location |
| `latitude` | DECIMAL | GPS latitude |
| `longitude` | DECIMAL | GPS longitude |
| `created_at` | TIMESTAMP | Creation timestamp |

### `garden_plants`

Plants in gardens.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `garden_id` | UUID | Foreign key to `gardens` |
| `plant_id` | UUID | Foreign key to `plants` |
| `user_id` | UUID | Foreign key to `profiles` |
| `planted_at` | TIMESTAMP | Planting date |
| `quantity` | INTEGER | Number of plants |
| `notes` | TEXT | Plant notes |

### `garden_plant_tasks`

Recurring tasks for garden plants.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `garden_plant_id` | UUID | Foreign key to `garden_plants` |
| `task_type` | TEXT | water, fertilize, harvest, cut, custom |
| `custom_label` | TEXT | Custom task label |
| `recurrence` | JSONB | Recurrence pattern |
| `created_at` | TIMESTAMP | Task creation |

### `garden_plant_task_occurrences`

Individual task occurrences.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `task_id` | UUID | Foreign key to `garden_plant_tasks` |
| `due_date` | DATE | Due date |
| `completed_at` | TIMESTAMP | Completion timestamp |
| `skipped` | BOOLEAN | Whether skipped |

</details>

<details>
<summary><strong>👥 Social Tables</strong></summary>

### `friends`

Bidirectional friendship relationships.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Foreign key to `profiles` |
| `friend_id` | UUID | Foreign key to `profiles` |
| `created_at` | TIMESTAMP | Friendship creation |

### `friend_requests`

Friend request management.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `requester_id` | UUID | Foreign key to `profiles` |
| `recipient_id` | UUID | Foreign key to `profiles` |
| `status` | TEXT | pending, accepted, rejected |
| `created_at` | TIMESTAMP | Request creation |

### `bookmarks`

User bookmark collections. Each user gets one special "Likes" bookmark (`is_like = true`) on signup — always private, cannot be deleted or duplicated.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Foreign key to `auth.users` |
| `name` | TEXT | Bookmark collection name |
| `visibility` | TEXT | `public` or `private` |
| `is_like` | BOOLEAN | True for the special Likes bookmark (one per user) |
| `created_at` | TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP | Last update timestamp |

### `bookmark_items`

Plants saved to bookmark collections.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `bookmark_id` | UUID | Foreign key to `bookmarks` |
| `plant_id` | TEXT | Plant identifier |
| `created_at` | TIMESTAMP | When added |

</details>

<details>
<summary><strong>📦 Cache Tables</strong></summary>

### `garden_task_daily_cache`

Daily task statistics per garden.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `garden_id` | UUID | Foreign key to `gardens` |
| `cache_date` | DATE | Cache date |
| `due_count` | INTEGER | Tasks due |
| `completed_count` | INTEGER | Tasks completed |
| `task_count` | INTEGER | Total tasks |
| `occurrence_count` | INTEGER | Total occurrences |

### `garden_task_weekly_cache`

Weekly task breakdowns.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `garden_id` | UUID | Foreign key to `gardens` |
| `week_start_date` | DATE | Week start |
| `mon_count` ... `sun_count` | INTEGER | Daily counts |
| `water_count` ... `custom_count` | INTEGER | Type counts |

</details>

---

## 🔌 API Reference

<details>
<summary><strong>🌱 Plant Endpoints</strong></summary>

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/plants` | Get all plants (with optional filters) |
| `GET` | `/api/plants/:id` | Get single plant by ID |
| `POST` | `/api/plants` | Create new plant |
| `PUT` | `/api/plants/:id` | Update plant |
| `DELETE` | `/api/plants/:id` | Delete plant |
| `GET` | `/api/plants/:id/translations` | Get plant translations |
| `POST` | `/api/plants/:id/translations` | Create/update translations |

</details>

<details>
<summary><strong>🌐 Translation Endpoints</strong></summary>

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/translate` | Translate text via DeepL |

**Request Body:**

```json
{
  "text": "Hello world",
  "source_lang": "EN",
  "target_lang": "FR"
}
```

**Response:**

```json
{
  "translatedText": "Bonjour le monde"
}
```

</details>

<details>
<summary><strong>🔧 Admin Endpoints</strong></summary>

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/admin/branches` | List git branches |
| `POST` | `/api/admin/pull` | Pull latest changes |
| `POST` | `/api/admin/restart` | Restart service |
| `POST` | `/api/admin/sync-schema` | Sync database schema |
| `GET` | `/api/admin/member` | Search member by email |
| `POST` | `/api/admin/log-action` | Log admin action |
| `POST` | `/api/admin/upload` | Upload media file |

</details>

<details>
<summary><strong>💬 Messaging Endpoints</strong></summary>

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/conversations` | List user conversations |
| `GET` | `/api/conversations/:id/messages` | Get messages in a conversation |
| `POST` | `/api/conversations` | Create a new conversation |
| `POST` | `/api/conversations/:id/messages` | Send a message |

</details>

<details>
<summary><strong>🛡️ Moderation Endpoints</strong></summary>

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/report` | Report a user or content |
| `POST` | `/api/block` | Block a user |
| `DELETE` | `/api/block/:id` | Unblock a user |

</details>

<details>
<summary><strong>📊 Supabase RPC Functions</strong></summary>

### User Functions

- `get_user_profile_public_stats(_user_id)` — Get user statistics
- `get_user_daily_tasks(_user_id, _start, _end)` — Get task completion data
- `get_user_private_info(_user_id)` — Get private user information
- `get_friend_count(_user_id)` — Count user's friends
- `get_friend_email(_friend_id)` — Get friend's email (privacy-aware)
- `get_friend_request_requester_email(_requester_id)` — Get requester email

### Profile Functions

- `get_profile_public_by_display_name(_name)` — Get public profile by display name

### Friend Functions

- `accept_friend_request(_request_id)` — Accept friend request and create friendship

### Cache Functions

- `refresh_garden_daily_cache(_garden_id, _date)` — Refresh daily cache
- `refresh_garden_weekly_cache(_garden_id, _week_start)` — Refresh weekly cache
- `refresh_garden_task_cache(_garden_id, _date)` — Refresh all caches
- `cleanup_old_garden_task_cache()` — Clean old cache entries

</details>

---

## 🌍 Internationalization

<details>
<summary><strong>📖 i18n Configuration</strong></summary>

### Supported Languages

| Language | Code | Status |
|----------|------|--------|
| English | `en` | ✅ Default |
| French | `fr` | ✅ Supported |

### Language Routing

- **Default Route**: `/` (English)
- **Language Prefix**: `/en/...`, `/fr/...`
- **Auto-detection**: Browser language preference
- **Persistent**: Saved in localStorage

### Translation Files

Located in `public/locales/{lang}/`:

```
public/locales/
├── en/
│   ├── common.json       # Common UI strings
│   ├── About.json        # About page strings
│   ├── Landing.json      # Landing page strings
│   ├── email.json        # Email templates
│   ├── plantAdmin.json   # Plant admin strings
│   └── plantInfo.json    # Plant info strings
└── fr/
    ├── common.json
    ├── About.json
    ├── Landing.json
    ├── email.json
    ├── plantAdmin.json
    └── plantInfo.json
```

### Usage in Components

```typescript
import { useTranslation } from 'react-i18next'

function MyComponent() {
  const { t } = useTranslation('common')
  return <div>{t('welcome')}</div>
}
```

### i18n-Aware Routing

Use the custom Link components from `@/components/i18n`:

```typescript
import { Link, NavLink, Navigate } from '@/components/i18n'

// These automatically include the current language prefix
<Link to="/gardens">Gardens</Link>  // Renders as /en/gardens or /fr/gardens
```

</details>

---

## 🔄 Translation System

<details>
<summary><strong>🌐 Plant Translations</strong></summary>

### Translation Flow

```mermaid
flowchart LR
    Create[Create Plant] --> Save[Save Base Data]
    Save --> Check{Translation<br/>Mode?}
    Check -->|Auto| DeepL[DeepL API]
    Check -->|Manual| Manual[Manual Entry]
    DeepL --> SaveTrans[Save Translations]
    Manual --> SaveTrans
    SaveTrans --> DB[(Database)]
```

### Translation Storage

- **Base Data**: Stored in `plants` table (default language)
- **Translations**: Stored in `plant_translations` table
- **Merge Logic**: Translation overrides base data when available

### DeepL Integration

```typescript
import { translatePlantToAllLanguages } from '@/lib/deepl'

// Translate plant fields to all supported languages
const translations = await translatePlantToAllLanguages({
  name: "Rose",
  scientificName: "Rosa",
  meaning: "Love and beauty",
  description: "A beautiful flowering plant",
  careSoil: "Well-drained soil"
}, 'en')
```

</details>

---

## 🔐 Authentication

<details>
<summary><strong>🔑 Supabase Auth</strong></summary>

### Authentication Flow

1. User signs up/signs in via Supabase Auth
2. Auth token stored in browser (localStorage)
3. Token included in API requests automatically
4. Supabase RLS policies enforce access control

### Auth Context

```typescript
import { useAuth } from '@/context/AuthContext'

function MyComponent() {
  const { user, profile, signIn, signUp, signOut, loading } = useAuth()
  
  if (loading) return <Spinner />
  if (!user) return <LoginPrompt />
  
  return <div>Welcome, {profile?.display_name}!</div>
}
```

### Row Level Security (RLS)

- **Profiles**: Publicly readable, privately writable
- **Gardens**: Visible to owners and members
- **Friend Requests**: Private to participants
- **Plants**: Publicly readable, admin-writable

</details>

---

## 📱 Progressive Web App

<details>
<summary><strong>⚡ PWA Features</strong></summary>

### Configuration

The PWA is configured via `vite-plugin-pwa` in `vite.config.ts`:

- **Service Worker**: Custom InjectManifest strategy (`src/sw.ts`)
- **Manifest**: Auto-generated with app metadata
- **Offline Support**: Pre-cached routes and assets

### Cached Assets

- Static assets (JS, CSS, images, fonts)
- Translation JSON files
- Offline fallback page
- App icons

### Caching Strategies

| Resource | Strategy | Description |
|----------|----------|-------------|
| Static assets | CacheFirst | Cache first, network fallback |
| API requests | NetworkFirst | Network first, cache fallback |
| Translations | StaleWhileRevalidate | Serve cached, update in background |

### Service Worker Toast

The `ServiceWorkerToast` component handles:

- **Install prompt**: "Add to home screen" suggestion
- **Update notification**: "New version available" with reload button
- **Offline indicator**: Shows when app is offline

### Development Testing

```bash
# Enable PWA in development
VITE_ENABLE_PWA=true bun run dev

# Check PWA in browser DevTools:
# Application → Manifest (install assets)
# Application → Service Workers (caching)
```

### Disabling PWA

For fast iteration during development/QA:

```bash
# Via environment variable
VITE_DISABLE_PWA=true bun run build

# Existing clients will auto-unregister on next load
```

</details>

---

## ⚡ Performance

<details>
<summary><strong>🚀 Optimization Strategies</strong></summary>

### Code Splitting

- **Lazy Loading**: Admin pages and heavy components loaded on demand
- **Route-based**: Each route is a separate chunk
- **Manual Chunks**: React, Recharts, Three.js, Supabase in separate bundles

```typescript
// vite.config.ts
manualChunks: {
  'react-vendor': ['react', 'react-dom', 'react-router-dom'],
  'recharts': ['recharts'],
  'three': ['three'],
  'supabase': ['@supabase/supabase-js'],
}
```

### Asset Optimization

- **Vite**: Tree-shaking and esbuild minification
- **Images**: Processed via Sharp for optimization
- **Fonts**: Self-hosted with preload hints

### Database Optimization

- **Task Cache**: Pre-computed daily/weekly statistics
- **Indexes**: On frequently queried columns
- **Pagination**: Large datasets paginated
- **Query Optimization**: Efficient SQL with proper joins

### Bundle Metrics

| Metric | Target |
|--------|--------|
| Initial Bundle | ~200KB (gzipped) |
| Total Assets | ~500KB (gzipped) |
| First Paint | < 1.5s |
| TTI | < 3s |

</details>

---

## 🧪 Testing

<details>
<summary><strong>🔬 Testing Strategy</strong></summary>

### Current Status

- ⚠️ **Limited tests** — Manual testing primary
- 🔄 **Planned**: Comprehensive test suite

### Recommended Testing Stack

| Type | Tool | Coverage |
|------|------|----------|
| **Unit Tests** | Vitest | Components, utilities |
| **Integration Tests** | React Testing Library | User flows |
| **E2E Tests** | Playwright | Critical paths |
| **API Tests** | Supertest | Express routes |

### Translation Validation

```bash
# Check for missing/extra translation keys
bun run check-translations
```

</details>

---

## 🚀 Deployment

<details>
<summary><strong>📦 Production Deployment</strong></summary>

### Build Process

```bash
bun install
bun run build
# Output: dist/
# Includes: optimized assets, service worker
```

### Deployment Steps

1. **Build**: `bun run build`
2. **Sitemap** (optional): `bun run generate:sitemap` (requires database connection)
3. **Copy**: Deploy `dist/` to server
4. **Configure**: Set up nginx/server config
5. **Start**: Run Express server for API
6. **Environment**: Set production environment variables

### Server Configuration (nginx)

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    root /var/www/plant-swipe;
    index index.html;
    
    # API proxy
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

</details>

<details>
<summary><strong>🔧 Automated Sitemap</strong></summary>

### Generation

```bash
# Generate sitemap manually
bun run generate:sitemap

# Automatically runs during build
bun run build
```

### Configuration

| Variable | Description |
|----------|-------------|
| `PLANTSWIPE_SITE_URL` | Canonical origin (e.g., `https://aphylia.app`) |
| `SITEMAP_DEFAULT_LANGUAGE` | Default language for URLs |
| `SITEMAP_MAX_PLANT_URLS` | Max plant URLs to include |
| `SKIP_SITEMAP_GENERATION` | Set to `1` to skip |

### Features

- Static routes from configuration
- Dynamic plant pages from database
- Language variants for all routes
- Respects `VITE_APP_BASE_PATH` for sub-path deployments

</details>

<details>
<summary><strong>🏠 Local/Self-Hosted Deployment</strong></summary>

### First-Time Setup

```bash
# Install dependencies and configure services
sudo ./setup.sh

# With custom base path
PWA_BASE_PATH=/custom/ sudo ./setup.sh
```

### Subsequent Updates

```bash
# Pull, build, and restart services
sudo bash scripts/refresh-plant-swipe.sh
```

### What the Scripts Do

1. Pull latest code from git
2. Run `bun install && bun run build` (7x faster than npm)
3. Sync `dist/` to web root
4. Run database migrations
5. Restart `plant-swipe-node` and `admin-api` services

</details>

---

## 🔧 Troubleshooting

<details>
<summary><strong>❓ Common Issues</strong></summary>

### Database Connection

**Issue**: Cannot connect to database  
**Solution**: Verify `DATABASE_URL` or `PG*` environment variables

```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1"
```

### Auth Errors

**Issue**: Authentication fails  
**Solution**: Check Supabase credentials

```bash
# Verify in .env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### Translation Errors

**Issue**: DeepL translations not working  
**Solution**: Verify API key and check rate limits

```bash
# Test DeepL API
curl -X POST https://api.deepl.com/v2/translate \
  -H "Authorization: DeepL-Auth-Key YOUR_KEY" \
  -d "text=Hello&target_lang=FR"
```

### Build Errors

**Issue**: Out of memory during build  
**Solution**: Use low-memory build script

```bash
bun run build:low-mem
```

### PWA Issues

**Issue**: Service worker not updating  
**Solution**: Clear cache and unregister

```javascript
// In browser console
navigator.serviceWorker.getRegistrations().then(r => r.forEach(reg => reg.unregister()))
caches.keys().then(names => names.forEach(name => caches.delete(name)))
```

</details>

---

## 🤝 Contributing

<details>
<summary><strong>📋 Development Guidelines</strong></summary>

### Code Style

- **TypeScript**: Strict mode enabled
- **ESLint**: Configured with React rules
- **Imports**: Use `@/` alias for src directory

### Git Workflow

1. Create feature branch from `main`
2. Make changes with clear commits
3. Run linting: `bun run lint`
4. Test locally
5. Submit PR with description

### Code Organization

| Directory | Purpose |
|-----------|---------|
| `components/` | Reusable UI components |
| `pages/` | Route page components |
| `lib/` | Utility functions and API |
| `hooks/` | Custom React hooks |
| `context/` | React context providers |
| `types/` | TypeScript definitions |

### Component Guidelines

- Use functional components with hooks
- Prefer composition over inheritance
- Export types alongside components
- Include JSDoc comments for public APIs

</details>

---

## 📚 Resources

| Resource | Link |
|----------|------|
| Bun Documentation | [bun.sh/docs](https://bun.sh/docs) |
| Bun Migration Guide | [BUN_MIGRATION.md](./BUN_MIGRATION.md) |
| React Documentation | [react.dev](https://react.dev) |
| Vite Documentation | [vitejs.dev](https://vitejs.dev) |
| Supabase Documentation | [supabase.com/docs](https://supabase.com/docs) |
| Tailwind CSS Documentation | [tailwindcss.com/docs](https://tailwindcss.com/docs) |
| TypeScript Documentation | [typescriptlang.org/docs](https://www.typescriptlang.org/docs) |
| TipTap Documentation | [tiptap.dev](https://tiptap.dev) |
| Framer Motion Documentation | [framer.com/motion](https://www.framer.com/motion) |

---

<div align="center">

**Built with ❤️ by Neolite & Five**

[**Main README**](../README.md) • [**Features**](../README.md#-feature-overview) • [**Quick Start**](../README.md#-quick-start)

</div>
