export type RequiredFieldId =
  | 'scientificName'
  | 'colors'
  | 'seasons'
  | 'description'
  | 'funFact'
  | 'classification'

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
    label: 'Overview',
    sourceKeys: ['description', 'meta'],
  },
  {
    id: 'funFact',
      label: 'Fun Fact',
    sourceKeys: ['meta'],
  },
    {
      id: 'classification',
      label: 'Classification',
      sourceKeys: ['classification'],
    },
]

export const AI_FIELD_STATUS_TEXT: Record<AiFieldStatus, string> = {
  pending: 'Pending',
  working: 'In progress',
  filled: 'Filled',
  missing: 'Needs review',
}

export const REQUIRED_FIELD_TO_SCHEMA_KEY: Record<RequiredFieldId, string> = {
  scientificName: 'identifiers',
  colors: 'colors',
  seasons: 'seasons',
  description: 'description',
  funFact: 'meta',
  classification: 'classification',
}

export interface AiFieldStateSnapshot {
  scientificName: string
  colors: string
  seasons: string[]
  description: string
  funFact: string
  classificationType: string
}

export const MIN_DESCRIPTION_WORDS = 100
export const MAX_DESCRIPTION_WORDS = 400

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

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export function countSentences(text: string): number {
  return text
    .split(/[.!?]+/)
    .map((sentence) => sentence.replace(/\s+/g, ' ').trim())
    .filter(Boolean).length
}

export function isDescriptionValid(value: string): boolean {
  const words = countWords(value)
  return words >= MIN_DESCRIPTION_WORDS && words <= MAX_DESCRIPTION_WORDS
}

export function isFunFactValid(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  const sentenceCount = countSentences(trimmed)
  return sentenceCount >= 1 && sentenceCount <= 3
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
      return isDescriptionValid(state.description)
    case 'funFact':
      return isFunFactValid(state.funFact)
    case 'classification':
      return state.classificationType.trim().length > 0
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
      return isDescriptionValid(fieldData)
    }
    if (fieldKey === 'meta' && fieldData && typeof fieldData === 'object') {
      const value = (fieldData as any).description || (fieldData as any).longDescription
      return typeof value === 'string' && isDescriptionValid(value)
    }
    return false
  }
    case 'funFact': {
      if (fieldKey === 'meta' && fieldData && typeof fieldData === 'object') {
        const value = (fieldData as any).funFact
        return typeof value === 'string' && isFunFactValid(value)
      }
      if (fieldKey === 'funFact' && typeof fieldData === 'string') {
        return isFunFactValid(fieldData)
      }
      return false
    }
      case 'classification': {
        if (fieldKey === 'classification' && fieldData && typeof fieldData === 'object') {
          const value = (fieldData as any).type
          return typeof value === 'string' && value.trim().length > 0
        }
        return false
      }
    default:
      return false
  }
}
