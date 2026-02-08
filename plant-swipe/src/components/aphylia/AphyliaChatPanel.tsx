/**
 * Aphylia Chat Panel
 * 
 * The main chat interface for the AI gardening assistant.
 * Features streaming responses, context chips, quick actions, and image attachments.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send,
  Image as ImageIcon,
  Camera,
  X,
  Loader2,
  Sparkles,
  Leaf,
  ChevronDown,
  ChevronUp,
  Trash2,
  StopCircle,
  User,
  CheckCircle2,
  AlertCircle,
  FileText
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type {
  ChatMessage,
  ChatAttachment,
  ContextChip,
  QuickActionId
} from '@/types/aphyliaChat'
import { QUICK_ACTIONS, SLASH_COMMANDS } from '@/types/aphyliaChat'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { AphyliaThinkingIndicator } from './AphyliaTypingAnimation'

interface AphyliaChatPanelProps {
  isOpen: boolean
  isMinimized: boolean
  messages: ChatMessage[]
  input: string
  pendingAttachments: ChatAttachment[]
  selectedChips: ContextChip[]
  isSending: boolean
  isStreaming: boolean
  onClose: () => void
  onToggleMinimize: () => void
  onInputChange: (value: string) => void
  onSendMessage: (content?: string) => void
  onUploadImage: (file: File) => Promise<void>
  onRemoveAttachment: (id: string) => void
  onClearMessages: () => void
  onQuickAction: (actionId: QuickActionId) => void
  onAbortStream: () => void
  gardenName?: string
  className?: string
}

// Context chip colors
const chipColors: Record<string, string> = {
  garden: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  plant: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  task: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  note: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
}

// Message component
const ChatMessageBubble: React.FC<{ message: ChatMessage; isLatest?: boolean }> = ({ 
  message, 
  isLatest: _isLatest 
}) => {
  const isUser = message.role === 'user'
  const isStreaming = message.isStreaming
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex gap-3 p-3',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar */}
      <div className={cn(
        'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
        isUser 
          ? 'bg-blue-100 dark:bg-blue-900/50' 
          : 'bg-gradient-to-br from-emerald-400 to-emerald-600'
      )}>
        {isUser ? (
          <User className="w-4 h-4 text-blue-600 dark:text-blue-300" />
        ) : (
          <Sparkles className="w-4 h-4 text-white" />
        )}
      </div>
      
      {/* Content */}
      <div className={cn(
        'flex-1 max-w-[85%]',
        isUser ? 'items-end' : 'items-start'
      )}>
        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {message.attachments.map(att => (
              <div 
                key={att.id}
                className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700"
              >
                <img 
                  src={att.localPreviewUrl || att.url} 
                  alt="Attachment"
                  className="w-32 h-32 object-cover"
                />
              </div>
            ))}
          </div>
        )}
        
        {/* Message bubble */}
        <div className={cn(
          'rounded-2xl px-4 py-2.5',
          isUser 
            ? 'bg-blue-500 text-white rounded-br-sm' 
            : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-sm',
          message.error && 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800'
        )}>
          {/* 3D Streaming/Thinking indicator */}
          {isStreaming && !message.content && (
            <AphyliaThinkingIndicator compact />
          )}
          
          {/* Message content */}
          {message.content && (
            <div className={cn(
              'text-sm whitespace-pre-wrap break-words',
              '[&>p]:mb-2 [&>p:last-child]:mb-0',
              '[&>ul]:list-disc [&>ul]:ml-4 [&>ul]:mb-2',
              '[&>ol]:list-decimal [&>ol]:ml-4 [&>ol]:mb-2',
              '[&>code]:bg-gray-200 [&>code]:dark:bg-gray-700 [&>code]:px-1 [&>code]:rounded'
            )}>
              {message.content}
            </div>
          )}
          
          {/* Streaming cursor - subtle blinking line */}
          {isStreaming && message.content && (
            <span className="inline-block w-0.5 h-4 bg-emerald-500 animate-pulse ml-0.5 rounded-full" />
          )}
          
          {/* Error indicator */}
          {message.error && (
            <div className="flex items-center gap-2 mt-2 text-red-600 dark:text-red-400 text-xs">
              <AlertCircle className="w-3 h-3" />
              <span>{message.error}</span>
            </div>
          )}
        </div>
        
        {/* Timestamp */}
        <div className={cn(
          'text-xs text-gray-400 mt-1 px-1',
          isUser ? 'text-right' : 'text-left'
        )}>
          {new Date(message.createdAt).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </div>
      </div>
    </motion.div>
  )
}

