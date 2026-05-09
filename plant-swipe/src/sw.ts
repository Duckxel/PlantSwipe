/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { ExpirationPlugin } from 'workbox-expiration'
import { offlineFallback, warmStrategyCache } from 'workbox-recipes'

/* eslint-disable @typescript-eslint/no-explicit-any -- service worker dynamic data */
declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{
    url: string
    revision: string | null
  }>
}

type BuildMeta = {
  version: string
  commit?: string
}

type NotificationActionOption = {
  action: string
  title: string
  icon?: string
}

type ExtendedNotificationOptions = NotificationOptions & {
  actions?: NotificationActionOption[]
  vibrate?: number[]
  renotify?: boolean
  image?: string
}

const buildMeta: BuildMeta = {
  version: import.meta.env.VITE_APP_VERSION ?? 'dev',
  commit: import.meta.env.VITE_COMMIT_SHA || undefined,
}

const DAY_IN_SECONDS = 60 * 60 * 24
const YEAR_IN_SECONDS = DAY_IN_SECONDS * 365
/** Suffix Workbox cache names with app version so a new release does not read stale entries from an old SW. */
const cacheSuffix = String(import.meta.env.VITE_APP_VERSION ?? 'dev').replace(/[^a-zA-Z0-9._-]+/g, '_')
const v = (name: string) => `${name}-v${cacheSuffix}`

const broadcastMessage = async (payload: { type: string; meta?: BuildMeta }) => {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  for (const client of clients) {
    client.postMessage({
      source: 'aphylia-sw',
      ...payload,
    })
  }
}

const resolveScopedPath = (pathname: string) => {
  const normalized = pathname.startsWith('/') ? pathname.slice(1) : pathname
  return new URL(normalized || '.', self.registration.scope).pathname
}

const offlinePagePath = new URL('offline.html', self.registration.scope).pathname
const offlineImagePath = new URL('icons/icon-192x192.png', self.registration.scope).pathname
const scopeBasePath = new URL('.', self.registration.scope).pathname
// Status-bar badge for push notifications. MUST be a white silhouette on a transparent
// background — Android and iOS tint this icon and replace anything non-monochrome with a
// generic white circle (which is why the colored icon-192x192.png produced the white
// circle bug). notification-badge.png is deployed by setup.sh from assets/logo-dark.png.
const notificationBadgeUrl = new URL('icons/notification-badge.png', self.registration.scope).href
// Body icon for push notifications — the LARGE icon shown inside the notification
// (not the status bar). This one *should* be the full-color brand mark; an empty/
// transparent value here causes Chrome to fall back to a generic bell. icon.png
// is deployed by setup.sh / scripts/sync-brand-assets.mjs from assets/icon.png.
const notificationIconUrl = new URL('icons/icon.png', self.registration.scope).href
const defaultNotificationTarget = new URL('.', self.registration.scope).href

/**
 * A stale copy of this worker can persist inside an Android Capacitor WebView
 * after an app upgrade. Its `notificationclick` used to call
 * `clients.openWindow()`, which in a WebView dispatches ACTION_VIEW to the
 * system browser and boots the user out of the native shell. When we detect
 * we're running under a Capacitor-like origin (localhost), we keep the worker
 * idle for push handling and let `@capacitor/push-notifications` do the work.
 */
const isCapacitorLikeOrigin = (() => {
  try {
    const host = self.location.hostname.toLowerCase()
    return host === 'localhost' || host === '127.0.0.1' || host === '::1'
  } catch {
    return false
  }
})()

const resolveNotificationUrl = (target?: string | null) => {
  if (!target) return defaultNotificationTarget
  try {
    return new URL(target, self.location.origin).href
  } catch {
    try {
      return new URL(target, self.registration.scope).href
    } catch {
      return defaultNotificationTarget
    }
  }
}

clientsClaim()

self.addEventListener('install', (event) => {
  const isUpdate = Boolean(self.registration?.active)
  if (!isUpdate) return
  event.waitUntil(
    broadcastMessage({
      type: 'SW_UPDATE_FOUND',
      meta: buildMeta,
    })
  )
})

