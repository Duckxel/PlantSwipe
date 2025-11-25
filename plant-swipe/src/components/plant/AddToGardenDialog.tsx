import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Loader2, Flower2, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getUserGardens, addPlantToGarden } from '@/lib/gardens'
import { supabase } from '@/lib/supabaseClient'
import type { Garden } from '@/types/garden'
import { useLanguageNavigate } from '@/lib/i18nRouting'

interface AddToGardenDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  plantId: string
  plantName: string
  userId: string
  onAdded?: (gardenId: string) => void
}

export const AddToGardenDialog: React.FC<AddToGardenDialogProps> = ({
  open,
  onOpenChange,
  plantId,
  plantName,
  userId,
  onAdded,
}) => {
  const { t } = useTranslation('common')
  const navigate = useLanguageNavigate()
  const [gardens, setGardens] = React.useState<Garden[]>([])
  const [loading, setLoading] = React.useState(true)
  const [selectedGarden, setSelectedGarden] = React.useState<Garden | null>(null)
  const [step, setStep] = React.useState<'select' | 'details'>('select')
  const [nickname, setNickname] = React.useState('')
  const [count, setCount] = React.useState(1)
  const [adding, setAdding] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const countInputRef = React.useRef<HTMLInputElement>(null)

  const fetchGardens = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getUserGardens(userId)
      setGardens(data)
    } catch (e) {
      console.error(e)
      setError(t('common.error', { defaultValue: 'Failed to load gardens' }))
    } finally {
      setLoading(false)
    }
  }, [userId, t])

  React.useEffect(() => {
    if (open) {
      fetchGardens()
      // Reset state when dialog opens
      setSelectedGarden(null)
      setStep('select')
      setNickname('')
      setCount(1)
      setError(null)
    }
  }, [open, fetchGardens])

  React.useEffect(() => {
    // Focus count input when entering details step
    if (step === 'details' && countInputRef.current) {
      countInputRef.current.focus()
    }
  }, [step])

  const handleSelectGarden = (garden: Garden) => {
    setSelectedGarden(garden)
    setStep('details')
  }

  const handleBack = () => {
    setStep('select')
    setSelectedGarden(null)
    setNickname('')
    setCount(1)
    setError(null)
  }

  const handleAdd = async () => {
    if (!selectedGarden || adding) return
    setAdding(true)
    setError(null)

    try {
      // Treat unchanged name (same as species name) as no custom nickname
      const trimmedName = nickname.trim()
      const nicknameVal =
        trimmedName.length > 0 && trimmedName !== plantName.trim()
          ? trimmedName
          : null

      const qty = Math.max(0, Number(count || 0))

      // Create a new instance
      const gp = await addPlantToGarden({
        gardenId: selectedGarden.id,
        plantId: plantId,
        seedsPlanted: 0,
        nickname: nicknameVal || undefined,
      })

      // Update plant count if specified
      if (qty > 0) {
        await supabase
          .from('garden_plants')
          .update({ plants_on_hand: qty })
          .eq('id', gp.id)
      }

      // Close dialog and notify parent
      onOpenChange(false)
      onAdded?.(selectedGarden.id)
    } catch (e: unknown) {
      console.error(e)
      const errMessage = e instanceof Error ? e.message : String(e)
      setError(errMessage || t('common.error', { defaultValue: 'Failed to add plant' }))
    } finally {
      setAdding(false)
    }
  }

  const handleCreateGarden = () => {
    // Navigate to gardens page to create a new garden
    onOpenChange(false)
    navigate('/gardens')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-[425px]" aria-describedby="add-to-garden-description">
        <DialogHeader>
          <DialogTitle>
            {step === 'select'
              ? t('garden.addToGarden', { defaultValue: 'Add to Garden' })
              : t('gardenDashboard.plantsSection.addDetails', { defaultValue: 'Plant Details' })}
          </DialogTitle>
          <DialogDescription id="add-to-garden-description" className="sr-only">
            {step === 'select'
              ? t('garden.selectGardenDescription', { defaultValue: 'Select a garden to add this plant to' })
              : t('garden.addDetailsDescription', { defaultValue: 'Specify plant details' })}
          </DialogDescription>
        </DialogHeader>

        {step === 'select' ? (
          <div className="py-4 space-y-2 max-h-[60vh] overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin h-6 w-6 text-stone-400" />
              </div>
            ) : error ? (
              <div className="text-center py-8 text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            ) : (
              <>
                <button
                  onClick={handleCreateGarden}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-stone-100 dark:hover:bg-[#2d2d30] transition-colors text-left"
                >
                  <div className="h-12 w-12 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <Plus className="h-6 w-6" />
                  </div>
                  <span className="font-medium">
                    {t('garden.createNew', { defaultValue: 'New Garden' })}
                  </span>
                </button>

                {gardens.length === 0 ? (
                  <div className="text-center py-6 text-stone-500 dark:text-stone-400 text-sm">
                    {t('garden.noGardens', { defaultValue: "You don't have any gardens yet. Create one to get started!" })}
                  </div>
                ) : (
                  gardens.map((garden) => (
                    <button
                      key={garden.id}
                      onClick={() => handleSelectGarden(garden)}
                      className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-stone-100 dark:hover:bg-[#2d2d30] transition-colors text-left group"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="h-12 w-12 rounded-lg bg-stone-200 dark:bg-[#3e3e42] overflow-hidden flex-shrink-0">
                          {garden.coverImageUrl ? (
                            <img
                              src={garden.coverImageUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-stone-400">
                              <Flower2 className="h-5 w-5" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium truncate">{garden.name}</div>
                          {garden.streak !== undefined && garden.streak > 0 && (
                            <div className="text-xs text-stone-500 flex items-center gap-1">
                              🔥 {garden.streak} {t('garden.dayStreak', { defaultValue: 'day streak' })}
                            </div>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-stone-400 group-hover:text-stone-600 dark:group-hover:text-stone-300 transition-colors" />
                    </button>
                  ))
                )}
              </>
            )}
          </div>
        ) : (
          <div className="py-4 space-y-4">
            {selectedGarden && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                <div className="h-10 w-10 rounded-lg bg-stone-200 dark:bg-[#3e3e42] overflow-hidden flex-shrink-0">
                  {selectedGarden.coverImageUrl ? (
                    <img
                      src={selectedGarden.coverImageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-stone-400">
                      <Flower2 className="h-4 w-4" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{selectedGarden.name}</div>
                  <div className="text-xs text-emerald-600 dark:text-emerald-400">
                    {t('garden.addingPlant', { plant: plantName, defaultValue: `Adding ${plantName}` })}
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium">
                {t('gardenDashboard.plantsSection.customName', { defaultValue: 'Custom Name' })}
              </label>
              <Input
                value={nickname}
                maxLength={30}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNickname(e.target.value)}
                placeholder={t('gardenDashboard.plantsSection.optionalNickname', { defaultValue: 'Optional nickname' })}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium">
                {t('gardenDashboard.plantsSection.numberOfFlowers', { defaultValue: 'Number of Plants' })}
              </label>
              <Input
                ref={countInputRef}
                type="number"
                min={0}
                value={String(count)}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCount(Number(e.target.value))}
                className="mt-1"
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
            )}

            <div className="flex justify-between gap-2 pt-2">
              <Button
                variant="secondary"
                className="rounded-2xl"
                onClick={handleBack}
              >
                {t('gardenDashboard.plantsSection.back', { defaultValue: 'Back' })}
              </Button>
              <Button
                className="rounded-2xl"
                onClick={handleAdd}
                disabled={adding}
              >
                {adding ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('gardenDashboard.plantsSection.adding', { defaultValue: 'Adding...' })}
                  </>
                ) : (
                  t('gardenDashboard.plantsSection.add', { defaultValue: 'Add' })
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
