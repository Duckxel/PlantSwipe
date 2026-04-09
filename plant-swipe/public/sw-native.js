/* Minimal service worker for Capacitor native: PushManager + notificationclick only.
   No precache — avoids conflicting with bundled assets. */
self.addEventListener('install', () => {
  self.skipWaiting()
})
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})
self.addEventListener('push', (event) => {
  let payload = {}
  if (event.data) {
    try {
      payload = event.data.json()
    } catch {
      payload = { title: 'Aphylia', body: event.data.text() }
    }
  }
  const title = payload.title || 'Aphylia'
  const options = {
    body: payload.body || '',
    data: payload.data || {},
    tag: payload.tag || 'aphylia',
  }
  event.waitUntil(self.registration.showNotification(title, options))
})
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification?.data?.url || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client && client.url) {
          client.focus()
          client.navigate?.(url)
          return
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    }),
  )
})
