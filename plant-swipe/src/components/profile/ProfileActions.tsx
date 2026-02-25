import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Link } from '@/components/i18n/Link'
import {
  Home,
  Sprout,
  UserPlus,
  UserPen,
  Bookmark,
  ChevronRight,
  Check,
  PartyPopper,
  X,
  Target,
} from 'lucide-react'
import {
  PROFILE_ACTIONS,
  type ActionCheckData,
  type ProfileActionDef,
  getSkippedActionIds,
  skipAction,
  getRemainingCount,
} from '@/lib/profileActions'
import { supabase } from '@/lib/supabaseClient'

// ---- Shared fetch (also used by useProfileActionsCount) ----

export async function fetchAllActionData(
  userId: string,
): Promise<ActionCheckData | null> {
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
      ? Array.isArray(statsRes.data)
        ? statsRes.data[0]
        : statsRes.data
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
      hasBio: Boolean(
        profileRes.data?.bio && String(profileRes.data.bio).trim().length > 0,
      ),
    }
  } catch {
    return null
  }
}

// ---- Hook for TopBar / MobileNavBar badge ----

const BADGE_POLL_MS = 8_000

export function useProfileActionsCount(userId: string | null | undefined) {
  const [remaining, setRemaining] = React.useState(0)

  React.useEffect(() => {
    if (!userId) { setRemaining(0); return }

    let cancelled = false

    async function check() {
      const data = await fetchAllActionData(userId!)
      if (cancelled) return
      const skipped = getSkippedActionIds()
      setRemaining(getRemainingCount(data, skipped))
    }

    check()

    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') check()
    }, BADGE_POLL_MS)

    const onVisibility = () => {
      if (document.visibilityState === 'visible') check()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', () => check())

    return () => {
      cancelled = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [userId])

  return remaining
}

// ---- Constants ----

const ACTION_ICONS: Record<string, React.ReactNode> = {
  garden: <Home className="h-4 w-4" />,
  plant: <Sprout className="h-4 w-4" />,
  friend: <UserPlus className="h-4 w-4" />,
  profile: <UserPen className="h-4 w-4" />,
  bookmark: <Bookmark className="h-4 w-4" />,
}

const POLL_INTERVAL_MS = 6_000
const CIRCLE_SIZE = 72
const STROKE_WIDTH = 5
const RADIUS = (CIRCLE_SIZE - STROKE_WIDTH) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

type Props = { userId: string }

// ---- Main component ----

export function ProfileActions({ userId }: Props) {
  const { t } = useTranslation('common')
  const [data, setData] = React.useState<ActionCheckData | null>(null)
  const [dismissed, setDismissed] = React.useState(false)
  const [skipped, setSkipped] = React.useState<Set<string>>(getSkippedActionIds)
  const prevCompletedRef = React.useRef<Set<string>>(new Set())
  const [justCompleted, setJustCompleted] = React.useState<string | null>(null)

  const refresh = React.useCallback(async () => {
    const result = await fetchAllActionData(userId)
    if (result) setData(result)
  }, [userId])

  React.useEffect(() => { refresh() }, [refresh])

  React.useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null
    function start() { stop(); timer = setInterval(() => { if (document.visibilityState === 'visible') refresh() }, POLL_INTERVAL_MS) }
    function stop() { if (timer) { clearInterval(timer); timer = null } }
    const onVis = () => { if (document.visibilityState === 'visible') { refresh(); start() } else { stop() } }
    const onFocus = () => refresh()
    start()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', onFocus)
    return () => { stop(); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('focus', onFocus) }
  }, [refresh])

  React.useEffect(() => {
    if (!data) return
    const nowDone = new Set(PROFILE_ACTIONS.filter((a) => a.isCompleted(data)).map((a) => a.id))
    for (const id of nowDone) {
      if (!prevCompletedRef.current.has(id)) {
        setJustCompleted(id)
        const tm = setTimeout(() => setJustCompleted(null), 1200)
        prevCompletedRef.current = nowDone
        return () => clearTimeout(tm)
      }
    }
    prevCompletedRef.current = nowDone
  }, [data])

  const handleSkip = (actionId: string) => {
    setSkipped(skipAction(actionId))
  }

  if (!data || dismissed) return null

  const activeActions = PROFILE_ACTIONS.filter((a) => !skipped.has(a.id))
  const doneCount = activeActions.filter((a) => a.isCompleted(data)).length
  const totalActive = activeActions.length
  const allDone = totalActive > 0 && doneCount === totalActive
  const percentage = totalActive > 0 ? Math.round((doneCount / totalActive) * 100) : 100

  if (totalActive === 0) return null

  return (
    <AnimatePresence>
      <motion.div
        layout
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0, marginTop: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className="mt-4 rounded-[24px] border border-stone-200/60 dark:border-[#3e3e42]/60 bg-gradient-to-br from-white via-white to-accent/[0.03] dark:from-[#17171a] dark:via-[#17171a] dark:to-accent/[0.06] shadow-[0_8px_40px_-12px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.5)] overflow-hidden"
      >
        <div className="p-5 md:p-6">
          {/* Header */}
          <div className="flex items-center gap-4 mb-5">
            <ProgressCircle percentage={percentage} allDone={allDone} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-accent shrink-0" />
                <h3 className="text-base font-semibold text-stone-800 dark:text-stone-100 leading-tight">
                  {allDone
                    ? t('profileActions.allDoneTitle', 'All done!')
                    : t('profileActions.title', 'Get started')}
                </h3>
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 ml-6">
                {allDone
                  ? t('profileActions.allDoneSubtitle', 'You completed every action. Great job!')
                  : t('profileActions.subtitle', '{{done}} of {{total}} completed', {
                      done: doneCount,
                      total: totalActive,
                    })}
              </p>
            </div>
          </div>

          {allDone ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center justify-between rounded-2xl bg-accent/[0.07] dark:bg-accent/10 px-4 py-3"
            >
              <div className="flex items-center gap-2 text-accent text-sm font-medium">
                <PartyPopper className="h-4 w-4" />
                {t('profileActions.congratulations', 'Congratulations!')}
              </div>
              <button
                onClick={() => setDismissed(true)}
                className="text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors underline underline-offset-2"
              >
                {t('profileActions.dismiss', 'Dismiss')}
              </button>
            </motion.div>
          ) : (
            <div className="space-y-2">
              {activeActions.map((action, i) => (
                <ActionRow
                  key={action.id}
                  action={action}
                  done={action.isCompleted(data)}
                  justCompleted={justCompleted === action.id}
                  onSkip={() => handleSkip(action.id)}
                  index={i}
                />
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

/* ================================================================
   Sub-components
   ================================================================ */

function ProgressCircle({ percentage, allDone }: { percentage: number; allDone: boolean }) {
  const offset = CIRCUMFERENCE - (CIRCUMFERENCE * percentage) / 100
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
          className="text-stone-100 dark:text-stone-800"
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
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
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
              <Check className="h-6 w-6 text-accent" />
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
  onSkip,
  index,
}: {
  action: ProfileActionDef
  done: boolean
  justCompleted: boolean
  onSkip: () => void
  index: number
}) {
  const { t } = useTranslation('common')

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      className={`group relative flex items-center gap-3 rounded-2xl border transition-all duration-200 ${
        done
          ? 'border-accent/15 dark:border-accent/20 bg-accent/[0.04] dark:bg-accent/[0.07]'
          : 'border-stone-100 dark:border-stone-800 hover:border-stone-200 dark:hover:border-stone-700 hover:bg-stone-50/50 dark:hover:bg-stone-800/30'
      }`}
    >
      <Link
        to={action.link}
        className="flex items-center gap-3 flex-1 min-w-0 px-3 py-3"
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
                className="w-8 h-8 rounded-xl flex items-center justify-center bg-accent text-white shadow-sm"
              >
                <Check className="h-4 w-4" />
              </motion.div>
            ) : (
              <motion.div
                key="pending"
                className="w-8 h-8 rounded-xl flex items-center justify-center bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400"
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
              className="absolute inset-0 rounded-xl bg-accent/30 pointer-events-none"
            />
          )}
        </div>

        {/* Title */}
        <span
          className={`flex-1 text-sm leading-snug transition-all duration-300 ${
            done
              ? 'text-stone-400 dark:text-stone-500 line-through decoration-accent/40'
              : 'text-stone-700 dark:text-stone-200 font-medium'
          }`}
        >
          {t(action.titleKey)}
        </span>

        {!done && (
          <ChevronRight className="h-4 w-4 text-stone-300 dark:text-stone-600 group-hover:text-accent transition-colors shrink-0" />
        )}
      </Link>

      {/* Skip button — only for incomplete actions */}
      {!done && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSkip() }}
          className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity shrink-0 mr-2 p-1.5 rounded-lg text-stone-300 dark:text-stone-600 hover:text-stone-500 dark:hover:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
          title={t('profileActions.skip', 'Skip')}
          aria-label={t('profileActions.skip', 'Skip')}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </motion.div>
  )
}
