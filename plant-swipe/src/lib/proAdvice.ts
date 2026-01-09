import { supabase } from "@/lib/supabaseClient"
import type { PlantProAdvice } from "@/types/proAdvice"
import type { UserRole } from "@/constants/userRoles"

const ADVICE_SELECT = `
  id,
  plant_id,
  author_id,
  author_display_name,
  author_username,
  author_avatar_url,
  author_roles,
  content,
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
}

export async function createPlantProAdvice(input: CreatePlantProAdviceInput): Promise<PlantProAdvice> {
  const payload = {
    plant_id: input.plantId,
    author_id: input.authorId,
    author_display_name: input.authorDisplayName ?? null,
    author_username: input.authorUsername ?? null,
    author_avatar_url: input.authorAvatarUrl ?? null,
    author_roles: input.authorRoles ?? [],
    content: input.content,
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
}

export async function updatePlantProAdvice(input: UpdatePlantProAdviceInput): Promise<PlantProAdvice> {
  const payload: Record<string, unknown> = {}
  
  if (input.content !== undefined) {
    payload.content = input.content
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
