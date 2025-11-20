import type { Plant } from "@/types/plant"
import { mapFieldToCategory, type PlantFormCategory } from "./plantFormCategories"

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
      return { ...next, identity: { ...(next.identity || {}), ...payload } }
    }
    case 'plantCare':
      return { ...next, plantCare: { ...(next.plantCare || {}), ...(data as Record<string, unknown>) } }
    case 'growth':
      return { ...next, growth: { ...(next.growth || {}), ...(data as Record<string, unknown>) } }
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
