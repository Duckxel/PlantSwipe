import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import Backend from 'i18next-http-backend'
import LanguageDetector from 'i18next-browser-languagedetector'

// Supported languages
export const SUPPORTED_LANGUAGES = ['en', 'fr'] as const
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number]
export const DEFAULT_LANGUAGE: SupportedLanguage = 'en'

/**
 * Detect initial language preference:
 * 1. Check localStorage for saved preference
 * 2. Check browser language (if French, default to French)
 * 3. Fallback to default (English)
 */
function detectInitialLanguage(): SupportedLanguage {
  // Check localStorage first
  try {
    const saved = localStorage.getItem('plant-swipe-language')
    if (saved && SUPPORTED_LANGUAGES.includes(saved as SupportedLanguage)) {
      return saved as SupportedLanguage
    }
  } catch {}

  // Check browser language - if French, default to French
  try {
    const browserLang = navigator.language || (navigator as any).languages?.[0] || ''
    if (browserLang.startsWith('fr')) {
      return 'fr'
    }
  } catch {}

  return DEFAULT_LANGUAGE
}

// Initialize i18n
i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES,
    lng: detectInitialLanguage(), // Set initial language
    defaultNS: 'common',
    ns: ['common', 'About', 'email', 'Landing', 'plantInfo'],
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    detection: {
      // Don't auto-detect language from browser, we'll use our custom logic
      order: [],
      caches: [],
    },
    interpolation: {
      escapeValue: false, // React already escapes
    },
    react: {
      useSuspense: false, // Don't use suspense for translations
    },
  })

export default i18n