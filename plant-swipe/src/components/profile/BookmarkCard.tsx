import React from 'react'
import { Link } from 'react-router-dom'
import { Lock, Globe, Trash2, Edit2, Leaf } from 'lucide-react'
import type { Bookmark } from '@/types/bookmark'
import { useTranslation } from 'react-i18next'

interface BookmarkCardProps {
  bookmark: Bookmark
  isOwner: boolean
  onEdit?: (bookmark: Bookmark) => void
  onDelete?: (bookmark: Bookmark) => void
}

export const BookmarkCard: React.FC<BookmarkCardProps> = ({ bookmark, isOwner, onEdit, onDelete }) => {
  const { t } = useTranslation('common')
  
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

  return (
    <Link to={`/bookmarks/${bookmark.id}`} className="block group relative">
      <div className="relative">
        {/* Stacked Photos Container */}
        <div className="relative aspect-[4/5] mb-3">
          {displayImages.length === 0 ? (
            // Empty state - single card with icon
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-stone-100 to-stone-50 dark:from-stone-800 dark:to-stone-900 border border-stone-200/50 dark:border-stone-700/50 flex items-center justify-center shadow-sm">
              <div className="text-center">
                <Leaf className="h-10 w-10 text-stone-300 dark:text-stone-600 mx-auto mb-2" />
                <span className="text-xs text-stone-400 dark:text-stone-500">
                  {hasItems ? `${bookmark.plant_count} plants` : t('bookmarks.empty', { defaultValue: 'No plants' })}
                </span>
              </div>
            </div>
          ) : displayImages.length === 1 ? (
            // Single image - show as main card
            <div className="absolute inset-0 rounded-2xl overflow-hidden shadow-lg ring-1 ring-black/5 dark:ring-white/10 transition-transform duration-300 group-hover:scale-[1.02]">
              <img 
                src={displayImages[0]} 
                alt="" 
                className="absolute inset-0 w-full h-full object-cover"
                loading="lazy"
                draggable="false"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            </div>
          ) : displayImages.length === 2 ? (
            // Two images - stack with offset
            <>
              {/* Back card */}
              <div 
                className="absolute inset-0 rounded-2xl overflow-hidden shadow-md ring-1 ring-black/5 dark:ring-white/10 transition-all duration-300 origin-bottom-left group-hover:rotate-[-4deg] group-hover:translate-x-1"
                style={{ 
                  transform: 'rotate(-6deg) translateX(8px)',
                  zIndex: 1 
                }}
              >
                <img 
                  src={displayImages[1]} 
                  alt="" 
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
                  draggable="false"
                />
                <div className="absolute inset-0 bg-black/10" />
              </div>
              {/* Front card */}
              <div 
                className="absolute inset-0 rounded-2xl overflow-hidden shadow-xl ring-1 ring-black/5 dark:ring-white/10 transition-all duration-300 origin-bottom-right group-hover:rotate-[2deg] group-hover:-translate-x-1"
                style={{ zIndex: 2 }}
              >
                <img 
                  src={displayImages[0]} 
                  alt="" 
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
                  draggable="false"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
              </div>
            </>
          ) : (
            // Three images - full stack effect
            <>
              {/* Back card (3rd image) */}
              <div 
                className="absolute rounded-2xl overflow-hidden shadow ring-1 ring-black/5 dark:ring-white/10 transition-all duration-300 group-hover:rotate-[-8deg] group-hover:translate-x-2"
                style={{ 
                  inset: '8px',
                  transform: 'rotate(-8deg) translateX(12px) translateY(-4px)',
                  zIndex: 1 
                }}
              >
                <img 
                  src={displayImages[2]} 
                  alt="" 
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
                  draggable="false"
                />
                <div className="absolute inset-0 bg-black/20" />
              </div>
              {/* Middle card (2nd image) */}
              <div 
                className="absolute rounded-2xl overflow-hidden shadow-md ring-1 ring-black/5 dark:ring-white/10 transition-all duration-300 group-hover:rotate-[-2deg] group-hover:translate-x-0.5"
                style={{ 
                  inset: '4px',
                  transform: 'rotate(-3deg) translateX(6px) translateY(-2px)',
                  zIndex: 2 
                }}
              >
                <img 
                  src={displayImages[1]} 
                  alt="" 
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
                  draggable="false"
                />
                <div className="absolute inset-0 bg-black/10" />
              </div>
              {/* Front card (1st image) */}
              <div 
                className="absolute inset-0 rounded-2xl overflow-hidden shadow-xl ring-1 ring-black/5 dark:ring-white/10 transition-all duration-300 group-hover:rotate-[3deg] group-hover:-translate-y-1"
                style={{ zIndex: 3 }}
              >
                <img 
                  src={displayImages[0]} 
                  alt="" 
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                  draggable="false"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
              </div>
            </>
          )}
          
          {/* Plant count badge - floating */}
          {hasItems && displayImages.length > 0 && (
            <div 
              className="absolute bottom-2 right-2 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-sm text-white text-xs font-medium shadow-lg"
              style={{ zIndex: 10 }}
            >
              {bookmark.plant_count}
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="px-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-stone-900 dark:text-stone-100 truncate text-[15px] leading-tight">
                {bookmark.name}
              </h3>
              <div className="flex items-center gap-1.5 mt-1 text-xs text-stone-500 dark:text-stone-400">
                {bookmark.visibility === 'private' ? (
                  <>
                    <Lock className="h-3 w-3" />
                    <span>{t('bookmarks.private', { defaultValue: 'Private' })}</span>
                  </>
                ) : (
                  <>
                    <Globe className="h-3 w-3" />
                    <span>{t('bookmarks.public', { defaultValue: 'Public' })}</span>
                  </>
                )}
                <span className="text-stone-300 dark:text-stone-600">•</span>
                <span>{bookmark.plant_count || 0} {t('bookmarks.plants', { defaultValue: 'plants' })}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Owner Actions - Floating */}
        {isOwner && (
          <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-1 group-hover:translate-y-0" style={{ zIndex: 20 }}>
            <button 
              onClick={handleEdit}
              className="p-2 rounded-full bg-white/90 dark:bg-black/70 hover:bg-white dark:hover:bg-black text-stone-700 dark:text-stone-200 shadow-lg backdrop-blur-sm transition-colors"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
            <button 
              onClick={handleDelete}
              className="p-2 rounded-full bg-white/90 dark:bg-black/70 hover:bg-red-50 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 shadow-lg backdrop-blur-sm transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </Link>
  )
}
