import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Link } from '@/components/i18n/Link'
import { Home, Sprout, UserPlus, UserPen, Bookmark, ChevronRight, Check, PartyPopper } from 'lucide-react'
import { PROFILE_ACTIONS, type ActionCheckData, type ProfileActionDef } from '@/lib/profileActions'
import { supabase } from '@/lib/supabaseClient'

const ACTION_ICONS: Record<string, React.ReactNode> = {
  garden: <Home className="h-4 w-4" />,
  plant: <Sprout className="h-4 w-4" />,
  friend: <UserPlus className="h-4 w-4" />,
  profile: <UserPen className="h-4 w-4" />,
  bookmark: <Bookmark className="h-4 w-4" />,
}

const POLL_INTERVAL_MS = 6_000

const CIRCLE_SIZE = 64
const STROKE_WIDTH = 5
const RADIUS = (CIRCLE_SIZE - STROKE_WIDTH) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

type Props = { userId: string }

async function fetchAllActionData(userId: string): Promise<ActionCheckData | null> {
  try {
    const [statsRes, friendsRes, bookmarksRes, profileRes] = await Promise.all([
      supabase.rpc('get_user_profile_public_stats', { _user_id: userId }),
      supabase.rpc('get_friend_count', { _user_id: userId }),
      supabase
        .from('bookmarks')
        .select('id, items:bookmark_items(id)')
        .eq('user_id', userId),
      supabase
        .from('profiles')
        .select('bio')
        .eq('id', userId)
        .maybeSingle(),
    ])

    const statRow = statsRes.data
      ? Array.isArray(statsRes.data) ? statsRes.data[0] : statsRes.data
      : null

    const bookmarkItemTotal = bookmarksRes.data
      ? bookmarksRes.data.reduce(
          (sum: number, bm: { items?: { id: string }[] | null }) =>
            sum + (bm.items?.length ?? 0),
          0,
        )
      : 0

    return {
      gardensCount: Number(statRow?.gardens_count ?? 0),
      plantsTotal: Number(statRow?.plants_total ?? 0),
      friendsCount: typeof friendsRes.data === 'number' ? friendsRes.data : 0,
      bookmarkCount: bookmarkItemTotal,
      hasBio: Boolean(profileRes.data?.bio && String(profileRes.data.bio).trim().length > 0),
    }
  } catch {
    return null
  }
}

export function ProfileActions({ userId }: Props) {
  const { t } = useTranslation('common')
  const [data, setData] = React.useState<ActionCheckData | null>(null)
  const [dismissed, setDismissed] = React.useState(false)
  const prevCompletedRef = React.useRef<Set<string>>(new Set())
  const [justCompleted, setJustCompleted] = React.useState<string | null>(null)

  const refresh = React.useCallback(async () => {
    const result = await fetchAllActionData(userId)
    if (result) setData(result)
  }, [userId])

  // Initial fetch
  React.useEffect(() => {
    refresh()
  }, [refresh])

  // Polling — only while the tab is visible and not all done
  React.useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null

    function startPolling() {
      stopPolling()
      timer = setInterval(() => {
        if (document.visibilityState === 'visible') refresh()
      }, POLL_INTERVAL_MS)
    }
    function stopPolling() {
      if (timer) { clearInterval(timer); timer = null }
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        refresh()
        startPolling()
      } else {
        stopPolling()
      }
    }

    const onFocus = () => refresh()

    startPolling()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onFocus)

    return () => {
      stopPolling()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onFocus)
    }
  }, [refresh])

  // Track which actions just became completed for animation
  React.useEffect(() => {
    if (!data) return
    const nowCompleted = new Set(
      PROFILE_ACTIONS.filter((a) => a.isCompleted(data)).map((a) => a.id),
    )
    for (const id of nowCompleted) {
      if (!prevCompletedRef.current.has(id)) {
        setJustCompleted(id)
        const timeout = setTimeout(() => setJustCompleted(null), 1200)
        prevCompletedRef.current = nowCompleted
        return () => clearTimeout(timeout)
      }
    }
    prevCompletedRef.current = nowCompleted
  }, [data])

  if (!data || dismissed) return null

  const completedCount = PROFILE_ACTIONS.filter((a) => a.isCompleted(data)).length
  const totalCount = PROFILE_ACTIONS.length
  const allDone = completedCount === totalCount
  const percentage = Math.round((completedCount / totalCount) * 100)

  return (
    <AnimatePresence>
      <motion.div
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0, marginTop: 0 }}
        transition={{ duration: 0.35 }}
        className="mt-4 rounded-[24px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/90 dark:bg-[#17171a]/90 shadow-[0_25px_70px_-45px_rgba(15,23,42,0.65)] overflow-hidden"
      >
        <div className="p-5 md:p-6">
          {/* Header with progress circle */}
          <div className="flex items-center gap-4 mb-4">
            <ProgressCircle percentage={percentage} allDone={allDone} />
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-stone-800 dark:text-stone-100 leading-tight">
                {allDone
                  ? t('profileActions.allDoneTitle', 'All done!')
                  : t('profileActions.title', 'Get started')}
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                {allDone
                  ? t('profileActions.allDoneSubtitle', 'You completed every action. Great job!')
                  : t('profileActions.subtitle', '{{done}} of {{total}} completed', {
                      done: completedCount,
                      total: totalCount,
                    })}
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
              {PROFILE_ACTIONS.map((action) => (
                <ActionRow
                  key={action.id}
                  action={action}
                  done={action.isCompleted(data)}
                  justCompleted={justCompleted === action.id}
                />
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

/* ---------- Sub-components ---------- */

function ProgressCircle({ percentage, allDone }: { percentage: number; allDone: boolean }) {
  const strokeOffset = CIRCUMFERENCE - (CIRCUMFERENCE * percentage) / 100
  return (
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
          animate={{ strokeDashoffset: strokeOffset }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <AnimatePresence mode="wait">
          {allDone ? (
            <motion.div
              key="check"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            >
              <Check className="h-5 w-5 text-accent" />
            </motion.div>
          ) : (
            <motion.span
              key={percentage}
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.7, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="text-sm font-bold tabular-nums text-stone-700 dark:text-stone-200"
            >
              {percentage}%
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function ActionRow({
  action,
  done,
  justCompleted,
}: {
  action: ProfileActionDef
  done: boolean
  justCompleted: boolean
}) {
  const { t } = useTranslation('common')

  return (
    <Link
      to={action.link}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors group ${
        done
          ? 'bg-accent/8 dark:bg-accent/10'
          : 'hover:bg-stone-50 dark:hover:bg-stone-800/60'
      }`}
    >
      {/* Status icon */}
      <div className="shrink-0 relative">
        <AnimatePresence mode="wait">
          {done ? (
            <motion.div
              key="done"
              initial={justCompleted ? { scale: 0, rotate: -90 } : false}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 14 }}
              className="w-7 h-7 rounded-full flex items-center justify-center bg-accent text-white"
            >
              <Check className="h-3.5 w-3.5" />
            </motion.div>
          ) : (
            <motion.div
              key="pending"
              className="w-7 h-7 rounded-full flex items-center justify-center bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400"
            >
              {ACTION_ICONS[action.iconId]}
            </motion.div>
          )}
        </AnimatePresence>
        {justCompleted && (
          <motion.div
            initial={{ scale: 0.5, opacity: 1 }}
            animate={{ scale: 2.5, opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="absolute inset-0 rounded-full bg-accent/30 pointer-events-none"
          />
        )}
      </div>

      {/* Title */}
      <span
        className={`flex-1 text-sm leading-tight transition-all duration-300 ${
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
}
