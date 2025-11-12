import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import './lib/i18n' // Initialize i18n before App
import App from './App.tsx'
import { initAccentFromStorage } from '@/lib/accent'

// Apply saved accent before rendering to avoid flash
try { initAccentFromStorage() } catch {}

registerSW({
  immediate: true,
  onOfflineReady() {
    console.info('PlantSwipe is ready to work offline.')
  },
})

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

createRoot(document.getElementById('root')!).render(
  <App />,
)
