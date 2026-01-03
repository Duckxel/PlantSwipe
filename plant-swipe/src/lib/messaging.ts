/**
 * Messaging System Library
 * 
 * Functions for managing real-time messaging between friends,
 * including conversations, messages, reactions, and replies.
 */

import { supabase } from './supabaseClient'
import type { 
  Message, 
  MessageReaction, 
  ConversationWithDetails,
  SendMessageParams,
  LinkPreview,
  LinkType
} from '@/types/messaging'

// ===== Error Handling =====

const isMissingTableError = (error?: { message?: string; code?: string }) => {
  if (!error) return false
  if (error.message?.includes('does not exist')) return true
  if (error.code === '42P01') return true
  return false
}

// ===== Conversations =====

/**
 * Get or create a conversation between the current user and another user.
 * Only works if the users are friends.
 */
export async function getOrCreateConversation(otherUserId: string): Promise<string> {
  const session = (await supabase.auth.getSession()).data.session
  if (!session?.user?.id) {
    throw new Error('Not authenticated')
  }
  
  const { data, error } = await supabase.rpc('get_or_create_conversation', {
    _user1_id: session.user.id,
    _user2_id: otherUserId
  })
  
  if (error) {
    if (error.message?.includes('friends')) {
      throw new Error('You can only message your friends')
    }
    if (error.message?.includes('Cannot message')) {
      throw new Error('Cannot message this user')
    }
    throw new Error(error.message)
  }
  
  return data as string
}

/**
 * Get all conversations for the current user with details.
 */
export async function getUserConversations(): Promise<ConversationWithDetails[]> {
  const session = (await supabase.auth.getSession()).data.session
  if (!session?.user?.id) {
    throw new Error('Not authenticated')
  }
  
  const { data, error } = await supabase.rpc('get_user_conversations', {
    _user_id: session.user.id
  })
  
  if (error) {
    if (isMissingTableError(error)) {
      return []
    }
    throw new Error(error.message)
  }
  
  return (data || []).map((row: any) => ({
    conversationId: row.conversation_id,
    otherUserId: row.other_user_id,
    otherUserDisplayName: row.other_user_display_name,
    otherUserAvatarUrl: row.other_user_avatar_url,
    lastMessageContent: row.last_message_content,
    lastMessageAt: row.last_message_at,
    lastMessageSenderId: row.last_message_sender_id,
    unreadCount: row.unread_count || 0,
    isMuted: row.is_muted || false,
    createdAt: row.created_at
  }))
}

/**
 * Get unread message count for the current user.
 */
export async function getUnreadMessageCount(): Promise<number> {
  const session = (await supabase.auth.getSession()).data.session
  if (!session?.user?.id) {
    return 0
  }
  
  const { data, error } = await supabase.rpc('get_unread_message_count', {
    _user_id: session.user.id
  })
  
  if (error) {
    if (isMissingTableError(error)) {
      return 0
    }
    console.warn('[messaging] Failed to get unread count:', error)
    return 0
  }
  
  return data || 0
}

/**
 * Toggle mute status for a conversation.
 */
export async function toggleConversationMute(conversationId: string): Promise<boolean> {
  const session = (await supabase.auth.getSession()).data.session
  if (!session?.user?.id) {
    throw new Error('Not authenticated')
  }
  
  // First get the current conversation to determine which mute field to update
  const { data: conv, error: fetchError } = await supabase
    .from('conversations')
    .select('participant_1, participant_2, muted_by_1, muted_by_2')
    .eq('id', conversationId)
    .single()
  
  if (fetchError) throw new Error(fetchError.message)
  if (!conv) throw new Error('Conversation not found')
  
  const isParticipant1 = conv.participant_1 === session.user.id
  const currentMuteStatus = isParticipant1 ? conv.muted_by_1 : conv.muted_by_2
  const newMuteStatus = !currentMuteStatus
  
  const updateField = isParticipant1 ? 'muted_by_1' : 'muted_by_2'
  
  const { error } = await supabase
    .from('conversations')
    .update({ [updateField]: newMuteStatus, updated_at: new Date().toISOString() })
    .eq('id', conversationId)
  
  if (error) throw new Error(error.message)
  
  return newMuteStatus
}

// ===== Messages =====

/**
 * Get messages for a conversation with pagination.
 */
