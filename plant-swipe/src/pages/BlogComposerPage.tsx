import React from "react"
import { useParams } from "react-router-dom"
import { ArrowLeft, RefreshCcw, Sparkles, Trash2, UploadCloud } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { BlogEditor, type BlogEditorHandle } from "@/components/blog/BlogEditor"
import type { JSONContent } from "@tiptap/core"
import { useAuth } from "@/context/AuthContext"
import { usePageMetadata } from "@/hooks/usePageMetadata"
import type { BlogPost } from "@/types/blog"
import { fetchBlogPost, saveBlogPost, deleteBlogPost } from "@/lib/blogs"
import { uploadBlogImage } from "@/lib/blogMedia"
import { buildAdminRequestHeaders } from "@/lib/adminAuth"
import { useLanguageNavigate } from "@/lib/i18nRouting"

const DEFAULT_EDITOR_HTML = `<h2>New Aphylia story</h2><p>Use the editor to share releases, field reports, or garden learnings.</p>`

const formatDateTimeLocal = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value)
  const pad = (num: number) => num.toString().padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`
}

const slugifyFolder = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/["']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 60)

const createDraftFolder = () => {
  const randomId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `blog/draft-${randomId}`
}

const folderForPost = (post?: BlogPost | null, title?: string) => {
  if (post?.slug) return `blog/${post.slug}`
  const candidate = title ? slugifyFolder(title) : ""
  if (candidate) return `blog/${candidate}`
  return createDraftFolder()
}

export default function BlogComposerPage() {
  const { t } = useTranslation("common")
  const { postId } = useParams<{ postId?: string }>()
  const isEditing = Boolean(postId)
  const navigate = useLanguageNavigate()
  const { user, profile } = useAuth()

  const [postsError, setPostsError] = React.useState<string | null>(null)
  const [loadingPost, setLoadingPost] = React.useState<boolean>(isEditing)
  const [editingPost, setEditingPost] = React.useState<BlogPost | null>(null)
  const [editorKey, setEditorKey] = React.useState(0)
  const [formTitle, setFormTitle] = React.useState("")
  const [coverUrl, setCoverUrl] = React.useState("")
  const [autoSummary, setAutoSummary] = React.useState("")
  const [publishMode, setPublishMode] = React.useState<"draft" | "scheduled">("scheduled")
  const [publishAt, setPublishAt] = React.useState(formatDateTimeLocal(new Date()))
  const [formError, setFormError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [initialHtml, setInitialHtml] = React.useState<string | null>(DEFAULT_EDITOR_HTML)
  const [initialDocument, setInitialDocument] = React.useState<JSONContent | null>(null)
  const [assetFolder, setAssetFolder] = React.useState(() => createDraftFolder())
  const [editorContent, setEditorContent] = React.useState<{ html: string; doc: JSONContent | null; plainText: string }>({
    html: "",
    doc: null,
    plainText: "",
  })
  const [summaryStatus, setSummaryStatus] = React.useState<"idle" | "generating" | "error">("idle")
  const [summaryError, setSummaryError] = React.useState<string | null>(null)
  const [coverUploading, setCoverUploading] = React.useState(false)
  const [coverUploadError, setCoverUploadError] = React.useState<string | null>(null)
  const [showCoverImage, setShowCoverImage] = React.useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  const editorRef = React.useRef<BlogEditorHandle | null>(null)
  const coverInputRef = React.useRef<HTMLInputElement | null>(null)
  const summarySourceRef = React.useRef<string>("")
  const summaryAbortRef = React.useRef<AbortController | null>(null)
  const latestHtmlRef = React.useRef<string>("")

  const pageTitle = isEditing
    ? t("blogPage.editor.editTitle", { defaultValue: "Edit blog post" })
    : t("blogPage.editor.createTitle", { defaultValue: "Create blog post" })
  usePageMetadata({ title: pageTitle })

  React.useEffect(() => {
    if (publishMode === "scheduled" && !publishAt) {
      setPublishAt(formatDateTimeLocal(new Date()))
    }
  }, [publishMode, publishAt])

  const resetForCreate = React.useCallback(() => {
    setEditingPost(null)
    setFormTitle("")
    setCoverUrl("")
    setAutoSummary("")
    setPublishMode("scheduled")
    setPublishAt(formatDateTimeLocal(new Date()))
    setFormError(null)
    setInitialHtml(DEFAULT_EDITOR_HTML)
    setInitialDocument(null)
    setEditorContent({ html: "", doc: null, plainText: "" })
    setAssetFolder(createDraftFolder())
    setCoverUploadError(null)
    setShowCoverImage(false)
    setSummaryError(null)
    setSummaryStatus("idle")
    summarySourceRef.current = ""
    latestHtmlRef.current = ""
    setEditorKey((key) => key + 1)
  }, [])

  React.useEffect(() => {
    if (!isEditing) {
      setPostsError(null)
      setLoadingPost(false)
      resetForCreate()
      return
    }

    let cancelled = false
    const load = async () => {
      setLoadingPost(true)
      setPostsError(null)
      try {
        const post = await fetchBlogPost(postId!)
        if (!post) {
          if (!cancelled) setPostsError(t("blogPage.editor.loadError", { defaultValue: "Blog post not found." }))
          return
        }
        if (cancelled) return
        setEditingPost(post)
        setFormTitle(post.title)
        setCoverUrl(post.coverImageUrl ?? "")
        setAutoSummary(post.excerpt ?? "")
        setPublishMode(post.isPublished ? "scheduled" : "draft")
        setPublishAt(formatDateTimeLocal(post.publishedAt))
        setInitialHtml(post.bodyHtml || DEFAULT_EDITOR_HTML)
        setInitialDocument((post.editorData as JSONContent | null) ?? null)
        setEditorContent({ html: post.bodyHtml, doc: (post.editorData as JSONContent | null) ?? null, plainText: "" })
        setAssetFolder(folderForPost(post, post.title))
        setCoverUploadError(null)
        setShowCoverImage(post.showCoverImage ?? true)
        setSummaryError(null)
        setSummaryStatus("idle")
        summarySourceRef.current = post.bodyHtml
        latestHtmlRef.current = post.bodyHtml
        setEditorKey((key) => key + 1)
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error
              ? err.message
              : t("blogPage.editor.loadError", { defaultValue: "Failed to load blog post." })
          setPostsError(message)
        }
      } finally {
        if (!cancelled) setLoadingPost(false)
      }
    }

    load().catch(() => {})
    return () => {
      cancelled = true
    }
  }, [isEditing, postId, resetForCreate, t])

  React.useEffect(() => {
    if (editingPost?.slug) return
    if (!assetFolder.startsWith("blog/draft-")) return
    const candidate = slugifyFolder(formTitle)
    if (candidate && assetFolder !== `blog/${candidate}`) {
      setAssetFolder(`blog/${candidate}`)
    }
  }, [assetFolder, formTitle, editingPost?.slug])

  const uploadCoverImage = React.useCallback(
    async (file: File) => {
      setCoverUploadError(null)
      setCoverUploading(true)
      try {
        const result = await uploadBlogImage(file, { folder: assetFolder })
        if (result?.url) {
          setCoverUrl(result.url)
          setShowCoverImage(true) // Auto-check when image is uploaded
        } else if (result?.path) {
          setCoverUrl(result.path)
          setShowCoverImage(true) // Auto-check when image is uploaded
        }
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : t("blogPage.editor.coverUploadError", { defaultValue: "Failed to upload cover image." })
        setCoverUploadError(message)
      } finally {
        setCoverUploading(false)
        if (coverInputRef.current) {
          coverInputRef.current.value = ""
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

  const runSummary = React.useCallback(
    async (html: string, options?: { force?: boolean }) => {
      const source = html.trim()
      if (!source) {
        summarySourceRef.current = ""
        setAutoSummary("")
        setSummaryStatus("idle")
        setSummaryError(null)
        return ""
      }
      if (!options?.force && summarySourceRef.current === source) {
        return autoSummary
      }
      summaryAbortRef.current?.abort()
      const controller = new AbortController()
      summaryAbortRef.current = controller
      setSummaryStatus("generating")
      setSummaryError(null)
      try {
        const headers = await buildAdminRequestHeaders({ "Content-Type": "application/json" })
        const response = await fetch("/api/blog/summarize", {
          method: "POST",
          headers,
          body: JSON.stringify({ html: source, title: formTitle || undefined }),
          credentials: "same-origin",
          signal: controller.signal,
        })
        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(payload?.error || t("blogPage.editor.summaryError", { defaultValue: "Failed to generate summary." }))
        }
        const summaryText = (payload?.summary as string) || ""
        setAutoSummary(summaryText)
        summarySourceRef.current = source
        setSummaryStatus("idle")
        return summaryText
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          return ""
        }
        const message =
          err instanceof Error
            ? err.message
            : t("blogPage.editor.summaryError", { defaultValue: "Failed to generate summary." })
        setSummaryError(message)
        setSummaryStatus("error")
        throw err
      } finally {
        if (summaryAbortRef.current === controller) {
          summaryAbortRef.current = null
        }
      }
    },
    [autoSummary, formTitle, t],
  )

  const handleSavePost = async () => {
    const editorInstance = editorRef.current
    if (!editorInstance) {
      setFormError(t("blogPage.editor.errorNoEditor", { defaultValue: "Editor not ready yet." }))
      return
    }
    if (!formTitle.trim()) {
      setFormError(t("blogPage.editor.validation.title", { defaultValue: "Please enter a title." }))
      return
    }
    const authorId = profile?.id || user?.id
    if (!authorId) {
      setFormError(t("blogPage.editor.validation.author", { defaultValue: "Missing author information." }))
      return
    }
    if (publishMode === "scheduled" && !publishAt) {
      setFormError(t("blogPage.editor.validation.publishAt", { defaultValue: "Please provide a publish date." }))
      return
    }

    setSaving(true)
    setFormError(null)
    try {
      const html = editorInstance.getHtml()
      const doc = editorInstance.getDocument()
      latestHtmlRef.current = html
      const trimmedHtml = html.trim()
      summaryAbortRef.current?.abort()
      let summaryText = autoSummary
      if (trimmedHtml) {
        try {
          summaryText = await runSummary(trimmedHtml, { force: true })
          setAutoSummary(summaryText)
        } catch {
          summaryText = autoSummary
        }
      }
      const publishDateIso = publishAt ? new Date(publishAt).toISOString() : new Date().toISOString()
      const currentUserName = profile?.display_name || profile?.username || user?.email || "Aphylia Team"
      const { data, error: saveError } = await saveBlogPost({
        id: editingPost?.id,
        slug: editingPost?.slug,
        title: formTitle,
        bodyHtml: html,
        coverImageUrl: coverUrl || null,
        excerpt: summaryText?.trim() || undefined,
        isPublished: publishMode === "scheduled",
        publishedAt: publishDateIso,
        authorId,
        authorName: isEditing ? editingPost?.authorName ?? currentUserName : currentUserName,
        editorData: doc ?? undefined,
        showCoverImage,
        updatedByName: isEditing ? currentUserName : undefined,
      })

      if (saveError || !data) {
        setFormError(saveError || t("blogPage.editor.saveError", { defaultValue: "Failed to save post." }))
        setSaving(false)
        return
      }

      navigate("/blog", { replace: true })
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : t("blogPage.editor.saveError", { defaultValue: "Failed to save post." }),
      )
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    navigate("/blog")
  }

  const handleDeletePost = async () => {
    if (!editingPost?.id) return

    setDeleting(true)
    setFormError(null)
    try {
      await deleteBlogPost(editingPost.id)
      setDeleteDialogOpen(false)
      navigate("/blog", { replace: true })
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : t("blogPage.editor.deleteError", { defaultValue: "Failed to delete post." }),
      )
      setDeleting(false)
    }
  }

  const summaryText =
    summaryStatus === "generating"
      ? t("blogPage.editor.summaryPending", { defaultValue: "Summarizing this article…" })
      : autoSummary || t("blogPage.editor.summaryPlaceholder", { defaultValue: "Generate a short description when ready." })

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <button
            type="button"
            onClick={handleCancel}
            className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("blogPage.actions.backToBlog", { defaultValue: "Back to blog" })}
          </button>
          <h1 className="text-3xl font-semibold">
            {isEditing
              ? t("blogPage.editor.editHeading", { defaultValue: "Update blog post" })
              : t("blogPage.editor.createHeading", { defaultValue: "Start a new story" })}
          </h1>
          <p className="text-sm text-stone-600 dark:text-stone-400">
            {t("blogPage.editor.description", {
              defaultValue: "Use the TipTap simple editor to compose rich articles with instant visual feedback.",
            })}
          </p>
        </div>
        {editingPost && (
          <Badge variant="outline" className="rounded-2xl px-3 py-1 text-xs uppercase tracking-wide">
            {t("blogPage.editor.createdAtLabel", { defaultValue: "Created" })}:{" "}
            {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
              new Date(editingPost.createdAt),
            )}
          </Badge>
        )}
      </div>

      {loadingPost && (
        <div className="flex items-center gap-2 rounded-3xl border border-dashed border-stone-300 dark:border-[#3e3e42] p-6 text-sm text-stone-500 dark:text-stone-400">
          <RefreshCcw className="h-4 w-4 animate-spin" />
          {t("blogPage.editor.loading", { defaultValue: "Loading blog post…" })}
        </div>
      )}

      {!loadingPost && postsError && (
        <div className="space-y-4 rounded-3xl border border-red-200 bg-red-50/80 dark:border-red-900/40 dark:bg-red-900/10 p-6 text-sm text-red-700 dark:text-red-200">
          <p>{postsError}</p>
          <Button type="button" variant="outline" className="rounded-2xl" onClick={handleCancel}>
            {t("blogPage.actions.backToBlog", { defaultValue: "Back to blog" })}
          </Button>
        </div>
      )}

      {!loadingPost && !postsError && (
        <div className="space-y-6">
          <div className="space-y-2">
              <Label htmlFor="blog-title">{t("blogPage.editor.titleLabel", { defaultValue: "Title" })}</Label>
              <Input
                id="blog-title"
                value={formTitle}
                onChange={(event) => setFormTitle(event.target.value)}
                placeholder={t("blogPage.editor.titlePlaceholder", { defaultValue: "A new field report" })}
              />
            </div>
            <div className="rounded-2xl border border-stone-200 dark:border-[#3e3e42] p-4 space-y-3">
              <p className="text-sm font-medium">{t("blogPage.editor.visibilityLabel", { defaultValue: "Visibility" })}</p>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="blog-publish-mode"
                    value="draft"
                    checked={publishMode === "draft"}
                    onChange={() => setPublishMode("draft")}
                    className="h-4 w-4 border-stone-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  {t("blogPage.editor.publishModeDraft", { defaultValue: "Draft (keep hidden)" })}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="blog-publish-mode"
                    value="scheduled"
                    checked={publishMode === "scheduled"}
                    onChange={() => setPublishMode("scheduled")}
                    className="h-4 w-4 border-stone-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  {t("blogPage.editor.publishModeScheduled", { defaultValue: "Schedule / publish" })}
                </label>
              </div>
              {publishMode === "scheduled" && (
                <div className="grid gap-2">
                  <Label htmlFor="publish-at">{t("blogPage.editor.publishAtLabel", { defaultValue: "Publish on" })}</Label>
                  <Input
                    id="publish-at"
                    type="datetime-local"
                    value={publishAt}
                    onChange={(event) => setPublishAt(event.target.value)}
                  />
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    {t("blogPage.editor.publishAtHelper", {
                      defaultValue: "This page becomes publicly visible once this local date/time is reached.",
                    })}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="blog-cover">{t("blogPage.editor.coverLabel", { defaultValue: "Cover image URL" })}</Label>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <Input
                  id="blog-cover"
                  type="url"
                  value={coverUrl}
                  onChange={(event) => {
                    const newUrl = event.target.value
                    setCoverUrl(newUrl)
                    // Auto-check show cover image when a URL is added
                    if (newUrl.trim() && !coverUrl.trim()) {
                      setShowCoverImage(true)
                    }
                  }}
                  placeholder="https://..."
                  className="flex-1"
                />
                <div className="flex items-center gap-2">
                  <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverInputChange} />
                  <Button type="button" variant="outline" className="rounded-2xl" onClick={triggerCoverUpload} disabled={coverUploading}>
                    {coverUploading ? (
                      <>
                        <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                        {t("blogPage.editor.coverUploading", { defaultValue: "Uploading…" })}
                      </>
                    ) : (
                      <>
                        <UploadCloud className="mr-2 h-4 w-4" />
                        {t("blogPage.editor.coverUploadButton", { defaultValue: "Upload" })}
                      </>
                    )}
                  </Button>
                </div>
              </div>
              {coverUploadError && <p className="text-xs text-red-500">{coverUploadError}</p>}
              <label className="flex items-center gap-2 mt-3">
                <input
                  type="checkbox"
                  checked={showCoverImage}
                  onChange={(e) => setShowCoverImage(e.target.checked)}
                  className="h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm text-stone-600 dark:text-stone-400">
                  {t("blogPage.editor.showCoverAtTop", { defaultValue: "Display cover image at the top of the article" })}
                </span>
              </label>
              <p className="text-xs text-stone-500">
                {t("blogPage.editor.coverHelper", { defaultValue: "Paste a public image URL or upload to the shared blog folder." })}
              </p>
              <p className="text-[11px] text-stone-400">
                {t("blogPage.editor.coverHelperFallback", { defaultValue: "If no cover image is set, the first image in the blog content will be used for social sharing." })}
              </p>
              <p className="text-[11px] text-stone-400">
                {t("blogPage.editor.assetFolderHelper", { defaultValue: "Uploads stored in" })} <code className="font-mono">{assetFolder}</code>
              </p>
            </div>

            <div className="space-y-3 rounded-2xl border border-stone-200 dark:border-[#3e3e42] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">
                    {t("blogPage.editor.summaryLabel", { defaultValue: "Short description" })}
                  </p>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    {t("blogPage.editor.summaryHelper", { defaultValue: "Generated automatically from the article body." })}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-2xl"
                  onClick={() => runSummary(latestHtmlRef.current || editorContent.html, { force: true }).catch(() => {})}
                  disabled={summaryStatus === "generating"}
                >
                  {summaryStatus === "generating" ? (
                    <>
                      <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                      {t("blogPage.editor.summaryGenerating", { defaultValue: "Generating…" })}
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      {t("blogPage.editor.summaryRegenerate", { defaultValue: "Regenerate" })}
                    </>
                  )}
                </Button>
              </div>
              <div className="rounded-xl bg-stone-50 dark:bg-[#1a1a1a] p-4 min-h-[96px] text-sm text-stone-700 dark:text-stone-100">
                {summaryText}
              </div>
              {summaryError && <p className="text-xs text-red-500">{summaryError}</p>}
            </div>

          <div className="rounded-2xl border border-stone-200 dark:border-[#3e3e42] p-3 text-xs text-stone-500 dark:text-stone-400">
            {t("blogPage.editor.canvasHelper", {
              defaultValue: "Use the toolbar or slash menu to add blocks, quotes, dividers, and embeds. Everything is auto-sanitized.",
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
            <Button type="button" variant="outline" disabled={saving} className="rounded-2xl" onClick={handleCancel}>
              {t("blogPage.editor.cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button type="button" className="rounded-2xl" onClick={handleSavePost} disabled={saving}>
              {saving
                ? t("blogPage.editor.saving", { defaultValue: "Saving…" })
                : isEditing
                  ? t("blogPage.editor.updatePost", { defaultValue: "Update post" })
                  : t("blogPage.editor.save", { defaultValue: "Publish post" })}
            </Button>
          </div>

          {/* Delete Section - Only shown when editing */}
          {isEditing && editingPost && (
            <div className="mt-12 pt-8 border-t border-red-200 dark:border-red-900/40">
              <div className="rounded-2xl border border-red-200 bg-red-50/50 dark:border-red-900/40 dark:bg-red-900/10 p-6 space-y-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-red-700 dark:text-red-400">
                    {t("blogPage.editor.dangerZone", { defaultValue: "Danger zone" })}
                  </h3>
                  <p className="text-sm text-red-600/80 dark:text-red-300/80">
                    {t("blogPage.editor.deleteWarning", {
                      defaultValue: "Deleting this blog post is permanent and cannot be undone.",
                    })}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  className="rounded-2xl"
                  onClick={() => setDeleteDialogOpen(true)}
                  disabled={saving || deleting}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("blogPage.editor.deletePost", { defaultValue: "Delete this post" })}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => !deleting && setDeleteDialogOpen(open)}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <Trash2 className="h-5 w-5" />
              {t("blogPage.editor.deleteDialogTitle", { defaultValue: "Delete blog post?" })}
            </DialogTitle>
            <DialogDescription>
              {t("blogPage.editor.deleteDialogDescription", {
                defaultValue:
                  "This will permanently delete the blog post. This action cannot be undone.",
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 p-3 rounded-xl bg-stone-100 dark:bg-stone-800/50">
            <p className="text-sm font-medium text-stone-700 dark:text-stone-200 truncate">
              {editingPost?.title || t("blogPage.editor.untitled", { defaultValue: "Untitled post" })}
            </p>
          </div>
          <div className="flex gap-3 mt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1 rounded-2xl"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              {t("blogPage.editor.cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="flex-1 rounded-2xl"
              onClick={handleDeletePost}
              disabled={deleting}
            >
              {deleting
                ? t("blogPage.editor.deleting", { defaultValue: "Deleting…" })
                : t("blogPage.editor.confirmDelete", { defaultValue: "Yes, delete" })}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
