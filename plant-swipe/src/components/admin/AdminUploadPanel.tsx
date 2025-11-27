import React from "react"
import { UploadCloud, Loader2, Check, Copy, FileImage, Sparkles } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { cn } from "@/lib/utils"
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
  quality?: number | null
  compressionPercent?: number | null
  optimized?: boolean
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
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-stone-900 dark:text-white flex items-center gap-2">
          <UploadCloud className="h-5 w-5 text-emerald-600" />
          Upload Media
        </h2>
        <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
          Drop an image to optimize and store it in the <span className="font-medium text-emerald-600">UTILITY</span> bucket
        </p>
      </div>

      {/* Drop Zone */}
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
          "relative rounded-2xl border-2 border-dashed p-12 text-center transition-all cursor-pointer",
          dragActive
            ? "border-emerald-500 bg-emerald-50/70 dark:bg-emerald-500/10 scale-[1.02]"
            : "border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] hover:border-emerald-300 dark:hover:border-emerald-800",
          uploading && "opacity-70 pointer-events-none",
        )}
        onClick={handleBrowseClick}
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
        
        <div className={cn(
          "mx-auto mb-6 w-20 h-20 rounded-3xl flex items-center justify-center transition-colors",
          dragActive 
            ? "bg-emerald-500 text-white" 
            : "bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 text-emerald-600 dark:text-emerald-400"
        )}>
          {uploading ? (
            <Loader2 className="h-10 w-10 animate-spin" />
          ) : (
            <UploadCloud className="h-10 w-10" />
          )}
        </div>
        
        <div className="text-lg font-semibold text-stone-900 dark:text-white mb-2">
          {dragActive ? (
            "Drop your image here"
          ) : uploading ? (
            "Uploading..."
          ) : (
            <>
              Drag & drop an image or{" "}
              <span className="text-emerald-600 dark:text-emerald-400">browse</span>
            </>
          )}
        </div>
        
        <p className="text-sm text-stone-500 dark:text-stone-400 max-w-sm mx-auto">
          PNG, JPG, WebP, HEIC, AVIF, GIF, SVG. Max {DEFAULT_MAX_MB} MB.
          <br />
          <span className="text-emerald-600 dark:text-emerald-400">PNG, JPG, WebP optimized automatically</span>
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-200">
          {error}
        </div>
      )}

      {/* Upload Progress */}
      {uploading && (
        <div className="rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] p-4">
          <div className="flex items-center gap-3 text-sm text-stone-600 dark:text-stone-400">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
            Optimizing and uploading... This usually takes a few seconds.
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="rounded-2xl border-2 border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-900/20 dark:to-[#1e1e20] p-6 space-y-6">
          {/* Success Header */}
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center flex-shrink-0">
              <Check className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-stone-900 dark:text-white">
                Upload Complete!
              </h3>
              <p className="text-sm text-stone-500 dark:text-stone-400 mt-0.5">
                Stored in <span className="font-medium">{result.bucket}</span>
              </p>
            </div>
          </div>

          {/* Warning */}
          {result.warning && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
              {result.warning}
            </div>
          )}

          {/* URL Copy */}
          {result.url && (
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-stone-500 dark:text-stone-400">
                Public URL
              </label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={result.url}
                  onFocus={(e) => e.currentTarget.select()}
                  className="rounded-xl font-mono text-sm bg-white dark:bg-[#1a1a1d]"
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="rounded-xl flex-shrink-0"
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
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Compression Stats or File Info */}
            <div className="rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1a1a1d] p-4">
              <div className="flex items-center gap-2 mb-3">
                {result.optimized !== false ? (
                  <Sparkles className="h-4 w-4 text-emerald-600" />
                ) : (
                  <FileImage className="h-4 w-4 text-blue-600" />
                )}
                <span className="text-xs font-semibold uppercase text-stone-500 dark:text-stone-400">
                  {result.optimized !== false ? "Optimization" : "File Info"}
                </span>
              </div>
              <div className="space-y-2 text-sm">
                {result.optimized !== false ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-stone-500">Original</span>
                      <span className="font-medium text-stone-700 dark:text-stone-300">
                        {formatBytes(result.originalSize)} · {result.originalMimeType}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">Optimized</span>
                      <span className="font-medium text-stone-700 dark:text-stone-300">
                        {formatBytes(result.size)} · {result.mimeType}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">Saved</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {compressionPct}% smaller
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span className="text-stone-500">Type</span>
                      <span className="font-medium text-stone-700 dark:text-stone-300">
                        {result.mimeType}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">Size</span>
                      <span className="font-medium text-stone-700 dark:text-stone-300">
                        {formatBytes(result.size)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">Status</span>
                      <span className="font-medium text-blue-600 dark:text-blue-400">
                        Uploaded as-is
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Storage Path */}
            <div className="rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1a1a1d] p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileImage className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-semibold uppercase text-stone-500 dark:text-stone-400">
                  Storage Path
                </span>
              </div>
              <div className="space-y-2">
                <Input
                  readOnly
                  value={result.path}
                  onFocus={(e) => e.currentTarget.select()}
                  className="rounded-lg font-mono text-xs bg-stone-50 dark:bg-[#2a2a2d]"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-lg w-full"
                  onClick={() => copyToClipboard(result.path, "path")}
                >
                  {copiedField === "path" ? (
                    <>
                      <Check className="mr-2 h-3.5 w-3.5" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-3.5 w-3.5" />
                      Copy Path
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Upload Another */}
          <Button
            type="button"
            variant="outline"
            className="w-full rounded-xl"
            onClick={() => {
              setResult(null)
              inputRef.current?.click()
            }}
          >
            <UploadCloud className="mr-2 h-4 w-4" />
            Upload Another
          </Button>
        </div>
      )}
    </div>
  )
}
