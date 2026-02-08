-- PLANT SCANS TABLE
-- Stores plant identification scans using Kindwise API
-- =============================================

-- ========== Plant Scans Table ==========
-- Use CREATE TABLE IF NOT EXISTS to preserve existing data
CREATE TABLE IF NOT EXISTS public.plant_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Image information
  image_url TEXT NOT NULL,
  image_path TEXT,  -- Storage path if stored in Supabase
  image_bucket TEXT DEFAULT 'PHOTOS',
  
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
  
  -- Classification level used for the identification request
  classification_level TEXT DEFAULT 'species',  -- 'species', 'all', or 'genus'
  
  -- Link to our database plant (if matched)
  matched_plant_id TEXT REFERENCES public.plants(id) ON DELETE SET NULL,
  
  -- User notes
  user_notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ  -- Soft delete
);

-- Add columns if they don't exist (safe migration for existing tables)
ALTER TABLE public.plant_scans ADD COLUMN IF NOT EXISTS image_path TEXT;
ALTER TABLE public.plant_scans ADD COLUMN IF NOT EXISTS image_bucket TEXT DEFAULT 'PHOTOS';
ALTER TABLE public.plant_scans ADD COLUMN IF NOT EXISTS api_access_token TEXT;
ALTER TABLE public.plant_scans ADD COLUMN IF NOT EXISTS api_model_version TEXT;
ALTER TABLE public.plant_scans ADD COLUMN IF NOT EXISTS api_status TEXT DEFAULT 'pending';
ALTER TABLE public.plant_scans ADD COLUMN IF NOT EXISTS api_response JSONB;
ALTER TABLE public.plant_scans ADD COLUMN IF NOT EXISTS is_plant BOOLEAN;
ALTER TABLE public.plant_scans ADD COLUMN IF NOT EXISTS is_plant_probability NUMERIC(5,4);
ALTER TABLE public.plant_scans ADD COLUMN IF NOT EXISTS top_match_name TEXT;
ALTER TABLE public.plant_scans ADD COLUMN IF NOT EXISTS top_match_scientific_name TEXT;
ALTER TABLE public.plant_scans ADD COLUMN IF NOT EXISTS top_match_probability NUMERIC(5,4);
ALTER TABLE public.plant_scans ADD COLUMN IF NOT EXISTS top_match_entity_id TEXT;
ALTER TABLE public.plant_scans ADD COLUMN IF NOT EXISTS suggestions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.plant_scans ADD COLUMN IF NOT EXISTS similar_images JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.plant_scans ADD COLUMN IF NOT EXISTS latitude NUMERIC(9,6);
ALTER TABLE public.plant_scans ADD COLUMN IF NOT EXISTS longitude NUMERIC(9,6);
ALTER TABLE public.plant_scans ADD COLUMN IF NOT EXISTS classification_level TEXT DEFAULT 'species';
ALTER TABLE public.plant_scans ADD COLUMN IF NOT EXISTS matched_plant_id TEXT;
ALTER TABLE public.plant_scans ADD COLUMN IF NOT EXISTS user_notes TEXT;
ALTER TABLE public.plant_scans ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.plant_scans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.plant_scans ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add foreign key constraint if it doesn't exist (for matched_plant_id)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'plant_scans_matched_plant_id_fkey' 
    AND table_name = 'plant_scans'
  ) THEN
    ALTER TABLE public.plant_scans 
    ADD CONSTRAINT plant_scans_matched_plant_id_fkey 
    FOREIGN KEY (matched_plant_id) REFERENCES public.plants(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Indexes for plant_scans
CREATE INDEX IF NOT EXISTS idx_plant_scans_user_id ON public.plant_scans(user_id);
CREATE INDEX IF NOT EXISTS idx_plant_scans_created_at ON public.plant_scans(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_plant_scans_top_match ON public.plant_scans(top_match_name);
CREATE INDEX IF NOT EXISTS idx_plant_scans_matched_plant ON public.plant_scans(matched_plant_id);

-- Enable RLS
ALTER TABLE public.plant_scans ENABLE ROW LEVEL SECURITY;

-- Grant access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plant_scans TO authenticated;

-- ========== RLS Policies for Plant Scans ==========
-- Users can only see their own scans
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='plant_scans' AND policyname='plant_scans_select_own') THEN
    DROP POLICY plant_scans_select_own ON public.plant_scans;
  END IF;
  CREATE POLICY plant_scans_select_own ON public.plant_scans FOR SELECT TO authenticated
    USING (auth.uid() = user_id);
END $$;

-- Users can insert their own scans
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='plant_scans' AND policyname='plant_scans_insert_own') THEN
    DROP POLICY plant_scans_insert_own ON public.plant_scans;
  END IF;
  CREATE POLICY plant_scans_insert_own ON public.plant_scans FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);
