import { supabase } from "@/lib/supabaseClient"
import type { PlantProAdvice, ProAdviceTranslations } from "@/types/proAdvice"
import type { UserRole } from "@/constants/userRoles"
import { detectLanguage } from "@/lib/deepl"

const ADVICE_SELECT = `
  id,
  plant_id,
  author_id,
  author_display_name,
  author_username,
  author_avatar_url,
  author_roles,
  content,
  original_language,
  translations,
  image_url,
  reference_url,
  metadata,
  created_at
`

const mapAdviceRow = (row: any): PlantProAdvice => ({
  id: row.id,
  plantId: row.plant_id,
  authorId: row.author_id,
  authorDisplayName: row.author_display_name ?? null,
  authorUsername: row.author_username ?? null,
  authorAvatarUrl: row.author_avatar_url ?? null,
  authorRoles: (row.author_roles as UserRole[] | null | undefined) ?? null,
  content: row.content,
  originalLanguage: row.original_language ?? null,
  translations: (row.translations as ProAdviceTranslations | null | undefined) ?? null,
  imageUrl: row.image_url ?? null,
  referenceUrl: row.reference_url ?? null,
  metadata: row.metadata ?? null,
  createdAt: row.created_at,
})

export async function fetchPlantProAdvices(plantId: string): Promise<PlantProAdvice[]> {
  const { data, error } = await supabase
    .from("plant_pro_advices")
    .select(ADVICE_SELECT)
    .eq("plant_id", plantId)
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)
  return (data || []).map(mapAdviceRow)
}

type CreatePlantProAdviceInput = {
  plantId: string
  authorId: string
  content: string
  imageUrl?: string | null
  referenceUrl?: string | null
  metadata?: Record<string, unknown> | null
  authorDisplayName?: string | null
  authorUsername?: string | null
  authorAvatarUrl?: string | null
  authorRoles?: UserRole[] | null
  /** If true, skip language detection (useful for testing) */
  skipLanguageDetection?: boolean
}

export async function createPlantProAdvice(input: CreatePlantProAdviceInput): Promise<PlantProAdvice> {
  // Detect the language of the content using DeepL
  let detectedLanguage: string | null = null
  if (!input.skipLanguageDetection) {
    try {
      detectedLanguage = await detectLanguage(input.content)
    } catch (err) {
      // Language detection failure is non-blocking - we still save the advice
      console.warn("Language detection failed for pro advice:", err)
    }
  }

  const payload = {
    plant_id: input.plantId,
    author_id: input.authorId,
    author_display_name: input.authorDisplayName ?? null,
    author_username: input.authorUsername ?? null,
    author_avatar_url: input.authorAvatarUrl ?? null,
    author_roles: input.authorRoles ?? [],
    content: input.content,
    original_language: detectedLanguage,
    translations: {},
    image_url: input.imageUrl ?? null,
    reference_url: input.referenceUrl ?? null,
    metadata: input.metadata ?? {},
  }

  const { data, error } = await supabase
    .from("plant_pro_advices")
    .insert(payload)
    .select(ADVICE_SELECT)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error("Pro advice could not be saved.")
  return mapAdviceRow(data)
}

export async function deletePlantProAdvice(id: string): Promise<void> {
  const { error } = await supabase.from("plant_pro_advices").delete().eq("id", id)
  if (error) throw new Error(error.message)
}

type UpdatePlantProAdviceInput = {
  id: string
  content?: string
  imageUrl?: string | null
  referenceUrl?: string | null
  metadata?: Record<string, unknown> | null
  /** If true, skip language re-detection when content changes */
  skipLanguageDetection?: boolean
}

export async function updatePlantProAdvice(input: UpdatePlantProAdviceInput): Promise<PlantProAdvice> {
  const payload: Record<string, unknown> = {}
  
  if (input.content !== undefined) {
    payload.content = input.content
    
    // Re-detect language if content has changed
    if (!input.skipLanguageDetection) {
      try {
        const detectedLanguage = await detectLanguage(input.content)
        payload.original_language = detectedLanguage
        // Clear translations when content changes as they're now stale
        payload.translations = {}
      } catch (err) {
        console.warn("Language re-detection failed for pro advice update:", err)
      }
    }
  }
  if (input.imageUrl !== undefined) {
    payload.image_url = input.imageUrl
  }
  if (input.referenceUrl !== undefined) {
    payload.reference_url = input.referenceUrl
  }
  if (input.metadata !== undefined) {
    payload.metadata = input.metadata ?? {}
  }

  const { data, error } = await supabase
    .from("plant_pro_advices")
    .update(payload)
    .eq("id", input.id)
    .select(ADVICE_SELECT)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error("Pro advice could not be updated.")
  return mapAdviceRow(data)
}

