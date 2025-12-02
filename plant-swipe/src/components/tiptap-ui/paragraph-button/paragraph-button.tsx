import { forwardRef, useCallback } from "react"

// --- Tiptap UI ---
import type { UseParagraphConfig } from "@/components/tiptap-ui/paragraph-button"
import { useParagraph } from "@/components/tiptap-ui/paragraph-button"

// --- UI Primitives ---
import type { ButtonProps } from "@/components/tiptap-ui-primitive/button"
import { Button } from "@/components/tiptap-ui-primitive/button"
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"

// --- Icons ---
import { ParagraphIcon } from "@/components/tiptap-icons/paragraph-icon"

export interface ParagraphButtonProps
  extends Omit<ButtonProps, "type">,
    UseParagraphConfig {
  /**
   * Optional text to display alongside the icon.
   */
  text?: string
  /**
   * Whether to show the tooltip
   * @default true
   */
  showTooltip?: boolean
}

/**
 * Button component for setting paragraph (normal text) in a Tiptap editor.
 *
 * For custom button implementations, use the `useParagraph` hook instead.
 */
export const ParagraphButton = forwardRef<HTMLButtonElement, ParagraphButtonProps>(
  (
    {
      editor: providedEditor,
      text,
      hideWhenUnavailable = false,
      onToggled,
      onClick,
      children,
      showTooltip = true,
      ...buttonProps
    },
    ref
  ) => {
    const { editor } = useTiptapEditor(providedEditor)
    const {
      isVisible,
      canSetParagraph,
      isActive,
      handleSetParagraph,
      label,
    } = useParagraph({
      editor,
      hideWhenUnavailable,
      onToggled,
    })

    const handleClick = useCallback(
      (event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event)
        if (event.defaultPrevented) return
        handleSetParagraph()
      },
      [handleSetParagraph, onClick]
    )

    if (!isVisible) {
      return null
    }

    return (
      <Button
        type="button"
        data-style="ghost"
        data-active-state={isActive ? "on" : "off"}
        role="button"
        tabIndex={-1}
        disabled={!canSetParagraph}
        data-disabled={!canSetParagraph}
        aria-label={label}
        aria-pressed={isActive}
        tooltip={showTooltip ? label : undefined}
        onClick={handleClick}
        {...buttonProps}
        ref={ref}
      >
        {children ?? (
          <>
            <ParagraphIcon className="tiptap-button-icon" />
            {text && <span className="tiptap-button-text">{text}</span>}
          </>
        )}
      </Button>
    )
  }
)

ParagraphButton.displayName = "ParagraphButton"