END $$;

-- Users can update their own scans
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='plant_scans' AND policyname='plant_scans_update_own') THEN
    DROP POLICY plant_scans_update_own ON public.plant_scans;
  END IF;
  CREATE POLICY plant_scans_update_own ON public.plant_scans FOR UPDATE TO authenticated
    USING (auth.uid() = user_id);
END $$;

-- Users can delete their own scans
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='plant_scans' AND policyname='plant_scans_delete_own') THEN
    DROP POLICY plant_scans_delete_own ON public.plant_scans;
  END IF;
  CREATE POLICY plant_scans_delete_own ON public.plant_scans FOR DELETE TO authenticated
    USING (auth.uid() = user_id);
END $$;

-- ========== Storage Bucket for Scan Images ==========
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
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='plant_scans_upload_own') THEN
    CREATE POLICY plant_scans_upload_own ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'plant-scans' 
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='plant_scans_view_public') THEN
    CREATE POLICY plant_scans_view_public ON storage.objects FOR SELECT TO public
      USING (bucket_id = 'plant-scans');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='plant_scans_delete_own') THEN
    CREATE POLICY plant_scans_delete_own ON storage.objects FOR DELETE TO authenticated
      USING (
        bucket_id = 'plant-scans'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;

-- ========== Trigger for updated_at ==========
CREATE OR REPLACE FUNCTION public.update_plant_scan_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_plant_scan_updated_at ON public.plant_scans;
CREATE TRIGGER trigger_plant_scan_updated_at
  BEFORE UPDATE ON public.plant_scans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_plant_scan_updated_at();

-- Comments for documentation
COMMENT ON TABLE public.plant_scans IS 'Stores plant identification scans from users using Kindwise Plant.id API';
COMMENT ON COLUMN public.plant_scans.api_response IS 'Full JSON response from Kindwise API for reference';
COMMENT ON COLUMN public.plant_scans.suggestions IS 'Array of plant identification suggestions with probabilities';
COMMENT ON COLUMN public.plant_scans.matched_plant_id IS 'Reference to our plants table if a match was found';

-- =============================================
-- BUG CATCHER SYSTEM
-- Tables and functions for bug catcher actions, responses, reports, and points
-- =============================================

-- ========== Bug Actions Table ==========
-- Tasks that bug catchers can complete to earn points
CREATE TABLE IF NOT EXISTS public.bug_actions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text,
    points_reward integer NOT NULL DEFAULT 10,
    status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'planned', 'active', 'closed')),
    release_date timestamptz,  -- When the action becomes available (for planned status)
    questions jsonb DEFAULT '[]',  -- Array of questions: [{id, title, required, type}]
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    completed_count integer DEFAULT 0  -- Cached count of completions
);

CREATE INDEX IF NOT EXISTS idx_bug_actions_status ON public.bug_actions(status);
CREATE INDEX IF NOT EXISTS idx_bug_actions_release_date ON public.bug_actions(release_date) WHERE status = 'planned';

COMMENT ON TABLE public.bug_actions IS 'Tasks/actions that bug catchers can complete to earn points';
COMMENT ON COLUMN public.bug_actions.questions IS 'Array of question objects: [{id: string, title: string, required: boolean, type: "text"|"textarea"|"boolean"}]';

