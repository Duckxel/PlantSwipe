import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, ArrowLeft, ArrowUpRight, Check, Copy, ImagePlus, Loader2, Sparkles, Leaf } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { PlantProfileForm } from "@/components/plant/PlantProfileForm"
import { fetchAiPlantFill, fetchAiPlantFillField, getEnglishPlantName } from "@/lib/aiPlantFill"
import { fetchExternalPlantImages, uploadPlantImageFromUrl, deletePlantImage, isManagedPlantImageUrl, IMAGE_SOURCES, type SourceResult, type ExternalImageSource } from "@/lib/externalImages"
import type { Plant, PlantColor, PlantImage, PlantMeta, PlantRecipe, PlantSource, PlantWateringSchedule } from "@/types/plant"
import { useAuth } from "@/context/AuthContext"
import { useTranslation } from "react-i18next"
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/lib/i18n"
import { useLanguageNavigate, useLanguage } from "@/lib/i18nRouting"
import { useNavigationHistory } from "@/hooks/useNavigationHistory"
import { applyAiFieldToPlant, getCategoryForField } from "@/lib/applyAiField"
import { translateArray, translateText } from "@/lib/deepl"
import { buildCategoryProgress, createEmptyCategoryProgress, plantFormCategoryOrder, type CategoryProgress, type PlantFormCategory } from "@/lib/plantFormCategories"
import { useParams, useSearchParams } from "react-router-dom"
import { plantSchema } from "@/lib/plantSchema"
import { monthNumberToSlug, monthNumbersToSlugs, monthSlugToNumber, monthSlugsToNumbers } from "@/lib/months"
import {
  expandCompositionFromDb,
  normalizeCompositionForDb,
  expandFoliagePersistanceFromDb,
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
  recipeCategoryEnum,
  recipeTimeEnum,
} from "@/lib/composition"

type IdentityComposition = NonNullable<Plant["identity"]>["composition"]
type PlantCareData = NonNullable<Plant["plantCare"]>
type PlantGrowthData = NonNullable<Plant["growth"]>
type PlantEcologyData = NonNullable<Plant["ecology"]>

const AI_EXCLUDED_FIELDS = new Set(['name', 'image', 'imageurl', 'image_url', 'imageURL', 'images', 'meta'])
const IN_PROGRESS_STATUS: PlantMeta['status'] = 'In Progres'
const SECTION_LOG_LIMIT = 12
const OPTIONAL_FIELD_EXCEPTIONS = new Set<string>()

const formatStatusForUi = (value?: string | null): PlantMeta['status'] => {
  const map: Record<string, PlantMeta['status']> = {
    'in progres': 'In Progres',
    rework: 'Rework',
    review: 'Review',
    approved: 'Approved',
  }
  if (!value) return IN_PROGRESS_STATUS
  const lower = value.toLowerCase()
  return map[lower] || IN_PROGRESS_STATUS
}

const getFieldValueForKey = (plant: Plant, fieldKey: string): unknown => {
  switch (fieldKey) {
    case 'plantType':
      return plant.plantType
    case 'utility':
      return plant.utility
    case 'comestiblePart':
      return plant.comestiblePart
    case 'fruitType':
      return plant.fruitType
    case 'images':
      return plant.images
    case 'identity':
      return plant.identity
    case 'plantCare':
      return plant.plantCare
    case 'growth':
      return plant.growth
    case 'usage':
      return plant.usage
    case 'ecology':
      return plant.ecology
    case 'danger':
      return plant.danger
    case 'miscellaneous':
      return plant.miscellaneous
    case 'meta':
      return plant.meta
    case 'seasons':
      return plant.seasons
    case 'description':
      return plant.description
    default:
      return (plant as any)[fieldKey]
  }
}

const hasMeaningfulContent = (value: unknown): boolean => {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (typeof value === 'number') return true
  if (typeof value === 'boolean') return value === true
  if (Array.isArray(value)) return value.some((entry) => hasMeaningfulContent(entry))
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some((entry) => hasMeaningfulContent(entry))
  }
  return false
}

const requiresFieldCompletion = (fieldKey: string) => !OPTIONAL_FIELD_EXCEPTIONS.has(fieldKey)

const isFieldMissingForPlant = (plant: Plant, fieldKey: string): boolean => {
  if (!requiresFieldCompletion(fieldKey)) return false
  return !hasMeaningfulContent(getFieldValueForKey(plant, fieldKey))
}

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

// Parse Supabase errors and return user-friendly messages
function parseSupabaseError(error: any, context?: string): string {
  if (!error) return 'Unknown error occurred'
  
  const message = error.message || error.details || String(error)
  const code = error.code || ''
  const errorContext = error.context || context
  
  // Handle common constraint violations
  if (message.includes('plants_name_unique') || (message.includes('duplicate key') && message.includes('name') && !message.includes('scientific'))) {
    return 'A plant with this name already exists. Please choose a different name.'
  }
  
  if (message.includes('plants_scientific_name_unique') || (message.includes('duplicate key') && message.includes('scientific_name'))) {
    return 'A plant with this scientific name already exists. Please enter a different scientific name or leave it empty.'
  }
  
  if (message.includes('plant_translations_plant_id_fkey') || (message.includes('foreign key') && message.includes('plant_translations'))) {
    return 'Unable to save translations because the plant does not exist yet. Please try saving again.'
  }
  
  if (message.includes('plant_images_link_key')) {
    // This is the OLD global constraint - means the database schema hasn't been migrated
    return 'Database schema needs migration. The image URL constraint is outdated. Please contact support or run database migrations.'
  }
  
  if (message.includes('plant_images_plant_link_unique') || (message.includes('duplicate key') && message.includes('link') && message.includes('plant_images'))) {
    return 'An image with this URL already exists for this plant. Each image URL must be unique within a plant. Please check for duplicate image URLs.'
  }
  
  if (message.includes('plant_images_use_unique')) {
    // This should not happen with proper normalization - log for debugging
    console.error('[parseSupabaseError] plant_images_use_unique violation - this indicates a bug in image normalization')
    return 'Image save conflict detected. Please try saving again. If the problem persists, try removing and re-adding the images.'
  }
  
  // Handle 409 conflicts
  if (code === '23505' || message.includes('unique constraint') || message.includes('duplicate key')) {
    if (errorContext === 'plant') {
      return 'A plant with these details already exists. Please check the name and other unique fields.'
    }
    if (errorContext === 'translation') {
      return 'Unable to save translation. Please try saving again.'
    }
    if (errorContext === 'images') {
      return 'An image conflict occurred. Please check for duplicate image URLs.'
    }
    return `A record with these details already exists. ${context || 'Please modify the conflicting field.'}`
  }
  
  // Handle FK violations
  if (code === '23503' || message.includes('foreign key')) {
    if (errorContext === 'translation') {
      return 'Unable to save translations because the plant does not exist yet. Please try saving again.'
    }
    return 'A referenced record does not exist. Please ensure all related data is saved first.'
  }
  
  // Handle check constraint violations
  if (code === '23514' || message.includes('check constraint') || message.includes('violates check constraint')) {
    if (message.includes('plant_type')) {
      return 'Invalid plant type. Please select a valid plant type (plant, flower, bamboo, shrub, tree, cactus, or succulent).'
    }
    if (message.includes('utility')) {
      return 'Invalid utility value. Please check the selected utility options.'
    }
    if (message.includes('life_cycle')) {
      return 'Invalid life cycle. Please select a valid life cycle option.'
    }
    if (message.includes('conservation_status')) {
      return 'Invalid conservation status. Please select a valid conservation status.'
    }
    return 'Invalid field value. Please check the entered data matches the expected format.'
  }
  
  // Handle network/timeout errors
  if (message.includes('network') || message.includes('timeout') || message.includes('ERR_CONNECTION')) {
    return 'Network error. Please check your connection and try again.'
  }
  
  // Return original message if no specific handling
  return message
}

// Generate a unique plant name by appending a number suffix if the name already exists
async function generateUniquePlantName(baseName: string): Promise<string> {
  // First, check if the base name with "(Copy)" suffix exists
  const copyName = `${baseName} (Copy)`
  
  // Get all plants that might conflict (case-insensitive)
  const { data: existingPlants } = await supabase
    .from('plants')
    .select('name')
    .or(`name.ilike.${copyName},name.ilike.${baseName} (Copy %)`)
  
  console.log('[generateUniquePlantName] Checking for:', { baseName, copyName, existingPlants })
  
  // Check if exact copy name exists (case-insensitive)
  const copyNameLower = copyName.toLowerCase()
  const copyExists = (existingPlants || []).some(
    (p) => p.name.toLowerCase() === copyNameLower
  )
  
  if (!copyExists) {
    console.log('[generateUniquePlantName] Returning:', copyName)
    return copyName
  }
  
  // Find all used numbers
  const usedNumbers = new Set<number>([1])
  const copyRegex = new RegExp(`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\(Copy(?: (\\d+))?\\)$`, 'i')
  
  for (const row of existingPlants || []) {
    const match = row.name?.match(copyRegex)
    if (match) {
      const num = match[1] ? parseInt(match[1], 10) : 1
      if (!Number.isNaN(num)) usedNumbers.add(num)
    }
  }
  
  // Find next available number
  let nextNum = 2
  while (usedNumbers.has(nextNum)) {
    nextNum++
  }
  
  const result = `${baseName} (Copy ${nextNum})`
  console.log('[generateUniquePlantName] Returning:', result)
  return result
}

