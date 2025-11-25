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

// Simple seeded random for consistent but unique positions per bookmark
const seededRandom = (seed: string, index: number) => {
  let hash = 0
  const str = seed + index.toString()
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash % 100) / 100
}

export const BookmarkCard: React.FC<BookmarkCardProps> = ({ bookmark, isOwner, onEdit, onDelete }) => {
  const { t } = useTranslation('common')
  
  // Get up to 3 images for the scattered effect
  const images = bookmark.preview_images || []
  const displayImages = images.filter((img): img is string => !!img && typeof img === 'string').slice(0, 3)
  const hasItems = (bookmark.plant_count || 0) > 0

  // Generate unique positions for each image based on bookmark ID
  const getPhotoStyle = (index: number, total: number) => {
    const seed = bookmark.id
    
    // Random values seeded by bookmark ID
    const randRotate = seededRandom(seed, index * 10) * 30 - 15 // -15 to 15 degrees
    const randX = seededRandom(seed, index * 20) * 30 - 5 // -5 to 25 percent
    const randY = seededRandom(seed, index * 30) * 25 - 5 // -5 to 20 percent
    
    // Ensure photos are spread out a bit based on index
    const baseOffsets = [
      { x: 5, y: 5 },    // First photo - top left area
      { x: 35, y: 25 },  // Second photo - middle right area  
      { x: 15, y: 45 },  // Third photo - bottom left area
    ]
    
    const base = baseOffsets[index] || { x: 20, y: 20 }
    
    return {
      left: `${base.x + randX * 0.5}%`,
      top: `${base.y + randY * 0.5}%`,
      transform: `rotate(${randRotate}deg)`,
      zIndex: total - index, // First image on top
    }
  }

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
        {/* Scattered Photos Container */}
        <div className="relative aspect-square mb-3 rounded-2xl bg-gradient-to-br from-stone-100 via-stone-50 to-white dark:from-stone-800 dark:via-stone-850 dark:to-stone-900 border border-stone-200/60 dark:border-stone-700/40 overflow-hidden">
          {/* Subtle pattern overlay */}
          <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
            backgroundSize: '16px 16px'
          }} />
          
          {displayImages.length === 0 ? (
            // Empty state
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-stone-200/50 dark:bg-stone-700/50 flex items-center justify-center mx-auto mb-2">
                  <Leaf className="h-8 w-8 text-stone-300 dark:text-stone-600" />
                </div>
                <span className="text-xs text-stone-400 dark:text-stone-500">
                  {hasItems ? `${bookmark.plant_count} plants` : t('bookmarks.empty', { defaultValue: 'No plants' })}
                </span>
              </div>
            </div>
          ) : (
            // Scattered photos
            <>
              {displayImages.map((img, index) => {
                const style = getPhotoStyle(index, displayImages.length)
                return (
                  <div
                    key={index}
                    className="absolute w-[55%] aspect-[3/4] transition-all duration-300 group-hover:scale-105"
                    style={{
                      left: style.left,
                      top: style.top,
                      transform: style.transform,
                      zIndex: style.zIndex,
                    }}
                  >
                    {/* Photo frame */}
                    <div className="relative w-full h-full rounded-lg bg-white dark:bg-stone-800 p-1.5 shadow-lg ring-1 ring-black/5 dark:ring-white/10 transition-shadow duration-300 group-hover:shadow-xl">
                      {/* Image */}
                      <div className="relative w-full h-full rounded overflow-hidden bg-stone-100 dark:bg-stone-700">
                        <img 
                          src={img} 
                          alt="" 
                          className="absolute inset-0 w-full h-full object-cover"
                          loading="lazy"
                          draggable="false"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </>
          )}
          
          {/* Plant count badge */}
          {hasItems && displayImages.length > 0 && (
            <div 
              className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full bg-white/90 dark:bg-black/70 backdrop-blur-sm text-stone-700 dark:text-stone-200 text-[11px] font-medium shadow-sm ring-1 ring-black/5 dark:ring-white/10"
              style={{ zIndex: 10 }}
            >
              {bookmark.plant_count} {bookmark.plant_count === 1 ? 'plant' : 'plants'}
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="px-0.5">
          <h3 className="font-semibold text-stone-900 dark:text-stone-100 truncate text-sm leading-tight">
            {bookmark.name}
          </h3>
          <div className="flex items-center gap-1 mt-0.5 text-[11px] text-stone-500 dark:text-stone-400">
            {bookmark.visibility === 'private' ? (
              <Lock className="h-3 w-3" />
            ) : (
              <Globe className="h-3 w-3" />
            )}
            <span>{bookmark.visibility === 'private' ? t('bookmarks.private', { defaultValue: 'Private' }) : t('bookmarks.public', { defaultValue: 'Public' })}</span>
          </div>
        </div>

        {/* Owner Actions */}
        {isOwner && (
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200" style={{ zIndex: 20 }}>
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
