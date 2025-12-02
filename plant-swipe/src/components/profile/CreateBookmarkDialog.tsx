import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTranslation } from 'react-i18next'
import { createBookmark, updateBookmark } from '@/lib/bookmarks'
import type { Bookmark, BookmarkVisibility } from '@/types/bookmark'
import { Loader2 } from 'lucide-react'

interface CreateBookmarkDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  onSaved?: () => void
  existingBookmark?: Bookmark | null // If provided, we are editing
  userIsPrivate?: boolean // If true, only allow private visibility
}

export const CreateBookmarkDialog: React.FC<CreateBookmarkDialogProps> = ({ 
  open, 
  onOpenChange, 
  userId, 
  onSaved,
  existingBookmark,
  userIsPrivate = false
}) => {
  const { t } = useTranslation('common')
  const [name, setName] = React.useState('')
  // Private users can only create private bookmarks
  const defaultVisibility: BookmarkVisibility = userIsPrivate ? 'private' : 'public'
  const [visibility, setVisibility] = React.useState<BookmarkVisibility>(defaultVisibility)
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      if (existingBookmark) {
        setName(existingBookmark.name)
        // For private users, force visibility to private even for existing bookmarks
        setVisibility(userIsPrivate ? 'private' : existingBookmark.visibility)
      } else {
        setName('')
        setVisibility(userIsPrivate ? 'private' : 'public')
      }
    }
  }, [open, existingBookmark, userIsPrivate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setLoading(true)
    try {
      if (existingBookmark) {
        await updateBookmark(existingBookmark.id, { name, visibility })
      } else {
        await createBookmark(userId, name, visibility)
      }
      onSaved?.()
      onOpenChange(false)
    } catch (err) {
      console.error(err)
      alert(t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {existingBookmark ? t('bookmarks.editFolder', { defaultValue: 'Edit Folder' }) : t('bookmarks.newFolder', { defaultValue: 'New Bookmark Folder' })}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          <div className="space-y-2">
            <Label htmlFor="bookmark-name">{t('bookmarks.folderName', { defaultValue: 'Folder Name' })}</Label>
            <Input 
              id="bookmark-name" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder={t('bookmarks.namePlaceholder', { defaultValue: 'e.g. Wishlist' })}
              className="rounded-xl"
              required
            />
          </div>
          
          <div className="space-y-3">
            <Label>{t('bookmarks.visibility', { defaultValue: 'Visibility' })}</Label>
            {userIsPrivate ? (
              // Private users can only create private bookmarks
              <div className="flex items-center gap-2 p-3 rounded-xl bg-stone-100 dark:bg-stone-800 text-sm text-stone-600 dark:text-stone-400">
                <span>{t('bookmarks.privateOnlyNote', { defaultValue: 'As a private user, your bookmarks are only visible to friends.' })}</span>
              </div>
            ) : (
              <div className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <input 
                    type="radio" 
                    value="public" 
                    id="vis-public" 
                    checked={visibility === 'public'}
                    onChange={(e) => setVisibility(e.target.value as BookmarkVisibility)}
                    className="accent-black dark:accent-white"
                  />
                  <Label htmlFor="vis-public" className="cursor-pointer">{t('bookmarks.public', { defaultValue: 'Public' })}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input 
                    type="radio" 
                    value="private" 
                    id="vis-private" 
                    checked={visibility === 'private'}
                    onChange={(e) => setVisibility(e.target.value as BookmarkVisibility)}
                    className="accent-black dark:accent-white"
                  />
                  <Label htmlFor="vis-private" className="cursor-pointer">{t('bookmarks.private', { defaultValue: 'Private' })}</Label>
                </div>
              </div>
            )}
            {!userIsPrivate && (
              <p className="text-xs text-stone-500">
                {visibility === 'public' 
                  ? t('bookmarks.publicDesc', { defaultValue: 'Anyone can see this folder on your profile.' })
                  : t('bookmarks.privateDesc', { defaultValue: 'Only you can see this folder.' })
                }
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} className="rounded-xl">
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={loading} className="rounded-xl">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {existingBookmark ? t('common.save') : t('common.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
