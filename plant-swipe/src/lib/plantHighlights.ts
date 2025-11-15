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

export const isPlantOfTheMonth = (plant?: Plant | null, referenceDate: Date = new Date()): boolean => {
  if (!plant?.planting?.calendar) return false
  const promotionMonth = normalizeMonth(plant.planting.calendar.promotionMonth)
  if (!promotionMonth) return false
  return promotionMonth === referenceDate.getMonth() + 1
}

export const isNewPlant = (plant?: Plant | null, referenceDate: Date = new Date(), windowDays = 7): boolean => {
  if (!plant?.meta?.createdAt) return false
  const createdAt = parseDate(plant.meta.createdAt)
  if (!createdAt) return false
  const diff = referenceDate.getTime() - createdAt.getTime()
  return diff >= 0 && diff <= windowDays * DAYS_IN_MS
}

export const isPopularPlant = (plant?: Plant | null): boolean => Boolean(plant?.popularity?.isTopPick)

export const getPlantLikeCount = (plant?: Plant | null): number | null => {
  if (!plant?.popularity || typeof plant.popularity.likes !== "number") return null
  return plant.popularity.likes
}

export const formatLikeCount = (likes: number, locale?: string): string => {
  if (!Number.isFinite(likes)) return "0"
  const formatter = new Intl.NumberFormat(locale ?? undefined, {
    notation: likes >= 1000 ? "compact" : "standard",
    maximumFractionDigits: likes >= 1000 ? 1 : 0,
  })
  return formatter.format(likes)
}
