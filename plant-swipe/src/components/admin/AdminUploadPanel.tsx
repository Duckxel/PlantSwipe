import React from "react"
import { UploadCloud, Loader2, Check, Copy, FileImage, File, Sparkles, FolderOpen, FolderPlus, ChevronDown, X } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"

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

type RuntimeEnv = {
  __ENV__?: Record<string, string | undefined>
}

const BYTES_IN_MB = 1024 * 1024
const DEFAULT_MAX_MB = 15

const ALLOWED_MIME_TYPES = new Set([
  // Images
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/heic",
  "image/heif",
  "image/gif",
  "image/tiff",
  "image/bmp",
  "image/svg+xml",
  // Documents
  "application/pdf",
  "application/json",
  "text/csv",
  "text/plain",
  "text/markdown",
  // Videos
  "video/mp4",
  "video/webm",
  "video/quicktime",
  // Audio
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  // Archives
  "application/zip",
  // 3D Models
  "model/obj",
])

// Extensions that browsers report as application/octet-stream or empty
// Listed explicitly so the file picker shows them and validation accepts them
const ALLOWED_EXTENSIONS = new Set([".obj"])

const ACCEPT_STRING = [
  ...Array.from(ALLOWED_MIME_TYPES),
  ...Array.from(ALLOWED_EXTENSIONS),
].join(",")

function getFileExtension(name: string): string {
  const dot = name.lastIndexOf(".")
  return dot >= 0 ? name.slice(dot).toLowerCase() : ""
}

function isFileAllowed(file: File): boolean {
  const mime = (file.type || "").toLowerCase()
  if (ALLOWED_MIME_TYPES.has(mime)) return true
  // Fallback: check extension for types browsers don't recognise (e.g. .obj)
  return ALLOWED_EXTENSIONS.has(getFileExtension(file.name))
}

