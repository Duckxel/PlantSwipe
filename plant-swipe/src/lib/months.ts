export const MONTH_SLUGS = [
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

const monthSlugLookup = MONTH_SLUGS.reduce((acc, slug, index) => {
  const value = index + 1
  acc[slug] = value
  acc[slug.slice(0, 3)] = value
  acc[String(value)] = value
  acc[value.toString().padStart(2, '0')] = value
  return acc
}, {} as Record<string, number>)

export function monthNumberToSlug(value?: number | null): string | null {
  if (typeof value !== 'number') return null
  const int = Math.round(value)
  if (int < 1 || int > MONTH_SLUGS.length) return null
  return MONTH_SLUGS[int - 1]
}

export function monthNumbersToSlugs(values?: number[] | null): string[] {
  if (!Array.isArray(values)) return []
  return values
    .map((entry) => monthNumberToSlug(entry))
    .filter((slug): slug is string => typeof slug === 'string')
}

export function monthSlugToNumber(value?: string | null): number | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  if (!normalized) return null
  return monthSlugLookup[normalized] ?? null
}

export function monthSlugsToNumbers(values?: string[] | null): number[] {
  if (!Array.isArray(values)) return []
  const result: number[] = []
  for (const entry of values) {
    const normalized = monthSlugToNumber(entry)
    if (normalized && !result.includes(normalized)) {
      result.push(normalized)
    }
  }
  return result
}
