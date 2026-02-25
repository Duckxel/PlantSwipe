/**
 * ConversationSearch Component
 * 
 * A full-screen search interface for finding messages within a conversation.
 * Mobile-optimized with large touch targets and smooth interactions.
 */

import React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { 
  ArrowLeft,
  Search,
  X,
  Loader2,
  MessageSquare,
  Image as ImageIcon
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { searchConversationMessages, isImageMessage, parseImageMessage } from '@/lib/messaging'
import type { Message } from '@/types/messaging'

interface ConversationSearchProps {
  conversationId: string
  otherUserDisplayName: string | null
  otherUserAvatarUrl?: string | null
  currentUserId: string
  onClose: () => void
  onMessageSelect?: (messageId: string) => void
}

export const ConversationSearch: React.FC<ConversationSearchProps> = ({
  conversationId,
  otherUserDisplayName,
  otherUserAvatarUrl,
  currentUserId,
  onClose,
  onMessageSelect
}) => {
  const { t } = useTranslation('common')
  
  const [query, setQuery] = React.useState('')
  const [results, setResults] = React.useState<Message[]>([])
  const [loading, setLoading] = React.useState(false)
  const [hasSearched, setHasSearched] = React.useState(false)
  const [isFocused, setIsFocused] = React.useState(false)
  
  const inputRef = React.useRef<HTMLInputElement>(null)
  const debounceRef = React.useRef<NodeJS.Timeout | null>(null)
  
  // Focus input on mount with slight delay for mobile keyboard
  React.useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus()
    }, 100)
    return () => clearTimeout(timer)
  }, [])
  
  // Debounced search
  React.useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    
    if (!query.trim()) {
      setResults([])
      setHasSearched(false)
      return
    }
    
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      setHasSearched(true)
      
      try {
        const data = await searchConversationMessages(conversationId, query)
        setResults(data)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        console.error('[search] Failed to search messages:', e)
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
    
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [conversationId, query])
  
  // Format time
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000)
    
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else if (diffDays < 7) {
      return date.toLocaleDateString(undefined, { weekday: 'short' }) + ' ' + 
             date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else {
      return date.toLocaleDateString(undefined, { 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      })
    }
  }
  
  // Highlight matching text
  const highlightText = (text: string, searchQuery: string) => {
    if (!searchQuery.trim()) return text
    
    const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    const parts = text.split(regex)
    
    return parts.map((part, i) => 
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-200 dark:bg-yellow-800/60 text-inherit rounded px-0.5">
          {part}
        </mark>
      ) : part
    )
  }
  
  // Get display content for a message
  const getMessageContent = (message: Message) => {
    if (isImageMessage(message.content)) {
      const parsed = parseImageMessage(message.content)
      if (parsed?.caption) {
        return (
          <span className="flex items-center gap-1.5">
            <ImageIcon className="h-4 w-4 flex-shrink-0 text-stone-400" />
            {highlightText(parsed.caption, query)}
          </span>
        )
      }
      return (
        <span className="flex items-center gap-1.5 text-stone-500 dark:text-stone-400">
          <ImageIcon className="h-4 w-4" />
          {t('messages.photo', { defaultValue: 'Photo' })}
        </span>
      )
    }
    return highlightText(message.content, query)
  }
  
  // Handle message click
  const handleMessageClick = (message: Message) => {
    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(10)
    }
    
    if (onMessageSelect) {
      onMessageSelect(message.id)
    }
    onClose()
  }
  
  // Handle clear button
  const handleClear = () => {
    setQuery('')
    inputRef.current?.focus()
  }
  
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-[#0f0f10]">
      {/* Header with search input */}
      <header className="flex-shrink-0 px-2 py-3 bg-white dark:bg-[#1a1a1c] border-b border-stone-200/50 dark:border-[#2a2a2d]/50 safe-area-top">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full h-11 w-11 min-w-11 flex-shrink-0"
            onClick={onClose}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          {/* Search input - larger touch target */}
          <div className="flex-1 relative">
            <div className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
              "bg-stone-100 dark:bg-[#2a2a2d]",
              isFocused && "ring-2 ring-blue-500"
            )}>
              <Search className="h-5 w-5 text-stone-400 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                inputMode="search"
                enterKeyHint="search"
                placeholder={t('messages.searchMessages', { defaultValue: 'Search messages...' })}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                className="flex-1 bg-transparent border-0 focus:ring-0 focus:outline-none text-stone-900 dark:text-white placeholder:text-stone-400 text-[16px]"
              />
              {query && (
                <button
                  onClick={handleClear}
                  className="p-1.5 -mr-1.5 rounded-full hover:bg-stone-200 dark:hover:bg-stone-600 active:bg-stone-300 dark:active:bg-stone-500 transition-colors"
                >
                  <X className="h-5 w-5 text-stone-500 dark:text-stone-400" />
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* Search context */}
        <p className="mt-2 ml-14 text-xs text-stone-500 dark:text-stone-400">
          {t('messages.searchingIn', { defaultValue: 'Searching in conversation with' })}{' '}
          <span className="font-medium">{otherUserDisplayName || t('messages.unknownUser')}</span>
        </p>
      </header>
      
      {/* Results */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-stone-300 dark:text-stone-600" />
          </div>
        ) : !hasSearched ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-20 h-20 rounded-full bg-stone-100 dark:bg-[#2a2a2d] flex items-center justify-center mb-4">
              <Search className="h-10 w-10 text-stone-400" />
            </div>
            <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-2">
              {t('messages.searchTitle', { defaultValue: 'Search Messages' })}
            </h3>
            <p className="text-sm text-stone-500 dark:text-stone-400 max-w-xs">
              {t('messages.searchHint', { defaultValue: 'Type to search through your conversation history.' })}
            </p>
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-20 h-20 rounded-full bg-stone-100 dark:bg-[#2a2a2d] flex items-center justify-center mb-4">
              <MessageSquare className="h-10 w-10 text-stone-400" />
            </div>
            <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-2">
              {t('messages.noResults', { defaultValue: 'No results found' })}
            </h3>
            <p className="text-sm text-stone-500 dark:text-stone-400 max-w-xs">
              {t('messages.noResultsHint', { 
                defaultValue: 'Try searching for different keywords.',
                query: query 
              })}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-stone-100 dark:divide-[#2a2a2d]">
            {/* Results count */}
            <div className="px-4 py-2.5 bg-stone-50 dark:bg-[#1a1a1c] sticky top-0 z-10">
              <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">
                {results.length} {results.length === 1 
                  ? t('messages.result', { defaultValue: 'result' })
                  : t('messages.results', { defaultValue: 'results' })
                }
              </p>
            </div>
            
            {/* Message results - larger touch targets */}
            {results.map((message) => {
              const isOwn = message.senderId === currentUserId
              
              return (
                <button
                  key={message.id}
                  onClick={() => handleMessageClick(message)}
                  className={cn(
                    "w-full flex items-start gap-3 px-4 py-4 text-left",
                    "hover:bg-stone-50 dark:hover:bg-[#1a1a1c]",
                    "active:bg-stone-100 dark:active:bg-[#2a2a2d]",
                    "transition-colors"
                  )}
                >
                  {/* Avatar */}
                  <div className="flex-shrink-0 mt-0.5">
                    {isOwn ? (
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-semibold">
                        {t('messages.you', { defaultValue: 'You' }).charAt(0)}
                      </div>
                    ) : otherUserAvatarUrl ? (
                      <img
                        src={otherUserAvatarUrl}
                        alt=""
                        className="w-11 h-11 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-stone-300 to-stone-400 dark:from-stone-600 dark:to-stone-700 flex items-center justify-center text-white text-sm font-semibold">
                        {(otherUserDisplayName || 'U').charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-semibold text-stone-900 dark:text-white text-[15px]">
                        {isOwn 
                          ? t('messages.you', { defaultValue: 'You' })
                          : (message.sender?.displayName || otherUserDisplayName || t('messages.unknownUser'))
                        }
                      </span>
                      <span className="text-xs text-stone-400 dark:text-stone-500 flex-shrink-0">
                        {formatTime(message.createdAt)}
                      </span>
                    </div>
                    <p className="text-[15px] text-stone-600 dark:text-stone-300 line-clamp-2 leading-snug">
                      {getMessageContent(message)}
                    </p>
                  </div>
                </button>
              )
            })}
            
            {/* Bottom padding for safe area */}
            <div className="h-4 safe-area-bottom" />
          </div>
        )}
      </div>
    </div>
  )
}
