-- ========== GDPR Compliance Migration ==========
-- Adds consent tracking, data export audit logging, and data retention support

-- ========== 1. Add consent tracking columns to profiles ==========
-- These columns track explicit consent for marketing, terms acceptance, and privacy policy

-- Marketing consent (explicit opt-in for marketing emails)
ALTER TABLE IF EXISTS public.profiles
ADD COLUMN IF NOT EXISTS marketing_consent boolean DEFAULT false;

-- Timestamp when marketing consent was given/withdrawn
ALTER TABLE IF EXISTS public.profiles
ADD COLUMN IF NOT EXISTS marketing_consent_date timestamptz;

-- Timestamp when terms of service were accepted
ALTER TABLE IF EXISTS public.profiles
ADD COLUMN IF NOT EXISTS terms_accepted_date timestamptz;

-- Timestamp when privacy policy was accepted
ALTER TABLE IF EXISTS public.profiles
ADD COLUMN IF NOT EXISTS privacy_policy_accepted_date timestamptz;

-- ========== 2. Add granular communication preferences ==========
-- Email notification preferences
ALTER TABLE IF EXISTS public.profiles
ADD COLUMN IF NOT EXISTS email_product_updates boolean DEFAULT true;

ALTER TABLE IF EXISTS public.profiles
ADD COLUMN IF NOT EXISTS email_tips_advice boolean DEFAULT true;

ALTER TABLE IF EXISTS public.profiles
ADD COLUMN IF NOT EXISTS email_community_highlights boolean DEFAULT true;

ALTER TABLE IF EXISTS public.profiles
ADD COLUMN IF NOT EXISTS email_promotions boolean DEFAULT false;

-- Push notification preferences
ALTER TABLE IF EXISTS public.profiles
ADD COLUMN IF NOT EXISTS push_task_reminders boolean DEFAULT true;

ALTER TABLE IF EXISTS public.profiles
ADD COLUMN IF NOT EXISTS push_friend_activity boolean DEFAULT true;

ALTER TABLE IF EXISTS public.profiles
ADD COLUMN IF NOT EXISTS push_messages boolean DEFAULT true;

ALTER TABLE IF EXISTS public.profiles
ADD COLUMN IF NOT EXISTS push_garden_updates boolean DEFAULT true;

-- Personalization preferences
ALTER TABLE IF EXISTS public.profiles
ADD COLUMN IF NOT EXISTS personalized_recommendations boolean DEFAULT true;

ALTER TABLE IF EXISTS public.profiles
ADD COLUMN IF NOT EXISTS analytics_improvement boolean DEFAULT true;

-- ========== 2. Create GDPR Audit Log Table ==========
-- Tracks all GDPR-related actions for compliance and accountability

CREATE TABLE IF NOT EXISTS public.gdpr_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

-- Add comment documenting the audit log purpose
COMMENT ON TABLE public.gdpr_audit_log IS 'GDPR compliance audit log tracking data access, exports, and deletions';
COMMENT ON COLUMN public.gdpr_audit_log.action IS 'Type of GDPR action: DATA_EXPORT, ACCOUNT_DELETION, CONSENT_UPDATE, DATA_ACCESS';
COMMENT ON COLUMN public.gdpr_audit_log.details IS 'Additional context about the action (anonymized where appropriate)';

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS gdpr_audit_log_user_id_idx ON public.gdpr_audit_log(user_id);
CREATE INDEX IF NOT EXISTS gdpr_audit_log_action_idx ON public.gdpr_audit_log(action);
CREATE INDEX IF NOT EXISTS gdpr_audit_log_created_at_idx ON public.gdpr_audit_log(created_at DESC);

-- Enable RLS - only admins can read audit logs, system can write
ALTER TABLE public.gdpr_audit_log ENABLE ROW LEVEL SECURITY;

-- Allow admins to read audit logs
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='gdpr_audit_log' AND policyname='gdpr_audit_log_admin_select') THEN
    DROP POLICY gdpr_audit_log_admin_select ON public.gdpr_audit_log;
  END IF;
  CREATE POLICY gdpr_audit_log_admin_select ON public.gdpr_audit_log FOR SELECT TO authenticated
    USING (
      EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.is_admin = true)
    );
END $$;

-- Allow server-side inserts (RLS bypass via service role)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='gdpr_audit_log' AND policyname='gdpr_audit_log_insert_all') THEN
    DROP POLICY gdpr_audit_log_insert_all ON public.gdpr_audit_log;
  END IF;
  CREATE POLICY gdpr_audit_log_insert_all ON public.gdpr_audit_log FOR INSERT TO public
    WITH CHECK (true);
END $$;

-- Grant permissions
GRANT SELECT ON public.gdpr_audit_log TO authenticated;
GRANT INSERT ON public.gdpr_audit_log TO authenticated;

-- ========== 3. Cookie Consent Tracking (optional, client-side) ==========
-- Note: Cookie consent is typically stored client-side in localStorage
-- This table can be used if server-side tracking is preferred

CREATE TABLE IF NOT EXISTS public.user_cookie_consent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id text, -- For anonymous users
  consent_level text NOT NULL CHECK (consent_level IN ('essential', 'analytics', 'all', 'rejected')),
  consent_version text DEFAULT '1.0',
  consented_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  ip_address inet,
  user_agent text
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS user_cookie_consent_user_idx ON public.user_cookie_consent(user_id);
CREATE INDEX IF NOT EXISTS user_cookie_consent_session_idx ON public.user_cookie_consent(session_id);

-- Enable RLS
ALTER TABLE public.user_cookie_consent ENABLE ROW LEVEL SECURITY;

-- Users can read/write their own consent
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_cookie_consent' AND policyname='cookie_consent_own') THEN
    DROP POLICY cookie_consent_own ON public.user_cookie_consent;
  END IF;
  CREATE POLICY cookie_consent_own ON public.user_cookie_consent FOR ALL TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));
END $$;

-- Allow inserts for anonymous tracking (session-based)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_cookie_consent' AND policyname='cookie_consent_insert_anon') THEN
    DROP POLICY cookie_consent_insert_anon ON public.user_cookie_consent;
  END IF;
  CREATE POLICY cookie_consent_insert_anon ON public.user_cookie_consent FOR INSERT TO public
    WITH CHECK (true);
END $$;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.user_cookie_consent TO authenticated;
GRANT INSERT ON public.user_cookie_consent TO anon;

-- ========== 4. Update existing users with default consent dates ==========
-- Set terms/privacy acceptance dates to created_at for existing users
-- (Assumes they accepted terms when they signed up)
UPDATE public.profiles
SET 
  terms_accepted_date = COALESCE(terms_accepted_date, (
    SELECT u.created_at FROM auth.users u WHERE u.id = profiles.id
  )),
  privacy_policy_accepted_date = COALESCE(privacy_policy_accepted_date, (
    SELECT u.created_at FROM auth.users u WHERE u.id = profiles.id
  ))
WHERE terms_accepted_date IS NULL OR privacy_policy_accepted_date IS NULL;
