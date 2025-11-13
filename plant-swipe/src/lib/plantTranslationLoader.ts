/**
 * Plant Translation Utilities - Merge translations with base plant data
 * Updated for new JSONB structure
 */

import { supabase } from './supabaseClient'
import type { SupportedLanguage } from './i18n'
import type { Plant } from '@/types/plant'

const sanitizeStringValue = (value: string): string | undefined => {
  const trimmed = value.trim()
  if (!trimmed) return undefined

  const lower = trimmed.toLowerCase()
  if (lower === 'null' || lower === 'undefined') return undefined

  // Remove digits, common numeric punctuation, percent symbols, and whitespace
  // If nothing remains, the string only contained placeholder characters like "0", "0.0", "0%" etc.
  const stripped = trimmed.replace(/[0.,%\s]/g, '')
  if (stripped.length === 0) return undefined

  return trimmed
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null &&
  typeof value === 'object' &&
  (value.constructor === Object || Object.getPrototypeOf(value) === Object.prototype)

const sanitizeDeep = <T>(value: T): T => {
  if (typeof value === 'string') {
    const sanitized = sanitizeStringValue(value)
    return (sanitized === undefined ? undefined : sanitized) as T
  }

  if (Array.isArray(value)) {
    const sanitizedArray = value
      .map((item) => sanitizeDeep(item))
      .filter((item) => {
        if (item === undefined || item === null) return false
        if (Array.isArray(item) && item.length === 0) return false
        if (isPlainObject(item) && Object.keys(item).length === 0) return false
        return true
      })
    return sanitizedArray as unknown as T
  }

  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value)) {
      const sanitized = sanitizeDeep(entry)
      if (sanitized === undefined || sanitized === null) continue
      if (Array.isArray(sanitized) && sanitized.length === 0) continue
      if (isPlainObject(sanitized) && Object.keys(sanitized).length === 0) continue
      result[key] = sanitized
    }
    return result as T
  }

  return value
}

/**
 * Merge translation data with base plant data
 * Handles both new JSONB structure and legacy flat fields
 */
