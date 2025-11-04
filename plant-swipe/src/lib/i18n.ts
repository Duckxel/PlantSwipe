import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import Backend from 'i18next-http-backend'
import LanguageDetector from 'i18next-browser-languagedetector'

// Supported languages
export const SUPPORTED_LANGUAGES = ['en', 'fr'] as const
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number]
export const DEFAULT_LANGUAGE: SupportedLanguage = 'en'

// Initialize i18n
i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES,
    defaultNS: 'common',
    ns: ['common'],
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    detection: {
      // Don't auto-detect language from browser, we'll use URL
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