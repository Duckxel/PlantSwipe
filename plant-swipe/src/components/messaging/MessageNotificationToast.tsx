/**
 * MessageNotificationToast Component
 * 
 * Displays in-app toast notifications for incoming messages.
 * Shows sender name, message preview, and allows quick navigation to the conversation.
 */

import React from 'react'
import { useTranslation } from 'react-i18next'
import { X, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface MessageNotification {
  id: string
  conversationId: string
  senderId: string
  senderDisplayName: string
  senderAvatarUrl?: string | null
  content: string
  createdAt: string
}

interface MessageNotificationToastProps {
  notification: MessageNotification | null
  onDismiss: () => void
  onOpen: (conversationId: string) => void
}

export const MessageNotificationToast: React.FC<MessageNotificationToastProps> = ({
  notification,
  onDismiss,
  onOpen
}) => {
  const { t } = useTranslation('common')
  const [isVisible, setIsVisible] = React.useState(false)
  const [isLeaving, setIsLeaving] = React.useState(false)
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null)
  
  // Show/hide animation
  React.useEffect(() => {
    if (notification) {
      setIsLeaving(false)
      // Small delay to trigger enter animation
      requestAnimationFrame(() => {
        setIsVisible(true)
      })
      
      // Auto-dismiss after 5 seconds
      timeoutRef.current = setTimeout(() => {
        handleDismiss()
      }, 5000)
      
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }
      }
    } else {
      setIsVisible(false)
    }
  }, [notification])
  
  const handleDismiss = () => {
    setIsLeaving(true)
    setIsVisible(false)
    setTimeout(() => {
      onDismiss()
    }, 300)
  }
  
  const handleClick = () => {
    if (notification) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      onOpen(notification.conversationId)
      handleDismiss()
    }
  }
  
  if (!notification) return null
  
  // Check if this is an image message
  const isImage = notification.content.startsWith('[image:')
  const displayContent = isImage 
    ? '📷 ' + t('messages.photo', { defaultValue: 'Photo' })
    : notification.content.length > 60 
      ? notification.content.slice(0, 60) + '...'
      : notification.content
  
  return (
    <div
      className={cn(
        'fixed top-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-[100]',
        'transform transition-all duration-300 ease-out',
        isVisible && !isLeaving
          ? 'translate-y-0 opacity-100'
          : '-translate-y-full opacity-0'
      )}
    >
      <div
        onClick={handleClick}
        className={cn(
          'relative overflow-hidden rounded-2xl',
          'bg-white dark:bg-[#2a2a2d]',
          'border border-stone-200/80 dark:border-[#3a3a3d]/80',
          'shadow-xl dark:shadow-[0_25px_50px_rgba(0,0,0,0.5)]',
          'cursor-pointer active:scale-[0.98] transition-transform'
        )}
      >
        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-stone-100 dark:bg-[#3a3a3d]">
          <div 
            className="h-full bg-blue-500 transition-all ease-linear"
            style={{ 
              width: isVisible && !isLeaving ? '0%' : '100%',
              transitionDuration: isVisible && !isLeaving ? '5000ms' : '0ms'
            }}
          />
        </div>
        
        <div className="p-4 pt-5 flex items-start gap-3">
          {/* Avatar */}
          {notification.senderAvatarUrl ? (
            <img
              src={notification.senderAvatarUrl}
              alt=""
              className="w-12 h-12 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-lg font-semibold flex-shrink-0">
              {(notification.senderDisplayName || 'U').charAt(0).toUpperCase()}
            </div>
          )}
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <MessageCircle className="h-4 w-4 text-blue-500 flex-shrink-0" />
              <span className="font-semibold text-stone-900 dark:text-white truncate">
                {notification.senderDisplayName}
              </span>
            </div>
            <p className="text-sm text-stone-600 dark:text-stone-300 line-clamp-2">
              {displayContent}
            </p>
            <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">
              {t('messages.tapToReply', { defaultValue: 'Tap to reply' })}
            </p>
          </div>
          
          {/* Dismiss button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleDismiss()
            }}
            className="p-1.5 rounded-full hover:bg-stone-100 dark:hover:bg-[#3a3a3d] text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default MessageNotificationToast
