/**
 * DeepL Translation Service
 * 
 * Translates plant data between supported languages using DeepL API
 * Requires DEEPL_API_KEY environment variable on the server
 * Updated for new JSONB structure
 * 
 * Features:
 * - Language detection for Pro Insights
 * - Translation caching for Pro Advice content
 */

import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, type SupportedLanguage } from './i18n'
import { supabase } from './supabaseClient'
import type {
  PlantIdentifiers,
  PlantEcology,
  PlantUsage,
  PlantMeta,
  PlantPhenology,
  PlantCare,
  PlantPlanting,
  PlantProblems,
} from '@/types/plant'

export interface TranslationFields {
  name?: string
  scientificName?: string
  meaning?: string
  description?: string
  careSoil?: string
  // New JSONB translatable fields
  identifiers?: PlantIdentifiers
  ecology?: PlantEcology
  usage?: PlantUsage
  meta?: PlantMeta
  phenology?: Pick<PlantPhenology, 'scentNotes'>
  care?: {
    watering?: PlantCare['watering']
    fertilizing?: PlantCare['fertilizing']
    mulching?: PlantCare['mulching']
  }
  planting?: Pick<PlantPlanting, 'sitePrep' | 'companionPlants' | 'avoidNear'>
  problems?: PlantProblems
}

export interface TranslatedFields extends TranslationFields {}

/**
 * Extract template variables (e.g., {{user}}) and replace with placeholders
 * Returns the modified text and a map to restore variables later
 */
function protectTemplateVariables(text: string): { text: string; variableMap: Map<string, string> } {
  const variableMap = new Map<string, string>()
  let counter = 0
  
  // Match {{variable}} patterns
  const protectedText = text.replace(/\{\{(\w+)\}\}/g, (match) => {
    const placeholder = `__VAR_${counter}__`
    variableMap.set(placeholder, match)
    counter++
    return placeholder
  })
  
  return { text: protectedText, variableMap }
}

/**
 * Restore template variables from placeholders
 */
function restoreTemplateVariables(text: string, variableMap: Map<string, string>): string {
  let result = text
  for (const [placeholder, original] of variableMap) {
    // Use global replace in case the placeholder appears multiple times
    result = result.split(placeholder).join(original)
  }
  return result
}

/**
 * Retry helper with exponential backoff for rate-limited (429) requests.
 * The server now also queues and retries DeepL calls, but this provides
 * an additional safety net on the client side.
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 5,
  baseDelayMs = 1500
): Promise<Response> {
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options)
      
      // If rate limited, wait and retry
      if (response.status === 429 && attempt < maxRetries) {
        // Check for Retry-After header
        const retryAfter = response.headers.get('retry-after')
        let delay: number
        if (retryAfter && !isNaN(Number(retryAfter))) {
          delay = Number(retryAfter) * 1000
        } else {
          delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500
        }
        console.warn(`[translate] Rate limited (429), retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      
      return response
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      // Only retry on network errors, not on other failures
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500
        console.warn(`[translate] Network error, retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
    }
  }
  
  throw lastError || new Error('Translation request failed after retries')
}

/**
 * Translate text using DeepL API via backend endpoint
 * Includes automatic retry with exponential backoff for rate-limited requests
 */
export async function translateText(
  text: string,
  targetLang: SupportedLanguage,
  sourceLang: SupportedLanguage = DEFAULT_LANGUAGE
): Promise<string> {
  if (!text || text.trim() === '') return text
  
  // If source and target are the same, return original
  if (sourceLang === targetLang) return text

  // Protect template variables before translation
  const { text: protectedText, variableMap } = protectTemplateVariables(text)

  try {
    // Call backend endpoint that has the DeepL API key
    const response = await fetchWithRetry('/api/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: protectedText.trim(),
        source_lang: sourceLang.toUpperCase(),
        target_lang: targetLang.toUpperCase(),
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }))
      throw new Error(errorData.error || `Translation API error: ${response.statusText}`)
    }

    const data = await response.json()
    const translatedText = data.translatedText || protectedText
    
    // Restore template variables after translation
    return restoreTemplateVariables(translatedText, variableMap)
  } catch (error) {
    console.error('Translation error:', error)
    // Throw error so caller can handle it
    throw error
  }
}

