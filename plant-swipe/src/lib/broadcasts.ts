const STORAGE_KEY = 'plantswipe.broadcast.active'

export type BroadcastMessage = {
  id: string
  message: string
  severity: 'info' | 'warning' | 'danger'
  createdAt: string | null
  expiresAt: string | null
  adminName?: string | null
}

function normalizeIso(value: unknown): string | null {
  if (!value) return null
  try {
    if (value instanceof Date) {
      return value.toISOString()
    }
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (!trimmed) return null
      const timestamp = Date.parse(trimmed)
      if (!Number.isFinite(timestamp)) return null
      return new Date(timestamp).toISOString()
    }
  } catch {}
  return null
}

export function normalizeBroadcast(raw: any): BroadcastMessage | null {
  if (!raw || typeof raw !== 'object') return null
  const id = String(raw.id ?? '')
  const message = String(raw.message ?? '')
  if (!message.trim()) return null
  const severity =
    raw.severity === 'warning' || raw.severity === 'danger' ? raw.severity : 'info'
  const createdAt = normalizeIso((raw.createdAt ?? raw.created_at) ?? null)
  const expiresAt = normalizeIso((raw.expiresAt ?? raw.expires_at) ?? null)
  const adminNameRaw = raw.adminName ?? raw.admin_name ?? null
  return {
    id,
    message,
    severity,
    createdAt,
    expiresAt,
    adminName: adminNameRaw == null ? null : String(adminNameRaw),
  }
}

export function msRemaining(expiresAt: string | null, nowMs: number = Date.now()): number | null {
  if (!expiresAt) return null
  const end = Date.parse(expiresAt)
  if (!Number.isFinite(end)) return null
  return Math.max(0, end - nowMs)
}

export function persistBroadcast(broadcast: BroadcastMessage | null): void {
  try {
    if (!broadcast) {
      localStorage.removeItem(STORAGE_KEY)
      return
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(broadcast))
  } catch {}
}

export function loadPersistedBroadcast(nowMs: number = Date.now()): BroadcastMessage | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    const next = normalizeBroadcast(data)
    if (!next) return null
    const remaining = msRemaining(next.expiresAt, nowMs)
    if (remaining !== null && remaining <= 0) return null
    return next
  } catch {
    return null
  }
}

export function loadSeededBroadcast(nowMs: number = Date.now()): BroadcastMessage | null {
  try {
    const seedSource: any =
      typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
          ? globalThis
          : null
    if (!seedSource) return null
    const seed = seedSource.__LAST_BROADCAST_SEED__ ?? seedSource.__BROADCAST__
    const next = normalizeBroadcast(seed)
    if (!next) return null
    const remaining = msRemaining(next.expiresAt, nowMs)
    if (remaining !== null && remaining <= 0) return null
    return next
  } catch {
    return null
  }
}

export function seedBroadcastInWindow(broadcast: BroadcastMessage | null): void {
  try {
    if (typeof window !== 'undefined') {
      ;(window as any).__LAST_BROADCAST_SEED__ = broadcast ?? null
    }
  } catch {}
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(
        new CustomEvent('plantswipe:broadcastSeed', { detail: broadcast ?? null }),
      )
    }
  } catch {}
}

