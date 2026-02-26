/**
 * AI Prefill Service
 * 
 * Handles the automated AI fill, save, and translate workflow for plant requests.
 * This is used by the "AI Prefill" feature in the Admin panel.
 */

import { supabase } from "@/lib/supabaseClient"
import { fetchAiPlantFill, getEnglishPlantName } from "@/lib/aiPlantFill"
import { fetchExternalPlantImages, uploadPlantImageFromUrl, type SourceResult, type ExternalImageSource } from "@/lib/externalImages"
import { translateBatch } from "@/lib/deepl"
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/lib/i18n"
import { applyAiFieldToPlant } from "@/lib/applyAiField"
import { plantSchema } from "@/lib/plantSchema"
import type { Plant, PlantColor, PlantRecipe, PlantSource, PlantWateringSchedule } from "@/types/plant"
import {
  utilityEnum,
  ediblePartEnum,
  toxicityEnum,
  poisoningMethodEnum,
  lifeCycleEnum,
  averageLifespanEnum,
  foliagePersistenceEnum,
  livingSpaceEnum,
  seasonEnum,
  climateEnum,
  careLevelEnum,
  sunlightEnum,
  wateringTypeEnum,
  divisionEnum,
  sowingMethodEnum,
  conservationStatusEnum,
  ecologicalToleranceEnum,
  ecologicalImpactEnum,
  timePeriodEnum,
  recipeCategoryEnum,
  recipeTimeEnum,
} from "@/lib/composition"

const AI_EXCLUDED_FIELDS = new Set(['name', 'image', 'imageurl', 'image_url', 'imageURL', 'images'])
const IN_PROGRESS_STATUS = 'in_progress' as const

// Helper to check if an error is a cancellation/abort error
function isCancellationError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'AbortError') return true
  if (err instanceof Error && err.name === 'AbortError') return true
  if (err instanceof Error && (
    err.message === 'Operation cancelled' ||
    err.message === 'AI fill was cancelled' ||
    err.message.includes('aborted')
  )) return true
  return false
}

// AI section fill order — matches the 9 sections of the new schema
const aiFieldOrder = [
  'base',
  'identity',
  'care',
  'growth',
  'danger',
  'ecology',
  'consumption',
  'misc',
  'meta',
].filter((key) => !AI_EXCLUDED_FIELDS.has(key) && !AI_EXCLUDED_FIELDS.has(key.toLowerCase()))

function generateUUIDv4(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID()
  } catch {}
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

/**
 * Format plant name to Title Case, stripping non-alphanumeric characters.
 * Only A-Z, a-z, 0-9, and spaces are kept.
 * Examples:
 *   "basil" -> "Basil"
 *   "ARROWHEAD PLANT" -> "Arrowhead Plant"
 *   "spider plant" -> "Spider Plant"
 *   "Begonia 'Silver Maples'" -> "Begonia Silver Maples"
 *   "Rose-of-Sharon" -> "Rose Of Sharon"
 */
function formatPlantName(name: string): string {
  if (!name) return name
  return name
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .split(' ')
    .filter(word => word.length > 0)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .trim()
}

function coerceBoolean(value: unknown, fallback: boolean | null = false): boolean | null {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return fallback
    return value !== 0
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (!normalized) return fallback
    if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true
    if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false
    return fallback
  }
  return fallback
}

function normalizeSchedules(entries?: PlantWateringSchedule[]): PlantWateringSchedule[] {
  if (!entries?.length) return []
  return entries
    .map((entry) => {
      const qty = entry.quantity
      const parsedQuantity = typeof qty === 'string' ? parseInt(qty, 10) : qty
      const season = entry.season && typeof entry.season === 'string' ? entry.season.trim() : undefined
      // Normalize timePeriod to valid DB values: 'week', 'month', 'year', or undefined
      const rawTimePeriod = entry.timePeriod && typeof entry.timePeriod === 'string' ? entry.timePeriod.trim() : undefined
      const normalizedTimePeriod = normalizeTimePeriodSlug(rawTimePeriod) as PlantWateringSchedule['timePeriod'] | undefined
      return {
        ...entry,
        quantity: Number.isFinite(parsedQuantity as number) ? Number(parsedQuantity) : undefined,
        season,
        timePeriod: normalizedTimePeriod || undefined,
      }
    })
    .filter((entry) => entry.season || entry.quantity !== undefined || entry.timePeriod)
}

const normalizeSeasonSlug = (value?: string | null): string | null => {
  if (!value) return null
  const slug = seasonEnum.toDb(value)
  return slug || null
}

const normalizeTimePeriodSlug = (value?: string | null): string | null => {
  if (!value) return null
  const slug = timePeriodEnum.toDb(value)
  return slug || null
}

const mergeContributorNames = (
  existing: Array<string | null | undefined>,
  extras: Array<string | null | undefined>,
): string[] => {
  const combined = [...existing, ...extras]
  const seen = new Set<string>()
  const result: string[] = []
  for (const entry of combined) {
    if (typeof entry !== 'string') continue
    const trimmed = entry.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(trimmed)
  }
  return result
}

async function fetchRequestContributors(requestId: string): Promise<string[]> {
  if (!requestId) return []
  try {
    const { data: requestUsersData, error: usersError } = await supabase
      .from('plant_request_users')
      .select('user_id')
      .eq('requested_plant_id', requestId)
    if (usersError) throw new Error(usersError.message)
    const userIds = new Set(
      (requestUsersData || []).map((row: any) => String(row.user_id)).filter(Boolean),
    )
    if (userIds.size === 0) {
      const { data: requestRow, error: requestError } = await supabase
        .from('requested_plants')
        .select('requested_by')
        .eq('id', requestId)
        .maybeSingle()
      if (requestError) throw new Error(requestError.message)
      if (requestRow?.requested_by) userIds.add(String(requestRow.requested_by))
    }
    if (userIds.size === 0) return []
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, display_name')
      .in('id', Array.from(userIds))
    if (profilesError) throw new Error(profilesError.message)
    const names = (profilesData || [])
      .map((profile: any) => profile?.display_name)
      .filter((name: any) => typeof name === 'string' && name.trim())
      .map((name: string) => name.trim())
    return mergeContributorNames(names, [])
  } catch (err) {
    console.warn('[aiPrefillService] Failed to load request contributors', err)
    return []
  }
}

