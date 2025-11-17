import React from 'react'
import { Info, AlertTriangle, XCircle } from 'lucide-react'
import { useTheme } from '@/context/ThemeContext'
import { cn } from '@/lib/utils'
import {
  BroadcastMessage,
  loadPersistedBroadcast,
  loadSeededBroadcast,
  msRemaining,
  normalizeBroadcast,
  persistBroadcast,
} from '@/lib/broadcasts'

const REVALIDATE_INTERVAL_MS = 60_000
const POLL_FALLBACK_INTERVAL_MS = 30_000
const SSE_RECONNECT_DELAY_MS = 15_000

function useNowTick(intervalMs: number = 1000) {
  const [now, setNow] = React.useState<number>(() => Date.now())
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
const POSITIONS = [
  { key: 'tr', className: 'top-4 right-4' },
  { key: 'tl', className: 'top-4 left-4' },
  { key: 'br', className: 'bottom-4 right-4' },
  { key: 'bl', className: 'bottom-4 left-4' },
] as const

type PositionKey = typeof POSITIONS[number]['key']

function nextPositionKey(current: PositionKey): PositionKey {
  const idx = POSITIONS.findIndex(p => p.key === current)
  const next = (idx >= 0 ? (idx + 1) % POSITIONS.length : 0)
  return POSITIONS[next].key
}

function getPositionClass(pos: PositionKey): string {
  const p = POSITIONS.find(p => p.key === pos)
  return p ? p.className : POSITIONS[0].className
}

function loadPosition(): PositionKey {
  try {
    const s = localStorage.getItem('plantswipe.broadcast.pos')
    if (s === 'tr' || s === 'tl' || s === 'br' || s === 'bl') return s
  } catch {}
  return 'tr'
}

function savePosition(pos: PositionKey) {
  try { localStorage.setItem('plantswipe.broadcast.pos', pos) } catch {}
}

function isAbortError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'name' in error && (error as { name?: string }).name === 'AbortError')
}

function formatRemainingDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const days = Math.floor(totalSeconds / 86_400)
  if (days > 0) {
    const hours = Math.floor((totalSeconds % 86_400) / 3600)
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`
  }
  const hours = Math.floor(totalSeconds / 3600)
  if (hours > 0) {
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  }
  const minutes = Math.floor(totalSeconds / 60)
  if (minutes > 0) {
    const seconds = totalSeconds % 60
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`
  }
  return `${totalSeconds}s`
}

