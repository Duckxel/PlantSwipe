import { supabase } from "@/lib/supabaseClient"

interface PlantFillRequest {
  plantName: string
  schema: unknown
  existingData?: Record<string, unknown>
}

export async function fetchAiPlantFill({ plantName, schema, existingData }: PlantFillRequest) {
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
    const adminToken = (globalThis as any)?.__ENV__?.VITE_ADMIN_STATIC_TOKEN
    if (adminToken) {
      headers['X-Admin-Token'] = String(adminToken)
    }
  } catch {}

  let response: Response
  try {
    response = await fetch('/api/admin/ai/plant-fill', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        plantName,
        schema,
        existingData,
      }),
    })
  } catch (err: any) {
    throw new Error(err?.message || 'Failed to reach AI fill service')
  }

  let payload: any = null
  try {
    payload = await response.json()
  } catch {}

  if (!response.ok) {
    const message = payload?.error || `AI fill failed with status ${response.status}`
    throw new Error(message)
  }

  if (!payload?.success || !payload?.data) {
    const message = payload?.error || 'Failed to fill plant data'
    throw new Error(message)
  }

  return payload.data
}
