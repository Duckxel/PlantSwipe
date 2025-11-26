import type { Editor } from '@tiptap/core'
import type { FC, ReactNode } from 'react'

declare module '@tiptap/react' {
  type MenuProps = {
    editor: Editor | null
    className?: string
    shouldShow?: () => boolean
    tippyOptions?: Record<string, unknown>
    children?: ReactNode
  }

  export const BubbleMenu: FC<MenuProps>
  export const FloatingMenu: FC<MenuProps>
}
