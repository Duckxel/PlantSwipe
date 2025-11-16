import React from "react"
import { ExternalLink, RefreshCw, ImageIcon, Loader2, Trash2 } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

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
  metadata?: { originalName?: string | null; typeSegment?: string | null } | null
  createdAt: string | null
}

const BYTES_IN_MB = 1024 * 1024

function formatBytes(value?: number | null) {
  if (!Number.isFinite(value || 0) || !value) return "-"
  if (value < 1024) return `${value} B`
  if (value < BYTES_IN_MB) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / BYTES_IN_MB).toFixed(2)} MB`
}

function formatTimestamp(value?: string | null) {
  if (!value) return "-"
  try {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "-"
    return date.toLocaleString()
  } catch {
    return "-"
  }
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

export const AdminMediaPanel: React.FC = () => {
  const [entries, setEntries] = React.useState<MediaEntry[]>([])
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
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
        const resp = await fetch("/api/admin/media?limit=100", {
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
    [adminToken],
  )

  React.useEffect(() => {
    fetchMedia().catch(() => {})
  }, [fetchMedia])

  const handleDelete = React.useCallback(
    async (entry: MediaEntry) => {
      if (
        !window.confirm(
          `Delete "${entry.metadata?.originalName || entry.path}"?\nThis will remove the optimized file from storage.`,
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

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl">
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-2xl font-semibold tracking-tight">Media library</div>
              <p className="text-sm text-muted-foreground">
                Recent uploads to the Supabase bucket, including who uploaded them and
                file details.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl"
              onClick={() => fetchMedia({ showSpinner: true })}
              disabled={refreshing}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-200">
              {error}
            </div>
          )}
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading media uploads...</div>
          ) : entries.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              No media uploads found yet.
            </div>
          ) : (
            <div className="space-y-4">
              {entries.map((entry) => {
                const fileName =
                  entry.metadata?.originalName ||
                  entry.path.split("/").filter(Boolean).pop() ||
                  entry.path
                const displayLink =
                  entry.url || `supabase://${entry.bucket}/${entry.path}`
                const isImage =
                  (entry.mimeType || entry.originalMimeType || "").startsWith(
                    "image/",
                  )
                return (
                  <div
                    key={entry.id}
                    className="rounded-2xl border bg-white/70 p-4 dark:border-[#3e3e42] dark:bg-[#1a1a1d]"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="flex flex-1 items-center gap-3">
                          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-200 overflow-hidden">
                            {isImage && entry.url ? (
                              <div className="h-full w-full rounded-xl bg-muted">
                                <img
                                  src={entry.url}
                                  alt={fileName}
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                              </div>
                            ) : (
                              <ImageIcon className="h-5 w-5" />
                            )}
                          </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{fileName}</div>
                  <div className="text-xs text-muted-foreground space-x-1">
                    <span>{entry.bucket}</span>
                    <span>·</span>
                    <span>{entry.mimeType || entry.originalMimeType || "-"}</span>
                    {entry.metadata?.typeSegment && (
                      <>
                        <span>·</span>
                        <span>{entry.metadata.typeSegment}</span>
                      </>
                    )}
                  </div>
                          <div className="text-xs text-muted-foreground">
                            Uploaded by{" "}
                            <span className="font-medium">
                              {entry.adminName || entry.adminEmail || "Unknown"}
                            </span>{" "}
                            · {formatRelativeTime(entry.createdAt)}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 text-sm text-muted-foreground md:text-right">
                        <div>
                          Size:{" "}
                          <span className="font-medium text-foreground">
                            {formatBytes(entry.sizeBytes)}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 md:items-end">
                        <Input
                          readOnly
                          value={displayLink}
                          onFocus={(e) => e.currentTarget.select()}
                          className="rounded-2xl font-mono text-xs"
                        />
                        {entry.url && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="rounded-2xl"
                            asChild
                          >
                            <a href={entry.url} target="_blank" rel="noreferrer">
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Open
                            </a>
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="rounded-2xl"
                          onClick={() => handleDelete(entry)}
                          disabled={deletingId === entry.id}
                        >
                          {deletingId === entry.id ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Deleting...
                            </>
                          ) : (
                            <>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </>
                          )}
                        </Button>
                        <div className="text-xs text-muted-foreground">
                          {formatTimestamp(entry.createdAt)}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