export async function getConversationMessages(
  conversationId: string,
  options?: {
    limit?: number
    before?: string // Cursor for pagination (message ID)
  }
): Promise<Message[]> {
  let query = supabase
    .from('messages')
    .select(`
      id,
      conversation_id,
      sender_id,
      content,
      link_type,
      link_id,
      link_url,
      link_preview,
      reply_to_id,
      created_at,
      updated_at,
      deleted_at,
      edited_at,
      read_at
    `)
    .eq('conversation_id', conversationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  
  if (options?.limit) {
    query = query.limit(options.limit)
  } else {
    query = query.limit(50)
  }
  
  if (options?.before) {
    // Get the created_at of the cursor message
    const { data: cursorMsg } = await supabase
      .from('messages')
      .select('created_at')
      .eq('id', options.before)
      .single()
    
    if (cursorMsg) {
      query = query.lt('created_at', cursorMsg.created_at)
    }
  }
  
  const { data, error } = await query
  
  if (error) {
    if (isMissingTableError(error)) {
      return []
    }
    throw new Error(error.message)
  }
  
  if (!data || data.length === 0) return []
  
  // Get sender profiles
  const senderIds = [...new Set(data.map(m => m.sender_id))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url')
    .in('id', senderIds)
  
  const profileMap = new Map(
    (profiles || []).map(p => [p.id, { id: p.id, displayName: p.display_name, avatarUrl: p.avatar_url }])
  )
  
  // Get reactions for these messages
  const messageIds = data.map(m => m.id)
  const { data: reactions } = await supabase
    .from('message_reactions')
    .select('id, message_id, user_id, emoji, created_at')
    .in('message_id', messageIds)
  
  const reactionsByMessage = new Map<string, MessageReaction[]>()
  if (reactions) {
    reactions.forEach(r => {
      const existing = reactionsByMessage.get(r.message_id) || []
      existing.push({
        id: r.id,
        messageId: r.message_id,
        userId: r.user_id,
        emoji: r.emoji,
        createdAt: r.created_at
      })
      reactionsByMessage.set(r.message_id, existing)
    })
  }
  
  // Get reply-to messages if any
  const replyToIds = data.filter(m => m.reply_to_id).map(m => m.reply_to_id)
  const replyToMap = new Map<string, Message>()
  
  if (replyToIds.length > 0) {
    const { data: replyMsgs } = await supabase
      .from('messages')
      .select('id, sender_id, content, created_at')
      .in('id', replyToIds)
    
    if (replyMsgs) {
      replyMsgs.forEach(r => {
        replyToMap.set(r.id, {
          id: r.id,
          conversationId: conversationId,
          senderId: r.sender_id,
          content: r.content,
          createdAt: r.created_at,
          updatedAt: r.created_at,
          sender: profileMap.get(r.sender_id) || undefined
        })
      })
    }
  }
  
  return data.map(row => ({
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    content: row.content,
    linkType: row.link_type as LinkType | null,
    linkId: row.link_id,
    linkUrl: row.link_url,
    linkPreview: row.link_preview as LinkPreview | null,
    replyToId: row.reply_to_id,
    replyTo: row.reply_to_id ? replyToMap.get(row.reply_to_id) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    editedAt: row.edited_at,
    readAt: row.read_at,
    reactions: reactionsByMessage.get(row.id) || [],
    sender: profileMap.get(row.sender_id)
  })).reverse() // Reverse to get chronological order
}

/**
 * Send a message in a conversation.
 */
export async function sendMessage(params: SendMessageParams): Promise<Message> {
  const session = (await supabase.auth.getSession()).data.session
  if (!session?.user?.id) {
    throw new Error('Not authenticated')
  }
  
  const { data, error } = await supabase.rpc('send_message', {
    _conversation_id: params.conversationId,
    _content: params.content,
    _link_type: params.linkType || null,
    _link_id: params.linkId || null,
    _link_url: params.linkUrl || null,
    _link_preview: params.linkPreview || null,
    _reply_to_id: params.replyToId || null
  })
  
  if (error) throw new Error(error.message)
  
  // Fetch the created message
  const { data: msgData, error: msgError } = await supabase
    .from('messages')
    .select('*')
    .eq('id', data)
    .single()
  
  if (msgError) throw new Error(msgError.message)
  
  return {
    id: msgData.id,
    conversationId: msgData.conversation_id,
    senderId: msgData.sender_id,
    content: msgData.content,
    linkType: msgData.link_type,
    linkId: msgData.link_id,
    linkUrl: msgData.link_url,
    linkPreview: msgData.link_preview,
    replyToId: msgData.reply_to_id,
    createdAt: msgData.created_at,
    updatedAt: msgData.updated_at,
    deletedAt: msgData.deleted_at,
    editedAt: msgData.edited_at,
    readAt: msgData.read_at,
    reactions: []
  }
}

/**
 * Edit a message (only the sender can edit).
 */
export async function editMessage(messageId: string, newContent: string): Promise<void> {
  const session = (await supabase.auth.getSession()).data.session
  if (!session?.user?.id) {
    throw new Error('Not authenticated')
  }
  
  const { error } = await supabase
    .from('messages')
    .update({ 
      content: newContent, 
      edited_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', messageId)
    .eq('sender_id', session.user.id)
  
  if (error) throw new Error(error.message)
}

/**
 * Soft delete a message (only the sender can delete).
 */
export async function deleteMessage(messageId: string): Promise<void> {
  const session = (await supabase.auth.getSession()).data.session
  if (!session?.user?.id) {
    throw new Error('Not authenticated')
  }
  
  const { error } = await supabase
    .from('messages')
    .update({ 
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', messageId)
    .eq('sender_id', session.user.id)
  
  if (error) throw new Error(error.message)
}

/**
 * Mark all messages in a conversation as read.
 */
export async function markMessagesAsRead(conversationId: string): Promise<number> {
  const { data, error } = await supabase.rpc('mark_messages_as_read', {
    _conversation_id: conversationId
  })
  
  if (error) throw new Error(error.message)
  
  return data || 0
}

// ===== Reactions =====

/**
 * Add a reaction to a message.
 */
export async function addReaction(messageId: string, emoji: string): Promise<MessageReaction> {
  const session = (await supabase.auth.getSession()).data.session
  if (!session?.user?.id) {
    throw new Error('Not authenticated')
  }
  
  const { data, error } = await supabase
    .from('message_reactions')
    .insert({
      message_id: messageId,
      user_id: session.user.id,
      emoji
    })
    .select()
    .single()
  
  if (error) {
    if (error.code === '23505') {
      throw new Error('You have already reacted with this emoji')
    }
    throw new Error(error.message)
  }
  
  return {
    id: data.id,
    messageId: data.message_id,
    userId: data.user_id,
    emoji: data.emoji,
    createdAt: data.created_at
  }
}

/**
 * Remove a reaction from a message.
 */
export async function removeReaction(messageId: string, emoji: string): Promise<void> {
  const session = (await supabase.auth.getSession()).data.session
  if (!session?.user?.id) {
    throw new Error('Not authenticated')
  }
  
  const { error } = await supabase
    .from('message_reactions')
    .delete()
    .eq('message_id', messageId)
    .eq('user_id', session.user.id)
    .eq('emoji', emoji)
  
  if (error) throw new Error(error.message)
}

/**
 * Toggle a reaction on a message (add if not present, remove if present).
 */
export async function toggleReaction(messageId: string, emoji: string): Promise<boolean> {
  const session = (await supabase.auth.getSession()).data.session
  if (!session?.user?.id) {
    throw new Error('Not authenticated')
  }
  
  // Check if reaction exists
  const { data: existing } = await supabase
    .from('message_reactions')
    .select('id')
    .eq('message_id', messageId)
    .eq('user_id', session.user.id)
    .eq('emoji', emoji)
    .maybeSingle()
  
  if (existing) {
    await removeReaction(messageId, emoji)
    return false
  } else {
    await addReaction(messageId, emoji)
    return true
  }
}

// ===== Link Sharing =====

/**
 * Generate a shareable link for an app resource.
 */
export function generateShareLink(type: LinkType, id: string): string {
  const baseUrl = window.location.origin
  
  switch (type) {
    case 'plant':
      return `${baseUrl}/plants/${id}`
    case 'garden':
      return `${baseUrl}/garden/${id}`
    case 'bookmark':
      return `${baseUrl}/bookmarks/${id}`
    case 'profile':
      return `${baseUrl}/u/${id}`
    default:
      return id // For external links, the ID is the URL
  }
}

/**
 * Parse a link URL to extract resource type and ID.
 */
export function parseLinkUrl(url: string): { type: LinkType; id: string } | null {
  try {
    const parsed = new URL(url)
    const path = parsed.pathname
    
    // Check if it's an internal link
    if (parsed.origin === window.location.origin) {
      const plantMatch = path.match(/^\/plants\/([^/]+)$/)
      if (plantMatch) return { type: 'plant', id: plantMatch[1] }
      
      const gardenMatch = path.match(/^\/garden\/([^/]+)/)
      if (gardenMatch) return { type: 'garden', id: gardenMatch[1] }
      
      const bookmarkMatch = path.match(/^\/bookmarks\/([^/]+)$/)
      if (bookmarkMatch) return { type: 'bookmark', id: bookmarkMatch[1] }
      
      const profileMatch = path.match(/^\/u\/([^/]+)$/)
      if (profileMatch) return { type: 'profile', id: profileMatch[1] }
    }
    
    // External link
    return { type: 'external', id: url }
  } catch {
    return null
  }
}

// ===== Image Upload =====

/**
 * Upload an image for messaging.
 * Returns the public URL of the uploaded image.
 */
export async function uploadMessageImage(file: File): Promise<{ url: string; thumbnailUrl?: string }> {
  const session = (await supabase.auth.getSession()).data.session
  if (!session?.user?.id) {
    throw new Error('Not authenticated')
  }
  
  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.')
  }
  
  // Validate file size (max 10MB)
  const maxSize = 10 * 1024 * 1024
  if (file.size > maxSize) {
    throw new Error('File too large. Maximum size is 10MB.')
  }
  
  // Generate unique filename
  const ext = file.name.split('.').pop() || 'jpg'
  const timestamp = Date.now()
  const randomId = Math.random().toString(36).substring(2, 10)
  const filename = `${session.user.id}/${timestamp}-${randomId}.${ext}`
  
  // Upload to Supabase storage
  const { error } = await supabase.storage
    .from('message-images')
    .upload(filename, file, {
      cacheControl: '31536000', // 1 year cache
      upsert: false
    })
  
  if (error) {
    // If bucket doesn't exist, try uploads bucket as fallback
    const { error: fallbackError } = await supabase.storage
      .from('uploads')
      .upload(`messages/${filename}`, file, {
        cacheControl: '31536000',
        upsert: false
      })
    
    if (fallbackError) {
      console.error('[messaging] Failed to upload image:', fallbackError)
      throw new Error('Failed to upload image')
    }
    
    const { data: urlData } = supabase.storage
      .from('uploads')
      .getPublicUrl(`messages/${filename}`)
    
    return { url: urlData.publicUrl }
  }
  
  const { data: urlData } = supabase.storage
    .from('message-images')
    .getPublicUrl(filename)
  
  return { url: urlData.publicUrl }
}

/**
 * Send an image message.
 * Images are sent with a special content format that the UI renders as images.
 */
export async function sendImageMessage(
  conversationId: string,
  imageUrl: string,
  caption?: string,
  replyToId?: string
): Promise<Message> {
  // Use a special format to identify image messages
  // Format: [image:URL] optional caption
  const content = caption 
    ? `[image:${imageUrl}] ${caption}`
    : `[image:${imageUrl}]`
  
  return sendMessage({
    conversationId,
    content,
    messageType: 'image',
    imageUrl,
    replyToId
  })
}

/**
 * Check if a message is an image message.
 */
export function isImageMessage(content: string): boolean {
  return content.startsWith('[image:')
}

/**
 * Extract image URL and caption from an image message content.
 */
export function parseImageMessage(content: string): { imageUrl: string; caption?: string } | null {
  const match = content.match(/^\[image:(.*?)\](.*)$/)
  if (!match) return null
  
  return {
    imageUrl: match[1],
    caption: match[2]?.trim() || undefined
  }
}

// ===== Push Notifications =====

/**
 * Send a push notification for a new message.
 */
export async function sendMessagePushNotification(
  recipientId: string,
  senderDisplayName: string,
  messagePreview: string,
  conversationId: string,
  language: string = 'en'
): Promise<{ sent: boolean; reason?: string }> {
  const translations: Record<string, { title: string; body: string }> = {
    en: {
      title: `New message from ${senderDisplayName}`,
      body: messagePreview.length > 100 ? messagePreview.slice(0, 100) + '...' : messagePreview
    },
    fr: {
      title: `Nouveau message de ${senderDisplayName}`,
      body: messagePreview.length > 100 ? messagePreview.slice(0, 100) + '...' : messagePreview
    }
  }
  
  const t = translations[language] || translations.en
  
  try {
    const session = (await supabase.auth.getSession()).data.session
    const token = session?.access_token
    
    if (!token) {
      return { sent: false, reason: 'NOT_AUTHENTICATED' }
    }
    
    const response = await fetch('/api/push/instant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      credentials: 'same-origin',
      body: JSON.stringify({
        recipientId,
        type: 'new_message',
        title: t.title,
        body: t.body,
        data: { conversationId, senderDisplayName }
      })
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return { sent: false, reason: errorData?.error || 'REQUEST_FAILED' }
    }
    
    const result = await response.json()
    return { sent: result.sent ?? false, reason: result.reason }
  } catch (err) {
    console.warn('[messaging] Error sending push notification:', (err as Error)?.message)
    return { sent: false, reason: 'ERROR' }
  }
}
