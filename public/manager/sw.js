/* Imperial Odyssey Manager — service worker
 *
 * Scope: /manager only (file lives under /manager/).
 * Strategy for an authenticated admin console:
 *  - Never cache mutating requests (POST/PUT/PATCH/DELETE) or Server Actions
 *  - Never cache login HTML or Supabase / API-ish traffic
 *  - Network-first for navigations (fresh auth/session pages)
 *  - Cache-first only for local PWA shell assets (icons, offline page, manifest)
 *  - Offline fallback page when a navigation fails
 */

const VERSION = 'io-manager-v1'
const SHELL_CACHE = `${VERSION}-shell`
const SHELL_URLS = [
  '/manager/offline.html',
  '/manager/manifest.webmanifest',
  '/manager/icons/icon-192.png',
  '/manager/icons/icon-512.png',
  '/manager/icons/icon-512-maskable.png',
  '/manager/icons/apple-touch-icon.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn('[manager-sw] precache failed', err)
        return self.skipWaiting()
      }),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('io-manager-') && key !== SHELL_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

function isShellAsset(url) {
  if (url.origin !== self.location.origin) return false
  const p = url.pathname
  return (
    p === '/manager/offline.html' ||
    p === '/manager/manifest.webmanifest' ||
    p === '/manager/sw.js' ||
    p.startsWith('/manager/icons/')
  )
}

function isLoginPath(url) {
  return url.pathname === '/manager/login' || url.pathname.startsWith('/manager/login/')
}

function isMutating(request) {
  const method = request.method.toUpperCase()
  if (method !== 'GET' && method !== 'HEAD') return true
  // Next.js Server Actions
  if (request.headers.has('Next-Action') || request.headers.has('next-action')) return true
  const accept = request.headers.get('accept') || ''
  if (accept.includes('text/x-component')) return true
  return false
}

function isAuthOrApiTraffic(url) {
  const p = url.pathname
  // Never cache auth / backend traffic that may sit under manager scope
  if (p.startsWith('/api/')) return true
  if (p.includes('/auth/')) return true
  // Supabase and third-party hosts are already cross-origin and skipped below
  return false
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (!request || request.method === undefined) return

  let url
  try {
    url = new URL(request.url)
  } catch {
    return
  }

  // Only handle same-origin /manager scope
  if (url.origin !== self.location.origin) return
  if (!url.pathname.startsWith('/manager')) return

  // Always network for mutations, server actions, login, and API-like paths
  if (isMutating(request) || isLoginPath(url) || isAuthOrApiTraffic(url)) {
    event.respondWith(fetch(request))
    return
  }

  // PWA shell assets — cache-first
  if (isShellAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          if (response && response.ok) {
            const clone = response.clone()
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, clone))
          }
          return response
        })
      }),
    )
    return
  }

  // Navigations (HTML / RSC documents) — network-first, offline fallback
  const isNavigation =
    request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html')

  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then((response) => response)
        .catch(async () => {
          const offline = await caches.match('/manager/offline.html')
          return (
            offline ||
            new Response('Offline', {
              status: 503,
              headers: { 'Content-Type': 'text/plain' },
            })
          )
        }),
    )
    return
  }

  // Everything else under /manager (Next static chunks served from other paths
  // are outside scope) — network only to avoid stale authenticated UI.
  event.respondWith(fetch(request))
})

// Allow the page to request an immediate SW update
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
