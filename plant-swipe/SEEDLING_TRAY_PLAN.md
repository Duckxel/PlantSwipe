# Seedling Tray Garden Type — Implementation Plan

## Overview

Add a **"Seedling"** garden type to PlantSwipe for managing seedling trays. Users configure a tray grid (rows × columns) at creation time, then manage individual cells — each representing a slot in the physical tray — with growth stage tracking, watering, and notes.

**Design decisions (confirmed with user):**
- Plant species are selected from the **real plant catalog** (Supabase `plants` table)
- Tray dimensions are configured **inline in the creation dialog**
- Dashboard shows **all standard tabs + a new Tray tab**
- Default and Beginner garden types remain unchanged

---

## 1. Database Changes

### 1a. Update `garden_type` CHECK constraint

**File:** `supabase/sync_parts/12_audit_and_analytics.sql` (append)

Add `'seedling'` to the allowed garden types. Since the existing constraint is inline on the column, we need to drop and recreate it:

```sql
-- Migration: Add 'seedling' garden type
DO $$
BEGIN
  -- Drop old inline CHECK if it exists (the column was added with an inline check)
  ALTER TABLE public.gardens DROP CONSTRAINT IF EXISTS gardens_garden_type_check;
  -- Re-add with seedling included
  ALTER TABLE public.gardens ADD CONSTRAINT gardens_garden_type_check
    CHECK (garden_type IN ('default', 'beginners', 'seedling'));
EXCEPTION WHEN others THEN NULL;
END $$;
```

### 1b. Add tray dimension columns to `gardens`

```sql
-- Tray dimensions for seedling gardens (nullable, only used when garden_type = 'seedling')
ALTER TABLE IF EXISTS public.gardens
  ADD COLUMN IF NOT EXISTS tray_rows INTEGER,
  ADD COLUMN IF NOT EXISTS tray_cols INTEGER;
```

### 1c. Create `seedling_tray_cells` table

New table to persist each cell's state:

```sql
CREATE TABLE IF NOT EXISTS public.seedling_tray_cells (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  garden_id UUID NOT NULL REFERENCES public.gardens(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,            -- 0-based index (row * cols + col)
  plant_id TEXT REFERENCES public.plants(id) ON DELETE SET NULL,
  stage TEXT NOT NULL DEFAULT 'empty'
    CHECK (stage IN ('empty', 'sown', 'germinating', 'sprouted', 'ready')),
  sow_date DATE,
  last_watered DATE,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(garden_id, position)
);

-- Index for fast lookup by garden
CREATE INDEX IF NOT EXISTS idx_seedling_tray_cells_garden
  ON public.seedling_tray_cells(garden_id);
```

### 1d. RLS policies for `seedling_tray_cells`

```sql
ALTER TABLE public.seedling_tray_cells ENABLE ROW LEVEL SECURITY;

-- Read: garden members can read
CREATE POLICY seedling_cells_select ON public.seedling_tray_cells
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.garden_members gm
      WHERE gm.garden_id = seedling_tray_cells.garden_id
        AND gm.user_id = auth.uid()
    )
  );

-- Insert: garden members can insert
CREATE POLICY seedling_cells_insert ON public.seedling_tray_cells
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.garden_members gm
      WHERE gm.garden_id = seedling_tray_cells.garden_id
        AND gm.user_id = auth.uid()
    )
  );

-- Update: garden members can update
CREATE POLICY seedling_cells_update ON public.seedling_tray_cells
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.garden_members gm
      WHERE gm.garden_id = seedling_tray_cells.garden_id
        AND gm.user_id = auth.uid()
    )
  );

-- Delete: garden members can delete
CREATE POLICY seedling_cells_delete ON public.seedling_tray_cells
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.garden_members gm
      WHERE gm.garden_id = seedling_tray_cells.garden_id
        AND gm.user_id = auth.uid()
    )
  );
```

### 1e. Migration file

**File:** `supabase/migrations/20260325000000_add_seedling_tray.sql`

Contains all of the above SQL in one migration file.

---

## 2. TypeScript Type Changes

### 2a. `src/types/garden.ts`

```typescript
// Update GardenType union
export type GardenType = 'default' | 'beginners' | 'seedling'

// Add seedling stage type
export type SeedlingStage = 'empty' | 'sown' | 'germinating' | 'sprouted' | 'ready'

// Add SeedlingTrayCell interface
export interface SeedlingTrayCell {
  id: string
  gardenId: string
  position: number          // 0-based index in the tray grid
  plantId: string | null    // references plants.id from catalog
  stage: SeedlingStage
  sowDate: string | null     // ISO date string
  lastWatered: string | null // ISO date string
  notes: string
}

// Update Garden interface — add optional tray fields
export interface Garden {
  // ... existing fields ...
  trayRows?: number | null
  trayCols?: number | null
}
```

