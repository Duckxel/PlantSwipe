-- ============================================================================
-- Migration: Add Landing Page Showcase Configuration
-- Description: Creates a table to store configurable showcase section data
--              for the landing page, editable via admin panel
-- ============================================================================

-- Create the landing_showcase_config table
CREATE TABLE IF NOT EXISTS landing_showcase_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Garden Card Settings
  garden_name TEXT NOT NULL DEFAULT 'My Indoor Jungle',
  plants_count INTEGER NOT NULL DEFAULT 12,
  species_count INTEGER NOT NULL DEFAULT 8,
  streak_count INTEGER NOT NULL DEFAULT 7,
  progress_percent INTEGER NOT NULL DEFAULT 85 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  cover_image_url TEXT,
  
  -- Tasks (JSONB array of {id, text, completed})
  tasks JSONB NOT NULL DEFAULT '[
    {"id": "1", "text": "Water your Pothos", "completed": true},
    {"id": "2", "text": "Fertilize Monstera", "completed": false},
    {"id": "3", "text": "Mist your Fern", "completed": false}
  ]'::jsonb,
  
  -- Members (JSONB array of {id, name, role, avatar_url, color})
  members JSONB NOT NULL DEFAULT '[
    {"id": "1", "name": "Sophie", "role": "owner", "avatar_url": null, "color": "#10b981"},
    {"id": "2", "name": "Marcus", "role": "member", "avatar_url": null, "color": "#3b82f6"}
  ]'::jsonb,
  
  -- Plant Cards (JSONB array of {id, plant_id, name, image_url, gradient, tasks_due})
  plant_cards JSONB NOT NULL DEFAULT '[
    {"id": "1", "plant_id": null, "name": "Monstera", "image_url": null, "gradient": "from-emerald-400 to-teal-500", "tasks_due": 1},
    {"id": "2", "plant_id": null, "name": "Pothos", "image_url": null, "gradient": "from-lime-400 to-green-500", "tasks_due": 2},
    {"id": "3", "plant_id": null, "name": "Snake Plant", "image_url": null, "gradient": "from-green-400 to-emerald-500", "tasks_due": 0},
    {"id": "4", "plant_id": null, "name": "Fern", "image_url": null, "gradient": "from-teal-400 to-cyan-500", "tasks_due": 0},
    {"id": "5", "plant_id": null, "name": "Peace Lily", "image_url": null, "gradient": "from-emerald-500 to-green-600", "tasks_due": 0},
    {"id": "6", "plant_id": null, "name": "Calathea", "image_url": null, "gradient": "from-green-500 to-teal-600", "tasks_due": 0}
  ]'::jsonb,
  
  -- Analytics Card Settings
  completion_rate INTEGER NOT NULL DEFAULT 92 CHECK (completion_rate >= 0 AND completion_rate <= 100),
  analytics_streak INTEGER NOT NULL DEFAULT 14,
  chart_data JSONB NOT NULL DEFAULT '[3, 5, 2, 6, 4, 5, 6]'::jsonb,
  
  -- Calendar (30 days history: array of {date, status})
  calendar_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_landing_showcase_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS landing_showcase_config_updated_at ON landing_showcase_config;
CREATE TRIGGER landing_showcase_config_updated_at
  BEFORE UPDATE ON landing_showcase_config
  FOR EACH ROW
  EXECUTE FUNCTION update_landing_showcase_config_updated_at();

-- Enable RLS
ALTER TABLE landing_showcase_config ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Anyone can read the showcase config (it's public landing page data)
DROP POLICY IF EXISTS "Anyone can read landing_showcase_config" ON landing_showcase_config;
CREATE POLICY "Anyone can read landing_showcase_config"
  ON landing_showcase_config FOR SELECT
  USING (true);

-- Only admins can modify the showcase config
DROP POLICY IF EXISTS "Admins can update landing_showcase_config" ON landing_showcase_config;
CREATE POLICY "Admins can update landing_showcase_config"
  ON landing_showcase_config FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

DROP POLICY IF EXISTS "Admins can insert landing_showcase_config" ON landing_showcase_config;
CREATE POLICY "Admins can insert landing_showcase_config"
  ON landing_showcase_config FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

DROP POLICY IF EXISTS "Admins can delete landing_showcase_config" ON landing_showcase_config;
CREATE POLICY "Admins can delete landing_showcase_config"
  ON landing_showcase_config FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Insert default row if table is empty
INSERT INTO landing_showcase_config (id)
SELECT gen_random_uuid()
WHERE NOT EXISTS (SELECT 1 FROM landing_showcase_config);

-- Add comment
COMMENT ON TABLE landing_showcase_config IS 'Configuration for the landing page showcase section, editable via admin panel';
