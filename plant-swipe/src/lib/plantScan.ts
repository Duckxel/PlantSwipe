/**
 * Plant Scan Library
 * 
 * Handles plant identification using Kindwise Plant.id API
 * Includes image upload, API calls, and database operations
 */

import { supabase } from './supabaseClient'
import type { 
  PlantScan, 
  PlantScanSuggestion, 
  KindwiseApiResponse,
  ScanImageUploadResult,
  ScanStatus,
  ClassificationLevel
} from '@/types/scan'

// ===== Constants =====
const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif', 'image/avif']

// ===== Error Handling =====
const isMissingTableError = (error?: { message?: string; code?: string }) => {
  if (!error) return false
  if (error.message?.includes('does not exist')) return true
  if (error.code === '42P01') return true
  return false
}

// ===== Combined Upload + Identify =====

/**
 * Result from the combined upload and identify endpoint
 */
export interface UploadAndIdentifyResult {
  ok: boolean
  upload: ScanImageUploadResult
  identification: KindwiseApiResponse
}

/**
 * Upload and identify a plant image in a single request
 * Uses the same optimization pipeline as all other uploads (Admin, Garden Cover, Messages)
 * - Converts to WebP with sharp optimization
 * - Uploads to PHOTOS bucket under scans/{userId}/
 * - Calls Kindwise API with the optimized image
 * - Records in admin_media_uploads table
 * 
 * @param file - The image file to upload and identify
 * @param options - Optional parameters for identification
 * @param options.latitude - Geographic coordinate for better accuracy
 * @param options.longitude - Geographic coordinate for better accuracy
 * @param options.classificationLevel - Level of taxonomic detail in results:
 *   - 'species': genus + species (default) - e.g., "Philodendron hederaceum"
 *   - 'all': includes cultivars/varieties - e.g., "Philodendron hederaceum var. oxycardium 'Brasil'"
 *   - 'genus': genus only - e.g., "Philodendron"
 */
