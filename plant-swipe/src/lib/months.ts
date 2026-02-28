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

/**
 * Normalize a mixed array of month values (numbers, slug strings, short names)
 * into an array of canonical slug strings (e.g. "january", "february").
 * Handles data that may have been saved as numbers (1-12) or slugs.
 */
export function normalizeMonthsToSlugs(values?: unknown[] | null): string[] {
  if (!Array.isArray(values)) return []
  const result: string[] = []
  for (const entry of values) {
    let slug: string | null = null
    if (typeof entry === 'number') {
      slug = monthNumberToSlug(entry)
    } else if (typeof entry === 'string') {
      const lower = entry.trim().toLowerCase()
      if ((MONTH_SLUGS as readonly string[]).includes(lower)) {
        slug = lower
      } else {
        const num = monthSlugToNumber(entry)
        if (num) slug = MONTH_SLUGS[num - 1]
      }
    }
    if (slug && !result.includes(slug)) {
      result.push(slug)
    }
  }
  return result
}
