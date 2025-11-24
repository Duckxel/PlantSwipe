import { useState } from 'react'
import { BubbleMenu, Editor } from '@tiptap/react'
import Tippy from '@tippyjs/react'
import { Bold, Italic, Check, ChevronDown, Heading1, Heading2, Heading3, List, ListOrdered } from 'lucide-react'

type BubbleMenuProps = {
  editor: Editor
}

const blockOptions = [
  { label: 'Text', action: (editor: Editor) => editor.chain().focus().setParagraph().run(), isActive: (editor: Editor) => editor.isActive('paragraph') },
  { label: 'Heading 1', action: (editor: Editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(), isActive: (editor: Editor) => editor.isActive('heading', { level: 1 }), icon: Heading1 },
  { label: 'Heading 2', action: (editor: Editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(), isActive: (editor: Editor) => editor.isActive('heading', { level: 2 }), icon: Heading2 },
  { label: 'Heading 3', action: (editor: Editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(), isActive: (editor: Editor) => editor.isActive('heading', { level: 3 }), icon: Heading3 },
  { label: 'Bulleted list', action: (editor: Editor) => editor.chain().focus().toggleBulletList().run(), isActive: (editor: Editor) => editor.isActive('bulletList'), icon: List },
  { label: 'Numbered list', action: (editor: Editor) => editor.chain().focus().toggleOrderedList().run(), isActive: (editor: Editor) => editor.isActive('orderedList'), icon: ListOrdered },
]

const inlineButtons = [
  {
    label: 'Bold',
    icon: Bold,
    action: (editor: Editor) => editor.chain().focus().toggleBold().run(),
    isActive: (editor: Editor) => editor.isActive('bold'),
  },
  {
    label: 'Italic',
    icon: Italic,
    action: (editor: Editor) => editor.chain().focus().toggleItalic().run(),
    isActive: (editor: Editor) => editor.isActive('italic'),
  },
]

const NodeTypeDropdown = ({ editor }: { editor: Editor }) => {
  const [visible, setVisible] = useState(false)

  const activeOption = blockOptions.find((option) => option.isActive(editor)) ?? blockOptions[0]

  return (
    <Tippy
      visible={visible}
      interactive
      onClickOutside={() => setVisible(false)}
      animation="shift-toward-subtle"
      placement="bottom-start"
      content={
        <div className="rounded-2xl border border-stone-200 bg-white p-2 shadow-xl dark:border-stone-700 dark:bg-stone-900">
          {blockOptions.map((option) => (
            <button
              key={option.label}
              type="button"
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-stone-100 dark:hover:bg-stone-800"
              onClick={() => {
                option.action(editor)
                setVisible(false)
              }}
            >
              <span className="flex items-center gap-2">
                {option.icon && <option.icon className="h-4 w-4 text-stone-500" />}
                {option.label}
              </span>
              {option.isActive(editor) && <Check className="h-4 w-4 text-emerald-500" />}
            </button>
          ))}
        </div>
      }
    >
      <button
        type="button"
        className="bubble-menu-button flex w-32 items-center justify-between"
        onClick={() => setVisible((prev) => !prev)}
      >
        <span className="truncate">{activeOption.label}</span>
        <ChevronDown className="h-4 w-4" />
      </button>
    </Tippy>
  )
}

export const CustomBubbleMenu = ({ editor }: BubbleMenuProps) => {
  return (
    <BubbleMenu
      editor={editor}
      className="bubble-menu"
      tippyOptions={{
        duration: 150,
        animation: 'shift-toward-subtle',
      }}
    >
      <NodeTypeDropdown editor={editor} />
      {inlineButtons.map((btn) => {
        const Icon = btn.icon
        const active = btn.isActive(editor)
        return (
          <button
            key={btn.label}
            type="button"
            className={`bubble-menu-button ${active ? 'is-active' : ''}`}
            onClick={() => btn.action(editor)}
          >
            <Icon className="h-4 w-4" />
          </button>
        )
      })}
    </BubbleMenu>
  )
}

