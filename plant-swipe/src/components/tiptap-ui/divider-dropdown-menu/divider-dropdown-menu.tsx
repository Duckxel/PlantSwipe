import { forwardRef, useCallback, useState } from "react"
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"
import type { ButtonProps } from "@/components/tiptap-ui-primitive/button"
import { Button } from "@/components/tiptap-ui-primitive/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/tiptap-ui-primitive/dropdown-menu"
import { Minus, ChevronDown } from "lucide-react"
import type { DividerStyle } from "@/components/tiptap-node/styled-divider-node"

const DIVIDER_OPTIONS: { style: DividerStyle; label: string; icon: string }[] = [
  { style: "solid", label: "Solid Line", icon: "—" },
  { style: "gradient", label: "Gradient", icon: "◆" },
  { style: "dashed", label: "Dashed", icon: "- -" },
  { style: "dots", label: "Dots", icon: "•••" },
  { style: "fancy", label: "Fancy", icon: "✦" },
  { style: "wave", label: "Wave", icon: "〰" },
  { style: "stars", label: "Stars", icon: "★★★" },
]

export interface DividerDropdownMenuProps extends Omit<ButtonProps, "type"> {
  text?: string
  portal?: boolean
}

export const DividerDropdownMenu = forwardRef<HTMLButtonElement, DividerDropdownMenuProps>(
  ({ text, portal = false, ...buttonProps }, ref) => {
    const { editor } = useTiptapEditor()
    const [open, setOpen] = useState(false)

    const insertDivider = useCallback(
      (style: DividerStyle) => {
        if (editor) {
          editor.chain().focus().setStyledDivider({ style, color: "emerald" }).run()
        }
        setOpen(false)
      },
      [editor]
    )

    if (!editor) return null

    return (
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            data-style="ghost"
            role="button"
            tabIndex={-1}
            aria-label="Insert divider"
            tooltip="Insert Divider"
            {...buttonProps}
            ref={ref}
          >
            <Minus className="tiptap-button-icon h-4 w-4" />
            {text && <span className="tiptap-button-text">{text}</span>}
            <ChevronDown className="tiptap-button-icon h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent portal={portal} className="w-48">
          {DIVIDER_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.style}
              onClick={() => insertDivider(option.style)}
              className="flex items-center gap-3"
            >
              <span className="w-8 text-center text-sm">{option.icon}</span>
              <span>{option.label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }
)

DividerDropdownMenu.displayName = "DividerDropdownMenu"

export default DividerDropdownMenu
