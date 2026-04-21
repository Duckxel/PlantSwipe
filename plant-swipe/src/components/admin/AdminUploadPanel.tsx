import React from "react"
import {
  UploadCloud, Loader2, Check, Copy, FileImage, File, Sparkles,
  FolderOpen, FolderPlus, X, ChevronRight, Home, Trash2, ArrowUp,
  RefreshCw, FileText, FileVideo, FileAudio, FileArchive,
} from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { FileDropZone } from "@/components/ui/file-drop-zone"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

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
  isImage?: boolean
}

type RuntimeEnv = { __ENV__?: Record<string, string | undefined> }

type FolderEntry = { name: string }
type FileEntry = {
  name: string
  id: string
  size: number
  mimeType: string
  updatedAt: string
}

type FileUploadStatus = {
  file: File
  status: "pending" | "uploading" | "done" | "error"
  result?: UploadResult
  error?: string
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const BYTES_IN_MB = 1024 * 1024
const DEFAULT_MAX_MB = 15

/** Shown in breadcrumbs; must match server ADMIN_UPLOAD_PREFIX default. */
const ADMIN_UPLOAD_PREFIX =
  (import.meta.env?.VITE_ADMIN_UPLOAD_PREFIX as string | undefined)?.trim().replace(/^\/+|\/+$/g, "") ||
  "admin/uploads"

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/avif",
  "image/heic", "image/heif", "image/gif", "image/tiff",
  "image/bmp", "image/svg+xml",
  "application/pdf", "application/json", "text/csv", "text/plain", "text/markdown",
  "video/mp4", "video/webm", "video/quicktime",
  "audio/mpeg", "audio/ogg", "audio/wav", "audio/webm",
  "application/zip",
  "model/obj",
])

const ALLOWED_EXTENSIONS = new Set([".obj"])

const ACCEPT_STRING = [
  ...Array.from(ALLOWED_MIME_TYPES),
  ...Array.from(ALLOWED_EXTENSIONS),
].join(",")

/* ------------------------------------------------------------------ */
/*  Utilities                                                          */
/* ------------------------------------------------------------------ */

function getFileExtension(name: string): string {
  const dot = name.lastIndexOf(".")
  return dot >= 0 ? name.slice(dot).toLowerCase() : ""
}

function isFileAllowed(file: File): boolean {
  const mime = (file.type || "").toLowerCase()
  if (ALLOWED_MIME_TYPES.has(mime)) return true
  return ALLOWED_EXTENSIONS.has(getFileExtension(file.name))
}

function formatBytes(value: number) {
  if (!Number.isFinite(value)) return "-"
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(2)} MB`
}

function getFileIcon(mime: string) {
  if (mime.startsWith("image/")) return FileImage
  if (mime.startsWith("video/")) return FileVideo
  if (mime.startsWith("audio/")) return FileAudio
  if (mime === "application/zip") return FileArchive
  if (mime === "application/pdf" || mime.startsWith("text/")) return FileText
  return File
}

function formatDate(dateStr: string) {
  if (!dateStr) return ""
  try {
    const d = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    if (diff < 60_000) return "just now"
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
    if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`
    return d.toLocaleDateString()
  } catch {
    return ""
  }
}

/* ------------------------------------------------------------------ */
/*  Auth helper                                                        */
/* ------------------------------------------------------------------ */

function useAdminHeaders() {
  const runtimeEnv = (globalThis as typeof globalThis & RuntimeEnv).__ENV__
  const adminToken =
    import.meta.env?.VITE_ADMIN_STATIC_TOKEN ?? runtimeEnv?.VITE_ADMIN_STATIC_TOKEN

  const getHeaders = React.useCallback(async () => {
    const session = (await supabase.auth.getSession()).data.session
    const token = session?.access_token
    const headers: Record<string, string> = {}
    if (token) headers["Authorization"] = `Bearer ${token}`
    if (adminToken) headers["X-Admin-Token"] = String(adminToken)
    return headers
  }, [adminToken])

  return { adminToken, getHeaders }
}

/* ------------------------------------------------------------------ */
/*  File Explorer Component                                            */
/* ------------------------------------------------------------------ */

