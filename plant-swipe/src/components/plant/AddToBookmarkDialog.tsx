import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, Lock, Globe } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getUserBookmarks, addPlantToBookmark } from '@/lib/bookmarks'
import type { Bookmark } from '@/types/bookmark'
import { CreateBookmarkDialog } from '@/components/profile/CreateBookmarkDialog'
import { Loader2 } from 'lucide-react'

interface AddToBookmarkDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  plantId: string
  userId: string
  onAdded?: () => void
}

export const AddToBookmarkDialog: React.FC<AddToBookmarkDialogProps> = ({ open, onOpenChange, plantId, userId, onAdded }) => {
  const { t } = useTranslation('common')
  const [bookmarks, setBookmarks] = React.useState<Bookmark[]>([])
  const [loading, setLoading] = React.useState(true)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [addingToId, setAddingToId] = React.useState<string | null>(null)

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
    if (open) {
      fetchBookmarks()
    }
  }, [open, fetchBookmarks])

  const handleAddToBookmark = async (bookmark: Bookmark) => {
    if (addingToId) return
    setAddingToId(bookmark.id)
    try {
      await addPlantToBookmark(bookmark.id, plantId)
      onAdded?.()
      onOpenChange(false)
    } catch (e: any) {
       if (e.message?.includes('unique constraint') || e.message?.includes('duplicate')) {
         // Already in bookmark, just refresh state and close
         onAdded?.()
         onOpenChange(false)
       } else {
         console.error(e)
         alert(t('common.error'))
       }
    } finally {
      setAddingToId(null)
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('bookmarks.saveTo', { defaultValue: 'Save to Collection' })}</DialogTitle>
        </DialogHeader>
        
        <div className="py-4 space-y-2 max-h-[60vh] overflow-y-auto">
          {loading ? (
             <div className="flex justify-center py-8"><Loader2 className="animate-spin h-6 w-6 text-stone-400" /></div>
          ) : (
            <>
              <button
                onClick={() => setCreateOpen(true)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-stone-100 dark:hover:bg-[#2d2d30] transition-colors text-left"
              >
                 <div className="h-12 w-12 rounded-lg bg-stone-200 dark:bg-[#3e3e42] flex items-center justify-center text-stone-500">
                   <Plus className="h-6 w-6" />
                 </div>
                 <span className="font-medium">{t('bookmarks.createNew', { defaultValue: 'New Collection' })}</span>
              </button>

              {bookmarks.map(b => {
                 const preview = b.preview_images?.[0]
                 const isAdding = addingToId === b.id
                 const hasPlant = b.items?.some(i => i.plant_id === plantId)
                 
                 return (
                  <button
                    key={b.id}
                    onClick={() => handleAddToBookmark(b)}
                    disabled={isAdding}
                    className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-stone-50 dark:hover:bg-[#2d2d30] transition-colors text-left group"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                       <div className="h-12 w-12 rounded-lg bg-stone-200 dark:bg-[#3e3e42] overflow-hidden flex-shrink-0">
                         {preview ? (
                           <img src={preview} alt="" className="h-full w-full object-cover" />
                         ) : (
                           <div className="h-full w-full flex items-center justify-center text-stone-400">
                             <Globe className="h-5 w-5" />
                           </div>
                         )}
                       </div>
                       <div className="min-w-0">
                         <div className="font-medium truncate">{b.name}</div>
                         <div className="text-xs text-stone-500 flex items-center gap-1">
                           {b.visibility === 'private' && <Lock className="h-3 w-3" />}
                           <span>{b.plant_count || 0} {t('bookmarks.plants', { defaultValue: 'plants' })}</span>
                         </div>
                       </div>
                    </div>
                    {isAdding ? (
                      <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
                    ) : hasPlant ? (
                       <div className="text-emerald-600 dark:text-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-full text-xs font-medium">
                         {t('bookmarks.saved', { defaultValue: 'Saved' })}
                       </div>
                    ) : null}
                  </button>
                 )
              })}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
    
    <CreateBookmarkDialog 
        open={createOpen} 
        onOpenChange={setCreateOpen} 
        userId={userId}
        onSaved={() => {
          fetchBookmarks()
          // After creating a new bookmark, the dialog will close and user can add plant to it
        }}
    />
    </>
  )
}
