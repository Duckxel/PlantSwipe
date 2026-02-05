import React from 'react'
import { Workbox } from 'workbox-window'

const AUTO_HIDE_MS = 8000
const READY_ACK_KEY = 'plantswipe.offlineReadyAck'
const VERSION_KEY = 'plantswipe.appVersion'
/** Delay (ms) after an offline event before we verify with a real fetch */
const OFFLINE_VERIFY_DELAY_MS = 3000
/** How often (ms) to re-check connectivity while the offline popup is shown */
const OFFLINE_RECHECK_INTERVAL_MS = 10000
const disablePwaFlag = String(import.meta.env.VITE_DISABLE_PWA ?? '').trim().toLowerCase()
const PWA_DISABLED = disablePwaFlag === 'true' || disablePwaFlag === '1' || disablePwaFlag === 'yes' || disablePwaFlag === 'on' || disablePwaFlag === 'disable' || disablePwaFlag === 'disabled'

const resolveScope = () => {
  const scope = import.meta.env.BASE_URL || '/'
  return scope.endsWith('/') ? scope : `${scope}/`
}

/**
 * Perform a real network connectivity check by fetching a tiny resource.
 * Returns true if the network is reachable, false otherwise.
 */
const checkRealConnectivity = async (): Promise<boolean> => {
  try {
    // Use a cache-busted HEAD request to a lightweight same-origin endpoint.
    // Fallback to fetching the favicon if no API is available.
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const response = await fetch(`/api/health?_cb=${Date.now()}`, {
      method: 'HEAD',
      cache: 'no-store',
      signal: controller.signal,
    })
    clearTimeout(timeout)
    return response.ok || response.status === 204 || response.status === 304
  } catch {
    // First attempt failed, try favicon as fallback
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      const response = await fetch(`/favicon.ico?_cb=${Date.now()}`, {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal,
      })
      clearTimeout(timeout)
      return response.ok || response.status === 204 || response.status === 304
    } catch {
      return false
    }
  }
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

const readStoredVersion = () => {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(VERSION_KEY)
  } catch {
    return null
  }
}

