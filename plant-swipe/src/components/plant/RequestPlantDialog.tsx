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
      // Normalize the plant name for similarity matching (lowercase, trim)
      const normalizedName = plantName.trim().toLowerCase()

      if (!normalizedName) {
        setError(t('requestPlant.nameRequired') || 'Plant name is required')
        return
      }

      // Get all existing requests to check for similar names
      // We fetch all because we need to do client-side similarity matching
      const { data: existingRequests, error: searchError } = await supabase
        .from('requested_plants')
        .select('id, request_count, plant_name')

      if (searchError) {
        throw new Error(searchError.message)
      }

      // Check for exact match first (case-insensitive)
      const exactMatch = existingRequests?.find(
        req => req.plant_name.toLowerCase().trim() === normalizedName
      )

      if (exactMatch) {
        // Increment the count for exact match
        const { error: updateError } = await supabase
          .from('requested_plants')
          .update({ 
            request_count: (exactMatch.request_count || 1) + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', exactMatch.id)

        if (updateError) {
          throw new Error(updateError.message)
        }
      } else {
        // Check for similar names (fuzzy match)
        // Simple similarity: check if names are very close
        const similarMatch = existingRequests?.find(req => {
          const existing = req.plant_name.toLowerCase().trim()
          
          // If names are identical (after normalization), it's a match
          if (existing === normalizedName) return true
          
          // Check if one contains the other (for partial matches like "Rose" vs "Red Rose")
          if (existing.includes(normalizedName) || normalizedName.includes(existing)) {
            // Only consider it similar if the length difference is small
            const lengthDiff = Math.abs(existing.length - normalizedName.length)
            return lengthDiff <= 3
          }
          
          // Check character similarity using simple Levenshtein distance approximation
          const maxLen = Math.max(existing.length, normalizedName.length)
          const minLen = Math.min(existing.length, normalizedName.length)
          
          // If length difference is too large, not similar
          if (maxLen - minLen > 3) return false
          
          // Count character differences
          let differences = 0
          for (let i = 0; i < minLen; i++) {
            if (existing[i] !== normalizedName[i]) differences++
          }
          differences += maxLen - minLen
          
          // Consider similar if differences <= 2 (allowing for typos)
          return differences <= 2
        })

        if (similarMatch) {
          // Increment count for similar match
          const { error: updateError } = await supabase
            .from('requested_plants')
            .update({ 
              request_count: (similarMatch.request_count || 1) + 1,
              updated_at: new Date().toISOString()
            })
            .eq('id', similarMatch.id)

          if (updateError) {
            throw new Error(updateError.message)
          }
        } else {
          // Create new request
          const { error: insertError } = await supabase
            .from('requested_plants')
            .insert({
              plant_name: normalizedName,
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
      
      // Close dialog after a short delay
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
