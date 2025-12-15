import React from 'react'
import { Lock, Globe, Trash2, Edit2, Leaf } from 'lucide-react'
import type { Bookmark } from '@/types/bookmark'
import { useTranslation } from 'react-i18next'
import { Link } from '@/components/i18n/Link'

interface BookmarkCardProps {
  bookmark: Bookmark
  isOwner: boolean
  onEdit?: (bookmark: Bookmark) => void
  onDelete?: (bookmark: Bookmark) => void
}

export const BookmarkCard: React.FC<BookmarkCardProps> = ({ bookmark, isOwner, onEdit, onDelete }) => {
  const { t } = useTranslation('common')
  const [isHovered, setIsHovered] = React.useState(false)
  
  // Get up to 3 images for the stacked effect
  const images = bookmark.preview_images || []
  const displayImages = images.filter((img): img is string => !!img && typeof img === 'string').slice(0, 3)
  const hasItems = (bookmark.plant_count || 0) > 0

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (window.confirm(t('bookmarks.deleteConfirm', { defaultValue: 'Delete this bookmark folder?' }))) {
      onDelete?.(bookmark)
    }
  }

  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onEdit?.(bookmark)
  }

  // Stacked positions (at rest) and spread positions (on hover)
  const getCardTransform = (index: number, total: number, hovered: boolean) => {
    if (total === 1) {
      return {
        transform: hovered ? 'rotate(0deg) scale(1.02)' : 'rotate(0deg)',
        zIndex: 3,
      }
    }
    
    if (total === 2) {
      const stackedPositions = [
        { rotate: 0, x: 0, y: 0 },
        { rotate: -6, x: 4, y: 2 },
      ]
      const spreadPositions = [
        { rotate: 8, x: 15, y: -5 },
        { rotate: -8, x: -15, y: 5 },
      ]
      const pos = hovered ? spreadPositions[index] : stackedPositions[index]
      return {
        transform: `rotate(${pos.rotate}deg) translateX(${pos.x}%) translateY(${pos.y}%)`,
        zIndex: 3 - index,
      }
    }
    
    // 3 images
    const stackedPositions = [
      { rotate: 0, x: 0, y: 0 },
      { rotate: -4, x: 3, y: 1 },
      { rotate: -8, x: 6, y: 2 },
    ]
    const spreadPositions = [
      { rotate: 0, x: 0, y: -12 },
      { rotate: -12, x: -20, y: 8 },
      { rotate: 12, x: 20, y: 8 },
    ]
    
    const pos = hovered ? spreadPositions[index] : stackedPositions[index]
    return {
      transform: `rotate(${pos.rotate}deg) translateX(${pos.x}%) translateY(${pos.y}%)`,
      zIndex: 3 - index,
    }
  }

  return (
    <Link 
      to={`/bookmarks/${bookmark.id}`} 
      className="block group relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative">
        {/* Stacked Photos Container */}
        <div className="relative aspect-square mb-3">
          {displayImages.length === 0 ? (
            // Empty state
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-stone-100 via-stone-50 to-white dark:from-stone-800 dark:via-stone-850 dark:to-stone-900 border border-stone-200/60 dark:border-stone-700/40 flex items-center justify-center transition-all duration-300 group-hover:border-stone-300 dark:group-hover:border-stone-600">
              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-stone-200/50 dark:bg-stone-700/50 flex items-center justify-center mx-auto mb-2 transition-colors group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/30">
                  <Leaf className="h-7 w-7 text-stone-300 dark:text-stone-600 transition-colors group-hover:text-emerald-500 dark:group-hover:text-emerald-400" />
                </div>
                <span className="text-xs text-stone-400 dark:text-stone-500">
                  {hasItems ? `${bookmark.plant_count} plants` : t('bookmarks.empty', { defaultValue: 'No plants' })}
                </span>
              </div>
            </div>
          ) : (
            // Stacked/Spread photos
            <div className="relative w-full h-full">
              {/* Render in reverse so first image is on top */}
              {[...displayImages].reverse().map((img, reversedIndex) => {
                const index = displayImages.length - 1 - reversedIndex
                const { transform, zIndex } = getCardTransform(index, displayImages.length, isHovered)
                
                return (
                  <div
                    key={index}
                    className="absolute inset-[8%] transition-all duration-500 ease-out"
                    style={{
                      transform,
                      zIndex,
                      transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
                    }}
                  >
                    {/* Photo card */}
                    <div className="relative w-full h-full rounded-xl overflow-hidden bg-white dark:bg-stone-800 shadow-lg ring-1 ring-black/10 dark:ring-white/10">
                      {/* White frame effect */}
                      <div className="absolute inset-0 p-1.5">
                        <div className="relative w-full h-full rounded-lg overflow-hidden bg-stone-100 dark:bg-stone-700">
                          <img 
                            src={img} 
                            alt="" 
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500"
                            style={{
                              transform: isHovered && index === 0 ? 'scale(1.05)' : 'scale(1)',
                            }}
                            loading="lazy"
                            draggable="false"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
              
              {/* Glow effect on hover */}
              <div 
                className="absolute inset-0 rounded-2xl transition-opacity duration-300 pointer-events-none"
                style={{
                  opacity: isHovered ? 1 : 0,
                  background: 'radial-gradient(circle at 50% 50%, rgba(16, 185, 129, 0.1) 0%, transparent 70%)',
                }}
              />
            </div>
          )}
          
          {/* Plant count badge */}
          {hasItems && displayImages.length > 0 && (
            <div 
              className="absolute bottom-1 right-1 px-2 py-0.5 rounded-full bg-white/95 dark:bg-black/80 backdrop-blur-sm text-stone-700 dark:text-stone-200 text-[11px] font-medium shadow-md ring-1 ring-black/5 dark:ring-white/10 transition-all duration-300"
              style={{ 
                zIndex: 10,
                opacity: isHovered ? 0 : 1,
                transform: isHovered ? 'translateY(4px)' : 'translateY(0)',
              }}
            >
              {bookmark.plant_count}
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="px-0.5">
          <h3 className="font-semibold text-stone-900 dark:text-stone-100 truncate text-sm leading-tight">
            {bookmark.name}
          </h3>
          <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-stone-500 dark:text-stone-400">
            {bookmark.visibility === 'private' ? (
              <Lock className="h-3 w-3" />
            ) : (
              <Globe className="h-3 w-3" />
            )}
            <span>{bookmark.visibility === 'private' ? t('bookmarks.private', { defaultValue: 'Private' }) : t('bookmarks.public', { defaultValue: 'Public' })}</span>
            <span className="text-stone-300 dark:text-stone-600">•</span>
            <span>{bookmark.plant_count || 0} {t('bookmarks.plants', { defaultValue: 'plants' })}</span>
          </div>
        </div>

        {/* Owner Actions */}
        {isOwner && (
          <div 
            className="absolute top-2 right-2 flex gap-1 transition-all duration-200"
            style={{ 
              zIndex: 20,
              opacity: isHovered ? 1 : 0,
              transform: isHovered ? 'translateY(0)' : 'translateY(-4px)',
            }}
          >
            <button 
              onClick={handleEdit}
              className="p-1.5 rounded-full bg-white/95 dark:bg-black/80 hover:bg-white dark:hover:bg-black text-stone-600 dark:text-stone-300 shadow-md backdrop-blur-sm transition-colors ring-1 ring-black/5 dark:ring-white/10"
            >
              <Edit2 className="h-3 w-3" />
            </button>
            <button 
              onClick={handleDelete}
              className="p-1.5 rounded-full bg-white/95 dark:bg-black/80 hover:bg-red-50 dark:hover:bg-red-900/50 text-red-500 dark:text-red-400 shadow-md backdrop-blur-sm transition-colors ring-1 ring-black/5 dark:ring-white/10"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </Link>
  )
}
