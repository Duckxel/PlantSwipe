/**
 * MessageBubble Component
 * 
 * Displays a single message with mobile-first touch interactions.
 * Features: reactions with long-press, reply swipe, image display.
 */

import React from 'react'
import { useTranslation } from 'react-i18next'
import { useLanguageNavigate } from '@/lib/i18nRouting'
import { Button } from '@/components/ui/button'
import { 
  User,
  Reply,
  MoreVertical,
  Edit2,
  Trash2,
  ExternalLink,
  Check,
  X,
  Leaf,
  Home,
  Bookmark,
  Download
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Message } from '@/types/messaging'
import { COMMON_REACTIONS } from '@/types/messaging'
import { isImageMessage, parseImageMessage, extractInternalLinks } from '@/lib/messaging'
import { InternalLinkPreview } from './InternalLinkPreview'

interface MessageBubbleProps {
  message: Message
  isOwn: boolean
  showAvatar: boolean
  isLastInGroup?: boolean
  otherUser: {
    id: string
    displayName: string | null
    avatarUrl?: string | null
  }
  onReply: () => void
  onReaction: (emoji: string) => void
  onEdit: (newContent: string) => void
  onDelete: () => void
  currentUserId: string
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwn,
  showAvatar,
  isLastInGroup,
  otherUser,
  onReply,
  onReaction,
  onEdit,
  onDelete,
  currentUserId
}) => {
  const { t } = useTranslation('common')
  const navigate = useLanguageNavigate()
  
  const [showReactions, setShowReactions] = React.useState(false)
  const [showMenu, setShowMenu] = React.useState(false)
  const [isEditing, setIsEditing] = React.useState(false)
  const [editContent, setEditContent] = React.useState(message.content)
  const [imageLoaded, setImageLoaded] = React.useState(false)
  const [imageFullscreen, setImageFullscreen] = React.useState(false)
  
  const menuRef = React.useRef<HTMLDivElement>(null)
  const reactionsRef = React.useRef<HTMLDivElement>(null)
  const longPressTimer = React.useRef<NodeJS.Timeout | null>(null)
  const bubbleRef = React.useRef<HTMLDivElement>(null)
  
  // Parse image message if applicable
  const imageData = React.useMemo(() => {
    if (isImageMessage(message.content)) {
      return parseImageMessage(message.content)
    }
    return null
  }, [message.content])
  
  // Close menus on outside click
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
      if (reactionsRef.current && !reactionsRef.current.contains(e.target as Node)) {
        setShowReactions(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
  // Long press handlers for reactions
  const handleTouchStart = () => {
    longPressTimer.current = setTimeout(() => {
      setShowReactions(true)
      // Haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(50)
      }
    }, 500)
  }
  
  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }
  
  const handleTouchMove = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }
  
  // Format time
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  
  // Handle edit save
  const handleEditSave = () => {
    if (editContent.trim() && editContent !== message.content) {
      onEdit(editContent)
    }
    setIsEditing(false)
  }
  
  // Handle edit cancel
  const handleEditCancel = () => {
    setEditContent(message.content)
    setIsEditing(false)
  }
  
  // Aggregate reactions
  const reactionCounts = React.useMemo(() => {
    const counts: Record<string, { count: number; users: string[]; hasOwn: boolean }> = {}
    
    message.reactions?.forEach(r => {
      if (!counts[r.emoji]) {
        counts[r.emoji] = { count: 0, users: [], hasOwn: false }
      }
      counts[r.emoji].count++
      counts[r.emoji].users.push(r.userId)
      if (r.userId === currentUserId) {
        counts[r.emoji].hasOwn = true
      }
    })
    
    return counts
  }, [message.reactions, currentUserId])
  
  // Get link icon
  const getLinkIcon = () => {
    switch (message.linkType) {
      case 'plant':
        return <Leaf className="h-4 w-4" />
      case 'garden':
        return <Home className="h-4 w-4" />
      case 'bookmark':
        return <Bookmark className="h-4 w-4" />
      case 'profile':
        return <User className="h-4 w-4" />
      default:
        return <ExternalLink className="h-4 w-4" />
    }
  }
  
  // Navigate to link
  const handleLinkClick = () => {
    if (!message.linkType || !message.linkId) return
    
    switch (message.linkType) {
      case 'plant':
        navigate(`/plants/${message.linkId}`)
        break
      case 'garden':
        navigate(`/garden/${message.linkId}`)
        break
      case 'bookmark':
        navigate(`/bookmarks/${message.linkId}`)
        break
      case 'profile':
        navigate(`/u/${message.linkId}`)
        break
      case 'external':
        if (message.linkUrl) {
          window.open(message.linkUrl, '_blank', 'noopener,noreferrer')
        }
        break
    }
  }
  
  // Check if message is deleted
  if (message.deletedAt) {
    return (
      <div className={cn(
        'flex items-center gap-2 my-2',
        isOwn ? 'justify-end' : 'justify-start'
      )}>
        <div className="px-4 py-2.5 rounded-2xl bg-stone-100 dark:bg-[#2a2a2d] text-stone-400 dark:text-stone-500 italic text-sm">
          {t('messages.messageDeleted', { defaultValue: 'Message deleted' })}
        </div>
      </div>
    )
  }
  
  return (
    <>
      <div 
        className={cn(
          'flex items-start gap-2 my-0.5',
          isOwn ? 'flex-row-reverse' : 'flex-row',
          isLastInGroup && 'mb-2'
        )}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        onContextMenu={(e) => {
          e.preventDefault()
          setShowReactions(true)
        }}
      >
        {/* Avatar - mt-2.5 aligns with the text content inside the message bubble (which has py-2.5 padding) */}
        {!isOwn && (
          showAvatar ? (
            <div className="flex-shrink-0 w-7 mt-2.5">
              {otherUser.avatarUrl ? (
                <img
                  src={otherUser.avatarUrl}
                  alt=""
                  className="w-7 h-7 rounded-full object-cover"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-stone-300 to-stone-400 dark:from-stone-600 dark:to-stone-700 flex items-center justify-center text-white text-xs font-semibold">
                  {(otherUser.displayName || 'U').charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          ) : (
            <div className="w-7 flex-shrink-0" />
          )
        )}
        
        {/* Message content */}
        <div 
          ref={bubbleRef}
          className={cn(
            'relative max-w-[75%] md:max-w-[65%]',
            isOwn ? 'items-end' : 'items-start'
          )}
        >
          {/* Reply preview */}
          {message.replyTo && (
            <div className={cn(
              'flex items-center gap-2 px-3 py-1.5 mb-1 text-xs rounded-xl',
              isOwn 
                ? 'bg-blue-400/30 text-blue-100'
                : 'bg-stone-200 dark:bg-[#3a3a3d] text-stone-600 dark:text-stone-300'
            )}>
              <Reply className="h-3 w-3 flex-shrink-0" />
              <span className="font-medium truncate">
                {message.replyTo.sender?.displayName || t('messages.unknownUser')}:
              </span>
              <span className="truncate flex-1">
                {isImageMessage(message.replyTo.content) 
                  ? '📷 ' + t('messages.photo', { defaultValue: 'Photo' })
                  : message.replyTo.content
                }
              </span>
            </div>
          )}
          
          {/* Image message */}
          {imageData ? (
            <div 
              className={cn(
                'rounded-2xl overflow-hidden cursor-pointer',
                isOwn 
                  ? 'bg-blue-500 rounded-br-md'
                  : 'bg-stone-100 dark:bg-[#2a2a2d] rounded-bl-md'
              )}
              onClick={() => setImageFullscreen(true)}
            >
              <img
                src={imageData.imageUrl}
                alt=""
                className={cn(
                  "max-w-full max-h-[300px] object-contain",
                  !imageLoaded && "min-h-[100px] animate-pulse bg-stone-200 dark:bg-stone-700"
                )}
                onLoad={() => setImageLoaded(true)}
                loading="lazy"
              />
              {imageData.caption && (
                <p className={cn(
                  "px-3 py-2 text-sm",
                  isOwn ? "text-white" : "text-stone-900 dark:text-white"
                )}>
                  {imageData.caption}
                </p>
              )}
            </div>
          ) : (
            /* Text Bubble */
            <div className={cn(
              'px-4 py-2.5 rounded-2xl',
              isOwn 
                ? 'bg-blue-500 text-white rounded-br-md'
                : 'bg-stone-100 dark:bg-[#2a2a2d] text-stone-900 dark:text-white rounded-bl-md'
            )}>
              {isEditing ? (
                <div className="space-y-2">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none resize-none text-inherit min-w-[200px]"
                    rows={2}
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-inherit hover:bg-white/20"
                      onClick={handleEditCancel}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-inherit hover:bg-white/20"
                      onClick={handleEditSave}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-[15px] leading-snug whitespace-pre-wrap break-words">
                    {message.content}
                  </p>
                  
                  {/* Auto-detected internal link previews (aphylia.app links in message text) */}
                  {!message.linkType && extractInternalLinks(message.content).length > 0 && (
                    <InternalLinkPreview
                      content={message.content}
                      isOwn={isOwn}
                    />
                  )}
                  
                  {/* Explicit link preview (from LinkShareDialog) */}
                  {message.linkType && (
                    <button
                      onClick={handleLinkClick}
                      className={cn(
                        'mt-2 flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-left transition-colors',
                        isOwn 
                          ? 'bg-blue-400/40 hover:bg-blue-400/60'
                          : 'bg-stone-200/70 dark:bg-[#3a3a3d] hover:bg-stone-200 dark:hover:bg-[#4a4a4d]'
                      )}
                    >
                      {message.linkPreview?.image ? (
                        <img
                          src={message.linkPreview.image}
                          alt=""
                          className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className={cn(
                          'w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0',
                          isOwn ? 'bg-blue-300/50' : 'bg-stone-300/70 dark:bg-[#4a4a4d]'
                        )}>
                          {getLinkIcon()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {message.linkPreview?.title || message.linkId || t('messages.link', { defaultValue: 'Link' })}
                        </p>
                        {message.linkPreview?.description && (
                          <p className="text-xs opacity-70 truncate">
                            {message.linkPreview.description}
                          </p>
                        )}
                      </div>
                      <ExternalLink className="h-4 w-4 flex-shrink-0 opacity-60" />
                    </button>
                  )}
                </>
              )}
            </div>
          )}
          
          {/* Reactions - positioned at bottom edge of message bubble */}
          {Object.keys(reactionCounts).length > 0 && (
            <div className={cn(
              'flex flex-wrap gap-1 -mt-2 mb-1 relative z-10',
              isOwn ? 'justify-end pr-1' : 'justify-start pl-1'
            )}>
              {Object.entries(reactionCounts).map(([emoji, data]) => (
                <button
                  key={emoji}
                  onClick={() => onReaction(emoji)}
                  className={cn(
                    'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all active:scale-95 shadow-sm border',
                    data.hasOwn 
                      ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700'
                      : 'bg-white dark:bg-[#2a2a2d] text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-[#3a3a3d] border-stone-200 dark:border-[#3a3a3d]'
                  )}
                >
                  <span className="text-sm">{emoji}</span>
                  {data.count > 1 && <span className="font-medium">{data.count}</span>}
                </button>
              ))}
            </div>
          )}
          
          {/* Time and status */}
          <div className={cn(
            'flex items-center gap-1.5 px-1',
            isOwn ? 'justify-end' : 'justify-start',
            Object.keys(reactionCounts).length === 0 && 'mt-1'
          )}>
            <span className="text-[10px] text-stone-400 dark:text-stone-500">
              {formatTime(message.createdAt)}
            </span>
            {message.editedAt && (
              <span className="text-[10px] text-stone-400 dark:text-stone-500">
                · {t('messages.edited', { defaultValue: 'edited' })}
              </span>
            )}
          </div>
          
          {/* Reaction picker overlay */}
          {showReactions && (
            <div 
              ref={reactionsRef}
              className={cn(
                'absolute z-20 bottom-full mb-2 p-1.5 bg-white dark:bg-[#2a2a2d] rounded-full shadow-xl border border-stone-200 dark:border-[#3a3a3d] flex items-center gap-0.5',
                isOwn ? 'right-0' : 'left-0'
              )}
            >
              {COMMON_REACTIONS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => {
                    onReaction(emoji)
                    setShowReactions(false)
                  }}
                  className="p-2 hover:bg-stone-100 dark:hover:bg-[#3a3a3d] rounded-full transition-all active:scale-110 text-xl"
                >
                  {emoji}
                </button>
              ))}
              
              {/* Divider and actions */}
              <div className="w-px h-6 bg-stone-200 dark:bg-[#3a3a3d] mx-1" />
              
              <button
                onClick={() => {
                  onReply()
                  setShowReactions(false)
                }}
                className="p-2 hover:bg-stone-100 dark:hover:bg-[#3a3a3d] rounded-full transition-colors"
                title={t('messages.reply', { defaultValue: 'Reply' })}
              >
                <Reply className="h-5 w-5 text-stone-600 dark:text-stone-300" />
              </button>
              
              {isOwn && (
                <button
                  onClick={() => {
                    setShowReactions(false)
                    setShowMenu(true)
                  }}
                  className="p-2 hover:bg-stone-100 dark:hover:bg-[#3a3a3d] rounded-full transition-colors"
                >
                  <MoreVertical className="h-5 w-5 text-stone-600 dark:text-stone-300" />
                </button>
              )}
            </div>
          )}
          
          {/* More options menu for own messages */}
          {showMenu && isOwn && (
            <div 
              ref={menuRef}
              className={cn(
                'absolute z-20 bottom-full mb-2 w-36 p-1.5 bg-white dark:bg-[#2a2a2d] rounded-2xl shadow-xl border border-stone-200 dark:border-[#3a3a3d]',
                isOwn ? 'right-0' : 'left-0'
              )}
            >
              {!imageData && (
                <button
                  onClick={() => {
                    setIsEditing(true)
                    setShowMenu(false)
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left hover:bg-stone-100 dark:hover:bg-[#3a3a3d] rounded-xl transition-colors"
                >
                  <Edit2 className="h-4 w-4" />
                  {t('messages.edit', { defaultValue: 'Edit' })}
                </button>
              )}
              <button
                onClick={() => {
                  onDelete()
                  setShowMenu(false)
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                {t('messages.delete', { defaultValue: 'Delete' })}
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Fullscreen image viewer */}
      {imageFullscreen && imageData && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={() => setImageFullscreen(false)}
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            onClick={() => setImageFullscreen(false)}
          >
            <X className="h-6 w-6" />
          </button>
          <button
            className="absolute top-4 left-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            onClick={(e) => {
              e.stopPropagation()
              const link = document.createElement('a')
              link.href = imageData.imageUrl
              link.download = 'image.jpg'
              link.click()
            }}
          >
            <Download className="h-6 w-6" />
          </button>
          <img
            src={imageData.imageUrl}
            alt=""
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}
