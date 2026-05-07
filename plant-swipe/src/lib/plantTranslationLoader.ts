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
  normalizeLivingSpace,
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

// ⚡ Bolt Optimization: Replace Object.keys(obj).length === 0 with for...in early return
// to avoid unnecessary array allocations in hot loop
const isEmptyPlainObject = (obj: Record<string, unknown>): boolean => {
  for (const _ in obj) return false
  return true
}

// ⚡ Bolt Optimization: Replace .map().filter() and Object.entries() with single-pass loops
const sanitizeDeep = <T>(value: T): T => {
  if (typeof value === 'string') {
    const sanitized = sanitizeStringValue(value)
    return (sanitized === undefined ? undefined : sanitized) as T
  }
  if (Array.isArray(value)) {
    const sanitizedArray: unknown[] = []
    for (let i = 0; i < value.length; i++) {
      const sanitized = sanitizeDeep(value[i])
      if (sanitized === undefined || sanitized === null) continue
      if (Array.isArray(sanitized) && sanitized.length === 0) continue
      if (isPlainObject(sanitized) && isEmptyPlainObject(sanitized)) continue
      sanitizedArray.push(sanitized)
    }
    return sanitizedArray as unknown as T
  }
  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {}
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        const sanitized = sanitizeDeep(value[key])
        if (sanitized === undefined || sanitized === null) continue
        if (Array.isArray(sanitized) && sanitized.length === 0) continue
        if (isPlainObject(sanitized) && isEmptyPlainObject(sanitized)) continue
        result[key] = sanitized
      }
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
    || (typeof basePlant.image_url === 'string' ? basePlant.image_url : undefined)
    || (typeof basePlant.image === 'string' ? basePlant.image : undefined)

  const plant: Plant = {
    id: String(basePlant.id),
    name: (translation.name as string) || (basePlant.name as string) || '',

    // Section 1: Base
    plantType: (basePlant.plant_type as Plant['plantType']) || undefined,
    plantPart: (basePlant.plant_part as Plant['plantPart']) || [],
    habitat: (basePlant.habitat as Plant['habitat']) || [],
    scientificNameSpecies: (basePlant.scientific_name_species as string) || undefined,
    variety: (translation.variety as string) || undefined,
    family: (basePlant.family as string) || undefined,
    featuredMonth: (basePlant.featured_month as MonthSlug[]) || [],

    // Section 2: Identity (non-translatable from plants table)
    climate: climateEnum.toDbArray(basePlant.climate) as Plant['climate'],
    season: seasonEnum.toDbArray(basePlant.season) as Plant['season'],
    utility: utilityEnum.toDbArray(basePlant.utility) as Plant['utility'],
    vegetable: (basePlant.vegetable as boolean) ?? false,
    ediblePart: ediblePartEnum.toDbArray(basePlant.edible_part) as Plant['ediblePart'],
    thorny: (basePlant.thorny as boolean) ?? false,
    toxicityHuman: (toxicityEnum.toDb(basePlant.toxicity_human) as Plant['toxicityHuman']) || undefined,
    toxicityPets: (toxicityEnum.toDb(basePlant.toxicity_pets) as Plant['toxicityPets']) || undefined,
    poisoningMethod: poisoningMethodEnum.toDbArray(basePlant.poisoning_method) as Plant['poisoningMethod'],
    lifeCycle: lifeCycleEnum.toDbArray(basePlant.life_cycle) as Plant['lifeCycle'],
    averageLifespan: averageLifespanEnum.toDbArray(basePlant.average_lifespan) as Plant['averageLifespan'],
    foliagePersistence: foliagePersistenceEnum.toDbArray(basePlant.foliage_persistence) as Plant['foliagePersistence'],
    livingSpace: normalizeLivingSpace(basePlant.living_space) as Plant['livingSpace'],
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
    specialNeeds: ((translation.special_needs as string[])?.length ? translation.special_needs as string[] : null) || (basePlant.special_needs as string[]) || [],
    substrate: ((translation.substrate as string[])?.length ? translation.substrate as string[] : null) || (basePlant.substrate as string[]) || [],
    substrateMix: (basePlant.substrate_mix as string[]) || [],
    mulchingNeeded: (basePlant.mulching_needed as boolean) ?? false,
    mulchType: ((translation.mulch_type as string[])?.length ? translation.mulch_type as string[] : null) || (basePlant.mulch_type as string[]) || [],
    nutritionNeed: ((translation.nutrition_need as string[])?.length ? translation.nutrition_need as string[] : null) || (basePlant.nutrition_need as string[]) || [],
    fertilizer: ((translation.fertilizer as string[])?.length ? translation.fertilizer as string[] : null) || (basePlant.fertilizer as string[]) || [],
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
    harvestingMonth: (basePlant.harvesting_month as MonthSlug[]) || [],
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
    biotopes: ((translation.biotopes as string[])?.length ? translation.biotopes as string[] : null) || (basePlant.biotopes as string[]) || [],
    urbanBiotopes: (basePlant.urban_biotopes as string[]) || [],
    ecologicalTolerance: ecologicalToleranceEnum.toDbArray(basePlant.ecological_tolerance) as Plant['ecologicalTolerance'],
    biodiversityRole: (basePlant.biodiversity_role as string[]) || [],
    pollinatorsAttracted: ((translation.pollinators_attracted as string[])?.length ? translation.pollinators_attracted as string[] : null) || (basePlant.pollinators_attracted as string[]) || [],
    birdsAttracted: ((translation.birds_attracted as string[])?.length ? translation.birds_attracted as string[] : null) || (basePlant.birds_attracted as string[]) || [],
    mammalsAttracted: ((translation.mammals_attracted as string[])?.length ? translation.mammals_attracted as string[] : null) || (basePlant.mammals_attracted as string[]) || [],
    ecologicalManagement: (basePlant.ecological_management as string[]) || [],
    ecologicalImpact: ecologicalImpactEnum.toDbArray(basePlant.ecological_impact) as Plant['ecologicalImpact'],
    // Translatable
    beneficialRoles: (translation.beneficial_roles as string[]) || [],
    harmfulRoles: (translation.harmful_roles as string[]) || [],
    symbiosis: (translation.symbiosis as string[]) || [],
    symbiosisNotes: (translation.symbiosis_notes as string) || undefined,

    // Section 7: Consumption (non-translatable)
    infusionParts: (basePlant.infusion_parts as string[]) || [],
    edibleOil: (basePlant.edible_oil as boolean) ?? undefined,
    // Translatable
    nutritionalValue: (translation.nutritional_value as string) || undefined,
    recipesIdeas: (translation.recipes_ideas as string[]) || [],
    recipes: (() => {
      // ⚡ Bolt: Use single-pass for loop with pre-allocated array instead of .map() to reduce GC overhead
      const result = new Array(recipes.length)
      for (let i = 0; i < recipes.length; i++) {
        const r = recipes[i]
        const localizedName = language !== 'en' && r[`name_${language}`]
          ? r[`name_${language}`] as string
          : r.name as string
        result[i] = {
          id: r.id as string,
          name: localizedName || (r.name as string) || '',
          name_fr: (r.name_fr as string) || undefined,
          category: (r.category as string) || 'other',
          time: (r.time as string) || 'undefined',
          link: (r.link as string) || undefined,
        }
      }
      return result as Plant['recipes']
    })(),
    infusionBenefits: (translation.infusion_benefits as string) || undefined,
    infusionRecipeIdeas: (translation.infusion_recipe_ideas as string) || undefined,
    medicinalBenefits: (translation.medicinal_benefits as string) || undefined,
    medicinalUsage: (translation.medicinal_usage as string) || undefined,
    medicinalWarning: (translation.medicinal_warning as string) || undefined,
    medicinalHistory: (translation.medicinal_history as string) || undefined,
    aromatherapyBenefits: (translation.aromatherapy_benefits as string) || undefined,
    essentialOilBlends: (translation.essential_oil_blends as string) || undefined,
    // ⚡ Bolt: Use isEmptyPlainObject to avoid intermediate array allocation
    infusionMixes: !isEmptyPlainObject(infusionMixes) ? infusionMixes : undefined,
    spiceMixes: (translation.spice_mixes as string[]) || [],

    // Section 8: Misc
    companionPlants: (basePlant.companion_plants as string[]) || [],
    biotopePlants: (basePlant.biotope_plants as string[]) || [],
    beneficialPlants: (basePlant.beneficial_plants as string[]) || [],
    harmfulPlants: (basePlant.harmful_plants as string[]) || [],
    plantTags: (translation.plant_tags as string[]) || [],
    biodiversityTags: (translation.biodiversity_tags as string[]) || [],
    sources,
    sourceName: (translation.source_name as string) || undefined,
    sourceUrl: (translation.source_url as string) || undefined,

    // Section 9: Meta
    status: (basePlant.status as Plant['status']) || undefined,
    createdBy: (basePlant.created_by as string) || undefined,
    createdTime: (basePlant.created_time as string) || undefined,
    updatedBy: (basePlant.updated_by as string) || undefined,
    updatedTime: (basePlant.updated_time as string) || undefined,

    // Display
    images,
    photos: (() => {
      // ⚡ Bolt: Use single-pass for loop with pre-allocated array instead of .map() to reduce GC overhead
      const result = new Array(images.length)
      for (let i = 0; i < images.length; i++) {
        const img = images[i]
        result[i] = {
          url: img.link || '',
          isPrimary: img.use === 'primary',
          isVertical: false,
        }
      }
      return result
    })(),
    image: primaryImage,
    colors: colorObjects,
    colorNames: (() => {
      // ⚡ Bolt: Use single-pass for loop with pre-allocated array instead of .map() to reduce GC overhead
      const result = new Array(colorObjects.length)
      for (let i = 0; i < colorObjects.length; i++) {
        result[i] = colorObjects[i].name
      }
      return result
    })(),
    popularity,

    // Legacy aliases for backward compatibility
    // plantType already set in Section 1: Base above
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

    // Fetch all translations for the language (no .in() filter) to avoid
    // Supabase URL length limits when there are hundreds of plant IDs.
    const { data: translations } = await supabase
      .from('plant_translations')
      .select('*')
      .eq('language', language)

    const translationMap = new Map<string, Record<string, unknown>>()
    if (translations) {
      translations.forEach((t: Record<string, unknown>) => translationMap.set(t.plant_id as string, t))
    }

    const toTitleCase = (val: string | null | undefined): string | undefined => {
      if (!val) return undefined
      return val.charAt(0).toUpperCase() + val.slice(1)
    }

    // ⚡ Bolt: Optimize mapping of large dataset using pre-allocated array and single-pass for loop
    const resultPlants = new Array(plants.length)
    for (let index = 0; index < plants.length; index++) {
      const basePlant = plants[index] as Record<string, unknown>
      const translation = translationMap.get(basePlant.id as string) || {}

      const colorObjects: Array<{ id?: string; name: string; hexCode?: string }> = []
      const plantColors = (basePlant.plant_colors as Record<string, unknown>[]) || []
      for (let i = 0; i < plantColors.length; i++) {
        const pc = plantColors[i]
        const colors = pc?.colors as Record<string, unknown>
        if (colors?.name) {
          colorObjects.push({
            id: colors.id as string,
            name: colors.name as string,
            hexCode: colors.hex_code as string,
          })
        }
      }

      // ⚡ Bolt: Use single-pass for loop with pre-allocated array instead of .map() to reduce GC overhead
      const rawImages = (basePlant.plant_images as Record<string, unknown>[]) || []
      const images: PlantImage[] = new Array(rawImages.length)
      for (let i = 0; i < rawImages.length; i++) {
        const img = rawImages[i]
        images[i] = {
          link: img?.link as string,
          use: img?.use as PlantImage['use'],
        }
      }

      const schedules: Array<{ season?: string; quantity?: number; timePeriod?: string }> = []
      const waterSchedules = (basePlant.plant_watering_schedules as Record<string, unknown>[]) || []
      for (let i = 0; i < waterSchedules.length; i++) {
        const row = waterSchedules[i]
        const season = row?.season ? toTitleCase(row.season as string) : undefined
        const quantity = row?.quantity != null ? Number(row.quantity) : undefined
        const timePeriod = (row?.time_period as string) || undefined
        if (season || quantity !== undefined || timePeriod) {
          schedules.push({ season, quantity, timePeriod })
        }
      }

      const sourcesList: Array<{ id?: string; name: string; url?: string }> = []
      const plantSources = (basePlant.plant_sources as Record<string, unknown>[]) || []
      for (let i = 0; i < plantSources.length; i++) {
        const src = plantSources[i]
        if (src?.name) {
          sourcesList.push({
            id: src.id as string,
            name: src.name as string,
            url: src.url as string,
          })
        }
      }
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

      resultPlants[index] = mapDbRowToPlant(
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
    }
    return resultPlants
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
      'plant_type', 'plant_part', 'habitat',
      'scientific_name_species', 'family',
      'featured_month',
      'climate', 'season', 'utility', 'vegetable', 'edible_part',
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

    let { data: plantsData, error } = plantsResponse
    const { data: topLiked, error: topLikedError } = topLikedResponse

    // Fallback: if the full query fails (e.g. missing columns), retry with core columns only
    if (error) {
      console.warn('Full plant query failed, retrying with core columns:', error.message)
      const coreColumns = [
        'id', 'name',
        'plant_type', 'plant_part', 'habitat',
        'scientific_name_species', 'family',
        'featured_month',
        'climate', 'season', 'utility', 'edible_part',
        'thorny', 'toxicity_human', 'toxicity_pets',
        'life_cycle', 'foliage_persistence',
        'living_space', 'landscaping', 'plant_habit',
        'multicolor', 'bicolor',
        'care_level', 'sunlight',
        'status', 'created_time', 'updated_time',
        'plant_images (link,use)',
        'plant_colors (colors (id,name,hex_code))',
        'plant_watering_schedules (season,quantity,time_period)',
      ].join(',')
      const fallback = await supabase
        .from('plants')
        .select(coreColumns)
        .order('name', { ascending: true })
      plantsData = fallback.data
      error = fallback.error
    }

    if (error) throw error
    const plants = plantsData as unknown as Record<string, unknown>[]
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

    // Fetch all translations for the language (no .in() filter) to avoid
    // Supabase URL length limits when there are hundreds of plant IDs.
    const { data: translationsData } = await supabase
      .from('plant_translations')
      .select('plant_id, name, variety, common_names, presentation, origin, allergens, plant_tags')
      .eq('language', language)

    const translationMap = new Map<string, Record<string, unknown>>()
    if (translationsData) {
      (translationsData as Record<string, unknown>[]).forEach((t) => translationMap.set(t.plant_id as string, t))
    }

    // ⚡ Bolt: Optimize large array mapping with single-pass for loop and pre-allocated array to reduce garbage collection overhead
    const resultPlants = new Array(plants.length)
    for (let index = 0; index < plants.length; index++) {
      const basePlant = plants[index] as Record<string, unknown>
      const translation = translationMap.get(basePlant.id as string) || {}

      const colorObjects: Array<{ id?: string; name: string; hexCode?: string }> = []
      const plantColors = (basePlant.plant_colors as Record<string, unknown>[]) || []
      for (let i = 0; i < plantColors.length; i++) {
        const pc = plantColors[i]
        const colors = pc?.colors as Record<string, unknown>
        if (colors?.name) {
          colorObjects.push({
            id: colors.id as string,
            name: colors.name as string,
            hexCode: colors.hex_code as string,
          })
        }
      }

      // ⚡ Bolt: Use single-pass for loop with pre-allocated array instead of .map() to reduce GC overhead
      const rawImages = (basePlant.plant_images as Record<string, unknown>[]) || []
      const images: PlantImage[] = new Array(rawImages.length)
      for (let i = 0; i < rawImages.length; i++) {
        const img = rawImages[i]
        images[i] = {
          link: img?.link as string,
          use: img?.use as PlantImage['use'],
        }
      }

      const toTitleCase = (val: string | null | undefined): string | undefined => {
        if (!val) return undefined
        return val.charAt(0).toUpperCase() + val.slice(1)
      }

      const schedules: Array<{ season?: string; quantity?: number; timePeriod?: string }> = []
      const waterSchedules = (basePlant.plant_watering_schedules as Record<string, unknown>[]) || []
      for (let i = 0; i < waterSchedules.length; i++) {
        const row = waterSchedules[i]
        const season = row?.season ? toTitleCase(row.season as string) : undefined
        const quantity = row?.quantity != null ? Number(row.quantity) : undefined
        const timePeriod = (row?.time_period as string) || undefined
        if (season || quantity !== undefined || timePeriod) {
          schedules.push({ season, quantity, timePeriod })
        }
      }

      resultPlants[index] = mapDbRowToPlant(
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
    }
    return resultPlants
  } catch (error) {
    console.error('Failed to load plant previews:', error)
    return []
  }
}

// Re-export legacy function name
export const mergePlantWithTranslation = mapDbRowToPlant
