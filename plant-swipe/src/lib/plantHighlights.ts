import type { Plant } from "@/types/plant"
import { monthSlugToNumber } from "@/lib/months"

const DAYS_IN_MS = 24 * 60 * 60 * 1000

const parseDate = (value?: string): Date | null => {
  if (!value) return null
  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) return null
  return new Date(timestamp)
}

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

export const isNewPlant = (plant?: Plant | null, referenceDate: Date = new Date(), windowDays = 7): boolean => {
  const createdAtRaw = plant?.createdTime ?? plant?.meta?.createdAt as string | undefined
  if (!createdAtRaw) return false
  const createdAt = parseDate(createdAtRaw)
  if (!createdAt) return false

  const diff = referenceDate.getTime() - createdAt.getTime()
  return diff >= 0 && diff <= windowDays * DAYS_IN_MS
}

export const isPopularPlant = (plant?: Plant | null): boolean => Boolean(plant?.popularity?.isTopPick)
