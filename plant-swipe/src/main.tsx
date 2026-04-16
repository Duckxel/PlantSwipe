import { createRoot } from 'react-dom/client'
// Initialize Sentry first - before any other code runs
import { initSentry } from '@/lib/sentry'
initSentry()

import '@/lib/runtimeEnvLoader'
import { installNativeNetworkBridge } from '@/lib/nativeNetworkBridge'
import { patchGoogleTranslateConflict } from '@/lib/googleTranslateFix'
import './lib/i18n' // Initialize i18n before App
import './index.scss'
// App is dynamically imported in bootstrap() below.
// In Capacitor native builds, environment variables (Supabase credentials, etc.) are
// loaded asynchronously from the remote API.  Static imports execute at module-init
// time — before those async fetches complete — so supabaseClient.ts would crash with
// "Missing environment variable".  Deferring the import gives the env-loader time to
// finish, while the loading spinner in index.html keeps the user informed.
import { initAccentFromStorage } from '@/lib/accent'
import { Capacitor } from '@capacitor/core'

// Apply Google Translate DOM conflict fix before React renders
// This prevents crashes when users use browser translation extensions
patchGoogleTranslateConflict()
installNativeNetworkBridge()

type WindowControlsOverlay = {
  visible?: boolean
  getTitlebarAreaRect?: () => DOMRect | DOMRectReadOnly
  addEventListener?: (type: 'geometrychange', listener: () => void) => void
}

type NavigatorWithOverlay = Navigator & {
  windowControlsOverlay?: WindowControlsOverlay
}

const initWindowControlsOverlay = () => {
  if (typeof navigator === 'undefined') return
  const overlay = (navigator as NavigatorWithOverlay).windowControlsOverlay
  if (!overlay || typeof overlay.getTitlebarAreaRect !== 'function') return

  const applyGeometry = () => {
    const rect = overlay.getTitlebarAreaRect?.()
    const height = rect?.height ?? 0
    document.documentElement.style.setProperty('--window-controls-overlay-height', `${height}px`)
    if (document.body) {
      document.body.classList.toggle('has-window-controls-overlay', overlay.visible && height > 0)
    }
  }

  overlay.addEventListener?.('geometrychange', applyGeometry)
  applyGeometry()
}

// Apply saved accent before rendering to avoid flash
try {
  initAccentFromStorage()
} catch {
  /* ignore accent init errors */
}

// Apply theme before rendering to avoid flash
try {
  const savedTheme = localStorage.getItem('plantswipe.theme') || 'system'
  const getSystemTheme = () => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  const effectiveTheme = savedTheme === 'system' ? getSystemTheme() : savedTheme
  if (effectiveTheme === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
} catch {
  /* ignore theme init errors */
}

try {
  initWindowControlsOverlay()
} catch {
  /* ignore overlay init errors */
}

if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
  try {
    document.documentElement.classList.add('capacitor-native')
    document.body?.classList.add('capacitor-native')
  } catch {
    /* ignore */
  }

  // Configure native keyboard behavior — prevents the WebView from resizing
  // on input focus which causes layout jumps. Instead, the keyboard overlays
  // and scrolls the focused element into view.
  void import('@capacitor/keyboard').then(({ Keyboard, KeyboardResize }) => {
    Keyboard.setResizeMode({ mode: KeyboardResize.None }).catch(() => {})
    Keyboard.setScroll({ isDisabled: false }).catch(() => {})
    Keyboard.addListener('keyboardWillShow', (info) => {
      document.documentElement.style.setProperty('--keyboard-height', `${info.keyboardHeight}px`)
      document.body.classList.add('keyboard-visible')
    }).catch(() => {})
    Keyboard.addListener('keyboardWillHide', () => {
      document.documentElement.style.setProperty('--keyboard-height', '0px')
      document.body.classList.remove('keyboard-visible')
    }).catch(() => {})
  }).catch(() => { /* plugin unavailable */ })
}

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Capacitor store builds omit the SW; probing registration is pointless and can touch stale state.
    if (import.meta.env.VITE_APP_NATIVE_BUILD === '1') return
    navigator.serviceWorker
      .getRegistration()
      .then((registration) => registration?.update().catch(() => {}))
      .catch(() => {})
  })
}

if (import.meta.env.PROD) {
  try {
    console.info('[Aphylia] Build info', {
      version: (import.meta.env as Record<string, string>).VITE_APP_VERSION ?? 'unknown',
      commit: (import.meta.env as Record<string, string>).VITE_COMMIT_SHA ?? 'unknown',
      base: import.meta.env.BASE_URL,
    })
  } catch {
    /* ignore logging failures */
  }
}

/**
 * Wait for runtime environment variables to be available before mounting.
 *
 * In Capacitor native builds the JS bundle loads instantly from local assets,
 * but critical env vars (Supabase URL/key) are fetched asynchronously from the
 * remote API (`/api/env.js`).  Without waiting, module-level code in
 * supabaseClient.ts would reference an empty `window.__ENV__` and fail.
 *
 * On the web the bundle is also downloaded over the network, so by the time it
 * evaluates the env-loader has almost always finished — no wait is needed.
 */
function waitForNativeEnv(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any

  // If env vars already have Supabase credentials, proceed immediately.
  if (w.__ENV__?.VITE_SUPABASE_URL) return Promise.resolve()

  // Also skip waiting if the credentials were baked in at build time.
  if (import.meta.env.VITE_SUPABASE_URL) return Promise.resolve()

  return new Promise<void>((resolve) => {
    let settled = false
    const settle = () => { if (settled) return; settled = true; resolve() }

    const onReady = () => { clearTimeout(tid); settle() }
    window.addEventListener('plantswipe:env-ready', onReady, { once: true })

    // Safety: don't block forever if env loading fails (e.g. no internet).
    // After 8 s the app mounts anyway in guest / offline mode.
    const tid = setTimeout(() => {
      window.removeEventListener('plantswipe:env-ready', onReady)
      settle()
    }, 8_000)
  })
}

async function bootstrap() {
  // On native Capacitor, wait for the env-loader to fetch credentials from the
  // remote API before importing App (which triggers supabaseClient.ts init).
  if (Capacitor.isNativePlatform()) {
    await waitForNativeEnv()
  }

  const { default: App } = await import('./App.tsx')
  createRoot(document.getElementById('root')!).render(<App />)
}

bootstrap().catch((err) => {
  // Last resort: render error info so the user doesn't stare at a spinner forever.
  console.error('[Aphylia] bootstrap failed', err)
  const root = document.getElementById('root')
  if (root) {
    root.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:system-ui;padding:2rem;text-align:center">' +
      '<p>Something went wrong while starting the app. Please restart or reinstall.</p></div>'
  }
})
