-- =============================================================================
-- Rate Limiting for Messages and Plant Requests
-- This migration adds database-level rate limiting to prevent abuse
-- Rate limits are invisible to users - operations silently fail with errors
-- =============================================================================

-- =============================================================================
-- MESSAGE RATE LIMITING
-- Limit: 120 messages per hour per user (generous but prevents spam)
-- =============================================================================

-- Create or replace the send_message function with rate limiting
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
  v_rate_limit INTEGER := 120; -- Max messages per hour
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

-- Ensure the grant is in place
GRANT EXECUTE ON FUNCTION public.send_message(UUID, TEXT, TEXT, TEXT, TEXT, JSONB, UUID) TO authenticated;

-- =============================================================================
-- PLANT REQUEST RATE LIMITING
-- Limit: 10 plant requests per hour per user
-- =============================================================================

-- Create a function to check plant request rate limit
CREATE OR REPLACE FUNCTION public.check_plant_request_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request_count INTEGER;
  v_rate_limit INTEGER := 10; -- Max plant requests per hour
  v_window_interval INTERVAL := '1 hour';
BEGIN
  -- Count requests by this user in the last hour
  SELECT COUNT(*)::INTEGER INTO v_request_count
  FROM public.plant_request_users
  WHERE user_id = NEW.user_id
    AND created_at > NOW() - v_window_interval;
  
  IF v_request_count >= v_rate_limit THEN
    RAISE EXCEPTION 'Rate limit exceeded. Please wait before requesting more plants.';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for plant request rate limiting
DROP TRIGGER IF EXISTS plant_request_rate_limit_trigger ON public.plant_request_users;
CREATE TRIGGER plant_request_rate_limit_trigger
  BEFORE INSERT ON public.plant_request_users
  FOR EACH ROW
  EXECUTE FUNCTION public.check_plant_request_rate_limit();

-- =============================================================================
-- CONVERSATION CREATION RATE LIMITING
-- Limit: 20 new conversations per hour per user (prevents mass spam)
-- =============================================================================

-- Create or replace the get_or_create_conversation function with rate limiting
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(_user1_id UUID, _user2_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation_id UUID;
  v_caller UUID;
  v_are_friends BOOLEAN;
  v_conversation_count INTEGER;
  v_rate_limit INTEGER := 20; -- Max new conversations per hour
  v_window_interval INTERVAL := '1 hour';
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Only allow creating conversations for yourself
  IF v_caller <> _user1_id THEN
    RAISE EXCEPTION 'Cannot create conversations for other users';
  END IF;
  
  -- Check if they are friends
  SELECT EXISTS (
    SELECT 1 FROM public.friends
    WHERE ((user_id = _user1_id AND friend_id = _user2_id)
        OR (user_id = _user2_id AND friend_id = _user1_id))
    AND status = 'accepted'
  ) INTO v_are_friends;
  
  IF NOT v_are_friends THEN
    RAISE EXCEPTION 'You can only message your friends';
  END IF;
  
  -- Check for existing conversation (order-independent)
  SELECT id INTO v_conversation_id
  FROM public.conversations
  WHERE (participant_1 = _user1_id AND participant_2 = _user2_id)
     OR (participant_1 = _user2_id AND participant_2 = _user1_id);
  
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
  VALUES (_user1_id, _user2_id)
  RETURNING id INTO v_conversation_id;
  
  RETURN v_conversation_id;
END;
$$;

-- Ensure the grant is in place
GRANT EXECUTE ON FUNCTION public.get_or_create_conversation(UUID, UUID) TO authenticated;

-- =============================================================================
-- FRIEND REQUEST RATE LIMITING
-- Limit: 30 friend requests per hour per user (prevents mass spam)
-- =============================================================================

-- Create a function to check friend request rate limit
CREATE OR REPLACE FUNCTION public.check_friend_request_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request_count INTEGER;
  v_rate_limit INTEGER := 30; -- Max friend requests per hour
  v_window_interval INTERVAL := '1 hour';
BEGIN
  -- Only check for new pending requests (not status updates)
  IF NEW.status = 'pending' THEN
    -- Count pending friend requests sent by this user in the last hour
    SELECT COUNT(*)::INTEGER INTO v_request_count
    FROM public.friends
    WHERE user_id = NEW.user_id
      AND status = 'pending'
      AND created_at > NOW() - v_window_interval;
    
    IF v_request_count >= v_rate_limit THEN
      RAISE EXCEPTION 'Rate limit exceeded. Please wait before sending more friend requests.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for friend request rate limiting
DROP TRIGGER IF EXISTS friend_request_rate_limit_trigger ON public.friends;
CREATE TRIGGER friend_request_rate_limit_trigger
  BEFORE INSERT ON public.friends
  FOR EACH ROW
  EXECUTE FUNCTION public.check_friend_request_rate_limit();

-- =============================================================================
-- REACTION RATE LIMITING
-- Limit: 200 reactions per hour per user (prevents reaction spam)
-- =============================================================================

-- Create a function to check reaction rate limit
CREATE OR REPLACE FUNCTION public.check_reaction_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reaction_count INTEGER;
  v_rate_limit INTEGER := 200; -- Max reactions per hour
  v_window_interval INTERVAL := '1 hour';
BEGIN
  -- Count reactions added by this user in the last hour
  SELECT COUNT(*)::INTEGER INTO v_reaction_count
  FROM public.message_reactions
  WHERE user_id = NEW.user_id
    AND created_at > NOW() - v_window_interval;
  
  IF v_reaction_count >= v_rate_limit THEN
    RAISE EXCEPTION 'Rate limit exceeded. Please wait before adding more reactions.';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for reaction rate limiting
DROP TRIGGER IF EXISTS reaction_rate_limit_trigger ON public.message_reactions;
CREATE TRIGGER reaction_rate_limit_trigger
  BEFORE INSERT ON public.message_reactions
  FOR EACH ROW
  EXECUTE FUNCTION public.check_reaction_rate_limit();

-- =============================================================================
-- Add index for efficient rate limit queries
-- =============================================================================

-- Index for message rate limiting queries
CREATE INDEX IF NOT EXISTS idx_messages_sender_created 
  ON public.messages(sender_id, created_at DESC);

-- Index for plant request rate limiting queries  
CREATE INDEX IF NOT EXISTS idx_plant_request_users_user_created
  ON public.plant_request_users(user_id, created_at DESC);

-- Index for conversation rate limiting queries
CREATE INDEX IF NOT EXISTS idx_conversations_participant1_created
  ON public.conversations(participant_1, created_at DESC);

-- Index for friend request rate limiting queries
CREATE INDEX IF NOT EXISTS idx_friends_user_status_created
  ON public.friends(user_id, status, created_at DESC);

-- Index for reaction rate limiting queries
CREATE INDEX IF NOT EXISTS idx_message_reactions_user_created
  ON public.message_reactions(user_id, created_at DESC);
