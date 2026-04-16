import { isNativeCapacitor } from '@/platform/runtime'

/**
 * Web push (SW + PushManager) on browser PWA; native uses @capacitor/push-notifications + minimal SW + FCM/APNs on server.
 */
export function isPlatformWebPushSupported(): boolean {
  if (typeof window === 'undefined') return false
  // Native Capacitor uses FCM/APNs via @capacitor/push-notifications — not the Web Push API.
  // Returning true here caused the usePushSubscription hook to treat the WebView as a regular
  // browser, which can trigger Notification.requestPermission() or service-worker PushManager
  // calls that redirect the user out of the app to Chrome on Android.
  if (isNativeCapacitor()) return false
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window
}
