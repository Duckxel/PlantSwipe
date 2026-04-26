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

// ⚡ Bolt: Replace reduce with a single-pass for loop to eliminate intermediate array allocations
const monthSlugLookup: Record<string, number> = {}
for (let i = 0; i < MONTH_SLUGS.length; i++) {
  const slug = MONTH_SLUGS[i]
  const value = i + 1
  monthSlugLookup[slug] = value
  monthSlugLookup[slug.slice(0, 3)] = value
  monthSlugLookup[String(value)] = value
  monthSlugLookup[value.toString().padStart(2, '0')] = value
}

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
