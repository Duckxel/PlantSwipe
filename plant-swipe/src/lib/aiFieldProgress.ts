export type RequiredFieldId = 'scientificName' | 'colors' | 'seasons' | 'description'

export type AiFieldStatus = 'pending' | 'working' | 'filled' | 'missing'

export const REQUIRED_FIELD_CONFIG: Array<{
  id: RequiredFieldId
  label: string
  sourceKeys: string[]
}> = [
  {
    id: 'scientificName',
    label: 'Scientific Name',
    sourceKeys: ['identifiers', 'scientificName'],
  },
  {
    id: 'colors',
    label: 'Colors',
    sourceKeys: ['colors', 'phenology'],
  },
  {
    id: 'seasons',
    label: 'Seasons',
    sourceKeys: ['seasons', 'phenology'],
  },
  {
    id: 'description',
    label: 'Description',
    sourceKeys: ['description', 'meta'],
  },
]

export const AI_FIELD_STATUS_TEXT: Record<AiFieldStatus, string> = {
  pending: 'Pending',
  working: 'In progress',
  filled: 'Filled',
  missing: 'Needs review',
}

export interface AiFieldStateSnapshot {
  scientificName: string
  colors: string
  seasons: string[]
  description: string
}

export function createInitialStatuses(): Record<RequiredFieldId, AiFieldStatus> {
  return REQUIRED_FIELD_CONFIG.reduce(
    (acc, { id }) => {
      acc[id] = 'pending'
      return acc
    },
    {} as Record<RequiredFieldId, AiFieldStatus>,
  )
}

export function normalizeColorList(value: unknown): string[] {
  if (!value) return []
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((item) => {
            if (typeof item === 'string') return item
            if (item && typeof item === 'object' && 'name' in item && typeof (item as any).name === 'string') {
              return (item as any).name
            }
            return null
          })
          .filter((entry): entry is string => !!entry)
          .map((entry) => entry.trim())
          .filter(Boolean),
      ),
    )
  }
  if (typeof value === 'string') {
    return value
      .split(/[,|]/)
      .map((entry) => entry.trim())
      .filter(Boolean)
  }
  return []
}

const MONTH_TO_SEASON: Record<number, 'Winter' | 'Spring' | 'Summer' | 'Autumn'> = {
  12: 'Winter',
  1: 'Winter',
  2: 'Winter',
  3: 'Spring',
  4: 'Spring',
  5: 'Spring',
  6: 'Summer',
  7: 'Summer',
  8: 'Summer',
  9: 'Autumn',
  10: 'Autumn',
  11: 'Autumn',
}

function normalizeSeasonString(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const lower = trimmed.toLowerCase()
  if (lower.startsWith('spr')) return 'Spring'
  if (lower.startsWith('sum')) return 'Summer'
  if (lower.startsWith('aut') || lower.startsWith('fal')) return 'Autumn'
  if (lower.startsWith('win')) return 'Winter'
  return null
}

export function normalizeSeasonList(value: unknown): string[] {
  if (!value) return []
  const seasons = new Set<string>()

  if (Array.isArray(value)) {
    value.forEach((entry) => {
      if (typeof entry === 'string') {
        const normalized = normalizeSeasonString(entry)
        if (normalized) seasons.add(normalized)
      } else if (typeof entry === 'number' && MONTH_TO_SEASON[entry]) {
        seasons.add(MONTH_TO_SEASON[entry])
      }
    })
  } else if (typeof value === 'string') {
    const normalized = normalizeSeasonString(value)
    if (normalized) seasons.add(normalized)
  } else if (typeof value === 'object' && value) {
    // Support objects like { floweringMonths: number[] }
    const maybeMonths = (value as any).floweringMonths
    if (Array.isArray(maybeMonths)) {
      maybeMonths.forEach((month) => {
        if (typeof month === 'number' && MONTH_TO_SEASON[month]) {
          seasons.add(MONTH_TO_SEASON[month])
        }
      })
    }
  }

  return Array.from(seasons)
}

export function isFieldFilledFromState(id: RequiredFieldId, state: AiFieldStateSnapshot): boolean {
  switch (id) {
    case 'scientificName':
      return state.scientificName.trim().length > 0
    case 'colors':
      return normalizeColorList(state.colors).length > 0
    case 'seasons':
      return Array.isArray(state.seasons) && state.seasons.length > 0
    case 'description':
      return state.description.trim().length > 0
    default:
      return false
  }
}

export function isFieldFilledFromData(
  id: RequiredFieldId,
  fieldKey: string,
  fieldData: unknown,
): boolean {
  switch (id) {
    case 'scientificName': {
      if (fieldKey === 'identifiers' && fieldData && typeof fieldData === 'object') {
        const sci = (fieldData as any).scientificName
        return typeof sci === 'string' && sci.trim().length > 0
      }
      if (fieldKey === 'scientificName' && typeof fieldData === 'string') {
        return fieldData.trim().length > 0
      }
      return false
    }
    case 'colors': {
      if (fieldKey === 'colors') {
        return normalizeColorList(fieldData).length > 0
      }
      if (fieldKey === 'phenology' && fieldData && typeof fieldData === 'object') {
        return normalizeColorList((fieldData as any).flowerColors).length > 0
      }
      return false
    }
    case 'seasons': {
      if (fieldKey === 'seasons') {
        return normalizeSeasonList(fieldData).length > 0
      }
      if (fieldKey === 'phenology' && fieldData && typeof fieldData === 'object') {
        return normalizeSeasonList((fieldData as any).floweringMonths).length > 0
      }
      return false
    }
    case 'description': {
      if (fieldKey === 'description' && typeof fieldData === 'string') {
        return fieldData.trim().length > 0
      }
      if (fieldKey === 'meta' && fieldData && typeof fieldData === 'object') {
        const value = (fieldData as any).description || (fieldData as any).longDescription
        return typeof value === 'string' && value.trim().length > 0
      }
      return false
    }
    default:
      return false
  }
}
