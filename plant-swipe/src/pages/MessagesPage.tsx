/**
 * MessagesPage Component
 * 
 * Displays a list of conversations and allows users to select one to view/send messages.
 */

import React from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { 
  MessageCircle, 
  User, 
  ChevronRight,
  Loader2,
  Bell,
  BellOff,
  Plus
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { 
  getUserConversations, 
  toggleConversationMute
} from '@/lib/messaging'
import { supabase } from '@/lib/supabaseClient'
import type { ConversationWithDetails } from '@/types/messaging'
import { ConversationView } from '@/components/messaging/ConversationView'
import { NewConversationDialog } from '@/components/messaging/NewConversationDialog'

const glassCard =
  'rounded-[28px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/80 dark:bg-[#1f1f1f]/80 backdrop-blur shadow-[0_25px_70px_-40px_rgba(15,23,42,0.65)]'

export const MessagesPage: React.FC = () => {
  const { t } = useTranslation('common')
  const { user, profile } = useAuth()
  
  const [conversations, setConversations] = React.useState<ConversationWithDetails[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [selectedConversationId, setSelectedConversationId] = React.useState<string | null>(null)
  const [newConversationOpen, setNewConversationOpen] = React.useState(false)
  const [togglingMute, setTogglingMute] = React.useState<string | null>(null)
  
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
    
    const channel = supabase
      .channel('messages-list')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        () => {
          // Reload conversations to update last message and unread counts
          loadConversations()
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
          loadConversations()
        }
      )
      .subscribe()
    
    return () => {
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
  
  // Handle mute toggle
  const handleToggleMute = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setTogglingMute(conversationId)
    try {
      await toggleConversationMute(conversationId)
      await loadConversations()
    } catch (e: any) {
      console.error('[messages] Failed to toggle mute:', e)
    } finally {
      setTogglingMute(null)
    }
  }
  
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
    
    if (diffMins < 1) return t('messages.time.justNow', { defaultValue: 'just now' })
    if (diffMins < 60) return t('messages.time.minutesAgo', { count: diffMins, defaultValue: '{{count}}m ago' })
    if (diffHours < 24) return t('messages.time.hoursAgo', { count: diffHours, defaultValue: '{{count}}h ago' })
    if (diffDays < 7) return t('messages.time.daysAgo', { count: diffDays, defaultValue: '{{count}}d ago' })
    
    return date.toLocaleDateString()
  }
  
  if (!user) {
    return (
      <div className="max-w-6xl mx-auto mt-8 px-4 md:px-0 pb-16 space-y-6">
        <Card className={glassCard}>
          <CardContent className="p-6 md:p-8 text-center text-sm text-stone-600 dark:text-stone-300">
            {t('messages.pleaseLogin', { defaultValue: 'Please log in to view your messages.' })}
          </CardContent>
        </Card>
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
    <div className="max-w-4xl mx-auto mt-8 px-4 md:px-0 pb-16 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <MessageCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-black dark:text-white">
              {t('messages.title', { defaultValue: 'Messages' })}
            </h1>
            <p className="text-sm text-stone-500 dark:text-stone-400">
              {t('messages.subtitle', { defaultValue: 'Chat with your friends' })}
            </p>
          </div>
        </div>
        <Button
          variant="default"
          className="rounded-2xl"
          onClick={() => setNewConversationOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          {t('messages.newMessage', { defaultValue: 'New Message' })}
        </Button>
      </div>
      
      {/* Search */}
      <div className="relative">
        <SearchInput
          placeholder={t('messages.searchPlaceholder', { defaultValue: 'Search conversations...' })}
          value={searchQuery}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
          className="rounded-2xl"
        />
      </div>
      
      {/* Error */}
      {error && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl border border-red-200 dark:border-red-800">
          {error}
        </div>
      )}
      
      {/* Conversations List */}
      <Card className={glassCard}>
        <CardContent className="p-4 md:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-stone-100 dark:bg-[#2a2a2d] flex items-center justify-center">
                <MessageCircle className="h-8 w-8 text-stone-400" />
              </div>
              <p className="text-stone-500 dark:text-stone-400 mb-4">
                {searchQuery 
                  ? t('messages.noSearchResults', { defaultValue: 'No conversations found' })
                  : t('messages.noConversations', { defaultValue: 'No messages yet' })
                }
              </p>
              {!searchQuery && (
                <Button
                  variant="default"
                  className="rounded-2xl"
                  onClick={() => setNewConversationOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t('messages.startConversation', { defaultValue: 'Start a conversation' })}
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
                    'w-full flex items-center gap-4 p-4 hover:bg-stone-50 dark:hover:bg-[#2a2a2d] transition-colors text-left',
                    conversation.unreadCount > 0 && 'bg-blue-50/50 dark:bg-blue-900/10'
                  )}
                >
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    {conversation.otherUserAvatarUrl ? (
                      <img
                        src={conversation.otherUserAvatarUrl}
                        alt=""
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-stone-200 dark:bg-[#3e3e42] flex items-center justify-center">
                        <User className="h-6 w-6 text-stone-500 dark:text-stone-400" />
                      </div>
                    )}
                    {conversation.unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-blue-500 text-white text-[10px] font-medium flex items-center justify-center">
                        {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                      </span>
                    )}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn(
                        'font-medium truncate',
                        conversation.unreadCount > 0 
                          ? 'text-black dark:text-white' 
                          : 'text-stone-700 dark:text-stone-300'
                      )}>
                        {conversation.otherUserDisplayName || t('messages.unknownUser', { defaultValue: 'Unknown User' })}
                      </span>
                      <span className="text-xs text-stone-400 dark:text-stone-500 flex-shrink-0">
                        {formatRelativeTime(conversation.lastMessageAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {conversation.lastMessageSenderId === user.id && (
                        <span className="text-xs text-stone-400 dark:text-stone-500">
                          {t('messages.you', { defaultValue: 'You:' })}
                        </span>
                      )}
                      <p className={cn(
                        'text-sm truncate',
                        conversation.unreadCount > 0
                          ? 'text-stone-700 dark:text-stone-300 font-medium'
                          : 'text-stone-500 dark:text-stone-400'
                      )}>
                        {conversation.lastMessageContent || t('messages.noMessagesYet', { defaultValue: 'No messages yet' })}
                      </p>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={(e) => handleToggleMute(conversation.conversationId, e)}
                      className={cn(
                        'p-2 rounded-xl transition-colors',
                        conversation.isMuted 
                          ? 'text-stone-400 hover:bg-stone-100 dark:hover:bg-[#3e3e42]'
                          : 'text-stone-400 hover:bg-stone-100 dark:hover:bg-[#3e3e42]'
                      )}
                      disabled={togglingMute === conversation.conversationId}
                      aria-label={conversation.isMuted ? t('messages.unmute', { defaultValue: 'Unmute' }) : t('messages.mute', { defaultValue: 'Mute' })}
                    >
                      {togglingMute === conversation.conversationId ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : conversation.isMuted ? (
                        <BellOff className="h-4 w-4" />
                      ) : (
                        <Bell className="h-4 w-4" />
                      )}
                    </button>
                    <ChevronRight className="h-5 w-5 text-stone-300 dark:text-stone-600" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
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
