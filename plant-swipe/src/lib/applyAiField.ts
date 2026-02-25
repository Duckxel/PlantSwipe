// ============================================================================
// Apply AI field data to a Plant object
// Handles normalization, enum validation, and type coercion
// Updated for new flat DB schema (Feb 2026)
// ============================================================================

import type { Plant } from "@/types/plant"
import { mapFieldToCategory, type PlantFormCategory } from "./plantFormCategories"
import type { EnumTools } from "@/lib/composition"
import {
  encyclopediaCategoryEnum,
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
  recipeCategoryEnum,
  recipeTimeEnum,
} from "@/lib/composition"

type EnumValueResult =
  | { shouldUpdate: true; value: string | undefined }
  | { shouldUpdate: false; value?: undefined }

type EnumArrayResult =
  | { shouldUpdate: true; value: string[] }
  | { shouldUpdate: false; value?: undefined }

const shouldClearValue = (value: unknown) =>
  value === null || (typeof value === 'string' && value.trim() === '')

const isExplicitArrayClear = (value: unknown) =>
  Array.isArray(value) && (value as unknown[]).length === 0

const normalizeEnumValueInput = (enumTool: EnumTools, value: unknown): EnumValueResult => {
  if (value === undefined) return { shouldUpdate: false }
  if (shouldClearValue(value)) return { shouldUpdate: true, value: undefined }
  const ui = enumTool.toUi(value)
  if (ui !== undefined) return { shouldUpdate: true, value: ui }
  // For the new schema, also accept raw DB values directly
  const db = enumTool.toDb(value)
  if (db !== null) return { shouldUpdate: true, value: db }
  return { shouldUpdate: false }
}

const normalizeEnumArrayInput = (enumTool: EnumTools, value: unknown): EnumArrayResult => {
  if (value === undefined) return { shouldUpdate: false }
  // Try DB array first (new schema uses DB keys directly)
  const dbArr = enumTool.toDbArray(value)
  if (dbArr.length > 0) return { shouldUpdate: true, value: dbArr }
  const uiArr = enumTool.toUiArray(value)
  if (uiArr.length > 0) return { shouldUpdate: true, value: uiArr }
  if (isExplicitArrayClear(value) || shouldClearValue(value)) return { shouldUpdate: true, value: [] }
  return { shouldUpdate: false }
}

const normalizeStringArray = (value: unknown): string[] | undefined => {
  if (value === undefined) return undefined
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map(item => item.trim())
  }
  if (typeof value === 'string' && value.trim()) return [value.trim()]
  return []
}

const normalizeString = (value: unknown): string | undefined => {
  if (value === undefined) return undefined
  if (typeof value === 'string') return value.trim() || undefined
  return undefined
}

const normalizeBoolean = (value: unknown): boolean | undefined => {
  if (value === undefined) return undefined
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim()
    if (lower === 'true' || lower === 'yes' || lower === '1') return true
    if (lower === 'false' || lower === 'no' || lower === '0') return false
  }
  return undefined
}

const normalizeInteger = (value: unknown): number | undefined => {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'number' && isFinite(value)) return Math.round(value)
  if (typeof value === 'string') {
    const parsed = parseFloat(value.trim())
    if (isFinite(parsed) && !isNaN(parsed)) return Math.round(parsed)
  }
  return undefined
}

const MONTH_SLUGS = [
  'january','february','march','april','may','june',
  'july','august','september','october','november','december',
] as const
const MONTH_LOOKUP: Record<string, string> = {}
MONTH_SLUGS.forEach((slug, i) => {
  MONTH_LOOKUP[slug] = slug
  MONTH_LOOKUP[slug.slice(0, 3)] = slug
  MONTH_LOOKUP[String(i + 1)] = slug
  MONTH_LOOKUP[String(i + 1).padStart(2, '0')] = slug
})

const normalizeMonthArray = (value: unknown): string[] => {
  if (!value) return []
  const source = Array.isArray(value) ? value : [value]
  const result: string[] = []
  for (const entry of source) {
    const key = typeof entry === 'number' ? String(entry) : typeof entry === 'string' ? entry.trim().toLowerCase() : null
    if (key && MONTH_LOOKUP[key] && !result.includes(MONTH_LOOKUP[key])) {
      result.push(MONTH_LOOKUP[key])
    }
  }
  return result
}

// Fields that AI should never overwrite
const IGNORED_FIELDS = new Set([
  'id', 'name', 'images', 'image', 'status',
  'createdBy', 'createdTime', 'updatedBy', 'updatedTime',
])

