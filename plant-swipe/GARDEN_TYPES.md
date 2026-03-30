# Garden Types

This document describes the garden type system, including the features, roadmap, and behavior unique to each garden type.

## Overview

Every garden has a `garden_type` column (stored in the `gardens` DB table) that determines its behavior and UI. The type is chosen at creation time and defaults to `default`.

**Database column:**

```sql
garden_type TEXT NOT NULL DEFAULT 'default'
  CHECK (garden_type IN ('default', 'beginners', 'seedling'))
```

**TypeScript type:**

```ts
type GardenType = 'default' | 'beginners' | 'seedling'
```

**Key files:**

| File | Purpose |
|------|---------|
| `src/types/garden.ts` | `GardenType` type, `Garden.gardenType` field |
| `src/lib/gardens.ts` | `createGarden()`, `getGarden()`, `getUserGardens()` — read/write `garden_type` |
| `src/pages/GardenListPage.tsx` | Creation dialog with type selector |
| `src/pages/GardenDashboardPage.tsx` | Roadmap, suggestions, beginner tag, seedling tray tab |
| `src/components/seedling-tray/` | Seedling tray components (grid, modal, care list, analytics) |
| `supabase/sync_parts/12_audit_and_analytics.sql` | DB migration for `garden_type` column, seedling tray tables |
| `public/locales/{en,fr}/common.json` | i18n keys under `garden.*`, `gardenDashboard.*`, `seedlingTray.*` |

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

#### Roadmap Steps (Duolingo/CandyCrush map style)

| # | Step | Key | Completion trigger | Action link |
|---|------|-----|-------------------|-------------|
| 1 | Set your garden space | `set_living_space` | `garden.livingSpace.length > 0` | Settings (general) |
| 2 | Add your first plant | `add_plant` | `plants.length > 0` | Plants tab |
| 3 | Read your plant's info | `read_plant_info` | localStorage flag `beginner_read_plant_{gardenId}` | `/plants/{plantId}` |
| 4 | Schedule watering | `schedule_water` | Any task with `type === 'water'` exists | Tasks tab |
| 5 | Schedule fertilization | `schedule_fertilize` | Any task with `type === 'fertilize'` exists | Tasks tab |
| 6 | Write a journal entry | `create_journal` | Any row in `garden_journal_entries` for the garden | Journal tab |

**Sequential unlocking:** Steps are locked until the previous step is completed. Only the current (first incomplete) step shows a "START" badge and can be interacted with.

**Persistent tracking:** Completions are stored in `garden_roadmap_completions` table (per garden, not per user). The `complete_roadmap_step` RPC is called when a step is detected as complete. Once persisted, a step stays complete forever even if the underlying resource is removed.

**Visual design:**
- Inspired by Duolingo course map / CandyCrush level map
- Nodes arranged in a vertical squiggly path (alternating left/center/right)
- Green vine line grows between completed nodes (SVG path with dash animation)
- Leaves appear along the vine as progress advances
- Completed nodes: green circle with checkmark
- Current node: green with amber ring + pulse animation + "START" badge
- Locked nodes: grey circle with lock icon

**Data sources:**
- Step 1: `garden.livingSpace` array from garden fetch
- Step 2: `plants` array length from `getGardenPlants()`
- Step 3: `localStorage` (client-side only, per garden)
- Steps 4–5: `listGardenTasks()` filtered by `task.type`
- Step 6: Count query on `garden_journal_entries` table
- All steps: also checked against `garden_roadmap_completions` table

### Plant Suggestions

A "Suggested for you" section appears **only in the Plants tab** of beginner gardens. **Only visible to owners and members.**

- When the garden has **no plants**: expanded by default (open)
- When plants have been added: **collapsed** at the bottom of the Plants tab (click to expand)
- **Not shown in the Overview tab**

Shows 5 cards in a horizontal scrollable row:
- **Cards 1–4:** Random plants matching the garden's living space
  - If `garden.livingSpace` is set: `living_space && {garden.livingSpace}`, `status != 'in_progress'`
  - If `garden.livingSpace` is empty: falls back to `care_level @> ['easy']`, `status != 'in_progress'`
  - Shuffled randomly, limited to 4
  - Shows plant image (3:4 aspect), name, variety, "Learn more" link
  - Respects current language for translated names
