import React from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

const AUTO_HIDE_MS = 8000
const READY_ACK_KEY = 'plantswipe.offlineReadyAck'

const readReadyAck = () => {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(READY_ACK_KEY) === '1'
  } catch {
    return false
  }
}

const persistReadyAck = () => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(READY_ACK_KEY, '1')
  } catch {
    // ignore
  }
}

export function ServiceWorkerToast() {
  const [visible, setVisible] = React.useState(false)
  const [mode, setMode] = React.useState<'ready' | 'update'>('ready')
  const [readyAcknowledged, setReadyAcknowledged] = React.useState(readReadyAck)
  const [refreshDismissed, setRefreshDismissed] = React.useState(false)
  const autoHideTimer = React.useRef<number | null>(null)

  const { offlineReady, needRefresh, updateServiceWorker } = useRegisterSW({
    immediate: true,
    onRegisterError(error) {
      if (import.meta.env.DEV) {
        console.error('[PWA] Service worker registration failed', error)
      }
    },
  })

  React.useEffect(() => {
    if (offlineReady && !readyAcknowledged) {
      setMode('ready')
      setVisible(true)
    }
  }, [offlineReady, readyAcknowledged])

  React.useEffect(() => {
    if (needRefresh) {
      setRefreshDismissed(false)
      setMode('update')
      setVisible(true)
    } else {
      setRefreshDismissed(false)
    }
  }, [needRefresh])

  React.useEffect(() => {
    if (!visible || mode === 'update') return
    window.clearTimeout(autoHideTimer.current ?? undefined)
    autoHideTimer.current = window.setTimeout(() => {
      setVisible(false)
      setReadyAcknowledged(true)
      persistReadyAck()
    }, AUTO_HIDE_MS)
    return () => window.clearTimeout(autoHideTimer.current ?? undefined)
  }, [visible, mode])

  const dismiss = () => {
    window.clearTimeout(autoHideTimer.current ?? undefined)
    if (mode === 'ready') {
      setReadyAcknowledged(true)
      persistReadyAck()
    } else {
      setRefreshDismissed(true)
    }
    setVisible(false)
  }

  if (!visible || (mode === 'update' && refreshDismissed)) return null

  const title =
    mode === 'update'
      ? 'New release available'
      : 'Offline mode ready'
  const description =
    mode === 'update'
      ? 'Reload to use the latest PlantSwipe experience.'
      : 'You can keep swiping even without a network connection.'

  return (
    <div
      className="fixed bottom-6 right-6 z-[999] max-w-sm rounded-2xl border border-emerald-500/40 bg-neutral-900/90 p-4 text-white shadow-2xl backdrop-blur"
      role="status"
      aria-live="polite"
    >
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-2 text-xs text-white/70">{description}</p>
      <div className="mt-3 flex gap-2 text-sm">
        {mode === 'update' ? (
          <>
            <button
              type="button"
              onClick={() => updateServiceWorker(true)}
              className="rounded-full bg-emerald-400 px-3 py-1 font-semibold text-emerald-950 transition hover:bg-emerald-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200"
            >
              Reload now
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="rounded-full border border-white/30 px-3 py-1 text-white/80 transition hover:border-white hover:text-white"
            >
              Later
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={dismiss}
            className="rounded-full border border-white/30 px-3 py-1 text-white/80 transition hover:border-white hover:text-white"
          >
            Got it
          </button>
        )}
      </div>
    </div>
  )
}

export default ServiceWorkerToast
