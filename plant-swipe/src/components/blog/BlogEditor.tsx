import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import type { Editor, JSONContent, Range } from '@tiptap/core'
import { Bold, Image as ImageIcon, Italic, Link2, List, ListOrdered, Quote, Wand2 } from 'lucide-react'
import { cn } from '@/lib/utils'

import { createNotitapExtensions, CustomBubbleMenu, LinkBubbleMenu } from './notitap'
import '@/components/blog/notitap/styles/editor.css'

export type BlogEditorHandle = {
  getHtml: () => string
  getDocument: () => JSONContent | null
  setContent: (input: { html?: string; doc?: JSONContent }) => void
}

type BlogEditorProps = {
  initialHtml?: string | null
  initialDocument?: JSONContent | null
  className?: string
  onContentChange?: (payload: { html: string; doc: JSONContent | null; plainText: string }) => void
  onUploadImage?: (file: File) => Promise<{ url?: string | null; path?: string | null }>
}

const DEFAULT_DOCUMENT: JSONContent = {
  type: 'doc',
  content: [
    {
      type: 'dBlock',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'New Aphylia story' }],
        },
      ],
    },
  ],
}

const toolbarButton =
  'inline-flex h-9 w-9 items-center justify-center rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e1e] text-stone-600 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-[#2a2a2a] transition disabled:opacity-40'

