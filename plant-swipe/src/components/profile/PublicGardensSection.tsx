import React from 'react'
import { useTranslation } from 'react-i18next'
import { TreeDeciduous } from 'lucide-react'
import { PublicGardenCard } from './PublicGardenCard'
import { getUserPublicGardens, type PublicGardenWithPreview } from '@/lib/gardens'

interface PublicGardensSectionProps {
  userId: string
  isOwner: boolean
}

export const PublicGardensSection: React.FC<PublicGardensSectionProps> = ({ userId, isOwner }) => {
  const { t } = useTranslation('common')
  const [gardens, setGardens] = React.useState<PublicGardenWithPreview[]>([])
  const [loading, setLoading] = React.useState(true)

  const fetchGardens = React.useCallback(async () => {
    setLoading(true)
    try {
      const data = await getUserPublicGardens(userId)
      setGardens(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [userId])

  React.useEffect(() => {
    fetchGardens()
  }, [fetchGardens])

  // Hide section if empty and not owner
  if (!loading && gardens.length === 0 && !isOwner) {
    return null
  }

  // Don't show section if no public gardens (even for owner viewing their own profile)
  if (!loading && gardens.length === 0) {
    return null
  }

  return (
    <div className="mt-8 space-y-4">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <TreeDeciduous className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          {t('gardens.publicGardensTitle', { defaultValue: 'Public Gardens' })}
        </h2>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          {[1, 2, 3].map(i => (
            <div key={i} className="space-y-2">
              <div className="aspect-[4/3] rounded-2xl bg-gradient-to-br from-stone-100 to-stone-50 dark:from-stone-800 dark:to-stone-900 animate-pulse">
                <div className="h-full w-full flex items-center justify-center">
                  <TreeDeciduous className="h-10 w-10 text-stone-300 dark:text-stone-600 animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          {gardens.map(garden => (
            <PublicGardenCard 
              key={garden.id} 
              garden={garden}
            />
          ))}
        </div>
      )}
    </div>
  )
}
