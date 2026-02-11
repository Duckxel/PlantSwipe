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
  const limit = options?.limit ?? 12
  const signal = options?.signal
  const { onSourceStart, onSourceDone } = options?.callbacks || {}

  const allImages: ExternalImage[] = []
  const counts: Record<ExternalImageSource, number> = {
    serpapi: 0,
    gbif: 0,
    smithsonian: 0,
  }
  const errors: string[] = []

  // Limits per source: SerpAPI gets 5, others get the full limit
  const sourceLimits: Record<ExternalImageSource, number> = {
    serpapi: 5,
    gbif: limit,
    smithsonian: limit,
  }

  for (const { key, label } of IMAGE_SOURCES) {
    if (signal?.aborted) break

    onSourceStart?.(key)

    try {
      const images = await fetchFromSource(
        key,
        plantName,
        sourceLimits[key],
        headers,
        signal
      )
      counts[key] = images.length
      allImages.push(...images)

      onSourceDone?.({
        source: key,
        label,
        images,
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
