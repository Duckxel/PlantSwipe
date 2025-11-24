import React from 'react'
import type { Editor } from '@tiptap/react'
import { BubbleMenu, FloatingMenu } from '@tiptap/react'
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Minus,
  Quote,
  Text,
  TextCursor,
  ListChecks,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type MenuButtonProps = {
  label: string
  active?: boolean
  onClick: () => void
}

const bubbleButtonClass =
  'inline-flex h-8 w-8 items-center justify-center rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1a1a1a] text-stone-600 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-[#2a2a2a]'

const BubbleButton: React.FC<MenuButtonProps> = ({ label, active, onClick, children }) => (
  <button
    type="button"
    className={cn(
      bubbleButtonClass,
      active && 'bg-emerald-600 text-white dark:bg-emerald-500/80 dark:text-white',
    )}
    aria-label={label}
    onClick={onClick}
  >
    {children}
  </button>
)

export const NotitapBubbleMenu: React.FC<{ editor: Editor | null }> = ({ editor }) => {
  if (!editor) return null
  return (
    <BubbleMenu editor={editor} tippyOptions={{ duration: 120 }} className="rounded-2xl bg-white/95 dark:bg-[#151515] border border-stone-200 dark:border-[#3e3e42] shadow-xl p-2 flex items-center gap-2">
      <BubbleButton label="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="h-4 w-4" />
      </BubbleButton>
      <BubbleButton label="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="h-4 w-4" />
      </BubbleButton>
      <BubbleButton label="Code" active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()}>
        <Code className="h-4 w-4" />
      </BubbleButton>
    </BubbleMenu>
  )
}

const blockOptions = [
  {
    label: 'Text',
    description: 'Start with plain text',
    icon: Text,
    action: (editor: Editor) => editor.chain().focus().setParagraph().run(),
  },
  {
    label: 'Heading 1',
    description: 'Large section title',
    icon: Heading1,
    action: (editor: Editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    label: 'Heading 2',
    description: 'Medium section title',
    icon: Heading2,
    action: (editor: Editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    label: 'Heading 3',
    description: 'Small section label',
    icon: Heading3,
    action: (editor: Editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    label: 'Bulleted list',
    description: 'Create a bullet list',
    icon: List,
    action: (editor: Editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    label: 'Numbered list',
    description: 'Ordered list with numbers',
    icon: ListOrdered,
    action: (editor: Editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    label: 'To-do list',
    description: 'Track tasks with checkboxes',
    icon: ListChecks,
    action: (editor: Editor) => editor.chain().focus().toggleTaskList().run(),
  },
  {
    label: 'Quote',
    description: 'Insert a block quote',
    icon: Quote,
    action: (editor: Editor) => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    label: 'Code block',
    description: 'Capture code snippets',
    icon: Code,
    action: (editor: Editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    label: 'Divider',
    description: 'Visual separator',
    icon: Minus,
    action: (editor: Editor) => editor.chain().focus().setHorizontalRule().run(),
  },
]

export const NotitapBlockMenu: React.FC<{ editor: Editor | null }> = ({ editor }) => {
  if (!editor) return null
  return (
    <FloatingMenu
      editor={editor}
      tippyOptions={{ duration: 120, placement: 'right' }}
      shouldShow={({ editor: ed }) => {
        const { $from } = ed.state.selection
        if (!$from) return false
        const isParagraph = $from.parent.type.name === 'paragraph'
        const isEmpty = $from.parent.content.size === 0
        return isParagraph && isEmpty
      }}
      className="rounded-3xl border border-stone-200 dark:border-[#3e3e42] bg-white/95 dark:bg-[#141414] shadow-2xl w-72 p-3 space-y-3"
    >
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-300">
        <TextCursor className="h-3.5 w-3.5" />
        Notitap Blocks
      </div>
      <div className="space-y-1">
        {blockOptions.map(({ label, description, icon: Icon, action }) => (
          <button
            key={label}
            type="button"
            onClick={() => action(editor)}
            className="flex w-full items-center gap-3 rounded-2xl p-2 text-left hover:bg-stone-100 dark:hover:bg-[#1f1f1f]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#0f0f0f] text-stone-600 dark:text-stone-200">
              <Icon className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-sm font-medium text-stone-800 dark:text-stone-100">{label}</span>
              <span className="block text-xs text-stone-500 dark:text-stone-400">{description}</span>
            </span>
          </button>
        ))}
      </div>
    </FloatingMenu>
  )
}
