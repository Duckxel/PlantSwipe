import { supabase } from "@/lib/supabaseClient"

// Retry configuration for handling timeouts and rate limits
const MAX_RETRIES = 3
const INITIAL_RETRY_DELAY = 2000 // 2 seconds

// Helper to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Helper to check if error is retryable (504, 502, 503, 429)
const isRetryableStatus = (status: number) => [502, 503, 504, 429].includes(status)

// Fetch with retry logic and exponential backoff
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = MAX_RETRIES
): Promise<Response> {
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options)
      
      // If it's a retryable error and we have retries left, retry
      if (isRetryableStatus(response.status) && attempt < maxRetries) {
        const retryDelay = INITIAL_RETRY_DELAY * Math.pow(2, attempt)
        console.log(`[AI Fill] Request failed with ${response.status}, retrying in ${retryDelay}ms (attempt ${attempt + 1}/${maxRetries})`)
        await delay(retryDelay)
        continue
      }
      
      return response
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      
      // Network errors - retry if we have attempts left
      if (attempt < maxRetries) {
        const retryDelay = INITIAL_RETRY_DELAY * Math.pow(2, attempt)
        console.log(`[AI Fill] Network error, retrying in ${retryDelay}ms (attempt ${attempt + 1}/${maxRetries}):`, lastError.message)
        await delay(retryDelay)
        continue
      }
    }
  }
  
  throw lastError || new Error('Request failed after retries')
}

async function buildAuthHeaders() {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }

  try {
    const session = (await supabase.auth.getSession()).data.session
    const token = session?.access_token
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
  } catch (err) {
    console.error('Failed to get Supabase session for AI fill:', err)
  }

  try {
    const token = (globalThis as typeof globalThis & {
      __ENV__?: { VITE_ADMIN_STATIC_TOKEN?: unknown }
    }).__ENV__?.VITE_ADMIN_STATIC_TOKEN
    if (token) {
      headers['X-Admin-Token'] = String(token)
    }
  } catch {}

  return headers
}

interface PlantFillRequest {
  plantName: string
  schema: unknown
  existingData?: Record<string, unknown>
  fields?: string[]
  onProgress?: (info: { field: string; completed: number; total: number }) => void
  onFieldComplete?: (info: { field: string; data: unknown }) => void
  onFieldError?: (info: { field: string; error: string }) => void
  signal?: AbortSignal
  language?: string
  continueOnFieldError?: boolean
}

export async function fetchAiPlantFill({
  plantName,
  schema,
  existingData,
  fields,
  onProgress,
  onFieldComplete,
  onFieldError,
  signal,
  language,
  continueOnFieldError = false,
}: PlantFillRequest) {
  const headers = await buildAuthHeaders()

  const schemaObject = schema && typeof schema === 'object' && !Array.isArray(schema)
    ? schema
    : null

  const aggregated: Record<string, unknown> =
    existingData && typeof existingData === 'object' && !Array.isArray(existingData)
      ? { ...existingData }
      : {}

  if (!schemaObject) {
    onProgress?.({ field: 'init', completed: 0, total: 1 })
    const response = await fetchWithRetry('/api/admin/ai/plant-fill', {
      method: 'POST',
      headers,
      body: JSON.stringify({ plantName, schema, existingData, language }),
      signal,
    })

    let payload: any = null
    try { payload = await response.json() } catch {}

    if (!response.ok) {
      const message = payload?.error || `AI fill failed with status ${response.status}`
      throw new Error(message)
    }

    if (!payload?.success || !payload?.data) {
      const message = payload?.error || 'Failed to fill plant data'
      throw new Error(message)
    }

    onProgress?.({ field: 'complete', completed: 1, total: 1 })
    onFieldComplete?.({ field: 'complete', data: payload.data })
    return payload.data
  }

  const disallowedFields = new Set(['name', 'image', 'imageurl', 'image_url', 'imageURL', 'images', 'meta'])
  const allowedSet = Array.isArray(fields) && fields.length ? new Set(fields) : null
  const schemaKeys = Object.keys(schemaObject)
  const filteredKeys = allowedSet
    ? fields!.filter((key) => Object.prototype.hasOwnProperty.call(schemaObject, key))
    : schemaKeys
  const fieldEntries = filteredKeys.filter(
    (key) => !disallowedFields.has(key) && !disallowedFields.has(key.toLowerCase())
  )
  const totalFields = fieldEntries.length
  let completedFields = 0
  onProgress?.({ field: 'init', completed: completedFields, total: totalFields })

  // Process fields one by one (sequential)
  for (const fieldKey of fieldEntries) {
    if (signal?.aborted) {
      throw new Error('AI fill was cancelled')
    }

    onProgress?.({ field: fieldKey, completed: completedFields, total: totalFields })

    let fieldError: Error | null = null
    try {
      const response = await fetchWithRetry('/api/admin/ai/plant-fill/field', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          plantName,
          schema,
          fieldKey,
          existingField:
            existingData && typeof existingData === 'object' && !Array.isArray(existingData)
              ? existingData[fieldKey]
              : undefined,
          language,
        }),
        signal,
      })

      let payload: any = null
      try {
        payload = await response.json()
      } catch {}

      if (!response.ok) {
        const message = payload?.error || `AI fill failed for "${fieldKey}" with status ${response.status}`
        throw new Error(message)
      }

      if (!payload?.success) {
        const message = payload?.error || `AI fill failed for "${fieldKey}"`
        throw new Error(message)
      }

      if (payload?.data !== undefined && payload?.data !== null) {
        aggregated[fieldKey] = payload.data
      } else {
        delete aggregated[fieldKey]
      }

      onFieldComplete?.({ field: fieldKey, data: payload?.data ?? null })
    } catch (err) {
      fieldError = err instanceof Error ? err : new Error(String(err || 'AI fill failed'))
    }

    if (fieldError) {
      if (!continueOnFieldError) {
        throw fieldError
      }
      onFieldError?.({ field: fieldKey, error: fieldError.message })
    }

    completedFields += 1
    onProgress?.({ field: fieldKey, completed: completedFields, total: totalFields })
  }

  onProgress?.({ field: 'complete', completed: completedFields, total: totalFields })

  onProgress?.({ field: 'complete', completed: completedFields, total: totalFields })

  return aggregated
}

