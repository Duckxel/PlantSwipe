import type { Plant } from "@/types/plant"
import { mapFieldToCategory, type PlantFormCategory } from "./plantFormCategories"
import type { EnumTools } from "@/lib/composition"
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
  if (shouldClearValue(value)) {
    return { shouldUpdate: true, value: undefined }
  }
  const ui = enumTool.toUi(value)
  if (ui !== undefined) {
    return { shouldUpdate: true, value: ui }
  }
  return { shouldUpdate: false }
}

const normalizeEnumArrayInput = (enumTool: EnumTools, value: unknown): EnumArrayResult => {
  if (value === undefined) return { shouldUpdate: false }
  const normalized = enumTool.toUiArray(value)
  if (normalized.length > 0) {
    return { shouldUpdate: true, value: normalized }
  }
  if (isExplicitArrayClear(value) || shouldClearValue(value)) {
    return { shouldUpdate: true, value: [] }
  }
  return { shouldUpdate: false }
}

export function applyAiFieldToPlant(prev: Plant, fieldKey: string, data: unknown): Plant {
  const next: Plant = { ...prev }

  const shouldIgnore = ['colors', 'identity.colors', 'miscellaneous.source', 'source', 'sources'].some(
    (blocked) => fieldKey.toLowerCase() === blocked.toLowerCase(),
  )
  if (shouldIgnore) return next

  switch (fieldKey) {
    case 'id':
      return { ...next, id: typeof data === 'string' ? data : next.id }
    case 'plantType': {
      const result = normalizeEnumValueInput(plantTypeEnum as EnumTools, data)
      if (!result.shouldUpdate) return next
      return { ...next, plantType: result.value as Plant['plantType'] | undefined }
    }
    case 'utility': {
      const result = normalizeEnumArrayInput(utilityEnum as EnumTools, data)
      if (!result.shouldUpdate) return next
      return { ...next, utility: result.value as Plant['utility'] }
    }
    case 'comestiblePart': {
      const result = normalizeEnumArrayInput(comestiblePartEnum as EnumTools, data)
      if (!result.shouldUpdate) return next
      return { ...next, comestiblePart: result.value as Plant['comestiblePart'] }
    }
    case 'fruitType': {
      const result = normalizeEnumArrayInput(fruitTypeEnum as EnumTools, data)
      if (!result.shouldUpdate) return next
      return { ...next, fruitType: result.value as Plant['fruitType'] }
    }
    case 'images':
      return { ...next, images: Array.isArray(data) ? (data as any) : next.images }
    case 'colors':
      return { ...next, colors: Array.isArray(data) ? (data as any) : next.colors }
    case 'seasons': {
      const result = normalizeEnumArrayInput(seasonEnum as EnumTools, data)
      if (!result.shouldUpdate) return next
      return { ...next, seasons: result.value as Plant['seasons'] }
    }
    case 'description':
      return { ...next, description: typeof data === 'string' ? data : next.description }
    case 'identity': {
      type IdentityComposition = NonNullable<NonNullable<Plant['identity']>['composition']>
      const payload = { ...(data as Record<string, unknown>) }
      delete (payload as any).colors
      if ('composition' in payload) {
        const normalizedComposition = expandCompositionFromDb(
          payload.composition as string[] | null | undefined,
        ) as IdentityComposition | undefined
        if (normalizedComposition) {
          ;(payload as { composition?: IdentityComposition }).composition = normalizedComposition
        } else {
          delete (payload as Record<string, unknown>).composition
        }
      }
      const lifeCycleResult = normalizeEnumValueInput(lifeCycleEnum as EnumTools, (payload as any).lifeCycle)
      if (lifeCycleResult.shouldUpdate) {
        (payload as any).lifeCycle = lifeCycleResult.value
      }
      const livingSpaceResult = normalizeEnumValueInput(livingSpaceEnum as EnumTools, (payload as any).livingSpace)
      if (livingSpaceResult.shouldUpdate) {
        (payload as any).livingSpace = livingSpaceResult.value
      }
      const maintenanceResult = normalizeEnumValueInput(maintenanceLevelEnum as EnumTools, (payload as any).maintenanceLevel)
      if (maintenanceResult.shouldUpdate) {
        (payload as any).maintenanceLevel = maintenanceResult.value
      }
      const toxicityHumanResult = normalizeEnumValueInput(toxicityEnum as EnumTools, (payload as any).toxicityHuman)
      if (toxicityHumanResult.shouldUpdate) {
        (payload as any).toxicityHuman = toxicityHumanResult.value
      }
      const toxicityPetsResult = normalizeEnumValueInput(toxicityEnum as EnumTools, (payload as any).toxicityPets)
      if (toxicityPetsResult.shouldUpdate) {
        (payload as any).toxicityPets = toxicityPetsResult.value
      }
      const seasonResult = normalizeEnumArrayInput(seasonEnum as EnumTools, (payload as any).season)
      if (seasonResult.shouldUpdate) {
        (payload as any).season = seasonResult.value
      }
      if (payload.foliagePersistance !== undefined) {
        (payload as any).foliagePersistance = expandFoliagePersistanceFromDb(
          typeof payload.foliagePersistance === 'string'
            ? (payload as any).foliagePersistance
            : String(payload.foliagePersistance ?? ''),
        )
      }
      // Explicitly handle multicolor and bicolor booleans
      if ('multicolor' in payload) {
        (payload as any).multicolor = typeof payload.multicolor === 'boolean' ? payload.multicolor : Boolean(payload.multicolor)
      }
      if ('bicolor' in payload) {
        (payload as any).bicolor = typeof payload.bicolor === 'boolean' ? payload.bicolor : Boolean(payload.bicolor)
      }
      return { ...next, identity: { ...(next.identity || {}), ...payload } }
    }
    case 'plantCare': {
      const payload = { ...(data as Record<string, unknown>) }
      const habitatResult = normalizeEnumArrayInput(habitatEnum as EnumTools, (payload as any).habitat)
      if (habitatResult.shouldUpdate) {
        (payload as any).habitat = habitatResult.value
      }
      const levelSunResult = normalizeEnumValueInput(levelSunEnum as EnumTools, (payload as any).levelSun)
      if (levelSunResult.shouldUpdate) {
        (payload as any).levelSun = levelSunResult.value
      }
      const wateringTypeResult = normalizeEnumArrayInput(wateringTypeEnum as EnumTools, (payload as any).wateringType)
      if (wateringTypeResult.shouldUpdate) {
        (payload as any).wateringType = wateringTypeResult.value
      }
      const divisionResult = normalizeEnumArrayInput(divisionEnum as EnumTools, (payload as any).division)
      if (divisionResult.shouldUpdate) {
        (payload as any).division = divisionResult.value
      }
      const soilResult = normalizeEnumArrayInput(soilEnum as EnumTools, (payload as any).soil)
      if (soilResult.shouldUpdate) {
        (payload as any).soil = soilResult.value
      }
      const mulchingResult = normalizeEnumArrayInput(mulchingEnum as EnumTools, (payload as any).mulching)
      if (mulchingResult.shouldUpdate) {
        (payload as any).mulching = mulchingResult.value
      }
      const nutritionResult = normalizeEnumArrayInput(nutritionNeedEnum as EnumTools, (payload as any).nutritionNeed)
      if (nutritionResult.shouldUpdate) {
        (payload as any).nutritionNeed = nutritionResult.value
      }
      const fertilizerResult = normalizeEnumArrayInput(fertilizerEnum as EnumTools, (payload as any).fertilizer)
      if (fertilizerResult.shouldUpdate) {
        (payload as any).fertilizer = fertilizerResult.value
      }
      // Explicitly handle temperature fields - ensure they're numbers or undefined
      if ('temperatureMax' in payload) {
        const val: unknown = payload.temperatureMax
        if (typeof val === 'number' && isFinite(val)) {
          (payload as any).temperatureMax = val
        } else if (typeof val === 'string' && val.trim()) {
          const parsed = parseFloat(val.trim())
          (payload as any).temperatureMax = isFinite(parsed) ? parsed : undefined
        } else {
          (payload as any).temperatureMax = undefined
        }
      }
      if ('temperatureMin' in payload) {
        const val: unknown = payload.temperatureMin
        if (typeof val === 'number' && isFinite(val)) {
          (payload as any).temperatureMin = val
        } else if (typeof val === 'string' && val.trim()) {
          const parsed = parseFloat(val.trim())
          (payload as any).temperatureMin = isFinite(parsed) ? parsed : undefined
        } else {
          (payload as any).temperatureMin = undefined
        }
      }
      if ('temperatureIdeal' in payload) {
        const val: unknown = payload.temperatureIdeal
        if (typeof val === 'number' && isFinite(val)) {
          (payload as any).temperatureIdeal = val
        } else if (typeof val === 'string' && val.trim()) {
          const parsed = parseFloat(val.trim())
          (payload as any).temperatureIdeal = isFinite(parsed) ? parsed : undefined
        } else {
          (payload as any).temperatureIdeal = undefined
        }
      }
      // Explicitly handle origin array
      if ('origin' in payload) {
        const originVal = payload.origin
        if (Array.isArray(originVal)) {
          (payload as any).origin = originVal.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map(item => item.trim())
        } else if (typeof originVal === 'string' && originVal.trim()) {
          (payload as any).origin = [originVal.trim()]
        } else {
          (payload as any).origin = []
        }
      }
      return { ...next, plantCare: { ...(next.plantCare || {}), ...payload } }
    }
    case 'growth': {
      const payload = { ...(data as Record<string, unknown>) }
      const normalizeMonthsProp = (prop: 'sowingMonth' | 'floweringMonth' | 'fruitingMonth') => {
        if (prop in payload) {
          payload[prop] = normalizeMonthArray(payload[prop])
        }
      }
      normalizeMonthsProp('sowingMonth')
      normalizeMonthsProp('floweringMonth')
      normalizeMonthsProp('fruitingMonth')
      const sowTypeResult = normalizeEnumArrayInput(sowTypeEnum as EnumTools, (payload as any).sowType)
      if (sowTypeResult.shouldUpdate) {
        (payload as any).sowType = sowTypeResult.value
      }
        return { ...next, growth: { ...(next.growth || {}), ...payload } }
    }
    case 'usage':
      return { ...next, usage: { ...(next.usage || {}), ...(data as Record<string, unknown>) } }
    case 'ecology': {
      const payload = { ...(data as Record<string, unknown>) }
      const polenizerResult = normalizeEnumArrayInput(polenizerEnum as EnumTools, (payload as any).polenizer)
      if (polenizerResult.shouldUpdate) {
        (payload as any).polenizer = polenizerResult.value
      }
      const conservationResult = normalizeEnumValueInput(conservationStatusEnum as EnumTools, (payload as any).conservationStatus)
      if (conservationResult.shouldUpdate) {
        (payload as any).conservationStatus = conservationResult.value
      }
      return { ...next, ecology: { ...(next.ecology || {}), ...payload } }
    }
    case 'danger':
      return { ...next, danger: { ...(next.danger || {}), ...(data as Record<string, unknown>) } }
    case 'miscellaneous': {
      const payload = { ...(data as Record<string, unknown>) }
      delete (payload as any).source
      delete (payload as any).sources
      return { ...next, miscellaneous: { ...(next.miscellaneous || {}), ...payload } }
    }
    case 'meta': {
      if (data && typeof data === 'object') {
        const { status: _ignoredStatus, ...rest } = data as Record<string, unknown>
        return { ...next, meta: { ...(next.meta || {}), ...rest } }
      }
      return next
    }
    default: {
      const mutable = next as Plant & Record<string, unknown>
      mutable[fieldKey] = data as any
      return mutable
    }
  }
}

