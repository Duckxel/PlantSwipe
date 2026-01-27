-- ========== GDPR Compliance Migration ==========
-- This migration adds GDPR compliance features:
-- 1. Consent tracking columns for marketing and terms
-- 2. GDPR audit log table for tracking data access/deletion
-- 3. Cookie consent preferences

-- ========== Add consent tracking columns to profiles ==========
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'marketing_consent'
  ) THEN
    ALTER TABLE public.profiles 
      ADD COLUMN marketing_consent boolean DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'marketing_consent_date'
  ) THEN
    ALTER TABLE public.profiles 
      ADD COLUMN marketing_consent_date timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'terms_accepted_date'
  ) THEN
    ALTER TABLE public.profiles 
      ADD COLUMN terms_accepted_date timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'privacy_policy_accepted_date'
  ) THEN
    ALTER TABLE public.profiles 
      ADD COLUMN privacy_policy_accepted_date timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'analytics_consent'
  ) THEN
    ALTER TABLE public.profiles 
      ADD COLUMN analytics_consent boolean DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'analytics_consent_date'
  ) THEN
    ALTER TABLE public.profiles 
      ADD COLUMN analytics_consent_date timestamptz;
  END IF;
END $$;

-- ========== GDPR Audit Log Table ==========
-- Records GDPR-related actions for compliance auditing
CREATE TABLE IF NOT EXISTS public.gdpr_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

-- Index for efficient queries by user
CREATE INDEX IF NOT EXISTS gdpr_audit_log_user_id_idx ON public.gdpr_audit_log(user_id);
-- Index for queries by action type
CREATE INDEX IF NOT EXISTS gdpr_audit_log_action_idx ON public.gdpr_audit_log(action);
-- Index for queries by date
CREATE INDEX IF NOT EXISTS gdpr_audit_log_created_at_idx ON public.gdpr_audit_log(created_at DESC);

-- Enable RLS
ALTER TABLE public.gdpr_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='gdpr_audit_log' AND policyname='gdpr_audit_log_admin_select') THEN
    DROP POLICY gdpr_audit_log_admin_select ON public.gdpr_audit_log;
  END IF;
  CREATE POLICY gdpr_audit_log_admin_select ON public.gdpr_audit_log
    FOR SELECT TO authenticated
    USING (public.is_admin_user((SELECT auth.uid())));
END $$;

-- Grant permissions
GRANT SELECT ON public.gdpr_audit_log TO authenticated;

-- ========== Add data retention tracking ==========
-- Track when data was last anonymized for retention compliance
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'web_visits' 
    AND column_name = 'anonymized_at'
  ) THEN
    ALTER TABLE public.web_visits 
      ADD COLUMN anonymized_at timestamptz;
  END IF;
END $$;

-- ========== Update profiles RLS to allow consent updates ==========
-- Users should be able to update their own consent preferences
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_update_consent') THEN
    DROP POLICY profiles_update_consent ON public.profiles;
  END IF;
  CREATE POLICY profiles_update_consent ON public.profiles
    FOR UPDATE TO authenticated
    USING (id = (SELECT auth.uid()))
    WITH CHECK (id = (SELECT auth.uid()));
END $$;

-- ========== Helper function to log GDPR actions ==========
CREATE OR REPLACE FUNCTION public.log_gdpr_action(
  _user_id uuid,
  _action text,
  _details jsonb DEFAULT '{}'::jsonb,
  _ip_address inet DEFAULT NULL,
  _user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO public.gdpr_audit_log (user_id, action, details, ip_address, user_agent)
  VALUES (_user_id, _action, _details, _ip_address, _user_agent)
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_gdpr_action(uuid, text, jsonb, inet, text) TO authenticated;

-- ========== Comments for documentation ==========
COMMENT ON TABLE public.gdpr_audit_log IS 'Audit log for GDPR compliance - tracks data exports, deletions, and consent changes';
COMMENT ON COLUMN public.profiles.marketing_consent IS 'User consent for marketing communications';
COMMENT ON COLUMN public.profiles.marketing_consent_date IS 'Timestamp when marketing consent was given/updated';
COMMENT ON COLUMN public.profiles.terms_accepted_date IS 'Timestamp when terms of service were accepted';
COMMENT ON COLUMN public.profiles.privacy_policy_accepted_date IS 'Timestamp when privacy policy was accepted';
COMMENT ON COLUMN public.profiles.analytics_consent IS 'User consent for analytics tracking';
COMMENT ON COLUMN public.profiles.analytics_consent_date IS 'Timestamp when analytics consent was given/updated';
