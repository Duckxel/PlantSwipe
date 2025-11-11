# 🔬 Aphylia — Technical Overview

<div align="center">

**Comprehensive technical documentation for developers and engineers working with Aphylia**

[![Architecture](#architecture)](#architecture) • [![Setup](#setup)](#setup) • [![API](#api-reference)](#api-reference) • [![Database](#database-schema)](#database-schema)

</div>

---

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Setup & Configuration](#setup--configuration)
- [Development Workflow](#development-workflow)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
- [Internationalization](#internationalization)
- [Translation System](#translation-system)
- [Authentication](#authentication)
- [State Management](#state-management)
- [Performance](#performance)
- [Testing](#testing)
- [Deployment](#deployment)

---

## Overview

Aphylia is a modern web application built with **React 19**, **TypeScript**, **Vite 7**, and **Express.js**, connecting to a **PostgreSQL** database via **Supabase**. It features a swipe-first UI for plant discovery, comprehensive garden management, social features, and multi-language support.

### Key Technologies

| Layer | Technology | Version |
|-------|------------|---------|
| **Frontend** | React | 19.1.1 |
| **Language** | TypeScript | 5.8.3 |
| **Build Tool** | Vite | 7.1.2 |
| **Styling** | Tailwind CSS | 3.4.17 |
| **Backend** | Express.js | 4.19.2 |
| **Database** | PostgreSQL | Via Supabase |
| **Auth** | Supabase Auth | 2.57.2 |
| **i18n** | react-i18next | 16.2.4 |

---

## Architecture

### System Architecture

```mermaid
flowchart TB
    subgraph Client["🌐 Client Browser"]
        React[React App]
        Vite[Vite Dev Server]
    end
    
    subgraph Server["🖥️ Express Server"]
        ExpressAPI[Express API]
        StaticServe[Static File Server]
    end
    
    subgraph Database["💾 Database Layer"]
        Supabase[(Supabase/Postgres)]
        Auth[Supabase Auth]
    end
    
    subgraph External["🌍 External Services"]
        DeepL[DeepL Translation API]
    end
    
    React -->|HTTP Requests| ExpressAPI
    Vite -->|Proxy /api/*| ExpressAPI
    ExpressAPI -->|SQL Queries| Supabase
    ExpressAPI -->|Auth Requests| Auth
    ExpressAPI -->|Translation| DeepL
    ExpressAPI -->|Static Files| StaticServe
    StaticServe -->|Production Build| React
    
    style React fill:#61dafb
    style ExpressAPI fill:#339933
    style Supabase fill:#3ecf8e
    style DeepL fill:#0f2b46
```

### Request Flow

```mermaid
sequenceDiagram
    participant User
    participant React
    participant Vite
    participant Express
    participant Supabase
    
    User->>React: Interact with UI
    React->>Vite: API Request (/api/*)
    Vite->>Express: Proxy Request
    Express->>Supabase: SQL Query
    Supabase-->>Express: Data Response
    Express-->>Vite: JSON Response
    Vite-->>React: Proxy Response
    React->>User: Update UI
```

---

## Project Structure

```
plant-swipe/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── admin/          # Admin-specific components
│   │   ├── garden/         # Garden management components
│   │   ├── i18n/           # i18n routing components
│   │   ├── layout/         # Layout components (TopBar, BottomBar)
│   │   ├── plant/          # Plant-related components
│   │   ├── profile/        # Profile components
│   │   └── ui/             # shadcn-inspired UI primitives
│   ├── constants/          # Constants and configuration
│   ├── context/            # React context providers
│   ├── lib/                # Utility libraries
│   │   ├── i18n.ts         # i18n configuration
│   │   ├── i18nRouting.ts  # Language routing
│   │   ├── plantTranslations.ts  # Plant translation utilities
│   │   ├── supabaseClient.ts     # Supabase client
│   │   └── ...
│   ├── pages/              # Page components (routes)
│   ├── types/              # TypeScript type definitions
│   ├── App.tsx             # Root component
│   ├── PlantSwipe.tsx     # Main app component
│   └── main.tsx            # Entry point
├── public/
│   ├── locales/            # Translation files
│   │   ├── en/
│   │   └── fr/
│   └── env-loader.js       # Environment loader
├── supabase/               # Database migrations
├── server.js               # Express API server
├── vite.config.ts          # Vite configuration
├── tailwind.config.js      # Tailwind configuration
└── package.json            # Dependencies
```

---

## Setup & Configuration

<details>
<summary><strong>Environment Variables</strong></summary>

### Client-Side (`plant-swipe/.env`)

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
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

# Optional: DeepL Translation API
DEEPL_API_KEY=your-deepl-api-key
DEEPL_API_URL=https://api-free.deepl.com/v2/translate
```

</details>

<details>
<summary><strong>Development Scripts</strong></summary>

| Script | Command | Purpose |
|--------|---------|---------|
| **Development** | `npm run dev` | Start Vite dev server (port 5173) |
| **API Server** | `npm run serve` | Start Express API server (port 3000) |
| **Build** | `npm run build` | Build production bundle |
| **Preview** | `npm run preview` | Preview production build |
| **Lint** | `npm run lint` | Run ESLint |
| **Check Translations** | `npm run check-translations` | Validate translation files |

</details>

---

## Development Workflow

### Running Locally

1. **Start API Server** (Terminal 1):
   ```bash
   npm run serve
   # Runs on http://localhost:3000
   ```

2. **Start Dev Server** (Terminal 2):
   ```bash
   npm run dev
   # Runs on http://127.0.0.1:5173
   # Proxies /api/* requests to port 3000
   ```

### Building for Production

```bash
npm ci                    # Clean install
npm run build            # TypeScript compilation + Vite build
# Output: dist/
```

---

## Database Schema

<details>
<summary><strong>Core Tables</strong></summary>

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
| `care_soil` | TEXT | Soil care instructions |
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
| `care_soil` | TEXT | Translated care instructions |

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
| `liked_plant_ids` | UUID[] | Array of liked plant IDs |
| `accent_key` | TEXT | UI accent color preference |
| `is_private` | BOOLEAN | Privacy setting |
| `disable_friend_requests` | BOOLEAN | Friend request control |

### `gardens`
Garden collections.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `name` | TEXT | Garden name |
| `owner_id` | UUID | Foreign key to `profiles` |
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

</details>

---

## API Reference

<details>
<summary><strong>Express API Routes</strong></summary>

### Plant Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/plants` | Get all plants |
| `POST` | `/api/plants` | Create new plant |
| `PUT` | `/api/plants/:id` | Update plant |
| `DELETE` | `/api/plants/:id` | Delete plant |

### Translation Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/translate` | Translate text via DeepL |

### Admin Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/admin/branches` | List git branches |
| `POST` | `/api/admin/pull` | Pull latest changes |
| `POST` | `/api/admin/restart` | Restart service |
| `POST` | `/api/admin/sync-schema` | Sync database schema |
| `GET` | `/api/admin/member` | Search member by email |
| `POST` | `/api/admin/log-action` | Log admin action |

</details>

<details>
<summary><strong>Supabase RPC Functions</strong></summary>

### User Functions

- `get_user_profile_public_stats(_user_id)` - Get user statistics
- `get_user_daily_tasks(_user_id, _start, _end)` - Get task completion data
- `get_user_private_info(_user_id)` - Get private user information
- `get_friend_count(_user_id)` - Count user's friends
- `get_friend_email(_friend_id)` - Get friend's email (privacy-aware)
- `get_friend_request_requester_email(_requester_id)` - Get requester email

### Profile Functions

- `get_profile_public_by_display_name(_name)` - Get public profile by display name

### Friend Functions

- `accept_friend_request(_request_id)` - Accept friend request and create friendship

</details>

---

## Internationalization

<details>
<summary><strong>i18n Configuration</strong></summary>

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

Located in `public/locales/{lang}/common.json`

```json
{
  "common": {
    "welcome": "Welcome",
    "login": "Login"
  },
  "profile": {
    "title": "Profile",
    "edit": "Edit Profile"
  }
}
```

### Usage in Components

```typescript
import { useTranslation } from 'react-i18next'

function MyComponent() {
  const { t } = useTranslation('common')
  return <div>{t('welcome')}</div>
}
```

</details>

---

## Translation System

<details>
<summary><strong>Plant Translations</strong></summary>

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
// Translate plant fields
const translations = await translatePlantToAllLanguages({
  name: "Rose",
  scientificName: "Rosa",
  meaning: "Love",
  description: "A beautiful flower",
  careSoil: "Well-drained soil"
}, 'en')
```

</details>

---

## Authentication

<details>
<summary><strong>Supabase Auth</strong></summary>

### Authentication Flow

1. User signs up/signs in via Supabase Auth
2. Auth token stored in browser
3. Token included in API requests
4. Supabase RLS policies enforce access control

### Auth Context

```typescript
const { user, profile, signIn, signUp, signOut } = useAuth()
```

### Row Level Security (RLS)

- Profiles are publicly readable but privately writable
- Gardens are visible to owners and members
- Friend requests are private to participants

</details>

---

## State Management

<details>
<summary><strong>State Architecture</strong></summary>

### React Context

- **AuthContext**: User authentication and profile
- **No global state library**: Uses React hooks and context

### Data Fetching

- **Supabase Client**: Direct queries from components
- **React Query**: Not used (could be added for caching)
- **Optimistic Updates**: Manual state updates

### State Flow

```mermaid
graph TD
    Component[Component] -->|useState| LocalState[Local State]
    Component -->|useAuth| AuthContext[Auth Context]
    Component -->|Supabase Client| Database[(Database)]
    Database -->|Response| Component
    Component -->|Update| LocalState
```

</details>

---

## Performance

<details>
<summary><strong>Optimization Strategies</strong></summary>

### Code Splitting

- **Lazy Loading**: Admin page loaded on demand
- **Route-based**: Each route is a separate chunk
- **Component-level**: Heavy components lazy loaded

### Asset Optimization

- **Vite**: Tree-shaking and minification
- **Images**: Optimized via build process
- **Fonts**: Self-hosted or optimized CDN

### Database Optimization

- **Indexes**: On frequently queried columns
- **Pagination**: Large datasets paginated
- **Query Optimization**: Efficient SQL queries

### Bundle Size

| Metric | Size |
|--------|------|
| **Initial Bundle** | ~200KB (gzipped) |
| **Total Assets** | ~500KB (gzipped) |
| **Code Splitting** | Multiple chunks |

</details>

---

## Testing

<details>
<summary><strong>Testing Strategy</strong></summary>

### Current Status

- ⚠️ **No tests currently** - Manual testing only
- 🔄 **Planned**: Jest + React Testing Library

### Recommended Testing

| Type | Tool | Coverage |
|------|------|----------|
| **Unit Tests** | Jest | Components, utilities |
| **Integration Tests** | React Testing Library | User flows |
| **E2E Tests** | Playwright | Critical paths |
| **API Tests** | Supertest | Express routes |

</details>

---

## Deployment

<details>
<summary><strong>Production Deployment</strong></summary>

### Build Process

```bash
npm ci
npm run build
# Output: dist/
```

### Deployment Steps

1. **Build**: `npm run build`
2. **Copy**: Deploy `dist/` to server
3. **Configure**: Set up nginx/server config
4. **Start**: Run Express server for API
5. **Environment**: Set production environment variables

### Server Configuration

```nginx
# Example nginx config
server {
    listen 80;
    server_name your-domain.com;
    
    root /var/www/plant-swipe;
    index index.html;
    
    location /api {
        proxy_pass http://localhost:3000;
    }
    
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### Environment Variables

Ensure production environment variables are set:
- `DATABASE_URL` or `PG*` variables
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `DEEPL_API_KEY` (optional)

</details>

---

## Troubleshooting

<details>
<summary><strong>Common Issues</strong></summary>

### Database Connection

**Issue**: Cannot connect to database  
**Solution**: Check `DATABASE_URL` or `PG*` environment variables

### Auth Errors

**Issue**: Authentication fails  
**Solution**: Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

### Translation Errors

**Issue**: Translations not working  
**Solution**: Check `DEEPL_API_KEY` is set (optional for manual translations)

### Build Errors

**Issue**: TypeScript errors during build  
**Solution**: Run `npm run lint` and fix type errors

</details>

---

## Contributing

<details>
<summary><strong>Development Guidelines</strong></summary>

### Code Style

- **TypeScript**: Strict mode enabled
- **ESLint**: Configured with React rules
- **Prettier**: Not configured (consider adding)

### Git Workflow

1. Create feature branch
2. Make changes
3. Test locally
4. Submit PR

### Code Organization

- **Components**: Reusable UI components
- **Pages**: Route components
- **Lib**: Utility functions
- **Types**: TypeScript definitions

</details>

---

## Resources

- [React Documentation](https://react.dev)
- [Vite Documentation](https://vitejs.dev)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)

---

<div align="center">

**Built with ❤️ by Neolite & Five**

[Main README](../README.md) • [Features](../README.md#feature-overview) • [Quick Start](../README.md#quick-start)

</div>
