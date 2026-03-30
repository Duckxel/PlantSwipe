import { motion } from 'framer-motion'
import { Egg, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'

type EggFoundModalProps = {
  description: string
  onClose: () => void
}

export function EggFoundModal({ description, onClose }: EggFoundModalProps) {
  const { t } = useTranslation('common')

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Modal */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e1e] p-6 shadow-xl"
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          aria-label={t('common.close')}
        >
          <X className="h-4 w-4 text-stone-500" />
        </button>

        <div className="flex flex-col items-center text-center space-y-4">
          {/* Animated egg icon */}
          <motion.div
            initial={{ rotate: -20 }}
            animate={{ rotate: [0, -10, 10, -5, 5, 0] }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="rounded-full bg-amber-100 dark:bg-amber-900/30 p-4"
          >
            <Egg className="h-10 w-10 text-amber-500 dark:text-amber-300" />
          </motion.div>

          <h3 className="text-lg font-semibold text-stone-900 dark:text-stone-100">
            {t('eggHunt.foundTitle')}
          </h3>

          <p className="text-sm text-stone-600 dark:text-stone-300">
            {description}
          </p>

          <Button onClick={onClose} className="rounded-2xl w-full mt-2">
            {t('eggHunt.continueButton')}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}
