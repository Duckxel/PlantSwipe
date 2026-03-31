import { motion } from 'framer-motion'
import { Egg, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'

type EggFoundModalProps = {
  description: string
  alreadyFound?: boolean
  onClose: () => void
}

export function EggFoundModal({ description, alreadyFound, onClose }: EggFoundModalProps) {
  const { t } = useTranslation('common')

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Modal — bottom sheet on mobile, centered on desktop */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full sm:max-w-md max-h-[85vh] rounded-t-2xl sm:rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e1e] shadow-xl overflow-hidden flex flex-col"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-lg bg-white/80 dark:bg-[#1e1e1e]/80 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          aria-label={t('common.close')}
        >
          <X className="h-4 w-4 text-stone-500" />
        </button>

        {/* Scrollable content */}
        <div className="overflow-y-auto overscroll-contain p-6 flex flex-col items-center text-center space-y-4">
          {/* Animated egg icon */}
          <motion.div
            initial={{ rotate: -20 }}
            animate={{ rotate: alreadyFound ? 0 : [0, -10, 10, -5, 5, 0] }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className={`rounded-full p-4 flex-shrink-0 ${
              alreadyFound
                ? 'bg-stone-100 dark:bg-stone-800'
                : 'bg-amber-100 dark:bg-amber-900/30'
            }`}
          >
            <Egg className={`h-10 w-10 ${
              alreadyFound
                ? 'text-stone-400 dark:text-stone-500'
                : 'text-amber-500 dark:text-amber-300'
            }`} />
          </motion.div>

          <h3 className="text-lg font-semibold text-stone-900 dark:text-stone-100">
            {alreadyFound ? t('eggHunt.alreadyFoundTitle') : t('eggHunt.foundTitle')}
          </h3>

          <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed text-left w-full">
            {description}
          </p>

          <Button onClick={onClose} className="rounded-2xl w-full mt-2 flex-shrink-0">
            {t('eggHunt.continueButton')}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}
