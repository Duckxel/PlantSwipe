import { forwardRef, useCallback, useMemo } from "react"

// --- Hooks ---
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"

// --- Tiptap UI ---
import type { UseTextColorConfig } from "@/components/tiptap-ui/text-color-button"
import { useTextColor } from "@/components/tiptap-ui/text-color-button"

// --- UI Primitives ---
import type { ButtonProps } from "@/components/tiptap-ui-primitive/button"
import { Button } from "@/components/tiptap-ui-primitive/button"

// --- Styles ---
import "@/components/tiptap-ui/text-color-button/text-color-button.scss"

export interface TextColorButtonProps
  extends Omit<ButtonProps, "type">,
    UseTextColorConfig {
  /**
   * Optional text to display alongside the icon.
   */
  text?: string
}

/**
 * Button component for applying text colors in a Tiptap editor.
 */
export const TextColorButton = forwardRef<
  HTMLButtonElement,
  TextColorButtonProps
>(
  (
    {
      editor: providedEditor,
      textColor,
      text,
      hideWhenUnavailable = false,
      onApplied,
      onClick,
      children,
      style,
      ...buttonProps
    },
    ref
  ) => {
    const { editor } = useTiptapEditor(providedEditor)
    const {
      isVisible,
      canSetTextColor,
      isActive,
      handleSetTextColor,
      label,
    } = useTextColor({
      editor,
      textColor,
      label: text || `Set text color`,
      hideWhenUnavailable,
      onApplied,
    })

    const handleClick = useCallback(
      (event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event)
        if (event.defaultPrevented) return
        handleSetTextColor()
      },
      [handleSetTextColor, onClick]
    )

    // For "inherit" (default), show black circle
    const displayColor = textColor === "inherit" ? "#000000" : textColor

    const buttonStyle = useMemo(
      () =>
        ({
          ...style,
          "--text-color": displayColor,
        }) as React.CSSProperties,
      [displayColor, style]
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
        disabled={!canSetTextColor}
        data-disabled={!canSetTextColor}
        aria-label={label}
        aria-pressed={isActive}
        tooltip={label}
        onClick={handleClick}
        style={buttonStyle}
        {...buttonProps}
        ref={ref}
      >
        {children ?? (
          <span
            className="tiptap-button-color-circle"
            style={
              { "--text-color": displayColor } as React.CSSProperties
            }
          />
        )}
      </Button>
    )
  }
)

TextColorButton.displayName = "TextColorButton"
