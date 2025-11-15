import React from 'react'
import PlantSwipe from "@/PlantSwipe"
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n, { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from '@/lib/i18n'
import { getLanguageFromPath, getSavedLanguagePreference, detectBrowserLanguage, addLanguagePrefix } from '@/lib/i18nRouting'

function AppShell() {
  const { loading } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  
  // Detect language from URL and set it
  React.useEffect(() => {
    const lang = getLanguageFromPath(location.pathname)
    if (i18n.language !== lang) {
      i18n.changeLanguage(lang)
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
  
  if (loading) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-b from-stone-100 to-stone-200 dark:from-[#252526] dark:to-[#1e1e1e] p-4 md:p-8" aria-busy="true" aria-live="polite" />
    )
  }
  return <PlantSwipe />
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
  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <LanguageRoutes />
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </I18nextProvider>
  )
}
