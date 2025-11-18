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

clientsClaim()

self.addEventListener('activate', (event) => {
  if (self.registration.navigationPreload) {
    event.waitUntil(self.registration.navigationPreload.enable())
  }
})

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

const appShellUrl = new URL('index.html', self.registration.scope)

const pageStrategy = new NetworkFirst({
  cacheName: 'pages-cache',
  networkTimeoutSeconds: 5,
  plugins: [
    new CacheableResponsePlugin({ statuses: [0, 200] }),
    new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 }),
  ],
})

warmStrategyCache({
  urls: [appShellUrl.pathname],
  strategy: pageStrategy,
})

registerRoute(
  ({ request, url }) => request.mode === 'navigate' && !/\/api\//.test(url.pathname),
  pageStrategy
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
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
)

registerRoute(
  ({ request }) => request.destination === 'image',
  new StaleWhileRevalidate({
    cacheName: 'image-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 14 }),
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
  pageFallback: '/offline.html',
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
