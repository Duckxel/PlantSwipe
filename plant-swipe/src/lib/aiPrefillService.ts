/**
 * AI Prefill Service
 * 
 * Handles the automated AI fill, save, and translate workflow for plant requests.
 * This is used by the "AI Prefill" feature in the Admin panel.
 */

import { supabase } from "@/lib/supabaseClient"
import { fetchAiPlantFill, getEnglishPlantName } from "@/lib/aiPlantFill"
import { translateText, translateArray, translateBatch } from "@/lib/deepl"
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/lib/i18n"
import { applyAiFieldToPlant } from "@/lib/applyAiField"
import { plantSchema } from "@/lib/plantSchema"
import type { Plant, PlantColor, PlantMeta, PlantSource, PlantWateringSchedule } from "@/types/plant"
import {
  normalizeCompositionForDb,
  normalizeFoliagePersistanceForDb,
  plantTypeEnum,
  utilityEnum,
  comestiblePartEnum,
  fruitTypeEnum,
  seasonEnum,
  lifeCycleEnum,
  livingSpaceEnum,
  maintenanceLevelEnum,
  toxicityEnum,
  habitatEnum,
  levelSunEnum,
  wateringTypeEnum,
  divisionEnum,
  soilEnum,
  mulchingEnum,
  nutritionNeedEnum,
  fertilizerEnum,
  sowTypeEnum,
  polenizerEnum,
  conservationStatusEnum,
  timePeriodEnum,
} from "@/lib/composition"
import { monthNumberToSlug, monthNumbersToSlugs } from "@/lib/months"

const IN_PROGRESS_STATUS: PlantMeta['status'] = 'In Progres'
const AI_EXCLUDED_FIELDS = new Set(['name', 'image', 'imageurl', 'image_url', 'imageURL', 'images', 'meta'])

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

