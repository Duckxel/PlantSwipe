-- - Message reactions (emoji reactions)
-- - Reply threading support

-- ========== Conversations Table ==========
-- A conversation is a 1:1 chat between two friends
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  participant_2 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Last message timestamp for ordering conversations
  last_message_at TIMESTAMPTZ,
  -- Each participant can mute the conversation
  muted_by_1 BOOLEAN NOT NULL DEFAULT FALSE,
  muted_by_2 BOOLEAN NOT NULL DEFAULT FALSE,
  -- Ensure unique conversation between two users (order-independent)
  CONSTRAINT unique_conversation UNIQUE (participant_1, participant_2),
  CONSTRAINT different_participants CHECK (participant_1 <> participant_2),
  -- Normalize order: participant_1 < participant_2 to avoid duplicates
  CONSTRAINT ordered_participants CHECK (participant_1 < participant_2)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_conversations_participant_1 ON public.conversations(participant_1);
CREATE INDEX IF NOT EXISTS idx_conversations_participant_2 ON public.conversations(participant_2);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON public.conversations(last_message_at DESC NULLS LAST);

-- ========== Messages Table ==========
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Message content
  content TEXT NOT NULL CHECK (length(content) > 0 AND length(content) <= 4000),
  -- Optional link sharing (plant, garden, bookmark, etc.)
  link_type TEXT CHECK (link_type IN ('plant', 'garden', 'bookmark', 'profile', 'external')),
  link_id TEXT, -- ID of the linked resource
  link_url TEXT, -- URL for external links
  link_preview JSONB, -- Cached preview data: { title, description, image }
  -- Reply threading
  reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Soft delete (allows sender to delete their own messages)
  deleted_at TIMESTAMPTZ,
  -- Edit tracking
  edited_at TIMESTAMPTZ,
  -- Read receipt: null = unread, timestamp = when read
  read_at TIMESTAMPTZ
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON public.messages(reply_to_id) WHERE reply_to_id IS NOT NULL;

-- ========== Message Reactions Table ==========
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL CHECK (length(emoji) > 0 AND length(emoji) <= 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Each user can only react once with the same emoji to a message
  CONSTRAINT unique_reaction UNIQUE (message_id, user_id, emoji)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON public.message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user_id ON public.message_reactions(user_id);

-- ========== Enable RLS ==========
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- ========== Grant Access ==========
GRANT SELECT, INSERT, UPDATE ON public.conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.message_reactions TO authenticated;

-- ========== RLS Policies for Conversations ==========
-- Users can only see conversations they are part of
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='conversations' AND policyname='conversations_select_own') THEN
    DROP POLICY conversations_select_own ON public.conversations;
  END IF;
  CREATE POLICY conversations_select_own ON public.conversations FOR SELECT TO authenticated
    USING (
      participant_1 = (SELECT auth.uid())
      OR participant_2 = (SELECT auth.uid())
      OR public.is_admin_user((SELECT auth.uid()))
    );
END $$;

-- Users can create conversations (handled by function to normalize order)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='conversations' AND policyname='conversations_insert_own') THEN
    DROP POLICY conversations_insert_own ON public.conversations;
  END IF;
  CREATE POLICY conversations_insert_own ON public.conversations FOR INSERT TO authenticated
    WITH CHECK (
      participant_1 = (SELECT auth.uid()) OR participant_2 = (SELECT auth.uid())
    );
END $$;

-- Users can update their own mute settings
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='conversations' AND policyname='conversations_update_own') THEN
    DROP POLICY conversations_update_own ON public.conversations;
  END IF;
  CREATE POLICY conversations_update_own ON public.conversations FOR UPDATE TO authenticated
    USING (
      participant_1 = (SELECT auth.uid())
      OR participant_2 = (SELECT auth.uid())
      OR public.is_admin_user((SELECT auth.uid()))
    )
    WITH CHECK (
      participant_1 = (SELECT auth.uid())
      OR participant_2 = (SELECT auth.uid())
      OR public.is_admin_user((SELECT auth.uid()))
    );
END $$;

-- ========== RLS Policies for Messages ==========
-- Users can see messages in their conversations
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='messages' AND policyname='messages_select_own') THEN
    DROP POLICY messages_select_own ON public.messages;
  END IF;
  CREATE POLICY messages_select_own ON public.messages FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = messages.conversation_id
        AND (c.participant_1 = (SELECT auth.uid()) OR c.participant_2 = (SELECT auth.uid()))
      )
      OR public.is_admin_user((SELECT auth.uid()))
    );
END $$;

-- Users can send messages in their conversations
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='messages' AND policyname='messages_insert_own') THEN
    DROP POLICY messages_insert_own ON public.messages;
  END IF;
  CREATE POLICY messages_insert_own ON public.messages FOR INSERT TO authenticated
    WITH CHECK (
      sender_id = (SELECT auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = messages.conversation_id
        AND (c.participant_1 = (SELECT auth.uid()) OR c.participant_2 = (SELECT auth.uid()))
      )
    );
END $$;

