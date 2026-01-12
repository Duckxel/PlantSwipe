-- Migration: Add Plant Scans Table
-- Stores user plant identification scans using Kindwise API

-- Create plant_scans table
CREATE TABLE IF NOT EXISTS plant_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Image information
  image_url TEXT NOT NULL,
  image_path TEXT,  -- Storage path if stored in Supabase
  image_bucket TEXT DEFAULT 'plant-scans',
  
  -- API request/response
  api_access_token TEXT,  -- Kindwise API access token for the request
  api_model_version TEXT,  -- e.g., 'plant_id:3.1.0'
  api_status TEXT DEFAULT 'pending',  -- pending, processing, completed, failed
  api_response JSONB,  -- Full API response stored for reference
  
  -- Identification results
  is_plant BOOLEAN,
  is_plant_probability NUMERIC(5,4),  -- 0.0000 to 1.0000
  
  -- Top match result (denormalized for easy querying)
  top_match_name TEXT,
  top_match_scientific_name TEXT,
  top_match_probability NUMERIC(5,4),
  top_match_entity_id TEXT,
  
  -- All suggestions stored as JSONB array
  suggestions JSONB DEFAULT '[]'::jsonb,
  
  -- Similar images from API
  similar_images JSONB DEFAULT '[]'::jsonb,
  
  -- Location data (optional)
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  
  -- Link to our database plant (if matched)
  matched_plant_id UUID REFERENCES plants(id) ON DELETE SET NULL,
  
  -- User notes
  user_notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ  -- Soft delete
);

-- Create index for user queries
CREATE INDEX IF NOT EXISTS idx_plant_scans_user_id ON plant_scans(user_id);
CREATE INDEX IF NOT EXISTS idx_plant_scans_created_at ON plant_scans(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_plant_scans_top_match ON plant_scans(top_match_name);
CREATE INDEX IF NOT EXISTS idx_plant_scans_matched_plant ON plant_scans(matched_plant_id);

-- Enable RLS
ALTER TABLE plant_scans ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only see their own scans
CREATE POLICY "Users can view their own scans"
  ON plant_scans
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own scans
CREATE POLICY "Users can create their own scans"
  ON plant_scans
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own scans
CREATE POLICY "Users can update their own scans"
  ON plant_scans
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can soft delete their own scans
CREATE POLICY "Users can delete their own scans"
  ON plant_scans
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create storage bucket for scan images if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'plant-scans',
  'plant-scans',
  true,
  10485760,  -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/avif']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for plant-scans bucket
CREATE POLICY "Users can upload their own scan images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'plant-scans' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Anyone can view scan images"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'plant-scans');

CREATE POLICY "Users can delete their own scan images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'plant-scans'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_plant_scan_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_plant_scan_updated_at ON plant_scans;
CREATE TRIGGER trigger_plant_scan_updated_at
  BEFORE UPDATE ON plant_scans
  FOR EACH ROW
  EXECUTE FUNCTION update_plant_scan_updated_at();

-- Comment for documentation
COMMENT ON TABLE plant_scans IS 'Stores plant identification scans from users using Kindwise Plant.id API';
COMMENT ON COLUMN plant_scans.api_response IS 'Full JSON response from Kindwise API for reference';
COMMENT ON COLUMN plant_scans.suggestions IS 'Array of plant identification suggestions with probabilities';
COMMENT ON COLUMN plant_scans.matched_plant_id IS 'Reference to our plants table if a match was found';
