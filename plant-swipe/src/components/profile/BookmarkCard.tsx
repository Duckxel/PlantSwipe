import React from 'react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Lock, Globe, Trash2, Edit2 } from 'lucide-react'
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
  
  // Stack of up to 3 images for Pinterest-style effect
  const images = bookmark.preview_images || []
  const displayImages = images.filter((img): img is string => !!img && typeof img === 'string').slice(0, 3)
  const hasItems = (bookmark.plant_count || 0) > 0
  const stackClass = `stack-${displayImages.length || 1}`

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
    <>
      <style>{`
        .bookmark-tile {
          width: 100%;
          font-family: system-ui, sans-serif;
        }

        .bookmark-stack {
          position: relative;
          width: 100%;
          aspect-ratio: 3 / 4;
          margin-bottom: 8px;
        }

        .bookmark-stack .stack-image {
          position: absolute;
          top: 0;
          bottom: 0;
          object-fit: cover;
          border-radius: 18px;
          box-shadow: 0 8px 16px rgba(0,0,0,0.18);
          transition: transform 150ms ease-out, box-shadow 150ms ease-out;
        }

        .bookmark-tile:hover .stack-image {
          transform: translateY(-2px);
          box-shadow: 0 10px 22px rgba(0,0,0,0.22);
        }

        .stack-1 .stack-image:nth-child(1) {
          left: 0;
          right: 0;
        }

        .stack-2 .stack-image:nth-child(1) {
          left: 0;
          right: 0;
          z-index: 3;
        }

        .stack-2 .stack-image:nth-child(2) {
          left: 10%;
          right: -6%;
          filter: brightness(0.92);
          z-index: 2;
        }

        .stack-3 .stack-image:nth-child(1) {
          left: 0;
          right: 0;
          z-index: 3;
        }

        .stack-3 .stack-image:nth-child(2) {
          left: 7%;
          right: -4%;
          z-index: 2;
          filter: brightness(0.9);
        }

        .stack-3 .stack-image:nth-child(3) {
          left: 14%;
          right: -8%;
          z-index: 1;
          filter: brightness(0.85);
        }

        .bookmark-title {
          font-size: 15px;
          font-weight: 600;
          margin-bottom: 2px;
        }

        .bookmark-sub {
          font-size: 12px;
          color: #6b6b6b;
        }

        .dark .bookmark-sub {
          color: #9ca3af;
        }

        .bookmark-tile:hover .bookmark-title {
          text-decoration: underline;
        }
      `}</style>
      <Link to={`/bookmarks/${bookmark.id}`} className="block group relative bookmark-tile">
        <Card className="overflow-visible transition-all hover:shadow-md border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e1e] p-0">
          {!hasItems ? (
            <div className="bookmark-stack bg-stone-100 dark:bg-[#2d2d30] rounded-2xl flex items-center justify-center text-stone-400 text-xs">
              {t('bookmarks.empty', { defaultValue: 'No plants' })}
            </div>
          ) : displayImages.length === 0 ? (
            <div className="bookmark-stack bg-stone-100 dark:bg-[#2d2d30] rounded-2xl flex items-center justify-center text-stone-400 text-xs">
              {bookmark.plant_count || 0} {t('bookmarks.plants', { defaultValue: 'plants' })}
            </div>
          ) : (
            <div className={`bookmark-stack ${stackClass}`}>
              {displayImages.map((img: string, idx: number) => (
                <img 
                  key={idx} 
                  src={img} 
                  alt="" 
                  className="stack-image"
                />
              ))}
            </div>
          )}

          <div className="bookmark-meta px-1">
            <div className="bookmark-title truncate text-stone-900 dark:text-stone-100">{bookmark.name}</div>
            <div className="bookmark-sub flex items-center gap-1">
              <span>{bookmark.plant_count || 0} {t('bookmarks.plants', { defaultValue: 'plants' })}</span>
              {bookmark.visibility === 'private' ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
            </div>
          </div>

          {isOwner && (
            <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
               <button 
                 onClick={handleEdit}
                 className="p-2 rounded-full bg-white/90 dark:bg-black/50 hover:bg-white dark:hover:bg-black text-stone-700 dark:text-stone-200 shadow-sm backdrop-blur-sm"
               >
                 <Edit2 className="h-3.5 w-3.5" />
               </button>
               <button 
                 onClick={handleDelete}
                 className="p-2 rounded-full bg-white/90 dark:bg-black/50 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 shadow-sm backdrop-blur-sm"
               >
                 <Trash2 className="h-3.5 w-3.5" />
               </button>
            </div>
          )}
        </Card>
      </Link>
    </>
  )
}
