import type { Plant } from "@/types/plant"
import { mapFieldToCategory, type PlantFormCategory } from "./plantFormCategories"
import { expandCompositionFromDb, expandFoliagePersistanceFromDb } from "@/lib/composition"

export function applyAiFieldToPlant(prev: Plant, fieldKey: string, data: unknown): Plant {
  const next: Plant = { ...prev }

  const shouldIgnore = ['colors', 'identity.colors', 'miscellaneous.source', 'source', 'sources'].some(
    (blocked) => fieldKey.toLowerCase() === blocked.toLowerCase(),
  )
  if (shouldIgnore) return next

    switch (fieldKey) {
    case 'id':
      return { ...next, id: typeof data === 'string' ? data : next.id }
    case 'plantType':
      return { ...next, plantType: typeof data === 'string' ? (data as any) : next.plantType }
    case 'utility':
      return { ...next, utility: Array.isArray(data) ? (data as any) : next.utility }
    case 'comestiblePart':
      return { ...next, comestiblePart: Array.isArray(data) ? (data as any) : next.comestiblePart }
    case 'fruitType':
      return { ...next, fruitType: Array.isArray(data) ? (data as any) : next.fruitType }
    case 'images':
      return { ...next, images: Array.isArray(data) ? (data as any) : next.images }
    case 'colors':
      return { ...next, colors: Array.isArray(data) ? (data as any) : next.colors }
    case 'seasons':
      return { ...next, seasons: Array.isArray(data) ? (data as any) : next.seasons }
    case 'description':
      return { ...next, description: typeof data === 'string' ? data : next.description }
    case 'identity': {
      const payload = { ...(data as Record<string, unknown>) }
      delete (payload as any).colors
        if (Array.isArray(payload.composition)) {
          payload.composition = expandCompositionFromDb(payload.composition as string[]) as NonNullable<NonNullable<Plant["identity"]>["composition"]>
        }
        if (payload.foliagePersistance !== undefined) {
          payload.foliagePersistance = expandFoliagePersistanceFromDb(
            typeof payload.foliagePersistance === 'string'
              ? payload.foliagePersistance
              : String(payload.foliagePersistance ?? ''),
          )
        }
      return { ...next, identity: { ...(next.identity || {}), ...payload } }
    }
    case 'plantCare':
      return { ...next, plantCare: { ...(next.plantCare || {}), ...(data as Record<string, unknown>) } }
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
        return { ...next, growth: { ...(next.growth || {}), ...payload } }
      }
    case 'usage':
      return { ...next, usage: { ...(next.usage || {}), ...(data as Record<string, unknown>) } }
    case 'ecology':
      return { ...next, ecology: { ...(next.ecology || {}), ...(data as Record<string, unknown>) } }
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
