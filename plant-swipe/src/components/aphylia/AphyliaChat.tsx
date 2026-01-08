/**
 * Aphylia Chat
 * 
 * Main wrapper component that combines the floating bubble and chat panel.
 * This is the component that should be added to the app layout.
 */

import React, { useEffect } from 'react'
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
    setGardenContext,
    setPlantContext,
    setAvailableChips,
    abortStream,
    isStreaming
  } = useAphyliaChat({
    gardenContext,
    plantContext
  })
  
  // Update context when props change
  useEffect(() => {
    setGardenContext(gardenContext || null)
  }, [gardenContext, setGardenContext])
  
  useEffect(() => {
    setPlantContext(plantContext || null)
  }, [plantContext, setPlantContext])
  
  useEffect(() => {
    // Build available chips from context
    const chips: ContextChip[] = [...availableChips]
    
    if (gardenContext) {
      chips.unshift({
        type: 'garden',
        id: gardenContext.gardenId,
        label: gardenContext.gardenName,
        data: gardenContext
      })
    }
    
    if (plantContext) {
      chips.unshift({
        type: 'plant',
        id: plantContext.gardenPlantId,
        label: plantContext.nickname || plantContext.plantName,
        data: plantContext
      })
    }
    
    setAvailableChips(chips)
  }, [gardenContext, plantContext, availableChips, setAvailableChips])
  
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
        availableChips={state.availableChips}
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
