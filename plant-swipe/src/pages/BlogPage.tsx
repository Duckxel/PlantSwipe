import React from 'react'
import { Loader2, Plus, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { BlogEditor, type BlogEditorHandle } from '@/components/blog/BlogEditor'
import type { JSONContent } from '@tiptap/core'
import { BlogCard } from '@/components/blog/BlogCard'
import { useAuth } from '@/context/AuthContext'
import { usePageMetadata } from '@/hooks/usePageMetadata'
import type { BlogPost } from '@/types/blog'
import { fetchBlogPosts, saveBlogPost } from '@/lib/blogs'
import { supabase } from '@/lib/supabaseClient'
import { cn } from '@/lib/utils'

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

type SummaryStatus = 'idle' | 'stale' | 'generating' | 'ready' | 'error'

type RuntimeEnvBridge = {
  __ENV__?: Record<string, string | undefined>
}

export default function BlogPage() {
  const { t } = useTranslation('common')
  const { user, profile } = useAuth()
  const [posts, setPosts] = React.useState<BlogPost[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [composerOpen, setComposerOpen] = React.useState(false)
  const [editorKey, setEditorKey] = React.useState(0)
  const [editingPost, setEditingPost] = React.useState<BlogPost | null>(null)
  const [formTitle, setFormTitle] = React.useState('')
  const [coverUrl, setCoverUrl] = React.useState('')
  const [publishMode, setPublishMode] = React.useState<'draft' | 'scheduled'>('scheduled')
  const [publishAt, setPublishAt] = React.useState(formatDateTimeLocal(new Date()))
  const [formError, setFormError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [initialHtml, setInitialHtml] = React.useState<string | null>(null)
  const [initialDocument, setInitialDocument] = React.useState<JSONContent | null>(null)
  const [summary, setSummary] = React.useState('')
  const [summaryStatus, setSummaryStatus] = React.useState<SummaryStatus>('idle')
  const [summaryError, setSummaryError] = React.useState<string | null>(null)
  const [editorHtmlSnapshot, setEditorHtmlSnapshot] = React.useState('')
  const [coverUploading, setCoverUploading] = React.useState(false)
  const [coverUploadNotice, setCoverUploadNotice] = React.useState<string | null>(null)
  const [coverUploadError, setCoverUploadError] = React.useState<string | null>(null)
  const editorRef = React.useRef<BlogEditorHandle | null>(null)
  const composerRef = React.useRef<HTMLDivElement | null>(null)
  const coverFileInputRef = React.useRef<HTMLInputElement | null>(null)
  const editorInitializedRef = React.useRef(false)
  const summaryAbortRef = React.useRef<AbortController | null>(null)
  const summaryRequestIdRef = React.useRef(0)
  const summaryTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const runtimeEnv = (globalThis as typeof globalThis & RuntimeEnvBridge).__ENV__
  const adminStaticTokenRef = React.useRef(
    import.meta.env?.VITE_ADMIN_STATIC_TOKEN ?? runtimeEnv?.VITE_ADMIN_STATIC_TOKEN,
  )
  const adminStaticToken = adminStaticTokenRef.current
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

  const resetEditorState = React.useCallback(() => {
    setComposerOpen(false)
    setEditingPost(null)
    setFormTitle('')
    setCoverUrl('')
    setPublishMode('scheduled')
    setPublishAt(formatDateTimeLocal(new Date()))
    setFormError(null)
    setInitialHtml(null)
    setInitialDocument(null)
    setEditorKey((key) => key + 1)
    setSummary('')
    setSummaryStatus('idle')
    setSummaryError(null)
    setEditorHtmlSnapshot('')
    setCoverUploadNotice(null)
    setCoverUploadError(null)
    setCoverUploading(false)
    editorInitializedRef.current = false
    summaryAbortRef.current?.abort()
    summaryAbortRef.current = null
    if (summaryTimerRef.current) {
      clearTimeout(summaryTimerRef.current)
      summaryTimerRef.current = null
    }
  }, [])

  const openCreateDialog = () => {
    if (!isAdmin) return
    editorInitializedRef.current = false
    summaryAbortRef.current?.abort()
    summaryAbortRef.current = null
    setEditorKey((key) => key + 1)
    setEditingPost(null)
    setFormTitle('')
    setCoverUrl('')
    setPublishMode('scheduled')
    setPublishAt(formatDateTimeLocal(new Date()))
    setInitialHtml(DEFAULT_EDITOR_HTML)
    setInitialDocument(null)
    setFormError(null)
    setSummary('')
    setSummaryStatus('stale')
    setSummaryError(null)
    setCoverUploadNotice(null)
    setCoverUploadError(null)
    setCoverUploading(false)
    setComposerOpen(true)
    setTimeout(() => {
      composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  const openEditDialog = (post: BlogPost) => {
    if (!isAdmin) return
    editorInitializedRef.current = false
    summaryAbortRef.current?.abort()
    summaryAbortRef.current = null
    setEditorKey((key) => key + 1)
    setEditingPost(post)
    setFormTitle(post.title)
    setCoverUrl(post.coverImageUrl ?? '')
    setPublishMode(post.isPublished ? 'scheduled' : 'draft')
    setPublishAt(formatDateTimeLocal(post.publishedAt))
    setInitialHtml(post.bodyHtml)
    setInitialDocument((post.editorData as JSONContent | null) ?? null)
    setFormError(null)
    setSummary(post.excerpt ?? '')
    setSummaryStatus(post.excerpt ? 'ready' : 'idle')
    setSummaryError(null)
    setCoverUploadNotice(null)
    setCoverUploadError(null)
    setCoverUploading(false)
    setComposerOpen(true)
    setTimeout(() => {
      composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

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
      const publishDateIso = publishAt ? new Date(publishAt).toISOString() : new Date().toISOString()
      const summaryPayload = summary.trim()
      const { data, error: saveError } = await saveBlogPost({
        id: editingPost?.id,
        slug: editingPost?.slug,
        title: formTitle,
        bodyHtml: html,
        coverImageUrl: coverUrl || null,
        excerpt: summaryPayload || undefined,
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

  const getAuthHeaders = React.useCallback(async () => {
    const headers: Record<string, string> = {}
    try {
      const session = (await supabase.auth.getSession()).data.session
      const token = session?.access_token
      if (token) headers.Authorization = `Bearer ${token}`
    } catch {}
    if (adminStaticToken) {
      headers['X-Admin-Token'] = String(adminStaticToken)
    }
    return headers
  }, [adminStaticToken])

  const uploadBlogImage = React.useCallback(
    async (file: File) => {
      const headers = await getAuthHeaders()
      const form = new FormData()
      form.append('file', file)
      const resp = await fetch('/api/blog/upload-image', {
        method: 'POST',
        headers,
        body: form,
      })
      const data = await resp.json().catch(() => null)
      if (!resp.ok) {
        throw new Error(
          (data && data.error) ||
            t('blogPage.editor.imageUploadError', { defaultValue: 'Failed to upload image.' }),
        )
      }
      return data as { url?: string | null; path?: string | null }
    },
    [getAuthHeaders, t],
  )

  const handleCoverUploadClick = React.useCallback(() => {
    coverFileInputRef.current?.click()
  }, [])

  const handleCoverFileChange = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] || null
      if (!file) return
      setCoverUploadError(null)
      setCoverUploadNotice(t('blogPage.editor.coverUploadWorking', { defaultValue: 'Uploading cover image…' }))
      setCoverUploading(true)
      try {
        const result = await uploadBlogImage(file)
        if (!result?.url) {
          throw new Error(
            t('blogPage.editor.coverUploadNoUrl', {
              defaultValue: 'Upload completed but no public URL was returned.',
            }),
          )
        }
        setCoverUrl(result.url)
        setCoverUploadNotice(t('blogPage.editor.coverUploadSuccess', { defaultValue: 'Cover image updated.' }))
        setTimeout(() => setCoverUploadNotice(null), 4000)
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : t('blogPage.editor.coverUploadError', { defaultValue: 'Failed to upload cover image.' })
        setCoverUploadError(message)
        setCoverUploadNotice(null)
      } finally {
        setCoverUploading(false)
        if (coverFileInputRef.current) {
          coverFileInputRef.current.value = ''
        }
      }
    },
    [t, uploadBlogImage],
  )

  const handleEditorContentChange = React.useCallback(
    ({ html }: { html: string; doc: JSONContent | null; plainText: string }) => {
      setEditorHtmlSnapshot(html)
      if (editorInitializedRef.current) {
        summaryAbortRef.current?.abort()
        setSummaryStatus('stale')
      } else {
        editorInitializedRef.current = true
        if (!editingPost) {
          setSummaryStatus('stale')
        }
      }
    },
    [editingPost],
  )

  const runSummaryGeneration = React.useCallback(async () => {
    const textOnly = editorHtmlSnapshot.replace(/<[^>]+>/g, '').trim()
    if (!textOnly) {
      setSummary('')
      setSummaryStatus('idle')
      setSummaryError(null)
      return
    }
    summaryAbortRef.current?.abort()
    const controller = new AbortController()
    summaryAbortRef.current = controller
    const requestId = ++summaryRequestIdRef.current
    setSummaryStatus('generating')
    setSummaryError(null)
    try {
      const headers = await getAuthHeaders()
      headers['Content-Type'] = 'application/json'
      const resp = await fetch('/api/blog/generate-summary', {
        method: 'POST',
        headers,
        body: JSON.stringify({ title: formTitle, bodyHtml: editorHtmlSnapshot }),
        signal: controller.signal,
      })
      const data = await resp.json().catch(() => null)
      if (!resp.ok) {
        throw new Error(
          (data && data.error) ||
            t('blogPage.editor.summaryError', { defaultValue: 'Failed to generate summary.' }),
        )
      }
      if (summaryRequestIdRef.current !== requestId) return
      setSummary(typeof data?.summary === 'string' ? data.summary : '')
      setSummaryStatus('ready')
    } catch (err) {
      if (controller.signal.aborted) return
      if (summaryRequestIdRef.current !== requestId) return
      setSummaryStatus('error')
      setSummaryError(
        err instanceof Error
          ? err.message
          : t('blogPage.editor.summaryError', { defaultValue: 'Failed to generate summary.' }),
      )
    }
  }, [editorHtmlSnapshot, formTitle, getAuthHeaders, t])

  React.useEffect(() => {
    if (!composerOpen) return
    if (summaryStatus !== 'stale') return
    if (!editorHtmlSnapshot) return
    if (summaryTimerRef.current) {
      clearTimeout(summaryTimerRef.current)
      summaryTimerRef.current = null
    }
    const timer = setTimeout(() => {
      runSummaryGeneration().catch(() => {})
    }, 1200)
    summaryTimerRef.current = timer
    return () => {
      clearTimeout(timer)
      if (summaryTimerRef.current === timer) {
        summaryTimerRef.current = null
      }
    }
  }, [composerOpen, summaryStatus, editorHtmlSnapshot, runSummaryGeneration])

  React.useEffect(() => {
    return () => {
      summaryAbortRef.current?.abort()
      if (summaryTimerRef.current) {
        clearTimeout(summaryTimerRef.current)
        summaryTimerRef.current = null
      }
    }
  }, [])

  const summaryStatusLabel = React.useMemo(() => {
    switch (summaryStatus) {
      case 'ready':
        return t('blogPage.editor.summaryStatus.ready', { defaultValue: 'Up to date' })
      case 'generating':
        return t('blogPage.editor.summaryStatus.generating', { defaultValue: 'Generating…' })
      case 'error':
        return t('blogPage.editor.summaryStatus.error', { defaultValue: 'Failed' })
      case 'stale':
        return t('blogPage.editor.summaryStatus.stale', { defaultValue: 'Needs update' })
      default:
        return t('blogPage.editor.summaryStatus.idle', { defaultValue: 'Idle' })
    }
  }, [summaryStatus, t])

  const summaryBadgeClass = React.useMemo(() => {
    switch (summaryStatus) {
      case 'ready':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
      case 'generating':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
      case 'error':
        return 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300'
      default:
        return 'bg-stone-200 text-stone-700 dark:bg-stone-700/30 dark:text-stone-200'
    }
  }, [summaryStatus])

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

      {isAdmin && composerOpen && (
        <section
          ref={composerRef}
          className="rounded-[32px] border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#0b0b0b] p-6 md:p-8 space-y-6 shadow-sm"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-stone-500 dark:text-stone-400">
                {editingPost ? t('blogPage.editor.editTitle', { defaultValue: 'Edit blog post' }) : t('blogPage.editor.createTitle', { defaultValue: 'Create blog post' })}
              </p>
              <h2 className="text-2xl font-semibold">{formTitle || t('blogPage.editor.titlePlaceholder', { defaultValue: 'A new field report' })}</h2>
              <p className="text-sm text-stone-500 dark:text-stone-400">
                {t('blogPage.editor.description', {
                  defaultValue: 'Use the Notion-style TipTap canvas to compose rich articles without touching code.',
                })}
              </p>
              {editingPost && (
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  {t('blogPage.editor.createdAtLabel', { defaultValue: 'Created' })}: {formatDisplayDate(editingPost.createdAt)}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="ghost" className="rounded-2xl" onClick={resetEditorState} disabled={saving}>
                {t('blogPage.editor.cancel', { defaultValue: 'Cancel' })}
              </Button>
              <Button type="button" className="rounded-2xl" onClick={handleSavePost} disabled={saving}>
                {saving
                  ? t('blogPage.editor.saving', { defaultValue: 'Saving…' })
                  : t('blogPage.editor.save', { defaultValue: 'Save post' })}
              </Button>
            </div>
          </div>

          <div className="grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor="blog-title">
                {t('blogPage.editor.titleLabel', { defaultValue: 'Title' })}
              </Label>
              <Input
                id="blog-title"
                value={formTitle}
                onChange={(event) => setFormTitle(event.target.value)}
                placeholder={t('blogPage.editor.titlePlaceholder', { defaultValue: 'A new field report' })}
                className="rounded-2xl"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="blog-cover">
                {t('blogPage.editor.coverLabel', { defaultValue: 'Cover image' })}
              </Label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Input
                  id="blog-cover"
                  type="url"
                  value={coverUrl}
                  onChange={(event) => setCoverUrl(event.target.value)}
                  placeholder="https://..."
                  className="rounded-2xl"
                />
                <input
                  ref={coverFileInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={handleCoverFileChange}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl w-full sm:w-auto"
                  onClick={handleCoverUploadClick}
                  disabled={coverUploading}
                >
                  {coverUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('blogPage.editor.coverUploading', { defaultValue: 'Uploading…' })}
                    </>
                  ) : (
                    t('blogPage.editor.coverUploadButton', { defaultValue: 'Upload photo' })
                  )}
                </Button>
              </div>
              {coverUploadNotice && <p className="text-xs text-emerald-600 dark:text-emerald-400">{coverUploadNotice}</p>}
              {coverUploadError && <p className="text-xs text-red-600">{coverUploadError}</p>}
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {t('blogPage.editor.coverHelper', {
                  defaultValue: 'Paste a public image URL or upload to store it under UTILITY/blog.',
                })}
              </p>
            </div>

            <div className="rounded-3xl border border-stone-200 dark:border-[#3e3e42] p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">
                    {t('blogPage.editor.summaryLabel', { defaultValue: 'Card summary' })}
                  </p>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    {t('blogPage.editor.summaryHelper', {
                      defaultValue: 'Used on the blog card and meta description.',
                    })}
                  </p>
                </div>
                <Badge className={cn('rounded-xl px-3 py-1 text-xs font-medium', summaryBadgeClass)}>
                  {summaryStatus === 'generating' && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                  {summaryStatusLabel}
                </Badge>
              </div>
              <div className="rounded-2xl border border-dashed border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#111] p-4 text-sm text-stone-700 dark:text-stone-200 min-h-[96px]">
                {summary
                  ? summary
                  : summaryStatus === 'generating'
                    ? t('blogPage.editor.summaryGenerating', { defaultValue: 'Generating summary…' })
                    : t('blogPage.editor.summaryEmpty', { defaultValue: 'Start writing to generate a preview summary.' })}
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => {
                    summaryAbortRef.current?.abort()
                    if (summaryTimerRef.current) {
                      clearTimeout(summaryTimerRef.current)
                      summaryTimerRef.current = null
                    }
                    runSummaryGeneration().catch(() => {})
                  }}
                  disabled={summaryStatus === 'generating' || !editorHtmlSnapshot}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {t('blogPage.editor.summaryRegenerate', { defaultValue: 'Regenerate now' })}
                </Button>
              </div>
              {summaryError && <p className="text-sm text-red-600">{summaryError}</p>}
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
                    className="rounded-2xl"
                  />
                  <p className="text-xs text-stone-500">
                    {t('blogPage.editor.publishAtHelper', {
                      defaultValue: 'This page becomes publicly visible once this local date/time is reached.',
                    })}
                  </p>
                </div>
              )}
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
              onContentChange={handleEditorContentChange}
              onUploadImage={uploadBlogImage}
            />

            {formError && <p className="text-sm text-red-600">{formError}</p>}

            <div className="flex flex-wrap items-center justify-end gap-3">
              <Button type="button" variant="outline" disabled={saving} className="rounded-2xl" onClick={resetEditorState}>
                {t('blogPage.editor.cancel', { defaultValue: 'Cancel' })}
              </Button>
              <Button type="button" className="rounded-2xl" onClick={handleSavePost} disabled={saving}>
                {saving
                  ? t('blogPage.editor.saving', { defaultValue: 'Saving…' })
                  : t('blogPage.editor.save', { defaultValue: 'Save post' })}
              </Button>
            </div>
          </div>
        </section>
      )}
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

    </div>
  )
}