- **Card 5:** "Explore more" — links to search filtered by living space (or easy maintenance fallback)

### Garden Living Space

All gardens (default and beginners) have a `living_space` field — a text array of: `indoor`, `outdoor`, `terrarium`, `greenhouse`.

- **Set in:** Garden Settings > General > Living Space (multi-select toggle buttons)
- **Also available at creation:** Garden creation dialog includes living space picker
- **Used by:** Plant suggestions query (filters plants whose `living_space` overlaps with the garden's)
- **Beginner action:** "Set your garden space" is the first step in the beginner roadmap
- **DB column:** `gardens.living_space text[] not null default '{}'`

### Recommended Watering Frequency

When creating a **water** task in the Task Create dialog, a blue hint box displays the plant's recommended watering frequency:
- **Warm season:** `wateringFrequencyWarm` (times per week)
- **Cold season:** `wateringFrequencyCold` (times per week)

This data comes from the plant's catalog entry and is passed through:
`GardenDashboardPage` → `TaskEditorDialog` → `TaskCreateDialog`

This feature is **not limited to beginner gardens** — it appears for all garden types when the plant has watering frequency data.

---

## Type: Seedling

A seedling tray management experience for tracking individual cells in a physical seedling tray. Users configure tray dimensions (rows × columns) at creation and manage plants cell-by-cell with growth stage tracking.

### Tag

An emerald **"Seedling"** badge is shown (with tray dimensions):
- In the garden overview hero section
- On the garden card in the garden list page

### Tray Configuration

Set at creation time via inline dimension pickers in the creation dialog:
- **Rows:** 1–8 (default 4)
- **Columns:** 1–12 (default 6)
- **Preview grid** displayed below pickers
- Dimensions can be changed later in Settings > General > Tray Configuration

**DB columns:** `gardens.tray_rows INTEGER`, `gardens.tray_cols INTEGER`

### Seedling Tray Cells

Each cell in the tray is stored in `seedling_tray_cells`:
- `id`, `garden_id`, `position` (0-based index), `plant_id` (from catalog), `stage`, `sow_date`, `last_watered`, `notes`

**Growth stages:** `empty` → `sown` → `germinating` → `sprouted` → `ready`

### Dashboard: Tray Tab

The seedling garden dashboard includes a **Tray** tab (in addition to all standard tabs) containing:
1. **Tray Grid** — Visual grid of cells with stage-based coloring, plant names, and water indicators
2. **Select Mode** — Multi-select cells for bulk editing (set plant, stage, watering)
3. **Care Schedule** — List of planted cells with water status and quick actions
4. **Tray Analytics** — Stage breakdown bars, plant overview, tray utilization

### Cell Modal

Click a cell to open an edit dialog with:
- Plant species picker (search the plant catalog)
- Growth stage selector
- Sow date with germination/transplant day estimates (manual input)
- Watering tracker
- Notes (single cell only)

### Key Files

| File | Purpose |
|------|---------|
| `src/components/seedling-tray/SeedlingStageIcon.tsx` | Visual icon per growth stage |
| `src/components/seedling-tray/SeedlingTrayGrid.tsx` | Main tray grid with toolbar and select mode |
| `src/components/seedling-tray/SeedlingCellModal.tsx` | Cell edit dialog (single & multi) |
| `src/components/seedling-tray/SeedlingCareList.tsx` | Care schedule list view |
| `src/components/seedling-tray/SeedlingTrayAnalytics.tsx` | Stage breakdown and tray stats |
| `src/components/seedling-tray/SeedlingTrayDimensionEditor.tsx` | Tray resize in settings |
| `src/lib/gardens.ts` | CRUD functions: `getSeedlingTrayCells`, `updateSeedlingTrayCell`, etc. |
| `supabase/migrations/20260325000000_add_seedling_tray.sql` | DB migration |

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