// AI field order for consistent filling
const aiFieldOrder = [
  'plantType',
  'utility',
  'comestiblePart',
  'fruitType',
  'seasons',
  'description',
  'identity',
  'plantCare',
  'growth',
  'usage',
  'ecology',
  'danger',
  'miscellaneous',
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
 * Format plant name to Title Case
 * Examples:
 *   "basil" -> "Basil"
 *   "ARROWHEAD PLANT" -> "Arrowhead Plant"
 *   "spider plant" -> "Spider Plant"
 */
function formatPlantName(name: string): string {
  if (!name) return name
  return name
    .toLowerCase()
    .split(' ')
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

async function upsertWateringSchedules(plantId: string, schedules: Plant["plantCare"] | undefined) {
  await supabase.from('plant_watering_schedules').delete().eq('plant_id', plantId)
  const entries = normalizeSchedules(schedules?.watering?.schedules)
  const rows = entries.map((entry) => ({
    plant_id: plantId,
    season: normalizeSeasonSlug(entry.season),
    quantity: entry.quantity ?? null,
    // Use normalizeTimePeriodSlug to ensure only valid DB values: 'week', 'month', 'year', or null
    time_period: normalizeTimePeriodSlug(entry.timePeriod) || null,
  }))
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

export interface AiPrefillCallbacks {
  onProgress?: (info: { stage: 'filling' | 'saving' | 'translating' | 'translating_name'; plantName: string }) => void
  onFieldComplete?: (info: { field: string; fieldsCompleted: number; totalFields: number }) => void
  onFieldStart?: (info: { field: string; fieldsCompleted: number; totalFields: number }) => void
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
  const { onProgress, onFieldComplete, onFieldStart, onError, signal } = callbacks || {}
  
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
    // Check against: name, scientific_name, and common names (given_names from plant_translations)
    // This prevents creating duplicate plants when the requested name is a common name of an existing plant
    
    // First, check by name or scientific_name in plants table
    const { data: existingByName } = await supabase
      .from('plants')
      .select('id, name, scientific_name')
      .or(`name.ilike.${englishPlantName},scientific_name.ilike.${englishPlantName}`)
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
    
    // Also check by given_names (common names) in plant_translations table
    // Search in English translations for any plant that has this name as a common name
    const searchTermLower = englishPlantName.toLowerCase()
    const { data: translationMatches } = await supabase
      .from('plant_translations')
      .select('plant_id, given_names, plants!inner(id, name)')
      .eq('language', 'en')
      .limit(100)
    
    // Check if any plant has this name as a given_name (common name)
    let existingByCommonName: { id: string; name: string } | null = null
    if (translationMatches) {
      for (const row of translationMatches as any[]) {
        const givenNames = Array.isArray(row?.given_names) ? row.given_names : []
        const matchesGivenName = givenNames.some(
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
      comestiblePart: [],
      fruitType: [],
      images: [],
      identity: { givenNames: [], colors: [], multicolor: false, bicolor: false },
      plantCare: { watering: { schedules: [] } },
      growth: {},
      usage: {},
      ecology: {},
      danger: {},
      miscellaneous: { sources: [] },
      meta: { status: IN_PROGRESS_STATUS },
      seasons: [],
      colors: [],
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
    
    // Ensure required fields have defaults
    plant = {
      ...plant,
      plantCare: {
        ...(plant.plantCare || {}),
        origin: (plant.plantCare?.origin || []).length ? plant.plantCare?.origin : ['Unknown'],
        watering: {
          ...(plant.plantCare?.watering || {}),
          schedules: normalizeSchedules(plant.plantCare?.watering?.schedules).length
            ? normalizeSchedules(plant.plantCare?.watering?.schedules)
            : [{ season: undefined, quantity: 1, timePeriod: 'week' as const }],
        },
      },
      growth: {
        ...(plant.growth || {}),
        sowingMonth: (plant.growth?.sowingMonth || []).length ? plant.growth?.sowingMonth : [3],
        floweringMonth: (plant.growth?.floweringMonth || []).length ? plant.growth?.floweringMonth : [6],
        fruitingMonth: (plant.growth?.fruitingMonth || []).length ? plant.growth?.fruitingMonth : [9],
      },
      meta: { ...(plant.meta || {}), status: IN_PROGRESS_STATUS },
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
    const normalizedSchedules = normalizeSchedules(plant.plantCare?.watering?.schedules)
    const sources = plant.miscellaneous?.sources || []
    const primarySource = sources[0]
    
    // Normalize enums
    let normalizedPlantType = plantTypeEnum.toDb(plant.plantType)
    if (normalizedPlantType === null && plant.plantType && typeof plant.plantType === 'string' && plant.plantType.trim()) {
      normalizedPlantType = 'plant'
    }
    
    const normalizedStatus = String(plant.meta?.status || IN_PROGRESS_STATUS).toLowerCase()
    const createdTimeValue = new Date().toISOString()
    const requestContributors = await fetchRequestContributors(requestId)
    const contributors = mergeContributorNames(requestContributors, [createdBy])
    
    // Save base plant record
    const basePayload = {
      id: plantId,
      name: trimmedName,
      scientific_name: plant.identity?.scientificName || null,
      promotion_month: monthNumberToSlug(plant.identity?.promotionMonth),
      plant_type: normalizedPlantType || null,
      utility: utilityEnum.toDbArray(plant.utility),
      comestible_part: comestiblePartEnum.toDbArray(plant.comestiblePart),
      fruit_type: fruitTypeEnum.toDbArray(plant.fruitType),
      family: plant.identity?.family || null,
      life_cycle: lifeCycleEnum.toDb(plant.identity?.lifeCycle) || null,
      season: seasonEnum.toDbArray(plant.identity?.season),
      foliage_persistance: normalizeFoliagePersistanceForDb(plant.identity?.foliagePersistance),
      spiked: coerceBoolean(plant.identity?.spiked, false),
      toxicity_human: toxicityEnum.toDb(plant.identity?.toxicityHuman) || null,
      toxicity_pets: toxicityEnum.toDb(plant.identity?.toxicityPets) || null,
      scent: coerceBoolean(plant.identity?.scent, false),
      living_space: livingSpaceEnum.toDb(plant.identity?.livingSpace) || null,
      composition: normalizeCompositionForDb(plant.identity?.composition),
      maintenance_level: maintenanceLevelEnum.toDb(plant.identity?.maintenanceLevel) || null,
      multicolor: coerceBoolean(plant.identity?.multicolor, false),
      bicolor: coerceBoolean(plant.identity?.bicolor, false),
      temperature_max: plant.plantCare?.temperatureMax || null,
      temperature_min: plant.plantCare?.temperatureMin || null,
      temperature_ideal: plant.plantCare?.temperatureIdeal || null,
      hygrometry: plant.plantCare?.hygrometry || null,
      level_sun: levelSunEnum.toDb(plant.plantCare?.levelSun) || null,
      habitat: habitatEnum.toDbArray(plant.plantCare?.habitat),
      watering_type: wateringTypeEnum.toDbArray(plant.plantCare?.wateringType),
      division: divisionEnum.toDbArray(plant.plantCare?.division),
      soil: soilEnum.toDbArray(plant.plantCare?.soil),
      mulching: mulchingEnum.toDbArray(plant.plantCare?.mulching),
      nutrition_need: nutritionNeedEnum.toDbArray(plant.plantCare?.nutritionNeed),
      fertilizer: fertilizerEnum.toDbArray(plant.plantCare?.fertilizer),
      sowing_month: monthNumbersToSlugs(plant.growth?.sowingMonth),
      flowering_month: monthNumbersToSlugs(plant.growth?.floweringMonth),
      fruiting_month: monthNumbersToSlugs(plant.growth?.fruitingMonth),
      height_cm: plant.growth?.height || null,
      wingspan_cm: plant.growth?.wingspan || null,
      tutoring: coerceBoolean(plant.growth?.tutoring, false),
      sow_type: sowTypeEnum.toDbArray(plant.growth?.sowType),
      separation_cm: plant.growth?.separation || null,
      transplanting: coerceBoolean(plant.growth?.transplanting, null),
      infusion: coerceBoolean(plant.usage?.infusion, false),
      aromatherapy: coerceBoolean(plant.usage?.aromatherapy, false),
      // spice_mixes moved to plant_translations (translatable)
      melliferous: coerceBoolean(plant.ecology?.melliferous, false),
      polenizer: polenizerEnum.toDbArray(plant.ecology?.polenizer),
      be_fertilizer: coerceBoolean(plant.ecology?.beFertilizer, false),
      conservation_status: conservationStatusEnum.toDb(plant.ecology?.conservationStatus) || null,
      // pests and diseases moved to plant_translations (translatable)
      companions: plant.miscellaneous?.companions || [],
      status: normalizedStatus,
      admin_commentary: plant.meta?.adminCommentary || null,
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
    const colorIds = await upsertColors(plant.identity?.colors || [])
    await linkColors(plantId, colorIds)
    await upsertImages(plantId, plant.images || [])
    await upsertWateringSchedules(plantId, {
      ...(plant.plantCare || {}),
      watering: { ...(plant.plantCare?.watering || {}), schedules: normalizedSchedules },
    })
    await upsertSources(plantId, sources)
    await upsertContributors(plantId, contributors)
    await upsertInfusionMixes(plantId, plant.usage?.infusionMix)
    
    // Save English translation
    const translationPayload = {
      plant_id: plantId,
      language: 'en' as SupportedLanguage,
      name: trimmedName,
      given_names: plant.identity?.givenNames || [],
      overview: plant.identity?.overview || null,
      allergens: plant.identity?.allergens || [],
      symbolism: plant.identity?.symbolism || [],
      origin: plant.plantCare?.origin || [],
      advice_soil: plant.plantCare?.adviceSoil || null,
      advice_mulching: plant.plantCare?.adviceMulching || null,
      advice_fertilizer: plant.plantCare?.adviceFertilizer || null,
      advice_tutoring: plant.growth?.adviceTutoring || null,
      advice_sowing: plant.growth?.adviceSowing || null,
      cut: plant.growth?.cut || null,
      advice_medicinal: plant.usage?.adviceMedicinal || null,
      nutritional_intake: plant.usage?.nutritionalIntake || [],
      recipes_ideas: plant.usage?.recipesIdeas || [],
      advice_infusion: plant.usage?.adviceInfusion || null,
      ground_effect: plant.ecology?.groundEffect || null,
      source_name: primarySource?.name || null,
      source_url: primarySource?.url || null,
      tags: plant.miscellaneous?.tags || [],
      // Translatable array fields
      spice_mixes: plant.usage?.spiceMixes || [],
      pests: plant.danger?.pests || [],
      diseases: plant.danger?.diseases || [],
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
    
    // Process languages sequentially to avoid overwhelming the translation API
    const translatedRows: Array<Record<string, unknown>> = []
    
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
        addStringField('overview', plant.identity?.overview)
        addStringField('advice_soil', plant.plantCare?.adviceSoil)
        addStringField('advice_mulching', plant.plantCare?.adviceMulching)
        addStringField('advice_fertilizer', plant.plantCare?.adviceFertilizer)
        addStringField('advice_tutoring', plant.growth?.adviceTutoring)
        addStringField('advice_sowing', plant.growth?.adviceSowing)
        addStringField('cut', plant.growth?.cut)
        addStringField('advice_medicinal', plant.usage?.adviceMedicinal)
        addStringField('advice_infusion', plant.usage?.adviceInfusion)
        addStringField('ground_effect', plant.ecology?.groundEffect)
        
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
        
        // Collect all array fields for batch translation  
        // Flatten all arrays into one big batch, then split results back
        const arrayFields: Array<{ key: string; items: string[] }> = []
        const addArrayField = (key: string, arr?: string[]) => {
          const items = (arr || []).map(s => String(s || '')).filter(s => s.trim())
          if (items.length > 0) {
            arrayFields.push({ key, items })
          }
        }
        
        addArrayField('given_names', plant.identity?.givenNames)
        addArrayField('allergens', plant.identity?.allergens)
        addArrayField('symbolism', plant.identity?.symbolism)
        addArrayField('origin', plant.plantCare?.origin)
        addArrayField('nutritional_intake', plant.usage?.nutritionalIntake)
        addArrayField('recipes_ideas', plant.usage?.recipesIdeas)
        addArrayField('tags', plant.miscellaneous?.tags)
        addArrayField('spice_mixes', plant.usage?.spiceMixes)
        addArrayField('pests', plant.danger?.pests)
        addArrayField('diseases', plant.danger?.diseases)
        
        // Flatten all array items into one batch
        const allArrayItems: string[] = []
        const arrayOffsets: Array<{ key: string; start: number; count: number }> = []
        for (const field of arrayFields) {
          arrayOffsets.push({ key: field.key, start: allArrayItems.length, count: field.items.length })
          allArrayItems.push(...field.items)
        }
        
        // Translate all array items in one batch call (or split into chunks of 50)
        let translatedArrayItems: string[] = []
        if (allArrayItems.length > 0) {
          const BATCH_SIZE = 50
          for (let i = 0; i < allArrayItems.length; i += BATCH_SIZE) {
            if (signal?.aborted) {
              throw new DOMException('Operation cancelled', 'AbortError')
            }
            const chunk = allArrayItems.slice(i, i + BATCH_SIZE)
            const translated = await translateBatch(chunk, target, 'en')
            translatedArrayItems.push(...translated)
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
          given_names: arrayMap.get('given_names') || [],
          overview: stringMap.get('overview') || null,
          allergens: arrayMap.get('allergens') || [],
          symbolism: arrayMap.get('symbolism') || [],
          origin: arrayMap.get('origin') || [],
          advice_soil: stringMap.get('advice_soil') || null,
          advice_mulching: stringMap.get('advice_mulching') || null,
          advice_fertilizer: stringMap.get('advice_fertilizer') || null,
          advice_tutoring: stringMap.get('advice_tutoring') || null,
          advice_sowing: stringMap.get('advice_sowing') || null,
          cut: stringMap.get('cut') || null,
          advice_medicinal: stringMap.get('advice_medicinal') || null,
          nutritional_intake: arrayMap.get('nutritional_intake') || [],
          recipes_ideas: arrayMap.get('recipes_ideas') || [],
          advice_infusion: stringMap.get('advice_infusion') || null,
          ground_effect: stringMap.get('ground_effect') || null,
          source_name: stringMap.get('sourceName') || null,
          source_url: primarySource?.url ? String(primarySource.url) : null,
          tags: arrayMap.get('tags') || [],
          spice_mixes: arrayMap.get('spice_mixes') || [],
          pests: arrayMap.get('pests') || [],
          diseases: arrayMap.get('diseases') || [],
        })
      } catch (err) {
        // If translation for one language fails, log and continue with others
        if (isCancellationError(err)) throw err
        console.error(`[aiPrefillService] Translation to ${target} failed for "${englishPlantName}":`, err)
      }
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
    
    if (signal?.aborted) {
      // Clean up everything
      await supabase.from('plant_translations').delete().eq('plant_id', plantId)
      await supabase.from('plants').delete().eq('id', plantId)
      throw new DOMException('Operation cancelled', 'AbortError')
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