-- ========== Bug Action Responses Table ==========
-- User responses to actions
CREATE TABLE IF NOT EXISTS public.bug_action_responses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    action_id uuid NOT NULL REFERENCES public.bug_actions(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    answers jsonb DEFAULT '{}',  -- {questionId: answer}
    points_earned integer DEFAULT 0,
    completed_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(action_id, user_id)  -- Each user can only complete an action once
);

CREATE INDEX IF NOT EXISTS idx_bug_action_responses_user ON public.bug_action_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_bug_action_responses_action ON public.bug_action_responses(action_id);

COMMENT ON TABLE public.bug_action_responses IS 'User responses to bug catcher actions';

-- ========== Bug Reports Table ==========
-- Bugs reported by bug catchers
CREATE TABLE IF NOT EXISTS public.bug_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    bug_name text NOT NULL,
    description text NOT NULL,
    steps_to_reproduce text,
    screenshots jsonb DEFAULT '[]',  -- Array of image URLs
    user_info jsonb DEFAULT '{}',  -- {username, role, server, device}
    console_logs text,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'closed', 'completed')),
    points_earned integer DEFAULT 0,
    admin_notes text,
    reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    resolved_at timestamptz
);

-- Add foreign key to profiles for Supabase PostgREST joins
-- This enables the profiles:user_id embed syntax in queries
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'bug_reports_user_id_profiles_fkey' 
        AND table_name = 'bug_reports'
    ) THEN
        ALTER TABLE public.bug_reports 
        ADD CONSTRAINT bug_reports_user_id_profiles_fkey 
        FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bug_reports_user ON public.bug_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON public.bug_reports(status);
CREATE INDEX IF NOT EXISTS idx_bug_reports_created ON public.bug_reports(created_at DESC);

COMMENT ON TABLE public.bug_reports IS 'Bug reports submitted by bug catchers';

-- ========== Bug Points History Table ==========
-- Track point transactions
CREATE TABLE IF NOT EXISTS public.bug_points_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    points integer NOT NULL,
    reason text NOT NULL,  -- 'action_completed', 'bug_report_accepted', 'bonus', 'adjustment'
    reference_id uuid,  -- Reference to action_response or bug_report
    reference_type text,  -- 'action' or 'bug_report'
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bug_points_history_user ON public.bug_points_history(user_id);
CREATE INDEX IF NOT EXISTS idx_bug_points_history_created ON public.bug_points_history(created_at DESC);

COMMENT ON TABLE public.bug_points_history IS 'History of all point transactions for bug catchers';

-- ========== Bug Catcher Functions ==========