export async function uploadAndIdentifyPlant(
  file: File,
  options?: {
    latitude?: number
    longitude?: number
    classificationLevel?: ClassificationLevel
  }
): Promise<UploadAndIdentifyResult> {
  const session = (await supabase.auth.getSession()).data.session
  if (!session?.access_token) {
    throw new Error('Not authenticated')
  }
  
  // Validate file type
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Invalid file type. Only JPEG, PNG, GIF, WebP, HEIC, and AVIF are allowed.')
  }
  
  // Validate file size
  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error('File too large. Maximum size is 10MB.')
  }
  
  // Upload via server endpoint (handles optimization + identification in one request)
  const formData = new FormData()
  formData.append('file', file)
  if (options?.latitude !== undefined) {
    formData.append('latitude', String(options.latitude))
  }
  if (options?.longitude !== undefined) {
    formData.append('longitude', String(options.longitude))
  }
  if (options?.classificationLevel) {
    formData.append('classification_level', options.classificationLevel)
  }
  
  const response = await fetch('/api/scan/upload-and-identify', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`
    },
    body: formData
  })
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || 'Failed to scan plant')
  }
  
  const data = await response.json()
  
  if (!data.ok || !data.upload || !data.identification) {
    throw new Error('Failed to scan plant: Invalid response')
  }
  
  return data as UploadAndIdentifyResult
}

// Legacy functions for backwards compatibility

/**
 * @deprecated Use uploadAndIdentifyPlant instead
 */
export async function uploadScanImage(file: File): Promise<ScanImageUploadResult> {
  const result = await uploadAndIdentifyPlant(file)
  return result.upload
}

/**
 * @deprecated Use uploadAndIdentifyPlant instead - no longer sends base64 over network
 */
export async function identifyPlant(
  _imageBase64: string,
  _options?: {
    latitude?: number
    longitude?: number
  }
): Promise<KindwiseApiResponse> {
  throw new Error('identifyPlant is deprecated. Use uploadAndIdentifyPlant instead.')
}

/**
 * Convert a File to base64 string
 * @deprecated No longer needed - server handles image processing
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      const result = reader.result as string
      resolve(result)
    }
    reader.onerror = (error) => reject(error)
  })
}

// ===== Database Operations =====

/**
 * Convert API response to app-friendly format
 * Extracts taxonomy details including cultivar/infraspecies when classification_level='all'
 */
function transformApiResponse(apiResponse: KindwiseApiResponse): {
  isPlant: boolean
  isPlantProbability: number
  topMatch?: PlantScanSuggestion
  suggestions: PlantScanSuggestion[]
} {
  const isPlant = apiResponse.result.is_plant.binary
  const isPlantProbability = apiResponse.result.is_plant.probability
  
  const suggestions: PlantScanSuggestion[] = apiResponse.result.classification.suggestions.map(s => ({
    id: s.id,
    name: s.name,
    probability: s.probability,
    similarImages: s.similar_images?.map(img => ({
      id: img.id,
      url: img.url,
      urlSmall: img.url_small,
      similarity: img.similarity,
      citation: img.citation
    })),
    entityId: s.details?.entity_id,
    // Extract taxonomy details when available (classification_level='all')
    genus: s.details?.taxonomy?.genus,
    species: s.details?.taxonomy?.species,
    infraspecies: s.details?.taxonomy?.infraspecies,
    commonNames: s.details?.common_names,
    synonyms: s.details?.synonyms
  }))
  
  const topMatch = suggestions.length > 0 ? suggestions[0] : undefined
  
  return {
    isPlant,
    isPlantProbability,
    topMatch,
    suggestions
  }
}

/**
 * Try to find a matching plant in our database
 * Uses multiple search strategies for best matching
 * All strategies are executed before returning - Request Plant should only appear after this completes
 */
async function findMatchingPlant(topMatch: PlantScanSuggestion | undefined): Promise<string | undefined> {
  if (!topMatch?.name) {
    console.log('[plantScan] No plant name to match')
    return undefined
  }
  
  console.log('[plantScan] Starting database match for:', topMatch.name)
  console.log('[plantScan] Taxonomy info - Genus:', topMatch.genus, 'Species:', topMatch.species, 'Infraspecies:', topMatch.infraspecies)
  
  try {
    // Strategy 1: Exact name match (case-insensitive)
    const { data: exactMatch, error: exactError } = await supabase
      .from('plants')
      .select('id, name, scientific_name')
      .or(`name.ilike.${topMatch.name},scientific_name.ilike.${topMatch.name}`)
      .limit(1)
      .single()
    
    if (exactMatch && !exactError) {
      console.log('[plantScan] ✓ Strategy 1 (exact match) found:', exactMatch.name)
      return exactMatch.id
    }
    
    // Strategy 2: Build scientific name from genus + species and search
    if (topMatch.genus && topMatch.species) {
      const scientificName = `${topMatch.genus} ${topMatch.species}`
      console.log('[plantScan] Trying Strategy 2 with scientific name:', scientificName)
      
      const { data: scientificMatch, error: sciError } = await supabase
        .from('plants')
        .select('id, name, scientific_name')
        .or(`scientific_name.ilike.${scientificName},scientific_name.ilike.${scientificName}%`)
        .limit(1)
        .single()
      
      if (scientificMatch && !sciError) {
        console.log('[plantScan] ✓ Strategy 2 (scientific name) found:', scientificMatch.name)
        return scientificMatch.id
      }
    }
    
    // Strategy 3: Partial name match (contains)
    const { data: partialMatch, error: partialError } = await supabase
      .from('plants')
      .select('id, name, scientific_name')
      .or(`name.ilike.%${topMatch.name}%,scientific_name.ilike.%${topMatch.name}%`)
      .limit(1)
      .single()
    
    if (partialMatch && !partialError) {
      console.log('[plantScan] ✓ Strategy 3 (partial match) found:', partialMatch.name)
      return partialMatch.id
    }
    
    // Strategy 4: Search by genus only if we have it
    if (topMatch.genus) {
      console.log('[plantScan] Trying Strategy 4 with genus:', topMatch.genus)
      
      const { data: genusMatch, error: genusError } = await supabase
        .from('plants')
        .select('id, name, scientific_name')
        .or(`scientific_name.ilike.${topMatch.genus}%,name.ilike.%${topMatch.genus}%`)
        .limit(1)
        .single()
      
      if (genusMatch && !genusError) {
        console.log('[plantScan] ✓ Strategy 4 (genus match) found:', genusMatch.name)
        return genusMatch.id
      }
    }
    
    // Strategy 5: Search by common names if available
    if (topMatch.commonNames && topMatch.commonNames.length > 0) {
      console.log('[plantScan] Trying Strategy 5 with common names:', topMatch.commonNames.slice(0, 3))
      
      for (const commonName of topMatch.commonNames.slice(0, 3)) {
        const { data: commonNameMatch, error: commonError } = await supabase
          .from('plants')
          .select('id, name, scientific_name')
          .or(`name.ilike.%${commonName}%,scientific_name.ilike.%${commonName}%`)
          .limit(1)
          .single()
        
        if (commonNameMatch && !commonError) {
          console.log('[plantScan] ✓ Strategy 5 (common name) found:', commonNameMatch.name, 'via', commonName)
          return commonNameMatch.id
        }
      }
    }
    
    console.log('[plantScan] ✗ No match found after all 5 strategies')
    return undefined
    
  } catch (err) {
    console.error('[plantScan] Error during database matching:', err)
    return undefined
  }
}

/**
 * Create a new plant scan record
 */
export async function createPlantScan(
  imageUrl: string,
  imagePath: string,
  apiResponse: KindwiseApiResponse,
  options?: {
    latitude?: number
    longitude?: number
  }
): Promise<PlantScan> {
  const session = (await supabase.auth.getSession()).data.session
  if (!session?.user?.id) {
    throw new Error('Not authenticated')
  }
  
  const { isPlant, isPlantProbability, topMatch, suggestions } = transformApiResponse(apiResponse)
  
  // Try to match with our database using multiple strategies
  const matchedPlantId = await findMatchingPlant(topMatch)
  
  // Log the matching result for debugging
  console.log('[plantScan] Database match result:', matchedPlantId ? `Found plant ID: ${matchedPlantId}` : 'No match found')
  
  const { data, error } = await supabase
    .from('plant_scans')
    .insert({
      user_id: session.user.id,
      image_url: imageUrl,
      image_path: imagePath,
      image_bucket: 'PHOTOS',
      api_access_token: apiResponse.access_token,
      api_model_version: apiResponse.model_version,
      api_status: apiResponse.status.toLowerCase(),
      api_response: apiResponse,
      is_plant: isPlant,
      is_plant_probability: isPlantProbability,
      top_match_name: topMatch?.name,
      top_match_scientific_name: topMatch?.name, // API doesn't separate these
      top_match_probability: topMatch?.probability,
      top_match_entity_id: topMatch?.entityId,
      suggestions: suggestions,
      similar_images: topMatch?.similarImages || [],
      latitude: options?.latitude,
      longitude: options?.longitude,
      matched_plant_id: matchedPlantId
    })
    .select(`
      *,
      matched_plant:plants(id, name, scientific_name)
    `)
    .single()
  
  if (error) {
    console.error('[plantScan] Failed to create scan record:', error)
    throw new Error(error.message)
  }
  
  return transformDbRow(data)
}

/**
 * Re-check if a scan now has a matching plant in the database
 * This is useful when plants are added after the scan was created
 * Updates the scan record if a new match is found
 */
async function recheckScanMatch(scan: any): Promise<any> {
  // Skip if already has a match
  if (scan.matched_plant_id || scan.matched_plant) {
    return scan
  }
  
  // Skip if no top match name to search for
  if (!scan.top_match_name) {
    return scan
  }
  
  // Build a suggestion object from the scan data for findMatchingPlant
  const suggestion: PlantScanSuggestion = {
    id: scan.top_match_entity_id || '',
    name: scan.top_match_name,
    probability: scan.top_match_probability || 0,
    // Try to extract taxonomy from suggestions if available
    genus: scan.suggestions?.[0]?.genus,
    species: scan.suggestions?.[0]?.species,
    infraspecies: scan.suggestions?.[0]?.infraspecies,
    commonNames: scan.suggestions?.[0]?.commonNames
  }
  
  // Try to find a match
  const matchedPlantId = await findMatchingPlant(suggestion)
  
  if (matchedPlantId) {
    console.log('[plantScan] Re-check found new match for scan:', scan.id, '-> plant:', matchedPlantId)
    
    // Update the scan record with the new match
    const { data: updatedScan, error } = await supabase
      .from('plant_scans')
      .update({ matched_plant_id: matchedPlantId })
      .eq('id', scan.id)
      .select(`
        *,
        matched_plant:plants(id, name, scientific_name)
      `)
      .single()
    
    if (!error && updatedScan) {
      return updatedScan
    }
  }
  
  return scan
}

/**
 * Get all scans for the current user
 * Automatically re-checks unmatched scans for new database matches
 */
export async function getUserScans(options?: {
  limit?: number
  offset?: number
  recheckMatches?: boolean
}): Promise<PlantScan[]> {
  const session = (await supabase.auth.getSession()).data.session
  if (!session?.user?.id) {
    throw new Error('Not authenticated')
  }
  
  let query = supabase
    .from('plant_scans')
    .select(`
      *,
      matched_plant:plants(id, name, scientific_name)
    `)
    .eq('user_id', session.user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  
  if (options?.limit) {
    query = query.limit(options.limit)
  }
  
  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 20) - 1)
  }
  
  const { data, error } = await query
  
  if (error) {
    if (isMissingTableError(error)) {
      return []
    }
    throw new Error(error.message)
  }
  
  // Re-check unmatched scans for new database matches (default: enabled)
  const shouldRecheck = options?.recheckMatches !== false
  let scans = data || []
  
  if (shouldRecheck) {
    // Only re-check scans without matches (limit to first 10 to avoid too many queries)
    const unmatchedScans = scans.filter(s => !s.matched_plant_id && s.top_match_name)
    const scansToRecheck = unmatchedScans.slice(0, 10)
    
    if (scansToRecheck.length > 0) {
      console.log('[plantScan] Re-checking', scansToRecheck.length, 'unmatched scans for new database matches')
      
      // Re-check in parallel, but handle individual failures gracefully
      const recheckResults = await Promise.allSettled(
        scansToRecheck.map(scan => recheckScanMatch(scan))
      )
      
      const recheckedScans = recheckResults
        .filter((result): result is PromiseFulfilledResult<PlantScan> => result.status === 'fulfilled')
        .map(result => result.value)
      
      // Optional: log failed rechecks without failing the whole operation
      const failedRechecks = recheckResults.filter(result => result.status === 'rejected')
      if (failedRechecks.length > 0) {
        console.warn('[plantScan] Failed to re-check some scans', failedRechecks.length)
      }
      
      // Merge successfully rechecked scans back into the list
      const recheckedMap = new Map(recheckedScans.map(s => [s.id, s]))
      scans = scans.map(s => recheckedMap.get(s.id) || s)
    }
  }
  
  return scans.map(transformDbRow)
}

/**
 * Get a single scan by ID
 */
export async function getScanById(scanId: string): Promise<PlantScan | null> {
  const { data, error } = await supabase
    .from('plant_scans')
    .select(`
      *,
      matched_plant:plants(id, name, scientific_name)
    `)
    .eq('id', scanId)
    .is('deleted_at', null)
    .single()
  
  if (error) {
    if (error.code === 'PGRST116') {
      return null // Not found
    }
    throw new Error(error.message)
  }
  
  return transformDbRow(data)
}

/**
 * Update a scan (notes, matched plant)
 */
export async function updateScan(
  scanId: string,
  updates: {
    userNotes?: string
    matchedPlantId?: string | null
  }
): Promise<PlantScan> {
  const session = (await supabase.auth.getSession()).data.session
  if (!session?.user?.id) {
    throw new Error('Not authenticated')
  }
  
  const { data, error } = await supabase
    .from('plant_scans')
    .update({
      user_notes: updates.userNotes,
      matched_plant_id: updates.matchedPlantId
    })
    .eq('id', scanId)
    .eq('user_id', session.user.id)
    .select(`
      *,
      matched_plant:plants(id, name, scientific_name)
    `)
    .single()
  
  if (error) {
    throw new Error(error.message)
  }
  
  return transformDbRow(data)
}

/**
 * Soft delete a scan
 */
export async function deleteScan(scanId: string): Promise<void> {
  const session = (await supabase.auth.getSession()).data.session
  if (!session?.user?.id) {
    throw new Error('Not authenticated')
  }
  
  const { error } = await supabase
    .from('plant_scans')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', scanId)
    .eq('user_id', session.user.id)
  
  if (error) {
    throw new Error(error.message)
  }
}

/**
 * Transform database row to PlantScan type
 */
function transformDbRow(row: any): PlantScan {
  return {
    id: row.id,
    userId: row.user_id,
    imageUrl: row.image_url,
    imagePath: row.image_path,
    imageBucket: row.image_bucket,
    apiAccessToken: row.api_access_token,
    apiModelVersion: row.api_model_version,
    apiStatus: row.api_status as ScanStatus,
    apiResponse: row.api_response,
    isPlant: row.is_plant,
    isPlantProbability: row.is_plant_probability,
    topMatchName: row.top_match_name,
    topMatchScientificName: row.top_match_scientific_name,
    topMatchProbability: row.top_match_probability,
    topMatchEntityId: row.top_match_entity_id,
    suggestions: row.suggestions || [],
    similarImages: row.similar_images || [],
    latitude: row.latitude,
    longitude: row.longitude,
    matchedPlantId: row.matched_plant_id,
    matchedPlant: row.matched_plant ? {
      id: row.matched_plant.id,
      name: row.matched_plant.name,
      scientificName: row.matched_plant.scientific_name
    } : undefined,
    userNotes: row.user_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at
  }
}

// ===== Scan Count =====

/**
 * Get total scan count for user
 */
export async function getUserScanCount(): Promise<number> {
  const session = (await supabase.auth.getSession()).data.session
  if (!session?.user?.id) {
    return 0
  }
  
  const { count, error } = await supabase
    .from('plant_scans')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', session.user.id)
    .is('deleted_at', null)
  
  if (error) {
    console.warn('[plantScan] Failed to get scan count:', error)
    return 0
  }
  
  return count || 0
}

// ===== Helper Functions =====

/**
 * Format probability as percentage string
 */
export function formatProbability(probability: number): string {
  return `${(probability * 100).toFixed(1)}%`
}

/**
 * Get confidence level label based on probability
 */
export function getConfidenceLevel(probability: number): {
  level: 'high' | 'medium' | 'low'
  label: string
  color: string
} {
  if (probability >= 0.8) {
    return { level: 'high', label: 'High Confidence', color: 'text-emerald-600 dark:text-emerald-400' }
  }
  if (probability >= 0.5) {
    return { level: 'medium', label: 'Medium Confidence', color: 'text-amber-600 dark:text-amber-400' }
  }
  return { level: 'low', label: 'Low Confidence', color: 'text-red-600 dark:text-red-400' }
}
