import React from 'react'
import { Info, AlertTriangle, XCircle } from 'lucide-react'
import { useTheme } from '@/context/ThemeContext'
import { cn } from '@/lib/utils'
import { useBroadcastActions, useBroadcastState } from '@/hooks/useBroadcastState'
import { msRemaining } from '@/lib/broadcasts'

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
  const { broadcast, ready } = useBroadcastState()
  const { refresh } = useBroadcastActions()
  React.useEffect(() => {
    void refresh()
  }, [refresh])
  const [pos, setPos] = React.useState<PositionKey>(loadPosition)
  const now = useNowTick(1000)

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

  if (!ready || !broadcast) return null

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
