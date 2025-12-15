import React from 'react'
import { Info, AlertTriangle, XCircle } from 'lucide-react'
import { loadPersistedBroadcast, savePersistedBroadcast, type BroadcastRecord } from '@/lib/broadcastStorage'

export type Broadcast = BroadcastRecord

function useNowTick(intervalMs: number = 1000) {
  const [now, setNow] = React.useState<number>(() => Date.now())
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

function msRemaining(expiresAt: string | null, nowMs: number, clockOffset: number = 0): number | null {
  if (!expiresAt) return null
  const end = Date.parse(expiresAt)
  if (!Number.isFinite(end)) return null
  // Calculate expiry relative to adjusted time
  return end - (nowMs + clockOffset)
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

const BroadcastToast: React.FC = () => {
  const [broadcast, setBroadcast] = React.useState<Broadcast | null>(() => loadPersistedBroadcast())
  const [pos, setPos] = React.useState<PositionKey>(loadPosition)
  const [clockOffset, setClockOffset] = React.useState(0)
  const now = useNowTick(1000)

  const applyBroadcast = React.useCallback((incoming: BroadcastRecord | null, serverTime?: string) => {
    if (serverTime) {
      const serverMs = Date.parse(serverTime)
      if (Number.isFinite(serverMs)) {
        setClockOffset(serverMs - Date.now())
      }
    }

    // If null, clear.
    if (!incoming) {
      setBroadcast(null)
      savePersistedBroadcast(null)
      return
    }

    // If server returned it, trust it is active initially.
    // Client-side expiry check will run in useEffect using offset.
    setBroadcast(incoming)
    savePersistedBroadcast(incoming)
  }, [])

  const refreshBroadcast = React.useCallback(async () => {
    try {
      const r = await fetch('/api/broadcast/active', {
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
      })
      if (r.ok) {
        const body = await r.json().catch(() => ({}))
        const next: Broadcast | null = body?.broadcast || null
        const sTime: string | undefined = body?.serverTime

        if (next) {
          applyBroadcast(next, sTime)
        } else {
          // If server says nothing active, clear local
          setBroadcast(null)
          savePersistedBroadcast(null)
        }
        return true
      }
    } catch {}
    // If fetch failed, do not clear local state (offline support)
    // But check expiration of local state
    const persisted = loadPersistedBroadcast()
    setBroadcast(persisted)
    return false
  }, [applyBroadcast])

  // Initial fetch to hydrate: on load, check server for active broadcast
  React.useEffect(() => {
    refreshBroadcast()
  }, [refreshBroadcast])

  // SSE stream for live updates with polling fallback
  React.useEffect(() => {
    let es: EventSource | null = null
    let pollId: number | null = null

    const startPolling = () => {
      if (pollId) return
      const tick = () => { void refreshBroadcast().catch(() => {}) }
      pollId = window.setInterval(tick, 60000)
      tick()
    }

    const stopPolling = () => {
      if (pollId !== null) {
        window.clearInterval(pollId)
        pollId = null
      }
    }

    const handleBroadcast = (ev: MessageEvent) => {
      try {
        const data = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data
        const next: Broadcast = {
          id: String(data?.id || ''),
          message: String(data?.message || ''),
          severity: (data?.severity === 'warning' || data?.severity === 'danger') ? data.severity : 'info',
          createdAt: data?.createdAt || null,
          expiresAt: data?.expiresAt || null,
          adminName: data?.adminName || null,
        }
        applyBroadcast(next, data?.serverTime)
      } catch {}
    }

    const handleClear = () => {
      applyBroadcast(null)
    }

    try {
      es = new EventSource('/api/broadcast/stream', { withCredentials: true })
      es.addEventListener('broadcast', handleBroadcast as EventListener)
      es.addEventListener('clear', handleClear as EventListener)
      es.onerror = () => {
        if (es) {
          try { es.close() } catch {}
          es = null
        }
        startPolling()
      }
    } catch {
      startPolling()
    }

    return () => {
      try { es?.close() } catch {}
      stopPolling()
    }
  }, [refreshBroadcast, applyBroadcast])

  // Auto-hide on expiry
  React.useEffect(() => {
    const expirySource = broadcast?.expiresAt
    if (!expirySource) return
    const remaining = msRemaining(expirySource, now, clockOffset)
    // Only hide if clearly expired (buffer 2s) to avoid flickering on drift
    if (remaining !== null && remaining <= -2000) {
      setBroadcast(null)
      savePersistedBroadcast(null)
    }
  }, [broadcast?.expiresAt, now, clockOffset])

  const severity = (broadcast?.severity === 'warning' || broadcast?.severity === 'danger') ? broadcast?.severity : 'info'
  const severityLabel = severity === 'warning' ? 'Warning' : severity === 'danger' ? 'Danger' : 'Information'
  const severityVisuals = React.useMemo(() => {
    switch (severity) {
      case 'warning':
        return {
          border: 'border-yellow-400 dark:border-yellow-300/80',
          square: 'border-yellow-300 dark:border-yellow-300/60 bg-yellow-400 dark:bg-yellow-400/40',
          icon: 'text-yellow-600 dark:text-yellow-200',
        }
      case 'danger':
        return {
          border: 'border-red-500 dark:border-red-400/80',
          square: 'border-red-400 dark:border-red-400/60 bg-red-500 dark:bg-red-500/35',
          icon: 'text-red-600 dark:text-red-300',
        }
      default:
        return {
          border: 'border-white dark:border-white/20',
          square: 'border-neutral-200 dark:border-white/25 bg-white dark:bg-white/15',
          icon: 'text-neutral-500 dark:text-neutral-100',
        }
    }
  }, [severity])

  if (!broadcast) return null

  const IconComp = severity === 'warning' ? AlertTriangle : severity === 'danger' ? XCircle : Info

  const handleCycle = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    const next = nextPositionKey(pos)
    setPos(next)
    savePosition(next)
  }

  return (
    <div
      className={`fixed z-50 ${getPositionClass(pos)} max-w-sm w-[92vw] sm:w-[380px]`}
      role="status"
      aria-live="polite"
      onClick={handleCycle}
      title="Click to move between corners"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <div className={`select-none rounded-2xl border ${severityVisuals.border} bg-white dark:bg-[#111217] shadow-lg dark:shadow-[0_25px_50px_rgba(0,0,0,0.65)] text-sm text-neutral-900 dark:text-neutral-100 overflow-hidden p-3 sm:p-4 transition-colors`}>
        <div className="flex items-start gap-2">
          <span className={`mt-[2px] ${severityVisuals.icon}`}>
            <IconComp className="h-4 w-4" />
          </span>
          <div className="break-words flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={`h-3 w-3 rounded-sm border ${severityVisuals.square}`} aria-hidden />
              <div className="font-semibold">{severityLabel}</div>
            </div>
            <div>{broadcast.message}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BroadcastToast
