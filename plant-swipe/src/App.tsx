import React from 'react'
const PlantSwipe = React.lazy(() => import("@/PlantSwipe"))
import ServiceWorkerToast from '@/components/pwa/ServiceWorkerToast'
import { AuthProvider } from '@/context/AuthContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n, { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from '@/lib/i18n'
import { getLanguageFromPath, getSavedLanguagePreference, detectBrowserLanguage, addLanguagePrefix } from '@/lib/i18nRouting'

function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()
  
  // Track if the language from URL is synced with i18n
  const [languageReady, setLanguageReady] = React.useState(() => {
    const urlLang = getLanguageFromPath(location.pathname)
    return i18n.language === urlLang
  })
  
  // Detect language from URL and set it
  React.useEffect(() => {
    const lang = getLanguageFromPath(location.pathname)
    if (i18n.language !== lang) {
      setLanguageReady(false)
      i18n.changeLanguage(lang).then(() => {
        setLanguageReady(true)
      }).catch(() => {
        // Even on error, allow rendering to proceed
        setLanguageReady(true)
      })
    } else {
      setLanguageReady(true)
    }
  }, [location.pathname])
  
  // Scroll to top on route changes
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
    })
  }, [location.pathname, location.search, location.hash])
  
  // Handle initial redirect to preferred language
  React.useEffect(() => {
    // Only redirect if we're at root path and language is not default
    if (location.pathname === '/' || location.pathname === '') {
      const savedLang = getSavedLanguagePreference()
      const preferredLang = savedLang || detectBrowserLanguage()
      
      if (preferredLang !== DEFAULT_LANGUAGE) {
        const newPath = addLanguagePrefix('/', preferredLang)
        navigate(newPath, { replace: true })
      }
    }
  }, [location.pathname, navigate])
  
  // Non-blocking rendering: PlantSwipe handles user=null (guest mode)
  // if (loading) { ... } removed to allow immediate LCP
  
  // Wait for language to be synced with URL before rendering
  // This ensures pages like /fr/setup show French content immediately
  if (!languageReady) {
    return <div className="min-h-screen w-full bg-gradient-to-b from-stone-100 to-stone-200 dark:from-[#252526] dark:to-[#1e1e1e] p-4 md:p-8" />
  }
  
  return (
    <React.Suspense fallback={<div className="min-h-screen w-full bg-gradient-to-b from-stone-100 to-stone-200 dark:from-[#252526] dark:to-[#1e1e1e] p-4 md:p-8" />}>
      <PlantSwipe />
    </React.Suspense>
  )
}

// Language-aware route wrapper
function LanguageRoutes() {
  return (
    <Routes>
      {/* Routes without language prefix (default language) */}
      <Route path="/*" element={<AppShell />} />
      
      {/* Language-prefixed routes */}
      {SUPPORTED_LANGUAGES.filter(lang => lang !== DEFAULT_LANGUAGE).map((lang) => (
        <Route
          key={lang}
          path={`/${lang}/*`}
          element={<AppShell />}
        />
      ))}
    </Routes>
  )
}

export default function App() {
  const routerBase = React.useMemo(() => {
    const baseUrl = import.meta.env.BASE_URL || '/'
    if (baseUrl === '/') return '/'
    return baseUrl.replace(/\/+$/, '')
  }, [])

  React.useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = 'Aphylia'
    }
  }, [])

  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter basename={routerBase}>
            <LanguageRoutes />
          </BrowserRouter>
          <ServiceWorkerToast />
        </AuthProvider>
      </ThemeProvider>
    </I18nextProvider>
  )
}
