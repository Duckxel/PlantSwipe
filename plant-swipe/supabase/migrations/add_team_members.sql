-- ========== Team Members Table ==========
-- Stores team members displayed on the About page
-- Managed via Admin > Advanced > Team

CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL,
  tag TEXT,
  image_url TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for ordering
CREATE INDEX IF NOT EXISTS idx_team_members_position ON public.team_members(position);
CREATE INDEX IF NOT EXISTS idx_team_members_active ON public.team_members(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Policies: anyone can read active team members, only admins can modify
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'team_members' AND policyname = 'team_members_select_public') THEN
    CREATE POLICY team_members_select_public ON public.team_members 
      FOR SELECT TO authenticated, anon 
      USING (is_active = true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'team_members' AND policyname = 'team_members_admin_all') THEN
    CREATE POLICY team_members_admin_all ON public.team_members 
      FOR ALL TO authenticated 
      USING (
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
      );
  END IF;
END $$;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_team_members_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS team_members_updated_at ON public.team_members;
CREATE TRIGGER team_members_updated_at
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_team_members_updated_at();

-- Insert initial team members
INSERT INTO public.team_members (name, display_name, role, tag, image_url, position, is_active)
VALUES 
  ('lauryne', 'Lauryne Gaignard', 'CEO', NULL, NULL, 0, true),
  ('xavier', 'Xavier Sabar', 'Co-Founder', 'Psychokwak', 'https://media.aphylia.app/UTILITY/admin/uploads/webp/img-0151-ab46ee91-19d9-4c9f-9694-8c975c084cf1.webp', 1, true),
  ('five', 'Chan AH-HONG', 'Co-Founder', 'Five', 'https://media.aphylia.app/UTILITY/admin/uploads/webp/img-0414-2-low-0a499a50-08a7-4615-834d-288b179e628e.webp', 2, true)
ON CONFLICT DO NOTHING;

COMMENT ON TABLE public.team_members IS 'Team members displayed on the About page, managed via Admin panel';
