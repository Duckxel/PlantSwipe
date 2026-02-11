import { supabase } from "@/lib/supabaseClient"

export type ExternalImageSource = "serpapi" | "gbif" | "smithsonian"

export interface ExternalImage {
  url: string
  license: string
  source: ExternalImageSource
  creator?: string | null
  title?: string | null
  thumbnail?: string | null
}

export interface SourceResult {
  source: ExternalImageSource
  label: string
  images: ExternalImage[]
  status: "idle" | "loading" | "done" | "error" | "skipped"
  error?: string
}

export interface ExternalImagesResult {
  images: ExternalImage[]
  gbifCount: number
  smithsonianCount: number
  serpapiCount: number
  errors?: string[]
}

export interface FetchExternalImagesCallbacks {
  /** Called when a source starts loading */
  onSourceStart?: (source: ExternalImageSource) => void
  /** Called when a source finishes (success or error) */
  onSourceDone?: (result: SourceResult) => void
  signal?: AbortSignal
}

/** All sources in fetch order */
export const IMAGE_SOURCES: { key: ExternalImageSource; label: string }[] = [
  { key: "serpapi", label: "Google Images" },
  { key: "gbif", label: "GBIF" },
  { key: "smithsonian", label: "Smithsonian" },
]

async function buildAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  }

  try {
    const session = (await supabase.auth.getSession()).data.session
    const token = session?.access_token
    if (token) {
      headers["Authorization"] = `Bearer ${token}`
    }
  } catch (err) {
    console.error("Failed to get Supabase session for external images:", err)
  }

  try {
    const token = (
      globalThis as typeof globalThis & {
        __ENV__?: { VITE_ADMIN_STATIC_TOKEN?: unknown }
      }
    ).__ENV__?.VITE_ADMIN_STATIC_TOKEN
    if (token) {
      headers["X-Admin-Token"] = String(token)
    }
  } catch {}

  return headers
}

async function fetchFromSource(
  source: ExternalImageSource,
  plantName: string,
  limit: number,
  headers: Record<string, string>,
  signal?: AbortSignal
): Promise<ExternalImage[]> {
  const url = `/api/admin/images/${source}`
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ plantName, limit }),
    signal,
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    // For 503 (not configured) - skip silently
    if (response.status === 503) {
      console.log(`[externalImages] ${source}: not configured, skipping`)
      return []
    }
    throw new Error(data.error || `${source} returned ${response.status}`)
  }

  const data = await response.json()

  // SerpAPI may return success with skipped=true when rate limited
  if (data.skipped) {
    console.log(`[externalImages] ${source}: skipped - ${data.reason || "unknown"}`)
    return []
  }

  return (data.images || []).map((img: ExternalImage) => ({
    ...img,
    source,
  }))
}

/**
 * Fetch free-to-use plant images from all sources (SerpAPI, GBIF, Smithsonian).
 * Calls each API individually with per-source progress callbacks.
 */