/**
 * Get the current auth headers for API requests.
 * Returns Authorization header if user is logged in, empty object otherwise.
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const { data } = await supabase.auth.getSession()
    if (data?.session?.access_token) {
      return { Authorization: `Bearer ${data.session.access_token}` }
    }
  } catch {
    // Silently fail - auth header is optional (batch falls back to individual)
  }
  return {}
}

/**
 * Translate multiple texts in a single batch request (admin-only endpoint)
 * Falls back to individual requests if batch endpoint fails.
 * Includes auth token so admin users actually hit the batch endpoint
 * instead of always falling back to N individual requests.
 */
export async function translateBatch(
  texts: string[],
  targetLang: SupportedLanguage,
  sourceLang: SupportedLanguage = DEFAULT_LANGUAGE
): Promise<string[]> {
  if (!texts || texts.length === 0) return texts
  if (sourceLang === targetLang) return texts
  
  // Protect template variables in all texts
  const protected_ = texts.map(text => protectTemplateVariables(text || ''))
  const protectedTexts = protected_.map(p => p.text.trim())
  
  try {
    // Include auth headers so admin users can use the batch endpoint
    // (previously missing, causing all batch calls to 403 and fall back to individual)
    const authHeaders = await getAuthHeaders()
    
    const response = await fetchWithRetry('/api/translate-batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({
        texts: protectedTexts,
        source_lang: sourceLang.toUpperCase(),
        target_lang: targetLang.toUpperCase(),
      }),
    })

    if (!response.ok) {
      // If batch endpoint fails (e.g., non-admin), fall back to individual requests
      console.warn('[translate] Batch endpoint failed, falling back to individual requests')
      return translateArrayIndividual(texts, targetLang, sourceLang)
    }

    const data = await response.json()
    const translations: string[] = data.translations || []
    
    // Restore template variables in all translations
    return translations.map((translated, i) => {
      const variableMap = protected_[i]?.variableMap
      return variableMap ? restoreTemplateVariables(translated, variableMap) : translated
    })
  } catch (error) {
    console.warn('[translate] Batch translation failed, falling back to individual:', error)
    return translateArrayIndividual(texts, targetLang, sourceLang)
  }
}

/**
 * Translate array of strings individually (fallback for non-admin users)
 * Uses concurrency control to avoid overwhelming the API
 */
async function translateArrayIndividual(
  items: string[],
  targetLang: SupportedLanguage,
  sourceLang: SupportedLanguage = DEFAULT_LANGUAGE
): Promise<string[]> {
  if (!items || items.length === 0) return items
  if (sourceLang === targetLang) return items
  
  // Process in chunks of 2 to limit concurrency and avoid DeepL rate limits
  const CHUNK_SIZE = 2
  const CHUNK_DELAY_MS = 300 // Small delay between chunks to spread requests
  const results: string[] = []
  
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE)
    const chunkResults = await Promise.all(
      chunk.map(item => translateText(item, targetLang, sourceLang))
    )
    results.push(...chunkResults)
    
    // Add a small delay between chunks to avoid overwhelming DeepL
    if (i + CHUNK_SIZE < items.length) {
      await new Promise(resolve => setTimeout(resolve, CHUNK_DELAY_MS))
    }
  }
  
  return results
}

/**
 * Translate array of strings
 * Uses batch endpoint for efficiency when available, falls back to individual requests
 */
export async function translateArray(
  items: string[],
  targetLang: SupportedLanguage,
  sourceLang: SupportedLanguage = DEFAULT_LANGUAGE
): Promise<string[]> {
  if (!items || items.length === 0) return items
  if (sourceLang === targetLang) return items
  
  // Use batch endpoint for arrays (more efficient, 1 API call instead of N)
  return translateBatch(items, targetLang, sourceLang)
}

/**
 * Translate plant identifiers
 */
async function translateIdentifiers(
  identifiers: PlantIdentifiers,
  targetLang: SupportedLanguage,
  sourceLang: SupportedLanguage = DEFAULT_LANGUAGE
): Promise<PlantIdentifiers> {
  if (sourceLang === targetLang) return identifiers

  const translated: PlantIdentifiers = { ...identifiers }

  if (identifiers.commonNames) {
    translated.commonNames = await translateArray(identifiers.commonNames, targetLang, sourceLang)
  }

  // Scientific names typically don't need translation
  // Other identifier fields are usually not translatable

  return translated
}

