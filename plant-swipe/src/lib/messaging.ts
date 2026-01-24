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

const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10MB

/** Result from optimized image upload */
export type MessageImageUploadResult = {
  ok?: boolean
  url?: string | null
  bucket?: string
  path?: string
  mimeType?: string
  size?: number
  originalMimeType?: string
  originalSize?: number
  compressionPercent?: number | null
  optimized?: boolean
}

/**
 * Upload an image for messaging.
 * Uses the server-side endpoint which handles optimization with sharp.
 * Returns the public URL of the uploaded image.
 */
export async function uploadMessageImage(file: File): Promise<{ url: string }> {
  const session = (await supabase.auth.getSession()).data.session
  if (!session?.access_token) {
    throw new Error('Not authenticated')
  }
  
  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif', 'image/avif']
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Invalid file type. Only JPEG, PNG, GIF, WebP, HEIC, and AVIF are allowed.')
  }
  
  // Validate file size (max 10MB)
  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error('File too large. Maximum size is 10MB.')
  }
  
  // Upload via server endpoint (handles optimization with sharp)
  const formData = new FormData()
  formData.append('file', file)
  
  const response = await fetch('/api/messages/upload-image', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`
    },
    body: formData
  })
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    console.error('[messaging] Failed to upload image:', errorData)
    throw new Error(errorData.error || 'Failed to upload image')
  }
  
  const data = await response.json()
  
  if (!data.ok || !data.url) {
    throw new Error('Failed to upload image: Invalid response')
  }
  
  return { url: data.url }
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

// ===== Conversation Search & Media =====

/**
 * Search messages within a conversation.
 * Returns messages matching the search query.
 */
export async function searchConversationMessages(
  conversationId: string,
  query: string,
  options?: {
    limit?: number
  }
): Promise<Message[]> {
  const session = (await supabase.auth.getSession()).data.session
  if (!session?.user?.id) {
    throw new Error('Not authenticated')
  }
  
  if (!query.trim()) {
    return []
  }
  
  const searchTerm = `%${query.toLowerCase()}%`
  
  let dbQuery = supabase
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
    .ilike('content', searchTerm)
    .order('created_at', { ascending: false })
  
  if (options?.limit) {
    dbQuery = dbQuery.limit(options.limit)
  } else {
    dbQuery = dbQuery.limit(50)
  }
  
  const { data, error } = await dbQuery
  
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    editedAt: row.edited_at,
    readAt: row.read_at,
    reactions: [],
    sender: profileMap.get(row.sender_id)
  }))
}

export interface ConversationImage {
  id: string
  messageId: string
  imageUrl: string
  caption: string | undefined
  senderId: string
  senderDisplayName: string | null
  senderAvatarUrl: string | null
  createdAt: string
}

/**
 * Get all images from a conversation.
 * Returns images in reverse chronological order (newest first).
 */
export async function getConversationImages(
  conversationId: string,
  options?: {
    limit?: number
    offset?: number
  }
): Promise<ConversationImage[]> {
  const session = (await supabase.auth.getSession()).data.session
  if (!session?.user?.id) {
    throw new Error('Not authenticated')
  }
  
  // Query messages that start with [image: pattern
  let query = supabase
    .from('messages')
    .select(`
      id,
      conversation_id,
      sender_id,
      content,
      created_at
    `)
    .eq('conversation_id', conversationId)
    .is('deleted_at', null)
    .like('content', '[image:%')
    .order('created_at', { ascending: false })
  
  if (options?.limit) {
    query = query.limit(options.limit)
  } else {
    query = query.limit(100)
  }
  
  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 100) - 1)
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
    (profiles || []).map(p => [p.id, { 
      displayName: p.display_name, 
      avatarUrl: p.avatar_url 
    }])
  )
  
  // Parse image messages and return image data
  const results: ConversationImage[] = []
  
  for (const row of data) {
    const parsed = parseImageMessage(row.content)
    if (!parsed) continue
    
    const profile = profileMap.get(row.sender_id)
    
    results.push({
      id: `${row.id}-image`,
      messageId: row.id,
      imageUrl: parsed.imageUrl,
      caption: parsed.caption,
      senderId: row.sender_id,
      senderDisplayName: profile?.displayName || null,
      senderAvatarUrl: profile?.avatarUrl || null,
      createdAt: row.created_at
    })
  }
  
  return results
}

// ===== Internal Link Detection & Preview =====

/**
 * Internal link types for aphylia.app resources
 */
export interface InternalLink {
  type: 'plant' | 'garden' | 'profile' | 'bookmark' | 'blog' | 'media'
  id: string
  url: string
  fullMatch: string // The original matched text
}

export interface InternalLinkPreviewData {
  type: InternalLink['type']
  id: string
  title: string
  description?: string
  imageUrl?: string
  subtitle?: string
}

/**
 * Media domains for aphylia.app
 */
const MEDIA_DOMAINS = [
  'media.aphylia.app'
]

/**
 * Check if a URL is a media.aphylia.app link
 */
export function isMediaUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.toLowerCase()
    return MEDIA_DOMAINS.some(domain => hostname === domain)
  } catch {
    return false
  }
}

/**
 * Check if a URL points to an image file
 */
export function isImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    const path = parsed.pathname.toLowerCase()
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.svg', '.heic', '.heif']
    return imageExtensions.some(ext => path.endsWith(ext))
  } catch {
    return false
  }
}

/**
 * Get a friendly filename from a media URL
 */
export function getMediaFilename(url: string): string {
  try {
    const parsed = new URL(url)
    const path = parsed.pathname
    const segments = path.split('/')
    const filename = segments[segments.length - 1] || 'media'
    // Remove UUID-like suffixes for cleaner display
    const cleanName = filename.replace(/-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, '')
    // Get just the name part without extension for display
    const nameOnly = cleanName.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
    return nameOnly || 'Image'
  } catch {
    return 'Image'
  }
}

/**
 * Domains that should be treated as internal (aphylia.app links)
 */
const INTERNAL_DOMAINS = [
  'aphylia.app',
  'www.aphylia.app',
  'staging.aphylia.app',
  'dev.aphylia.app',
  'localhost'
]

/**
 * Check if a URL is an internal aphylia.app link
 */
export function isInternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.toLowerCase()
    
    // Check if it's the current origin
    if (parsed.origin === window.location.origin) {
      return true
    }
    
    // Check if it's a media URL
    if (MEDIA_DOMAINS.some(domain => hostname === domain)) {
      return true
    }
    
    // Check if it matches known internal domains
    return INTERNAL_DOMAINS.some(domain => 
      hostname === domain || hostname.endsWith(`.${domain}`)
    )
  } catch {
    return false
  }
}

/**
 * Parse an internal URL to extract resource type and ID
 */
export function parseInternalUrl(url: string): InternalLink | null {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.toLowerCase()
    let path = parsed.pathname
    
    // Check if it's a media URL (media.aphylia.app)
    if (MEDIA_DOMAINS.some(domain => hostname === domain)) {
      // It's a media file
      return { type: 'media', id: url, url, fullMatch: url }
    }
    
    // Strip language prefix (e.g., /en/, /fr/)
    const langMatch = path.match(/^\/([a-z]{2})(\/.*)$/)
    if (langMatch) {
      path = langMatch[2]
    }
    
    // Match different resource types
    const plantMatch = path.match(/^\/plants\/([^/]+)(?:\/.*)?$/)
    if (plantMatch) {
      return { type: 'plant', id: plantMatch[1], url, fullMatch: url }
    }
    
    const gardenMatch = path.match(/^\/garden\/([^/]+)(?:\/.*)?$/)
    if (gardenMatch) {
      return { type: 'garden', id: gardenMatch[1], url, fullMatch: url }
    }
    
    const bookmarkMatch = path.match(/^\/bookmarks\/([^/]+)(?:\/.*)?$/)
    if (bookmarkMatch) {
      return { type: 'bookmark', id: bookmarkMatch[1], url, fullMatch: url }
    }
    
    const profileMatch = path.match(/^\/u\/([^/]+)(?:\/.*)?$/)
    if (profileMatch) {
      return { type: 'profile', id: decodeURIComponent(profileMatch[1]), url, fullMatch: url }
    }
    
    const blogMatch = path.match(/^\/blog\/([^/]+)(?:\/.*)?$/)
    if (blogMatch && blogMatch[1] !== 'create') {
      return { type: 'blog', id: blogMatch[1], url, fullMatch: url }
    }
    
    return null
  } catch {
    return null
  }
}

/**
 * Extract all URLs from text content
 */
export function extractUrlsFromText(text: string): string[] {
  // Regex to match URLs - supports http, https, and URLs without protocol
  const urlRegex = /(?:https?:\/\/)?(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&/=]*)/gi
  const matches = text.match(urlRegex) || []
  
  // Normalize URLs - add https:// if missing protocol
  return matches.map(url => {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return `https://${url}`
    }
    return url
  })
}

