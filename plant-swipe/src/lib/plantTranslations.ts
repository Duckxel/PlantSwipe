/**
 * Plant Translation Utilities
 * 
 * Functions to save and load plant translations from Supabase
 */

import { supabase } from './supabaseClient'
import type { SupportedLanguage } from './i18n'

export interface PlantTranslation {
  plant_id: string
  language: SupportedLanguage
  name: string
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
    // OPTIMIZED: Only select needed fields to reduce egress
    const { data, error } = await supabase
      .from('plant_translations')
      .select('plant_id, language, name, scientific_name, meaning, description, care_soil')
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
    // OPTIMIZED: Only select needed fields to reduce egress
    const { data, error } = await supabase
      .from('plant_translations')
      .select('plant_id, language, name, scientific_name, meaning, description, care_soil')
      .eq('plant_id', plantId)

    if (error) {
      return { error: new Error(error.message) }
    }

    return { data: (data || []) as PlantTranslation[] }
  } catch (error) {
    return { error: error instanceof Error ? error : new Error('Failed to load translations') }
  }
}
