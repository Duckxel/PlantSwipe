const DB_VALUES = ['flowerbed', 'path', 'hedge', 'ground cover', 'pot'] as const
const UI_VALUES = ['Flowerbed', 'Path', 'Hedge', 'Ground Cover', 'Pot'] as const

export type CompositionDbValue = typeof DB_VALUES[number]
export type CompositionUiValue = typeof UI_VALUES[number]

const DB_VALUE_SET = new Set<string>(DB_VALUES)
const UI_VALUE_SET = new Set<string>(UI_VALUES)

const DB_TO_UI_MAP: Record<CompositionDbValue, CompositionUiValue> = {
  flowerbed: 'Flowerbed',
  path: 'Path',
  hedge: 'Hedge',
  'ground cover': 'Ground Cover',
  pot: 'Pot',
}

const UI_TO_DB_MAP = Object.entries(DB_TO_UI_MAP).reduce(
  (acc, [db, ui]) => {
    acc[ui as CompositionUiValue] = db as CompositionDbValue
    return acc
  },
  {} as Record<CompositionUiValue, CompositionDbValue>,
)

const UI_LOWER_TO_DB_MAP = UI_VALUES.reduce((acc, ui) => {
  acc[ui.toLowerCase()] = UI_TO_DB_MAP[ui]
  return acc
}, {} as Record<string, CompositionDbValue>)

function coerceDbValue(raw?: string | null): CompositionDbValue | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  const lower = trimmed.toLowerCase()
  if (DB_VALUE_SET.has(lower)) {
    return lower as CompositionDbValue
  }
  if (UI_VALUE_SET.has(trimmed)) {
    const mapped = UI_TO_DB_MAP[trimmed as CompositionUiValue]
    return mapped ?? null
  }
  return UI_LOWER_TO_DB_MAP[lower] || null
}

export function normalizeCompositionForDb(values?: string[] | null): CompositionDbValue[] {
  if (!values?.length) return []
  const result: CompositionDbValue[] = []
  for (const raw of values) {
    const dbValue = coerceDbValue(raw)
    if (!dbValue) continue
    if (!result.includes(dbValue)) result.push(dbValue)
  }
  return result
}

export function expandCompositionFromDb(values?: string[] | null): CompositionUiValue[] {
  if (!values?.length) return []
  const result: CompositionUiValue[] = []
  for (const raw of values) {
    const trimmed = raw?.trim().toLowerCase()
    if (!trimmed) continue
    const uiValue = DB_TO_UI_MAP[trimmed as CompositionDbValue]
    if (uiValue && !result.includes(uiValue)) {
      result.push(uiValue)
    }
  }
  return result
}
