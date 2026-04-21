/**
 * useMessageNotifications Hook
 *
 * Listens for new incoming messages via both Supabase realtime AND the native
 * FCM/APNs push pipeline (`plantswipe:push-received` DOM event emitted by
 * `src/lib/nativePushRegistration.ts`) and triggers in-app toast notifications
 * when the user is not currently viewing the conversation.
 *
 * Why both sources:
 *   - Supabase realtime requires a working WebSocket; on Capacitor mobile it
 *     often drops during sleep/background and silently reconnects minutes
 *     late, so INSERTs that landed mid-sleep never reach the client.
 *   - The native push pipeline fires `pushNotificationReceived` while the app
 *     is in foreground — Android suppresses the system tray UI in that case,
 *     so without this bridge the user sees nothing even though the FCM push
 *     was delivered.
 * Dedup is keyed by message id so the two channels can both fire safely.
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
  // Dedup window shared between the realtime and native-push sources: both
  // channels fire for the same message, we only want one toast.
  const seenMessageIds = React.useRef<Set<string>>(new Set())
  const SEEN_ID_LIMIT = 100

  const rememberMessageId = React.useCallback((id: string | null | undefined): boolean => {
    if (!id) return true
    if (seenMessageIds.current.has(id)) return false
    seenMessageIds.current.add(id)
    if (seenMessageIds.current.size > SEEN_ID_LIMIT) {
      const first = seenMessageIds.current.values().next().value
      if (first) seenMessageIds.current.delete(first)
    }
    return true
  }, [])

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

          // Skip if a native push with the same message id already enqueued a toast
          if (!rememberMessageId(newMessage.id)) return

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
  }, [userId, enabled, activeConversationId, processQueue, rememberMessageId])

  // Bridge native FCM/APNs foreground pushes into the same in-app toast queue.
  // `nativePushRegistration.ts` emits `plantswipe:push-received` whenever a push
  // lands while the app is visible — Android suppresses the system tray UI in
  // that state so without this the user sees nothing.
  React.useEffect(() => {
    if (!enabled || typeof window === 'undefined') return

    const handlePushReceived = (ev: Event) => {
      try {
        const detail = (ev as CustomEvent).detail as
          | { title?: string; body?: string; data?: Record<string, unknown> }
          | undefined
        const data = detail?.data || {}
        const type = typeof data.type === 'string' ? data.type : undefined
        if (type !== 'new_message') return

        const conversationId = typeof data.conversationId === 'string' ? data.conversationId : ''
        if (!conversationId) return
        if (activeConversationId && activeConversationId === conversationId) return
        // `currentConversationId === 'all'` means the user is on the messages
        // list — suppress toasts for every conversation in that case.
        if (activeConversationId === 'all') return

        const messageId =
          (typeof data.messageId === 'string' && data.messageId) ||
          (typeof data['google.message_id'] === 'string' && data['google.message_id']) ||
          `push-${conversationId}-${Date.now()}`
        if (!rememberMessageId(messageId)) return

        const senderDisplayName =
          (typeof data.senderDisplayName === 'string' && data.senderDisplayName) ||
          detail?.title ||
          'Someone'
        const content = detail?.body || (typeof data.body === 'string' ? data.body : '') || ''
        const senderId = typeof data.senderId === 'string' ? data.senderId : ''

        notificationQueue.current.push({
          id: messageId,
          conversationId,
          senderId,
          senderDisplayName,
          senderAvatarUrl: typeof data.senderAvatarUrl === 'string' ? data.senderAvatarUrl : undefined,
          content,
          createdAt: new Date().toISOString(),
        })
        processQueue()
      } catch (err) {
        console.warn('[message-notifications] push bridge failed:', err)
      }
    }

    window.addEventListener('plantswipe:push-received', handlePushReceived)
    return () => {
      window.removeEventListener('plantswipe:push-received', handlePushReceived)
    }
  }, [enabled, activeConversationId, processQueue, rememberMessageId])
  
  return {
    notification,
    dismiss,
    markConversationAsActive
  }
}

export default useMessageNotifications
