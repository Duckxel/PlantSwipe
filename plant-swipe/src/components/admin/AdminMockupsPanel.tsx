import React from "react"
import {
  UploadCloud,
  Loader2,
  Check,
  Copy,
  FileImage,
  Sparkles,
  Trash2,
  ExternalLink,
  RefreshCw,
  Search,
  X,
  Calendar,
  HardDrive,
  User,
  ImageIcon,
  Smartphone,
} from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { SearchInput } from "@/components/ui/search-input"

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

type MediaEntry = {
  id: string
  adminId: string | null
  adminEmail: string | null
  adminName: string | null
  bucket: string
  path: string
  url: string | null
  mimeType: string | null
  originalMimeType: string | null
  sizeBytes: number | null
  originalSizeBytes: number | null
  quality: number | null
  compressionPercent: number | null
  uploadSource: string | null
  metadata?: {
    originalName?: string | null
    originalUploadName?: string | null
    storageName?: string | null
    displayName?: string | null
    typeSegment?: string | null
    [key: string]: unknown
  } | null
  createdAt: string | null
}

type RuntimeEnv = {
  __ENV__?: Record<string, string | undefined>
}

const BYTES_IN_MB = 1024 * 1024
const DEFAULT_MAX_MB = 15

function formatBytes(value?: number | null) {
  if (!Number.isFinite(value || 0) || !value) return "-"
  if (value < 1024) return `${value} B`
  if (value < BYTES_IN_MB) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / BYTES_IN_MB).toFixed(2)} MB`
}

function formatRelativeTime(value?: string | null) {
  if (!value) return "-"
  try {
    const date = new Date(value)
    const diffMs = Date.now() - date.getTime()
    const minutes = Math.floor(diffMs / (1000 * 60))
    if (minutes < 1) return "just now"
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString()
  } catch {
    return "-"
  }
}

export const AdminMockupsPanel: React.FC = () => {
  // Upload state
  const [dragActive, setDragActive] = React.useState(false)
  const [uploading, setUploading] = React.useState(false)
  const [uploadError, setUploadError] = React.useState<string | null>(null)
  const [uploadResult, setUploadResult] = React.useState<UploadResult | null>(null)
  const [copiedField, setCopiedField] = React.useState<"url" | "path" | null>(null)
  const [optimize, setOptimize] = React.useState(true)
  const inputRef = React.useRef<HTMLInputElement | null>(null)

  // Library state
  const [entries, setEntries] = React.useState<MediaEntry[]>([])
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [copiedId, setCopiedId] = React.useState<string | null>(null)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [selectedEntry, setSelectedEntry] = React.useState<MediaEntry | null>(null)

  const runtimeEnv = (globalThis as typeof globalThis & RuntimeEnv).__ENV__
  const adminToken =
    import.meta.env?.VITE_ADMIN_STATIC_TOKEN ?? runtimeEnv?.VITE_ADMIN_STATIC_TOKEN

  const compressionPct = React.useMemo(() => {
    if (typeof uploadResult?.compressionPercent === "number") {
      return Math.max(0, uploadResult.compressionPercent)
    }
    if (!uploadResult || !uploadResult.originalSize) return 0
    return Math.max(
      0,
      100 - Math.round((uploadResult.size / uploadResult.originalSize) * 100),
    )
  }, [uploadResult])

  // Fetch mockup images
  const fetchMockups = React.useCallback(
    async ({ showSpinner = false }: { showSpinner?: boolean } = {}) => {
      setError(null)
      if (showSpinner) setRefreshing(true)
      try {
        if (!showSpinner) setLoading(true)
        const session = (await supabase.auth.getSession()).data.session
        const token = session?.access_token
        if (!token && !adminToken) {
          setError("You must be signed in as an admin to view mockups.")
          setEntries([])
          return
        }
        const headers: Record<string, string> = { Accept: "application/json" }
        if (token) headers["Authorization"] = `Bearer ${token}`
        if (adminToken) headers["X-Admin-Token"] = String(adminToken)
        
        // Fetch only mockups source
        const params = new URLSearchParams({ limit: "200", source: "mockups" })
        
        const resp = await fetch(`/api/admin/media?${params.toString()}`, {
          method: "GET",
          headers,
          credentials: "same-origin",
        })
        const data = await resp.json().catch(() => null)
        if (!resp.ok) {
          throw new Error(data?.error || "Failed to load mockups")
        }
        setEntries(Array.isArray(data?.media) ? data.media : [])
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load mockups"
        setError(message)
        setEntries([])
      } finally {
        if (showSpinner) setRefreshing(false)
        setLoading(false)
      }
    },
    [adminToken],
  )

  React.useEffect(() => {
    fetchMockups().catch(() => {})
  }, [fetchMockups])

  // Upload functions
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
        setUploadError("Unable to copy to clipboard. Please copy manually.")
      }
    },
    [resetCopyState],
  )

  const handleFile = React.useCallback(
    async (file: File | null) => {
      if (!file) return
      setUploadError(null)
      if (!file.type.startsWith("image/")) {
        setUploadError("Only image files are supported.")
        return
      }
      if (file.size > DEFAULT_MAX_MB * BYTES_IN_MB) {
        setUploadError(`Please choose a file under ${DEFAULT_MAX_MB} MB.`)
        return
      }
      setUploading(true)
      setUploadResult(null)
      try {
        const session = (await supabase.auth.getSession()).data.session
        const token = session?.access_token
        if (!token && !adminToken) {
          setUploadError("You must be signed in as an admin to upload images.")
          return
        }
        const form = new FormData()
        form.append("file", file)
        form.append("optimize", optimize ? "true" : "false")
        form.append("folder", "Mockups") // This will be overridden by the backend
        const headers: Record<string, string> = {}
        if (token) headers["Authorization"] = `Bearer ${token}`
        if (adminToken) headers["X-Admin-Token"] = String(adminToken)
        const resp = await fetch("/api/admin/upload-mockup", {
          method: "POST",
          headers,
          body: form,
          credentials: "same-origin",
        })
        const data = await resp.json().catch(() => null)
        if (!resp.ok) {
          throw new Error(data?.error || "Upload failed")
        }
        setUploadResult(data as UploadResult)
        // Refresh the list after successful upload
        fetchMockups({ showSpinner: false }).catch(() => {})
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Upload failed. Please try again."
        setUploadError(message)
      } finally {
        setUploading(false)
        if (inputRef.current) inputRef.current.value = ""
      }
    },
    [adminToken, optimize, fetchMockups],
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

  // Delete function
  const handleDelete = React.useCallback(
    async (entry: MediaEntry) => {
      const storageName =
        entry.metadata?.storageName ||
        entry.metadata?.displayName ||
        entry.path
      if (
        !window.confirm(
          `Delete "${storageName}"?\nThis will remove the mockup from storage.`,
        )
      ) {
        return
      }
      setError(null)
      setDeletingId(entry.id)
      try {
        const session = (await supabase.auth.getSession()).data.session
        const token = session?.access_token
        if (!token && !adminToken) {
          setError("You must be signed in as an admin to delete mockups.")
          return
        }
        const headers: Record<string, string> = { Accept: "application/json" }
        if (token) headers["Authorization"] = `Bearer ${token}`
        if (adminToken) headers["X-Admin-Token"] = String(adminToken)

        const resp = await fetch(`/api/admin/media/${entry.id}`, {
          method: "DELETE",
          headers,
          credentials: "same-origin",
        })
        const data = await resp.json().catch(() => null)
        if (!resp.ok) {
          throw new Error(data?.error || "Failed to delete mockup")
        }
        setEntries((prev) => prev.filter((item) => item.id !== entry.id))
        if (selectedEntry?.id === entry.id) {
          setSelectedEntry(null)
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to delete mockup"
        setError(message)
      } finally {
        setDeletingId(null)
      }
    },
    [adminToken, selectedEntry],
  )

  const handleCopy = React.useCallback((entryId: string, value: string) => {
    try {
      navigator.clipboard.writeText(value).then(
        () => {
          setCopiedId(entryId)
          setTimeout(() => setCopiedId(null), 1800)
        },
        () => setError("Unable to copy link. Please copy manually."),
      )
    } catch {
      setError("Unable to copy link. Please copy manually.")
    }
  }, [])

  // Filter entries by search
  const visibleEntries = React.useMemo(() => {
    if (!searchQuery.trim()) return entries
    const query = searchQuery.toLowerCase()
    return entries.filter((entry) => {
      const name = entry.metadata?.storageName || entry.metadata?.displayName || entry.path
      return (
        name.toLowerCase().includes(query) ||
        entry.adminName?.toLowerCase().includes(query) ||
        entry.adminEmail?.toLowerCase().includes(query)
      )
    })
  }, [entries, searchQuery])

  return (
    <div className="space-y-8">
      {/* Upload Section */}
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-stone-900 dark:text-white flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-emerald-600" />
            Upload Mockup
          </h2>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
            Upload PWA screenshots and app mockup images for marketing materials
          </p>
        </div>

        {/* Optimization Toggle */}
        <div className="flex items-center justify-between rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] p-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center",
              optimize 
                ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                : "bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400"
            )}>
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <label 
                htmlFor="mockup-optimize-toggle" 
                className="text-sm font-medium text-stone-900 dark:text-white cursor-pointer"
              >
                Optimize file
              </label>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {optimize 
                  ? "PNG, JPG, WebP will be compressed and converted to WebP"
                  : "File will be uploaded as-is without optimization"
                }
              </p>
            </div>
          </div>
          <Switch 
            id="mockup-optimize-toggle"
            checked={optimize}
            onCheckedChange={setOptimize}
            disabled={uploading}
          />
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
            "relative rounded-2xl border-2 border-dashed p-8 text-center transition-all cursor-pointer",
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
            "mx-auto mb-4 w-16 h-16 rounded-2xl flex items-center justify-center transition-colors",
            dragActive 
              ? "bg-emerald-500 text-white" 
              : "bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 text-emerald-600 dark:text-emerald-400"
          )}>
            {uploading ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : (
              <UploadCloud className="h-8 w-8" />
            )}
          </div>
          
          <div className="text-base font-semibold text-stone-900 dark:text-white mb-1">
            {dragActive ? (
              "Drop your mockup here"
            ) : uploading ? (
              "Uploading..."
            ) : (
              <>
                Drag & drop a mockup or{" "}
                <span className="text-emerald-600 dark:text-emerald-400">browse</span>
              </>
            )}
          </div>
          
          <p className="text-sm text-stone-500 dark:text-stone-400">
            PNG, JPG, WebP. Max {DEFAULT_MAX_MB} MB.
          </p>
        </div>

        {/* Upload Error */}
        {uploadError && (
          <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-200">
            {uploadError}
          </div>
        )}

        {/* Upload Progress */}
        {uploading && (
          <div className="rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] p-4">
            <div className="flex items-center gap-3 text-sm text-stone-600 dark:text-stone-400">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
              {optimize ? "Optimizing and uploading..." : "Uploading..."} This usually takes a few seconds.
            </div>
          </div>
        )}

        {/* Upload Result */}
        {uploadResult && (
          <div className="rounded-2xl border-2 border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-900/20 dark:to-[#1e1e20] p-6 space-y-4">
            {/* Success Header */}
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center flex-shrink-0">
                <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-stone-900 dark:text-white">
                  Mockup Uploaded!
                </h3>
                <p className="text-sm text-stone-500 dark:text-stone-400">
                  Stored in <span className="font-medium">{uploadResult.bucket}/Mockups</span>
                </p>
              </div>
            </div>

            {/* URL Copy */}
            {uploadResult.url && (
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-stone-500 dark:text-stone-400">
                  Public URL
                </label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={uploadResult.url}
                    onFocus={(e) => e.currentTarget.select()}
                    className="rounded-xl font-mono text-sm bg-white dark:bg-[#1a1a1d]"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="rounded-xl flex-shrink-0"
                    onClick={() => copyToClipboard(uploadResult.url || "", "url")}
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

            {/* Stats */}
            <div className="flex flex-wrap gap-4 text-sm">
              {uploadResult.optimized !== false && (
                <div className="flex items-center gap-2 text-stone-600 dark:text-stone-400">
                  <Sparkles className="h-4 w-4 text-emerald-600" />
                  <span>{compressionPct}% smaller</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-stone-600 dark:text-stone-400">
                <HardDrive className="h-4 w-4" />
                <span>{formatBytes(uploadResult.size)}</span>
              </div>
            </div>

            {/* Upload Another */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => {
                setUploadResult(null)
                inputRef.current?.click()
              }}
            >
              <UploadCloud className="mr-2 h-4 w-4" />
              Upload Another
            </Button>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-stone-200 dark:border-[#3e3e42]" />

      {/* Mockups Library Section */}
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-stone-900 dark:text-white flex items-center gap-2">
              <FileImage className="h-5 w-5 text-emerald-600" />
              Mockups Library
            </h2>
            <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
              {visibleEntries.length} mockup{visibleEntries.length !== 1 ? 's' : ''} available
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={() => fetchMockups({ showSpinner: true })}
            disabled={refreshing}
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>

        {/* Search */}
        {entries.length > 0 && (
          <div className="relative max-w-md">
            <SearchInput
              placeholder="Search mockups..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              variant="lg"
              className="rounded-xl border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-stone-400 hover:text-stone-600 hover:bg-stone-100 dark:hover:bg-[#2a2a2d] z-10"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-200">
            {error}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3 text-stone-500 dark:text-stone-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading mockups...</span>
            </div>
          </div>
        ) : visibleEntries.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-stone-200 dark:border-[#3e3e42] p-12 text-center">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-stone-100 dark:bg-[#2a2a2d] flex items-center justify-center mb-4">
              {searchQuery ? (
                <Search className="h-6 w-6 text-stone-400" />
              ) : (
                <Smartphone className="h-6 w-6 text-stone-400" />
              )}
            </div>
            <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-2">
              {searchQuery ? "No results found" : "No mockups yet"}
            </h3>
            <p className="text-sm text-stone-500 dark:text-stone-400">
              {searchQuery 
                ? `No mockups match "${searchQuery}"`
                : "Upload some PWA screenshots and mockups to see them here."
              }
            </p>
            {searchQuery && (
              <Button variant="outline" onClick={() => setSearchQuery('')} className="rounded-xl mt-4">
                Clear search
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleEntries.map((entry) => {
              const storageName =
                entry.metadata?.storageName ||
                entry.metadata?.displayName ||
                entry.path.split("/").filter(Boolean).pop() ||
                entry.path
              const displayLink = entry.url || `supabase://${entry.bucket}/${entry.path}`
              const isImage = (entry.mimeType || entry.originalMimeType || "").startsWith("image/")
              
              return (
                <div
                  key={entry.id}
                  className="group rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] overflow-hidden transition-all hover:border-emerald-300 dark:hover:border-emerald-800 hover:shadow-lg hover:shadow-emerald-500/5"
                >
                  {/* Image Preview */}
                  <div className="aspect-video bg-stone-100 dark:bg-[#2a2a2d] relative overflow-hidden">
                    {isImage && entry.url ? (
                      <img
                        src={entry.url}
                        alt={storageName}
                        className="w-full h-full object-cover cursor-pointer"
                        loading="lazy"
                        onClick={() => setSelectedEntry(entry)}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="h-12 w-12 text-stone-300 dark:text-stone-600" />
                      </div>
                    )}
                    
                    {/* Overlay Actions */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center gap-2 p-4">
                      <Button
                        type="button"
                        size="sm"
                        className="rounded-lg bg-white/90 text-stone-900 hover:bg-white"
                        onClick={() => handleCopy(entry.id, displayLink)}
                        disabled={copiedId === entry.id}
                      >
                        {copiedId === entry.id ? (
                          <>
                            <Check className="mr-1.5 h-3.5 w-3.5" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="mr-1.5 h-3.5 w-3.5" />
                            Copy
                          </>
                        )}
                      </Button>
                      {entry.url && (
                        <Button
                          type="button"
                          size="sm"
                          className="rounded-lg bg-white/90 text-stone-900 hover:bg-white"
                          asChild
                        >
                          <a href={entry.url} target="_blank" rel="noreferrer">
                            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                            Open
                          </a>
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        className="rounded-lg bg-red-500 text-white hover:bg-red-600"
                        onClick={() => handleDelete(entry)}
                        disabled={deletingId === entry.id}
                      >
                        {deletingId === entry.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <h3 className="font-medium text-stone-900 dark:text-white truncate text-sm" title={storageName}>
                      {storageName}
                    </h3>
                    
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500 dark:text-stone-400">
                      <span className="flex items-center gap-1">
                        <HardDrive className="h-3 w-3" />
                        {formatBytes(entry.sizeBytes)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatRelativeTime(entry.createdAt)}
                      </span>
                    </div>
                    
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-stone-400">
                      <User className="h-3 w-3" />
                      <span className="truncate">
                        {entry.adminName || entry.adminEmail || "Unknown"}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Image Detail Modal */}
      {selectedEntry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
          onClick={() => setSelectedEntry(null)}
        >
          <div
            className="relative max-w-4xl w-full max-h-[90vh] bg-white dark:bg-[#1e1e20] rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedEntry(null)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex flex-col lg:flex-row">
              {/* Image */}
              <div className="lg:w-2/3 bg-stone-900 flex items-center justify-center p-4">
                {selectedEntry.url ? (
                  <img
                    src={selectedEntry.url}
                    alt={selectedEntry.metadata?.storageName || "Mockup"}
                    className="max-w-full max-h-[60vh] object-contain"
                  />
                ) : (
                  <div className="text-stone-500">No preview available</div>
                )}
              </div>

              {/* Details */}
              <div className="lg:w-1/3 p-6 space-y-4 overflow-y-auto max-h-[60vh]">
                <div>
                  <h3 className="text-lg font-bold text-stone-900 dark:text-white mb-1">
                    {selectedEntry.metadata?.storageName || selectedEntry.metadata?.displayName || "Mockup Details"}
                  </h3>
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-purple-600 bg-purple-100 dark:bg-purple-900/30">
                    <Smartphone className="h-3 w-3" />
                    Mockup
                  </span>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-stone-500">Size</span>
                    <span className="font-medium text-stone-900 dark:text-white">{formatBytes(selectedEntry.sizeBytes)}</span>
                  </div>
                  {selectedEntry.originalSizeBytes && selectedEntry.originalSizeBytes !== selectedEntry.sizeBytes && (
                    <div className="flex justify-between">
                      <span className="text-stone-500">Original Size</span>
                      <span className="font-medium text-stone-900 dark:text-white">{formatBytes(selectedEntry.originalSizeBytes)}</span>
                    </div>
                  )}
                  {selectedEntry.compressionPercent && selectedEntry.compressionPercent > 0 && (
                    <div className="flex justify-between">
                      <span className="text-stone-500">Compression</span>
                      <span className="font-medium text-emerald-600">{selectedEntry.compressionPercent}% saved</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-stone-500">Type</span>
                    <span className="font-medium text-stone-900 dark:text-white">{selectedEntry.mimeType || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Bucket</span>
                    <span className="font-medium text-stone-900 dark:text-white">{selectedEntry.bucket}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-stone-200 dark:border-[#3e3e42]">
                  <label className="text-xs font-semibold uppercase text-stone-500 dark:text-stone-400">
                    Uploaded By
                  </label>
                  <div className="mt-1 flex items-center gap-2 text-sm text-stone-600 dark:text-stone-400">
                    <div className="w-8 h-8 rounded-full bg-stone-200 dark:bg-[#3a3a3d] flex items-center justify-center">
                      <User className="h-4 w-4 text-stone-500" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium">{selectedEntry.adminName || "Unknown"}</div>
                      {selectedEntry.adminEmail && (
                        <div className="text-xs text-stone-500">{selectedEntry.adminEmail}</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-stone-200 dark:border-[#3e3e42]">
                  <label className="text-xs font-semibold uppercase text-stone-500 dark:text-stone-400">
                    URL
                  </label>
                  <div className="mt-1 flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={selectedEntry.url || ""}
                      className="flex-1 px-3 py-2 text-xs rounded-lg bg-stone-100 dark:bg-[#2a2a2d] border-0 font-mono truncate"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="rounded-lg"
                      onClick={() => handleCopy(selectedEntry.id, selectedEntry.url || "")}
                    >
                      {copiedId === selectedEntry.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  {selectedEntry.url && (
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 rounded-xl"
                      asChild
                    >
                      <a href={selectedEntry.url} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Open
                      </a>
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="destructive"
                    className="flex-1 rounded-xl"
                    onClick={() => handleDelete(selectedEntry)}
                    disabled={deletingId === selectedEntry.id}
                  >
                    {deletingId === selectedEntry.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-2 h-4 w-4" />
                    )}
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
