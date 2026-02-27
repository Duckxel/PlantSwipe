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
/* eslint-disable @typescript-eslint/no-explicit-any -- dynamic translation payload processing */

type IdentityComposition = NonNullable<Plant["identity"]>["composition"]
type PlantCareData = NonNullable<Plant["plantCare"]>
type PlantGrowthData = NonNullable<Plant["growth"]>
type PlantEcologyData = NonNullable<Plant["ecology"]>

// Pre-compiled regex for better performance
const STRIP_REGEX = /[0.,%\s]/g

const sanitizeStringValue = (value: string): string | undefined => {
  const trimmed = value.trim()
  if (!trimmed) return undefined

  // Check for literal "null" or "undefined" strings
  if (trimmed.length < 10) { // Optimization: only check short strings
    const lower = trimmed.toLowerCase()
    if (lower === 'null' || lower === 'undefined') return undefined
  }

  // Remove digits, common numeric punctuation, percent symbols, and whitespace
  // If nothing remains, the string only contained placeholder characters like "0", "0.0", "0%" etc.
  const stripped = trimmed.replace(STRIP_REGEX, '')
  if (stripped.length === 0) return undefined

  return trimmed
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null &&
  typeof value === 'object' &&
  (value.constructor === Object || Object.getPrototypeOf(value) === Object.prototype)

// Optimized deep sanitizer that avoids excessive object/array creation
const sanitizeDeep = <T>(value: T): T => {
  if (typeof value === 'string') {
    const sanitized = sanitizeStringValue(value)
    return (sanitized === undefined ? undefined : sanitized) as T
  }

  if (Array.isArray(value)) {
    // Optimization: Use single loop with push instead of map().filter()
    // This avoids iterating twice and creating intermediate arrays
    const result: any[] = []
    for (let i = 0; i < value.length; i++) {
      const sanitized = sanitizeDeep(value[i])
      if (sanitized === undefined || sanitized === null) continue
      if (Array.isArray(sanitized) && sanitized.length === 0) continue
      if (isPlainObject(sanitized)) {
        // Check for empty object without creating keys array if possible
        // using for...in loop is faster than Object.keys(obj).length for just checking emptiness
        let isEmpty = true
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for (const _ in sanitized) {
          isEmpty = false
          break
        }
        if (isEmpty) continue
      }
      result.push(sanitized)
    }
    return result as unknown as T
  }

  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {}
    // Optimization: Use for...in loop instead of Object.entries()
    // This avoids creating an array of [key, value] pairs
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        const sanitized = sanitizeDeep((value as Record<string, unknown>)[key])

        if (sanitized === undefined || sanitized === null) continue
        if (Array.isArray(sanitized) && sanitized.length === 0) continue
        if (isPlainObject(sanitized)) {
           // Check for empty object
           let isEmpty = true
           // eslint-disable-next-line @typescript-eslint/no-unused-vars
           for (const _ in sanitized) {
             isEmpty = false
             break
           }
           if (isEmpty) continue
        }

        result[key] = sanitized
      }
    }
    return result as T
  }

  return value
}

/**
 * Safely parse JSON string, returning the value as-is if not a string or null on error
 * This prevents JSON.parse errors from crashing the application
 */
const safeJsonParse = (value: unknown): any => {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') return value
  if (!value.trim()) return null
  try {
    return JSON.parse(value)
  } catch {
    // Log only in development to help debugging, avoid noise in production
    if (import.meta.env.DEV) {
      console.warn('[plantTranslationLoader] Failed to parse JSON:', value.slice(0, 100))
    }
    return null
  }
}

/**
 * Merge translation data with base plant data
 * Handles both new JSONB structure and legacy flat fields
 */
