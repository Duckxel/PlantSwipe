import React from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, ChevronDown, ChevronUp, Bookmark as BookmarkIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BookmarkCard } from './BookmarkCard'
import { CreateBookmarkDialog } from './CreateBookmarkDialog'
import { getUserBookmarks, deleteBookmark } from '@/lib/bookmarks'
import type { Bookmark } from '@/types/bookmark'

interface BookmarksSectionProps {
  userId: string
  isOwner: boolean
  isFriend?: boolean // Whether the viewer is a friend of the profile owner
  userIsPrivate?: boolean // Whether the profile owner has a private profile
}

// Number of items per row on largest breakpoint (md:grid-cols-4)
const ITEMS_PER_ROW = 4

export const BookmarksSection: React.FC<BookmarksSectionProps> = ({ userId, isOwner, isFriend = false, userIsPrivate = false }) => {
  const { t } = useTranslation('common')
  const [bookmarks, setBookmarks] = React.useState<Bookmark[]>([])
  const [loading, setLoading] = React.useState(true)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [editBookmark, setEditBookmark] = React.useState<Bookmark | null>(null)
  const [expanded, setExpanded] = React.useState(false)

  const fetchBookmarks = React.useCallback(async () => {
    setLoading(true)
    try {
      const data = await getUserBookmarks(userId)
      // Filter based on viewer relationship:
      // - Owner sees all bookmarks
      // - Friends see public + private bookmarks
      // - Others see only public bookmarks
      const filteredData = isOwner 
        ? data 
        : isFriend 
          ? data // Friends can see all (including private)
          : data.filter(b => b.visibility === 'public')
      
      // Sort by most recently updated first
      const sortedData = filteredData.sort((a, b) => {
        const dateA = new Date(a.updated_at || a.created_at).getTime()
        const dateB = new Date(b.updated_at || b.created_at).getTime()
        return dateB - dateA
      })
      
      setBookmarks(sortedData)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [userId, isOwner, isFriend])

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

  const hasMoreThanOneRow = bookmarks.length > ITEMS_PER_ROW
  const displayedBookmarks = expanded ? bookmarks : bookmarks.slice(0, ITEMS_PER_ROW)
  const remainingCount = bookmarks.length - ITEMS_PER_ROW

  return (
    <div id="bookmarks" className="mt-8 space-y-4 scroll-mt-24">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <BookmarkIcon className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          {t('bookmarks.title', { defaultValue: 'Bookmarks' })}
        </h2>
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
           {[1, 2, 3, 4].map(i => (
             <div key={i} className="space-y-2">
               <div className="aspect-square rounded-2xl bg-gradient-to-br from-stone-100 to-stone-50 dark:from-stone-800 dark:to-stone-900 animate-pulse" />
               <div className="space-y-1.5 px-0.5">
                 <div className="h-3.5 w-20 rounded bg-stone-200 dark:bg-stone-700 animate-pulse" />
                 <div className="h-3 w-12 rounded bg-stone-100 dark:bg-stone-800 animate-pulse" />
               </div>
             </div>
           ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
            {displayedBookmarks.map(bookmark => (
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
                className="aspect-square rounded-2xl border-2 border-dashed border-stone-200 dark:border-[#3e3e42] flex flex-col items-center justify-center text-stone-400 hover:text-emerald-600 hover:border-emerald-300 dark:hover:text-emerald-400 dark:hover:border-emerald-700 transition-all bg-gradient-to-br from-stone-50 to-white dark:from-stone-900 dark:to-stone-800 group"
              >
                <div className="w-12 h-12 rounded-xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center mb-2 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/30 transition-colors">
                  <Plus className="h-6 w-6" />
                </div>
                <span className="text-sm font-medium">{t('bookmarks.createFirst', { defaultValue: 'Create Collection' })}</span>
              </button>
            )}
          </div>
          
          {/* View all / Show less button */}
          {hasMoreThanOneRow && (
            <div className="flex justify-center pt-2">
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors rounded-xl hover:bg-amber-50 dark:hover:bg-amber-900/20"
              >
                {expanded ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    {t('bookmarks.showLess', { defaultValue: 'Show less' })}
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    {t('bookmarks.viewAll', { defaultValue: 'View all' })} ({remainingCount} {t('bookmarks.more', { defaultValue: 'more' })})
                  </>
                )}
              </button>
            </div>
          )}
        </>
      )}

      <CreateBookmarkDialog 
        open={createOpen} 
        onOpenChange={setCreateOpen} 
        userId={userId} 
        onSaved={fetchBookmarks}
        existingBookmark={editBookmark}
        userIsPrivate={userIsPrivate}
      />
    </div>
  )
}
