/**
 * useMessageNotifications Hook
 * 
 * Listens for new incoming messages via Supabase realtime
 * and triggers in-app toast notifications when the user is not
 * currently viewing the conversation.
 */

import React from 'react'
import { supabase } from '@/lib/supabaseClient'
import type { MessageNotification } from '@/components/messaging/MessageNotificationToast'

interface UseMessageNotificationsOptions {
  userId: string | null
  currentConversationId?: string | null // Don't show notifications for the current conversation
  enabled?: boolean
}

interface UseMessageNotificationsResult {
  notification: MessageNotification | null
  dismiss: () => void
  markConversationAsActive: (conversationId: string | null) => void
}

export function useMessageNotifications({
  userId,
  currentConversationId,
  enabled = true
}: UseMessageNotificationsOptions): UseMessageNotificationsResult {
  const [notification, setNotification] = React.useState<MessageNotification | null>(null)
  const [activeConversationId, setActiveConversationId] = React.useState<string | null>(currentConversationId || null)
  const notificationQueue = React.useRef<MessageNotification[]>([])
  const isShowingNotification = React.useRef(false)
  
  // Update active conversation when prop changes
  React.useEffect(() => {
    setActiveConversationId(currentConversationId || null)
  }, [currentConversationId])
  
  // Process notification queue
  const processQueue = React.useCallback(() => {
    if (isShowingNotification.current || notificationQueue.current.length === 0) {
      return
    }
    
    const nextNotification = notificationQueue.current.shift()
    if (nextNotification) {
      isShowingNotification.current = true
      setNotification(nextNotification)
    }
  }, [])
  
  // Dismiss current notification and process next
  const dismiss = React.useCallback(() => {
    setNotification(null)
    isShowingNotification.current = false
    
    // Process next notification after a small delay
    setTimeout(() => {
      processQueue()
    }, 300)
  }, [processQueue])
  
  // Mark a conversation as active (don't show notifications for it)
  const markConversationAsActive = React.useCallback((conversationId: string | null) => {
    setActiveConversationId(conversationId)
  }, [])
  
  // Listen for new messages
  React.useEffect(() => {
    if (!userId || !enabled) return
    
    const channel = supabase
      .channel('message-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        async (payload) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const newMessage = payload.new as any
          
          // Skip if message is from current user
          if (newMessage.sender_id === userId) {
            return
          }
          
          // Skip if user is currently viewing this conversation
          if (activeConversationId === newMessage.conversation_id) {
            return
          }
          
          // Check if this conversation involves the current user
          try {
            const { data: conversation } = await supabase
              .from('conversations')
              .select('id, participant_1, participant_2')
              .eq('id', newMessage.conversation_id)
              .single()
            
            if (!conversation) return
            
            // Check if user is a participant
            if (conversation.participant_1 !== userId && conversation.participant_2 !== userId) {
              return
            }
            
            // Get sender profile
            const { data: senderProfile } = await supabase
              .from('profiles')
              .select('id, display_name, avatar_url')
              .eq('id', newMessage.sender_id)
              .single()
            
            // Create notification
            const messageNotification: MessageNotification = {
              id: newMessage.id,
              conversationId: newMessage.conversation_id,
              senderId: newMessage.sender_id,
              senderDisplayName: senderProfile?.display_name || 'Someone',
              senderAvatarUrl: senderProfile?.avatar_url,
              content: newMessage.content || '',
              createdAt: newMessage.created_at
            }
            
            // Add to queue
            notificationQueue.current.push(messageNotification)
            processQueue()
            
          } catch (error) {
            console.warn('[message-notifications] Error processing message:', error)
          }
        }
      )
      .subscribe()
    
    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, enabled, activeConversationId, processQueue])
  
  return {
    notification,
    dismiss,
    markConversationAsActive
  }
}

export default useMessageNotifications
