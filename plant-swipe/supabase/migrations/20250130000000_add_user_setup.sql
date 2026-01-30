-- Migration: Add user setup/onboarding fields to profiles table
-- Description: Stores user preferences from the initial setup wizard after signup

-- Add setup completion flag
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS setup_completed BOOLEAN DEFAULT FALSE;

-- Add garden type preference (where user's garden is located)
-- Values: 'inside', 'outside', 'both'
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS garden_type TEXT;

-- Add experience level
-- Values: 'novice', 'intermediate', 'expert'
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS experience_level TEXT;

-- Add gardening purpose/goal
-- Values: 'eat', 'ornamental', 'various'
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS looking_for TEXT;

-- Add preferred notification time
-- Values: '6h', '10h', '14h', '17h' (representing 6:00 AM, 10:00 AM, 2:00 PM, 5:00 PM)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notification_time TEXT DEFAULT '10h';

-- Create index for quick lookups on setup_completed
CREATE INDEX IF NOT EXISTS idx_profiles_setup_completed ON profiles(setup_completed);

-- Add comments for documentation
COMMENT ON COLUMN profiles.setup_completed IS 'Whether the user has completed the initial setup wizard';
COMMENT ON COLUMN profiles.garden_type IS 'Garden location preference: inside, outside, or both';
COMMENT ON COLUMN profiles.experience_level IS 'User gardening experience: novice, intermediate, or expert';
COMMENT ON COLUMN profiles.looking_for IS 'User gardening goal: eat (vegetables/fruits), ornamental (flowers), or various (diverse plants)';
COMMENT ON COLUMN profiles.notification_time IS 'Preferred notification time: 6h, 10h, 14h, or 17h';