export async function fetchExternalPlantImages(
  plantName: string,
  options?: {
    limit?: number
    signal?: AbortSignal
    callbacks?: FetchExternalImagesCallbacks
  }
): Promise<ExternalImagesResult> {
  const empty: ExternalImagesResult = {
    images: [],
    gbifCount: 0,
    smithsonianCount: 0,
    serpapiCount: 0,
  }

  if (!plantName.trim()) return empty

  const headers = await buildAuthHeaders()
  const signal = options?.signal
  const { onSourceStart, onSourceDone } = options?.callbacks || {}

  // Hard cap: never add more than this many images total across all sources
  const MAX_TOTAL_IMAGES = 15

  const allImages: ExternalImage[] = []
  const counts: Record<ExternalImageSource, number> = {
    serpapi: 0,
    gbif: 0,
    smithsonian: 0,
  }
  const errors: string[] = []

  // Per-source limits (kept small to avoid flooding the page)
  const sourceLimits: Record<ExternalImageSource, number> = {
    serpapi: 5,
    gbif: 8,
    smithsonian: 5,
  }

  for (const { key, label } of IMAGE_SOURCES) {
    if (signal?.aborted) break
    // Stop if we already have enough images
    if (allImages.length >= MAX_TOTAL_IMAGES) {
      onSourceDone?.({
        source: key,
        label,
        images: [],
        status: "done",
      })
      continue
    }

    onSourceStart?.(key)

    try {
      // Ask the server for up to the source limit, but we may cap locally
      const remaining = MAX_TOTAL_IMAGES - allImages.length
      const askLimit = Math.min(sourceLimits[key], remaining)
      const images = await fetchFromSource(
        key,
        plantName,
        askLimit,
        headers,
        signal
      )
      // Cap locally in case server returns more than asked
      const capped = images.slice(0, MAX_TOTAL_IMAGES - allImages.length)
      counts[key] = capped.length
      allImages.push(...capped)

      onSourceDone?.({
        source: key,
        label,
        images: capped,
        status: "done",
      })

      console.log(
        `[externalImages] ${label}: ${images.length} images found for "${plantName}"`
      )
    } catch (err) {
      if (
        err instanceof DOMException &&
        err.name === "AbortError"
      ) {
        throw err
      }
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${label}: ${msg}`)
      counts[key] = 0

      onSourceDone?.({
        source: key,
        label,
        images: [],
        status: msg.includes("not configured") || msg.includes("503")
          ? "skipped"
          : "error",
        error: msg,
      })

      console.warn(`[externalImages] ${label} failed for "${plantName}":`, msg)
    }
  }

  return {
    images: allImages,
    gbifCount: counts.gbif,
    smithsonianCount: counts.smithsonian,
    serpapiCount: counts.serpapi,
    errors: errors.length > 0 ? errors : undefined,
  }
}

export interface PlantImageUploadResult {
  url: string
  bucket: string
  path: string
  sizeBytes: number
  originalSizeBytes: number
  compressionPercent: number
}

/**
 * Upload an external image URL to the PLANTS bucket.
 * The server fetches, optimizes to WebP, stores, and records in DB.
 */
export async function uploadPlantImageFromUrl(
  imageUrl: string,
  plantName: string,
  source: string,
  signal?: AbortSignal
): Promise<PlantImageUploadResult> {
  const headers = await buildAuthHeaders()
  const response = await fetch("/api/admin/plant-images/upload-from-url", {
    method: "POST",
    headers,
    body: JSON.stringify({ imageUrl, plantName, source }),
    signal,
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || `Upload failed (${response.status})`)
  }

  const data = await response.json()
  return {
    url: data.url,
    bucket: data.bucket,
    path: data.path,
    sizeBytes: data.sizeBytes,
    originalSizeBytes: data.originalSizeBytes,
    compressionPercent: data.compressionPercent,
  }
}

/**
 * Delete a plant image from storage and DB.
 * Only deletes images hosted in the PLANTS bucket.
 * External URLs (not managed) are silently skipped.
 */
export async function deletePlantImage(
  imageUrl: string,
  signal?: AbortSignal
): Promise<{ deleted: boolean }> {
  const headers = await buildAuthHeaders()
  const response = await fetch("/api/admin/plant-images/delete", {
    method: "POST",
    headers,
    body: JSON.stringify({ imageUrl }),
    signal,
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || `Delete failed (${response.status})`)
  }

  const data = await response.json()
  return { deleted: data.deleted ?? false }
}

/**
 * Check if a URL points to a managed plant image (PLANTS bucket).
 * Used to determine if removal should also delete from storage.
 */
export function isManagedPlantImageUrl(url: string): boolean {
  if (!url) return false
  // Check if URL goes through the media proxy or Supabase storage
  // Managed URLs contain the PLANTS bucket path
  return url.includes('/PLANTS/') || url.includes('/plants/')
}
