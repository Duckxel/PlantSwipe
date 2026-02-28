import type { Plant } from "@/types/plant"
import { monthSlugToNumber } from "@/lib/months"

const DAYS_IN_MS = 24 * 60 * 60 * 1000

const normalizeMonth = (value?: number | string | null): number | null => {
  if (value === undefined || value === null) return null
  const monthNumber = typeof value === "number" ? value : Number.parseInt(String(value), 10)
  if (Number.isNaN(monthNumber)) return null
  if (monthNumber < 1 || monthNumber > 12) return null
  return monthNumber
}

const parseDate = (value?: string): Date | null => {
  if (!value) return null
  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) return null
  return new Date(timestamp)
}

/**
 * Checks if a plant should be featured as "Plant of the Month"
 *
 * New schema: plant.featuredMonth is a MonthSlug[] (e.g. ["february"])
 * Legacy fallback: plant.planting?.calendar?.promotionMonth or plant.identity?.promotionMonth (number 1-12)
 */
export const isPlantOfTheMonth = (plant?: Plant | null, referenceDate: Date = new Date()): boolean => {
  if (!plant) return false
  const currentMonth = referenceDate.getMonth() + 1

  // New flat schema: featuredMonth is MonthSlug[] (e.g. ["february", "march"])
  if (Array.isArray(plant.featuredMonth) && plant.featuredMonth.length > 0) {
    return plant.featuredMonth.some(slug => monthSlugToNumber(slug) === currentMonth)
  }

  // Legacy nested fields
  const promotionMonth = normalizeMonth(
    plant.planting?.calendar?.promotionMonth ?? plant.identity?.promotionMonth
  )
  if (promotionMonth) return promotionMonth === currentMonth

  return false
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

