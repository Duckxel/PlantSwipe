import { supabase } from "@/lib/supabaseClient"

export interface ExternalImage {
  url: string
  license: string
  source: "gbif" | "smithsonian"
  creator?: string | null
  title?: string | null
  thumbnail?: string | null
}

export interface ExternalImagesResult {
  images: ExternalImage[]
  gbifCount: number
  smithsonianCount: number
  errors?: string[]
}

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

/**
 * Fetch CC0-licensed plant images from GBIF and Smithsonian Open Access.
 * Uses the combined `/api/admin/images/external` endpoint.
 */
export async function fetchExternalPlantImages(
  plantName: string,
  options?: { limit?: number; signal?: AbortSignal }
): Promise<ExternalImagesResult> {
  if (!plantName.trim()) {
    return { images: [], gbifCount: 0, smithsonianCount: 0 }
  }

  const headers = await buildAuthHeaders()
  const response = await fetch("/api/admin/images/external", {
    method: "POST",
    headers,
    body: JSON.stringify({
      plantName: plantName.trim(),
      limit: options?.limit ?? 12,
    }),
    signal: options?.signal,
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(
      data.error || `Failed to fetch external images (${response.status})`
    )
  }

  const data = await response.json()
  return {
    images: data.images || [],
    gbifCount: data.gbifCount || 0,
    smithsonianCount: data.smithsonianCount || 0,
    errors: data.errors,
  }
}