export function mergePlantWithTranslation(
  basePlant: any,
  translation: any | null
): Plant {
  // Parse JSONB fields if they're strings
  const identifiers = typeof basePlant.identifiers === 'string' 
    ? JSON.parse(basePlant.identifiers) 
    : basePlant.identifiers
  const traits = typeof basePlant.traits === 'string' 
    ? JSON.parse(basePlant.traits) 
    : basePlant.traits
  const dimensions = typeof basePlant.dimensions === 'string' 
    ? JSON.parse(basePlant.dimensions) 
    : basePlant.dimensions
  const phenology = typeof basePlant.phenology === 'string' 
    ? JSON.parse(basePlant.phenology) 
    : basePlant.phenology
  const environment = typeof basePlant.environment === 'string' 
    ? JSON.parse(basePlant.environment) 
    : basePlant.environment
  const care = typeof basePlant.care === 'string' 
    ? JSON.parse(basePlant.care) 
    : basePlant.care
  const propagation = typeof basePlant.propagation === 'string' 
    ? JSON.parse(basePlant.propagation) 
    : basePlant.propagation
  const usage = typeof basePlant.usage === 'string' 
    ? JSON.parse(basePlant.usage) 
    : basePlant.usage
  const ecology = typeof basePlant.ecology === 'string' 
    ? JSON.parse(basePlant.ecology) 
    : basePlant.ecology
  const commerce = typeof basePlant.commerce === 'string' 
    ? JSON.parse(basePlant.commerce) 
    : basePlant.commerce
  const problems = typeof basePlant.problems === 'string' 
    ? JSON.parse(basePlant.problems) 
    : basePlant.problems
  const planting = typeof basePlant.planting === 'string' 
    ? JSON.parse(basePlant.planting) 
    : basePlant.planting
  const meta = typeof basePlant.meta === 'string' 
    ? JSON.parse(basePlant.meta) 
    : basePlant.meta

    // Parse translation JSONB if present
    const translationIdentifiers = translation?.identifiers
      ? (typeof translation.identifiers === 'string' ? JSON.parse(translation.identifiers) : translation.identifiers)
      : null
    const translationEcology = translation?.ecology
      ? (typeof translation.ecology === 'string' ? JSON.parse(translation.ecology) : translation.ecology)
      : null
    const translationUsage = translation?.usage
      ? (typeof translation.usage === 'string' ? JSON.parse(translation.usage) : translation.usage)
      : null
    const translationMeta = translation?.meta
      ? (typeof translation.meta === 'string' ? JSON.parse(translation.meta) : translation.meta)
      : null
    const translationPhenology = translation?.phenology
      ? (typeof translation.phenology === 'string' ? JSON.parse(translation.phenology) : translation.phenology)
      : null
    const translationCare = translation?.care
      ? (typeof translation.care === 'string' ? JSON.parse(translation.care) : translation.care)
      : null
    const translationPlanting = translation?.planting
      ? (typeof translation.planting === 'string' ? JSON.parse(translation.planting) : translation.planting)
      : null
    const translationProblems = translation?.problems
      ? (typeof translation.problems === 'string' ? JSON.parse(translation.problems) : translation.problems)
      : null

    const mergedPlant: Plant = {
      id: String(basePlant.id),
      name: translation?.name || basePlant.name || '',
      // New structured format - merge with translations where applicable
      identifiers: {
        ...identifiers,
        ...translationIdentifiers,
        scientificName: translationIdentifiers?.scientificName || identifiers?.scientificName || basePlant.scientific_name || '',
        commonNames: translationIdentifiers?.commonNames || identifiers?.commonNames || undefined,
      },
      traits: traits || undefined,
      dimensions: dimensions || undefined,
      phenology: {
        ...phenology,
        ...translationPhenology,
        flowerColors: phenology?.flowerColors || (Array.isArray(basePlant.colors)
          ? basePlant.colors.map((c: string) => ({ name: c }))
          : undefined),
        floweringMonths: phenology?.floweringMonths || (Array.isArray(basePlant.seasons)
          ? basePlant.seasons.map((s: string) => {
              const monthMap: Record<string, number[]> = {
                Spring: [3, 4, 5],
                Summer: [6, 7, 8],
                Autumn: [9, 10, 11],
                Winter: [12, 1, 2],
              }
              return monthMap[s] || []
            }).flat()
          : undefined),
        scentNotes: translationPhenology?.scentNotes || phenology?.scentNotes || undefined,
      },
      environment: {
        ...environment,
        sunExposure: environment?.sunExposure || (basePlant.care_sunlight === 'High' ? 'full sun'
          : basePlant.care_sunlight === 'Medium' ? 'partial sun'
          : basePlant.care_sunlight === 'Low' ? 'partial shade'
          : undefined),
        soil: {
          ...environment?.soil,
          texture: environment?.soil?.texture || (basePlant.care_soil ? [basePlant.care_soil] : undefined),
        },
      },
      care: (() => {
        const fallbackFrequency = care?.watering?.frequency || {
          spring: basePlant.water_freq_period && basePlant.water_freq_amount
            ? `${basePlant.water_freq_amount} times per ${basePlant.water_freq_period}`
            : undefined,
        }

        const mergedWatering = {
          ...care?.watering,
          ...translationCare?.watering,
          frequency: {
            ...fallbackFrequency,
            ...(translationCare?.watering?.frequency || {}),
          },
        }

        const mergedCare = {
          ...care,
          ...translationCare,
          difficulty: care?.difficulty || (basePlant.care_difficulty === 'Easy' ? 'easy'
            : basePlant.care_difficulty === 'Moderate' ? 'moderate'
            : basePlant.care_difficulty === 'Hard' ? 'advanced'
            : undefined),
          watering: mergedWatering,
        }

        if (translationCare?.fertilizing?.schedule) {
          mergedCare.fertilizing = {
            ...care?.fertilizing,
            ...translationCare.fertilizing,
          }
        }
        if (translationCare?.mulching?.material) {
          mergedCare.mulching = {
            ...care?.mulching,
            ...translationCare.mulching,
          }
        }

        return mergedCare
      })(),
      propagation: propagation || undefined,
      usage: {
        ...usage,
        ...translationUsage,
        gardenUses: usage?.gardenUses || undefined,
        culinaryUses: translationUsage?.culinaryUses || usage?.culinaryUses || undefined,
        medicinalUses: translationUsage?.medicinalUses || usage?.medicinalUses || undefined,
      },
      ecology: {
        ...ecology,
        ...translationEcology,
        nativeRange: translationEcology?.nativeRange || ecology?.nativeRange || undefined,
        wildlifeValue: translationEcology?.wildlifeValue || ecology?.wildlifeValue || undefined,
      },
      commerce: {
        ...commerce,
        seedsAvailable: commerce?.seedsAvailable ?? basePlant.seeds_available ?? false,
      },
      problems: {
        ...problems,
        ...translationProblems,
        pests: translationProblems?.pests || problems?.pests || undefined,
        diseases: translationProblems?.diseases || problems?.diseases || undefined,
        hazards: translationProblems?.hazards || problems?.hazards || undefined,
      },
      planting: {
        ...planting,
        ...translationPlanting,
        calendar: {
          ...planting?.calendar,
          promotionMonth: planting?.calendar?.promotionMonth || (Array.isArray(basePlant.plant_month) && basePlant.plant_month.length > 0
            ? basePlant.plant_month[0]
            : undefined),
        },
        sitePrep: translationPlanting?.sitePrep || planting?.sitePrep || undefined,
        companionPlants: translationPlanting?.companionPlants || planting?.companionPlants || undefined,
        avoidNear: translationPlanting?.avoidNear || planting?.avoidNear || undefined,
      },
      meta: {
        ...meta,
        ...translationMeta,
        rarity: meta?.rarity || (basePlant.rarity === 'Common' ? 'common'
          : basePlant.rarity === 'Uncommon' ? 'uncommon'
          : basePlant.rarity === 'Rare' ? 'rare'
          : basePlant.rarity === 'Legendary' ? 'very rare'
          : undefined),
        authorNotes: translationMeta?.authorNotes || meta?.authorNotes || basePlant.author_notes || undefined,
        funFact: translationMeta?.funFact || meta?.funFact || basePlant.meaning || undefined,
      },
      // Legacy fields for backward compatibility
      scientificName: translation?.scientific_name || basePlant.scientific_name || identifiers?.scientificName || '',
      colors: Array.isArray(basePlant.colors) ? basePlant.colors.map((c: unknown) => String(c)) : [],
      seasons: Array.isArray(basePlant.seasons) ? (basePlant.seasons as unknown[]).map((s) => String(s)) as Plant['seasons'] : [],
      rarity: (basePlant.rarity || 'Common') as Plant['rarity'],
      meaning: translation?.meaning || basePlant.meaning || '',
      description: translation?.description || basePlant.description || '',
      image: basePlant.image_url || basePlant.image || '',
      seedsAvailable: Boolean(basePlant.seeds_available ?? commerce?.seedsAvailable ?? false),
      waterFreqUnit: basePlant.water_freq_unit || basePlant.waterFreqUnit || undefined,
      waterFreqValue: basePlant.water_freq_value ?? basePlant.waterFreqValue ?? null,
      waterFreqPeriod: basePlant.water_freq_period || basePlant.waterFreqPeriod || undefined,
      waterFreqAmount: basePlant.water_freq_amount ?? basePlant.waterFreqAmount ?? null,
    }

    const sanitizedPlant = sanitizeDeep(mergedPlant) as Plant

    return {
      ...sanitizedPlant,
      id: String(basePlant.id),
      name: sanitizedPlant.name ?? '',
      colors: Array.isArray(sanitizedPlant.colors) ? sanitizedPlant.colors : [],
      seasons: Array.isArray(sanitizedPlant.seasons) ? sanitizedPlant.seasons as Plant['seasons'] : [],
    }
}

