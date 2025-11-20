const DB_VALUES = ['flowerbed', 'path', 'hedge', 'ground cover', 'pot'] as const
const DB_VALUE_SET = new Set(DB_VALUES)

const DB_TO_UI_MAP: Record<(typeof DB_VALUES)[number], string> = {
  flowerbed: 'Flowerbed',
  path: 'Path',
  hedge: 'Hedge',
  'ground cover': 'Ground Cover',
  pot: 'Pot',
}

const UI_TO_DB_ENTRIES = Object.entries(DB_TO_UI_MAP).map(([db, ui]) => [ui.toLowerCase(), db]) as Array<[string, string]>
const UI_TO_DB_MAP: Record<string, string> = UI_TO_DB_ENTRIES.reduce((acc, [uiLower, db]) => {
  acc[uiLower] = db
  return acc
}, {} as Record<string, string>)

export function normalizeCompositionForDb(values?: string[] | null): string[] {
  if (!values?.length) return []
  const result: string[] = []
  for (const raw of values) {
    if (!raw) continue
    const trimmed = raw.trim()
    if (!trimmed) continue
    const lower = trimmed.toLowerCase()
    let dbValue: string | undefined
    if (DB_VALUE_SET.has(trimmed as (typeof DB_VALUES)[number])) {
      dbValue = trimmed.toLowerCase()
    } else if (DB_VALUE_SET.has(lower as (typeof DB_VALUES)[number])) {
      dbValue = lower
    } else if (UI_TO_DB_MAP[lower]) {
      dbValue = UI_TO_DB_MAP[lower]
    }
    if (!dbValue) continue
    if (!result.includes(dbValue)) {
      result.push(dbValue)
    }
  }
  return result
}

export function expandCompositionFromDb(values?: string[] | null): string[] {
  if (!values?.length) return []
  const result: string[] = []
  for (const raw of values) {
    if (!raw) continue
    const lower = raw.trim().toLowerCase()
    if (!lower) continue
    const uiValue = DB_TO_UI_MAP[lower as (typeof DB_VALUES)[number]]
    if (uiValue && !result.includes(uiValue)) {
      result.push(uiValue)
    }
  }
  return result
}
