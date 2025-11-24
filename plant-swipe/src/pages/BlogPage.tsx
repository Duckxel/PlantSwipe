import React from 'react'
import { Plus, Sparkles, RefreshCcw, UploadCloud } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { BlogEditor, type BlogEditorHandle } from '@/components/blog/BlogEditor'
import type { JSONContent } from '@tiptap/core'
import { BlogCard } from '@/components/blog/BlogCard'
import { useAuth } from '@/context/AuthContext'
import { usePageMetadata } from '@/hooks/usePageMetadata'
import type { BlogPost } from '@/types/blog'
import { fetchBlogPosts, saveBlogPost } from '@/lib/blogs'
import { uploadBlogImage } from '@/lib/blogMedia'
import { buildAdminRequestHeaders } from '@/lib/adminAuth'

const DEFAULT_EDITOR_HTML = `<h2>New Aphylia story</h2><p>Use the editor to share releases, field reports, or garden learnings.</p>`

const formatDateTimeLocal = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value)
  const pad = (num: number) => num.toString().padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const sortPostsByDate = (list: BlogPost[]) =>
  [...list].sort((a, b) => {
    const aTime = Date.parse(a.publishedAt || a.createdAt)
    const bTime = Date.parse(b.publishedAt || b.createdAt)
    return bTime - aTime
  })

const formatDisplayDate = (value?: string) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

