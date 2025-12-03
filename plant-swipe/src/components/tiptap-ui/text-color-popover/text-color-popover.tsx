import { forwardRef, useRef, useState, useCallback } from "react"
import { type Editor } from "@tiptap/react"

// --- Hooks ---
import { useMenuNavigation } from "@/hooks/use-menu-navigation"
import { useIsBreakpoint } from "@/hooks/use-is-breakpoint"
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"

// --- Icons ---
import { BanIcon } from "@/components/tiptap-icons/ban-icon"
import { TypeIcon } from "@/components/tiptap-icons/type-icon"

// --- UI Primitives ---
import type { ButtonProps } from "@/components/tiptap-ui-primitive/button"
import { Button, ButtonGroup } from "@/components/tiptap-ui-primitive/button"
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/tiptap-ui-primitive/popover"
import { Separator } from "@/components/tiptap-ui-primitive/separator"
import {
  Card,
  CardBody,
  CardItemGroup,
} from "@/components/tiptap-ui-primitive/card"

// --- Tiptap UI ---
import type {
  TextColor,
} from "@/components/tiptap-ui/text-color-button"

export interface TextColorPopoverContentProps {
  /**
   * The Tiptap editor instance.
   */
  editor?: Editor | null
  /**
   * Optional colors to use in the text color popover.
   * If not provided, defaults to a predefined set of colors.
   */
  colors?: TextColor[]
}

export interface TextColorPopoverProps extends Omit<ButtonProps, "type"> {
  /**
   * The Tiptap editor instance.
   */
  editor?: Editor | null
  /**
   * Optional colors to use in the text color popover.
   * If not provided, defaults to a predefined set of colors.
   */
  colors?: TextColor[]
  /**
   * Whether the button should hide when the mark is not available.
   * @default false
   */
  hideWhenUnavailable?: boolean
  /**
   * Called when a color is applied.
   */
  onApplied?: (color: { color: string; label: string }) => void
}

export const TextColorPopoverButton = forwardRef<
  HTMLButtonElement,
  ButtonProps
>(({ className, children, ...props }, ref) => (
  <Button
    type="button"
    className={className}
    data-style="ghost"
    data-appearance="default"
    role="button"
    tabIndex={-1}
    aria-label="Text color"
    tooltip="Text color"
    ref={ref}
    {...props}
  >
    {children ?? (
      <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
        <TypeIcon className="tiptap-button-icon" style={{ marginBottom: "-2px" }} />
        <span style={{
          width: "14px",
          height: "3px",
          borderRadius: "1px",
          background: "linear-gradient(90deg, #d62828, #ffb703, #8338ec, #0a9396, #6a994e)",
        }} />
      </span>
    )}
  </Button>
))

TextColorPopoverButton.displayName = "TextColorPopoverButton"

// Predefined color options for the popover
const DEFAULT_TEXT_COLORS: TextColor[] = [
  { label: "Red", value: "#d62828", hex: "#d62828" },
  { label: "Yellow", value: "#ffb703", hex: "#ffb703" },
  { label: "Purple", value: "#8338ec", hex: "#8338ec" },
  { label: "Blue", value: "#0a9396", hex: "#0a9396" },
  { label: "Green", value: "#6a994e", hex: "#6a994e" },
]

export function TextColorPopoverContent({
  editor: providedEditor,
  colors = DEFAULT_TEXT_COLORS,
}: TextColorPopoverContentProps) {
  const { editor } = useTiptapEditor(providedEditor)
  const isMobile = useIsBreakpoint()
  const containerRef = useRef<HTMLDivElement>(null)

  const handleRemoveColor = useCallback(() => {
    if (!editor) return
    editor.chain().focus().unsetColor().run()
  }, [editor])

  const handleSetColor = useCallback((color: string) => {
    if (!editor) return
    if (color === "inherit") {
      editor.chain().focus().unsetColor().run()
    } else {
      editor.chain().focus().setColor(color).run()
    }
  }, [editor])

  const menuItems = [...colors, { label: "Remove color", value: "none", hex: "#000000" }]

  const { selectedIndex } = useMenuNavigation({
    containerRef,
    items: menuItems,
    orientation: "both",
    onSelect: (item) => {
      if (!containerRef.current) return false
      const highlightedElement = containerRef.current.querySelector(
        '[data-highlighted="true"]'
      ) as HTMLElement
      if (highlightedElement) highlightedElement.click()
      if (item.value === "none") handleRemoveColor()
      return true
    },
    autoSelectFirstItem: false,
  })

  return (
    <Card
      ref={containerRef}
      tabIndex={0}
      style={isMobile ? { boxShadow: "none", border: 0 } : {}}
    >
      <CardBody style={isMobile ? { padding: 0 } : {}}>
        <CardItemGroup orientation="horizontal">
          <ButtonGroup orientation="horizontal">
            {colors.map((color, index) => {
              const isActive = editor?.isActive("textStyle", { color: color.value })
              return (
                <Button
                  key={color.value}
                  type="button"
                  data-style="ghost"
                  data-active-state={isActive ? "on" : "off"}
                  role="menuitem"
                  tabIndex={index === selectedIndex ? 0 : -1}
                  data-highlighted={selectedIndex === index}
                  aria-label={`${color.label} text color`}
                  tooltip={color.label}
                  onClick={() => handleSetColor(color.value)}
                >
                  <span
                    style={{
                      display: "block",
                      width: "18px",
                      height: "18px",
                      minWidth: "18px",
                      minHeight: "18px",
                      borderRadius: "50%",
                      backgroundColor: color.hex || color.value,
                      border: "2px solid rgba(255, 255, 255, 0.9)",
                      boxShadow: isActive
                        ? `0 0 0 2px ${color.hex || color.value}, 0 0 0 4px rgba(0, 0, 0, 0.1)`
                        : "0 0 0 1px rgba(0, 0, 0, 0.15)",
                      flexShrink: 0,
                    }}
                  />
                </Button>
              )
            })}
          </ButtonGroup>
          <Separator />
          <ButtonGroup orientation="horizontal">
            <Button
              onClick={handleRemoveColor}
              aria-label="Remove text color"
              tooltip="Remove color"
              tabIndex={selectedIndex === colors.length ? 0 : -1}
              type="button"
              role="menuitem"
              data-style="ghost"
              data-highlighted={selectedIndex === colors.length}
            >
              <BanIcon className="tiptap-button-icon" />
            </Button>
          </ButtonGroup>
        </CardItemGroup>
      </CardBody>
    </Card>
  )
}

export function TextColorPopover({
  editor: providedEditor,
  colors = DEFAULT_TEXT_COLORS,
  hideWhenUnavailable = false,
  onApplied,
  ...props
}: TextColorPopoverProps) {
  const { editor } = useTiptapEditor(providedEditor)
  const [isOpen, setIsOpen] = useState(false)
  
  // Check if text color is currently active
  const isActive = editor?.isActive("textStyle") ?? false

  // Always show the text color button - it will work when text is selected
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <TextColorPopoverButton
          data-active-state={isActive ? "on" : "off"}
          aria-pressed={isActive}
          aria-label="Text color"
          tooltip="Text color"
          {...props}
        />
      </PopoverTrigger>
      <PopoverContent aria-label="Text colors">
        <TextColorPopoverContent editor={editor} colors={colors} />
      </PopoverContent>
    </Popover>
  )
}

export default TextColorPopover