export function getCategoryForField(fieldKey: string): PlantFormCategory {
  return mapFieldToCategory(fieldKey)
}

const MONTH_LABELS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
] as const

const MONTH_NAME_TO_NUMBER: Record<string, number> = MONTH_LABELS.reduce((acc, label, index) => {
  const value = index + 1
  acc[label] = value
  acc[label.slice(0, 3)] = value
  const padded = value.toString().padStart(2, '0')
  acc[padded] = value
  acc[String(value)] = value
  return acc
}, {} as Record<string, number>)

function normalizeMonthValue(entry: unknown): number | null {
  if (typeof entry === 'number' && Number.isFinite(entry)) {
    const int = Math.round(entry)
    if (int >= 1 && int <= 12) return int
  }
  if (typeof entry === 'string') {
    const trimmed = entry.trim()
    if (!trimmed) return null
    const lower = trimmed.toLowerCase()
    if (MONTH_NAME_TO_NUMBER[lower]) return MONTH_NAME_TO_NUMBER[lower]
  }
  return null
}

function normalizeMonthArray(value: unknown): number[] {
  if (value === null || value === undefined) return []
  const source = Array.isArray(value) ? value : [value]
  const result: number[] = []
  for (const entry of source) {
    const normalized = normalizeMonthValue(entry)
    if (normalized && !result.includes(normalized)) {
      result.push(normalized)
    }
  }
  return result
}
