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
  Loader2,
  Image as ImageIcon,
  Download
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { 
  extractInternalLinks, 
  fetchInternalLinkPreview,
  isImageUrl,
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
    case 'media':
      return <ImageIcon className="h-4 w-4" />
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
    case 'media':
      return t('messages.linkPreview.media', { defaultValue: 'Media' })
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
    case 'media':
      return 'from-cyan-400 to-cyan-600'
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
  const [imageLoaded, setImageLoaded] = React.useState(false)
  
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
  
  // Handle navigation/action
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
      case 'media':
        // Open media in new tab
        window.open(link.url, '_blank', 'noopener,noreferrer')
        break
    }
  }
  
  // Handle download for media
  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation()
    const a = document.createElement('a')
    a.href = link.url
    a.download = ''
    a.target = '_blank'
    a.click()
  }
  
  // Don't show anything if there was an error loading
  if (error) {
    return null
  }
  
  const resourceLabel = getResourceLabel(link.type, t)
  const icon = getResourceIcon(link.type)
  const gradient = getResourceGradient(link.type)
  
  // Check if this is a media image that should be shown large
  const isMediaImage = link.type === 'media' && isImageUrl(link.url)
  
  // For media images, show a larger preview
  if (isMediaImage) {
    return (
      <div className="mt-2 rounded-xl overflow-hidden">
        {/* Large image preview */}
        <div 
          className={cn(
            'relative cursor-pointer',
            isOwn ? 'bg-blue-500/20' : 'bg-stone-100 dark:bg-[#2a2a2d]'
          )}
          onClick={handleClick}
        >
          {!imageLoaded && (
            <div className="w-full h-[200px] flex items-center justify-center animate-pulse">
              <Loader2 className={cn(
                "h-8 w-8 animate-spin",
                isOwn ? "text-blue-200" : "text-stone-400"
              )} />
            </div>
          )}
          <img
            src={link.url}
            alt=""
            className={cn(
              "max-w-full max-h-[300px] object-contain mx-auto",
              !imageLoaded && "hidden"
            )}
            onLoad={() => setImageLoaded(true)}
            loading="lazy"
          />
          
          {/* Overlay with actions on hover */}
          {imageLoaded && (
            <div className={cn(
              "absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors",
              "flex items-center justify-center gap-3 opacity-0 hover:opacity-100"
            )}>
              <button
                onClick={handleDownload}
                className="p-2 rounded-full bg-white/90 hover:bg-white text-stone-700 shadow-lg transition-transform hover:scale-110"
                title={t('messages.download', { defaultValue: 'Download' })}
              >
                <Download className="h-5 w-5" />
              </button>
              <button
                onClick={handleClick}
                className="p-2 rounded-full bg-white/90 hover:bg-white text-stone-700 shadow-lg transition-transform hover:scale-110"
                title={t('messages.openInNewTab', { defaultValue: 'Open in new tab' })}
              >
                <ExternalLink className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
        
        {/* Caption bar below image */}
        <div className={cn(
          'flex items-center gap-2 px-3 py-2',
          isOwn 
            ? 'bg-blue-400/20 border-t border-blue-400/20' 
            : 'bg-stone-50 dark:bg-[#1a1a1c] border-t border-stone-200/50 dark:border-[#3a3a3d]/50'
        )}>
          <div className={cn(
            'p-1.5 rounded-lg',
            isOwn ? 'bg-blue-300/30' : 'bg-cyan-100 dark:bg-cyan-900/30'
          )}>
            <ImageIcon className={cn(
              'h-4 w-4',
              isOwn ? 'text-blue-100' : 'text-cyan-600 dark:text-cyan-400'
            )} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn(
              'text-sm font-medium truncate',
              isOwn ? 'text-white' : 'text-stone-900 dark:text-white'
            )}>
              {preview?.title || 'Image'}
            </p>
            <p className={cn(
              'text-xs truncate',
              isOwn ? 'text-blue-100/70' : 'text-stone-500 dark:text-stone-400'
            )}>
              media.aphylia.app
            </p>
          </div>
        </div>
      </div>
    )
  }
  
  // Standard preview card for other types
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
            preview?.title || resourceLabel
          )}
        </p>
        
        {/* Subtitle (stats like plant count, friend count) */}
        {!loading && preview?.subtitle && (
          <p className={cn(
            'text-xs mt-0.5',
            isOwn ? 'text-blue-100/90' : 'text-stone-600 dark:text-stone-300'
          )}>
            {preview.subtitle}
          </p>
        )}
        
        {/* Description (bio, meaning, etc) - only show if no subtitle or truncate */}
        {!loading && preview?.description && !preview?.subtitle && (
          <p className={cn(
            'text-xs truncate mt-0.5',
            isOwn ? 'text-blue-100/70' : 'text-stone-500 dark:text-stone-400'
          )}>
            {preview.description}
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
