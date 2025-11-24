import type { PlantImage, PlantPhoto } from "@/types/plant"

export const MAX_PLANT_PHOTOS = 5

const normalizeBoolean = (value: unknown): boolean => value === true

export function createEmptyPhoto(isPrimary = false): PlantPhoto {
  return { url: "", isPrimary, isVertical: false }
}

export function sanitizePlantPhotos(photos: PlantPhoto[]): PlantPhoto[] {
  const sanitized: PlantPhoto[] = []
  const seen = new Set<string>()

  for (const photo of photos) {
    if (sanitized.length >= MAX_PLANT_PHOTOS) break
    const url = typeof photo?.url === "string" ? photo.url.trim() : ""
    if (!url) continue
    const key = url.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    sanitized.push({
      url,
      isPrimary: normalizeBoolean(photo.isPrimary),
      isVertical: normalizeBoolean(photo.isVertical),
    })
  }

  if (sanitized.length === 0) {
    return sanitized
  }

  let primaryIndex = sanitized.findIndex((photo) => photo.isPrimary)
  if (primaryIndex === -1) {
    primaryIndex = 0
  }

  let verticalIndex: number | null = sanitized.findIndex((photo) => photo.isVertical)
  if (verticalIndex === -1) {
    verticalIndex = null
  }

  return sanitized.map((photo, index) => ({
    ...photo,
    isPrimary: index === primaryIndex,
    isVertical: verticalIndex !== null ? index === verticalIndex : false,
  }))
}

export function normalizePlantPhotos(raw: unknown, fallbackUrl?: string | null): PlantPhoto[] {
  const source = Array.isArray(raw) ? raw : []
  const coalesced: PlantPhoto[] = []

  for (const entry of source) {
    if (!entry || typeof entry !== "object") continue
    const url = typeof (entry as any).url === "string" ? (entry as any).url.trim() : ""
    if (!url) continue
    coalesced.push({
      url,
      isPrimary: normalizeBoolean((entry as any).isPrimary),
      isVertical: normalizeBoolean((entry as any).isVertical),
    })
    if (coalesced.length >= MAX_PLANT_PHOTOS) break
  }

  let sanitized = sanitizePlantPhotos(coalesced)

  if (sanitized.length === 0) {
    const fallback = typeof fallbackUrl === "string" ? fallbackUrl.trim() : ""
    if (fallback) {
      sanitized = sanitizePlantPhotos([{ url: fallback, isPrimary: true, isVertical: false }])
    }
  }

  return sanitized
}

const safeTrim = (value?: string) => (typeof value === "string" ? value.trim() : "")

export function getPrimaryPhotoUrl(photos: PlantPhoto[]): string {
  const primary = photos.find((photo) => photo.isPrimary && safeTrim(photo.url))
  if (primary) return safeTrim(primary.url)
  const first = photos.find((photo) => safeTrim(photo.url))
  return first ? safeTrim(first.url) : ""
}

export function getVerticalPhotoUrl(photos: PlantPhoto[]): string {
  const vertical = photos.find((photo) => photo.isVertical && safeTrim(photo.url))
  if (vertical) return safeTrim(vertical.url)
  return ""
}

const extractImageLink = (image?: PlantImage | null): string => {
  if (!image) return ""
  return safeTrim(image.link) || safeTrim(image.url)
}

const getImageLinkByUse = (images: PlantImage[] | undefined, use: PlantImage["use"]): string => {
  if (!Array.isArray(images) || !use) return ""
  const candidate = images.find((image) => image?.use === use && extractImageLink(image))
  return extractImageLink(candidate)
}

export function getDiscoveryPageImageUrl(
  plant?: { images?: PlantImage[]; photos?: PlantPhoto[]; image?: string },
): string {
  if (!plant) return ""
  const discovery = getImageLinkByUse(plant.images, "discovery")
  if (discovery) return discovery

  const primary = getImageLinkByUse(plant.images, "primary")
  if (primary) return primary

  if (plant.photos) {
    const vertical = getVerticalPhotoUrl(plant.photos)
    if (vertical) return vertical

    const primaryPhoto = getPrimaryPhotoUrl(plant.photos)
    if (primaryPhoto) return primaryPhoto
  }

  return safeTrim(plant.image)
}

export function upsertPrimaryPhoto(current: PlantPhoto[], url: string): PlantPhoto[] {
  const trimmed = typeof url === "string" ? url.trim() : ""
  if (!trimmed) return current

  const sanitized = sanitizePlantPhotos(current)
  const existingIndex = sanitized.findIndex((photo) => photo.url === trimmed)

  let next = sanitized
  if (existingIndex !== -1) {
    next = sanitized.map((photo, index) => ({
      ...photo,
      isPrimary: index === existingIndex,
    }))
  } else {
    next = sanitizePlantPhotos([{ url: trimmed, isPrimary: true, isVertical: false }, ...sanitized])
  }

  return next.slice(0, MAX_PLANT_PHOTOS)
}

export function ensureAtLeastOnePhoto(photos: PlantPhoto[]): PlantPhoto[] {
  const defined = photos.filter((photo) => typeof photo?.url === "string" && photo.url.trim())
  let sanitized = sanitizePlantPhotos(defined)
  const hasBlankPlaceholder = photos.some((photo) => !photo.url || !photo.url.trim())
  if ((hasBlankPlaceholder || sanitized.length === 0) && sanitized.length < MAX_PLANT_PHOTOS) {
    sanitized = [...sanitized, createEmptyPhoto(sanitized.every((photo) => !photo.isPrimary))]
  }
  return sanitized
}
