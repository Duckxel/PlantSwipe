-- =============================================================================
-- SECURITY IMPROVEMENTS MIGRATION
-- 1. Distributed Rate Limiting using PostgreSQL
-- 2. Security audit logging enhancements
-- =============================================================================

-- =============================================================================
-- RATE LIMITING TABLE
-- Stores rate limit entries for distributed rate limiting across server instances
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Identifier: can be user_id, IP address, or combination
  identifier text NOT NULL,
  -- Action being rate limited (e.g., 'scan', 'ai_chat', 'translate')
  action text NOT NULL,
  -- Timestamp of the request
  requested_at timestamptz NOT NULL DEFAULT NOW(),
  -- Optional metadata (e.g., endpoint, user agent)
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Composite index for efficient rate limit queries
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup 
  ON public.rate_limits(identifier, action, requested_at DESC);

-- Index for cleanup of old entries
CREATE INDEX IF NOT EXISTS idx_rate_limits_cleanup 
  ON public.rate_limits(requested_at);

-- Enable RLS
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- No direct user access - only service role can write
-- This is intentional: rate limiting happens server-side only

-- =============================================================================
-- RATE LIMIT CHECK FUNCTION
-- Returns true if the action is allowed, false if rate limited
-- Automatically records the attempt if allowed
-- =============================================================================

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_identifier text,
  p_action text,
  p_max_requests integer,
  p_window_seconds integer DEFAULT 3600,
  p_record_attempt boolean DEFAULT true
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_window_start timestamptz;
BEGIN
  -- Calculate window start time
  v_window_start := NOW() - (p_window_seconds || ' seconds')::interval;
  
  -- Count requests in the window
  SELECT COUNT(*)::integer INTO v_count
  FROM public.rate_limits
  WHERE identifier = p_identifier
    AND action = p_action
    AND requested_at > v_window_start;
  
  -- Check if limit exceeded
  IF v_count >= p_max_requests THEN
    RETURN false;  -- Rate limited
  END IF;
  
  -- Record the attempt if requested
  IF p_record_attempt THEN
    INSERT INTO public.rate_limits (identifier, action, requested_at)
    VALUES (p_identifier, p_action, NOW());
  END IF;
  
  RETURN true;  -- Allowed
END;
$$;

-- =============================================================================
-- RATE LIMIT CLEANUP FUNCTION
-- Removes old rate limit entries to prevent table bloat
-- Should be called periodically via cron
-- =============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_rate_limits(
  p_max_age_hours integer DEFAULT 24
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.rate_limits
  WHERE requested_at < NOW() - (p_max_age_hours || ' hours')::interval;
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- =============================================================================
-- RATE LIMIT CONFIGURATION TABLE
-- Stores configurable rate limits for different actions
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.rate_limit_config (
  action text PRIMARY KEY,
  max_requests integer NOT NULL,
  window_seconds integer NOT NULL DEFAULT 3600,
  description text,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

-- Insert default rate limit configurations
INSERT INTO public.rate_limit_config (action, max_requests, window_seconds, description) VALUES
  ('scan', 60, 3600, 'Plant identification scans - AI/API costs'),
  ('ai_chat', 120, 3600, 'AI garden chat messages - OpenAI costs'),
  ('translate', 500, 3600, 'Translation API calls - DeepL costs'),
  ('image_upload', 100, 3600, 'Image uploads - storage costs'),
  ('bug_report', 20, 3600, 'Bug report submissions - spam prevention'),
  ('garden_activity', 300, 3600, 'Garden activity logs'),
  ('garden_journal', 50, 3600, 'Journal entry creation'),
  ('push_notify', 300, 3600, 'Push notification sending'),
  ('message_send', 300, 3600, 'Direct message sending'),
  ('friend_request', 50, 3600, 'Friend request sending'),
  ('conversation_create', 30, 3600, 'New conversation creation'),
  ('data_export', 5, 3600, 'GDPR data export requests'),
  ('password_reset', 5, 3600, 'Password reset requests')
ON CONFLICT (action) DO NOTHING;

-- Enable RLS
ALTER TABLE public.rate_limit_config ENABLE ROW LEVEL SECURITY;

-- Allow authenticated admins to read config
CREATE POLICY rate_limit_config_admin_read ON public.rate_limit_config
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'super_admin')
    )
  );

-- =============================================================================
-- SECURITY AUDIT ENHANCEMENTS
-- Add more detailed tracking for security-sensitive operations
-- =============================================================================

-- Add index for faster security audit queries
CREATE INDEX IF NOT EXISTS idx_gdpr_audit_log_action_created
  ON public.gdpr_audit_log(action, created_at DESC);

-- Add security event types to audit log if table exists
DO $$
BEGIN
  -- Add rate_limit_exceeded tracking
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'gdpr_audit_log') THEN
    -- Ensure we can track rate limit events
    COMMENT ON TABLE public.gdpr_audit_log IS 
      'Audit log for GDPR-sensitive and security-related actions including rate limit violations';
  END IF;
END $$;

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

-- Rate limits table: only service role should access directly
-- The check_rate_limit function is SECURITY DEFINER so it can write

-- Allow the cleanup function to be called by cron/service
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, text, integer, integer, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_rate_limits(integer) TO service_role;
