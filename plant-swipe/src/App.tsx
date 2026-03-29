import React from 'react'
const PlantSwipe = React.lazy(() => import("@/PlantSwipe"))
import ServiceWorkerToast from '@/components/pwa/ServiceWorkerToast'
import { AuthProvider } from '@/context/AuthContext'
import { TutorialProvider } from '@/context/TutorialContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n, { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, getDomainDefaultLanguage } from '@/lib/i18n'
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
  // This runs on first load and when PWA users land on a URL in the wrong language.
  // Covers: PWA home screen launch, bookmarks, shared links, etc.
  React.useEffect(() => {
    const domainLang = getDomainDefaultLanguage()
    const segments = location.pathname.split('/').filter(Boolean)
    const hasExplicitLangPrefix = segments.length > 0 && SUPPORTED_LANGUAGES.includes(segments[0] as typeof SUPPORTED_LANGUAGES[number])

    // Determine what language the URL currently implies
    const urlLang = getLanguageFromPath(location.pathname)

    // Get user's saved language preference (only redirect based on explicit preference,
    // not browser detection, to avoid unwanted redirects on subsequent navigations)
    const savedLang = getSavedLanguagePreference()

    // On first visit (no saved preference), use browser language for initial redirect only
    const preferredLang = savedLang || detectBrowserLanguage()

    // If URL already matches user preference, nothing to do
    if (urlLang === preferredLang) {
      return
    }

    // On a language-specific domain (e.g., aphylia.fr serves French by default):
    // Only redirect if user has an EXPLICIT saved preference that differs from the domain default.
    // Don't redirect based on browser detection alone — the domain already chose a language.
    if (domainLang) {
      if (savedLang && savedLang !== domainLang && !hasExplicitLangPrefix) {
        const currentPath = location.pathname === '' ? '/' : location.pathname
        const newPath = addLanguagePrefix(currentPath, savedLang)
        navigate(newPath, { replace: true })
      }
      return
    }

    // If URL has an explicit language prefix (e.g., /fr/discovery), respect it
    if (hasExplicitLangPrefix) {
      return
    }

    // URL has no language prefix (e.g., /discovery, /gardens, /)
    // Redirect if user's preferred language differs from default (English)
    if (preferredLang !== DEFAULT_LANGUAGE) {
      const currentPath = location.pathname === '' ? '/' : location.pathname
      const newPath = addLanguagePrefix(currentPath, preferredLang)
      navigate(newPath, { replace: true })
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
      {/* Routes without language prefix (default/domain language) */}
      <Route path="/*" element={<AppShell />} />

      {/* Language-prefixed routes (all languages, including /en for explicit override) */}
      {SUPPORTED_LANGUAGES.map((lang) => (
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
          <TutorialProvider>
            <BrowserRouter basename={routerBase}>
              <LanguageRoutes />
            </BrowserRouter>
          </TutorialProvider>
          <ServiceWorkerToast />
        </AuthProvider>
      </ThemeProvider>
    </I18nextProvider>
  )
}
