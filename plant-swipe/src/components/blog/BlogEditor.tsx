import { forwardRef, useImperativeHandle } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Underline from '@tiptap/extension-underline'
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

const DEFAULT_CONTENT = `<h2>New Aphylia story</h2><p>Share product updates, garden learnings, or beta milestones. Select text to style it, add bullet lists, and drop in images with a URL.</p>`

const toolbarButton =
  'inline-flex h-9 w-9 items-center justify-center rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e1e] text-stone-600 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-[#2a2a2a] transition disabled:opacity-40'

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
        <EditorContent editor={editor} className="prose prose-stone dark:prose-invert max-w-none min-h-[320px] focus:outline-none [&_*]:text-base" />
      </div>
    </div>
  )
})

BlogEditor.displayName = 'BlogEditor'
