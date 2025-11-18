import { SUPABASE_URL } from '@/lib/supabaseClient'

type RealtimeStatus = 'unknown' | 'checking' | 'ready' | 'disabled'

const hasWindow = typeof window !== 'undefined'
const disableFlag =
  readFlag('VITE_DISABLE_SUPABASE_REALTIME') ||
  readFlag('REACT_APP_DISABLE_SUPABASE_REALTIME') ||
  readFlag('NEXT_PUBLIC_DISABLE_SUPABASE_REALTIME') ||
  readFlag('DISABLE_SUPABASE_REALTIME')

const supabaseOrigin = (() => {
  try {
    return new URL(SUPABASE_URL).origin
  } catch {
    return null
  }
})()

let status: RealtimeStatus = hasWindow ? 'unknown' : 'ready'
let disabledReason: string | null = null
let pendingProbe: Promise<boolean> | null = null
let retryAfter = 0
let lastLoggedReason: string | null = null

if (!supabaseOrigin) {
  status = 'disabled'
  disabledReason = 'invalid-url'
  retryAfter = Number.POSITIVE_INFINITY
}

if (disableFlag) {
  status = 'disabled'
  disabledReason = 'env-flag'
  retryAfter = Number.POSITIVE_INFINITY
  logDisableOnce(disabledReason)
}

function readFlag(name: string): boolean {
  const metaValue = (import.meta as any)?.env?.[name]
  const runtimeValue = (hasWindow && (window as any)?.__ENV__?.[name]) ?? (globalThis as any)?.__ENV__?.[name]
  const value = metaValue ?? runtimeValue
  if (value === undefined || value === null) return false
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (!normalized) return false
    return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on'
  }
  return Boolean(value)
}

function logDisableOnce(reason: string) {
  if (typeof console === 'undefined') return
  if (lastLoggedReason === reason) return
  lastLoggedReason = reason
  console.warn(`[supabase-realtime] disabled realtime (${reason})`)
}

async function probeConnectivity(): Promise<boolean> {
  if (!hasWindow) return true
  if (!supabaseOrigin) return false

  const target = `${supabaseOrigin}/auth/v1/health`
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer =
    controller && typeof setTimeout === 'function'
      ? setTimeout(() => {
          try {
            controller.abort()
          } catch {}
        }, 4000)
      : null
  try {
    await fetch(target, {
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller?.signal,
    })
    return true
  } catch (error) {
    if ((import.meta as any)?.env?.DEV) {
      console.debug('[supabase-realtime] connectivity probe failed', error)
    }
    return false
  } finally {
    if (timer) {
      clearTimeout(timer)
    }
  }
}

function setDisabled(reason: string, options?: { retryMs?: number }) {
  status = 'disabled'
  disabledReason = reason
  const retryMs = options?.retryMs ?? 60000
  retryAfter = retryMs === Number.POSITIVE_INFINITY ? Number.POSITIVE_INFINITY : Date.now() + Math.max(0, retryMs)
  logDisableOnce(reason)
}

export function disableRealtime(reason: string, options?: { retryMs?: number }) {
  setDisabled(reason, options)
}

export function isRealtimeReady(): boolean {
  return status === 'ready'
}

export function getRealtimeStatus(): { status: RealtimeStatus; reason: string | null; retryAfter: number } {
  return { status, reason: disabledReason, retryAfter }
}

export async function ensureRealtimeReady(): Promise<boolean> {
  if (!hasWindow) return true

  if (status === 'disabled') {
    if (retryAfter === Number.POSITIVE_INFINITY || Date.now() < retryAfter) {
      return false
    }
    status = 'unknown'
  }

  if (status === 'ready') {
    return true
  }

  if (!supabaseOrigin) {
    setDisabled('invalid-url', { retryMs: Number.POSITIVE_INFINITY })
    return false
  }

  if (!pendingProbe) {
    status = 'checking'
    pendingProbe = probeConnectivity()
      .then((ok) => {
        if (ok) {
          status = 'ready'
          disabledReason = null
          retryAfter = 0
          lastLoggedReason = null
        } else {
          setDisabled('connectivity-failed')
        }
        return ok
      })
      .finally(() => {
        pendingProbe = null
      })
  }

  return pendingProbe
}
