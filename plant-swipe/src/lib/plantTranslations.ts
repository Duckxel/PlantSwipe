/**
 * Plant Translation Utilities
 * 
 * Functions to save and load plant translations from Supabase
 * Updated for new JSONB structure
 */

import { supabase } from './supabaseClient'
import type { SupportedLanguage } from './i18n'
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

export interface PlantTranslation {
  plant_id: string
  language: SupportedLanguage
  name: string
  // Translatable JSONB fields
  identifiers?: PlantIdentifiers
  ecology?: PlantEcology
  usage?: PlantUsage
  meta?: PlantMeta
  phenology?: PlantPhenology
  care?: PlantCare
  planting?: PlantPlanting
  problems?: PlantProblems
  // Legacy fields for backward compatibility
  scientific_name?: string | null
  meaning?: string | null
  description?: string | null
  care_soil?: string | null
}

/**
 * Save or update a plant translation
 */
export async function savePlantTranslation(translation: PlantTranslation): Promise<{ error?: Error }> {
  try {
    const { error } = await supabase
      .from('plant_translations')
        .upsert({
          plant_id: translation.plant_id,
          language: translation.language,
          name: translation.name,
          identifiers: translation.identifiers || null,
          ecology: translation.ecology || null,
          usage: translation.usage || null,
          meta: translation.meta || null,
          phenology: translation.phenology || null,
          care: translation.care || null,
          planting: translation.planting || null,
          problems: translation.problems || null,
          // Legacy fields
          scientific_name: translation.scientific_name || null,
          meaning: translation.meaning || null,
          description: translation.description || null,
          care_soil: translation.care_soil || null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'plant_id,language',
        })

    if (error) {
      return { error: new Error(error.message) }
    }

    return {}
  } catch (error) {
    return { error: error instanceof Error ? error : new Error('Failed to save translation') }
  }
}

/**
 * Save multiple plant translations
 */
export async function savePlantTranslations(translations: PlantTranslation[]): Promise<{ error?: Error }> {
  try {
      const data = translations.map(t => ({
        plant_id: t.plant_id,
        language: t.language,
        name: t.name,
        identifiers: t.identifiers || null,
        ecology: t.ecology || null,
        usage: t.usage || null,
        meta: t.meta || null,
        phenology: t.phenology || null,
        care: t.care || null,
        planting: t.planting || null,
        problems: t.problems || null,
        // Legacy fields
        scientific_name: t.scientific_name || null,
        meaning: t.meaning || null,
        description: t.description || null,
        care_soil: t.care_soil || null,
        updated_at: new Date().toISOString(),
      }))

    const { error } = await supabase
      .from('plant_translations')
      .upsert(data, {
        onConflict: 'plant_id,language',
      })

    if (error) {
      return { error: new Error(error.message) }
    }

    return {}
  } catch (error) {
    return { error: error instanceof Error ? error : new Error('Failed to save translations') }
  }
}

/**
 * Get plant translation for a specific language
 */
export async function getPlantTranslation(
  plantId: string,
  language: SupportedLanguage
): Promise<{ data?: PlantTranslation | null; error?: Error }> {
  try {
    const { data, error } = await supabase
      .from('plant_translations')
      .select('*')
      .eq('plant_id', plantId)
      .eq('language', language)
      .maybeSingle()

    if (error) {
      return { error: new Error(error.message) }
    }

    return { data: data as PlantTranslation | null }
  } catch (error) {
    return { error: error instanceof Error ? error : new Error('Failed to load translation') }
  }
}

/**
 * Get all translations for a plant
 */
export async function getPlantTranslations(plantId: string): Promise<{ data?: PlantTranslation[]; error?: Error }> {
  try {
    const { data, error } = await supabase
      .from('plant_translations')
      .select('*')
      .eq('plant_id', plantId)

    if (error) {
      return { error: new Error(error.message) }
    }

    return { data: (data || []) as PlantTranslation[] }
  } catch (error) {
    return { error: error instanceof Error ? error : new Error('Failed to load translations') }
  }
}