-- Users can update their own messages (edit/delete)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='messages' AND policyname='messages_update_own') THEN
    DROP POLICY messages_update_own ON public.messages;
  END IF;
  CREATE POLICY messages_update_own ON public.messages FOR UPDATE TO authenticated
    USING (
      sender_id = (SELECT auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = messages.conversation_id
        AND (c.participant_1 = (SELECT auth.uid()) OR c.participant_2 = (SELECT auth.uid()))
      )
      OR public.is_admin_user((SELECT auth.uid()))
    )
    WITH CHECK (
      sender_id = (SELECT auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = messages.conversation_id
        AND (c.participant_1 = (SELECT auth.uid()) OR c.participant_2 = (SELECT auth.uid()))
      )
      OR public.is_admin_user((SELECT auth.uid()))
    );
END $$;

-- ========== RLS Policies for Reactions ==========
-- Users can see reactions on messages they can see
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='message_reactions' AND policyname='reactions_select_own') THEN
    DROP POLICY reactions_select_own ON public.message_reactions;
  END IF;
  CREATE POLICY reactions_select_own ON public.message_reactions FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.messages m
        JOIN public.conversations c ON c.id = m.conversation_id
        WHERE m.id = message_reactions.message_id
        AND (c.participant_1 = (SELECT auth.uid()) OR c.participant_2 = (SELECT auth.uid()))
      )
      OR public.is_admin_user((SELECT auth.uid()))
    );
END $$;

-- Users can add reactions to messages they can see
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='message_reactions' AND policyname='reactions_insert_own') THEN
    DROP POLICY reactions_insert_own ON public.message_reactions;
  END IF;
  CREATE POLICY reactions_insert_own ON public.message_reactions FOR INSERT TO authenticated
    WITH CHECK (
      user_id = (SELECT auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.messages m
        JOIN public.conversations c ON c.id = m.conversation_id
        WHERE m.id = message_reactions.message_id
        AND (c.participant_1 = (SELECT auth.uid()) OR c.participant_2 = (SELECT auth.uid()))
      )
    );
END $$;

-- Users can remove their own reactions
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='message_reactions' AND policyname='reactions_delete_own') THEN
    DROP POLICY reactions_delete_own ON public.message_reactions;
  END IF;
  CREATE POLICY reactions_delete_own ON public.message_reactions FOR DELETE TO authenticated
    USING (
      user_id = (SELECT auth.uid())
      OR public.is_admin_user((SELECT auth.uid()))
    );
END $$;

-- ========== Helper Functions ==========

-- Function to get or create a conversation between two users (with rate limiting for new conversations)
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(_user1_id UUID, _user2_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID;
  v_p1 UUID;
  v_p2 UUID;
  v_conversation_id UUID;
  v_are_friends BOOLEAN;
  v_are_blocked BOOLEAN;
  v_conversation_count INTEGER;
  v_rate_limit INTEGER := 30; -- Max new conversations per hour
  v_window_interval INTERVAL := '1 hour';
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Caller must be one of the participants
  IF v_caller <> _user1_id AND v_caller <> _user2_id THEN
    RAISE EXCEPTION 'Cannot create conversation for other users';
  END IF;
  
  -- Normalize order
  IF _user1_id < _user2_id THEN
    v_p1 := _user1_id;
    v_p2 := _user2_id;
  ELSE
    v_p1 := _user2_id;
    v_p2 := _user1_id;
  END IF;
  
  -- Check if they are friends
  SELECT EXISTS (
    SELECT 1 FROM public.friends
    WHERE (user_id = v_p1 AND friend_id = v_p2)
    OR (user_id = v_p2 AND friend_id = v_p1)
  ) INTO v_are_friends;
  
  IF NOT v_are_friends THEN
    RAISE EXCEPTION 'You can only message your friends';
  END IF;
  
  -- Check if blocked
  SELECT EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE (blocker_id = v_p1 AND blocked_id = v_p2)
    OR (blocker_id = v_p2 AND blocked_id = v_p1)
  ) INTO v_are_blocked;
  
  IF v_are_blocked THEN
    RAISE EXCEPTION 'Cannot message this user';
  END IF;
  
  -- Try to find existing conversation
  SELECT id INTO v_conversation_id
  FROM public.conversations
  WHERE participant_1 = v_p1 AND participant_2 = v_p2;
  
  IF v_conversation_id IS NOT NULL THEN
    RETURN v_conversation_id;
  END IF;
  
  -- Rate limiting for NEW conversation creation only
  SELECT COUNT(*)::INTEGER INTO v_conversation_count
  FROM public.conversations
  WHERE participant_1 = v_caller
    AND created_at > NOW() - v_window_interval;
  
  IF v_conversation_count >= v_rate_limit THEN
    RAISE EXCEPTION 'Rate limit exceeded. Please wait before starting more conversations.';
  END IF;
  
  -- Create new conversation
  INSERT INTO public.conversations (participant_1, participant_2)
  VALUES (v_p1, v_p2)
  RETURNING id INTO v_conversation_id;
  
  RETURN v_conversation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_conversation(UUID, UUID) TO authenticated;

