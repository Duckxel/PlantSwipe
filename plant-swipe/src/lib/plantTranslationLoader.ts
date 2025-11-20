/**
 * Plant Translation Utilities - Merge translations with base plant data
 * Updated for new JSONB structure
 */

import { supabase } from './supabaseClient'
import type { SupportedLanguage } from './i18n'
import type { Plant, PlantImage, PlantSeason } from '@/types/plant'
import { getPrimaryPhotoUrl, normalizePlantPhotos } from '@/lib/photos'

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
    const classification = typeof basePlant.classification === 'string'
      ? JSON.parse(basePlant.classification)
      : basePlant.classification

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
    const normalizedPhotos = normalizePlantPhotos(basePlant.photos, basePlant.image_url || basePlant.image)

    const mergedPlant: Plant = {
      id: String(basePlant.id),
      name: translation?.name || basePlant.name || '',
    photos: normalizedPhotos,
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
          funFact: translationMeta?.funFact || meta?.funFact || undefined,
          createdAt: translationMeta?.createdAt || meta?.createdAt || basePlant.created_at || undefined,
          updatedAt: translationMeta?.updatedAt || meta?.updatedAt || basePlant.updated_at || undefined,
        },
        // Legacy fields for backward compatibility
      scientificName: translation?.scientific_name || basePlant.scientific_name || identifiers?.scientificName || '',
      colors: Array.isArray(basePlant.colors) ? basePlant.colors.map((c: unknown) => String(c)) : [],
      seasons: Array.isArray(basePlant.seasons) ? (basePlant.seasons as unknown[]).map((s) => String(s)) as Plant['seasons'] : [],
      rarity: (basePlant.rarity || 'Common') as Plant['rarity'],
      meaning: translation?.meaning || basePlant.meaning || '',
      description: translation?.description || basePlant.description || '',
    image: getPrimaryPhotoUrl(normalizedPhotos) || basePlant.image_url || basePlant.image || '',
      seedsAvailable: Boolean(basePlant.seeds_available ?? commerce?.seedsAvailable ?? false),
      waterFreqUnit: basePlant.water_freq_unit || basePlant.waterFreqUnit || undefined,
      waterFreqValue: basePlant.water_freq_value ?? basePlant.waterFreqValue ?? null,
      waterFreqPeriod: basePlant.water_freq_period || basePlant.waterFreqPeriod || undefined,
        waterFreqAmount: basePlant.water_freq_amount ?? basePlant.waterFreqAmount ?? null,
        classification: classification || undefined,
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
    const TOP_LIKED_LIMIT = 5
    const [plantsResponse, topLikedResponse] = await Promise.all([
      supabase
        .from('plants')
        .select('*, plant_images (link,use), plant_colors (colors (id,name,hex_code)), plant_watering_schedules (season,quantity,time_period), plant_sources (id,name,url)')
        .order('name', { ascending: true }),
      supabase.rpc('top_liked_plants', { limit_count: TOP_LIKED_LIMIT }),
    ])
    const { data: plants, error } = plantsResponse
    const { data: topLiked, error: topLikedError } = topLikedResponse

    if (error) throw error
    if (!plants || plants.length === 0) return []

    if (topLikedError) {
      console.warn('Failed to load top liked plants', topLikedError)
    }

    const popularityMap = new Map<string, { likes: number; rank: number }>()
    if (Array.isArray(topLiked)) {
      topLiked.forEach((entry, index) => {
        if (!entry || !entry.plant_id) return
        const likesNumber = typeof entry.likes === 'number' ? entry.likes : Number(entry.likes ?? 0)
        popularityMap.set(String(entry.plant_id), {
          likes: likesNumber,
          rank: index + 1,
        })
      })
    }

    const plantIds = plants.map((p) => p.id)
    const { data: translations } = await supabase
      .from('plant_translations')
      .select('*')
      .eq('language', language)
      .in('plant_id', plantIds)

    const translationMap = new Map<string, any>()
    if (translations) {
      translations.forEach((t) => translationMap.set(t.plant_id, t))
    }

    const toTitleCase = (val: string | null | undefined): string | undefined => {
      if (!val) return undefined
      return val.charAt(0).toUpperCase() + val.slice(1)
    }

    return plants.map((basePlant: any) => {
      const translation = translationMap.get(basePlant.id) || {}
      const colorObjects = ((basePlant.plant_colors as any[]) || []).map((pc) => ({
        id: pc?.colors?.id,
        name: pc?.colors?.name,
        hexCode: pc?.colors?.hex_code,
      })).filter((c) => c.name)
      const seasonsRaw = translation.season ?? basePlant.season ?? []
      const seasons: PlantSeason[] = Array.isArray(seasonsRaw)
        ? seasonsRaw.map((s: string) => toTitleCase(s) as PlantSeason).filter(Boolean)
        : []
      const images: PlantImage[] = ((basePlant.plant_images as any[]) || []).map((img) => ({
        link: img?.link,
        use: img?.use,
      }))
      const schedules = ((basePlant.plant_watering_schedules as any[]) || []).map((row) => {
        const seasonValue = row?.season ? toTitleCase(row.season) : undefined
        const quantityValue = row?.quantity !== null && row?.quantity !== undefined ? Number(row.quantity) : undefined
        return {
          season: seasonValue,
          quantity: quantityValue,
          timePeriod: row?.time_period || undefined,
        }
      }).filter((entry) => entry.season || entry.quantity !== undefined || entry.timePeriod)
      const sources = ((basePlant.plant_sources as any[]) || []).map((src) => ({
        id: src?.id,
        name: src?.name,
        url: src?.url,
      })).filter((src) => src.name)
      if (!sources.length && (translation.source_name || basePlant.source_name)) {
        sources.push({
          id: `${basePlant.id}-legacy-source-${sources.length}`,
          name: translation.source_name || basePlant.source_name,
          url: translation.source_url || basePlant.source_url,
        })
      }
      const primaryImage = images.find((i) => i.use === 'primary')?.link
        || images.find((i) => i.use === 'discovery')?.link
        || images[0]?.link

      const plant: Plant = {
        id: String(basePlant.id),
        name: translation.name || basePlant.name || '',
        plantType: basePlant.plant_type || undefined,
        utility: basePlant.utility || [],
        comestiblePart: basePlant.comestible_part || [],
        fruitType: basePlant.fruit_type || [],
        images,
        image: primaryImage,
        identity: {
          givenNames: translation.given_names || basePlant.given_names || [],
          scientificName: translation.scientific_name || basePlant.scientific_name || undefined,
          family: translation.family || basePlant.family || undefined,
          overview: translation.overview || basePlant.overview || undefined,
          promotionMonth: translation.promotion_month || basePlant.promotion_month || undefined,
          lifeCycle: translation.life_cycle || basePlant.life_cycle || undefined,
          season: seasons,
          foliagePersistance: translation.foliage_persistance || basePlant.foliage_persistance || undefined,
          spiked: basePlant.spiked ?? false,
          toxicityHuman: translation.toxicity_human || basePlant.toxicity_human || undefined,
          toxicityPets: translation.toxicity_pets || basePlant.toxicity_pets || undefined,
          allergens: translation.allergens || basePlant.allergens || [],
          scent: basePlant.scent ?? false,
          symbolism: translation.symbolism || basePlant.symbolism || [],
          livingSpace: translation.living_space || basePlant.living_space || undefined,
          composition: translation.composition || basePlant.composition || [],
          maintenanceLevel: translation.maintenance_level || basePlant.maintenance_level || undefined,
          colors: colorObjects,
          multicolor: basePlant.multicolor ?? false,
          bicolor: basePlant.bicolor ?? false,
        },
        plantCare: {
          origin: translation.origin || basePlant.origin || [],
          habitat: translation.habitat || basePlant.habitat || [],
          temperatureMax: basePlant.temperature_max || undefined,
          temperatureMin: basePlant.temperature_min || undefined,
          temperatureIdeal: basePlant.temperature_ideal || undefined,
          levelSun: basePlant.level_sun || undefined,
          hygrometry: basePlant.hygrometry || undefined,
          wateringType: basePlant.watering_type || [],
          division: basePlant.division || [],
          soil: basePlant.soil || [],
          adviceSoil: translation.advice_soil || basePlant.advice_soil || undefined,
          mulching: basePlant.mulching || [],
          adviceMulching: translation.advice_mulching || basePlant.advice_mulching || undefined,
          nutritionNeed: basePlant.nutrition_need || [],
          fertilizer: basePlant.fertilizer || [],
          adviceFertilizer: translation.advice_fertilizer || basePlant.advice_fertilizer || undefined,
          watering: {
            schedules,
          },
        },
        growth: {
          sowingMonth: basePlant.sowing_month || [],
          floweringMonth: basePlant.flowering_month || [],
          fruitingMonth: basePlant.fruiting_month || [],
          height: basePlant.height_cm || undefined,
          wingspan: basePlant.wingspan_cm || undefined,
          tutoring: basePlant.tutoring || false,
          adviceTutoring: translation.advice_tutoring || basePlant.advice_tutoring || undefined,
          sowType: basePlant.sow_type || [],
          separation: basePlant.separation_cm || undefined,
          transplanting: basePlant.transplanting || undefined,
          adviceSowing: translation.advice_sowing || basePlant.advice_sowing || undefined,
          cut: basePlant.cut || undefined,
        },
        usage: {
          adviceMedicinal: translation.advice_medicinal || basePlant.advice_medicinal || undefined,
          nutritionalIntake: basePlant.nutritional_intake || [],
          infusion: basePlant.infusion || false,
          adviceInfusion: translation.advice_infusion || basePlant.advice_infusion || undefined,
          infusionMix: basePlant.infusion_mix || [],
          recipesIdeas: basePlant.recipes_ideas || [],
          aromatherapy: basePlant.aromatherapy || false,
          spiceMixes: basePlant.spice_mixes || [],
        },
        ecology: {
          melliferous: basePlant.melliferous || false,
          polenizer: basePlant.polenizer || [],
          beFertilizer: basePlant.be_fertilizer || false,
          groundEffect: translation.ground_effect || basePlant.ground_effect || undefined,
          conservationStatus: basePlant.conservation_status || undefined,
        },
        danger: {
          pests: basePlant.pests || [],
          diseases: basePlant.diseases || [],
        },
        miscellaneous: {
          companions: basePlant.companions || [],
          tags: basePlant.tags || [],
          sources,
        },
        meta: {
          status: basePlant.status || undefined,
          adminCommentary: translation.admin_commentary || basePlant.admin_commentary || undefined,
          createdBy: basePlant.created_by || undefined,
          createdAt: basePlant.created_time || basePlant.created_at || undefined,
          updatedBy: basePlant.updated_by || undefined,
          updatedAt: basePlant.updated_time || basePlant.updated_at || undefined,
        },
        seasons,
        colors: colorObjects.map((c) => c.name as string),
        multicolor: basePlant.multicolor ?? false,
        bicolor: basePlant.bicolor ?? false,
        description: translation.overview || basePlant.overview || '',
        rarity: (basePlant.rarity || 'Common') as Plant['rarity'],
        classification: basePlant.plant_type ? { type: basePlant.plant_type } : undefined,
        popularity: popularityMap.get(String(basePlant.id)),
      }

      return sanitizeDeep(plant) as Plant
    })
  } catch (error) {
    console.error('Failed to load plants with translations:', error)
    try {
      const { data: fallbackPlants } = await supabase
        .from('plants')
        .select('id,name,scientific_name,plant_type,overview,season,plant_images (link,use), plant_colors (colors (name,hex_code)), plant_sources (name,url)')
        .order('name', { ascending: true })
      if (!fallbackPlants) return []
      return fallbackPlants.map((row: any) => {
        const images: PlantImage[] = ((row.plant_images as any[]) || []).map((img) => ({ link: img?.link, use: img?.use }))
        const primaryImage = images.find((i) => i.use === 'primary')?.link || images.find((i) => i.use === 'discovery')?.link || images[0]?.link
        const colors = ((row.plant_colors as any[]) || []).map((c) => c?.colors?.name).filter(Boolean) as string[]
        const sources = ((row.plant_sources as any[]) || []).map((src) => ({ name: src?.name, url: src?.url })).filter((s) => s.name)
        const seasonsRaw = row.season || []
        const seasons: PlantSeason[] = Array.isArray(seasonsRaw)
          ? seasonsRaw.map((s: string) => (s ? (s.charAt(0).toUpperCase() + s.slice(1)) as PlantSeason : undefined)).filter(Boolean) as PlantSeason[]
          : []
        return {
          id: String(row.id),
          name: row.name || '',
          identity: { scientificName: row.scientific_name || undefined, season: seasons },
          miscellaneous: { sources },
          plantType: row.plant_type || undefined,
          description: row.overview || '',
          images,
          image: primaryImage,
          colors,
          seasons,
        } as Plant
      })
    } catch (fallbackError) {
      console.error('Fallback plant load failed', fallbackError)
      return []
    }
  }
}
