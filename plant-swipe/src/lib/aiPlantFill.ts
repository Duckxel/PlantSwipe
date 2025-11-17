import { supabase } from "@/lib/supabaseClient"

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
  onProgress?: (info: { field: string; completed: number; total: number }) => void
  onFieldComplete?: (info: { field: string; data: unknown }) => void
  signal?: AbortSignal
}

export async function fetchAiPlantFill({
  plantName,
  schema,
  existingData,
  onProgress,
  onFieldComplete,
  signal,
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
    const response = await fetch('/api/admin/ai/plant-fill', {
      method: 'POST',
      headers,
      body: JSON.stringify({ plantName, schema, existingData }),
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

  const disallowedFields = new Set(['name', 'image', 'imageurl', 'image_url', 'imageURL'])
  const fieldEntries = Object.keys(schemaObject).filter(
    (key) => !disallowedFields.has(key) && !disallowedFields.has(key.toLowerCase())
  )
  const totalFields = fieldEntries.length
  let completedFields = 0
  onProgress?.({ field: 'init', completed: completedFields, total: totalFields })

  for (const fieldKey of fieldEntries) {
    if (signal?.aborted) {
      throw new Error('AI fill was cancelled')
    }

    onProgress?.({ field: fieldKey, completed: completedFields, total: totalFields })

    const response = await fetch('/api/admin/ai/plant-fill/field', {
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
      }),
      signal,
    })

    let payload: any = null
    try { payload = await response.json() } catch {}

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

    completedFields += 1
    onProgress?.({ field: fieldKey, completed: completedFields, total: totalFields })
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
}

export async function fetchAiPlantFillField({
  plantName,
  schema,
  fieldKey,
  existingField,
  onFieldComplete,
  signal,
}: PlantFillFieldRequest) {
  const headers = await buildAuthHeaders()

  const response = await fetch('/api/admin/ai/plant-fill/field', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      plantName,
      schema,
      fieldKey,
      existingField,
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

export interface PlantKnowledgeCheckResult {
  known: boolean
  confidence: number
  summary: string
}

export async function detectAiPlantKnowledge(plantName: string, signal?: AbortSignal): Promise<PlantKnowledgeCheckResult> {
  const trimmedName = plantName.trim()
  if (!trimmedName) {
    throw new Error('Plant name is required')
  }
  const headers = await buildAuthHeaders()
  const response = await fetch('/api/admin/ai/plant-fill/detect', {
    method: 'POST',
    headers,
    body: JSON.stringify({ plantName: trimmedName }),
    signal,
  })

  let payload: any = null
  try {
    payload = await response.json()
  } catch {}

  if (!response.ok) {
    const message = payload?.error || `AI detection failed with status ${response.status}`
    throw new Error(message)
  }

  if (!payload?.success) {
    const message = payload?.error || 'Failed to verify plant name'
    throw new Error(message)
  }

  const known = Boolean(payload.known)
  const confidence = typeof payload.confidence === 'number' ? payload.confidence : Number(payload.confidence) || 0
  const summary = typeof payload.summary === 'string' ? payload.summary.trim() : ''

  return { known, confidence, summary }
}
