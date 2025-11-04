/**
 * DeepL Translation Service
 * 
 * Translates plant data between supported languages using DeepL API
 * Requires DEEPL_API_KEY environment variable
 */

import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, type SupportedLanguage } from './i18n'

const DEEPL_API_URL = 'https://api-free.deepl.com/v2/translate'
// For production, use: 'https://api.deepl.com/v2/translate'

export interface TranslationFields {
  name?: string
  scientificName?: string
  meaning?: string
  description?: string
  careSoil?: string
}

export interface TranslatedFields extends TranslationFields {}

/**
 * Get DeepL API key from environment or return null
 */
function getDeepLApiKey(): string | null {
  // Check for API key in environment variables
  // In browser, this would come from a server endpoint or config
  // For now, we'll need to implement a server-side endpoint
  return null
}

/**
 * Translate text using DeepL API
 */
async function translateText(text: string, targetLang: SupportedLanguage, sourceLang: SupportedLanguage = DEFAULT_LANGUAGE): Promise<string> {
  if (!text || text.trim() === '') return text
  
  // If source and target are the same, return original
  if (sourceLang === targetLang) return text

  try {
    // In a real implementation, this would call a backend endpoint
    // that has the DeepL API key for security
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        source_lang: sourceLang.toUpperCase(),
        target_lang: targetLang.toUpperCase(),
      }),
    })

    if (!response.ok) {
      throw new Error(`Translation API error: ${response.statusText}`)
    }

    const data = await response.json()
    return data.translatedText || text
  } catch (error) {
    console.error('Translation error:', error)
    // Return original text on error
    return text
  }
}

/**
 * Translate all plant fields to target language
 */
export async function translatePlantFields(
  fields: TranslationFields,
  targetLang: SupportedLanguage,
  sourceLang: SupportedLanguage = DEFAULT_LANGUAGE
): Promise<TranslatedFields> {
  if (sourceLang === targetLang) {
    return fields
  }

  const translations: TranslatedFields = {}

  // Translate each field if it exists
  if (fields.name) {
    translations.name = await translateText(fields.name, targetLang, sourceLang)
  }
  if (fields.scientificName) {
    // Scientific names typically don't need translation
    translations.scientificName = fields.scientificName
  }
  if (fields.meaning) {
    translations.meaning = await translateText(fields.meaning, targetLang, sourceLang)
  }
  if (fields.description) {
    translations.description = await translateText(fields.description, targetLang, sourceLang)
  }
  if (fields.careSoil) {
    translations.careSoil = await translateText(fields.careSoil, targetLang, sourceLang)
  }

  return translations
}

/**
 * Translate plant fields to all supported languages
 */
export async function translatePlantToAllLanguages(
  fields: TranslationFields,
  sourceLang: SupportedLanguage = DEFAULT_LANGUAGE
): Promise<Record<SupportedLanguage, TranslatedFields>> {
  const translations: Record<SupportedLanguage, TranslatedFields> = {} as any

  for (const lang of SUPPORTED_LANGUAGES) {
    if (lang === sourceLang) {
      translations[lang] = fields
    } else {
      translations[lang] = await translatePlantFields(fields, lang, sourceLang)
    }
  }

  return translations
}