const emptyPlant: Plant = {
  id: generateUUIDv4(),
  name: "",
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
  meta: { contributors: [] },
  seasons: [],
  colors: [],
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

function normalizeSchedules(entries?: PlantWateringSchedule[]): PlantWateringSchedule[] {
  if (!entries?.length) return []
  return entries
    .map((entry) => {
      const qty = entry.quantity
      const parsedQuantity = typeof qty === 'string' ? parseInt(qty, 10) : qty
      // Normalize timePeriod to valid DB values: 'week', 'month', 'year', or undefined
      const rawTimePeriod = entry.timePeriod && typeof entry.timePeriod === 'string' ? entry.timePeriod.trim() : undefined
      const normalizedTimePeriod = normalizeTimePeriodSlug(rawTimePeriod) as PlantWateringSchedule['timePeriod'] | undefined
      return {
        ...entry,
        quantity: Number.isFinite(parsedQuantity as number) ? Number(parsedQuantity) : undefined,
        season: entry.season && typeof entry.season === 'string' ? entry.season.trim() : undefined,
        timePeriod: normalizedTimePeriod || undefined,
      }
    })
    .filter((entry) => entry.season || entry.quantity !== undefined || entry.timePeriod)
}

const mergeContributors = (
  existing: unknown,
  extras: Array<string | null | undefined> = [],
): string[] => {
  const base = Array.isArray(existing) ? existing : []
  const combined = [...base, ...extras]
  const seen = new Set<string>()
  const result: string[] = []
  for (const entry of combined) {
    if (typeof entry !== "string") continue
    const trimmed = entry.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(trimmed)
  }
  return result
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
  
  console.log('[upsertImages] Input images:', list.map(img => ({ link: img.link?.slice(0, 50), use: img.use })))
  
  // Build final insert list with strict enforcement of 1 primary, 1 discovery, unlimited other
  const seenLinks = new Set<string>()
  
  // First pass: filter and deduplicate by normalized link (case-insensitive, trimmed)
  const filtered = list.filter((img) => {
    const link = img.link && typeof img.link === 'string' ? img.link.trim() : null
    if (!link) return false
    const linkLower = link.toLowerCase()
    if (seenLinks.has(linkLower)) {
      console.log('[upsertImages] Skipping duplicate link:', link.slice(0, 50))
      return false
    }
    seenLinks.add(linkLower)
    return true
  })
  
  // Second pass: normalize use values - ensure EXACTLY 1 primary, at most 1 discovery
  // Normalize use value to lowercase and valid values only
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
  
  // If no primary was set and we have images, set the first one as primary
  if (!hasPrimary && normalized.length > 0) {
    normalized[0] = { ...normalized[0], use: 'primary' }
    hasPrimary = true
  }
  
  console.log('[upsertImages] Normalized for save:', normalized.map(img => ({ link: img.link?.slice(0, 50), use: img.use })))
  
  // Final verification: ensure only 1 primary and 1 discovery
  const primaryCount = normalized.filter(i => i.use === 'primary').length
  const discoveryCount = normalized.filter(i => i.use === 'discovery').length
  console.log('[upsertImages] Final counts - primary:', primaryCount, 'discovery:', discoveryCount, 'total:', normalized.length)
  
  if (primaryCount > 1 || discoveryCount > 1) {
    console.error('[upsertImages] ERROR: Multiple primary or discovery images detected after normalization!')
  }
  
  // Delete ALL existing images for this plant first, then insert fresh
  // This is more reliable than upsert when dealing with use changes
  const { error: deleteError } = await supabase
    .from('plant_images')
    .delete()
    .eq('plant_id', plantId)
  
  if (deleteError) {
    console.error('[upsertImages] Delete error:', deleteError)
    throw { ...deleteError, context: 'images' }
  }
  
  // If no images to insert, we're done (just deleted all)
  if (!normalized.length) {
    console.log('[upsertImages] No images to save, deleted all existing')
    return
  }
  
  console.log('[upsertImages] Deleted existing images, now inserting', normalized.length, 'images')
  
  // Insert all images fresh
  const { error: insertError } = await supabase
    .from('plant_images')
    .insert(normalized)
  
  if (insertError) {
    console.error('[upsertImages] Insert error:', insertError)
    console.error('[upsertImages] Attempted to insert:', JSON.stringify(normalized, null, 2))
    
    // Check if it's a duplicate key error - provide more context
    if (insertError.message?.includes('duplicate') || insertError.code === '23505') {
      // Find which URL(s) are causing the conflict
      const duplicateUrls: string[] = []
      for (const img of normalized) {
        const { data: existing } = await supabase
          .from('plant_images')
          .select('plant_id, link')
          .eq('link', img.link)
          .neq('plant_id', plantId)
          .limit(1)
        if (existing && existing.length > 0) {
          duplicateUrls.push(img.link.slice(0, 80))
        }
      }
      if (duplicateUrls.length > 0) {
        console.error('[upsertImages] URLs that exist on other plants:', duplicateUrls)
        throw {
          ...insertError,
          context: 'images',
          message: `Image URL(s) already used by another plant: ${duplicateUrls.join(', ')}. This may indicate a database schema issue - please contact support.`
        }
      }
    }
    
    throw { ...insertError, context: 'images' }
  }
  
  console.log('[upsertImages] Successfully saved', normalized.length, 'images')
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
      name: String(s.name).trim(), 
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

function mapInfusionMixRows(rows?: Array<{ mix_name?: string | null; benefit?: string | null }> | null) {
  const result: Record<string, string> = {}
  if (!rows) return result
  for (const row of rows) {
    const key = row?.mix_name && typeof row.mix_name === 'string' ? row.mix_name.trim() : null
    if (!key) continue
    const value = row?.benefit && typeof row.benefit === 'string' ? row.benefit.trim() : null
    result[key] = value || ''
  }
  return result
}

async function fetchInfusionMixes(plantId: string) {
  const { data, error } = await supabase.from('plant_infusion_mixes').select('mix_name,benefit').eq('plant_id', plantId)
  if (error) throw new Error(error.message)
  return mapInfusionMixRows(data || [])
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
        category: recipeCategoryEnum.toDb(r.category) || 'other',
        time: recipeTimeEnum.toDb(r.time) || 'undefined',
      }
    })
    .filter((row): row is { plant_id: string; name: string; category: string; time: string } => Boolean(row))
  if (!rows.length) return
  const { error } = await supabase.from('plant_recipes').insert(rows)
  if (error) throw new Error(error.message)
}

// Sync bidirectional companion relationships
// When plant A adds plant B as companion, plant B should also have plant A
// When plant A removes plant B as companion, plant B should also remove plant A
async function syncBidirectionalCompanions(
  plantId: string, 
  newCompanions: string[], 
  oldCompanions: string[]
): Promise<void> {
  // Find added and removed companions
  const added = newCompanions.filter(id => !oldCompanions.includes(id) && id !== plantId)
  const removed = oldCompanions.filter(id => !newCompanions.includes(id) && id !== plantId)
  
  // For each newly added companion, add this plant to their companions list
  for (const companionId of added) {
    try {
      const { data: companionData } = await supabase
        .from('plants')
        .select('companions')
        .eq('id', companionId)
        .maybeSingle()
      
      if (companionData) {
        const currentCompanions: string[] = companionData.companions || []
        if (!currentCompanions.includes(plantId)) {
          const updatedCompanions = [...currentCompanions, plantId]
          await supabase
            .from('plants')
            .update({ companions: updatedCompanions })
            .eq('id', companionId)
          console.log(`[syncBidirectionalCompanions] Added ${plantId} to ${companionId}'s companions`)
        }
      }
    } catch (e) {
      console.error(`[syncBidirectionalCompanions] Failed to add to companion ${companionId}:`, e)
    }
  }
  
  // For each removed companion, remove this plant from their companions list
  for (const companionId of removed) {
    try {
      const { data: companionData } = await supabase
        .from('plants')
        .select('companions')
        .eq('id', companionId)
        .maybeSingle()
      
      if (companionData) {
        const currentCompanions: string[] = companionData.companions || []
        if (currentCompanions.includes(plantId)) {
          const updatedCompanions = currentCompanions.filter(id => id !== plantId)
          await supabase
            .from('plants')
            .update({ companions: updatedCompanions })
            .eq('id', companionId)
          console.log(`[syncBidirectionalCompanions] Removed ${plantId} from ${companionId}'s companions`)
        }
      }
    } catch (e) {
      console.error(`[syncBidirectionalCompanions] Failed to remove from companion ${companionId}:`, e)
    }
  }
}

async function loadPlant(id: string, language?: string): Promise<Plant | null> {
  const { data, error } = await supabase.from('plants').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  
  // All translatable fields are stored in plant_translations for ALL languages (including English)
  // The plants table contains only non-translatable base data
  const targetLanguage = language || 'en'
  let translation: any = null
  
  // Always load translation for the requested language
  const { data: translationData } = await supabase
    .from('plant_translations')
    .select('*')
    .eq('plant_id', id)
    .eq('language', targetLanguage)
    .maybeSingle()
  translation = translationData || null
  
  const { data: colorLinks } = await supabase.from('plant_colors').select('color_id, colors:color_id (id,name,hex_code)').eq('plant_id', id)
  const { data: images } = await supabase.from('plant_images').select('id,link,use').eq('plant_id', id)
  const { data: schedules } = await supabase.from('plant_watering_schedules').select('season,quantity,time_period').eq('plant_id', id)
  const { data: sources } = await supabase.from('plant_sources').select('id,name,url').eq('plant_id', id)
  const { data: contributorRows } = await supabase
    .from('plant_contributors')
    .select('contributor_name')
    .eq('plant_id', id)
  const { data: recipeRows } = await supabase
    .from('plant_recipes')
    .select('id,name,category,time')
    .eq('plant_id', id)
  const infusionMix = await fetchInfusionMixes(id)
  const colors = (colorLinks || []).map((c: any) => ({ id: c.colors?.id, name: c.colors?.name, hexCode: c.colors?.hex_code }))
  const sourceList = (sources || []).map((s) => ({ id: s.id, name: s.name, url: s.url }))
  if (!sourceList.length && ((translation?.source_name || data.source_name) || (translation?.source_url || data.source_url))) {
    sourceList.push({
      id: `${data.id}-legacy-source`,
      name: translation?.source_name || data.source_name || 'Source',
      url: translation?.source_url || data.source_url || undefined,
    })
  }
  
  // All translatable fields come from plant_translations ONLY (plants table no longer has them)
  // Use translation data or empty defaults
  const plantName = translation?.name || data.name
  
  const plant: Plant = {
      id: data.id,
      name: plantName,
      // Non-translatable fields from plants table
      plantType: (plantTypeEnum.toUi(data.plant_type) as Plant["plantType"]) || undefined,
      utility: utilityEnum.toUiArray(data.utility) as Plant["utility"],
      comestiblePart: comestiblePartEnum.toUiArray(data.comestible_part) as Plant["comestiblePart"],
      fruitType: fruitTypeEnum.toUiArray(data.fruit_type) as Plant["fruitType"],
    identity: {
      // Translatable fields from plant_translations only
      givenNames: translation?.given_names || [],
      // Non-translatable fields from plants table
      scientificName: data.scientific_name || undefined,
      family: data.family || undefined,
      // Translatable field from plant_translations
      overview: translation?.overview || undefined,
      // Non-translatable fields from plants table (enums)
      promotionMonth: monthSlugToNumber(data.promotion_month) ?? undefined,
      lifeCycle: (lifeCycleEnum.toUi(data.life_cycle) as NonNullable<Plant["identity"]>["lifeCycle"]) || undefined,
      season: seasonEnum.toUiArray(data.season) as NonNullable<Plant["identity"]>["season"],
      foliagePersistance: expandFoliagePersistanceFromDb(data.foliage_persistance),
      spiked: data.spiked || false,
      toxicityHuman: (toxicityEnum.toUi(data.toxicity_human) as NonNullable<Plant["identity"]>["toxicityHuman"]) || undefined,
      toxicityPets: (toxicityEnum.toUi(data.toxicity_pets) as NonNullable<Plant["identity"]>["toxicityPets"]) || undefined,
      // Translatable fields from plant_translations only
      allergens: translation?.allergens || [],
      // Non-translatable fields from plants table
      scent: data.scent || false,
      // Translatable fields from plant_translations only
      symbolism: translation?.symbolism || [],
      // Non-translatable fields from plants table (enums)
      livingSpace: (livingSpaceEnum.toUi(data.living_space) as NonNullable<Plant["identity"]>["livingSpace"]) || undefined,
      composition: expandCompositionFromDb(data.composition) as IdentityComposition,
      maintenanceLevel: (maintenanceLevelEnum.toUi(data.maintenance_level) as NonNullable<Plant["identity"]>["maintenanceLevel"]) || undefined,
      multicolor: data.multicolor || false,
      bicolor: data.bicolor || false,
      colors,
    },
    plantCare: {
      // Translatable fields from plant_translations only
      origin: translation?.origin || [],
      // Non-translatable fields from plants table
      habitat: habitatEnum.toUiArray(data.habitat) as PlantCareData["habitat"],
      temperatureMax: data.temperature_max || undefined,
      temperatureMin: data.temperature_min || undefined,
      temperatureIdeal: data.temperature_ideal || undefined,
      // Non-translatable field from plants table
      levelSun: (levelSunEnum.toUi(data.level_sun) as PlantCareData["levelSun"]) || undefined,
      hygrometry: data.hygrometry || undefined,
      wateringType: wateringTypeEnum.toUiArray(data.watering_type) as PlantCareData["wateringType"],
      division: divisionEnum.toUiArray(data.division) as PlantCareData["division"],
      soil: soilEnum.toUiArray(data.soil) as PlantCareData["soil"],
      // Translatable fields from plant_translations only
      adviceSoil: translation?.advice_soil || undefined,
      // Non-translatable fields from plants table
      mulching: mulchingEnum.toUiArray(data.mulching) as unknown as PlantCareData["mulching"],
      // Translatable fields from plant_translations only
      adviceMulching: translation?.advice_mulching || undefined,
      // Non-translatable fields from plants table
      nutritionNeed: nutritionNeedEnum.toUiArray(data.nutrition_need) as PlantCareData["nutritionNeed"],
      fertilizer: fertilizerEnum.toUiArray(data.fertilizer) as PlantCareData["fertilizer"],
      // Translatable fields from plant_translations only
      adviceFertilizer: translation?.advice_fertilizer || undefined,
      watering: {
        schedules: normalizeSchedules(
          (schedules || []).map((row: any) => ({
            season: row.season || undefined,
            quantity: row.quantity ?? undefined,
            timePeriod: row.time_period || undefined,
          })),
        ),
      },
    },
    growth: {
      // Non-translatable fields from plants table
      sowingMonth: monthSlugsToNumbers(data.sowing_month),
      floweringMonth: monthSlugsToNumbers(data.flowering_month),
      fruitingMonth: monthSlugsToNumbers(data.fruiting_month),
      height: data.height_cm || undefined,
      wingspan: data.wingspan_cm || undefined,
      tutoring: data.tutoring || false,
      // Translatable fields from plant_translations only
      adviceTutoring: translation?.advice_tutoring || undefined,
      // Non-translatable fields from plants table
      sowType: sowTypeEnum.toUiArray(data.sow_type) as PlantGrowthData["sowType"],
      separation: data.separation_cm || undefined,
      transplanting: data.transplanting || undefined,
      // Translatable fields from plant_translations only
      adviceSowing: translation?.advice_sowing || undefined,
      cut: translation?.cut || undefined,
    },
    usage: {
      // Translatable fields from plant_translations only
      adviceMedicinal: translation?.advice_medicinal || undefined,
      nutritionalIntake: translation?.nutritional_intake || [],
      // Non-translatable fields from plants table
      infusion: data.infusion || false,
      // Translatable fields from plant_translations only
      adviceInfusion: translation?.advice_infusion || undefined,
      infusionMix,
      recipesIdeas: translation?.recipes_ideas || [],
      // Structured recipes from plant_recipes table
      recipes: (recipeRows || []).map((r: any) => ({
        id: r.id,
        name: r.name || '',
        category: recipeCategoryEnum.toUi(r.category) || 'Other',
        time: recipeTimeEnum.toUi(r.time) || 'Undefined',
      })) as PlantRecipe[],
      // Non-translatable fields from plants table
      aromatherapy: data.aromatherapy || false,
      // Translatable field from plant_translations only
      spiceMixes: translation?.spice_mixes || [],
    },
    ecology: {
      // Non-translatable fields from plants table
      melliferous: data.melliferous || false,
      polenizer: polenizerEnum.toUiArray(data.polenizer) as PlantEcologyData["polenizer"],
      beFertilizer: data.be_fertilizer || false,
      // Translatable fields from plant_translations only
      groundEffect: translation?.ground_effect || undefined,
      // Non-translatable fields from plants table
      conservationStatus: (conservationStatusEnum.toUi(data.conservation_status) as PlantEcologyData["conservationStatus"]) || undefined,
    },
    danger: { 
      // Translatable fields from plant_translations only
      pests: translation?.pests || [], 
      diseases: translation?.diseases || [] 
    },
    miscellaneous: {
      companions: data.companions || [],
      // Translatable fields from plant_translations only
      tags: translation?.tags || [],
      sources: sourceList,
    },
    meta: {
      status: formatStatusForUi(data.status),
      adminCommentary: data.admin_commentary || undefined,
      contributors: (contributorRows || [])
        .map((row: any) => row?.contributor_name)
        .filter((name: any) => typeof name === 'string' && name.trim()),
      createdBy: data.created_by || undefined,
      createdAt: data.created_time || undefined,
      updatedBy: data.updated_by || undefined,
      updatedAt: data.updated_time || undefined,
    },
    multicolor: data.multicolor || false,
    bicolor: data.bicolor || false,
    // Translatable fields from plant_translations only
    seasons: seasonEnum.toUiArray(translation?.season) as Plant["seasons"],
    description: translation?.overview || undefined,
    images: (images as PlantImage[]) || [],
  }
  if (colors.length || data.multicolor || data.bicolor) plant.identity = { ...(plant.identity || {}), colors, multicolor: data.multicolor, bicolor: data.bicolor }
  return plant
}

