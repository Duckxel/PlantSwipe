import type { PlantPhoto } from "@/types/plant"

const normalizeBoolean = (value: unknown): boolean => value === true

export function createEmptyPhoto(isPrimary = false): PlantPhoto {
  return { url: "", isPrimary, isVertical: false }
}

export function sanitizePlantPhotos(photos: PlantPhoto[]): PlantPhoto[] {
  const sanitized: PlantPhoto[] = []
  const seen = new Set<string>()

  photos.forEach((photo) => {
    const url = typeof photo?.url === "string" ? photo.url.trim() : ""
    if (!url) return
    const key = url.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    sanitized.push({
      url,
      isPrimary: normalizeBoolean(photo.isPrimary),
      isVertical: normalizeBoolean(photo.isVertical),
    })
  })

  if (sanitized.length === 0) {
    return sanitized
  }

  let primaryIndex = sanitized.findIndex((photo) => photo.isPrimary)
  if (primaryIndex === -1) {
    primaryIndex = 0
  }

  return sanitized.map((photo, index) => ({
    ...photo,
    isPrimary: index === primaryIndex,
  }))
}

export function normalizePlantPhotos(raw: unknown, fallbackUrl?: string | null): PlantPhoto[] {
  const source = Array.isArray(raw) ? raw : []
  const coalesced = source
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null
      const url = typeof (entry as any).url === "string" ? (entry as any).url.trim() : ""
      if (!url) return null
      return {
        url,
        isPrimary: normalizeBoolean((entry as any).isPrimary),
        isVertical: normalizeBoolean((entry as any).isVertical),
      } satisfies PlantPhoto
    })
    .filter((entry): entry is PlantPhoto => !!entry)

  let sanitized = sanitizePlantPhotos(coalesced)

  if (sanitized.length === 0) {
    const fallback = typeof fallbackUrl === "string" ? fallbackUrl.trim() : ""
    if (fallback) {
      sanitized = sanitizePlantPhotos([{ url: fallback, isPrimary: true, isVertical: false }])
    }
  }

  return sanitized
}

export function getPrimaryPhotoUrl(photos: PlantPhoto[]): string {
  const primary = photos.find((photo) => photo.isPrimary && photo.url.trim())
  if (primary) return primary.url.trim()
  const first = photos.find((photo) => photo.url.trim())
  return first ? first.url.trim() : ""
}

export function upsertPrimaryPhoto(current: PlantPhoto[], url: string): PlantPhoto[] {
  const trimmed = typeof url === "string" ? url.trim() : ""
  if (!trimmed) return current

  const sanitized = sanitizePlantPhotos(current)
  const existingIndex = sanitized.findIndex((photo) => photo.url === trimmed)

  if (existingIndex !== -1) {
    return sanitized.map((photo, index) => ({
      ...photo,
      isPrimary: index === existingIndex,
    }))
  }

  return sanitizePlantPhotos([{ url: trimmed, isPrimary: true, isVertical: false }, ...sanitized])
}

export function ensureAtLeastOnePhoto(photos: PlantPhoto[]): PlantPhoto[] {
  return photos.length > 0 ? photos : [createEmptyPhoto(true)]
}
