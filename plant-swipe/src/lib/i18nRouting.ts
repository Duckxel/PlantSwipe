import { useLocation, useNavigate } from 'react-router-dom'
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, type SupportedLanguage } from './i18n'
import i18n from './i18n'

/**
 * Get the saved language preference from localStorage
 */
export function getSavedLanguagePreference(): SupportedLanguage | null {
  try {
    const saved = localStorage.getItem('plant-swipe-language')
    if (saved && SUPPORTED_LANGUAGES.includes(saved as SupportedLanguage)) {
      return saved as SupportedLanguage
    }
  } catch {}
  return null
}

/**
 * Save language preference to localStorage
 */
export function saveLanguagePreference(lang: SupportedLanguage): void {
  try {
    localStorage.setItem('plant-swipe-language', lang)
  } catch {}
}

/**
 * Detect initial language from browser (French if browser language is French)
 */
export function detectBrowserLanguage(): SupportedLanguage {
  try {
    const browserLang = navigator.language || (navigator as any).languages?.[0] || ''
    if (browserLang.startsWith('fr')) {
      return 'fr'
    }
  } catch {}
  return DEFAULT_LANGUAGE
}

/**
 * Get the current language from the URL path
 * Returns the language code if present in URL (e.g., '/fr/...'), otherwise returns default
 */
export function getLanguageFromPath(pathname: string): SupportedLanguage {
  const segments = pathname.split('/').filter(Boolean)
  const firstSegment = segments[0]
  
  if (SUPPORTED_LANGUAGES.includes(firstSegment as SupportedLanguage)) {
    return firstSegment as SupportedLanguage
  }
  
  return DEFAULT_LANGUAGE
}

/**
 * Remove language prefix from a path
 * '/fr/gardens' -> '/gardens'
 * '/gardens' -> '/gardens'
 */
export function removeLanguagePrefix(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean)
  const firstSegment = segments[0]
  
  if (SUPPORTED_LANGUAGES.includes(firstSegment as SupportedLanguage)) {
    return '/' + segments.slice(1).join('/')
  }
  
  return pathname || '/'
}

/**
 * Add language prefix to a path
 * '/gardens', 'fr' -> '/fr/gardens'
 * '/gardens', 'en' -> '/gardens' (default language has no prefix)
 */
export function addLanguagePrefix(path: string, lang: SupportedLanguage): string {
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path
  
  // For default language, omit the prefix for cleaner URLs
  if (lang === DEFAULT_LANGUAGE) {
    return path === '/' ? '/' : `/${cleanPath}`
  }
  
  return path === '/' ? `/${lang}` : `/${lang}/${cleanPath}`
}

/**
 * Hook to get current language from URL
 */
export function useLanguage(): SupportedLanguage {
  const location = useLocation()
  return getLanguageFromPath(location.pathname)
}

/**
 * Hook to get current path without language prefix
 */
export function usePathWithoutLanguage(): string {
  const location = useLocation()
  return removeLanguagePrefix(location.pathname)
}

/**
 * Hook to navigate with language preservation
 */
export function useLanguageNavigate() {
  const navigate = useNavigate()
  const location = useLocation()
  const currentLang = useLanguage()
  
  return (to: string | number, options?: { replace?: boolean; state?: any }) => {
    // Handle browser history navigation (numbers)
    if (typeof to === 'number') {
      navigate(to as any, options)
      return
    }
    
    // Handle relative paths (paths that don't start with '/')
    let resolvedPath = to
    if (!to.startsWith('/')) {
      // Resolve relative path against current location
      const currentPathWithoutLang = removeLanguagePrefix(location.pathname)
      // Remove trailing slash and add the relative path
      const basePath = currentPathWithoutLang.endsWith('/') 
        ? currentPathWithoutLang.slice(0, -1) 
        : currentPathWithoutLang
      resolvedPath = basePath ? `${basePath}/${to}` : `/${to}`
    }
    
    // Handle string paths - always add language prefix for absolute paths
    const pathWithoutLang = removeLanguagePrefix(resolvedPath)
    const pathWithLang = addLanguagePrefix(pathWithoutLang, currentLang)
    
    // Debug logging (can be removed in production)
    if (process.env.NODE_ENV === 'development') {
      console.log('[useLanguageNavigate]', {
        from: location.pathname,
        to,
        resolvedPath,
        currentLang,
        pathWithoutLang,
        pathWithLang
      })
    }
    
    navigate(pathWithLang, options)
  }
}

/**
 * Hook to change language and preserve current route
 * Also syncs the language preference to the user's database profile
 */
export function useChangeLanguage() {
  const navigate = useNavigate()
  const location = useLocation()
  
  return async (newLang: SupportedLanguage) => {
    const currentPath = removeLanguagePrefix(location.pathname)
    const newPath = addLanguagePrefix(currentPath, newLang)
    
    // Change i18n language
    i18n.changeLanguage(newLang)
    
    // Save preference to localStorage
    saveLanguagePreference(newLang)
    
    // Navigate to new path with language prefix
    navigate(newPath, { replace: true })
    
    // Sync to database profile (non-blocking)
    // Import supabase dynamically to avoid circular dependencies
    try {
      const { supabase } = await import('./supabaseClient')
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.id) {
        await supabase
          .from('profiles')
          .update({ language: newLang })
          .eq('id', user.id)
      }
    } catch {
      // Silently fail - localStorage already has the preference
    }
  }
}