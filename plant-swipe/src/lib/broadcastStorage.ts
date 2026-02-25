const STORAGE_KEY = 'plantswipe.broadcast.active'

const VALID_SEVERITIES = new Set(['info', 'warning', 'danger'])

export type BroadcastRecord = {
  id: string
  message: string
  severity?: 'info' | 'warning' | 'danger'
  createdAt: string | null
  expiresAt: string | null
  adminName?: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitizeBroadcast(raw: any): BroadcastRecord {
  return {
    id: String(raw?.id || ''),
    message: String(raw?.message || ''),
    severity: VALID_SEVERITIES.has(raw?.severity) ? raw.severity : 'info',
    createdAt: raw?.createdAt || null,
    expiresAt: raw?.expiresAt || null,
    adminName: raw?.adminName ?? null,
  }
}

function isExpired(expiresAt: string | null, nowMs: number): boolean {
  if (!expiresAt) return false
  const end = Date.parse(expiresAt)
  if (!Number.isFinite(end)) return false
  return end <= nowMs
}

export function loadPersistedBroadcast(nowMs: number = Date.now()): BroadcastRecord | null {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const broadcast = sanitizeBroadcast(parsed)
    // Only return if not expired based on server time
    if (broadcast.expiresAt && isExpired(broadcast.expiresAt, nowMs)) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    if (!broadcast.id || !broadcast.message) return null
    return broadcast
  } catch {
    return null
  }
}

export function savePersistedBroadcast(value: BroadcastRecord | null): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return
  try {
    if (!value) {
      localStorage.removeItem(STORAGE_KEY)
      return
    }
    const severity: 'info' | 'warning' | 'danger' =
      value.severity && VALID_SEVERITIES.has(value.severity) ? value.severity : 'info'
    const payload: BroadcastRecord = {
      id: String(value.id || ''),
      message: String(value.message || ''),
      severity,
      createdAt: value.createdAt || null,
      expiresAt: value.expiresAt || null,
      adminName: value.adminName ?? null,
    }
    if (!payload.id || !payload.message) {
      localStorage.removeItem(STORAGE_KEY)
      return
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {}
}
