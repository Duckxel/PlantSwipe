import React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabaseClient"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/context/AuthContext"

interface RequestPlantDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const RequestPlantDialog: React.FC<RequestPlantDialogProps> = ({ open, onOpenChange }) => {
  const { t } = useTranslation('common')
  const { user } = useAuth()
  const [plantName, setPlantName] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState(false)

  const handleSubmit = async () => {
    if (!plantName.trim()) {
      setError(t('requestPlant.nameRequired') || 'Plant name is required')
      return
    }

    if (!user?.id) {
      setError(t('requestPlant.mustBeLoggedIn') || 'You must be logged in to request a plant')
      return
    }

    setSubmitting(true)
    setError(null)
    setSuccess(false)

    try {
      const displayName = plantName.trim()
      const normalizedName = displayName.toLowerCase()

      if (!displayName || !normalizedName) {
        setError(t('requestPlant.nameRequired') || 'Plant name is required')
        return
      }

      const normalize = (value: string | null | undefined) => (value ?? '').toLowerCase().trim()

      // Get all existing active requests to check for similar names
      // We fetch all because we need to do client-side similarity matching
      const { data: existingRequests, error: searchError } = await supabase
        .from('requested_plants')
        .select('id, request_count, plant_name, plant_name_normalized')
        .is('completed_at', null)

      if (searchError) {
        throw new Error(searchError.message)
      }

      // Check for exact match first (case-insensitive)
      const exactMatch = existingRequests?.find((req) => {
        const existingNormalized = normalize(req.plant_name_normalized ?? req.plant_name)
        return existingNormalized === normalizedName
      })

      if (exactMatch) {
        const { error: updateError } = await supabase
          .from('requested_plants')
          .update({
            plant_name: displayName,
            plant_name_normalized: normalizedName,
            request_count: (exactMatch.request_count ?? 0) + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', exactMatch.id)

        if (updateError) {
          throw new Error(updateError.message)
        }
      } else {
        // Check for similar names (fuzzy match)
        const similarMatch = existingRequests?.find((req) => {
          const existing = normalize(req.plant_name_normalized ?? req.plant_name)

          if (!existing) return false
          if (existing === normalizedName) return true

          // Check for partial overlap (e.g., "Rose" vs "Red Rose")
          if (existing.includes(normalizedName) || normalizedName.includes(existing)) {
            const lengthDiff = Math.abs(existing.length - normalizedName.length)
            if (lengthDiff <= 3) return true
          }

          // Simple character difference heuristic
          const maxLen = Math.max(existing.length, normalizedName.length)
          const minLen = Math.min(existing.length, normalizedName.length)
          if (maxLen - minLen > 3) return false

          let differences = 0
          for (let i = 0; i < minLen; i++) {
            if (existing[i] !== normalizedName[i]) differences++
          }
          differences += maxLen - minLen

          return differences <= 2
        })

        if (similarMatch) {
          const stored = similarMatch.plant_name ?? ''
          const storedNormalized = normalize(similarMatch.plant_name_normalized ?? stored)
          const computedNormalized = similarMatch.plant_name_normalized ?? (storedNormalized || normalizedName)

          const updatePayload: Record<string, any> = {
            request_count: (similarMatch.request_count ?? 0) + 1,
            updated_at: new Date().toISOString(),
            plant_name_normalized: computedNormalized || normalizedName
          }

          if (!stored || storedNormalized === stored) {
            updatePayload.plant_name = displayName
          }

          const { error: updateError } = await supabase
            .from('requested_plants')
            .update(updatePayload)
            .eq('id', similarMatch.id)

          if (updateError) {
            throw new Error(updateError.message)
          }
        } else {
          // Create new request
          const { error: insertError } = await supabase
            .from('requested_plants')
            .insert({
              plant_name: displayName,
              plant_name_normalized: normalizedName,
              requested_by: user.id,
              request_count: 1
            })

          if (insertError) {
            throw new Error(insertError.message)
          }
        }
      }

      setSuccess(true)
      setPlantName("")

      setTimeout(() => {
        onOpenChange(false)
        setSuccess(false)
      }, 1500)
    } catch (e: any) {
      setError(e?.message || t('requestPlant.error') || 'Failed to submit request')
    } finally {
      setSubmitting(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !submitting) {
      setPlantName("")
      setError(null)
      setSuccess(false)
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('requestPlant.title') || 'Request a Plant'}</DialogTitle>
          <DialogDescription>
            {t('requestPlant.description') || 'Let us know which plant you would like to see added to the encyclopedia.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="plant-name">{t('requestPlant.plantName') || 'Plant Name'}</Label>
            <Input
              id="plant-name"
              placeholder={t('requestPlant.placeholder') || 'Enter plant name...'}
              value={plantName}
              onChange={(e) => {
                setPlantName(e.target.value)
                setError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !submitting) {
                  handleSubmit()
                }
              }}
              disabled={submitting}
            />
          </div>
          {error && (
            <div className="text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
          {success && (
            <div className="text-sm text-green-600 dark:text-green-400">
              {t('requestPlant.success') || 'Thank you! Your request has been submitted.'}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            {t('common.cancel') || 'Cancel'}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !plantName.trim()}
          >
            {submitting ? (t('common.submitting') || 'Submitting...') : (t('requestPlant.submit') || 'Submit Request')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