function FileExplorer({
  currentPath,
  onNavigate,
  onSelectForUpload,
  adminHeaders,
}: {
  currentPath: string
  onNavigate: (path: string) => void
  onSelectForUpload: (path: string) => void
  adminHeaders: () => Promise<Record<string, string>>
}) {
  const [folders, setFolders] = React.useState<FolderEntry[]>([])
  const [files, setFiles] = React.useState<FileEntry[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // New folder creation
  const [creatingFolder, setCreatingFolder] = React.useState(false)
  const [newFolderName, setNewFolderName] = React.useState("")
  const [savingFolder, setSavingFolder] = React.useState(false)

  // Deletion state
  const [deletingItem, setDeletingItem] = React.useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = React.useState<{ type: "folder" | "file"; name: string } | null>(null)
  const [copiedStoragePath, setCopiedStoragePath] = React.useState<string | null>(null)

  const loadContents = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const headers = await adminHeaders()
      const params = new URLSearchParams()
      if (currentPath) params.set("path", currentPath)
      const resp = await fetch(`/api/admin/upload-folder-contents?${params}`, {
        headers,
        credentials: "same-origin",
      })
      const data = await resp.json().catch(() => null)
      if (!resp.ok) throw new Error(data?.error || "Failed to load folder")
      if (!data || typeof data !== "object") {
        throw new Error("Invalid response from server (expected JSON with folders/files)")
      }
      setFolders(Array.isArray(data.folders) ? data.folders : [])
      setFiles(Array.isArray(data.files) ? data.files : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load folder contents")
    } finally {
      setLoading(false)
    }
  }, [currentPath, adminHeaders])

  React.useEffect(() => {
    void loadContents()
  }, [loadContents])

  const handleCreateFolder = React.useCallback(async () => {
    const trimmed = newFolderName.trim().replace(/[/\\]/g, "-")
    if (!trimmed) return
    setSavingFolder(true)
    try {
      const headers = await adminHeaders()
      headers["Content-Type"] = "application/json"
      const folderPath = currentPath ? `${currentPath}/${trimmed}` : trimmed
      const resp = await fetch("/api/admin/upload-folders", {
        method: "POST",
        headers,
        body: JSON.stringify({ folderPath }),
        credentials: "same-origin",
      })
      const data = await resp.json().catch(() => null)
      if (!resp.ok) throw new Error(data?.error || "Failed to create folder")
      setNewFolderName("")
      setCreatingFolder(false)
      void loadContents()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create folder")
    } finally {
      setSavingFolder(false)
    }
  }, [newFolderName, currentPath, adminHeaders, loadContents])

  const handleDeleteFolder = React.useCallback(async (folderName: string) => {
    const fullPath = currentPath ? `${currentPath}/${folderName}` : folderName
    setDeletingItem(folderName)
    try {
      const headers = await adminHeaders()
      headers["Content-Type"] = "application/json"
      const resp = await fetch("/api/admin/upload-folders", {
        method: "DELETE",
        headers,
        body: JSON.stringify({ folderPath: fullPath }),
        credentials: "same-origin",
      })
      const data = await resp.json().catch(() => null)
      if (!resp.ok) throw new Error(data?.error || "Failed to delete folder")
      setConfirmDelete(null)
      void loadContents()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete folder")
    } finally {
      setDeletingItem(null)
    }
  }, [currentPath, adminHeaders, loadContents])

  const handleDeleteFile = React.useCallback(async (fileName: string) => {
    const filePath = currentPath ? `${currentPath}/${fileName}` : fileName
    setDeletingItem(fileName)
    try {
      const headers = await adminHeaders()
      headers["Content-Type"] = "application/json"
      const resp = await fetch("/api/admin/upload-file", {
        method: "DELETE",
        headers,
        body: JSON.stringify({ filePath }),
        credentials: "same-origin",
      })
      const data = await resp.json().catch(() => null)
      if (!resp.ok) throw new Error(data?.error || "Failed to delete file")
      setConfirmDelete(null)
      void loadContents()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete file")
    } finally {
      setDeletingItem(null)
    }
  }, [currentPath, adminHeaders, loadContents])

  const storagePathForEntry = React.useCallback((entryName: string) => {
    const rel = currentPath ? `${currentPath}/${entryName}` : entryName
    return rel.startsWith("/") ? rel : `/${rel}`
  }, [currentPath])

  const copyFileStoragePath = React.useCallback(
    async (fileName: string) => {
      const path = storagePathForEntry(fileName)
      try {
        await navigator.clipboard.writeText(path)
        setCopiedStoragePath(path)
        window.setTimeout(() => setCopiedStoragePath(null), 2000)
      } catch {
        setError("Unable to copy path to clipboard.")
      }
    },
    [storagePathForEntry],
  )

  // Breadcrumb segments
  const pathSegments = currentPath ? currentPath.split("/") : []

  return (
    <div className="rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-stone-200 dark:border-[#3e3e42] bg-stone-50 dark:bg-[#252528]">
        {/* Back / Up button */}
        <button
          type="button"
          disabled={!currentPath || loading}
          onClick={() => {
            const parts = currentPath.split("/")
            parts.pop()
            onNavigate(parts.join("/"))
          }}
          className={cn(
            "p-1.5 rounded-lg transition-colors",
            currentPath
              ? "hover:bg-stone-200 dark:hover:bg-[#3a3a3d] text-stone-600 dark:text-stone-300"
              : "text-stone-300 dark:text-stone-600 cursor-not-allowed",
          )}
          title="Go up"
        >
          <ArrowUp className="h-4 w-4" />
        </button>

        {/* Breadcrumbs */}
        <div className="flex-1 flex items-center gap-1 overflow-x-auto min-w-0 text-sm">
          <button
            type="button"
            onClick={() => onNavigate("")}
            className={cn(
              "flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors flex-shrink-0",
              !currentPath
                ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                : "text-stone-500 dark:text-stone-400 hover:text-emerald-600 dark:hover:text-emerald-400",
            )}
          >
            <Home className="h-3.5 w-3.5" />
            <span>UTILITY</span>
          </button>
          {pathSegments.map((seg, i) => {
            const fullPath = pathSegments.slice(0, i + 1).join("/")
            const isLast = i === pathSegments.length - 1
            return (
              <React.Fragment key={fullPath}>
                <ChevronRight className="h-3 w-3 text-stone-300 dark:text-stone-600 flex-shrink-0" />
                <button
                  type="button"
                  onClick={() => onNavigate(fullPath)}
                  className={cn(
                    "px-1.5 py-0.5 rounded transition-colors truncate max-w-[140px] flex-shrink-0",
                    isLast
                      ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                      : "text-stone-500 dark:text-stone-400 hover:text-emerald-600 dark:hover:text-emerald-400",
                  )}
                  title={seg}
                >
                  {seg}
                </button>
              </React.Fragment>
            )
          })}
        </div>

        {/* Actions */}
        <button
          type="button"
          onClick={() => void loadContents()}
          disabled={loading}
          className="p-1.5 rounded-lg hover:bg-stone-200 dark:hover:bg-[#3a3a3d] text-stone-500 dark:text-stone-400 transition-colors"
          title="Refresh"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </button>
        <button
          type="button"
          onClick={() => { setCreatingFolder(true); setNewFolderName("") }}
          className="p-1.5 rounded-lg hover:bg-stone-200 dark:hover:bg-[#3a3a3d] text-blue-500 dark:text-blue-400 transition-colors"
          title="New folder"
        >
          <FolderPlus className="h-4 w-4" />
        </button>
        <Button
          type="button"
          size="sm"
          className="rounded-lg text-xs h-7 px-3"
          onClick={() => onSelectForUpload(currentPath)}
        >
          <UploadCloud className="mr-1.5 h-3.5 w-3.5" />
          Upload here
        </Button>
      </div>

      {/* New folder input */}
      {creatingFolder && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-stone-200 dark:border-[#3e3e42] bg-blue-50/50 dark:bg-blue-900/10">
          <FolderPlus className="h-4 w-4 text-blue-500 flex-shrink-0" />
          <Input
            placeholder="New folder name..."
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleCreateFolder()
              if (e.key === "Escape") setCreatingFolder(false)
            }}
            className="h-7 rounded-md text-sm font-mono flex-1"
            autoFocus
            disabled={savingFolder}
          />
          <Button
            type="button"
            size="sm"
            className="rounded-md h-7 text-xs"
            onClick={() => void handleCreateFolder()}
            disabled={!newFolderName.trim() || savingFolder}
          >
            {savingFolder ? <Loader2 className="h-3 w-3 animate-spin" /> : "Create"}
          </Button>
          <button
            type="button"
            onClick={() => setCreatingFolder(false)}
            className="p-1 rounded hover:bg-stone-200 dark:hover:bg-[#3a3a3d]"
          >
            <X className="h-3.5 w-3.5 text-stone-400" />
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-3 py-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 border-b border-red-200 dark:border-red-900/30">
          {error}
          <button type="button" onClick={() => setError(null)} className="ml-2 underline hover:no-underline focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none rounded-sm">
            dismiss
          </button>
        </div>
      )}

      <Dialog
        open={confirmDelete !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(null)
        }}
      >
        <DialogContent className="sm:max-w-md" hideCloseButton={false}>
          {confirmDelete && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {confirmDelete.type === "folder" ? "Delete folder?" : "Delete file?"}
                </DialogTitle>
                <DialogDescription className="text-left">
                  {confirmDelete.type === "folder"
                    ? "This removes the folder and everything inside it from storage. This cannot be undone."
                    : "This removes the file from storage. This cannot be undone."}
                </DialogDescription>
              </DialogHeader>
              <div className="font-mono text-xs break-all text-stone-800 dark:text-stone-200 bg-stone-100 dark:bg-[#2a2a2d] rounded-md px-2 py-1.5 -mt-1">
                UTILITY
                {storagePathForEntry(confirmDelete.name)}
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-md"
                  disabled={!!deletingItem}
                  onClick={() => setConfirmDelete(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="rounded-md"
                  disabled={!!deletingItem}
                  onClick={() => {
                    if (confirmDelete.type === "folder") void handleDeleteFolder(confirmDelete.name)
                    else void handleDeleteFile(confirmDelete.name)
                  }}
                >
                  {deletingItem === confirmDelete.name ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Delete"
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Content list */}
      <div className="max-h-[400px] overflow-y-auto">
        {loading && folders.length === 0 && files.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-stone-400">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading...
          </div>
        ) : folders.length === 0 && files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-stone-400 dark:text-stone-500">
            <FolderOpen className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">Empty folder</p>
            <p className="text-xs mt-1">Upload files or create a subfolder</p>
          </div>
        ) : (
          <div className="divide-y divide-stone-100 dark:divide-[#2a2a2d]">
            {/* Folders first */}
            {folders.map((folder) => (
              <div
                key={`f-${folder.name}`}
                className="group flex items-center gap-3 px-3 py-2 hover:bg-stone-50 dark:hover:bg-[#252528] cursor-pointer transition-colors"
                onClick={() => onNavigate(currentPath ? `${currentPath}/${folder.name}` : folder.name)}
              >
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                  <FolderOpen className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-900 dark:text-white truncate">
                    {folder.name}
                  </p>
                  <p className="text-xs text-stone-400">Folder</p>
                </div>
                <ChevronRight className="h-4 w-4 text-stone-300 dark:text-stone-600 group-hover:text-stone-500 flex-shrink-0" />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setConfirmDelete({ type: "folder", name: folder.name })
                  }}
                  className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-400 hover:text-red-600 transition-all flex-shrink-0"
                  title="Delete folder"
                  aria-label={`Delete folder ${folder.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            {/* Files */}
            {files.map((file) => {
              const IconComp = getFileIcon(file.mimeType)
              const isImage = file.mimeType.startsWith("image/")
              return (
                <div
                  key={`file-${file.id}`}
                  className="group flex items-center gap-3 px-3 py-2 hover:bg-stone-50 dark:hover:bg-[#252528] transition-colors"
                >
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                    isImage
                      ? "bg-emerald-100 dark:bg-emerald-900/30"
                      : "bg-stone-100 dark:bg-stone-800",
                  )}>
                    <IconComp className={cn(
                      "h-4 w-4",
                      isImage ? "text-emerald-500" : "text-stone-500 dark:text-stone-400",
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-stone-900 dark:text-white truncate" title={file.name}>
                      {file.name}
                    </p>
                    <p className="text-xs text-stone-400">
                      {formatBytes(file.size)}
                      {file.mimeType && ` \u00b7 ${file.mimeType.split("/")[1] || file.mimeType}`}
                      {file.updatedAt && ` \u00b7 ${formatDate(file.updatedAt)}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      void copyFileStoragePath(file.name)
                    }}
                    className={cn(
                      "p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all flex-shrink-0",
                      copiedStoragePath === storagePathForEntry(file.name)
                        ? "text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30"
                        : "hover:bg-stone-200 dark:hover:bg-[#3a3a3d] text-stone-500 dark:text-stone-400",
                    )}
                    title="Copy storage path"
                    aria-label={`Copy path for ${file.name}`}
                  >
                    {copiedStoragePath === storagePathForEntry(file.name) ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setConfirmDelete({ type: "file", name: file.name })
                    }}
                    className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-400 hover:text-red-600 transition-all flex-shrink-0"
                    title="Delete file"
                    aria-label={`Delete file ${file.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer status */}
      <div className="px-3 py-1.5 border-t border-stone-100 dark:border-[#2a2a2d] bg-stone-50/50 dark:bg-[#1a1a1d] text-xs text-stone-400">
        {folders.length} folder{folders.length !== 1 ? "s" : ""}, {files.length} file{files.length !== 1 ? "s" : ""}
        <span className="ml-2 font-mono">
          {currentPath ? `/${currentPath}` : "/ (bucket root)"}
        </span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export const AdminUploadPanel: React.FC = () => {
  const { adminToken, getHeaders } = useAdminHeaders()

  // File explorer state (paths relative to UTILITY bucket root)
  const [currentPath, setCurrentPath] = React.useState("")
  /** null = upload to default admin prefix on server; string = explicit path from bucket root ("" = bucket root) */
  const [uploadTargetPath, setUploadTargetPath] = React.useState<string | null>(null)

  // Upload state
  const [uploading, setUploading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [results, setResults] = React.useState<UploadResult[]>([])
  const [fileQueue, setFileQueue] = React.useState<FileUploadStatus[]>([])
  const [copiedField, setCopiedField] = React.useState<string | null>(null)
  const [optimize, setOptimize] = React.useState(true)
  const dropZoneRef = React.useRef<React.ComponentRef<typeof FileDropZone>>(null)

  // Sync upload target with explorer navigation
  const handleNavigate = React.useCallback((path: string) => {
    setCurrentPath(path)
  }, [])

  const handleSelectForUpload = React.useCallback((path: string) => {
    setUploadTargetPath(path)
  }, [])

  const resetCopyState = React.useCallback(() => {
    setTimeout(() => setCopiedField(null), 1800)
  }, [])

  const copyToClipboard = React.useCallback(
    async (text: string, field: string) => {
      try {
        await navigator.clipboard.writeText(text)
        setCopiedField(field)
        resetCopyState()
      } catch {
        setError("Unable to copy to clipboard.")
      }
    },
    [resetCopyState],
  )

  const uploadSingleFile = React.useCallback(
    async (file: File): Promise<UploadResult> => {
      const headers = await getHeaders()
      if (!headers["Authorization"] && !adminToken) {
        throw new Error("You must be signed in as an admin to upload files.")
      }
      const form = new FormData()
      form.append("file", file)
      form.append("optimize", optimize ? "true" : "false")
      if (uploadTargetPath !== null) {
        form.append("folderMode", "explorer")
        form.append("folderPath", uploadTargetPath)
      }
      // Don't send Content-Type - browser sets it with boundary for FormData
      const fetchHeaders: Record<string, string> = {}
      if (headers["Authorization"]) fetchHeaders["Authorization"] = headers["Authorization"]
      if (headers["X-Admin-Token"]) fetchHeaders["X-Admin-Token"] = headers["X-Admin-Token"]

      const resp = await fetch("/api/admin/upload-image", {
        method: "POST",
        headers: fetchHeaders,
        body: form,
        credentials: "same-origin",
      })
      const data = await resp.json().catch(() => null)
      if (!resp.ok) throw new Error(data?.error || "Upload failed")
      return data as UploadResult
    },
    [adminToken, optimize, uploadTargetPath, getHeaders],
  )

  const handleFiles = React.useCallback(
    async (files: File[]) => {
      if (files.length === 0) return
      setError(null)

      const invalidFiles: string[] = []
      const oversizedFiles: string[] = []
      for (const file of files) {
        if (!isFileAllowed(file)) invalidFiles.push(file.name)
        if (file.size > DEFAULT_MAX_MB * BYTES_IN_MB) oversizedFiles.push(file.name)
      }
      if (invalidFiles.length > 0) {
        setError(`Unsupported file type: ${invalidFiles.join(", ")}`)
        return
      }
      if (oversizedFiles.length > 0) {
        setError(`Files over ${DEFAULT_MAX_MB} MB: ${oversizedFiles.join(", ")}`)
        return
      }

      const queue: FileUploadStatus[] = files.map((f) => ({
        file: f,
        status: "pending" as const,
      }))
      setFileQueue(queue)
      setResults([])
      setUploading(true)

      const completedResults: UploadResult[] = []

      for (let i = 0; i < queue.length; i++) {
        setFileQueue((prev) =>
          prev.map((item, idx) => (idx === i ? { ...item, status: "uploading" } : item)),
        )
        try {
          const result = await uploadSingleFile(queue[i].file)
          completedResults.push(result)
          setFileQueue((prev) =>
            prev.map((item, idx) =>
              idx === i ? { ...item, status: "done", result } : item,
            ),
          )
        } catch (err) {
          const message = err instanceof Error ? err.message : "Upload failed"
          setFileQueue((prev) =>
            prev.map((item, idx) =>
              idx === i ? { ...item, status: "error", error: message } : item,
            ),
          )
        }
      }

      setResults(completedResults)
      setUploading(false)
    },
    [uploadSingleFile],
  )

  const displayedTarget =
    uploadTargetPath === null
      ? `UTILITY/${ADMIN_UPLOAD_PREFIX} (default)`
      : uploadTargetPath === ""
        ? "UTILITY/ (bucket root)"
        : `UTILITY/${uploadTargetPath}`

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-stone-900 dark:text-white flex items-center gap-2">
          <UploadCloud className="h-5 w-5 text-emerald-600" />
          Upload Media
        </h2>
        <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
          Browse the <span className="font-medium text-emerald-600">UTILITY</span> bucket from its root. Use{" "}
          <span className="font-medium">Upload here</span> to set the destination; otherwise uploads go to{" "}
          <span className="font-mono text-xs">{ADMIN_UPLOAD_PREFIX}</span>.
        </p>
      </div>

      {/* File Explorer */}
      <FileExplorer
        currentPath={currentPath}
        onNavigate={handleNavigate}
        onSelectForUpload={handleSelectForUpload}
        adminHeaders={getHeaders}
      />

      {/* Upload Target Indicator */}
      <div className="flex items-center gap-3 rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-900/10 px-4 py-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex-shrink-0">
          <FolderOpen className="h-4.5 w-4.5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium uppercase text-emerald-700 dark:text-emerald-400 tracking-wide">
            Upload destination
          </p>
          <p className="text-sm font-mono text-stone-700 dark:text-stone-300 truncate">
            {displayedTarget}
          </p>
        </div>
        {uploadTargetPath !== null && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-lg text-xs h-7"
            onClick={() => setUploadTargetPath(null)}
          >
            Use default folder
          </Button>
        )}
      </div>

      {/* Optimization Toggle */}
      <div className="flex items-center justify-between rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] p-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-9 h-9 rounded-lg flex items-center justify-center",
            optimize
              ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
              : "bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400",
          )}>
            <Sparkles className="h-4.5 w-4.5" />
          </div>
          <div>
            <label htmlFor="optimize-toggle" className="text-sm font-medium text-stone-900 dark:text-white cursor-pointer">
              Optimize images
            </label>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              {optimize
                ? "PNG, JPG, WebP will be compressed and converted to WebP"
                : "Files uploaded as-is without optimization"}
            </p>
          </div>
        </div>
        <Switch id="optimize-toggle" checked={optimize} onCheckedChange={setOptimize} disabled={uploading} />
      </div>

      {/* Drop Zone */}
      <FileDropZone
        ref={dropZoneRef}
        onFiles={(files) => void handleFiles(files)}
        acceptInput={ACCEPT_STRING}
        multiple
        disabled={uploading}
        className={cn(
          "relative rounded-2xl border-2 border-dashed p-10 text-center transition-all cursor-pointer border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] hover:border-emerald-300 dark:hover:border-emerald-800",
          uploading && "opacity-70 pointer-events-none",
        )}
        dragActiveClassName="!border-emerald-500 bg-emerald-50/70 dark:bg-emerald-500/10 scale-[1.01]"
        aria-disabled={uploading}
      >
        {({ isDragging }) => (
          <>
            <div className={cn(
              "mx-auto mb-4 w-16 h-16 rounded-2xl flex items-center justify-center transition-colors",
              isDragging
                ? "bg-emerald-500 text-white"
                : "bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 text-emerald-600 dark:text-emerald-400",
            )}>
              {uploading ? <Loader2 className="h-8 w-8 animate-spin" /> : <UploadCloud className="h-8 w-8" />}
            </div>

            <div className="text-base font-semibold text-stone-900 dark:text-white mb-1.5">
              {isDragging ? "Drop your files here" : uploading ? "Uploading..." : (
                <>Drag & drop files or <span className="text-emerald-600 dark:text-emerald-400">browse</span></>
              )}
            </div>

            <p className="text-sm text-stone-500 dark:text-stone-400 max-w-md mx-auto">
              Images, PDF, video, audio, CSV, JSON, TXT, ZIP, OBJ. Max {DEFAULT_MAX_MB} MB per file.
              <br />
              <span className="text-emerald-600 dark:text-emerald-400">Multiple files supported</span>
              {optimize && (
                <> {"\u00b7"} <span className="text-emerald-600 dark:text-emerald-400">Auto-optimization enabled</span></>
              )}
            </p>
          </>
        )}
      </FileDropZone>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-200 flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="ml-3 flex-shrink-0 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none rounded-sm" aria-label="Dismiss error" title="Dismiss error">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Upload Progress Queue */}
      {fileQueue.length > 0 && uploading && (
        <div className="rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] p-4 space-y-2">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-stone-700 dark:text-stone-300">
              Uploading {fileQueue.filter((f) => f.status === "done").length}/{fileQueue.length} files
            </p>
            <div className="h-1.5 flex-1 mx-4 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${(fileQueue.filter((f) => f.status === "done").length / fileQueue.length) * 100}%` }}
              />
            </div>
          </div>
          {fileQueue.map((item, idx) => (
            <div key={idx} className="flex items-center gap-3 text-sm">
              {item.status === "uploading" && <Loader2 className="h-4 w-4 animate-spin text-emerald-600 flex-shrink-0" />}
              {item.status === "done" && <Check className="h-4 w-4 text-emerald-600 flex-shrink-0" />}
              {item.status === "error" && <X className="h-4 w-4 text-red-500 flex-shrink-0" />}
              {item.status === "pending" && <div className="h-4 w-4 rounded-full border-2 border-stone-300 dark:border-stone-600 flex-shrink-0" />}
              <span className={cn(
                "truncate",
                item.status === "done" && "text-stone-500 dark:text-stone-400",
                item.status === "uploading" && "text-stone-900 dark:text-white font-medium",
                item.status === "error" && "text-red-600 dark:text-red-400",
                item.status === "pending" && "text-stone-400 dark:text-stone-500",
              )}>
                {item.file.name}
              </span>
              <span className="text-xs text-stone-400 flex-shrink-0">{formatBytes(item.file.size)}</span>
              {item.error && <span className="text-xs text-red-500 flex-shrink-0">{item.error}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {!uploading && results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center flex-shrink-0">
              <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-stone-900 dark:text-white">
                {results.length === 1 ? "Upload Complete!" : `${results.length} Files Uploaded!`}
              </h3>
              <p className="text-sm text-stone-500 dark:text-stone-400">
                Stored in <span className="font-medium">UTILITY</span>
                {uploadTargetPath ? <> / <span className="font-mono text-xs">{uploadTargetPath}</span></> : null}
              </p>
            </div>
          </div>

          {fileQueue.some((f) => f.status === "error") && (
            <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-200 space-y-1">
              {fileQueue.filter((f) => f.status === "error").map((f, i) => (
                <div key={i}>{f.file.name}: {f.error}</div>
              ))}
            </div>
          )}

          {results.map((result, idx) => (
            <ResultCard
              key={idx}
              result={result}
              index={idx}
              total={results.length}
              copiedField={copiedField}
              onCopy={copyToClipboard}
            />
          ))}

          <Button
            type="button"
            variant="outline"
            className="w-full rounded-xl"
            onClick={() => {
              setResults([])
              setFileQueue([])
              dropZoneRef.current?.openFilePicker()
            }}
          >
            <UploadCloud className="mr-2 h-4 w-4" />
            Upload More
          </Button>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Result Card                                                        */
/* ------------------------------------------------------------------ */

function ResultCard({
  result,
  index,
  total,
  copiedField,
  onCopy,
}: {
  result: UploadResult
  index: number
  total: number
  copiedField: string | null
  onCopy: (text: string, field: string) => void
}) {
  const compressionPct = React.useMemo(() => {
    if (typeof result.compressionPercent === "number") {
      return Math.max(0, result.compressionPercent)
    }
    if (!result.originalSize) return 0
    return Math.max(0, 100 - Math.round((result.size / result.originalSize) * 100))
  }, [result])

  return (
    <div className="rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] p-5 space-y-4">
      {total > 1 && (
        <p className="text-xs font-semibold uppercase text-stone-400">
          File {index + 1} of {total}
        </p>
      )}

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
              onClick={() => onCopy(result.url || "", `url-${index}`)}
            >
              {copiedField === `url-${index}` ? (
                <><Check className="mr-2 h-4 w-4" />Copied</>
              ) : (
                <><Copy className="mr-2 h-4 w-4" />Copy</>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Compression / File Info */}
        <div className="rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-stone-50 dark:bg-[#1a1a1d] p-4">
          <div className="flex items-center gap-2 mb-3">
            {result.optimized !== false ? (
              <Sparkles className="h-4 w-4 text-emerald-600" />
            ) : result.isImage !== false ? (
              <FileImage className="h-4 w-4 text-blue-600" />
            ) : (
              <File className="h-4 w-4 text-blue-600" />
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
                    {formatBytes(result.originalSize)} {"\u00b7"} {result.originalMimeType}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Optimized</span>
                  <span className="font-medium text-stone-700 dark:text-stone-300">
                    {formatBytes(result.size)} {"\u00b7"} {result.mimeType}
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
                  <span className="font-medium text-stone-700 dark:text-stone-300">{result.mimeType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Size</span>
                  <span className="font-medium text-stone-700 dark:text-stone-300">{formatBytes(result.size)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Status</span>
                  <span className="font-medium text-blue-600 dark:text-blue-400">Uploaded as-is</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Storage Path */}
        <div className="rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-stone-50 dark:bg-[#1a1a1d] p-4">
          <div className="flex items-center gap-2 mb-3">
            {result.isImage !== false ? (
              <FileImage className="h-4 w-4 text-emerald-600" />
            ) : (
              <File className="h-4 w-4 text-emerald-600" />
            )}
            <span className="text-xs font-semibold uppercase text-stone-500 dark:text-stone-400">
              Storage Path
            </span>
          </div>
          <div className="space-y-2">
            <Input
              readOnly
              value={result.path}
              onFocus={(e) => e.currentTarget.select()}
              className="rounded-lg font-mono text-xs bg-white dark:bg-[#2a2a2d]"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-lg w-full"
              onClick={() => onCopy(result.path, `path-${index}`)}
            >
              {copiedField === `path-${index}` ? (
                <><Check className="mr-2 h-3.5 w-3.5" />Copied</>
              ) : (
                <><Copy className="mr-2 h-3.5 w-3.5" />Copy Path</>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
