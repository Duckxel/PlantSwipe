import React from 'react'
import { CalendarClock, Pencil, UserRound } from 'lucide-react'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Link } from '@/components/i18n/Link'
import { useTranslation } from 'react-i18next'
import type { BlogPost } from '@/types/blog'

type BlogCardProps = {
  post: BlogPost
  isAdmin?: boolean
  onEdit?: (post: BlogPost) => void
}

const formatDateTime = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export const BlogCard: React.FC<BlogCardProps> = ({ post, isAdmin, onEdit }) => {
  const { t } = useTranslation('common')
  const publishedLabel = formatDateTime(post.publishedAt)
  const authorLabel = post.authorName || t('blogPage.card.unknownAuthor', { defaultValue: 'Team Aphylia' })

  return (
    <Card className="rounded-3xl overflow-hidden border border-stone-200 dark:border-[#3e3e42] flex flex-col bg-white/80 dark:bg-[#1f1f1f] shadow-sm hover:shadow-lg transition-shadow">
      <div className="relative h-48 bg-stone-100 dark:bg-[#2b2b2b]">
        {post.coverImageUrl ? (
          <img
            src={post.coverImageUrl}
            alt={post.title}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-[11px] uppercase tracking-[0.3em] text-stone-500 dark:text-stone-400 px-6 text-center">
            {t('blogPage.card.imagePlaceholder', { defaultValue: 'Image placeholder' })}
          </div>
        )}
      </div>
      <CardHeader className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
          <CalendarClock className="h-4 w-4" aria-hidden="true" />
          <span>{publishedLabel}</span>
          {isAdmin && !post.isPublished ? (
            <Badge variant="secondary" className="ml-auto rounded-2xl uppercase tracking-wide text-[10px]">
              {t('blogPage.card.draftBadge', { defaultValue: 'Draft' })}
            </Badge>
          ) : null}
        </div>
        <h3 className="text-xl font-semibold">{post.title}</h3>
        <div className="flex items-center gap-2 text-sm text-stone-500 dark:text-stone-400">
          <UserRound className="h-4 w-4" aria-hidden="true" />
          <span>{authorLabel}</span>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4">
        <p className="text-sm text-stone-600 dark:text-stone-300 min-h-[3.5rem]">
          {post.excerpt || t('blogPage.card.excerptFallback', { defaultValue: 'Pull up the full article to explore every detail.' })}
        </p>
        <div className="flex items-center justify-between gap-3 pt-2">
          <Button asChild variant="secondary" className="rounded-2xl px-4">
            <Link to={`/blog/${post.slug}`}>
              {t('blogPage.card.readMore', { defaultValue: 'Read article' })}
            </Link>
          </Button>
          {isAdmin && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-2xl"
              onClick={() => onEdit?.(post)}
            >
              <Pencil className="h-4 w-4 mr-1" />
              {t('blogPage.card.edit', { defaultValue: 'Edit' })}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
