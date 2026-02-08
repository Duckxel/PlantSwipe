/**
 * Aphylia Chat
 * 
 * Main wrapper component that combines the floating bubble and chat panel.
 * This is the component that should be added to the app layout.
 * 
 * IMPORTANT: This component is designed to NOT interfere with React Router navigation.
 * Context is passed directly to the hook via refs, not state, to avoid re-render loops.
 */

import React from 'react'
import { useAphyliaChat } from '@/hooks/useAphyliaChat'
import { AphyliaChatBubble } from './AphyliaChatBubble'
import { AphyliaChatPanel } from './AphyliaChatPanel'
import type { GardenContext, PlantContext } from '@/types/aphyliaChat'

interface AphyliaChatProps {
  /** Current garden context (pass when user is viewing a garden) */
  gardenContext?: GardenContext | null
  /** Current plant context (pass when user is viewing a specific plant) */
  plantContext?: PlantContext | null
  /** Whether to show the chat bubble (can be hidden on certain pages) */
  showBubble?: boolean
  /** Class name for positioning overrides */
  className?: string
}

export const AphyliaChat: React.FC<AphyliaChatProps> = ({
  gardenContext,
  plantContext,
  showBubble = true,
  className
}) => {
  // Pass context directly to hook - it uses refs internally to avoid re-render issues
  // Garden context is ALWAYS included automatically (no user toggle needed)
  const {
    state,
    closeChat,
    toggleChat,
    toggleMinimize,
    setInput,
    sendMessage,
    executeQuickAction,
    uploadImage,
    removePendingAttachment,
    clearMessages,
    abortStream,
    isStreaming
  } = useAphyliaChat({
    gardenContext,
    plantContext
  })
  
  // Handle image upload
  const handleUploadImage = async (file: File) => {
    await uploadImage(file)
  }
  
  if (!showBubble && !state.isOpen) {
    return null
  }
  
  return (
    <>
      {/* Floating bubble */}
      {showBubble && (
        <AphyliaChatBubble
          isOpen={state.isOpen}
          onClick={toggleChat}
          className={className}
        />
      )}
      
      {/* Chat panel - garden context is always included automatically */}
      <AphyliaChatPanel
        isOpen={state.isOpen}
        isMinimized={state.isMinimized}
        messages={state.messages}
        input={state.input}
        pendingAttachments={state.pendingAttachments}
        selectedChips={state.selectedChips}
        isSending={state.isSending}
        isStreaming={isStreaming}
        onClose={closeChat}
        onToggleMinimize={toggleMinimize}
        onInputChange={setInput}
        onSendMessage={sendMessage}
        onUploadImage={handleUploadImage}
        onRemoveAttachment={removePendingAttachment}
        onClearMessages={clearMessages}
        onQuickAction={executeQuickAction}
        onAbortStream={abortStream}
        gardenName={gardenContext?.gardenName}
      />
    </>
  )
}

export default AphyliaChat