/**
 * Translate plant ecology
 */
async function translateEcology(
  ecology: PlantEcology,
  targetLang: SupportedLanguage,
  sourceLang: SupportedLanguage = DEFAULT_LANGUAGE
): Promise<PlantEcology> {
  if (sourceLang === targetLang) return ecology

  const translated: PlantEcology = { ...ecology }

  if (ecology.wildlifeValue) {
    translated.wildlifeValue = await translateArray(ecology.wildlifeValue, targetLang, sourceLang)
  }

  // nativeRange and pollinators are usually proper nouns, don't translate
  // conservationStatus is standardized codes, don't translate

  return translated
}

/**
 * Translate plant usage
 */
async function translateUsage(
  usage: PlantUsage,
  targetLang: SupportedLanguage,
  sourceLang: SupportedLanguage = DEFAULT_LANGUAGE
): Promise<PlantUsage> {
  if (sourceLang === targetLang) return usage

  const translated: PlantUsage = { ...usage }

  if (usage.culinaryUses) {
    translated.culinaryUses = await translateArray(usage.culinaryUses, targetLang, sourceLang)
  }

  if (usage.medicinalUses) {
    translated.medicinalUses = await translateArray(usage.medicinalUses, targetLang, sourceLang)
  }

  // gardenUses, indoorOutdoor, edibleParts are usually standardized terms

  return translated
}

/**
 * Translate plant meta
 */
