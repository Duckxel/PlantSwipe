import React from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
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
  
  // Collage of up to 4 images
  const images = bookmark.preview_images || []
  const displayImages = images.slice(0, 4)

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
      <Card className="overflow-hidden transition-all hover:shadow-md border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e1e]">
        <div className="aspect-square relative bg-stone-100 dark:bg-[#2d2d30]">
           {displayImages.length === 0 ? (
             <div className="absolute inset-0 flex items-center justify-center text-stone-400 text-xs">
               {t('bookmarks.empty', { defaultValue: 'No plants' })}
             </div>
           ) : (
             <div className="grid grid-cols-2 grid-rows-2 h-full w-full gap-[1px]">
               {displayImages.map((img, idx) => (
                 <img 
                    key={idx} 
                    src={img} 
                    alt="" 
                    className={`object-cover w-full h-full ${displayImages.length === 1 ? 'col-span-2 row-span-2' : ''} ${displayImages.length === 2 && idx === 0 ? 'col-span-2' : ''} ${displayImages.length === 3 && idx === 0 ? 'col-span-2' : ''}`} 
                 />
               ))}
             </div>
           )}
           
           {/* Overlay Gradient */}
           <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60" />

           <div className="absolute bottom-3 left-3 right-3 text-white">
             <div className="font-semibold text-lg truncate">{bookmark.name}</div>
             <div className="flex items-center gap-2 text-xs opacity-90">
               <span>{bookmark.plant_count || 0} {t('bookmarks.plants', { defaultValue: 'plants' })}</span>
               {bookmark.visibility === 'private' ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
             </div>
           </div>
        </div>

        {isOwner && (
          <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
  )
}
