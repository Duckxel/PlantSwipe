/**
 * Capacitor-only: hardware back (Android), minimal SW for native push, iOS swipe-back alignment.
 */
import type { NavigateFunction } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { platformHapticTap } from '@/platform/haptics'

const SW_NAME = 'sw-native.js'

function swUrlAndScope(): { url: string; scope: string } {
  let base = import.meta.env.BASE_URL || '/'
  if (!base.startsWith('/')) base = `/${base}`
  if (!base.endsWith('/')) base = `${base}/`
  const url = `${base}${SW_NAME}`.replace(/\/{2,}/g, '/')
  return { url, scope: base }
}

/** Register minimal push SW on native (no Workbox / precache). */
export async function registerNativeMinimalServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!Capacitor.isNativePlatform()) return null
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null
  try {
    const { url, scope } = swUrlAndScope()
    return await navigator.serviceWorker.register(url, { scope, type: 'classic' })
  } catch (e) {
    if (import.meta.env.DEV) console.warn('[native] sw-native registration failed', e)
    return null
  }
}

type BackHandler = () => boolean

const backHandlers: BackHandler[] = []

function tryCloseOpenOverlays(): boolean {
  // Match Radix Dialog, AlertDialog, and Sheet/Drawer overlays
  const open = document.querySelector(
    '[role="dialog"][data-state="open"], [data-state="open"][role="alertdialog"], [data-state="open"][data-radix-dialog-content], [data-state="open"][data-radix-drawer-content]',
  )
  if (!open) return false
  platformHapticTap(10)
  document.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }),
  )
  return true
}

/** Register LIFO: last registered runs first — register overlay handler after navigation so modals close before history.back(). */
export function registerNativeBackHandler(handler: BackHandler): () => void {
  backHandlers.push(handler)
  return () => {
    const i = backHandlers.lastIndexOf(handler)
    if (i !== -1) backHandlers.splice(i, 1)
  }
}

export function registerNativeOverlayBackHandler(): () => void {
  return registerNativeBackHandler(() => tryCloseOpenOverlays())
}

let androidBackListenerAttached = false

export function registerCapacitorAndroidBackButton(): void {
  if (!Capacitor.isNativePlatform() || androidBackListenerAttached) return
  androidBackListenerAttached = true
  void import('@capacitor/app').then(({ App }) => {
    App.addListener('backButton', ({ canGoBack }) => {
      // Try registered LIFO handlers first (overlays, then in-app navigation)
      for (let i = backHandlers.length - 1; i >= 0; i -= 1) {
        try {
          if (backHandlers[i]()) return
        } catch {
          /* continue */
        }
      }
      // Fall back to browser history if available
      if (canGoBack) {
        platformHapticTap(10)
        window.history.back()
        return
      }
      // No history left — exit the app
      void App.exitApp()
    }).catch(() => {})
  })
}

function pathSegments(pathname: string): string[] {
  return pathname.split('/').filter(Boolean)
}

/** Prefer in-app back over exiting when URL has more than one meaningful segment (e.g. /fr/swipe). */
export function registerCapacitorBackNavigation(navigate: NavigateFunction): () => void {
  return registerNativeBackHandler(() => {
    if (typeof window === 'undefined') return false
    const segs = pathSegments(window.location.pathname) // e.g. /fr/swipe → 2 segments
    if (segs.length <= 1) return false
    platformHapticTap(10)
    navigate(-1)
    return true
  })
}

/** iOS: interactive pop often needs an edge-swipeable stack; ensure body allows vertical scroll where needed. */
export function patchIosInteractivePopGesture(): void {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') return
  try {
    document.documentElement.style.setProperty('-webkit-overflow-scrolling', 'touch')
  } catch {
    /* ignore */
  }
}
