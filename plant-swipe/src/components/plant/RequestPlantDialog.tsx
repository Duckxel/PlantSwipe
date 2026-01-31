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
  initialPlantName?: string
}

export const RequestPlantDialog: React.FC<RequestPlantDialogProps> = ({ open, onOpenChange, initialPlantName }) => {
  const { t } = useTranslation('common')
  const { user } = useAuth()
  const [plantName, setPlantName] = React.useState(initialPlantName || "")
  
  // Update plant name when initialPlantName prop changes
  React.useEffect(() => {
    if (initialPlantName && open) {
      setPlantName(initialPlantName)
    }
  }, [initialPlantName, open])
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
      const normalizedName = displayName.toLowerCase().trim()

      if (!displayName || !normalizedName) {
        setError(t('requestPlant.nameRequired') || 'Plant name is required')
        return
      }

      const normalize = (value: string | null | undefined) => (value ?? '').toLowerCase().trim()

      // First, check if a plant with this name already exists in the database
      // Check against: name, scientific_name in plants table
      const { data: existingByName, error: plantSearchError } = await supabase
        .from('plants')
        .select('id, name, scientific_name')
        .or(`name.ilike.%${normalizedName}%,scientific_name.ilike.%${normalizedName}%`)
        .limit(1)
        .maybeSingle()

      if (plantSearchError) {
        console.error('[RequestPlantDialog] Error checking existing plants:', plantSearchError)
        // Continue even if check fails - don't block the request
      }

      if (existingByName) {
        setError(t('requestPlant.plantAlreadyExists', { 
          plantName: existingByName.name,
          defaultValue: `This plant already exists in our database as "${existingByName.name}". Try searching for it in the encyclopedia!`
        }))
        return
      }

      // Also check given_names in plant_translations table
      // This catches cases where user searches by a common name like "Swiss Cheese Plant"
      const { data: translationMatches, error: translationError } = await supabase
        .from('plant_translations')
        .select('plant_id, given_names, plants!inner(id, name)')
        .eq('language', 'en')
        .limit(100)

      if (translationError) {
        console.error('[RequestPlantDialog] Error checking translations:', translationError)
        // Continue even if check fails - don't block the request
      }

      // Check if any plant has this name as a given_name
      let existingByGivenName: { id: string; name: string } | null = null
      if (translationMatches) {
        for (const row of translationMatches as any[]) {
          const givenNames = Array.isArray(row?.given_names) ? row.given_names : []
          const matchesGivenName = givenNames.some(
            (gn: unknown) => typeof gn === 'string' && gn.toLowerCase().includes(normalizedName)
          )
          if (matchesGivenName && row?.plants?.id) {
            existingByGivenName = { id: String(row.plants.id), name: String(row.plants.name || '') }
            break
          }
        }
      }

      if (existingByGivenName) {
        setError(t('requestPlant.plantAlreadyExists', { 
          plantName: existingByGivenName.name,
          defaultValue: `This plant already exists in our database as "${existingByGivenName.name}". Try searching for it in the encyclopedia!`
        }))
        return
      }

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

      let requestId: string | null = null

      if (exactMatch) {
        requestId = exactMatch.id
        
        // Check if user already requested this plant
        const { data: existingUserRequest, error: checkError } = await supabase
          .from('plant_request_users')
          .select('id')
          .eq('requested_plant_id', requestId)
          .eq('user_id', user.id)
          .single()

        if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "not found" which is expected
          throw new Error(checkError.message)
        }

        // If user already requested, don't add again
        if (existingUserRequest) {
          setError(t('requestPlant.alreadyRequested') || 'You have already requested this plant.')
          return
        }

        // Add user to junction table (trigger will update request_count)
        const { error: insertUserError } = await supabase
          .from('plant_request_users')
          .insert({
            requested_plant_id: requestId,
            user_id: user.id
          })

        if (insertUserError) {
          throw new Error(insertUserError.message)
        }

        // Update plant name if needed (to preserve better casing)
        if (displayName !== exactMatch.plant_name) {
          await supabase
            .from('requested_plants')
            .update({
              plant_name: displayName,
              plant_name_normalized: normalizedName,
              updated_at: new Date().toISOString()
            })
            .eq('id', requestId)
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
          requestId = similarMatch.id
          
          // Check if user already requested this plant
          const { data: existingUserRequest, error: checkError } = await supabase
            .from('plant_request_users')
            .select('id')
            .eq('requested_plant_id', requestId)
            .eq('user_id', user.id)
            .single()

          if (checkError && checkError.code !== 'PGRST116') {
            throw new Error(checkError.message)
          }

          // If user already requested, don't add again
          if (existingUserRequest) {
            setError(t('requestPlant.alreadyRequested') || 'You have already requested this plant.')
            return
          }

          // Add user to junction table (trigger will update request_count)
          const { error: insertUserError } = await supabase
            .from('plant_request_users')
            .insert({
              requested_plant_id: requestId,
              user_id: user.id
            })

          if (insertUserError) {
            throw new Error(insertUserError.message)
          }

          const stored = similarMatch.plant_name ?? ''
          const storedNormalized = normalize(similarMatch.plant_name_normalized ?? stored)
          const computedNormalized = similarMatch.plant_name_normalized ?? (storedNormalized || normalizedName)

          const updatePayload: Record<string, any> = {
            updated_at: new Date().toISOString(),
            plant_name_normalized: computedNormalized || normalizedName
          }

          if (!stored || storedNormalized === stored) {
            updatePayload.plant_name = displayName
          }

          await supabase
            .from('requested_plants')
            .update(updatePayload)
            .eq('id', requestId)
        } else {
          // Create new request
          const { data: newRequest, error: insertError } = await supabase
            .from('requested_plants')
            .insert({
              plant_name: displayName,
              plant_name_normalized: normalizedName,
              requested_by: user.id,
              request_count: 1
            })
            .select('id')
            .single()

          if (insertError) {
            throw new Error(insertError.message)
          }

          if (!newRequest?.id) {
            throw new Error('Failed to create request')
          }

          // Add user to junction table
          const { error: insertUserError } = await supabase
            .from('plant_request_users')
            .insert({
              requested_plant_id: newRequest.id,
              user_id: user.id
            })

          if (insertUserError) {
            throw new Error(insertUserError.message)
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
