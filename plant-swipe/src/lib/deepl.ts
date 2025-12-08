/**
 * DeepL Translation Service
 * 
 * Translates plant data between supported languages using DeepL API
 * Requires DEEPL_API_KEY environment variable on the server
 * Updated for new JSONB structure
 */

import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, type SupportedLanguage } from './i18n'
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
 * Translate text using DeepL API via backend endpoint
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
    console.log(`[deepl] Translating "${text.slice(0, 30)}..." from ${sourceLang} to ${targetLang}`)
    
    // Call backend endpoint that has the DeepL API key
    const response = await fetch('/api/translate', {
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
      console.error('[deepl] API error:', response.status, errorData)
      throw new Error(errorData.error || `Translation API error: ${response.statusText}`)
    }

    const data = await response.json()
    const translatedText = data.translatedText || protectedText
    
    console.log(`[deepl] Translation success: "${translatedText.slice(0, 30)}..."`)
    
    // Restore template variables after translation
    return restoreTemplateVariables(translatedText, variableMap)
  } catch (error) {
    console.error('[deepl] Translation error:', error)
    // Throw error so caller can handle it
    throw error
  }
}

/**
 * Translate array of strings
 */
export async function translateArray(
  items: string[],
  targetLang: SupportedLanguage,
  sourceLang: SupportedLanguage = DEFAULT_LANGUAGE
): Promise<string[]> {
  if (!items || items.length === 0) return items
  if (sourceLang === targetLang) return items
  
  const translated = await Promise.all(
    items.map(item => translateText(item, targetLang, sourceLang))
  )
  return translated
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
    const response = await fetch('/api/translate', {
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
