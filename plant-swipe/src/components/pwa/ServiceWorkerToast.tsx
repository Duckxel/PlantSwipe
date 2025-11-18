import React from 'react'
import { Workbox } from 'workbox-window'

const AUTO_HIDE_MS = 8000
const READY_ACK_KEY = 'plantswipe.offlineReadyAck'
const disablePwaFlag = String(import.meta.env.VITE_DISABLE_PWA ?? '').trim().toLowerCase()
const PWA_DISABLED = disablePwaFlag === 'true' || disablePwaFlag === '1' || disablePwaFlag === 'yes' || disablePwaFlag === 'on' || disablePwaFlag === 'disable' || disablePwaFlag === 'disabled'

const resolveScope = () => {
  const scope = import.meta.env.BASE_URL || '/'
  return scope.endsWith('/') ? scope : `${scope}/`
}

const getIsOffline = () => {
  if (typeof navigator === 'undefined') return false
  return !navigator.onLine
}

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
  const [mode, setMode] = React.useState<'ready' | 'update' | 'offline'>('ready')
  const [readyAcknowledged, setReadyAcknowledged] = React.useState(readReadyAck)
  const [refreshDismissed, setRefreshDismissed] = React.useState(false)
  const [offlineReadyFlag, setOfflineReadyFlag] = React.useState(false)
  const [needRefreshFlag, setNeedRefreshFlag] = React.useState(false)
  const [isOffline, setIsOffline] = React.useState(getIsOffline)
  const [offlineHint, setOfflineHint] = React.useState<string | null>(null)
  const autoHideTimer = React.useRef<number | null>(null)
  const wbRef = React.useRef<Workbox | null>(null)
  const pendingReloadRef = React.useRef(false)

  const requestRegistrationUpdate = React.useCallback(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker
      .getRegistration()
      .then((registration) => registration?.update().catch(() => {}))
      .catch(() => {})
  }, [])

  React.useEffect(() => {
    if (!PWA_DISABLED) return
    if (typeof navigator === 'undefined' || !navigator.serviceWorker?.getRegistrations) return
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => Promise.all(regs.map((reg) => reg.unregister().catch(() => {}))))
      .catch(() => {})

    if (typeof window !== 'undefined' && 'caches' in window && window.caches?.keys) {
      window.caches
        .keys()
        .then((keys) => Promise.all(keys.map((key) => window.caches.delete(key).catch(() => false))))
        .catch(() => {})
    }
  }, [])

  const surfaceWaitingUpdate = React.useCallback(() => {
    setNeedRefreshFlag(true)
    setRefreshDismissed(false)
    setMode('update')
    setVisible(true)
  }, [])

  React.useEffect(() => {
    if (PWA_DISABLED) return
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    const scope = resolveScope()
    const swUrl = `${scope}sw.js`
    const wb = new Workbox(swUrl, { scope })
    wbRef.current = wb

    const handleWaiting = () => {
      surfaceWaitingUpdate()
    }

    const handleActivated = (event: { isUpdate?: boolean }) => {
      if (!event.isUpdate) {
        setOfflineReadyFlag(true)
      }
    }

    wb.addEventListener('waiting', handleWaiting)
    wb.addEventListener('activated', handleActivated)

    wb.register().catch((error) => {
      if (import.meta.env.DEV) {
        console.error('[PWA] Service worker registration failed', error)
      }
    })

    return () => {
      wb.removeEventListener('waiting', handleWaiting)
      wb.removeEventListener('activated', handleActivated)
      wbRef.current = null
    }
  }, [surfaceWaitingUpdate])

  React.useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    let mounted = true
    navigator.serviceWorker
      .getRegistration()
      .then((registration) => {
        if (!mounted) return
        if (registration?.waiting) {
          surfaceWaitingUpdate()
        }
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [surfaceWaitingUpdate])

  React.useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    const handleControllerChange = () => {
      if (!pendingReloadRef.current) return
      pendingReloadRef.current = false
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)
    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
    }
  }, [])

  React.useEffect(() => {
    if (offlineReadyFlag && !readyAcknowledged && !isOffline) {
      setMode('ready')
      setVisible(true)
    } else if (offlineReadyFlag && readyAcknowledged) {
      setOfflineReadyFlag(false)
    }
  }, [offlineReadyFlag, readyAcknowledged, isOffline])

  React.useEffect(() => {
    if (needRefreshFlag && !isOffline) {
      setMode('update')
      setVisible(true)
    }
  }, [needRefreshFlag, isOffline])

  React.useEffect(() => {
    if (!visible || mode !== 'ready') return
    window.clearTimeout(autoHideTimer.current ?? undefined)
    autoHideTimer.current = window.setTimeout(() => {
      setVisible(false)
      setReadyAcknowledged(true)
      persistReadyAck()
      setOfflineReadyFlag(false)
    }, AUTO_HIDE_MS)
    return () => window.clearTimeout(autoHideTimer.current ?? undefined)
  }, [visible, mode])

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  React.useEffect(() => {
    if (isOffline) {
      setMode('offline')
      setVisible(true)
      setOfflineHint('Waiting for a connection…')
    } else if (mode === 'offline') {
      setVisible(false)
      setOfflineHint(null)
    }
  }, [isOffline, mode])

  const dismiss = () => {
    window.clearTimeout(autoHideTimer.current ?? undefined)
    if (mode === 'ready') {
      setReadyAcknowledged(true)
      persistReadyAck()
      setOfflineReadyFlag(false)
    } else if (mode === 'update') {
      setRefreshDismissed(true)
      setNeedRefreshFlag(false)
    }
    setVisible(false)
  }

  const triggerUpdate = () => {
    setNeedRefreshFlag(false)
    setRefreshDismissed(false)
    pendingReloadRef.current = true
    const wb = wbRef.current
    const postSkipWaiting = () => {
      if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
      if (navigator.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' })
      }
    }

    if (wb) {
      wb.messageSW({ type: 'SKIP_WAITING' }).catch(() => {
        postSkipWaiting()
      })
    } else {
      postSkipWaiting()
    }
    setVisible(false)
  }

  const retryConnection = () => {
    if (typeof window === 'undefined') return
    if (navigator.onLine) {
      requestRegistrationUpdate()
      window.location.reload()
      return
    }
    requestRegistrationUpdate()
    setOfflineHint('Still offline. Double-check Wi‑Fi or cellular data.')
  }

  const isBlockingMode = mode === 'update' || mode === 'offline'

    React.useEffect(() => {
      if (!isBlockingMode || !visible) return
      if (typeof document === 'undefined') return
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prev
      }
    }, [isBlockingMode, visible])

  if (PWA_DISABLED) {
    return null
  }

  if (!visible || (mode === 'update' && (refreshDismissed || !needRefreshFlag)) || (mode === 'offline' && !isOffline)) return null

  const title =
    mode === 'update'
      ? 'New release available'
        : mode === 'offline'
          ? 'You appear to be offline'
          : 'Offline mode ready'
  const description =
    mode === 'update'
      ? 'Reload to use the latest Aphylia experience.'
        : mode === 'offline'
          ? 'Reconnect to the internet to continue using Aphylia without interruptions.'
          : 'You can keep swiping even without a network connection.'

  return (
    <div
      className={
        isBlockingMode
          ? 'fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4'
          : 'fixed bottom-6 right-6 z-[999] max-w-sm rounded-2xl border border-emerald-500/40 bg-neutral-900/90 p-4 text-white shadow-2xl backdrop-blur'
      }
      role={isBlockingMode ? 'dialog' : 'status'}
      aria-live={isBlockingMode ? undefined : 'polite'}
      aria-modal={isBlockingMode ? 'true' : undefined}
    >
      <div
        className={
          isBlockingMode
            ? 'w-full max-w-md rounded-2xl border border-white/20 bg-neutral-900 p-6 text-white shadow-2xl'
            : 'text-white'
        }
      >
        <p className={isBlockingMode ? 'text-xl font-semibold' : 'text-sm font-semibold'}>{title}</p>
          <p className={isBlockingMode ? 'mt-3 text-sm text-white/80' : 'mt-2 text-xs text-white/70'}>{description}</p>
          {mode === 'offline' && offlineHint ? <p className="mt-2 text-xs text-amber-200/90">{offlineHint}</p> : null}
        <div className={`mt-4 flex gap-2 ${isBlockingMode ? 'text-base' : 'text-sm'}`}>
          {mode === 'update' ? (
            <button
              type="button"
              onClick={triggerUpdate}
              className="w-full rounded-full bg-emerald-400 px-4 py-2 font-semibold text-emerald-950 transition hover:bg-emerald-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200"
            >
              Reload now
            </button>
          ) : mode === 'offline' ? (
            <button
              type="button"
              onClick={retryConnection}
              className="w-full rounded-full bg-amber-300 px-4 py-2 font-semibold text-amber-950 transition hover:bg-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-100"
            >
              Retry connection
            </button>
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
    </div>
  )
}

export default ServiceWorkerToast
