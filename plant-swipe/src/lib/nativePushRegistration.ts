/**
 * Capacitor: FCM/APNs token registration for native push.
 *
 * Native push uses @capacitor/push-notifications exclusively — no web service
 * worker is registered.  The previous implementation called
 * registerNativeMinimalServiceWorker() which registered sw-native.js inside the
 * Capacitor WebView.  On Android that service-worker's `notificationclick`
 * handler called `self.clients.openWindow()` which opened Chrome instead of
 * navigating inside the app, and on some devices the SW registration itself
 * caused a redirect out of the WebView.
 */
import { Capacitor } from '@capacitor/core'
import { supabase } from '@/lib/supabaseClient'

let registeredListeners = false
let listenersPromise: Promise<void> | null = null
/** Last FCM/APNs token from the plugin (for unregister). */
export let lastNativePushToken: string | null = null

/** Reference to the in-app navigate function (set by registerNativePushNavigation). */
let navigateFn: ((path: string) => void) | null = null

/**
 * Call once from the root component so that notification taps can navigate
 * inside the app instead of opening Chrome.
 */
export function registerNativePushNavigation(navigate: (path: string) => void): void {
  navigateFn = navigate
}

async function postFcmToken(token: string): Promise<void> {
  const session = (await supabase.auth.getSession()).data.session
  const auth = session?.access_token
  if (!auth || !token) return
  await fetch('/api/push/fcm-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth}` },
    credentials: 'same-origin',
    body: JSON.stringify({
      token,
      platform: Capacitor.getPlatform(),
    }),
  })
}

/** Resolve notification data to an in-app path. */
function resolveNotificationPath(data: Record<string, unknown> | undefined): string {
  if (!data) return '/'
  if (typeof data.url === 'string' && data.url.length) return data.url
  if (typeof data.ctaUrl === 'string' && data.ctaUrl.length) return data.ctaUrl
  const type = data.type as string | undefined
  const conversationId = data.conversationId as string | undefined
  if (type === 'new_message' && conversationId) return `/messages?conversation=${conversationId}`
  if (type === 'friend_request' || type === 'friend_request_accepted') return '/friends'
  if (type === 'garden_invite' || type === 'garden_invite_accepted') return '/gardens'
  if (type === 'daily_task_reminder' || type === 'task_reminder') return '/gardens'
  if (type === 'journal_continue_reminder') return '/gardens'
  if (type === 'weekly_inactive_reminder') return '/discovery'
  if (conversationId) return `/messages?conversation=${conversationId}`
  return '/'
}

export async function registerNativePushForCurrentUser(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')

    if (!registeredListeners) {
      registeredListeners = true
      listenersPromise = (async () => {
        await PushNotifications.addListener('registration', (ev) => {
          const tok = ev?.value
          if (tok) {
            lastNativePushToken = tok
            void postFcmToken(tok)
          }
        })
        await PushNotifications.addListener('registrationError', (err) => {
          if (import.meta.env.DEV) console.warn('[native push] registration error', err)
        })
        // Handle notification taps — navigate inside the app instead of opening Chrome
        await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          const data = action?.notification?.data as Record<string, unknown> | undefined
          const path = resolveNotificationPath(data)
          if (navigateFn) {
            navigateFn(path)
          }
        })
      })()
    }
    if (listenersPromise) await listenersPromise

    const perm = await PushNotifications.checkPermissions()
    if (perm.receive !== 'granted') {
      const req = await PushNotifications.requestPermissions()
      if (req.receive !== 'granted') return
    }
    await PushNotifications.register()
  } catch (e) {
    if (import.meta.env.DEV) console.warn('[native push] setup failed', e)
  }
}
