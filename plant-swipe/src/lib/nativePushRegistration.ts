/**
 * Capacitor: FCM/APNs notification pipeline.
 *
 * Push is critical — a missed watering reminder can kill a user's plants — so
 * this module is structured so that every delivery path survives the worst
 * conditions we've seen in production:
 *
 *   1. Listeners are attached at app boot (`initializeNativePushListeners`)
 *      regardless of auth state.  Capacitor's plugin queues any retained
 *      `pushNotificationActionPerformed` events until a listener shows up, so
 *      attaching early guarantees cold-start taps are never dropped.
 *   2. A tap that arrives before React mounts is buffered in memory AND
 *      persisted to `localStorage`, so even a crash between the tap and the
 *      first render still routes the user to the right screen on the next
 *      launch.
 *   3. FCM token uploads retry with exponential backoff (network drop during
 *      first launch is common) and the token is cached so we can re-post on
 *      the next online session.
 *   4. A dedicated Android notification channel is provisioned on init so
 *      reminders can bypass Doze and show even under battery-optimised
 *      defaults.
 *   5. Foreground pushes are still surfaced — Android suppresses the system
 *      notification UI when the app is visible, so we re-emit the payload to
 *      the rest of the app via a `plantswipe:push-received` DOM event.
 *
 * Native push uses @capacitor/push-notifications exclusively — no web service
 * worker is ever registered inside the Capacitor WebView (see
 * MainActivity.java and src/sw.ts for the belt-and-braces blockers).
 */
import { Capacitor } from '@capacitor/core'
import { supabase } from '@/lib/supabaseClient'

/** Last FCM/APNs token the plugin handed us — used for unregister + retry. */
export let lastNativePushToken: string | null = null

let navigateFn: ((path: string) => void) | null = null

/** In-memory buffer for a tap whose path hasn't been consumed by the router yet. */
let pendingPath: string | null = null

/** Memo flags so repeated calls during render don't reattach listeners. */
let listenersInitialized = false
let pushRegisteredForUser = false

const PENDING_TAP_KEY = 'plantswipe.push.pendingTap'
const PENDING_TAP_TTL_MS = 10 * 60 * 1000 // 10 minutes — enough for a crash-restart
const FCM_TOKEN_CACHE_KEY = 'plantswipe.push.lastFcmToken'
const ANDROID_CHANNEL_ID = 'aphylia_priority'

/**
 * De-duplicate tap events. Android's push plugin reads the FCM extras during
 * bridge init, but in rare races (config change, WebView reload) it can
 * re-emit `pushNotificationActionPerformed` for the same notification id.
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

function safeLocalStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    return null
  }
}

function savePendingTapPath(path: string): void {
  if (!path || !path.startsWith('/')) return
  const store = safeLocalStorage()
  if (!store) return
  try {
    store.setItem(PENDING_TAP_KEY, JSON.stringify({ path, ts: Date.now() }))
  } catch {
    /* storage quota / privacy mode */
  }
}

function consumePendingTapPath(): string | null {
  const store = safeLocalStorage()
  if (!store) return null
  try {
    const raw = store.getItem(PENDING_TAP_KEY)
    if (!raw) return null
    store.removeItem(PENDING_TAP_KEY)
    const parsed = JSON.parse(raw) as { path?: unknown; ts?: unknown }
    const path = typeof parsed?.path === 'string' ? parsed.path : ''
    const ts = typeof parsed?.ts === 'number' ? parsed.ts : 0
    if (!path.startsWith('/')) return null
    // Expired taps are dropped so a user who ignored a stale notification
    // isn't teleported out of the home screen on their next launch.
    if (Date.now() - ts > PENDING_TAP_TTL_MS) return null
    return path
  } catch {
    try { store.removeItem(PENDING_TAP_KEY) } catch { /* ignore */ }
    return null
  }
}

function cacheFcmToken(token: string): void {
  const store = safeLocalStorage()
  if (!store) return
  try {
    store.setItem(FCM_TOKEN_CACHE_KEY, token)
  } catch {
    /* ignore */
  }
}

function readCachedFcmToken(): string | null {
  const store = safeLocalStorage()
  if (!store) return null
  try {
    const v = store.getItem(FCM_TOKEN_CACHE_KEY)
    return v && v.length > 0 ? v : null
  } catch {
    return null
  }
}

