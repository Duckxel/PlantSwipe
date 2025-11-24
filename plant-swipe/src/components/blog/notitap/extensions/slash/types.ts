import type { Editor, Range } from '@tiptap/core'
import type { LucideIcon } from 'lucide-react'

export type SlashCommandHandler = (props: { editor: Editor; range: Range }) => void

export type SlashCommandItem = {
  id: string
  title: string
  description: string
  shortcut?: string
  icon: LucideIcon
  command: SlashCommandHandler
}

