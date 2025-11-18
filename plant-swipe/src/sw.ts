/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { CacheFirst, NetworkFirst, NetworkOnly, StaleWhileRevalidate } from 'workbox-strategies'
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

const buildMeta: BuildMeta = {
  version: import.meta.env.VITE_APP_VERSION ?? 'dev',
  commit: import.meta.env.VITE_COMMIT_SHA || undefined,
}

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
  if (self.registration.navigationPreload) {
    tasks.push(self.registration.navigationPreload.enable())
  }
  tasks.push(
    broadcastMessage({
      type: 'SW_ACTIVATED',
      meta: buildMeta,
    })
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
    new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 }),
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
  async ({ event, request }) => {
    const navEvent = event as FetchEvent
    if (self.registration.navigationPreload) {
      try {
        const preloadResponse = await navEvent.preloadResponse
        if (preloadResponse) return preloadResponse
      } catch {
        // ignore preload failures and fall back to strategy
      }
    }
    return pageStrategy.handle({ event: navEvent, request })
  }
)

registerRoute(
  ({ url }) => /\/api\/.+\/stream/.test(url.pathname),
  new NetworkOnly()
)

registerRoute(
  ({ url }) => url.pathname.startsWith('/api/') && !/\/stream/.test(url.pathname),
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 10,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 5 }),
    ],
  })
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
      new ExpirationPlugin({ maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 60 }),
    ],
  })
)

registerRoute(
  ({ request }) => request.destination === 'image',
  new StaleWhileRevalidate({
    cacheName: 'image-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 }),
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
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 }),
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
