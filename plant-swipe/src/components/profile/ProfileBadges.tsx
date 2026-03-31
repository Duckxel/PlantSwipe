import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
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
}

export function ProfileBadges({ userId, className }: ProfileBadgesProps) {
  const { t, i18n } = useTranslation('common')
  const [badges, setBadges] = useState<EarnedBadge[]>([])
  const [loading, setLoading] = useState(true)
  const [hoveredBadge, setHoveredBadge] = useState<string | null>(null)

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
      let translationMap: Record<string, { name: string; description: string }> = {}

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

  return (
    <Card className={className}>
      <CardContent className="p-6 md:p-8 space-y-4">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          <h3 className="text-lg font-semibold">{t('profile.badges', 'Badges')}</h3>
          <span className="text-xs text-stone-500 dark:text-stone-400 ml-1">
            {badges.length}
          </span>
        </div>

        <div className="flex flex-wrap gap-4">
          {badges.map((earned) => (
            <div
              key={earned.id}
              className="relative group"
              onMouseEnter={() => setHoveredBadge(earned.id)}
              onMouseLeave={() => setHoveredBadge(null)}
              onTouchStart={() => setHoveredBadge(hoveredBadge === earned.id ? null : earned.id)}
            >
              {/* Badge icon */}
              <motion.div
                whileHover={{ scale: 1.08 }}
                className="flex items-center justify-center h-20 w-20 rounded-2xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-stone-50 dark:bg-[#1f1f1f] cursor-pointer transition-shadow hover:shadow-md"
              >
                {earned.badge.icon_url ? (
                  <img
                    src={earned.badge.icon_url}
                    alt={earned.displayName}
                    className="h-14 w-14 object-contain"
                    loading="lazy"
                  />
                ) : (
                  <Trophy className="h-10 w-10 text-amber-400 dark:text-amber-300" />
                )}
              </motion.div>

              {/* Tooltip */}
              <AnimatePresence>
                {hoveredBadge === earned.id && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-50 pointer-events-none w-max"
                  >
                    <div className="relative rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 px-3.5 py-2.5 shadow-lg min-w-[180px] max-w-[240px]">
                      <p className="text-xs font-semibold leading-tight">
                        {earned.displayName}
                      </p>
                      {earned.displayDescription && (
                        <p className="text-[11px] opacity-80 mt-1 leading-snug">
                          {earned.displayDescription}
                        </p>
                      )}
                      <p className="text-[10px] opacity-60 mt-1.5">
                        {formatDate(earned.earned_at)}
                      </p>

                      {/* Arrow */}
                      <div className="absolute left-1/2 -translate-x-1/2 top-full h-0 w-0 border-x-[6px] border-x-transparent border-t-[6px] border-t-stone-900 dark:border-t-stone-100" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