async function upsertColors(colors: PlantColor[]) {
  if (!colors?.length) return [] as string[]
  const normalized = colors
    .map((c) => {
      const name = c.name && typeof c.name === 'string' ? c.name.trim() : null
      if (!name) return null
      const hex = c.hexCode && typeof c.hexCode === 'string' ? c.hexCode.trim() : null
      return {
        name,
        hex_code: hex && hex.length ? (hex.startsWith("#") ? hex : `#${hex}`) : null,
      }
    })
    .filter((entry): entry is { name: string; hex_code: string | null } => Boolean(entry?.name))
  if (!normalized.length) return [] as string[]
  const deduped = Array.from(
    new Map(normalized.map((entry) => [entry.name.toLowerCase(), entry])).values(),
  )
  const { data, error } = await supabase
    .from('colors')
    .upsert(deduped, { onConflict: 'name' })
    .select('id,name')
  if (error) throw new Error(error.message)
  return (data || []).map((row) => row.id as string)
}

async function linkColors(plantId: string, colorIds: string[]) {
  if (!colorIds.length) return
  await supabase.from('plant_colors').delete().eq('plant_id', plantId)
  const inserts = colorIds.map((id) => ({ plant_id: plantId, color_id: id }))
  const { error } = await supabase.from('plant_colors').insert(inserts)
  if (error) throw new Error(error.message)
}

async function upsertImages(plantId: string, images: Plant["images"]) {
  const list = images && images.length ? images : []
  
  const seenLinks = new Set<string>()
  const filtered = list.filter((img) => {
    // Ensure link is a string before calling trim() - AI might return objects
    if (typeof img.link !== 'string') return false
    const link = img.link.trim()
    if (!link) return false
    const linkLower = link.toLowerCase()
    if (seenLinks.has(linkLower)) return false
    seenLinks.add(linkLower)
    return true
  })
  
  const normalizeUse = (use: unknown): 'primary' | 'discovery' | 'other' => {
    if (typeof use !== 'string') return 'other'
    const lower = use.toLowerCase().trim()
    if (lower === 'primary') return 'primary'
    if (lower === 'discovery') return 'discovery'
    return 'other'
  }
  
  let hasPrimary = false
  let hasDiscovery = false
  
  const normalized = filtered.map((img) => {
    const normalizedUse = normalizeUse(img.use)
    let finalUse: 'primary' | 'discovery' | 'other' = 'other'
    
    if (normalizedUse === 'primary' && !hasPrimary) {
      finalUse = 'primary'
      hasPrimary = true
    } else if (normalizedUse === 'discovery' && !hasDiscovery) {
      finalUse = 'discovery'
      hasDiscovery = true
    } else {
      finalUse = 'other'
    }
    
    return {
      plant_id: plantId,
      link: img.link!.trim(),
      use: finalUse,
    }
  })
  
  if (!hasPrimary && normalized.length > 0) {
    normalized[0] = { ...normalized[0], use: 'primary' }
  }
  
  const { error: deleteError } = await supabase
    .from('plant_images')
    .delete()
    .eq('plant_id', plantId)
  
  if (deleteError) throw { ...deleteError, context: 'images' }
  
  if (!normalized.length) return
  
  const { error: insertError } = await supabase
    .from('plant_images')
    .insert(normalized)
  
  if (insertError) throw { ...insertError, context: 'images' }
}

async function upsertWateringSchedules(plantId: string, schedules: PlantWateringSchedule[] | undefined) {
  await supabase.from('plant_watering_schedules').delete().eq('plant_id', plantId)
  const entries = normalizeSchedules(schedules)
  const rows = entries.map((entry) => {
    // Preserve 'hot' and 'cold' seasons directly; normalize legacy seasons
    const season = entry.season === 'hot' || entry.season === 'cold'
      ? entry.season
      : normalizeSeasonSlug(entry.season)
    return {
      plant_id: plantId,
      season,
      quantity: entry.quantity ?? null,
      // Use normalizeTimePeriodSlug to ensure only valid DB values: 'week', 'month', 'year', or null
      time_period: normalizeTimePeriodSlug(entry.timePeriod) || null,
    }
  })
  if (!rows.length) return
  const { error } = await supabase.from('plant_watering_schedules').insert(rows)
  if (error) throw new Error(error.message)
}

async function upsertSources(plantId: string, sources?: PlantSource[]) {
  await supabase.from('plant_sources').delete().eq('plant_id', plantId)
  if (!sources?.length) return
  const rows = sources
    .filter((s) => s.name && typeof s.name === 'string' && s.name.trim())
    .map((s) => ({ 
      plant_id: plantId, 
      name: String(s.name || '').trim(), 
      url: s.url && typeof s.url === 'string' ? s.url.trim() : null 
    }))
  if (!rows.length) return
  const { error } = await supabase.from('plant_sources').insert(rows)
  if (error) throw new Error(error.message)
}

async function upsertContributors(plantId: string, contributors: string[]) {
  await supabase.from('plant_contributors').delete().eq('plant_id', plantId)
  if (!contributors.length) return
  const rows = contributors
    .filter((name) => typeof name === 'string' && name.trim())
    .map((name) => ({
      plant_id: plantId,
      contributor_name: name.trim(),
    }))
  if (!rows.length) return
  const { error } = await supabase.from('plant_contributors').insert(rows)
  if (error) throw new Error(error.message)
}

