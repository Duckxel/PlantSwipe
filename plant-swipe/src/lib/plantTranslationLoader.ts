/**
 * Plant Translation Utilities - Merge translations with base plant data
 */

import { supabase } from './supabaseClient'
import type { SupportedLanguage } from './i18n'
import type { Plant } from '@/types/plant'

/**
 * Merge translation data with base plant data
 */
export function mergePlantWithTranslation(
  basePlant: any,
  translation: any | null
): Plant {
  return {
    id: String(basePlant.id),
    name: translation?.name || basePlant.name || '',
    scientificName: translation?.scientific_name || basePlant.scientific_name || '',
    colors: Array.isArray(basePlant.colors) ? basePlant.colors.map((c: unknown) => String(c)) : [],
    seasons: Array.isArray(basePlant.seasons) ? (basePlant.seasons as unknown[]).map((s) => String(s)) as Plant['seasons'] : [],
    rarity: (basePlant.rarity || 'Common') as Plant['rarity'],
    meaning: translation?.meaning || basePlant.meaning || '',
    description: translation?.description || basePlant.description || '',
    image: basePlant.image_url || basePlant.image || '',
    care: {
      sunlight: (basePlant.care_sunlight || basePlant.care?.sunlight || 'Low') as Plant['care']['sunlight'],
      water: (basePlant.care_water || basePlant.care?.water || 'Low') as Plant['care']['water'],
      soil: String(translation?.care_soil || basePlant.care_soil || basePlant.care?.soil || ''),
      difficulty: (basePlant.care_difficulty || basePlant.care?.difficulty || 'Easy') as Plant['care']['difficulty']
    },
    seedsAvailable: Boolean(basePlant.seeds_available ?? basePlant.seedsAvailable ?? false),
    waterFreqUnit: basePlant.water_freq_unit || basePlant.waterFreqUnit || undefined,
    waterFreqValue: basePlant.water_freq_value ?? basePlant.waterFreqValue ?? null,
    waterFreqPeriod: basePlant.water_freq_period || basePlant.waterFreqPeriod || undefined,
    waterFreqAmount: basePlant.water_freq_amount ?? basePlant.waterFreqAmount ?? null
  }
}

/**
 * Load plants with translations for a specific language
 * Always loads translations for the specified language, regardless of whether it's the default language.
 * This ensures plants created in one language display correctly when viewed in another language.
 */
export async function loadPlantsWithTranslations(language: SupportedLanguage): Promise<Plant[]> {
  try {
    // Load base plants
    const { data: plants, error } = await supabase
      .from('plants')
      .select('id, name, scientific_name, colors, seasons, rarity, meaning, description, image_url, care_sunlight, care_water, care_soil, care_difficulty, seeds_available, water_freq_unit, water_freq_value, water_freq_period, water_freq_amount')
      .order('name', { ascending: true })
    
    if (error) throw error
    if (!plants || plants.length === 0) return []
    
    // Always load translations for the specified language (including English)
    // This ensures plants created in one language display correctly in another
    const plantIds = plants.map(p => p.id)
    const { data: translations } = await supabase
      .from('plant_translations')
      .select('*')
      .eq('language', language)
      .in('plant_id', plantIds)
    
    // Create a map of translations by plant_id
    const translationMap = new Map()
    if (translations) {
      translations.forEach(t => {
        translationMap.set(t.plant_id, t)
      })
    }
    
    // Merge translations with base plants
    // If a translation exists, it will override the base plant data
    return plants.map(plant => {
      const translation = translationMap.get(plant.id)
      return mergePlantWithTranslation(plant, translation)
    })
  } catch (error) {
    console.error('Failed to load plants with translations:', error)
    throw error
  }
}
