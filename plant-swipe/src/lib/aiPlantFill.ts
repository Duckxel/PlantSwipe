import { supabase } from "@/lib/supabaseClient"

interface PlantFillRequest {
  plantName: string
  schema: unknown
  existingData?: Record<string, unknown>
}

const JOB_POLL_INTERVAL_MS = Number((globalThis as any)?.__ENV__?.VITE_AI_FILL_POLL_INTERVAL_MS || 4000)
const JOB_MAX_WAIT_MS = Number((globalThis as any)?.__ENV__?.VITE_AI_FILL_MAX_WAIT_MS || 1000 * 60 * 5)

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function pollPlantFillJob(jobId: string, baseHeaders: Record<string, string>) {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  }
  if (baseHeaders['Authorization']) headers['Authorization'] = baseHeaders['Authorization']
  if (baseHeaders['X-Admin-Token']) headers['X-Admin-Token'] = baseHeaders['X-Admin-Token']

  const startedAt = Date.now()
  while (true) {
    let response: Response
    try {
      response = await fetch(`/api/admin/ai/plant-fill/${jobId}`, {
        method: 'GET',
        headers,
      })
    } catch (err: any) {
      throw new Error(err?.message || 'Failed to check AI fill job status')
    }

    let payload: any = null
    try {
      payload = await response.json()
    } catch {}

    if (!response.ok) {
      const message = payload?.error || `AI fill status failed with ${response.status}`
      throw new Error(message)
    }

    const status = String(payload?.status || '').toLowerCase()
    if (status === 'completed' && payload?.data) {
      return payload.data
    }

    if (status === 'failed') {
      const message = payload?.error?.message || payload?.error || 'AI fill job failed'
      throw new Error(message)
    }

    if (Date.now() - startedAt > JOB_MAX_WAIT_MS) {
      throw new Error('AI fill is taking longer than expected. Please try again later.')
    }

    await sleep(JOB_POLL_INTERVAL_MS)
  }
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

  if (!response.ok && response.status !== 202) {
    const message = payload?.error || `AI fill failed with status ${response.status}`
    throw new Error(message)
  }

  if (payload?.success && payload?.data) {
    return payload.data
  }

  if (payload?.jobId) {
    return await pollPlantFillJob(String(payload.jobId), headers)
  }

  const message = payload?.error || 'Failed to start AI fill job'
  throw new Error(message)
}
