import { supabase } from '@/lib/supabaseClient'

function getVapidPublicKey(): string | null {
  if (typeof window !== 'undefined') {
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
