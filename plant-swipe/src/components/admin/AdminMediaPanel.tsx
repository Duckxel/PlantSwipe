import React from "react"
import {
  ExternalLink,
  RefreshCw,
  ImageIcon,
  Loader2,
  Trash2,
  Copy,
  Check,
  Search,
  X,
  Calendar,
  HardDrive,
  User,
  FileImage,
} from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { SearchInput } from "@/components/ui/search-input"

type RuntimeEnv = {
  __ENV__?: Record<string, string | undefined>
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

type AdminMediaPanelProps = {
  filterBuckets?: string[]
  filterLabel?: string
}

const BYTES_IN_MB = 1024 * 1024

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

export const AdminMediaPanel: React.FC<AdminMediaPanelProps> = ({
  filterBuckets,
  filterLabel,
}) => {
  const [entries, setEntries] = React.useState<MediaEntry[]>([])
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [copiedId, setCopiedId] = React.useState<string | null>(null)
  const [searchQuery, setSearchQuery] = React.useState("")
  const runtimeEnv = (globalThis as typeof globalThis & RuntimeEnv).__ENV__
  const adminToken =
    import.meta.env?.VITE_ADMIN_STATIC_TOKEN ?? runtimeEnv?.VITE_ADMIN_STATIC_TOKEN

  const normalizedFilterBuckets = React.useMemo(() => {
    if (!filterBuckets || filterBuckets.length === 0) return null
    return filterBuckets
      .map((bucket) => bucket?.toString().trim().toLowerCase())
      .filter((bucket): bucket is string => Boolean(bucket))
  }, [filterBuckets])

  const fetchMedia = React.useCallback(
    async ({ showSpinner = false }: { showSpinner?: boolean } = {}) => {
      setError(null)
      if (showSpinner) setRefreshing(true)
      try {
        if (!showSpinner) setLoading(true)
        const session = (await supabase.auth.getSession()).data.session
        const token = session?.access_token
        if (!token && !adminToken) {
          setError("You must be signed in as an admin to view media uploads.")
          setEntries([])
          return
        }
        const headers: Record<string, string> = { Accept: "application/json" }
        if (token) headers["Authorization"] = `Bearer ${token}`
        if (adminToken) headers["X-Admin-Token"] = String(adminToken)
        const params = new URLSearchParams({ limit: "100" })
        const bucketParam =
          normalizedFilterBuckets && normalizedFilterBuckets.length === 1
            ? normalizedFilterBuckets[0]
            : null
        if (bucketParam) params.set("bucket", bucketParam)
        const resp = await fetch(`/api/admin/media?${params.toString()}`, {
          method: "GET",
          headers,
          credentials: "same-origin",
        })
        const data = await resp.json().catch(() => null)
        if (!resp.ok) {
          throw new Error(data?.error || "Failed to load media uploads")
        }
        setEntries(Array.isArray(data?.media) ? data.media : [])
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load media uploads"
        setError(message)
        setEntries([])
      } finally {
        if (showSpinner) setRefreshing(false)
        setLoading(false)
      }
    },
    [adminToken, normalizedFilterBuckets],
  )

  React.useEffect(() => {
    fetchMedia().catch(() => {})
  }, [fetchMedia])

  const handleDelete = React.useCallback(
    async (entry: MediaEntry) => {
      const storageName =
        entry.metadata?.storageName ||
        entry.metadata?.displayName ||
        entry.path
      if (
        !window.confirm(
          `Delete "${storageName}"?\nThis will remove the file from storage.`,
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
          setError("You must be signed in as an admin to delete media.")
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
          throw new Error(data?.error || "Failed to delete media")
        }
        setEntries((prev) => prev.filter((item) => item.id !== entry.id))
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to delete media"
        setError(message)
      } finally {
        setDeletingId(null)
      }
    },
    [adminToken],
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

  const visibleEntries = React.useMemo(() => {
    let filtered = entries
    if (normalizedFilterBuckets && normalizedFilterBuckets.length > 0) {
      filtered = entries.filter((entry) =>
        entry.bucket
          ? normalizedFilterBuckets.includes(entry.bucket.toLowerCase())
          : false,
      )
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((entry) => {
        const name = entry.metadata?.storageName || entry.metadata?.displayName || entry.path
        return name.toLowerCase().includes(query) || 
          entry.adminName?.toLowerCase().includes(query) ||
          entry.adminEmail?.toLowerCase().includes(query)
      })
    }
    return filtered
  }, [entries, normalizedFilterBuckets, searchQuery])

  const hasBucketFilter =
    Array.isArray(normalizedFilterBuckets) && normalizedFilterBuckets.length > 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-stone-900 dark:text-white flex items-center gap-2">
            <FileImage className="h-5 w-5 text-emerald-600" />
            Media Library
          </h2>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
            {hasBucketFilter && (
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                {filterLabel || "Filtered"} bucket · {" "}
              </span>
            )}
            {visibleEntries.length} file{visibleEntries.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="rounded-xl"
          onClick={() => fetchMedia({ showSpinner: true })}
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
            placeholder="Search files by name or uploader..."
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
        <div className="flex items-center justify-center py-16">
          <div className="flex items-center gap-3 text-stone-500 dark:text-stone-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading media...</span>
          </div>
        </div>
      ) : visibleEntries.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-stone-200 dark:border-[#3e3e42] p-12 text-center">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-stone-100 dark:bg-[#2a2a2d] flex items-center justify-center mb-4">
            {searchQuery ? (
              <Search className="h-6 w-6 text-stone-400" />
            ) : (
              <ImageIcon className="h-6 w-6 text-stone-400" />
            )}
          </div>
          <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-2">
            {searchQuery ? "No results found" : "No media files yet"}
          </h3>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            {searchQuery 
              ? `No files match "${searchQuery}"`
              : hasBucketFilter 
                ? `No ${(filterLabel || "filtered").toLowerCase()} uploads found.`
                : "Upload some files to see them here."
            }
          </p>
          {searchQuery && (
            <Button variant="outline" onClick={() => setSearchQuery('')} className="rounded-xl mt-4">
              Clear search
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                      className="w-full h-full object-cover"
                      loading="lazy"
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
  )
}
