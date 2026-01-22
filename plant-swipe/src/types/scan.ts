/**
 * Types for Plant Scan Feature
 * Using Kindwise Plant.id API for identification
 */

// Classification Level - controls the taxonomic depth of identification results
// - 'species': genus + species (default) - e.g., "Philodendron hederaceum"
// - 'all': genus + species + infraspecies (cultivars, varieties, subspecies) - e.g., "Philodendron hederaceum var. oxycardium 'Brasil'"
// - 'genus': genus only - e.g., "Philodendron"
export type ClassificationLevel = 'species' | 'all' | 'genus'

// API Response Types from Kindwise
export interface KindwiseSimilarImage {
  id: string
  url: string
  url_small?: string
  license_name?: string
  license_url?: string
  citation?: string
  similarity: number
}

export interface KindwiseSuggestionDetails {
  language: string
  entity_id: string
  // Additional taxonomy details when classification_level includes cultivars
  taxonomy?: {
    kingdom?: string
    phylum?: string
    class?: string
    order?: string
    family?: string
    genus?: string
    species?: string
    infraspecies?: string
  }
  common_names?: string[]
  synonyms?: string[]
}

export interface KindwiseSuggestion {
  id: string
  name: string
  probability: number
  similar_images?: KindwiseSimilarImage[]
  details?: KindwiseSuggestionDetails
}

export interface KindwiseIsPlantResult {
  probability: number
  binary: boolean
  threshold: number
}

export interface KindwiseClassificationResult {
  suggestions: KindwiseSuggestion[]
}

export interface KindwiseResult {
  is_plant: KindwiseIsPlantResult
  classification: KindwiseClassificationResult
}

export interface KindwiseInput {
  latitude?: number
  longitude?: number
  similar_images: boolean
  images: string[]
  datetime: string
  classification_level?: ClassificationLevel
}

export interface KindwiseApiResponse {
  access_token: string
  model_version: string
  custom_id?: string | null
  input: KindwiseInput
  result: KindwiseResult
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  sla_compliant_client: boolean
  sla_compliant_system: boolean
  created: number
  completed?: number
}

// App-side types
export type ScanStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface PlantScanSuggestion {
  id: string
  name: string
  scientificName?: string
  probability: number
  similarImages?: {
    id: string
    url: string
    urlSmall?: string
    similarity: number
    citation?: string
  }[]
  entityId?: string
  // If this suggestion matches a plant in our database
  matchedPlantId?: string
  // Taxonomy details when classification_level is 'all'
  genus?: string
  species?: string
  infraspecies?: string  // Cultivar, variety, subspecies, or trademark
  commonNames?: string[]
  synonyms?: string[]
}

export interface PlantScan {
  id: string
  userId: string
  
  // Image
  imageUrl: string
  imagePath?: string
  imageBucket?: string
  
  // API info
  apiAccessToken?: string
  apiModelVersion?: string
  apiStatus: ScanStatus
  apiResponse?: KindwiseApiResponse
  
  // Classification level used for this scan
  classificationLevel?: ClassificationLevel
  
  // Is plant check
  isPlant?: boolean
  isPlantProbability?: number
  
  // Top match
  topMatchName?: string
  topMatchScientificName?: string
  topMatchProbability?: number
  topMatchEntityId?: string
  
  // All suggestions
  suggestions: PlantScanSuggestion[]
  
  // Similar images
  similarImages?: KindwiseSimilarImage[]
  
  // Location
  latitude?: number
  longitude?: number
  
  // Matched to our DB
  matchedPlantId?: string
  matchedPlant?: {
    id: string
    name: string
    scientificName?: string
    image?: string
  }
  
  // User notes
  userNotes?: string
  
  // Timestamps
  createdAt: string
  updatedAt: string
  deletedAt?: string
}

// Request types
export interface CreateScanRequest {
  imageBase64: string  // Base64 encoded image
  latitude?: number
  longitude?: number
  classificationLevel?: ClassificationLevel
}

export interface UpdateScanRequest {
  userNotes?: string
  matchedPlantId?: string
}

// Upload result
export interface ScanImageUploadResult {
  ok: boolean
  url: string
  path: string
  bucket: string
  mimeType: string
  size: number
  originalSize?: number
  compressionPercent?: number
}