---

## 3. Backend Functions (`src/lib/gardens.ts`)

### 3a. Update `createGarden()`

Add `trayRows` and `trayCols` to the params type and insert them. After creating a seedling garden, bulk-insert empty cells:

```typescript
// In createGarden params:
trayRows?: number
trayCols?: number

// After garden insert (when gardenType === 'seedling'):
if (gardenType === 'seedling' && trayRows && trayCols) {
  const cells = Array.from({ length: trayRows * trayCols }, (_, i) => ({
    garden_id: garden.id,
    position: i,
    stage: 'empty',
    notes: '',
  }));
  await supabase.from('seedling_tray_cells').insert(cells);
}
```

### 3b. Update `getGarden()` / `getUserGardens()`

Add `tray_rows, tray_cols` to the select query. Map to camelCase.

### 3c. New seedling-specific functions

```typescript
// Fetch all cells for a garden (ordered by position)
export async function getSeedlingTrayCells(gardenId: string): Promise<SeedlingTrayCell[]>

// Update a single cell
export async function updateSeedlingTrayCell(cellId: string, data: Partial<SeedlingTrayCell>): Promise<void>

// Bulk update multiple cells (for multi-select edit)
export async function updateSeedlingTrayCells(cellIds: string[], data: Partial<SeedlingTrayCell>): Promise<void>

// Clear a cell (reset to empty)
export async function clearSeedlingTrayCell(cellId: string): Promise<void>

// Clear multiple cells
export async function clearSeedlingTrayCells(cellIds: string[]): Promise<void>

// Resize tray (called from settings) — adds/removes cells as needed
export async function resizeSeedlingTray(gardenId: string, newRows: number, newCols: number): Promise<void>

// Update tray dimensions on garden
export async function updateGardenTraySize(gardenId: string, rows: number, cols: number): Promise<void>
```

---

## 4. Component Architecture

All new components in `src/components/seedling-tray/`:

