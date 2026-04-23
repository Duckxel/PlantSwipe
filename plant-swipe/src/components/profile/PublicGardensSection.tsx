import React from 'react'
import { useTranslation } from 'react-i18next'
import { TreeDeciduous, ChevronDown, ChevronUp } from 'lucide-react'
import { PublicGardenCard } from './PublicGardenCard'
import { getUserPublicGardens, type PublicGardenWithPreview } from '@/lib/gardens'
import { isBlockedByUser } from '@/lib/moderation'

interface PublicGardensSectionProps {
  userId: string
  isOwner: boolean
}

export const PublicGardensSection: React.FC<PublicGardensSectionProps> = ({ userId, isOwner }) => {
  const { t } = useTranslation('common')
  const [gardens, setGardens] = React.useState<PublicGardenWithPreview[]>([])
  const [loading, setLoading] = React.useState(true)
  const [expanded, setExpanded] = React.useState(false)
  const [isBlocked, setIsBlocked] = React.useState(false)

  const fetchGardens = React.useCallback(async () => {
    setLoading(true)
    try {
      // Check if the profile owner has blocked the current viewer
      // If blocked, don't show any gardens
      if (!isOwner) {
        const blocked = await isBlockedByUser(userId)
        if (blocked) {
          setIsBlocked(true)
          setGardens([])
          setLoading(false)
          return
        }
      }
      
      const data = await getUserPublicGardens(userId)
      setGardens(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [userId, isOwner])

  React.useEffect(() => {
    fetchGardens()
  }, [fetchGardens])

  // Hide section if blocked or if empty and not owner
  if (!loading && (isBlocked || (gardens.length === 0 && !isOwner))) {
    return null
  }

  // Don't show section if no public gardens (even for owner viewing their own profile)
  if (!loading && gardens.length === 0) {
    return null
  }

  const hasMoreThanThree = gardens.length > 3
  const displayedGardens = expanded ? gardens : gardens.slice(0, 3)
  const remainingCount = gardens.length - 3

  // Determine grid classes for centering
  const getGridClasses = (count: number) => {
    if (count === 1) {
      return 'flex justify-center'
    }
    if (count === 2) {
      return 'grid grid-cols-2 gap-3 sm:gap-5'
    }
    // 3 or more — always 3 per row so the section stays compact on mobile
    return 'grid grid-cols-3 gap-3 sm:gap-5'
  }

  // Single garden gets a constrained width so it doesn't span the whole row
  const getItemClasses = (count: number) => {
    if (count === 1) {
      return 'w-full max-w-[280px]'
    }
    return ''
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
        <div className="grid grid-cols-3 gap-3 sm:gap-5">
          {[1, 2, 3].map(i => (
            <div key={i} className="space-y-2">
              <div className="aspect-[4/3] rounded-2xl bg-gradient-to-br from-stone-100 to-stone-50 dark:from-stone-800 dark:to-stone-900 animate-pulse">
                <div className="h-full w-full flex items-center justify-center">
                  <TreeDeciduous className="h-8 w-8 sm:h-10 sm:w-10 text-stone-300 dark:text-stone-600 animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className={getGridClasses(displayedGardens.length)}>
            {displayedGardens.map(garden => (
              <div key={garden.id} className={getItemClasses(displayedGardens.length)}>
                <PublicGardenCard garden={garden} />
              </div>
            ))}
          </div>
          
          {/* View all / Show less button */}
          {hasMoreThanThree && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                aria-expanded={expanded}
                aria-label={expanded ? t('gardens.showLess', { defaultValue: 'Show less' }) : t('gardens.viewAll', { defaultValue: 'View all' })}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                {expanded ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    {t('gardens.showLess', { defaultValue: 'Show less' })}
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    {t('gardens.viewAll', { defaultValue: 'View all' })} ({remainingCount} {t('gardens.more', { defaultValue: 'more' })})
                  </>
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
