/**
 * ConversationView Component
 * 
 * A mobile-first conversation view with iMessage-like UX.
 * Features: real-time messages, replies, reactions, image sending.
 */

import React from 'react'
import { useTranslation } from 'react-i18next'
import { useLanguageNavigate } from '@/lib/i18nRouting'
import { Button } from '@/components/ui/button'
import { 
  ArrowLeft, 
  Send, 
  Loader2, 
  Link as LinkIcon,
  X,
  Image as ImageIcon,
  Plus
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { 
  getConversationMessages,
  sendMessage,
  markMessagesAsRead,
  editMessage,
  deleteMessage,
  toggleReaction,
  sendMessagePushNotification,
  uploadMessageImage,
  sendImageMessage,
  isImageMessage
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
  const [showAttachMenu, setShowAttachMenu] = React.useState(false)
  const [uploadingImage, setUploadingImage] = React.useState(false)
  const [pendingLink, setPendingLink] = React.useState<{
    type: LinkType
    id: string
    url: string
    preview?: LinkPreview
  } | null>(null)
  
  const messagesEndRef = React.useRef<HTMLDivElement>(null)
  const messagesContainerRef = React.useRef<HTMLDivElement>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const attachMenuRef = React.useRef<HTMLDivElement>(null)
  
  // Auto-resize textarea
  const adjustTextareaHeight = React.useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
  }, [])
  
  // Load messages
  const loadMessages = React.useCallback(async () => {
    try {
      setError(null)
      const data = await getConversationMessages(conversationId)
      setMessages(data)
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
  
  // Close attach menu on outside click
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setShowAttachMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
  // Realtime subscription for new messages and reactions
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
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const newMsg = payload.new as any
            // Skip if we already have this message (we added it optimistically)
            setMessages(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev
              
              // For messages from others, add with sender info
              const messageToAdd: Message = {
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
                reactions: [],
                // Add sender info for messages from the other user
                sender: newMsg.sender_id !== currentUserId ? {
                  id: otherUser.id,
                  displayName: otherUser.displayName,
                  avatarUrl: otherUser.avatarUrl || null
                } : undefined
              }
              return [...prev, messageToAdd]
            })
            if (newMsg.sender_id !== currentUserId) {
              markMessagesAsRead(conversationId).catch(() => {})
            }
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as any
            setMessages(prev => prev.map(m => 
              m.id === updated.id 
                ? { ...m, content: updated.content, editedAt: updated.edited_at, deletedAt: updated.deleted_at }
                : m
            ))
          } else if (payload.eventType === 'DELETE') {
            const deleted = payload.old as any
            setMessages(prev => prev.filter(m => m.id !== deleted.id))
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_reactions'
        },
        (payload) => {
          const reaction = payload.new as any
          setMessages(prev => prev.map(m => {
            if (m.id !== reaction.message_id) return m
            // Add reaction if not already present
            const existingReaction = m.reactions?.find(r => r.id === reaction.id)
            if (existingReaction) return m
            return {
              ...m,
              reactions: [...(m.reactions || []), {
                id: reaction.id,
                messageId: reaction.message_id,
                userId: reaction.user_id,
                emoji: reaction.emoji,
                createdAt: reaction.created_at
              }]
            }
          }))
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'message_reactions'
        },
        (payload) => {
          const deleted = payload.old as any
          setMessages(prev => prev.map(m => {
            if (m.id !== deleted.message_id) return m
            return {
              ...m,
              reactions: (m.reactions || []).filter(r => r.id !== deleted.id)
            }
          }))
        }
      )
      .subscribe()
    
    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, currentUserId, otherUser])
  
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
      
      setMessages(prev => [...prev, {
        ...msg,
        sender: {
          id: currentUserId,
          displayName: currentUserDisplayName,
          avatarUrl: null
        }
      }])
      
      setNewMessage('')
      setReplyingTo(null)
      setPendingLink(null)
      
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
      
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
  
  // Handle image upload
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    setUploadingImage(true)
    setShowAttachMenu(false)
    setError(null)
    
    try {
      const { url } = await uploadMessageImage(file)
      await sendImageMessage(conversationId, url, '', replyingTo?.id)
      
      setReplyingTo(null)
      await loadMessages()
      
      sendMessagePushNotification(
        otherUser.id,
        currentUserDisplayName || 'Someone',
        '📷 ' + t('messages.sentImage', { defaultValue: 'Sent an image' }),
        conversationId
      ).catch(() => {})
    } catch (e: any) {
      console.error('[conversation] Failed to upload image:', e)
      setError(e?.message || 'Failed to upload image')
    } finally {
      setUploadingImage(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
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
  
  // Format date for separator
  const formatDateSeparator = (dateStr: string) => {
    const date = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    if (date.toDateString() === today.toDateString()) {
      return t('messages.today', { defaultValue: 'Today' })
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return t('messages.yesterday', { defaultValue: 'Yesterday' })
    }
    return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
  }
  
  return (
    <div className="fixed inset-0 bottom-[70px] md:bottom-0 md:relative md:inset-auto flex flex-col bg-stone-50 dark:bg-[#0f0f10] md:bg-transparent md:dark:bg-transparent md:max-w-4xl md:mx-auto md:mt-8 md:px-4 md:h-[calc(100vh-12rem)]">
      {/* Header */}
      <header className="flex-shrink-0 flex items-center gap-3 px-4 py-3 bg-white/80 dark:bg-[#1a1a1c]/80 backdrop-blur-xl border-b border-stone-200/50 dark:border-[#2a2a2d]/50 md:rounded-t-2xl md:border md:border-b-0">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full h-10 w-10 -ml-2"
          onClick={onBack}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        
        <button
          onClick={() => navigate(`/u/${encodeURIComponent(otherUser.displayName || '')}`)}
          className="flex items-center gap-3 flex-1 min-w-0 active:opacity-70 transition-opacity"
        >
          {otherUser.avatarUrl ? (
            <img
              src={otherUser.avatarUrl}
              alt=""
              className="w-10 h-10 rounded-full object-cover ring-2 ring-white dark:ring-[#1a1a1c]"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold shadow-md">
              {(otherUser.displayName || 'U').charAt(0).toUpperCase()}
            </div>
          )}
          <div className="text-left min-w-0">
            <h2 className="font-semibold text-stone-900 dark:text-white truncate">
              {otherUser.displayName || t('messages.unknownUser', { defaultValue: 'Unknown User' })}
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              {t('messages.tapToViewProfile', { defaultValue: 'Tap to view profile' })}
            </p>
          </div>
        </button>
      </header>
      
      {/* Messages Container */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-1"
      >
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-stone-300 dark:text-stone-600" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-full bg-stone-100 dark:bg-[#2a2a2d] flex items-center justify-center mb-4">
              {otherUser.avatarUrl ? (
                <img src={otherUser.avatarUrl} alt="" className="w-16 h-16 rounded-full object-cover" />
              ) : (
                <span className="text-3xl font-bold text-stone-400 dark:text-stone-500">
                  {(otherUser.displayName || 'U').charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <h3 className="font-semibold text-stone-900 dark:text-white mb-1">
              {otherUser.displayName}
            </h3>
            <p className="text-sm text-stone-500 dark:text-stone-400 max-w-xs">
              {t('messages.startConversationHint', { 
                defaultValue: 'This is the beginning of your conversation. Say hello! 👋'
              })}
            </p>
          </div>
        ) : (
          groupedMessages.map((group, groupIdx) => (
            <div key={groupIdx}>
              {/* Date separator */}
              <div className="flex items-center justify-center my-4">
                <span className="text-xs font-medium text-stone-400 dark:text-stone-500 bg-stone-100 dark:bg-[#2a2a2d] px-3 py-1.5 rounded-full">
                  {formatDateSeparator(group.date)}
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
                  isLastInGroup={
                    msgIdx === group.messages.length - 1 ||
                    group.messages[msgIdx + 1]?.senderId !== message.senderId
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
        <div className="mx-4 mb-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl border border-red-200 dark:border-red-800 flex items-center gap-2">
          <X className="h-4 w-4 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-600 dark:text-red-400 hover:underline text-xs">
            {t('common.dismiss', { defaultValue: 'Dismiss' })}
          </button>
        </div>
      )}
      
      {/* Reply preview */}
      {replyingTo && (
        <div className="mx-4 flex items-center gap-3 px-4 py-3 bg-stone-100 dark:bg-[#2a2a2d] rounded-t-2xl border-b-0">
          <div className="w-1 h-10 bg-blue-500 rounded-full" />
          <div className="flex-1 min-w-0">
            <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
              {t('messages.replyingTo', { defaultValue: 'Replying to' })} {replyingTo.sender?.displayName || t('messages.unknownUser')}
            </span>
            <p className="text-sm text-stone-600 dark:text-stone-300 truncate">
              {isImageMessage(replyingTo.content) 
                ? '📷 ' + t('messages.photo', { defaultValue: 'Photo' })
                : replyingTo.content
              }
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={() => setReplyingTo(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      
      {/* Pending link preview */}
      {pendingLink && (
        <div className="mx-4 flex items-center gap-3 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 rounded-t-2xl border-b-0">
          <div className="w-1 h-10 bg-blue-500 rounded-full" />
          <div className="flex-1 min-w-0">
            <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
              {t('messages.sharingLink', { defaultValue: 'Sharing link' })}
            </span>
            <p className="text-sm text-blue-700 dark:text-blue-300 truncate">
              {pendingLink.preview?.title || pendingLink.url}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={() => setPendingLink(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      
      {/* Upload progress */}
      {uploadingImage && (
        <div className="mx-4 flex items-center gap-3 px-4 py-3 bg-stone-100 dark:bg-[#2a2a2d] rounded-t-2xl border-b-0">
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
          <span className="text-sm text-stone-600 dark:text-stone-300">
            {t('messages.uploadingImage', { defaultValue: 'Uploading image...' })}
          </span>
        </div>
      )}
      
      {/* Input Area */}
      <div className={cn(
        'flex-shrink-0 px-4 pb-4 pt-2 bg-white/80 dark:bg-[#1a1a1c]/80 backdrop-blur-xl md:border md:border-t-0 md:rounded-b-2xl',
        !replyingTo && !pendingLink && !uploadingImage && 'pt-4'
      )}>
        <div className={cn(
          'flex items-end gap-2 p-2 bg-stone-100 dark:bg-[#2a2a2d] border border-stone-200 dark:border-[#3a3a3d]',
          replyingTo || pendingLink || uploadingImage ? 'rounded-b-2xl rounded-t-none' : 'rounded-2xl'
        )}>
          {/* Attachment button */}
          <div className="relative" ref={attachMenuRef}>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-9 w-9 flex-shrink-0 text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200"
              onClick={() => setShowAttachMenu(!showAttachMenu)}
              disabled={uploadingImage}
            >
              <Plus className={cn("h-5 w-5 transition-transform", showAttachMenu && "rotate-45")} />
            </Button>
            
            {/* Attachment menu */}
            {showAttachMenu && (
              <div className="absolute bottom-full left-0 mb-2 p-2 bg-white dark:bg-[#2a2a2d] rounded-2xl shadow-xl border border-stone-200 dark:border-[#3a3a3d] flex gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-1 p-3 rounded-xl hover:bg-stone-100 dark:hover:bg-[#3a3a3d] transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <ImageIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <span className="text-xs text-stone-600 dark:text-stone-300">{t('messages.photo', { defaultValue: 'Photo' })}</span>
                </button>
                <button
                  onClick={() => {
                    setShowAttachMenu(false)
                    setLinkShareOpen(true)
                  }}
                  className="flex flex-col items-center gap-1 p-3 rounded-xl hover:bg-stone-100 dark:hover:bg-[#3a3a3d] transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <LinkIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="text-xs text-stone-600 dark:text-stone-300">{t('messages.link', { defaultValue: 'Link' })}</span>
                </button>
              </div>
            )}
          </div>
          
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageSelect}
          />
          
          {/* Text input */}
          <textarea
            ref={textareaRef}
            placeholder={t('messages.typePlaceholder', { defaultValue: 'Message...' })}
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value)
              adjustTextareaHeight()
            }}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent border-0 focus:ring-0 focus:outline-none resize-none py-2 px-1 text-stone-900 dark:text-white placeholder:text-stone-400 dark:placeholder:text-stone-500 text-[16px] leading-tight"
            rows={1}
            style={{ minHeight: '24px', maxHeight: '120px' }}
          />
          
          {/* Send button */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "rounded-full h-9 w-9 flex-shrink-0 transition-all",
              (newMessage.trim() || pendingLink)
                ? "bg-blue-500 hover:bg-blue-600 text-white"
                : "text-stone-400 dark:text-stone-500"
            )}
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
        
        {/* Safe area for iOS */}
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
