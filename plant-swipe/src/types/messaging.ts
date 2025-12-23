/**
 * Messaging System Types
 * 
 * Types for the real-time messaging system including conversations,
 * messages, reactions, and replies.
 */

export type LinkType = 'plant' | 'garden' | 'bookmark' | 'profile' | 'external'

export interface LinkPreview {
  title?: string
  description?: string
  image?: string
}

export interface Message {
  id: string
  conversationId: string
  senderId: string
  content: string
  // Optional link sharing
  linkType?: LinkType | null
  linkId?: string | null
  linkUrl?: string | null
  linkPreview?: LinkPreview | null
  // Reply threading
  replyToId?: string | null
  replyTo?: Message | null
  // Timestamps
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
  editedAt?: string | null
  readAt?: string | null
  // Reactions
  reactions?: MessageReaction[]
  // Sender profile (populated by query)
  sender?: {
    id: string
    displayName: string | null
    avatarUrl?: string | null
  }
}

export interface MessageReaction {
  id: string
  messageId: string
  userId: string
  emoji: string
  createdAt: string
  // User profile (populated by query)
  user?: {
    id: string
    displayName: string | null
  }
}

export interface Conversation {
  id: string
  participant1: string
  participant2: string
  createdAt: string
  updatedAt: string
  lastMessageAt?: string | null
  mutedBy1: boolean
  mutedBy2: boolean
}

export interface ConversationWithDetails {
  conversationId: string
  otherUserId: string
  otherUserDisplayName: string | null
  otherUserAvatarUrl?: string | null
  lastMessageContent?: string | null
  lastMessageAt?: string | null
  lastMessageSenderId?: string | null
  unreadCount: number
  isMuted: boolean
  createdAt: string
}

export interface SendMessageParams {
  conversationId: string
  content: string
  linkType?: LinkType | null
  linkId?: string | null
  linkUrl?: string | null
  linkPreview?: LinkPreview | null
  replyToId?: string | null
}

export interface MessageUpdate {
  content?: string
  deletedAt?: string | null
  editedAt?: string | null
  readAt?: string | null
}

// Common emoji reactions for quick access
export const COMMON_REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🎉', '🔥', '🌱'] as const
export type CommonReaction = typeof COMMON_REACTIONS[number]

// Realtime message events
export type MessageEventType = 
  | 'new_message'
  | 'message_updated'
  | 'message_deleted'
  | 'reaction_added'
  | 'reaction_removed'
  | 'messages_read'

export interface MessageEvent {
  type: MessageEventType
  conversationId: string
  message?: Message
  messageId?: string
  reaction?: MessageReaction
  readBy?: string
  timestamp: string
}
