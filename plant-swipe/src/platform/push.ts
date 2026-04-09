import { isNativeCapacitor } from '@/platform/runtime'

/**
 * Web push (SW + PushManager) on browser PWA; native uses @capacitor/push-notifications + minimal SW + FCM/APNs on server.
 */
export function isPlatformWebPushSupported(): boolean {
  if (typeof window === 'undefined') return false
  if (isNativeCapacitor()) {
    return typeof Notification !== 'undefined'
  }
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window
}
