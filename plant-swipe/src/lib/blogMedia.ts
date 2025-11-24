import { buildAdminRequestHeaders } from "@/lib/adminAuth"

export type BlogImageUploadResult = {
  ok?: boolean
  bucket: string
  path: string
  url?: string | null
  mimeType: string
  size: number
  originalMimeType: string
  originalSize: number
  uploadedAt?: string
  warning?: string
  quality?: number
  compressionPercent?: number | null
}

type UploadOptions = {
  folder?: string
  signal?: AbortSignal
}

export async function uploadBlogImage(
  file: File,
  options?: UploadOptions,
): Promise<BlogImageUploadResult> {
  if (!file) {
    throw new Error("Missing file to upload.")
  }
  if (!file.type.startsWith("image/")) {
    throw new Error("Only image files are supported.")
  }

  const headers = await buildAdminRequestHeaders()
  const form = new FormData()
  form.append("file", file)
  if (options?.folder) {
    form.append("folder", options.folder)
  }

  const response = await fetch("/api/blog/upload-image", {
    method: "POST",
    headers,
    body: form,
    signal: options?.signal,
    credentials: "same-origin",
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const message = payload?.error || "Failed to upload image."
    throw new Error(message)
  }

  return payload as BlogImageUploadResult
}
