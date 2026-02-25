import { supabase } from "@/lib/supabaseClient"

// Retry configuration for handling timeouts and rate limits
const MAX_RETRIES = 2 // Reduced from 3 since server already has 10min timeout
const INITIAL_RETRY_DELAY = 2000 // 2 seconds
const INITIAL_RETRY_DELAY_GATEWAY_TIMEOUT = 3000 // 3 seconds for gateway timeouts

// Parallel processing configuration
// Number of fields to process simultaneously (balance between speed and API rate limits)
const PARALLEL_BATCH_SIZE = 4

// Helper to delay execution (abortable)
const delay = (ms: number, signal?: AbortSignal | null) => new Promise<void>((resolve, reject) => {
  if (signal?.aborted) {
    reject(new DOMException('Aborted', 'AbortError'))
    return
  }
  const timeout = setTimeout(resolve, ms)
  signal?.addEventListener('abort', () => {
    clearTimeout(timeout)
    reject(new DOMException('Aborted', 'AbortError'))
  }, { once: true })
})

// Helper to check if error is retryable (504, 502, 503, 429)
const isRetryableStatus = (status: number) => [502, 503, 504, 429].includes(status)

// Helper to check if status is a gateway timeout (needs extra patience)
const isGatewayTimeout = (status: number) => status === 504

// Helper to check if error is an abort error
const isAbortError = (err: unknown): boolean => {
  if (err instanceof DOMException && err.name === 'AbortError') return true
  if (err instanceof Error && err.name === 'AbortError') return true
  if (err instanceof Error && err.message.includes('aborted')) return true
  return false
}