async function upsertInfusionMixes(plantId: string, infusionMix?: Record<string, string | undefined>) {
  await supabase.from('plant_infusion_mixes').delete().eq('plant_id', plantId)
  if (!infusionMix) return
  const rows = Object.entries(infusionMix)
    .map(([mix, benefit]) => {
      const trimmedName = mix && typeof mix === 'string' ? mix.trim() : null
      if (!trimmedName) return null
      const trimmedBenefit = benefit && typeof benefit === 'string' ? benefit.trim() : null
      return {
        plant_id: plantId,
        mix_name: trimmedName,
        benefit: trimmedBenefit || null,
      }
    })
    .filter((row): row is { plant_id: string; mix_name: string; benefit: string | null } => Boolean(row))
  if (!rows.length) return
  const { error } = await supabase.from('plant_infusion_mixes').insert(rows)
  if (error) throw new Error(error.message)
}

async function upsertRecipes(plantId: string, recipes?: PlantRecipe[]) {
  await supabase.from('plant_recipes').delete().eq('plant_id', plantId)
  if (!recipes?.length) return
  const rows = recipes
    .map((r) => {
      const trimmedName = r.name && typeof r.name === 'string' ? r.name.trim() : null
      if (!trimmedName) return null
      return {
        plant_id: plantId,
        name: trimmedName,
        name_fr: r.name_fr && typeof r.name_fr === 'string' ? r.name_fr.trim() || null : null,
        category: recipeCategoryEnum.toDb(r.category) || 'other',
        time: recipeTimeEnum.toDb(r.time) || 'undefined',
        link: null, // AI does not fill the link field - admin only
      }
    })
    .filter(Boolean)
  if (!rows.length) return
  const { error } = await supabase.from('plant_recipes').insert(rows)
  if (error) throw new Error(error.message)
}

/** Translate recipe names for all target languages and update plant_recipes rows */
async function translateRecipeNames(plantId: string, targetLanguages: string[]) {
  const { data: recipeRows } = await supabase
    .from('plant_recipes')
    .select('id,name')
    .eq('plant_id', plantId)
  if (!recipeRows?.length) return
  const names = recipeRows.map(r => r.name || '')
  for (const target of targetLanguages) {
    try {
      const translated = await translateBatch(names, target as any, 'en')
      for (let i = 0; i < recipeRows.length; i++) {
        if (translated[i]) {
          await supabase
            .from('plant_recipes')
            .update({ [`name_${target}`]: translated[i] })
            .eq('id', recipeRows[i].id)
        }
      }
    } catch (err) {
      console.warn(`[aiPrefillService] Failed to translate recipe names to ${target}:`, err)
    }
  }
}

export interface AiPrefillCallbacks {
  onProgress?: (info: { stage: 'filling' | 'saving' | 'translating' | 'translating_name' | 'fetching_images' | 'uploading_images'; plantName: string }) => void
  onFieldComplete?: (info: { field: string; fieldsCompleted: number; totalFields: number }) => void
  onFieldStart?: (info: { field: string; fieldsCompleted: number; totalFields: number }) => void
  /** Called when an individual image source starts loading */
  onImageSourceStart?: (source: ExternalImageSource) => void
  /** Called when an individual image source finishes (success, error, or skipped) */
  onImageSourceDone?: (result: SourceResult) => void
  /** Called during image upload to storage with per-image progress */
  onImageUploadProgress?: (info: { current: number; total: number; uploaded: number; failed: number }) => void
  onError?: (error: string) => void
  signal?: AbortSignal
}

/**
 * Process a single plant request with AI fill, save, and translate
 */
