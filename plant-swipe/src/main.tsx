import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initAccentFromStorage } from '@/lib/accent'

// Apply saved accent before rendering to avoid flash
try { initAccentFromStorage() } catch {}

createRoot(document.getElementById('root')!).render(
  <App />,
)