/**
 * Extract internal links from message content
 */
export function extractInternalLinks(content: string): InternalLink[] {
  const urls = extractUrlsFromText(content)
  const links: InternalLink[] = []
  
  for (const url of urls) {
    if (isInternalUrl(url)) {
      const parsed = parseInternalUrl(url)
      if (parsed) {
        // Update fullMatch to the original text
        const originalMatch = urls.find(u => u === url || `https://${u}` === url)
        if (originalMatch) {
          parsed.fullMatch = originalMatch
        }
        links.push(parsed)
      }
    }
  }
  
  return links
}

/**
 * Fetch preview data for a plant
 */
async function fetchPlantPreview(plantId: string): Promise<InternalLinkPreviewData | null> {
  try {
    const { data: plant, error } = await supabase
      .from('plants')
      .select('id, name, scientific_name, meaning, identity')
      .eq('id', plantId)
      .single()
    
    if (error || !plant) return null
    
    // Get primary image
    const { data: imageData } = await supabase
      .from('plant_images')
      .select('url')
      .eq('plant_id', plantId)
      .eq('is_primary', true)
      .single()
    
    // Build description from plant identity
    const identity = plant.identity as { maintenanceLevel?: string; livingSpace?: string } | null
    let description = plant.scientific_name || ''
    if (identity?.maintenanceLevel) {
      const maintenanceLabels: Record<string, string> = {
        'low': '🌱 Easy care',
        'medium': '🌿 Moderate care', 
        'high': '🌺 Expert care'
      }
      const careLabel = maintenanceLabels[identity.maintenanceLevel.toLowerCase()] || ''
      if (careLabel) {
        description = description ? `${description} · ${careLabel}` : careLabel
      }
    }
    
    return {
      type: 'plant',
      id: plantId,
      title: plant.name,
      subtitle: description || undefined,
      description: plant.meaning || undefined,
      imageUrl: imageData?.url || undefined
    }
  } catch {
    return null
  }
}

