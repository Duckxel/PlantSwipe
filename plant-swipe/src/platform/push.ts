import { isNativeCapacitor } from '@/platform/runtime'

/**
 * Web push (service worker + PushManager) capability. Native push will use a different path later;
 * until then, feature detection treats native as "no web push" so UI degrades gracefully.
 */
export function isPlatformWebPushSupported(): boolean {
  if (typeof window === 'undefined') return false
  if (isNativeCapacitor()) return false
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window
}
