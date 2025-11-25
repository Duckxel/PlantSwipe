import { forwardRef, useCallback } from "react"
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"
import type { ButtonProps } from "@/components/tiptap-ui-primitive/button"
import { Button } from "@/components/tiptap-ui-primitive/button"
import { MousePointerClick } from "lucide-react"

export interface EmailButtonButtonProps extends Omit<ButtonProps, "type"> {
  text?: string
}

export const EmailButtonButton = forwardRef<HTMLButtonElement, EmailButtonButtonProps>(
  ({ text, onClick, ...buttonProps }, ref) => {
    const { editor } = useTiptapEditor()

    const handleClick = useCallback(
      (event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event)
        if (event.defaultPrevented) return
        
        if (editor) {
          editor.chain().focus().setEmailButton({
            text: "Click Here",
            url: "",
            style: "primary",
            size: "md",
            align: "center",
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
        aria-label="Insert button"
        tooltip="Insert CTA Button"
        onClick={handleClick}
        {...buttonProps}
        ref={ref}
      >
        <MousePointerClick className="tiptap-button-icon h-4 w-4" />
        {text && <span className="tiptap-button-text">{text}</span>}
      </Button>
    )
  }
)

EmailButtonButton.displayName = "EmailButtonButton"

export default EmailButtonButton