/**
 * Save a translation for a Pro Advice
 * Merges the new translation with existing translations in the database
 * 
 * @param adviceId The ID of the pro advice
 * @param languageCode The language code of the translation (e.g., 'en', 'fr')
 * @param translatedContent The translated content
 * @returns The updated PlantProAdvice
 */
export async function saveProAdviceTranslation(
  adviceId: string,
  languageCode: string,
  translatedContent: string
): Promise<PlantProAdvice> {
  // First, fetch the current translations
  const { data: current, error: fetchError } = await supabase
    .from("plant_pro_advices")
    .select("translations")
    .eq("id", adviceId)
    .maybeSingle()

  if (fetchError) throw new Error(fetchError.message)
  if (!current) throw new Error("Pro advice not found.")

  // Merge the new translation with existing ones
  const existingTranslations = (current.translations as ProAdviceTranslations) || {}
  const updatedTranslations = {
    ...existingTranslations,
    [languageCode.toLowerCase()]: translatedContent,
  }

  // Update with merged translations
  const { data, error } = await supabase
    .from("plant_pro_advices")
    .update({ translations: updatedTranslations })
    .eq("id", adviceId)
    .select(ADVICE_SELECT)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error("Pro advice translation could not be saved.")
  return mapAdviceRow(data)
}

/**
 * Get a translation for a Pro Advice, either from cache or by translating
 * If the translation doesn't exist in cache, it will be translated and saved
 * 
 * @param advice The PlantProAdvice object
 * @param targetLanguage The target language code
 * @returns Object with the translated content and whether it was from cache
 */
export async function getOrTranslateProAdvice(
  advice: PlantProAdvice,
  targetLanguage: string
): Promise<{ content: string; fromCache: boolean; updatedAdvice?: PlantProAdvice }> {
  const targetLang = targetLanguage.toLowerCase()
  
  // If target language is the same as original, return original content
  if (advice.originalLanguage?.toLowerCase() === targetLang) {
    return { content: advice.content, fromCache: true }
  }

  // Check if we have a cached translation
  if (advice.translations && advice.translations[targetLang as keyof ProAdviceTranslations]) {
    return { 
      content: advice.translations[targetLang as keyof ProAdviceTranslations]!, 
      fromCache: true 
    }
  }

  // Need to translate - import dynamically to avoid circular dependencies
  const { translateProAdviceContent } = await import("@/lib/deepl")
  
  const translatedContent = await translateProAdviceContent(
    advice.content,
    targetLang as any,
    advice.originalLanguage
  )

  // Save the translation for future use
  try {
    const updatedAdvice = await saveProAdviceTranslation(advice.id, targetLang, translatedContent)
    return { content: translatedContent, fromCache: false, updatedAdvice }
  } catch (err) {
    // If saving fails, still return the translation
    console.warn("Failed to save pro advice translation:", err)
    return { content: translatedContent, fromCache: false }
  }
}

type UploadOptions = {
  folder?: string
  signal?: AbortSignal
}

export async function uploadProAdviceImage(file: File, options?: UploadOptions): Promise<string> {
  if (!file) throw new Error("Missing file to upload.")
  if (!file.type.startsWith("image/")) throw new Error("Only image uploads are supported.")

  const session = await supabase.auth.getSession()
  const token = session?.data?.session?.access_token
  if (!token) {
    throw new Error("You must be signed in to upload an image.")
  }

  const form = new FormData()
  form.append("file", file)
  if (options?.folder) {
    form.append("folder", options.folder)
  }

  const response = await fetch("/api/pro-advice/upload-image", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
    credentials: "same-origin",
    signal: options?.signal,
  })

  const payload = await response.json().catch(() => ({} as any))
  if (!response.ok) {
    const message = payload?.error || "Failed to upload image."
    throw new Error(message)
  }

  const url = payload?.url || payload?.publicUrl
  if (!url) {
    throw new Error("Upload succeeded but no public URL was returned.")
  }
  return url as string
}
