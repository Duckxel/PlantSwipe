import React from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Ban, LogOut } from 'lucide-react'

type BannedModalProps = {
  open: boolean
  onAcknowledge: () => void
}

/**
 * BannedModal — shown when a user's account is detected as shadow-banned
 * (threat_level = 3) during an active session. The user must acknowledge
 * the ban before being signed out. This ensures they see a clear message
 * explaining what happened.
 */
export const BannedModal: React.FC<BannedModalProps> = ({ open, onAcknowledge }) => {
  const { t } = useTranslation('common')

  return (
    <Dialog open={open} onOpenChange={() => { /* prevent close by clicking outside */ }}>
      <DialogContent
        className="max-w-md mx-auto rounded-2xl"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        hideCloseButton
      >
        <div className="flex flex-col items-center text-center gap-4 py-4">
          {/* Ban icon */}
          <div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-950/50 flex items-center justify-center">
            <Ban className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>

          {/* Title */}
          <h2 className="text-xl font-semibold text-stone-900 dark:text-stone-100">
            {t('ban.modal.title')}
          </h2>

          {/* Description */}
          <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed max-w-sm">
            {t('ban.modal.description')}
          </p>

          {/* Details list */}
          <div className="w-full bg-stone-50 dark:bg-stone-900/50 rounded-xl p-4 text-left space-y-2">
            <p className="text-xs font-medium text-stone-700 dark:text-stone-300 uppercase tracking-wide">
              {t('ban.modal.whatHappened')}
            </p>
            <ul className="text-sm text-stone-600 dark:text-stone-400 space-y-1.5 list-disc list-inside">
              <li>{t('ban.modal.detail1')}</li>
              <li>{t('ban.modal.detail2')}</li>
              <li>{t('ban.modal.detail3')}</li>
              <li>{t('ban.modal.detail4')}</li>
            </ul>
          </div>

          {/* Contact info */}
          <p className="text-xs text-stone-500 dark:text-stone-500">
            {t('ban.modal.contact')}
          </p>

          {/* Acknowledge button */}
          <Button
            onClick={onAcknowledge}
            variant="destructive"
            className="w-full rounded-2xl gap-2"
          >
            <LogOut className="h-4 w-4" />
            {t('ban.modal.acknowledge')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
