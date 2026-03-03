import type { Plant } from "@/types/plant"
import { monthSlugToNumber } from "@/lib/months"

const DAYS_IN_MS = 24 * 60 * 60 * 1000

/**
 * Checks if a plant should be featured as "Plant of the Month"
 *
 * plant.featuredMonth is a MonthSlug[] (e.g. ["february"])
 */
export const isPlantOfTheMonth = (plant?: Plant | null, referenceDate: Date = new Date()): boolean => {
  if (!plant) return false
  if (!Array.isArray(plant.featuredMonth) || plant.featuredMonth.length === 0) return false
  const currentMonth = referenceDate.getMonth() + 1
  return plant.featuredMonth.some(slug => monthSlugToNumber(slug) === currentMonth)
}

// ⚡ Bolt: Optimize isNewPlant by avoiding `new Date()` allocations per call
// by relying directly on `Date.parse()` timestamps for math operations.
export const isNewPlant = (plant?: Plant | null, referenceDate: Date = new Date(), windowDays = 7): boolean => {
  const createdAtRaw = plant?.createdTime ?? plant?.meta?.createdAt as string | undefined
  if (!createdAtRaw) return false
  const createdAtTs = Date.parse(createdAtRaw)
  if (Number.isNaN(createdAtTs)) return false

  const diff = referenceDate.getTime() - createdAtTs
  return diff >= 0 && diff <= windowDays * DAYS_IN_MS
}

export const isPopularPlant = (plant?: Plant | null): boolean => Boolean(plant?.popularity?.isTopPick)

const DANGEROUS_TOXICITY = new Set(['very_toxic', 'deadly'])

/** Returns true when either toxicityHuman or toxicityPets is very_toxic or deadly. */
export const isDangerouslyToxic = (plant?: Plant | null): boolean => {
  if (!plant) return false
  return DANGEROUS_TOXICITY.has(plant.toxicityHuman ?? '') || DANGEROUS_TOXICITY.has(plant.toxicityPets ?? '')
}
