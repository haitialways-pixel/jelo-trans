'use client'

import { useEffect } from 'react'

const SW_URL = '/manager/sw.js'
const SW_SCOPE = '/manager/'

/**
 * Registers the manager-scoped service worker (installable PWA).
 * Safe to mount on login + dashboard; no-ops when unsupported.
 */
export function ManagerPwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    // Only register while the user is on a manager URL
    if (!window.location.pathname.startsWith('/manager')) return

    let cancelled = false

    async function register() {
      try {
        const reg = await navigator.serviceWorker.register(SW_URL, {
          scope: SW_SCOPE,
          updateViaCache: 'none',
        })

        if (cancelled) return

        // Check for updates when the tab becomes visible again
        const onVisible = () => {
          if (document.visibilityState === 'visible') {
            reg.update().catch(() => {})
          }
        }
        document.addEventListener('visibilitychange', onVisible)

        // If a new worker is waiting, activate it on next load cycle
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' })
        }

        reg.addEventListener('updatefound', () => {
          const worker = reg.installing
          if (!worker) return
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version ready — activate on next navigation
              worker.postMessage({ type: 'SKIP_WAITING' })
            }
          })
        })

        return () => {
          document.removeEventListener('visibilitychange', onVisible)
        }
      } catch (err) {
        console.warn('[manager-pwa] service worker registration failed:', err)
      }
    }

    const cleanupPromise = register()

    return () => {
      cancelled = true
      void cleanupPromise.then((cleanup) => cleanup?.())
    }
  }, [])

  return null
}