### 4a. `SeedlingStageIcon.tsx`
- Renders the visual icon for each growth stage (matching the prototype's StageIcon)
- Props: `stage: SeedlingStage`, `size?: number`
- Uses Tailwind classes (not inline styles) with dark mode support

### 4b. `SeedlingTrayGrid.tsx`
- Main tray grid view component
- Props: `cells`, `rows`, `cols`, `onCellClick`, `selectMode`, `selected`, etc.
- Renders a CSS grid with aspect-ratio-1 cells
- Supports select mode with visual selection indicators
- Stage-based cell coloring using Tailwind dark: classes
- Shows plant name, stage icon, and water indicator per cell
- Includes toolbar: tray name, Select/Edit/Cancel buttons
- Legend row at bottom showing all stages

### 4c. `SeedlingCellModal.tsx`
- Dialog (Radix UI) for editing a single cell or multiple cells
- Plant species: searchable dropdown querying the plant catalog
- Growth stage selector: 4 buttons (sown/germinating/sprouted/ready)
- Sow date picker with auto-calculated germination/transplant estimates
  - Uses plant catalog's `transplanting` boolean and `sowing_month` data
  - For germination day estimates: since the DB doesn't have `germination_days`, provide a manual input field with sensible defaults
- Watering: "Mark as watered" button with "last watered X days ago" display
- Notes textarea (single-cell only)
- Clear cell / Save buttons
- Multi-edit mode: shows count, applies changes to all selected

### 4d. `SeedlingCareList.tsx`
- List view of all planted (non-empty) cells
- Shows plant name, cell position, stage, sow date, water status
- Quick action buttons: Water, Edit (opens CellModal)
- Highlights cells needing water (>2 days since last watered)

### 4e. `SeedlingTrayAnalytics.tsx`
- Stage breakdown: horizontal bars showing count per stage
- Plant overview: dot visualization grouped by species
- Tray utilization: planted vs empty percentage

### 4f. `SeedlingTrayDimensionEditor.tsx` (for Settings)
- Rows/Cols picker with +/- buttons (same pattern as prototype)
- Preview grid
- Calls `resizeSeedlingTray()` on save
- Warns if reducing dimensions would delete planted cells

---

## 5. Integration Points

### 5a. Garden Creation Dialog (`GardenListPage.tsx`)

**Changes:**
1. Add `"seedling"` option to `gardenType` state type
2. Add third button in type selector grid (change from `grid-cols-2` to `grid-cols-3`):
   - Icon: `Grid3X3` from lucide-react
   - Label: `t("garden.gardenTypeSeedling", "Seedling")`
3. When `gardenType === "seedling"`, show tray dimension picker below type selector:
   - Rows picker (1–8, default 4)
   - Cols picker (1–12, default 6)
   - Total cells count
   - Small preview grid
4. Pass `trayRows` and `trayCols` to `createGarden()`
5. Add state: `const [trayRows, setTrayRows] = useState(4)` and `const [trayCols, setTrayCols] = useState(6)`

### 5b. Garden Dashboard (`GardenDashboardPage.tsx`)

**Changes:**
1. Add `"tray"` to `TabKey` union type
2. Add tray icon to `GARDEN_TAB_ICONS`: `tray: Grid3X3`
3. In the tab list array, conditionally add `["tray", t("gardenDashboard.tray", "Tray")]` when `garden?.gardenType === 'seedling'`
4. Load seedling cells in a new `useEffect` when garden is seedling type
5. Add new state: `seedlingCells`, `seedlingLoading`
6. Render the `SeedlingTrayGrid` component when `tab === "tray"`
7. Add "Seedling" tag (emerald colored) in hero section when `gardenType === 'seedling'`

### 5c. Garden List Page — Card badge

Add seedling tag on garden cards (similar to beginner tag):
```tsx
{g.gardenType === 'seedling' && (
  <span className="text-[10px] font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full px-2 py-0.5">
    {t("garden.seedlingTag", "Seedling")}
  </span>
)}
```

### 5d. Garden Settings (`GardenSettingsSection.tsx`)

Add a new **"Tray Configuration"** section (only visible when `garden.gardenType === 'seedling'`):
- Uses `SeedlingTrayDimensionEditor` component
- Placed in the General category, below the Living Space editor
- Shows current dimensions and allows resize

### 5e. `getGarden()` and `getUserGardens()` in `gardens.ts`

Add `tray_rows, tray_cols` to select queries. Map `tray_rows → trayRows`, `tray_cols → trayCols`.

---

## 6. i18n Keys

### English (`public/locales/en/common.json`)

```json
{
  "garden": {
    "gardenTypeSeedling": "Seedling",
    "seedlingTag": "Seedling",
    "trayDimensions": "Tray Dimensions",
    "trayDimensionsHint": "Set the size of your seedling tray grid.",
    "trayRows": "Rows",
    "trayCols": "Columns",
    "trayTotalCells": "Total: {{count}} cells",
    "trayPreview": "Preview"
  },
  "gardenDashboard": {
    "tray": "Tray"
  },
  "seedlingTray": {
    "cellTitle": "Cell {{index}}",
    "cellsSelected": "{{count}} cells selected",
    "changesApplyToAll": "Changes apply to all selected",
    "editingMultiple": "Editing {{count}} cells at once — only fields you change will be applied.",
    "plantSpecies": "Plant species",
    "emptyOption": "— Empty —",
    "growthStage": "Growth stage",
    "sowDate": "Sow date",
    "germination": "Germination",
    "transplant": "Transplant",
    "watering": "Watering",
    "markWatered": "Mark as watered",
    "lastWatered": "Last watered {{days}}d ago — mark again",
    "notes": "Notes",
    "notesPlaceholder": "Add notes...",
    "clearCell": "Clear cell",
    "clearCells": "Clear {{count}} cells",
    "save": "Save",
    "saveCells": "Save {{count}} cells",
    "select": "Select",
    "selected": "{{count}} selected",
    "all": "All",
    "none": "None",
    "edit": "Edit",
    "cancel": "Cancel",
    "selectHint": "Click cells to select them, then hit Edit to apply changes to all at once.",
    "needsWater": "Needs water",
    "stages": {
      "empty": "Empty",
      "sown": "Sown",
      "germinating": "Germinating",
      "sprouted": "Sprouted",
      "ready": "Ready"
    },
    "care": {
      "title": "Care Schedule",
      "noPlants": "No plants yet. Go to Tray and click a cell to add one.",
      "wateredAgo": "Watered {{days}}d ago",
      "water": "Water"
    },
    "analytics": {
      "stageBreakdown": "Stage breakdown",
      "plantsOverview": "Plants overview",
      "noPlants": "No plants added yet",
      "trayUtilization": "Tray utilization",
      "planted": "Planted",
      "empty": "Empty"
    },
    "settings": {
      "trayConfig": "Tray Configuration",
      "trayConfigDesc": "Adjust your seedling tray dimensions.",
      "resizeWarning": "Reducing dimensions may remove cells. Planted cells in removed positions will be lost.",
      "currentSize": "Current size: {{rows}} × {{cols}} ({{total}} cells)"
    },
    "germDaysLabel": "Germination (days)",
    "germDaysPlaceholder": "e.g. 7",
    "transplantDaysLabel": "Transplant (days)",
    "transplantDaysPlaceholder": "e.g. 42"
  }
}
```

French translations follow the same structure in `public/locales/fr/common.json`.

---

## 7. Implementation Order

1. **Database migration** — Create migration file + update sync SQL
2. **TypeScript types** — Add `SeedlingStage`, `SeedlingTrayCell`, update `GardenType` and `Garden`
3. **Backend functions** — CRUD for cells, update `createGarden`/`getGarden`
4. **Creation dialog** — Seedling button + tray dimension picker
5. **Seedling components** — StageIcon, TrayGrid, CellModal, CareList, Analytics
6. **Dashboard integration** — Tray tab, cell loading, rendering
7. **Settings** — TrayDimensionEditor
8. **i18n** — English + French keys
9. **Garden list badge** — Seedling tag on cards
10. **Documentation** — Update GARDEN_TYPES.md

---

## 8. Data Flow

```
Garden Creation (seedling type)
  → createGarden({ gardenType: 'seedling', trayRows: 4, trayCols: 6 })
  → INSERT into gardens (with tray_rows, tray_cols)
  → Bulk INSERT 24 empty cells into seedling_tray_cells
  → Navigate to /garden/:id

Garden Dashboard (Tray tab)
  → getSeedlingTrayCells(gardenId) → fetch all cells ordered by position
  → Render SeedlingTrayGrid with cells in a rows×cols CSS grid
  → Click cell → open SeedlingCellModal
    → Search plant catalog → select species
    → Set stage, sow date, watering
    → Save → updateSeedlingTrayCell(cellId, data)
    → Refresh cells

Multi-select edit
  → Enter select mode → click cells to toggle selection
  → Click "Edit" → SeedlingCellModal in multi mode
  → Save → updateSeedlingTrayCells(selectedIds, data)

Resize tray (Settings)
  → Change rows/cols → resizeSeedlingTray(gardenId, newRows, newCols)
  → If growing: INSERT new empty cells for new positions
  → If shrinking: DELETE cells at positions >= newRows*newCols
  → UPDATE gardens SET tray_rows, tray_cols
```

---

## 9. Visual Design Notes

- Tray cells use subtle background colors per stage (adapted from prototype for dark/light mode):
  - Empty: `bg-stone-100 dark:bg-stone-800`
  - Sown: `bg-amber-50 dark:bg-amber-950/30`
  - Germinating: `bg-emerald-50 dark:bg-emerald-950/30`
  - Sprouted: `bg-emerald-100 dark:bg-emerald-900/30`
  - Ready: `bg-emerald-200 dark:bg-emerald-800/30`
- Border colors follow stage theming
- Selection uses emerald ring + checkmark dot
- Water indicator: small blue dot (top-right) when >2 days since last watered
- Seedling tag: emerald badge (vs sky-blue for beginner)
- All components use Tailwind + Radix UI Dialog (consistent with app patterns)

---

## 10. Files to Create

| File | Purpose |
|------|---------|
| `supabase/migrations/20260325000000_add_seedling_tray.sql` | DB migration |
| `src/components/seedling-tray/SeedlingStageIcon.tsx` | Stage icon component |
| `src/components/seedling-tray/SeedlingTrayGrid.tsx` | Main tray grid + toolbar |
| `src/components/seedling-tray/SeedlingCellModal.tsx` | Cell edit dialog |
| `src/components/seedling-tray/SeedlingCareList.tsx` | Care schedule list |
| `src/components/seedling-tray/SeedlingTrayAnalytics.tsx` | Tray analytics view |
| `src/components/seedling-tray/SeedlingTrayDimensionEditor.tsx` | Settings dimension editor |
| `src/components/seedling-tray/index.ts` | Barrel export |

## 11. Files to Modify

| File | Change |
|------|--------|
| `src/types/garden.ts` | Add `SeedlingStage`, `SeedlingTrayCell`, update `GardenType`, `Garden` |
| `src/lib/gardens.ts` | Update `createGarden`, `getGarden`, `getUserGardens`; add seedling CRUD |
| `src/pages/GardenListPage.tsx` | Add seedling type button + tray picker in creation dialog; seedling tag on cards |
| `src/pages/GardenDashboardPage.tsx` | Add Tray tab, load cells, render tray components, seedling tag |
| `src/components/garden/GardenSettingsSection.tsx` | Add tray config category for seedling gardens |
| `supabase/sync_parts/12_audit_and_analytics.sql` | Update garden_type CHECK, add tray columns, add seedling_tray_cells table |
| `public/locales/en/common.json` | Add seedling i18n keys |
| `public/locales/fr/common.json` | Add seedling i18n keys (French) |
| `GARDEN_TYPES.md` | Document seedling garden type |