export const BlogEditor = forwardRef<BlogEditorHandle, BlogEditorProps>(
  ({ initialHtml, initialDocument, className, onContentChange, onUploadImage }, ref) => {
    const fileInputRef = useRef<HTMLInputElement | null>(null)
    const pendingSlashRange = useRef<Range | null>(null)
    const editorRef = useRef<Editor | null>(null)
    const [inlineUploadError, setInlineUploadError] = useState<string | null>(null)
    const [inlineUploading, setInlineUploading] = useState(false)

    const handleLinkShortcut = useCallback(() => {
      const instance = editorRef.current
      if (!instance) return
      const current = instance.getAttributes('link')?.href ?? 'https://'
      const next = window.prompt('Link URL', current)
      if (next === null) return
      const trimmed = next.trim()
      if (!trimmed) {
        instance.chain().focus().unsetLink().run()
        return
      }
      instance.chain().focus().setLink({ href: trimmed }).run()
    }, [])

    const triggerFileDialog = useCallback(() => {
      setInlineUploadError(null)
      fileInputRef.current?.click()
    }, [])

    const slashOptions = useMemo(() => {
      if (typeof onUploadImage !== 'function') return undefined
      return {
        onImageInsert: ({ range }: { range: Range }) => {
          pendingSlashRange.current = range
          triggerFileDialog()
        },
      }
    }, [onUploadImage, triggerFileDialog])

    const extensions = useMemo(
      () =>
        createNotitapExtensions({
          onLinkShortcut: handleLinkShortcut,
          slashCommands: slashOptions,
        }),
      [handleLinkShortcut, slashOptions],
    )

    const editor = useEditor({
      extensions,
      content: initialDocument ?? initialHtml ?? DEFAULT_DOCUMENT,
    })

    useEffect(() => {
      editorRef.current = editor ?? null
      return () => {
        if (!editor) {
          editorRef.current = null
        }
      }
    }, [editor])

    const insertImage = useCallback(
      async (file: File, range?: Range | null) => {
        if (!onUploadImage) return
        const instance = editorRef.current
        if (!instance) return
        try {
          setInlineUploading(true)
          const result = await onUploadImage(file)
          const url = result?.url
          if (!url) {
            throw new Error('Upload completed without a public URL.')
          }
          const chain = instance.chain().focus()
          if (range) {
            chain.deleteRange(range)
          }
          chain.setImage({ src: url }).run()
          setInlineUploadError(null)
        } catch (error) {
          setInlineUploadError(
            error instanceof Error ? error.message : 'Failed to upload image. Please try again.',
          )
        } finally {
          setInlineUploading(false)
          pendingSlashRange.current = null
        }
      },
      [onUploadImage],
    )

    useImperativeHandle(
      ref,
      () => ({
        getHtml: () => editorRef.current?.getHTML() ?? '',
        getDocument: () => editorRef.current?.getJSON() ?? null,
        setContent: ({ html, doc }) => {
          const instance = editorRef.current
          if (!instance) return
          if (doc) {
            instance.commands.setContent(doc)
          } else if (html) {
            instance.commands.setContent(html)
          }
        },
      }),
      [],
    )

    useEffect(() => {
      if (!editor || !onContentChange) return
      const handler = () => {
        onContentChange({
          html: editor.getHTML(),
          doc: editor.getJSON(),
          plainText: editor.getText({ blockSeparator: '\n' }),
        })
      }
      editor.on('update', handler)
      handler()
      return () => {
        editor.off('update', handler)
      }
    }, [editor, onContentChange])

    const handleToolbarImage = () => {
      if (typeof onUploadImage === 'function') {
        pendingSlashRange.current = null
        triggerFileDialog()
        return
      }
      const url = window.prompt('Image URL')
      if (!url) return
      editorRef.current?.chain().focus().setImage({ src: url.trim() }).run()
    }

    const handleFileInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (!file) return
      await insertImage(file, pendingSlashRange.current)
    }

    const toolbarButtons = [
      {
        id: 'bold',
        icon: Bold,
        label: 'Bold',
        action: () => editorRef.current?.chain().focus().toggleBold().run(),
        isActive: () => editorRef.current?.isActive('bold'),
      },
      {
        id: 'italic',
        icon: Italic,
        label: 'Italic',
        action: () => editorRef.current?.chain().focus().toggleItalic().run(),
        isActive: () => editorRef.current?.isActive('italic'),
      },
      {
        id: 'bullet',
        icon: List,
        label: 'Bulleted list',
        action: () => editorRef.current?.chain().focus().toggleBulletList().run(),
        isActive: () => editorRef.current?.isActive('bulletList'),
      },
      {
        id: 'ordered',
        icon: ListOrdered,
        label: 'Numbered list',
        action: () => editorRef.current?.chain().focus().toggleOrderedList().run(),
        isActive: () => editorRef.current?.isActive('orderedList'),
      },
      {
        id: 'quote',
        icon: Quote,
        label: 'Quote',
        action: () => editorRef.current?.chain().focus().toggleBlockquote().run(),
        isActive: () => editorRef.current?.isActive('blockquote'),
      },
    ]

    return (
      <div className={cn('space-y-3', className)}>
        <div className="flex flex-wrap gap-2 rounded-2xl border border-stone-200 bg-white/80 p-3 shadow-sm dark:border-[#3e3e42] dark:bg-[#0f0f0f]">
          {toolbarButtons.map((button) => {
            const Icon = button.icon
            const active = button.isActive?.() ?? false
            return (
              <button
                key={button.id}
                type="button"
                title={button.label}
                className={cn(
                  toolbarButton,
                  active && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-100',
                )}
                onClick={button.action}
              >
                <Icon className="h-4 w-4" />
              </button>
            )
          })}
          <button type="button" className={toolbarButton} onClick={handleToolbarImage}>
            <ImageIcon className="h-4 w-4" />
          </button>
          <button type="button" className={toolbarButton} onClick={handleLinkShortcut}>
            <Link2 className="h-4 w-4" />
          </button>
        </div>

        {inlineUploadError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-900/10 dark:text-red-200">
            {inlineUploadError}
          </div>
        )}

        <div className="space-y-3">
          <EditorContent editor={editor} />
          {editor && (
            <>
              <CustomBubbleMenu editor={editor} />
              <LinkBubbleMenu editor={editor} />
            </>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
          <span className="inline-flex items-center gap-2">
            <Wand2 className="h-3.5 w-3.5" />
            Use “/” to open the Notitap command palette. Drag the •• handle to reorder blocks.
          </span>
          <span>{editor ? `${editor.storage.characterCount.words()} words` : '—'}</span>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileInputChange}
          disabled={inlineUploading}
        />
      </div>
    )
  },
)

BlogEditor.displayName = 'BlogEditor'
