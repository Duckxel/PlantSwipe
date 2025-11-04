import React from 'react'
import PlantSwipe from "@/PlantSwipe"
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n, { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/lib/i18n'
import { getLanguageFromPath } from '@/lib/i18nRouting'

function AppShell() {
  const { loading } = useAuth()
  const location = useLocation()
  
  // Detect language from URL and set it
  React.useEffect(() => {
    const lang = getLanguageFromPath(location.pathname)
    if (i18n.language !== lang) {
      i18n.changeLanguage(lang)
    }
  }, [location.pathname])
  
  if (loading) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-b from-stone-50 to-stone-100 p-4 md:p-8" aria-busy="true" aria-live="polite" />
    )
  }
  return <PlantSwipe />
}

// Language-aware route wrapper
function LanguageRoutes() {
  const location = useLocation()
  
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
      <AuthProvider>
        <BrowserRouter>
          <LanguageRoutes />
        </BrowserRouter>
      </AuthProvider>
    </I18nextProvider>
  )
}
