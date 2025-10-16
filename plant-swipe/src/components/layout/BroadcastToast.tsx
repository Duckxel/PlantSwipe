import React from 'react'
import { Info, AlertTriangle, XCircle } from 'lucide-react'

export type Broadcast = {
  id: string
  message: string
  severity?: 'info' | 'warning' | 'danger'
  createdAt: string | null
  expiresAt: string | null
}

function useNowTick(intervalMs: number = 1000) {
  const [now, setNow] = React.useState<number>(() => Date.now())
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

function msRemaining(expiresAt: string | null, nowMs: number): number | null {
  if (!expiresAt) return null
  const end = Date.parse(expiresAt)
  if (!Number.isFinite(end)) return null
  return Math.max(0, end - nowMs)
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

// Persist the last active broadcast so it survives reloads while still valid
function loadPersistedBroadcast(nowMs: number): Broadcast | null {
  try {
    const raw = localStorage.getItem('plantswipe.broadcast.active')
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data || typeof data !== 'object') return null
    const b: Broadcast = {
      id: String((data as any).id || ''),
      message: String((data as any).message || ''),
      severity: ((data as any).severity === 'warning' || (data as any).severity === 'danger') ? (data as any).severity : 'info',
      createdAt: (data as any).createdAt || null,
      expiresAt: (data as any).expiresAt || null,
    }
    const remaining = msRemaining(b.expiresAt, nowMs)
    if (remaining !== null && remaining <= 0) return null
    return b
  } catch {}
  return null
}

function savePersistedBroadcast(b: Broadcast | null) {
  try {
    if (!b) localStorage.removeItem('plantswipe.broadcast.active')
    else localStorage.setItem('plantswipe.broadcast.active', JSON.stringify(b))
  } catch {}
}

const BroadcastToast: React.FC = () => {
  const [broadcast, setBroadcast] = React.useState<Broadcast | null>(() => loadPersistedBroadcast(Date.now()))
  const [pos, setPos] = React.useState<PositionKey>(loadPosition)
  const now = useNowTick(1000)

  // Initial fetch to hydrate
  React.useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const r = await fetch('/api/broadcast/active', { headers: { 'Accept': 'application/json' }, credentials: 'same-origin' })
        if (r.ok) {
          const b = await r.json().catch(() => ({}))
          if (!cancelled) {
            const next: Broadcast | null = b?.broadcast || null
            if (next) {
              setBroadcast(next)
              savePersistedBroadcast(next)
            } else {
              // If server reports none but we have a valid persisted banner, keep it
              const persisted = loadPersistedBroadcast(Date.now())
              setBroadcast(persisted)
              if (!persisted) savePersistedBroadcast(null)
            }
          }
        } else {
          // Keep previously persisted value if fetch fails
          if (!cancelled) {
            const persisted = loadPersistedBroadcast(Date.now())
            setBroadcast(persisted)
          }
        }
      } catch {}
    }
    load()
    return () => { cancelled = true }
  }, [])

  // SSE stream for live updates
  React.useEffect(() => {
    let es: EventSource | null = null
    try {
      es = new EventSource('/api/broadcast/stream', { withCredentials: true })
      es.addEventListener('broadcast', (ev: MessageEvent) => {
        try {
          const data = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data
          const next: Broadcast = {
            id: String(data?.id || ''),
            message: String(data?.message || ''),
            severity: (data?.severity === 'warning' || data?.severity === 'danger') ? data.severity : 'info',
            createdAt: data?.createdAt || null,
            expiresAt: data?.expiresAt || null,
          }
          setBroadcast(next)
          savePersistedBroadcast(next)
        } catch {}
      })
      es.addEventListener('clear', () => {
        setBroadcast(null)
        savePersistedBroadcast(null)
      })
      es.onerror = () => {
        // Let browser retry; also keep UI stable
      }
    } catch {}
    return () => { try { es?.close() } catch {} }
  }, [])

  // Auto-hide on expiry
  React.useEffect(() => {
    if (!broadcast?.expiresAt) return
    const remaining = msRemaining(broadcast.expiresAt, now)
    if (remaining !== null && remaining <= 0) {
      setBroadcast(null)
      savePersistedBroadcast(null)
    }
  }, [broadcast?.expiresAt, now])

  if (!broadcast) return null

  const severity = (broadcast.severity === 'warning' || broadcast.severity === 'danger') ? broadcast.severity : 'info'
  const severityLabel = severity === 'warning' ? 'Warning' : severity === 'danger' ? 'Danger' : 'Information'
  const borderClass = severity === 'warning' ? 'border-yellow-400' : severity === 'danger' ? 'border-red-500' : 'border-white'
  const squareBgClass = severity === 'warning' ? 'bg-yellow-400' : severity === 'danger' ? 'bg-red-500' : 'bg-white'
  const iconColorClass = severity === 'warning' ? 'text-yellow-600' : severity === 'danger' ? 'text-red-600' : 'text-neutral-500'

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
      <div className={`select-none rounded-2xl border ${borderClass} bg-white shadow-lg text-sm text-neutral-900 overflow-hidden p-3 sm:p-4`}>
        <div className="flex items-start gap-2">
          <span className={`mt-[2px] ${iconColorClass}`}>
            <IconComp className="h-4 w-4" />
          </span>
          <div className="break-words flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={`h-3 w-3 rounded-sm border border-neutral-300 ${squareBgClass}`} aria-hidden />
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
