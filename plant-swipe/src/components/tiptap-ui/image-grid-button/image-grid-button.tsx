import { forwardRef, useCallback } from "react"
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"
import type { ButtonProps } from "@/components/tiptap-ui-primitive/button"
import { Button } from "@/components/tiptap-ui-primitive/button"
import { LayoutGrid } from "lucide-react"

export interface ImageGridButtonProps extends Omit<ButtonProps, "type"> {
  text?: string
}

export const ImageGridButton = forwardRef<HTMLButtonElement, ImageGridButtonProps>(
  ({ text, onClick, ...buttonProps }, ref) => {
    const { editor } = useTiptapEditor()

    const handleClick = useCallback(
      (event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event)
        if (event.defaultPrevented) return
        
        if (editor) {
          editor.chain().focus().setImageGrid({
            images: [],
            columns: 2,
            gap: "md",
            rounded: true,
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
        aria-label="Insert image grid"
        tooltip="Insert Image Grid"
        onClick={handleClick}
        {...buttonProps}
        ref={ref}
      >
        <LayoutGrid className="tiptap-button-icon h-4 w-4" />
        {text && <span className="tiptap-button-text">{text}</span>}
      </Button>
    )
  }
)

ImageGridButton.displayName = "ImageGridButton"

export default ImageGridButton
