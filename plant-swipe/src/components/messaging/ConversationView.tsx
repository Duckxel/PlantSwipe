/**
 * ConversationView Component
 * 
 * Displays a conversation with messages, allowing users to send messages,
 * react to messages, and reply to specific messages.
 */

import React from 'react'
import { useTranslation } from 'react-i18next'
import { useLanguageNavigate } from '@/lib/i18nRouting'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { 
  ArrowLeft, 
  Send, 
  Loader2, 
  User,
  Reply,
  Link as LinkIcon,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { 
  getConversationMessages,
  sendMessage,
  markMessagesAsRead,
  editMessage,
  deleteMessage,
  toggleReaction,
  sendMessagePushNotification
} from '@/lib/messaging'
import { supabase } from '@/lib/supabaseClient'
import type { Message, LinkType, LinkPreview } from '@/types/messaging'
import { MessageBubble } from './MessageBubble'
import { LinkShareDialog } from './LinkShareDialog'

interface ConversationViewProps {
  conversationId: string
  otherUser: {
    id: string
    displayName: string | null
    avatarUrl?: string | null
  }
  onBack: () => void
  currentUserId: string
  currentUserDisplayName: string | null
}

export const ConversationView: React.FC<ConversationViewProps> = ({
  conversationId,
  otherUser,
  onBack,
  currentUserId,
  currentUserDisplayName
}) => {
  const { t } = useTranslation('common')
  const navigate = useLanguageNavigate()
  
  const [messages, setMessages] = React.useState<Message[]>([])
  const [loading, setLoading] = React.useState(true)
  const [sending, setSending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [newMessage, setNewMessage] = React.useState('')
  const [replyingTo, setReplyingTo] = React.useState<Message | null>(null)
  const [linkShareOpen, setLinkShareOpen] = React.useState(false)
  const [pendingLink, setPendingLink] = React.useState<{
    type: LinkType
    id: string
    url: string
    preview?: LinkPreview
  } | null>(null)
  
  const messagesEndRef = React.useRef<HTMLDivElement>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  
  // Load messages
  const loadMessages = React.useCallback(async () => {
    try {
      setError(null)
      const data = await getConversationMessages(conversationId)
      setMessages(data)
      // Mark messages as read
      await markMessagesAsRead(conversationId)
    } catch (e: any) {
      console.error('[conversation] Failed to load messages:', e)
      setError(e?.message || 'Failed to load messages')
    } finally {
      setLoading(false)
    }
  }, [conversationId])
  
  React.useEffect(() => {
    loadMessages()
  }, [loadMessages])
  
  // Scroll to bottom when messages change
  React.useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])
  
  // Realtime subscription for new messages
  React.useEffect(() => {
    const channel = supabase
      .channel(`conversation-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            // Add new message
            const newMsg = payload.new as any
            setMessages(prev => {
              // Check if message already exists
              if (prev.some(m => m.id === newMsg.id)) return prev
              return [...prev, {
                id: newMsg.id,
                conversationId: newMsg.conversation_id,
                senderId: newMsg.sender_id,
                content: newMsg.content,
                linkType: newMsg.link_type,
                linkId: newMsg.link_id,
                linkUrl: newMsg.link_url,
                linkPreview: newMsg.link_preview,
                replyToId: newMsg.reply_to_id,
                createdAt: newMsg.created_at,
                updatedAt: newMsg.updated_at,
                deletedAt: newMsg.deleted_at,
                editedAt: newMsg.edited_at,
                readAt: newMsg.read_at,
                reactions: []
              }]
            })
            // Mark as read if from other user
            if (newMsg.sender_id !== currentUserId) {
              markMessagesAsRead(conversationId).catch(() => {})
            }
          } else if (payload.eventType === 'UPDATE') {
            // Update existing message
            const updated = payload.new as any
            setMessages(prev => prev.map(m => 
              m.id === updated.id 
                ? { ...m, content: updated.content, editedAt: updated.edited_at, deletedAt: updated.deleted_at }
                : m
            ))
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions'
        },
        () => {
          // Reload messages to get updated reactions
          loadMessages()
        }
      )
      .subscribe()
    
    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, currentUserId, loadMessages])
  
  // Handle sending message
  const handleSend = async () => {
    const content = newMessage.trim()
    if (!content && !pendingLink) return
    
    setSending(true)
    setError(null)
    
    try {
      const msg = await sendMessage({
        conversationId,
        content: content || (pendingLink ? t('messages.sharedLink', { defaultValue: 'Shared a link' }) : ''),
        linkType: pendingLink?.type,
        linkId: pendingLink?.id,
        linkUrl: pendingLink?.url,
        linkPreview: pendingLink?.preview,
        replyToId: replyingTo?.id
      })
      
      // Add message to list optimistically
      setMessages(prev => [...prev, {
        ...msg,
        sender: {
          id: currentUserId,
          displayName: currentUserDisplayName,
          avatarUrl: null
        }
      }])
      
      // Clear input
      setNewMessage('')
      setReplyingTo(null)
      setPendingLink(null)
      
      // Send push notification to recipient
      sendMessagePushNotification(
        otherUser.id,
        currentUserDisplayName || 'Someone',
        content.slice(0, 50),
        conversationId
      ).catch(() => {})
    } catch (e: any) {
      console.error('[conversation] Failed to send message:', e)
      setError(e?.message || 'Failed to send message')
    } finally {
      setSending(false)
    }
  }
  
  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }
  
  // Handle reaction toggle
  const handleReaction = async (messageId: string, emoji: string) => {
    try {
      await toggleReaction(messageId, emoji)
      loadMessages()
    } catch (e: any) {
      console.error('[conversation] Failed to toggle reaction:', e)
    }
  }
  
  // Handle message edit
  const handleEdit = async (messageId: string, newContent: string) => {
    try {
      await editMessage(messageId, newContent)
      setMessages(prev => prev.map(m => 
        m.id === messageId 
          ? { ...m, content: newContent, editedAt: new Date().toISOString() }
          : m
      ))
    } catch (e: any) {
      console.error('[conversation] Failed to edit message:', e)
    }
  }
  
  // Handle message delete
  const handleDelete = async (messageId: string) => {
    try {
      await deleteMessage(messageId)
      setMessages(prev => prev.map(m => 
        m.id === messageId 
          ? { ...m, deletedAt: new Date().toISOString() }
          : m
      ))
    } catch (e: any) {
      console.error('[conversation] Failed to delete message:', e)
    }
  }
  
  // Handle link share
  const handleLinkShare = (link: { type: LinkType; id: string; url: string; preview?: LinkPreview }) => {
    setPendingLink(link)
    setLinkShareOpen(false)
    textareaRef.current?.focus()
  }
  
  // Group messages by date
  const groupedMessages = React.useMemo(() => {
    const groups: { date: string; messages: Message[] }[] = []
    let currentDate = ''
    
    messages.forEach(msg => {
      const msgDate = new Date(msg.createdAt).toLocaleDateString()
      if (msgDate !== currentDate) {
        currentDate = msgDate
        groups.push({ date: msgDate, messages: [] })
      }
      groups[groups.length - 1].messages.push(msg)
    })
    
    return groups
  }, [messages])
  
  return (
    <div className="max-w-4xl mx-auto mt-8 px-4 md:px-0 pb-16 flex flex-col h-[calc(100vh-12rem)]">
      {/* Header */}
      <div className="flex items-center gap-4 pb-4 border-b border-stone-200 dark:border-[#3e3e42]">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-2xl"
          onClick={onBack}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        
        <button
          onClick={() => navigate(`/u/${encodeURIComponent(otherUser.displayName || '')}`)}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          {otherUser.avatarUrl ? (
            <img
              src={otherUser.avatarUrl}
              alt=""
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-stone-200 dark:bg-[#3e3e42] flex items-center justify-center">
              <User className="h-5 w-5 text-stone-500 dark:text-stone-400" />
            </div>
          )}
          <div className="text-left">
            <h2 className="font-semibold text-black dark:text-white">
              {otherUser.displayName || t('messages.unknownUser', { defaultValue: 'Unknown User' })}
            </h2>
          </div>
        </button>
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-stone-500 dark:text-stone-400">
              {t('messages.startChatting', { 
                defaultValue: 'Start the conversation! Say hello 👋',
                name: otherUser.displayName 
              })}
            </p>
          </div>
        ) : (
          groupedMessages.map((group, groupIdx) => (
            <div key={groupIdx}>
              {/* Date separator */}
              <div className="flex items-center justify-center my-4">
                <span className="text-xs text-stone-400 dark:text-stone-500 bg-stone-100 dark:bg-[#2a2a2d] px-3 py-1 rounded-full">
                  {group.date}
                </span>
              </div>
              
              {/* Messages */}
              {group.messages.map((message, msgIdx) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isOwn={message.senderId === currentUserId}
                  showAvatar={
                    msgIdx === 0 || 
                    group.messages[msgIdx - 1]?.senderId !== message.senderId
                  }
                  otherUser={otherUser}
                  onReply={() => {
                    setReplyingTo(message)
                    textareaRef.current?.focus()
                  }}
                  onReaction={(emoji) => handleReaction(message.id, emoji)}
                  onEdit={(newContent) => handleEdit(message.id, newContent)}
                  onDelete={() => handleDelete(message.id)}
                  currentUserId={currentUserId}
                />
              ))}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Error */}
      {error && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl border border-red-200 dark:border-red-800 mb-4">
          {error}
        </div>
      )}
      
      {/* Reply preview */}
      {replyingTo && (
        <div className="flex items-center gap-2 p-3 bg-stone-100 dark:bg-[#2a2a2d] rounded-t-xl border-b-0">
          <Reply className="h-4 w-4 text-stone-400" />
          <div className="flex-1 min-w-0">
            <span className="text-xs text-stone-400">
              {t('messages.replyingTo', { defaultValue: 'Replying to' })} {replyingTo.sender?.displayName || t('messages.unknownUser')}
            </span>
            <p className="text-sm text-stone-600 dark:text-stone-300 truncate">
              {replyingTo.content}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setReplyingTo(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      
      {/* Pending link preview */}
      {pendingLink && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-t-xl border-b-0">
          <LinkIcon className="h-4 w-4 text-blue-500" />
          <div className="flex-1 min-w-0">
            <span className="text-xs text-blue-500">
              {t('messages.sharingLink', { defaultValue: 'Sharing link' })}
            </span>
            <p className="text-sm text-blue-600 dark:text-blue-300 truncate">
              {pendingLink.preview?.title || pendingLink.url}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setPendingLink(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      
      {/* Input */}
      <div className={cn(
        'flex items-end gap-2 p-3 bg-white dark:bg-[#1f1f1f] border border-stone-200 dark:border-[#3e3e42]',
        replyingTo || pendingLink ? 'rounded-b-2xl' : 'rounded-2xl'
      )}>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-xl flex-shrink-0"
          onClick={() => setLinkShareOpen(true)}
        >
          <LinkIcon className="h-5 w-5" />
        </Button>
        
        <Textarea
          ref={textareaRef}
          placeholder={t('messages.typePlaceholder', { defaultValue: 'Type a message...' })}
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          className="min-h-[40px] max-h-[120px] resize-none border-0 focus-visible:ring-0 p-0"
          rows={1}
        />
        
        <Button
          variant="default"
          size="icon"
          className="rounded-xl flex-shrink-0"
          onClick={handleSend}
          disabled={sending || (!newMessage.trim() && !pendingLink)}
        >
          {sending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </Button>
      </div>
      
      {/* Link Share Dialog */}
      <LinkShareDialog
        open={linkShareOpen}
        onOpenChange={setLinkShareOpen}
        onShare={handleLinkShare}
      />
    </div>
  )
}
