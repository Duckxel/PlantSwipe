/**
 * MessageBubble Component
 * 
 * Displays a single message with reactions, reply threading, and action buttons.
 */

import React from 'react'
import { useTranslation } from 'react-i18next'
import { useLanguageNavigate } from '@/lib/i18nRouting'
import { Button } from '@/components/ui/button'
import { 
  User,
  Smile,
  Reply,
  MoreVertical,
  Edit2,
  Trash2,
  ExternalLink,
  Check,
  X,
  Leaf,
  Home,
  Bookmark
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Message } from '@/types/messaging'
import { COMMON_REACTIONS } from '@/types/messaging'

interface MessageBubbleProps {
  message: Message
  isOwn: boolean
  showAvatar: boolean
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
  
  const menuRef = React.useRef<HTMLDivElement>(null)
  const reactionsRef = React.useRef<HTMLDivElement>(null)
  
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
  
  // Aggregate reactions (must be before early returns to respect hooks rules)
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
        <div className="px-4 py-2 rounded-2xl bg-stone-100 dark:bg-[#2a2a2d] text-stone-400 dark:text-stone-500 italic text-sm">
          {t('messages.messageDeleted', { defaultValue: 'This message was deleted' })}
        </div>
      </div>
    )
  }
  
  return (
    <div className={cn(
      'group flex items-end gap-2 my-1',
      isOwn ? 'flex-row-reverse' : 'flex-row'
    )}>
      {/* Avatar */}
      {showAvatar ? (
        <div className="flex-shrink-0 w-8">
          {isOwn ? null : (
            otherUser.avatarUrl ? (
              <img
                src={otherUser.avatarUrl}
                alt=""
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-stone-200 dark:bg-[#3e3e42] flex items-center justify-center">
                <User className="h-4 w-4 text-stone-500 dark:text-stone-400" />
              </div>
            )
          )}
        </div>
      ) : (
        <div className="w-8 flex-shrink-0" />
      )}
      
      {/* Message content */}
      <div className={cn(
        'relative max-w-[70%] group',
        isOwn ? 'items-end' : 'items-start'
      )}>
        {/* Reply preview */}
        {message.replyTo && (
          <div className={cn(
            'flex items-center gap-2 px-3 py-1 mb-1 text-xs rounded-lg',
            isOwn 
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
              : 'bg-stone-100 dark:bg-[#2a2a2d] text-stone-600 dark:text-stone-400'
          )}>
            <Reply className="h-3 w-3" />
            <span className="font-medium">
              {message.replyTo.sender?.displayName || t('messages.unknownUser')}
            </span>
            <span className="truncate max-w-[150px]">
              {message.replyTo.content}
            </span>
          </div>
        )}
        
        {/* Bubble */}
        <div className={cn(
          'px-4 py-2 rounded-2xl',
          isOwn 
            ? 'bg-blue-500 text-white rounded-br-sm'
            : 'bg-stone-100 dark:bg-[#2a2a2d] text-stone-900 dark:text-white rounded-bl-sm'
        )}>
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full bg-transparent border-0 focus:ring-0 resize-none text-inherit"
                rows={2}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2"
                  onClick={handleEditCancel}
                >
                  <X className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2"
                  onClick={handleEditSave}
                >
                  <Check className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm whitespace-pre-wrap break-words">
                {message.content}
              </p>
              
              {/* Link preview */}
              {message.linkType && (
                <button
                  onClick={handleLinkClick}
                  className={cn(
                    'mt-2 flex items-center gap-2 px-3 py-2 rounded-xl w-full text-left transition-colors',
                    isOwn 
                      ? 'bg-blue-400/50 hover:bg-blue-400/70'
                      : 'bg-stone-200/50 dark:bg-[#3e3e42] hover:bg-stone-200 dark:hover:bg-[#4e4e52]'
                  )}
                >
                  {message.linkPreview?.image ? (
                    <img
                      src={message.linkPreview.image}
                      alt=""
                      className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                      isOwn ? 'bg-blue-300/50' : 'bg-stone-300/50 dark:bg-[#5e5e62]'
                    )}>
                      {getLinkIcon()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">
                      {message.linkPreview?.title || message.linkId || t('messages.link', { defaultValue: 'Link' })}
                    </p>
                    {message.linkPreview?.description && (
                      <p className="text-xs opacity-70 truncate">
                        {message.linkPreview.description}
                      </p>
                    )}
                  </div>
                  <ExternalLink className="h-4 w-4 flex-shrink-0 opacity-70" />
                </button>
              )}
            </>
          )}
        </div>
        
        {/* Time and edited indicator */}
        <div className={cn(
          'flex items-center gap-1 mt-1 text-[10px] text-stone-400',
          isOwn ? 'justify-end' : 'justify-start'
        )}>
          <span>{formatTime(message.createdAt)}</span>
          {message.editedAt && (
            <span>· {t('messages.edited', { defaultValue: 'edited' })}</span>
          )}
        </div>
        
        {/* Reactions */}
        {Object.keys(reactionCounts).length > 0 && (
          <div className={cn(
            'flex flex-wrap gap-1 mt-1',
            isOwn ? 'justify-end' : 'justify-start'
          )}>
            {Object.entries(reactionCounts).map(([emoji, data]) => (
              <button
                key={emoji}
                onClick={() => onReaction(emoji)}
                className={cn(
                  'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors',
                  data.hasOwn 
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'bg-stone-100 dark:bg-[#2a2a2d] text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-[#3e3e42]'
                )}
              >
                <span>{emoji}</span>
                {data.count > 1 && <span>{data.count}</span>}
              </button>
            ))}
          </div>
        )}
        
        {/* Action buttons - show on hover */}
        <div className={cn(
          'absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 -mt-8',
          isOwn ? 'right-0' : 'left-0'
        )}>
          {/* Reactions picker */}
          <div className="relative" ref={reactionsRef}>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full bg-white dark:bg-[#1f1f1f] shadow-sm"
              onClick={() => setShowReactions(!showReactions)}
            >
              <Smile className="h-4 w-4" />
            </Button>
            
            {showReactions && (
              <div className={cn(
                'absolute z-10 flex items-center gap-1 p-1 bg-white dark:bg-[#1f1f1f] rounded-full shadow-lg border border-stone-200 dark:border-[#3e3e42]',
                isOwn ? 'right-0' : 'left-0'
              )}>
                {COMMON_REACTIONS.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => {
                      onReaction(emoji)
                      setShowReactions(false)
                    }}
                    className="p-1 hover:bg-stone-100 dark:hover:bg-[#2a2a2d] rounded-full transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* Reply */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full bg-white dark:bg-[#1f1f1f] shadow-sm"
            onClick={onReply}
          >
            <Reply className="h-4 w-4" />
          </Button>
          
          {/* More options (only for own messages) */}
          {isOwn && (
            <div className="relative" ref={menuRef}>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full bg-white dark:bg-[#1f1f1f] shadow-sm"
                onClick={() => setShowMenu(!showMenu)}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
              
              {showMenu && (
                <div className={cn(
                  'absolute z-10 w-32 p-1 bg-white dark:bg-[#1f1f1f] rounded-xl shadow-lg border border-stone-200 dark:border-[#3e3e42]',
                  isOwn ? 'right-0' : 'left-0'
                )}>
                  <button
                    onClick={() => {
                      setIsEditing(true)
                      setShowMenu(false)
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-stone-100 dark:hover:bg-[#2a2a2d] rounded-lg transition-colors"
                  >
                    <Edit2 className="h-4 w-4" />
                    {t('messages.edit', { defaultValue: 'Edit' })}
                  </button>
                  <button
                    onClick={() => {
                      onDelete()
                      setShowMenu(false)
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                    {t('messages.delete', { defaultValue: 'Delete' })}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
