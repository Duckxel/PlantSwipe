"use client"

import { useCallback, useEffect, useState } from "react"
import { type Editor } from "@tiptap/react"

// --- Hooks ---
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"

// --- Lib ---
import {
  isNodeInSchema,
  isNodeTypeSelected,
} from "@/lib/tiptap-utils"

/**
 * Configuration for the paragraph functionality
 */
export interface UseParagraphConfig {
  /**
   * The Tiptap editor instance.
   */
  editor?: Editor | null
  /**
   * Whether the button should hide when paragraph is not available.
   * @default false
   */
  hideWhenUnavailable?: boolean
  /**
   * Callback function called after a successful paragraph toggle.
   */
  onToggled?: () => void
}

/**
 * Checks if paragraph can be set in the current editor state
 */
export function canSetParagraph(editor: Editor | null): boolean {
  if (!editor || !editor.isEditable) return false
  if (
    !isNodeInSchema("paragraph", editor) ||
    isNodeTypeSelected(editor, ["image"])
  )
    return false

  return editor.can().setNode("paragraph")
}

/**
 * Checks if paragraph is currently active
 */
export function isParagraphActive(editor: Editor | null): boolean {
  if (!editor || !editor.isEditable) return false
  return editor.isActive("paragraph")
}

/**
 * Sets the current node to paragraph
 */
export function setParagraph(editor: Editor | null): boolean {
  if (!editor || !editor.isEditable) return false
  if (!canSetParagraph(editor)) return false

  return editor.chain().focus().setNode("paragraph").run()
}

/**
 * Determines if the paragraph button should be shown
 */
export function shouldShowButton(props: {
  editor: Editor | null
  hideWhenUnavailable: boolean
}): boolean {
  const { editor, hideWhenUnavailable } = props

  if (!editor || !editor.isEditable) return false
  if (!isNodeInSchema("paragraph", editor)) return false

  if (hideWhenUnavailable && !editor.isActive("code")) {
    return canSetParagraph(editor)
  }

  return true
}

/**
 * Custom hook that provides paragraph functionality for Tiptap editor
 */
export function useParagraph(config?: UseParagraphConfig) {
  const {
    editor: providedEditor,
    hideWhenUnavailable = false,
    onToggled,
  } = config || {}

  const { editor } = useTiptapEditor(providedEditor)
  const [isVisible, setIsVisible] = useState<boolean>(true)
  const canSetParagraphState = canSetParagraph(editor)
  const isActive = isParagraphActive(editor)

  useEffect(() => {
    if (!editor) return

    const handleSelectionUpdate = () => {
      setIsVisible(shouldShowButton({ editor, hideWhenUnavailable }))
    }

    handleSelectionUpdate()

    editor.on("selectionUpdate", handleSelectionUpdate)

    return () => {
      editor.off("selectionUpdate", handleSelectionUpdate)
    }
  }, [editor, hideWhenUnavailable])

  const handleSetParagraph = useCallback(() => {
    if (!editor) return false

    const success = setParagraph(editor)
    if (success) {
      onToggled?.()
    }
    return success
  }, [editor, onToggled])

  return {
    isVisible,
    isActive,
    handleSetParagraph,
    canSetParagraph: canSetParagraphState,
    label: "Normal text",
  }
}
