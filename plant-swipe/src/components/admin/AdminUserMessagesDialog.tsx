/**
 * AdminUserMessagesDialog Component
 * 
 * A dialog that shows a user's messages from their perspective,
 * allowing admins to browse conversations, search messages, and view images for moderation.
 */

import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  MessageCircle,
  ArrowLeft,
  Loader2,
  Search,
  ChevronRight,
  AlertTriangle,
  Link as LinkIcon,
  Reply,
  Edit2,
  Trash2,
  Images,
  X,
  Download,
  ChevronLeft,
  Check,
  Image as ImageIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabaseClient'

// Types for admin message viewing
interface AdminConversation {
  id: string
  participant1: string
  participant2: string
  participant1Name: string | null
  participant1Avatar: string | null
  participant2Name: string | null
  participant2Avatar: string | null
  createdAt: string
  lastMessageAt: string | null
  messageCount?: number
}

interface AdminMessageReaction {
  id: string
  userId: string
  userName: string | null
  emoji: string
  createdAt: string
}

interface AdminMessage {
  id: string
  conversationId: string
  senderId: string
  senderName: string | null
  senderAvatar: string | null
  content: string
  linkType: string | null
  linkUrl: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  linkPreview: any | null
  replyToId: string | null
  replyTo: {
    id: string
    senderId: string
    senderName: string | null
    content: string
    createdAt: string
  } | null
  createdAt: string
  editedAt: string | null
  deletedAt: string | null
  readAt: string | null
  reactions: AdminMessageReaction[]
}

interface SearchMessage {
  id: string
  conversationId: string
  senderId: string
  senderName: string | null
  senderAvatar: string | null
  otherUserId: string | null
  otherUserName: string | null
  content: string
  linkType: string | null
  linkUrl: string | null
  createdAt: string
  editedAt: string | null
  deletedAt: string | null
  replyToId: string | null
}

interface UserImage {
  id: string
  conversationId: string
  senderId: string
  senderName: string | null
  senderAvatar: string | null
  otherUserId: string | null
  otherUserName: string | null
  imageUrl: string
  caption: string | null
  createdAt: string
  isSentByUser: boolean
}

interface AdminUserMessagesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  userName: string | null
}

type ViewMode = 'list' | 'conversation' | 'search' | 'media'

