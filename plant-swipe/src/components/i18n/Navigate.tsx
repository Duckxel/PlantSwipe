import { Navigate as RouterNavigate, type NavigateProps } from 'react-router-dom'
import { useLanguage, addLanguagePrefix, removeLanguagePrefix } from '@/lib/i18nRouting'

/**
 * Language-aware Navigate component that preserves language when redirecting
 */
export function Navigate({ to, ...props }: NavigateProps) {
  const currentLang = useLanguage()
  
  // Convert 'to' to string if it's an object
  const toPath = typeof to === 'string' ? to : to.pathname || '/'
  
  // Remove any existing language prefix and add current language
  const pathWithoutLang = removeLanguagePrefix(toPath)
  const pathWithLang = addLanguagePrefix(pathWithoutLang, currentLang)
  
  return (
    <RouterNavigate
      to={pathWithLang}
      {...props}
    />
  )
}