/**
 * Fetch preview data for a garden
 */
async function fetchGardenPreview(gardenId: string): Promise<InternalLinkPreviewData | null> {
  try {
    const { data: garden, error } = await supabase
      .from('gardens')
      .select('id, name, description, cover_image_url')
      .eq('id', gardenId)
      .single()
    
    if (error || !garden) return null
    
    // Get plant count in this garden
    const { count: plantCount } = await supabase
      .from('garden_plants')
      .select('*', { count: 'exact', head: true })
      .eq('garden_id', gardenId)
    
    // Get member count
    const { count: memberCount } = await supabase
      .from('garden_members')
      .select('*', { count: 'exact', head: true })
      .eq('garden_id', gardenId)
    
    // Build subtitle with counts
    const parts: string[] = []
    if (plantCount !== null && plantCount > 0) {
      parts.push(`🌱 ${plantCount} plant${plantCount !== 1 ? 's' : ''}`)
    }
    if (memberCount !== null && memberCount > 1) {
      parts.push(`👥 ${memberCount} members`)
    }
    
    return {
      type: 'garden',
      id: gardenId,
      title: garden.name,
      subtitle: parts.length > 0 ? parts.join(' · ') : undefined,
      description: garden.description || undefined,
      imageUrl: garden.cover_image_url || undefined
    }
  } catch {
    return null
  }
}

/**
 * Fetch preview data for a user profile
 */
async function fetchProfilePreview(username: string): Promise<InternalLinkPreviewData | null> {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, bio, liked_plant_ids')
      .eq('display_name', username)
      .single()
    
    if (error || !profile) return null
    
    // Get friend count (friends where this user is either user_id or friend_id with status accepted)
    const { count: friendCount } = await supabase
      .from('friends')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .eq('status', 'accepted')
    
    // Get garden count
    const { count: gardenCount } = await supabase
      .from('garden_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id)
    
    // Build subtitle with counts
    const parts: string[] = []
    const likedCount = Array.isArray(profile.liked_plant_ids) ? profile.liked_plant_ids.length : 0
    if (likedCount > 0) {
      parts.push(`❤️ ${likedCount} favorite${likedCount !== 1 ? 's' : ''}`)
    }
    if (gardenCount !== null && gardenCount > 0) {
      parts.push(`🏡 ${gardenCount} garden${gardenCount !== 1 ? 's' : ''}`)
    }
    if (friendCount !== null && friendCount > 0) {
      parts.push(`👥 ${friendCount} friend${friendCount !== 1 ? 's' : ''}`)
    }
    
    return {
      type: 'profile',
      id: username,
      title: profile.display_name || username,
      subtitle: parts.length > 0 ? parts.join(' · ') : undefined,
      description: profile.bio || undefined,
      imageUrl: profile.avatar_url || undefined
    }
  } catch {
    return null
  }
}

