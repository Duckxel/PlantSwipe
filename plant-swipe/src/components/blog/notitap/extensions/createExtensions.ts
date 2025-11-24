import type { AnyExtension } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import Typography from '@tiptap/extension-typography'
import Image from '@tiptap/extension-image'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'

import { DBlock } from './dblock'
import { TrailingNode } from './TrailingNode'
import { NotitapLink } from './Link'
import { SlashCommands } from './slash/extension'
import { createSlashCommandItems, createSlashSuggestion } from './slash/suggestions'
import type { SlashSuggestionOptions } from './slash/suggestions'

export type NotitapExtensionOptions = {
  placeholder?: string
  slashCommands?: SlashSuggestionOptions
  onLinkShortcut?: () => void
}

export const createNotitapExtensions = (
  options: NotitapExtensionOptions = {},
): AnyExtension[] => {
  const slashItems = createSlashCommandItems(options.slashCommands)

  return [
    DBlock,
    Paragraph,
    Text,
    StarterKit.configure({
      paragraph: false,
      text: false,
      dropcursor: {
        color: '#10b981',
        width: 2,
      },
    }),
    TaskList.configure({
      HTMLAttributes: { class: 'notitap-task-list space-y-1' },
    }),
    TaskItem.configure({
      nested: true,
    }),
    Image.configure({
      HTMLAttributes: {
        class: 'rounded-2xl',
      },
    }),
    Underline,
    Typography,
    NotitapLink.configure({
      autolink: true,
      linkOnPaste: true,
      openOnClick: true,
      onModKPressed: options.onLinkShortcut,
      protocols: ['mailto'],
    }),
    Placeholder.configure({
      includeChildren: true,
      placeholder: options.placeholder ?? 'Type “/” for commands or start writing…',
    }),
    CharacterCount.configure({
      limit: 20000,
    }),
    TrailingNode.configure({
      node: 'paragraph',
      notAfter: ['paragraph', 'heading'],
    }),
    SlashCommands.configure({
      suggestion: createSlashSuggestion(slashItems),
    }),
  ]
}

