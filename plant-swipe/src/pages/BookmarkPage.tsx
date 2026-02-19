import React from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/context/AuthContext'
import { getBookmarkDetails, deleteBookmark, removePlantFromBookmark } from '@/lib/bookmarks'
import type { Bookmark } from '@/types/bookmark'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, Share2, Lock, Globe, Plus, Trash2, Edit2, X, Sparkles, Heart, Leaf } from 'lucide-react'
import { CreateBookmarkDialog } from '@/components/profile/CreateBookmarkDialog'
import { AddPlantToBookmarkDialog } from '@/components/profile/AddPlantToBookmarkDialog'
import { rarityTone } from '@/constants/badges'
import { usePageMetadata } from '@/hooks/usePageMetadata'
import { Link } from '@/components/i18n/Link'
import { useLanguageNavigate, useLanguage } from '@/lib/i18nRouting'

export const BookmarkPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useLanguageNavigate()
  const { t } = useTranslation('common')
  const { user } = useAuth()
  const currentLang = useLanguage()
  
  const [bookmark, setBookmark] = React.useState<Bookmark | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  
  const [editOpen, setEditOpen] = React.useState(false)
  const [addPlantOpen, setAddPlantOpen] = React.useState(false)
  const [hoveredId, setHoveredId] = React.useState<string | null>(null)
  
  const isOwner = user?.id === bookmark?.user_id

  const fetchBookmark = React.useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const data = await getBookmarkDetails(id, currentLang)
      setBookmark(data)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : t('common.error')
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [id, t, currentLang])

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
      try { 
        await navigator.share({ title: bookmark?.name, url }) 
      } catch {
        // User cancelled sharing
      }
    } else {
      try { 
        await navigator.clipboard.writeText(url)
        alert('Link copied!') 
      } catch {
        // Clipboard access denied
      }
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        >
          <Leaf className="h-12 w-12 text-emerald-500" />
        </motion.div>
        <span className="text-stone-400 text-sm">{t('common.loading', { defaultValue: 'Loading...' })}</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
          <X className="h-8 w-8 text-red-600 dark:text-red-400" />
        </div>
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    )
  }

  if (!bookmark) {
    return (
      <div className="text-center py-20">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-stone-100 dark:bg-stone-800 mb-4">
          <Heart className="h-8 w-8 text-stone-400" />
        </div>
        <p className="text-stone-500">{t('bookmarks.notFound', { defaultValue: 'Bookmark not found' })}</p>
      </div>
    )
  }

  const plantCount = bookmark.plant_count || bookmark.items?.length || 0
  const previewImages = bookmark.items?.slice(0, 4).map(i => i.plant?.image).filter(Boolean) || []

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <motion.section 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative overflow-hidden mx-4 mt-4 rounded-[32px]"
      >
        {/* Background with gradient and blur */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-100/70 via-white to-stone-100/80 dark:from-emerald-950/20 dark:via-[#1e1e1e] dark:to-[#171717]" />
        
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-emerald-200/30 dark:bg-emerald-500/10 blur-3xl" />
        <div className="pointer-events-none absolute top-20 right-0 h-64 w-64 rounded-full bg-amber-200/20 dark:bg-amber-500/5 blur-3xl" />
        
        {/* Background Image Mosaic (if has images) */}
        {previewImages.length > 0 && (
          <div className="absolute inset-0 opacity-[0.07] dark:opacity-[0.04]">
            <div className="absolute inset-0 grid grid-cols-4 gap-1">
              {[...previewImages, ...previewImages, ...previewImages, ...previewImages].slice(0, 16).map((img, i) => (
                <div key={i} className="relative overflow-hidden">
                  <img src={img} alt="" className="absolute inset-0 w-full h-full object-cover" />
                </div>
              ))}
            </div>
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/50 to-white dark:via-[#1e1e1e]/50 dark:to-[#1e1e1e]" />
          </div>
        )}
        
        <div className="relative max-w-6xl mx-auto px-4 pt-8 pb-12">
          {/* Back Button */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate(-1)} 
              className="mb-6 -ml-2 text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 rounded-2xl"
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> {t('common.back', { defaultValue: 'Back' })}
            </Button>
          </motion.div>
          
          {/* Header Content */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-4"
            >
              {/* Title with Icon */}
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/25">
                  <Sparkles className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold text-stone-900 dark:text-white">
                    {bookmark.name}
                  </h1>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge 
                      variant="secondary" 
                      className="rounded-full px-3 py-0.5 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300"
                    >
                      {plantCount} {t('bookmarks.plants', { defaultValue: 'plants' })}
                    </Badge>
                    <Badge 
                      variant="outline" 
                      className={`rounded-full px-3 py-0.5 ${
                        bookmark.visibility === 'private' 
                          ? 'border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400' 
                          : 'border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400'
                      }`}
                    >
                      {bookmark.visibility === 'private' ? <Lock className="h-3 w-3 mr-1" /> : <Globe className="h-3 w-3 mr-1" />}
                      {bookmark.visibility === 'private' ? t('bookmarks.private', { defaultValue: 'Private' }) : t('bookmarks.public', { defaultValue: 'Public' })}
                    </Badge>
                  </div>
                </div>
              </div>
            </motion.div>
            
            {/* Actions */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-wrap items-center gap-2"
            >
              <Button 
                variant="outline" 
                onClick={handleShare} 
                className="rounded-2xl bg-white/80 dark:bg-stone-800/80 backdrop-blur border-stone-200 dark:border-stone-700 hover:bg-white dark:hover:bg-stone-800"
              >
                <Share2 className="h-4 w-4 mr-2" /> {t('common.share', { defaultValue: 'Share' })}
              </Button>
              {isOwner && (
                <>
                  <Button 
                    onClick={() => setAddPlantOpen(true)} 
                    className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/25"
                  >
                    <Plus className="h-4 w-4 mr-2" /> {t('bookmarks.addPlant', { defaultValue: 'Add Plant' })}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setEditOpen(true)} 
                    className="rounded-2xl bg-white/80 dark:bg-stone-800/80 backdrop-blur border-stone-200 dark:border-stone-700"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    onClick={handleDelete} 
                    className="rounded-2xl text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* Plant Grid */}
      <section className="max-w-6xl mx-auto px-4 py-8">
        <AnimatePresence mode="popLayout">
          {bookmark.items && bookmark.items.length > 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
            >
              {bookmark.items.map((item, index) => {
                const p = item.plant
                if (!p) return null
                const isHovered = hoveredId === item.id
                
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: index * 0.05, duration: 0.3 }}
                    layout
                    className="group relative"
                    onMouseEnter={() => setHoveredId(item.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    <Link 
                      to={`/plants/${p.id}`}
                      className="block aspect-square relative rounded-3xl overflow-hidden bg-stone-100 dark:bg-stone-800 shadow-sm hover:shadow-xl transition-all duration-300"
                    >
                      {/* Image */}
                      {p.image ? (
                        <img
                          src={p.image}
                          alt={p.name}
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                          loading="lazy"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-emerald-100 to-emerald-50 dark:from-emerald-900/30 dark:to-emerald-800/20">
                          <Leaf className="h-12 w-12 text-emerald-300 dark:text-emerald-700" />
                        </div>
                      )}
                      
                      {/* Gradient Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />
                      
                      {/* Rarity Badge */}
                      <div className="absolute top-3 left-3">
                        <Badge className={`${rarityTone[p.rarity ?? "Common"]} rounded-xl text-[10px] shadow-lg backdrop-blur-sm`}>
                          {p.rarity}
                        </Badge>
                      </div>
                      
                      {/* Remove Button (Owner only) */}
                      {isOwner && (
                        <motion.button
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: isHovered ? 1 : 0, scale: isHovered ? 1 : 0.8 }}
                          transition={{ duration: 0.2 }}
                          onClick={(e) => { 
                            e.preventDefault()
                            e.stopPropagation()
                            handleRemovePlant(p.id) 
                          }}
                          className="absolute top-3 right-3 p-2 rounded-full bg-black/50 hover:bg-red-600 text-white backdrop-blur-sm transition-colors shadow-lg"
                        >
                          <X className="h-4 w-4" />
                        </motion.button>
                      )}
                      
                      {/* Plant Info */}
                      <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                        <motion.div
                          initial={false}
                          animate={{ y: isHovered ? 0 : 8, opacity: 1 }}
                          transition={{ duration: 0.2 }}
                        >
                          <h3 className="font-semibold text-lg leading-tight truncate drop-shadow-sm">
                            {p.name}
                          </h3>
                          <p className="text-xs italic opacity-75 truncate mt-0.5">
                            {p.scientificName}
                          </p>
                        </motion.div>
                        
                        {/* Season Tags - Show on hover */}
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ 
                            opacity: isHovered ? 1 : 0, 
                            height: isHovered ? 'auto' : 0 
                          }}
                          transition={{ duration: 0.2 }}
                          className="flex flex-wrap gap-1 mt-2 overflow-hidden"
                        >
                          {(p.seasons || []).slice(0, 3).map((s: string) => (
                            <span 
                              key={s} 
                              className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-sm"
                            >
                              {s}
                            </span>
                          ))}
                        </motion.div>
                      </div>
                    </Link>
                  </motion.div>
                )
              })}
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-center py-20"
            >
              <div className="relative inline-block">
                {/* Decorative rings */}
                <div className="absolute inset-0 animate-ping opacity-20">
                  <div className="w-24 h-24 rounded-full border-2 border-emerald-400 dark:border-emerald-600" />
                </div>
                <div className="relative inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-emerald-100 to-stone-100 dark:from-emerald-900/30 dark:to-stone-800">
                  <Leaf className="h-10 w-10 text-emerald-500 dark:text-emerald-400" />
                </div>
              </div>
              <h3 className="mt-6 text-xl font-semibold text-stone-700 dark:text-stone-200">
                {t('bookmarks.emptyCollection', { defaultValue: 'Your collection is empty' })}
              </h3>
              <p className="mt-2 text-stone-500 dark:text-stone-400 max-w-sm mx-auto">
                {t('bookmarks.emptyCollectionHint', { defaultValue: 'Start adding plants to build your personal collection' })}
              </p>
              {isOwner && (
                <Button 
                  onClick={() => setAddPlantOpen(true)}
                  className="mt-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/25"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t('bookmarks.addFirstPlant', { defaultValue: 'Add your first plant' })}
                </Button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Dialogs */}
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
