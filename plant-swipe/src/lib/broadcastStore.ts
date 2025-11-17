import type { BroadcastMessage } from '@/lib/broadcasts'
import {
  loadPersistedBroadcast,
  loadSeededBroadcast,
  msRemaining,
  normalizeBroadcast,
  persistBroadcast,
  seedBroadcastInWindow,
} from '@/lib/broadcasts'

const REVALIDATE_INTERVAL_MS = 60_000
const POLL_FALLBACK_INTERVAL_MS = 30_000
const SSE_RECONNECT_DELAY_MS = 15_000

export type BroadcastSnapshot = {
  broadcast: BroadcastMessage | null
  ready: boolean
}

type Listener = () => void

class BroadcastStore {
  private snapshot: BroadcastSnapshot
  private listeners = new Set<Listener>()
  private started = false
  private refreshPromise: Promise<boolean> | null = null
  private pollId: number | null = null
  private reconnectId: number | null = null
  private expiryTimeout: number | null = null
  private es: EventSource | null = null

  constructor() {
    const initial = this.loadInitialBroadcast()
    this.snapshot = { broadcast: initial, ready: Boolean(initial) }
    this.scheduleExpiry(initial?.expiresAt ?? null)
  }

  start() {
    if (this.started || typeof window === 'undefined') return
    this.started = true
    void this.refresh()
    window.setInterval(() => { void this.refresh() }, REVALIDATE_INTERVAL_MS)
    document.addEventListener('visibilitychange', this.handleVisibility)
    window.addEventListener('online', this.handleOnline)
    window.addEventListener('plantswipe:broadcastSeed', this.handleSeed as EventListener)
    this.connectSse()
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = (): BroadcastSnapshot => {
    return this.snapshot
  }

  async refresh(): Promise<boolean> {
    if (typeof window === 'undefined') return false
    if (this.refreshPromise) return this.refreshPromise
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
    this.refreshPromise = fetch('/api/broadcast/active', {
      headers: { Accept: 'application/json' },
      credentials: 'include',
      cache: 'no-store',
      signal: controller?.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const body = await res.json().catch(() => ({}))
        this.applyServerPayload(body?.broadcast ?? null)
        return Boolean(body?.broadcast)
      })
      .catch(() => {
        this.ensureReady()
        return false
      })
      .finally(() => {
        this.refreshPromise = null
      })
    const result = await this.refreshPromise
    return result
  }

  applyServerPayload(raw: any, options: { emitSeed?: boolean } = {}) {
    const next = raw ? normalizeBroadcast(raw) : null
    this.setBroadcast(next, {
      persist: true,
      emitSeed: options.emitSeed === true,
    })
  }

  clear(options: { emitSeed?: boolean } = {}) {
    this.setBroadcast(null, { persist: true, emitSeed: options.emitSeed === true })
  }

  private emit() {
    for (const listener of Array.from(this.listeners)) {
      try {
        listener()
      } catch {}
    }
  }

  private setBroadcast(
    next: BroadcastMessage | null,
    { persist = true, emitSeed = false }: { persist?: boolean; emitSeed?: boolean } = {},
  ) {
    const prevSnapshot = this.snapshot
    const changed =
      next?.id !== prevSnapshot.broadcast?.id ||
      next?.message !== prevSnapshot.broadcast?.message ||
      next?.expiresAt !== prevSnapshot.broadcast?.expiresAt
    this.snapshot = { broadcast: next, ready: true }
    if (persist) persistBroadcast(next)
    if (emitSeed) seedBroadcastInWindow(next)
    this.scheduleExpiry(next?.expiresAt ?? null)
    if (changed || (!prevSnapshot.ready && this.snapshot.ready)) {
      this.emit()
    }
  }

  private ensureReady() {
    if (!this.snapshot.ready) {
      this.snapshot = { ...this.snapshot, ready: true }
      this.emit()
    }
  }

  private scheduleExpiry(expiresAt: string | null) {
    if (this.expiryTimeout !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.expiryTimeout)
      this.expiryTimeout = null
    }
    if (!expiresAt || typeof window === 'undefined') return
    const remaining = msRemaining(expiresAt, Date.now())
    if (remaining === null) return
    this.expiryTimeout = window.setTimeout(() => {
      this.clear({ emitSeed: true })
    }, Math.max(0, remaining))
  }

  private loadInitialBroadcast(): BroadcastMessage | null {
    if (typeof window === 'undefined') return null
    const seeded = loadSeededBroadcast()
    if (seeded) {
      persistBroadcast(seeded)
      return seeded
    }
    return loadPersistedBroadcast()
  }

  private connectSse() {
    if (typeof window === 'undefined') return
    this.cleanupSse()
    this.stopPolling()
    try {
      this.es = new EventSource('/api/broadcast/stream', { withCredentials: true })
      this.es.addEventListener('broadcast', this.handleBroadcastEvent as EventListener)
      this.es.addEventListener('clear', this.handleClearEvent as EventListener)
      this.es.onerror = () => {
        this.cleanupSse()
        this.startPolling()
        this.scheduleReconnect()
      }
    } catch {
      this.startPolling()
      this.scheduleReconnect()
    }
  }

  private cleanupSse() {
    if (!this.es) return
    try {
      this.es.removeEventListener('broadcast', this.handleBroadcastEvent as EventListener)
    } catch {}
    try {
      this.es.removeEventListener('clear', this.handleClearEvent as EventListener)
    } catch {}
    try {
      this.es.close()
    } catch {}
    this.es = null
  }

  private startPolling() {
    if (this.pollId !== null || typeof window === 'undefined') return
    const tick = () => { void this.refresh() }
    this.pollId = window.setInterval(tick, POLL_FALLBACK_INTERVAL_MS)
    tick()
  }

  private stopPolling() {
    if (this.pollId === null || typeof window === 'undefined') return
    window.clearInterval(this.pollId)
    this.pollId = null
  }

  private scheduleReconnect() {
    if (this.reconnectId !== null || typeof window === 'undefined') return
    this.reconnectId = window.setTimeout(() => {
      this.reconnectId = null
      this.connectSse()
    }, SSE_RECONNECT_DELAY_MS)
  }

  private handleBroadcastEvent = (ev: MessageEvent) => {
    try {
      const data = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data
      this.applyServerPayload(data)
    } catch {}
  }

  private handleClearEvent = () => {
    this.clear()
  }

  private handleVisibility = () => {
    if (typeof document === 'undefined') return
    if (document.visibilityState === 'visible') {
      void this.refresh()
    }
  }

  private handleOnline = () => {
    void this.refresh()
  }

  private handleSeed = (event: Event) => {
    const detail = (event as CustomEvent)?.detail
    if (!detail) {
      this.clear()
      return
    }
    this.applyServerPayload(detail)
  }
}

export const broadcastStore = new BroadcastStore()

export function applyBroadcastPayload(payload: any, options?: { emitSeed?: boolean }) {
  broadcastStore.applyServerPayload(payload, options)
}

export function clearBroadcast(options?: { emitSeed?: boolean }) {
  broadcastStore.clear(options)
}

