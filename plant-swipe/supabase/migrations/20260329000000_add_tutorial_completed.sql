-- Add tutorial_completed flag to profiles
-- When false (default), the onboarding tutorial is shown after signup + email verification
-- Skipping the tutorial also sets this to true

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tutorial_completed BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_profiles_tutorial_completed ON public.profiles(tutorial_completed);

COMMENT ON COLUMN public.profiles.tutorial_completed IS 'Whether the user has completed the onboarding tutorial. When false, the tutorial is shown on every login. Skipping the tutorial also sets this to true.';
