-- Migration: Allow any hour for notification_time
-- Description: Expand notification_time to accept 0-23h values

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_notification_time_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_notification_time_check
  CHECK (
    notification_time IS NULL
    OR (
      notification_time ~ '^[0-9]{1,2}h?$'
      AND regexp_replace(notification_time, '[^0-9]', '', 'g')::int BETWEEN 0 AND 23
    )
  );

COMMENT ON COLUMN profiles.notification_time IS 'Preferred notification hour in local time (0-23), stored as text like "6h" or "18h"';
