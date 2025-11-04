import { NavLink as RouterNavLink, type NavLinkProps as RouterNavLinkProps } from 'react-router-dom'
import { useLanguage, addLanguagePrefix, removeLanguagePrefix } from '@/lib/i18nRouting'
import { forwardRef } from 'react'

/**
 * Language-aware NavLink component that preserves language when navigating
 */
export const NavLink = forwardRef<HTMLAnchorElement, RouterNavLinkProps>(
  ({ to, ...props }, ref) => {
    const currentLang = useLanguage()
    
    // Convert 'to' to string if it's an object
    let toPath: string
    if (typeof to === 'string') {
      toPath = to
    } else if (to && typeof to === 'object' && 'pathname' in to) {
      toPath = to.pathname || '/'
    } else {
      toPath = '/'
    }
    
    // Remove any existing language prefix and add current language
    const pathWithoutLang = removeLanguagePrefix(toPath)
    const pathWithLang = addLanguagePrefix(pathWithoutLang, currentLang)
    
    // Reconstruct 'to' prop - preserve object form if it was an object
    const newTo = typeof to === 'string' 
      ? pathWithLang 
      : { ...to, pathname: pathWithLang }
    
    return (
      <RouterNavLink
        ref={ref}
        to={newTo}
        {...props}
      />
    )
  }
)

NavLink.displayName = 'LanguageAwareNavLink'
