export type PlantFormCategory =
  | 'basics'
  | 'identity'
  | 'plantCare'
  | 'growth'
  | 'usage'
  | 'ecology'
  | 'danger'
  | 'miscellaneous'
  | 'meta'

export const plantFormCategoryOrder: PlantFormCategory[] = [
  'basics',
  'identity',
  'plantCare',
  'growth',
  'usage',
  'ecology',
  'danger',
  'miscellaneous',
  'meta',
]

const fieldCategoryOverrides: Record<string, PlantFormCategory> = {
  identity: 'identity',
  plantCare: 'plantCare',
  growth: 'growth',
  usage: 'usage',
  ecology: 'ecology',
  danger: 'danger',
  miscellaneous: 'miscellaneous',
  meta: 'meta',
}

export function mapFieldToCategory(fieldKey: string): PlantFormCategory {
  return fieldCategoryOverrides[fieldKey] || 'basics'
}

export type CategoryProgress = Record<
  PlantFormCategory,
  { total: number; completed: number; status: 'idle' | 'filling' | 'done' }
>

export function createEmptyCategoryProgress(): CategoryProgress {
  return plantFormCategoryOrder.reduce<CategoryProgress>((acc, key) => {
    acc[key] = { total: 0, completed: 0, status: 'idle' }
    return acc
  }, {} as CategoryProgress)
}

export function buildCategoryProgress(fieldKeys: string[]): CategoryProgress {
  const progress = createEmptyCategoryProgress()

  for (const key of fieldKeys) {
    const category = mapFieldToCategory(key)
    progress[category] = {
      total: (progress[category]?.total || 0) + 1,
      completed: progress[category]?.completed || 0,
      status: 'filling',
    }
  }

  return progress
}
