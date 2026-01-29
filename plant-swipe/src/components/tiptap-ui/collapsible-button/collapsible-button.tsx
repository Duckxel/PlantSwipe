import { forwardRef, useCallback, useState } from "react"
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"
import type { ButtonProps } from "@/components/tiptap-ui-primitive/button"
import { Button } from "@/components/tiptap-ui-primitive/button"
import { ChevronDown, ChevronRight } from "lucide-react"
import type { CollapsibleStyle } from "@/components/tiptap-node/collapsible-node"

export interface CollapsibleButtonProps extends Omit<ButtonProps, "type"> {
  text?: string
}

const COLLAPSIBLE_STYLES: { value: CollapsibleStyle; label: string; icon: string; description: string }[] = [
  { value: "default", label: "Default", icon: "📄", description: "Simple collapsible section" },
  { value: "info", label: "Info", icon: "ℹ️", description: "Informational content" },
  { value: "tip", label: "Tip", icon: "💡", description: "Helpful tips and tricks" },
  { value: "warning", label: "Warning", icon: "⚠️", description: "Important warnings" },
  { value: "note", label: "Note", icon: "📝", description: "Additional notes" },
]

export const CollapsibleButton = forwardRef<HTMLButtonElement, CollapsibleButtonProps>(
  ({ text, onClick, ...buttonProps }, ref) => {
    const { editor } = useTiptapEditor()
    const [showDropdown, setShowDropdown] = useState(false)

    const handleInsert = useCallback(
      (style: CollapsibleStyle) => {
        if (editor) {
          editor.chain().focus().setCollapsible({
            title: "Click to expand",
            isOpen: true,
            style,
          }).run()
        }
        setShowDropdown(false)
      },
      [editor]
    )

    const handleClick = useCallback(
      (event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event)
        if (event.defaultPrevented) return
        setShowDropdown(!showDropdown)
      },
      [onClick, showDropdown]
    )

    if (!editor) return null

    return (
      <div className="relative">
        <Button
          type="button"
          data-style="ghost"
          role="button"
          tabIndex={-1}
          aria-label="Insert collapsible section"
          aria-haspopup="true"
          aria-expanded={showDropdown}
          tooltip="Insert Collapsible Section"
          onClick={handleClick}
          {...buttonProps}
          ref={ref}
        >
          <div className="relative flex items-center">
            <ChevronRight className="tiptap-button-icon h-3 w-3 -mr-1" />
            <ChevronDown className="tiptap-button-icon h-3 w-3" />
          </div>
          {text && <span className="tiptap-button-text">{text}</span>}
        </Button>

        {showDropdown && (
          <>
            {/* Backdrop to close dropdown */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowDropdown(false)}
            />

            {/* Dropdown menu */}
            <div className="absolute left-0 top-full mt-1 z-50 w-56 rounded-xl border border-stone-200 bg-white p-2 shadow-xl dark:border-stone-700 dark:bg-stone-800">
              <div className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider px-2 py-1.5 mb-1">
                Insert Collapsible
              </div>
              {COLLAPSIBLE_STYLES.map((style) => (
                <button
                  key={style.value}
                  type="button"
                  onClick={() => handleInsert(style.value)}
                  className="w-full flex items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-stone-100 dark:hover:bg-stone-700"
                >
                  <span className="text-lg flex-shrink-0">{style.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-stone-700 dark:text-stone-200">
                      {style.label}
                    </div>
                    <div className="text-xs text-stone-400 dark:text-stone-500 truncate">
                      {style.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    )
  }
)

CollapsibleButton.displayName = "CollapsibleButton"

export default CollapsibleButton
