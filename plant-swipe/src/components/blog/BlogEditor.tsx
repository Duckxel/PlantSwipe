import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ChangeEvent } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
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
import { Bold, Heading1, Heading2, Heading3, ImageIcon, Italic, LinkIcon, ListOrdered, List, Loader2, Underline as UnderlineIcon, UploadCloud } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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

const DEFAULT_CONTENT = `<h2>New Aphylia story</h2><p>Use the slash menu to insert headings, quotes, dividers, galleries, or embeds.</p>`

const toolbarButton =
  'inline-flex h-9 w-9 items-center justify-center rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e1e] text-stone-600 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-[#2a2a2a] transition disabled:opacity-40'

const floatingButton =
  'flex w-full items-center gap-3 rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-white/90 dark:bg-[#1a1a1a] px-3 py-2 text-sm text-stone-700 dark:text-stone-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'

export const BlogEditor = forwardRef<BlogEditorHandle, BlogEditorProps>(
  ({ initialHtml, initialDocument, className, onContentChange, onUploadImage }, ref),
) => {
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

  const [slashMenu, setSlashMenu] = useState<{ visible: boolean; top: number; left: number }>({
    visible: false,
    top: 0,
    left: 0,
  })
  const canUploadImages = typeof onUploadImage === 'function'
  const [imageDialogOpen, setImageDialogOpen] = useState(false)
  const [imageMode, setImageMode] = useState<'url' | 'upload'>('url')
  const [imageInputUrl, setImageInputUrl] = useState('')
  const [imageUploadError, setImageUploadError] = useState<string | null>(null)
  const [imageUploading, setImageUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const imageModeButtonClass = (mode: 'url' | 'upload') =>
    cn(
      'flex-1 rounded-2xl px-3 py-2 text-sm font-medium transition',
      imageMode === mode
        ? 'bg-white shadow text-emerald-600 dark:bg-[#1f1f1f]'
        : 'text-stone-500 hover:text-stone-800 dark:text-stone-200/80',
    )

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

  const resetImageDialogState = () => {
    setImageMode('url')
    setImageInputUrl('')
    setImageUploadError(null)
    setSelectedFile(null)
    setImageUploading(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const closeImageDialog = () => {
    resetImageDialogState()
    setImageDialogOpen(false)
  }

  const handleImageButtonClick = () => {
    if (!canUploadImages) {
      addImage()
      return
    }
    resetImageDialogState()
    setImageDialogOpen(true)
  }

  const handleInsertImageUrl = () => {
    const nextUrl = imageInputUrl.trim()
    if (!nextUrl) {
      setImageUploadError('Please provide an image URL.')
      return
    }
    editor?.chain().focus().setImage({ src: nextUrl }).run()
    closeImageDialog()
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null
    setSelectedFile(file)
    setImageUploadError(null)
  }

  const handleBrowseClick = () => {
    fileInputRef.current?.click()
  }

  const handleUploadAndInsert = async () => {
    if (!selectedFile || !onUploadImage) {
      setImageUploadError('Please choose an image to upload.')
      return
    }
    setImageUploadError(null)
    setImageUploading(true)
    try {
      const result = await onUploadImage(selectedFile)
      const publicUrl = result?.url
      if (!publicUrl) {
        throw new Error('Upload succeeded but no public URL was returned.')
      }
      editor?.chain().focus().setImage({ src: publicUrl }).run()
      closeImageDialog()
    } catch (uploadErr) {
      const message =
        uploadErr instanceof Error ? uploadErr.message : 'Upload failed. Please try again.'
      setImageUploadError(message)
    } finally {
      setImageUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const slashCommands = [
    { label: 'Heading 1', description: 'Large section title', action: () => editor?.chain().focus().toggleHeading({ level: 1 }).run() },
    { label: 'Heading 2', description: 'Medium section heading', action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: 'Heading 3', description: 'Small section heading', action: () => editor?.chain().focus().toggleHeading({ level: 3 }).run() },
    { label: 'Checklist', description: 'Track todos with checkboxes', action: () => editor?.chain().focus().toggleTaskList().run() },
    { label: 'Bullet list', description: 'Classic unordered bullets', action: () => editor?.chain().focus().toggleBulletList().run() },
    { label: 'Quote', description: 'Emphasize cited text', action: () => editor?.chain().focus().toggleBlockquote().run() },
    { label: 'Divider', description: 'Visual section break', action: () => editor?.chain().focus().setHorizontalRule().run() },
    { label: 'Code block', description: 'Snippets or terminal output', action: () => editor?.chain().focus().toggleCodeBlock().run() },
  ]

  const hideSlashMenu = () => {
    setSlashMenu((prev) => (prev.visible ? { ...prev, visible: false } : prev))
  }

  useEffect(() => {
    if (!editor) return
    const updateMenu = () => {
      const { state } = editor
      const { $from } = state.selection
      const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, '\uffff')
      if (textBefore === '/') {
        const coords = editor.view.coordsAtPos($from.pos)
        setSlashMenu({
          visible: true,
          top: coords.bottom + window.scrollY + 6,
          left: coords.left + window.scrollX,
        })
      } else {
        hideSlashMenu()
      }
    }
    editor.on('selectionUpdate', updateMenu)
    editor.on('transaction', updateMenu)
    return () => {
      editor.off('selectionUpdate', updateMenu)
      editor.off('transaction', updateMenu)
    }
  }, [editor])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        hideSlashMenu()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSlashCommand = (run?: () => void) => {
    if (!editor) return
    const from = editor.state.selection.from
    editor.chain().focus().deleteRange({ from: Math.max(0, from - 1), to: from }).run()
    run?.()
    hideSlashMenu()
  }

  return (
    <>
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
          <button type="button" className={toolbarButton} onClick={handleImageButtonClick}>
            <ImageIcon className="h-4 w-4" />
          </button>
          <button type="button" className={toolbarButton} onClick={addLink}>
            <LinkIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="px-4 pb-4 relative">
          {slashMenu.visible && (
            <div
              className="fixed z-50 w-64 space-y-1 rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white/95 dark:bg-[#0d0d0d] p-2 shadow-xl"
              style={{ top: slashMenu.top, left: slashMenu.left }}
            >
              <p className="px-2 text-xs uppercase tracking-wide text-stone-500 dark:text-stone-400">Blocks</p>
              {slashCommands.map(({ label, description, action }) => (
                <button key={label} type="button" className={floatingButton} onClick={() => handleSlashCommand(action)}>
                  <div className="text-left">
                    <div className="text-sm font-medium">{label}</div>
                    <div className="text-xs text-stone-500 dark:text-stone-400">{description}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
          <EditorContent editor={editor} className="prose prose-stone dark:prose-invert max-w-none min-h-[320px] focus:outline-none [&_*]:text-base" />
        </div>
        <div className="flex items-center justify-between border-t border-stone-200 dark:border-[#3e3e42] px-4 py-3 text-xs text-stone-500 dark:text-stone-400">
          <span>Use "/" for quick block insertions • Drag images between blocks</span>
          <span>{editor ? `${editor.storage.characterCount.words()} words` : '0 words'}</span>
        </div>
      </div>
      {canUploadImages && (
        <Dialog
          open={imageDialogOpen}
          onOpenChange={(nextOpen) => {
            if (nextOpen) {
              setImageDialogOpen(true)
            } else {
              closeImageDialog()
            }
          }}
        >
          <DialogContent className="max-w-lg space-y-5">
            <DialogHeader>
              <DialogTitle>Insert image</DialogTitle>
              <DialogDescription>
                Paste an existing link or upload a photo. Uploads are optimized and stored in the shared UTILITY/blog folder.
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-2 rounded-2xl bg-stone-100/60 p-1 dark:bg-[#1a1a1a]/80">
              <button
                type="button"
                className={imageModeButtonClass('url')}
                onClick={() => {
                  setImageMode('url')
                  setImageUploadError(null)
                }}
              >
                Paste link
              </button>
              <button
                type="button"
                className={imageModeButtonClass('upload')}
                onClick={() => {
                  setImageMode('upload')
                  setImageUploadError(null)
                }}
              >
                Upload photo
              </button>
            </div>
            {imageMode === 'url' ? (
              <div className="space-y-3">
                <Label htmlFor="blog-editor-image-url">Image URL</Label>
                <Input
                  id="blog-editor-image-url"
                  type="url"
                  value={imageInputUrl}
                  placeholder="https://example.com/photo.webp"
                  onChange={(event) => {
                    setImageInputUrl(event.target.value)
                    if (imageUploadError) setImageUploadError(null)
                  }}
                />
                <Button type="button" className="rounded-2xl" onClick={handleInsertImageUrl}>
                  Insert image
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleFileChange} />
                <div
                  className={cn(
                    'rounded-3xl border-2 border-dashed p-6 text-center',
                    imageUploading
                      ? 'border-emerald-400/80 bg-emerald-50/60 dark:border-emerald-500/50 dark:bg-emerald-500/10'
                      : 'border-stone-200 dark:border-[#3e3e42]',
                  )}
                >
                  <UploadCloud className="mx-auto mb-3 h-10 w-10 text-emerald-600 dark:text-emerald-300" />
                  <p className="text-sm text-stone-600 dark:text-stone-300">
                    {selectedFile
                      ? `${selectedFile.name} · ${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB`
                      : 'Drop or choose an image (PNG, JPG, WebP, HEIC, AVIF). Max 15 MB.'}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-4 rounded-2xl"
                    onClick={handleBrowseClick}
                    disabled={imageUploading}
                  >
                    Choose image
                  </Button>
                </div>
                <Button
                  type="button"
                  className="rounded-2xl"
                  onClick={handleUploadAndInsert}
                  disabled={!selectedFile || imageUploading}
                >
                  {imageUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading…
                    </>
                  ) : (
                    'Upload & insert'
                  )}
                </Button>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Images are converted to WebP and capped to stay performant on the blog page.
                </p>
              </div>
            )}
            {imageUploadError && <p className="text-sm text-red-600">{imageUploadError}</p>}
          </DialogContent>
        </Dialog>
      )}
    </>
  )
})

BlogEditor.displayName = 'BlogEditor'
