# Garden Types

This document describes the garden type system, including the features, roadmap, and behavior unique to each garden type.

## Overview

Every garden has a `garden_type` column (stored in the `gardens` DB table) that determines its behavior and UI. The type is chosen at creation time and defaults to `default`.

**Database column:**

```sql
garden_type TEXT NOT NULL DEFAULT 'default'
  CHECK (garden_type IN ('default', 'beginners'))
```

**TypeScript type:**

```ts
type GardenType = 'default' | 'beginners'
```

**Key files:**

| File | Purpose |
|------|---------|
| `src/types/garden.ts` | `GardenType` type, `Garden.gardenType` field |
| `src/lib/gardens.ts` | `createGarden()`, `getGarden()`, `getUserGardens()` — read/write `garden_type` |
| `src/pages/GardenListPage.tsx` | Creation dialog with type selector |
| `src/pages/GardenDashboardPage.tsx` | Roadmap, suggestions, beginner tag |
| `supabase/sync_parts/12_audit_and_analytics.sql` | DB migration for `garden_type` column |
| `public/locales/{en,fr}/common.json` | i18n keys under `garden.*`, `gardenDashboard.beginnerRoadmap.*`, `gardenDashboard.beginnerSuggestions.*` |

---

## Garden Creation Dialog

The creation dialog (`GardenListPage.tsx`) presents:

- **Garden name** input
- **Garden type** selector — two buttons: Default / Beginners
- Default selection is **Default**

No cover image selection (removed). Cover images can still be set later in garden settings.

---

## Type: Default

The standard garden experience. No guided onboarding, no roadmap, no plant suggestions. Full access to all features (plants, tasks, journal, analytics, settings).

### Features

- Full garden dashboard with Overview, Plants, Tasks, Journal, Analytics, Settings tabs
- Task scheduling (water, fertilize, harvest, cut, custom)
- Member management
- AI chat (Aphylia)
- Activity feed and 30-day heatmap

### Tag

None displayed.

---

## Type: Beginners

A guided experience for new gardeners, focused on succulents with easy care. Displays a "Beginner" tag and provides an onboarding roadmap with plant suggestions.

### Tag

A sky-blue **"Beginner"** badge is shown:
- In the garden overview hero section (both cover-image and no-cover variants)
- On the garden card in the garden list page

Visible to everyone (members and visitors of public gardens).

### Beginner Roadmap

A **"Getting Started"** card shown in the Overview tab. **Only visible to owners and members** (not visitors of public beginner gardens).

The roadmap has a progress bar and is organized into **sections**, each containing a list of steps. Each step has:
- A completion condition (auto-detected)
- An action button linking to the relevant page/tab
- A checked/unchecked visual state

#### Section 1: Your first plant

| # | Step | Completion trigger | Action link |
|---|------|-------------------|-------------|
| 1 | Add 1 plant to your garden | `plants.length > 0` | Plants tab |
| 2 | Read the info page of your plant | localStorage flag `beginner_read_plant_{gardenId}` | `/plants/{plantId}` |
| 3 | Schedule watering tasks for your plant | Any task with `type === 'water'` exists | Tasks tab |
| 4 | Schedule fertilization tasks for your plant | Any task with `type === 'fertilize'` exists | Tasks tab |
| 5 | Create an entry in your journal | Any row in `garden_journal_entries` for the garden | Journal tab |

**Data sources:**
- Steps 1: `plants` array length from `getGardenPlants()`
- Step 2: `localStorage` (client-side only, per garden)
- Steps 3–4: `listGardenTasks()` filtered by `task.type`
- Step 5: Count query on `garden_journal_entries` table

**Adding new sections:** The roadmap is built as an array of `roadmapSections`, each with a `key`, `title`, and `steps` array. To add a new section, append to the array. Steps from all sections are flattened for the overall progress bar.

### Plant Suggestions

When a beginner garden has **no plants**, a "Suggested for you" card appears in both:
- **Overview tab**
- **Plants tab** (in the empty state)

**Only visible to owners and members.**

Shows 5 cards in a horizontal scrollable row:
- **Cards 1–4:** Random easy-care succulents from the plant catalog
  - Queried as: `plant_type = 'succulent'`, `care_level @> ['easy']`, `status != 'in_progress'`
  - Shuffled randomly, limited to 4
  - Shows plant image (3:4 aspect), name, variety, "Learn more" link
  - Respects current language for translated names
- **Card 5:** "Explore more" — links to `/search?type=Succulent&maintenance=easy`

Suggestions disappear once the user adds any plant to the garden.

### Recommended Watering Frequency

When creating a **water** task in the Task Create dialog, a blue hint box displays the plant's recommended watering frequency:
- **Warm season:** `wateringFrequencyWarm` (times per week)
- **Cold season:** `wateringFrequencyCold` (times per week)

This data comes from the plant's catalog entry and is passed through:
`GardenDashboardPage` → `TaskEditorDialog` → `TaskCreateDialog`

This feature is **not limited to beginner gardens** — it appears for all garden types when the plant has watering frequency data.

---

## Adding a New Garden Type

1. **Database:** Add the new type to the `CHECK` constraint in `12_audit_and_analytics.sql`
2. **TypeScript:** Add to `GardenType` union in `src/types/garden.ts`
3. **Creation dialog:** Add a button in the type selector in `GardenListPage.tsx`
4. **i18n:** Add translation keys in `public/locales/{en,fr}/common.json`:
   - `garden.gardenType{Name}` for the selector button
   - `garden.{name}Tag` if a tag should display
5. **Roadmap (optional):** In `GardenDashboardPage.tsx`, add conditional roadmap sections/steps
6. **Suggestions (optional):** Adjust the suggestion query filters for the new type
7. **Tag (optional):** Add conditional rendering in the overview hero and garden list cards