// Context chip component
const ContextChipBadge: React.FC<{
  chip: ContextChip
  onRemove?: () => void
  selectable?: boolean
  onSelect?: () => void
}> = ({ chip, onRemove, selectable, onSelect }) => {
  const chipIcons: Record<string, React.ReactNode> = {
    garden: <Leaf className="w-3 h-3" />,
    plant: <Leaf className="w-3 h-3" />,
    task: <CheckCircle2 className="w-3 h-3" />,
    note: <FileText className="w-3 h-3" />
  }
  
  return (
    <motion.button
      onClick={selectable ? onSelect : undefined}
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
        'transition-all duration-200',
        chipColors[chip.type] || 'bg-gray-100 text-gray-800',
        selectable && 'cursor-pointer hover:opacity-80',
        !selectable && 'cursor-default'
      )}
      whileHover={selectable ? { scale: 1.02 } : undefined}
      whileTap={selectable ? { scale: 0.98 } : undefined}
    >
      {chipIcons[chip.type]}
      <span className="truncate max-w-[100px]">{chip.label}</span>
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="ml-0.5 hover:bg-black/10 rounded-full p-0.5"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </motion.button>
  )
}

// Quick action button - larger on mobile for better touch targets
const QuickActionButton: React.FC<{
  action: typeof QUICK_ACTIONS[0]
  onClick: () => void
  disabled?: boolean
}> = ({ action, onClick, disabled }) => {
  const { t } = useTranslation('common')
  
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center gap-3 md:gap-2 px-4 md:px-3 py-3 md:py-2 rounded-xl',
        'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
        'hover:border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20',
        'active:bg-emerald-100 dark:active:bg-emerald-900/30',
        'transition-all duration-200 text-base md:text-sm',
        'disabled:opacity-50 disabled:cursor-not-allowed'
      )}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <span className="text-xl md:text-lg">{action.icon}</span>
      <span className="text-gray-700 dark:text-gray-300 text-left">
        {t(action.labelKey, action.id)}
      </span>
    </motion.button>
  )
}

