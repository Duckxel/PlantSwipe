import { forwardRef, useImperativeHandle } from 'react'
import { EditorContent, useEditor, BubbleMenu, FloatingMenu } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import Typography from '@tiptap/extension-typography'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import type { JSONContent } from '@tiptap/core'
import { Bold, Heading1, Heading2, Heading3, ImageIcon, Italic, LinkIcon, ListOrdered, List, Underline as UnderlineIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type BlogEditorHandle = {
  getHtml: () => string
  getDocument: () => JSONContent | null
  setContent: (input: { html?: string; doc?: JSONContent }) => void
}

type BlogEditorProps = {
  initialHtml?: string | null
  initialDocument?: JSONContent | null
  className?: string
}

const DEFAULT_CONTENT = `<h2>New Aphylia story</h2><p>Use the slash menu to insert headings, quotes, dividers, galleries, or embeds.</p>`

const toolbarButton =
  'inline-flex h-9 w-9 items-center justify-center rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e1e] text-stone-600 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-[#2a2a2a] transition disabled:opacity-40'

const floatingButton =
  'flex w-full items-center gap-3 rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-white/90 dark:bg-[#1a1a1a] px-3 py-2 text-sm text-stone-700 dark:text-stone-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'

export const BlogEditor = forwardRef<BlogEditorHandle, BlogEditorProps>(({ initialHtml, initialDocument, className }, ref) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        defaultProtocol: 'https',
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'rounded-2xl w-full h-auto',
        },
      }),
      TaskList.configure({
        HTMLAttributes: {
          class: 'notion-task-list space-y-2',
        },
      }),
      TaskItem.configure({
        nested: true,
      }),
      Placeholder.configure({
        placeholder: 'Type "/" for commands or just start writing…',
      }),
      Typography,
      CharacterCount.configure({
        limit: 20000,
      }),
    ],
    content: initialDocument ?? initialHtml ?? DEFAULT_CONTENT,
    editable: true,
  })

  useImperativeHandle(
    ref,
    () => ({
      getHtml: () => editor?.getHTML() ?? '',
      getDocument: () => editor?.getJSON() ?? null,
      setContent: ({ html, doc }) => {
        if (!editor) return
        if (doc) {
          editor.commands.setContent(doc)
        } else if (html) {
          editor.commands.setContent(html)
        }
      },
    }),
    [editor],
  )

  const addImage = () => {
    const url = window.prompt('Image URL')
    if (!url) return
    editor?.chain().focus().setImage({ src: url }).run()
  }

  const addLink = () => {
    const previous = editor?.getAttributes('link').href
    const url = window.prompt('Link URL', previous || 'https://')
    if (url === null) return
    if (url === '') {
      editor?.chain().focus().unsetLink().run()
      return
    }
    editor?.chain().focus().setLink({ href: url }).run()
  }

  const slashCommands = [
    { label: 'Heading 1', description: 'Large section title', action: () => editor?.chain().focus().toggleHeading({ level: 1 }).run() },
    { label: 'Heading 2', description: 'Medium section title', action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: 'Heading 3', description: 'Small section title', action: () => editor?.chain().focus().toggleHeading({ level: 3 }).run() },
    { label: 'Checklist', description: 'Actionable list with checkboxes', action: () => editor?.chain().focus().toggleTaskList().run() },
    { label: 'Bullet list', description: 'Classic unordered list', action: () => editor?.chain().focus().toggleBulletList().run() },
    { label: 'Quote', description: 'Highlight a quote', action: () => editor?.chain().focus().toggleBlockquote().run() },
    { label: 'Divider', description: 'Visual section break', action: () => editor?.chain().focus().setHorizontalRule().run() },
    { label: 'Code block', description: 'Snippet or terminal output', action: () => editor?.chain().focus().toggleCodeBlock().run() },
  ]

  const showFloatingMenu = () => {
    if (!editor) return false
    const { state } = editor
    const { $from } = state.selection
    const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, '\uffff')
    return textBefore === '/'
  }

  return (
    <div className={cn('space-y-3 rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#111]', className)}>
      <div className="flex flex-wrap gap-2 border-b border-stone-200 dark:border-[#3e3e42] p-3">
        <button
          type="button"
          className={toolbarButton}
          onClick={() => editor?.chain().focus().toggleBold().run()}
          disabled={!editor?.can().chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={toolbarButton}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          disabled={!editor?.can().chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={toolbarButton}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
          disabled={!editor?.can().chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-4 w-4" />
        </button>
        <button type="button" className={toolbarButton} onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}>
          <Heading1 className="h-4 w-4" />
        </button>
        <button type="button" className={toolbarButton} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 className="h-4 w-4" />
        </button>
        <button type="button" className={toolbarButton} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}>
          <Heading3 className="h-4 w-4" />
        </button>
        <button type="button" className={toolbarButton} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
          <List className="h-4 w-4" />
        </button>
        <button type="button" className={toolbarButton} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
          <ListOrdered className="h-4 w-4" />
        </button>
        <button type="button" className={toolbarButton} onClick={addImage}>
          <ImageIcon className="h-4 w-4" />
        </button>
        <button type="button" className={toolbarButton} onClick={addLink}>
          <LinkIcon className="h-4 w-4" />
        </button>
      </div>
      <div className="px-4 pb-4">
        {editor ? (
          <>
            <BubbleMenu editor={editor} tippyOptions={{ duration: 150 }}>
              <div className="flex gap-1 rounded-full border border-stone-200 bg-white/90 p-1 shadow-lg">
                <button className={toolbarButton} onClick={() => editor.chain().focus().toggleBold().run()}>
                  <Bold className="h-4 w-4" />
                </button>
                <button className={toolbarButton} onClick={() => editor.chain().focus().toggleItalic().run()}>
                  <Italic className="h-4 w-4" />
                </button>
                <button className={toolbarButton} onClick={() => editor.chain().focus().toggleUnderline().run()}>
                  <UnderlineIcon className="h-4 w-4" />
                </button>
                <button className={toolbarButton} onClick={addLink}>
                  <LinkIcon className="h-4 w-4" />
                </button>
              </div>
            </BubbleMenu>

            <FloatingMenu editor={editor} shouldShow={showFloatingMenu} tippyOptions={{ duration: 150 }}>
              <div className="w-64 space-y-1 rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white/95 dark:bg-[#0d0d0d] p-2 shadow-xl">
                <p className="px-2 text-xs uppercase tracking-wide text-stone-500 dark:text-stone-400">Blocks</p>
                {slashCommands.map(({ label, description, action }) => (
                  <button
                    key={label}
                    type="button"
                    className={floatingButton}
                    onClick={() => {
                      action()
                      editor
                        ?.chain()
                        .focus()
                        .deleteRange({ from: editor.state.selection.from - 1, to: editor.state.selection.from })
                        .run()
                    }}
                  >
                    <div className="text-left">
                      <div className="text-sm font-medium">{label}</div>
                      <div className="text-xs text-stone-500 dark:text-stone-400">{description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </FloatingMenu>
          </>
        ) : null}
        <EditorContent editor={editor} className="prose prose-stone dark:prose-invert max-w-none min-h-[320px] focus:outline-none [&_*]:text-base" />
      </div>
      <div className="flex items-center justify-between border-t border-stone-200 dark:border-[#3e3e42] px-4 py-3 text-xs text-stone-500 dark:text-stone-400">
        <span>Use "/" for quick block insertions • Drag images between blocks</span>
        <span>{editor ? `${editor.storage.characterCount.words()} words` : '0 words'}</span>
      </div>
    </div>
  )
})

BlogEditor.displayName = 'BlogEditor'