export async function processPlantRequest(
  plantName: string,
  requestId: string,
  createdBy: string | undefined,
  callbacks?: AiPrefillCallbacks
): Promise<{ success: boolean; plantId?: string; error?: string; cancelled?: boolean }> {
  const { onProgress, onFieldComplete, onFieldStart, onImageSourceStart, onImageSourceDone, onImageUploadProgress, onError, signal } = callbacks || {}
  
  const totalFields = aiFieldOrder.length
  let fieldsCompleted = 0
  
  // Keep the original plant name for progress tracking (UI consistency)
  const displayName = String(plantName || '').trim()
  
  try {
    // Check if aborted
    if (signal?.aborted) {
      throw new DOMException('Operation cancelled', 'AbortError')
    }
    
    // Stage 0: Get English plant name
    // The plant name might be in any language, so we first ask AI for the English common name
    onProgress?.({ stage: 'translating_name', plantName: displayName })
    
    let englishPlantName = formatPlantName(displayName)
    try {
      const nameResult = await getEnglishPlantName(plantName, signal)
      const rawEnglishName = String(nameResult.englishName || plantName || '').trim()
      englishPlantName = formatPlantName(rawEnglishName)
      if (nameResult.wasTranslated) {
        console.log(`[aiPrefillService] Translated plant name: "${plantName}" -> "${englishPlantName}"`)
      }
    } catch (err) {
      console.warn(`[aiPrefillService] Failed to get English name for "${plantName}", using original:`, err)
      // Continue with original name if translation fails
    }
    
    // Ensure we have a valid plant name
    if (!englishPlantName) {
      throw new Error('Plant name is required')
    }
    
    if (signal?.aborted) {
      throw new DOMException('Operation cancelled', 'AbortError')
    }
    
    // Check if a plant with this English name already exists in the database
    // Check against: name, scientific_name_species, and common_names from plant_translations
    // This prevents creating duplicate plants when the requested name is a common name of an existing plant
    
    // First, check by name or scientific_name in plants table
    const { data: existingByName } = await supabase
      .from('plants')
      .select('id, name, scientific_name_species')
      .or(`name.ilike.${englishPlantName},scientific_name_species.ilike.${englishPlantName}`)
      .limit(1)
      .maybeSingle()
    
    if (existingByName) {
      console.log(`[aiPrefillService] Plant "${englishPlantName}" already exists as "${existingByName.name}" (id: ${existingByName.id}), skipping and marking request as complete`)
      
      // Delete the request since the plant already exists
      const { error: deleteError } = await supabase
        .from('requested_plants')
        .delete()
        .eq('id', requestId)
      
      if (deleteError) {
        console.error('Failed to delete plant request:', deleteError)
      }
      
      return { success: true, plantId: existingByName.id }
    }
    
    // Also check by common_names in plant_translations table
    // Search in English translations for any plant that has this name as a common name
    const searchTermLower = englishPlantName.toLowerCase()
    const { data: translationMatches } = await supabase
      .from('plant_translations')
      .select('plant_id, common_names, plants!inner(id, name)')
      .eq('language', 'en')
      .limit(100)
    
    // Check if any plant has this name as a given_name (common name)
    let existingByCommonName: { id: string; name: string } | null = null
    if (translationMatches) {
      for (const row of translationMatches as any[]) {
        const commonNames = Array.isArray(row?.common_names) ? row.common_names : []
        const matchesGivenName = commonNames.some(
          (gn: unknown) => typeof gn === 'string' && gn.toLowerCase() === searchTermLower
        )
        if (matchesGivenName && row?.plants?.id) {
          existingByCommonName = { id: String(row.plants.id), name: String(row.plants.name || '') }
          break
        }
      }
    }
    
    if (existingByCommonName) {
      console.log(`[aiPrefillService] Plant "${englishPlantName}" already exists as common name for "${existingByCommonName.name}" (id: ${existingByCommonName.id}), skipping and marking request as complete`)
      
      // Delete the request since the plant already exists
      const { error: deleteError } = await supabase
        .from('requested_plants')
        .delete()
        .eq('id', requestId)
      
      if (deleteError) {
        console.error('Failed to delete plant request:', deleteError)
      }
      
      return { success: true, plantId: existingByCommonName.id }
    }
    
    // Stage 1: AI Fill (using English name internally, but display original name)
    onProgress?.({ stage: 'filling', plantName: displayName })
    
    const emptyPlant: Plant = {
      id: generateUUIDv4(),
      name: englishPlantName,
      utility: [],
      ediblePart: [],
      images: [],
      colors: [],
      season: [],
      wateringSchedules: [],
      sources: [],
      status: IN_PROGRESS_STATUS,
    }
    
    let plant: Plant = { ...emptyPlant }
    
    // Run AI Fill (using English name for better AI results)
    // Use continueOnFieldError: true to allow partial fills when some fields fail
    // This prevents a single field timeout from failing the entire plant
    const fieldErrors: Array<{ field: string; error: string }> = []
    const aiData = await fetchAiPlantFill({
      plantName: englishPlantName,
      schema: plantSchema,
      existingData: plant,
      fields: aiFieldOrder,
      language: 'en',
      signal,
      continueOnFieldError: true,
      onProgress: ({ field, completed, total }) => {
        if (field !== 'init' && field !== 'complete') {
          onFieldStart?.({ field, fieldsCompleted: completed, totalFields: total })
        }
      },
      onFieldComplete: ({ field }) => {
        if (field !== 'complete') {
          fieldsCompleted++
          onFieldComplete?.({ field, fieldsCompleted, totalFields })
        }
      },
      onFieldError: ({ field, error }) => {
        console.warn(`[aiPrefillService] Field "${field}" failed for plant "${englishPlantName}": ${error}`)
        fieldErrors.push({ field, error })
      },
    })
    
    if (signal?.aborted) {
      throw new DOMException('Operation cancelled', 'AbortError')
    }
    
    // Log any field errors that occurred during AI fill
    if (fieldErrors.length > 0) {
      console.warn(`[aiPrefillService] ${fieldErrors.length} field(s) failed for "${englishPlantName}":`, 
        fieldErrors.map(e => `${e.field}: ${e.error}`).join(', '))
      
      // If more than half of the fields failed, consider this a critical failure
      const criticalFailureThreshold = Math.ceil(aiFieldOrder.length / 2)
      if (fieldErrors.length >= criticalFailureThreshold) {
        const failedFields = fieldErrors.map(e => e.field).join(', ')
        throw new Error(`Too many fields failed (${fieldErrors.length}/${aiFieldOrder.length}): ${failedFields}`)
      }
    }
    
    // Apply AI data to plant
    if (aiData && typeof aiData === 'object') {
      for (const [fieldKey, data] of Object.entries(aiData as Record<string, unknown>)) {
        plant = applyAiFieldToPlant(plant, fieldKey, data)
      }
    }
    
    // Ensure plant name is always the English name (AI might overwrite or corrupt it)
    plant.name = englishPlantName
    
    // Ensure required fields have defaults (use flat fields)
    plant = {
      ...plant,
      origin: (plant.origin || []).length ? plant.origin : ['Unknown'],
      wateringSchedules: normalizeSchedules(plant.wateringSchedules).length
        ? normalizeSchedules(plant.wateringSchedules)
        : [{ season: undefined, quantity: 1, timePeriod: 'week' as const }],
      sowingMonth: (plant.sowingMonth || []).length ? plant.sowingMonth : ['march'],
      floweringMonth: (plant.floweringMonth || []).length ? plant.floweringMonth : ['june'],
      fruitingMonth: (plant.fruitingMonth || []).length ? plant.fruitingMonth : ['september'],
      status: plant.status || IN_PROGRESS_STATUS,
    }
    
    if (signal?.aborted) {
      throw new DOMException('Operation cancelled', 'AbortError')
    }
    
    // Stage 1.5: Fetch external images from Google (SerpAPI), GBIF & Smithsonian
    onProgress?.({ stage: 'fetching_images', plantName: displayName })
    
    try {
      const externalResult = await fetchExternalPlantImages(englishPlantName, {
        signal,
        callbacks: {
          onSourceStart: onImageSourceStart,
          onSourceDone: onImageSourceDone,
        },
      })
      
      if (externalResult.images.length > 0) {
        // Upload each found image to the PLANTS storage bucket
        onProgress?.({ stage: 'uploading_images', plantName: displayName })
        const totalToUpload = externalResult.images.length
        const uploadedImages: Array<{ link: string; use: 'primary' | 'discovery' | 'other' }> = []
        let failedCount = 0
        onImageUploadProgress?.({ current: 0, total: totalToUpload, uploaded: 0, failed: 0 })

        for (let i = 0; i < externalResult.images.length; i++) {
          if (signal?.aborted) break
          const img = externalResult.images[i]
          onImageUploadProgress?.({ current: i + 1, total: totalToUpload, uploaded: uploadedImages.length, failed: failedCount })
          try {
            const uploaded = await uploadPlantImageFromUrl(img.url, englishPlantName, img.source, signal)
            uploadedImages.push({
              link: uploaded.url,
              use: ((plant.images || []).length === 0 && uploadedImages.length === 0 ? 'primary' : 'other'),
            })
          } catch (uploadErr) {
            if (isCancellationError(uploadErr)) throw uploadErr
            failedCount++
            console.warn(`[aiPrefillService] Failed to upload image from ${img.source} for "${englishPlantName}":`, uploadErr)
          }
        }

        onImageUploadProgress?.({ current: totalToUpload, total: totalToUpload, uploaded: uploadedImages.length, failed: failedCount })
        
        if (uploadedImages.length > 0) {
          plant = {
            ...plant,
            images: [...(plant.images || []), ...uploadedImages],
          }
          console.log(`[aiPrefillService] Uploaded ${uploadedImages.length} images to storage for "${englishPlantName}" (${failedCount} failed)`)
        }
      }
      
      if (externalResult.errors?.length) {
        console.warn(`[aiPrefillService] External image fetch partial errors for "${englishPlantName}":`, externalResult.errors)
      }
    } catch (imgErr) {
      // Don't fail the whole prefill for image fetch errors - just log and continue
      if (isCancellationError(imgErr)) throw imgErr
      console.warn(`[aiPrefillService] External image fetch failed for "${englishPlantName}":`, imgErr)
    }
    
    if (signal?.aborted) {
      throw new DOMException('Operation cancelled', 'AbortError')
    }
    
    // Stage 2: Save Plant
    onProgress?.({ stage: 'saving', plantName: displayName })
    
    const plantId = plant.id
    // Ensure name is a string (AI might return non-string values)
    const trimmedName = String(plant.name || englishPlantName || '').trim()
    
    if (!trimmedName) {
      throw new Error('Plant name is required for saving')
    }
    const normalizedSchedules = normalizeSchedules(plant.wateringSchedules)
    const sources = plant.sources || []
    const primarySource = sources[0]
    
    const normalizedStatus = String(plant.status || 'in_progress').toLowerCase()
    const createdTimeValue = new Date().toISOString()
    const requestContributors = await fetchRequestContributors(requestId)
    const contributors = mergeContributorNames(requestContributors, [createdBy])
    
    // Save base plant record — maps flat Plant fields to snake_case DB columns
    const basePayload = {
      id: plantId,
      name: trimmedName,
      // Section 1: Base
      scientific_name_species: plant.scientificNameSpecies || null,
      scientific_name_variety: plant.scientificNameVariety || null,
      family: plant.family || null,
      featured_month: plant.featuredMonth || [],
      // Section 2: Identity
      climate: climateEnum.toDbArray(plant.climate),
      season: seasonEnum.toDbArray(plant.season),
      utility: utilityEnum.toDbArray(plant.utility),
      edible_part: ediblePartEnum.toDbArray(plant.ediblePart),
      thorny: coerceBoolean(plant.thorny, false),
      toxicity_human: toxicityEnum.toDb(plant.toxicityHuman) || null,
      toxicity_pets: toxicityEnum.toDb(plant.toxicityPets) || null,
      poisoning_method: poisoningMethodEnum.toDbArray(plant.poisoningMethod),
      life_cycle: lifeCycleEnum.toDbArray(plant.lifeCycle),
      average_lifespan: averageLifespanEnum.toDbArray(plant.averageLifespan),
      foliage_persistence: foliagePersistenceEnum.toDbArray(plant.foliagePersistence),
      living_space: livingSpaceEnum.toDbArray(plant.livingSpace),
      landscaping: plant.landscaping || [],
      plant_habit: plant.plantHabit || [],
      multicolor: coerceBoolean(plant.multicolor, false),
      bicolor: coerceBoolean(plant.bicolor, false),
      // Section 3: Care
      care_level: careLevelEnum.toDbArray(plant.careLevel),
      sunlight: sunlightEnum.toDbArray(plant.sunlight),
      temperature_max: plant.temperatureMax || null,
      temperature_min: plant.temperatureMin || null,
      temperature_ideal: plant.temperatureIdeal || null,
      watering_mode: plant.wateringMode || 'always',
      watering_frequency_warm: plant.wateringFrequencyWarm || null,
      watering_frequency_cold: plant.wateringFrequencyCold || null,
      watering_type: wateringTypeEnum.toDbArray(plant.wateringType),
      hygrometry: plant.hygrometry || null,
      misting_frequency: plant.mistingFrequency || null,
      special_needs: plant.specialNeeds || [],
      substrate: plant.substrate || [],
      substrate_mix: plant.substrateMix || [],
      mulching_needed: coerceBoolean(plant.mulchingNeeded, false),
      mulch_type: plant.mulchType || [],
      nutrition_need: plant.nutritionNeed || [],
      fertilizer: plant.fertilizer || [],
      // Section 4: Growth
      sowing_month: plant.sowingMonth || [],
      flowering_month: plant.floweringMonth || [],
      fruiting_month: plant.fruitingMonth || [],
      height_cm: plant.heightCm || null,
      wingspan_cm: plant.wingspanCm || null,
      staking: coerceBoolean(plant.staking, false),
      division: divisionEnum.toDbArray(plant.division),
      cultivation_mode: plant.cultivationMode || [],
      sowing_method: sowingMethodEnum.toDbArray(plant.sowingMethod),
      transplanting: coerceBoolean(plant.transplanting, null),
      pruning: coerceBoolean(plant.pruning, false),
      pruning_month: plant.pruningMonth || [],
      // Section 6: Ecology
      conservation_status: conservationStatusEnum.toDbArray(plant.conservationStatus),
      ecological_status: plant.ecologicalStatus || [],
      biotopes: plant.biotopes || [],
      urban_biotopes: plant.urbanBiotopes || [],
      ecological_tolerance: ecologicalToleranceEnum.toDbArray(plant.ecologicalTolerance),
      biodiversity_role: plant.biodiversityRole || [],
      pollinators_attracted: plant.pollinatorsAttracted || [],
      birds_attracted: plant.birdsAttracted || [],
      mammals_attracted: plant.mammalsAttracted || [],
      ecological_management: plant.ecologicalManagement || [],
      ecological_impact: ecologicalImpactEnum.toDbArray(plant.ecologicalImpact),
      // Section 7: Consumption
      infusion: coerceBoolean(plant.infusion, false),
      infusion_parts: plant.infusionParts || [],
      medicinal: coerceBoolean(plant.medicinal, false),
      aromatherapy: coerceBoolean(plant.aromatherapy, false),
      fragrance: coerceBoolean(plant.fragrance, false),
      edible_oil: plant.edibleOil || null,
      // Section 8: Misc
      companion_plants: plant.companionPlants || [],
      biotope_plants: plant.biotopePlants || [],
      beneficial_plants: plant.beneficialPlants || [],
      harmful_plants: plant.harmfulPlants || [],
      varieties: plant.varieties || [],
      // Section 9: Meta
      status: normalizedStatus,
      admin_commentary: plant.adminCommentary || null,
      user_notes: plant.userNotes || null,
      created_by: createdBy || null,
      created_time: createdTimeValue,
      updated_by: createdBy || null,
      updated_time: createdTimeValue,
    }
    
    const { error: insertError } = await supabase
      .from('plants')
      .upsert(basePayload)
    
    if (insertError) {
      throw new Error(`Failed to save plant: ${insertError.message}`)
    }
    
    if (signal?.aborted) {
      // Clean up - delete the plant we just created
      await supabase.from('plants').delete().eq('id', plantId)
      throw new DOMException('Operation cancelled', 'AbortError')
    }
    
    // Save related data
    const normalizedColors = (plant.colors || []).map(c =>
      typeof c === 'string' ? { name: c } : c
    ) as PlantColor[]
    const colorIds = await upsertColors(normalizedColors)
    await linkColors(plantId, colorIds)
    await upsertImages(plantId, plant.images || [])
    await upsertWateringSchedules(plantId, normalizedSchedules)
    await upsertSources(plantId, sources)
    await upsertContributors(plantId, contributors)
    await upsertInfusionMixes(plantId, plant.infusionMixes)
    await upsertRecipes(plantId, plant.recipes)
    
    // Save English translation — maps flat Plant fields to new snake_case DB columns
    const translationPayload = {
      plant_id: plantId,
      language: 'en' as SupportedLanguage,
      name: trimmedName,
      // Core
      common_names: plant.commonNames || [],
      presentation: plant.presentation || null,
      // Identity
      origin: plant.origin || [],
      allergens: plant.allergens || [],
      poisoning_symptoms: plant.poisoningSymptoms || null,
      // Care
      soil_advice: plant.soilAdvice || null,
      mulch_advice: plant.mulchAdvice || null,
      fertilizer_advice: plant.fertilizerAdvice || null,
      // Growth
      staking_advice: plant.stakingAdvice || null,
      sowing_advice: plant.sowingAdvice || null,
      transplanting_time: plant.transplantingTime || null,
      outdoor_planting_time: plant.outdoorPlantingTime || null,
      pruning_advice: plant.pruningAdvice || null,
      // Danger
      pests: plant.pests || [],
      diseases: plant.diseases || [],
      // Consumption
      nutritional_value: plant.nutritionalValue || null,
      recipes_ideas: (plant.recipes?.length
        ? plant.recipes.map(r => r.name).filter(Boolean)
        : plant.recipesIdeas || []),
      infusion_benefits: plant.infusionBenefits || null,
      infusion_recipe_ideas: plant.infusionRecipeIdeas || null,
      medicinal_benefits: plant.medicinalBenefits || null,
      medicinal_usage: plant.medicinalUsage || null,
      medicinal_warning: plant.medicinalWarning || null,
      medicinal_history: plant.medicinalHistory || null,
      aromatherapy_benefits: plant.aromatherapyBenefits || null,
      essential_oil_blends: plant.essentialOilBlends || null,
      // Ecology
      beneficial_roles: plant.beneficialRoles || [],
      harmful_roles: plant.harmfulRoles || [],
      symbiosis: plant.symbiosis || [],
      symbiosis_notes: plant.symbiosisNotes || null,
      // Misc
      plant_tags: plant.plantTags || [],
      biodiversity_tags: plant.biodiversityTags || [],
      source_name: primarySource?.name || null,
      source_url: primarySource?.url || null,
      user_notes: plant.userNotes || null,
      // Deprecated
      spice_mixes: plant.spiceMixes || [],
    }
    
    const { error: translationError } = await supabase
      .from('plant_translations')
      .upsert(translationPayload, { onConflict: 'plant_id,language' })
    
    if (translationError) {
      throw new Error(`Failed to save translation: ${translationError.message}`)
    }
    
    if (signal?.aborted) {
      // Clean up - delete the plant and translation
      await supabase.from('plant_translations').delete().eq('plant_id', plantId)
      await supabase.from('plants').delete().eq('id', plantId)
      throw new DOMException('Operation cancelled', 'AbortError')
    }
    
    // Stage 3: Translate to other languages (sequentially to avoid rate limiting)
    onProgress?.({ stage: 'translating', plantName: displayName })
    
    const targetLanguages = SUPPORTED_LANGUAGES.filter((lang) => lang !== 'en')
    
    // Process languages sequentially with delays to avoid DeepL rate limits
    const translatedRows: Array<Record<string, unknown>> = []
    const INTER_LANGUAGE_DELAY_MS = 500 // Delay between languages to spread DeepL requests
    
    for (const target of targetLanguages) {
      if (signal?.aborted) {
        throw new DOMException('Operation cancelled', 'AbortError')
      }
      
      try {
        // Collect all single-string fields for batch translation
        // This allows translating all strings in 1 API call instead of 10+
        const stringFields: Array<{ key: string; value: string }> = []
        const addStringField = (key: string, value?: string | null) => {
          if (value && typeof value === 'string' && value.trim()) {
            stringFields.push({ key, value: value.trim() })
          }
        }
        
        addStringField('name', String(plant.name || trimmedName || ''))
        addStringField('sourceName', primarySource?.name ? String(primarySource.name) : undefined)
        addStringField('presentation', plant.presentation)
        addStringField('poisoning_symptoms', plant.poisoningSymptoms)
        addStringField('soil_advice', plant.soilAdvice)
        addStringField('mulch_advice', plant.mulchAdvice)
        addStringField('fertilizer_advice', plant.fertilizerAdvice)
        addStringField('staking_advice', plant.stakingAdvice)
        addStringField('sowing_advice', plant.sowingAdvice)
        addStringField('transplanting_time', plant.transplantingTime)
        addStringField('outdoor_planting_time', plant.outdoorPlantingTime)
        addStringField('pruning_advice', plant.pruningAdvice)
        addStringField('nutritional_value', plant.nutritionalValue)
        addStringField('infusion_benefits', plant.infusionBenefits)
        addStringField('infusion_recipe_ideas', plant.infusionRecipeIdeas)
        addStringField('medicinal_benefits', plant.medicinalBenefits)
        addStringField('medicinal_usage', plant.medicinalUsage)
        addStringField('medicinal_warning', plant.medicinalWarning)
        addStringField('medicinal_history', plant.medicinalHistory)
        addStringField('aromatherapy_benefits', plant.aromatherapyBenefits)
        addStringField('essential_oil_blends', plant.essentialOilBlends)
        addStringField('symbiosis_notes', plant.symbiosisNotes)
        
        // Batch translate all single-string fields in one API call
        const stringTexts = stringFields.map(f => f.value)
        const translatedStrings = stringTexts.length > 0 
          ? await translateBatch(stringTexts, target, 'en')
          : []
        
        // Build lookup map for translated strings
        const stringMap = new Map<string, string>()
        stringFields.forEach((field, i) => {
          stringMap.set(field.key, translatedStrings[i] || field.value)
        })
        
        if (signal?.aborted) {
          throw new DOMException('Operation cancelled', 'AbortError')
        }
        
        // Small delay between string batch and array batch to avoid DeepL rate limits
        if (stringTexts.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 300))
        }
        
        // Collect all array fields for batch translation  
        // Flatten all arrays into one big batch, then split results back
        const arrayFields: Array<{ key: string; items: string[] }> = []
        const addArrayField = (key: string, arr?: string[]) => {
          const items = (arr || []).map(s => String(s || '')).filter(s => s.trim())
          if (items.length > 0) {
            arrayFields.push({ key, items })
          }
        }
        
        addArrayField('common_names', plant.commonNames)
        addArrayField('allergens', plant.allergens)
        addArrayField('origin', plant.origin)
        addArrayField('recipes_ideas', plant.recipes?.length
          ? plant.recipes.map(r => r.name).filter(Boolean)
          : plant.recipesIdeas)
        addArrayField('plant_tags', plant.plantTags)
        addArrayField('biodiversity_tags', plant.biodiversityTags)
        addArrayField('beneficial_roles', plant.beneficialRoles)
        addArrayField('harmful_roles', plant.harmfulRoles)
        addArrayField('symbiosis', plant.symbiosis)
        addArrayField('spice_mixes', plant.spiceMixes)
        addArrayField('pests', plant.pests)
        addArrayField('diseases', plant.diseases)
        
        // Flatten all array items into one batch
        const allArrayItems: string[] = []
        const arrayOffsets: Array<{ key: string; start: number; count: number }> = []
        for (const field of arrayFields) {
          arrayOffsets.push({ key: field.key, start: allArrayItems.length, count: field.items.length })
          allArrayItems.push(...field.items)
        }
        
        // Translate all array items in one batch call (or split into chunks of 50)
        const translatedArrayItems: string[] = []
        if (allArrayItems.length > 0) {
          const BATCH_SIZE = 50
          for (let i = 0; i < allArrayItems.length; i += BATCH_SIZE) {
            if (signal?.aborted) {
              throw new DOMException('Operation cancelled', 'AbortError')
            }
            const chunk = allArrayItems.slice(i, i + BATCH_SIZE)
            const translated = await translateBatch(chunk, target, 'en')
            translatedArrayItems.push(...translated)
            // Small delay between array batch chunks to avoid DeepL rate limits
            if (i + BATCH_SIZE < allArrayItems.length) {
              await new Promise(resolve => setTimeout(resolve, 300))
            }
          }
        }
        
        // Split translated items back into their respective arrays
        const arrayMap = new Map<string, string[]>()
        for (const offset of arrayOffsets) {
          arrayMap.set(offset.key, translatedArrayItems.slice(offset.start, offset.start + offset.count))
        }
        
        translatedRows.push({
          plant_id: plantId,
          language: target,
          name: stringMap.get('name') || trimmedName,
          common_names: arrayMap.get('common_names') || [],
          presentation: stringMap.get('presentation') || null,
          origin: arrayMap.get('origin') || [],
          allergens: arrayMap.get('allergens') || [],
          poisoning_symptoms: stringMap.get('poisoning_symptoms') || null,
          soil_advice: stringMap.get('soil_advice') || null,
          mulch_advice: stringMap.get('mulch_advice') || null,
          fertilizer_advice: stringMap.get('fertilizer_advice') || null,
          staking_advice: stringMap.get('staking_advice') || null,
          sowing_advice: stringMap.get('sowing_advice') || null,
          transplanting_time: stringMap.get('transplanting_time') || null,
          outdoor_planting_time: stringMap.get('outdoor_planting_time') || null,
          pruning_advice: stringMap.get('pruning_advice') || null,
          pests: arrayMap.get('pests') || [],
          diseases: arrayMap.get('diseases') || [],
          nutritional_value: stringMap.get('nutritional_value') || null,
          recipes_ideas: arrayMap.get('recipes_ideas') || [],
          infusion_benefits: stringMap.get('infusion_benefits') || null,
          infusion_recipe_ideas: stringMap.get('infusion_recipe_ideas') || null,
          medicinal_benefits: stringMap.get('medicinal_benefits') || null,
          medicinal_usage: stringMap.get('medicinal_usage') || null,
          medicinal_warning: stringMap.get('medicinal_warning') || null,
          medicinal_history: stringMap.get('medicinal_history') || null,
          aromatherapy_benefits: stringMap.get('aromatherapy_benefits') || null,
          essential_oil_blends: stringMap.get('essential_oil_blends') || null,
          beneficial_roles: arrayMap.get('beneficial_roles') || [],
          harmful_roles: arrayMap.get('harmful_roles') || [],
          symbiosis: arrayMap.get('symbiosis') || [],
          symbiosis_notes: stringMap.get('symbiosis_notes') || null,
          plant_tags: arrayMap.get('plant_tags') || [],
          biodiversity_tags: arrayMap.get('biodiversity_tags') || [],
          source_name: stringMap.get('sourceName') || null,
          source_url: primarySource?.url ? String(primarySource.url) : null,
          spice_mixes: arrayMap.get('spice_mixes') || [],
        })
      } catch (err) {
        // If translation for one language fails, log and continue with others
        if (isCancellationError(err)) throw err
        console.error(`[aiPrefillService] Translation to ${target} failed for "${englishPlantName}":`, err)
      }
      
      // Delay between languages to spread DeepL API requests and avoid rate limits
      await new Promise(resolve => setTimeout(resolve, INTER_LANGUAGE_DELAY_MS))
    }
    
    if (signal?.aborted) {
      // Clean up
      await supabase.from('plant_translations').delete().eq('plant_id', plantId)
      await supabase.from('plants').delete().eq('id', plantId)
      throw new DOMException('Operation cancelled', 'AbortError')
    }
    
    if (translatedRows.length) {
      const { error: translateError } = await supabase
        .from('plant_translations')
        .upsert(translatedRows, { onConflict: 'plant_id,language' })
      
      if (translateError) {
        console.error('Failed to save translations:', translateError)
        // Don't fail the whole operation for translation errors
      }
    }
    
    // Translate recipe names to other languages
    if (!signal?.aborted) {
      try {
        await translateRecipeNames(plantId, targetLanguages)
      } catch (err) {
        if (isCancellationError(err)) throw err
        console.warn('[aiPrefillService] Recipe name translation failed:', err)
      }
    }
    
    if (signal?.aborted) {
      // Clean up everything
      await supabase.from('plant_translations').delete().eq('plant_id', plantId)
      await supabase.from('plants').delete().eq('id', plantId)
      throw new DOMException('Operation cancelled', 'AbortError')
    }
    
    // Notify users who requested this plant (before deleting the request)
    try {
      const session = (await supabase.auth.getSession()).data.session
      const notifyHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
      if (session?.access_token) notifyHeaders['Authorization'] = `Bearer ${session.access_token}`
      const resp = await fetch('/api/admin/notify-plant-requesters', {
        method: 'POST',
        headers: notifyHeaders,
        credentials: 'same-origin',
        body: JSON.stringify({ requestId, plantName: trimmedName, plantId }),
      })
      if (resp.ok) {
        const notifyResult = await resp.json()
        if (notifyResult.notified) {
          console.log(`[aiPrefillService] Notified ${notifyResult.queued} users about "${trimmedName}"`)
        } else {
          console.log(`[aiPrefillService] Skipped notifications for "${trimmedName}": ${notifyResult.reason}`)
        }
      } else {
        console.warn(`[aiPrefillService] Failed to notify plant requesters: ${resp.status}`)
      }
    } catch (notifyErr) {
      // Don't fail the plant creation if notifications fail
      console.warn('[aiPrefillService] Error sending plant request notifications:', notifyErr)
    }
    
    // Mark the request as complete (delete it)
    const { error: deleteError } = await supabase
      .from('requested_plants')
      .delete()
      .eq('id', requestId)
    
    if (deleteError) {
      console.error('Failed to delete plant request:', deleteError)
      // Don't fail - the plant was created successfully
    }
    
    return { success: true, plantId }
    
  } catch (error) {
    // Don't report cancellation errors as failures - they're intentional
    if (isCancellationError(error)) {
      return { success: false, cancelled: true }
    }
    const message = error instanceof Error ? error.message : String(error)
    onError?.(message)
    return { success: false, error: message }
  }
}

