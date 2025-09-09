import { createClient } from '@supabase/supabase-js'
import { getEnvAny } from '@/lib/utils'

// Allow the same values to drive both frontend and dev API
const supabaseUrl = getEnvAny(['VITE_SUPABASE_URL', 'SUPABASE_URL'])
const supabaseAnonKey = getEnvAny(['VITE_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY'])

// Global fetch with timeout to prevent hanging requests (e.g., slow networks)
const DEFAULT_TIMEOUT_MS = 12000
const timeoutFetch: typeof fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const controller = new AbortController()
  const upstreamSignal = init?.signal
  // Propagate upstream abort to our controller
  if (upstreamSignal) {
    if (upstreamSignal.aborted) controller.abort((upstreamSignal as any).reason)
    else upstreamSignal.addEventListener('abort', () => controller.abort((upstreamSignal as any).reason), { once: true })
  }
  const timer = setTimeout(() => controller.abort(new Error('Request timed out')), DEFAULT_TIMEOUT_MS)
  try {
    const resp = await fetch(input, { ...(init || {}), signal: controller.signal })
    return resp
  } finally {
    clearTimeout(timer)
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Disable URL session detection to avoid any unnecessary waiting on success paths
    detectSessionInUrl: false,
    storageKey: 'plantswipe.auth',
  },
  global: {
    fetch: timeoutFetch,
  },
})

export type ProfileRow = {
  id: string
  display_name: string | null
  avatar_url: string | null
  liked_plant_ids: string[] | null
}


