/**
 * Plant Translation Utilities - Merge translations with base plant data
 * Updated for new JSONB structure
 */

import { supabase } from './supabaseClient'
import type { SupportedLanguage } from './i18n'
import type { Plant, PlantImage, PlantSeason } from '@/types/plant'
import { getPrimaryPhotoUrl, normalizePlantPhotos } from '@/lib/photos'
import { monthSlugToNumber, monthSlugsToNumbers } from '@/lib/months'
import {
  expandCompositionFromDb,
  expandFoliagePersistanceFromDb,
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
} from '@/lib/composition'

type IdentityComposition = NonNullable<Plant["identity"]>["composition"]
type PlantCareData = NonNullable<Plant["plantCare"]>
type PlantGrowthData = NonNullable<Plant["growth"]>
type PlantEcologyData = NonNullable<Plant["ecology"]>

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
          sunExposure: environment?.sunExposure || basePlant.level_sun || undefined,
          soil: {
            ...environment?.soil,
            texture: environment?.soil?.texture || (Array.isArray(basePlant.soil) ? basePlant.soil : undefined),
          },
        },
      care: (() => {
          const fallbackFrequency = care?.watering?.frequency || {}

        const mergedWatering = {
          ...care?.watering,
          ...translationCare?.watering,
          frequency: {
            ...fallbackFrequency,
            ...(translationCare?.watering?.frequency || {}),
          },
        }

          const difficultyMap: Record<string, string> = {
            none: 'easy',
            low: 'easy',
            moderate: 'moderate',
            heavy: 'advanced',
          }

          const normalizedDifficulty = typeof basePlant.maintenance_level === 'string'
            ? basePlant.maintenance_level.toLowerCase()
            : undefined

          const mergedCare = {
          ...care,
            ...translationCare,
            difficulty: care?.difficulty || (normalizedDifficulty ? (difficultyMap[normalizedDifficulty] || normalizedDifficulty) : undefined),
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
 * All translatable fields are stored in plant_translations for ALL languages (including English)
 */
export async function loadPlantsWithTranslations(language: SupportedLanguage): Promise<Plant[]> {
    try {
      const TOP_LIKED_LIMIT = 5
      
      const [plantsResponse, topLikedResponse] = await Promise.all([
        supabase
          .from('plants')
          .select('*, plant_images (link,use), plant_colors (colors (id,name,hex_code)), plant_watering_schedules (season,quantity,time_period), plant_sources (id,name,url), plant_infusion_mixes (mix_name,benefit)')
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

    // Load translations for ALL languages (including English)
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
        const seasons: PlantSeason[] = seasonEnum.toUiArray(seasonsRaw) as PlantSeason[]
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
        const sources = ((basePlant.plant_sources as any[]) || [])
          .map((src) => ({
            id: src?.id,
            name: src?.name,
            url: src?.url,
          }))
          .filter((src) => src.name)
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

        const infusionMixRows = ((basePlant.plant_infusion_mixes as any[]) || [])
        const infusionMix = infusionMixRows.reduce((acc: Record<string, string>, row) => {
          const key = row?.mix_name?.trim()
          if (!key) return acc
          acc[key] = row?.benefit?.trim() || ''
          return acc
        }, {} as Record<string, string>)

          const plant: Plant = {
            id: String(basePlant.id),
            name: translation.name || basePlant.name || '',
            // Non-translatable fields from plants table
            plantType: (plantTypeEnum.toUi(basePlant.plant_type) as Plant["plantType"]) || undefined,
            utility: utilityEnum.toUiArray(basePlant.utility) as Plant["utility"],
            comestiblePart: comestiblePartEnum.toUiArray(basePlant.comestible_part) as Plant["comestiblePart"],
            fruitType: fruitTypeEnum.toUiArray(basePlant.fruit_type) as Plant["fruitType"],
            images,
            image: primaryImage,
            identity: {
              // Translatable fields from plant_translations only
              givenNames: translation.given_names || [],
              // Non-translatable fields from plants table
              scientificName: basePlant.scientific_name || undefined,
              // Translatable fields from plant_translations only
              family: translation.family || undefined,
              overview: translation.overview || undefined,
              // Non-translatable field from plants table
              promotionMonth: monthSlugToNumber(basePlant.promotion_month) ?? undefined,
              lifeCycle: (lifeCycleEnum.toUi(translation.life_cycle) as NonNullable<Plant["identity"]>["lifeCycle"]) || undefined,
              season: seasons,
              foliagePersistance: expandFoliagePersistanceFromDb(translation.foliage_persistance),
              // Non-translatable fields from plants table
              spiked: basePlant.spiked ?? false,
              // Translatable fields from plant_translations only
              toxicityHuman: (toxicityEnum.toUi(translation.toxicity_human) as NonNullable<Plant["identity"]>["toxicityHuman"]) || undefined,
              toxicityPets: (toxicityEnum.toUi(translation.toxicity_pets) as NonNullable<Plant["identity"]>["toxicityPets"]) || undefined,
              allergens: translation.allergens || [],
              // Non-translatable fields from plants table
              scent: basePlant.scent ?? false,
              // Translatable fields from plant_translations only
              symbolism: translation.symbolism || [],
              livingSpace: (livingSpaceEnum.toUi(translation.living_space) as NonNullable<Plant["identity"]>["livingSpace"]) || undefined,
              composition: expandCompositionFromDb(translation.composition || []) as IdentityComposition,
              maintenanceLevel: (maintenanceLevelEnum.toUi(translation.maintenance_level) as NonNullable<Plant["identity"]>["maintenanceLevel"]) || undefined,
              colors: colorObjects,
              // Non-translatable fields from plants table
              multicolor: basePlant.multicolor ?? false,
              bicolor: basePlant.bicolor ?? false,
            },
            plantCare: {
              // Translatable fields from plant_translations only
              origin: translation.origin || [],
              habitat: habitatEnum.toUiArray(translation.habitat) as PlantCareData["habitat"],
              // Non-translatable fields from plants table
              temperatureMax: basePlant.temperature_max || undefined,
              temperatureMin: basePlant.temperature_min || undefined,
              temperatureIdeal: basePlant.temperature_ideal || undefined,
              // Translatable fields from plant_translations only
              levelSun: (levelSunEnum.toUi(translation.level_sun) as PlantCareData["levelSun"]) || undefined,
              // Non-translatable fields from plants table
              hygrometry: basePlant.hygrometry || undefined,
              wateringType: wateringTypeEnum.toUiArray(basePlant.watering_type) as PlantCareData["wateringType"],
              division: divisionEnum.toUiArray(basePlant.division) as PlantCareData["division"],
              soil: soilEnum.toUiArray(basePlant.soil) as PlantCareData["soil"],
              // Translatable fields from plant_translations only
              adviceSoil: translation.advice_soil || undefined,
              // Non-translatable fields from plants table
              mulching: mulchingEnum.toUiArray(basePlant.mulching) as PlantCareData["mulching"],
              // Translatable fields from plant_translations only
              adviceMulching: translation.advice_mulching || undefined,
              // Non-translatable fields from plants table
              nutritionNeed: nutritionNeedEnum.toUiArray(basePlant.nutrition_need) as PlantCareData["nutritionNeed"],
              fertilizer: fertilizerEnum.toUiArray(basePlant.fertilizer) as PlantCareData["fertilizer"],
              // Translatable fields from plant_translations only
              adviceFertilizer: translation.advice_fertilizer || undefined,
              watering: {
                schedules,
              },
            },
            growth: {
              // Non-translatable fields from plants table
              sowingMonth: monthSlugsToNumbers(basePlant.sowing_month),
              floweringMonth: monthSlugsToNumbers(basePlant.flowering_month),
              fruitingMonth: monthSlugsToNumbers(basePlant.fruiting_month),
              height: basePlant.height_cm || undefined,
              wingspan: basePlant.wingspan_cm || undefined,
              tutoring: basePlant.tutoring || false,
              // Translatable fields from plant_translations only
              adviceTutoring: translation.advice_tutoring || undefined,
              // Non-translatable fields from plants table
              sowType: sowTypeEnum.toUiArray(basePlant.sow_type) as PlantGrowthData["sowType"],
              separation: basePlant.separation_cm || undefined,
              transplanting: basePlant.transplanting || undefined,
              // Translatable fields from plant_translations only
              adviceSowing: translation.advice_sowing || undefined,
              cut: translation.cut || undefined,
            },
            usage: {
              // Translatable fields from plant_translations only
              adviceMedicinal: translation.advice_medicinal || undefined,
              nutritionalIntake: translation.nutritional_intake || [],
              // Non-translatable fields from plants table
              infusion: basePlant.infusion || false,
              // Translatable fields from plant_translations only
              adviceInfusion: translation.advice_infusion || undefined,
              infusionMix,
              recipesIdeas: translation.recipes_ideas || [],
              // Non-translatable fields from plants table
              aromatherapy: basePlant.aromatherapy || false,
              spiceMixes: basePlant.spice_mixes || [],
            },
            ecology: {
              // Non-translatable fields from plants table
              melliferous: basePlant.melliferous || false,
              polenizer: polenizerEnum.toUiArray(basePlant.polenizer) as PlantEcologyData["polenizer"],
              beFertilizer: basePlant.be_fertilizer || false,
              // Translatable fields from plant_translations only
              groundEffect: translation.ground_effect || undefined,
              // Non-translatable fields from plants table
              conservationStatus: (conservationStatusEnum.toUi(basePlant.conservation_status) as PlantEcologyData["conservationStatus"]) || undefined,
            },
            danger: {
              pests: basePlant.pests || [],
              diseases: basePlant.diseases || [],
            },
            miscellaneous: {
              companions: basePlant.companions || [],
              // Translatable fields from plant_translations only
              tags: translation.tags || [],
              sources,
            },
            meta: {
              status: basePlant.status || undefined,
              adminCommentary: basePlant.admin_commentary || undefined,
              createdBy: basePlant.created_by || undefined,
              createdAt: basePlant.created_time || basePlant.created_at || undefined,
              updatedBy: basePlant.updated_by || undefined,
              updatedAt: basePlant.updated_time || basePlant.updated_at || undefined,
            },
            seasons,
            colors: colorObjects.map((c) => c.name as string),
            // Non-translatable fields from plants table
            multicolor: basePlant.multicolor ?? false,
            bicolor: basePlant.bicolor ?? false,
            // Translatable fields from plant_translations only
            description: translation.overview || '',
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

/**
 * Optimized loader for plant previews (discovery/swipe/search)
 * Fetches only the fields necessary for listing, filtering, and swipe cards.
 * All translatable fields are stored in plant_translations for ALL languages (including English)
 */
export async function loadPlantPreviews(language: SupportedLanguage): Promise<Plant[]> {
  try {
    const TOP_LIKED_LIMIT = 5
    
    const plantColumns = [
      'id', 'name', 'scientific_name', 'plant_type', 
      'utility', 'comestible_part', 'fruit_type',
      'season', 
      'level_sun', 
      'created_time', 'updated_time',
      'scent', 'aromatherapy', 'advice_medicinal', 'origin', 'composition',
      'plant_images (link,use)',
      'plant_colors (colors (id,name,hex_code))',
      'plant_watering_schedules (season,quantity,time_period)',
      'plant_sources (id,name,url)',
    ].join(',')

    const [plantsResponse, topLikedResponse] = await Promise.all([
      supabase
        .from('plants')
        .select(plantColumns)
        .order('name', { ascending: true }),
      supabase.rpc('top_liked_plants', { limit_count: TOP_LIKED_LIMIT }),
    ])

    const { data: plantsData, error } = plantsResponse
    const plants = plantsData as any[]
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

    // Load translations for ALL languages (including English)
    const plantIds = plants.map((p) => p.id)
    const { data: translationsData } = await supabase
      .from('plant_translations')
      .select('*')
      .eq('language', language)
      .in('plant_id', plantIds)

    const translationMap = new Map<string, any>()
    const translations = translationsData as any[]
    if (translations) {
      translations.forEach((t) => translationMap.set(t.plant_id, t))
    }

    const toTitleCase = (val: string | null | undefined): string | undefined => {
      if (!val) return undefined
      return val.charAt(0).toUpperCase() + val.slice(1)
    }

    return plants.map((basePlant: any) => {
      // Translation contains translated data, fallback to plants table if not found
      const translation = translationMap.get(basePlant.id) || {}
      
      const parseIfNeeded = (val: any) => (typeof val === 'string' ? JSON.parse(val) : val)
      
      // Try to get JSONB fields if they exist, otherwise fallback to empty
      const transIdentity = parseIfNeeded(translation.identity) || {}
      const transUsage = parseIfNeeded(translation.usage) || {}
      const transEcology = parseIfNeeded(translation.ecology) || {}
      
      const colorObjects = ((basePlant.plant_colors as any[]) || []).map((pc) => ({
        id: pc?.colors?.id,
        name: pc?.colors?.name,
        hexCode: pc?.colors?.hex_code,
      })).filter((c) => c.name)

      const seasonsRaw = translation.season ?? basePlant.season ?? []
      const seasons: PlantSeason[] = seasonEnum.toUiArray(seasonsRaw) as PlantSeason[]

      const images: PlantImage[] = ((basePlant.plant_images as any[]) || []).map((img) => ({
        link: img?.link,
        use: img?.use,
      }))
      const primaryImage = images.find((i) => i.use === 'primary')?.link
        || images.find((i) => i.use === 'discovery')?.link
        || images[0]?.link

      // Merge flat columns into structured objects to match Plant interface
      const mergedIdentity = {
        ...transIdentity,
        scientificName: translation.scientific_name || basePlant.scientific_name || transIdentity.scientificName,
        promotionMonth: monthSlugToNumber(translation.promotion_month || basePlant.promotion_month) ?? undefined,
        colors: colorObjects,
        season: seasons,
        scent: basePlant.scent ?? transIdentity.scent ?? false,
        // Map other flat fields if needed for preview
      }

      const mergedUsage = {
        ...transUsage,
        adviceMedicinal: translation.advice_medicinal || transUsage.adviceMedicinal || basePlant.advice_medicinal,
        aromatherapy: basePlant.aromatherapy ?? transUsage.aromatherapy ?? false,
      }
      
      const mergedEcology = {
        ...transEcology,
        nativeRange: translation.origin || transEcology.nativeRange || basePlant.origin || undefined,
      }

      const containerFriendly = basePlant.composition && Array.isArray(basePlant.composition) && basePlant.composition.includes('pot')

      const plant: Plant = {
        id: String(basePlant.id),
        name: translation.name || basePlant.name || '',
        scientificName: translation.scientific_name || basePlant.scientific_name || '',
        meaning: translation.meaning || '',
        plantType: (plantTypeEnum.toUi(basePlant.plant_type) as Plant["plantType"]) || undefined,
        utility: utilityEnum.toUiArray(basePlant.utility) as Plant["utility"],
        comestiblePart: comestiblePartEnum.toUiArray(basePlant.comestible_part) as Plant["comestiblePart"],
        fruitType: fruitTypeEnum.toUiArray(basePlant.fruit_type) as Plant["fruitType"],
        
        images,
        image: primaryImage,
        
        identity: mergedIdentity,
        usage: mergedUsage,
        ecology: mergedEcology,

        dimensions: {
            containerFriendly
        },
        
        plantCare: {
          levelSun: (levelSunEnum.toUi(basePlant.level_sun) as PlantCareData["levelSun"]) || undefined,
          watering: {
            schedules: ((basePlant.plant_watering_schedules as any[]) || []).map((row) => ({
               season: row?.season ? toTitleCase(row.season) : undefined,
               quantity: row?.quantity !== null ? Number(row.quantity) : undefined,
               timePeriod: row?.time_period || undefined,
            })).filter((e) => e.season || e.quantity !== undefined || e.timePeriod),
          }
        },
        
        colors: colorObjects.map((c) => c.name as string),
        seasons,
        rarity: 'Common',
        seedsAvailable: false,
        
        waterFreqUnit: undefined,
        waterFreqValue: undefined,
        waterFreqPeriod: undefined,
        waterFreqAmount: undefined,
        
        popularity: popularityMap.get(String(basePlant.id)),
        meta: {
            createdAt: basePlant.created_time,
            updatedAt: basePlant.updated_time,
        },
        
        planting: {
            calendar: {
                promotionMonth: basePlant.promotion_month
            }
        },
        
        classification: basePlant.plant_type ? { type: basePlant.plant_type } : undefined,
      }
      
      return sanitizeDeep(plant) as Plant
    })

  } catch (error) {
    console.error('Failed to load plant previews:', error)
    return [] 
  }
}
