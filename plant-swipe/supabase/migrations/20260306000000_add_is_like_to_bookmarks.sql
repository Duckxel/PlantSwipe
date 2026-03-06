-- Add is_like boolean column to bookmarks table
-- This column marks a bookmark as the user's "Likes" bookmark
ALTER TABLE public.bookmarks ADD COLUMN IF NOT EXISTS is_like boolean NOT NULL DEFAULT false;

-- Ensure each user can only have one likes bookmark
CREATE UNIQUE INDEX IF NOT EXISTS bookmarks_user_likes_unique ON public.bookmarks (user_id) WHERE is_like = true;

-- Create likes bookmarks for all existing users who don't have one yet
INSERT INTO public.bookmarks (user_id, name, visibility, is_like)
SELECT p.id, 'Likes', 'private', true
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.bookmarks b WHERE b.user_id = p.id AND b.is_like = true
);

-- Migrate existing liked_plant_ids into the likes bookmark
INSERT INTO public.bookmark_items (bookmark_id, plant_id)
SELECT b.id, unnest(p.liked_plant_ids)
FROM public.profiles p
JOIN public.bookmarks b ON b.user_id = p.id AND b.is_like = true
WHERE p.liked_plant_ids IS NOT NULL AND array_length(p.liked_plant_ids, 1) > 0
ON CONFLICT DO NOTHING;
