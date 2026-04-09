/**
 * Capacitor: minimal SW + FCM token registration for native push (server: FCM_LEGACY_SERVER_KEY).
 */
import { Capacitor } from '@capacitor/core'
import { supabase } from '@/lib/supabaseClient'
import { registerNativeMinimalServiceWorker } from '@/lib/capNativeBridge'

let registeredListeners = false
let listenersPromise: Promise<void> | null = null
/** Last FCM/APNs token from the plugin (for unregister). */
export let lastNativePushToken: string | null = null

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

export async function registerNativePushForCurrentUser(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await registerNativeMinimalServiceWorker()
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
