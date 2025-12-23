-- ========== Messaging System ==========
-- This migration adds a complete messaging system with:
-- - Conversations (1:1 between friends)
-- - Messages with text content and optional link sharing
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

-- Function to get or create a conversation between two users
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
  
  -- Create new conversation
  INSERT INTO public.conversations (participant_1, participant_2)
  VALUES (v_p1, v_p2)
  RETURNING id INTO v_conversation_id;
  
  RETURN v_conversation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_conversation(UUID, UUID) TO authenticated;

-- Function to send a message
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
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
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

-- Add messaging tables to allowed list for schema sync
-- NOTE: Add these to the allowed_tables array in 000_sync_schema.sql:
-- 'conversations', 'messages', 'message_reactions'