self.addEventListener('activate', (event) => {
  const tasks: Array<Promise<unknown>> = []
  if (self.registration?.navigationPreload) {
    try {
      tasks.push(self.registration.navigationPreload.disable().catch(() => undefined))
    } catch {
      /* ignore */
    }
  }
  // Drop runtime caches from older releases (cleanupOutdatedCaches only clears precache revision names).
  const versionedRuntimePrefixes = [
    'pages-cache-v',
    'i18n-cache-v',
    'static-assets-v',
    'image-cache-v',
    'font-cache-v',
    'supabase-read-v',
  ]
  const legacyRuntimeNames = new Set([
    'pages-cache',
    'i18n-cache',
    'static-assets',
    'image-cache',
    'font-cache',
    'workbox-offline-fallbacks',
  ])
  const currentVersionTag = `-v${cacheSuffix}`
  tasks.push(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (legacyRuntimeNames.has(key)) return caches.delete(key)
            const isOurs = versionedRuntimePrefixes.some((p) => key.startsWith(p))
            if (isOurs && !key.endsWith(currentVersionTag)) return caches.delete(key)
            return Promise.resolve(false)
          }),
        ),
      )
      .catch(() => undefined),
  )
  tasks.push(
    broadcastMessage({
      type: 'SW_ACTIVATED',
      meta: buildMeta,
    }),
  )
  event.waitUntil(Promise.all(tasks))
})

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

const appShellUrl = new URL('index.html', self.registration.scope)
const criticalRoutes = [
  '/',
  '/swipe',
  '/gardens',
  '/download',
  '/friends',
  '/settings',
  '/about',
  // French language routes (PWA users may install from French locale)
  '/fr/swipe',
  '/fr/gardens',
  '/fr/download',
  '/fr/friends',
  '/fr/settings',
  '/fr/about',
  offlinePagePath,
]

const pageStrategy = new NetworkFirst({
  cacheName: v('pages-cache'),
  networkTimeoutSeconds: 5,
  plugins: [
    new CacheableResponsePlugin({ statuses: [0, 200] }),
    new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: DAY_IN_SECONDS * 7 }),
  ],
})

warmStrategyCache({
  urls: Array.from(
    new Set([appShellUrl.pathname, ...criticalRoutes.map(resolveScopedPath)])
  ),
  strategy: pageStrategy,
})

registerRoute(
  ({ request, url }) => request.mode === 'navigate' && !/\/api\//.test(url.pathname),
  pageStrategy
)

registerRoute(
  ({ url }) => /\/locales\/.*\.json/i.test(url.pathname),
  new NetworkFirst({
    cacheName: v('i18n-cache'),
    networkTimeoutSeconds: 3,
    plugins: [
      new ExpirationPlugin({ maxEntries: 40, maxAgeSeconds: DAY_IN_SECONDS * 7 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
)

registerRoute(
  ({ request, url }) => {
    // Only intercept SAME-ORIGIN script/style/worker. Cross-origin scripts
    // (GTM, reCAPTCHA, etc.) must pass through to the network: an SW fetch is
    // governed by connect-src, so caching them here would force every
    // third-party host to be enumerated there — and a missing entry blocks
    // the script intermittently (only after SW activation + on cache miss).
    const destinations = ['style', 'script', 'worker']
    if (destinations.includes(request.destination)) {
      return url.origin === self.location.origin
    }
    if (request.destination || request.mode === 'navigate') return false
    const assetsPrefix = `${scopeBasePath}assets/`
    return url.origin === self.location.origin && url.pathname.startsWith(assetsPrefix)
  },
  new CacheFirst({
    cacheName: v('static-assets'),
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 120, maxAgeSeconds: YEAR_IN_SECONDS }),
    ],
  })
)

// Only cache images from same-origin or known safe domains
// External images (e.g., third-party plant photos) are not cached to avoid CSP violations
const allowedImageOrigins = [
  self.location.origin,
  'https://media.aphylia.app',
  '[REDACTED]',
]

registerRoute(
  ({ request, url }) => {
    if (request.destination !== 'image') return false
    // Only cache images from allowed origins
    return allowedImageOrigins.some(origin => url.href.startsWith(origin))
  },
  new StaleWhileRevalidate({
    cacheName: v('image-cache'),
    plugins: [
      new ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: DAY_IN_SECONDS * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
)

registerRoute(
  ({ request }) => request.destination === 'font',
  new CacheFirst({
    cacheName: v('font-cache'),
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: YEAR_IN_SECONDS }),
    ],
  })
)

// Cache read-only Supabase REST/Storage requests so the app has something to
// show on flaky mobile networks. Only caches GETs, and never the auth/realtime
// endpoints where a stale response would break login or subscriptions.
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL as string | undefined
let supabaseOrigin: string | null = null
try {
  if (supabaseUrl) supabaseOrigin = new URL(supabaseUrl).origin
} catch {
  supabaseOrigin = null
}

registerRoute(
  ({ request, url }) => {
    if (request.method !== 'GET') return false
    if (!supabaseOrigin || url.origin !== supabaseOrigin) return false
    // Skip auth, realtime, and functions — these must always hit the network.
    if (url.pathname.startsWith('/auth/')) return false
    if (url.pathname.startsWith('/realtime/')) return false
    if (url.pathname.startsWith('/functions/')) return false
    // Cache REST reads and public storage reads.
    return (
      url.pathname.startsWith('/rest/') ||
      url.pathname.startsWith('/storage/v1/object/public/')
    )
  },
  new NetworkFirst({
    cacheName: v('supabase-read'),
    networkTimeoutSeconds: 4,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: DAY_IN_SECONDS * 14 }),
    ],
  }),
)

