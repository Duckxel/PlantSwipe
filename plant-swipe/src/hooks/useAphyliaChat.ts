/**
 * Aphylia Chat Hook
 * 
 * Manages the state and API interactions for the in-app AI gardening assistant.
 * Messages are ephemeral (session-only) and not persisted to database.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import type {
  ChatMessage,
  ChatAttachment,
  ContextChip,
  GardenContext,
  PlantContext,
  QuickActionId,
  StreamEvent,
  ChatContext,
  AphyliaChatState
} from '@/types/aphyliaChat'

// Re-export for convenience
export { QUICK_ACTIONS, SLASH_COMMANDS } from '@/types/aphyliaChat'

interface UseAphyliaChatOptions {
  /** Initial garden context */
  gardenContext?: GardenContext | null
  /** Initial plant context */
  plantContext?: PlantContext | null
}

interface UseAphyliaChatReturn {
  /** Current chat state */
  state: AphyliaChatState
  /** Open the chat panel */
  openChat: () => void
  /** Close the chat panel */
  closeChat: () => void
  /** Toggle chat panel visibility */
  toggleChat: () => void
  /** Minimize/restore the chat */
  toggleMinimize: () => void
  /** Update input value */
  setInput: (value: string) => void
  /** Send a message */
  sendMessage: (content?: string, attachments?: ChatAttachment[]) => Promise<void>
  /** Execute a quick action */
  executeQuickAction: (actionId: QuickActionId) => Promise<void>
  /** Upload an image for chat */
  uploadImage: (file: File) => Promise<ChatAttachment | null>
  /** Remove a pending attachment */
  removePendingAttachment: (attachmentId: string) => void
  /** Add a context chip */
  addContextChip: (chip: ContextChip) => void
  /** Remove a context chip */
  removeContextChip: (chipId: string) => void
  /** Clear all messages */
  clearMessages: () => void
  /** Update garden context */
  setGardenContext: (context: GardenContext | null) => void
  /** Update plant context */
  setPlantContext: (context: PlantContext | null) => void
  /** Update available context chips */
  setAvailableChips: (chips: ContextChip[]) => void
  /** Abort current streaming response */
  abortStream: () => void
  /** Is streaming in progress */
  isStreaming: boolean
}

// Generate a unique ID
const generateId = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

// Initial state
const createInitialState = (options?: UseAphyliaChatOptions): AphyliaChatState => ({
  isOpen: false,
  messages: [],
  input: '',
  pendingAttachments: [],
  selectedChips: [],
  isSending: false,
  currentGarden: options?.gardenContext || null,
  currentPlant: options?.plantContext || null,
  availableChips: [],
  isMinimized: false
})