/**
 * Load plants with translations for a specific language
 * Always loads translations for the specified language, regardless of whether it's the default language.
 * This ensures plants created in one language display correctly when viewed in another language.
 */
export async function loadPlantsWithTranslations(language: SupportedLanguage): Promise<Plant[]> {
  try {
    // Load base plants with all JSONB fields
    const { data: plants, error } = await supabase
      .from('plants')
      .select('id, name, scientific_name, colors, seasons, rarity, meaning, description, image_url, care_sunlight, care_water, care_soil, care_difficulty, seeds_available, water_freq_unit, water_freq_value, water_freq_period, water_freq_amount, identifiers, traits, dimensions, phenology, environment, care, propagation, usage, ecology, commerce, problems, planting, meta')
      .order('name', { ascending: true })
    
    if (error) throw error
    if (!plants || plants.length === 0) return []
    
    // Always load translations for the specified language (including English)
    // This ensures plants created in one language display correctly in another
    const plantIds = plants.map(p => p.id)
    const { data: translations } = await supabase
      .from('plant_translations')
      .select('*')
      .eq('language', language)
      .in('plant_id', plantIds)
    
    // Create a map of translations by plant_id
    const translationMap = new Map()
    if (translations) {
      translations.forEach(t => {
        translationMap.set(t.plant_id, t)
      })
    }
    
    // Merge translations with base plants
    // If a translation exists, it will override the base plant data
    return plants.map(plant => {
      const translation = translationMap.get(plant.id)
      return mergePlantWithTranslation(plant, translation)
    })
  } catch (error) {
    console.error('Failed to load plants with translations:', error)
    throw error
  }
}
