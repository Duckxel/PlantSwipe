import React from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { BookmarkCard } from './BookmarkCard'
import { CreateBookmarkDialog } from './CreateBookmarkDialog'
import { getUserBookmarks, deleteBookmark } from '@/lib/bookmarks'
import type { Bookmark } from '@/types/bookmark'

interface BookmarksSectionProps {
  userId: string
  isOwner: boolean
}

export const BookmarksSection: React.FC<BookmarksSectionProps> = ({ userId, isOwner }) => {
  const { t } = useTranslation('common')
  const [bookmarks, setBookmarks] = React.useState<Bookmark[]>([])
  const [loading, setLoading] = React.useState(true)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [editBookmark, setEditBookmark] = React.useState<Bookmark | null>(null)

  const fetchBookmarks = React.useCallback(async () => {
    setLoading(true)
    try {
      const data = await getUserBookmarks(userId)
      setBookmarks(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [userId])

  React.useEffect(() => {
    fetchBookmarks()
  }, [fetchBookmarks])

  const handleDelete = async (bookmark: Bookmark) => {
    try {
      await deleteBookmark(bookmark.id)
      setBookmarks(prev => prev.filter(b => b.id !== bookmark.id))
    } catch (e) {
      console.error(e)
      alert(t('common.error'))
    }
  }

  if (!loading && bookmarks.length === 0 && !isOwner) {
    return null // Hide section if empty and not owner
  }

  return (
    <div className="mt-8 space-y-4">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-lg font-semibold">{t('bookmarks.title', { defaultValue: 'Bookmarks' })}</h2>
        {isOwner && (
          <Button 
            variant="outline" 
            size="sm" 
            className="rounded-xl gap-1"
            onClick={() => {
              setEditBookmark(null)
              setCreateOpen(true)
            }}
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">{t('bookmarks.newFolder', { defaultValue: 'New Folder' })}</span>
          </Button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
           {[1, 2, 3].map(i => (
             <div key={i} className="aspect-square rounded-2xl bg-stone-200 dark:bg-[#2d2d30] animate-pulse" />
           ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {bookmarks.map(bookmark => (
              <BookmarkCard 
                key={bookmark.id} 
                bookmark={bookmark} 
                isOwner={isOwner}
                onEdit={(b) => {
                  setEditBookmark(b)
                  setCreateOpen(true)
                }}
                onDelete={handleDelete}
              />
            ))}
            
            {/* Empty State for Owner */}
            {isOwner && bookmarks.length === 0 && (
              <button 
                onClick={() => setCreateOpen(true)}
                className="aspect-square rounded-2xl border-2 border-dashed border-stone-200 dark:border-[#3e3e42] flex flex-col items-center justify-center text-stone-400 hover:text-stone-600 hover:border-stone-300 dark:hover:text-stone-300 dark:hover:border-[#555] transition-colors bg-transparent"
              >
                <Plus className="h-8 w-8 mb-2" />
                <span className="text-sm font-medium">{t('bookmarks.createFirst', { defaultValue: 'Create Collection' })}</span>
              </button>
            )}
          </div>
        </>
      )}

      <CreateBookmarkDialog 
        open={createOpen} 
        onOpenChange={setCreateOpen} 
        userId={userId} 
        onSaved={fetchBookmarks}
        existingBookmark={editBookmark}
      />
    </div>
  )
}
