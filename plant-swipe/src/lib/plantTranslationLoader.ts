/**
 * Plant Translation Utilities — Load plants from DB into flat Plant interface
 * Updated for new 9-section schema (Feb 2026)
 */

import { supabase } from './supabaseClient'
import type { SupportedLanguage } from './i18n'
import type { Plant, PlantImage, PlantWateringSchedule, MonthSlug } from '@/types/plant'
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
} from '@/lib/composition'

const sanitizeStringValue = (value: string): string | undefined => {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const lower = trimmed.toLowerCase()
  if (lower === 'null' || lower === 'undefined') return undefined
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
 * Map a DB row (plants table + plant_translations) to the flat Plant interface
 */
function mapDbRowToPlant(
  basePlant: Record<string, unknown>,
  translation: Record<string, unknown>,
  colorObjects: Array<{ id?: string; name: string; hexCode?: string }>,
  images: PlantImage[],
  schedules: Array<{ season?: string; quantity?: number; timePeriod?: string }>,
  sources: Array<{ id?: string; name: string; url?: string }>,
  infusionMixes: Record<string, string>,
  recipes: Array<Record<string, unknown>>,
  popularity?: { likes: number; rank: number },
  language?: string,
): Plant {
  const primaryImage = images.find((i) => i.use === 'primary')?.link
    || images.find((i) => i.use === 'discovery')?.link
    || images[0]?.link

  const plant: Plant = {
    id: String(basePlant.id),
    name: (translation.name as string) || (basePlant.name as string) || '',

    // Section 1: Base
    scientificNameSpecies: (basePlant.scientific_name_species as string) || undefined,
    scientificNameVariety: (basePlant.scientific_name_variety as string) || undefined,
    family: (basePlant.family as string) || undefined,
    featuredMonth: (basePlant.featured_month as MonthSlug[]) || [],

    // Section 2: Identity (non-translatable from plants table)
    climate: climateEnum.toDbArray(basePlant.climate) as Plant['climate'],
    season: seasonEnum.toDbArray(basePlant.season) as Plant['season'],
    utility: utilityEnum.toDbArray(basePlant.utility) as Plant['utility'],
    ediblePart: ediblePartEnum.toDbArray(basePlant.edible_part) as Plant['ediblePart'],
    thorny: (basePlant.thorny as boolean) ?? false,
    toxicityHuman: (toxicityEnum.toDb(basePlant.toxicity_human) as Plant['toxicityHuman']) || undefined,
    toxicityPets: (toxicityEnum.toDb(basePlant.toxicity_pets) as Plant['toxicityPets']) || undefined,
    poisoningMethod: poisoningMethodEnum.toDbArray(basePlant.poisoning_method) as Plant['poisoningMethod'],
    lifeCycle: lifeCycleEnum.toDbArray(basePlant.life_cycle) as Plant['lifeCycle'],
    averageLifespan: averageLifespanEnum.toDbArray(basePlant.average_lifespan) as Plant['averageLifespan'],
    foliagePersistence: foliagePersistenceEnum.toDbArray(basePlant.foliage_persistence) as Plant['foliagePersistence'],
    livingSpace: livingSpaceEnum.toDbArray(basePlant.living_space) as Plant['livingSpace'],
    landscaping: (basePlant.landscaping as string[]) || [],
    plantHabit: (basePlant.plant_habit as string[]) || [],
    multicolor: (basePlant.multicolor as boolean) ?? false,
    bicolor: (basePlant.bicolor as boolean) ?? false,

    // Section 2: Identity (translatable from plant_translations)
    commonNames: (translation.common_names as string[]) || [],
    presentation: (translation.presentation as string) || undefined,
    origin: (translation.origin as string[]) || [],
    allergens: (translation.allergens as string[]) || [],
    poisoningSymptoms: (translation.poisoning_symptoms as string) || undefined,

    // Section 3: Care (non-translatable)
    careLevel: careLevelEnum.toDbArray(basePlant.care_level) as Plant['careLevel'],
    sunlight: sunlightEnum.toDbArray(basePlant.sunlight) as Plant['sunlight'],
    temperatureMax: (basePlant.temperature_max as number) || undefined,
    temperatureMin: (basePlant.temperature_min as number) || undefined,
    temperatureIdeal: (basePlant.temperature_ideal as number) || undefined,
    wateringMode: (basePlant.watering_mode as Plant['wateringMode']) || 'always',
    wateringFrequencyWarm: (basePlant.watering_frequency_warm as number) || undefined,
    wateringFrequencyCold: (basePlant.watering_frequency_cold as number) || undefined,
    wateringType: wateringTypeEnum.toDbArray(basePlant.watering_type) as Plant['wateringType'],
    hygrometry: (basePlant.hygrometry as number) || undefined,
    mistingFrequency: (basePlant.misting_frequency as number) || undefined,
    specialNeeds: (basePlant.special_needs as string[]) || [],
    substrate: (basePlant.substrate as string[]) || [],
    substrateMix: (basePlant.substrate_mix as string[]) || [],
    mulchingNeeded: (basePlant.mulching_needed as boolean) ?? false,
    mulchType: (basePlant.mulch_type as string[]) || [],
    nutritionNeed: (basePlant.nutrition_need as string[]) || [],
    fertilizer: (basePlant.fertilizer as string[]) || [],
    // Translatable
    soilAdvice: (translation.soil_advice as string) || undefined,
    mulchAdvice: (translation.mulch_advice as string) || undefined,
    fertilizerAdvice: (translation.fertilizer_advice as string) || undefined,

    // Watering schedules (from related table)
    wateringSchedules: schedules.length > 0 ? schedules as PlantWateringSchedule[] : undefined,

    // Section 4: Growth
    sowingMonth: (basePlant.sowing_month as MonthSlug[]) || [],
    floweringMonth: (basePlant.flowering_month as MonthSlug[]) || [],
    fruitingMonth: (basePlant.fruiting_month as MonthSlug[]) || [],
    heightCm: (basePlant.height_cm as number) || undefined,
    wingspanCm: (basePlant.wingspan_cm as number) || undefined,
    staking: (basePlant.staking as boolean) ?? false,
    division: divisionEnum.toDbArray(basePlant.division) as Plant['division'],
    cultivationMode: (basePlant.cultivation_mode as string[]) || [],
    sowingMethod: sowingMethodEnum.toDbArray(basePlant.sowing_method) as Plant['sowingMethod'],
    transplanting: (basePlant.transplanting as boolean) || undefined,
    pruning: (basePlant.pruning as boolean) ?? false,
    pruningMonth: (basePlant.pruning_month as MonthSlug[]) || [],
    // Translatable
    stakingAdvice: (translation.staking_advice as string) || undefined,
    sowingAdvice: (translation.sowing_advice as string) || undefined,
    transplantingTime: (translation.transplanting_time as string) || undefined,
    outdoorPlantingTime: (translation.outdoor_planting_time as string) || undefined,
    pruningAdvice: (translation.pruning_advice as string) || undefined,

    // Section 5: Danger (translatable)
    pests: (translation.pests as string[]) || [],
    diseases: (translation.diseases as string[]) || [],

    // Section 6: Ecology (non-translatable)
    conservationStatus: conservationStatusEnum.toDbArray(basePlant.conservation_status) as Plant['conservationStatus'],
    ecologicalStatus: (basePlant.ecological_status as string[]) || [],
    biotopes: (basePlant.biotopes as string[]) || [],
    urbanBiotopes: (basePlant.urban_biotopes as string[]) || [],
    ecologicalTolerance: ecologicalToleranceEnum.toDbArray(basePlant.ecological_tolerance) as Plant['ecologicalTolerance'],
    biodiversityRole: (basePlant.biodiversity_role as string[]) || [],
    pollinatorsAttracted: (basePlant.pollinators_attracted as string[]) || [],
    birdsAttracted: (basePlant.birds_attracted as string[]) || [],
    mammalsAttracted: (basePlant.mammals_attracted as string[]) || [],
    ecologicalManagement: (basePlant.ecological_management as string[]) || [],
    ecologicalImpact: ecologicalImpactEnum.toDbArray(basePlant.ecological_impact) as Plant['ecologicalImpact'],
    // Translatable
    beneficialRoles: (translation.beneficial_roles as string[]) || [],
    harmfulRoles: (translation.harmful_roles as string[]) || [],
    symbiosis: (translation.symbiosis as string[]) || [],
    symbiosisNotes: (translation.symbiosis_notes as string) || undefined,

    // Section 7: Consumption (non-translatable)
    infusionParts: (basePlant.infusion_parts as string[]) || [],
    edibleOil: (basePlant.edible_oil as Plant['edibleOil']) || undefined,
    // Translatable
    nutritionalValue: (translation.nutritional_value as string) || undefined,
    recipesIdeas: (translation.recipes_ideas as string[]) || [],
    recipes: recipes.map((r) => {
      const localizedName = language !== 'en' && r[`name_${language}`]
        ? r[`name_${language}`] as string
        : r.name as string
      return {
        id: r.id as string,
        name: localizedName || (r.name as string) || '',
        name_fr: (r.name_fr as string) || undefined,
        category: (r.category as string) || 'other',
        time: (r.time as string) || 'undefined',
        link: (r.link as string) || undefined,
      }
    }) as Plant['recipes'],
    infusionBenefits: (translation.infusion_benefits as string) || undefined,
    infusionRecipeIdeas: (translation.infusion_recipe_ideas as string) || undefined,
    medicinalBenefits: (translation.medicinal_benefits as string) || undefined,
    medicinalUsage: (translation.medicinal_usage as string) || undefined,
    medicinalWarning: (translation.medicinal_warning as string) || undefined,
    medicinalHistory: (translation.medicinal_history as string) || undefined,
    aromatherapyBenefits: (translation.aromatherapy_benefits as string) || undefined,
    essentialOilBlends: (translation.essential_oil_blends as string) || undefined,
    infusionMixes: Object.keys(infusionMixes).length > 0 ? infusionMixes : undefined,
    spiceMixes: (translation.spice_mixes as string[]) || [],

    // Section 8: Misc
    companionPlants: (basePlant.companion_plants as string[]) || [],
    biotopePlants: (basePlant.biotope_plants as string[]) || [],
    beneficialPlants: (basePlant.beneficial_plants as string[]) || [],
    harmfulPlants: (basePlant.harmful_plants as string[]) || [],
    varieties: (basePlant.varieties as string[]) || [],
    plantTags: (translation.plant_tags as string[]) || [],
    biodiversityTags: (translation.biodiversity_tags as string[]) || [],
    sources,
    sourceName: (translation.source_name as string) || undefined,
    sourceUrl: (translation.source_url as string) || undefined,

    // Section 9: Meta
    status: (basePlant.status as Plant['status']) || undefined,
    adminCommentary: (basePlant.admin_commentary as string) || undefined,
    createdBy: (basePlant.created_by as string) || undefined,
    createdTime: (basePlant.created_time as string) || undefined,
    updatedBy: (basePlant.updated_by as string) || undefined,
    updatedTime: (basePlant.updated_time as string) || undefined,

    // Display
    images,
    image: primaryImage,
    colors: colorObjects,
    colorNames: colorObjects.map(c => c.name),
    popularity,

    // Legacy aliases for backward compatibility
    description: (translation.presentation as string) || '',
    scientificName: (basePlant.scientific_name_species as string) || '',
    givenNames: (translation.common_names as string[]) || [],
    overview: (translation.presentation as string) || '',
  }

  return sanitizeDeep(plant) as Plant
}

/**
 * Load plants with translations for a specific language (full data)
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
        popularityMap.set(String(entry.plant_id), {
          likes: typeof entry.likes === 'number' ? entry.likes : Number(entry.likes ?? 0),
          rank: index + 1,
        })
      })
    }

    const plantIds = plants.map((p: Record<string, unknown>) => p.id)
    const { data: translations } = await supabase
      .from('plant_translations')
      .select('*')
      .eq('language', language)
      .in('plant_id', plantIds)

    const translationMap = new Map<string, Record<string, unknown>>()
    if (translations) {
      translations.forEach((t: Record<string, unknown>) => translationMap.set(t.plant_id as string, t))
    }

    const toTitleCase = (val: string | null | undefined): string | undefined => {
      if (!val) return undefined
      return val.charAt(0).toUpperCase() + val.slice(1)
    }

    return plants.map((basePlant: Record<string, unknown>) => {
      const translation = translationMap.get(basePlant.id as string) || {}

      const colorObjects = ((basePlant.plant_colors as Record<string, unknown>[]) || []).map((pc) => ({
        id: (pc?.colors as Record<string, unknown>)?.id as string,
        name: (pc?.colors as Record<string, unknown>)?.name as string,
        hexCode: (pc?.colors as Record<string, unknown>)?.hex_code as string,
      })).filter((c) => c.name)

      const images: PlantImage[] = ((basePlant.plant_images as Record<string, unknown>[]) || []).map((img) => ({
        link: img?.link as string,
        use: img?.use as PlantImage['use'],
      }))

      const schedules = ((basePlant.plant_watering_schedules as Record<string, unknown>[]) || []).map((row) => ({
        season: row?.season ? toTitleCase(row.season as string) : undefined,
        quantity: row?.quantity != null ? Number(row.quantity) : undefined,
        timePeriod: (row?.time_period as string) || undefined,
      })).filter((e) => e.season || e.quantity !== undefined || e.timePeriod)

      const sourcesList = ((basePlant.plant_sources as Record<string, unknown>[]) || [])
        .map((src) => ({
          id: src?.id as string,
          name: src?.name as string,
          url: src?.url as string,
        }))
        .filter((src) => src.name)
      if (!sourcesList.length && translation.source_name) {
        sourcesList.push({
          id: `${basePlant.id}-legacy-source`,
          name: translation.source_name as string,
          url: translation.source_url as string,
        })
      }

      const infusionMixRows = (basePlant.plant_infusion_mixes as Record<string, unknown>[]) || []
      const infusionMixes = infusionMixRows.reduce((acc: Record<string, string>, row) => {
        if (typeof row?.mix_name !== 'string') return acc
        const key = row.mix_name.trim()
        if (!key) return acc
        acc[key] = typeof row?.benefit === 'string' ? row.benefit.trim() : ''
        return acc
      }, {} as Record<string, string>)

      const recipes = (basePlant.plant_recipes as Record<string, unknown>[]) || []

      return mapDbRowToPlant(
        basePlant,
        translation,
        colorObjects,
        images,
        schedules,
        sourcesList,
        infusionMixes,
        recipes,
        popularityMap.get(String(basePlant.id)),
        language,
      )
    })
  } catch (error) {
    console.error('Failed to load plants with translations:', error)
    return []
  }
}

/**
 * Optimized loader for plant previews (discovery/swipe/search)
 * Fetches only the fields necessary for listing, filtering, and swipe cards.
 */
export async function loadPlantPreviews(language: SupportedLanguage): Promise<Plant[]> {
  try {
    const TOP_LIKED_LIMIT = 5

    const plantColumns = [
      'id', 'name',
      'scientific_name_species', 'family',
      'featured_month',
      'climate', 'season', 'utility', 'edible_part',
      'thorny', 'toxicity_human', 'toxicity_pets',
      'life_cycle', 'foliage_persistence',
      'living_space', 'landscaping', 'plant_habit',
      'multicolor', 'bicolor',
      'care_level', 'sunlight',
      'conservation_status',
      'biodiversity_role', 'ecological_tolerance',
      'companion_plants',
      'status', 'created_time', 'updated_time',
      'plant_images (link,use)',
      'plant_colors (colors (id,name,hex_code))',
      'plant_watering_schedules (season,quantity,time_period)',
    ].join(',')

    const [plantsResponse, topLikedResponse] = await Promise.all([
      supabase
        .from('plants')
        .select(plantColumns)
        .order('name', { ascending: true }),
      supabase.rpc('top_liked_plants', { limit_count: TOP_LIKED_LIMIT }),
    ])

    const { data: plantsData, error } = plantsResponse
    const plants = plantsData as unknown as Record<string, unknown>[]
    const { data: topLiked, error: topLikedError } = topLikedResponse

    if (error) throw error
    if (!plants || plants.length === 0) return []

    if (topLikedError) console.warn('Failed to load top liked plants', topLikedError)

    const popularityMap = new Map<string, { likes: number; rank: number }>()
    if (Array.isArray(topLiked)) {
      topLiked.forEach((entry, index) => {
        if (!entry || !entry.plant_id) return
        popularityMap.set(String(entry.plant_id), {
          likes: typeof entry.likes === 'number' ? entry.likes : Number(entry.likes ?? 0),
          rank: index + 1,
        })
      })
    }

    const plantIds = plants.map((p) => p.id)
    const { data: translationsData } = await supabase
      .from('plant_translations')
      .select('plant_id, name, common_names, presentation, origin, allergens, plant_tags')
      .eq('language', language)
      .in('plant_id', plantIds)

    const translationMap = new Map<string, Record<string, unknown>>()
    if (translationsData) {
      (translationsData as Record<string, unknown>[]).forEach((t) => translationMap.set(t.plant_id as string, t))
    }

    return plants.map((basePlant) => {
      const translation = translationMap.get(basePlant.id as string) || {}

      const colorObjects = ((basePlant.plant_colors as Record<string, unknown>[]) || []).map((pc) => ({
        id: (pc?.colors as Record<string, unknown>)?.id as string,
        name: (pc?.colors as Record<string, unknown>)?.name as string,
        hexCode: (pc?.colors as Record<string, unknown>)?.hex_code as string,
      })).filter((c) => c.name)

      const images: PlantImage[] = ((basePlant.plant_images as Record<string, unknown>[]) || []).map((img) => ({
        link: img?.link as string,
        use: img?.use as PlantImage['use'],
      }))

      const toTitleCase = (val: string | null | undefined): string | undefined => {
        if (!val) return undefined
        return val.charAt(0).toUpperCase() + val.slice(1)
      }

      const schedules = ((basePlant.plant_watering_schedules as Record<string, unknown>[]) || []).map((row) => ({
        season: row?.season ? toTitleCase(row.season as string) : undefined,
        quantity: row?.quantity != null ? Number(row.quantity) : undefined,
        timePeriod: (row?.time_period as string) || undefined,
      })).filter((e) => e.season || e.quantity !== undefined || e.timePeriod)

      return mapDbRowToPlant(
        basePlant,
        translation,
        colorObjects,
        images,
        schedules,
        [],
        {},
        [],
        popularityMap.get(String(basePlant.id)),
        language,
      )
    })
  } catch (error) {
    console.error('Failed to load plant previews:', error)
    return []
  }
}

// Re-export legacy function name
export const mergePlantWithTranslation = mapDbRowToPlant
