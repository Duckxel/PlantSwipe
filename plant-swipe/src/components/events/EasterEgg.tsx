import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Egg } from 'lucide-react'
import { useEggHunt } from '@/context/EggHuntContext'
import { EggFoundModal } from './EggFoundModal'
import { useTranslation } from 'react-i18next'

type EasterEggProps = {
  /** The page path this egg belongs to (e.g. '/about'). */
  pagePath: string
}

/**
 * Renders a hidden egg icon on the page if there's an active event
 * with an item assigned to the given page path.
 * Uses the item's position_seed to pick a deterministic position.
 */
export function EasterEgg({ pagePath }: EasterEggProps) {
  const { getItemForPage, foundItemIds, collectItem, event } = useEggHunt()
  const { t } = useTranslation('common')
  const [modalDescription, setModalDescription] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)

  const item = getItemForPage(pagePath)
  if (!item || !event) return null

  const alreadyFound = foundItemIds.has(item.id)

  // Deterministic position from seed
  const seed = item.position_seed
  const topPercent = 20 + (((seed * 7) % 60))    // 20-80%
  const leftPercent = 10 + (((seed * 13) % 75))   // 10-85%

  const handleClick = async () => {
    const description = await collectItem(item.id)
    if (description !== null) {
      setModalDescription(description)
      setShowModal(true)
    }
  }

  return (
    <>
      <motion.button
        onClick={handleClick}
        initial={{ opacity: 0, scale: 0 }}
        animate={{
          opacity: alreadyFound ? 0.3 : 1,
          scale: 1,
        }}
        whileHover={{ scale: 1.2, rotate: [0, -10, 10, 0] }}
        whileTap={{ scale: 0.9 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="absolute z-40 cursor-pointer group"
        style={{
          top: `${topPercent}%`,
          left: `${leftPercent}%`,
        }}
        aria-label={t('eggHunt.foundTitle')}
        title={alreadyFound ? t('eggHunt.alreadyFound') : t('eggHunt.clickMe')}
      >
        <div className="relative">
          <Egg
            className={`h-8 w-8 drop-shadow-lg transition-colors ${
              alreadyFound
                ? 'text-stone-400 dark:text-stone-600'
                : 'text-amber-400 dark:text-amber-300 group-hover:text-amber-500 dark:group-hover:text-amber-200'
            }`}
          />
          {!alreadyFound && (
            <motion.div
              className="absolute -inset-1 rounded-full bg-amber-300/30 dark:bg-amber-400/20"
              animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )}
        </div>
      </motion.button>

      <AnimatePresence>
        {showModal && modalDescription !== null && (
          <EggFoundModal
            description={modalDescription}
            onClose={() => setShowModal(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}
