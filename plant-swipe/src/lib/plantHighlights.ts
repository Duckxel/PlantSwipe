import type { Plant } from "@/types/plant"

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
 * Database schema (000_sync_schema.sql):
 *   promotion_month text check (promotion_month in ('january','february',...,'december'))
 * 
 * The loaders convert text slugs to numbers (1-12) via monthSlugToNumber().
 * This function checks if the plant's promotion month matches the current month.
 */
export const isPlantOfTheMonth = (plant?: Plant | null, referenceDate: Date = new Date()): boolean => {
  if (!plant) return false
  // Check both possible locations for promotionMonth (number 1-12)
  // - planting.calendar.promotionMonth (used by loadPlantPreviews & loadPlantsWithTranslations)
  // - identity.promotionMonth (legacy location)
  const promotionMonth = normalizeMonth(
    plant.planting?.calendar?.promotionMonth ?? plant.identity?.promotionMonth
  )
  if (!promotionMonth) return false
  return promotionMonth === referenceDate.getMonth() + 1
}

export const isNewPlant = (plant?: Plant | null, referenceDate: Date = new Date(), windowDays = 7): boolean => {
  const createdAtRaw = plant?.meta?.createdAt
  if (!createdAtRaw) return false
  const createdAt = parseDate(createdAtRaw)
  if (!createdAt) return false

  const diff = referenceDate.getTime() - createdAt.getTime()
  return diff >= 0 && diff <= windowDays * DAYS_IN_MS
}

export const isPopularPlant = (plant?: Plant | null): boolean => Boolean(plant?.popularity?.isTopPick)