/**
 * POST the FCM/APNs token to the server with bounded exponential backoff.
 * Network on cold-launch mobile is unreliable — a single miss historically
 * meant the server never learned about the device, so push never arrived.
 */
async function postFcmToken(token: string, attempt = 0): Promise<void> {
  const MAX_ATTEMPTS = 6
  try {
    const session = (await supabase.auth.getSession()).data.session
    const auth = session?.access_token
    // No session yet? Cache the token and retry when the user signs in.
    if (!auth || !token) {
      cacheFcmToken(token)
      return
    }
    const res = await fetch('/api/push/fcm-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth}` },
      credentials: 'same-origin',
      body: JSON.stringify({ token, platform: Capacitor.getPlatform() }),
    })
    if (!res.ok) throw new Error(`http ${res.status}`)
    cacheFcmToken(token)
  } catch (err) {
    if (attempt >= MAX_ATTEMPTS) {
      // Keep the token cached so we can retry on the next successful launch.
      cacheFcmToken(token)
      if (import.meta.env.DEV) console.warn('[native push] token post gave up', err)
      return
    }
    const delayMs = Math.min(1000 * Math.pow(2, attempt), 30_000)
    setTimeout(() => { void postFcmToken(token, attempt + 1) }, delayMs)
  }
}

/**
 * Convert any incoming notification target (relative path or full URL) into a
 * safe in-app path.  Returning a full URL with a different origin would cause
 * React Router to no-op (or, worse, the WebView to navigate cross-origin and
 * spawn Chrome on Android — the exact crash-loop this module exists to stop).
 */
function sanitizeInAppTarget(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length === 0) return null
  // Block protocol handlers that would launch external apps.
  if (/^(?:javascript|data|blob|file|mailto|tel|sms|intent):/i.test(raw)) return null
  if (raw.startsWith('/')) return raw
  try {
    const base = typeof window !== 'undefined' && window.location
      ? window.location.origin
      : 'http://localhost'
    const u = new URL(raw, base)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return `${u.pathname || '/'}${u.search}${u.hash}`
  } catch {
    return null
  }
}

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
 * Clear any service worker the WebView may have inherited from a previous
 * build.  Belt-and-braces alongside the Android `ServiceWorkerController`
 * reject-all client installed in MainActivity.java.
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

function dispatchNavigate(path: string): void {
  if (!path || !path.startsWith('/')) return
  if (!navigateFn) {
    // Router hasn't mounted yet — stash in memory AND localStorage so a
    // crash between here and the first render still recovers on next launch.
    pendingPath = path
    savePendingTapPath(path)
    return
  }
  // Defer to the next microtask so we never re-enter React Router
  // mid-render if the tap arrives while it's still mounting.
  queueMicrotask(() => {
    try {
      if (navigateFn) navigateFn(path)
    } catch (navErr) {
      // Navigation failed — persist the path so the next (hopefully cleaner)
      // launch can retry.  Better to ship the user late than never.
      savePendingTapPath(path)
      if (import.meta.env.DEV) console.warn('[native push] navigate failed', navErr)
    }
  })
}

function emitReceivedEvent(detail: Record<string, unknown>): void {
  try {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new CustomEvent('plantswipe:push-received', { detail }))
  } catch {
    /* ignore */
  }
}

/**
 * Called by the React root once the Router is mounted.  Flushes any path we
 * captured from a cold-start tap (from memory first, then from localStorage
 * for crash-recovery).
 */
export function registerNativePushNavigation(navigate: (path: string) => void): void {
  navigateFn = navigate
  const inMemory = pendingPath
  pendingPath = null
  // Always drain the persisted marker here — even if we found an in-memory
  // path, a stale entry in storage would otherwise replay on the next cold
  // launch and teleport the user to an old target.
  const persisted = consumePendingTapPath()
  const path = inMemory || persisted
  if (!path) return
  queueMicrotask(() => {
    try {
      navigate(path)
    } catch (err) {
      // Navigation blew up — re-persist so the next launch can retry.
      savePendingTapPath(path)
      if (import.meta.env.DEV) console.warn('[native push] deferred navigate failed', err)
    }
  })
}

