-- Add roles column to profiles table for user role management
-- Roles: admin, editor, pro, merchant, creator, vip, plus

-- Add the roles column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'roles'
    ) THEN
        ALTER TABLE public.profiles 
        ADD COLUMN roles text[] DEFAULT '{}';
        
        -- Create an index for faster role queries
        CREATE INDEX IF NOT EXISTS idx_profiles_roles ON public.profiles USING GIN (roles);
        
        -- Add a comment documenting the roles
        COMMENT ON COLUMN public.profiles.roles IS 'User roles: admin, editor, pro, merchant, creator, vip, plus';
    END IF;
END $$;

-- Migrate existing is_admin=true users to have admin role
UPDATE public.profiles 
SET roles = array_append(COALESCE(roles, '{}'), 'admin')
WHERE is_admin = true 
AND NOT ('admin' = ANY(COALESCE(roles, '{}')));

-- Create a function to check if a user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = _user_id 
        AND _role = ANY(COALESCE(roles, '{}'))
    );
$$;

-- Create a function to check if a user has any of the specified roles
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = _user_id 
        AND COALESCE(roles, '{}') && _roles
    );
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid, text[]) TO authenticated;

-- Update get_profile_public_by_display_name to include roles
DROP FUNCTION IF EXISTS public.get_profile_public_by_display_name(text);
CREATE OR REPLACE FUNCTION public.get_profile_public_by_display_name(_name text)
RETURNS TABLE(
  id uuid,
  display_name text,
  country text,
  bio text,
  avatar_url text,
  accent_key text,
  is_admin boolean,
  roles text[],
  is_private boolean,
  disable_friend_requests boolean,
  joined_at timestamptz,
  last_seen_at timestamptz,
  is_online boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT p.id, p.display_name, p.country, p.bio, p.avatar_url, p.accent_key, p.is_admin, COALESCE(p.roles, '{}') as roles, COALESCE(p.is_private, false) AS is_private, COALESCE(p.disable_friend_requests, false) AS disable_friend_requests
    FROM public.profiles p
    WHERE lower(p.display_name) = lower(_name)
    LIMIT 1
  ),
  auth_meta AS (
    SELECT u.id, u.created_at AS joined_at
    FROM auth.users u
    WHERE EXISTS (SELECT 1 FROM base b WHERE b.id = u.id)
  ),
  ls AS (
    SELECT v.user_id, max(v.occurred_at) AS last_seen_at
    FROM public.web_visits v
    WHERE EXISTS (SELECT 1 FROM base b WHERE b.id = v.user_id)
    GROUP BY v.user_id
  )
  SELECT b.id,
         b.display_name,
         b.country,
         b.bio,
         b.avatar_url,
         b.accent_key,
         b.is_admin,
         b.roles,
         b.is_private,
         b.disable_friend_requests,
         a.joined_at,
         l.last_seen_at,
         COALESCE((l.last_seen_at IS NOT NULL AND (now() - l.last_seen_at) <= make_interval(mins => 10)), false) AS is_online
  FROM base b
  LEFT JOIN auth_meta a ON a.id = b.id
  LEFT JOIN ls l ON l.user_id = b.id
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_profile_public_by_display_name(text) TO anon, authenticated;
