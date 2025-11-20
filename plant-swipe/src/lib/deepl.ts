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
