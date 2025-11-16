import React from "react"
import { UploadCloud, Loader2, Check, Copy } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type UploadResult = {
  ok?: boolean
  bucket: string
  path: string
  url?: string | null
  warning?: string
  mimeType: string
  size: number
  originalMimeType: string
  originalSize: number
  uploadedAt?: string
  quality?: number
  compressionPercent?: number | null
}

type RuntimeEnv = {
  __ENV__?: Record<string, string | undefined>
}

const BYTES_IN_MB = 1024 * 1024
const DEFAULT_MAX_MB = 15

function formatBytes(value: number) {
  if (!Number.isFinite(value)) return "-"
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(2)} MB`
}

export const AdminUploadPanel: React.FC = () => {
  const [dragActive, setDragActive] = React.useState(false)
  const [uploading, setUploading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<UploadResult | null>(null)
  const [copiedField, setCopiedField] = React.useState<"url" | "path" | null>(null)
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const runtimeEnv = (globalThis as typeof globalThis & RuntimeEnv).__ENV__
  const adminToken =
    import.meta.env?.VITE_ADMIN_STATIC_TOKEN ?? runtimeEnv?.VITE_ADMIN_STATIC_TOKEN
  const compressionPct = React.useMemo(() => {
    if (typeof result?.compressionPercent === "number") {
      return Math.max(0, result.compressionPercent)
    }
    if (!result || !result.originalSize) return 0
    return Math.max(
      0,
      100 - Math.round((result.size / result.originalSize) * 100),
    )
  }, [result])

  const resetCopyState = React.useCallback(() => {
    setTimeout(() => setCopiedField(null), 1800)
  }, [])

  const copyToClipboard = React.useCallback(
    async (text: string, field: "url" | "path") => {
      try {
        await navigator.clipboard.writeText(text)
        setCopiedField(field)
        resetCopyState()
      } catch {
        setError("Unable to copy to clipboard. Please copy manually.")
      }
    },
    [resetCopyState],
  )

  const handleFile = React.useCallback(
    async (file: File | null) => {
      if (!file) return
      setError(null)
      if (!file.type.startsWith("image/")) {
        setError("Only image files are supported.")
        return
      }
      if (file.size > DEFAULT_MAX_MB * BYTES_IN_MB) {
        setError(`Please choose a file under ${DEFAULT_MAX_MB} MB.`)
        return
      }
      setUploading(true)
      setResult(null)
      try {
        const session = (await supabase.auth.getSession()).data.session
        const token = session?.access_token
        if (!token && !adminToken) {
          setError("You must be signed in as an admin to upload images.")
          return
        }
        const form = new FormData()
        form.append("file", file)
        const headers: Record<string, string> = {}
        if (token) headers["Authorization"] = `Bearer ${token}`
        if (adminToken) headers["X-Admin-Token"] = String(adminToken)
        const resp = await fetch("/api/admin/upload-image", {
          method: "POST",
          headers,
          body: form,
          credentials: "same-origin",
        })
        const data = await resp.json().catch(() => null)
        if (!resp.ok) {
          throw new Error(data?.error || "Upload failed")
        }
        setResult(data as UploadResult)
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Upload failed. Please try again."
        setError(message)
      } finally {
        setUploading(false)
        if (inputRef.current) inputRef.current.value = ""
      }
    },
    [adminToken],
  )

  const handleDrop = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      event.stopPropagation()
      setDragActive(false)
      const file = event.dataTransfer.files?.[0] || null
      void handleFile(file)
    },
    [handleFile],
  )

  const handleBrowseClick = React.useCallback(() => {
    inputRef.current?.click()
  }, [])

  const handleFileChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] || null
      void handleFile(file)
    },
    [handleFile],
  )

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl">
        <CardContent className="p-6 space-y-6">
          <div>
            <div className="text-xl font-semibold">Upload media</div>
            <p className="text-sm text-muted-foreground">
              Drop a single image to optimize it as WebP and store it under the
              Supabase <span className="font-medium">UTILITY</span> bucket.
            </p>
          </div>
          <div
            onDragOver={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (!dragActive) setDragActive(true)
            }}
            onDragEnter={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setDragActive(true)
            }}
            onDragLeave={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setDragActive(false)
            }}
            onDrop={handleDrop}
            className={cn(
              "rounded-3xl border-2 border-dashed p-8 text-center transition-colors",
              dragActive
                ? "border-emerald-500 bg-emerald-50/70 dark:bg-emerald-500/10"
                : "border-stone-200 dark:border-[#3e3e42] bg-white/60 dark:bg-[#1a1a1d]",
              uploading && "opacity-70 cursor-not-allowed",
            )}
            aria-disabled={uploading}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={handleFileChange}
              disabled={uploading}
            />
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-200">
              {uploading ? (
                <Loader2 className="h-8 w-8 animate-spin" />
              ) : (
                <UploadCloud className="h-8 w-8" />
              )}
            </div>
            <div className="text-lg font-medium">
              Drag &amp; drop an image or{" "}
              <button
                type="button"
                onClick={handleBrowseClick}
                className="text-emerald-600 underline underline-offset-4"
                disabled={uploading}
              >
                browse your files
              </button>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              PNG, JPG, WebP, HEIC, AVIF, GIF (first frame). Limit one file, max{" "}
              {DEFAULT_MAX_MB} MB. We will convert to WebP automatically.
            </p>
          </div>
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-100">
              {error}
            </div>
          )}
          {uploading && (
            <div className="text-sm text-muted-foreground">
              Uploading and optimizing... This usually takes just a few seconds.
            </div>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card className="rounded-2xl border-emerald-200/70 dark:border-emerald-500/30">
          <CardContent className="p-6 space-y-6">
            <div>
              <div className="text-lg font-semibold">Upload complete</div>
              <p className="text-sm text-muted-foreground">
                Stored in <span className="font-medium">{result.bucket}</span> at{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">
                  {result.path}
                </code>
                .
              </p>
            </div>
              {result.warning && (
                <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-900 dark:border-yellow-600/60 dark:bg-yellow-900/20 dark:text-yellow-100">
                  {result.warning}
                </div>
              )}
              {result.url && (
                <div>
                  <div className="text-xs font-semibold uppercase text-muted-foreground">
                    Public URL
                  </div>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <Input
                      readOnly
                      value={result.url ?? ""}
                      onFocus={(e) => e.currentTarget.select()}
                      className="rounded-2xl"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      className="rounded-2xl"
                      onClick={() => copyToClipboard(result.url || "", "url")}
                    >
                      {copiedField === "url" ? (
                        <>
                          <Check className="mr-2 h-4 w-4" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="mr-2 h-4 w-4" />
                          Copy URL
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border p-4 dark:border-[#3e3e42]">
                  <div className="text-xs font-semibold uppercase text-muted-foreground">
                    File details
                  </div>
                  <div className="mt-2 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Original</span>
                      <span>
                        {formatBytes(result.originalSize)} · {result.originalMimeType}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Optimized</span>
                      <span>
                        {formatBytes(result.size)} · {result.mimeType}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Compression</span>
                      <span>{compressionPct}% smaller</span>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border p-4 dark:border-[#3e3e42]">
                  <div className="text-xs font-semibold uppercase text-muted-foreground">
                    Storage path
                  </div>
                  <div className="mt-2 flex flex-col gap-2">
                    <Input
                      readOnly
                      value={result.path}
                      onFocus={(e) => e.currentTarget.select()}
                      className="rounded-2xl font-mono text-sm"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-2xl"
                      onClick={() => copyToClipboard(result.path, "path")}
                    >
                      {copiedField === "path" ? (
                        <>
                          <Check className="mr-2 h-4 w-4" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="mr-2 h-4 w-4" />
                          Copy path
                        </>
                      )}
                    </Button>
                    <div className="text-xs text-muted-foreground">
                      Use this path for Supabase Storage signed URLs or to reference the
                      asset elsewhere in the admin tools.
                    </div>
                  </div>
                </div>
              </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
