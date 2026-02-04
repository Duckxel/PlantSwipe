-- Migration: Add email verification system
-- Description: Adds email_verified column to profiles and creates email_verification_codes table for OTP-based email verification

-- Add email_verified column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;

-- Create index for quick lookups on email verification status
CREATE INDEX IF NOT EXISTS idx_profiles_email_verified ON profiles(email_verified);

-- Create email_verification_codes table
-- Stores temporary verification codes with 5-minute expiry
CREATE TABLE IF NOT EXISTS email_verification_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  code VARCHAR(8) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ DEFAULT NULL,
  
  -- Add index for quick lookups by user_id
  CONSTRAINT unique_active_code_per_user UNIQUE (user_id, code)
);

-- Create index for cleanup job (finding expired codes)
CREATE INDEX IF NOT EXISTS idx_verification_codes_expires_at ON email_verification_codes(expires_at);

-- Create index for user lookup
CREATE INDEX IF NOT EXISTS idx_verification_codes_user_id ON email_verification_codes(user_id);

-- Add comments for documentation
COMMENT ON COLUMN profiles.email_verified IS 'Whether the user has verified their email address via OTP code';
COMMENT ON TABLE email_verification_codes IS 'Stores temporary verification codes for email verification. Codes expire after 5 minutes.';
COMMENT ON COLUMN email_verification_codes.user_id IS 'The user who requested the verification code';
COMMENT ON COLUMN email_verification_codes.code IS 'The 6-character alphanumeric verification code';
COMMENT ON COLUMN email_verification_codes.created_at IS 'When the code was generated';
COMMENT ON COLUMN email_verification_codes.expires_at IS 'When the code expires (5 minutes after creation)';
COMMENT ON COLUMN email_verification_codes.used_at IS 'When the code was successfully used (null if not used yet)';

-- Function to clean up expired verification codes (to be called by daily job)
CREATE OR REPLACE FUNCTION cleanup_expired_verification_codes()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM email_verification_codes
  WHERE expires_at < NOW()
  OR used_at IS NOT NULL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_verification_codes() IS 'Removes expired or already-used verification codes. Should be called periodically by a daily cleanup job.';

-- Grant necessary permissions for the function
GRANT EXECUTE ON FUNCTION cleanup_expired_verification_codes() TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_verification_codes() TO service_role;

-- Enable RLS on the verification codes table
ALTER TABLE email_verification_codes ENABLE ROW LEVEL SECURITY;

-- RLS policy: Users can only see their own verification codes
DROP POLICY IF EXISTS "Users can view their own verification codes" ON email_verification_codes;
CREATE POLICY "Users can view their own verification codes"
  ON email_verification_codes
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS policy: Only service role can insert/update/delete (server-side operations)
DROP POLICY IF EXISTS "Service role can manage verification codes" ON email_verification_codes;
CREATE POLICY "Service role can manage verification codes"
  ON email_verification_codes
  FOR ALL
  USING (auth.role() = 'service_role');

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
    'SELECT cleanup_expired_verification_codes();'
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
  UPDATE profiles
  SET email_verified = false
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION reset_email_verification_on_email_change(uuid) IS 'Resets email_verified to false when a user changes their email address. Called from the application when email is updated.';

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION reset_email_verification_on_email_change(uuid) TO authenticated;
