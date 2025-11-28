import { forwardRef, useCallback } from "react"
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"
import type { ButtonProps } from "@/components/tiptap-ui-primitive/button"
import { Button } from "@/components/tiptap-ui-primitive/button"
import { KeyRound } from "lucide-react"

export interface SensitiveCodeButtonProps extends Omit<ButtonProps, "type"> {
  text?: string
}

export const SensitiveCodeButton = forwardRef<HTMLButtonElement, SensitiveCodeButtonProps>(
  ({ text, onClick, ...buttonProps }, ref) => {
    const { editor } = useTiptapEditor()

    const handleClick = useCallback(
      (event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event)
        if (event.defaultPrevented) return

        if (editor) {
          editor
            .chain()
            .focus()
            .setSensitiveCode({
              label: "Your verification code",
              code: "{{code}}",
              type: "otp",
              expiryText: "",
            })
            .run()
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
        aria-label="Insert sensitive code block"
        tooltip="Insert Code/OTP Block"
        onClick={handleClick}
        {...buttonProps}
        ref={ref}
      >
        <KeyRound className="tiptap-button-icon h-4 w-4" />
        {text && <span className="tiptap-button-text">{text}</span>}
      </Button>
    )
  }
)

SensitiveCodeButton.displayName = "SensitiveCodeButton"

export default SensitiveCodeButton
