import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import type { JSONContent } from '@tiptap/core'
import { EditorContent, EditorContext, useEditor } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import Typography from '@tiptap/extension-typography'
import CharacterCount from '@tiptap/extension-character-count'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Superscript from '@tiptap/extension-superscript'
import Subscript from '@tiptap/extension-subscript'
import Underline from '@tiptap/extension-underline'

import { Toolbar, ToolbarGroup, ToolbarSeparator } from '@/components/tiptap-ui-primitive/toolbar'
import { MarkButton } from '@/components/tiptap-ui/mark-button'
import { HeadingDropdownMenu } from '@/components/tiptap-ui/heading-dropdown-menu'
import { ListDropdownMenu } from '@/components/tiptap-ui/list-dropdown-menu'
import { BlockquoteButton } from '@/components/tiptap-ui/blockquote-button'
import { CodeBlockButton } from '@/components/tiptap-ui/code-block-button'
import { LinkPopover } from '@/components/tiptap-ui/link-popover'
import { TextAlignButton } from '@/components/tiptap-ui/text-align-button'
import { UndoRedoButton } from '@/components/tiptap-ui/undo-redo-button'
import { Button } from '@/components/tiptap-ui-primitive/button'
import { ImagePlusIcon } from '@/components/tiptap-icons/image-plus-icon'
import { cn } from '@/lib/utils'

import '@/components/tiptap-templates/simple/simple-editor.scss'

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
      type: 'paragraph',
      content: [{ type: 'text', text: 'Start your Aphylia update here…' }],
    },
  ],
}

export const BlogEditor = forwardRef<BlogEditorHandle, BlogEditorProps>(
  ({ initialHtml, initialDocument, className, onContentChange, onUploadImage }, ref) => {
    const fileInputRef = useRef<HTMLInputElement | null>(null)
    const [uploadError, setUploadError] = useState<string | null>(null)
    const [uploading, setUploading] = useState(false)

    const extensions = useMemo(
      () => [
        StarterKit.configure({
          heading: { levels: [1, 2, 3, 4] },
        }),
        Placeholder.configure({
          placeholder: 'Start writing your story…',
        }),
        Link.configure({
          openOnClick: false,
          autolink: true,
          linkOnPaste: true,
        }),
        Image,
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        Highlight.configure({ multicolor: true }),
        Underline,
        Typography,
        TaskList,
        TaskItem.configure({ nested: true }),
        Superscript,
        Subscript,
        CharacterCount.configure(),
      ],
      [],
    )

    const editor = useEditor({
      extensions,
      content: initialDocument ?? initialHtml ?? DEFAULT_DOCUMENT,
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

    useEffect(() => {
      if (!editor || !onContentChange) return
      const handleUpdate = () => {
        onContentChange({
          html: editor.getHTML(),
          doc: editor.getJSON(),
          plainText: editor.getText({ blockSeparator: '\n' }),
        })
      }
      editor.on('update', handleUpdate)
      handleUpdate()
      return () => {
        editor.off('update', handleUpdate)
      }
    }, [editor, onContentChange])

    const insertUploadedImage = useCallback(
      async (file: File) => {
        if (!onUploadImage || !editor) return
        try {
          setUploading(true)
          const result = await onUploadImage(file)
          const src = result?.url ?? result?.path
          if (!src) {
            throw new Error('Upload completed without a public URL.')
          }
          editor.chain().focus().setImage({ src }).run()
          setUploadError(null)
        } catch (error) {
          setUploadError(
            error instanceof Error ? error.message : 'Failed to upload image. Please try again.',
          )
        } finally {
          setUploading(false)
        }
      },
      [editor, onUploadImage],
    )

    const handleToolbarImage = () => {
      if (onUploadImage) {
        setUploadError(null)
        fileInputRef.current?.click()
        return
      }
      const url = window.prompt('Image URL')
      if (!url || !editor) return
      editor.chain().focus().setImage({ src: url.trim() }).run()
    }

    const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (file) {
        void insertUploadedImage(file)
      }
    }

    return (
      <div className={cn('space-y-4', className)}>
        <EditorContext.Provider value={{ editor }}>
          <Toolbar className="flex-wrap gap-2 rounded-2xl border border-stone-200 bg-white/90 p-3 shadow-sm dark:border-[#3e3e42] dark:bg-[#0f0f0f]">
            <ToolbarGroup>
              <UndoRedoButton action="undo" />
              <UndoRedoButton action="redo" />
            </ToolbarGroup>

            <ToolbarSeparator />

            <ToolbarGroup>
              <HeadingDropdownMenu levels={[1, 2, 3, 4]} />
              <ListDropdownMenu types={['bulletList', 'orderedList', 'taskList']} />
              <BlockquoteButton />
              <CodeBlockButton />
            </ToolbarGroup>

            <ToolbarSeparator />

            <ToolbarGroup>
              <MarkButton type="bold" />
              <MarkButton type="italic" />
              <MarkButton type="underline" />
              <MarkButton type="strike" />
            </ToolbarGroup>

            <ToolbarSeparator />

            <ToolbarGroup>
              <MarkButton type="superscript" />
              <MarkButton type="subscript" />
            </ToolbarGroup>

            <ToolbarSeparator />

            <ToolbarGroup>
              <LinkPopover />
            </ToolbarGroup>

            <ToolbarSeparator />

            <ToolbarGroup>
              <TextAlignButton align="left" />
              <TextAlignButton align="center" />
              <TextAlignButton align="right" />
              <TextAlignButton align="justify" />
            </ToolbarGroup>

            <ToolbarSeparator />

            <ToolbarGroup>
              <Button
                type="button"
                data-style="ghost"
                onClick={handleToolbarImage}
                disabled={uploading}
              >
                <ImagePlusIcon className="tiptap-button-icon" />
                <span className="tiptap-button-text">Image</span>
              </Button>
            </ToolbarGroup>
          </Toolbar>

          {uploadError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-900/10 dark:text-red-200">
              {uploadError}
            </div>
          )}

          <div className="simple-editor-wrapper rounded-2xl border border-stone-200 bg-white/70 p-4 dark:border-[#3e3e42] dark:bg-[#101010]">
            <EditorContent editor={editor} className="simple-editor-content" />
          </div>

          <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-300">
            <span>TipTap Simple Editor</span>
            <span>{editor ? `${editor.storage.characterCount.words()} words` : '—'}</span>
          </div>
        </EditorContext.Provider>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileInputChange}
          disabled={uploading}
        />
      </div>
    )
  },
)

BlogEditor.displayName = 'BlogEditor'