const persistVersion = (value: string | null) => {
  if (typeof window === 'undefined') return
  try {
    if (value) {
      window.localStorage.setItem(VERSION_KEY, value)
    } else {
      window.localStorage.removeItem(VERSION_KEY)
    }
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
  // Start as online — the real connectivity check will update this if truly offline.
  // This prevents false-positive offline popups on page load.
  const [isOffline, setIsOffline] = React.useState(false)
  const [offlineHint, setOfflineHint] = React.useState<string | null>(null)
  const [activeVersion, setActiveVersion] = React.useState<string | null>(readStoredVersion)
  const [availableVersion, setAvailableVersion] = React.useState<string | null>(null)
  const autoHideTimer = React.useRef<number | null>(null)
  const wbRef = React.useRef<Workbox | null>(null)
  const pendingReloadRef = React.useRef(false)
  // Guard: once set to true, prevents any further update popups for this
  // service-worker lifecycle.  Only reset when a new SW actually activates
  // (i.e. the version changes), so that a *future* update can still be surfaced.
  const updateShownRef = React.useRef(false)

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
    // Prevent duplicate update notifications
    if (updateShownRef.current) return
    updateShownRef.current = true
    
    setNeedRefreshFlag(true)
    setRefreshDismissed(false)
    setMode('update')
    setVisible(true)
  }, [])

  const handleSwMessage = React.useCallback(
    (event: MessageEvent) => {
      const data = event.data
      if (!data || data.source !== 'aphylia-sw') return
      if (data.type === 'SW_UPDATE_FOUND') {
        if (typeof data.meta?.version === 'string') {
          setAvailableVersion(data.meta.version)
        }
        surfaceWaitingUpdate()
        return
      }
      if (data.type === 'SW_ACTIVATED') {
        const nextVersion = typeof data.meta?.version === 'string' ? data.meta.version : null
        if (nextVersion) {
          setActiveVersion(nextVersion)
          persistVersion(nextVersion)
          setAvailableVersion((current) => (current === nextVersion ? null : current))
          // The current update cycle is complete — reset the guard so that
          // a *future* service-worker update can surface a new popup.
          updateShownRef.current = false
        }
      }
    },
    [surfaceWaitingUpdate]
  )

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

  // Note: no separate effect for needRefreshFlag — surfaceWaitingUpdate()
  // already sets mode='update' and visible=true directly.  A duplicate
  // effect here was causing the popup to re-appear after dismiss because
  // needRefreshFlag could still be true from a prior trigger.

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

  // -- Robust offline detection: verify with real network requests --
  const offlineVerifyTimer = React.useRef<number | null>(null)
  const offlineRecheckTimer = React.useRef<number | null>(null)

  const clearOfflineTimers = React.useCallback(() => {
    if (offlineVerifyTimer.current !== null) {
      window.clearTimeout(offlineVerifyTimer.current)
      offlineVerifyTimer.current = null
    }
    if (offlineRecheckTimer.current !== null) {
      window.clearInterval(offlineRecheckTimer.current)
      offlineRecheckTimer.current = null
    }
  }, [])

  const verifyOffline = React.useCallback(async () => {
    const isReachable = await checkRealConnectivity()
    if (isReachable) {
      // Network is actually reachable — do NOT show offline popup
      setIsOffline(false)
    } else {
      // Confirmed offline
      setIsOffline(true)
    }
  }, [])

  React.useEffect(() => {
    if (typeof window === 'undefined') return

    const handleOnline = () => {
      // Browser says online — trust it and clear timers
      clearOfflineTimers()
      setIsOffline(false)
    }

    const handleOffline = () => {
      // Browser says offline — don't trust it immediately.
      // Wait a short delay then verify with a real network request.
      if (offlineVerifyTimer.current !== null) return // already scheduled
      offlineVerifyTimer.current = window.setTimeout(() => {
        offlineVerifyTimer.current = null
        void verifyOffline()
      }, OFFLINE_VERIFY_DELAY_MS)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // If navigator.onLine is false at mount, schedule a verification
    if (!navigator.onLine) {
      offlineVerifyTimer.current = window.setTimeout(() => {
        offlineVerifyTimer.current = null
        void verifyOffline()
      }, OFFLINE_VERIFY_DELAY_MS)
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearOfflineTimers()
    }
  }, [verifyOffline, clearOfflineTimers])

  // Periodically re-check connectivity while the offline popup is shown,
  // so it auto-dismisses once the connection is restored.
  React.useEffect(() => {
    if (!isOffline) {
      if (offlineRecheckTimer.current !== null) {
        window.clearInterval(offlineRecheckTimer.current)
        offlineRecheckTimer.current = null
      }
      return
    }
    offlineRecheckTimer.current = window.setInterval(() => {
      void verifyOffline()
    }, OFFLINE_RECHECK_INTERVAL_MS)
    return () => {
      if (offlineRecheckTimer.current !== null) {
        window.clearInterval(offlineRecheckTimer.current)
        offlineRecheckTimer.current = null
      }
    }
  }, [isOffline, verifyOffline])

  React.useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.addEventListener('message', handleSwMessage)
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleSwMessage)
    }
  }, [handleSwMessage])

  React.useEffect(() => {
    if (PWA_DISABLED) return
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.ready
      .then((registration) => {
        registration?.active?.postMessage({ type: 'SW_CLIENT_READY' })
      })
      .catch(() => {})
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
      // Do NOT reset updateShownRef here — the same waiting SW is still
      // present and other triggers (Workbox 'waiting', SW_UPDATE_FOUND
      // message, registration.waiting check) could fire again and re-show
      // the popup.  The ref is only reset when SW_ACTIVATED arrives with
      // a new version, so a genuinely new update can still be surfaced.
    }
    setVisible(false)
  }

  const triggerUpdate = () => {
    setNeedRefreshFlag(false)
    setRefreshDismissed(false)
    setAvailableVersion(null)
    // Do NOT reset updateShownRef — a reload is pending; no reason to
    // allow the popup to re-appear if the reload takes a moment.
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

  const retryConnection = async () => {
    if (typeof window === 'undefined') return
    setOfflineHint('Checking connection…')
    const isReachable = await checkRealConnectivity()
    if (isReachable) {
      setIsOffline(false)
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
        ? availableVersion
          ? `Aphylia v${availableVersion} ready`
          : 'New release available'
        : mode === 'offline'
          ? 'You appear to be offline'
          : 'Offline mode ready'
    const description =
      mode === 'update'
        ? availableVersion && activeVersion && availableVersion !== activeVersion
          ? `Reload to move from v${activeVersion} to v${availableVersion}.`
          : availableVersion
            ? `Reload to use Aphylia v${availableVersion}.`
            : 'Reload to use the latest Aphylia experience.'
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
          {mode === 'update' && availableVersion ? (
            <p className="mt-2 text-[11px] uppercase tracking-wide text-emerald-200/80">
              {activeVersion ? `Current v${activeVersion}` : 'Current build'} → v{availableVersion}
            </p>
          ) : null}
          {mode === 'offline' && offlineHint ? <p className="mt-2 text-xs text-amber-200/90">{offlineHint}</p> : null}
        <div className={`mt-4 flex gap-2 ${isBlockingMode ? 'text-base' : 'text-sm'}`}>
          {mode === 'update' ? (
            <>
              <button
                type="button"
                onClick={dismiss}
                className="flex-1 rounded-full border border-white/30 px-4 py-2 font-medium text-white/80 transition hover:border-white hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50"
              >
                Later
              </button>
              <button
                type="button"
                onClick={triggerUpdate}
                className="flex-1 rounded-full bg-emerald-400 px-4 py-2 font-semibold text-emerald-950 transition hover:bg-emerald-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200"
              >
                Reload now
              </button>
            </>
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
