import React from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Loader2, Upload, X, Check } from 'lucide-react'

interface ReportPlantDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  plantId: string
  plantName: string
}

export const ReportPlantDialog: React.FC<ReportPlantDialogProps> = ({
  open,
  onOpenChange,
  plantId,
  plantName,
}) => {
  const { t } = useTranslation('common')
  const { user } = useAuth()
  const [note, setNote] = React.useState('')
  const [imageUrl, setImageUrl] = React.useState<string | null>(null)
  const [imagePreview, setImagePreview] = React.useState<string | null>(null)
  const [uploading, setUploading] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [submitted, setSubmitted] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const resetForm = React.useCallback(() => {
    setNote('')
    setImageUrl(null)
    setImagePreview(null)
    setUploading(false)
    setSubmitting(false)
    setSubmitted(false)
    setError(null)
  }, [])

  const handleOpenChange = React.useCallback((value: boolean) => {
    if (!value) resetForm()
    onOpenChange(value)
  }, [onOpenChange, resetForm])

  const handleImageSelect = React.useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/avif']
    if (!allowedTypes.includes(file.type)) {
      setError(t('plantInfo.report.invalidImage', { defaultValue: 'Please upload a valid image file (JPEG, PNG, WebP, GIF)' }))
      return
    }

    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      setError(t('plantInfo.report.imageTooLarge', { defaultValue: 'Image is too large. Maximum size is 10 MB.' }))
      return
    }

    setError(null)
    setUploading(true)

    const reader = new FileReader()
    reader.onload = () => setImagePreview(reader.result as string)
    reader.readAsDataURL(file)

    try {
      const token = (await (await import('@/lib/supabaseClient')).supabase.auth.getSession()).data.session?.access_token
      if (!token) throw new Error('Not authenticated')

      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/plant-report/upload-image', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Upload failed')
      setImageUrl(data.url)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upload failed'
      setError(message)
      setImagePreview(null)
      setImageUrl(null)
    } finally {
      setUploading(false)
    }
  }, [t])

  const handleRemoveImage = React.useCallback(() => {
    setImageUrl(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const handleSubmit = React.useCallback(async () => {
    if (!note.trim() || note.trim().length < 10) {
      setError(t('plantInfo.report.noteTooShort', { defaultValue: 'Please provide a detailed description (at least 10 characters).' }))
      return
    }

    setError(null)
    setSubmitting(true)

    try {
      const token = (await (await import('@/lib/supabaseClient')).supabase.auth.getSession()).data.session?.access_token
      if (!token) throw new Error('Not authenticated')

      const response = await fetch('/api/plant-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plantId, note: note.trim(), imageUrl }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to submit report')

      setSubmitted(true)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to submit report'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }, [note, plantId, imageUrl, t])

  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg rounded-[28px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {t('plantInfo.report.title', { defaultValue: 'Report Plant Information' })}
          </DialogTitle>
          <DialogDescription>
            {t('plantInfo.report.description', {
              defaultValue: 'Report incorrect or outdated information for {{plantName}}',
              plantName,
            })}
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="h-14 w-14 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
              <Check className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-semibold text-stone-900 dark:text-white">
                {t('plantInfo.report.successTitle', { defaultValue: 'Report Submitted' })}
              </h3>
              <p className="text-sm text-stone-500 dark:text-stone-400">
                {t('plantInfo.report.successDescription', { defaultValue: 'Thank you for helping improve our plant data. Our team will review your report.' })}
              </p>
            </div>
            <Button
              variant="default"
              className="rounded-full bg-emerald-600 hover:bg-emerald-700"
              onClick={() => handleOpenChange(false)}
            >
              {t('common.close', { defaultValue: 'Close' })}
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <div>
                <Label htmlFor="report-note" className="text-sm font-medium">
                  {t('plantInfo.report.noteLabel', { defaultValue: 'What is wrong?' })} *
                </Label>
                <Textarea
                  id="report-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t('plantInfo.report.notePlaceholder', {
                    defaultValue: 'Describe what information is incorrect or outdated...',
                  })}
                  className="mt-1.5 min-h-[120px] resize-y rounded-xl"
                  maxLength={2000}
                />
                <p className="text-xs text-stone-400 dark:text-stone-500 mt-1 text-right">
                  {note.length}/2000
                </p>
              </div>

              <div>
                <Label className="text-sm font-medium">
                  {t('plantInfo.report.imageLabel', { defaultValue: 'Attach an image (optional)' })}
                </Label>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 mb-2">
                  {t('plantInfo.report.imageHint', { defaultValue: 'Upload a photo showing the correct information or the error' })}
                </p>

                {imagePreview ? (
                  <div className="relative inline-block">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="h-32 w-auto rounded-xl border border-stone-200 dark:border-[#3e3e42] object-cover"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="absolute -top-2 -right-2 rounded-full bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 p-1 shadow-md hover:opacity-80 transition-opacity"
                      disabled={uploading}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    {uploading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl">
                        <Loader2 className="h-6 w-6 animate-spin text-white" />
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border-2 border-dashed border-stone-200 dark:border-[#3e3e42] hover:border-emerald-400 dark:hover:border-emerald-600 text-stone-500 dark:text-stone-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                    disabled={uploading}
                  >
                    {uploading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Upload className="h-5 w-5" />
                    )}
                    <span className="text-sm">
                      {uploading
                        ? t('plantInfo.report.uploading', { defaultValue: 'Uploading...' })
                        : t('plantInfo.report.uploadImage', { defaultValue: 'Click to upload an image' })}
                    </span>
                  </button>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,image/avif"
                  className="hidden"
                  onChange={handleImageSelect}
                />
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 px-4 py-2.5 text-sm text-red-700 dark:text-red-300">
                  {error}
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="ghost" onClick={() => handleOpenChange(false)} className="rounded-full">
                {t('common.cancel', { defaultValue: 'Cancel' })}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || uploading || !note.trim()}
                className="rounded-full bg-emerald-600 hover:bg-emerald-700"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    {t('plantInfo.report.submitting', { defaultValue: 'Submitting...' })}
                  </>
                ) : (
                  t('plantInfo.report.submit', { defaultValue: 'Submit Report' })
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
