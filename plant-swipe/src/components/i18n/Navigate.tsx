import { Navigate as RouterNavigate, type NavigateProps, useLocation } from 'react-router-dom'
import { useLanguage, addLanguagePrefix, removeLanguagePrefix, getLanguageFromPath } from '@/lib/i18nRouting'
import i18n from '@/lib/i18n'

/**
 * Language-aware Navigate component that preserves language when redirecting
 * 
 * Uses multiple sources to detect the current language to handle edge cases:
 * 1. React Router location (primary source)
 * 2. window.location.pathname (fallback for race conditions)
 * 3. i18n.language (fallback for consistency)
 * 
 * Prefers non-default language (e.g., 'fr') if any source indicates it,
 * to ensure French users aren't accidentally redirected to English pages.
 */
export function Navigate({ to, ...props }: NavigateProps) {
  const routerLang = useLanguage()
  const location = useLocation()
  
  // Get language from multiple sources to handle edge cases where
  // React Router's location state might be stale during redirects
  const windowLang = typeof window !== 'undefined' 
    ? getLanguageFromPath(window.location.pathname) 
    : routerLang
  const i18nLang = (i18n.language === 'fr' ? 'fr' : 'en') as 'en' | 'fr'
  
  // Prefer non-default language (French) if any source indicates it
  // This ensures French users are always redirected to French pages
  const currentLang = routerLang === 'fr' || windowLang === 'fr' || i18nLang === 'fr' 
    ? 'fr' 
    : 'en'
  
  // Convert 'to' to string if it's an object
  let toPath: string
  if (typeof to === 'string') {
    toPath = to
  } else if (to && typeof to === 'object' && 'pathname' in to) {
    toPath = to.pathname || '/'
  } else {
    toPath = '/'
  }
  
  // Handle relative paths (paths that don't start with '/')
  if (!toPath.startsWith('/')) {
    // Resolve relative path against current location
    const currentPathWithoutLang = removeLanguagePrefix(location.pathname)
    // Remove trailing slash and add the relative path
    const basePath = currentPathWithoutLang.endsWith('/') 
      ? currentPathWithoutLang.slice(0, -1) 
      : currentPathWithoutLang
    toPath = basePath ? `${basePath}/${toPath}` : `/${toPath}`
  }
  
  // Remove any existing language prefix and add current language
  const pathWithoutLang = removeLanguagePrefix(toPath)
  const pathWithLang = addLanguagePrefix(pathWithoutLang, currentLang)
  
  // Preserve object form if it was an object
  const newTo = typeof to === 'string' 
    ? pathWithLang 
    : { ...to, pathname: pathWithLang }
  
  return (
    <RouterNavigate
      to={newTo}
      {...props}
    />
  )
}