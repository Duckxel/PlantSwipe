import React from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { getBookmarkDetails, deleteBookmark, removePlantFromBookmark } from '@/lib/bookmarks'
import type { Bookmark } from '@/types/bookmark'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, Share2, Lock, Globe, Plus, Trash2, Edit2, Loader2, X } from 'lucide-react'
import { CreateBookmarkDialog } from '@/components/profile/CreateBookmarkDialog'
import { AddPlantToBookmarkDialog } from '@/components/profile/AddPlantToBookmarkDialog'
import { rarityTone } from '@/constants/badges'
import { usePageMetadata } from '@/hooks/usePageMetadata'

export const BookmarkPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation('common')
  const { user } = useAuth()
  
  const [bookmark, setBookmark] = React.useState<Bookmark | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  
  const [editOpen, setEditOpen] = React.useState(false)
  const [addPlantOpen, setAddPlantOpen] = React.useState(false)
  
  const isOwner = user?.id === bookmark?.user_id

  const fetchBookmark = React.useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const data = await getBookmarkDetails(id)
      setBookmark(data)
    } catch (e: any) {
      setError(e.message || t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [id, t])

  React.useEffect(() => {
    fetchBookmark()
  }, [fetchBookmark])

  usePageMetadata({ 
    title: bookmark ? `${bookmark.name} | Bookmarks` : 'Bookmark',
    description: `View plants in ${bookmark?.name}`
  })

  const handleDelete = async () => {
    if (!bookmark || !window.confirm(t('bookmarks.deleteConfirm', { defaultValue: 'Delete this folder?' }))) return
    try {
      await deleteBookmark(bookmark.id)
      navigate('/profile')
    } catch (e) {
      console.error(e)
    }
  }

  const handleRemovePlant = async (plantId: string) => {
    if (!bookmark || !window.confirm(t('bookmarks.removePlantConfirm', { defaultValue: 'Remove this plant?' }))) return
    try {
      await removePlantFromBookmark(bookmark.id, plantId)
      fetchBookmark()
    } catch (e) {
      console.error(e)
    }
  }

  const handleShare = async () => {
    const url = window.location.href
    if (navigator.share) {
      try { await navigator.share({ title: bookmark?.name, url }) } catch {}
    } else {
      try { await navigator.clipboard.writeText(url); alert('Link copied!') } catch {}
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin h-8 w-8 text-stone-400" /></div>
  if (error) return <div className="text-center py-20 text-red-600">{error}</div>
  if (!bookmark) return <div className="text-center py-20">{t('bookmarks.notFound', { defaultValue: 'Bookmark not found' })}</div>

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 md:py-10 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-2 text-stone-500">
            <ChevronLeft className="h-4 w-4 mr-1" /> {t('common.back', { defaultValue: 'Back' })}
          </Button>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            {bookmark.name}
            {bookmark.visibility === 'private' ? <Lock className="h-5 w-5 text-stone-400" /> : <Globe className="h-5 w-5 text-stone-400" />}
          </h1>
          <div className="text-sm text-stone-500">
            {bookmark.plant_count} {t('bookmarks.plants', { defaultValue: 'plants' })}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleShare} className="rounded-xl">
            <Share2 className="h-4 w-4 mr-2" /> {t('common.share', { defaultValue: 'Share' })}
          </Button>
          {isOwner && (
            <>
              <Button variant="outline" onClick={() => setEditOpen(true)} className="rounded-xl">
                <Edit2 className="h-4 w-4 mr-2" /> {t('common.edit')}
              </Button>
              <Button variant="ghost" onClick={handleDelete} className="rounded-xl text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20">
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Plant List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {isOwner && (
          <button 
            onClick={() => setAddPlantOpen(true)}
            className="min-h-[200px] rounded-[28px] border-2 border-dashed border-stone-200 dark:border-[#3e3e42] flex flex-col items-center justify-center text-stone-400 hover:text-stone-600 hover:border-stone-300 dark:hover:text-stone-300 dark:hover:border-[#555] transition-all hover:bg-stone-50 dark:hover:bg-[#2d2d30]"
          >
            <Plus className="h-10 w-10 mb-3" />
            <span className="font-medium">{t('bookmarks.addPlant', { defaultValue: 'Add Plant' })}</span>
          </button>
        )}

        {bookmark.items?.map((item) => {
          const p = item.plant
          if (!p) return null
          return (
            <Card
              key={item.id}
              className="group relative rounded-[28px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/80 dark:bg-[#1f1f1f]/80 backdrop-blur overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="grid grid-cols-[120px_1fr] h-full">
                <Link to={`/plants/${p.id}`} className="relative h-full bg-stone-100 dark:bg-[#2d2d30]">
                  {p.image && (
                    <img
                      src={p.image}
                      alt={p.name}
                      className="absolute inset-0 h-full w-full object-cover"
                      loading="lazy"
                    />
                  )}
                </Link>
                <div className="p-4 flex flex-col h-full">
                  <div className="flex justify-between items-start gap-2">
                    <Link to={`/plants/${p.id}`} className="min-w-0 flex-1">
                      <div className="font-semibold truncate">{p.name}</div>
                      <div className="text-xs italic opacity-60 truncate">{p.scientificName}</div>
                    </Link>
                    {isOwner && (
                      <button 
                        onClick={(e) => { e.preventDefault(); handleRemovePlant(p.id) }}
                        className="text-stone-400 hover:text-red-500 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  
                  <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
                    <Badge className={`${rarityTone[p.rarity ?? "Common"]} rounded-xl text-[10px]`}>{p.rarity}</Badge>
                    {(p.seasons || []).slice(0, 2).map((s: any) => (
                       <Badge key={s} variant="secondary" className="rounded-xl text-[10px]">{s}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {isOwner && user && (
        <>
          <CreateBookmarkDialog 
            open={editOpen} 
            onOpenChange={setEditOpen} 
            userId={user.id} 
            onSaved={fetchBookmark}
            existingBookmark={bookmark}
          />
          <AddPlantToBookmarkDialog
            open={addPlantOpen}
            onOpenChange={setAddPlantOpen}
            bookmarkId={bookmark.id}
            existingPlantIds={bookmark.items?.map(i => i.plant_id) || []}
            onAdded={fetchBookmark}
          />
        </>
      )}
    </div>
  )
}
