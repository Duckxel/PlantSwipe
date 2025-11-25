import { forwardRef, useCallback } from "react"
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"
import type { ButtonProps } from "@/components/tiptap-ui-primitive/button"
import { Button } from "@/components/tiptap-ui-primitive/button"
import { Square } from "lucide-react"

export interface EmailCardButtonProps extends Omit<ButtonProps, "type"> {
  text?: string
}

export const EmailCardButton = forwardRef<HTMLButtonElement, EmailCardButtonProps>(
  ({ text, onClick, ...buttonProps }, ref) => {
    const { editor } = useTiptapEditor()

    const handleClick = useCallback(
      (event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event)
        if (event.defaultPrevented) return
        
        if (editor) {
          editor.chain().focus().setEmailCard({
            title: "",
            content: "Your content here",
            style: "default",
            icon: "📌",
          }).run()
        }
      },
      [editor, onClick]
    )

    if (!editor) return null

    return (
      <Button
        type="button"
        data-style="ghost"
        role="button"
        tabIndex={-1}
        aria-label="Insert card"
        tooltip="Insert Card/Box"
        onClick={handleClick}
        {...buttonProps}
        ref={ref}
      >
        <Square className="tiptap-button-icon h-4 w-4" />
        {text && <span className="tiptap-button-text">{text}</span>}
      </Button>
    )
  }
)

EmailCardButton.displayName = "EmailCardButton"

export default EmailCardButton