export function useAphyliaChat(options?: UseAphyliaChatOptions): UseAphyliaChatReturn {
  const [state, setState] = useState<AphyliaChatState>(() => createInitialState(options))
  const abortControllerRef = useRef<AbortController | null>(null)
  const isStreamingRef = useRef(false)
  
  // Track streaming state for external consumers
  const [isStreaming, setIsStreaming] = useState(false)
  
  // Update context when options change - use JSON serialization to avoid infinite loops
  // from object reference changes
  const gardenContextJson = options?.gardenContext ? JSON.stringify(options.gardenContext) : null
  const plantContextJson = options?.plantContext ? JSON.stringify(options.plantContext) : null
  
  useEffect(() => {
    const ctx = gardenContextJson ? JSON.parse(gardenContextJson) : null
    setState(prev => {
      // Only update if actually different
      if (JSON.stringify(prev.currentGarden) === gardenContextJson) return prev
      return { ...prev, currentGarden: ctx }
    })
  }, [gardenContextJson])
  
  useEffect(() => {
    const ctx = plantContextJson ? JSON.parse(plantContextJson) : null
    setState(prev => {
      // Only update if actually different
      if (JSON.stringify(prev.currentPlant) === plantContextJson) return prev
      return { ...prev, currentPlant: ctx }
    })
  }, [plantContextJson])
  
  // Open chat panel
  const openChat = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: true, isMinimized: false }))
  }, [])
  
  // Close chat panel
  const closeChat = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: false }))
  }, [])
  
  // Toggle chat panel
  const toggleChat = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      isOpen: !prev.isOpen,
      isMinimized: false
    }))
  }, [])
  
  // Toggle minimize
  const toggleMinimize = useCallback(() => {
    setState(prev => ({ ...prev, isMinimized: !prev.isMinimized }))
  }, [])
  
  // Update input
  const setInput = useCallback((value: string) => {
    setState(prev => ({ ...prev, input: value }))
  }, [])
  
  // Abort current stream
  const abortStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    isStreamingRef.current = false
    setIsStreaming(false)
  }, [])
  
  // Upload image
  const uploadImage = useCallback(async (file: File): Promise<ChatAttachment | null> => {
    const attachmentId = generateId()
    const localPreviewUrl = URL.createObjectURL(file)
    
    // Add pending attachment
    const pendingAttachment: ChatAttachment = {
      id: attachmentId,
      type: 'image',
      url: '',
      localPreviewUrl,
      filename: file.name,
      status: 'uploading'
    }
    
    setState(prev => ({
      ...prev,
      pendingAttachments: [...prev.pendingAttachments, pendingAttachment]
    }))
    
    try {
      const session = (await supabase.auth.getSession()).data.session
      if (!session?.access_token) {
        throw new Error('Not authenticated')
      }
      
      const formData = new FormData()
      formData.append('image', file)
      
      const response = await fetch('/api/ai/garden-chat/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        body: formData
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Upload failed')
      }
      
      const data = await response.json()
      
      // Update attachment with uploaded URL
      const uploadedAttachment: ChatAttachment = {
        ...pendingAttachment,
        url: data.url,
        status: 'uploaded'
      }
      
      setState(prev => ({
        ...prev,
        pendingAttachments: prev.pendingAttachments.map(a => 
          a.id === attachmentId ? uploadedAttachment : a
        )
      }))
      
      return uploadedAttachment
    } catch (err) {
      console.error('[aphylia-chat] Upload error:', err)
      
      // Mark as error
      setState(prev => ({
        ...prev,
        pendingAttachments: prev.pendingAttachments.map(a => 
          a.id === attachmentId 
            ? { ...a, status: 'error' as const, error: (err as Error).message }
            : a
        )
      }))
      
      return null
    }
  }, [])
  
  // Remove pending attachment
  const removePendingAttachment = useCallback((attachmentId: string) => {
    setState(prev => {
      const attachment = prev.pendingAttachments.find(a => a.id === attachmentId)
      if (attachment?.localPreviewUrl) {
        URL.revokeObjectURL(attachment.localPreviewUrl)
      }
      return {
        ...prev,
        pendingAttachments: prev.pendingAttachments.filter(a => a.id !== attachmentId)
      }
    })
  }, [])
  
  // Add context chip
  const addContextChip = useCallback((chip: ContextChip) => {
    setState(prev => {
      // Don't add duplicate chips
      if (prev.selectedChips.some(c => c.type === chip.type && c.id === chip.id)) {
        return prev
      }
      return {
        ...prev,
        selectedChips: [...prev.selectedChips, chip]
      }
    })
  }, [])
  
  // Remove context chip
  const removeContextChip = useCallback((chipId: string) => {
    setState(prev => ({
      ...prev,
      selectedChips: prev.selectedChips.filter(c => c.id !== chipId)
    }))
  }, [])
  
  // Clear messages
  const clearMessages = useCallback(() => {
    abortStream()
    setState(prev => ({
      ...prev,
      messages: [],
      pendingAttachments: [],
      selectedChips: []
    }))
  }, [abortStream])
  
  // Set garden context
  const setGardenContext = useCallback((context: GardenContext | null) => {
    setState(prev => ({ ...prev, currentGarden: context }))
  }, [])
  
  // Set plant context
  const setPlantContext = useCallback((context: PlantContext | null) => {
    setState(prev => ({ ...prev, currentPlant: context }))
  }, [])
  
  // Set available chips
  const setAvailableChips = useCallback((chips: ContextChip[]) => {
    setState(prev => ({ ...prev, availableChips: chips }))
  }, [])
  
  // Send message
  const sendMessage = useCallback(async (content?: string, attachments?: ChatAttachment[]) => {
    const messageContent = content ?? state.input.trim()
    const messageAttachments = attachments ?? state.pendingAttachments.filter(a => a.status === 'uploaded')
    
    if (!messageContent && messageAttachments.length === 0) {
      return
    }
    
    // Abort any existing stream
    abortStream()
    
    // Create user message
    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: messageContent,
      attachments: messageAttachments.length > 0 ? messageAttachments : undefined,
      createdAt: new Date().toISOString()
    }
    
    // Create placeholder assistant message for streaming
    const assistantMessage: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      isStreaming: true
    }
    
    setState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage, assistantMessage],
      input: '',
      pendingAttachments: [],
      isSending: true
    }))
    
    try {
      const session = (await supabase.auth.getSession()).data.session
      if (!session?.access_token) {
        throw new Error('Not authenticated')
      }
      
      // Build context
      const context: ChatContext = {
        user: {
          userId: session.user.id,
          language: 'en' // Will be enriched by the server
        },
        garden: state.currentGarden,
        plants: state.currentPlant ? [state.currentPlant] : undefined,
        selectedChips: state.selectedChips.length > 0 ? state.selectedChips : undefined
      }
      
      // Build messages for API (include history)
      const apiMessages = state.messages
        .filter(m => !m.isStreaming)
        .concat(userMessage)
        .map(m => ({
          role: m.role,
          content: m.content,
          imageUrls: m.attachments?.filter(a => a.status === 'uploaded').map(a => a.url)
        }))
      
      // Create abort controller
      abortControllerRef.current = new AbortController()
      isStreamingRef.current = true
      setIsStreaming(true)
      
      const response = await fetch('/api/ai/garden-chat', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: apiMessages,
          context,
          stream: true
        }),
        signal: abortControllerRef.current.signal
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Chat request failed')
      }
      
      // Handle streaming response
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body')
      }
      
      const decoder = new TextDecoder()
      let streamedContent = ''
      
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event: StreamEvent = JSON.parse(line.slice(6))
              
              switch (event.type) {
                case 'token':
                  if (event.token) {
                    streamedContent += event.token
                    setState(prev => ({
                      ...prev,
                      messages: prev.messages.map(m => 
                        m.id === assistantMessage.id 
                          ? { ...m, content: streamedContent }
                          : m
                      )
                    }))
                  }
                  break
                  
                case 'done':
                  if (event.message) {
                    setState(prev => ({
                      ...prev,
                      messages: prev.messages.map(m => 
                        m.id === assistantMessage.id 
                          ? { ...event.message!, isStreaming: false }
                          : m
                      ),
                      isSending: false
                    }))
                  }
                  break
                  
                case 'error':
                  throw new Error(event.error || 'Stream error')
              }
            } catch (parseErr) {
              console.warn('[aphylia-chat] Failed to parse SSE:', parseErr)
            }
          }
        }
      }
      
      // Ensure streaming flag is removed
      setState(prev => ({
        ...prev,
        messages: prev.messages.map(m => 
          m.id === assistantMessage.id 
            ? { ...m, isStreaming: false }
            : m
        ),
        isSending: false
      }))
      
    } catch (err) {
      console.error('[aphylia-chat] Error:', err)
      
      // Check if aborted
      if ((err as Error).name === 'AbortError') {
        setState(prev => ({
          ...prev,
          messages: prev.messages.map(m => 
            m.id === assistantMessage.id 
              ? { ...m, isStreaming: false, content: m.content || 'Message cancelled.' }
              : m
          ),
          isSending: false
        }))
        return
      }
      
      // Update assistant message with error
      setState(prev => ({
        ...prev,
        messages: prev.messages.map(m => 
          m.id === assistantMessage.id 
            ? { ...m, isStreaming: false, error: (err as Error).message, content: 'Sorry, I encountered an error. Please try again.' }
            : m
        ),
        isSending: false
      }))
    } finally {
      abortControllerRef.current = null
      isStreamingRef.current = false
      setIsStreaming(false)
    }
  }, [state.input, state.pendingAttachments, state.messages, state.currentGarden, state.currentPlant, state.selectedChips, abortStream])
  
  // Execute quick action
  const executeQuickAction = useCallback(async (actionId: QuickActionId) => {
    const prompts: Record<QuickActionId, string> = {
      'diagnose': "Help me diagnose what's wrong with my plant. I'll share a photo.",
      'watering-schedule': "Help me create an optimal watering schedule for my garden.",
      'weekly-plan': "Create a weekly gardening plan for my garden based on current tasks and plants.",
      'summarize-journal': "Summarize the key observations and patterns from my garden journal entries.",
      'plant-care': "Give me a comprehensive care guide for my plant.",
      'pest-help': "Help me identify and deal with a pest or disease problem.",
      'seasonal-tips': "What should I be doing in my garden this season?",
      'companion-plants': "What are good companion plants for my current plants?"
    }
    
    const prompt = prompts[actionId] || `Help me with: ${actionId}`
    
    await sendMessage(prompt)
  }, [sendMessage])
  
  return {
    state,
    openChat,
    closeChat,
    toggleChat,
    toggleMinimize,
    setInput,
    sendMessage,
    executeQuickAction,
    uploadImage,
    removePendingAttachment,
    addContextChip,
    removeContextChip,
    clearMessages,
    setGardenContext,
    setPlantContext,
    setAvailableChips,
    abortStream,
    isStreaming
  }
}

export default useAphyliaChat