/**
 * Process all plant requests with AI fill, save, and translate
 * Plants are processed one at a time, but fields within each plant are filled in parallel
 */
export async function processAllPlantRequests(
  requests: Array<{ id: string; plant_name: string }>,
  createdBy: string | undefined,
  callbacks?: AiPrefillCallbacks & {
    onPlantProgress?: (info: { current: number; total: number; plantName: string }) => void
    onPlantComplete?: (info: { plantName: string; requestId: string; success: boolean; error?: string }) => void
  }
): Promise<{ processed: number; failed: number; cancelled: boolean }> {
  const { onPlantProgress, onPlantComplete, signal } = callbacks || {}
  
  let processed = 0
  let failed = 0
  
  // Process plants one at a time (fields within each plant are parallelized)
  for (let i = 0; i < requests.length; i++) {
    if (signal?.aborted) {
      return { processed, failed, cancelled: true }
    }
    
    const request = requests[i]
    onPlantProgress?.({ current: i + 1, total: requests.length, plantName: request.plant_name })
    
    const result = await processPlantRequest(
      request.plant_name,
      request.id,
      createdBy,
      callbacks
    )
    
    // If the operation was cancelled, stop processing and don't count as failure
    if (result.cancelled) {
      return { processed, failed, cancelled: true }
    }
    
    if (result.success) {
      processed++
    } else {
      failed++
    }
    
    // Only call onPlantComplete if not cancelled (cancellation is handled by the caller)
    onPlantComplete?.({
      plantName: request.plant_name,
      requestId: request.id,
      success: result.success,
      error: result.error,
    })
  }
  
  return { processed, failed, cancelled: false }
}
