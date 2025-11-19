import React from 'react'
import {
  getExistingSubscription,
  registerPushSubscription,
  removePushSubscription,
  requestNotificationPermission,
} from '@/lib/pushNotifications'

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