async function translateMeta(
  meta: PlantMeta,
  targetLang: SupportedLanguage,
  sourceLang: SupportedLanguage = DEFAULT_LANGUAGE
): Promise<PlantMeta> {
  if (sourceLang === targetLang) return meta

  const translated: PlantMeta = { ...meta }

  if (meta.funFact) {
    translated.funFact = await translateText(meta.funFact, targetLang, sourceLang)
  }

  if (meta.authorNotes) {
    translated.authorNotes = await translateText(meta.authorNotes, targetLang, sourceLang)
  }

  if (meta.sourceReferences) {
    translated.sourceReferences = await translateArray(meta.sourceReferences, targetLang, sourceLang)
  }

  // tags, rarity are usually standardized

  return translated
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
  if (fields.identifiers) {
    translations.identifiers = await translateIdentifiers(fields.identifiers, targetLang, sourceLang)
  }
  if (fields.ecology) {
    translations.ecology = await translateEcology(fields.ecology, targetLang, sourceLang)
  }
  if (fields.usage) {
    translations.usage = await translateUsage(fields.usage, targetLang, sourceLang)
  }
  if (fields.meta) {
    translations.meta = await translateMeta(fields.meta, targetLang, sourceLang)
  }
  if (fields.phenology?.scentNotes) {
    translations.phenology = {
      ...fields.phenology,
      scentNotes: await translateArray(fields.phenology.scentNotes, targetLang, sourceLang),
    }
  }
  if (fields.care) {
    const translatedCare: TranslationFields['care'] = {}
    if (fields.care.watering?.frequency && typeof fields.care.watering.frequency === 'object') {
      const freq = fields.care.watering.frequency
      translatedCare.watering = {
        ...fields.care.watering,
        frequency: {
          winter: freq?.winter ? await translateText(freq.winter, targetLang, sourceLang) : freq?.winter,
          spring: freq?.spring ? await translateText(freq.spring, targetLang, sourceLang) : freq?.spring,
          summer: freq?.summer ? await translateText(freq.summer, targetLang, sourceLang) : freq?.summer,
          autumn: freq?.autumn ? await translateText(freq.autumn, targetLang, sourceLang) : freq?.autumn,
        },
      }
    }
    if (fields.care.fertilizing?.schedule) {
      translatedCare.fertilizing = {
        ...fields.care.fertilizing,
        schedule: await translateText(fields.care.fertilizing.schedule, targetLang, sourceLang),
      }
    }
    if (fields.care.mulching?.material) {
      translatedCare.mulching = {
        ...fields.care.mulching,
        material: await translateText(fields.care.mulching.material, targetLang, sourceLang),
      }
    }
    if (Object.keys(translatedCare).length > 0) {
      translations.care = translatedCare as NonNullable<TranslationFields['care']>
    }
  }
  if (fields.planting) {
    const translatedPlanting: TranslationFields['planting'] = {}
    if (fields.planting.sitePrep?.length) {
      translatedPlanting.sitePrep = await translateArray(fields.planting.sitePrep, targetLang, sourceLang)
    }
    if (fields.planting.companionPlants?.length) {
      translatedPlanting.companionPlants = await translateArray(fields.planting.companionPlants, targetLang, sourceLang)
    }
    if (fields.planting.avoidNear?.length) {
      translatedPlanting.avoidNear = await translateArray(fields.planting.avoidNear, targetLang, sourceLang)
    }
    if (Object.keys(translatedPlanting).length > 0) {
      translations.planting = translatedPlanting
    }
  }
  if (fields.problems) {
    const translatedProblems: PlantProblems = {}
    if (fields.problems.pests?.length) {
      translatedProblems.pests = await translateArray(fields.problems.pests, targetLang, sourceLang)
    }
    if (fields.problems.diseases?.length) {
      translatedProblems.diseases = await translateArray(fields.problems.diseases, targetLang, sourceLang)
    }
    if (fields.problems.hazards?.length) {
      translatedProblems.hazards = await translateArray(fields.problems.hazards, targetLang, sourceLang)
    }
    if (Object.keys(translatedProblems).length > 0) {
      translations.problems = translatedProblems
    }
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

// ========== Email Template Translation Functions ==========

export interface EmailTranslationFields {
  subject: string
  previewText?: string | null
  bodyHtml: string
}

export interface TranslatedEmailFields extends EmailTranslationFields {}

/**
 * Translate email template fields to target language
 */
export async function translateEmailFields(
  fields: EmailTranslationFields,
  targetLang: SupportedLanguage,
  sourceLang: SupportedLanguage = DEFAULT_LANGUAGE
): Promise<TranslatedEmailFields> {
  if (sourceLang === targetLang) {
    return fields
  }

  const translated: TranslatedEmailFields = {
    subject: fields.subject,
    previewText: fields.previewText,
    bodyHtml: fields.bodyHtml,
  }

  // Translate subject
  if (fields.subject) {
    translated.subject = await translateText(fields.subject, targetLang, sourceLang)
  }

  // Translate preview text
  if (fields.previewText) {
    translated.previewText = await translateText(fields.previewText, targetLang, sourceLang)
  }

  // Translate body HTML content (preserving HTML structure)
  if (fields.bodyHtml) {
    translated.bodyHtml = await translateHtmlContent(fields.bodyHtml, targetLang, sourceLang)
  }

  return translated
}

/**
 * Translate HTML content while preserving tags and template variables
 * This extracts text content, translates it, and reconstructs the HTML
 */
async function translateHtmlContent(
  html: string,
  targetLang: SupportedLanguage,
  sourceLang: SupportedLanguage
): Promise<string> {
  if (!html || html.trim() === '') return html
  if (sourceLang === targetLang) return html

  // Protect template variables before translation
  const { text: protectedHtml, variableMap } = protectTemplateVariables(html)

  try {
    // For TipTap/rich text content, we translate the full HTML
    // DeepL preserves HTML tags when translating
    // Use fetchWithRetry to handle 429 rate limiting from DeepL
    const response = await fetchWithRetry('/api/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: protectedHtml,
        source_lang: sourceLang.toUpperCase(),
        target_lang: targetLang.toUpperCase(),
        // Tell DeepL to preserve formatting
        tag_handling: 'html',
      }),
    })

    if (!response.ok) {
      console.error('Translation API error:', response.statusText)
      return html
    }

    const data = await response.json()
    const translatedHtml = data.translatedText || protectedHtml
    
    // Restore template variables after translation
    return restoreTemplateVariables(translatedHtml, variableMap)
  } catch (error) {
    console.error('HTML translation error:', error)
    return html
  }
}

/**
 * Translate email template to all supported languages
 */
