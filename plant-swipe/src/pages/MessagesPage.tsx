/**
 * MessagesPage Component
 * 
 * Mobile-first messaging interface with conversation list and chat views.
 * Inspired by iMessage and Messenger for a professional UX.
 */

import React from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { 
  MessageCircle, 
  Loader2,
  BellOff,
  Plus,
  Search,
  Edit3
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getUserConversations } from '@/lib/messaging'
import { supabase } from '@/lib/supabaseClient'
import type { ConversationWithDetails } from '@/types/messaging'
import { ConversationView } from '@/components/messaging/ConversationView'
import { NewConversationDialog } from '@/components/messaging/NewConversationDialog'

export const MessagesPage: React.FC = () => {
  const { t } = useTranslation('common')
  const { user, profile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  
  const [conversations, setConversations] = React.useState<ConversationWithDetails[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [selectedConversationId, setSelectedConversationId] = React.useState<string | null>(null)
  const [newConversationOpen, setNewConversationOpen] = React.useState(false)
  const [isSearching, setIsSearching] = React.useState(false)
  
  // Handle conversation query parameter from push notifications
  React.useEffect(() => {
    const conversationParam = searchParams.get('conversation')
    if (conversationParam && !loading && conversations.length > 0) {
      // Check if this conversation exists in our list
      const exists = conversations.some(c => c.conversationId === conversationParam)
      if (exists) {
        setSelectedConversationId(conversationParam)
        // Clear the query param after opening
        setSearchParams({}, { replace: true })
      }
    }
  }, [searchParams, loading, conversations, setSearchParams])
  
  // Get the selected conversation details
  const selectedConversation = React.useMemo(() => {
    return conversations.find(c => c.conversationId === selectedConversationId) || null
  }, [conversations, selectedConversationId])
  
  // Load conversations
  const loadConversations = React.useCallback(async () => {
    if (!user?.id) return
    try {
      setError(null)
      const data = await getUserConversations()
      setConversations(data)
    } catch (e: any) {
      console.error('[messages] Failed to load conversations:', e)
      setError(e?.message || t('messages.errors.failedToLoad', { defaultValue: 'Failed to load conversations' }))
    } finally {
      setLoading(false)
    }
  }, [user?.id, t])
  
  React.useEffect(() => {
    loadConversations()
  }, [loadConversations])
  
  // Realtime subscription for new messages
  React.useEffect(() => {
    if (!user?.id) return
    
    let isSubscribed = true
    
    const channel = supabase
      .channel(`messages-list-${user.id}`, {
        config: {
          broadcast: { self: true }
        }
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        () => {
          if (isSubscribed) {
            console.log('[realtime] New message received, reloading conversations')
            loadConversations()
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages'
        },
        () => {
          if (isSubscribed) {
            console.log('[realtime] Message updated, reloading conversations')
            loadConversations()
          }
        }
      )
      .on('broadcast', { event: 'conversation_update' }, () => {
        if (isSubscribed) {
          console.log('[realtime] Broadcast received, reloading conversations')
          loadConversations()
        }
      })
    
    channel.subscribe((status) => {
      console.log('[realtime] Messages list subscription status:', status)
      if (status === 'CHANNEL_ERROR' && isSubscribed) {
        // Reload on error as fallback
        loadConversations()
      }
    })
    
    return () => {
      isSubscribed = false
      supabase.removeChannel(channel)
    }
  }, [user?.id, loadConversations])
  
  // Filter conversations by search query
  const filteredConversations = React.useMemo(() => {
    if (!searchQuery.trim()) return conversations
    const query = searchQuery.toLowerCase()
    return conversations.filter(c => 
      c.otherUserDisplayName?.toLowerCase().includes(query) ||
      c.lastMessageContent?.toLowerCase().includes(query)
    )
  }, [conversations, searchQuery])
  
  // Handle starting a new conversation
  const handleNewConversation = (conversationId: string) => {
    setNewConversationOpen(false)
    setSelectedConversationId(conversationId)
    loadConversations()
  }
  
  // Format relative time
  const formatRelativeTime = (dateStr?: string | null) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    
    if (diffMins < 1) return t('messages.time.now', { defaultValue: 'now' })
    if (diffMins < 60) return `${diffMins}m`
    if (diffHours < 24) return `${diffHours}h`
    if (diffDays < 7) return `${diffDays}d`
    
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }
  
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <div className="w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
          <MessageCircle className="h-10 w-10 text-blue-600 dark:text-blue-400" />
        </div>
        <h2 className="text-xl font-semibold text-stone-900 dark:text-white mb-2">
          {t('messages.signInTitle', { defaultValue: 'Sign in to Messages' })}
        </h2>
        <p className="text-stone-500 dark:text-stone-400 max-w-sm">
          {t('messages.pleaseLogin', { defaultValue: 'Please log in to view your messages and chat with friends.' })}
        </p>
      </div>
    )
  }
  
  // If a conversation is selected, show the conversation view
  if (selectedConversationId && selectedConversation) {
    return (
      <ConversationView
        conversationId={selectedConversationId}
        otherUser={{
          id: selectedConversation.otherUserId,
          displayName: selectedConversation.otherUserDisplayName,
          avatarUrl: selectedConversation.otherUserAvatarUrl
        }}
        onBack={() => {
          setSelectedConversationId(null)
          loadConversations()
        }}
        currentUserId={user.id}
        currentUserDisplayName={profile?.display_name || null}
      />
    )
  }
  
  return (
    <div className="fixed inset-0 md:relative md:inset-auto flex flex-col bg-white dark:bg-[#0f0f10] md:bg-transparent md:dark:bg-transparent md:max-w-4xl md:mx-auto md:mt-8 md:px-4 md:pb-16">
      {/* Header */}
      <header className="flex-shrink-0 px-4 pt-4 pb-2 md:px-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-stone-900 dark:text-white">
            {t('messages.title', { defaultValue: 'Messages' })}
          </h1>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full h-10 w-10 bg-stone-100 dark:bg-[#2a2a2d]"
            onClick={() => setNewConversationOpen(true)}
          >
            <Edit3 className="h-5 w-5" />
          </Button>
        </div>
        
        {/* Search */}
        <div className="relative">
          <div className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl bg-stone-100 dark:bg-[#2a2a2d] transition-all",
            isSearching && "ring-2 ring-blue-500"
          )}>
            <Search className="h-5 w-5 text-stone-400 flex-shrink-0" />
            <input
              type="text"
              placeholder={t('messages.searchPlaceholder', { defaultValue: 'Search' })}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearching(true)}
              onBlur={() => setIsSearching(false)}
              className="flex-1 bg-transparent border-0 focus:ring-0 focus:outline-none text-stone-900 dark:text-white placeholder:text-stone-400 text-[16px]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </header>
      
      {/* Error */}
      {error && (
        <div className="mx-4 mb-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl border border-red-200 dark:border-red-800">
          {error}
        </div>
      )}
      
      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-stone-300 dark:text-stone-600" />
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-20 h-20 rounded-full bg-stone-100 dark:bg-[#2a2a2d] flex items-center justify-center mb-4">
              <MessageCircle className="h-10 w-10 text-stone-400" />
            </div>
            <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-2">
              {searchQuery 
                ? t('messages.noSearchResults', { defaultValue: 'No conversations found' })
                : t('messages.noConversations', { defaultValue: 'No messages yet' })
              }
            </h3>
            <p className="text-sm text-stone-500 dark:text-stone-400 mb-6 max-w-xs">
              {searchQuery 
                ? t('messages.tryDifferentSearch', { defaultValue: 'Try searching for a different name' })
                : t('messages.startChatHint', { defaultValue: 'Start a conversation with your friends' })
              }
            </p>
            {!searchQuery && (
              <Button
                onClick={() => setNewConversationOpen(true)}
                className="rounded-full px-6"
              >
                <Plus className="h-4 w-4 mr-2" />
                {t('messages.newMessage', { defaultValue: 'New Message' })}
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-stone-100 dark:divide-[#2a2a2d]">
            {filteredConversations.map((conversation) => (
              <button
                key={conversation.conversationId}
                onClick={() => setSelectedConversationId(conversation.conversationId)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 hover:bg-stone-50 dark:hover:bg-[#1a1a1c] active:bg-stone-100 dark:active:bg-[#2a2a2d] transition-colors text-left',
                  conversation.unreadCount > 0 && 'bg-blue-50/50 dark:bg-blue-900/10'
                )}
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  {conversation.otherUserAvatarUrl ? (
                    <img
                      src={conversation.otherUserAvatarUrl}
                      alt=""
                      className="w-14 h-14 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xl font-semibold">
                      {(conversation.otherUserDisplayName || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                  {/* Unread indicator dot */}
                  {conversation.unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 h-5 min-w-5 px-1.5 rounded-full bg-blue-500 text-white text-[11px] font-semibold flex items-center justify-center shadow-sm">
                      {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                    </span>
                  )}
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0 py-0.5">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className={cn(
                      'font-semibold truncate',
                      conversation.unreadCount > 0 
                        ? 'text-stone-900 dark:text-white' 
                        : 'text-stone-700 dark:text-stone-200'
                    )}>
                      {conversation.otherUserDisplayName || t('messages.unknownUser', { defaultValue: 'Unknown User' })}
                    </span>
                    <span className={cn(
                      'text-xs flex-shrink-0',
                      conversation.unreadCount > 0 
                        ? 'text-blue-600 dark:text-blue-400 font-medium'
                        : 'text-stone-400 dark:text-stone-500'
                    )}>
                      {formatRelativeTime(conversation.lastMessageAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {conversation.lastMessageSenderId === user.id && (
                      <span className="text-stone-400 dark:text-stone-500 text-sm">
                        {t('messages.you', { defaultValue: 'You:' })}
                      </span>
                    )}
                    <p className={cn(
                      'text-sm truncate flex-1',
                      conversation.unreadCount > 0
                        ? 'text-stone-700 dark:text-stone-200 font-medium'
                        : 'text-stone-500 dark:text-stone-400'
                    )}>
                      {conversation.lastMessageContent?.startsWith('[image:') 
                        ? '📷 ' + t('messages.photo', { defaultValue: 'Photo' })
                        : conversation.lastMessageContent || t('messages.noMessagesYet', { defaultValue: 'No messages yet' })
                      }
                    </p>
                    
                    {/* Mute indicator */}
                    {conversation.isMuted && (
                      <BellOff className="h-4 w-4 text-stone-400 flex-shrink-0" />
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      
      {/* Floating action button (mobile) */}
      <div className="md:hidden fixed bottom-24 right-4">
        <Button
          size="lg"
          className="h-14 w-14 rounded-full shadow-lg bg-blue-500 hover:bg-blue-600"
          onClick={() => setNewConversationOpen(true)}
        >
          <Edit3 className="h-6 w-6" />
        </Button>
      </div>
      
      {/* New Conversation Dialog */}
      <NewConversationDialog
        open={newConversationOpen}
        onOpenChange={setNewConversationOpen}
        onConversationCreated={handleNewConversation}
        currentUserId={user.id}
      />
    </div>
  )
}

export default MessagesPage
