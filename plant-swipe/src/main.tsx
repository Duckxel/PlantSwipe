import { createRoot } from 'react-dom/client'
import './index.css'
import './lib/i18n' // Initialize i18n before App
import App from './App.tsx'
import { initAccentFromStorage } from '@/lib/accent'

const initWindowControlsOverlay = () => {
  if (typeof navigator === 'undefined') return
  const overlay = (navigator as any).windowControlsOverlay
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
try { initAccentFromStorage() } catch {}

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
} catch {}

try { initWindowControlsOverlay() } catch {}

createRoot(document.getElementById('root')!).render(
  <App />,
)