const BroadcastToast: React.FC = () => {
  const { effectiveTheme } = useTheme()
  const isDarkTheme = effectiveTheme === 'dark'
  const [broadcast, setBroadcast] = React.useState<BroadcastMessage | null>(() => {
    const seeded = loadSeededBroadcast(Date.now())
    if (seeded) return seeded
    return loadPersistedBroadcast(Date.now())
  })
  const [pos, setPos] = React.useState<PositionKey>(loadPosition)
  const now = useNowTick(1000)
  const fetchAbortRef = React.useRef<AbortController | null>(null)

  const refreshBroadcast = React.useCallback(async () => {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
    if (controller) {
      fetchAbortRef.current?.abort?.()
      fetchAbortRef.current = controller
    }
    try {
      const response = await fetch('/api/broadcast/active', {
        headers: { Accept: 'application/json' },
        credentials: 'include',
        cache: 'no-store',
        signal: controller?.signal,
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const body = await response.json().catch(() => ({}))
      const next = body?.broadcast ? normalizeBroadcast(body.broadcast) : null
      if (next) {
        setBroadcast(next)
        persistBroadcast(next)
      } else {
        const persisted = loadPersistedBroadcast(Date.now())
        setBroadcast(persisted)
        if (!persisted) persistBroadcast(null)
      }
      return Boolean(next)
    } catch (err) {
      if (!isAbortError(err)) {
        const persisted = loadPersistedBroadcast(Date.now())
        setBroadcast(persisted)
        if (!persisted) persistBroadcast(null)
      }
      return false
    } finally {
      if (fetchAbortRef.current === controller) {
        fetchAbortRef.current = null
      }
    }
  }, [])

  React.useEffect(() => {
    return () => { fetchAbortRef.current?.abort?.() }
  }, [])

  React.useEffect(() => {
    void refreshBroadcast()
  }, [refreshBroadcast])

  React.useEffect(() => {
    const seeded = loadSeededBroadcast(Date.now())
    if (seeded) {
      setBroadcast(prev => prev ?? seeded)
      persistBroadcast(seeded)
    }
  }, [])

  React.useEffect(() => {
    if (broadcast) return
    let cancelled = false
    let attempts = 0
    const MAX_ATTEMPTS = 25
    const retry = () => {
      if (cancelled) return
      const seeded = loadSeededBroadcast(Date.now())
      if (seeded) {
        setBroadcast(seeded)
        persistBroadcast(seeded)
        return
      }
      const persisted = loadPersistedBroadcast(Date.now())
      if (persisted) {
        setBroadcast(persisted)
        persistBroadcast(persisted)
        return
      }
      attempts += 1
      if (attempts < MAX_ATTEMPTS) {
        window.setTimeout(retry, 200)
      }
    }
    retry()
    return () => { cancelled = true }
  }, [broadcast])

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const handleSeed = (event: Event) => {
      const detail = (event as CustomEvent)?.detail
      if (!detail || typeof detail !== 'object') {
        setBroadcast(null)
        persistBroadcast(null)
        return
      }
      try {
        const next = normalizeBroadcast(detail)
        if (!next) {
          setBroadcast(null)
          persistBroadcast(null)
          return
        }
        const remaining = msRemaining(next.expiresAt, Date.now())
        if (remaining !== null && remaining <= 0) {
          setBroadcast(null)
          persistBroadcast(null)
          return
        }
        setBroadcast(next)
        persistBroadcast(next)
      } catch {}
    }
    window.addEventListener('plantswipe:broadcastSeed', handleSeed as EventListener)
    return () => window.removeEventListener('plantswipe:broadcastSeed', handleSeed as EventListener)
  }, [])

  React.useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refreshBroadcast().catch(() => {})
      }
    }
    const handleOnline = () => { void refreshBroadcast().catch(() => {}) }
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('online', handleOnline)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('online', handleOnline)
    }
  }, [refreshBroadcast])

  React.useEffect(() => {
    const id = window.setInterval(() => { void refreshBroadcast().catch(() => {}) }, REVALIDATE_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [refreshBroadcast])

  React.useEffect(() => {
    let es: EventSource | null = null
    let pollId: number | null = null
    let reconnectId: number | null = null

      const startPolling = () => {
        if (pollId !== null) return
        const tick = () => { void refreshBroadcast().catch(() => {}) }
        pollId = window.setInterval(tick, POLL_FALLBACK_INTERVAL_MS)
        tick()
      }

      const stopPolling = () => {
        if (pollId === null) return
        window.clearInterval(pollId)
        pollId = null
      }

      const handleBroadcast = (ev: MessageEvent) => {
        try {
          const data = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data
          const next = normalizeBroadcast(data)
          if (!next) {
            setBroadcast(null)
            persistBroadcast(null)
            return
          }
          setBroadcast(next)
          persistBroadcast(next)
        } catch {}
      }

      const handleClear = () => {
        setBroadcast(null)
        persistBroadcast(null)
      }

    const cleanupSse = () => {
      if (!es) return
      try { es.removeEventListener('broadcast', handleBroadcast as EventListener) } catch {}
      try { es.removeEventListener('clear', handleClear as EventListener) } catch {}
      try { es.close() } catch {}
      es = null
    }

    const scheduleReconnect = () => {
      if (reconnectId !== null) return
      reconnectId = window.setTimeout(() => {
        reconnectId = null
        connect()
      }, SSE_RECONNECT_DELAY_MS)
    }

    function connect() {
      cleanupSse()
      stopPolling()
      try {
        es = new EventSource('/api/broadcast/stream', { withCredentials: true })
        es.addEventListener('broadcast', handleBroadcast as EventListener)
        es.addEventListener('clear', handleClear as EventListener)
        es.onerror = () => {
          cleanupSse()
          startPolling()
          scheduleReconnect()
        }
      } catch {
        startPolling()
        scheduleReconnect()
      }
    }

    connect()

    return () => {
      cleanupSse()
      stopPolling()
      if (reconnectId !== null) window.clearTimeout(reconnectId)
    }
  }, [refreshBroadcast])

  React.useEffect(() => {
    if (!broadcast?.expiresAt) return
    const remaining = msRemaining(broadcast.expiresAt, now)
    if (remaining !== null && remaining <= 0) {
      setBroadcast(null)
      persistBroadcast(null)
    }
  }, [broadcast?.expiresAt, now])

  const severity = (broadcast?.severity === 'warning' || broadcast?.severity === 'danger') ? broadcast.severity : 'info'
  const severityLabel = severity === 'warning' ? 'Warning' : severity === 'danger' ? 'Danger' : 'Information'
  const severityPalette = React.useMemo(() => {
    if (severity === 'warning') {
      return {
        border: isDarkTheme ? 'border-amber-500/60' : 'border-yellow-400',
        icon: isDarkTheme ? 'text-amber-200' : 'text-yellow-600',
        square: isDarkTheme ? 'bg-amber-400/30 border-amber-200/60' : 'bg-yellow-400 border-yellow-300',
      }
    }
    if (severity === 'danger') {
      return {
        border: isDarkTheme ? 'border-red-500/70' : 'border-red-500',
        icon: isDarkTheme ? 'text-red-200' : 'text-red-600',
        square: isDarkTheme ? 'bg-red-500/30 border-red-300/60' : 'bg-red-500 border-red-400',
      }
    }
    return {
      border: isDarkTheme ? 'border-emerald-400/40' : 'border-white',
      icon: isDarkTheme ? 'text-emerald-200' : 'text-neutral-500',
      square: isDarkTheme ? 'bg-emerald-400/20 border-emerald-300/40' : 'bg-white border-neutral-300',
    }
  }, [severity, isDarkTheme])

  const IconComp = severity === 'warning' ? AlertTriangle : severity === 'danger' ? XCircle : Info
  const expiresInLabel = React.useMemo(() => {
    if (!broadcast?.expiresAt) return null
    const remaining = msRemaining(broadcast.expiresAt, now)
    if (remaining === null || remaining <= 0) return null
    return formatRemainingDuration(remaining)
  }, [broadcast?.expiresAt, now])

  if (!broadcast) return null

  const handleCycle = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    const next = nextPositionKey(pos)
    setPos(next)
    savePosition(next)
  }

  return (
    <div
      className={cn(
        'fixed z-50',
        getPositionClass(pos),
        'max-w-sm w-[92vw] sm:w-[380px] animate-in fade-in-0 slide-in-from-top-2'
      )}
      role="status"
      aria-live="polite"
      onClick={handleCycle}
      title="Click to move between corners"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <div
        className={cn(
          'select-none rounded-2xl border shadow-lg text-sm overflow-hidden p-3 sm:p-4 transition-colors duration-200',
          isDarkTheme ? 'bg-[#17171c]/95 text-white border-[#2f2f34]' : 'bg-white text-neutral-900 border-white',
          severityPalette.border
        )}
      >
        <div className="flex items-start gap-3">
          <span className={cn('mt-[2px]', severityPalette.icon)}>
            <IconComp className="h-4 w-4" />
          </span>
          <div className="flex-1 break-words">
            <div className="flex items-center gap-2 mb-1">
              <span className={cn('h-3 w-3 rounded-sm border', severityPalette.square)} aria-hidden />
              <div className="font-semibold tracking-tight">{severityLabel}</div>
            </div>
            <div className="leading-relaxed">{broadcast.message}</div>
            {expiresInLabel && (
              <div className="mt-2 text-xs opacity-70">
                Expires in {expiresInLabel}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default BroadcastToast
