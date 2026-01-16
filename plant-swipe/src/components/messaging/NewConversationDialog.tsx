/**
 * NewConversationDialog Component
 * 
 * Dialog to start a new conversation by selecting a friend.
 */

import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog'
import { SearchInput } from '@/components/ui/search-input'
import { User, MessageCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabaseClient'
import { getOrCreateConversation } from '@/lib/messaging'

interface Friend {
  id: string
  friendId: string
  displayName: string | null
  avatarUrl?: string | null
}

interface NewConversationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConversationCreated: (conversationId: string) => void
  currentUserId: string
}

export const NewConversationDialog: React.FC<NewConversationDialogProps> = ({
  open,
  onOpenChange,
  onConversationCreated,
  currentUserId
}) => {
  const { t } = useTranslation('common')
  
  const [friends, setFriends] = React.useState<Friend[]>([])
  const [loading, setLoading] = React.useState(true)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [creating, setCreating] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  
  // Load friends list
  React.useEffect(() => {
    if (!open) return
    
    const loadFriends = async () => {
      setLoading(true)
      setError(null)
      
      try {
        const { data, error: err } = await supabase
          .from('friends')
          .select('id, friend_id')
          .eq('user_id', currentUserId)
        
        if (err) throw err
        
        if (!data || data.length === 0) {
          setFriends([])
          setLoading(false)
          return
        }
        
        // Get friend profiles
        const friendIds = data.map(f => f.friend_id)
        const { data: profiles, error: profileErr } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', friendIds)
        
        if (profileErr) throw profileErr
        
        const profileMap = new Map(
          (profiles || []).map(p => [p.id, p])
        )
        
        setFriends(data.map(f => ({
          id: f.id,
          friendId: f.friend_id,
          displayName: profileMap.get(f.friend_id)?.display_name || null,
          avatarUrl: profileMap.get(f.friend_id)?.avatar_url || null
        })))
      } catch (e: any) {
        console.error('[new-conversation] Failed to load friends:', e)
        setError(e?.message || 'Failed to load friends')
      } finally {
        setLoading(false)
      }
    }
    
    loadFriends()
  }, [open, currentUserId])
  
  // Filter friends by search
  const filteredFriends = React.useMemo(() => {
    if (!searchQuery.trim()) return friends
    const query = searchQuery.toLowerCase()
    return friends.filter(f => 
      f.displayName?.toLowerCase().includes(query)
    )
  }, [friends, searchQuery])
  
  // Handle friend selection
  const handleSelect = async (friendId: string) => {
    setCreating(friendId)
    setError(null)
    
    try {
      const conversationId = await getOrCreateConversation(friendId)
      onConversationCreated(conversationId)
    } catch (e: any) {
      console.error('[new-conversation] Failed to create conversation:', e)
      setError(e?.message || 'Failed to start conversation')
    } finally {
      setCreating(null)
    }
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[28px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/90 dark:bg-[#1f1f1f]/90 backdrop-blur max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-blue-500" />
            {t('messages.newConversation', { defaultValue: 'New Conversation' })}
          </DialogTitle>
          <DialogDescription>
            {t('messages.selectFriend', { defaultValue: 'Select a friend to start chatting' })}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Search */}
          <SearchInput
            placeholder={t('messages.searchFriends', { defaultValue: 'Search friends...' })}
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            className="rounded-xl"
          />
          
          {/* Error */}
          {error && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl border border-red-200 dark:border-red-800">
              {error}
            </div>
          )}
          
          {/* Friends list */}
          <div className="max-h-[300px] overflow-y-auto space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
              </div>
            ) : filteredFriends.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-stone-100 dark:bg-[#2a2a2d] flex items-center justify-center">
                  <User className="h-6 w-6 text-stone-400" />
                </div>
                <p className="text-sm text-stone-500 dark:text-stone-400">
                  {searchQuery 
                    ? t('messages.noFriendsFound', { defaultValue: 'No friends found' })
                    : t('messages.noFriends', { defaultValue: 'Add some friends to start chatting!' })
                  }
                </p>
              </div>
            ) : (
              filteredFriends.map(friend => (
                <button
                  key={friend.id}
                  onClick={() => handleSelect(friend.friendId)}
                  disabled={creating !== null}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-xl transition-colors',
                    'hover:bg-stone-50 dark:hover:bg-[#2a2a2d]',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  {friend.avatarUrl ? (
                    <img
                      src={friend.avatarUrl}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-stone-200 dark:bg-[#3e3e42] flex items-center justify-center">
                      <User className="h-5 w-5 text-stone-500 dark:text-stone-400" />
                    </div>
                  )}
                  <div className="flex-1 text-left">
                    <p className="font-medium text-stone-900 dark:text-white">
                      {friend.displayName || t('messages.unknownUser', { defaultValue: 'Unknown User' })}
                    </p>
                  </div>
                  {creating === friend.friendId ? (
                    <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                  ) : (
                    <MessageCircle className="h-5 w-5 text-stone-400" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
