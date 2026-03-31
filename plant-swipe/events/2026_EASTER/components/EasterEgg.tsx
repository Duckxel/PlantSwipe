import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useEggHunt } from '@/context/EggHuntContext'
import { EggFoundModal } from './EggFoundModal'
import { useTranslation } from 'react-i18next'

const EGG_SVGS = [
  'https://media.aphylia.app/UTILITY/events/2026-easter/svg/egg-one-8050a884-e2c4-4a33-95bc-3d803ab9d0f4.svg',
  'https://media.aphylia.app/UTILITY/events/2026-easter/svg/egg-two-91cde01a-300a-4de6-b3c7-2e5931384e45.svg',
  'https://media.aphylia.app/UTILITY/events/2026-easter/svg/egg-three-69d4594c-e395-4257-aa89-fde5ec7bff79.svg',
  'https://media.aphylia.app/UTILITY/events/2026-easter/svg/egg-four-b0ba67ff-96ef-44f1-aeb5-ceb76668543e.svg',
  'https://media.aphylia.app/UTILITY/events/2026-easter/svg/egg-five-56657480-a57e-4466-9b57-c04f6ee74a27.svg',
  'https://media.aphylia.app/UTILITY/events/2026-easter/svg/egg-six-5a29a4df-abe3-45a7-b068-ac9a7e18ca47.svg',
]

type EasterEggProps = {
  /** The page path this egg belongs to (e.g. '/about'). */
  pagePath: string
}

/**
 * Renders a hidden egg icon on the page if there's an active event
 * with an item assigned to the given page path.
 * Uses the item's position_seed to pick a deterministic position and egg variant.
 */
export function EasterEgg({ pagePath }: EasterEggProps) {
  const { getItemForPage, foundItemIds, collectItem, event } = useEggHunt()
  const { t } = useTranslation('common')
  const [modalDescription, setModalDescription] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [wasAlreadyFound, setWasAlreadyFound] = useState(false)

  const item = getItemForPage(pagePath)
  if (!item || !event) return null

  const alreadyFound = foundItemIds.has(item.id)

  // Deterministic position from seed
  const seed = item.position_seed
  const topPercent = 20 + (((seed * 7) % 60))    // 20-80%
  const leftPercent = 10 + (((seed * 13) % 75))   // 10-85%

  // Pick egg variant from seed
  const eggSvg = EGG_SVGS[seed % EGG_SVGS.length]

  const handleClick = async () => {
    setWasAlreadyFound(alreadyFound)
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
          opacity: alreadyFound ? 0.6 : 1,
          scale: 1,
        }}
        whileHover={{ scale: 1.15, rotate: [0, -8, 8, 0] }}
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
          <img
            src={eggSvg}
            alt="Easter egg"
            className={`h-10 w-10 drop-shadow-lg transition-all ${
              alreadyFound
                ? 'grayscale opacity-70'
                : 'group-hover:scale-105 group-hover:drop-shadow-xl'
            }`}
            draggable={false}
          />
          {/* Pulsing glow only on unfound eggs */}
          {!alreadyFound && (
            <motion.div
              className="absolute -inset-1 rounded-full bg-amber-300/30 dark:bg-amber-400/20"
              animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )}
          {/* Small checkmark for found eggs */}
          {alreadyFound && (
            <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 flex items-center justify-center">
              <svg className="h-2 w-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </div>
      </motion.button>

      <AnimatePresence>
        {showModal && modalDescription !== null && (
          <EggFoundModal
            description={modalDescription}
            alreadyFound={wasAlreadyFound}
            eggSvg={eggSvg}
            onClose={() => setShowModal(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}