export function mergePlantWithTranslation(
  basePlant: any,
  translation: any | null
): Plant {
  // Parse JSONB fields if they're strings (using safe parsing to avoid crashes)
  const identifiers = safeJsonParse(basePlant.identifiers)
  const traits = safeJsonParse(basePlant.traits)
  const dimensions = safeJsonParse(basePlant.dimensions)
  const phenology = safeJsonParse(basePlant.phenology)
  const environment = safeJsonParse(basePlant.environment)
  const care = safeJsonParse(basePlant.care)
  const propagation = safeJsonParse(basePlant.propagation)
  const usage = safeJsonParse(basePlant.usage)
  const ecology = safeJsonParse(basePlant.ecology)
  const commerce = safeJsonParse(basePlant.commerce)
  const problems = safeJsonParse(basePlant.problems)
  const planting = safeJsonParse(basePlant.planting)
  const meta = safeJsonParse(basePlant.meta)
  const classification = safeJsonParse(basePlant.classification)

  // Parse translation JSONB if present (using safe parsing)
  const translationIdentifiers = safeJsonParse(translation?.identifiers)
  const translationEcology = safeJsonParse(translation?.ecology)
  const translationUsage = safeJsonParse(translation?.usage)
  const translationMeta = safeJsonParse(translation?.meta)
  const translationPhenology = safeJsonParse(translation?.phenology)
  const translationCare = safeJsonParse(translation?.care)
  const translationPlanting = safeJsonParse(translation?.planting)
  const translationProblems = safeJsonParse(translation?.problems)
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
          // promotion_month in plants table is text slug ('january', etc.) - convert to number (1-12)
          promotionMonth: planting?.calendar?.promotionMonth || monthSlugToNumber(basePlant.promotion_month) || (Array.isArray(basePlant.plant_month) && basePlant.plant_month.length > 0
            ? monthSlugToNumber(basePlant.plant_month[0]) ?? undefined
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
          .select('*, plant_images (link,use), plant_colors (colors (id,name,hex_code)), plant_watering_schedules (season,quantity,time_period), plant_sources (id,name,url), plant_infusion_mixes (mix_name,benefit), plant_recipes (id,name,name_fr,category,time,link)')
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
        // season is a non-translatable enum field, always from plants table
        const seasonsRaw = basePlant.season ?? []
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
      // source_name and source_url are now only in plant_translations
      if (!sources.length && translation.source_name) {
        sources.push({
          id: `${basePlant.id}-legacy-source-${sources.length}`,
          name: translation.source_name,
          url: translation.source_url,
        })
      }
      const primaryImage = images.find((i) => i.use === 'primary')?.link
        || images.find((i) => i.use === 'discovery')?.link
        || images[0]?.link

        const infusionMixRows = ((basePlant.plant_infusion_mixes as any[]) || [])
        const infusionMix = infusionMixRows.reduce((acc: Record<string, string>, row) => {
          // Ensure mix_name is a string before calling trim()
          if (typeof row?.mix_name !== 'string') return acc
          const key = row.mix_name.trim()
          if (!key) return acc
          // Ensure benefit is a string before calling trim()
          acc[key] = typeof row?.benefit === 'string' ? row.benefit.trim() : ''
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
              family: basePlant.family || undefined,
              // Translatable field from plant_translations
              overview: translation.overview || undefined,
              // Non-translatable fields from plants table (enums)
              promotionMonth: monthSlugToNumber(basePlant.promotion_month) ?? undefined,
              lifeCycle: (lifeCycleEnum.toUi(basePlant.life_cycle) as NonNullable<Plant["identity"]>["lifeCycle"]) || undefined,
              season: seasons,
              foliagePersistance: expandFoliagePersistanceFromDb(basePlant.foliage_persistance),
              spiked: basePlant.spiked ?? false,
              toxicityHuman: (toxicityEnum.toUi(basePlant.toxicity_human) as NonNullable<Plant["identity"]>["toxicityHuman"]) || undefined,
              toxicityPets: (toxicityEnum.toUi(basePlant.toxicity_pets) as NonNullable<Plant["identity"]>["toxicityPets"]) || undefined,
              // Translatable fields from plant_translations only
              allergens: translation.allergens || [],
              // Non-translatable fields from plants table
              scent: basePlant.scent ?? false,
              // Translatable fields from plant_translations only
              symbolism: translation.symbolism || [],
              // Non-translatable fields from plants table (enums)
              livingSpace: (livingSpaceEnum.toUi(basePlant.living_space) as NonNullable<Plant["identity"]>["livingSpace"]) || undefined,
              composition: expandCompositionFromDb(basePlant.composition || []) as IdentityComposition,
              maintenanceLevel: (maintenanceLevelEnum.toUi(basePlant.maintenance_level) as NonNullable<Plant["identity"]>["maintenanceLevel"]) || undefined,
              colors: colorObjects,
              multicolor: basePlant.multicolor ?? false,
              bicolor: basePlant.bicolor ?? false,
            },
            plantCare: {
              // Translatable fields from plant_translations only
              origin: translation.origin || [],
              // Non-translatable fields from plants table
              habitat: habitatEnum.toUiArray(basePlant.habitat) as PlantCareData["habitat"],
              temperatureMax: basePlant.temperature_max || undefined,
              temperatureMin: basePlant.temperature_min || undefined,
              temperatureIdeal: basePlant.temperature_ideal || undefined,
              // Non-translatable field from plants table
              levelSun: (levelSunEnum.toUi(basePlant.level_sun) as PlantCareData["levelSun"]) || undefined,
              hygrometry: basePlant.hygrometry || undefined,
              wateringType: wateringTypeEnum.toUiArray(basePlant.watering_type) as PlantCareData["wateringType"],
              division: divisionEnum.toUiArray(basePlant.division) as PlantCareData["division"],
              soil: soilEnum.toUiArray(basePlant.soil) as PlantCareData["soil"],
              // Translatable fields from plant_translations only
              adviceSoil: translation.advice_soil || undefined,
              // Non-translatable fields from plants table
              mulching: mulchingEnum.toUiArray(basePlant.mulching) as unknown as PlantCareData["mulching"],
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
              // Structured recipes from plant_recipes table
              recipes: ((basePlant.plant_recipes as any[]) || []).map((r: any) => {
                const localizedName = language !== 'en' && r[`name_${language}`]
                  ? r[`name_${language}`]
                  : r.name
                return {
                  id: r.id,
                  name: localizedName || r.name || '',
                  name_fr: r.name_fr || undefined,
                  category: r.category || 'other',
                  time: r.time || 'undefined',
                  link: r.link || undefined,
                }
              }),
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
            // promotion_month in plants table is text slug ('january', etc.) - convert to number (1-12)
            planting: {
              calendar: {
                promotionMonth: monthSlugToNumber(basePlant.promotion_month) ?? undefined,
              },
            },
          }

      return sanitizeDeep(plant) as Plant
    })

  } catch (error) {
    console.error('Failed to load plant previews:', error)
    return [] 
  }
}
