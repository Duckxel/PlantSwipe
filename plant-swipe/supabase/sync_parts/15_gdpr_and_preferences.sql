
-- ========== GDPR COMPLIANCE ==========
-- Added for GDPR compliance requirements including consent tracking and audit logging

-- Add consent tracking columns to profiles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='marketing_consent') THEN
    ALTER TABLE public.profiles ADD COLUMN marketing_consent boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='marketing_consent_date') THEN
    ALTER TABLE public.profiles ADD COLUMN marketing_consent_date timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='terms_accepted_date') THEN
    ALTER TABLE public.profiles ADD COLUMN terms_accepted_date timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='privacy_policy_accepted_date') THEN
    ALTER TABLE public.profiles ADD COLUMN privacy_policy_accepted_date timestamptz;
  END IF;
  -- Track which version of legal documents user accepted
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='terms_version_accepted') THEN
    ALTER TABLE public.profiles ADD COLUMN terms_version_accepted text DEFAULT '1.0.0';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='privacy_version_accepted') THEN
    ALTER TABLE public.profiles ADD COLUMN privacy_version_accepted text DEFAULT '1.0.0';
  END IF;
  -- User Setup/Onboarding Preferences
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='setup_completed') THEN
    ALTER TABLE public.profiles ADD COLUMN setup_completed boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='garden_type') THEN
    ALTER TABLE public.profiles ADD COLUMN garden_type text CHECK (garden_type IS NULL OR garden_type IN ('inside', 'outside', 'both'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='experience_level') THEN
    ALTER TABLE public.profiles ADD COLUMN experience_level text CHECK (experience_level IS NULL OR experience_level IN ('novice', 'intermediate', 'expert'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='looking_for') THEN
    ALTER TABLE public.profiles ADD COLUMN looking_for text CHECK (looking_for IS NULL OR looking_for IN ('eat', 'ornamental', 'various'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='notification_time') THEN
    ALTER TABLE public.profiles ADD COLUMN notification_time text DEFAULT '10h'
      CHECK (
        notification_time IS NULL
        OR (
          notification_time ~ '^[0-9]{1,2}h?$'
          AND regexp_replace(notification_time, '[^0-9]', '', 'g')::int BETWEEN 0 AND 23
        )
      );
  END IF;
END $$;

-- Create index for quick lookups on setup_completed
CREATE INDEX IF NOT EXISTS idx_profiles_setup_completed ON public.profiles(setup_completed);

COMMENT ON COLUMN public.profiles.setup_completed IS 'Whether the user has completed the initial setup wizard';
COMMENT ON COLUMN public.profiles.garden_type IS 'Garden location preference: inside, outside, or both';
COMMENT ON COLUMN public.profiles.experience_level IS 'User gardening experience: novice, intermediate, or expert';
COMMENT ON COLUMN public.profiles.looking_for IS 'User gardening goal: eat (vegetables/fruits), ornamental (flowers), or various (diverse plants)';
COMMENT ON COLUMN public.profiles.notification_time IS 'Preferred notification hour in local time (0-23), stored as text like "6h" or "18h"';

-- Email Verification
-- Add email_verified column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_profiles_email_verified ON public.profiles(email_verified);
COMMENT ON COLUMN public.profiles.email_verified IS 'Whether the user has verified their email address via OTP code';

-- Force Password Change
-- When true, user must change their password before accessing the app (e.g., after magic link login)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN DEFAULT FALSE;
COMMENT ON COLUMN public.profiles.force_password_change IS 'When true, user must change their password before accessing any other page. Set after forgot-password magic link login.';

-- Email verification codes table for OTP-based email verification
CREATE TABLE IF NOT EXISTS public.email_verification_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code VARCHAR(8) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ DEFAULT NULL,
  CONSTRAINT unique_active_code_per_user UNIQUE (user_id, code)
);

CREATE INDEX IF NOT EXISTS idx_verification_codes_expires_at ON public.email_verification_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_verification_codes_user_id ON public.email_verification_codes(user_id);

COMMENT ON TABLE public.email_verification_codes IS 'Stores temporary verification codes for email verification. Codes expire after 5 minutes.';
COMMENT ON COLUMN public.email_verification_codes.user_id IS 'The user who requested the verification code';
COMMENT ON COLUMN public.email_verification_codes.code IS 'The 6-character alphanumeric verification code';
COMMENT ON COLUMN public.email_verification_codes.created_at IS 'When the code was generated';
COMMENT ON COLUMN public.email_verification_codes.expires_at IS 'When the code expires (5 minutes after creation)';
COMMENT ON COLUMN public.email_verification_codes.used_at IS 'When the code was successfully used (null if not used yet)';

-- Add target_email column for email change flow (stores the new email the user wants to change to)
ALTER TABLE public.email_verification_codes ADD COLUMN IF NOT EXISTS target_email TEXT DEFAULT NULL;
COMMENT ON COLUMN public.email_verification_codes.target_email IS 'For email change: the new email address the user wants to change to. NULL for standard email verification.';

-- Function to clean up expired verification codes (to be called by daily job)
CREATE OR REPLACE FUNCTION cleanup_expired_verification_codes()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.email_verification_codes
  WHERE expires_at < NOW()
  OR used_at IS NOT NULL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SET search_path = public;

COMMENT ON FUNCTION cleanup_expired_verification_codes() IS 'Removes expired or already-used verification codes. Should be called periodically by a daily cleanup job.';

-- Grant necessary permissions for the cleanup function
GRANT EXECUTE ON FUNCTION cleanup_expired_verification_codes() TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_verification_codes() TO service_role;

-- Enable RLS on the verification codes table
ALTER TABLE public.email_verification_codes ENABLE ROW LEVEL SECURITY;

-- RLS policy: Users can only see their own verification codes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_verification_codes' AND policyname = 'Users can view their own verification codes') THEN
    CREATE POLICY "Users can view their own verification codes"
      ON public.email_verification_codes
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- RLS policy: Only service role can insert/update/delete (server-side operations)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_verification_codes' AND policyname = 'Service role can manage verification codes') THEN
    CREATE POLICY "Service role can manage verification codes"
      ON public.email_verification_codes
      FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- Schedule daily cleanup of expired verification codes (runs at 2:30 AM UTC)
DO $$
BEGIN
  -- Remove existing schedule if it exists (to allow updates)
  PERFORM cron.unschedule('cleanup_expired_verification_codes');
EXCEPTION
  WHEN OTHERS THEN NULL; -- Ignore if job doesn't exist
END $$;

DO $outer$
BEGIN
  PERFORM cron.schedule(
    'cleanup_expired_verification_codes',
    '30 2 * * *',
    'SELECT public.cleanup_expired_verification_codes();'
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Failed to schedule cleanup_expired_verification_codes cron job: %', SQLERRM;
END $outer$;

-- Function to reset email_verified when user's email changes
-- This is called from the frontend when email is updated
CREATE OR REPLACE FUNCTION reset_email_verification_on_email_change(p_user_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET email_verified = false
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION reset_email_verification_on_email_change(uuid) IS 'Resets email_verified to false when a user changes their email address. Called from the application when email is updated.';

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION reset_email_verification_on_email_change(uuid) TO authenticated;

-- GDPR Audit Log Table
CREATE TABLE IF NOT EXISTS public.gdpr_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.gdpr_audit_log IS 'GDPR compliance audit log tracking data access, exports, and deletions';
COMMENT ON COLUMN public.gdpr_audit_log.action IS 'Type of GDPR action: DATA_EXPORT, ACCOUNT_DELETION, CONSENT_UPDATE, DATA_ACCESS';

CREATE INDEX IF NOT EXISTS gdpr_audit_log_user_id_idx ON public.gdpr_audit_log(user_id);
CREATE INDEX IF NOT EXISTS gdpr_audit_log_action_idx ON public.gdpr_audit_log(action);
CREATE INDEX IF NOT EXISTS gdpr_audit_log_created_at_idx ON public.gdpr_audit_log(created_at DESC);

ALTER TABLE public.gdpr_audit_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='gdpr_audit_log' AND policyname='gdpr_audit_log_admin_select') THEN
    DROP POLICY gdpr_audit_log_admin_select ON public.gdpr_audit_log;
  END IF;
  CREATE POLICY gdpr_audit_log_admin_select ON public.gdpr_audit_log FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.is_admin = true));
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='gdpr_audit_log' AND policyname='gdpr_audit_log_insert_all') THEN
    DROP POLICY gdpr_audit_log_insert_all ON public.gdpr_audit_log;
  END IF;
  CREATE POLICY gdpr_audit_log_insert_all ON public.gdpr_audit_log FOR INSERT TO public
    WITH CHECK (true);
