import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { supabase } from '@/lib/supabaseClient'
import { useTranslation } from 'react-i18next'
import type { BadgeRow } from '@/types/badge'

type EarnedBadge = {
  id: string
  badge: BadgeRow
  earned_at: string
  /** Translated name (current language), falls back to badge.name */
  displayName: string
  /** Translated description, falls back to badge.description */
  displayDescription: string
}

type ProfileBadgesProps = {
  userId: string
  className?: string
  /** Cap the inline badge tiles; shows a "See all" control when exceeded. */
  limit?: number
  /** When true, renders without a Card wrapper so it can embed in another section. */
  embedded?: boolean
}

export function ProfileBadges({ userId, className, limit, embedded = false }: ProfileBadgesProps) {
  const { t, i18n } = useTranslation('common')
  const [badges, setBadges] = useState<EarnedBadge[]>([])
  const [loading, setLoading] = useState(true)
  const [hoveredBadge, setHoveredBadge] = useState<string | null>(null)
  const [allOpen, setAllOpen] = useState(false)

  const lang = i18n.language

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)

      // Fetch user badges with badge details
      const { data, error } = await supabase
        .from('user_badges')
        .select('id, earned_at, badge:badges(*)')
        .eq('user_id', userId)
        .order('earned_at', { ascending: false })

      if (error || !data || cancelled) {
        setLoading(false)
        return
      }

      // Fetch translations for all badges
      const badgeIds = data.map((row: any) => row.badge?.id).filter(Boolean)
      const translationMap: Record<string, { name: string; description: string }> = {}

      if (badgeIds.length > 0 && lang !== 'en') {
        const { data: translations } = await supabase
          .from('badge_translations')
          .select('badge_id, name, description')
          .in('badge_id', badgeIds)
          .eq('language', lang)

        if (translations) {
          for (const tr of translations) {
            translationMap[tr.badge_id] = { name: tr.name, description: tr.description }
          }
        }
      }

      if (cancelled) return

      const earned: EarnedBadge[] = data
        .filter((row: any) => row.badge)
        .map((row: any) => {
          const badge = row.badge as BadgeRow
          const tr = translationMap[badge.id]
          return {
            id: row.id,
            badge,
            earned_at: row.earned_at,
            displayName: tr?.name || badge.name,
            displayDescription: tr?.description || badge.description || '',
          }
        })

      setBadges(earned)
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [userId, lang])

  if (loading || badges.length === 0) return null

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString(lang, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  const shown = typeof limit === 'number' && limit > 0 ? badges.slice(0, limit) : badges
  const hasMore = shown.length < badges.length

  const renderTile = (earned: EarnedBadge, size: 'sm' | 'md' = 'md') => {
    const dim = size === 'sm' ? 'h-16 w-16' : 'h-20 w-20'
    const imgDim = size === 'sm' ? 'h-11 w-11' : 'h-14 w-14'
    const fallbackDim = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10'
    return (
      <div
        key={earned.id}
        className="relative group"
        onMouseEnter={() => setHoveredBadge(earned.id)}
        onMouseLeave={() => setHoveredBadge(null)}
        onTouchStart={() => setHoveredBadge(hoveredBadge === earned.id ? null : earned.id)}
      >
        <motion.button
          type="button"
          onFocus={() => setHoveredBadge(earned.id)}
          onBlur={() => setHoveredBadge(null)}
          aria-label={earned.displayName}
          aria-describedby={`badge-tooltip-${earned.id}`}
          whileHover={{ scale: 1.08 }}
          className={`flex items-center justify-center ${dim} rounded-2xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-stone-50 dark:bg-[#1f1f1f] cursor-pointer transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2`}
        >
          {earned.badge.icon_url ? (
            <img
              src={earned.badge.icon_url}
              alt={earned.displayName}
              className={`${imgDim} object-contain`}
              loading="lazy"
            />
          ) : (
            <Trophy className={`${fallbackDim} text-amber-400 dark:text-amber-300`} />
          )}
        </motion.button>

        <AnimatePresence>
          {hoveredBadge === earned.id && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-full left-0 mb-3 z-50 pointer-events-none w-max"
            >
              <div
                id={`badge-tooltip-${earned.id}`}
                role="tooltip"
                className="relative rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 px-3.5 py-2.5 shadow-lg min-w-[180px] max-w-[240px]"
              >
                <p className="text-xs font-semibold leading-tight">{earned.displayName}</p>
                {earned.displayDescription && (
                  <p className="text-[11px] opacity-80 mt-1 leading-snug">
                    {earned.displayDescription}
                  </p>
                )}
                <p className="text-[10px] opacity-60 mt-1.5">{formatDate(earned.earned_at)}</p>
                <div className="absolute left-[34px] top-full h-0 w-0 border-x-[6px] border-x-transparent border-t-[6px] border-t-stone-900 dark:border-t-stone-100" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  const header = (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Trophy className="h-5 w-5 text-amber-500" />
        <h3 className="text-lg font-semibold">{t('profile.badges', 'Badges')}</h3>
        <span className="text-xs text-stone-500 dark:text-stone-400 ml-1">
          {badges.length}
        </span>
      </div>
      {hasMore && (
        <button
          type="button"
          onClick={() => setAllOpen(true)}
          className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 underline underline-offset-2"
        >
          {t('profile.badges.seeAll', { defaultValue: 'See all' })}
        </button>
      )}
    </div>
  )

  const tiles = <div className="flex flex-wrap gap-4">{shown.map((b) => renderTile(b))}</div>

  const dialog = (
    <Dialog open={allOpen} onOpenChange={setAllOpen}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            <span>{t('profile.badges', 'Badges')}</span>
            <span className="text-xs text-stone-500 dark:text-stone-400 ml-1 font-normal">
              {badges.length}
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap gap-3 pt-2">
          {badges.map((b) => renderTile(b, 'sm'))}
        </div>
      </DialogContent>
    </Dialog>
  )

  if (embedded) {
    return (
      <div className={className}>
        {header}
        <div className="mt-3">{tiles}</div>
        {dialog}
      </div>
    )
  }

  return (
    <>
      <Card className={className}>
        <CardContent className="p-6 md:p-8 space-y-4">
          {header}
          {tiles}
        </CardContent>
      </Card>
      {dialog}
    </>
  )
}
