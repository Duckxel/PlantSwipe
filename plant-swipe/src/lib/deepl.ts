/**
 * DeepL Translation Service
 * 
 * Translates plant data between supported languages using DeepL API
 * Requires DEEPL_API_KEY environment variable on the server
 */

import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, type SupportedLanguage } from './i18n'

export interface TranslationFields {
  name?: string
  scientificName?: string
  meaning?: string
  description?: string
  careSoil?: string
}

export interface TranslatedFields extends TranslationFields {}

/**
 * Translate text using DeepL API via backend endpoint
 */
async function translateText(text: string, targetLang: SupportedLanguage, sourceLang: SupportedLanguage = DEFAULT_LANGUAGE): Promise<string> {
  if (!text || text.trim() === '') return text
  
  // If source and target are the same, return original
  if (sourceLang === targetLang) return text

  try {
    // Call backend endpoint that has the DeepL API key
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text.trim(),
        source_lang: sourceLang.toUpperCase(),
        target_lang: targetLang.toUpperCase(),
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }))
      throw new Error(errorData.error || `Translation API error: ${response.statusText}`)
    }

    const data = await response.json()
    return data.translatedText || text
  } catch (error) {
    console.error('Translation error:', error)
    // Throw error so caller can handle it
    throw error
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

  // Translate each field if it exists (each field is sent separately to DeepL)
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