-- Function to send a message (with rate limiting)
CREATE OR REPLACE FUNCTION public.send_message(
  _conversation_id UUID,
  _content TEXT,
  _link_type TEXT DEFAULT NULL,
  _link_id TEXT DEFAULT NULL,
  _link_url TEXT DEFAULT NULL,
  _link_preview JSONB DEFAULT NULL,
  _reply_to_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID;
  v_message_id UUID;
  v_recipient_id UUID;
  v_p1 UUID;
  v_p2 UUID;
  v_is_muted BOOLEAN;
  v_message_count INTEGER;
  v_rate_limit INTEGER := 300; -- Max messages per hour (5/min sustained)
  v_window_interval INTERVAL := '1 hour';
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Rate limiting: Count messages sent by this user in the last hour
  SELECT COUNT(*)::INTEGER INTO v_message_count
  FROM public.messages
  WHERE sender_id = v_caller
    AND created_at > NOW() - v_window_interval;
  
  IF v_message_count >= v_rate_limit THEN
    RAISE EXCEPTION 'Rate limit exceeded. Please wait before sending more messages.';
  END IF;
  
  -- Verify caller is participant
  SELECT participant_1, participant_2 INTO v_p1, v_p2
  FROM public.conversations
  WHERE id = _conversation_id;
  
  IF v_p1 IS NULL THEN
    RAISE EXCEPTION 'Conversation not found';
  END IF;
  
  IF v_caller <> v_p1 AND v_caller <> v_p2 THEN
    RAISE EXCEPTION 'Not a participant of this conversation';
  END IF;
  
  -- Get recipient ID
  IF v_caller = v_p1 THEN
    v_recipient_id := v_p2;
    SELECT muted_by_2 INTO v_is_muted FROM public.conversations WHERE id = _conversation_id;
  ELSE
    v_recipient_id := v_p1;
    SELECT muted_by_1 INTO v_is_muted FROM public.conversations WHERE id = _conversation_id;
  END IF;
  
  -- Insert message
  INSERT INTO public.messages (
    conversation_id,
    sender_id,
    content,
    link_type,
    link_id,
    link_url,
    link_preview,
    reply_to_id
  )
  VALUES (
    _conversation_id,
    v_caller,
    _content,
    _link_type,
    _link_id,
    _link_url,
    _link_preview,
    _reply_to_id
  )
  RETURNING id INTO v_message_id;
  
  -- Update conversation's last_message_at
  UPDATE public.conversations
  SET last_message_at = NOW(), updated_at = NOW()
  WHERE id = _conversation_id;
  
  RETURN v_message_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_message(UUID, TEXT, TEXT, TEXT, TEXT, JSONB, UUID) TO authenticated;

-- Function to get unread message count for a user
CREATE OR REPLACE FUNCTION public.get_unread_message_count(_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.messages m
  JOIN public.conversations c ON c.id = m.conversation_id
  WHERE (c.participant_1 = _user_id OR c.participant_2 = _user_id)
  AND m.sender_id <> _user_id
  AND m.read_at IS NULL
  AND m.deleted_at IS NULL;
$$;

GRANT EXECUTE ON FUNCTION public.get_unread_message_count(UUID) TO authenticated;

-- Function to mark messages as read
CREATE OR REPLACE FUNCTION public.mark_messages_as_read(_conversation_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID;
  v_count INTEGER;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Mark all unread messages from the other user as read
  UPDATE public.messages
  SET read_at = NOW()
  WHERE conversation_id = _conversation_id
  AND sender_id <> v_caller
  AND read_at IS NULL
  AND deleted_at IS NULL;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_messages_as_read(UUID) TO authenticated;

-- Function to get conversation with last message and unread count
CREATE OR REPLACE FUNCTION public.get_user_conversations(_user_id UUID)
RETURNS TABLE (
  conversation_id UUID,
  other_user_id UUID,
  other_user_display_name TEXT,
  other_user_avatar_url TEXT,
  last_message_content TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_sender_id UUID,
  unread_count BIGINT,
  is_muted BOOLEAN,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH conv_data AS (
    SELECT 
      c.id,
      CASE WHEN c.participant_1 = _user_id THEN c.participant_2 ELSE c.participant_1 END AS other_id,
      CASE WHEN c.participant_1 = _user_id THEN c.muted_by_1 ELSE c.muted_by_2 END AS is_muted,
      c.last_message_at,
      c.created_at
    FROM public.conversations c
    WHERE c.participant_1 = _user_id OR c.participant_2 = _user_id
  ),
  last_msgs AS (
    SELECT DISTINCT ON (m.conversation_id)
      m.conversation_id,
      m.content,
      m.created_at,
      m.sender_id
    FROM public.messages m
    WHERE m.deleted_at IS NULL
    ORDER BY m.conversation_id, m.created_at DESC
  ),
  unread_counts AS (
    SELECT 
      m.conversation_id,
      COUNT(*) AS cnt
    FROM public.messages m
    WHERE m.sender_id <> _user_id
    AND m.read_at IS NULL
    AND m.deleted_at IS NULL
    GROUP BY m.conversation_id
  )
  SELECT 
    cd.id AS conversation_id,
    cd.other_id AS other_user_id,
    p.display_name AS other_user_display_name,
    p.avatar_url AS other_user_avatar_url,
    lm.content AS last_message_content,
    COALESCE(lm.created_at, cd.created_at) AS last_message_at,
    lm.sender_id AS last_message_sender_id,
    COALESCE(uc.cnt, 0) AS unread_count,
    cd.is_muted,
    cd.created_at
  FROM conv_data cd
  LEFT JOIN public.profiles p ON p.id = cd.other_id
  LEFT JOIN last_msgs lm ON lm.conversation_id = cd.id
  LEFT JOIN unread_counts uc ON uc.conversation_id = cd.id
  ORDER BY COALESCE(lm.created_at, cd.created_at) DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_conversations(UUID) TO authenticated;

-- ========== Landing Page CMS Tables ==========
-- These tables store configurable content for the landing page

-- Landing Page Settings: Global settings for the landing page (single row)
create table if not exists public.landing_page_settings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- Hero Section Settings
  hero_badge_text text default 'Your Personal Plant Care Expert',
  hero_title text default 'Grow Your',
  hero_title_highlight text default 'Green Paradise',
  hero_title_end text default 'with Confidence',
  hero_description text default 'Discover, track, and nurture your plants with personalized care reminders, smart identification, and expert tips – all in one beautiful app.',
  hero_cta_primary_text text default 'Download App',
  hero_cta_primary_link text default '/download',
  hero_cta_secondary_text text default 'Try in Browser',
  hero_cta_secondary_link text default '/discovery',
  hero_social_proof_text text default '10,000+ plant lovers',
  
  -- Section Visibility
  show_hero_section boolean default true,
  show_stats_section boolean default true,
  show_beginner_section boolean default true,
  show_features_section boolean default true,
  show_demo_section boolean default true,
  show_how_it_works_section boolean default true,
  show_showcase_section boolean default true,
  show_testimonials_section boolean default true,
  show_faq_section boolean default true,
  show_final_cta_section boolean default true,
  
  -- Social Links
  instagram_url text default 'https://instagram.com/aphylia.app',
  twitter_url text default 'https://twitter.com/aphylia_app',
  support_email text default 'hello@aphylia.app',
  
  -- Final CTA Section
  final_cta_badge text default 'No experience needed',
  final_cta_title text default 'Ready to Start Your Plant Journey?',
  final_cta_subtitle text default 'Whether it''s your first succulent or you''re building a jungle, Aphylia grows with you.',
  final_cta_button_text text default 'Start Growing',
  final_cta_secondary_text text default 'Explore Plants',
  
  -- Beginner Section
  beginner_badge text default 'Perfect for Beginners',
  beginner_title text default 'Know Nothing About Gardening?',
  beginner_title_highlight text default 'That''s Exactly Why We Built This',
  beginner_subtitle text default 'Everyone starts somewhere. Aphylia turns complete beginners into confident plant parents with gentle guidance.',
  
  -- Meta/SEO
  meta_title text default 'Aphylia – Your Personal Plant Care Expert',
  meta_description text default 'Discover, track, and nurture your plants with personalized care reminders, smart identification, and expert tips.'
);

-- Create index for landing_page_settings
create index if not exists idx_landing_page_settings_id on public.landing_page_settings(id);

-- Ensure only one row exists for settings
create or replace function public.ensure_single_landing_page_settings()
returns trigger as $$
begin
  if (select count(*) from public.landing_page_settings) > 0 and TG_OP = 'INSERT' then
    raise exception 'Only one landing_page_settings row allowed';
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;

drop trigger if exists ensure_single_landing_page_settings_trigger on public.landing_page_settings;
create trigger ensure_single_landing_page_settings_trigger
  before insert on public.landing_page_settings
  for each row execute function public.ensure_single_landing_page_settings();

-- Hero Cards: Multiple plant cards shown in the hero section
create table if not exists public.landing_hero_cards (
  id uuid primary key default gen_random_uuid(),
  position integer not null default 0,
  plant_name text not null,
  plant_scientific_name text,
  plant_description text,
  image_url text,
  water_frequency text default '2x/week',
  light_level text default 'Bright indirect',
  reminder_text text default 'Water in 2 days',
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Add indexes
create index if not exists idx_landing_hero_cards_position on public.landing_hero_cards(position);
create index if not exists idx_landing_hero_cards_active on public.landing_hero_cards(is_active);

-- Landing Stats: Single row containing all stats displayed on the landing page
create table if not exists public.landing_stats (
  id uuid primary key default gen_random_uuid(),
  plants_count text not null default '10K+',
  plants_label text not null default 'Plant Species',
  users_count text not null default '50K+',
  users_label text not null default 'Happy Gardeners',
  tasks_count text not null default '100K+',
  tasks_label text not null default 'Care Tasks Done',
  rating_value text not null default '4.9',
  rating_label text not null default 'App Store Rating',
  updated_at timestamptz default now()
);

-- Ensure only one row exists for stats
create or replace function public.ensure_single_landing_stats()
returns trigger as $$
begin
  if (select count(*) from public.landing_stats) > 0 and TG_OP = 'INSERT' then
    raise exception 'Only one landing_stats row allowed';
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;

drop trigger if exists ensure_single_landing_stats_trigger on public.landing_stats;
create trigger ensure_single_landing_stats_trigger
  before insert on public.landing_stats
  for each row execute function public.ensure_single_landing_stats();

-- Landing Stats Translations: Stores translations for stats labels
create table if not exists public.landing_stats_translations (
  id uuid primary key default gen_random_uuid(),
  stats_id uuid not null references public.landing_stats(id) on delete cascade,
  language text not null,
  plants_label text not null,
  users_label text not null,
  tasks_label text not null,
  rating_label text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(stats_id, language)
);

create index if not exists idx_landing_stats_translations_stats_id on public.landing_stats_translations(stats_id);
create index if not exists idx_landing_stats_translations_language on public.landing_stats_translations(language);

-- Landing Testimonials: Customer reviews/testimonials
create table if not exists public.landing_testimonials (
  id uuid primary key default gen_random_uuid(),
  position integer not null default 0,
  author_name text not null,
  author_role text,
  author_avatar_url text,
  author_website_url text,
  linked_user_id uuid references public.profiles(id) on delete set null,
  quote text not null,
  rating integer not null default 5 check (rating >= 1 and rating <= 5),
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_landing_testimonials_position on public.landing_testimonials(position);
create index if not exists idx_landing_testimonials_active on public.landing_testimonials(is_active);

-- Add new columns to landing_testimonials if they don't exist (for existing tables)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'landing_testimonials' AND column_name = 'author_website_url') THEN
    ALTER TABLE public.landing_testimonials ADD COLUMN author_website_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'landing_testimonials' AND column_name = 'linked_user_id') THEN
    ALTER TABLE public.landing_testimonials ADD COLUMN linked_user_id uuid references public.profiles(id) on delete set null;
  END IF;
END $$;

-- Landing FAQ: Frequently asked questions (base content in English)
create table if not exists public.landing_faq (
  id uuid primary key default gen_random_uuid(),
  position integer not null default 0,
  question text not null,
  answer text not null,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_landing_faq_position on public.landing_faq(position);
create index if not exists idx_landing_faq_active on public.landing_faq(is_active);

-- Landing FAQ Translations: Stores translations for FAQ items
create table if not exists public.landing_faq_translations (
  id uuid primary key default gen_random_uuid(),
  faq_id uuid not null references public.landing_faq(id) on delete cascade,
  language text not null,
  question text not null,
  answer text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(faq_id, language)
);

create index if not exists idx_landing_faq_translations_faq_id on public.landing_faq_translations(faq_id);
create index if not exists idx_landing_faq_translations_language on public.landing_faq_translations(language);

-- Landing Demo Features: Features shown in the interactive demo wheel
create table if not exists public.landing_demo_features (
  id uuid primary key default gen_random_uuid(),
  position integer not null default 0,
  icon_name text not null default 'Leaf',
  label text not null,
  color text not null default 'emerald',
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_landing_demo_features_position on public.landing_demo_features(position);
create index if not exists idx_landing_demo_features_active on public.landing_demo_features(is_active);

-- Landing Demo Feature Translations: Stores translations for demo features
create table if not exists public.landing_demo_feature_translations (
  id uuid primary key default gen_random_uuid(),
  feature_id uuid not null references public.landing_demo_features(id) on delete cascade,
  language text not null,
  label text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(feature_id, language)
);

create index if not exists idx_landing_demo_feature_translations_feature_id on public.landing_demo_feature_translations(feature_id);
create index if not exists idx_landing_demo_feature_translations_language on public.landing_demo_feature_translations(language);

-- Insert default demo features if table is empty
insert into public.landing_demo_features (position, icon_name, label, color)
select * from (values
  (0, 'Leaf', 'Discover Plants', 'emerald'),
  (1, 'Clock', 'Schedule Care', 'blue'),
  (2, 'TrendingUp', 'Track Growth', 'purple'),
  (3, 'Shield', 'Get Alerts', 'rose'),
  (4, 'Camera', 'Identify Plants', 'pink'),
  (5, 'NotebookPen', 'Keep Journal', 'amber'),
  (6, 'Users', 'Join Community', 'teal'),
  (7, 'Sparkles', 'Smart Assistant', 'indigo')
) as v(position, icon_name, label, color)
where not exists (select 1 from public.landing_demo_features limit 1);

-- Landing Showcase Config: Configuration for the landing page showcase section
create table if not exists public.landing_showcase_config (
  id uuid primary key default gen_random_uuid(),
  
  -- Garden Card Settings
  garden_name text not null default 'My Indoor Jungle',
  plants_count integer not null default 12,
  species_count integer not null default 8,
  streak_count integer not null default 7,
  progress_percent integer not null default 85 check (progress_percent >= 0 and progress_percent <= 100),
  cover_image_url text,
  
  -- Tasks (JSONB array of {id, text, completed})
  tasks jsonb not null default '[
    {"id": "1", "text": "Water your Pothos", "completed": true},
    {"id": "2", "text": "Fertilize Monstera", "completed": false},
    {"id": "3", "text": "Mist your Fern", "completed": false}
  ]'::jsonb,
  
  -- Members (JSONB array of {id, name, role, avatar_url, color})
  members jsonb not null default '[
    {"id": "1", "name": "Sophie", "role": "owner", "avatar_url": null, "color": "#10b981"},
    {"id": "2", "name": "Marcus", "role": "member", "avatar_url": null, "color": "#3b82f6"}
  ]'::jsonb,
  
  -- Plant Cards (JSONB array of {id, plant_id, name, image_url, gradient, tasks_due})
  plant_cards jsonb not null default '[
    {"id": "1", "plant_id": null, "name": "Monstera", "image_url": null, "gradient": "from-emerald-400 to-teal-500", "tasks_due": 1},
    {"id": "2", "plant_id": null, "name": "Pothos", "image_url": null, "gradient": "from-lime-400 to-green-500", "tasks_due": 2},
    {"id": "3", "plant_id": null, "name": "Snake Plant", "image_url": null, "gradient": "from-green-400 to-emerald-500", "tasks_due": 0},
    {"id": "4", "plant_id": null, "name": "Fern", "image_url": null, "gradient": "from-teal-400 to-cyan-500", "tasks_due": 0},
    {"id": "5", "plant_id": null, "name": "Peace Lily", "image_url": null, "gradient": "from-emerald-500 to-green-600", "tasks_due": 0},
    {"id": "6", "plant_id": null, "name": "Calathea", "image_url": null, "gradient": "from-green-500 to-teal-600", "tasks_due": 0}
  ]'::jsonb,
  
  -- Analytics Card Settings
  completion_rate integer not null default 92 check (completion_rate >= 0 and completion_rate <= 100),
  analytics_streak integer not null default 14,
  chart_data jsonb not null default '[3, 5, 2, 6, 4, 5, 6]'::jsonb,
  
  -- Calendar (30 days history: array of {date, status})
  calendar_data jsonb not null default '[]'::jsonb,
  
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure only one row exists for showcase config
create or replace function public.ensure_single_landing_showcase_config()
returns trigger as $$
begin
  if (select count(*) from public.landing_showcase_config) > 0 and TG_OP = 'INSERT' then
    raise exception 'Only one landing_showcase_config row allowed';
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;

drop trigger if exists ensure_single_landing_showcase_config_trigger on public.landing_showcase_config;
create trigger ensure_single_landing_showcase_config_trigger
  before insert on public.landing_showcase_config
  for each row execute function public.ensure_single_landing_showcase_config();

-- ========== Updated_at Triggers for Landing Page Tables ==========
-- Create a generic updated_at trigger function
create or replace function public.update_landing_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql set search_path = public;

-- Add updated_at triggers for all landing tables that have the column
drop trigger if exists landing_page_settings_updated_at on public.landing_page_settings;
create trigger landing_page_settings_updated_at
  before update on public.landing_page_settings
  for each row execute function public.update_landing_updated_at();

drop trigger if exists landing_hero_cards_updated_at on public.landing_hero_cards;
create trigger landing_hero_cards_updated_at
  before update on public.landing_hero_cards
  for each row execute function public.update_landing_updated_at();

drop trigger if exists landing_stats_updated_at on public.landing_stats;
create trigger landing_stats_updated_at
  before update on public.landing_stats
  for each row execute function public.update_landing_updated_at();

drop trigger if exists landing_stats_translations_updated_at on public.landing_stats_translations;
create trigger landing_stats_translations_updated_at
  before update on public.landing_stats_translations
  for each row execute function public.update_landing_updated_at();

drop trigger if exists landing_testimonials_updated_at on public.landing_testimonials;
create trigger landing_testimonials_updated_at
  before update on public.landing_testimonials
  for each row execute function public.update_landing_updated_at();

drop trigger if exists landing_faq_updated_at on public.landing_faq;
create trigger landing_faq_updated_at
  before update on public.landing_faq
  for each row execute function public.update_landing_updated_at();

drop trigger if exists landing_faq_translations_updated_at on public.landing_faq_translations;
create trigger landing_faq_translations_updated_at
  before update on public.landing_faq_translations
  for each row execute function public.update_landing_updated_at();

drop trigger if exists landing_demo_features_updated_at on public.landing_demo_features;
create trigger landing_demo_features_updated_at
  before update on public.landing_demo_features
  for each row execute function public.update_landing_updated_at();

drop trigger if exists landing_demo_feature_translations_updated_at on public.landing_demo_feature_translations;
create trigger landing_demo_feature_translations_updated_at
  before update on public.landing_demo_feature_translations
  for each row execute function public.update_landing_updated_at();

drop trigger if exists landing_showcase_config_updated_at on public.landing_showcase_config;
create trigger landing_showcase_config_updated_at
  before update on public.landing_showcase_config
  for each row execute function public.update_landing_updated_at();

-- ========== RLS Policies for Landing Page Tables ==========
-- All landing tables are publicly readable but only admin-writable
-- Using separate policies for INSERT, UPDATE, DELETE with proper WITH CHECK clauses

-- Helper function to check if user is admin (cached for performance)
create or replace function public.is_landing_admin()
returns boolean as $$
begin
  return exists (
    select 1 from public.profiles 
    where id = auth.uid() and is_admin = true
  );
end;
$$ language plpgsql security definer stable set search_path = public;

-- ========== landing_page_settings RLS ==========
alter table public.landing_page_settings enable row level security;

drop policy if exists "Landing page settings are publicly readable" on public.landing_page_settings;
create policy "Landing page settings are publicly readable" 
  on public.landing_page_settings for select using (true);

drop policy if exists "Admins can manage landing page settings" on public.landing_page_settings;
drop policy if exists "Admins can insert landing page settings" on public.landing_page_settings;
create policy "Admins can insert landing page settings" 
  on public.landing_page_settings for insert 
  with check (public.is_landing_admin());

drop policy if exists "Admins can update landing page settings" on public.landing_page_settings;
create policy "Admins can update landing page settings" 
  on public.landing_page_settings for update 
  using (public.is_landing_admin())
  with check (public.is_landing_admin());

drop policy if exists "Admins can delete landing page settings" on public.landing_page_settings;
create policy "Admins can delete landing page settings" 
  on public.landing_page_settings for delete 
  using (public.is_landing_admin());

-- Insert default settings row if not exists
insert into public.landing_page_settings (id)
select gen_random_uuid()
where not exists (select 1 from public.landing_page_settings limit 1);

-- ========== landing_hero_cards RLS ==========
alter table public.landing_hero_cards enable row level security;

drop policy if exists "Landing hero cards are publicly readable" on public.landing_hero_cards;
create policy "Landing hero cards are publicly readable" 
  on public.landing_hero_cards for select using (true);

drop policy if exists "Admins can manage landing hero cards" on public.landing_hero_cards;
drop policy if exists "Admins can insert landing hero cards" on public.landing_hero_cards;
create policy "Admins can insert landing hero cards" 
  on public.landing_hero_cards for insert 
  with check (public.is_landing_admin());

drop policy if exists "Admins can update landing hero cards" on public.landing_hero_cards;
create policy "Admins can update landing hero cards" 
  on public.landing_hero_cards for update 
  using (public.is_landing_admin())
  with check (public.is_landing_admin());

drop policy if exists "Admins can delete landing hero cards" on public.landing_hero_cards;
create policy "Admins can delete landing hero cards" 
  on public.landing_hero_cards for delete 
  using (public.is_landing_admin());

-- ========== landing_stats RLS ==========
alter table public.landing_stats enable row level security;

drop policy if exists "Landing stats are publicly readable" on public.landing_stats;
create policy "Landing stats are publicly readable" 
  on public.landing_stats for select using (true);

drop policy if exists "Admins can manage landing stats" on public.landing_stats;
drop policy if exists "Admins can insert landing stats" on public.landing_stats;
create policy "Admins can insert landing stats" 
  on public.landing_stats for insert 
  with check (public.is_landing_admin());

drop policy if exists "Admins can update landing stats" on public.landing_stats;
create policy "Admins can update landing stats" 
  on public.landing_stats for update 
  using (public.is_landing_admin())
  with check (public.is_landing_admin());

drop policy if exists "Admins can delete landing stats" on public.landing_stats;
create policy "Admins can delete landing stats" 
  on public.landing_stats for delete 
  using (public.is_landing_admin());

-- Insert default stats row if not exists
insert into public.landing_stats (id)
select gen_random_uuid()
where not exists (select 1 from public.landing_stats limit 1);

-- ========== landing_stats_translations RLS ==========
alter table public.landing_stats_translations enable row level security;

drop policy if exists "Landing stats translations are publicly readable" on public.landing_stats_translations;
create policy "Landing stats translations are publicly readable" 
  on public.landing_stats_translations for select using (true);

drop policy if exists "Admins can manage landing stats translations" on public.landing_stats_translations;
drop policy if exists "Admins can insert landing stats translations" on public.landing_stats_translations;
create policy "Admins can insert landing stats translations" 
  on public.landing_stats_translations for insert 
  with check (public.is_landing_admin());

drop policy if exists "Admins can update landing stats translations" on public.landing_stats_translations;
create policy "Admins can update landing stats translations" 
  on public.landing_stats_translations for update 
  using (public.is_landing_admin())
  with check (public.is_landing_admin());

drop policy if exists "Admins can delete landing stats translations" on public.landing_stats_translations;
create policy "Admins can delete landing stats translations" 
  on public.landing_stats_translations for delete 
  using (public.is_landing_admin());

-- ========== landing_testimonials RLS ==========
alter table public.landing_testimonials enable row level security;

drop policy if exists "Landing testimonials are publicly readable" on public.landing_testimonials;
create policy "Landing testimonials are publicly readable" 
  on public.landing_testimonials for select using (true);

drop policy if exists "Admins can manage landing testimonials" on public.landing_testimonials;
drop policy if exists "Admins can insert landing testimonials" on public.landing_testimonials;
create policy "Admins can insert landing testimonials" 
  on public.landing_testimonials for insert 
  with check (public.is_landing_admin());

drop policy if exists "Admins can update landing testimonials" on public.landing_testimonials;
create policy "Admins can update landing testimonials" 
  on public.landing_testimonials for update 
  using (public.is_landing_admin())
  with check (public.is_landing_admin());

drop policy if exists "Admins can delete landing testimonials" on public.landing_testimonials;
create policy "Admins can delete landing testimonials" 
  on public.landing_testimonials for delete 
  using (public.is_landing_admin());

-- ========== landing_faq RLS ==========
alter table public.landing_faq enable row level security;

drop policy if exists "Landing FAQ are publicly readable" on public.landing_faq;
create policy "Landing FAQ are publicly readable" 
  on public.landing_faq for select using (true);

drop policy if exists "Admins can manage landing FAQ" on public.landing_faq;
drop policy if exists "Admins can insert landing FAQ" on public.landing_faq;
create policy "Admins can insert landing FAQ" 
  on public.landing_faq for insert 
  with check (public.is_landing_admin());

drop policy if exists "Admins can update landing FAQ" on public.landing_faq;
create policy "Admins can update landing FAQ" 
  on public.landing_faq for update 
  using (public.is_landing_admin())
  with check (public.is_landing_admin());

drop policy if exists "Admins can delete landing FAQ" on public.landing_faq;
create policy "Admins can delete landing FAQ" 
  on public.landing_faq for delete 
  using (public.is_landing_admin());

-- ========== landing_faq_translations RLS ==========
alter table public.landing_faq_translations enable row level security;

drop policy if exists "Landing FAQ translations are publicly readable" on public.landing_faq_translations;
create policy "Landing FAQ translations are publicly readable" 
  on public.landing_faq_translations for select using (true);

drop policy if exists "Admins can manage landing FAQ translations" on public.landing_faq_translations;
drop policy if exists "Admins can insert landing FAQ translations" on public.landing_faq_translations;
create policy "Admins can insert landing FAQ translations" 
  on public.landing_faq_translations for insert 
  with check (public.is_landing_admin());

drop policy if exists "Admins can update landing FAQ translations" on public.landing_faq_translations;
create policy "Admins can update landing FAQ translations" 
  on public.landing_faq_translations for update 
  using (public.is_landing_admin())
  with check (public.is_landing_admin());

drop policy if exists "Admins can delete landing FAQ translations" on public.landing_faq_translations;
create policy "Admins can delete landing FAQ translations" 
  on public.landing_faq_translations for delete 
  using (public.is_landing_admin());

-- ========== landing_demo_features RLS ==========
alter table public.landing_demo_features enable row level security;

drop policy if exists "Landing demo features are publicly readable" on public.landing_demo_features;
create policy "Landing demo features are publicly readable" 
  on public.landing_demo_features for select using (true);

drop policy if exists "Admins can manage landing demo features" on public.landing_demo_features;
drop policy if exists "Admins can insert landing demo features" on public.landing_demo_features;
create policy "Admins can insert landing demo features" 
  on public.landing_demo_features for insert 
  with check (public.is_landing_admin());

drop policy if exists "Admins can update landing demo features" on public.landing_demo_features;
create policy "Admins can update landing demo features" 
  on public.landing_demo_features for update 
  using (public.is_landing_admin())
  with check (public.is_landing_admin());

drop policy if exists "Admins can delete landing demo features" on public.landing_demo_features;
create policy "Admins can delete landing demo features" 
  on public.landing_demo_features for delete 
  using (public.is_landing_admin());

-- ========== landing_demo_feature_translations RLS ==========
alter table public.landing_demo_feature_translations enable row level security;

drop policy if exists "Landing demo feature translations are publicly readable" on public.landing_demo_feature_translations;
create policy "Landing demo feature translations are publicly readable" 
  on public.landing_demo_feature_translations for select using (true);

drop policy if exists "Admins can manage landing demo feature translations" on public.landing_demo_feature_translations;
drop policy if exists "Admins can insert landing demo feature translations" on public.landing_demo_feature_translations;
create policy "Admins can insert landing demo feature translations" 
  on public.landing_demo_feature_translations for insert 
  with check (public.is_landing_admin());

drop policy if exists "Admins can update landing demo feature translations" on public.landing_demo_feature_translations;
create policy "Admins can update landing demo feature translations" 
  on public.landing_demo_feature_translations for update 
  using (public.is_landing_admin())
  with check (public.is_landing_admin());

drop policy if exists "Admins can delete landing demo feature translations" on public.landing_demo_feature_translations;
create policy "Admins can delete landing demo feature translations" 
  on public.landing_demo_feature_translations for delete 
  using (public.is_landing_admin());

-- ========== landing_showcase_config RLS ==========
alter table public.landing_showcase_config enable row level security;

drop policy if exists "Landing showcase config is publicly readable" on public.landing_showcase_config;
create policy "Landing showcase config is publicly readable" 
  on public.landing_showcase_config for select using (true);

drop policy if exists "Admins can manage landing showcase config" on public.landing_showcase_config;
drop policy if exists "Admins can insert landing showcase config" on public.landing_showcase_config;
create policy "Admins can insert landing showcase config" 
  on public.landing_showcase_config for insert 
  with check (public.is_landing_admin());

drop policy if exists "Admins can update landing showcase config" on public.landing_showcase_config;
create policy "Admins can update landing showcase config" 
  on public.landing_showcase_config for update 
  using (public.is_landing_admin())
  with check (public.is_landing_admin());

drop policy if exists "Admins can delete landing showcase config" on public.landing_showcase_config;
create policy "Admins can delete landing showcase config" 
  on public.landing_showcase_config for delete 
  using (public.is_landing_admin());

-- Insert default showcase config row if not exists
insert into public.landing_showcase_config (id)
select gen_random_uuid()
where not exists (select 1 from public.landing_showcase_config limit 1);

-- =============================================
