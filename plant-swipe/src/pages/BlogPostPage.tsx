import React from 'react'
import { useParams } from 'react-router-dom'
import DOMPurify from 'dompurify'
import { ArrowLeft, CalendarClock, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Link } from '@/components/i18n/Link'
import { usePageMetadata } from '@/hooks/usePageMetadata'
import type { BlogPost } from '@/types/blog'
import { fetchBlogPost } from '@/lib/blogs'
import { useAuth } from '@/context/AuthContext'

const formatDateTime = (value?: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeStyle: 'short' }).format(date)
}

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>()
  const { t } = useTranslation('common')
  const { profile } = useAuth()
  const [post, setPost] = React.useState<BlogPost | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

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
  const isAdmin = Boolean(profile?.is_admin)
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
    return DOMPurify.sanitize(post.bodyHtml, { ADD_ATTR: ['style'], ADD_TAGS: ['style'] })
  }, [post?.bodyHtml])

  const seoTitle = post
    ? t('seo.blog.postTitle', { title: post.title, defaultValue: `${post.title} · Aphylia Blog` })
    : t('seo.blog.listTitle', { defaultValue: 'Aphylia Blog' })
  const seoDescription = post?.excerpt
    || t('seo.blog.postDescription', {
      title: post?.title ?? '',
      author: authorLabel,
      date: publishedLabel,
      defaultValue: 'Stories from Aphylia.',
    })
  usePageMetadata({ title: seoTitle, description: seoDescription })

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
              </div>
            </div>

            {post.coverImageUrl ? (
              <div className="rounded-[28px] overflow-hidden border border-stone-200 dark:border-[#3e3e42]">
                <img
                  src={post.coverImageUrl}
                  alt={post.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            ) : null}

            {(isDraft || isScheduled) && (
              <div className="rounded-2xl border border-dashed border-stone-300 dark:border-[#3e3e42] bg-stone-50/60 dark:bg-[#1b1b1b] p-4 text-sm text-stone-600 dark:text-stone-300">
                {isDraft
                  ? t('blogPage.detail.statusDraftNotice', { defaultValue: 'This story is still a draft. Only admins can see this preview.' })
                  : t('blogPage.detail.statusScheduledNotice', { defaultValue: 'This story is scheduled. Readers will see it once the publish date is reached.' })}
              </div>
            )}

            <div
              className="space-y-4 leading-relaxed text-stone-700 dark:text-stone-200"
              dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
            />
          </article>
        </>
      )}
    </div>
  )
}
