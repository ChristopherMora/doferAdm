const CACHE_NAME = 'dofer-bazar-shell-v1'
const BAZAR_PATH = '/dashboard/bazar'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((key) => key.startsWith('dofer-bazar-shell-') && key !== CACHE_NAME)
              .map((key) => caches.delete(key)),
          ),
        ),
    ]),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && url.pathname.startsWith(BAZAR_PATH)) {
            const copy = response.clone()
            void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(async () => {
          const exact = await caches.match(request)
          if (exact) return exact
          const bazarShell = await caches.match(BAZAR_PATH)
          return bazarShell || Response.error()
        }),
    )
    return
  }

  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/_next/image') ||
    /\.(?:css|js|png|jpg|jpeg|webp|gif|ico|woff2?)$/i.test(url.pathname)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone()
            void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          }
          return response
        })
      }),
    )
  }
})
