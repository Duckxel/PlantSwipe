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
  Filter,
  Inbox,
  MessageSquare,
  BookOpen,
  Flower2,
  Mail,
  Shield,
  Sparkles,
} from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { SearchInput } from "@/components/ui/search-input"
import { useLocation, useNavigate } from "react-router-dom"

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
  uploadSource: string | null
  metadata?: {
    originalName?: string | null
    originalUploadName?: string | null
    storageName?: string | null
    displayName?: string | null
    typeSegment?: string | null
    gardenId?: string | null
    gardenName?: string | null
    scope?: string | null
    source?: string | null
    [key: string]: unknown
  } | null
  createdAt: string | null
}

type MediaStats = {
  totalCount: number
  totalSize: number
  bySource: Record<string, { count: number; size: number }>
}

const BYTES_IN_MB = 1024 * 1024
const BYTES_IN_GB = 1024 * 1024 * 1024

// Source display configuration
const SOURCE_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  admin: { label: "Admin Upload", icon: Shield, color: "text-purple-600 bg-purple-100 dark:bg-purple-900/30" },
  blog: { label: "Blog", icon: BookOpen, color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30" },
  messages: { label: "Messages", icon: MessageSquare, color: "text-green-600 bg-green-100 dark:bg-green-900/30" },
  garden_cover: { label: "Garden Cover", icon: Flower2, color: "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30" },
  garden_journal: { label: "Garden Journal", icon: BookOpen, color: "text-teal-600 bg-teal-100 dark:bg-teal-900/30" },
  garden_photo: { label: "Garden Photo", icon: ImageIcon, color: "text-lime-600 bg-lime-100 dark:bg-lime-900/30" },
  pro_advice: { label: "Pro Advice", icon: Sparkles, color: "text-amber-600 bg-amber-100 dark:bg-amber-900/30" },
  "pro-advice": { label: "Pro Advice", icon: Sparkles, color: "text-amber-600 bg-amber-100 dark:bg-amber-900/30" },
  email: { label: "Email", icon: Mail, color: "text-rose-600 bg-rose-100 dark:bg-rose-900/30" },
  contact_screenshot: { label: "Contact Form", icon: MessageSquare, color: "text-indigo-600 bg-indigo-100 dark:bg-indigo-900/30" },
}

function getSourceConfig(source: string | null) {
  if (!source) return SOURCE_CONFIG.admin
  const normalized = source.toLowerCase().replace(/_/g, '-')
  return SOURCE_CONFIG[source] || SOURCE_CONFIG[normalized] || {
    label: source.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    icon: FileImage,
    color: "text-stone-600 bg-stone-100 dark:bg-stone-800",
  }
}