/**
 * Fetch preview data for a bookmark list
 */
async function fetchBookmarkPreview(bookmarkId: string): Promise<InternalLinkPreviewData | null> {
  try {
    const { data: bookmark, error } = await supabase
      .from('bookmarks')
      .select('id, name, description, cover_image_url, user_id')
      .eq('id', bookmarkId)
      .single()
    
    if (error || !bookmark) return null
    
    // Get plant count in this bookmark
    const { count: plantCount } = await supabase
      .from('bookmark_items')
      .select('*', { count: 'exact', head: true })
      .eq('bookmark_id', bookmarkId)
    
    // Get owner's display name
    let ownerName: string | undefined
    if (bookmark.user_id) {
      const { data: owner } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', bookmark.user_id)
        .single()
      ownerName = owner?.display_name || undefined
    }
    
    // Build subtitle
    const parts: string[] = []
    if (plantCount !== null && plantCount > 0) {
      parts.push(`🌱 ${plantCount} plant${plantCount !== 1 ? 's' : ''}`)
    }
    if (ownerName) {
      parts.push(`by ${ownerName}`)
    }
    
    return {
      type: 'bookmark',
      id: bookmarkId,
      title: bookmark.name,
      subtitle: parts.length > 0 ? parts.join(' · ') : undefined,
      description: bookmark.description || undefined,
      imageUrl: bookmark.cover_image_url || undefined
    }
  } catch {
    return null
  }
}

/**
 * Fetch preview data for a blog post
 */
async function fetchBlogPreview(slug: string): Promise<InternalLinkPreviewData | null> {
  try {
    const { data: post, error } = await supabase
      .from('blog_posts')
      .select('id, title, excerpt, cover_image_url, author_id, published_at')
      .eq('slug', slug)
      .single()
    
    if (error || !post) return null
    
    // Get author's display name
    let authorName: string | undefined
    if (post.author_id) {
      const { data: author } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', post.author_id)
        .single()
      authorName = author?.display_name || undefined
    }
    
    // Format published date
    let dateStr: string | undefined
    if (post.published_at) {
      const date = new Date(post.published_at)
      dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    }
    
    // Build subtitle
    const parts: string[] = []
    if (authorName) {
      parts.push(`by ${authorName}`)
    }
    if (dateStr) {
      parts.push(dateStr)
    }
    
    return {
      type: 'blog',
      id: slug,
      title: post.title,
      subtitle: parts.length > 0 ? parts.join(' · ') : undefined,
      description: post.excerpt || undefined,
      imageUrl: post.cover_image_url || undefined
    }
  } catch {
    return null
  }
}

/**
 * Fetch preview data for a media file
 */
function fetchMediaPreview(url: string): InternalLinkPreviewData {
  const filename = getMediaFilename(url)
  const isImage = isImageUrl(url)
  
  return {
    type: 'media',
    id: url,
    title: filename,
    subtitle: isImage ? '📷 Image' : '📁 File',
    imageUrl: isImage ? url : undefined
  }
}

/**
 * Fetch preview data for an internal link
 */
export async function fetchInternalLinkPreview(link: InternalLink): Promise<InternalLinkPreviewData | null> {
  switch (link.type) {
    case 'plant':
      return fetchPlantPreview(link.id)
    case 'garden':
      return fetchGardenPreview(link.id)
    case 'profile':
      return fetchProfilePreview(link.id)
    case 'bookmark':
      return fetchBookmarkPreview(link.id)
    case 'blog':
      return fetchBlogPreview(link.id)
    case 'media':
      return fetchMediaPreview(link.id)
    default:
      return null
  }
}

// ===== Push Notifications =====

/**
 * Send a push notification for a new message.
 * This sends a push notification to the recipient's registered devices.
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
      title: `${senderDisplayName}`,
      body: messagePreview.length > 100 ? messagePreview.slice(0, 100) + '...' : messagePreview
    },
    fr: {
      title: `${senderDisplayName}`,
      body: messagePreview.length > 100 ? messagePreview.slice(0, 100) + '...' : messagePreview
    }
  }
  
  const t = translations[language] || translations.en
  
  // Build the conversation URL for navigation when notification is clicked
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const conversationUrl = `${baseUrl}/messages?conversation=${conversationId}`
  
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
        tag: `message-${conversationId}`, // Group notifications by conversation
        renotify: true, // Show new notification even if one exists with same tag
        data: { 
          conversationId, 
          senderDisplayName,
          type: 'new_message',
          url: conversationUrl,
          ctaUrl: conversationUrl
        }
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