// Fetch with retry logic and exponential backoff
// For 504 gateway timeouts, uses more retries and longer delays to give server time to complete
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  baseMaxRetries = MAX_RETRIES
): Promise<Response> {
  let lastError: Error | null = null
  let lastStatus: number | null = null
  const signal = options.signal
  
  // Start with base retries, but allow escalation for gateway timeouts
  const maxRetries = baseMaxRetries
  let initialDelay = INITIAL_RETRY_DELAY
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Check if aborted before each attempt
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }
    
    try {
      const response = await fetch(url, options)
      
      // If it's a retryable error and we have retries left, retry
      if (isRetryableStatus(response.status) && attempt < maxRetries) {
        // For 504 gateway timeouts, use slightly longer delays
        if (isGatewayTimeout(response.status) && initialDelay < INITIAL_RETRY_DELAY_GATEWAY_TIMEOUT) {
          initialDelay = INITIAL_RETRY_DELAY_GATEWAY_TIMEOUT
          console.log(`[AI Fill] Gateway timeout (504) detected, using ${initialDelay}ms delay between retries`)
        }
        
        lastStatus = response.status
        const retryDelay = initialDelay * Math.pow(2, attempt)
        const statusDesc = isGatewayTimeout(response.status) ? 'Gateway timeout' : `Status ${response.status}`
        console.log(`[AI Fill] ${statusDesc}, retrying in ${retryDelay}ms (attempt ${attempt + 1}/${maxRetries})`)
        await delay(retryDelay, signal)
        continue
      }
      
      return response
    } catch (err) {
      // Don't retry abort errors
      if (isAbortError(err)) {
        throw err
      }
      
      lastError = err instanceof Error ? err : new Error(String(err))
      
      // Network errors - retry if we have attempts left
      if (attempt < maxRetries) {
        const retryDelay = initialDelay * Math.pow(2, attempt)
        console.log(`[AI Fill] Network error, retrying in ${retryDelay}ms (attempt ${attempt + 1}/${maxRetries}):`, lastError.message)
        try {
          await delay(retryDelay, signal)
        } catch (delayErr) {
          if (isAbortError(delayErr)) throw delayErr
        }
        continue
      }
    }
  }
  
  // Provide more informative error message
  if (lastStatus === 504) {
    throw new Error(`Gateway timeout after ${maxRetries + 1} attempts. The AI backend is taking too long to respond.`)
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

  // Process fields in parallel batches for faster completion
  // Split fields into batches of PARALLEL_BATCH_SIZE
  const batches: string[][] = []
  for (let i = 0; i < fieldEntries.length; i += PARALLEL_BATCH_SIZE) {
    batches.push(fieldEntries.slice(i, i + PARALLEL_BATCH_SIZE))
  }

  // Process each batch using the batch endpoint for better performance
  // This reduces HTTP round-trips by processing multiple fields per request
  for (const batch of batches) {
    if (signal?.aborted) {
      throw new DOMException('AI fill was cancelled', 'AbortError')
    }

    // Notify progress for each field in the batch that we're starting
    for (const fieldKey of batch) {
      onProgress?.({ field: fieldKey, completed: completedFields, total: totalFields })
    }

    // Use batch endpoint when available (>1 field), otherwise use single field endpoint
    if (batch.length > 1) {
      // Try batch endpoint first for better performance
      try {
        const response = await fetchWithRetry('/api/admin/ai/plant-fill/batch', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            plantName,
            schema,
            fieldKeys: batch,
            existingData: existingData && typeof existingData === 'object' && !Array.isArray(existingData)
              ? batch.reduce((acc, key) => {
                  if (existingData[key] !== undefined) {
                    acc[key] = existingData[key]
                  }
                  return acc
                }, {} as Record<string, unknown>)
              : undefined,
            language,
          }),
          signal,
        })

        let payload: any = null
        try {
          payload = await response.json()
        } catch {}

        if (response.ok && payload?.success) {
          // Process successful batch response
          const batchData = payload.data || {}
          const batchErrors = payload.errors || {}

          for (const fieldKey of batch) {
            if (batchErrors[fieldKey]) {
              // Handle field error
              if (!continueOnFieldError) {
                throw new Error(batchErrors[fieldKey])
              }
              onFieldError?.({ field: fieldKey, error: batchErrors[fieldKey] })
            } else {
              const data = batchData[fieldKey] ?? null
              if (data !== undefined && data !== null) {
                aggregated[fieldKey] = data
              } else {
                delete aggregated[fieldKey]
              }
              onFieldComplete?.({ field: fieldKey, data })
            }
            completedFields += 1
            onProgress?.({ field: fieldKey, completed: completedFields, total: totalFields })
          }
          continue // Move to next batch
        }
        // If batch endpoint failed, fall through to individual requests
        console.warn('[AI Fill] Batch endpoint failed, falling back to individual requests')
      } catch (batchErr) {
        // Fall through to individual requests
        console.warn('[AI Fill] Batch endpoint error, falling back to individual requests:', batchErr)
      }
    }

    // Fallback: Process fields individually in parallel
    const batchResults = await Promise.allSettled(
      batch.map(async (fieldKey) => {
        if (signal?.aborted) {
          throw new DOMException('AI fill was cancelled', 'AbortError')
        }

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
          let message: string
          if (response.status === 504) {
            message = `Gateway timeout for "${fieldKey}" - AI backend took too long to respond`
          } else if (response.status === 503) {
            message = `Service unavailable for "${fieldKey}" - AI backend is temporarily down`
          } else if (response.status === 502) {
            message = `Bad gateway for "${fieldKey}" - proxy error communicating with AI backend`
          } else if (response.status === 429) {
            message = `Rate limited for "${fieldKey}" - too many AI requests`
          } else {
            message = payload?.error || `AI fill failed for "${fieldKey}" with status ${response.status}`
          }
          throw new Error(message)
        }

        if (!payload?.success) {
          const message = payload?.error || `AI fill failed for "${fieldKey}" - no success response`
          throw new Error(message)
        }

        return { fieldKey, data: payload?.data ?? null }
      })
    )

    // Process batch results
    for (let i = 0; i < batch.length; i++) {
      const fieldKey = batch[i]
      const result = batchResults[i]

      if (result.status === 'fulfilled') {
        const { data } = result.value
        if (data !== undefined && data !== null) {
          aggregated[fieldKey] = data
        } else {
          delete aggregated[fieldKey]
        }
        onFieldComplete?.({ field: fieldKey, data })
      } else {
        // Handle error
        const fieldError = result.reason instanceof Error 
          ? result.reason 
          : new Error(String(result.reason || 'AI fill failed'))
        
        if (!continueOnFieldError) {
          throw fieldError
        }
        onFieldError?.({ field: fieldKey, error: fieldError.message })
      }

      completedFields += 1
      onProgress?.({ field: fieldKey, completed: completedFields, total: totalFields })
    }
  }

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
