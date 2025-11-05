/**
 * Plant Translation Utilities - Merge translations with base plant data
 * Optimized for reduced egress costs
 */

import { supabase } from './supabaseClient'
import type { SupportedLanguage } from './i18n'
import type { Plant } from '@/types/plant'

// Cache for plants data to reduce egress
const plantCache = new Map<string, { data: Plant[]; timestamp: number; language: SupportedLanguage }>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes cache
const MAX_CACHE_ENTRIES = 10 // Limit cache size

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
 * Get cache key for language
 */
function getCacheKey(language: SupportedLanguage): string {
  return `plants_${language}`
}

/**
 * Clear expired cache entries
 */
function cleanupCache(): void {
  const now = Date.now()
  for (const [key, value] of plantCache.entries()) {
    if (now - value.timestamp > CACHE_TTL_MS) {
      plantCache.delete(key)
    }
  }
  // If cache is still too large, remove oldest entries
  if (plantCache.size > MAX_CACHE_ENTRIES) {
    const entries = Array.from(plantCache.entries())
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
    const toRemove = entries.slice(0, plantCache.size - MAX_CACHE_ENTRIES)
    for (const [key] of toRemove) {
      plantCache.delete(key)
    }
  }
}

/**
 * Load plants with translations for a specific language
 * Always loads translations for the specified language, regardless of whether it's the default language.
 * This ensures plants created in one language display correctly when viewed in another language.
 * 
 * OPTIMIZED: Uses caching to reduce egress costs
 */
export async function loadPlantsWithTranslations(language: SupportedLanguage, useCache = true): Promise<Plant[]> {
  // Check cache first
  if (useCache) {
    cleanupCache()
    const cacheKey = getCacheKey(language)
    const cached = plantCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data
    }
  }

  try {
    // Load base plants - OPTIMIZED: Select only essential fields for list views
    // Full details can be loaded on-demand when viewing individual plants
    const { data: plants, error } = await supabase
      .from('plants')
      .select('id, name, scientific_name, colors, seasons, rarity, meaning, description, image_url, care_sunlight, care_water, care_soil, care_difficulty, seeds_available, water_freq_unit, water_freq_value, water_freq_period, water_freq_amount')
      .order('name', { ascending: true })
    
    if (error) throw error
    if (!plants || plants.length === 0) {
      const empty: Plant[] = []
      if (useCache) plantCache.set(getCacheKey(language), { data: empty, timestamp: Date.now(), language })
      return empty
    }
    
    // Always load translations for the specified language (including English)
    // This ensures plants created in one language display correctly in another
    // OPTIMIZED: Only select needed translation fields, not all columns
    const plantIds = plants.map(p => p.id)
    const { data: translations } = await supabase
      .from('plant_translations')
      .select('plant_id, language, name, scientific_name, meaning, description, care_soil')
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
    const result = plants.map(plant => {
      const translation = translationMap.get(plant.id)
      return mergePlantWithTranslation(plant, translation)
    })

    // Cache the result
    if (useCache) {
      cleanupCache()
      plantCache.set(getCacheKey(language), { data: result, timestamp: Date.now(), language })
    }

    return result
  } catch (error) {
    console.error('Failed to load plants with translations:', error)
    throw error
  }
}

/**
 * Clear the plant cache (useful after plant updates)
 */
export function clearPlantCache(): void {
  plantCache.clear()
}