interface PlantFillFieldRequest {
  plantName: string
  schema: unknown
  fieldKey: string
  existingField?: unknown
  onFieldComplete?: (info: { field: string; data: unknown }) => void
  signal?: AbortSignal
  language?: string
}

export async function fetchAiPlantFillField({
  plantName,
  schema,
  fieldKey,
  existingField,
  onFieldComplete,
  signal,
  language,
}: PlantFillFieldRequest) {
  const headers = await buildAuthHeaders()

  const response = await fetchWithRetry('/api/admin/ai/plant-fill/field', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      plantName,
      schema,
      fieldKey,
      existingField,
      language,
    }),
    signal,
  })

  let payload: any = null
  try {
    payload = await response.json()
  } catch {}

  if (!response.ok) {
    const message = payload?.error || `AI fill failed for "${fieldKey}" with status ${response.status}`
    throw new Error(message)
  }

  if (!payload?.success) {
    const message = payload?.error || `AI fill failed for "${fieldKey}"`
    throw new Error(message)
  }

  onFieldComplete?.({ field: fieldKey, data: payload?.data ?? null })

  return payload?.data ?? null
}

interface VerifyPlantNameResult {
  isPlant: boolean
  reason: string
}

export async function verifyPlantNameIsPlant(
  plantName: string,
  signal?: AbortSignal,
): Promise<VerifyPlantNameResult> {
  const headers = await buildAuthHeaders()
  const response = await fetchWithRetry('/api/admin/ai/plant-fill/verify-name', {
    method: 'POST',
    headers,
    body: JSON.stringify({ plantName }),
    signal,
  })
  let payload: any = null
  try {
    payload = await response.json()
  } catch {}

  if (!response.ok) {
    const message = payload?.error || 'Failed to verify plant name'
    throw new Error(message)
  }

  return {
    isPlant: Boolean(payload?.isPlant),
    reason: typeof payload?.reason === 'string' ? payload.reason : '',
  }
}

interface EnglishPlantNameResult {
  originalName: string
  englishName: string
  wasTranslated: boolean
}

/**
 * Get the English common name for a plant.
 * The input can be in any language (scientific name, French, Spanish, etc.)
 * and the AI will return the common English name.
 */
export async function getEnglishPlantName(
  plantName: string,
  signal?: AbortSignal,
): Promise<EnglishPlantNameResult> {
  const headers = await buildAuthHeaders()
  const response = await fetchWithRetry('/api/admin/ai/plant-fill/english-name', {
    method: 'POST',
    headers,
    body: JSON.stringify({ plantName }),
    signal,
  })
  let payload: any = null
  try {
    payload = await response.json()
  } catch {}

  if (!response.ok) {
    const message = payload?.error || 'Failed to get English plant name'
    throw new Error(message)
  }

  return {
    originalName: typeof payload?.originalName === 'string' ? payload.originalName : plantName,
    englishName: typeof payload?.englishName === 'string' ? payload.englishName : plantName,
    wasTranslated: Boolean(payload?.wasTranslated),
  }
}
