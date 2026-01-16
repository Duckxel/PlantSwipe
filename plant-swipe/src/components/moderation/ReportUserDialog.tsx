import React from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { AlertTriangle, Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { createUserReport } from "@/lib/moderation"

interface ReportUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  displayName: string | null
}

export function ReportUserDialog({ 
  open, 
  onOpenChange, 
  userId, 
  displayName 
}: ReportUserDialogProps) {
  const { t } = useTranslation('common')
  const [reason, setReason] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState(false)

  const handleSubmit = async () => {
    if (!reason.trim()) return
    
    setSubmitting(true)
    setError(null)
    
    try {
      await createUserReport({
        reportedUserId: userId,
        reason: reason.trim()
      })
      setSuccess(true)
      setTimeout(() => {
        onOpenChange(false)
        setReason('')
        setSuccess(false)
      }, 1500)
    } catch (e: any) {
      setError(e?.message || t('moderation.report.error'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setReason('')
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
            <div className="p-2.5 rounded-xl bg-red-100 dark:bg-red-900/30">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <DialogTitle className="text-lg">
                {t('moderation.report.title')}
              </DialogTitle>
              {displayName && (
                <p className="text-sm text-stone-500 dark:text-stone-400 mt-0.5">
                  {displayName}
                </p>
              )}
            </div>
          </div>
          <DialogDescription className="text-sm text-stone-600 dark:text-stone-400 mt-3">
            {t('moderation.report.description')}
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('moderation.report.reasonPlaceholder')}
            className="min-h-[120px] rounded-xl resize-none"
            disabled={submitting || success}
          />
          
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-2">{error}</p>
          )}
          
          {success && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-2">
              {t('moderation.report.success')}
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
            onClick={handleSubmit}
            disabled={submitting || !reason.trim() || success}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('common.submitting')}
              </>
            ) : (
              t('moderation.report.submit')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
