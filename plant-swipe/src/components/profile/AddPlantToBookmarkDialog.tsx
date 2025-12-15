import React, { useState, useEffect, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Plus, Loader2, Check } from 'lucide-react'
import { SearchInput } from '@/components/ui/search-input'
import { useTranslation } from 'react-i18next'
import type { Plant } from '@/types/plant'
import { loadPlantPreviews } from '@/lib/plantTranslationLoader'
import { useLanguage } from '@/lib/i18nRouting'
import { addPlantToBookmark } from '@/lib/bookmarks'

interface AddPlantToBookmarkDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookmarkId: string
  existingPlantIds: string[]
  onAdded: (plantId: string) => void
}

export const AddPlantToBookmarkDialog: React.FC<AddPlantToBookmarkDialogProps> = ({
  open,
  onOpenChange,
  bookmarkId,
  existingPlantIds,
  onAdded
}) => {
  const { t } = useTranslation('common')
  const currentLang = useLanguage()
  const [query, setQuery] = useState('')
  const [allPlants, setAllPlants] = useState<Plant[]>([])
  const [loading, setLoading] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      if (allPlants.length === 0) {
        setLoading(true)
        loadPlantPreviews(currentLang)
          .then(setAllPlants)
          .catch(console.error)
          .finally(() => setLoading(false))
      }
    } else {
      // Reset search when dialog closes
      setQuery('')
    }
  }, [open, currentLang, allPlants.length])

  const filtered = useMemo(() => {
    if (!query.trim()) {
      // If no search, return 10 random plants
      const shuffled = [...allPlants].sort(() => 0.5 - Math.random())
      return shuffled.slice(0, 10)
    }
    // If searching, filter and limit to 10
    const lower = query.toLowerCase().trim()
    return allPlants
      .filter(p => 
        p.name.toLowerCase().includes(lower) || 
        p.scientificName?.toLowerCase().includes(lower)
      )
      .slice(0, 10)
  }, [allPlants, query])

  const handleAdd = async (plant: Plant) => {
    setAddingId(plant.id)
    try {
      await addPlantToBookmark(bookmarkId, plant.id)
      onAdded(plant.id)
    } catch (e) {
      console.error(e)
    } finally {
      setAddingId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-[500px] h-[80vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-4 sm:p-6 pb-2">
          <DialogTitle>{t('bookmarks.addPlant', { defaultValue: 'Add Plant' })}</DialogTitle>
        </DialogHeader>
        
        <div className="px-4 sm:px-6 pb-2">
          <SearchInput 
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('plant.searchPlaceholder', { defaultValue: 'Search plants...' })}
            className="rounded-xl"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 pt-2 space-y-2">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin h-6 w-6 text-stone-400" /></div>
          ) : (
            filtered.map(p => {
              const isAdded = existingPlantIds.includes(p.id)
              return (
                <div key={p.id} className="flex items-center justify-between p-2 rounded-xl hover:bg-stone-50 dark:hover:bg-[#2d2d30] transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-stone-200 dark:bg-[#3e3e42] overflow-hidden flex-shrink-0">
                      {p.image ? <img src={p.image} alt="" className="h-full w-full object-cover" /> : null}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{p.name}</div>
                      <div className="text-xs text-stone-500 truncate">{p.scientificName}</div>
                    </div>
                  </div>
                  
                  {isAdded ? (
                    <Button size="sm" variant="ghost" disabled className="h-8 w-8 p-0 rounded-full text-emerald-600">
                      <Check className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button 
                      size="sm" 
                      variant="secondary" 
                      className="h-8 w-8 p-0 rounded-full"
                      onClick={() => handleAdd(p)}
                      disabled={addingId === p.id}
                    >
                      {addingId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    </Button>
                  )}
                </div>
              )
            })
          )}
          {!loading && filtered.length === 0 && (
            <div className="text-center py-8 text-sm text-stone-500">{t('plant.noResults')}</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
