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
  ScanStatus
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

// ===== Image Upload =====

/**
 * Upload a scan image to Supabase storage
 * Uses server-side optimization endpoint
 */
export async function uploadScanImage(file: File): Promise<ScanImageUploadResult> {
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
  
  // Upload via server endpoint (handles optimization)
  const formData = new FormData()
  formData.append('file', file)
  
  const response = await fetch('/api/scan/upload-image', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`
    },
    body: formData
  })
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || 'Failed to upload image')
  }
  
  const data = await response.json()
  
  if (!data.ok || !data.url) {
    throw new Error('Failed to upload image: Invalid response')
  }
  
  return data as ScanImageUploadResult
}

/**
 * Convert a File to base64 string
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      const result = reader.result as string
      // Return just the base64 part if it's a data URL
      resolve(result)
    }
    reader.onerror = (error) => reject(error)
  })
}

// ===== API Integration =====

/**
 * Identify a plant using Kindwise Plant.id API
 * This calls our server endpoint which handles the API key
 */
export async function identifyPlant(
  imageBase64: string,
  options?: {
    latitude?: number
    longitude?: number
  }
): Promise<KindwiseApiResponse> {
  const session = (await supabase.auth.getSession()).data.session
  if (!session?.access_token) {
    throw new Error('Not authenticated')
  }
  
  const response = await fetch('/api/scan/identify', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      image: imageBase64,
      latitude: options?.latitude,
      longitude: options?.longitude,
      similar_images: true
    })
  })
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || 'Failed to identify plant')
  }
  
  return await response.json()
}

// ===== Database Operations =====

/**
 * Convert API response to app-friendly format
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
    entityId: s.details?.entity_id
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
  
  // Try to match with our database
  let matchedPlantId: string | undefined
  if (topMatch?.name) {
    const { data: matchedPlant } = await supabase
      .from('plants')
      .select('id')
      .or(`name.ilike.%${topMatch.name}%,scientific_name.ilike.%${topMatch.name}%`)
      .limit(1)
      .single()
    
    if (matchedPlant) {
      matchedPlantId = matchedPlant.id
    }
  }
  
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
    .select()
    .single()
  
  if (error) {
    console.error('[plantScan] Failed to create scan record:', error)
    throw new Error(error.message)
  }
  
  return transformDbRow(data)
}

/**
 * Get all scans for the current user
 */
export async function getUserScans(options?: {
  limit?: number
  offset?: number
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
  
  return (data || []).map(transformDbRow)
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