export const CreatePlantPage: React.FC<{ onCancel: () => void; onSaved?: (id: string) => void; initialName?: string }> = ({ onCancel, onSaved, initialName }) => {
  const { t } = useTranslation('common')
  const { id } = useParams<{ id?: string }>()
  const [searchParams] = useSearchParams()
  const prefillFromId = searchParams.get('prefillFrom')
  const duplicatedFromName = searchParams.get('duplicatedFrom')
  const requestId = searchParams.get('requestId')
  // Support initial name from query parameter (e.g., /create?name=Rose) or from prop
  const initialNameFromUrl = searchParams.get('name')
  const effectiveInitialName = initialName || initialNameFromUrl || ""
  const languageNavigate = useLanguageNavigate()
  const { navigateBack } = useNavigationHistory('/search')
  const { profile } = useAuth()
  // Get the language from the URL path (e.g., /fr/admin/plants/create -> 'fr')
  const urlLanguage = useLanguage()
  const [language, setLanguage] = React.useState<SupportedLanguage>(urlLanguage)
  const languageRef = React.useRef<SupportedLanguage>(urlLanguage)
  const [plant, setPlant] = React.useState<Plant>(() => ({ ...emptyPlant, name: effectiveInitialName, id: id || emptyPlant.id }))
  // Cache of plant data per language to preserve edits when switching languages
  const [plantByLanguage, setPlantByLanguage] = React.useState<Partial<Record<SupportedLanguage, Plant>>>({})
  // Track which languages have been loaded from DB
  const [loadedLanguages, setLoadedLanguages] = React.useState<Set<SupportedLanguage>>(new Set())
  // State to hold other language translations when cloning a plant
  const [pendingTranslations, setPendingTranslations] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState<boolean>(!!id || !!prefillFromId)
  const [saving, setSaving] = React.useState(false)
  const [prefillSourceName, setPrefillSourceName] = React.useState<string | null>(duplicatedFromName)
  const [error, setError] = React.useState<string | null>(null)
  const [aiWorking, setAiWorking] = React.useState(false)
  const [aiCompleted, setAiCompleted] = React.useState(false)
  const [translating, setTranslating] = React.useState(false)
  const [aiProgress, setAiProgress] = React.useState<CategoryProgress>(() => createEmptyCategoryProgress())
  const [aiSectionLog, setAiSectionLog] = React.useState<Array<{ category: PlantFormCategory; label: string; timestamp: number }>>([])
  const [aiCurrentField, setAiCurrentField] = React.useState<string | null>(null)
  const [aiFieldProgress, setAiFieldProgress] = React.useState<{ completed: number; total: number }>({ completed: 0, total: 0 })
  const [aiStatus, setAiStatus] = React.useState<'idle' | 'translating_name' | 'filling' | 'saving'>('idle')
  const [existingLoaded, setExistingLoaded] = React.useState(false)
  const [colorSuggestions, setColorSuggestions] = React.useState<PlantColor[]>([])
  const [companionSuggestions, setCompanionSuggestions] = React.useState<string[]>([])
  const [fetchingExternalImages, setFetchingExternalImages] = React.useState(false)
  const [externalImageSources, setExternalImageSources] = React.useState<Record<ExternalImageSource, SourceResult>>(() => {
    const initial: Record<string, SourceResult> = {}
    for (const s of IMAGE_SOURCES) {
      initial[s.key] = { source: s.key, label: s.label, images: [], status: 'idle' }
    }
    return initial as Record<ExternalImageSource, SourceResult>
  })
  const [externalImagesTotal, setExternalImagesTotal] = React.useState<number | null>(null)
  const [imageUploadProgress, setImageUploadProgress] = React.useState<{
    phase: 'idle' | 'searching' | 'uploading'
    current: number
    total: number
    uploaded: number
    failed: number
  }>({ phase: 'idle', current: 0, total: 0, uploaded: 0, failed: 0 })
  const targetFields = React.useMemo(
    () =>
      [
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
      ].filter((key) => !AI_EXCLUDED_FIELDS.has(key) && !AI_EXCLUDED_FIELDS.has(key.toLowerCase())),
    [],
  )
  const basicFieldOrder = React.useMemo(
    () => ['plantType', 'utility', 'comestiblePart', 'fruitType', 'seasons', 'description', 'identity'],
    [],
  )
  const aiFieldOrder = React.useMemo(() => {
    const prioritized = basicFieldOrder.filter((key) => targetFields.includes(key))
    const remaining = targetFields.filter((key) => !prioritized.includes(key))
    return [...prioritized, ...remaining]
  }, [basicFieldOrder, targetFields])
    const mandatoryFieldOrder = aiFieldOrder
    const categoryLabels = React.useMemo(() => ({
      basics: t('plantAdmin.categories.basics', 'Basics'),
      identity: t('plantAdmin.categories.identity', 'Identity'),
      plantCare: t('plantAdmin.categories.plantCare', 'Plant Care'),
      growth: t('plantAdmin.categories.growth', 'Growth'),
      usage: t('plantAdmin.categories.usage', 'Usage'),
      ecology: t('plantAdmin.categories.ecology', 'Ecology'),
      danger: t('plantAdmin.categories.danger', 'Danger'),
      miscellaneous: t('plantAdmin.categories.miscellaneous', 'Miscellaneous'),
      meta: t('plantAdmin.categories.meta', 'Meta'),
    }), [t])

    React.useEffect(() => {
      languageRef.current = language
    }, [language])

    // Sync language state with URL when it changes (e.g., user navigates to /fr version)
    React.useEffect(() => {
      if (urlLanguage !== language) {
        setLanguage(urlLanguage)
      }
    }, [urlLanguage])

    React.useEffect(() => {
      if (!requestId || id) return
      let cancelled = false
      const loadRequestContributors = async () => {
        try {
          const { data: requestUsersData, error } = await supabase
            .from('plant_request_users')
            .select('user_id')
            .eq('requested_plant_id', requestId)
            .order('created_at', { ascending: false })
          if (error) throw new Error(error.message)
          const userIds = [
            ...new Set((requestUsersData || []).map((row: any) => String(row.user_id))),
          ].filter(Boolean)
          if (!userIds.length) return
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('id, display_name')
            .in('id', userIds)
          if (profilesError) throw new Error(profilesError.message)
          const names = (profilesData || [])
            .map((profile: any) => profile?.display_name)
            .filter((name: any) => typeof name === 'string' && name.trim())
            .map((name: string) => name.trim())
          if (!names.length || cancelled) return
          setPlant((prev) => ({
            ...prev,
            meta: {
              ...(prev.meta || {}),
              contributors: mergeContributors(prev.meta?.contributors, names),
            },
          }))
        } catch (err) {
          console.warn('[createPlant] Failed to load request contributors', err)
        }
      }
      loadRequestContributors()
      return () => {
        cancelled = true
      }
    }, [requestId, id, supabase])

    // Track if initial load is complete
    const initialLoadCompleteRef = React.useRef(false)
    // Track the previous language to save edits before switching
    const previousLanguageRef = React.useRef<SupportedLanguage>(urlLanguage)
    
    // Handle language changes - save current edits and load new language data
    React.useEffect(() => {
      if (!id) { return }
      
      const prevLang = previousLanguageRef.current
      const newLang = language
      
      // If language actually changed, save current plant to cache for previous language
      if (prevLang !== newLang && initialLoadCompleteRef.current) {
        setPlantByLanguage(prev => ({
          ...prev,
          [prevLang]: plant
        }))
      }
      
      previousLanguageRef.current = newLang
    }, [language, id, plant])
    
    // Load plant data for the current language
    React.useEffect(() => {
      if (!id) { setLoading(false); return }
      
      const requestedLanguage = language
      
      // Check if we already have this language's data in cache
      const cachedPlant = plantByLanguage[requestedLanguage]
      if (cachedPlant) {
        setPlant(cachedPlant)
        return
      }
      
      // Check if this language was already loaded from DB
      if (loadedLanguages.has(requestedLanguage) && initialLoadCompleteRef.current) {
        // Already attempted to load but no data exists (translation doesn't exist yet)
        // For non-English, start with English base data
        if (requestedLanguage !== 'en' && plantByLanguage['en']) {
          setPlant(plantByLanguage['en'])
        }
        return
      }
      
      let ignore = false
      setLoading(true)
      const fetchPlant = async () => {
        try {
          // Load plant with translations for the current language
          const loaded = await loadPlant(id, requestedLanguage)
          if (!ignore && loaded && languageRef.current === requestedLanguage) {
            setPlant(loaded)
            setPlantByLanguage(prev => ({
              ...prev,
              [requestedLanguage]: loaded
            }))
            setLoadedLanguages(prev => new Set(prev).add(requestedLanguage))
            setExistingLoaded(true)
            initialLoadCompleteRef.current = true
          }
        } catch (e: any) {
          if (!ignore && languageRef.current === requestedLanguage) {
            setError(e?.message || 'Failed to load plant')
          }
        } finally {
          if (!ignore && languageRef.current === requestedLanguage) {
            setLoading(false)
          }
        }
      }
      fetchPlant()
      return () => { ignore = true }
    }, [id, language, plantByLanguage, loadedLanguages])

    // Track if we've already prefilled to avoid re-running on language changes
    const prefillCompleteRef = React.useRef(false)
    
    // Handle prefillFrom parameter - load existing plant data into a new plant
    React.useEffect(() => {
      if (!prefillFromId || id) { 
        // Don't prefill if we're editing an existing plant (id is set)
        if (!id && !prefillFromId) setLoading(false)
        return 
      }
      
      // Only prefill once - don't re-run when language/translation changes
      if (prefillCompleteRef.current) {
        return
      }
      
      let ignore = false
      setLoading(true)
      const prefillFromSource = async () => {
        try {
          // NEW: Fetch all translations to preserve them and determine best source language
          const { data: allTranslations } = await supabase
            .from('plant_translations')
            .select('*')
            .eq('plant_id', prefillFromId)

          // Determine best language: English if available, otherwise first available, otherwise 'en'
          const hasEnglish = allTranslations?.some(t => t.language === 'en')
          const sourceLang = hasEnglish ? 'en' : (allTranslations?.[0]?.language || 'en')

          // Load source plant with the best available language
          const sourcePlant = await loadPlant(prefillFromId, sourceLang)

          if (!sourcePlant) {
            throw new Error('Source plant not found')
          }
          if (!ignore) {
            if (allTranslations) {
               // Filter out English (as it is already loaded as base/target)
               // We assume we are creating the English version first
               const others = allTranslations.filter(t => t.language !== 'en')
               setPendingTranslations(others)
            }
            // Create a new plant with a new ID, but copy all the data from the source
            const newId = generateUUIDv4()
            // Generate a unique name to avoid duplicate name conflicts
            const uniqueName = await generateUniquePlantName(sourcePlant.name)
            const prefilled: Plant = {
              ...sourcePlant,
              id: newId,
              name: uniqueName,
              // Keep images - if they conflict, the user will be notified on save
              images: sourcePlant.images || [],
              // Modify identity fields that have unique constraints
              identity: {
                ...sourcePlant.identity,
                // Append (Copy) to scientific name to avoid unique constraint violation
                scientificName: sourcePlant.identity?.scientificName
                  ? `${sourcePlant.identity.scientificName} (Copy)`
                  : undefined,
              },
              meta: {
                ...sourcePlant.meta,
                status: IN_PROGRESS_STATUS,
                createdBy: profile?.display_name || undefined,
                createdAt: new Date().toISOString(),
                updatedBy: undefined,
                updatedAt: undefined,
              },
            }
            setPlant(prefilled)
            setPrefillSourceName(sourcePlant.name)
            // Don't mark as existingLoaded - this is a new plant
            setExistingLoaded(false)
            // Mark prefill as complete so we don't re-run
            prefillCompleteRef.current = true
          }
        } catch (e: any) {
          if (!ignore) {
            setError(e?.message || 'Failed to load source plant')
          }
        } finally {
          if (!ignore) {
            setLoading(false)
          }
        }
      }
      prefillFromSource()
      return () => { ignore = true }
    }, [prefillFromId, id, profile?.display_name])

    const captureColorSuggestions = (data: unknown) => {
    if (!data) return
    const parsed: PlantColor[] = []
    if (Array.isArray(data)) {
      data.forEach((entry) => {
        if (typeof entry === 'string') {
          parsed.push({ name: entry })
        } else if (entry && typeof entry === 'object') {
          const name = (entry as any).name || (entry as any).label || (entry as any).hex || (entry as any).hexCode
          const hexCode = (entry as any).hexCode || (entry as any).hex
          parsed.push({ name: name || 'Color', hexCode })
        }
      })
    }
    if (parsed.length) setColorSuggestions(parsed)
  }

  const captureCompanionSuggestions = (data: unknown) => {
    if (!data) return
    const parsed: string[] = []
    if (Array.isArray(data)) {
      data.forEach((entry) => {
        if (typeof entry === 'string' && entry.trim()) {
          parsed.push(entry.trim())
        }
      })
    }
    if (parsed.length) setCompanionSuggestions(parsed)
  }
  const normalizePlantWatering = (candidate: Plant): Plant => ({
    ...candidate,
    plantCare: {
      ...(candidate.plantCare || {}),
      watering: { ...(candidate.plantCare?.watering || {}), schedules: normalizeSchedules(candidate.plantCare?.watering?.schedules) },
    },
  })
    const hasAiProgress = React.useMemo(() => Object.values(aiProgress).some((p) => p.total > 0), [aiProgress])
    const showAiProgressCard = aiWorking || (!aiCompleted && hasAiProgress)
  const recentSectionLog = React.useMemo(() => aiSectionLog.slice(-5).reverse(), [aiSectionLog])
  const initializeCategoryProgress = () => {
    const progress = buildCategoryProgress(targetFields)
    setAiProgress(progress)
    setAiSectionLog([])
    return progress
  }
  const markFieldComplete = (fieldKey: string) => {
    const category = getCategoryForField(fieldKey)
    setAiProgress((prev) => {
      const current = prev[category] || { total: 0, completed: 0, status: 'idle' }
      const total = current.total || 1
      const completed = Math.min((current.completed || 0) + 1, total)
      const nextStatus = completed >= total ? 'done' : 'filling'
      if (nextStatus === 'done' && current.status !== 'done') {
        const typedCategory = category as PlantFormCategory
        const entry = {
          category: typedCategory,
          label: categoryLabels[typedCategory] || typedCategory,
          timestamp: Date.now(),
        }
        setAiSectionLog((log) => {
          const nextLog = [...log, entry]
          return nextLog.length > SECTION_LOG_LIMIT ? nextLog.slice(nextLog.length - SECTION_LOG_LIMIT) : nextLog
        })
      }
      return {
        ...prev,
        [category]: {
          total,
          completed,
          status: nextStatus,
        },
      }
    })
  }

    const savePlant = async (plantOverride?: Plant, options?: { skipOnSaved?: boolean }) => {
      const saveLanguage = language
      const plantToSave = plantOverride || plant
      const trimmedName = plantToSave.name && typeof plantToSave.name === 'string' ? plantToSave.name.trim() : ''
      if (!trimmedName) { setError(t('plantAdmin.nameRequired', 'Name is required')); return }
      const isEnglish = saveLanguage === 'en'
      const existingPlantId = plantToSave.id || id
      
      // For non-English saves, the plant base record MUST exist in the database first
      // Use existingLoaded (not just existingPlantId) because "Add From" generates a new ID
      // in memory that doesn't exist in the database yet
      if (!isEnglish && !existingLoaded) {
        setError(t('plantAdmin.translationRequiresBase', 'Please save the English version first before adding translations.'))
        return
      }
      setSaving(true)
      setError(null)
      try {
        const plantId = existingPlantId || generateUUIDv4()
        
        // Get old companions for bidirectional sync (only for existing plants)
        let oldCompanions: string[] = []
        if (existingLoaded && existingPlantId) {
          const { data: oldPlantData } = await supabase
            .from('plants')
            .select('companions')
            .eq('id', existingPlantId)
            .maybeSingle()
          oldCompanions = oldPlantData?.companions || []
        }
        
        // Debug logging
        console.log('[savePlant] Starting save:', {
          plantId,
          trimmedName,
          saveLanguage,
          existingLoaded,
          existingPlantId,
        })
        
        // For new plants (English first save), check if a plant with this name already exists
        // The DB has a unique index on lower(name), so we need to check case-insensitively
        if (isEnglish && !existingLoaded) {
          const { data: existingPlants, error: checkError } = await supabase
            .from('plants')
            .select('id, name')
            .filter('name', 'ilike', trimmedName)
          
          const conflictingPlant = (existingPlants || []).find(
            (p) => p.name.toLowerCase() === trimmedName.toLowerCase() && p.id !== plantId
          )
          
          if (checkError) {
            console.error('[savePlant] Error checking for existing plant:', checkError)
          }
          
          if (conflictingPlant) {
            setError(`A plant with the name "${conflictingPlant.name}" already exists. Please choose a different name.`)
            setSaving(false)
            return
          }
        }
        
        // For new plants: set creator to current user's display name
        // For existing plants: preserve the original creator
        const createdByValue = existingLoaded 
          ? (plantToSave.meta?.createdBy || null)
          : (plantToSave.meta?.createdBy || profile?.display_name || null)
        const createdTimeValue = existingLoaded 
          ? (plantToSave.meta?.createdAt || null)
          : (plantToSave.meta?.createdAt || new Date().toISOString())
        const updatedByValue = profile?.display_name || plantToSave.meta?.updatedBy || null
        const contributorList = mergeContributors(plantToSave.meta?.contributors, [profile?.display_name])
        const normalizedSchedules = normalizeSchedules(plantToSave.plantCare?.watering?.schedules)
        const sources = plantToSave.miscellaneous?.sources || []
        const primarySource = sources[0]
        // Normalize plantType - if toDb returns null but plantType has a value, default to 'plant'
        // This prevents constraint violations when AI returns unrecognized plant types
        let normalizedPlantType = plantTypeEnum.toDb(plantToSave.plantType)
        if (normalizedPlantType === null && plantToSave.plantType && typeof plantToSave.plantType === 'string' && plantToSave.plantType.trim()) {
          console.warn(`[savePlant] Unrecognized plantType "${plantToSave.plantType}", defaulting to "plant"`)
          normalizedPlantType = 'plant'
        }
        const normalizedUtility = utilityEnum.toDbArray(plantToSave.utility)
        const normalizedComestible = comestiblePartEnum.toDbArray(plantToSave.comestiblePart)
        const normalizedFruit = fruitTypeEnum.toDbArray(plantToSave.fruitType)
        const normalizedIdentitySeasons = seasonEnum.toDbArray(plantToSave.identity?.season)
        const normalizedLifeCycle = lifeCycleEnum.toDb(plantToSave.identity?.lifeCycle)
        const normalizedLivingSpace = livingSpaceEnum.toDb(plantToSave.identity?.livingSpace)
        const normalizedMaintenance = maintenanceLevelEnum.toDb(plantToSave.identity?.maintenanceLevel)
        const normalizedToxicityHuman = toxicityEnum.toDb(plantToSave.identity?.toxicityHuman)
        const normalizedToxicityPets = toxicityEnum.toDb(plantToSave.identity?.toxicityPets)
        const normalizedHabitat = habitatEnum.toDbArray(plantToSave.plantCare?.habitat)
        const normalizedLevelSun = levelSunEnum.toDb(plantToSave.plantCare?.levelSun)
        const normalizedWateringType = wateringTypeEnum.toDbArray(plantToSave.plantCare?.wateringType)
        const normalizedDivision = divisionEnum.toDbArray(plantToSave.plantCare?.division)
        const normalizedSoil = soilEnum.toDbArray(plantToSave.plantCare?.soil)
        const normalizedMulching = mulchingEnum.toDbArray(plantToSave.plantCare?.mulching)
        const normalizedNutritionNeed = nutritionNeedEnum.toDbArray(plantToSave.plantCare?.nutritionNeed)
        const normalizedFertilizer = fertilizerEnum.toDbArray(plantToSave.plantCare?.fertilizer)
        const normalizedSowType = sowTypeEnum.toDbArray(plantToSave.growth?.sowType)
        const normalizedPolenizer = polenizerEnum.toDbArray(plantToSave.ecology?.polenizer)
        const normalizedConservationStatus = conservationStatusEnum.toDb(plantToSave.ecology?.conservationStatus)
        const normalizedPromotionMonth = monthNumberToSlug(plantToSave.identity?.promotionMonth)
        let savedId = plantId
        let payloadUpdatedTime: string | null = null
        const normalizedStatus = (plantToSave.meta?.status || IN_PROGRESS_STATUS).toLowerCase()

        // STEP 1: Save/update the base plant record (non-translatable fields)
        // For English (first save): create the plant record with all base data
        // For other languages: only update meta fields (status, updated_by, etc.)
        if (isEnglish) {
          // Full plant record with non-translatable base data
          const basePayload = {
            id: plantId,
            name: trimmedName, // Keep name in plants table for unique constraint and fallback
            scientific_name: plantToSave.identity?.scientificName || null,
            promotion_month: normalizedPromotionMonth,
            plant_type: normalizedPlantType || null,
            utility: normalizedUtility,
            comestible_part: normalizedComestible,
            fruit_type: normalizedFruit,
            // Non-translatable enum fields from identity section
            family: plantToSave.identity?.family || null,
            life_cycle: normalizedLifeCycle || null,
            season: normalizedIdentitySeasons,
            foliage_persistance: normalizeFoliagePersistanceForDb(plantToSave.identity?.foliagePersistance),
            spiked: coerceBoolean(plantToSave.identity?.spiked, false),
            toxicity_human: normalizedToxicityHuman || null,
            toxicity_pets: normalizedToxicityPets || null,
            scent: coerceBoolean(plantToSave.identity?.scent, false),
            living_space: normalizedLivingSpace || null,
            composition: normalizeCompositionForDb(plantToSave.identity?.composition),
            maintenance_level: normalizedMaintenance || null,
            multicolor: coerceBoolean(plantToSave.identity?.multicolor, false),
            bicolor: coerceBoolean(plantToSave.identity?.bicolor, false),
            temperature_max: plantToSave.plantCare?.temperatureMax || null,
            temperature_min: plantToSave.plantCare?.temperatureMin || null,
            temperature_ideal: plantToSave.plantCare?.temperatureIdeal || null,
            hygrometry: plantToSave.plantCare?.hygrometry || null,
            level_sun: normalizedLevelSun || null,
            habitat: normalizedHabitat,
            watering_type: normalizedWateringType,
            division: normalizedDivision,
            soil: normalizedSoil,
            mulching: normalizedMulching,
            nutrition_need: normalizedNutritionNeed,
            fertilizer: normalizedFertilizer,
            sowing_month: monthNumbersToSlugs(plantToSave.growth?.sowingMonth),
            flowering_month: monthNumbersToSlugs(plantToSave.growth?.floweringMonth),
            fruiting_month: monthNumbersToSlugs(plantToSave.growth?.fruitingMonth),
            height_cm: plantToSave.growth?.height || null,
            wingspan_cm: plantToSave.growth?.wingspan || null,
            tutoring: coerceBoolean(plantToSave.growth?.tutoring, false),
            sow_type: normalizedSowType,
            separation_cm: plantToSave.growth?.separation || null,
            transplanting: coerceBoolean(plantToSave.growth?.transplanting, null),
            infusion: coerceBoolean(plantToSave.usage?.infusion, false),
            aromatherapy: coerceBoolean(plantToSave.usage?.aromatherapy, false),
            // spice_mixes moved to plant_translations (translatable)
            melliferous: coerceBoolean(plantToSave.ecology?.melliferous, false),
            polenizer: normalizedPolenizer,
            be_fertilizer: coerceBoolean(plantToSave.ecology?.beFertilizer, false),
            conservation_status: normalizedConservationStatus || null,
            // pests and diseases moved to plant_translations (translatable)
            companions: plantToSave.miscellaneous?.companions || [],
            status: normalizedStatus,
            admin_commentary: plantToSave.meta?.adminCommentary || null,
            created_by: createdByValue,
            created_time: createdTimeValue,
            updated_by: updatedByValue,
            updated_time: new Date().toISOString(),
          }
          payloadUpdatedTime = basePayload.updated_time
          
          const { data, error: insertError } = await supabase
            .from('plants')
            .upsert(basePayload)
            .select('id')
            .maybeSingle()
          if (insertError) {
            throw { ...insertError, context: 'plant' }
          }
          savedId = data?.id || plantId
        } else {
          // For non-English: update ALL non-translatable fields in plants table
          // These fields are shared across all languages, so edits in any language should be saved
          const nonEnglishUpdatePayload = {
            // Meta fields
            status: normalizedStatus,
            admin_commentary: plantToSave.meta?.adminCommentary || null,
            updated_by: updatedByValue,
            updated_time: new Date().toISOString(),
            // Non-translatable identity fields
            scientific_name: plantToSave.identity?.scientificName || null,
            promotion_month: normalizedPromotionMonth,
            family: plantToSave.identity?.family || null,
            life_cycle: normalizedLifeCycle || null,
            season: normalizedIdentitySeasons,
            foliage_persistance: normalizeFoliagePersistanceForDb(plantToSave.identity?.foliagePersistance),
            spiked: coerceBoolean(plantToSave.identity?.spiked, false),
            toxicity_human: normalizedToxicityHuman || null,
            toxicity_pets: normalizedToxicityPets || null,
            scent: coerceBoolean(plantToSave.identity?.scent, false),
            living_space: normalizedLivingSpace || null,
            composition: normalizeCompositionForDb(plantToSave.identity?.composition),
            maintenance_level: normalizedMaintenance || null,
            multicolor: coerceBoolean(plantToSave.identity?.multicolor, false),
            bicolor: coerceBoolean(plantToSave.identity?.bicolor, false),
            // Non-translatable basic type fields
            plant_type: normalizedPlantType || null,
            utility: normalizedUtility,
            comestible_part: normalizedComestible,
            fruit_type: normalizedFruit,
            // Non-translatable plant care fields
            temperature_max: plantToSave.plantCare?.temperatureMax || null,
            temperature_min: plantToSave.plantCare?.temperatureMin || null,
            temperature_ideal: plantToSave.plantCare?.temperatureIdeal || null,
            hygrometry: plantToSave.plantCare?.hygrometry || null,
            level_sun: normalizedLevelSun || null,
            habitat: normalizedHabitat,
            watering_type: normalizedWateringType,
            division: normalizedDivision,
            soil: normalizedSoil,
            mulching: normalizedMulching,
            nutrition_need: normalizedNutritionNeed,
            fertilizer: normalizedFertilizer,
            // Non-translatable growth fields
            sowing_month: monthNumbersToSlugs(plantToSave.growth?.sowingMonth),
            flowering_month: monthNumbersToSlugs(plantToSave.growth?.floweringMonth),
            fruiting_month: monthNumbersToSlugs(plantToSave.growth?.fruitingMonth),
            height_cm: plantToSave.growth?.height || null,
            wingspan_cm: plantToSave.growth?.wingspan || null,
            tutoring: coerceBoolean(plantToSave.growth?.tutoring, false),
            sow_type: normalizedSowType,
            separation_cm: plantToSave.growth?.separation || null,
            transplanting: coerceBoolean(plantToSave.growth?.transplanting, null),
            // Non-translatable usage fields
            infusion: coerceBoolean(plantToSave.usage?.infusion, false),
            aromatherapy: coerceBoolean(plantToSave.usage?.aromatherapy, false),
            // Non-translatable ecology fields
            melliferous: coerceBoolean(plantToSave.ecology?.melliferous, false),
            polenizer: normalizedPolenizer,
            be_fertilizer: coerceBoolean(plantToSave.ecology?.beFertilizer, false),
            conservation_status: normalizedConservationStatus || null,
            // Non-translatable miscellaneous fields
            companions: plantToSave.miscellaneous?.companions || [],
            // Note: pests, diseases, spice_mixes are in plant_translations (translatable)
          }
          const { error: metaUpdateError } = await supabase
            .from('plants')
            .update(nonEnglishUpdatePayload)
            .eq('id', savedId)
          if (metaUpdateError) {
            throw new Error(metaUpdateError.message)
          }
          payloadUpdatedTime = nonEnglishUpdatePayload.updated_time
        }
        
        // Save related non-translatable shared data (images, colors, schedules, sources)
        // These should be saved regardless of the current language
        const colorIds = await upsertColors(plantToSave.identity?.colors || [])
        await linkColors(savedId, colorIds)
        await upsertImages(savedId, plantToSave.images || [])
        await upsertWateringSchedules(savedId, {
          ...(plantToSave.plantCare || {}),
          watering: { ...(plantToSave.plantCare?.watering || {}), schedules: normalizedSchedules },
        })
        await upsertSources(savedId, sources)
        await upsertContributors(savedId, contributorList)
        await upsertInfusionMixes(savedId, plantToSave.usage?.infusionMix)
        await upsertRecipes(savedId, plantToSave.usage?.recipes)
        
        // Sync bidirectional companion relationships
        const newCompanions = plantToSave.miscellaneous?.companions || []
        await syncBidirectionalCompanions(savedId, newCompanions, oldCompanions)

        // STEP 2: Save translatable fields to plant_translations (for ALL languages including English)
        // Note: enum fields (family, life_cycle, season, foliage_persistance, toxicity_*, living_space,
        // composition, maintenance_level) are NOT translated - they stay in plants table only
        // Same for scientific_name, promotion_month, habitat, level_sun
        const translationPayload = {
          plant_id: savedId,
          language: saveLanguage,
          name: trimmedName,
          // Translatable text fields only
          given_names: plantToSave.identity?.givenNames || [],
          overview: plantToSave.identity?.overview || null,
          allergens: plantToSave.identity?.allergens || [],
          symbolism: plantToSave.identity?.symbolism || [],
          origin: plantToSave.plantCare?.origin || [],
          advice_soil: plantToSave.plantCare?.adviceSoil || null,
          advice_mulching: plantToSave.plantCare?.adviceMulching || null,
          advice_fertilizer: plantToSave.plantCare?.adviceFertilizer || null,
          advice_tutoring: plantToSave.growth?.adviceTutoring || null,
          advice_sowing: plantToSave.growth?.adviceSowing || null,
          cut: plantToSave.growth?.cut || null,
          advice_medicinal: plantToSave.usage?.adviceMedicinal || null,
          nutritional_intake: plantToSave.usage?.nutritionalIntake || [],
          recipes_ideas: (plantToSave.usage?.recipes?.length
            ? plantToSave.usage.recipes.map(r => r.name).filter(Boolean)
            : plantToSave.usage?.recipesIdeas || []),
          advice_infusion: plantToSave.usage?.adviceInfusion || null,
          ground_effect: plantToSave.ecology?.groundEffect || null,
          source_name: primarySource?.name || null,
          source_url: primarySource?.url || null,
          tags: plantToSave.miscellaneous?.tags || [],
          // Translatable array fields (spice mixes, pests, diseases)
          spice_mixes: plantToSave.usage?.spiceMixes || [],
          pests: plantToSave.danger?.pests || [],
          diseases: plantToSave.danger?.diseases || [],
        }
        const { error: translationError } = await supabase
          .from('plant_translations')
          .upsert(translationPayload, { onConflict: 'plant_id,language' })
        if (translationError) {
          throw { ...translationError, context: 'translation' }
        }

        // NEW: Save pending translations if this is the initial save (English)
        if (isEnglish && pendingTranslations.length > 0) {
           const pendingPayloads = pendingTranslations.map(t => {
             // Create a copy without system fields
             const { id, created_at, plant_id, ...rest } = t
             return {
               ...rest,
               plant_id: savedId, // Link to the new plant ID
             }
           })

           if (pendingPayloads.length > 0) {
             const { error: pendingError } = await supabase
               .from('plant_translations')
               .upsert(pendingPayloads, { onConflict: 'plant_id,language' })

             if (pendingError) {
               console.error('Failed to save pending translations', pendingError)
             } else {
               // Clear pending so we don't save again
               setPendingTranslations([])
             }
           }
        }

          const savedPlant = {
            ...plantToSave,
            plantCare: { ...(plantToSave.plantCare || {}), watering: { ...(plantToSave.plantCare?.watering || {}), schedules: normalizedSchedules } },
            miscellaneous: { ...(plantToSave.miscellaneous || {}), sources },
            id: savedId,
            meta: {
              ...plantToSave.meta,
              contributors: contributorList,
              createdBy: createdByValue || undefined,
              createdAt: createdTimeValue || undefined,
                updatedBy: payloadUpdatedTime
                  ? (updatedByValue || plantToSave.meta?.updatedBy)
                  : plantToSave.meta?.updatedBy,
                updatedAt: payloadUpdatedTime || plantToSave.meta?.updatedAt,
            },
          }
          if (languageRef.current === saveLanguage) {
            setPlant(savedPlant)
            // Update the language cache with saved data
            setPlantByLanguage(prev => ({
              ...prev,
              [saveLanguage]: savedPlant
            }))
            setLoadedLanguages(prev => new Set(prev).add(saveLanguage))
          }
        if (isEnglish && !existingLoaded) setExistingLoaded(true)
        
        // Notify plant requesters if this plant was created from a request
        if (requestId && isEnglish && !existingLoaded) {
          try {
            const session = (await supabase.auth.getSession()).data.session
            const notifyHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
            if (session?.access_token) notifyHeaders['Authorization'] = `Bearer ${session.access_token}`
            const resp = await fetch('/api/admin/notify-plant-requesters', {
              method: 'POST',
              headers: notifyHeaders,
              credentials: 'same-origin',
              body: JSON.stringify({ requestId, plantName: trimmedName, plantId: savedId }),
            })
            if (resp.ok) {
              const notifyResult = await resp.json()
              if (notifyResult.notified) {
                console.log(`[savePlant] Notified ${notifyResult.queued} users about "${trimmedName}"`)
              }
            }
          } catch (notifyErr) {
            // Don't fail the save if notifications fail
            console.warn('[savePlant] Error sending plant request notifications:', notifyErr)
          }
        }
        
        // Only call onSaved if not explicitly skipped (e.g., during AI fill auto-save)
        if (!options?.skipOnSaved) {
          onSaved?.(savedId)
        }
        } catch (e: any) {
          // Use parseSupabaseError for user-friendly messages
          const userFriendlyError = parseSupabaseError(e, 'Please check the plant details.')
          setError(userFriendlyError)
          // Enhanced error logging
          console.error('[savePlant] Error details:', {
            message: e?.message,
            code: e?.code,
            details: e?.details,
            hint: e?.hint,
            context: e?.context,
            fullError: e,
          })
      } finally {
        setSaving(false)
      }
    }

  const runExternalImageFetch = async () => {
    const trimmedName = plant.name && typeof plant.name === 'string' ? plant.name.trim() : ''
    if (!trimmedName) {
      setError(t('plantAdmin.aiNameRequired', 'Please enter a name before fetching images.'))
      return
    }
    setFetchingExternalImages(true)
    setExternalImagesTotal(null)
    setImageUploadProgress({ phase: 'searching', current: 0, total: 0, uploaded: 0, failed: 0 })
    setError(null)
    // Reset all sources to loading
    setExternalImageSources((prev) => {
      const next = { ...prev }
      for (const s of IMAGE_SOURCES) {
        next[s.key] = { source: s.key, label: s.label, images: [], status: 'loading' }
      }
      return next
    })

    // Collect all found images, then upload them to storage
    const allFoundImages: Array<{ url: string; source: string }> = []

    try {
      const result = await fetchExternalPlantImages(trimmedName, {
        callbacks: {
          onSourceStart: (source) => {
            setExternalImageSources((prev) => ({
              ...prev,
              [source]: { ...prev[source], status: 'loading', images: [], error: undefined },
            }))
          },
          onSourceDone: (sourceResult) => {
            setExternalImageSources((prev) => ({
              ...prev,
              [sourceResult.source]: sourceResult,
            }))
            // Collect images for uploading
            for (const img of sourceResult.images) {
              allFoundImages.push({ url: img.url, source: img.source })
            }
          },
        },
      })

      if (result.errors?.length) {
        console.warn('[CreatePlantPage] External image fetch partial errors:', result.errors)
      }

      // Upload each found image to the PLANTS bucket
      const totalToUpload = allFoundImages.length
      let uploadedCount = 0
      let failedCount = 0
      setImageUploadProgress({ phase: 'uploading', current: 0, total: totalToUpload, uploaded: 0, failed: 0 })

      for (let i = 0; i < allFoundImages.length; i++) {
        const img = allFoundImages[i]
        setImageUploadProgress((prev) => ({ ...prev, current: i + 1 }))
        try {
          const uploaded = await uploadPlantImageFromUrl(img.url, trimmedName, img.source)
          // Add the storage URL to the plant
          setPlant((prev) => {
            const existing = prev.images || []
            const existingUrls = new Set(
              existing.map((im) => (im.link || im.url || '').toLowerCase()).filter(Boolean)
            )
            if (existingUrls.has(uploaded.url.toLowerCase())) return prev
            const newImage = {
              link: uploaded.url,
              use: (existing.length === 0 ? 'primary' : 'other') as 'primary' | 'discovery' | 'other',
            }
            return { ...prev, images: [...existing, newImage] }
          })
          uploadedCount++
          setImageUploadProgress((prev) => ({ ...prev, uploaded: uploadedCount }))
          console.log(`[CreatePlantPage] Uploaded plant image: ${img.source} -> ${uploaded.url} (${(uploaded.sizeBytes / 1024).toFixed(0)} KB, -${uploaded.compressionPercent}%)`)
        } catch (uploadErr) {
          failedCount++
          setImageUploadProgress((prev) => ({ ...prev, failed: failedCount }))
          console.warn(`[CreatePlantPage] Failed to upload image from ${img.source}:`, uploadErr)
        }
      }

      setImageUploadProgress({ phase: 'idle', current: totalToUpload, total: totalToUpload, uploaded: uploadedCount, failed: failedCount })
      setExternalImagesTotal(uploadedCount)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch external images'
      setError(message)
      console.error('[CreatePlantPage] External image fetch failed:', err)
    } finally {
      setFetchingExternalImages(false)
    }
  }

  const runAiFill = async () => {
    const trimmedName = plant.name && typeof plant.name === 'string' ? plant.name.trim() : ''
    if (!trimmedName) {
      setError(t('plantAdmin.aiNameRequired', 'Please enter a name before using AI fill.'))
      return
    }

    initializeCategoryProgress()
    setAiCompleted(false)
    setAiWorking(true)
    setColorSuggestions([])
    setError(null)
    setAiCurrentField(null)
    setAiFieldProgress({ completed: 0, total: targetFields.length })
    setAiStatus('translating_name')

    let aiSucceeded = false
    let finalPlant: Plant | null = null
    let fieldsCompleted = 0
    // Capture current images at the start to preserve them throughout AI fill
    const currentImages = plant.images || []
    
    // First, get the English name of the plant (it might be in any language)
    let plantNameForAi = trimmedName
    try {
      const nameResult = await getEnglishPlantName(trimmedName)
      plantNameForAi = nameResult.englishName
      if (nameResult.wasTranslated) {
        console.log(`[CreatePlantPage] Translated plant name: "${trimmedName}" -> "${plantNameForAi}"`)
        // Update the plant name to the English version
        setPlant((prev) => ({
          ...prev,
          name: plantNameForAi,
        }))
      }
    } catch (err) {
      console.warn(`[CreatePlantPage] Failed to get English name for "${trimmedName}", using original:`, err)
      // Continue with original name if translation fails
    }
    
    setAiStatus('filling')
    
    const applyWithStatus = (candidate: Plant): Plant => ({
      ...candidate,
      // Always preserve images from the current state
      images: candidate.images && candidate.images.length > 0 ? candidate.images : currentImages,
      meta: { ...(candidate.meta || {}), status: IN_PROGRESS_STATUS },
    })
    const needsMonths = (p: Plant) =>
      !((p.growth?.sowingMonth || []).length && (p.growth?.floweringMonth || []).length && (p.growth?.fruitingMonth || []).length)
    const needsOriginOrWater = (p: Plant) => {
      const hasOrigin = (p.plantCare?.origin || []).length > 0
      const hasSchedule = (p.plantCare?.watering?.schedules || []).length > 0
      return !(hasOrigin && hasSchedule)
    }

    const fillFieldWithRetries = async (fieldKey: string, existingField?: unknown) => {
      setAiCurrentField(fieldKey)
      let lastError: Error | null = null
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          const fieldData = await fetchAiPlantFillField({
            plantName: plantNameForAi,
            schema: plantSchema,
            fieldKey,
            existingField,
            // AI always uses English regardless of current editing language
            language: 'en',
          })
          setPlant((prev) => {
            const applied = applyAiFieldToPlant(prev, fieldKey, fieldData)
            const normalized = normalizePlantWatering(applied)
            const withStatus = applyWithStatus(normalized)
            // Ensure images are always preserved from the most recent state
            const withImages = {
              ...withStatus,
              images: prev.images && prev.images.length > 0 ? prev.images : (withStatus.images || currentImages),
            }
            finalPlant = withImages
            markFieldComplete(fieldKey)
            return withImages
          })
          fieldsCompleted++
          setAiFieldProgress({ completed: fieldsCompleted, total: targetFields.length })
          return true
        } catch (err: any) {
            lastError = err instanceof Error ? err : new Error(String(err || 'AI field fill failed'))
            if (attempt >= 3) {
              setError(lastError?.message || t('plantAdmin.errors.aiFill', 'AI fill failed'))
          }
        }
      }
      if (lastError) console.error(`AI fill failed for ${fieldKey} after 3 attempts`, lastError)
      return false
    }

    const ensureMandatoryFields = async () => {
      for (const fieldKey of mandatoryFieldOrder) {
        if (!requiresFieldCompletion(fieldKey)) continue
        const latestSnapshot = finalPlant || plant
        if (!latestSnapshot) break
        if (!isFieldMissingForPlant(latestSnapshot, fieldKey)) continue
        await fillFieldWithRetries(fieldKey, getFieldValueForKey(latestSnapshot, fieldKey))
      }
    }

    try {
      let aiData: Record<string, unknown> | null = null
      let lastError: Error | null = null
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          aiData = await fetchAiPlantFill({
            plantName: plantNameForAi,
            schema: plantSchema,
            existingData: plant,
            fields: aiFieldOrder,
            // AI always uses English regardless of current editing language
            language: 'en',
            onProgress: ({ field, completed, total }) => {
              if (field !== 'init' && field !== 'complete') {
                setAiCurrentField(field)
                setAiFieldProgress({ completed, total })
              }
            },
            onFieldComplete: ({ field, data }) => {
              if (field === 'complete') return
              if (field.toLowerCase().includes('color')) captureColorSuggestions(data)
              if (field === 'identity' && (data as any)?.colors) captureColorSuggestions((data as any).colors)
              if (field === 'miscellaneous' && (data as any)?.companions) captureCompanionSuggestions((data as any).companions)
              setPlant((prev) => {
                const applied = applyAiFieldToPlant(prev, field, data)
                const normalized = normalizePlantWatering(applied)
                const withStatus = applyWithStatus(normalized)
                // Ensure images are always preserved from the most recent state
                const withImages = {
                  ...withStatus,
                  images: prev.images && prev.images.length > 0 ? prev.images : (withStatus.images || currentImages),
                }
                finalPlant = withImages
                return withImages
              })
              markFieldComplete(field)
              fieldsCompleted++
              setAiFieldProgress({ completed: fieldsCompleted, total: targetFields.length })
            },
          })
          lastError = null
          break
        } catch (err: any) {
          lastError = err instanceof Error ? err : new Error(String(err || 'AI fill failed'))
          if (attempt >= 3) throw lastError
        }
      }

      if (aiData && typeof aiData === 'object') {
        setPlant((prev) => {
          let updated = { ...prev }
          // Preserve images before processing AI data
          const preservedImages = prev.images && prev.images.length > 0 ? prev.images : currentImages
          for (const [fieldKey, data] of Object.entries(aiData as Record<string, unknown>)) {
            if (fieldKey.toLowerCase().includes('color')) captureColorSuggestions(data)
            if (fieldKey === 'identity' && (data as any)?.colors) captureColorSuggestions((data as any).colors)
            if (fieldKey === 'miscellaneous' && (data as any)?.companions) captureCompanionSuggestions((data as any).companions)
            updated = applyAiFieldToPlant(updated, fieldKey, data)
            markFieldComplete(fieldKey)
          }
          const withId = { ...updated, id: updated.id || generateUUIDv4() }
          const normalized = normalizePlantWatering(withId)
          const withStatus = applyWithStatus(normalized)
          // Always restore preserved images
          const withImages = {
            ...withStatus,
            images: preservedImages,
          }
          finalPlant = withImages
          return withImages
        })
      }

      const snapshot: Plant = finalPlant || plant
      if (needsOriginOrWater(snapshot)) {
        await fillFieldWithRetries('plantCare', snapshot.plantCare)
      }
      if (needsMonths(snapshot)) {
        await fillFieldWithRetries('growth', snapshot.growth)
      }

      setPlant((prev) => {
        const target = normalizePlantWatering(finalPlant || prev)
        // Preserve images from current state
        const preservedImages = prev.images && prev.images.length > 0 ? prev.images : currentImages
        const ensuredWater = (target.plantCare?.watering?.schedules || []).length
          ? normalizeSchedules(target.plantCare?.watering?.schedules)
          : [{ season: undefined, quantity: 1, timePeriod: 'week' as const }]
        const ensuredGrowth = {
          sowingMonth: target.growth?.sowingMonth?.length ? target.growth.sowingMonth : [3],
          floweringMonth: target.growth?.floweringMonth?.length ? target.growth.floweringMonth : [6],
          fruitingMonth: target.growth?.fruitingMonth?.length ? target.growth.fruitingMonth : [9],
        }
        const next = {
          ...target,
          images: preservedImages,
          plantCare: {
            ...(target.plantCare || {}),
            origin: (target.plantCare?.origin || []).length ? target.plantCare?.origin : ['Unknown'],
            watering: { ...(target.plantCare?.watering || {}), schedules: ensuredWater },
          },
          growth: { ...(target.growth || {}), ...ensuredGrowth },
          meta: { ...(target.meta || {}), status: IN_PROGRESS_STATUS },
        }
        finalPlant = next
        return next
      })

      await ensureMandatoryFields()
      aiSucceeded = true
      } catch (e: any) {
        setError(e?.message || t('plantAdmin.errors.aiFill', 'AI fill failed'))
    } finally {
      setAiWorking(false)
      setAiCurrentField(null)
      setAiStatus('idle')
      if (aiSucceeded) {
        setAiCompleted(true)
        setAiProgress(createEmptyCategoryProgress())
        setAiSectionLog([])
      }
      const targetPlant = finalPlant || plant
      // Auto-save after AI fill but skip onSaved to prevent popup from closing
      // User can review the AI-filled data and manually save/close when ready
      if (targetPlant) await savePlant(targetPlant, { skipOnSaved: true })
    }
  }

  const translatePlant = async () => {
    // Translate to all other languages (all languages including English are stored in plant_translations)
    const targets = SUPPORTED_LANGUAGES.filter((lang) => lang !== language)
    if (!targets.length) {
      setError(t('plantAdmin.translationNoTargets', 'No other languages configured for translation.'))
      return
    }
    if (!(plant.name && typeof plant.name === 'string' && plant.name.trim())) {
      setError(t('plantAdmin.nameRequired', 'Name is required'))
      return
    }
    await savePlant()
    setTranslating(true)
    setError(null)
    try {
      const sourceLang = language
      const translatedRows = [] as any[]
      const primarySource = (plant.miscellaneous?.sources || [])[0]
        for (const target of targets) {
        const translatedName = await translateText(plant.name || '', target, sourceLang)
        const translatedGivenNames = await translateArray(plant.identity?.givenNames || [], target, sourceLang)
        const translateArraySafe = (arr?: string[]) => translateArray(arr || [], target, sourceLang)
        const translatedSourceName = primarySource?.name
          ? await translateText(primarySource.name, target, sourceLang)
          : undefined
        const translatedSource: Record<string, string> = {}
        if (translatedSourceName) translatedSource.name = translatedSourceName
        if (primarySource?.url) translatedSource.url = primarySource.url

          // Note: All enum fields (family, life_cycle, season, foliage_persistance, toxicity_*,
          // living_space, composition, maintenance_level) are NOT translated - they stay in plants table only
          // Same for scientific_name, promotion_month, habitat, level_sun
          // Only text fields that need actual translation go in plant_translations
          translatedRows.push({
          plant_id: plant.id,
          language: target,
          name: translatedName,
          given_names: translatedGivenNames,
          overview: plant.identity?.overview
            ? await translateText(plant.identity.overview, target, sourceLang)
            : plant.identity?.overview || null,
            allergens: await translateArraySafe(plant.identity?.allergens),
            symbolism: await translateArraySafe(plant.identity?.symbolism),
          origin: await translateArraySafe(plant.plantCare?.origin),
          advice_soil: plant.plantCare?.adviceSoil
            ? await translateText(plant.plantCare.adviceSoil, target, sourceLang)
            : plant.plantCare?.adviceSoil || null,
          advice_mulching: plant.plantCare?.adviceMulching
            ? await translateText(plant.plantCare.adviceMulching, target, sourceLang)
            : plant.plantCare?.adviceMulching || null,
          advice_fertilizer: plant.plantCare?.adviceFertilizer
            ? await translateText(plant.plantCare.adviceFertilizer, target, sourceLang)
            : plant.plantCare?.adviceFertilizer || null,
          advice_tutoring: plant.growth?.adviceTutoring
            ? await translateText(plant.growth.adviceTutoring, target, sourceLang)
            : plant.growth?.adviceTutoring || null,
          advice_sowing: plant.growth?.adviceSowing
            ? await translateText(plant.growth.adviceSowing, target, sourceLang)
            : plant.growth?.adviceSowing || null,
          cut: plant.growth?.cut
            ? await translateText(plant.growth.cut, target, sourceLang)
            : plant.growth?.cut || null,
          advice_medicinal: plant.usage?.adviceMedicinal
            ? await translateText(plant.usage.adviceMedicinal, target, sourceLang)
            : plant.usage?.adviceMedicinal || null,
          nutritional_intake: await translateArraySafe(plant.usage?.nutritionalIntake),
          recipes_ideas: await translateArraySafe(
            plant.usage?.recipes?.length
              ? plant.usage.recipes.map(r => r.name).filter(Boolean)
              : plant.usage?.recipesIdeas
          ),
          advice_infusion: plant.usage?.adviceInfusion
            ? await translateText(plant.usage.adviceInfusion, target, sourceLang)
            : plant.usage?.adviceInfusion || null,
            ground_effect: plant.ecology?.groundEffect
              ? await translateText(plant.ecology.groundEffect, target, sourceLang)
              : plant.ecology?.groundEffect || null,
          source_name: translatedSource.name || null,
          source_url: translatedSource.url || null,
          tags: await translateArraySafe(plant.miscellaneous?.tags),
          // Translatable array fields (formerly non-translatable)
          spice_mixes: await translateArraySafe(plant.usage?.spiceMixes),
          pests: await translateArraySafe(plant.danger?.pests),
          diseases: await translateArraySafe(plant.danger?.diseases),
        })
      }

      if (translatedRows.length) {
        const { error: translateError } = await supabase
          .from('plant_translations')
          .upsert(translatedRows, { onConflict: 'plant_id,language' })
        if (translateError) throw new Error(translateError.message)
        
        // Clear cache for translated languages so they reload fresh data
        setLoadedLanguages(prev => {
          const newSet = new Set(prev)
          targets.forEach(lang => newSet.delete(lang))
          return newSet
        })
        setPlantByLanguage(prev => {
          const newCache = { ...prev }
          targets.forEach(lang => delete newCache[lang])
          return newCache
        })
      }

      setPlant((prev) => ({
        ...prev,
        meta: { ...(prev.meta || {}), status: IN_PROGRESS_STATUS },
      }))
      await savePlant()
      } catch (e: any) {
        setError(e?.message || t('plantAdmin.errors.translation', 'Translation failed'))
    } finally {
      setTranslating(false)
    }
  }

  const handleBackClick = React.useCallback(() => {
    // Use navigateBack to go to the last distinct page
    // This fixes the issue where clicking back multiple times was needed
    // when the user navigated to the same page multiple times
    navigateBack()
  }, [navigateBack])

  const handleViewPlantInfo = React.useCallback(() => {
    if (!id) return
    languageNavigate(`/plants/${id}`)
  }, [id, languageNavigate])

  // Ctrl+S keyboard shortcut to save
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (!saving && !aiWorking) {
          savePlant()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [saving, aiWorking, savePlant])

  return (
    <div className="max-w-6xl mx-auto px-4 pb-12 space-y-6">
      <div className="relative overflow-hidden rounded-[32px] border border-stone-200 dark:border-[#3e3e42] bg-gradient-to-br from-emerald-50 via-white to-stone-100 dark:from-[#1b2a21] dark:via-[#101712] dark:to-[#0c120e] shadow-[0_24px_80px_-40px_rgba(16,185,129,0.45)] dark:shadow-[0_28px_90px_-50px_rgba(34,197,94,0.35)]">
        <div className="absolute -left-20 -top-24 h-64 w-64 rounded-full bg-emerald-200/40 dark:bg-emerald-500/15 blur-3xl" aria-hidden="true" />
        <div className="absolute -right-12 bottom-[-30%] h-72 w-72 rounded-full bg-emerald-100/40 dark:bg-emerald-600/10 blur-3xl" aria-hidden="true" />
        <div className="relative p-6 sm:p-8 flex flex-col gap-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-full px-3"
                  onClick={handleBackClick}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {t('plantAdmin.backToPrevious', 'Back to previous page')}
                </Button>
                {id ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="rounded-full px-3"
                    onClick={handleViewPlantInfo}
                  >
                    <ArrowUpRight className="h-4 w-4 mr-2" />
                    {t('plantAdmin.viewPlantInfo', 'Open plant page')}
                  </Button>
                ) : null}
              </div>
              <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight">
                {id ? t('plantAdmin.editTitle', 'Edit Plant') : t('plantAdmin.createTitle', 'Create Plant')}
              </h1>
              <p className="text-sm text-muted-foreground max-w-2xl">
                {t('plantAdmin.createSubtitle', 'Fill every field with the supplied descriptions or let AI help.')}
              </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2 rounded-full bg-white/80 dark:bg-[#151b15]/80 border border-stone-200/70 dark:border-stone-700/60 px-3 py-1.5 shadow-inner shadow-emerald-100/40 dark:shadow-[inset_0_1px_0_rgba(16,185,129,0.25)]">
                <label className="text-sm font-medium" htmlFor="create-language">{t('plantAdmin.languageLabel', 'Language')}</label>
                <select
                  id="create-language"
                  className="border rounded px-2 py-1 text-sm bg-background"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang} value={lang}>{lang.toUpperCase()}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <Button type="button" onClick={translatePlant} disabled={translating} className="rounded-2xl shadow-md">
                  {translating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {t('plantAdmin.deeplTranslate', 'DeepL Translation')}
                </Button>
              </div>
              <div className="flex gap-2">
                  <Button variant="secondary" onClick={onCancel} className="rounded-2xl">{t('common.cancel', 'Cancel')}</Button>
                <Button onClick={() => savePlant()} disabled={saving || aiWorking} className="rounded-2xl shadow-md">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('plantAdmin.savePlant', 'Save Plant')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
      {prefillSourceName && (
        <Card className="border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-950/30">
          <CardContent className="flex gap-2 items-center py-3">
            <Copy className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm text-blue-800 dark:text-blue-200">
              {duplicatedFromName 
                ? <>Duplicated from original plant: <strong>{prefillSourceName}</strong></>
                : <>Creating new plant from template: <strong>{prefillSourceName}</strong></>
              }
            </span>
          </CardContent>
        </Card>
      )}
      {error && (
        <Card className="border-red-500">
          <CardContent className="flex gap-2 items-center text-red-700 py-3">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </CardContent>
        </Card>
      )}
      <div className="flex flex-col gap-3">
        <div className="flex gap-3 flex-col sm:flex-row sm:items-center sm:justify-between">
          {language === 'en' && (
            <div className="flex gap-2 flex-wrap items-center">
              <Button
                type="button"
                onClick={aiCompleted ? undefined : runAiFill}
                disabled={aiWorking || !(plant.name && typeof plant.name === 'string' && plant.name.trim()) || aiCompleted}
              >
                {aiWorking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : aiCompleted ? <Check className="mr-2 h-4 w-4" /> : <Sparkles className="mr-2 h-4 w-4" />}
                {aiCompleted ? t('plantAdmin.aiFilled', 'AI Filled') : t('plantAdmin.aiFill', 'AI fill all fields')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={runExternalImageFetch}
                disabled={fetchingExternalImages || !(plant.name && typeof plant.name === 'string' && plant.name.trim())}
              >
                {fetchingExternalImages ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
                {t('plantAdmin.fetchExternalImages', 'Fetch Images')}
              </Button>
              {externalImagesTotal !== null && !fetchingExternalImages && (
                <span className="text-xs text-muted-foreground self-center">
                  {externalImagesTotal === 0
                    ? 'No free images found'
                    : `Added ${externalImagesTotal} images`}
                </span>
              )}
              {!(plant.name && typeof plant.name === 'string' && plant.name.trim()) && (
                <span className="text-xs text-muted-foreground self-center">{t('plantAdmin.aiNameRequired', 'Please enter a name before using AI fill.')}</span>
              )}
            </div>
          )}
        </div>
          {/* External Image Fetch + Upload Progress Card */}
          {(fetchingExternalImages || externalImagesTotal !== null) && (
            <div className="rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] p-4 space-y-3 shadow-md shadow-stone-200/50 dark:shadow-black/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ImagePlus className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                  <span className="text-sm font-semibold text-stone-800 dark:text-stone-100">
                    {imageUploadProgress.phase === 'searching'
                      ? 'Searching for images...'
                      : imageUploadProgress.phase === 'uploading'
                        ? 'Uploading & optimizing...'
                        : fetchingExternalImages
                          ? 'Processing...'
                          : 'Image Fetch Complete'}
                  </span>
                </div>
                {imageUploadProgress.phase === 'uploading' && imageUploadProgress.total > 0 && (
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    {imageUploadProgress.current}/{imageUploadProgress.total}
                  </span>
                )}
              </div>

              {/* Source search progress */}
              <div className="space-y-2">
                {IMAGE_SOURCES.map(({ key, label }) => {
                  const src = externalImageSources[key]
                  const isLoading = src.status === 'loading'
                  const isDone = src.status === 'done'
                  const isError = src.status === 'error'
                  const isSkipped = src.status === 'skipped'
                  const count = src.images.length
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <div className="w-28 shrink-0 text-xs font-medium text-stone-600 dark:text-stone-300">
                        {label}
                      </div>
                      <div className="flex-1 h-2 rounded-full bg-stone-100 dark:bg-[#2a2a2d] overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ease-out ${
                            isLoading
                              ? 'bg-cyan-400 dark:bg-cyan-500 animate-pulse w-full'
                              : isDone && count > 0
                                ? 'bg-emerald-500 dark:bg-emerald-400'
                                : isDone && count === 0
                                  ? 'bg-stone-300 dark:bg-stone-600'
                                  : isError
                                    ? 'bg-red-400 dark:bg-red-500'
                                    : isSkipped
                                      ? 'bg-amber-300 dark:bg-amber-500'
                                      : 'bg-stone-200 dark:bg-stone-700'
                          }`}
                          style={{ width: isLoading ? '100%' : (isDone || isError || isSkipped) ? '100%' : '0%' }}
                        />
                      </div>
                      <div className="w-24 shrink-0 text-right">
                        {isLoading && (
                          <span className="text-xs text-cyan-600 dark:text-cyan-400 flex items-center justify-end gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Searching
                          </span>
                        )}
                        {isDone && count > 0 && (
                          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            {count} found
                          </span>
                        )}
                        {isDone && count === 0 && (
                          <span className="text-xs text-stone-400 dark:text-stone-500">0 found</span>
                        )}
                        {isError && (
                          <span className="text-xs text-red-500 dark:text-red-400" title={src.error}>Failed</span>
                        )}
                        {isSkipped && (
                          <span className="text-xs text-amber-500 dark:text-amber-400" title={src.error}>Not configured</span>
                        )}
                        {src.status === 'idle' && (
                          <span className="text-xs text-stone-300 dark:text-stone-600">Waiting</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Upload progress */}
              {imageUploadProgress.phase === 'uploading' && imageUploadProgress.total > 0 && (
                <div className="space-y-2 pt-2 border-t border-stone-100 dark:border-[#2a2a2d]">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-stone-500 dark:text-stone-400 flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Uploading image {imageUploadProgress.current} of {imageUploadProgress.total} to storage
                    </span>
                    <span className="font-medium text-stone-700 dark:text-stone-200">
                      {imageUploadProgress.uploaded} saved{imageUploadProgress.failed > 0 ? `, ${imageUploadProgress.failed} failed` : ''}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-stone-100 dark:bg-[#2a2a2d] overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${Math.round((imageUploadProgress.current / imageUploadProgress.total) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Complete summary */}
              {!fetchingExternalImages && externalImagesTotal !== null && (
                <div className="pt-2 border-t border-stone-100 dark:border-[#2a2a2d]">
                  <span className="text-xs text-stone-500 dark:text-stone-400">
                    {externalImagesTotal === 0
                      ? 'No images could be uploaded'
                      : `${externalImagesTotal} ${externalImagesTotal === 1 ? 'image' : 'images'} uploaded to storage as WebP`}
                    {imageUploadProgress.failed > 0 ? ` (${imageUploadProgress.failed} failed)` : ''}
                  </span>
                </div>
              )}
            </div>
          )}
          {showAiProgressCard && (
          <div className="rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] p-5 space-y-5 shadow-lg shadow-stone-200/50 dark:shadow-black/20">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ${
                  aiCompleted 
                    ? 'bg-gradient-to-br from-emerald-400 to-teal-500 shadow-emerald-500/25' 
                    : 'bg-gradient-to-br from-blue-400 to-indigo-500 shadow-blue-500/25'
                }`}>
                  {aiWorking ? (
                    <Loader2 className="h-5 w-5 text-white animate-spin" />
                  ) : aiCompleted ? (
                    <Check className="h-5 w-5 text-white" />
                  ) : (
                    <Sparkles className="h-5 w-5 text-white" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-stone-800 dark:text-stone-100">
                    {aiWorking
                      ? t('plantAdmin.categoryProgressTitle', 'AI Fill in Progress')
                      : aiCompleted
                        ? t('plantAdmin.categoryProgressComplete', 'AI Fill Complete')
                        : t('plantAdmin.categoryProgressSummary', 'AI Fill Summary')}
                  </h3>
                  {aiWorking && (
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      Generating plant information with AI
                    </p>
                  )}
                </div>
              </div>
              {aiWorking && aiFieldProgress.total > 0 && (
                <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  {Math.round((aiFieldProgress.completed / aiFieldProgress.total) * 100)}%
                </span>
              )}
            </div>

            {/* Current plant info when filling */}
            {aiWorking && (
              <div className="rounded-xl border border-stone-100 dark:border-[#2a2a2d] bg-stone-50/50 dark:bg-[#252528] p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                      <Leaf className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <span className="font-medium text-sm text-stone-800 dark:text-stone-100">{plant.name || 'Plant'}</span>
                  </div>
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${
                    aiStatus === 'filling' 
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
                      : aiStatus === 'saving'
                        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                        : 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
                  }`}>
                    {aiStatus === 'filling' && <Loader2 className="h-3 w-3 animate-spin" />}
                    {aiStatus === 'translating_name' ? 'Getting Name' : 
                     aiStatus === 'filling' ? 'AI Filling' : 
                     aiStatus === 'saving' ? 'Saving' : 'Processing'}
                  </div>
                </div>

                {/* Field progress */}
                {aiStatus === 'filling' && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-stone-500 dark:text-stone-400">
                        {aiCurrentField && (
                          <>Filling <span className="font-medium text-stone-700 dark:text-stone-200">{aiCurrentField}</span></>
                        )}
                      </span>
                      <span className="text-stone-600 dark:text-stone-300 font-medium">
                        {aiFieldProgress.completed}/{aiFieldProgress.total} fields
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-stone-200 dark:bg-[#1a1a1d] overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all duration-300 rounded-full"
                        style={{
                          width: `${Math.round((aiFieldProgress.completed / aiFieldProgress.total) * 100)}%`
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Category progress grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {plantFormCategoryOrder.filter(cat => cat !== 'meta').map((cat) => {
                const info = aiProgress[cat]
                if (!info?.total) return null
                const percent = info.total ? Math.round((info.completed / info.total) * 100) : 0
                const isDone = info.status === 'done'
                const isFilling = info.status === 'filling'
                return (
                  <div 
                    key={cat} 
                    className={`rounded-lg p-2.5 transition-all ${
                      isDone 
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50' 
                        : isFilling
                          ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50'
                          : 'bg-white dark:bg-[#1e1e20] border border-stone-100 dark:border-[#2a2a2d]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-[11px] font-medium truncate ${
                        isDone ? 'text-emerald-700 dark:text-emerald-300' : 
                        isFilling ? 'text-blue-700 dark:text-blue-300' : 
                        'text-stone-500 dark:text-stone-400'
                      }`}>
                        {categoryLabels[cat]}
                      </span>
                      {isDone && <Check className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />}
                      {isFilling && <Loader2 className="h-3 w-3 animate-spin text-blue-500 flex-shrink-0" />}
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-stone-200 dark:bg-stone-700/50 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 rounded-full ${
                          isDone ? 'bg-emerald-500' : isFilling ? 'bg-blue-500' : 'bg-stone-300 dark:bg-stone-600'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-stone-400 dark:text-stone-500 mt-1 text-right">
                      {info.completed}/{info.total}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Sections completed log */}
            {recentSectionLog.length > 0 && (
              <div className="space-y-2">
                <div className="text-[11px] uppercase tracking-wider font-medium text-stone-400 dark:text-stone-500">
                  {t('plantAdmin.sectionLogTitle', 'Recently Completed')}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {recentSectionLog.map((entry) => (
                    <span
                      key={`${entry.category}-${entry.timestamp}`}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30 text-emerald-700 dark:text-emerald-300 text-xs"
                    >
                      <Check className="h-3 w-3" />
                      {entry.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {loading ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('plantAdmin.loadingPlant', 'Loading plant...')}
          </CardContent>
        </Card>
        ) : (
          <PlantProfileForm
            value={plant}
            onChange={setPlant}
            colorSuggestions={colorSuggestions}
            companionSuggestions={companionSuggestions}
            categoryProgress={hasAiProgress ? aiProgress : undefined}
            language={language}
            onImageRemove={(imageUrl) => {
              if (isManagedPlantImageUrl(imageUrl)) {
                deletePlantImage(imageUrl).then((result) => {
                  if (result.deleted) {
                    console.log(`[CreatePlantPage] Deleted plant image from storage: ${imageUrl}`)
                  }
                }).catch((err) => {
                  console.warn(`[CreatePlantPage] Failed to delete plant image from storage:`, err)
                })
              }
            }}
          />
        )}
    </div>
  )
}

export default CreatePlantPage