async function ensureAndroidNotificationChannel(
  PushNotifications: typeof import('@capacitor/push-notifications').PushNotifications,
): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return
  try {
    // @capacitor/push-notifications v8 exposes createChannel on Android only.
    // Idempotent: the OS reuses an existing channel with the same id, we just
    // (re)upsert the metadata.  Missing channel = many OEMs silently drop the
    // notification on Android 8+.
    const api = PushNotifications as unknown as {
      createChannel?: (opts: Record<string, unknown>) => Promise<void>
    }
    if (typeof api.createChannel !== 'function') return
    await api.createChannel({
      id: ANDROID_CHANNEL_ID,
      name: 'Reminders & messages',
      description: 'Plant care reminders, friend activity, and direct messages',
      importance: 4, // IMPORTANCE_HIGH — heads-up + sound + vibration
      visibility: 1, // VISIBILITY_PUBLIC
      sound: 'default',
      lights: true,
      lightColor: '#22c55e',
      vibration: true,
    })
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[native push] channel setup failed', err)
  }
}

/**
 * Attach the three push listeners as early as possible — before auth has
 * resolved.  Capacitor retains any `pushNotificationActionPerformed` emitted
 * during bridge init until a listener shows up, so doing this on app boot
 * guarantees that cold-start taps route correctly even for a logged-out
 * user (they land on `/` instead of disappearing).
 */
export async function initializeNativePushListeners(): Promise<void> {
  if (!Capacitor.isNativePlatform() || listenersInitialized) return
  listenersInitialized = true

  try {
    await cleanupStaleServiceWorkers()
    const mod = await import('@capacitor/push-notifications')
    const { PushNotifications } = mod
    await ensureAndroidNotificationChannel(PushNotifications)

    await PushNotifications.addListener('registration', (ev) => {
      const tok = ev?.value
      if (!tok) return
      lastNativePushToken = tok
      void postFcmToken(tok)
    })

    await PushNotifications.addListener('registrationError', (err) => {
      if (import.meta.env.DEV) console.warn('[native push] registration error', err)
    })

    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      // Foreground delivery: Android suppresses the system tray UI while the
      // app is visible, so we surface the payload to the rest of the app and
      // let UI code decide what to do (toast, badge, list refresh, …).
      try {
        const data = (notification?.data || {}) as Record<string, unknown>
        emitReceivedEvent({
          title: notification?.title,
          body: notification?.body,
          data,
        })
      } catch (e) {
        if (import.meta.env.DEV) console.warn('[native push] received handler failed', e)
      }
    })

    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      try {
        const notification = action?.notification
        const data = notification?.data as Record<string, unknown> | undefined
        const messageId =
          (data?.['google.message_id'] as string | undefined) ||
          (notification?.id as string | undefined) ||
          null
        if (messageId && !markProcessed(messageId)) return
        dispatchNavigate(resolveNotificationPath(data))
      } catch (e) {
        if (import.meta.env.DEV) console.warn('[native push] action handler failed', e)
      }
    })
  } catch (e) {
    if (import.meta.env.DEV) console.warn('[native push] listener init failed', e)
    // Reset so a subsequent call can retry — don't leave the app in a silent
    // "notifications are broken" state if the first import failed transiently.
    listenersInitialized = false
  }
}

/**
 * Register the device with FCM/APNs and upload the token for the signed-in
 * user.  Called from AuthContext after auth resolves.  Safe to call multiple
 * times — the plugin dedupes its own registration internally.
 */
export async function registerNativePushForCurrentUser(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  // Listeners must be attached before `register()` fires an event.
  await initializeNativePushListeners()

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')

    const perm = await PushNotifications.checkPermissions()
    if (perm.receive !== 'granted') {
      const req = await PushNotifications.requestPermissions()
      if (req.receive !== 'granted') return
    }
    await PushNotifications.register()
    pushRegisteredForUser = true

    // If we cached a token earlier (e.g. before the user signed in) push it
    // to the server now that we have a session.
    const cached = readCachedFcmToken()
    if (cached) {
      lastNativePushToken = cached
      void postFcmToken(cached)
    }
  } catch (e) {
    if (import.meta.env.DEV) console.warn('[native push] setup failed', e)
    pushRegisteredForUser = false
  }
}

/** Exposed for diagnostics / settings UI. */
export function isNativePushRegisteredForUser(): boolean {
  return pushRegisteredForUser
}