// Enum field → EnumTools mapping
const ENUM_FIELDS: Record<string, EnumTools> = {
  encyclopediaCategory: encyclopediaCategoryEnum as EnumTools,
  utility: utilityEnum as EnumTools,
  ediblePart: ediblePartEnum as EnumTools,
  poisoningMethod: poisoningMethodEnum as EnumTools,
  lifeCycle: lifeCycleEnum as EnumTools,
  averageLifespan: averageLifespanEnum as EnumTools,
  foliagePersistence: foliagePersistenceEnum as EnumTools,
  livingSpace: livingSpaceEnum as EnumTools,
  season: seasonEnum as EnumTools,
  climate: climateEnum as EnumTools,
  careLevel: careLevelEnum as EnumTools,
  sunlight: sunlightEnum as EnumTools,
  wateringType: wateringTypeEnum as EnumTools,
  division: divisionEnum as EnumTools,
  sowingMethod: sowingMethodEnum as EnumTools,
  conservationStatus: conservationStatusEnum as EnumTools,
  ecologicalTolerance: ecologicalToleranceEnum as EnumTools,
  ecologicalImpact: ecologicalImpactEnum as EnumTools,
}

const SINGLE_ENUM_FIELDS: Record<string, EnumTools> = {
  toxicityHuman: toxicityEnum as EnumTools,
  toxicityPets: toxicityEnum as EnumTools,
}

// Month-based array fields
const MONTH_FIELDS = new Set([
  'featuredMonth', 'sowingMonth', 'floweringMonth', 'fruitingMonth', 'pruningMonth',
])

// Boolean fields
const BOOLEAN_FIELDS = new Set([
  'thorny', 'multicolor', 'bicolor', 'mulchingNeeded', 'staking',
  'transplanting', 'pruning', 'infusion', 'medicinal', 'aromatherapy', 'fragrance',
])

// Integer fields
const INTEGER_FIELDS = new Set([
  'temperatureMax', 'temperatureMin', 'temperatureIdeal',
  'wateringFrequencyWarm', 'wateringFrequencyCold',
  'hygrometry', 'mistingFrequency', 'heightCm', 'wingspanCm',
])

// String (text) fields
const TEXT_FIELDS = new Set([
  'scientificNameSpecies', 'scientificNameVariety', 'family',
  'presentation', 'poisoningSymptoms',
  'soilAdvice', 'mulchAdvice', 'fertilizerAdvice',
  'stakingAdvice', 'sowingAdvice', 'transplantingTime',
  'outdoorPlantingTime', 'pruningAdvice',
  'nutritionalValue', 'infusionBenefits', 'infusionRecipeIdeas',
  'medicinalBenefits', 'medicinalUsage', 'medicinalWarning', 'medicinalHistory',
  'aromatherapyBenefits', 'essentialOilBlends',
  'symbiosisNotes', 'adminCommentary', 'userNotes',
])

// String array (tag) fields
const TAG_FIELDS = new Set([
  'commonNames', 'origin', 'allergens',
  'landscaping', 'plantHabit', 'specialNeeds',
  'substrate', 'substrateMix', 'mulchType', 'nutritionNeed', 'fertilizer',
  'cultivationMode', 'infusionParts',
  'pests', 'diseases',
  'ecologicalStatus', 'biotopes', 'urbanBiotopes',
  'biodiversityRole', 'pollinatorsAttracted', 'birdsAttracted', 'mammalsAttracted',
  'beneficialRoles', 'harmfulRoles', 'symbiosis',
  'ecologicalManagement',
  'companionPlants', 'biotopePlants', 'beneficialPlants', 'harmfulPlants',
  'varieties', 'plantTags', 'biodiversityTags', 'spiceMixes',
])

/**
 * Apply AI-generated data for a single field (section or flat field) to a Plant.
 * The AI can return data either as a flat object with field keys matching the Plant interface,
 * or as a section key (base, identity, care, etc.) with an object of fields.
 */
export function applyAiFieldToPlant(prev: Plant, fieldKey: string, data: unknown): Plant {
  if (IGNORED_FIELDS.has(fieldKey)) return prev

  const next: Plant = { ...prev }

  // If the fieldKey is a section name, data is an object with multiple fields
  const sectionNames = ['base', 'identity', 'care', 'growth', 'danger', 'ecology', 'consumption', 'misc', 'meta']
  if (sectionNames.includes(fieldKey) && data && typeof data === 'object' && !Array.isArray(data)) {
    let result = next
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (IGNORED_FIELDS.has(key)) continue
      result = applySingleField(result, key, value)
    }
    return result
  }

  // Legacy section names → map to new names
  const legacyMap: Record<string, string> = {
    plantType: 'encyclopediaCategory',
    plantCare: 'care',
    usage: 'consumption',
    miscellaneous: 'misc',
  }
  const mappedKey = legacyMap[fieldKey] || fieldKey

  if (sectionNames.includes(mappedKey) && data && typeof data === 'object' && !Array.isArray(data)) {
    let result = next
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (IGNORED_FIELDS.has(key)) continue
      result = applySingleField(result, key, value)
    }
    return result
  }

  return applySingleField(next, mappedKey, data)
}

