/**
 * ConversationSearch Component
 * 
 * A full-screen search interface for finding messages within a conversation.
 * Features: live search, highlighted results, jump to message.
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
  
  const inputRef = React.useRef<HTMLInputElement>(null)
  const debounceRef = React.useRef<NodeJS.Timeout | null>(null)
  
  // Focus input on mount
  React.useEffect(() => {
    inputRef.current?.focus()
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
        <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 text-inherit rounded px-0.5">
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
          <span className="flex items-center gap-1">
            <ImageIcon className="h-3 w-3 flex-shrink-0" />
            {highlightText(parsed.caption, query)}
          </span>
        )
      }
      return (
        <span className="flex items-center gap-1 text-stone-500 dark:text-stone-400">
          <ImageIcon className="h-3 w-3" />
          {t('messages.photo', { defaultValue: 'Photo' })}
        </span>
      )
    }
    return highlightText(message.content, query)
  }
  
  // Handle message click
  const handleMessageClick = (message: Message) => {
    if (onMessageSelect) {
      onMessageSelect(message.id)
    }
    onClose()
  }
  
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-[#0f0f10]">
      {/* Header with search input */}
      <header className="flex-shrink-0 px-2 py-3 bg-white dark:bg-[#1a1a1c] border-b border-stone-200/50 dark:border-[#2a2a2d]/50">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full h-10 w-10 flex-shrink-0"
            onClick={onClose}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          {/* Search input */}
          <div className="flex-1 relative">
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-stone-100 dark:bg-[#2a2a2d]">
              <Search className="h-5 w-5 text-stone-400 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                placeholder={t('messages.searchMessages', { defaultValue: 'Search messages...' })}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 bg-transparent border-0 focus:ring-0 focus:outline-none text-stone-900 dark:text-white placeholder:text-stone-400 text-[16px]"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* Search context */}
        <p className="mt-2 ml-12 text-xs text-stone-500 dark:text-stone-400">
          {t('messages.searchingIn', { defaultValue: 'Searching in conversation with' })}{' '}
          <span className="font-medium">{otherUserDisplayName || t('messages.unknownUser')}</span>
        </p>
      </header>
      
      {/* Results */}
      <div className="flex-1 overflow-y-auto">
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
            <div className="px-4 py-2 bg-stone-50 dark:bg-[#1a1a1c]">
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {results.length} {results.length === 1 
                  ? t('messages.result', { defaultValue: 'result' })
                  : t('messages.results', { defaultValue: 'results' })
                }
              </p>
            </div>
            
            {/* Message results */}
            {results.map((message) => {
              const isOwn = message.senderId === currentUserId
              
              return (
                <button
                  key={message.id}
                  onClick={() => handleMessageClick(message)}
                  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-stone-50 dark:hover:bg-[#1a1a1c] active:bg-stone-100 dark:active:bg-[#2a2a2d] transition-colors text-left"
                >
                  {/* Avatar */}
                  <div className="flex-shrink-0 mt-0.5">
                    {isOwn ? (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-semibold">
                        {t('messages.you', { defaultValue: 'You' }).charAt(0)}
                      </div>
                    ) : otherUserAvatarUrl ? (
                      <img
                        src={otherUserAvatarUrl}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-stone-300 to-stone-400 dark:from-stone-600 dark:to-stone-700 flex items-center justify-center text-white text-sm font-semibold">
                        {(otherUserDisplayName || 'U').charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="font-medium text-stone-900 dark:text-white text-sm">
                        {isOwn 
                          ? t('messages.you', { defaultValue: 'You' })
                          : (message.sender?.displayName || otherUserDisplayName || t('messages.unknownUser'))
                        }
                      </span>
                      <span className="text-xs text-stone-400 dark:text-stone-500 flex-shrink-0">
                        {formatTime(message.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-stone-600 dark:text-stone-300 line-clamp-2">
                      {getMessageContent(message)}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
