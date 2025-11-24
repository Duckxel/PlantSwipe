import type { Editor, Range } from '@tiptap/core'
import { ReactRenderer } from '@tiptap/react'
import fuzzysort from 'fuzzysort'
import tippy from 'tippy.js'
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Minus,
  Type,
  Image as ImageIcon,
} from 'lucide-react'

import { CommandList } from './CommandList'
import type { SlashCommandItem } from './types'
import { stopPrevent } from '../../utils/dom'

type SuggestionContext = {
  editor: Editor
  range: Range
}

export type SlashSuggestionOptions = {
  onImageInsert?: (ctx: SuggestionContext) => Promise<void> | void
}

export const createSlashCommandItems = (
  options: SlashSuggestionOptions = {},
): SlashCommandItem[] => [
  {
    id: 'text',
    title: 'Text',
    description: 'Start with plain paragraph text',
    icon: Type,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setParagraph().run()
    },
  },
  {
    id: 'heading-1',
    title: 'Heading 1',
    description: 'Large section heading',
    icon: Heading1,
    shortcut: '#',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run()
    },
  },
  {
    id: 'heading-2',
    title: 'Heading 2',
    description: 'Medium section heading',
    icon: Heading2,
    shortcut: '##',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run()
    },
  },
  {
    id: 'heading-3',
    title: 'Heading 3',
    description: 'Small section heading',
    icon: Heading3,
    shortcut: '###',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run()
    },
  },
  {
    id: 'numbered-list',
    title: 'Numbered list',
    description: 'Create an ordered list',
    icon: ListOrdered,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run()
    },
  },
  {
    id: 'bulleted-list',
    title: 'Bulleted list',
    description: 'Create an unordered list',
    icon: List,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run()
    },
  },
  {
    id: 'quote',
    title: 'Quote',
    description: 'Capture a quote',
    icon: Quote,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run()
    },
  },
  {
    id: 'divider',
    title: 'Divider',
    description: 'Insert a horizontal rule',
    icon: Minus,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run()
    },
  },
  ...(options.onImageInsert
    ? [
        {
          id: 'image',
          title: 'Image',
          description: 'Upload or paste an image',
          icon: ImageIcon,
          command: (ctx: SuggestionContext) => {
            options.onImageInsert?.(ctx)
          },
        } satisfies SlashCommandItem,
      ]
    : []),
]

export const createSlashSuggestion = (
  items: SlashCommandItem[],
) => {
  return {
    items: ({ query }: { query: string }) => {
      if (!query) return items

      return fuzzysort
        .go(query, items, { key: 'title' })
        .map((result) => ({
          ...result.obj,
          highlightedTitle: fuzzysort.highlight(result, '<b>', '</b>') || result.obj.title,
        }))
    },
    render: () => {
      let component: ReactRenderer | null = null
      let popupInstances: any[] | null = null
      let localProps: Record<string, any> | undefined

      return {
        onStart: (props: Record<string, any>) => {
          localProps = props
          component = new ReactRenderer(CommandList, {
            props,
            editor: props.editor,
          })

          popupInstances = tippy('body', {
            getReferenceClientRect: props.clientRect,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
            animation: 'shift-toward-subtle',
            duration: 150,
          })
        },
        onUpdate(props: Record<string, any>) {
          localProps = props
          component?.updateProps(props)
          popupInstances?.[0]?.setProps({
            getReferenceClientRect: props.clientRect,
          })
        },
        onKeyDown(props: { event: KeyboardEvent }) {
          ;(component?.ref as any)?.onKeyDown?.({ event: props.event })

          if (props.event.key === 'Escape') {
            popupInstances?.[0]?.hide()
            return true
          }

          if (props.event.key === 'Enter') {
            stopPrevent(props.event)
            return true
          }

          return false
        },
        onExit() {
          popupInstances?.[0]?.destroy()
          popupInstances = null
          component?.destroy()
          component = null
        },
      }
    },
  }
}

