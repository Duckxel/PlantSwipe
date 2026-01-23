/**
 * InternalLinkPreview Component
 * 
 * Displays a beautiful preview card for internal aphylia.app links
 * shared in messages. Supports plants, gardens, profiles, bookmarks, and blog posts.
 */

import React from 'react'
import { useTranslation } from 'react-i18next'
import { useLanguageNavigate } from '@/lib/i18nRouting'
import { 
  Leaf, 
  Home, 
  User, 
  Bookmark, 
  FileText,
  ExternalLink,
  Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { 
  extractInternalLinks, 
  fetchInternalLinkPreview,
  type InternalLink,
  type InternalLinkPreviewData
} from '@/lib/messaging'

interface InternalLinkPreviewProps {
  content: string
  isOwn: boolean
  className?: string
}

/**
 * Get the icon for a resource type
 */
function getResourceIcon(type: InternalLink['type']) {
  switch (type) {
    case 'plant':
      return <Leaf className="h-4 w-4" />
    case 'garden':
      return <Home className="h-4 w-4" />
    case 'profile':
      return <User className="h-4 w-4" />
    case 'bookmark':
      return <Bookmark className="h-4 w-4" />
    case 'blog':
      return <FileText className="h-4 w-4" />
    default:
      return <ExternalLink className="h-4 w-4" />
  }
}

/**
 * Get the label for a resource type
 */
function getResourceLabel(type: InternalLink['type'], t: (key: string, options?: Record<string, unknown>) => string): string {
  switch (type) {
    case 'plant':
      return t('messages.linkPreview.plant', { defaultValue: 'Plant' })
    case 'garden':
      return t('messages.linkPreview.garden', { defaultValue: 'Garden' })
    case 'profile':
      return t('messages.linkPreview.profile', { defaultValue: 'Profile' })
    case 'bookmark':
      return t('messages.linkPreview.bookmark', { defaultValue: 'Collection' })
    case 'blog':
      return t('messages.linkPreview.blog', { defaultValue: 'Article' })
    default:
      return t('messages.linkPreview.link', { defaultValue: 'Link' })
  }
}

/**
 * Get the gradient colors for a resource type (used when no image)
 */
function getResourceGradient(type: InternalLink['type']): string {
  switch (type) {
    case 'plant':
      return 'from-emerald-400 to-emerald-600'
    case 'garden':
      return 'from-amber-400 to-amber-600'
    case 'profile':
      return 'from-blue-400 to-blue-600'
    case 'bookmark':
      return 'from-purple-400 to-purple-600'
    case 'blog':
      return 'from-rose-400 to-rose-600'
    default:
      return 'from-stone-400 to-stone-600'
  }
}

/**
 * Single link preview card
 */
const LinkPreviewCard: React.FC<{
  link: InternalLink
  isOwn: boolean
}> = ({ link, isOwn }) => {
  const { t } = useTranslation('common')
  const navigate = useLanguageNavigate()
  const [preview, setPreview] = React.useState<InternalLinkPreviewData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState(false)
  
  // Fetch preview data
  React.useEffect(() => {
    let mounted = true
    
    const loadPreview = async () => {
      try {
        const data = await fetchInternalLinkPreview(link)
        if (mounted) {
          setPreview(data)
          setLoading(false)
        }
      } catch {
        if (mounted) {
          setError(true)
          setLoading(false)
        }
      }
    }
    
    loadPreview()
    
    return () => {
      mounted = false
    }
  }, [link])
  
  // Handle navigation
  const handleClick = () => {
    switch (link.type) {
      case 'plant':
        navigate(`/plants/${link.id}`)
        break
      case 'garden':
        navigate(`/garden/${link.id}`)
        break
      case 'profile':
        navigate(`/u/${encodeURIComponent(link.id)}`)
        break
      case 'bookmark':
        navigate(`/bookmarks/${link.id}`)
        break
      case 'blog':
        navigate(`/blog/${link.id}`)
        break
    }
  }
  
  // Don't show anything if there was an error loading
  if (error) {
    return null
  }
  
  const resourceLabel = getResourceLabel(link.type, t)
  const icon = getResourceIcon(link.type)
  const gradient = getResourceGradient(link.type)
  
  return (
    <button
      onClick={handleClick}
      className={cn(
        'mt-2 flex items-stretch overflow-hidden rounded-xl w-full text-left transition-all active:scale-[0.98]',
        'border',
        isOwn 
          ? 'border-blue-400/30 bg-blue-400/20 hover:bg-blue-400/30'
          : 'border-stone-200/50 dark:border-[#3a3a3d]/50 bg-white/50 dark:bg-[#1f1f1f]/50 hover:bg-white/80 dark:hover:bg-[#1f1f1f]/80'
      )}
    >
      {/* Image or Icon */}
      <div className={cn(
        'flex-shrink-0 w-16 sm:w-20 flex items-center justify-center',
        'bg-gradient-to-br',
        gradient
      )}>
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-white/80" />
        ) : preview?.imageUrl ? (
          <img
            src={preview.imageUrl}
            alt=""
            className="w-full h-full object-cover min-h-[64px]"
            loading="lazy"
          />
        ) : (
          <div className="text-white/90">
            {icon}
          </div>
        )}
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0 p-2.5 sm:p-3">
        {/* Type badge */}
        <div className={cn(
          'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide mb-1',
          isOwn 
            ? 'bg-blue-300/30 text-blue-100'
            : 'bg-stone-100 dark:bg-[#2a2a2d] text-stone-500 dark:text-stone-400'
        )}>
          {icon}
          <span>{resourceLabel}</span>
        </div>
        
        {/* Title */}
        <p className={cn(
          'font-medium text-sm truncate',
          isOwn ? 'text-white' : 'text-stone-900 dark:text-white'
        )}>
          {loading ? (
            <span className="animate-pulse bg-current/20 rounded inline-block w-24 h-4" />
          ) : (
            preview?.title || link.id
          )}
        </p>
        
        {/* Subtitle or description */}
        {!loading && (preview?.subtitle || preview?.description) && (
          <p className={cn(
            'text-xs truncate mt-0.5',
            isOwn ? 'text-blue-100/80' : 'text-stone-500 dark:text-stone-400'
          )}>
            {preview.subtitle || preview.description}
          </p>
        )}
      </div>
      
      {/* Arrow indicator */}
      <div className={cn(
        'flex-shrink-0 flex items-center px-2',
        isOwn ? 'text-blue-200/60' : 'text-stone-300 dark:text-stone-600'
      )}>
        <ExternalLink className="h-4 w-4" />
      </div>
    </button>
  )
}

/**
 * Main component that detects internal links in content and renders previews
 */
export const InternalLinkPreview: React.FC<InternalLinkPreviewProps> = ({
  content,
  isOwn,
  className
}) => {
  // Extract internal links from content
  const links = React.useMemo(() => {
    return extractInternalLinks(content)
  }, [content])
  
  // Don't render anything if no internal links found
  if (links.length === 0) {
    return null
  }
  
  // Show first link preview (limit to avoid clutter)
  // Multiple links can be shown if needed in the future
  const primaryLink = links[0]
  
  return (
    <div className={className}>
      <LinkPreviewCard link={primaryLink} isOwn={isOwn} />
      {links.length > 1 && (
        <p className={cn(
          'text-[10px] mt-1 px-1',
          isOwn ? 'text-blue-200/60' : 'text-stone-400 dark:text-stone-500'
        )}>
          +{links.length - 1} more link{links.length > 2 ? 's' : ''}
        </p>
      )}
    </div>
  )
}

export default InternalLinkPreview
