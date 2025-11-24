import React from 'react'
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { BlogEditor, type BlogEditorHandle } from '@/components/blog/BlogEditor'
import { BlogCard } from '@/components/blog/BlogCard'
import { useAuth } from '@/context/AuthContext'
import { usePageMetadata } from '@/hooks/usePageMetadata'
import type { BlogPost } from '@/types/blog'
import { fetchBlogPosts, saveBlogPost } from '@/lib/blogs'

const DEFAULT_EDITOR_HTML = `<section class="section">
  <div class="container">
    <h1 data-gjs-type="text">New Aphylia story</h1>
    <p data-gjs-type="text">Use the blocks panel (top-left) to add media, columns, and text.</p>
  </div>
</section>`

const sortPostsByDate = (list: BlogPost[]) =>
  [...list].sort((a, b) => {
    const aTime = Date.parse(a.publishedAt || a.createdAt)
    const bTime = Date.parse(b.publishedAt || b.createdAt)
    return bTime - aTime
  })

export default function BlogPage() {
  const { t } = useTranslation('common')
  const { user, profile } = useAuth()
  const [posts, setPosts] = React.useState<BlogPost[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [editorOpen, setEditorOpen] = React.useState(false)
  const [editorKey, setEditorKey] = React.useState(0)
  const [editingPost, setEditingPost] = React.useState<BlogPost | null>(null)
  const [formTitle, setFormTitle] = React.useState('')
  const [coverUrl, setCoverUrl] = React.useState('')
  const [excerpt, setExcerpt] = React.useState('')
  const [publishNow, setPublishNow] = React.useState(true)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [initialHtml, setInitialHtml] = React.useState<string | null>(null)
  const [initialProject, setInitialProject] = React.useState<Record<string, unknown> | null>(null)
  const editorRef = React.useRef<BlogEditorHandle | null>(null)
  const isAdmin = Boolean(profile?.is_admin)

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
    setEditorOpen(false)
    setEditingPost(null)
    setFormTitle('')
    setCoverUrl('')
    setExcerpt('')
    setPublishNow(true)
    setFormError(null)
    setInitialHtml(null)
    setInitialProject(null)
    setEditorKey((key) => key + 1)
  }, [])

  const openCreateDialog = () => {
    if (!isAdmin) return
    setEditorKey((key) => key + 1)
    setEditingPost(null)
    setFormTitle('')
    setCoverUrl('')
    setExcerpt('')
    setPublishNow(true)
    setInitialHtml(DEFAULT_EDITOR_HTML)
    setInitialProject(null)
    setFormError(null)
    setEditorOpen(true)
  }

  const openEditDialog = (post: BlogPost) => {
    if (!isAdmin) return
    setEditorKey((key) => key + 1)
    setEditingPost(post)
    setFormTitle(post.title)
    setCoverUrl(post.coverImageUrl ?? '')
    setExcerpt(post.excerpt ?? '')
    setPublishNow(post.isPublished)
    setInitialHtml(post.bodyHtml)
    setInitialProject((post.editorData as Record<string, unknown> | null) ?? null)
    setFormError(null)
    setEditorOpen(true)
  }

  const handleSavePost = async () => {
    if (!editorRef.current) {
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

    setSaving(true)
    setFormError(null)
    try {
      const html = editorRef.current.getHtml()
      const css = editorRef.current.getCss()
      const projectData = editorRef.current.getProjectData()
      const bodyHtml = css?.trim() ? `<style>${css}</style>${html}` : html
      const { data, error: saveError } = await saveBlogPost({
        id: editingPost?.id,
        slug: editingPost?.slug,
        title: formTitle,
        bodyHtml,
        coverImageUrl: coverUrl || null,
        excerpt: excerpt || undefined,
        isPublished: publishNow,
        authorId,
        authorName: profile?.display_name || profile?.username || user?.email || 'Aphylia Team',
        editorData: projectData ?? undefined,
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
              defaultValue: 'Admins can author new posts with the GrapesJS builder below. Drafts remain private until published.',
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

      <Dialog
        open={editorOpen}
        onOpenChange={(open) => {
          if (open) {
            setEditorOpen(true)
          } else {
            resetEditorState()
          }
        }}
      >
        <DialogContent className="max-w-4xl overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              {editingPost
                ? t('blogPage.editor.editTitle', { defaultValue: 'Edit blog post' })
                : t('blogPage.editor.createTitle', { defaultValue: 'Create blog post' })}
            </DialogTitle>
            <DialogDescription>
              {t('blogPage.editor.description', {
                defaultValue: 'Use the visual GrapesJS canvas to compose your article without writing code.',
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-3">
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
            <div className="grid gap-3">
              <Label htmlFor="blog-cover">
                {t('blogPage.editor.coverLabel', { defaultValue: 'Cover image URL' })}
              </Label>
              <Input
                id="blog-cover"
                type="url"
                value={coverUrl}
                onChange={(event) => setCoverUrl(event.target.value)}
                placeholder="https://..."
              />
              <p className="text-xs text-stone-500">
                {t('blogPage.editor.coverHelper', { defaultValue: 'Paste a public image URL or leave blank for a placeholder.' })}
              </p>
            </div>
            <div className="grid gap-3">
              <Label htmlFor="blog-excerpt">
                {t('blogPage.editor.excerptLabel', { defaultValue: 'Short summary (optional)' })}
              </Label>
              <Textarea
                id="blog-excerpt"
                value={excerpt}
                onChange={(event) => setExcerpt(event.target.value)}
                rows={3}
                placeholder={t('blogPage.editor.excerptPlaceholder', { defaultValue: 'One or two sentences that appear on the card.' })}
              />
            </div>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                checked={publishNow}
                onChange={(event) => setPublishNow(event.target.checked)}
              />
              {t('blogPage.editor.publishToggle', { defaultValue: 'Publish immediately' })}
            </label>
            <div className="rounded-2xl border border-stone-200 dark:border-[#3e3e42] p-3 text-xs text-stone-500 dark:text-stone-400">
              {t('blogPage.editor.canvasHelper', {
                defaultValue: 'Drag blocks from the top-left panel, tweak text inline, and keep styles consistent. Your HTML is auto-sanitized.',
              })}
            </div>
            <BlogEditor
              key={editorKey}
              ref={editorRef}
              initialHtml={initialHtml || undefined}
              initialProject={initialProject || undefined}
              className="rounded-2xl border border-stone-200 dark:border-[#3e3e42] overflow-hidden"
              height="60vh"
            />
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <div className="flex items-center justify-end gap-3">
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
        </DialogContent>
      </Dialog>
    </div>
  )
}