function formatBytes(value?: number | null) {
  if (!Number.isFinite(value || 0) || !value) return "-"
  if (value < 1024) return `${value} B`
  if (value < BYTES_IN_MB) return `${(value / 1024).toFixed(1)} KB`
  if (value < BYTES_IN_GB) return `${(value / BYTES_IN_MB).toFixed(2)} MB`
  return `${(value / BYTES_IN_GB).toFixed(2)} GB`
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

function formatFullDate(value?: string | null) {
  if (!value) return "-"
  try {
    const date = new Date(value)
    return date.toLocaleString()
  } catch {
    return "-"
  }
}

export const GlobalImageLibrary: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  
  // Read initial userId from URL query params
  const initialUserId = React.useMemo(() => {
    const params = new URLSearchParams(location.search)
    return params.get("userId") || null
  }, [location.search])
  
  const [entries, setEntries] = React.useState<MediaEntry[]>([])
  const [availableSources, setAvailableSources] = React.useState<string[]>([])
  const [stats, setStats] = React.useState<MediaStats | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [copiedId, setCopiedId] = React.useState<string | null>(null)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [selectedSource, setSelectedSource] = React.useState<string | null>(null)
  const [selectedUser, setSelectedUser] = React.useState<string | null>(initialUserId)
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("grid")
  const [selectedEntry, setSelectedEntry] = React.useState<MediaEntry | null>(null)
  
  // Sync selectedUser with URL when it changes from URL
  React.useEffect(() => {
    if (initialUserId && initialUserId !== selectedUser) {
      setSelectedUser(initialUserId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUserId])
  
  const runtimeEnv = (globalThis as typeof globalThis & RuntimeEnv).__ENV__
  const adminToken =
    import.meta.env?.VITE_ADMIN_STATIC_TOKEN ?? runtimeEnv?.VITE_ADMIN_STATIC_TOKEN

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
        
        const params = new URLSearchParams({ limit: "500" })
        if (selectedSource) params.set("source", selectedSource)
        if (selectedUser) params.set("userId", selectedUser)
        
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
        setAvailableSources(Array.isArray(data?.availableSources) ? data.availableSources : [])
        setStats(data?.stats || null)
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
    [adminToken, selectedSource, selectedUser],
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
          `Delete "${storageName}"?\nThis will remove the file from storage and the database.`,
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
        if (selectedEntry?.id === entry.id) {
          setSelectedEntry(null)
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to delete media"
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

  const clearUserFilter = React.useCallback(() => {
    setSelectedUser(null)
    // Clear userId from URL if present
    const params = new URLSearchParams(location.search)
    if (params.has("userId")) {
      params.delete("userId")
      navigate({ search: params.toString() }, { replace: true })
    }
  }, [location.search, navigate])

  const visibleEntries = React.useMemo(() => {
    let filtered = entries
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((entry) => {
        const name = entry.metadata?.storageName || entry.metadata?.displayName || entry.path
        return (
          name.toLowerCase().includes(query) ||
          entry.adminName?.toLowerCase().includes(query) ||
          entry.adminEmail?.toLowerCase().includes(query) ||
          entry.uploadSource?.toLowerCase().includes(query) ||
          entry.metadata?.gardenName?.toLowerCase().includes(query)
        )
      })
    }
    return filtered
  }, [entries, searchQuery])

  // Unique uploaders for user filter
  const uniqueUploaders = React.useMemo(() => {
    const map = new Map<string, { id: string; name: string | null; email: string | null; count: number }>()
    entries.forEach((entry) => {
      if (entry.adminId) {
        const existing = map.get(entry.adminId)
        if (existing) {
          existing.count++
        } else {
          map.set(entry.adminId, {
            id: entry.adminId,
            name: entry.adminName,
            email: entry.adminEmail,
            count: 1,
          })
        }
      }
    })
    return Array.from(map.values()).sort((a, b) => b.count - a.count)
  }, [entries])

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-bold text-stone-900 dark:text-white flex items-center gap-2">
            <Inbox className="h-5 w-5 text-emerald-600" />
            Global Image Library
          </h2>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
            All images uploaded across the platform
          </p>
        </div>
        
        {/* Stats Summary */}
        {stats && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-[#2a2a2d] text-sm">
              <ImageIcon className="h-4 w-4 text-stone-500" />
              <span className="font-medium">{stats.totalCount}</span>
              <span className="text-stone-500">images</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-[#2a2a2d] text-sm">
              <HardDrive className="h-4 w-4 text-stone-500" />
              <span className="font-medium">{formatBytes(stats.totalSize)}</span>
              <span className="text-stone-500">total</span>
            </div>
          </div>
        )}
      </div>

      {/* Source Stats Cards */}
      {stats && Object.keys(stats.bySource).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {availableSources.map((source) => {
            const config = getSourceConfig(source)
            const Icon = config.icon
            const sourceStats = stats.bySource[source]
            if (!sourceStats) return null
            const isSelected = selectedSource === source
            return (
              <button
                key={source}
                type="button"
                onClick={() => setSelectedSource(isSelected ? null : source)}
                className={cn(
                  "relative flex flex-col items-start gap-1 p-3 rounded-xl border transition-all text-left",
                  isSelected
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 ring-2 ring-emerald-500/20"
                    : "border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] hover:border-emerald-300 dark:hover:border-emerald-800"
                )}
              >
                <div className={cn("p-1.5 rounded-lg", config.color)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-medium text-stone-600 dark:text-stone-300 truncate max-w-full">
                    {config.label}
                  </div>
                  <div className="text-lg font-bold text-stone-900 dark:text-white">
                    {sourceStats.count}
                  </div>
                  <div className="text-xs text-stone-500">
                    {formatBytes(sourceStats.size)}
                  </div>
                </div>
                {isSelected && (
                  <div className="absolute top-2 right-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Controls Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <SearchInput
              placeholder="Search by name, user, or source..."
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

          {/* User Filter Indicator */}
          {selectedUser && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <User className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-blue-700 dark:text-blue-300">
                {uniqueUploaders.find(u => u.id === selectedUser)?.name || "User"}
              </span>
              <button
                type="button"
                onClick={clearUserFilter}
                className="p-0.5 rounded hover:bg-blue-100 dark:hover:bg-blue-800"
              >
                <X className="h-3.5 w-3.5 text-blue-600" />
              </button>
            </div>
          )}

          {/* Source Filter Indicator */}
          {selectedSource && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
              <Filter className="h-4 w-4 text-emerald-600" />
              <span className="text-sm text-emerald-700 dark:text-emerald-300">
                {getSourceConfig(selectedSource).label}
              </span>
              <button
                type="button"
                onClick={() => setSelectedSource(null)}
                className="p-0.5 rounded hover:bg-emerald-100 dark:hover:bg-emerald-800"
              >
                <X className="h-3.5 w-3.5 text-emerald-600" />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] p-1">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={cn(
                "p-2 rounded-lg transition-colors",
                viewMode === "grid"
                  ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600"
                  : "text-stone-500 hover:text-stone-700 dark:hover:text-stone-300"
              )}
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 16 16">
                <path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-3zM2.5 2a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3zm6.5.5A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5v-3zm1.5-.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3zM1 10.5A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5v-3zm1.5-.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3zm6.5.5A1.5 1.5 0 0 1 10.5 9h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 13.5v-3zm1.5-.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3z"/>
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={cn(
                "p-2 rounded-lg transition-colors",
                viewMode === "list"
                  ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600"
                  : "text-stone-500 hover:text-stone-700 dark:hover:text-stone-300"
              )}
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 16 16">
                <path fillRule="evenodd" d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5z"/>
              </svg>
            </button>
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
      </div>

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
            <span>Loading media library...</span>
          </div>
        </div>
      ) : visibleEntries.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-stone-200 dark:border-[#3e3e42] p-12 text-center">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-stone-100 dark:bg-[#2a2a2d] flex items-center justify-center mb-4">
            {searchQuery || selectedSource || selectedUser ? (
              <Search className="h-6 w-6 text-stone-400" />
            ) : (
              <ImageIcon className="h-6 w-6 text-stone-400" />
            )}
          </div>
          <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-2">
            {searchQuery || selectedSource || selectedUser ? "No results found" : "No media files yet"}
          </h3>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            {searchQuery
              ? `No files match "${searchQuery}"`
              : selectedSource
                ? `No ${getSourceConfig(selectedSource).label} uploads found.`
                : selectedUser
                  ? "No uploads from this user."
                  : "Upload some files to see them here."
            }
          </p>
          {(searchQuery || selectedSource || selectedUser) && (
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery('')
                setSelectedSource(null)
                setSelectedUser(null)
              }}
              className="rounded-xl mt-4"
            >
              Clear all filters
            </Button>
          )}
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleEntries.map((entry) => {
            const storageName =
              entry.metadata?.storageName ||
              entry.metadata?.displayName ||
              entry.path.split("/").filter(Boolean).pop() ||
              entry.path
            const displayLink = entry.url || `supabase://${entry.bucket}/${entry.path}`
            const isImage = (entry.mimeType || entry.originalMimeType || "").startsWith("image/")
            const sourceConfig = getSourceConfig(entry.uploadSource)
            const SourceIcon = sourceConfig.icon
            
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
                  
                  {/* Source Badge */}
                  <div className={cn(
                    "absolute top-2 left-2 px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1",
                    sourceConfig.color
                  )}>
                    <SourceIcon className="h-3 w-3" />
                    {sourceConfig.label}
                  </div>
                  
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
                  
                  {/* Uploader - Clickable */}
                  <button
                    type="button"
                    onClick={() => setSelectedUser(entry.adminId)}
                    disabled={!entry.adminId}
                    className={cn(
                      "mt-2 flex items-center gap-1.5 text-xs",
                      entry.adminId
                        ? "text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                        : "text-stone-400 cursor-default"
                    )}
                  >
                    <User className="h-3 w-3" />
                    <span className="truncate">
                      {entry.adminName || entry.adminEmail || "Unknown"}
                    </span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* List View */
        <div className="rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-stone-200 dark:border-[#3e3e42] bg-stone-50 dark:bg-[#2a2a2d]">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 dark:text-stone-400 uppercase tracking-wider">Image</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 dark:text-stone-400 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 dark:text-stone-400 uppercase tracking-wider">Function</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 dark:text-stone-400 uppercase tracking-wider">Uploader</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 dark:text-stone-400 uppercase tracking-wider">Size</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 dark:text-stone-400 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-stone-600 dark:text-stone-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 dark:divide-[#3e3e42]">
                {visibleEntries.map((entry) => {
                  const storageName =
                    entry.metadata?.storageName ||
                    entry.metadata?.displayName ||
                    entry.path.split("/").filter(Boolean).pop() ||
                    entry.path
                  const displayLink = entry.url || `supabase://${entry.bucket}/${entry.path}`
                  const isImage = (entry.mimeType || entry.originalMimeType || "").startsWith("image/")
                  const sourceConfig = getSourceConfig(entry.uploadSource)
                  const SourceIcon = sourceConfig.icon
                  
                  return (
                    <tr key={entry.id} className="hover:bg-stone-50 dark:hover:bg-[#2a2a2d] transition-colors">
                      <td className="px-4 py-3">
                        <div className="w-16 h-12 rounded-lg bg-stone-100 dark:bg-[#2a2a2d] overflow-hidden">
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
                              <ImageIcon className="h-5 w-5 text-stone-400" />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="max-w-[200px]">
                          <p className="text-sm font-medium text-stone-900 dark:text-white truncate" title={storageName}>
                            {storageName}
                          </p>
                          <p className="text-xs text-stone-500 truncate" title={entry.path}>
                            {entry.bucket}/{entry.path.split('/').slice(-2).join('/')}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium",
                          sourceConfig.color
                        )}>
                          <SourceIcon className="h-3 w-3" />
                          {sourceConfig.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setSelectedUser(entry.adminId)}
                          disabled={!entry.adminId}
                          className={cn(
                            "text-sm flex items-center gap-1.5",
                            entry.adminId
                              ? "text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                              : "text-stone-500 cursor-default"
                          )}
                        >
                          <User className="h-3.5 w-3.5" />
                          {entry.adminName || entry.adminEmail || "Unknown"}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm text-stone-600 dark:text-stone-400">
                        {formatBytes(entry.sizeBytes)}
                      </td>
                      <td className="px-4 py-3 text-sm text-stone-600 dark:text-stone-400" title={formatFullDate(entry.createdAt)}>
                        {formatRelativeTime(entry.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleCopy(entry.id, displayLink)}
                            className="p-1.5 rounded-lg text-stone-500 hover:text-stone-700 hover:bg-stone-100 dark:hover:bg-[#3a3a3d] transition-colors"
                            title="Copy URL"
                          >
                            {copiedId === entry.id ? (
                              <Check className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </button>
                          {entry.url && (
                            <a
                              href={entry.url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg text-stone-500 hover:text-stone-700 hover:bg-stone-100 dark:hover:bg-[#3a3a3d] transition-colors"
                              title="Open in new tab"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDelete(entry)}
                            disabled={deletingId === entry.id}
                            className="p-1.5 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            title="Delete"
                          >
                            {deletingId === entry.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
                    alt={selectedEntry.metadata?.storageName || "Image"}
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
                    {selectedEntry.metadata?.storageName || selectedEntry.metadata?.displayName || "Image Details"}
                  </h3>
                  <span className={cn(
                    "inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium",
                    getSourceConfig(selectedEntry.uploadSource).color
                  )}>
                    {React.createElement(getSourceConfig(selectedEntry.uploadSource).icon, { className: "h-3 w-3" })}
                    {getSourceConfig(selectedEntry.uploadSource).label}
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
                  <div className="flex justify-between">
                    <span className="text-stone-500">Uploaded</span>
                    <span className="font-medium text-stone-900 dark:text-white">{formatFullDate(selectedEntry.createdAt)}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-stone-200 dark:border-[#3e3e42]">
                  <label className="text-xs font-semibold uppercase text-stone-500 dark:text-stone-400">
                    Uploaded By
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedEntry.adminId) {
                        setSelectedUser(selectedEntry.adminId)
                        setSelectedEntry(null)
                      }
                    }}
                    disabled={!selectedEntry.adminId}
                    className={cn(
                      "mt-1 flex items-center gap-2 text-sm",
                      selectedEntry.adminId
                        ? "text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                        : "text-stone-600 dark:text-stone-400 cursor-default"
                    )}
                  >
                    <div className="w-8 h-8 rounded-full bg-stone-200 dark:bg-[#3a3a3d] flex items-center justify-center">
                      <User className="h-4 w-4 text-stone-500" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium">{selectedEntry.adminName || "Unknown"}</div>
                      {selectedEntry.adminEmail && (
                        <div className="text-xs text-stone-500">{selectedEntry.adminEmail}</div>
                      )}
                    </div>
                  </button>
                </div>

                {selectedEntry.metadata?.gardenId && (
                  <div className="pt-3 border-t border-stone-200 dark:border-[#3e3e42]">
                    <label className="text-xs font-semibold uppercase text-stone-500 dark:text-stone-400">
                      Garden
                    </label>
                    <p className="mt-1 text-sm text-stone-900 dark:text-white">
                      {selectedEntry.metadata.gardenName || selectedEntry.metadata.gardenId}
                    </p>
                  </div>
                )}

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
