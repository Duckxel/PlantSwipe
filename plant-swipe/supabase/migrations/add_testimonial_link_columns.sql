-- Migration: Add link columns to landing_testimonials
-- Adds website URL and user profile linking support

-- Add author_website_url column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'landing_testimonials' 
    AND column_name = 'author_website_url'
  ) THEN
    ALTER TABLE public.landing_testimonials ADD COLUMN author_website_url text;
  END IF;
END $$;

-- Add linked_user_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'landing_testimonials' 
    AND column_name = 'linked_user_id'
  ) THEN
    ALTER TABLE public.landing_testimonials ADD COLUMN linked_user_id uuid references public.profiles(id) on delete set null;
  END IF;
END $$;
