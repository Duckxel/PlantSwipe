import React from 'react'

export type Broadcast = {
  id: string
  message: string
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

const BroadcastToast: React.FC = () => {
  const [broadcast, setBroadcast] = React.useState<Broadcast | null>(null)
  const [pos, setPos] = React.useState<PositionKey>(loadPosition)
  const now = useNowTick(1000)

  // Initial fetch to hydrate
  React.useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const r = await fetch('/api/broadcast/active', { headers: { 'Accept': 'application/json' }, credentials: 'same-origin' })
        if (!r.ok) return
        const b = await r.json().catch(() => ({}))
        if (!cancelled) setBroadcast(b?.broadcast || null)
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
          setBroadcast({
            id: String(data?.id || ''),
            message: String(data?.message || ''),
            createdAt: data?.createdAt || null,
            expiresAt: data?.expiresAt || null,
          })
        } catch {}
      })
      es.addEventListener('clear', () => {
        setBroadcast(null)
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
    }
  }, [broadcast?.expiresAt, now])

  if (!broadcast) return null

  const remaining = msRemaining(broadcast.expiresAt, now)

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
      <div className="cursor-pointer select-none rounded-2xl border bg-white shadow-lg p-3 sm:p-4 text-sm text-neutral-900">
        <div className="font-semibold mb-1">Notice</div>
        <div className="break-words">{broadcast.message}</div>
        {remaining !== null && (
          <div className="mt-2 text-xs opacity-60">Disappears in {formatDuration(remaining)}</div>
        )}
      </div>
    </div>
  )
}

function formatDuration(ms: number): string {
  ms = Math.max(0, Math.floor(ms))
  const totalSeconds = Math.floor(ms / 1000)
  const s = totalSeconds % 60
  const totalMinutes = Math.floor(totalSeconds / 60)
  const m = totalMinutes % 60
  const h = Math.floor(totalMinutes / 60)
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export default BroadcastToast
