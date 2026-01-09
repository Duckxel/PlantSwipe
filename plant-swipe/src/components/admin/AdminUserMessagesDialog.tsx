/**
 * AdminUserMessagesDialog Component
 * 
 * A dialog that shows a user's messages from their perspective,
 * allowing admins to browse conversations and messages for moderation.
 */

import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  MessageCircle,
  ArrowLeft,
  Loader2,
  Search,
  ChevronRight,
  AlertTriangle,
  Link as LinkIcon,
  Reply,
  Edit2,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabaseClient'

// Types for admin message viewing
interface AdminConversation {
  id: string
  participant1: string
  participant2: string
  participant1Name: string | null
  participant1Avatar: string | null
  participant2Name: string | null
  participant2Avatar: string | null
  createdAt: string
  lastMessageAt: string | null
  messageCount?: number
}

interface AdminMessageReaction {
  id: string
  userId: string
  userName: string | null
  emoji: string
  createdAt: string
}

interface AdminMessage {
  id: string
  conversationId: string
  senderId: string
  senderName: string | null
  senderAvatar: string | null
  content: string
  linkType: string | null
  linkUrl: string | null
  linkPreview: any | null
  replyToId: string | null
  replyTo: {
    id: string
    senderId: string
    senderName: string | null
    content: string
    createdAt: string
  } | null
  createdAt: string
  editedAt: string | null
  deletedAt: string | null
  readAt: string | null
  reactions: AdminMessageReaction[]
}

interface AdminUserMessagesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  userName: string | null
}