function formatBytes(value: number) {
  if (!Number.isFinite(value)) return "-"
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(2)} MB`
}

type FileUploadStatus = {
  file: File
  status: "pending" | "uploading" | "done" | "error"
  result?: UploadResult
  error?: string
}

export const AdminUploadPanel: React.FC = () => {
  const [dragActive, setDragActive] = React.useState(false)
  const [uploading, setUploading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [results, setResults] = React.useState<UploadResult[]>([])
  const [fileQueue, setFileQueue] = React.useState<FileUploadStatus[]>([])
  const [copiedField, setCopiedField] = React.useState<string | null>(null)
  const [optimize, setOptimize] = React.useState(true)
  const inputRef = React.useRef<HTMLInputElement | null>(null)

  // Folder state
  const [folders, setFolders] = React.useState<string[]>([])
  const [loadingFolders, setLoadingFolders] = React.useState(false)
  const [selectedFolder, setSelectedFolder] = React.useState<string>("")
  const [showNewFolder, setShowNewFolder] = React.useState(false)
  const [newFolderName, setNewFolderName] = React.useState("")
  const [folderDropdownOpen, setFolderDropdownOpen] = React.useState(false)
  const dropdownRef = React.useRef<HTMLDivElement | null>(null)

  const runtimeEnv = (globalThis as typeof globalThis & RuntimeEnv).__ENV__
  const adminToken =
    import.meta.env?.VITE_ADMIN_STATIC_TOKEN ?? runtimeEnv?.VITE_ADMIN_STATIC_TOKEN

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
        setError("Unable to copy to clipboard. Please copy manually.")
      }
    },
    [resetCopyState],
  )

  // Load folders on mount
  React.useEffect(() => {
    void loadFolders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Close dropdown on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setFolderDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const loadFolders = React.useCallback(async () => {
    setLoadingFolders(true)
    try {
      const session = (await supabase.auth.getSession()).data.session
      const token = session?.access_token
      const headers: Record<string, string> = {}
      if (token) headers["Authorization"] = `Bearer ${token}`
      if (adminToken) headers["X-Admin-Token"] = String(adminToken)

      const resp = await fetch("/api/admin/upload-folders", { headers, credentials: "same-origin" })
      const data = await resp.json().catch(() => null)
      if (resp.ok && data?.folders) {
        setFolders(data.folders)
      }
    } catch {
      // Silently fail - folder list is optional
    } finally {
      setLoadingFolders(false)
    }
  }, [adminToken])

  const handleCreateFolder = React.useCallback(() => {
    const trimmed = newFolderName.trim()
    if (!trimmed) return
    // Build the full path: if a folder is selected, nest under it; otherwise use as root
    const fullPath = selectedFolder ? `${selectedFolder}/${trimmed}` : trimmed
    setSelectedFolder(fullPath)
    if (!folders.includes(fullPath)) {
      setFolders((prev) => [...prev, fullPath].sort())
    }
    setNewFolderName("")
    setShowNewFolder(false)
    setFolderDropdownOpen(false)
  }, [newFolderName, selectedFolder, folders])

  const uploadSingleFile = React.useCallback(
    async (file: File): Promise<UploadResult> => {
      const session = (await supabase.auth.getSession()).data.session
      const token = session?.access_token
      if (!token && !adminToken) {
        throw new Error("You must be signed in as an admin to upload files.")
      }
      const form = new FormData()
      form.append("file", file)
      form.append("optimize", optimize ? "true" : "false")
      if (selectedFolder) {
        form.append("folderPath", selectedFolder)
      }
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
      return data as UploadResult
    },
    [adminToken, optimize, selectedFolder],
  )

  const handleFiles = React.useCallback(
    async (files: File[]) => {
      if (files.length === 0) return
      setError(null)

      // Validate all files first
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

      // Build queue
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
          prev.map((item, idx) => (idx === i ? { ...item, status: "uploading" } : item))
        )
        try {
          const result = await uploadSingleFile(queue[i].file)
          completedResults.push(result)
          setFileQueue((prev) =>
            prev.map((item, idx) =>
              idx === i ? { ...item, status: "done", result } : item
            )
          )
        } catch (err) {
          const message = err instanceof Error ? err.message : "Upload failed"
          setFileQueue((prev) =>
            prev.map((item, idx) =>
              idx === i ? { ...item, status: "error", error: message } : item
            )
          )
        }
      }

      setResults(completedResults)
      setUploading(false)
      // Refresh folders in case a new path was created
      void loadFolders()
    },
    [uploadSingleFile, loadFolders],
  )

  const handleDrop = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      event.stopPropagation()
      setDragActive(false)
      const files = Array.from(event.dataTransfer.files || [])
      void handleFiles(files)
    },
    [handleFiles],
  )

  const handleBrowseClick = React.useCallback(() => {
    inputRef.current?.click()
  }, [])

  const handleFileChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || [])
      void handleFiles(files)
      if (inputRef.current) inputRef.current.value = ""
    },
    [handleFiles],
  )

  const displayedFolder = selectedFolder || "admin/uploads (default)"

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-stone-900 dark:text-white flex items-center gap-2">
          <UploadCloud className="h-5 w-5 text-emerald-600" />
          Upload Media
        </h2>
        <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
          Drop files to {optimize ? "optimize and " : ""}store them in the <span className="font-medium text-emerald-600">UTILITY</span> bucket
        </p>
      </div>

      {/* Folder Selector */}
      <div className="rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
            <FolderOpen className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <label className="text-sm font-medium text-stone-900 dark:text-white">
              Destination Folder
            </label>
            <p className="text-xs text-stone-500 dark:text-stone-400 truncate">
              {displayedFolder}
            </p>
          </div>
        </div>

        {/* Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setFolderDropdownOpen(!folderDropdownOpen)}
            disabled={uploading}
            className={cn(
              "w-full flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm transition-colors text-left",
              "border-stone-200 dark:border-[#3e3e42] bg-stone-50 dark:bg-[#2a2a2d]",
              "hover:border-emerald-300 dark:hover:border-emerald-800",
              "text-stone-900 dark:text-white",
              uploading && "opacity-50 cursor-not-allowed",
            )}
          >
            <span className="truncate font-mono text-xs">
              {selectedFolder || "admin/uploads (default)"}
            </span>
            <ChevronDown className={cn("h-4 w-4 flex-shrink-0 ml-2 transition-transform", folderDropdownOpen && "rotate-180")} />
          </button>

          {folderDropdownOpen && (
            <div className="absolute z-50 mt-1 w-full rounded-lg border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] shadow-lg max-h-64 overflow-y-auto">
              {/* Default option */}
              <button
                type="button"
                className={cn(
                  "w-full text-left px-3 py-2 text-sm hover:bg-stone-50 dark:hover:bg-[#2a2a2d] transition-colors font-mono",
                  !selectedFolder && "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400",
                )}
                onClick={() => {
                  setSelectedFolder("")
                  setFolderDropdownOpen(false)
                }}
              >
                admin/uploads (default)
              </button>

              {loadingFolders && (
                <div className="px-3 py-2 text-xs text-stone-400 flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading folders...
                </div>
              )}

              {folders.map((folder) => (
                <button
                  key={folder}
                  type="button"
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm hover:bg-stone-50 dark:hover:bg-[#2a2a2d] transition-colors font-mono",
                    selectedFolder === folder && "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400",
                  )}
                  onClick={() => {
                    setSelectedFolder(folder)
                    setFolderDropdownOpen(false)
                  }}
                >
                  {folder}
                </button>
              ))}

              {/* Divider + create new */}
              <div className="border-t border-stone-200 dark:border-[#3e3e42]">
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-stone-50 dark:hover:bg-[#2a2a2d] transition-colors flex items-center gap-2 text-blue-600 dark:text-blue-400"
                  onClick={() => {
                    setShowNewFolder(true)
                    setFolderDropdownOpen(false)
                  }}
                >
                  <FolderPlus className="h-4 w-4" />
                  Create new folder...
                </button>
              </div>
            </div>
          )}
        </div>

        {/* New Folder Input */}
        {showNewFolder && (
          <div className="flex gap-2 items-center">
            <div className="flex-1 relative">
              <Input
                placeholder="New folder name (e.g. blog/covers)"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreateFolder() }}
                className="rounded-lg font-mono text-xs pr-8"
                autoFocus
              />
              {selectedFolder && (
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 pointer-events-none hidden sm:inline">
                </span>
              )}
            </div>
            <Button
              type="button"
              size="sm"
              className="rounded-lg"
              onClick={handleCreateFolder}
              disabled={!newFolderName.trim()}
            >
              <FolderPlus className="mr-1.5 h-3.5 w-3.5" />
              Create
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-lg"
              onClick={() => { setShowNewFolder(false); setNewFolderName("") }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
        {showNewFolder && selectedFolder && (
          <p className="text-xs text-stone-400">
            Will create under: <span className="font-mono">{selectedFolder}/{newFolderName || "..."}</span>
          </p>
        )}
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
              htmlFor="optimize-toggle"
              className="text-sm font-medium text-stone-900 dark:text-white cursor-pointer"
            >
              Optimize file
            </label>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              {optimize
                ? "PNG, JPG, WebP images will be compressed and converted to WebP"
                : "File will be uploaded as-is without optimization"
              }
            </p>
          </div>
        </div>
        <Switch
          id="optimize-toggle"
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
          accept={ACCEPT_STRING}
          multiple
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
            "Drop your files here"
          ) : uploading ? (
            "Uploading..."
          ) : (
            <>
              Drag & drop files or{" "}
              <span className="text-emerald-600 dark:text-emerald-400">browse</span>
            </>
          )}
        </div>

        <p className="text-sm text-stone-500 dark:text-stone-400 max-w-sm mx-auto">
          Images, PDF, video, audio, CSV, JSON, TXT, ZIP, OBJ. Max {DEFAULT_MAX_MB} MB per file.
          <br />
          <span className="text-emerald-600 dark:text-emerald-400">Multiple files supported</span>
          {optimize && (
            <>
              {" · "}
              <span className="text-emerald-600 dark:text-emerald-400">PNG, JPG, WebP optimized automatically</span>
            </>
          )}
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-200">
          {error}
        </div>
      )}

      {/* Upload Progress Queue */}
      {fileQueue.length > 0 && uploading && (
        <div className="rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] p-4 space-y-2">
          <p className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-3">
            Uploading {fileQueue.filter((f) => f.status === "done").length}/{fileQueue.length} files...
          </p>
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
                {selectedFolder ? <> / <span className="font-mono text-xs">{selectedFolder}</span></> : null}
              </p>
            </div>
          </div>

          {/* Show errors from queue if any */}
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

          {/* Upload More */}
          <Button
            type="button"
            variant="outline"
            className="w-full rounded-xl"
            onClick={() => {
              setResults([])
              setFileQueue([])
              inputRef.current?.click()
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
    </div>
  )
}
