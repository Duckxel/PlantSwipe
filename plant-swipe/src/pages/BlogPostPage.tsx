import React from 'react'
import { useParams } from 'react-router-dom'
import DOMPurify from 'dompurify'
import { ArrowLeft, CalendarClock, CalendarDays, Clock, Eye, UserRound, X, ZoomIn } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Link } from '@/components/i18n/Link'
import { usePageMetadata } from '@/hooks/usePageMetadata'
import type { BlogPost } from '@/types/blog'
import { extractFirstImageFromHtml } from '@/types/blog'
import { fetchBlogPost } from '@/lib/blogs'
import { useAuth } from '@/context/AuthContext'
import { checkEditorAccess } from '@/constants/userRoles'
import { trackImpression, fetchImpression } from '@/lib/impressions'

const formatDateTime = (value?: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeStyle: 'short' }).format(date)
}

const formatDateOnly = (value?: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>()
  const { t } = useTranslation('common')
  const { profile } = useAuth()
  const [post, setPost] = React.useState<BlogPost | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [fullscreenImage, setFullscreenImage] = React.useState<string | null>(null)
  const contentRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!slug) return
    setLoading(true)
    setError(null)
    fetchBlogPost(slug)
      .then((data) => {
        if (!data) {
          setError(t('blogPage.detail.notFound', { defaultValue: 'This post does not exist anymore.' }))
        }
        setPost(data)
      })
      .catch((err: unknown) => {
        const message =
          err instanceof Error
            ? err.message
            : t('blogPage.detail.error', { defaultValue: 'Unable to load this post.' })
        setError(message)
      })
      .finally(() => setLoading(false))
  }, [slug, t])

  const publishedLabel = formatDateTime(post?.publishedAt)
  const authorLabel = post?.authorName || t('blogPage.card.unknownAuthor', { defaultValue: 'Team Aphylia' })
  const isAdmin = checkEditorAccess(profile)
  const isDraft = post ? !post.isPublished : false
  const isScheduled = post ? post.isPublished && Date.parse(post.publishedAt) > Date.now() : false

  React.useEffect(() => {
    if (!post) return
    if ((isDraft || isScheduled) && !isAdmin) {
      setError(t('blogPage.detail.notFound', { defaultValue: 'This post does not exist anymore.' }))
      setPost(null)
    }
  }, [post, isDraft, isScheduled, isAdmin, t])

  const sanitizedHtml = React.useMemo(() => {
    if (!post?.bodyHtml) return ''
    return DOMPurify.sanitize(post.bodyHtml, { ADD_ATTR: ['style', 'class'], ADD_TAGS: ['style'] })
  }, [post?.bodyHtml])

  // Determine the effective cover image URL (explicit or first from content)
  const effectiveCoverImageUrl = React.useMemo(() => {
    if (post?.coverImageUrl) return post.coverImageUrl
    // Fallback to first image in content for SEO/social sharing
    return extractFirstImageFromHtml(post?.bodyHtml ?? '')
  }, [post?.coverImageUrl, post?.bodyHtml])

  // Whether to display cover at top (only if showCoverImage is true AND we have an explicit cover OR fallback)
  const shouldShowCoverAtTop = post?.showCoverImage !== false && effectiveCoverImageUrl

  // Add click handlers to images in the blog content for fullscreen viewing
  React.useEffect(() => {
    if (!contentRef.current) return

    const handleImageClick = (e: Event) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'IMG') {
        const img = target as HTMLImageElement
        if (img.src) {
          setFullscreenImage(img.src)
        }
      }
    }

    const container = contentRef.current
    container.addEventListener('click', handleImageClick)

    // Add visual cue that images are clickable
    const images = container.querySelectorAll('img')
    images.forEach((img) => {
      img.style.cursor = 'zoom-in'
    })

    return () => {
      container.removeEventListener('click', handleImageClick)
    }
  }, [sanitizedHtml])

  // Use AI-generated SEO title/description if available, otherwise fall back to defaults
  const seoTitle = post?.seoTitle
    || (post ? t('seo.blog.postTitle', { title: post.title, defaultValue: `${post.title} · Aphylia Blog` })
    : t('seo.blog.listTitle', { defaultValue: 'Aphylia Blog' }))
  const seoDescription = post?.seoDescription
    || post?.excerpt
    || t('seo.blog.postDescription', {
      title: post?.title ?? '',
      author: authorLabel,
      date: publishedLabel,
      defaultValue: 'Stories from Aphylia.',
    })
  usePageMetadata({ 
    title: seoTitle, 
    description: seoDescription,
    image: effectiveCoverImageUrl ?? undefined,
    url: slug ? `/blog/${slug}` : '/blog',
  })

  // --- Impression tracking (page views) ---
  const [impressionCount, setImpressionCount] = React.useState<number | null>(null)

  // Track impression on every page load/reload (fire-and-forget).
  // Fires immediately based on URL slug — no auth or data load required.
  React.useEffect(() => {
    if (!slug) return
    trackImpression('blog', slug)
  }, [slug])

  // Fetch impression count for admins (uses slug as the entity_id)
  React.useEffect(() => {
    if (!slug || !profile?.is_admin) {
      setImpressionCount(null)
      return
    }
    let ignore = false
    fetchImpression('blog', slug).then((data) => {
      if (!ignore && data) setImpressionCount(data.count)
    })
    return () => { ignore = true }
  }, [slug, profile?.is_admin])

  // Display tags if present
  const displayTags = post?.tags ?? []

  // Footer attribution info
  const createdDate = formatDateOnly(post?.createdAt)
  const updatedDate = formatDateOnly(post?.updatedAt)
  const updatedByLabel = post?.updatedByName
  const hasBeenModified = post?.updatedAt && post?.createdAt && post.updatedAt !== post.createdAt

  return (
    <div className="max-w-4xl mx-auto mt-8 px-4 pb-20 space-y-8">
      <Button asChild variant="ghost" className="rounded-2xl w-fit">
        <Link to="/blog">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('blogPage.detail.back', { defaultValue: 'Back to blog' })}
        </Link>
      </Button>

      {loading && (
        <div className="rounded-3xl border border-dashed border-stone-300 dark:border-[#3e3e42] p-8 text-center text-sm text-stone-500 dark:text-stone-400">
          {t('blogPage.state.loading', { defaultValue: 'Fetching the latest posts…' })}
        </div>
      )}

      {!loading && error && (
        <div className="rounded-3xl border border-red-200 bg-red-50/80 dark:border-red-900/40 dark:bg-red-900/10 p-6 space-y-3 text-sm">
          <p className="text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {!loading && !error && post && (
        <>
          <article className="space-y-6">
            <div className="space-y-4">
              <Badge className="rounded-2xl px-4 py-1 w-fit bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
                {t('blogPage.hero.badge', { defaultValue: 'Stories & releases' })}
              </Badge>
              <h1 className="text-3xl md:text-4xl font-semibold">{post.title}</h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-stone-500 dark:text-stone-400">
                <span className="inline-flex items-center gap-2">
                  <UserRound className="h-4 w-4" />
                  {authorLabel}
                </span>
                {publishedLabel && (
                  <span className="inline-flex items-center gap-2">
                    <CalendarClock className="h-4 w-4" />
                    {publishedLabel}
                  </span>
                )}
                {(isDraft || isScheduled) && (
                  <Badge
                    variant="secondary"
                    className={`rounded-2xl uppercase tracking-wide text-[10px] ${isScheduled ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-50' : ''}`}
                  >
                    {isDraft
                      ? t('blogPage.card.draftBadge', { defaultValue: 'Draft' })
                      : t('blogPage.card.scheduledBadge', { defaultValue: 'Scheduled' })}
                  </Badge>
                )}
                {/* Impression count badge (Admin only) */}
                {profile?.is_admin && impressionCount !== null && (
                  <Badge
                    variant="secondary"
                    className="rounded-2xl px-3 py-1 text-xs font-medium bg-stone-100 text-stone-600 dark:bg-[#2a2a2e] dark:text-stone-300 border border-stone-200 dark:border-[#3e3e42] inline-flex items-center gap-1.5"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    {impressionCount.toLocaleString()} {t('admin.impressions', { defaultValue: 'impressions' })}
                  </Badge>
                )}
              </div>
              {displayTags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {displayTags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="rounded-2xl px-3 py-1 text-xs text-stone-600 dark:text-stone-300 border-stone-300 dark:border-stone-600"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {shouldShowCoverAtTop && (
              <div 
                className="rounded-[28px] overflow-hidden border border-stone-200 dark:border-[#3e3e42] cursor-zoom-in group relative"
                onClick={() => setFullscreenImage(effectiveCoverImageUrl)}
              >
                <img
                  src={effectiveCoverImageUrl}
                  alt={post.title}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  loading="lazy"
                  decoding="async"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <ZoomIn className="h-8 w-8 text-white drop-shadow-lg" />
                </div>
              </div>
            )}

            {(isDraft || isScheduled) && (
              <div className="rounded-2xl border border-dashed border-stone-300 dark:border-[#3e3e42] bg-stone-50/60 dark:bg-[#1b1b1b] p-4 text-sm text-stone-600 dark:text-stone-300">
                {isDraft
                  ? t('blogPage.detail.statusDraftNotice', { defaultValue: 'This story is still a draft. Only admins can see this preview.' })
                  : t('blogPage.detail.statusScheduledNotice', { defaultValue: 'This story is scheduled. Readers will see it once the publish date is reached.' })}
              </div>
            )}

            <div
              ref={contentRef}
              className="blog-article-content prose prose-stone dark:prose-invert max-w-none text-base leading-relaxed [&_img]:rounded-2xl [&_img]:cursor-zoom-in [&_img:hover]:opacity-90 [&_img]:transition-opacity"
              dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
            />
          </article>

          {/* Footer attribution section */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[10px] sm:text-xs text-stone-400 dark:text-stone-500 py-3 border-t border-stone-200 dark:border-[#3e3e42]">
            {(createdDate || authorLabel) && (
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-3 w-3" />
                <span>{t('blogPage.footer.created', { defaultValue: 'Created' })}</span>
                <span className="text-stone-500 dark:text-stone-400">{createdDate || '—'}</span>
                {authorLabel && <span>· {authorLabel}</span>}
              </span>
            )}
            {hasBeenModified && (
              <span className="flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                <span>{t('blogPage.footer.updated', { defaultValue: 'Updated' })}</span>
                <span className="text-stone-500 dark:text-stone-400">{updatedDate || '—'}</span>
                {updatedByLabel && <span>· {updatedByLabel}</span>}
              </span>
            )}
          </div>
        </>
      )}

      {/* Fullscreen Image Viewer */}
      <Dialog open={!!fullscreenImage} onOpenChange={(open) => !open && setFullscreenImage(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none rounded-2xl overflow-hidden">
          <DialogTitle className="sr-only">
            {t('blogPage.detail.fullscreenImageTitle', { defaultValue: 'Fullscreen image view' })}
          </DialogTitle>
          <button
            onClick={() => setFullscreenImage(null)}
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
          {fullscreenImage && (
            <div className="flex items-center justify-center w-full h-full min-h-[50vh]">
              <img 
                src={fullscreenImage}
                alt="Fullscreen view"
                className="max-w-full max-h-[90vh] object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