const slugifyFolder = (value: string) => {
  return value
    .toLowerCase()
    .trim()
    .replace(/["']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 60)
}

const createDraftFolder = () => {
  const randomId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `blog/draft-${randomId}`
}

const folderForPost = (post?: BlogPost | null, title?: string) => {
  if (post?.slug) return `blog/${post.slug}`
  const candidate = title ? slugifyFolder(title) : ''
  if (candidate) return `blog/${candidate}`
  return createDraftFolder()
}

export default function BlogPage() {
  const { t } = useTranslation('common')
  const { user, profile } = useAuth()
  const [posts, setPosts] = React.useState<BlogPost[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [editorVisible, setEditorVisible] = React.useState(false)
  const [editorKey, setEditorKey] = React.useState(0)
  const [editingPost, setEditingPost] = React.useState<BlogPost | null>(null)
  const [formTitle, setFormTitle] = React.useState('')
  const [coverUrl, setCoverUrl] = React.useState('')
  const [autoSummary, setAutoSummary] = React.useState('')
  const [publishMode, setPublishMode] = React.useState<'draft' | 'scheduled'>('scheduled')
  const [publishAt, setPublishAt] = React.useState(formatDateTimeLocal(new Date()))
  const [formError, setFormError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [initialHtml, setInitialHtml] = React.useState<string | null>(null)
  const [initialDocument, setInitialDocument] = React.useState<JSONContent | null>(null)
  const [assetFolder, setAssetFolder] = React.useState(() => createDraftFolder())
  const [editorContent, setEditorContent] = React.useState<{ html: string; doc: JSONContent | null; plainText: string }>({
    html: '',
    doc: null,
    plainText: '',
  })
  const [summaryStatus, setSummaryStatus] = React.useState<'idle' | 'generating' | 'error'>('idle')
  const [summaryError, setSummaryError] = React.useState<string | null>(null)
  const [coverUploading, setCoverUploading] = React.useState(false)
  const [coverUploadError, setCoverUploadError] = React.useState<string | null>(null)
  const editorRef = React.useRef<BlogEditorHandle | null>(null)
  const coverInputRef = React.useRef<HTMLInputElement | null>(null)
  const editorPanelRef = React.useRef<HTMLDivElement | null>(null)
  const summarySourceRef = React.useRef<string>('')
  const summaryTimeoutRef = React.useRef<number | null>(null)
  const summaryAbortRef = React.useRef<AbortController | null>(null)
  const latestHtmlRef = React.useRef<string>('')
  const isAdmin = Boolean(profile?.is_admin)

  React.useEffect(() => {
    if (publishMode === 'scheduled' && !publishAt) {
      setPublishAt(formatDateTimeLocal(new Date()))
    }
  }, [publishMode, publishAt])

  const seoTitle = t('seo.blog.listTitle', { defaultValue: 'Aphylia Blog' })
  const seoDescription = t('seo.blog.listDescription', {
    defaultValue: 'Stories, product updates, and horticulture lessons from the Aphylia team.',
  })
  usePageMetadata({ title: seoTitle, description: seoDescription })

  const loadPosts = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const includeDrafts = Boolean(profile?.is_admin)
      const data = await fetchBlogPosts({ includeDrafts })
      setPosts(sortPostsByDate(data))
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : t('blogPage.state.error', { defaultValue: 'Failed to load blog posts.' })
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [profile?.is_admin, t])

  React.useEffect(() => {
    loadPosts().catch(() => {})
  }, [loadPosts])

  const scrollEditorIntoView = React.useCallback(() => {
    requestAnimationFrame(() => {
      editorPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [])

  const resetEditorState = React.useCallback(() => {
    summaryAbortRef.current?.abort()
    if (summaryTimeoutRef.current) {
      window.clearTimeout(summaryTimeoutRef.current)
      summaryTimeoutRef.current = null
    }
    summarySourceRef.current = ''
    latestHtmlRef.current = ''
    setEditorVisible(false)
    setEditingPost(null)
    setFormTitle('')
    setCoverUrl('')
    setAutoSummary('')
    setSummaryStatus('idle')
    setSummaryError(null)
    setPublishMode('scheduled')
    setPublishAt(formatDateTimeLocal(new Date()))
    setFormError(null)
    setInitialHtml(null)
    setInitialDocument(null)
    setEditorContent({ html: '', doc: null, plainText: '' })
    setAssetFolder(createDraftFolder())
    setCoverUploadError(null)
    setCoverUploading(false)
    setEditorKey((key) => key + 1)
  }, [])

  const openCreateDialog = () => {
    if (!isAdmin) return
    setEditorKey((key) => key + 1)
    setEditingPost(null)
    setFormTitle('')
    setCoverUrl('')
    setAutoSummary('')
    setPublishMode('scheduled')
    setPublishAt(formatDateTimeLocal(new Date()))
    setInitialHtml(DEFAULT_EDITOR_HTML)
    setInitialDocument(null)
    setFormError(null)
    setAssetFolder(createDraftFolder())
    setEditorVisible(true)
    scrollEditorIntoView()
  }

  const openEditDialog = (post: BlogPost) => {
    if (!isAdmin) return
    setEditorKey((key) => key + 1)
    setEditingPost(post)
    setFormTitle(post.title)
    setCoverUrl(post.coverImageUrl ?? '')
    setAutoSummary(post.excerpt ?? '')
    setPublishMode(post.isPublished ? 'scheduled' : 'draft')
    setPublishAt(formatDateTimeLocal(post.publishedAt))
    setInitialHtml(post.bodyHtml)
    setInitialDocument((post.editorData as JSONContent | null) ?? null)
    setFormError(null)
    setAssetFolder(folderForPost(post, post.title))
    setEditorContent({ html: post.bodyHtml, doc: (post.editorData as JSONContent | null) ?? null, plainText: '' })
    summarySourceRef.current = post.bodyHtml
    latestHtmlRef.current = post.bodyHtml
    setEditorVisible(true)
    scrollEditorIntoView()
  }

  const runSummary = React.useCallback(
    async (html: string, options?: { force?: boolean }) => {
      const source = html.trim()
      if (!source) {
        summarySourceRef.current = ''
        setAutoSummary('')
        setSummaryStatus('idle')
        setSummaryError(null)
        return ''
      }
      if (!options?.force && summarySourceRef.current === source) {
        return autoSummary
      }
      summaryAbortRef.current?.abort()
      const controller = new AbortController()
      summaryAbortRef.current = controller
      setSummaryStatus('generating')
      setSummaryError(null)
      try {
        const headers = await buildAdminRequestHeaders({ 'Content-Type': 'application/json' })
        const response = await fetch('/api/blog/summarize', {
          method: 'POST',
          headers,
          body: JSON.stringify({ html: source, title: formTitle || undefined }),
          credentials: 'same-origin',
          signal: controller.signal,
        })
        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(payload?.error || t('blogPage.editor.summaryError', { defaultValue: 'Failed to generate summary.' }))
        }
        const summaryText = (payload?.summary as string) || ''
        setAutoSummary(summaryText)
        summarySourceRef.current = source
        setSummaryStatus('idle')
        return summaryText
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return ''
        }
        const message =
          err instanceof Error
            ? err.message
            : t('blogPage.editor.summaryError', { defaultValue: 'Failed to generate summary.' })
        setSummaryError(message)
        setSummaryStatus('error')
        throw err
      } finally {
        if (summaryAbortRef.current === controller) {
          summaryAbortRef.current = null
        }
      }
    },
    [autoSummary, formTitle, t],
  )

  React.useEffect(() => {
    if (!editorVisible) return
    if (!assetFolder.startsWith('blog/draft-')) return
    const candidate = slugifyFolder(formTitle)
    if (candidate && assetFolder !== `blog/${candidate}`) {
      setAssetFolder(`blog/${candidate}`)
    }
  }, [assetFolder, editorVisible, formTitle])

  React.useEffect(() => {
    if (!editorVisible) return
    const trimmed = editorContent.html.trim()
    if (!trimmed) {
      summarySourceRef.current = ''
      if (autoSummary) setAutoSummary('')
      return
    }
    if (summaryStatus === 'generating') return
    if (summarySourceRef.current === trimmed) return
    const timeout = window.setTimeout(() => {
      runSummary(trimmed).catch(() => {})
    }, 1200)
    summaryTimeoutRef.current = timeout
    return () => {
      window.clearTimeout(timeout)
      if (summaryTimeoutRef.current === timeout) {
        summaryTimeoutRef.current = null
      }
    }
  }, [autoSummary, editorContent.html, editorVisible, runSummary, summaryStatus])

  const uploadCoverImage = React.useCallback(
    async (file: File) => {
      setCoverUploadError(null)
      setCoverUploading(true)
      try {
        const result = await uploadBlogImage(file, { folder: assetFolder })
        if (result?.url) {
          setCoverUrl(result.url)
        } else if (result?.path) {
          setCoverUrl(result.path)
        }
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : t('blogPage.editor.coverUploadError', { defaultValue: 'Failed to upload cover image.' })
        setCoverUploadError(message)
      } finally {
        setCoverUploading(false)
        if (coverInputRef.current) {
          coverInputRef.current.value = ''
        }
      }
    },
    [assetFolder, t],
  )

  const handleCoverInputChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (file) {
        uploadCoverImage(file).catch(() => {})
      }
    },
    [uploadCoverImage],
  )

  const triggerCoverUpload = React.useCallback(() => {
    coverInputRef.current?.click()
  }, [])

  const handleEditorUpdate = React.useCallback((payload: { html: string; doc: JSONContent | null; plainText: string }) => {
    setEditorContent(payload)
    latestHtmlRef.current = payload.html
  }, [])

  const handleSavePost = async () => {
    const editorInstance = editorRef.current
    if (!editorInstance) {
      setFormError(t('blogPage.editor.errorNoEditor', { defaultValue: 'Editor not ready yet.' }))
      return
    }
    if (!formTitle.trim()) {
      setFormError(t('blogPage.editor.validation.title', { defaultValue: 'Please enter a title.' }))
      return
    }
    const authorId = profile?.id || user?.id
    if (!authorId) {
      setFormError(t('blogPage.editor.validation.author', { defaultValue: 'Missing author information.' }))
      return
    }
    if (publishMode === 'scheduled' && !publishAt) {
      setFormError(t('blogPage.editor.validation.publishAt', { defaultValue: 'Please provide a publish date.' }))
      return
    }

    setSaving(true)
    setFormError(null)
    try {
      const html = editorInstance.getHtml()
      const doc = editorInstance.getDocument()
      latestHtmlRef.current = html
      const trimmedHtml = html.trim()
      if (trimmedHtml && summarySourceRef.current !== trimmedHtml) {
        try {
          await runSummary(trimmedHtml, { force: true })
        } catch {
          // Ignore summary failures just before save; fallback will use server-side excerpt.
        }
      }
      const publishDateIso = publishAt ? new Date(publishAt).toISOString() : new Date().toISOString()
      const { data, error: saveError } = await saveBlogPost({
        id: editingPost?.id,
        slug: editingPost?.slug,
        title: formTitle,
        bodyHtml: html,
        coverImageUrl: coverUrl || null,
        excerpt: autoSummary?.trim() || undefined,
        isPublished: publishMode === 'scheduled',
        publishedAt: publishDateIso,
        authorId,
        authorName: profile?.display_name || profile?.username || user?.email || 'Aphylia Team',
        editorData: doc ?? undefined,
      })

      if (saveError || !data) {
        setFormError(saveError || t('blogPage.editor.saveError', { defaultValue: 'Failed to save post.' }))
        setSaving(false)
        return
      }

      setPosts((prev) => {
        const existingIndex = prev.findIndex((entry) => entry.id === data.id)
        if (existingIndex === -1) {
          return sortPostsByDate([data, ...prev])
        }
        const next = prev.slice()
        next[existingIndex] = data
        return sortPostsByDate(next)
      })
      resetEditorState()
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : t('blogPage.editor.saveError', { defaultValue: 'Failed to save post.' }),
      )
    } finally {
      setSaving(false)
    }
  }

  const heroTitle = t('blogPage.hero.title', { defaultValue: 'Aphylia Blog' })
  const heroSubtitle = t('blogPage.hero.subtitle', {
    defaultValue: 'Product updates, greenroom experiments, and gardening stories from our worldwide testers.',
  })

  return (
    <div className="max-w-6xl mx-auto mt-8 px-4 pb-16 space-y-10">
      <section className="rounded-[32px] border border-stone-200 dark:border-[#3e3e42] bg-gradient-to-br from-emerald-50 via-white to-stone-50 dark:from-[#1f1f1f] dark:via-[#151515] dark:to-[#0c0c0c] p-8 md:p-12 space-y-5 shadow-sm">
        <Badge className="rounded-2xl px-4 py-1 w-fit bg-white/70 dark:bg-white/10 text-emerald-700 dark:text-emerald-300">
          {t('blogPage.hero.badge', { defaultValue: 'Stories & releases' })}
        </Badge>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3 md:max-w-3xl">
            <h1 className="text-3xl md:text-4xl font-semibold">{heroTitle}</h1>
            <p className="text-base text-stone-600 dark:text-stone-300">{heroSubtitle}</p>
          </div>
          {isAdmin && (
            <Button
              type="button"
              className="rounded-2xl self-start md:self-center"
              onClick={openCreateDialog}
            >
              <Plus className="h-4 w-4 mr-2" />
              {t('blogPage.actions.addPost', { defaultValue: 'Add post' })}
            </Button>
          )}
        </div>
        {isAdmin && (
          <p className="text-xs text-stone-500 dark:text-stone-400 max-w-3xl">
            {t('blogPage.hero.helper', {
              defaultValue: 'Admins can author new posts with the Notion-style builder below. Drafts remain private until published.',
            })}
          </p>
        )}
      </section>

      {loading && (
        <div className="rounded-3xl border border-dashed border-stone-300 dark:border-[#3e3e42] p-8 text-center text-sm text-stone-500 dark:text-stone-400">
          {t('blogPage.state.loading', { defaultValue: 'Fetching the latest posts…' })}
        </div>
      )}

      {!loading && error && (
        <div className="rounded-3xl border border-red-200 bg-red-50/80 dark:border-red-900/40 dark:bg-red-900/10 p-6 space-y-3 text-sm">
          <p className="text-red-700 dark:text-red-300">{error}</p>
          <Button
            type="button"
            variant="outline"
            className="rounded-2xl"
            onClick={() => {
              loadPosts().catch(() => {})
            }}
          >
            {t('blogPage.state.retry', { defaultValue: 'Try again' })}
          </Button>
        </div>
      )}

      {!loading && !error && posts.length === 0 && (
        <div className="rounded-3xl border border-dashed border-stone-300 dark:border-[#3e3e42] p-8 text-center text-sm text-stone-500 dark:text-stone-400">
          {t('blogPage.state.empty', { defaultValue: 'No blog posts yet. Check back soon!' })}
        </div>
      )}

      {!loading && !error && posts.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2">
          {posts.map((post) => (
            <BlogCard key={post.id} post={post} isAdmin={isAdmin} onEdit={openEditDialog} />
          ))}
        </div>
      )}

      {isAdmin && editorVisible && (
        <section
          ref={editorPanelRef}
          className="rounded-3xl border border-stone-200 dark:border-[#3e3e42] bg-white/90 dark:bg-[#0f0f11] p-6 md:p-8 space-y-6 shadow-lg"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">
                {editingPost
                  ? t('blogPage.editor.editingTitle', { defaultValue: 'Editing existing post' })
                  : t('blogPage.editor.createTitle', { defaultValue: 'Create blog post' })}
              </p>
              <h2 className="text-2xl font-semibold">
                {editingPost
                  ? t('blogPage.editor.editHeading', { defaultValue: 'Update your story' })
                  : t('blogPage.editor.createHeading', { defaultValue: 'Start a new story' })}
              </h2>
              <p className="text-sm text-stone-500 dark:text-stone-400">
                {t('blogPage.editor.description', {
                  defaultValue: 'Use the TipTap simple editor to compose rich articles with instant visual feedback.',
                })}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {editingPost && (
                <Badge variant="outline" className="rounded-2xl px-3 py-1 text-xs uppercase tracking-wide">
                  {t('blogPage.editor.createdAtLabel', { defaultValue: 'Created' })}: {formatDisplayDate(editingPost.createdAt)}
                </Badge>
              )}
              <Button type="button" variant="ghost" className="rounded-2xl" onClick={resetEditorState}>
                {t('blogPage.editor.closePanel', { defaultValue: 'Close editor' })}
              </Button>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="blog-title">
                {t('blogPage.editor.titleLabel', { defaultValue: 'Title' })}
              </Label>
              <Input
                id="blog-title"
                value={formTitle}
                onChange={(event) => setFormTitle(event.target.value)}
                placeholder={t('blogPage.editor.titlePlaceholder', { defaultValue: 'A new field report' })}
              />
            </div>
            <div className="rounded-2xl border border-stone-200 dark:border-[#3e3e42] p-4 space-y-3">
              <p className="text-sm font-medium">
                {t('blogPage.editor.visibilityLabel', { defaultValue: 'Visibility' })}
              </p>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="blog-publish-mode"
                    value="draft"
                    checked={publishMode === 'draft'}
                    onChange={() => setPublishMode('draft')}
                    className="h-4 w-4 border-stone-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  {t('blogPage.editor.publishModeDraft', { defaultValue: 'Draft (keep hidden)' })}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="blog-publish-mode"
                    value="scheduled"
                    checked={publishMode === 'scheduled'}
                    onChange={() => setPublishMode('scheduled')}
                    className="h-4 w-4 border-stone-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  {t('blogPage.editor.publishModeScheduled', { defaultValue: 'Schedule / publish' })}
                </label>
              </div>
              {publishMode === 'scheduled' && (
                <div className="grid gap-2">
                  <Label htmlFor="publish-at">
                    {t('blogPage.editor.publishAtLabel', { defaultValue: 'Publish on' })}
                  </Label>
                  <Input
                    id="publish-at"
                    type="datetime-local"
                    value={publishAt}
                    onChange={(event) => setPublishAt(event.target.value)}
                  />
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    {t('blogPage.editor.publishAtHelper', {
                      defaultValue: 'This page becomes publicly visible once this local date/time is reached.',
                    })}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="blog-cover">
                {t('blogPage.editor.coverLabel', { defaultValue: 'Cover image URL' })}
              </Label>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <Input
                  id="blog-cover"
                  type="url"
                  value={coverUrl}
                  onChange={(event) => setCoverUrl(event.target.value)}
                  placeholder="https://..."
                  className="flex-1"
                />
                <div className="flex items-center gap-2">
                  <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverInputChange} />
                  <Button type="button" variant="outline" className="rounded-2xl" onClick={triggerCoverUpload} disabled={coverUploading}>
                    {coverUploading ? (
                      <>
                        <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                        {t('blogPage.editor.coverUploading', { defaultValue: 'Uploading…' })}
                      </>
                    ) : (
                      <>
                        <UploadCloud className="mr-2 h-4 w-4" />
                        {t('blogPage.editor.coverUploadButton', { defaultValue: 'Upload' })}
                      </>
                    )}
                  </Button>
                </div>
              </div>
              {coverUploadError && <p className="text-xs text-red-500">{coverUploadError}</p>}
              <p className="text-xs text-stone-500">
                {t('blogPage.editor.coverHelper', { defaultValue: 'Paste a public image URL or upload to the shared blog folder.' })}
              </p>
              <p className="text-[11px] text-stone-400">
                {t('blogPage.editor.assetFolderHelper', { defaultValue: 'Uploads stored in' })} <code className="font-mono">{assetFolder}</code>
              </p>
            </div>

            <div className="space-y-3 rounded-2xl border border-stone-200 dark:border-[#3e3e42] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">
                    {t('blogPage.editor.summaryLabel', { defaultValue: 'Short description' })}
                  </p>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    {t('blogPage.editor.summaryHelper', { defaultValue: 'Generated automatically from the article body.' })}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-2xl"
                  onClick={() => runSummary(latestHtmlRef.current || editorContent.html, { force: true }).catch(() => {})}
                  disabled={summaryStatus === 'generating'}
                >
                  {summaryStatus === 'generating' ? (
                    <>
                      <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                      {t('blogPage.editor.summaryGenerating', { defaultValue: 'Generating…' })}
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      {t('blogPage.editor.summaryRegenerate', { defaultValue: 'Regenerate' })}
                    </>
                  )}
                </Button>
              </div>
              <div className="rounded-xl bg-stone-50 dark:bg-[#1a1a1a] p-4 min-h-[96px] text-sm text-stone-700 dark:text-stone-100">
                {summaryStatus === 'generating'
                  ? t('blogPage.editor.summaryPending', { defaultValue: 'Summarizing this article…' })
                  : autoSummary || t('blogPage.editor.summaryPlaceholder', { defaultValue: 'Start writing to generate a short description.' })}
              </div>
              {summaryError && <p className="text-xs text-red-500">{summaryError}</p>}
            </div>
          </div>

          <div className="rounded-2xl border border-stone-200 dark:border-[#3e3e42] p-3 text-xs text-stone-500 dark:text-stone-400">
            {t('blogPage.editor.canvasHelper', {
              defaultValue: 'Use the toolbar or slash menu to add blocks, quotes, dividers, and embeds. Everything is auto-sanitized.',
            })}
          </div>

          <BlogEditor
            key={editorKey}
            ref={editorRef}
            initialHtml={initialHtml || undefined}
            initialDocument={initialDocument || undefined}
            uploadFolder={assetFolder}
            onUpdate={handleEditorUpdate}
          />

          {formError && <p className="text-sm text-red-600">{formError}</p>}

          <div className="flex items-center justify-end gap-3">
            <Button type="button" variant="outline" disabled={saving} className="rounded-2xl" onClick={resetEditorState}>
              {t('blogPage.editor.cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button type="button" className="rounded-2xl" onClick={handleSavePost} disabled={saving}>
              {saving
                ? t('blogPage.editor.saving', { defaultValue: 'Saving…' })
                : editingPost
                  ? t('blogPage.editor.updatePost', { defaultValue: 'Update post' })
                  : t('blogPage.editor.save', { defaultValue: 'Publish post' })}
            </Button>
          </div>
        </section>
      )}
    </div>
  )
}
