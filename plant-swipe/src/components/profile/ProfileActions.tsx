import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Link } from '@/components/i18n/Link'
import { Home, Sprout, UserPlus, UserPen, Bookmark, ChevronRight, Check, PartyPopper } from 'lucide-react'
import { PROFILE_ACTIONS, type ActionCheckData } from '@/lib/profileActions'
import { supabase } from '@/lib/supabaseClient'

const ACTION_ICONS: Record<string, React.ReactNode> = {
  garden: <Home className="h-4 w-4" />,
  plant: <Sprout className="h-4 w-4" />,
  friend: <UserPlus className="h-4 w-4" />,
  profile: <UserPen className="h-4 w-4" />,
  bookmark: <Bookmark className="h-4 w-4" />,
}

type Props = {
  userId: string
  gardensCount: number
  plantsTotal: number
  friendsCount: number
  hasBio: boolean
}

const CIRCLE_SIZE = 64
const STROKE_WIDTH = 5
const RADIUS = (CIRCLE_SIZE - STROKE_WIDTH) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function ProfileActions({ userId, gardensCount, plantsTotal, friendsCount, hasBio }: Props) {
  const { t } = useTranslation('common')
  const [bookmarkCount, setBookmarkCount] = React.useState<number | null>(null)
  const [dismissed, setDismissed] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false

    async function fetchBookmarkCount() {
      const { data, error } = await supabase
        .from('bookmarks')
        .select('id, items:bookmark_items(id)')
        .eq('user_id', userId)

      if (cancelled) return

      if (!error && data) {
        const total = data.reduce((sum: number, bm: { items?: { id: string }[] | null }) => sum + (bm.items?.length ?? 0), 0)
        setBookmarkCount(total)
      } else {
        setBookmarkCount(0)
      }
    }

    fetchBookmarkCount()

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchBookmarkCount()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', fetchBookmarkCount)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', fetchBookmarkCount)
    }
  }, [userId])

  if (bookmarkCount === null) return null

  const checkData: ActionCheckData = {
    gardensCount,
    plantsTotal,
    friendsCount,
    bookmarkCount,
    hasBio,
  }

  const completedCount = PROFILE_ACTIONS.filter((a) => a.isCompleted(checkData)).length
  const totalCount = PROFILE_ACTIONS.length
  const allDone = completedCount === totalCount
  const percentage = Math.round((completedCount / totalCount) * 100)
  const strokeOffset = CIRCUMFERENCE - (CIRCUMFERENCE * percentage) / 100

  if (dismissed) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0, marginTop: 0 }}
        transition={{ duration: 0.35 }}
        className="mt-4 rounded-[24px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/90 dark:bg-[#17171a]/90 shadow-[0_25px_70px_-45px_rgba(15,23,42,0.65)] overflow-hidden"
      >
        <div className="p-5 md:p-6">
          {/* Header with progress circle */}
          <div className="flex items-center gap-4 mb-4">
            {/* Circular progress */}
            <div className="relative shrink-0">
              <svg width={CIRCLE_SIZE} height={CIRCLE_SIZE} className="-rotate-90">
                <circle
                  cx={CIRCLE_SIZE / 2}
                  cy={CIRCLE_SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={STROKE_WIDTH}
                  className="text-stone-200 dark:text-stone-700"
                />
                <motion.circle
                  cx={CIRCLE_SIZE / 2}
                  cy={CIRCLE_SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={STROKE_WIDTH}
                  strokeLinecap="round"
                  className="text-accent"
                  strokeDasharray={CIRCUMFERENCE}
                  initial={{ strokeDashoffset: CIRCUMFERENCE }}
                  animate={{ strokeDashoffset: strokeOffset }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                {allDone ? (
                  <Check className="h-5 w-5 text-accent" />
                ) : (
                  <span className="text-sm font-bold tabular-nums text-stone-700 dark:text-stone-200">
                    {percentage}%
                  </span>
                )}
              </div>
            </div>

            <div className="min-w-0">
              <h3 className="text-base font-semibold text-stone-800 dark:text-stone-100 leading-tight">
                {allDone
                  ? t('profileActions.allDoneTitle', 'All done!')
                  : t('profileActions.title', 'Get started')}
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                {allDone
                  ? t('profileActions.allDoneSubtitle', 'You completed every action. Great job!')
                  : t('profileActions.subtitle', '{{done}} of {{total}} completed', { done: completedCount, total: totalCount })}
              </p>
            </div>
          </div>

          {allDone ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center justify-between py-3"
            >
              <div className="flex items-center gap-2 text-accent text-sm font-medium">
                <PartyPopper className="h-4 w-4" />
                {t('profileActions.congratulations', 'Congratulations!')}
              </div>
              <button
                onClick={() => setDismissed(true)}
                className="text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
              >
                {t('profileActions.dismiss', 'Dismiss')}
              </button>
            </motion.div>
          ) : (
            <div className="space-y-1.5">
              {PROFILE_ACTIONS.map((action) => {
                const done = action.isCompleted(checkData)
                return (
                  <Link
                    key={action.id}
                    to={action.link}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors group ${
                      done
                        ? 'bg-accent/8 dark:bg-accent/10'
                        : 'hover:bg-stone-50 dark:hover:bg-stone-800/60'
                    }`}
                  >
                    {/* Status icon */}
                    <div
                      className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                        done
                          ? 'bg-accent text-white'
                          : 'bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400'
                      }`}
                    >
                      {done ? <Check className="h-3.5 w-3.5" /> : ACTION_ICONS[action.iconId]}
                    </div>

                    {/* Title */}
                    <span
                      className={`flex-1 text-sm leading-tight ${
                        done
                          ? 'text-stone-400 dark:text-stone-500 line-through'
                          : 'text-stone-700 dark:text-stone-200 font-medium'
                      }`}
                    >
                      {t(action.titleKey)}
                    </span>

                    {/* Arrow for incomplete */}
                    {!done && (
                      <ChevronRight className="h-4 w-4 text-stone-300 dark:text-stone-600 group-hover:text-stone-500 dark:group-hover:text-stone-400 transition-colors shrink-0" />
                    )}
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
