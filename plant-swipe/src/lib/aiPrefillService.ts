/**
 * AI Prefill Service
 * 
 * Handles the automated AI fill, save, and translate workflow for plant requests.
 * This is used by the "AI Prefill" feature in the Admin panel.
 */

import { supabase } from "@/lib/supabaseClient"
import { fetchAiPlantFill, getEnglishPlantName } from "@/lib/aiPlantFill"
import { translateText, translateArray } from "@/lib/deepl"
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
} from "@/lib/composition"
import { monthNumberToSlug, monthNumbersToSlugs } from "@/lib/months"

const IN_PROGRESS_STATUS: PlantMeta['status'] = 'In Progres'
const AI_EXCLUDED_FIELDS = new Set(['name', 'image', 'imageurl', 'image_url', 'imageURL', 'images', 'meta'])

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
      return {
        ...entry,
        quantity: Number.isFinite(parsedQuantity as number) ? Number(parsedQuantity) : undefined,
        season: entry.season?.trim() || undefined,
      }
    })
    .filter((entry) => entry.season || entry.quantity !== undefined || entry.timePeriod)
}

const normalizeSeasonSlug = (value?: string | null): string | null => {
  if (!value) return null
  const slug = seasonEnum.toDb(value)
  return slug || null
}

async function upsertColors(colors: PlantColor[]) {
  if (!colors?.length) return [] as string[]
  const normalized = colors
    .map((c) => {
      const name = c.name?.trim()
      if (!name) return null
      const hex = c.hexCode?.trim()
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
    const link = img.link?.trim()
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
    time_period: entry.timePeriod || null,
  }))
  if (!rows.length) return
  const { error } = await supabase.from('plant_watering_schedules').insert(rows)
  if (error) throw new Error(error.message)
}

async function upsertSources(plantId: string, sources?: PlantSource[]) {
  await supabase.from('plant_sources').delete().eq('plant_id', plantId)
  if (!sources?.length) return
  const rows = sources
    .filter((s) => s.name?.trim())
    .map((s) => ({ plant_id: plantId, name: s.name.trim(), url: s.url?.trim() || null }))
  if (!rows.length) return
  const { error } = await supabase.from('plant_sources').insert(rows)
  if (error) throw new Error(error.message)
}