function applySingleField(plant: Plant, fieldKey: string, data: unknown): Plant {
  if (IGNORED_FIELDS.has(fieldKey) || data === undefined) return plant

  const next = { ...plant } as Plant & Record<string, unknown>

  // Enum array fields
  if (ENUM_FIELDS[fieldKey]) {
    const result = normalizeEnumArrayInput(ENUM_FIELDS[fieldKey], data)
    if (result.shouldUpdate) next[fieldKey] = result.value
    return next
  }

  // Single enum fields
  if (SINGLE_ENUM_FIELDS[fieldKey]) {
    const result = normalizeEnumValueInput(SINGLE_ENUM_FIELDS[fieldKey], data)
    if (result.shouldUpdate) next[fieldKey] = result.value
    return next
  }

  // edibleOil special case
  if (fieldKey === 'edibleOil') {
    if (typeof data === 'string') {
      const lower = data.toLowerCase().trim()
      if (['yes', 'no', 'unknown'].includes(lower)) next.edibleOil = lower as 'yes' | 'no' | 'unknown'
    }
    return next
  }

  // Month array fields
  if (MONTH_FIELDS.has(fieldKey)) {
    next[fieldKey] = normalizeMonthArray(data)
    return next
  }

  // Boolean fields
  if (BOOLEAN_FIELDS.has(fieldKey)) {
    const val = normalizeBoolean(data)
    if (val !== undefined) next[fieldKey] = val
    return next
  }

  // Integer fields
  if (INTEGER_FIELDS.has(fieldKey)) {
    const val = normalizeInteger(data)
    if (val !== undefined) next[fieldKey] = val
    return next
  }

  // Text fields
  if (TEXT_FIELDS.has(fieldKey)) {
    const val = normalizeString(data)
    if (val !== undefined) next[fieldKey] = val
    return next
  }

  // Tag (string array) fields
  if (TAG_FIELDS.has(fieldKey)) {
    const val = normalizeStringArray(data)
    if (val !== undefined) next[fieldKey] = val
    return next
  }

  // Colors — special handling
  if (fieldKey === 'colors') {
    if (Array.isArray(data)) {
      next.colors = data.filter((c: unknown) =>
        c && typeof c === 'object' && 'name' in (c as Record<string, unknown>)
      ) as Plant['colors']
    }
    return next
  }

  // Recipes — special handling
  if (fieldKey === 'recipes') {
    if (Array.isArray(data)) {
      next.recipes = (data as Record<string, unknown>[])
        .filter(item => item && typeof item === 'object' && item.name && typeof item.name === 'string')
        .map(item => ({
          name: String(item.name).trim(),
          category: (recipeCategoryEnum.toUi(item.category as string) || 'Other') as Plant['recipes'] extends (infer U)[] ? U extends { category: infer C } ? C : never : never,
          time: (recipeTimeEnum.toUi(item.time as string) || 'Undefined') as Plant['recipes'] extends (infer U)[] ? U extends { time: infer T } ? T : never : never,
        })) as Plant['recipes']
    }
    return next
  }

  // Sources — special handling
  if (fieldKey === 'sources') {
    if (Array.isArray(data)) {
      next.sources = (data as Record<string, unknown>[])
        .filter(item => item && typeof item === 'object' && item.name)
        .map(item => ({
          name: String(item.name).trim(),
          url: item.url ? String(item.url).trim() : undefined,
        }))
    }
    return next
  }

  // Infusion mixes — special handling
  if (fieldKey === 'infusionMixes' || fieldKey === 'infusionMix') {
    if (Array.isArray(data)) {
      const normalized: Record<string, string> = {}
      for (const item of data as Record<string, unknown>[]) {
        const key = (item?.mix_name || item?.name || item?.key) as string
        const value = (item?.benefit || item?.value || '') as string
        if (key && typeof key === 'string' && key.trim()) {
          normalized[key.trim()] = typeof value === 'string' ? value.trim() : String(value || '')
        }
      }
      next.infusionMixes = normalized
    } else if (data && typeof data === 'object' && !Array.isArray(data)) {
      const normalized: Record<string, string> = {}
      for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
        if (k && k.trim()) normalized[k.trim()] = typeof v === 'string' ? v.trim() : String(v || '')
      }
      next.infusionMixes = normalized
    }
    return next
  }

  // Fallback: set directly if we have a value
  if (data !== null && data !== undefined) {
    next[fieldKey] = data
  }

  return next
}

export function getCategoryForField(fieldKey: string): PlantFormCategory {
  return mapFieldToCategory(fieldKey)
}
