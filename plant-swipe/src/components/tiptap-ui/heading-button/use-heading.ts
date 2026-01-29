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

// --- Icons ---
import { HeadingOneIcon } from "@/components/tiptap-icons/heading-one-icon"
import { HeadingTwoIcon } from "@/components/tiptap-icons/heading-two-icon"
import { HeadingThreeIcon } from "@/components/tiptap-icons/heading-three-icon"
import { HeadingFourIcon } from "@/components/tiptap-icons/heading-four-icon"
import { HeadingFiveIcon } from "@/components/tiptap-icons/heading-five-icon"
import { HeadingSixIcon } from "@/components/tiptap-icons/heading-six-icon"

export type Level = 1 | 2 | 3 | 4 | 5 | 6

/**
 * Configuration for the heading functionality
 */
export interface UseHeadingConfig {
  /**
   * The Tiptap editor instance.
   */
  editor?: Editor | null
  /**
   * The heading level.
   */
  level: Level
  /**
   * Whether the button should hide when heading is not available.
   * @default false
   */
  hideWhenUnavailable?: boolean
  /**
   * Callback function called after a successful heading toggle.
   */
  onToggled?: () => void
}

export const headingIcons = {
  1: HeadingOneIcon,
  2: HeadingTwoIcon,
  3: HeadingThreeIcon,
  4: HeadingFourIcon,
  5: HeadingFiveIcon,
  6: HeadingSixIcon,
}

export const HEADING_SHORTCUT_KEYS: Record<Level, string> = {
  1: "ctrl+alt+1",
  2: "ctrl+alt+2",
  3: "ctrl+alt+3",
  4: "ctrl+alt+4",
  5: "ctrl+alt+5",
  6: "ctrl+alt+6",
}

/**
 * Checks if heading can be toggled in the current editor state
 */
export function canToggle(
  editor: Editor | null,
  level?: Level
): boolean {
  if (!editor || !editor.isEditable) return false
  if (
    !isNodeInSchema("heading", editor) ||
    isNodeTypeSelected(editor, ["image"])
  )
    return false

  // Use TipTap's native can() check
  return level
    ? editor.can().toggleHeading({ level })
    : editor.can().toggleHeading({ level: 1 })
}

/**
 * Checks if heading is currently active
 */
export function isHeadingActive(
  editor: Editor | null,
  level?: Level | Level[]
): boolean {
  if (!editor || !editor.isEditable) return false

  if (Array.isArray(level)) {
    return level.some((l) => editor.isActive("heading", { level: l }))
  }

  return level
    ? editor.isActive("heading", { level })
    : editor.isActive("heading")
}

/**
 * Toggles heading in the editor
 * Uses TipTap's native toggle command which handles nested content properly
 */
export function toggleHeading(
  editor: Editor | null,
  level: Level | Level[]
): boolean {
  if (!editor || !editor.isEditable) return false

  const levels = Array.isArray(level) ? level : [level]
  const firstLevel = levels[0]

  if (!firstLevel) return false

  try {
    // Use TipTap's native toggleHeading - it handles nesting correctly
    return editor.chain().focus(undefined, { scrollIntoView: false }).toggleHeading({ level: firstLevel }).run()
  } catch {
    return false
  }
}

/**
 * Determines if the heading button should be shown
 */
export function shouldShowButton(props: {
  editor: Editor | null
  level?: Level | Level[]
  hideWhenUnavailable: boolean
}): boolean {
  const { editor, level, hideWhenUnavailable } = props

  if (!editor || !editor.isEditable) return false
  if (!isNodeInSchema("heading", editor)) return false

  if (hideWhenUnavailable && !editor.isActive("code")) {
    if (Array.isArray(level)) {
      return level.some((l) => canToggle(editor, l))
    }
    return canToggle(editor, level)
  }

  return true
}

/**
 * Custom hook that provides heading functionality for Tiptap editor
 *
 * @example
 * ```tsx
 * // Simple usage
 * function MySimpleHeadingButton() {
 *   const { isVisible, isActive, handleToggle, Icon } = useHeading({ level: 1 })
 *
 *   if (!isVisible) return null
 *
 *   return (
 *     <button
 *       onClick={handleToggle}
 *       aria-pressed={isActive}
 *     >
 *       <Icon />
 *       Heading 1
 *     </button>
 *   )
 * }
 *
 * // Advanced usage with configuration
 * function MyAdvancedHeadingButton() {
 *   const { isVisible, isActive, handleToggle, label, Icon } = useHeading({
 *     level: 2,
 *     editor: myEditor,
 *     hideWhenUnavailable: true,
 *     onToggled: (isActive) => console.log('Heading toggled:', isActive)
 *   })
 *
 *   if (!isVisible) return null
 *
 *   return (
 *     <MyButton
 *       onClick={handleToggle}
 *       aria-label={label}
 *       aria-pressed={isActive}
 *     >
 *       <Icon />
 *       Toggle Heading 2
 *     </MyButton>
 *   )
 * }
 * ```
 */
export function useHeading(config: UseHeadingConfig) {
  const {
    editor: providedEditor,
    level,
    hideWhenUnavailable = false,
    onToggled,
  } = config

  const { editor } = useTiptapEditor(providedEditor)
  const [isVisible, setIsVisible] = useState<boolean>(true)
  const [isActive, setIsActive] = useState<boolean>(false)
  const [canToggleState, setCanToggleState] = useState<boolean>(false)

  useEffect(() => {
    if (!editor) return

    const handleSelectionUpdate = () => {
      setIsVisible(shouldShowButton({ editor, level, hideWhenUnavailable }))
      setIsActive(isHeadingActive(editor, level))
      setCanToggleState(canToggle(editor, level))
    }

    handleSelectionUpdate()

    editor.on("selectionUpdate", handleSelectionUpdate)
    editor.on("transaction", handleSelectionUpdate)
    editor.on("update", handleSelectionUpdate)

    return () => {
      editor.off("selectionUpdate", handleSelectionUpdate)
      editor.off("transaction", handleSelectionUpdate)
      editor.off("update", handleSelectionUpdate)
    }
  }, [editor, level, hideWhenUnavailable])

  const handleToggle = useCallback(() => {
    if (!editor || !editor.isEditable) return false

    try {
      // Use native toggleHeading which handles node conversion and paragraph toggling reliably
      if (typeof level === 'number') {
        const result = editor.chain().focus(undefined, { scrollIntoView: false }).toggleHeading({ level }).run()
        if (result) onToggled?.()
        return result
      }

      // Fallback for array of levels (uncommon for toggle, usually just for check)
      // If any is active, turn to paragraph. Else turn to first level.
      const active = isHeadingActive(editor, level)
      if (active) {
        const result = editor.chain().focus(undefined, { scrollIntoView: false }).setParagraph().run()
        if (result) onToggled?.()
        return result
      }

      const firstLevel = Array.isArray(level) ? level[0] : level
      if (firstLevel) {
        const result = editor.chain().focus(undefined, { scrollIntoView: false }).toggleHeading({ level: firstLevel }).run()
        if (result) onToggled?.()
        return result
      }

      return false
    } catch (error) {
      console.error('Error toggling heading:', error)
      return false
    }
  }, [editor, level, onToggled])

  return {
    isVisible,
    isActive,
    handleToggle,
    canToggle: canToggleState,
    label: `Heading ${level}`,
    shortcutKeys: HEADING_SHORTCUT_KEYS[level],
    Icon: headingIcons[level],
  }
}
