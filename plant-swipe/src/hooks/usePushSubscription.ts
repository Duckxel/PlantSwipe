import React from 'react'
import {
  getExistingSubscription,
  registerPushSubscription,
  removePushSubscription,
  requestNotificationPermission,
} from '@/lib/pushNotifications'

// Track if we've already attempted auto-enable for this session
const autoEnableAttempted = new Set<string>()

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

  React.useEffect(() => {
    refresh().catch(() => {})
  }, [refresh, userId])

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
