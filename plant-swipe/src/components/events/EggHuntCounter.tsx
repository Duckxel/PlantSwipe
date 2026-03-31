import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Egg, Trophy, ChevronUp, ChevronDown } from 'lucide-react'
import { useEggHunt } from '@/context/EggHuntContext'
import { useTranslation } from 'react-i18next'

/**
 * A floating counter widget that shows event progress.
 * Displays found/total items and a completion badge.
 * Collapsed by default on mobile, expandable.
 */
export function EggHuntCounter() {
  const { event, totalItems, foundCount, completed, loading } = useEggHunt()
  const { t } = useTranslation('common')
  const [expanded, setExpanded] = useState(false)

  if (loading || !event || totalItems === 0) return null

  const remaining = totalItems - foundCount

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-20 right-4 z-50 lg:bottom-6"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white/90 dark:bg-[#1e1e1e]/90 backdrop-blur-md px-3 py-2 shadow-lg hover:shadow-xl transition-shadow"
      >
        <Egg className="h-5 w-5 text-amber-500 dark:text-amber-300" />
        <span className="text-sm font-medium text-stone-800 dark:text-stone-200">
          {foundCount}/{totalItems}
        </span>
        {completed && (
          <Trophy className="h-4 w-4 text-emerald-500" />
        )}
        {expanded ? (
          <ChevronDown className="h-3 w-3 text-stone-400" />
        ) : (
          <ChevronUp className="h-3 w-3 text-stone-400" />
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: 8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: 8, height: 0 }}
            className="mt-2 rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white/90 dark:bg-[#1e1e1e]/90 backdrop-blur-md p-4 shadow-lg overflow-hidden"
          >
            <h4 className="text-sm font-semibold text-stone-800 dark:text-stone-200 mb-1">
              {event.name}
            </h4>
            {event.description && (
              <p className="text-xs text-stone-500 dark:text-stone-400 mb-3">
                {event.description}
              </p>
            )}

            {/* Progress bar */}
            <div className="w-full h-2 rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-amber-400 dark:bg-amber-500"
                initial={{ width: 0 }}
                animate={{ width: `${totalItems > 0 ? (foundCount / totalItems) * 100 : 0}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-2">
              {completed
                ? t('eggHunt.congratulations')
                : t('eggHunt.remaining', { count: remaining })}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
