import { Link as RouterLink, type LinkProps as RouterLinkProps } from 'react-router-dom'
import { useLanguage, addLanguagePrefix, removeLanguagePrefix } from '@/lib/i18nRouting'
import { useLocation } from 'react-router-dom'
import { forwardRef } from 'react'

/**
 * Language-aware Link component that preserves language when navigating
 */
export const Link = forwardRef<HTMLAnchorElement, RouterLinkProps>(
  ({ to, ...props }, ref) => {
    const currentLang = useLanguage()
    const location = useLocation()
    
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
    
    // Reconstruct 'to' prop - preserve object form if it was an object
    const newTo = typeof to === 'string' 
      ? pathWithLang 
      : { ...to, pathname: pathWithLang }
    
    return (
      <RouterLink
        ref={ref}
        to={newTo}
        {...props}
      />
    )
  }
)

Link.displayName = 'LanguageAwareLink'