END $$;

GRANT SELECT ON public.gdpr_audit_log TO authenticated;
GRANT INSERT ON public.gdpr_audit_log TO authenticated;

-- Cookie Consent Tracking Table (optional server-side tracking)
CREATE TABLE IF NOT EXISTS public.user_cookie_consent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id text,
  consent_level text NOT NULL CHECK (consent_level IN ('essential', 'analytics', 'all', 'rejected')),
  consent_version text DEFAULT '1.0',
  consented_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  ip_address inet,
  user_agent text
);

CREATE INDEX IF NOT EXISTS user_cookie_consent_user_idx ON public.user_cookie_consent(user_id);
CREATE INDEX IF NOT EXISTS user_cookie_consent_session_idx ON public.user_cookie_consent(session_id);

ALTER TABLE public.user_cookie_consent ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_cookie_consent' AND policyname='cookie_consent_own') THEN
    DROP POLICY cookie_consent_own ON public.user_cookie_consent;
  END IF;
  CREATE POLICY cookie_consent_own ON public.user_cookie_consent FOR ALL TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_cookie_consent' AND policyname='cookie_consent_insert_anon') THEN
    DROP POLICY cookie_consent_insert_anon ON public.user_cookie_consent;
  END IF;
  CREATE POLICY cookie_consent_insert_anon ON public.user_cookie_consent FOR INSERT TO public
    WITH CHECK (true);
