import { forwardRef, useCallback, useState } from "react"
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"
import type { ButtonProps } from "@/components/tiptap-ui-primitive/button"
import { Button, ButtonGroup } from "@/components/tiptap-ui-primitive/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/tiptap-ui-primitive/dropdown-menu"
import { Card, CardBody } from "@/components/tiptap-ui-primitive/card"
import { ChevronDownIcon } from "@/components/tiptap-icons/chevron-down-icon"
import { ChevronDown, ChevronRight } from "lucide-react"
import type { CollapsibleStyle } from "@/components/tiptap-node/collapsible-node"

export interface CollapsibleButtonProps extends Omit<ButtonProps, "type"> {
  text?: string
  /**
   * Whether to render the dropdown menu in a portal
   * @default true
   */
  portal?: boolean
  /**
   * Callback for when the dropdown opens or closes
   */
  onOpenChange?: (isOpen: boolean) => void
}

const COLLAPSIBLE_STYLES: { value: CollapsibleStyle; label: string; icon: string; description: string }[] = [
  { value: "default", label: "Default", icon: "📄", description: "Simple collapsible section" },
  { value: "info", label: "Info", icon: "ℹ️", description: "Informational content" },
  { value: "tip", label: "Tip", icon: "💡", description: "Helpful tips and tricks" },
  { value: "warning", label: "Warning", icon: "⚠️", description: "Important warnings" },
  { value: "note", label: "Note", icon: "📝", description: "Additional notes" },
]

export const CollapsibleButton = forwardRef<HTMLButtonElement, CollapsibleButtonProps>(
  ({ text, portal = true, onOpenChange, ...buttonProps }, ref) => {
    const { editor } = useTiptapEditor()
    const [isOpen, setIsOpen] = useState(false)

    const handleInsert = useCallback(
      (style: CollapsibleStyle) => {
        if (editor) {
          editor.chain().focus().setCollapsible({
            title: "Click to expand",
            isOpen: true,
            style,
          }).run()
        }
        setIsOpen(false)
      },
      [editor]
    )

    const handleOpenChange = useCallback(
      (open: boolean) => {
        setIsOpen(open)
        onOpenChange?.(open)
      },
      [onOpenChange]
    )

    if (!editor) return null

    return (
      <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            data-style="ghost"
            role="button"
            tabIndex={-1}
            aria-label="Insert collapsible section"
            tooltip="Collapsible"
            {...buttonProps}
            ref={ref}
          >
            <div className="relative flex items-center">
              <ChevronRight className="tiptap-button-icon h-3 w-3 -mr-1" />
              <ChevronDown className="tiptap-button-icon h-3 w-3" />
            </div>
            <ChevronDownIcon className="tiptap-button-dropdown-small" />
            {text && <span className="tiptap-button-text">{text}</span>}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" portal={portal} sideOffset={8} collisionPadding={8}>
          <Card>
            <CardBody>
              <div className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider px-2 py-1.5 mb-1">
                Insert Collapsible
              </div>
              <ButtonGroup>
                {COLLAPSIBLE_STYLES.map((style) => (
                  <DropdownMenuItem key={style.value} asChild>
                    <Button
                      type="button"
                      data-style="ghost"
                      onClick={() => handleInsert(style.value)}
                      className="w-full justify-start"
                    >
                      <span className="text-base flex-shrink-0 mr-2">{style.icon}</span>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="font-medium text-sm">{style.label}</div>
                        <div className="text-xs text-stone-400 dark:text-stone-500 truncate">
                          {style.description}
                        </div>
                      </div>
                    </Button>
                  </DropdownMenuItem>
                ))}
              </ButtonGroup>
            </CardBody>
          </Card>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }
)

CollapsibleButton.displayName = "CollapsibleButton"

export default CollapsibleButton