export const AdminUserMessagesDialog: React.FC<AdminUserMessagesDialogProps> = ({
  open,
  onOpenChange,
  userId,
  userName,
}) => {
  // State
  const [view, setView] = React.useState<'list' | 'conversation'>('list')
  const [conversations, setConversations] = React.useState<AdminConversation[]>([])
  const [conversationsLoading, setConversationsLoading] = React.useState(false)
  const [selectedConversation, setSelectedConversation] = React.useState<AdminConversation | null>(null)
  const [messages, setMessages] = React.useState<AdminMessage[]>([])
  const [messagesLoading, setMessagesLoading] = React.useState(false)
  const [hasMoreMessages, setHasMoreMessages] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')
  
  const messagesEndRef = React.useRef<HTMLDivElement>(null)
  const messagesContainerRef = React.useRef<HTMLDivElement>(null)

  // Load conversations when dialog opens
  React.useEffect(() => {
    if (open && userId) {
      loadConversations()
    } else {
      // Reset state when closing
      setView('list')
      setConversations([])
      setSelectedConversation(null)
      setMessages([])
      setSearchQuery('')
    }
  }, [open, userId])

  // Scroll to bottom when messages load
  React.useEffect(() => {
    if (messages.length > 0 && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'instant' })
    }
  }, [messages])

  const loadConversations = async () => {
    if (!userId) return
    setConversationsLoading(true)
    try {
      const session = (await supabase.auth.getSession()).data.session
      const token = session?.access_token
      const headers: Record<string, string> = { Accept: 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`
      try {
        const adminToken = (globalThis as any)?.__ENV__?.VITE_ADMIN_STATIC_TOKEN
        if (adminToken) headers['X-Admin-Token'] = String(adminToken)
      } catch {}
      
      const resp = await fetch(
        `/api/admin/member-messages?userId=${encodeURIComponent(userId)}&limit=200`,
        { headers, credentials: 'same-origin' }
      )
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error || 'Failed to load conversations')
      
      setConversations(data?.conversations || [])
    } catch (e) {
      console.error('Failed to load conversations:', e)
    } finally {
      setConversationsLoading(false)
    }
  }

  const loadConversationMessages = async (conversationId: string, before?: string) => {
    setMessagesLoading(true)
    try {
      const session = (await supabase.auth.getSession()).data.session
      const token = session?.access_token
      const headers: Record<string, string> = { Accept: 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`
      try {
        const adminToken = (globalThis as any)?.__ENV__?.VITE_ADMIN_STATIC_TOKEN
        if (adminToken) headers['X-Admin-Token'] = String(adminToken)
      } catch {}
      
      let url = `/api/admin/conversation-messages?conversationId=${encodeURIComponent(conversationId)}&limit=100`
      if (before) url += `&before=${encodeURIComponent(before)}`
      
      const resp = await fetch(url, { headers, credentials: 'same-origin' })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error || 'Failed to load messages')
      
      const newMessages = data?.messages || []
      if (before) {
        // Prepend older messages
        setMessages(prev => [...newMessages, ...prev])
      } else {
        setMessages(newMessages)
      }
      setHasMoreMessages(data?.hasMore || false)
      
      // Update conversation details if available
      if (data?.conversation) {
        setSelectedConversation(data.conversation)
      }
    } catch (e) {
      console.error('Failed to load messages:', e)
    } finally {
      setMessagesLoading(false)
    }
  }

  const handleSelectConversation = (conv: AdminConversation) => {
    setSelectedConversation(conv)
    setMessages([])
    setView('conversation')
    loadConversationMessages(conv.id)
  }

  const handleBack = () => {
    setView('list')
    setSelectedConversation(null)
    setMessages([])
  }

  const handleLoadMore = () => {
    if (selectedConversation && messages.length > 0) {
      loadConversationMessages(selectedConversation.id, messages[0].id)
    }
  }

  // Get the other participant info relative to the viewed user
  const getOtherParticipant = (conv: AdminConversation) => {
    if (conv.participant1 === userId) {
      return {
        id: conv.participant2,
        name: conv.participant2Name,
        avatar: conv.participant2Avatar,
      }
    }
    return {
      id: conv.participant1,
      name: conv.participant1Name,
      avatar: conv.participant1Avatar,
    }
  }

  // Filter conversations by search
  const filteredConversations = React.useMemo(() => {
    if (!searchQuery.trim()) return conversations
    const q = searchQuery.toLowerCase()
    return conversations.filter(conv => {
      const other = getOtherParticipant(conv)
      return other.name?.toLowerCase().includes(q)
    })
  }, [conversations, searchQuery, userId])

  // Format relative time
  const formatRelativeTime = (dateStr?: string | null) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    
    if (diffMins < 1) return 'now'
    if (diffMins < 60) return `${diffMins}m`
    if (diffHours < 24) return `${diffHours}h`
    if (diffDays < 7) return `${diffDays}d`
    
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  // Format message time
  const formatMessageTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  }

  // Check if message is an image
  const isImageMessage = (content: string) => content.startsWith('[image:')
  const parseImageUrl = (content: string) => content.match(/\[image:(.*?)\]/)?.[1] || ''

  // Group messages by date
  const groupedMessages = React.useMemo(() => {
    const groups: { date: string; messages: AdminMessage[] }[] = []
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

  // Format date separator
  const formatDateSeparator = (dateStr: string) => {
    const date = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    if (date.toDateString() === today.toDateString()) return 'Today'
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] p-0 flex flex-col overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-4 py-3 border-b flex-shrink-0">
          <div className="flex items-center gap-3">
            {view === 'conversation' && (
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full h-9 w-9"
                onClick={handleBack}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg font-semibold flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-blue-600" />
                {view === 'list' ? (
                  <>Messages for {userName || 'User'}</>
                ) : selectedConversation ? (
                  <>
                    <span className="truncate">
                      Chat with {getOtherParticipant(selectedConversation).name || 'Unknown'}
                    </span>
                  </>
                ) : (
                  'Loading...'
                )}
              </DialogTitle>
              <p className="text-xs text-stone-500 mt-0.5">
                Admin view — Viewing as {userName || 'user'}
              </p>
            </div>
            {view === 'list' && (
              <Badge variant="secondary" className="rounded-full">
                {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {view === 'list' ? (
            // Conversations List View
            <div className="h-full flex flex-col">
              {/* Search */}
              <div className="px-4 py-3 border-b">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                  <input
                    type="text"
                    placeholder="Search conversations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-xl bg-stone-100 dark:bg-[#2a2a2d] border-0 focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>

              {/* Conversations List */}
              <div className="flex-1 overflow-y-auto">
                {conversationsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                    <span className="ml-2 text-sm text-stone-500">Loading conversations...</span>
                  </div>
                ) : filteredConversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                    <div className="w-16 h-16 rounded-full bg-stone-100 dark:bg-[#2a2a2d] flex items-center justify-center mb-4">
                      <MessageCircle className="h-8 w-8 text-stone-400" />
                    </div>
                    <p className="text-stone-500">
                      {searchQuery ? 'No matching conversations' : 'No conversations found'}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-stone-100 dark:divide-[#2a2a2d]">
                    {filteredConversations.map((conv) => {
                      const other = getOtherParticipant(conv)
                      return (
                        <button
                          key={conv.id}
                          onClick={() => handleSelectConversation(conv)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-stone-50 dark:hover:bg-[#1a1a1c] transition-colors text-left"
                        >
                          {/* Avatar */}
                          <div className="flex-shrink-0">
                            {other.avatar ? (
                              <img
                                src={other.avatar}
                                alt=""
                                className="w-12 h-12 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-lg font-semibold">
                                {(other.name || 'U').charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-0.5">
                              <span className="font-semibold text-stone-900 dark:text-white truncate">
                                {other.name || 'Unknown User'}
                              </span>
                              <span className="text-xs text-stone-400 flex-shrink-0">
                                {formatRelativeTime(conv.lastMessageAt)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-stone-500">
                              <span>{conv.messageCount || 0} messages</span>
                              <span>•</span>
                              <span>Started {formatRelativeTime(conv.createdAt)}</span>
                            </div>
                          </div>
                          
                          <ChevronRight className="h-5 w-5 text-stone-300 flex-shrink-0" />
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            // Conversation View
            <div className="h-full flex flex-col">
              {/* Messages Container */}
              <div
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto px-4 py-4"
              >
                {messagesLoading && messages.length === 0 ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                    <span className="ml-2 text-sm text-stone-500">Loading messages...</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <MessageCircle className="h-12 w-12 text-stone-300 mb-4" />
                    <p className="text-stone-500">No messages in this conversation</p>
                  </div>
                ) : (
                  <>
                    {/* Load more button */}
                    {hasMoreMessages && (
                      <div className="flex justify-center py-2 mb-4">
                        <button
                          onClick={handleLoadMore}
                          disabled={messagesLoading}
                          className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                        >
                          {messagesLoading ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            'Load earlier messages'
                          )}
                        </button>
                      </div>
                    )}

                    {/* Messages grouped by date */}
                    {groupedMessages.map((group, groupIdx) => (
                      <div key={groupIdx}>
                        {/* Date separator */}
                        <div className="flex items-center justify-center my-4">
                          <span className="text-xs font-medium text-stone-400 bg-stone-100 dark:bg-[#2a2a2d] px-3 py-1.5 rounded-full">
                            {formatDateSeparator(group.date)}
                          </span>
                        </div>

                        {/* Messages */}
                        <div className="space-y-2">
                          {group.messages.map((msg, msgIdx) => {
                            const isOwnMessage = msg.senderId === userId
                            const showAvatar = msgIdx === 0 || group.messages[msgIdx - 1]?.senderId !== msg.senderId
                            
                            return (
                              <div
                                key={msg.id}
                                className={cn(
                                  "flex gap-2",
                                  isOwnMessage ? "flex-row-reverse" : "flex-row"
                                )}
                              >
                                {/* Avatar */}
                                <div className="w-8 flex-shrink-0">
                                  {showAvatar && !isOwnMessage && (
                                    msg.senderAvatar ? (
                                      <img
                                        src={msg.senderAvatar}
                                        alt=""
                                        className="w-8 h-8 rounded-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-stone-300 to-stone-400 flex items-center justify-center text-white text-xs font-semibold">
                                        {(msg.senderName || 'U').charAt(0).toUpperCase()}
                                      </div>
                                    )
                                  )}
                                </div>

                                {/* Message bubble */}
                                <div
                                  className={cn(
                                    "max-w-[70%] rounded-2xl px-4 py-2",
                                    isOwnMessage
                                      ? "bg-blue-500 text-white"
                                      : "bg-stone-100 dark:bg-[#2a2a2d] text-stone-900 dark:text-white",
                                    msg.deletedAt && "opacity-60"
                                  )}
                                >
                                  {/* Reply preview */}
                                  {msg.replyTo && (
                                    <div className={cn(
                                      "text-xs mb-2 pb-2 border-b",
                                      isOwnMessage ? "border-blue-400/30" : "border-stone-200 dark:border-stone-600"
                                    )}>
                                      <div className="flex items-center gap-1 mb-0.5">
                                        <Reply className="h-3 w-3" />
                                        <span className="font-medium">{msg.replyTo.senderName || 'Unknown'}</span>
                                      </div>
                                      <p className="truncate opacity-75">
                                        {isImageMessage(msg.replyTo.content) ? '📷 Photo' : msg.replyTo.content}
                                      </p>
                                    </div>
                                  )}

                                  {/* Content */}
                                  {msg.deletedAt ? (
                                    <p className="italic text-sm flex items-center gap-1">
                                      <Trash2 className="h-3 w-3" />
                                      Message deleted
                                    </p>
                                  ) : isImageMessage(msg.content) ? (
                                    <div>
                                      <img
                                        src={parseImageUrl(msg.content)}
                                        alt="Shared image"
                                        className="max-w-full rounded-lg cursor-pointer hover:opacity-90"
                                        onClick={() => window.open(parseImageUrl(msg.content), '_blank')}
                                      />
                                      {/* Caption if any */}
                                      {msg.content.includes(']') && msg.content.split(']')[1]?.trim() && (
                                        <p className="mt-2 text-sm whitespace-pre-wrap break-words">
                                          {msg.content.split(']')[1].trim()}
                                        </p>
                                      )}
                                    </div>
                                  ) : (
                                    <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                                  )}

                                  {/* Link preview */}
                                  {msg.linkType && msg.linkUrl && (
                                    <a
                                      href={msg.linkUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className={cn(
                                        "mt-2 flex items-center gap-2 text-xs rounded-lg p-2",
                                        isOwnMessage ? "bg-blue-600/50" : "bg-stone-200 dark:bg-stone-700"
                                      )}
                                    >
                                      <LinkIcon className="h-3 w-3" />
                                      <span className="truncate">{msg.linkUrl}</span>
                                    </a>
                                  )}

                                  {/* Reactions */}
                                  {msg.reactions && msg.reactions.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                      {msg.reactions.map((r) => (
                                        <span
                                          key={r.id}
                                          className={cn(
                                            "inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full",
                                            isOwnMessage ? "bg-blue-600/50" : "bg-stone-200 dark:bg-stone-600"
                                          )}
                                          title={r.userName || 'Unknown'}
                                        >
                                          {r.emoji}
                                        </span>
                                      ))}
                                    </div>
                                  )}

                                  {/* Metadata */}
                                  <div className={cn(
                                    "flex items-center gap-2 mt-1 text-[10px]",
                                    isOwnMessage ? "text-blue-200" : "text-stone-400"
                                  )}>
                                    <span>{formatMessageTime(msg.createdAt)}</span>
                                    {msg.editedAt && (
                                      <span className="flex items-center gap-0.5">
                                        <Edit2 className="h-2.5 w-2.5" /> edited
                                      </span>
                                    )}
                                    {msg.readAt && isOwnMessage && (
                                      <span>Read</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Admin notice footer */}
              <div className="px-4 py-3 border-t bg-amber-50 dark:bg-amber-900/20">
                <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Read-only admin view. Messages shown from {userName || 'user'}'s perspective.</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default AdminUserMessagesDialog