END $$;

GRANT SELECT, INSERT, UPDATE ON public.user_cookie_consent TO authenticated;
GRANT INSERT ON public.user_cookie_consent TO anon;

-- ========== Granular Communication Preferences ==========
DO $$
BEGIN
  -- Email notification preferences
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='email_product_updates') THEN
    ALTER TABLE public.profiles ADD COLUMN email_product_updates boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='email_tips_advice') THEN
    ALTER TABLE public.profiles ADD COLUMN email_tips_advice boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='email_community_highlights') THEN
    ALTER TABLE public.profiles ADD COLUMN email_community_highlights boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='email_promotions') THEN
    ALTER TABLE public.profiles ADD COLUMN email_promotions boolean DEFAULT false;
  END IF;
  -- Push notification preferences
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='push_task_reminders') THEN
    ALTER TABLE public.profiles ADD COLUMN push_task_reminders boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='push_friend_activity') THEN
    ALTER TABLE public.profiles ADD COLUMN push_friend_activity boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='push_messages') THEN
    ALTER TABLE public.profiles ADD COLUMN push_messages boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='push_garden_updates') THEN
    ALTER TABLE public.profiles ADD COLUMN push_garden_updates boolean DEFAULT true;
  END IF;
  -- Personalization preferences
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='personalized_recommendations') THEN
    ALTER TABLE public.profiles ADD COLUMN personalized_recommendations boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='analytics_improvement') THEN
    ALTER TABLE public.profiles ADD COLUMN analytics_improvement boolean DEFAULT true;
  END IF;
END $$;
