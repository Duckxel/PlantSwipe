import React from 'react'
import {
  getExistingSubscription,
  registerPushSubscription,
  removePushSubscription,
  requestNotificationPermission,
} from '@/lib/pushNotifications'

// Track if we've already attempted auto-enable for this session
const autoEnableAttempted = new Set<string>()
// Track if we've attempted re-sync for this session
const resyncAttempted = new Set<string>()
// Track if we've attempted re-subscribe after a SW update for this session
const swUpdateAttempted = new Set<string>()

export function usePushSubscription(userId: string | null) {
  const supported = React.useMemo(() => {
    if (typeof window === 'undefined') return false
    return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window
  }, [])
  const [permission, setPermission] = React.useState<NotificationPermission | 'unsupported'>(() => {
    if (typeof Notification === 'undefined') return 'unsupported'
    return Notification.permission
  })
  const [subscribed, setSubscribed] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [autoEnableTried, setAutoEnableTried] = React.useState(false)
  const [synced, setSynced] = React.useState(false)
  const resubscribeInFlight = React.useRef(false)

  const refresh = React.useCallback(async () => {
    if (!supported) return
    try {
      const existing = await getExistingSubscription()
      setSubscribed(Boolean(existing))
      if (typeof Notification !== 'undefined') {
        setPermission(Notification.permission)
      }
    } catch (err) {
      setError((err as Error)?.message || 'Failed to inspect subscription')
    }
  }, [supported])

  const attemptResubscribe = React.useCallback(async (force: boolean, reason: string) => {
    if (!supported || !userId) return
    if (resubscribeInFlight.current) return
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    resubscribeInFlight.current = true
    try {
      await registerPushSubscription(force)
      setSubscribed(true)
      setPermission(Notification.permission)
      console.log(`[push] Resubscribe success (${reason})`)
    } catch (err) {
      console.warn(`[push] Resubscribe failed (${reason}):`, (err as Error)?.message)
    } finally {
      resubscribeInFlight.current = false
    }
  }, [supported, userId])
  
  // Try to re-sync existing browser subscription to server
  // This handles cases where browser has subscription but it wasn't synced properly
  React.useEffect(() => {
    if (!supported || !userId || synced) return
    if (resyncAttempted.has(userId)) {
      setSynced(true)
      return
    }
    
    const tryResync = async () => {
      try {
        const existing = await getExistingSubscription()
        const permissionStatus = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
        
        console.log('[push] Checking subscription status:', {
          hasExistingSubscription: !!existing,
          permissionStatus,
          userId: userId.slice(0, 8) + '...'
        })
        
        if (existing && permissionStatus === 'granted') {
          // Browser has a subscription and permission is granted
          // Try to re-sync with server (this will update/insert the subscription)
          resyncAttempted.add(userId)
          console.log('[push] Re-syncing existing subscription with server...')
          await attemptResubscribe(false, 'resync-existing') // Don't force, just sync existing
          console.log('[push] Successfully re-synced subscription with server')
          setSynced(true)
          setSubscribed(true)
        } else if (permissionStatus === 'granted' && !existing) {
          // Permission granted but no subscription - try to create one
          console.log('[push] Permission granted but no subscription, attempting to create one...')
          resyncAttempted.add(userId)
          try {
            await attemptResubscribe(true, 'resync-missing') // Force create new subscription
            console.log('[push] Successfully created new subscription')
            setSynced(true)
            setSubscribed(true)
          } catch (createErr) {
            console.warn('[push] Failed to create subscription:', (createErr as Error)?.message)
            setSynced(true)
          }
        } else {
          setSynced(true)
        }
      } catch (err) {
        // Sync failed - this might indicate an auth issue
        console.warn('[push] Failed to re-sync subscription:', (err as Error)?.message)
        setSynced(true) // Mark as attempted to avoid retry loops
      }
    }
    
    // Small delay to avoid blocking initial render
    const timeout = setTimeout(tryResync, 1500)
    return () => clearTimeout(timeout)
  }, [supported, userId, synced])

  React.useEffect(() => {
    refresh().catch(() => {})
  }, [refresh, userId])

  // Re-subscribe after a service worker update becomes active
  React.useEffect(() => {
    if (!supported || !userId || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    let active = true
    let registration: ServiceWorkerRegistration | null = null

    const handleControllerChange = () => {
      if (!active) return
      if (swUpdateAttempted.has(userId)) return
      swUpdateAttempted.add(userId)
      attemptResubscribe(true, 'service-worker-activated')
    }

    const handleUpdateFound = () => {
      const installing = registration?.installing
      if (!installing) return
      const onStateChange = () => {
        if (installing.state === 'activated') {
          handleControllerChange()
        }
      }
      installing.addEventListener('statechange', onStateChange)
    }

    const setup = async () => {
      try {
        registration = await navigator.serviceWorker.ready
        registration.addEventListener('updatefound', handleUpdateFound)
      } catch {
        // ignore setup failures
      }
    }

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)
    setup()

    return () => {
      active = false
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
      registration?.removeEventListener('updatefound', handleUpdateFound)
    }
  }, [supported, userId, attemptResubscribe])

  // Auto-enable push notifications for new users (default behavior)
  // This runs once per user session when they first log in
  React.useEffect(() => {
    if (!supported || !userId || autoEnableTried) return
    if (autoEnableAttempted.has(userId)) return
    
    const tryAutoEnable = async () => {
      try {
        // Check if user already has a subscription
        const existing = await getExistingSubscription()
        if (existing) {
          setSubscribed(true)
          return
        }
        
        // Only auto-prompt if permission is 'default' (not yet asked)
        // and the user is logged in
        if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
          // Mark that we've attempted auto-enable for this user
          autoEnableAttempted.add(userId)
          setAutoEnableTried(true)
          
          // Try to enable push notifications
          await requestNotificationPermission()
          await registerPushSubscription()
          setSubscribed(true)
          if (typeof Notification !== 'undefined') {
            setPermission(Notification.permission)
          }
        }
      } catch {
        // Silent fail for auto-enable - user can manually enable later
        setAutoEnableTried(true)
        autoEnableAttempted.add(userId)
      }
    }
    
    // Small delay to avoid blocking initial render
    const timeout = setTimeout(tryAutoEnable, 2000)
    return () => clearTimeout(timeout)
  }, [supported, userId, autoEnableTried])

  const enable = React.useCallback(async () => {
    if (!supported) {
      setError('Push notifications are not supported on this device')
      return
    }
    if (!userId) {
      setError('Sign in to enable notifications')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await requestNotificationPermission()
      await registerPushSubscription()
      setSubscribed(true)
      if (typeof Notification !== 'undefined') {
        setPermission(Notification.permission)
      }
    } catch (err) {
      setError((err as Error)?.message || 'Failed to enable notifications')
    } finally {
      setLoading(false)
    }
  }, [supported, userId])

  const disable = React.useCallback(async () => {
    if (!supported) return
    setLoading(true)
    setError(null)
    try {
      await removePushSubscription()
      setSubscribed(false)
    } catch (err) {
      setError((err as Error)?.message || 'Failed to disable notifications')
    } finally {
      setLoading(false)
    }
  }, [supported])

  return { supported, permission, subscribed, loading, error, enable, disable, refresh }
}

export default usePushSubscription