offlineFallback({
  pageFallback: offlinePagePath,
  imageFallback: offlineImagePath,
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
    return
  }
  if (event.data && event.data.type === 'SW_CLIENT_READY') {
    if (event.source && 'postMessage' in event.source) {
      ;(event.source as Client).postMessage({
        source: 'aphylia-sw',
        type: 'SW_ACTIVATED',
        meta: buildMeta,
      })
    }
  }
})

self.addEventListener('push', (event) => {
  // Capacitor Android: a stale SW registration survives app upgrades; the
  // native plugin will display and route the notification, so silently drop
  // the push here instead of spawning a second UI the user can't dismiss.
  if (isCapacitorLikeOrigin) return
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return
  }
  let payload: any = {}
  if (event.data) {
    let raw: string | undefined
    try {
      raw = event.data.text()
    } catch {
      raw = undefined
    }
    if (raw && raw.length) {
      try {
        payload = JSON.parse(raw)
      } catch {
        payload = { body: raw }
      }
    }
  }
  const title = typeof payload.title === 'string' && payload.title.length ? payload.title : 'Aphylia'
  const data = payload.data && typeof payload.data === 'object' ? payload.data : {}
  
  // Determine if this is a message notification
  const isMessageNotification = (data as any)?.type === 'new_message' || 
    (typeof payload.tag === 'string' && payload.tag.startsWith('message-'))
  
  const options: ExtendedNotificationOptions = {
    body: typeof payload.body === 'string' ? payload.body : undefined,
    tag:
      typeof payload.tag === 'string' && payload.tag.length
        ? payload.tag
        : (data as any)?.campaignId || 'aphylia',
    data,
    // Small icon for status bar (monochrome on most devices)
    badge: typeof payload.badge === 'string' && payload.badge.length ? payload.badge : notificationBadgeUrl,
    // Large icon shown inside the notification body. Falling back to a transparent
    // 1x1 PNG used to make Chrome render its default bell — point at the full-color
    // brand icon instead.
    icon: typeof payload.icon === 'string' && payload.icon.length ? payload.icon : notificationIconUrl,
  }
  
  // Add actions for notifications (skip for messages - just tap to open conversation)
  if (!isMessageNotification && Array.isArray(payload.actions) && payload.actions.length) {
    const normalizedActions = payload.actions
      .map((action: any, index: number) => {
        if (!action) return null
        const actionId =
          (typeof action.action === 'string' && action.action.length && action.action) ||
          (typeof action.id === 'string' && action.id.length && action.id) ||
          `action-${index}`
        const actionTitle =
          (typeof action.title === 'string' && action.title.length && action.title) ||
          'Open'
        const icon = typeof action.icon === 'string' && action.icon.length ? action.icon : undefined
        return { action: actionId, title: actionTitle, icon }
      })
      .filter((entry: NotificationActionOption | null): entry is NotificationActionOption => Boolean(entry))
    if (normalizedActions.length) {
      options.actions = normalizedActions.slice(0, 3)
    }
  }
  
  if (Array.isArray(payload.vibrate)) {
    options.vibrate = payload.vibrate
  } else {
    // Use different vibration pattern for messages
    options.vibrate = isMessageNotification ? [200, 100, 200] : [100, 50, 100]
  }
  if (typeof payload.requireInteraction === 'boolean') {
    options.requireInteraction = payload.requireInteraction
  }
  if (typeof payload.renotify === 'boolean') {
    options.renotify = payload.renotify
  } else if (isMessageNotification) {
    // Always renotify for new messages to ensure they're seen
    options.renotify = true
  }
  if (typeof payload.image === 'string' && payload.image.length) {
    options.image = payload.image
  }
  if (typeof payload.silent === 'boolean') {
    options.silent = payload.silent
  }
  
  // Broadcast to open clients for in-app notification
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      // Notify open windows about the new message
      broadcastMessage({
        type: isMessageNotification ? 'NEW_MESSAGE' : 'PUSH_RECEIVED',
        meta: buildMeta,
      })
    ])
  )
})

