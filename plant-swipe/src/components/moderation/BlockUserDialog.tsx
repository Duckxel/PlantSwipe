import React from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Ban, Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { blockUser } from "@/lib/moderation"

interface BlockUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  displayName: string | null
  onBlocked?: () => void
}

export function BlockUserDialog({ 
  open, 
  onOpenChange, 
  userId, 
  displayName,
  onBlocked
}: BlockUserDialogProps) {
  const { t } = useTranslation('common')
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState(false)

  const handleBlock = async () => {
    setSubmitting(true)
    setError(null)
    
    try {
      await blockUser(userId)
      setSuccess(true)
      onBlocked?.()
      setTimeout(() => {
        onOpenChange(false)
        setSuccess(false)
      }, 1000)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      setError(e?.message || t('moderation.block.error'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setError(null)
      setSuccess(false)
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="rounded-[28px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/95 dark:bg-[#1f1f1f]/95 backdrop-blur max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-stone-100 dark:bg-stone-800/50">
              <Ban className="h-5 w-5 text-stone-600 dark:text-stone-400" />
            </div>
            <div>
              <DialogTitle className="text-lg">
                {t('moderation.block.title')}
              </DialogTitle>
              {displayName && (
                <p className="text-sm text-stone-500 dark:text-stone-400 mt-0.5">
                  {displayName}
                </p>
              )}
            </div>
          </div>
          <DialogDescription className="text-sm text-stone-600 dark:text-stone-400 mt-3">
            {t('moderation.block.description')}
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-2">
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          
          {success && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              {t('moderation.block.success')}
            </p>
          )}
        </div>
        
        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            className="rounded-xl"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant="destructive"
            className="rounded-xl"
            onClick={handleBlock}
            disabled={submitting || success}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('common.processing')}
              </>
            ) : (
              <>
                <Ban className="h-4 w-4 mr-2" />
                {t('moderation.block.confirm')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
