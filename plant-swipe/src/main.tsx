import { createRoot } from 'react-dom/client'
// Initialize Sentry first - before any other code runs
import { initSentry } from '@/lib/sentry'
initSentry()

import '@/lib/runtimeEnvLoader'
import { patchGoogleTranslateConflict } from '@/lib/googleTranslateFix'
import './lib/i18n' // Initialize i18n before App
import './index.scss'
import App from './App.tsx'
import { initAccentFromStorage } from '@/lib/accent'

// Apply Google Translate DOM conflict fix before React renders
// This prevents crashes when users use browser translation extensions
patchGoogleTranslateConflict()

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

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
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

createRoot(document.getElementById('root')!).render(
  <App />,
)