-- Function to get bug catcher leaderboard (top N)
CREATE OR REPLACE FUNCTION public.get_bug_catcher_leaderboard(_limit integer DEFAULT 10)
RETURNS TABLE(
    rank bigint,
    user_id uuid,
    display_name text,
    avatar_url text,
    bug_points integer,
    actions_completed bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        ROW_NUMBER() OVER (ORDER BY COALESCE(p.bug_points, 0) DESC, p.id) as rank,
        p.id as user_id,
        p.display_name,
        p.avatar_url,
        COALESCE(p.bug_points, 0) as bug_points,
        COUNT(DISTINCT bar.id) as actions_completed
    FROM public.profiles p
    LEFT JOIN public.bug_action_responses bar ON bar.user_id = p.id
    WHERE 'bug_catcher' = ANY(COALESCE(p.roles, '{}'))
    GROUP BY p.id, p.display_name, p.avatar_url, p.bug_points
    ORDER BY COALESCE(p.bug_points, 0) DESC, p.id
    LIMIT _limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_bug_catcher_leaderboard(integer) TO authenticated;

-- Function to get user's bug catcher rank
CREATE OR REPLACE FUNCTION public.get_bug_catcher_rank(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        (SELECT rank::integer FROM (
            SELECT 
                p.id,
                ROW_NUMBER() OVER (ORDER BY COALESCE(p.bug_points, 0) DESC, p.id) as rank
            FROM public.profiles p
            WHERE 'bug_catcher' = ANY(COALESCE(p.roles, '{}'))
        ) ranked WHERE id = _user_id),
        0
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_bug_catcher_rank(uuid) TO authenticated;

-- Function to get available actions for a bug catcher (max N uncompleted)
CREATE OR REPLACE FUNCTION public.get_available_bug_actions(_user_id uuid, _limit integer DEFAULT 5)
RETURNS TABLE(
    id uuid,
    title text,
    description text,
    points_reward integer,
    questions jsonb,
    created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        ba.id,
        ba.title,
        ba.description,
        ba.points_reward,
        ba.questions,
        ba.created_at
    FROM public.bug_actions ba
    WHERE ba.status = 'active'
    AND NOT EXISTS (
        SELECT 1 FROM public.bug_action_responses bar 
        WHERE bar.action_id = ba.id AND bar.user_id = _user_id
    )
    ORDER BY ba.created_at DESC
    LIMIT _limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_available_bug_actions(uuid, integer) TO authenticated;

-- Function to get completed actions for a user
CREATE OR REPLACE FUNCTION public.get_completed_bug_actions(_user_id uuid)
RETURNS TABLE(
    id uuid,
    action_id uuid,
    title text,
    description text,
    points_earned integer,
    answers jsonb,
    completed_at timestamptz,
    action_status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        bar.id,
        bar.action_id,
        ba.title,
        ba.description,
        bar.points_earned,
        bar.answers,
        bar.completed_at,
        ba.status as action_status
    FROM public.bug_action_responses bar
    JOIN public.bug_actions ba ON ba.id = bar.action_id
    WHERE bar.user_id = _user_id
    ORDER BY bar.completed_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_completed_bug_actions(uuid) TO authenticated;

-- Function to submit action response
CREATE OR REPLACE FUNCTION public.submit_bug_action_response(
    _user_id uuid,
    _action_id uuid,
    _answers jsonb
)
RETURNS TABLE(success boolean, points_earned integer, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_action_status text;
    v_points_reward integer;
    v_response_id uuid;
BEGIN
    -- Check if action exists and is active
    SELECT status, points_reward INTO v_action_status, v_points_reward
    FROM public.bug_actions WHERE id = _action_id;
    
    IF v_action_status IS NULL THEN
        RETURN QUERY SELECT false, 0, 'Action not found'::text;
        RETURN;
    END IF;
    
    IF v_action_status != 'active' THEN
        RETURN QUERY SELECT false, 0, 'Action is not active'::text;
        RETURN;
    END IF;
    
    -- Check if user has bug_catcher role
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND 'bug_catcher' = ANY(COALESCE(roles, '{}'))) THEN
        RETURN QUERY SELECT false, 0, 'User is not a bug catcher'::text;
        RETURN;
    END IF;
    
    -- Check if already completed
    IF EXISTS (SELECT 1 FROM public.bug_action_responses WHERE action_id = _action_id AND user_id = _user_id) THEN
        RETURN QUERY SELECT false, 0, 'Action already completed'::text;
        RETURN;
    END IF;
    
    -- Insert response
    INSERT INTO public.bug_action_responses (action_id, user_id, answers, points_earned)
    VALUES (_action_id, _user_id, _answers, v_points_reward)
    RETURNING id INTO v_response_id;
    
    -- Update user's bug points
    UPDATE public.profiles 
    SET bug_points = COALESCE(bug_points, 0) + v_points_reward
    WHERE id = _user_id;
    
    -- Add to points history
    INSERT INTO public.bug_points_history (user_id, points, reason, reference_id, reference_type)
    VALUES (_user_id, v_points_reward, 'action_completed', v_response_id, 'action');
    
    -- Update action completed count
    UPDATE public.bug_actions 
    SET completed_count = COALESCE(completed_count, 0) + 1
    WHERE id = _action_id;
    
    RETURN QUERY SELECT true, v_points_reward, 'Action completed successfully'::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_bug_action_response(uuid, uuid, jsonb) TO authenticated;

-- Function to update an action response (if action not closed)
CREATE OR REPLACE FUNCTION public.update_bug_action_response(
    _user_id uuid,
    _response_id uuid,
    _answers jsonb
)
RETURNS TABLE(success boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_action_status text;
BEGIN
    -- Check if response exists and belongs to user
    SELECT ba.status INTO v_action_status
    FROM public.bug_action_responses bar
    JOIN public.bug_actions ba ON ba.id = bar.action_id
    WHERE bar.id = _response_id AND bar.user_id = _user_id;
    
    IF v_action_status IS NULL THEN
        RETURN QUERY SELECT false, 'Response not found'::text;
        RETURN;
    END IF;
    
    IF v_action_status = 'closed' THEN
        RETURN QUERY SELECT false, 'Cannot update response for closed action'::text;
        RETURN;
    END IF;
    
    -- Update response
    UPDATE public.bug_action_responses 
    SET answers = _answers, updated_at = now()
    WHERE id = _response_id AND user_id = _user_id;
    
    RETURN QUERY SELECT true, 'Response updated successfully'::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_bug_action_response(uuid, uuid, jsonb) TO authenticated;

-- Function to submit a bug report (auto-fills user info from profile)
-- Drop the old version with _user_info parameter to avoid ambiguity
DROP FUNCTION IF EXISTS public.submit_bug_report(uuid, text, text, text, jsonb, jsonb, text);
CREATE OR REPLACE FUNCTION public.submit_bug_report(
    _user_id uuid,
    _bug_name text,
    _description text,
    _steps_to_reproduce text DEFAULT NULL,
    _screenshots jsonb DEFAULT '[]',
    _console_logs text DEFAULT NULL
)
RETURNS TABLE(success boolean, report_id uuid, points_earned integer, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_report_id uuid;
    v_base_points integer := 5;  -- Base points for submitting a bug report
    v_user_info jsonb;
    v_display_name text;
    v_roles text[];
BEGIN
    -- Check if user has bug_catcher role and get profile info
    SELECT display_name, roles INTO v_display_name, v_roles
    FROM public.profiles 
    WHERE id = _user_id AND 'bug_catcher' = ANY(COALESCE(roles, '{}'));
    
    IF v_display_name IS NULL AND v_roles IS NULL THEN
        RETURN QUERY SELECT false, NULL::uuid, 0, 'User is not a bug catcher'::text;
        RETURN;
    END IF;
    
    -- Auto-populate user info from profile
    v_user_info := jsonb_build_object(
        'username', COALESCE(v_display_name, ''),
        'roles', COALESCE(array_to_string(v_roles, ', '), 'bug_catcher'),
        'user_id', _user_id::text
    );
    
    -- Insert bug report
    INSERT INTO public.bug_reports (
        user_id, bug_name, description, steps_to_reproduce, 
        screenshots, user_info, console_logs, points_earned
    )
    VALUES (
        _user_id, _bug_name, _description, _steps_to_reproduce,
        _screenshots, v_user_info, _console_logs, v_base_points
    )
    RETURNING id INTO v_report_id;
    
    -- Award base points for submission
    UPDATE public.profiles 
    SET bug_points = COALESCE(bug_points, 0) + v_base_points
    WHERE id = _user_id;
    
    -- Add to points history
    INSERT INTO public.bug_points_history (user_id, points, reason, reference_id, reference_type)
    VALUES (_user_id, v_base_points, 'bug_report_submitted', v_report_id, 'bug_report');
    
    RETURN QUERY SELECT true, v_report_id, v_base_points, 'Bug report submitted successfully'::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_bug_report(uuid, text, text, text, jsonb, text) TO authenticated;

-- Function for admin to complete a bug report (awards bonus points)
CREATE OR REPLACE FUNCTION public.admin_complete_bug_report(
    _report_id uuid,
    _admin_id uuid,
    _bonus_points integer DEFAULT 15,
    _admin_notes text DEFAULT NULL
)
RETURNS TABLE(success boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_current_status text;
BEGIN
    -- Get report info
    SELECT user_id, status INTO v_user_id, v_current_status
    FROM public.bug_reports WHERE id = _report_id;
    
    IF v_user_id IS NULL THEN
        RETURN QUERY SELECT false, 'Bug report not found'::text;
        RETURN;
    END IF;
    
    IF v_current_status IN ('closed', 'completed') THEN
        RETURN QUERY SELECT false, 'Bug report already resolved'::text;
        RETURN;
    END IF;
    
    -- Update report
    UPDATE public.bug_reports 
    SET status = 'completed',
        points_earned = COALESCE(points_earned, 0) + _bonus_points,
        admin_notes = _admin_notes,
        reviewed_by = _admin_id,
        resolved_at = now(),
        updated_at = now()
    WHERE id = _report_id;
    
    -- Award bonus points to user
    UPDATE public.profiles 
    SET bug_points = COALESCE(bug_points, 0) + _bonus_points
    WHERE id = v_user_id;
    
    -- Add to points history
    INSERT INTO public.bug_points_history (user_id, points, reason, reference_id, reference_type)
    VALUES (v_user_id, _bonus_points, 'bug_report_accepted', _report_id, 'bug_report');
    
    RETURN QUERY SELECT true, 'Bug report completed and bonus points awarded'::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_complete_bug_report(uuid, uuid, integer, text) TO authenticated;

-- Function for admin to close a bug report (duplicate or invalid - no bonus points)
CREATE OR REPLACE FUNCTION public.admin_close_bug_report(
    _report_id uuid,
    _admin_id uuid,
    _admin_notes text DEFAULT NULL
)
RETURNS TABLE(success boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_status text;
BEGIN
    -- Get report status
    SELECT status INTO v_current_status
    FROM public.bug_reports WHERE id = _report_id;
    
    IF v_current_status IS NULL THEN
        RETURN QUERY SELECT false, 'Bug report not found'::text;
        RETURN;
    END IF;
    
    IF v_current_status IN ('closed', 'completed') THEN
        RETURN QUERY SELECT false, 'Bug report already resolved'::text;
        RETURN;
    END IF;
    
    -- Update report
    UPDATE public.bug_reports 
    SET status = 'closed',
        admin_notes = _admin_notes,
        reviewed_by = _admin_id,
        resolved_at = now(),
        updated_at = now()
    WHERE id = _report_id;
    
    RETURN QUERY SELECT true, 'Bug report closed'::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_close_bug_report(uuid, uuid, text) TO authenticated;

-- Function to get bug catcher stats for admin
CREATE OR REPLACE FUNCTION public.get_bug_catcher_stats()
RETURNS TABLE(
    total_bug_catchers bigint,
    total_actions bigint,
    active_actions bigint,
    total_responses bigint,
    pending_bug_reports bigint,
    total_points_awarded bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        (SELECT COUNT(*) FROM public.profiles WHERE 'bug_catcher' = ANY(COALESCE(roles, '{}'))) as total_bug_catchers,
        (SELECT COUNT(*) FROM public.bug_actions) as total_actions,
        (SELECT COUNT(*) FROM public.bug_actions WHERE status = 'active') as active_actions,
        (SELECT COUNT(*) FROM public.bug_action_responses) as total_responses,
        (SELECT COUNT(*) FROM public.bug_reports WHERE status = 'pending') as pending_bug_reports,
        (SELECT COALESCE(SUM(bug_points), 0) FROM public.profiles WHERE 'bug_catcher' = ANY(COALESCE(roles, '{}'))) as total_points_awarded;
$$;

GRANT EXECUTE ON FUNCTION public.get_bug_catcher_stats() TO authenticated;

-- Function to get user bug reports
CREATE OR REPLACE FUNCTION public.get_user_bug_reports(_user_id uuid)
RETURNS TABLE(
    id uuid,
    bug_name text,
    description text,
    status text,
    points_earned integer,
    created_at timestamptz,
    resolved_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        br.id,
        br.bug_name,
        br.description,
        br.status,
        br.points_earned,
        br.created_at,
        br.resolved_at
    FROM public.bug_reports br
    WHERE br.user_id = _user_id
    ORDER BY br.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_bug_reports(uuid) TO authenticated;

-- ========== Bug Catcher RLS Policies ==========

-- Enable RLS on all bug catcher tables
ALTER TABLE public.bug_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bug_action_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bug_points_history ENABLE ROW LEVEL SECURITY;

-- Bug Actions policies
-- Uses is_admin_user() SECURITY DEFINER function to bypass profiles RLS
-- Note: Using (select auth.uid()) pattern for consistent RLS evaluation
DROP POLICY IF EXISTS "Bug catchers can view active actions" ON public.bug_actions;
CREATE POLICY "Bug catchers can view active actions" ON public.bug_actions
    FOR SELECT
    TO authenticated
    USING (status = 'active' OR public.is_admin_user((select auth.uid())));

DROP POLICY IF EXISTS "Admins can manage all actions" ON public.bug_actions;
CREATE POLICY "Admins can manage all actions" ON public.bug_actions
    FOR ALL
    TO authenticated
    USING (public.is_admin_user((select auth.uid())))
    WITH CHECK (public.is_admin_user((select auth.uid())));

-- Bug Action Responses policies
-- Uses is_admin_user() SECURITY DEFINER function to bypass profiles RLS
-- Note: Using (select auth.uid()) pattern for consistent RLS evaluation
DROP POLICY IF EXISTS "Users can view own responses" ON public.bug_action_responses;
CREATE POLICY "Users can view own responses" ON public.bug_action_responses
    FOR SELECT
    TO authenticated
    USING (user_id = (select auth.uid()) OR public.is_admin_user((select auth.uid())));

DROP POLICY IF EXISTS "Users can insert own responses" ON public.bug_action_responses;
CREATE POLICY "Users can insert own responses" ON public.bug_action_responses
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own responses" ON public.bug_action_responses;
CREATE POLICY "Users can update own responses" ON public.bug_action_responses
    FOR UPDATE
    TO authenticated
    USING (user_id = (select auth.uid()))
    WITH CHECK (user_id = (select auth.uid()));

-- Bug Reports policies
-- Allow users to view their own reports, admins can view all
-- Uses is_admin_user() SECURITY DEFINER function to bypass profiles RLS
-- Note: Using (select auth.uid()) pattern for consistent RLS evaluation
DROP POLICY IF EXISTS "Users can view own reports" ON public.bug_reports;
CREATE POLICY "Users can view own reports" ON public.bug_reports
    FOR SELECT
    TO authenticated
    USING (
        user_id = (select auth.uid()) 
        OR public.is_admin_user((select auth.uid()))
    );

DROP POLICY IF EXISTS "Users can insert own reports" ON public.bug_reports;
CREATE POLICY "Users can insert own reports" ON public.bug_reports
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = (select auth.uid()));

-- Allow admins to update any report (for reviewing, completing, closing)
-- Uses is_admin_user() SECURITY DEFINER function to bypass profiles RLS
DROP POLICY IF EXISTS "Admins can update reports" ON public.bug_reports;
CREATE POLICY "Admins can update reports" ON public.bug_reports
    FOR UPDATE
    TO authenticated
    USING (public.is_admin_user((select auth.uid())))
    WITH CHECK (public.is_admin_user((select auth.uid())));

-- Bug Points History policies
-- Uses is_admin_user() SECURITY DEFINER function to bypass profiles RLS
-- Note: Using (select auth.uid()) pattern for consistent RLS evaluation
DROP POLICY IF EXISTS "Users can view own points history" ON public.bug_points_history;
CREATE POLICY "Users can view own points history" ON public.bug_points_history
    FOR SELECT
    TO authenticated
    USING (
        user_id = (select auth.uid()) 
        OR public.is_admin_user((select auth.uid()))
    );

DROP POLICY IF EXISTS "System can insert points history" ON public.bug_points_history;
CREATE POLICY "System can insert points history" ON public.bug_points_history
    FOR INSERT
    TO authenticated
    WITH CHECK (true);  -- Controlled by functions

-- Grant authenticated users access to tables (needed for RLS to work)
GRANT SELECT ON public.bug_actions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.bug_action_responses TO authenticated;
GRANT SELECT, INSERT ON public.bug_reports TO authenticated;
GRANT SELECT, INSERT ON public.bug_points_history TO authenticated;

-- Admins need full access
GRANT ALL ON public.bug_actions TO authenticated;
GRANT ALL ON public.bug_reports TO authenticated;

-- =============================================================================
-- RATE LIMITING TRIGGERS AND INDEXES
-- =============================================================================

-- Plant Request Rate Limiting
CREATE OR REPLACE FUNCTION public.check_plant_request_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request_count INTEGER;
  v_rate_limit INTEGER := 10; -- Max plant requests per hour
  v_window_interval INTERVAL := '1 hour';
BEGIN
  -- Count requests by this user in the last hour
  SELECT COUNT(*)::INTEGER INTO v_request_count
  FROM public.plant_request_users
  WHERE user_id = NEW.user_id
    AND created_at > NOW() - v_window_interval;
  
  IF v_request_count >= v_rate_limit THEN
    RAISE EXCEPTION 'Rate limit exceeded. Please wait before requesting more plants.';
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS plant_request_rate_limit_trigger ON public.plant_request_users;
CREATE TRIGGER plant_request_rate_limit_trigger
  BEFORE INSERT ON public.plant_request_users
  FOR EACH ROW
  EXECUTE FUNCTION public.check_plant_request_rate_limit();

-- Friend Request Rate Limiting
CREATE OR REPLACE FUNCTION public.check_friend_request_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request_count INTEGER;
  v_rate_limit INTEGER := 50; -- Max friend requests per hour
  v_window_interval INTERVAL := '1 hour';
BEGIN
  -- Only check for new pending requests (not status updates)
  IF NEW.status = 'pending' THEN
    -- Count pending friend requests sent by this user in the last hour
    SELECT COUNT(*)::INTEGER INTO v_request_count
    FROM public.friends
    WHERE user_id = NEW.user_id
      AND status = 'pending'
      AND created_at > NOW() - v_window_interval;
    
    IF v_request_count >= v_rate_limit THEN
      RAISE EXCEPTION 'Rate limit exceeded. Please wait before sending more friend requests.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS friend_request_rate_limit_trigger ON public.friends;
CREATE TRIGGER friend_request_rate_limit_trigger
  BEFORE INSERT ON public.friends
  FOR EACH ROW
  EXECUTE FUNCTION public.check_friend_request_rate_limit();

-- Reaction Rate Limiting
CREATE OR REPLACE FUNCTION public.check_reaction_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reaction_count INTEGER;
  v_rate_limit INTEGER := 500; -- Max reactions per hour
  v_window_interval INTERVAL := '1 hour';
BEGIN
  -- Count reactions added by this user in the last hour
  SELECT COUNT(*)::INTEGER INTO v_reaction_count
  FROM public.message_reactions
  WHERE user_id = NEW.user_id
    AND created_at > NOW() - v_window_interval;
  
  IF v_reaction_count >= v_rate_limit THEN
    RAISE EXCEPTION 'Rate limit exceeded. Please wait before adding more reactions.';
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reaction_rate_limit_trigger ON public.message_reactions;
CREATE TRIGGER reaction_rate_limit_trigger
  BEFORE INSERT ON public.message_reactions
  FOR EACH ROW
  EXECUTE FUNCTION public.check_reaction_rate_limit();

-- Rate Limiting Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_messages_sender_created 
  ON public.messages(sender_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_plant_request_users_user_created
  ON public.plant_request_users(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_participant1_created
  ON public.conversations(participant_1, created_at DESC);

-- Note: friends table doesn't have a status column (it only contains accepted friendships)
-- The status column is on friend_requests table, not friends
CREATE INDEX IF NOT EXISTS idx_friends_user_created
  ON public.friends(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_message_reactions_user_created
  ON public.message_reactions(user_id, created_at DESC);