export async function translateEmailToAllLanguages(
  fields: EmailTranslationFields,
  sourceLang: SupportedLanguage = DEFAULT_LANGUAGE
): Promise<Record<SupportedLanguage, TranslatedEmailFields>> {
  const translations: Record<SupportedLanguage, TranslatedEmailFields> = {} as Record<SupportedLanguage, TranslatedEmailFields>

  for (const lang of SUPPORTED_LANGUAGES) {
    if (lang === sourceLang) {
      translations[lang] = fields
    } else {
      translations[lang] = await translateEmailFields(fields, lang, sourceLang)
    }
  }

  return translations
}

// ============================================================================
// Notification Template Translation Functions
// ============================================================================

/**
 * Translate notification message variants to target language
 */
export async function translateNotificationVariants(
  variants: string[],
  targetLang: SupportedLanguage,
  sourceLang: SupportedLanguage = DEFAULT_LANGUAGE
): Promise<string[]> {
  if (!variants || variants.length === 0) return variants
  if (sourceLang === targetLang) return variants

  const translatedVariants: string[] = []

  for (const variant of variants) {
    try {
      const translated = await translateText(variant, targetLang, sourceLang)
      translatedVariants.push(translated)
    } catch (error) {
      console.error('Failed to translate notification variant:', error)
      // Keep original text on error
      translatedVariants.push(variant)
    }
  }

  return translatedVariants
}

/**
 * Translate notification message variants to all supported languages
 */
export async function translateNotificationToAllLanguages(
  variants: string[],
  sourceLang: SupportedLanguage = DEFAULT_LANGUAGE
): Promise<Record<SupportedLanguage, string[]>> {
  const translations: Record<SupportedLanguage, string[]> = {} as Record<SupportedLanguage, string[]>

  for (const lang of SUPPORTED_LANGUAGES) {
    if (lang === sourceLang) {
      translations[lang] = variants
    } else {
      translations[lang] = await translateNotificationVariants(variants, lang, sourceLang)
    }
  }

  return translations
}

// ============================================================================
// Pro Advice Translation Functions
// ============================================================================

/**
 * Detect the language of a text using DeepL API
 * @param text The text to detect the language of
 * @returns The detected language code (lowercase, e.g., 'en', 'fr') or null if detection failed
 */
export async function detectLanguage(text: string): Promise<string | null> {
  if (!text || text.trim() === '') return null

  try {
    const response = await fetch('/api/detect-language', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }))
      console.error('Language detection error:', errorData)
      return null
    }

    const data = await response.json()
    return data.detectedLanguage || null
  } catch (error) {
    console.error('Language detection error:', error)
    return null
  }
}

/**
 * Translate text with automatic language detection
 * Returns both the translated text and the detected source language
 */
export async function translateWithDetection(
  text: string,
  targetLang: SupportedLanguage
): Promise<{ translatedText: string; detectedLanguage: string | null; skipped?: boolean }> {
  if (!text || text.trim() === '') {
    return { translatedText: text, detectedLanguage: null }
  }

  try {
    const response = await fetch('/api/translate-detect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text.trim(),
        target_lang: targetLang.toUpperCase(),
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }))
      throw new Error(errorData.error || `Translation API error: ${response.statusText}`)
    }

    const data = await response.json()
    return {
      translatedText: data.translatedText || text,
      detectedLanguage: data.detectedLanguage || null,
      skipped: data.skipped || false,
    }
  } catch (error) {
    console.error('Translation with detection error:', error)
    throw error
  }
}

/**
 * Translate Pro Advice content to a target language
 * Used for on-demand translation when viewing in full screen
 * 
 * @param content The original content to translate
 * @param targetLang The target language code
 * @param sourceLang Optional source language (if known from originalLanguage field)
 * @returns The translated content
 */
export async function translateProAdviceContent(
  content: string,
  targetLang: SupportedLanguage,
  sourceLang?: string | null
): Promise<string> {
  if (!content || content.trim() === '') return content

  // If source language is known and equals target, return original
  if (sourceLang && sourceLang.toLowerCase() === targetLang.toLowerCase()) {
    return content
  }

  // If source language is known, use standard translation
  if (sourceLang && SUPPORTED_LANGUAGES.includes(sourceLang.toLowerCase() as SupportedLanguage)) {
    return translateText(content, targetLang, sourceLang.toLowerCase() as SupportedLanguage)
  }

  // Otherwise, use translation with auto-detection
  const result = await translateWithDetection(content, targetLang)
  return result.translatedText
}
