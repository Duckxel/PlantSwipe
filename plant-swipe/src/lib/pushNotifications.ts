import { supabase } from '@/lib/supabaseClient'

function getVapidPublicKey(): string | null {
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const envKey = (window as any)?.__ENV__?.VITE_VAPID_PUBLIC_KEY
    if (envKey && typeof envKey === 'string' && envKey.trim().length > 0) {
      return envKey.trim()
    }
  }
  const metaKey = (import.meta.env?.VITE_VAPID_PUBLIC_KEY as string | undefined) || ''
  return metaKey && metaKey.trim().length > 0 ? metaKey.trim() : null
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  try {
    const result = await Notification.requestPermission()
    return result === 'granted'
  } catch {
    return false
  }
}

async function syncSubscriptionWithServer(subscription: PushSubscription): Promise<void> {
  const session = (await supabase.auth.getSession()).data.session
  const token = session?.access_token
  if (!token) {
    throw new Error('You must be signed in to enable push notifications')
  }
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  headers.Authorization = `Bearer ${token}`
  
  const response = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers,
    credentials: 'same-origin',
    body: JSON.stringify({ subscription: subscription.toJSON() }),
  })
  
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    const errorMessage = data?.error || `Failed to register push subscription (${response.status})`
    console.error('[push] Failed to sync subscription with server:', errorMessage)
    throw new Error(errorMessage)
  }
  
  const data = await response.json().catch(() => ({}))
  if (!data.pushConfigured) {
    console.warn('[push] Push notifications are registered but server VAPID keys are not configured - notifications may not be delivered')
  }
}

export async function registerPushSubscription(force = false): Promise<PushSubscription> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Push notifications are not supported in this browser')
  }
  const permissionGranted =
    typeof Notification === 'undefined'
      ? false
      : Notification.permission === 'granted' || (await requestNotificationPermission())
  if (!permissionGranted) {
    throw new Error('Notifications are not enabled')
  }
  const vapidKey = getVapidPublicKey()
  if (!vapidKey) {
    throw new Error('Push key is not configured')
  }
  const registration = await navigator.serviceWorker.ready
  let subscription = await registration.pushManager.getSubscription()
  if (!subscription || force) {
    if (subscription && force) {
      try {
        await subscription.unsubscribe()
      } catch {}
    }
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    })
  }
  await syncSubscriptionWithServer(subscription)
  return subscription
}

export async function removePushSubscription(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  const endpoint = subscription?.endpoint
  try {
    await subscription?.unsubscribe()
  } catch {}
  try {
    const session = (await supabase.auth.getSession()).data.session
    const token = session?.access_token
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`
    await fetch('/api/push/subscribe', {
      method: 'DELETE',
      headers,
      credentials: 'same-origin',
      body: JSON.stringify({ endpoint }),
    })
  } catch {}
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null
  try {
    const registration = await navigator.serviceWorker.ready
    return registration.pushManager.getSubscription()
  } catch {
    return null
  }
}

export interface PushDebugInfo {
  browserSupport: {
    notifications: boolean
    serviceWorker: boolean
    pushManager: boolean
  }
  permission: NotificationPermission | 'unsupported'
  hasSubscription: boolean
  subscriptionEndpoint: string | null
  serverStatus?: {
    pushEnabled: boolean
    vapidConfigured: boolean
    subscriptionCount: number
    subscriptions: Array<{
      id: string
      endpointDomain: string
      lastUsedAt: string | null
    }>
    troubleshooting: Record<string, string | null>
  }
  error?: string
}

/**
 * Get debug information about the push notification setup.
 * Useful for troubleshooting notification delivery issues.
 */
export async function getPushDebugInfo(): Promise<PushDebugInfo> {
  const info: PushDebugInfo = {
    browserSupport: {
      notifications: typeof Notification !== 'undefined',
      serviceWorker: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
      pushManager: typeof window !== 'undefined' && 'PushManager' in window
    },
    permission: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
    hasSubscription: false,
    subscriptionEndpoint: null
  }
  
  // Check browser subscription
  try {
    const subscription = await getExistingSubscription()
    info.hasSubscription = !!subscription
    if (subscription) {
      // Only show domain for privacy
      try {
        const url = new URL(subscription.endpoint)
        info.subscriptionEndpoint = url.hostname
      } catch {
        info.subscriptionEndpoint = 'unknown'
      }
    }
  } catch (err) {
    info.error = `Failed to get subscription: ${(err as Error)?.message}`
  }
  
  // Check server status
  try {
    const session = (await supabase.auth.getSession()).data.session
    const token = session?.access_token
    
    if (token) {
      const response = await fetch('/api/push/debug', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        info.serverStatus = {
          pushEnabled: data.serverPushEnabled,
          vapidConfigured: data.vapidConfigured,
          subscriptionCount: data.subscriptionCount,
          subscriptions: data.subscriptions || [],
          troubleshooting: data.troubleshooting || {}
        }
      }
    }
  } catch (err) {
    // Don't fail if server debug fails
    console.warn('[push] Failed to get server debug info:', (err as Error)?.message)
  }
  
  return info
}

/**
 * Send a test push notification to the current user.
 * This helps verify that notifications are working end-to-end.
 */
export async function sendTestPushNotification(): Promise<{ sent: boolean; error?: string }> {
  try {
    const session = (await supabase.auth.getSession()).data.session
    const token = session?.access_token
    const userId = session?.user?.id
    
    if (!token || !userId) {
      return { sent: false, error: 'Not authenticated' }
    }
    
    // Check if we have permission and subscription
    if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
      return { sent: false, error: 'Notification permission not granted' }
    }
    
    const subscription = await getExistingSubscription()
    if (!subscription) {
      return { sent: false, error: 'No push subscription found. Try enabling notifications first.' }
    }
    
    // Send test notification via the instant API
    const response = await fetch('/api/push/instant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        recipientId: userId,
        type: 'new_message',
        title: 'Test Notification',
        body: 'If you see this, push notifications are working! 🎉',
        tag: 'test-notification',
        renotify: true,
        data: {
          type: 'test',
          url: '/settings'
        }
      })
    })
    
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      return { sent: false, error: data.error || `Request failed (${response.status})` }
    }
    
    const result = await response.json()
    if (!result.sent) {
      return { sent: false, error: result.reason || 'Notification not delivered' }
    }
    
    return { sent: true }
  } catch (err) {
    return { sent: false, error: (err as Error)?.message || 'Unknown error' }
  }
}