export const AphyliaChatPanel: React.FC<AphyliaChatPanelProps> = ({
  isOpen,
  isMinimized,
  messages,
  input,
  pendingAttachments,
  selectedChips,
  isSending,
  isStreaming,
  onClose,
  onToggleMinimize,
  onInputChange,
  onSendMessage,
  onUploadImage,
  onRemoveAttachment,
  onClearMessages,
  onQuickAction,
  onAbortStream,
  gardenName,
  className
}) => {
  const { t } = useTranslation('common')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [showSlashCommands, setShowSlashCommands] = useState(false)
  
  // Hide mobile nav bar when chat is open on mobile
  useEffect(() => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
    if (isOpen && !isMinimized && isMobile) {
      document.body.classList.add('aphylia-chat-open')
    } else {
      document.body.classList.remove('aphylia-chat-open')
    }
    return () => {
      document.body.classList.remove('aphylia-chat-open')
    }
  }, [isOpen, isMinimized])
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])
  
  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen, isMinimized])
  
  // Handle input change with slash command detection
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    onInputChange(value)
    
    // Show slash commands if input starts with /
    if (value.startsWith('/') && value.length < 20) {
      setShowSlashCommands(true)
    } else {
      setShowSlashCommands(false)
    }
  }, [onInputChange])
  
  // Handle key press
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      
      // Check for slash command
      const matchedCommand = Object.entries(SLASH_COMMANDS).find(
        ([cmd]) => input.toLowerCase().startsWith(cmd)
      )
      
      if (matchedCommand) {
        onQuickAction(matchedCommand[1])
        onInputChange('')
        setShowSlashCommands(false)
      } else if (input.trim() || pendingAttachments.length > 0) {
        onSendMessage()
      }
    }
    
    if (e.key === 'Escape') {
      setShowSlashCommands(false)
    }
  }, [input, pendingAttachments, onSendMessage, onQuickAction, onInputChange])
  
  // Handle file upload
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    
    for (const file of Array.from(files)) {
      await onUploadImage(file)
    }
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [onUploadImage])
  
  // Handle slash command selection
  const handleSlashCommand = useCallback((actionId: QuickActionId) => {
    onQuickAction(actionId)
    onInputChange('')
    setShowSlashCommands(false)
    inputRef.current?.focus()
  }, [onQuickAction, onInputChange])
  
  // Filter slash commands based on input
  const filteredCommands = Object.entries(SLASH_COMMANDS).filter(
    ([cmd]) => cmd.toLowerCase().startsWith(input.toLowerCase())
  )
  
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className={cn(
            // Mobile: full screen with safe areas
            'fixed z-50',
            'inset-0 md:inset-auto',
            // Desktop: positioned panel
            'md:bottom-24 md:right-6',
            'md:w-[400px] md:max-w-[calc(100vw-48px)]',
            'bg-white dark:bg-gray-900',
            'md:rounded-2xl shadow-2xl',
            'md:border md:border-gray-200 md:dark:border-gray-800',
            'flex flex-col',
            'overflow-hidden',
            // Height handling
            isMinimized 
              ? 'h-14' 
              : 'h-full md:h-[600px] md:max-h-[calc(100vh-140px)]',
            className
          )}
        >
          {/* Header - taller on mobile with safe area */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 md:py-3 pt-[max(env(safe-area-inset-top),12px)] border-b border-gray-200 dark:border-gray-800 bg-gradient-to-r from-emerald-500 to-emerald-600">
            <div className="flex items-center gap-3">
              {/* Close button on mobile (acts as back) */}
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="w-9 h-9 md:hidden text-white/90 hover:text-white hover:bg-white/20 -ml-1"
              >
                <X className="w-5 h-5" />
              </Button>
              
              <div className="w-9 h-9 md:w-8 md:h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Sparkles className="w-5 h-5 md:w-4 md:h-4 text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-base md:text-sm">Aphylia</h3>
                <p className="text-emerald-100 text-xs">
                  {gardenName ? `Helping with ${gardenName}` : 'Your gardening assistant'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClearMessages}
                  className="w-9 h-9 md:w-8 md:h-8 text-white/70 hover:text-white hover:bg-white/20"
                  title="Clear chat"
                >
                  <Trash2 className="w-5 h-5 md:w-4 md:h-4" />
                </Button>
              )}
              {/* Minimize only on desktop */}
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleMinimize}
                className="hidden md:flex w-8 h-8 text-white/70 hover:text-white hover:bg-white/20"
              >
                {isMinimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
              {/* Close on desktop only (mobile has it on left) */}
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="hidden md:flex w-8 h-8 text-white/70 hover:text-white hover:bg-white/20"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          {!isMinimized && (
            <>
              {messages.length === 0 && (
                <div className="flex-shrink-0 px-4 py-2 border-b border-amber-200/70 dark:border-amber-900/50 bg-amber-50/80 dark:bg-amber-900/20">
                  <div className="flex items-start gap-2 text-xs text-amber-900 dark:text-amber-200 leading-snug">
                    <AlertCircle className="w-4 h-4 mt-0.5 text-amber-600 dark:text-amber-400" />
                    <p>
                      Image analysis is not properly trained on plants and may make mistakes. Prefer the{' '}
                      <Link
                        to="/scan"
                        className="font-semibold text-emerald-700 dark:text-emerald-300 underline decoration-emerald-400/70 hover:decoration-emerald-500"
                      >
                        Scan
                      </Link>{' '}
                      feature for best results.
                    </p>
                  </div>
                </div>
              )}
              {/* Messages area */}
              <div className="flex-1 overflow-y-auto">
                {messages.length === 0 ? (
                  /* Welcome screen with quick actions */
                  <div className="p-4 md:p-4 space-y-5 md:space-y-4">
                    <div className="text-center py-4 md:py-6">
                      <div className="w-20 h-20 md:w-16 md:h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                        <Leaf className="w-10 h-10 md:w-8 md:h-8 text-white" />
                      </div>
                      <h4 className="text-xl md:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 md:mb-1">
                        {t('aphylia.welcome', 'Hi! I\'m Aphylia 🌱')}
                      </h4>
                      <p className="text-base md:text-sm text-gray-500 dark:text-gray-400 px-4 md:px-0">
                        {t('aphylia.welcomeDesc', 'Your AI gardening assistant. Ask me anything about your plants!')}
                      </p>
                    </div>
                    
                    {/* Quick actions - single column on mobile, 2 columns on desktop */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide px-1">
                        {t('aphylia.quickActions.title', 'Quick Actions')}
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {QUICK_ACTIONS.slice(0, 6).map(action => (
                          <QuickActionButton
                            key={action.id}
                            action={action}
                            onClick={() => onQuickAction(action.id)}
                            disabled={isSending}
                          />
                        ))}
                      </div>
                    </div>
                    
                    {/* Active context indicator - garden context is always included */}
                    {selectedChips.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide px-1">
                          {t('aphylia.context.activeTitle', 'Context')}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {selectedChips.map(chip => (
                            <ContextChipBadge
                              key={`${chip.type}-${chip.id}`}
                              chip={chip}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Messages list */
                  <div className="py-2">
                    {messages.map((msg, idx) => (
                      <ChatMessageBubble
                        key={msg.id}
                        message={msg}
                        isLatest={idx === messages.length - 1}
                      />
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>
              
              {/* Active context chips (always included, non-removable) */}
              {selectedChips.length > 0 && messages.length > 0 && (
                <div className="flex-shrink-0 px-3 py-2 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex flex-wrap gap-1.5">
                    {selectedChips.map(chip => (
                      <ContextChipBadge
                        key={`selected-${chip.type}-${chip.id}`}
                        chip={chip}
                      />
                    ))}
                  </div>
                </div>
              )}
              
              {/* Pending attachments */}
              {pendingAttachments.length > 0 && (
                <div className="flex-shrink-0 px-3 py-2 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex flex-wrap gap-2">
                    {pendingAttachments.map(att => (
                      <div 
                        key={att.id}
                        className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 group"
                      >
                        <img 
                          src={att.localPreviewUrl || att.url} 
                          alt="Attachment preview"
                          className="w-16 h-16 object-cover"
                        />
                        {att.status === 'uploading' && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <Loader2 className="w-5 h-5 text-white animate-spin" />
                          </div>
                        )}
                        {att.status === 'error' && (
                          <div className="absolute inset-0 bg-red-500/80 flex items-center justify-center">
                            <AlertCircle className="w-5 h-5 text-white" />
                          </div>
                        )}
                        <button
                          onClick={() => onRemoveAttachment(att.id)}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Slash commands dropdown */}
              <AnimatePresence>
                {showSlashCommands && filteredCommands.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute bottom-[72px] left-3 right-3 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
                  >
                    {filteredCommands.map(([cmd, actionId]) => {
                      const action = QUICK_ACTIONS.find(a => a.id === actionId)
                      if (!action) return null
                      return (
                        <button
                          key={cmd}
                          onClick={() => handleSlashCommand(actionId)}
                          className="w-full px-3 py-2 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                        >
                          <span className="text-lg">{action.icon}</span>
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {cmd}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {t(action.labelKey, action.id)}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
              
              {/* Input area - with safe area padding on mobile */}
              <div className="flex-shrink-0 p-3 pb-[max(env(safe-area-inset-bottom),12px)] md:pb-3 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                <div className="flex items-center gap-1.5">
                  {/* Gallery upload button */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    multiple
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSending}
                    className="flex-shrink-0 w-10 h-10 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                    title={t('aphylia.uploadFromGallery', 'Upload from gallery')}
                  >
                    <ImageIcon className="w-5 h-5" />
                  </Button>
                  
                  {/* Camera capture button */}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    id="camera-input"
                    onChange={handleFileChange}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => document.getElementById('camera-input')?.click()}
                    disabled={isSending}
                    className="flex-shrink-0 w-10 h-10 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                    title={t('aphylia.takePhoto', 'Take a photo')}
                  >
                    <Camera className="w-5 h-5" />
                  </Button>
                  
                  {/* Text input */}
                  <div className="flex-1 relative">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyDown}
                      placeholder={t('aphylia.placeholder', 'Ask me about your garden...')}
                      disabled={isSending}
                      rows={1}
                      className={cn(
                        'w-full px-3 py-2 rounded-xl resize-none',
                        'bg-gray-100 dark:bg-gray-800',
                        'border border-transparent focus:border-emerald-300 dark:focus:border-emerald-700',
                        'focus:outline-none focus:ring-0',
                        'text-base md:text-sm text-gray-900 dark:text-gray-100',
                        'placeholder:text-gray-400 dark:placeholder:text-gray-500',
                        'disabled:opacity-50',
                        'max-h-32',
                        'h-10' // Fixed height to match buttons
                      )}
                    />
                  </div>
                  
                  {/* Send/Stop button */}
                  {isStreaming ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onAbortStream}
                      className="flex-shrink-0 w-10 h-10 rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <StopCircle className="w-5 h-5" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onSendMessage()}
                      disabled={isSending || (!input.trim() && pendingAttachments.length === 0)}
                      className={cn(
                        'flex-shrink-0 w-10 h-10',
                        'bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl',
                        'disabled:opacity-50 disabled:hover:bg-emerald-500'
                      )}
                    >
                      {isSending ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Send className="w-5 h-5" />
                      )}
                    </Button>
                  )}
                </div>
                
                {/* Hint - hidden on mobile for cleaner UI */}
                <div className="hidden md:block mt-2 text-xs text-gray-400 text-center">
                  {t('aphylia.hint', 'Type / for commands • Shift+Enter for new line')}
                </div>
              </div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default AphyliaChatPanel