async function upsertInfusionMixes(plantId: string, infusionMix?: Record<string, string | undefined>) {
  await supabase.from('plant_infusion_mixes').delete().eq('plant_id', plantId)
  if (!infusionMix) return
  const rows = Object.entries(infusionMix)
    .map(([mix, benefit]) => {
      const trimmedName = mix?.trim()
      if (!trimmedName) return null
      const trimmedBenefit = benefit?.trim()
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
): Promise<{ success: boolean; plantId?: string; error?: string }> {
  const { onProgress, onFieldComplete, onFieldStart, onError, signal } = callbacks || {}
  
  const totalFields = aiFieldOrder.length
  let fieldsCompleted = 0
  
  try {
    // Check if aborted
    if (signal?.aborted) {
      throw new Error('Operation cancelled')
    }
    
    // Stage 0: Get English plant name
    // The plant name might be in any language, so we first ask AI for the English common name
    onProgress?.({ stage: 'translating_name', plantName })
    
    let englishPlantName = plantName
    try {
      const nameResult = await getEnglishPlantName(plantName, signal)
      englishPlantName = nameResult.englishName
      if (nameResult.wasTranslated) {
        console.log(`[aiPrefillService] Translated plant name: "${plantName}" -> "${englishPlantName}"`)
      }
    } catch (err) {
      console.warn(`[aiPrefillService] Failed to get English name for "${plantName}", using original:`, err)
      // Continue with original name if translation fails
    }
    
    if (signal?.aborted) {
      throw new Error('Operation cancelled')
    }
    
    // Stage 1: AI Fill (using English name)
    onProgress?.({ stage: 'filling', plantName: englishPlantName })
    
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
    const aiData = await fetchAiPlantFill({
      plantName: englishPlantName,
      schema: plantSchema,
      existingData: plant,
      fields: aiFieldOrder,
      language: 'en',
      signal,
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
    })
    
    if (signal?.aborted) {
      throw new Error('Operation cancelled')
    }
    
    // Apply AI data to plant
    if (aiData && typeof aiData === 'object') {
      for (const [fieldKey, data] of Object.entries(aiData as Record<string, unknown>)) {
        plant = applyAiFieldToPlant(plant, fieldKey, data)
      }
    }
    
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
      throw new Error('Operation cancelled')
    }
    
    // Stage 2: Save Plant
    onProgress?.({ stage: 'saving', plantName })
    
    const plantId = plant.id
    const trimmedName = plant.name.trim()
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
      spice_mixes: plant.usage?.spiceMixes || [],
      melliferous: coerceBoolean(plant.ecology?.melliferous, false),
      polenizer: polenizerEnum.toDbArray(plant.ecology?.polenizer),
      be_fertilizer: coerceBoolean(plant.ecology?.beFertilizer, false),
      conservation_status: conservationStatusEnum.toDb(plant.ecology?.conservationStatus) || null,
      pests: plant.danger?.pests || [],
      diseases: plant.danger?.diseases || [],
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
      throw new Error('Operation cancelled')
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
      throw new Error('Operation cancelled')
    }
    
    // Stage 3: Translate to other languages
    onProgress?.({ stage: 'translating', plantName })
    
    const targetLanguages = SUPPORTED_LANGUAGES.filter((lang) => lang !== 'en')
    const translatedRows = []
    
    for (const target of targetLanguages) {
      if (signal?.aborted) {
        // Clean up
        await supabase.from('plant_translations').delete().eq('plant_id', plantId)
        await supabase.from('plants').delete().eq('id', plantId)
        throw new Error('Operation cancelled')
      }
      
      const translatedName = await translateText(plant.name || '', target, 'en')
      const translatedGivenNames = await translateArray(plant.identity?.givenNames || [], target, 'en')
      const translateArraySafe = (arr?: string[]) => translateArray(arr || [], target, 'en')
      const translatedSourceName = primarySource?.name
        ? await translateText(primarySource.name, target, 'en')
        : undefined
      
      translatedRows.push({
        plant_id: plantId,
        language: target,
        name: translatedName,
        given_names: translatedGivenNames,
        overview: plant.identity?.overview
          ? await translateText(plant.identity.overview, target, 'en')
          : plant.identity?.overview || null,
        allergens: await translateArraySafe(plant.identity?.allergens),
        symbolism: await translateArraySafe(plant.identity?.symbolism),
        origin: await translateArraySafe(plant.plantCare?.origin),
        advice_soil: plant.plantCare?.adviceSoil
          ? await translateText(plant.plantCare.adviceSoil, target, 'en')
          : plant.plantCare?.adviceSoil || null,
        advice_mulching: plant.plantCare?.adviceMulching
          ? await translateText(plant.plantCare.adviceMulching, target, 'en')
          : plant.plantCare?.adviceMulching || null,
        advice_fertilizer: plant.plantCare?.adviceFertilizer
          ? await translateText(plant.plantCare.adviceFertilizer, target, 'en')
          : plant.plantCare?.adviceFertilizer || null,
        advice_tutoring: plant.growth?.adviceTutoring
          ? await translateText(plant.growth.adviceTutoring, target, 'en')
          : plant.growth?.adviceTutoring || null,
        advice_sowing: plant.growth?.adviceSowing
          ? await translateText(plant.growth.adviceSowing, target, 'en')
          : plant.growth?.adviceSowing || null,
        cut: plant.growth?.cut
          ? await translateText(plant.growth.cut, target, 'en')
          : plant.growth?.cut || null,
        advice_medicinal: plant.usage?.adviceMedicinal
          ? await translateText(plant.usage.adviceMedicinal, target, 'en')
          : plant.usage?.adviceMedicinal || null,
        nutritional_intake: await translateArraySafe(plant.usage?.nutritionalIntake),
        recipes_ideas: await translateArraySafe(plant.usage?.recipesIdeas),
        advice_infusion: plant.usage?.adviceInfusion
          ? await translateText(plant.usage.adviceInfusion, target, 'en')
          : plant.usage?.adviceInfusion || null,
        ground_effect: plant.ecology?.groundEffect
          ? await translateText(plant.ecology.groundEffect, target, 'en')
          : plant.ecology?.groundEffect || null,
        source_name: translatedSourceName || null,
        source_url: primarySource?.url || null,
        tags: await translateArraySafe(plant.miscellaneous?.tags),
      })
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
      throw new Error('Operation cancelled')
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
    const message = error instanceof Error ? error.message : String(error)
    onError?.(message)
    return { success: false, error: message }
  }
}

/**
 * Process all plant requests with AI fill, save, and translate
 */
export async function processAllPlantRequests(
  requests: Array<{ id: string; plant_name: string }>,
  createdBy: string | undefined,
  callbacks?: AiPrefillCallbacks & {
    onPlantProgress?: (info: { current: number; total: number; plantName: string }) => void
    onPlantComplete?: (info: { plantName: string; success: boolean; error?: string }) => void
  }
): Promise<{ processed: number; failed: number; cancelled: boolean }> {
  const { onPlantProgress, onPlantComplete, signal } = callbacks || {}
  
  let processed = 0
  let failed = 0
  
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
    
    if (result.success) {
      processed++
    } else {
      failed++
    }
    
    onPlantComplete?.({
      plantName: request.plant_name,
      success: result.success,
      error: result.error,
    })
  }
  
  return { processed, failed, cancelled: false }
}
