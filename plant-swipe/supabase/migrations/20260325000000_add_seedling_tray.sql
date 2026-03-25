-- Migration: Add 'seedling' garden type and seedling tray infrastructure
-- Date: 2026-03-25

-- 1. Update garden_type CHECK constraint to include 'seedling'
DO $$
BEGIN
  ALTER TABLE public.gardens DROP CONSTRAINT IF EXISTS gardens_garden_type_check;
  ALTER TABLE public.gardens ADD CONSTRAINT gardens_garden_type_check
    CHECK (garden_type IN ('default', 'beginners', 'seedling'));
EXCEPTION WHEN others THEN NULL;
END $$;

-- 2. Add tray dimension columns to gardens (only used when garden_type = 'seedling')
ALTER TABLE IF EXISTS public.gardens
  ADD COLUMN IF NOT EXISTS tray_rows INTEGER,
  ADD COLUMN IF NOT EXISTS tray_cols INTEGER;

-- 3. Create seedling_tray_cells table
CREATE TABLE IF NOT EXISTS public.seedling_tray_cells (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  garden_id UUID NOT NULL REFERENCES public.gardens(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_seedling_tray_cells_garden
  ON public.seedling_tray_cells(garden_id);

-- 4. RLS policies for seedling_tray_cells
ALTER TABLE public.seedling_tray_cells ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'seedling_tray_cells' AND policyname = 'seedling_cells_select') THEN
    CREATE POLICY seedling_cells_select ON public.seedling_tray_cells
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.garden_members gm
          WHERE gm.garden_id = seedling_tray_cells.garden_id
            AND gm.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'seedling_tray_cells' AND policyname = 'seedling_cells_insert') THEN
    CREATE POLICY seedling_cells_insert ON public.seedling_tray_cells
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.garden_members gm
          WHERE gm.garden_id = seedling_tray_cells.garden_id
            AND gm.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'seedling_tray_cells' AND policyname = 'seedling_cells_update') THEN
    CREATE POLICY seedling_cells_update ON public.seedling_tray_cells
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.garden_members gm
          WHERE gm.garden_id = seedling_tray_cells.garden_id
            AND gm.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'seedling_tray_cells' AND policyname = 'seedling_cells_delete') THEN
    CREATE POLICY seedling_cells_delete ON public.seedling_tray_cells
      FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM public.garden_members gm
          WHERE gm.garden_id = seedling_tray_cells.garden_id
            AND gm.user_id = auth.uid()
        )
      );
  END IF;
END $$;