self.addEventListener('notificationclick', (event) => {
  // See `isCapacitorLikeOrigin` above: inside the native shell,
  // `clients.openWindow()` would dispatch an ACTION_VIEW intent that launches
  // Chrome and crashes the Capacitor app. Close and bail — the native plugin
  // owns tap routing.
  if (isCapacitorLikeOrigin) {
    event.notification?.close()
    return
  }
  const notificationData = (event.notification?.data || {}) as {
    ctaUrl?: string
    url?: string
    conversationId?: string
    type?: string
  }
  const action = event.action

  // Handle dismiss action - just close the notification
  if (action === 'dismiss') {
    event.notification?.close()
    return
  }

  // Close notification first
  event.notification?.close()
  
  // Determine the target URL based on notification type
  let target: string
  
  // First, try to use the URL from the notification data
  if (notificationData.url || notificationData.ctaUrl) {
    target = resolveNotificationUrl(notificationData.url || notificationData.ctaUrl)
  } 
  // Fallback: route based on notification type
  else if (notificationData.type === 'new_message' && notificationData.conversationId) {
    target = resolveNotificationUrl(`/messages?conversation=${notificationData.conversationId}`)
  } else if (notificationData.type === 'friend_request' || notificationData.type === 'friend_request_accepted') {
    target = resolveNotificationUrl('/friends')
  } else if (notificationData.type === 'garden_invite' || notificationData.type === 'garden_invite_accepted') {
    target = resolveNotificationUrl('/gardens')
  } else if (notificationData.type === 'daily_task_reminder' || notificationData.type === 'task_reminder') {
    target = resolveNotificationUrl('/gardens')
  } else if (notificationData.type === 'journal_continue_reminder') {
    target = resolveNotificationUrl('/gardens')
  } else if (notificationData.type === 'weekly_inactive_reminder') {
    target = resolveNotificationUrl('/discovery')
  } else if (notificationData.conversationId) {
    target = resolveNotificationUrl(`/messages?conversation=${notificationData.conversationId}`)
  } else {
    // Default to home page
    target = resolveNotificationUrl('/')
  }
  
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })

      // Try to find an existing window to focus and navigate
      for (const client of allClients) {
        if ('focus' in client && 'navigate' in client) {
          try {
            const windowClient = client as WindowClient
            await windowClient.focus()
            await windowClient.navigate(target)
            return
          } catch {
            // focus() or navigate() can fail on some browsers/PWAs —
            // fall through to openWindow() below
          }
        }
      }

      // No usable existing window — open a new one
      try {
        if (self.clients.openWindow) {
          await self.clients.openWindow(target)
        }
      } catch {
        // Last resort: ignore — notification was already closed
      }
    })(),
  )
})
