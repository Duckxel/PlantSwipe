/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { ExpirationPlugin } from 'workbox-expiration'
import { offlineFallback, warmStrategyCache } from 'workbox-recipes'

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
const notificationIconUrl = new URL('icons/icon-192x192.png', self.registration.scope).href
const notificationBadgeUrl = new URL('icons/icon-96x96.png', self.registration.scope).href
const defaultNotificationTarget = new URL('.', self.registration.scope).href

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
  offlinePagePath,
]

const pageStrategy = new NetworkFirst({
  cacheName: 'pages-cache',
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
  ({ url }) => /\/locales\/.*\.json$/i.test(url.pathname),
  new StaleWhileRevalidate({
    cacheName: 'i18n-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 30 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
)

registerRoute(
  ({ request, url }) => {
    const destinations = ['style', 'script', 'worker']
    if (destinations.includes(request.destination)) return true
    if (request.destination || request.mode === 'navigate') return false
    const assetsPrefix = `${scopeBasePath}assets/`
    return url.origin === self.location.origin && url.pathname.startsWith(assetsPrefix)
  },
  new CacheFirst({
    cacheName: 'static-assets',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 120, maxAgeSeconds: YEAR_IN_SECONDS }),
    ],
  })
)

registerRoute(
  ({ request }) => request.destination === 'image',
  new StaleWhileRevalidate({
    cacheName: 'image-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: DAY_IN_SECONDS * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
)

registerRoute(
  ({ request }) => request.destination === 'font',
  new CacheFirst({
    cacheName: 'font-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: YEAR_IN_SECONDS }),
    ],
  })
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
  const options: ExtendedNotificationOptions = {
    body: typeof payload.body === 'string' ? payload.body : undefined,
    tag:
      typeof payload.tag === 'string' && payload.tag.length
        ? payload.tag
        : (data as any)?.campaignId || 'aphylia',
    data,
    icon: typeof payload.icon === 'string' && payload.icon.length ? payload.icon : notificationIconUrl,
    badge: typeof payload.badge === 'string' && payload.badge.length ? payload.badge : notificationBadgeUrl,
  }
  if (Array.isArray(payload.actions) && payload.actions.length) {
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
    options.vibrate = [100, 50, 100]
  }
  if (typeof payload.requireInteraction === 'boolean') {
    options.requireInteraction = payload.requireInteraction
  }
  if (typeof payload.renotify === 'boolean') {
    options.renotify = payload.renotify
  }
  if (typeof payload.image === 'string' && payload.image.length) {
    options.image = payload.image
  }
  if (typeof payload.silent === 'boolean') {
    options.silent = payload.silent
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  const notificationData = (event.notification?.data || {}) as { ctaUrl?: string; url?: string }
  const target = resolveNotificationUrl(notificationData.ctaUrl || notificationData.url)
  event.notification?.close()
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of allClients) {
        if ('focus' in client) {
          const windowClient = client as WindowClient
          const normalizedClientUrl = windowClient.url?.replace(/\/?$/, '/')
          const normalizedTarget = target.replace(/\/?$/, '/')
          if (normalizedClientUrl === normalizedTarget) {
            await windowClient.focus()
            return
          }
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(target)
      }
    })(),
  )
})
