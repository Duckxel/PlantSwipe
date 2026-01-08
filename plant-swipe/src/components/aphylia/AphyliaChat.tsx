/**
 * Aphylia Chat
 * 
 * Main wrapper component that combines the floating bubble and chat panel.
 * This is the component that should be added to the app layout.
 * 
 * IMPORTANT: This component is designed to NOT interfere with React Router navigation.
 * Context is passed directly to the hook via refs, not state, to avoid re-render loops.
 */

import React, { useMemo } from 'react'
import { useAphyliaChat } from '@/hooks/useAphyliaChat'
import { AphyliaChatBubble } from './AphyliaChatBubble'
import { AphyliaChatPanel } from './AphyliaChatPanel'
import type { GardenContext, PlantContext, ContextChip } from '@/types/aphyliaChat'

interface AphyliaChatProps {
  /** Current garden context (pass when user is viewing a garden) */
  gardenContext?: GardenContext | null
  /** Current plant context (pass when user is viewing a specific plant) */
  plantContext?: PlantContext | null
  /** Additional context chips available for the user to select */
  availableChips?: ContextChip[]
  /** Whether to show the chat bubble (can be hidden on certain pages) */
  showBubble?: boolean
  /** Class name for positioning overrides */
  className?: string
}

export const AphyliaChat: React.FC<AphyliaChatProps> = ({
  gardenContext,
  plantContext,
  availableChips = [],
  showBubble = true,
  className
}) => {
  // Pass context directly to hook - it uses refs internally to avoid re-render issues
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
    addContextChip,
    removeContextChip,
    clearMessages,
    abortStream,
    isStreaming
  } = useAphyliaChat({
    gardenContext,
    plantContext
  })
  
  // Build available chips from context - memoized to avoid unnecessary re-renders
  const computedAvailableChips = useMemo(() => {
    const chips: ContextChip[] = [...availableChips]
    
    if (gardenContext) {
      chips.unshift({
        type: 'garden',
        id: gardenContext.gardenId,
        label: gardenContext.gardenName,
        data: { ...gardenContext }
      })
    }
    
    if (plantContext) {
      chips.unshift({
        type: 'plant',
        id: plantContext.gardenPlantId,
        label: plantContext.nickname || plantContext.plantName,
        data: { ...plantContext }
      })
    }
    
    return chips
  }, [gardenContext?.gardenId, gardenContext?.gardenName, plantContext?.gardenPlantId, plantContext?.nickname, plantContext?.plantName, availableChips])
  
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
      
      {/* Chat panel */}
      <AphyliaChatPanel
        isOpen={state.isOpen}
        isMinimized={state.isMinimized}
        messages={state.messages}
        input={state.input}
        pendingAttachments={state.pendingAttachments}
        selectedChips={state.selectedChips}
        availableChips={computedAvailableChips}
        isSending={state.isSending}
        isStreaming={isStreaming}
        onClose={closeChat}
        onToggleMinimize={toggleMinimize}
        onInputChange={setInput}
        onSendMessage={sendMessage}
        onUploadImage={handleUploadImage}
        onRemoveAttachment={removePendingAttachment}
        onAddChip={addContextChip}
        onRemoveChip={removeContextChip}
        onClearMessages={clearMessages}
        onQuickAction={executeQuickAction}
        onAbortStream={abortStream}
        gardenName={gardenContext?.gardenName}
      />
    </>
  )
}

export default AphyliaChat
