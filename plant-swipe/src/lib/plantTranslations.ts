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
}

let ensureSchemaPromise: Promise<boolean> | null = null

function isMissingColumnError(message?: string | null) {
  if (!message) return false
  const lower = message.toLowerCase()
  return lower.includes('plant_translation') && lower.includes('column')
}

function formatTranslationError(message: string) {
  if (isMissingColumnError(message)) {
    return new Error(
      `${message}. The database schema appears to be outdated. Please run the admin "Sync Schema" task or restart the PlantSwipe services to apply migrations.`
    )
  }
  return new Error(message)
}

async function buildAdminHeaders() {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
  try {
    const session = (await supabase.auth.getSession()).data.session
    const token = session?.access_token
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
  } catch {}

  try {
    const token = (globalThis as typeof globalThis & {
      __ENV__?: { VITE_ADMIN_STATIC_TOKEN?: unknown }
    }).__ENV__?.VITE_ADMIN_STATIC_TOKEN
    if (token) {
      headers['X-Admin-Token'] = String(token)
    }
  } catch {}

  return headers
}

async function ensurePlantTranslationsSchemaOnServer(force = false): Promise<boolean> {
  if (ensureSchemaPromise && !force) {
    try {
      return await ensureSchemaPromise
    } catch {
      ensureSchemaPromise = null
      return false
    }
  }

  ensureSchemaPromise = (async () => {
    try {
      const headers = await buildAdminHeaders()
      const response = await fetch('/api/admin/plant-translations/ensure-schema', {
        method: 'POST',
        headers,
        body: '{}',
      })
      if (!response.ok) {
        const text = await response.text().catch(() => '')
        throw new Error(text || `Ensure schema failed with status ${response.status}`)
      }
      return true
    } catch (err) {
      console.warn('[translations] Failed to ensure plant_translations schema', err)
      throw err instanceof Error ? err : new Error('Failed to ensure plant translation schema')
    }
  })()

  try {
    return await ensureSchemaPromise
  } catch {
    ensureSchemaPromise = null
    return false
  }
}

function mapTranslationToRow(t: PlantTranslation, timestamp: string) {
  return {
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
    scientific_name: t.scientific_name || null,
    meaning: t.meaning || null,
      description: t.description || null,
    updated_at: timestamp,
  }
}

async function upsertPlantTranslationRows(rows: any[]) {
  return supabase
    .from('plant_translations')
    .upsert(rows, { onConflict: 'plant_id,language' })
}

/**
 * Save or update a plant translation
 */
export async function savePlantTranslation(translation: PlantTranslation): Promise<{ error?: Error }> {
  const { error } = await savePlantTranslations([translation])
  return { error }
}

/**
 * Save multiple plant translations
 */
export async function savePlantTranslations(translations: PlantTranslation[]): Promise<{ error?: Error }> {
  if (!Array.isArray(translations) || translations.length === 0) {
    return {}
  }

  const timestamp = new Date().toISOString()
  const rows = translations.map((t) => mapTranslationToRow(t, timestamp))

  let lastError: Error | undefined

  try {
    await ensurePlantTranslationsSchemaOnServer()
    const { error } = await upsertPlantTranslationRows(rows)
    if (!error) {
      return {}
    }
    lastError = formatTranslationError(error.message)
    if (isMissingColumnError(error.message)) {
      await ensurePlantTranslationsSchemaOnServer(true)
      const retry = await upsertPlantTranslationRows(rows)
      if (!retry.error) {
        return {}
      }
      lastError = formatTranslationError(retry.error.message)
    }
  } catch (error) {
    lastError = error instanceof Error ? error : new Error('Failed to save translations')
  }

  return lastError ? { error: lastError } : {}
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
