import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, Check, Loader2, Sparkles } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { PlantProfileForm } from "@/components/plant/PlantProfileForm"
import { fetchAiPlantFill, fetchAiPlantFillField } from "@/lib/aiPlantFill"
import type { Plant, PlantColor, PlantImage, PlantMeta, PlantSource, PlantWateringSchedule } from "@/types/plant"
import { useAuth } from "@/context/AuthContext"
import { useTranslation } from "react-i18next"
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/lib/i18n"
import { saveLanguagePreference } from "@/lib/i18nRouting"
import { applyAiFieldToPlant, getCategoryForField } from "@/lib/applyAiField"
import { translateArray, translateText } from "@/lib/deepl"
import { buildCategoryProgress, createEmptyCategoryProgress, plantFormCategoryOrder, type CategoryProgress, type PlantFormCategory } from "@/lib/plantFormCategories"
import { useParams } from "react-router-dom"
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
  meta: {},
  seasons: [],
  colors: [],
}

const normalizeSeasonSlug = (value?: string | null): string | null => {
  if (!value) return null
  const slug = seasonEnum.toDb(value)
  return slug || null
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
  const normalized = (() => {
    const list = images && images.length ? images : []
    let primaryUsed = false
    let discoveryUsed = false
    const mapped = list.map((img, idx) => {
      let use = img.use || (idx === 0 ? 'primary' : 'other')
      if (use === 'primary') {
        if (primaryUsed) use = 'other'
        primaryUsed = true
      }
      if (use === 'discovery') {
        if (discoveryUsed) use = 'other'
        discoveryUsed = true
      }
      return { ...img, use }
    })
    if (!primaryUsed && mapped.length) mapped[0] = { ...mapped[0], use: 'primary' }
    return mapped
  })()
  await supabase.from('plant_images').delete().eq('plant_id', plantId)
  if (!normalized?.length) return
  const inserts = normalized.filter((img) => img.link).map((img) => ({ plant_id: plantId, link: img.link, use: img.use || 'other' }))
  if (inserts.length === 0) return
  const { error } = await supabase.from('plant_images').insert(inserts)
  if (error) throw new Error(error.message)
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

function mapInfusionMixRows(rows?: Array<{ mix_name?: string | null; benefit?: string | null }> | null) {
  const result: Record<string, string> = {}
  if (!rows) return result
  for (const row of rows) {
    const key = row?.mix_name?.trim()
    if (!key) continue
    const value = row?.benefit?.trim()
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

async function loadPlant(id: string): Promise<Plant | null> {
  const { data, error } = await supabase.from('plants').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const { data: colorLinks } = await supabase.from('plant_colors').select('color_id, colors:color_id (id,name,hex_code)').eq('plant_id', id)
  const { data: images } = await supabase.from('plant_images').select('id,link,use').eq('plant_id', id)
  const { data: schedules } = await supabase.from('plant_watering_schedules').select('season,quantity,time_period').eq('plant_id', id)
  const { data: sources } = await supabase.from('plant_sources').select('id,name,url').eq('plant_id', id)
  const infusionMix = await fetchInfusionMixes(id)
  const colors = (colorLinks || []).map((c: any) => ({ id: c.colors?.id, name: c.colors?.name, hexCode: c.colors?.hex_code }))
  const sourceList = (sources || []).map((s) => ({ id: s.id, name: s.name, url: s.url }))
  if (!sourceList.length && (data.source_name || data.source_url)) {
    sourceList.push({
      id: `${data.id}-legacy-source`,
      name: data.source_name || 'Source',
      url: data.source_url || undefined,
    })
  }
    const plant: Plant = {
      id: data.id,
      name: data.name,
      plantType: (plantTypeEnum.toUi(data.plant_type) as Plant["plantType"]) || undefined,
      utility: utilityEnum.toUiArray(data.utility) as Plant["utility"],
      comestiblePart: comestiblePartEnum.toUiArray(data.comestible_part) as Plant["comestiblePart"],
      fruitType: fruitTypeEnum.toUiArray(data.fruit_type) as Plant["fruitType"],
    identity: {
      givenNames: data.given_names || [],
      scientificName: data.scientific_name || undefined,
      family: data.family || undefined,
        overview: data.overview || undefined,
        promotionMonth: monthSlugToNumber(data.promotion_month) ?? undefined,
        lifeCycle: (lifeCycleEnum.toUi(data.life_cycle) as NonNullable<Plant["identity"]>["lifeCycle"]) || undefined,
        season: seasonEnum.toUiArray(data.season) as NonNullable<Plant["identity"]>["season"],
        foliagePersistance: expandFoliagePersistanceFromDb(data.foliage_persistance),
        spiked: data.spiked || false,
        toxicityHuman: (toxicityEnum.toUi(data.toxicity_human) as NonNullable<Plant["identity"]>["toxicityHuman"]) || undefined,
        toxicityPets: (toxicityEnum.toUi(data.toxicity_pets) as NonNullable<Plant["identity"]>["toxicityPets"]) || undefined,
        allergens: data.allergens || [],
        scent: data.scent || false,
        symbolism: data.symbolism || [],
        livingSpace: (livingSpaceEnum.toUi(data.living_space) as NonNullable<Plant["identity"]>["livingSpace"]) || undefined,
        composition: expandCompositionFromDb(data.composition) as IdentityComposition,
        maintenanceLevel: (maintenanceLevelEnum.toUi(data.maintenance_level) as NonNullable<Plant["identity"]>["maintenanceLevel"]) || undefined,
        multicolor: data.multicolor || false,
        bicolor: data.bicolor || false,
        colors,
      },
      plantCare: {
        origin: data.origin || [],
        habitat: habitatEnum.toUiArray(data.habitat) as PlantCareData["habitat"],
        temperatureMax: data.temperature_max || undefined,
        temperatureMin: data.temperature_min || undefined,
        temperatureIdeal: data.temperature_ideal || undefined,
        levelSun: (levelSunEnum.toUi(data.level_sun) as PlantCareData["levelSun"]) || undefined,
        hygrometry: data.hygrometry || undefined,
        wateringType: wateringTypeEnum.toUiArray(data.watering_type) as PlantCareData["wateringType"],
        division: divisionEnum.toUiArray(data.division) as PlantCareData["division"],
        soil: soilEnum.toUiArray(data.soil) as PlantCareData["soil"],
        adviceSoil: data.advice_soil || undefined,
        mulching: mulchingEnum.toUiArray(data.mulching) as PlantCareData["mulching"],
        adviceMulching: data.advice_mulching || undefined,
        nutritionNeed: nutritionNeedEnum.toUiArray(data.nutrition_need) as PlantCareData["nutritionNeed"],
        fertilizer: fertilizerEnum.toUiArray(data.fertilizer) as PlantCareData["fertilizer"],
        adviceFertilizer: data.advice_fertilizer || undefined,
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
        sowingMonth: monthSlugsToNumbers(data.sowing_month),
        floweringMonth: monthSlugsToNumbers(data.flowering_month),
        fruitingMonth: monthSlugsToNumbers(data.fruiting_month),
        height: data.height_cm || undefined,
        wingspan: data.wingspan_cm || undefined,
        tutoring: data.tutoring || false,
        adviceTutoring: data.advice_tutoring || undefined,
        sowType: sowTypeEnum.toUiArray(data.sow_type) as PlantGrowthData["sowType"],
        separation: data.separation_cm || undefined,
        transplanting: data.transplanting || undefined,
        adviceSowing: data.advice_sowing || undefined,
        cut: data.cut || undefined,
      },
    usage: {
      adviceMedicinal: data.advice_medicinal || undefined,
      nutritionalIntake: data.nutritional_intake || [],
      infusion: data.infusion || false,
      adviceInfusion: data.advice_infusion || undefined,
      infusionMix,
      recipesIdeas: data.recipes_ideas || [],
      aromatherapy: data.aromatherapy || false,
      spiceMixes: data.spice_mixes || [],
    },
      ecology: {
        melliferous: data.melliferous || false,
        polenizer: polenizerEnum.toUiArray(data.polenizer) as PlantEcologyData["polenizer"],
        beFertilizer: data.be_fertilizer || false,
        groundEffect: data.ground_effect || undefined,
        conservationStatus: (conservationStatusEnum.toUi(data.conservation_status) as PlantEcologyData["conservationStatus"]) || undefined,
      },
    danger: { pests: data.pests || [], diseases: data.diseases || [] },
    miscellaneous: {
      companions: data.companions || [],
      tags: data.tags || [],
      sources: sourceList,
    },
    meta: {
      status: formatStatusForUi(data.status),
      adminCommentary: data.admin_commentary || undefined,
      createdBy: data.created_by || undefined,
      createdAt: data.created_time || undefined,
      updatedBy: data.updated_by || undefined,
      updatedAt: data.updated_time || undefined,
    },
    multicolor: data.multicolor || false,
    bicolor: data.bicolor || false,
      seasons: seasonEnum.toUiArray(data.season) as Plant["seasons"],
    description: data.overview || undefined,
    images: (images as PlantImage[]) || [],
  }
  if (colors.length || data.multicolor || data.bicolor) plant.identity = { ...(plant.identity || {}), colors, multicolor: data.multicolor, bicolor: data.bicolor }
  return plant
}

export const CreatePlantPage: React.FC<{ onCancel: () => void; onSaved?: (id: string) => void; initialName?: string }> = ({ onCancel, onSaved, initialName }) => {
  const { t, i18n } = useTranslation('common')
  const { id } = useParams<{ id?: string }>()
  const { profile } = useAuth()
  const initialLanguage = SUPPORTED_LANGUAGES.includes(i18n.language as SupportedLanguage)
    ? (i18n.language as SupportedLanguage)
    : 'en'
  const [language, setLanguage] = React.useState<SupportedLanguage>(initialLanguage)
  const [plant, setPlant] = React.useState<Plant>(() => ({ ...emptyPlant, name: initialName || "", id: id || emptyPlant.id }))
  const [loading, setLoading] = React.useState<boolean>(!!id)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [aiWorking, setAiWorking] = React.useState(false)
  const [aiCompleted, setAiCompleted] = React.useState(false)
  const [translating, setTranslating] = React.useState(false)
  const [aiProgress, setAiProgress] = React.useState<CategoryProgress>(() => createEmptyCategoryProgress())
  const [aiSectionLog, setAiSectionLog] = React.useState<Array<{ category: PlantFormCategory; label: string; timestamp: number }>>([])
  const [existingLoaded, setExistingLoaded] = React.useState(false)
  const [colorSuggestions, setColorSuggestions] = React.useState<PlantColor[]>([])
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
    i18n.changeLanguage(language)
    saveLanguagePreference(language)
  }, [language, i18n])

  React.useEffect(() => {
    if (!id) { setLoading(false); return }
    let ignore = false
    const fetchPlant = async () => {
      try {
        const loaded = await loadPlant(id)
        if (!ignore && loaded) { setPlant(loaded); setExistingLoaded(true) }
      } catch (e: any) {
        if (!ignore) setError(e?.message || 'Failed to load plant')
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    fetchPlant()
    return () => { ignore = true }
  }, [id])
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

  const savePlant = async (plantOverride?: Plant) => {
    let plantToSave = plantOverride || plant
    if (!plantToSave.name.trim()) { setError(t('plantAdmin.nameRequired', 'Name is required')); return }
    setSaving(true)
    setError(null)
    try {
      const plantId = plantToSave.id || id || generateUUIDv4()
      const createdByValue = existingLoaded ? plantToSave.meta?.createdBy || null : (plantToSave.meta?.createdBy || (profile as any)?.full_name || null)
      const createdTimeValue = existingLoaded ? plantToSave.meta?.createdAt || null : (plantToSave.meta?.createdAt || new Date().toISOString())
        const normalizedSchedules = normalizeSchedules(plantToSave.plantCare?.watering?.schedules)
        const sources = plantToSave.miscellaneous?.sources || []
        const primarySource = sources[0]
        const normalizedPlantType = plantTypeEnum.toDb(plantToSave.plantType)
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
        const payload = {
          id: plantId,
          name: plantToSave.name.trim(),
          plant_type: normalizedPlantType || null,
          utility: normalizedUtility,
          comestible_part: normalizedComestible,
          fruit_type: normalizedFruit,
          given_names: plantToSave.identity?.givenNames || [],
          scientific_name: plantToSave.identity?.scientificName || null,
          family: plantToSave.identity?.family || null,
          overview: plantToSave.identity?.overview || null,
          promotion_month: normalizedPromotionMonth,
          life_cycle: normalizedLifeCycle || null,
          season: normalizedIdentitySeasons,
          foliage_persistance: normalizeFoliagePersistanceForDb(plantToSave.identity?.foliagePersistance),
          spiked: coerceBoolean(plantToSave.identity?.spiked, false),
          toxicity_human: normalizedToxicityHuman || null,
          toxicity_pets: normalizedToxicityPets || null,
          allergens: plantToSave.identity?.allergens || [],
          scent: coerceBoolean(plantToSave.identity?.scent, false),
          symbolism: plantToSave.identity?.symbolism || [],
          living_space: normalizedLivingSpace || null,
          composition: normalizeCompositionForDb(plantToSave.identity?.composition),
        maintenance_level: normalizedMaintenance || null,
        multicolor: coerceBoolean(plantToSave.identity?.multicolor, false),
        bicolor: coerceBoolean(plantToSave.identity?.bicolor, false),
          origin: plantToSave.plantCare?.origin || [],
          habitat: normalizedHabitat,
        temperature_max: plantToSave.plantCare?.temperatureMax || null,
        temperature_min: plantToSave.plantCare?.temperatureMin || null,
        temperature_ideal: plantToSave.plantCare?.temperatureIdeal || null,
          level_sun: normalizedLevelSun || null,
        hygrometry: plantToSave.plantCare?.hygrometry || null,
          watering_type: normalizedWateringType,
          division: normalizedDivision,
          soil: normalizedSoil,
        advice_soil: plantToSave.plantCare?.adviceSoil || null,
          mulching: normalizedMulching,
        advice_mulching: plantToSave.plantCare?.adviceMulching || null,
          nutrition_need: normalizedNutritionNeed,
          fertilizer: normalizedFertilizer,
        advice_fertilizer: plantToSave.plantCare?.adviceFertilizer || null,
        sowing_month: monthNumbersToSlugs(plantToSave.growth?.sowingMonth),
        flowering_month: monthNumbersToSlugs(plantToSave.growth?.floweringMonth),
        fruiting_month: monthNumbersToSlugs(plantToSave.growth?.fruitingMonth),
        height_cm: plantToSave.growth?.height || null,
        wingspan_cm: plantToSave.growth?.wingspan || null,
        tutoring: coerceBoolean(plantToSave.growth?.tutoring, false),
        advice_tutoring: plantToSave.growth?.adviceTutoring || null,
          sow_type: normalizedSowType,
        separation_cm: plantToSave.growth?.separation || null,
        transplanting: coerceBoolean(plantToSave.growth?.transplanting, null),
        advice_sowing: plantToSave.growth?.adviceSowing || null,
        cut: plantToSave.growth?.cut || null,
        advice_medicinal: plantToSave.usage?.adviceMedicinal || null,
        nutritional_intake: plantToSave.usage?.nutritionalIntake || [],
        infusion: coerceBoolean(plantToSave.usage?.infusion, false),
        advice_infusion: plantToSave.usage?.adviceInfusion || null,
        recipes_ideas: plantToSave.usage?.recipesIdeas || [],
        aromatherapy: coerceBoolean(plantToSave.usage?.aromatherapy, false),
        spice_mixes: plantToSave.usage?.spiceMixes || [],
        melliferous: coerceBoolean(plantToSave.ecology?.melliferous, false),
          polenizer: normalizedPolenizer,
        be_fertilizer: coerceBoolean(plantToSave.ecology?.beFertilizer, false),
        ground_effect: plantToSave.ecology?.groundEffect || null,
          conservation_status: normalizedConservationStatus || null,
        pests: plantToSave.danger?.pests || [],
        diseases: plantToSave.danger?.diseases || [],
        companions: plantToSave.miscellaneous?.companions || [],
        tags: plantToSave.miscellaneous?.tags || [],
        source_name: primarySource?.name || null,
        source_url: primarySource?.url || null,
        status: (plantToSave.meta?.status || IN_PROGRESS_STATUS).toLowerCase(),
        admin_commentary: plantToSave.meta?.adminCommentary || null,
        created_by: createdByValue,
        created_time: createdTimeValue,
        updated_by: (profile as any)?.full_name || plantToSave.meta?.updatedBy || null,
        updated_time: new Date().toISOString(),
      }
        const { data, error: insertError } = await supabase
          .from('plants')
          .upsert(payload)
          .select('id')
          .maybeSingle()
        if (insertError) throw new Error(insertError.message)
        const savedId = data?.id || plantId
        const colorIds = await upsertColors(plantToSave.identity?.colors || [])
        await linkColors(savedId, colorIds)
        await upsertImages(savedId, plantToSave.images || [])
        await upsertWateringSchedules(savedId, {
          ...(plantToSave.plantCare || {}),
          watering: { ...(plantToSave.plantCare?.watering || {}), schedules: normalizedSchedules },
        })
        await upsertSources(savedId, sources)
        await upsertInfusionMixes(savedId, plantToSave.usage?.infusionMix)
      setPlant({
        ...plantToSave,
        plantCare: { ...(plantToSave.plantCare || {}), watering: { ...(plantToSave.plantCare?.watering || {}), schedules: normalizedSchedules } },
        miscellaneous: { ...(plantToSave.miscellaneous || {}), sources },
        id: savedId,
        meta: { ...plantToSave.meta, createdBy: createdByValue || undefined, createdAt: createdTimeValue || undefined, updatedBy: (profile as any)?.full_name || plantToSave.meta?.updatedBy, updatedAt: payload.updated_time },
      })
      if (!existingLoaded) setExistingLoaded(true)
      onSaved?.(savedId)
    } catch (e: any) {
      setError(e?.message || 'Failed to save plant')
    } finally {
      setSaving(false)
    }
  }

  const runAiFill = async () => {
    const trimmedName = plant.name.trim()
    if (!trimmedName) {
      setError(t('plantAdmin.aiNameRequired', 'Please enter a name before using AI fill.'))
      return
    }

    initializeCategoryProgress()
    setAiCompleted(false)
    setAiWorking(true)
    setColorSuggestions([])
    setError(null)

    let aiSucceeded = false
    let finalPlant: Plant | null = null
    const plantNameForAi = trimmedName
    const applyWithStatus = (candidate: Plant): Plant => ({
      ...candidate,
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
      let lastError: Error | null = null
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          const fieldData = await fetchAiPlantFillField({
            plantName: plantNameForAi,
            schema: plantSchema,
            fieldKey,
            existingField,
            language,
          })
          setPlant((prev) => {
            const applied = applyAiFieldToPlant(prev, fieldKey, fieldData)
            const normalized = normalizePlantWatering(applied)
            const withStatus = applyWithStatus(normalized)
            finalPlant = withStatus
            markFieldComplete(fieldKey)
            return withStatus
          })
          return true
        } catch (err: any) {
          lastError = err instanceof Error ? err : new Error(String(err || 'AI field fill failed'))
          if (attempt >= 3) {
            setError(lastError.message)
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
            language,
            onFieldComplete: ({ field, data }) => {
              if (field === 'complete') return
              if (field.toLowerCase().includes('color')) captureColorSuggestions(data)
              if (field === 'identity' && (data as any)?.colors) captureColorSuggestions((data as any).colors)
              setPlant((prev) => {
                const applied = applyAiFieldToPlant(prev, field, data)
                const normalized = normalizePlantWatering(applied)
                const withStatus = applyWithStatus(normalized)
                finalPlant = withStatus
                return withStatus
              })
              markFieldComplete(field)
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
          for (const [fieldKey, data] of Object.entries(aiData as Record<string, unknown>)) {
            if (fieldKey.toLowerCase().includes('color')) captureColorSuggestions(data)
            if (fieldKey === 'identity' && (data as any)?.colors) captureColorSuggestions((data as any).colors)
            updated = applyAiFieldToPlant(updated, fieldKey, data)
            markFieldComplete(fieldKey)
          }
          const withId = { ...updated, id: updated.id || generateUUIDv4() }
          const normalized = normalizePlantWatering(withId)
          const withStatus = applyWithStatus(normalized)
          finalPlant = withStatus
          return withStatus
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
      setError(e?.message || 'AI fill failed')
    } finally {
      setAiWorking(false)
      if (aiSucceeded) {
        setAiCompleted(true)
        setAiProgress(createEmptyCategoryProgress())
        setAiSectionLog([])
      }
      const targetPlant = finalPlant || plant
      if (targetPlant) await savePlant(targetPlant)
    }
  }

  const translatePlant = async () => {
    const targets = SUPPORTED_LANGUAGES.filter((lang) => lang !== language)
    if (!targets.length) {
      setError(t('plantAdmin.translationNoTargets', 'No other languages configured for translation.'))
      return
    }
    if (!plant.name.trim()) {
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

          const dbLifeCycle = lifeCycleEnum.toDb(plant.identity?.lifeCycle)
          const dbSeasons = seasonEnum.toDbArray(plant.identity?.season)
          const dbLivingSpace = livingSpaceEnum.toDb(plant.identity?.livingSpace)
          const dbMaintenance = maintenanceLevelEnum.toDb(plant.identity?.maintenanceLevel)
          const dbToxicityHuman = toxicityEnum.toDb(plant.identity?.toxicityHuman)
          const dbToxicityPets = toxicityEnum.toDb(plant.identity?.toxicityPets)
          const dbHabitat = habitatEnum.toDbArray(plant.plantCare?.habitat)
          const dbLevelSun = levelSunEnum.toDb(plant.plantCare?.levelSun)
          const dbWateringType = wateringTypeEnum.toDbArray(plant.plantCare?.wateringType)
          const dbDivision = divisionEnum.toDbArray(plant.plantCare?.division)
          const dbSoil = soilEnum.toDbArray(plant.plantCare?.soil)
          const dbMulching = mulchingEnum.toDbArray(plant.plantCare?.mulching)
          const dbNutritionNeed = nutritionNeedEnum.toDbArray(plant.plantCare?.nutritionNeed)
          const dbFertilizer = fertilizerEnum.toDbArray(plant.plantCare?.fertilizer)
          const dbSowType = sowTypeEnum.toDbArray(plant.growth?.sowType)
          const dbPolenizer = polenizerEnum.toDbArray(plant.ecology?.polenizer)
          const dbConservation = conservationStatusEnum.toDb(plant.ecology?.conservationStatus)

          translatedRows.push({
          plant_id: plant.id,
          language: target,
          name: translatedName,
          given_names: translatedGivenNames,
          scientific_name: plant.identity?.scientificName || null,
          family: plant.identity?.family
            ? await translateText(plant.identity.family, target, sourceLang)
            : plant.identity?.family || null,
          overview: plant.identity?.overview
            ? await translateText(plant.identity.overview, target, sourceLang)
            : plant.identity?.overview || null,
            promotion_month: monthNumberToSlug(plant.identity?.promotionMonth),
            life_cycle: dbLifeCycle || null,
            season: dbSeasons,
            foliage_persistance: normalizeFoliagePersistanceForDb(plant.identity?.foliagePersistance),
            toxicity_human: dbToxicityHuman || null,
            toxicity_pets: dbToxicityPets || null,
            allergens: await translateArraySafe(plant.identity?.allergens),
            symbolism: await translateArraySafe(plant.identity?.symbolism),
            living_space: dbLivingSpace || null,
            composition: normalizeCompositionForDb(plant.identity?.composition),
            maintenance_level: dbMaintenance || null,
          origin: await translateArraySafe(plant.plantCare?.origin),
            habitat: dbHabitat,
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
          advice_medicinal: plant.usage?.adviceMedicinal
            ? await translateText(plant.usage.adviceMedicinal, target, sourceLang)
            : plant.usage?.adviceMedicinal || null,
          advice_infusion: plant.usage?.adviceInfusion
            ? await translateText(plant.usage.adviceInfusion, target, sourceLang)
            : plant.usage?.adviceInfusion || null,
            ground_effect: plant.ecology?.groundEffect
              ? await translateText(plant.ecology.groundEffect, target, sourceLang)
              : plant.ecology?.groundEffect || null,
            level_sun: dbLevelSun || null,
            watering_type: dbWateringType,
            division: dbDivision,
            soil: dbSoil,
            mulching: dbMulching,
            nutrition_need: dbNutritionNeed,
            fertilizer: dbFertilizer,
            sow_type: dbSowType,
            polenizer: dbPolenizer,
            conservation_status: dbConservation || null,
            admin_commentary: plant.meta?.adminCommentary
            ? await translateText(plant.meta.adminCommentary, target, sourceLang)
            : plant.meta?.adminCommentary || null,
          source_name: translatedSource.name || null,
          source_url: translatedSource.url || null,
        })
      }

      if (translatedRows.length) {
        const { error: translateError } = await supabase
          .from('plant_translations')
          .upsert(translatedRows, { onConflict: 'plant_id,language' })
        if (translateError) throw new Error(translateError.message)
      }

      setPlant((prev) => ({
        ...prev,
        meta: { ...(prev.meta || {}), status: IN_PROGRESS_STATUS },
      }))
      await savePlant()
    } catch (e: any) {
      setError(e?.message || 'Translation failed')
    } finally {
      setTranslating(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 pb-12 space-y-6">
      <div className="relative overflow-hidden rounded-[32px] border border-stone-200 dark:border-[#3e3e42] bg-gradient-to-br from-emerald-50 via-white to-stone-100 dark:from-[#1b2a21] dark:via-[#101712] dark:to-[#0c120e] shadow-[0_24px_80px_-40px_rgba(16,185,129,0.45)] dark:shadow-[0_28px_90px_-50px_rgba(34,197,94,0.35)]">
        <div className="absolute -left-20 -top-24 h-64 w-64 rounded-full bg-emerald-200/40 dark:bg-emerald-500/15 blur-3xl" aria-hidden="true" />
        <div className="absolute -right-12 bottom-[-30%] h-72 w-72 rounded-full bg-emerald-100/40 dark:bg-emerald-600/10 blur-3xl" aria-hidden="true" />
        <div className="relative p-6 sm:p-8 flex flex-col gap-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight">
                {id ? t('plantAdmin.editTitle', 'Edit Plant') : t('plantAdmin.createTitle', 'Create Plant')}
              </h1>
              <p className="text-sm text-muted-foreground max-w-2xl">
                {t('plantAdmin.createSubtitle', 'Fill every field with the supplied descriptions or let AI help.')}
              </p>
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
                <Button variant="secondary" onClick={onCancel} className="rounded-2xl">Cancel</Button>
                <Button onClick={() => savePlant()} disabled={saving || aiWorking} className="rounded-2xl shadow-md">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Plant
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
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
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={aiCompleted ? undefined : runAiFill}
                disabled={aiWorking || !plant.name.trim() || aiCompleted}
              >
                {aiWorking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : aiCompleted ? <Check className="mr-2 h-4 w-4" /> : <Sparkles className="mr-2 h-4 w-4" />}
                {aiCompleted ? t('plantAdmin.aiFilled', 'AI Filled') : t('plantAdmin.aiFill', 'AI fill all fields')}
              </Button>
              {!plant.name.trim() && (
                <span className="text-xs text-muted-foreground self-center">{t('plantAdmin.aiNameRequired', 'Please enter a name before using AI fill.')}</span>
              )}
            </div>
          )}
        </div>
          {showAiProgressCard && (
          <Card>
            <CardContent className="space-y-4 pt-4">
              <div className="flex items-center justify-between text-sm font-medium">
                <span>
                  {aiWorking
                    ? t('plantAdmin.categoryProgressTitle', 'Category fill progress')
                    : t('plantAdmin.categoryProgressSummary', 'Latest AI fill summary')}
                </span>
                <div className="flex items-center gap-2 text-muted-foreground">
                  {aiWorking ? <Loader2 className="h-4 w-4 animate-spin" /> : aiCompleted ? <Check className="h-4 w-4 text-emerald-500" /> : null}
                </div>
              </div>
              <div className="grid gap-2">
                {plantFormCategoryOrder.map((cat) => {
                  const info = aiProgress[cat]
                  if (!info?.total) return null
                  const percent = info.total ? Math.round((info.completed / info.total) * 100) : 0
                  return (
                    <div key={cat} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span>{categoryLabels[cat]}</span>
                          <span
                            className={`text-xs font-medium ${
                              info.status === 'done' ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-300'
                            }`}
                          >
                            {info.status === 'done'
                              ? t('plantAdmin.sectionFilled', 'Filled')
                              : t('plantAdmin.sectionInProgress', 'Filling')}
                          </span>
                        </div>
                        <span className="text-muted-foreground">{info.completed}/{info.total}</span>
                      </div>
                      <div className="h-2 w-full rounded bg-muted overflow-hidden">
                        <div
                          className={`h-2 transition-all ${info.status === 'done' ? 'bg-emerald-500' : 'bg-blue-500'}`}
                          style={{ width: `${Math.min(100, Math.max(percent, info.status === 'done' ? 100 : percent))}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
              {recentSectionLog.length > 0 && (
                <div className="border-t border-dashed pt-3 space-y-2">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t('plantAdmin.sectionLogTitle', 'Sections completed')}
                  </div>
                  <div className="space-y-1.5">
                    {recentSectionLog.map((entry) => (
                      <div
                        key={`${entry.category}-${entry.timestamp}`}
                        className="flex items-center justify-between rounded-xl bg-emerald-50/80 dark:bg-emerald-500/10 px-3 py-2 text-sm"
                      >
                        <span className="flex items-center gap-2 font-medium text-emerald-700 dark:text-emerald-200">
                          <Check className="h-4 w-4" />
                          {entry.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
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
            categoryProgress={hasAiProgress ? aiProgress : undefined}
          />
        )}
    </div>
  )
}

export default CreatePlantPage