export const AdminUserMessagesDialog: React.FC<AdminUserMessagesDialogProps> = ({
  open,
  onOpenChange,
  userId,
  userName,
}) => {
  // State
  const [view, setView] = React.useState<ViewMode>('list')
  const [conversations, setConversations] = React.useState<AdminConversation[]>([])
  const [conversationsLoading, setConversationsLoading] = React.useState(false)
  const [selectedConversation, setSelectedConversation] = React.useState<AdminConversation | null>(null)
  const [messages, setMessages] = React.useState<AdminMessage[]>([])
  const [messagesLoading, setMessagesLoading] = React.useState(false)
  const [hasMoreMessages, setHasMoreMessages] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')
  
  // Search state
  const [messageSearchQuery, setMessageSearchQuery] = React.useState('')
  const [searchResults, setSearchResults] = React.useState<SearchMessage[]>([])
  const [searchLoading, setSearchLoading] = React.useState(false)
  const [hasSearched, setHasSearched] = React.useState(false)
  
  // Media gallery state
  const [userImages, setUserImages] = React.useState<UserImage[]>([])
  const [imagesLoading, setImagesLoading] = React.useState(false)
  const [imagesTotal, setImagesTotal] = React.useState(0)
  const [imagesOffset, setImagesOffset] = React.useState(0)
  const [imagesSentOnly, setImagesSentOnly] = React.useState(false)
  const [selectedImageIndex, setSelectedImageIndex] = React.useState<number | null>(null)
  const [showFullscreenControls, setShowFullscreenControls] = React.useState(true)
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null)
  const [downloadSuccess, setDownloadSuccess] = React.useState<string | null>(null)
  
  const messagesEndRef = React.useRef<HTMLDivElement>(null)
  const messagesContainerRef = React.useRef<HTMLDivElement>(null)
  const searchInputRef = React.useRef<HTMLInputElement>(null)
  const searchDebounceRef = React.useRef<NodeJS.Timeout | null>(null)

  // Load conversations when dialog opens
  React.useEffect(() => {
    if (open && userId) {
      loadConversations()
    } else {
      // Reset state when closing
      setView('list')
      setConversations([])
      setSelectedConversation(null)
      setMessages([])
      setSearchQuery('')
      setMessageSearchQuery('')
      setSearchResults([])
      setHasSearched(false)
      setUserImages([])
      setImagesOffset(0)
      setSelectedImageIndex(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, userId])

  // Scroll to bottom when messages load
  React.useEffect(() => {
    if (messages.length > 0 && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'instant' })
    }
  }, [messages])

  // Auto-hide fullscreen controls
  React.useEffect(() => {
    if (selectedImageIndex === null) return
    
    const timer = setTimeout(() => {
      setShowFullscreenControls(false)
    }, 3000)
    
    return () => clearTimeout(timer)
  }, [selectedImageIndex, showFullscreenControls])

  const getAuthHeaders = async () => {
    const session = (await supabase.auth.getSession()).data.session
    const token = session?.access_token
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const adminToken = (globalThis as any)?.__ENV__?.VITE_ADMIN_STATIC_TOKEN
      if (adminToken) headers['X-Admin-Token'] = String(adminToken)
    } catch {}
    return headers
  }

  const loadConversations = async () => {
    if (!userId) return
    setConversationsLoading(true)
    try {
      const headers = await getAuthHeaders()
      
      const resp = await fetch(
        `/api/admin/member-messages?userId=${encodeURIComponent(userId)}&limit=200`,
        { headers, credentials: 'same-origin' }
      )
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error || 'Failed to load conversations')
      
      setConversations(data?.conversations || [])
    } catch (e) {
      console.error('Failed to load conversations:', e)
    } finally {
      setConversationsLoading(false)
    }
  }

  const loadConversationMessages = async (conversationId: string, before?: string) => {
    setMessagesLoading(true)
    try {
      const headers = await getAuthHeaders()
      
      let url = `/api/admin/conversation-messages?conversationId=${encodeURIComponent(conversationId)}&limit=100`
      if (before) url += `&before=${encodeURIComponent(before)}`
      
      const resp = await fetch(url, { headers, credentials: 'same-origin' })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error || 'Failed to load messages')
      
      const newMessages = data?.messages || []
      if (before) {
        // Prepend older messages
        setMessages(prev => [...newMessages, ...prev])
      } else {
        setMessages(newMessages)
      }
      setHasMoreMessages(data?.hasMore || false)
      
      // Update conversation details if available
      if (data?.conversation) {
        setSelectedConversation(data.conversation)
      }
    } catch (e) {
      console.error('Failed to load messages:', e)
    } finally {
      setMessagesLoading(false)
    }
  }

  // Search messages
  const searchMessages = async (query: string) => {
    if (!userId || !query || query.length < 2) {
      setSearchResults([])
      setHasSearched(false)
      return
    }
    
    setSearchLoading(true)
    setHasSearched(true)
    
    try {
      const headers = await getAuthHeaders()
      
      const resp = await fetch(
        `/api/admin/search-user-messages?userId=${encodeURIComponent(userId)}&query=${encodeURIComponent(query)}&limit=50`,
        { headers, credentials: 'same-origin' }
      )
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error || 'Failed to search messages')
      
      setSearchResults(data?.messages || [])
    } catch (e) {
      console.error('Failed to search messages:', e)
      setSearchResults([])
    } finally {
      setSearchLoading(false)
    }
  }

  // Debounced search
  React.useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current)
    }
    
    if (!messageSearchQuery.trim()) {
      setSearchResults([])
      setHasSearched(false)
      return
    }
    
    searchDebounceRef.current = setTimeout(() => {
      searchMessages(messageSearchQuery)
    }, 300)
    
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageSearchQuery, userId])

  // Load user images
  const loadUserImages = async (reset = false) => {
    if (!userId) return
    
    setImagesLoading(true)
    try {
      const headers = await getAuthHeaders()
      const offset = reset ? 0 : imagesOffset
      
      const resp = await fetch(
        `/api/admin/user-images?userId=${encodeURIComponent(userId)}&limit=50&offset=${offset}&sentOnly=${imagesSentOnly}`,
        { headers, credentials: 'same-origin' }
      )
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error || 'Failed to load images')
      
      if (reset || offset === 0) {
        setUserImages(data?.images || [])
      } else {
        setUserImages(prev => [...prev, ...(data?.images || [])])
      }
      setImagesTotal(data?.totalCount || 0)
      setImagesOffset(offset + (data?.images?.length || 0))
    } catch (e) {
      console.error('Failed to load images:', e)
    } finally {
      setImagesLoading(false)
    }
  }

  // Load images when switching to media view or changing filter
  React.useEffect(() => {
    if (view === 'media' && userId) {
      setImagesOffset(0)
      loadUserImages(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, imagesSentOnly, userId])

  const handleSelectConversation = (conv: AdminConversation) => {
    setSelectedConversation(conv)
    setMessages([])
    setView('conversation')
    loadConversationMessages(conv.id)
  }

  const handleBack = () => {
    if (view === 'conversation') {
      setSelectedConversation(null)
      setMessages([])
    }
    setView('list')
    setSelectedImageIndex(null)
  }

  const handleLoadMore = () => {
    if (selectedConversation && messages.length > 0) {
      loadConversationMessages(selectedConversation.id, messages[0].id)
    }
  }

  // Get the other participant info relative to the viewed user
  const getOtherParticipant = (conv: AdminConversation) => {
    if (conv.participant1 === userId) {
      return {
        id: conv.participant2,
        name: conv.participant2Name,
        avatar: conv.participant2Avatar,
      }
    }
    return {
      id: conv.participant1,
      name: conv.participant1Name,
      avatar: conv.participant1Avatar,
    }
  }

  // Filter conversations by search
  const filteredConversations = React.useMemo(() => {
    if (!searchQuery.trim()) return conversations
    const q = searchQuery.toLowerCase()
    return conversations.filter(conv => {
      const other = getOtherParticipant(conv)
      return other.name?.toLowerCase().includes(q)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, searchQuery, userId])

  // Format relative time
  const formatRelativeTime = (dateStr?: string | null) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    
    if (diffMins < 1) return 'now'
    if (diffMins < 60) return `${diffMins}m`
    if (diffHours < 24) return `${diffHours}h`
    if (diffDays < 7) return `${diffDays}d`
    
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  // Format message time
  const formatMessageTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  }

  // Check if message is an image
  const isImageMessage = (content: string) => content.startsWith('[image:')
  const parseImageUrl = (content: string) => content.match(/\[image:(.*?)\]/)?.[1] || ''

  // Highlight search matches
  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    const parts = text.split(regex)
    
    return parts.map((part, i) => 
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-200 dark:bg-yellow-800/60 text-inherit rounded px-0.5">
          {part}
        </mark>
      ) : part
    )
  }

  // Group messages by date (using ISO date string YYYY-MM-DD for reliable grouping)
  const groupedMessages = React.useMemo(() => {
    const groups: { date: string; messages: AdminMessage[] }[] = []
    let currentDate = ''
    
    messages.forEach(msg => {
      // Use ISO date format (YYYY-MM-DD) for grouping to avoid locale parsing issues
      const msgDate = new Date(msg.createdAt).toISOString().split('T')[0]
      if (msgDate !== currentDate) {
        currentDate = msgDate
        groups.push({ date: msgDate, messages: [] })
      }
      groups[groups.length - 1].messages.push(msg)
    })
    
    return groups
  }, [messages])

  // Format date separator (expects ISO date string YYYY-MM-DD)
  const formatDateSeparator = (dateStr: string) => {
    // Parse ISO date string reliably by appending time component
    const date = new Date(dateStr + 'T12:00:00')
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    if (date.toDateString() === today.toDateString()) return 'Today'
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
  }

  // Format date for images
  const formatImageDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    })
  }

  // Download image
  const downloadImage = async (image: UserImage, index: number) => {
    setDownloadingId(image.id)
    
    try {
      const response = await fetch(image.imageUrl)
      const blob = await response.blob()
      
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `image-${index + 1}-${formatImageDate(image.createdAt).replace(/\s/g, '-')}.jpg`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      setDownloadSuccess(image.id)
      setTimeout(() => setDownloadSuccess(null), 2000)
    } catch (err) {
      console.error('Failed to download image:', err)
      // Fallback to direct link
      const link = document.createElement('a')
      link.href = image.imageUrl
      link.download = `image-${index + 1}.jpg`
      link.target = '_blank'
      link.click()
    } finally {
      setDownloadingId(null)
    }
  }

  // Navigate fullscreen images
  const goToPreviousImage = () => {
    if (selectedImageIndex !== null && selectedImageIndex > 0) {
      setSelectedImageIndex(selectedImageIndex - 1)
      setShowFullscreenControls(true)
    }
  }

  const goToNextImage = () => {
    if (selectedImageIndex !== null && selectedImageIndex < userImages.length - 1) {
      setSelectedImageIndex(selectedImageIndex + 1)
      setShowFullscreenControls(true)
    }
  }

  const selectedImage = selectedImageIndex !== null ? userImages[selectedImageIndex] : null

  // Render conversation list header with nav tabs
  const renderListHeader = () => (
    <div className="flex items-center gap-2 mb-3">
      <Button
        variant={view === 'list' ? 'default' : 'outline'}
        size="sm"
        className="rounded-full"
        onClick={() => setView('list')}
      >
        <MessageCircle className="h-4 w-4 mr-1.5" />
        Conversations
      </Button>
      <Button
        variant={view === 'search' ? 'default' : 'outline'}
        size="sm"
        className="rounded-full"
        onClick={() => {
          setView('search')
          setTimeout(() => searchInputRef.current?.focus(), 100)
        }}
      >
        <Search className="h-4 w-4 mr-1.5" />
        Search
      </Button>
      <Button
        variant={view === 'media' ? 'default' : 'outline'}
        size="sm"
        className="rounded-full"
        onClick={() => setView('media')}
      >
        <Images className="h-4 w-4 mr-1.5" />
        Media
      </Button>
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] p-0 flex flex-col overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-4 py-3 border-b flex-shrink-0">
          <div className="flex items-center gap-3">
            {(view === 'conversation' || selectedImageIndex !== null) && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Back"
                className="rounded-full h-9 w-9"
                onClick={() => {
                  if (selectedImageIndex !== null) {
                    setSelectedImageIndex(null)
                  } else {
                    handleBack()
                  }
                }}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg font-semibold flex items-center gap-2">
                {view === 'search' ? (
                  <>
                    <Search className="h-5 w-5 text-blue-600" />
                    Search Messages
                  </>
                ) : view === 'media' ? (
                  <>
                    <Images className="h-5 w-5 text-purple-600" />
                    Media Gallery
                  </>
                ) : view === 'conversation' && selectedConversation ? (
                  <>
                    <MessageCircle className="h-5 w-5 text-blue-600" />
                    <span className="truncate">
                      Chat with {getOtherParticipant(selectedConversation).name || 'Unknown'}
                    </span>
                  </>
                ) : (
                  <>
                    <MessageCircle className="h-5 w-5 text-blue-600" />
                    Messages for {userName || 'User'}
                  </>
                )}
              </DialogTitle>
              <p className="text-xs text-stone-500 mt-0.5">
                Admin view — {view === 'search' ? `Searching all messages for ${userName || 'user'}` : 
                              view === 'media' ? `Viewing images for ${userName || 'user'}` :
                              `Viewing as ${userName || 'user'}`}
              </p>
            </div>
            {view === 'list' && (
              <Badge variant="secondary" className="rounded-full">
                {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
              </Badge>
            )}
            {view === 'media' && (
              <Badge variant="secondary" className="rounded-full">
                {imagesTotal} image{imagesTotal !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {view === 'list' ? (
            // Conversations List View
            <div className="h-full flex flex-col">
              {/* Nav tabs and Search */}
              <div className="px-4 py-3 border-b">
                {renderListHeader()}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                  <input
                    type="text"
                    aria-label="Filter conversations"
                    placeholder="Filter conversations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-xl bg-stone-100 dark:bg-[#2a2a2d] border-0 focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>

              {/* Conversations List */}
              <div className="flex-1 overflow-y-auto">
                {conversationsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                    <span className="ml-2 text-sm text-stone-500">Loading conversations...</span>
                  </div>
                ) : filteredConversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                    <div className="w-16 h-16 rounded-full bg-stone-100 dark:bg-[#2a2a2d] flex items-center justify-center mb-4">
                      <MessageCircle className="h-8 w-8 text-stone-400" />
                    </div>
                    <p className="text-stone-500">
                      {searchQuery ? 'No matching conversations' : 'No conversations found'}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-stone-100 dark:divide-[#2a2a2d]">
                    {filteredConversations.map((conv) => {
                      const other = getOtherParticipant(conv)
                      return (
                        <button
                          key={conv.id}
                          onClick={() => handleSelectConversation(conv)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-stone-50 dark:hover:bg-[#1a1a1c] transition-colors text-left"
                        >
                          {/* Avatar */}
                          <div className="flex-shrink-0">
                            {other.avatar ? (
                              <img
                                src={other.avatar}
                                alt=""
                                className="w-12 h-12 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-lg font-semibold">
                                {(other.name || 'U').charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-0.5">
                              <span className="font-semibold text-stone-900 dark:text-white truncate">
                                {other.name || 'Unknown User'}
                              </span>
                              <span className="text-xs text-stone-400 flex-shrink-0">
                                {formatRelativeTime(conv.lastMessageAt)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-stone-500">
                              <span>{conv.messageCount || 0} messages</span>
                              <span>•</span>
                              <span>Started {formatRelativeTime(conv.createdAt)}</span>
                            </div>
                          </div>
                          
                          <ChevronRight className="h-5 w-5 text-stone-300 flex-shrink-0" />
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : view === 'search' ? (
            // Search View
            <div className="h-full flex flex-col">
              {/* Nav tabs and Search Input */}
              <div className="px-4 py-3 border-b">
                {renderListHeader()}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    aria-label="Search in message content"
                    placeholder="Search in message content..."
                    value={messageSearchQuery}
                    onChange={(e) => setMessageSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-10 py-2 rounded-xl bg-stone-100 dark:bg-[#2a2a2d] border-0 focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  {messageSearchQuery && (
                    <button
                      type="button"
                      aria-label="Clear search"
                      onClick={() => setMessageSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-stone-500 mt-2">
                  Search through all messages in conversations involving {userName || 'this user'}
                </p>
              </div>

              {/* Search Results */}
              <div className="flex-1 overflow-y-auto">
                {searchLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                    <span className="ml-2 text-sm text-stone-500">Searching...</span>
                  </div>
                ) : !hasSearched ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                    <div className="w-16 h-16 rounded-full bg-stone-100 dark:bg-[#2a2a2d] flex items-center justify-center mb-4">
                      <Search className="h-8 w-8 text-stone-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-2">
                      Search Messages
                    </h3>
                    <p className="text-sm text-stone-500 max-w-xs">
                      Enter at least 2 characters to search through message content.
                    </p>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                    <div className="w-16 h-16 rounded-full bg-stone-100 dark:bg-[#2a2a2d] flex items-center justify-center mb-4">
                      <MessageCircle className="h-8 w-8 text-stone-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-2">
                      No Results
                    </h3>
                    <p className="text-sm text-stone-500 max-w-xs">
                      No messages found matching "{messageSearchQuery}"
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-stone-100 dark:divide-[#2a2a2d]">
                    <div className="px-4 py-2.5 bg-stone-50 dark:bg-[#1a1a1c] sticky top-0 z-10">
                      <p className="text-xs text-stone-500 font-medium">
                        {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    {searchResults.map((msg) => {
                      const isOwnMessage = msg.senderId === userId
                      const isImage = isImageMessage(msg.content)
                      
                      return (
                        <div
                          key={msg.id}
                          className="px-4 py-3 hover:bg-stone-50 dark:hover:bg-[#1a1a1c] transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            {/* Avatar */}
                            <div className="flex-shrink-0 mt-0.5">
                              {msg.senderAvatar ? (
                                <img
                                  src={msg.senderAvatar}
                                  alt=""
                                  className="w-10 h-10 rounded-full object-cover"
                                />
                              ) : (
                                <div className={cn(
                                  "w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold",
                                  isOwnMessage 
                                    ? "bg-gradient-to-br from-blue-400 to-blue-600" 
                                    : "bg-gradient-to-br from-stone-300 to-stone-400"
                                )}>
                                  {(msg.senderName || 'U').charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                            
                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-stone-900 dark:text-white text-sm">
                                    {msg.senderName || 'Unknown'}
                                  </span>
                                  {isOwnMessage && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                      {userName || 'User'}
                                    </Badge>
                                  )}
                                  <span className="text-xs text-stone-400">→</span>
                                  <span className="text-xs text-stone-500">
                                    {isOwnMessage ? (msg.otherUserName || 'Unknown') : (userName || 'User')}
                                  </span>
                                </div>
                                <span className="text-xs text-stone-400 flex-shrink-0">
                                  {formatRelativeTime(msg.createdAt)}
                                </span>
                              </div>
                              
                              {isImage ? (
                                <div className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-300">
                                  <ImageIcon className="h-4 w-4" />
                                  <span>📷 Image</span>
                                  {msg.content.includes(']') && msg.content.split(']')[1]?.trim() && (
                                    <span>- {highlightText(msg.content.split(']')[1].trim(), messageSearchQuery)}</span>
                                  )}
                                </div>
                              ) : (
                                <p className="text-sm text-stone-600 dark:text-stone-300 line-clamp-2">
                                  {highlightText(msg.content, messageSearchQuery)}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : view === 'media' ? (
            // Media Gallery View
            <div className="h-full flex flex-col">
              {/* Nav tabs and Filter */}
              <div className="px-4 py-3 border-b">
                {renderListHeader()}
                <div className="flex items-center gap-3 mt-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={imagesSentOnly}
                      onChange={(e) => setImagesSentOnly(e.target.checked)}
                      className="rounded border-stone-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-stone-600 dark:text-stone-300">
                      Only images sent by {userName || 'user'}
                    </span>
                  </label>
                </div>
              </div>

              {/* Images Grid */}
              <div className="flex-1 overflow-y-auto p-2">
                {imagesLoading && userImages.length === 0 ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                    <span className="ml-2 text-sm text-stone-500">Loading images...</span>
                  </div>
                ) : userImages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                    <div className="w-16 h-16 rounded-full bg-stone-100 dark:bg-[#2a2a2d] flex items-center justify-center mb-4">
                      <Images className="h-8 w-8 text-stone-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-2">
                      No Images
                    </h3>
                    <p className="text-sm text-stone-500 max-w-xs">
                      {imagesSentOnly 
                        ? `${userName || 'This user'} hasn't sent any images.`
                        : `No images found in ${userName || 'this user'}'s conversations.`
                      }
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5">
                      {userImages.map((img, index) => (
                        <div key={img.id} className="relative group aspect-square">
                          <button
                            type="button"
                            onClick={() => setSelectedImageIndex(index)}
                            className="w-full h-full rounded-lg overflow-hidden bg-stone-100 dark:bg-[#2a2a2d] focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <img
                              src={img.imageUrl}
                              alt={img.caption || ''}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                            {/* Sent/Received indicator */}
                            <div className={cn(
                              "absolute top-1 left-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                              img.isSentByUser 
                                ? "bg-blue-500 text-white" 
                                : "bg-stone-800/70 text-white"
                            )}>
                              {img.isSentByUser ? 'Sent' : 'Received'}
                            </div>
                          </button>
                          
                          {/* Quick download button */}
                          <button
                            type="button"
                            aria-label="Download image"
                            onClick={(e) => {
                              e.stopPropagation()
                              downloadImage(img, index)
                            }}
                            className={cn(
                              "absolute bottom-1 right-1 p-1.5 rounded-full transition-all",
                              "bg-black/60 text-white focus-visible:outline-none",
                              "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-white",
                              "active:scale-95",
                              downloadSuccess === img.id && "bg-green-500"
                            )}
                            disabled={downloadingId === img.id}
                          >
                            {downloadingId === img.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : downloadSuccess === img.id ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : (
                              <Download className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                    
                    {/* Load more */}
                    {userImages.length < imagesTotal && (
                      <div className="flex justify-center py-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => loadUserImages(false)}
                          disabled={imagesLoading}
                        >
                          {imagesLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : null}
                          Load more ({imagesTotal - userImages.length} remaining)
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Fullscreen Image Viewer */}
              {selectedImage && (
                <div 
                  className="fixed inset-0 z-[100] bg-black flex flex-col"
                  onClick={() => setShowFullscreenControls(prev => !prev)}
                >
                  {/* Top bar */}
                  <div className={cn(
                    "absolute top-0 left-0 right-0 z-10 transition-opacity duration-200",
                    showFullscreenControls ? "opacity-100" : "opacity-0 pointer-events-none"
                  )}>
                    <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
                      <div className="flex items-center gap-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Close fullscreen"
                          className="rounded-full h-10 w-10 text-white hover:bg-white/20"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedImageIndex(null)
                          }}
                        >
                          <X className="h-5 w-5" />
                        </Button>
                        <div>
                          <p className="text-sm text-white font-medium">
                            {selectedImage.senderName || 'Unknown'}
                            {selectedImage.isSentByUser && (
                              <span className="ml-2 text-xs text-blue-400">(Sent by {userName})</span>
                            )}
                          </p>
                          <p className="text-xs text-white/70">
                            {formatImageDate(selectedImage.createdAt)} • To {selectedImage.otherUserName || 'Unknown'}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm text-white/80 px-3 py-1 rounded-full bg-black/30">
                        {selectedImageIndex !== null ? selectedImageIndex + 1 : 0} / {userImages.length}
                      </span>
                    </div>
                  </div>
                  
                  {/* Image */}
                  <div className="flex-1 flex items-center justify-center p-4">
                    <img
                      src={selectedImage.imageUrl}
                      alt={selectedImage.caption || ''}
                      className="max-w-full max-h-full object-contain select-none"
                      draggable={false}
                    />
                  </div>
                  
                  {/* Caption */}
                  {selectedImage.caption && (
                    <div className={cn(
                      "absolute bottom-20 left-0 right-0 px-4 transition-opacity duration-200",
                      showFullscreenControls ? "opacity-100" : "opacity-0"
                    )}>
                      <p className="text-white text-center text-sm bg-black/40 backdrop-blur-sm rounded-lg px-4 py-2 mx-auto max-w-md">
                        {selectedImage.caption}
                      </p>
                    </div>
                  )}
                  
                  {/* Bottom actions */}
                  <div className={cn(
                    "absolute bottom-0 left-0 right-0 z-10 transition-opacity duration-200",
                    showFullscreenControls ? "opacity-100" : "opacity-0 pointer-events-none"
                  )}>
                    <div className="bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-8 pb-4 px-4">
                      <div className="flex items-center justify-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            downloadImage(selectedImage, selectedImageIndex || 0)
                          }}
                          disabled={downloadingId === selectedImage.id}
                          className={cn(
                            "flex flex-col items-center gap-1 p-3 rounded-xl transition-colors",
                            "hover:bg-white/10 active:bg-white/20",
                            downloadSuccess === selectedImage.id && "bg-green-500/20"
                          )}
                        >
                          <div className={cn(
                            "w-14 h-14 rounded-full flex items-center justify-center transition-colors",
                            downloadSuccess === selectedImage.id 
                              ? "bg-green-500" 
                              : "bg-blue-500 hover:bg-blue-600"
                          )}>
                            {downloadingId === selectedImage.id ? (
                              <Loader2 className="h-7 w-7 text-white animate-spin" />
                            ) : downloadSuccess === selectedImage.id ? (
                              <Check className="h-7 w-7 text-white" />
                            ) : (
                              <Download className="h-7 w-7 text-white" />
                            )}
                          </div>
                          <span className="text-xs text-white/80">
                            {downloadSuccess === selectedImage.id ? 'Saved' : 'Save'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Navigation arrows */}
                  {selectedImageIndex !== null && selectedImageIndex > 0 && (
                    <button
                      type="button"
                      aria-label="Previous image"
                      className={cn(
                        "absolute left-2 top-1/2 -translate-y-1/2 p-2 transition-opacity duration-200",
                        "text-white",
                        showFullscreenControls ? "opacity-100" : "opacity-0 pointer-events-none"
                      )}
                      onClick={(e) => {
                        e.stopPropagation()
                        goToPreviousImage()
                      }}
                    >
                      <div className="p-2 rounded-full bg-black/40 hover:bg-black/60">
                        <ChevronLeft className="h-8 w-8" />
                      </div>
                    </button>
                  )}
                  {selectedImageIndex !== null && selectedImageIndex < userImages.length - 1 && (
                    <button
                      type="button"
                      aria-label="Next image"
                      className={cn(
                        "absolute right-2 top-1/2 -translate-y-1/2 p-2 transition-opacity duration-200",
                        "text-white",
                        showFullscreenControls ? "opacity-100" : "opacity-0 pointer-events-none"
                      )}
                      onClick={(e) => {
                        e.stopPropagation()
                        goToNextImage()
                      }}
                    >
                      <div className="p-2 rounded-full bg-black/40 hover:bg-black/60">
                        <ChevronRight className="h-8 w-8" />
                      </div>
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            // Conversation View
            <div className="h-full flex flex-col">
              {/* Messages Container */}
              <div
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto px-4 py-4"
              >
                {messagesLoading && messages.length === 0 ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                    <span className="ml-2 text-sm text-stone-500">Loading messages...</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <MessageCircle className="h-12 w-12 text-stone-300 mb-4" />
                    <p className="text-stone-500">No messages in this conversation</p>
                  </div>
                ) : (
                  <>
                    {/* Load more button */}
                    {hasMoreMessages && (
                      <div className="flex justify-center py-2 mb-4">
                        <button
                          onClick={handleLoadMore}
                          disabled={messagesLoading}
                          className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                        >
                          {messagesLoading ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            'Load earlier messages'
                          )}
                        </button>
                      </div>
                    )}

                    {/* Messages grouped by date */}
                    {groupedMessages.map((group, groupIdx) => (
                      <div key={groupIdx}>
                        {/* Date separator */}
                        <div className="flex items-center justify-center my-4">
                          <span className="text-xs font-medium text-stone-400 bg-stone-100 dark:bg-[#2a2a2d] px-3 py-1.5 rounded-full">
                            {formatDateSeparator(group.date)}
                          </span>
                        </div>

                        {/* Messages */}
                        <div className="space-y-2">
                          {group.messages.map((msg, msgIdx) => {
                            const isOwnMessage = msg.senderId === userId
                            const showAvatar = msgIdx === 0 || group.messages[msgIdx - 1]?.senderId !== msg.senderId
                            
                            return (
                              <div
                                key={msg.id}
                                className={cn(
                                  "flex gap-2",
                                  isOwnMessage ? "flex-row-reverse" : "flex-row"
                                )}
                              >
                                {/* Avatar */}
                                <div className="w-8 flex-shrink-0">
                                  {showAvatar && !isOwnMessage && (
                                    msg.senderAvatar ? (
                                      <img
                                        src={msg.senderAvatar}
                                        alt=""
                                        className="w-8 h-8 rounded-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-stone-300 to-stone-400 flex items-center justify-center text-white text-xs font-semibold">
                                        {(msg.senderName || 'U').charAt(0).toUpperCase()}
                                      </div>
                                    )
                                  )}
                                </div>

                                {/* Message bubble */}
                                <div
                                  className={cn(
                                    "max-w-[70%] rounded-2xl px-4 py-2",
                                    isOwnMessage
                                      ? "bg-blue-500 text-white"
                                      : "bg-stone-100 dark:bg-[#2a2a2d] text-stone-900 dark:text-white",
                                    msg.deletedAt && "opacity-60"
                                  )}
                                >
                                  {/* Reply preview */}
                                  {msg.replyTo && (
                                    <div className={cn(
                                      "text-xs mb-2 pb-2 border-b",
                                      isOwnMessage ? "border-blue-400/30" : "border-stone-200 dark:border-stone-600"
                                    )}>
                                      <div className="flex items-center gap-1 mb-0.5">
                                        <Reply className="h-3 w-3" />
                                        <span className="font-medium">{msg.replyTo.senderName || 'Unknown'}</span>
                                      </div>
                                      <p className="truncate opacity-75">
                                        {isImageMessage(msg.replyTo.content) ? '📷 Photo' : msg.replyTo.content}
                                      </p>
                                    </div>
                                  )}

                                  {/* Content */}
                                  {msg.deletedAt ? (
                                    <p className="italic text-sm flex items-center gap-1">
                                      <Trash2 className="h-3 w-3" />
                                      Message deleted
                                    </p>
                                  ) : isImageMessage(msg.content) ? (
                                    <div>
                                      <img
                                        src={parseImageUrl(msg.content)}
                                        alt="Shared image"
                                        className="max-w-full rounded-lg cursor-pointer hover:opacity-90"
                                        onClick={() => window.open(parseImageUrl(msg.content), '_blank')}
                                      />
                                      {/* Caption if any */}
                                      {msg.content.includes(']') && msg.content.split(']')[1]?.trim() && (
                                        <p className="mt-2 text-sm whitespace-pre-wrap break-words">
                                          {msg.content.split(']')[1].trim()}
                                        </p>
                                      )}
                                    </div>
                                  ) : (
                                    <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                                  )}

                                  {/* Link preview */}
                                  {msg.linkType && msg.linkUrl && (
                                    <a
                                      href={msg.linkUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className={cn(
                                        "mt-2 flex items-center gap-2 text-xs rounded-lg p-2",
                                        isOwnMessage ? "bg-blue-600/50" : "bg-stone-200 dark:bg-stone-700"
                                      )}
                                    >
                                      <LinkIcon className="h-3 w-3" />
                                      <span className="truncate">{msg.linkUrl}</span>
                                    </a>
                                  )}

                                  {/* Reactions */}
                                  {msg.reactions && msg.reactions.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                      {msg.reactions.map((r) => (
                                        <span
                                          key={r.id}
                                          className={cn(
                                            "inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full",
                                            isOwnMessage ? "bg-blue-600/50" : "bg-stone-200 dark:bg-stone-600"
                                          )}
                                          title={r.userName || 'Unknown'}
                                        >
                                          {r.emoji}
                                        </span>
                                      ))}
                                    </div>
                                  )}

                                  {/* Metadata */}
                                  <div className={cn(
                                    "flex items-center gap-2 mt-1 text-[10px]",
                                    isOwnMessage ? "text-blue-200" : "text-stone-400"
                                  )}>
                                    <span>{formatMessageTime(msg.createdAt)}</span>
                                    {msg.editedAt && (
                                      <span className="flex items-center gap-0.5">
                                        <Edit2 className="h-2.5 w-2.5" /> edited
                                      </span>
                                    )}
                                    {msg.readAt && isOwnMessage && (
                                      <span>Read</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Admin notice footer */}
              <div className="px-4 py-3 border-t bg-amber-50 dark:bg-amber-900/20">
                <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Read-only admin view. Messages shown from {userName || 'user'}'s perspective.</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default AdminUserMessagesDialog
