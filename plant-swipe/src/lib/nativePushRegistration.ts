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
 * Path buffered from a notification tap that arrived before the React tree
 * finished mounting (cold-launch from a tap). Flushed as soon as
 * `registerNativePushNavigation` wires up the router navigator.
 */
let pendingPath: string | null = null

/**
 * De-duplicate tap events. Android's push plugin reads the FCM extras during
 * bridge init, but in rare races (config change, WebView reload) it can
 * re-emit `pushNotificationActionPerformed` for the same notification id. We
 * keep a bounded set so a redelivered tap can't loop-navigate.
 */
const processedNotificationIds = new Set<string>()
const PROCESSED_ID_MAX = 50

function markProcessed(id: string): boolean {
  if (processedNotificationIds.has(id)) return false
  processedNotificationIds.add(id)
  if (processedNotificationIds.size > PROCESSED_ID_MAX) {
    const first = processedNotificationIds.values().next().value
    if (first) processedNotificationIds.delete(first)
  }
  return true
}

/**
 * Call once from the root component so that notification taps can navigate
 * inside the app instead of opening Chrome.
 */
export function registerNativePushNavigation(navigate: (path: string) => void): void {
  navigateFn = navigate
  // Flush a path captured from a cold-start tap before the router existed.
  if (pendingPath) {
    const path = pendingPath
    pendingPath = null
    queueMicrotask(() => {
      try {
        navigate(path)
      } catch (err) {
        if (import.meta.env.DEV) console.warn('[native push] deferred navigate failed', err)
      }
    })
  }
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

/**
 * Convert any incoming notification target (relative path or full URL) into a
 * safe in-app path.  Returning a full URL with a different origin would cause
 * React Router to no-op (or, worse, the WebView to navigate cross-origin and
 * spawn Chrome on Android — the exact crash-loop the user reported).
 */
function sanitizeInAppTarget(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length === 0) return null
  // Block protocol handlers that would launch external apps.
  if (/^(?:javascript|data|blob|file|mailto|tel|sms|intent):/i.test(raw)) return null
  // Already a clean in-app path.
  if (raw.startsWith('/')) return raw
  try {
    const base = typeof window !== 'undefined' && window.location
      ? window.location.origin
      : 'http://localhost'
    const u = new URL(raw, base)
    // Only http(s) targets are forwarded — everything else is unsafe.
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return `${u.pathname || '/'}${u.search}${u.hash}`
  } catch {
    return null
  }
}

/** Resolve notification data to an in-app path. */
function resolveNotificationPath(data: Record<string, unknown> | undefined): string {
  if (!data) return '/'
  const fromUrl = sanitizeInAppTarget(data.url)
  if (fromUrl) return fromUrl
  const fromCta = sanitizeInAppTarget(data.ctaUrl)
  if (fromCta) return fromCta
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

/**
 * Tear down any service worker that may have been registered by a previous
 * build of the app while running inside the Capacitor WebView.  An orphaned
 * SW's `notificationclick` handler can still call `clients.openWindow()` after
 * an upgrade — which on Android boots Chrome and leaves the user trapped in a
 * crash loop.  Best-effort and silent on failure.
 */
async function cleanupStaleServiceWorkers(): Promise<void> {
  try {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    const regs = await navigator.serviceWorker.getRegistrations().catch(() => [])
    await Promise.all((regs || []).map((r) => r.unregister().catch(() => false)))
  } catch {
    /* ignore */
  }
}

export async function registerNativePushForCurrentUser(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  // Remove any leftover SW registration from older builds before wiring listeners.
  await cleanupStaleServiceWorkers()
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
          try {
            const notification = action?.notification
            const data = notification?.data as Record<string, unknown> | undefined
            // Prefer FCM's message id (stable across replays) with an id fallback
            // so we can drop a redelivered tap that would otherwise re-navigate.
            const messageId =
              (data?.['google.message_id'] as string | undefined) ||
              (notification?.id as string | undefined) ||
              null
            if (messageId && !markProcessed(messageId)) return

            const path = resolveNotificationPath(data)
            // Buffer the path if the router navigator hasn't registered yet.
            // On a cold-start tap the push plugin fires before App.tsx mounts
            // `CapacitorLinkBridge`, which is when navigateFn is populated.
            if (!navigateFn) {
              pendingPath = path
              return
            }
            // Defer to the next microtask so we never re-enter React Router
            // mid-render if the tap arrives while it's still mounting.
            queueMicrotask(() => {
              try {
                if (navigateFn) navigateFn(path)
              } catch (navErr) {
                if (import.meta.env.DEV) console.warn('[native push] navigate failed', navErr)
              }
            })
          } catch (e) {
            if (import.meta.env.DEV) console.warn('[native push] action handler failed', e)
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
