import React from "react"
import {
  UploadCloud, Loader2, Check, X, Trash2, Layers, Leaf, Scan,
  ArrowLeft, RefreshCw, ChevronRight, CheckSquare, Square,
  ImageIcon, AlertCircle, ExternalLink, FolderPlus, Unlink,
  CheckCircle2, Eye,
} from "lucide-react"
import { Link } from "react-router-dom"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { FileDropZone } from "@/components/ui/file-drop-zone"
import { ImageViewer } from "@/components/ui/image-viewer"
import { SearchItem, type SearchItemOption } from "@/components/ui/search-item"
import { buildAdminRequestHeaders } from "@/lib/adminAuth"
import { supabase } from "@/lib/supabaseClient"
import { uploadAndIdentifyPlant } from "@/lib/plantScan"

/* -----------------------------------------------------------------------
   Types
----------------------------------------------------------------------- */

interface DumpGroup {
  id: string
  name: string | null
  plant_id: string | null
  created_at: string
  updated_at: string
  plants?: { id: string; name: string; scientific_name_species?: string | null } | null
}

interface DumpImage {
  id: string
  bucket: string
  path: string
  url: string
  original_name: string | null
  size_bytes: number | null
  group_id: string | null
  plant_id: string | null
  uploaded_by: string | null
  uploaded_at: string
  status: "pending" | "submitted" | "deleted"
  plant_dump_groups?: DumpGroup | null
  plants?: { id: string; name: string; scientific_name_species?: string | null } | null
  uploader?: { id: string; display_name?: string | null; avatar_url?: string | null } | null
}

type FileUploadStatus = {
  id: string
  file: File
  preview: string
  status: "pending" | "uploading" | "done" | "error"
  progress: number
  result?: DumpImage
  error?: string
}

type ActiveTab = "upload" | "manage"

/* -----------------------------------------------------------------------
   Helpers
----------------------------------------------------------------------- */

function formatBytes(bytes: number | null | undefined) {
  if (!bytes || !Number.isFinite(bytes)) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatRelative(iso: string | null | undefined) {
  if (!iso) return ""
  try {
    const d = new Date(iso)
    const diff = Date.now() - d.getTime()
    if (diff < 60_000) return "just now"
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
    if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`
    return d.toLocaleDateString()
  } catch {
    return ""
  }
}

/* -----------------------------------------------------------------------
   Main page component
----------------------------------------------------------------------- */

export function AdminPlantDumpPage() {
  const [activeTab, setActiveTab] = React.useState<ActiveTab>("upload")

  // Upload tab state
  const [queue, setQueue] = React.useState<FileUploadStatus[]>([])
  const uploadingCount = React.useRef(0)
  const uploadingIds = React.useRef(new Set<string>())
  const MAX_CONCURRENT = 5

  // Manage tab state
  const [images, setImages] = React.useState<DumpImage[]>([])
  const [groups, setGroups] = React.useState<DumpGroup[]>([])
  const [loadingManage, setLoadingManage] = React.useState(false)
  const [manageError, setManageError] = React.useState<string | null>(null)

  // Selection
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const lastClickedRef = React.useRef<string | null>(null)

  // Detail panel
  const [detailImage, setDetailImage] = React.useState<DumpImage | null>(null)
  const [detailGroup, setDetailGroup] = React.useState<DumpGroup | null>(null)

  // Viewer
  const [viewerOpen, setViewerOpen] = React.useState(false)
  const [viewerUrl, setViewerUrl] = React.useState("")

  // Scan state
  type ScanResult = { id: string; name: string; probability: number; dbPlantId?: string | null; dbSearchDone?: boolean }
  const [scanning, setScanning] = React.useState(false)
  const [scanResults, setScanResults] = React.useState<ScanResult[] | null>(null)
  const [scanError, setScanError] = React.useState<string | null>(null)

  // Dialogs
  const [confirmDelete, setConfirmDelete] = React.useState<{ ids: string[]; isGroup?: boolean; groupId?: string } | null>(null)
  const [deleting, setDeleting] = React.useState(false)
  const [submitDialog, setSubmitDialog] = React.useState<{ ids: string[]; plant: { id: string; name: string } | null } | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [successInfo, setSuccessInfo] = React.useState<{ plantId: string; plantName: string; count: number } | null>(null)

  // Group creation
  const [creatingGroup, setCreatingGroup] = React.useState(false)
  const [newGroupName, setNewGroupName] = React.useState("")
  const [savingGroup, setSavingGroup] = React.useState(false)

  // Plant search for bulk assign
  const [bulkAssignOpen, setBulkAssignOpen] = React.useState(false)

  /* -----------------------------------------------------------------------
     Auth headers
  ----------------------------------------------------------------------- */
  const getHeaders = React.useCallback(async () => {
    return buildAdminRequestHeaders()
  }, [])

  /* -----------------------------------------------------------------------
     Load manage data
  ----------------------------------------------------------------------- */
  const loadManageData = React.useCallback(async () => {
    setLoadingManage(true)
    setManageError(null)
    try {
      const headers = await getHeaders()
      const resp = await fetch("/api/admin/plant-dump/list", { headers })
      const data = await resp.json().catch(() => null)
      if (!resp.ok) throw new Error(data?.error || "Failed to load dump images")
      setImages(Array.isArray(data.images) ? data.images : [])
      setGroups(Array.isArray(data.groups) ? data.groups : [])
    } catch (err) {
      setManageError(err instanceof Error ? err.message : "Failed to load")
    } finally {
      setLoadingManage(false)
    }
  }, [getHeaders])

  React.useEffect(() => {
    if (activeTab === "manage") {
      void loadManageData()
    }
  }, [activeTab, loadManageData])

  /* -----------------------------------------------------------------------
     Upload logic
  ----------------------------------------------------------------------- */
  const processNextInQueue = React.useCallback(async (queueSnapshot: FileUploadStatus[]) => {
    const pending = queueSnapshot.filter(f => f.status === "pending" && !uploadingIds.current.has(f.id))
    const available = MAX_CONCURRENT - uploadingCount.current
    if (available <= 0 || pending.length === 0) return

    const toStart = pending.slice(0, available)

    for (const item of toStart) {
      uploadingIds.current.add(item.id)
      uploadingCount.current += 1
      setQueue(prev => prev.map(f => f.id === item.id ? { ...f, status: "uploading" } : f))

      // Upload
      ;(async () => {
        try {
          const headers = await getHeaders()
          const formData = new FormData()
          formData.append("file", item.file)

          const resp = await fetch("/api/admin/plant-dump/upload", {
            method: "POST",
            headers,
            body: formData,
          })
          const data = await resp.json().catch(() => null)
          if (!resp.ok) throw new Error(data?.error || "Upload failed")

          const dumpImage: DumpImage = data.image
          setQueue(prev => prev.map(f =>
            f.id === item.id ? { ...f, status: "done", progress: 100, result: dumpImage } : f
          ))
          // Add newly uploaded image to manage grid if already visible
          setImages(prev => dumpImage ? [dumpImage, ...prev] : prev)
        } catch (err) {
          setQueue(prev => prev.map(f =>
            f.id === item.id
              ? { ...f, status: "error", error: err instanceof Error ? err.message : "Upload failed" }
              : f
          ))
        } finally {
          uploadingIds.current.delete(item.id)
          uploadingCount.current = Math.max(0, uploadingCount.current - 1)
          // Trigger next batch from current queue state
          setQueue(current => {
            void processNextInQueue(current)
            return current
          })
        }
      })()
    }
  }, [getHeaders])

  const addFiles = React.useCallback((files: File[]) => {
    const items: FileUploadStatus[] = files.map(file => ({
      id: `${Date.now()}-${(() => { const arr = new Uint32Array(2); crypto.getRandomValues(arr); return (arr[0].toString(36) + arr[1].toString(36)); })()}`,
      file,
      preview: URL.createObjectURL(file),
      status: "pending",
      progress: 0,
    }))
    setQueue(prev => {
      const next = [...prev, ...items]
      void processNextInQueue(next)
      return next
    })
  }, [processNextInQueue])

  const clearDone = React.useCallback(() => {
    setQueue(prev => {
      const removed = prev.filter(f => f.status === "done")
      removed.forEach(f => URL.revokeObjectURL(f.preview))
      return prev.filter(f => f.status !== "done")
    })
  }, [])

  const retryErrors = React.useCallback(() => {
    setQueue(prev => {
      const next = prev.map(f => f.status === "error" ? { ...f, status: "pending" as const, error: undefined } : f)
      void processNextInQueue(next)
      return next
    })
  }, [processNextInQueue])

  /* -----------------------------------------------------------------------
     Selection helpers
  ----------------------------------------------------------------------- */
  const toggleSelect = React.useCallback((id: string, shift: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (shift && lastClickedRef.current) {
        // Range select on ungrouped images list
        const allIds = images.map(i => i.id)
        const a = allIds.indexOf(lastClickedRef.current)
        const b = allIds.indexOf(id)
        if (a !== -1 && b !== -1) {
          const [lo, hi] = a < b ? [a, b] : [b, a]
          for (let i = lo; i <= hi; i++) {
            next.add(allIds[i])
          }
        }
      } else {
        if (next.has(id)) next.delete(id)
        else next.add(id)
      }
      lastClickedRef.current = id
      return next
    })
  }, [images])

  const selectAll = React.useCallback(() => {
    setSelectedIds(new Set(images.map(i => i.id)))
  }, [images])

  const clearSelection = React.useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  /* -----------------------------------------------------------------------
     Group management
  ----------------------------------------------------------------------- */
  const createGroup = React.useCallback(async () => {
    if (selectedIds.size === 0 && !newGroupName) return
    setSavingGroup(true)
    try {
      const headers = await getHeaders()
      headers["Content-Type"] = "application/json"
      const resp = await fetch("/api/admin/plant-dump/groups", {
        method: "POST",
        headers,
        body: JSON.stringify({ name: newGroupName || null, imageIds: [...selectedIds] }),
      })
      const data = await resp.json().catch(() => null)
      if (!resp.ok) throw new Error(data?.error || "Failed to create group")
      setNewGroupName("")
      setCreatingGroup(false)
      setSelectedIds(new Set())
      void loadManageData()
    } catch (err) {
      setManageError(err instanceof Error ? err.message : "Failed to create group")
    } finally {
      setSavingGroup(false)
    }
  }, [selectedIds, newGroupName, getHeaders, loadManageData])

  const removeFromGroup = React.useCallback(async (imageIds: string[]) => {
    try {
      const headers = await getHeaders()
      headers["Content-Type"] = "application/json"
      await fetch("/api/admin/plant-dump/images/move-group", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ imageIds, groupId: null }),
      })
      void loadManageData()
    } catch {}
  }, [getHeaders, loadManageData])

  const addToGroup = React.useCallback(async (imageIds: string[], groupId: string) => {
    try {
      const headers = await getHeaders()
      headers["Content-Type"] = "application/json"
      await fetch("/api/admin/plant-dump/images/move-group", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ imageIds, groupId }),
      })
      void loadManageData()
    } catch {}
  }, [getHeaders, loadManageData])

  /* -----------------------------------------------------------------------
     Plant assignment
  ----------------------------------------------------------------------- */
  const searchPlants = React.useCallback(async (query: string): Promise<SearchItemOption[]> => {
    if (!query || query.trim().length < 1) return []
    try {
      const { data } = await supabase
        .from("plants")
        .select("id, name, scientific_name_species")
        .or(`name.ilike.%${query}%,scientific_name_species.ilike.%${query}%`)
        .limit(20)
      if (!data?.length) return []

      const ids = data.map(p => p.id)
      const { data: trans } = await supabase
        .from("plant_translations")
        .select("plant_id, variety")
        .in("plant_id", ids)
        .eq("language", "en")

      const varMap = new Map((trans || []).map(t => [t.plant_id, (t.variety || "").trim()]))

      return data.map(p => {
        const variety = varMap.get(p.id) || ""
        const sci = p.scientific_name_species || ""
        const parts = [variety && `'${variety}'`, sci].filter(Boolean)
        return {
          id: p.id,
          label: p.name,
          description: parts.join(" · ") || undefined,
        }
      })
    } catch {
      return []
    }
  }, [])

  const assignPlant = React.useCallback(async (plantId: string, imageIds?: string[], groupId?: string) => {
    try {
      const headers = await getHeaders()
      headers["Content-Type"] = "application/json"
      await fetch("/api/admin/plant-dump/assign-plant", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ plantId, imageIds, groupId }),
      })
      void loadManageData()
      if (detailImage) {
        setDetailImage(prev => prev ? { ...prev, plant_id: plantId } : prev)
      }
      if (detailGroup) {
        setDetailGroup(prev => prev ? { ...prev, plant_id: plantId } : prev)
      }
    } catch {}
  }, [getHeaders, loadManageData, detailImage, detailGroup])

  const unassignPlant = React.useCallback(async (imageIds?: string[], groupId?: string) => {
    await assignPlant("", imageIds, groupId)
  }, [assignPlant])

  /* -----------------------------------------------------------------------
     Scan
  ----------------------------------------------------------------------- */
  const runScan = React.useCallback(async (img: DumpImage) => {
    setScanError(null)
    setScanResults(null)
    setScanning(true)
    try {
      // Fetch the dump image as a Blob and re-submit for AI identification
      const resp = await fetch(img.url)
      if (!resp.ok) throw new Error("Failed to fetch image for scan")
      const blob = await resp.blob()
      const file = new File([blob], img.original_name || "dump-image.webp", { type: "image/webp" })
      const result = await uploadAndIdentifyPlant(file)
      const top5 = result.identification.result.classification.suggestions.slice(0, 5)
      const initial: ScanResult[] = top5.map(s => ({ id: s.id, name: s.name, probability: s.probability }))
      setScanResults(initial)

      // Async DB matching for each suggestion
      const matchAll = initial.map(async (item) => {
        try {
          const safe = item.name.replace(/[%_\\]/g, c => `\\${c}`)
          const { data } = await supabase
            .from("plants")
            .select("id")
            .or(`name.ilike.${safe},scientific_name_species.ilike.${safe}`)
            .limit(1)
            .maybeSingle()
          return { ...item, dbPlantId: data?.id || null, dbSearchDone: true }
        } catch {
          return { ...item, dbPlantId: null, dbSearchDone: true }
        }
      })
      const matched = await Promise.all(matchAll)
      setScanResults(matched)
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Scan failed")
    } finally {
      setScanning(false)
    }
  }, [])

  /* -----------------------------------------------------------------------
     Delete
  ----------------------------------------------------------------------- */
  const handleDelete = React.useCallback(async () => {
    if (!confirmDelete) return
    setDeleting(true)
    try {
      const headers = await getHeaders()
      headers["Content-Type"] = "application/json"

      if (confirmDelete.groupId) {
        await fetch("/api/admin/plant-dump/groups", {
          method: "DELETE",
          headers,
          body: JSON.stringify({ groupId: confirmDelete.groupId, deleteImages: confirmDelete.ids.length > 0 }),
        })
      }

      if (confirmDelete.ids.length > 0) {
        await fetch("/api/admin/plant-dump/images", {
          method: "DELETE",
          headers,
          body: JSON.stringify({ imageIds: confirmDelete.ids }),
        })
      }

      setSelectedIds(new Set())
      if (detailImage && (confirmDelete.ids.includes(detailImage.id) || confirmDelete.isGroup)) {
        setDetailImage(null)
      }
      if (detailGroup && confirmDelete.groupId === detailGroup.id) {
        setDetailGroup(null)
      }
      setConfirmDelete(null)
      void loadManageData()
    } catch (err) {
      setManageError(err instanceof Error ? err.message : "Delete failed")
    } finally {
      setDeleting(false)
    }
  }, [confirmDelete, getHeaders, detailImage, detailGroup, loadManageData])

  /* -----------------------------------------------------------------------
     Submit
  ----------------------------------------------------------------------- */
  const handleSubmit = React.useCallback(async () => {
    if (!submitDialog?.plant) return
    setSubmitting(true)
    try {
      const headers = await getHeaders()
      headers["Content-Type"] = "application/json"
      const resp = await fetch("/api/admin/plant-dump/submit", {
        method: "POST",
        headers,
        body: JSON.stringify({
          imageIds: submitDialog.ids,
          plantId: submitDialog.plant.id,
        }),
      })
      const data = await resp.json().catch(() => null)
      if (!resp.ok) throw new Error(data?.error || "Submit failed")

      const submittedCount = (data.submitted || []).length
      setSuccessInfo({ plantId: submitDialog.plant.id, plantName: submitDialog.plant.name, count: submittedCount })
      setSubmitDialog(null)
      setSelectedIds(new Set())
      setDetailImage(null)
      setDetailGroup(null)
      setScanResults(null)
      void loadManageData()
    } catch (err) {
      setManageError(err instanceof Error ? err.message : "Submit failed")
      setSubmitDialog(null)
    } finally {
      setSubmitting(false)
    }
  }, [submitDialog, getHeaders, loadManageData])

  /* -----------------------------------------------------------------------
     Drag-drop for grouping
  ----------------------------------------------------------------------- */
  const onDragStart = React.useCallback((e: React.DragEvent, imageId: string) => {
    e.dataTransfer.setData("text/plain", imageId)
    e.dataTransfer.effectAllowed = "move"
  }, [])

  const onDropOnGroup = React.useCallback((e: React.DragEvent, groupId: string) => {
    e.preventDefault()
    const imageId = e.dataTransfer.getData("text/plain")
    if (imageId) void addToGroup([imageId], groupId)
  }, [addToGroup])

  /* -----------------------------------------------------------------------
     Derived state
  ----------------------------------------------------------------------- */
  const ungroupedImages = images.filter(i => !i.group_id)

  // ⚡ Bolt: Calculate multiple queue status counts using a single-pass loop instead of chained .filter().length calls
  let doneCount = 0, uploadingCountDisplay = 0, errorCount = 0;
  for (let i = 0; i < queue.length; i++) {
    const status = queue[i].status;
    if (status === "done") doneCount++;
    else if (status === "uploading") uploadingCountDisplay++;
    else if (status === "error") errorCount++;
  }

  /* -----------------------------------------------------------------------
     Render helpers
  ----------------------------------------------------------------------- */
  const renderImageCard = (img: DumpImage, inGroup = false) => {
    const isSelected = selectedIds.has(img.id)
    const plant = img.plants || (img.plant_id ? { id: img.plant_id, name: "Assigned" } : null)

    return (
      <div
        key={img.id}
        draggable
        onDragStart={e => onDragStart(e, img.id)}
        onClick={() => {
          setDetailImage(img)
          setDetailGroup(null)
          setScanResults(null)
        }}
        className={cn(
          "group relative rounded-xl overflow-hidden cursor-pointer border-2 transition-all",
          isSelected && !inGroup
            ? "border-emerald-500 ring-2 ring-emerald-300 dark:ring-emerald-700"
            : "border-transparent hover:border-stone-300 dark:hover:border-stone-600",
          inGroup && "border-transparent hover:border-emerald-400 dark:hover:border-emerald-600 cursor-pointer",
        )}
      >
        {/* Thumbnail */}
        <div className="aspect-square bg-stone-100 dark:bg-stone-800 relative">
          <img
            src={img.url}
            alt={img.original_name || "dump image"}
            className="w-full h-full object-cover"
            loading="lazy"
          />

          {/* Selection checkbox (ungrouped only) */}
          {!inGroup && (
            <div
              className="absolute top-2 left-2"
              onClick={e => { e.stopPropagation(); toggleSelect(img.id, e.shiftKey) }}
            >
              {isSelected
                ? <CheckSquare className="h-5 w-5 text-emerald-500 bg-white rounded drop-shadow" />
                : <Square className="h-5 w-5 text-white/70 drop-shadow hover:text-white transition-colors" />
              }
            </div>
          )}

          {/* View button overlay */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 pointer-events-none">
            <button
              type="button"
              onClick={e => { e.stopPropagation(); setViewerUrl(img.url); setViewerOpen(true) }}
              className="bg-white/90 dark:bg-stone-900/90 rounded-full p-1.5 text-stone-700 dark:text-stone-200 hover:scale-110 transition-transform pointer-events-auto"
              title="View full size"
            >
              <Eye className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-2 py-1.5 bg-white dark:bg-stone-900 text-xs space-y-0.5">
          <p className="truncate text-stone-600 dark:text-stone-400 font-mono">{img.original_name || "untitled"}</p>
          {plant && (
            <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <Leaf className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{plant.name}</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderGroupCard = (group: DumpGroup) => {
    const groupImages = images.filter(i => i.group_id === group.id)
    const plant = group.plants || (group.plant_id ? { id: group.plant_id, name: "Assigned" } : null)

    return (
      <div
        key={group.id}
        onDragOver={e => e.preventDefault()}
        onDrop={e => onDropOnGroup(e, group.id)}
        className="rounded-xl border-2 border-dashed border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 overflow-hidden"
      >
        {/* Group header */}
        <div
          className="flex items-center gap-2 px-3 py-2 bg-stone-50 dark:bg-stone-800 cursor-pointer hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors"
          onClick={() => { setDetailGroup(group); setDetailImage(null); setScanResults(null) }}
        >
          <Layers className="h-4 w-4 text-stone-500 flex-shrink-0" />
          <span className="flex-1 text-sm font-medium truncate text-stone-700 dark:text-stone-300">
            {group.name || "Unnamed group"}
          </span>
          <span className="text-xs text-stone-400 dark:text-stone-500">{groupImages.length} images</span>
          {plant && (
            <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
              <Leaf className="h-3 w-3" />
              <span className="truncate max-w-[80px]">{plant.name}</span>
            </div>
          )}
        </div>

        {/* Image grid inside group */}
        {groupImages.length > 0 ? (
          <div className="grid grid-cols-4 gap-1 p-2">
            {groupImages.slice(0, 7).map(img => (
              <div key={img.id} className="aspect-square rounded overflow-hidden bg-stone-100 dark:bg-stone-800 relative group/img">
                <img src={img.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                <div
                  className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/img:opacity-100 bg-black/20 transition-opacity cursor-pointer"
                  onClick={e => { e.stopPropagation(); setDetailImage(img); setDetailGroup(null); setScanResults(null) }}
                >
                  <Eye className="h-3 w-3 text-white drop-shadow" />
                </div>
              </div>
            ))}
            {groupImages.length > 7 && (
              <div className="aspect-square rounded overflow-hidden bg-stone-200 dark:bg-stone-700 flex items-center justify-center text-sm font-semibold text-stone-600 dark:text-stone-300">
                +{groupImages.length - 7}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-16 text-xs text-stone-400 dark:text-stone-500 italic">
            Drop images here
          </div>
        )}

        {/* Group actions */}
        <div className="flex items-center gap-2 px-3 py-2 border-t border-stone-100 dark:border-stone-800">
          {plant ? (
            <button
              type="button"
              onClick={() => { setSubmitDialog({ ids: groupImages.map(i => i.id), plant: plant as { id: string; name: string } }) }}
              className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Submit all to {plant.name}
            </button>
          ) : (
            <span className="text-xs text-stone-400 italic">No plant assigned</span>
          )}
          <button
            type="button"
            onClick={() => setConfirmDelete({ ids: groupImages.map(i => i.id), isGroup: true, groupId: group.id })}
            className="ml-auto text-red-400 hover:text-red-600 transition-colors"
            title="Delete group"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    )
  }

  /* -----------------------------------------------------------------------
     Detail Panel
  ----------------------------------------------------------------------- */
  const renderDetailPanel = () => {
    if (!detailImage && !detailGroup) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-stone-400 dark:text-stone-500 gap-2 p-8 text-center">
          <ImageIcon className="h-10 w-10 opacity-40" />
          <p className="text-sm">Click an image or group to see details</p>
        </div>
      )
    }

    if (detailGroup && !detailImage) {
      const grp = groups.find(g => g.id === detailGroup.id) || detailGroup
      const grpImages = images.filter(i => i.group_id === grp.id)
      const plant = grp.plants || (grp.plant_id ? { id: grp.plant_id, name: "Assigned" } : null)

      return (
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-stone-200 dark:border-stone-700 flex-shrink-0">
            <Layers className="h-4 w-4 text-stone-500" />
            <span className="font-semibold text-stone-800 dark:text-stone-200 flex-1 truncate">
              {grp.name || "Unnamed group"}
            </span>
            <button type="button" onClick={() => { setDetailGroup(null) }} className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="text-sm text-stone-500 dark:text-stone-400">
              {grpImages.length} images · Created {formatRelative(grp.created_at)}
            </div>

            {/* Plant assignment */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400 mb-1.5 block">
                Assigned Plant
              </label>
              <SearchItem
                value={grp.plant_id || null}
                onSearch={searchPlants}
                onSelect={opt => void assignPlant(opt.id, undefined, grp.id)}
                onClear={() => void unassignPlant(undefined, grp.id)}
                placeholder="Search plants…"
                initialOption={plant ? { id: plant.id, label: plant.name, description: (plant as DumpImage["plants"])?.scientific_name_species || undefined } : null}
                priorityZIndex={200}
              />
            </div>

            {/* Submit */}
            {plant && (
              <Button
                className="w-full"
                onClick={() => setSubmitDialog({ ids: grpImages.map(i => i.id), plant: plant as { id: string; name: string } })}
                disabled={grpImages.length === 0}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Submit {grpImages.length} image{grpImages.length !== 1 ? "s" : ""} to {plant.name}
              </Button>
            )}

            {/* Delete group */}
            <Button
              variant="ghost"
              className="w-full text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
              onClick={() => setConfirmDelete({ ids: grpImages.map(i => i.id), isGroup: true, groupId: grp.id })}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete group & all images
            </Button>
          </div>
        </div>
      )
    }

    if (!detailImage) return null
    const img = images.find(i => i.id === detailImage.id) || detailImage
    const plant = img.plants || (img.plant_id ? { id: img.plant_id, name: "Assigned" } : null)

    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-stone-200 dark:border-stone-700 flex-shrink-0">
          <ImageIcon className="h-4 w-4 text-stone-500" />
          <span className="font-semibold text-stone-800 dark:text-stone-200 flex-1 truncate text-sm">
            {img.original_name || "Unnamed image"}
          </span>
          <button type="button" onClick={() => { setDetailImage(null); setScanResults(null); setScanError(null) }} className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Preview */}
          <div
            className="relative bg-stone-100 dark:bg-stone-800 cursor-zoom-in"
            onClick={() => { setViewerUrl(img.url); setViewerOpen(true) }}
          >
            <img
              src={img.url}
              alt={img.original_name || "dump image"}
              className="w-full max-h-64 object-contain"
            />
            <div className="absolute bottom-2 right-2">
              <button
                type="button"
                className="bg-white/80 dark:bg-stone-900/80 rounded p-1 text-stone-600 dark:text-stone-300 hover:bg-white dark:hover:bg-stone-900 transition-colors"
                onClick={e => { e.stopPropagation(); setViewerUrl(img.url); setViewerOpen(true) }}
              >
                <Eye className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* Meta */}
            <div className="text-xs text-stone-500 dark:text-stone-400 space-y-1">
              <div className="flex justify-between">
                <span>Size</span>
                <span className="font-mono">{formatBytes(img.size_bytes)}</span>
              </div>
              <div className="flex justify-between">
                <span>Uploaded</span>
                <span>{formatRelative(img.uploaded_at)}</span>
              </div>
              {img.uploader && (
                <div className="flex justify-between">
                  <span>By</span>
                  <span>{img.uploader.display_name || "Admin"}</span>
                </div>
              )}
              {img.group_id && (
                <div className="flex justify-between items-center">
                  <span>Group</span>
                  <div className="flex items-center gap-1">
                    <span className="truncate max-w-[100px]">{img.plant_dump_groups?.name || "Unnamed"}</span>
                    <button
                      type="button"
                      onClick={() => void removeFromGroup([img.id])}
                      className="text-stone-400 hover:text-red-500 transition-colors"
                      title="Remove from group"
                    >
                      <Unlink className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Plant assignment */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400 mb-1.5 block">
                Assigned Plant
              </label>
              <SearchItem
                value={img.plant_id || null}
                onSearch={searchPlants}
                onSelect={opt => void assignPlant(opt.id, img.group_id ? undefined : [img.id], img.group_id ?? undefined)}
                onClear={() => void unassignPlant(img.group_id ? undefined : [img.id], img.group_id ?? undefined)}
                placeholder="Search plants…"
                initialOption={plant ? { id: plant.id, label: plant.name, description: (plant as DumpImage["plants"])?.scientific_name_species || undefined } : null}
                priorityZIndex={200}
              />
            </div>

            {/* Scan */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400 mb-1.5 block">
                AI Plant Identification
              </label>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => void runScan(img)}
                disabled={scanning}
              >
                {scanning ? (
                  <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />Scanning…</>
                ) : (
                  <><Scan className="h-3.5 w-3.5 mr-2" />Scan with AI</>
                )}
              </Button>

              {scanError && (
                <p className="mt-2 text-xs text-red-500">{scanError}</p>
              )}

              {scanResults && scanResults.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {scanResults.map(s => (
                    <div
                      key={s.id}
                      className="flex items-center gap-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-2.5 py-2"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-stone-800 dark:text-stone-200 truncate">{s.name}</p>
                        {s.dbSearchDone && s.dbPlantId && (
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400">In database</p>
                        )}
                        {s.dbSearchDone && !s.dbPlantId && (
                          <p className="text-[10px] text-stone-400">Not in database</p>
                        )}
                      </div>
                      <span className={cn(
                        "text-[10px] font-semibold shrink-0",
                        s.probability >= 0.8 ? "text-emerald-600" : s.probability >= 0.5 ? "text-amber-500" : "text-stone-400"
                      )}>
                        {(s.probability * 100).toFixed(0)}%
                      </span>
                      {!s.dbSearchDone ? (
                        <Loader2 className="h-3 w-3 animate-spin text-stone-400 shrink-0" />
                      ) : s.dbPlantId ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs shrink-0 text-emerald-600"
                          onClick={() => void assignPlant(s.dbPlantId!, img.group_id ? undefined : [img.id], img.group_id ?? undefined)}
                        >
                          Assign
                        </Button>
                      ) : (
                        <Link
                          to="/admin/plants/requests"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-stone-400 hover:text-stone-600 shrink-0 flex items-center gap-0.5"
                        >
                          Request <ExternalLink className="h-2.5 w-2.5" />
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Submit */}
            {plant && (
              <Button
                className="w-full"
                onClick={() => setSubmitDialog({ ids: [img.id], plant: plant as { id: string; name: string } })}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Submit to {plant.name}
              </Button>
            )}

            {/* Add to group */}
            {groups.length > 0 && (
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400 mb-1.5 block">
                  Add to Group
                </label>
                <div className="grid grid-cols-2 gap-1">
                  {groups.map(grp => (
                    <button
                      key={grp.id}
                      type="button"
                      onClick={() => void addToGroup([img.id], grp.id)}
                      className="text-xs rounded-md border border-stone-200 dark:border-stone-700 px-2 py-1 text-left hover:bg-stone-100 dark:hover:bg-stone-800 truncate"
                    >
                      {grp.name || "Unnamed"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Delete */}
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
              onClick={() => setConfirmDelete({ ids: [img.id] })}
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" />
              Delete image
            </Button>
          </div>
        </div>
      </div>
    )
  }

  /* -----------------------------------------------------------------------
     Render
  ----------------------------------------------------------------------- */
  return (
    <div className="min-h-screen bg-stone-50 dark:bg-[#111113]">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white dark:bg-[#1a1a1c] border-b border-stone-200 dark:border-stone-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Link
            to="/admin/upload"
            className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Upload & Media
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-stone-300 dark:text-stone-600" />
          <h1 className="text-sm font-semibold text-stone-800 dark:text-stone-200">Plant Image Dump</h1>
          <div className="ml-auto flex items-center gap-2">
            {activeTab === "manage" && (
              <button
                type="button"
                onClick={() => void loadManageData()}
                disabled={loadingManage}
                className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 transition-colors"
                title="Refresh"
              >
                <RefreshCw className={cn("h-4 w-4", loadingManage && "animate-spin")} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
        <div className="flex gap-1 bg-stone-100 dark:bg-stone-800 rounded-xl p-1 w-fit">
          {(["upload", "manage"] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize",
                activeTab === tab
                  ? "bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 shadow-sm"
                  : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200",
              )}
            >
              {tab === "upload" ? "Upload" : `Manage${images.length > 0 ? ` (${images.length})` : ""}`}
            </button>
          ))}
        </div>
      </div>

      {/* ---- UPLOAD TAB ---- */}
      {activeTab === "upload" && (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
          {/* Drop zone */}
          <FileDropZone
            onFiles={addFiles}
            multiple
            accept={["image/"]}
            className="rounded-2xl border-2 border-dashed border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-900 p-12 flex flex-col items-center gap-3 text-center hover:border-emerald-400 dark:hover:border-emerald-600 transition-colors cursor-pointer"
          >
            <UploadCloud className="h-12 w-12 text-stone-300 dark:text-stone-600" />
            <div>
              <p className="text-stone-700 dark:text-stone-300 font-medium">Drop plant images here</p>
              <p className="text-sm text-stone-400 dark:text-stone-500 mt-1">JPEG, PNG, WebP, HEIC, AVIF — any size</p>
            </div>
            <Button type="button" size="sm" variant="outline" className="mt-2">Browse files</Button>
          </FileDropZone>

          {/* Queue */}
          {queue.length > 0 && (
            <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 overflow-hidden">
              {/* Summary bar */}
              <div className="flex items-center gap-4 px-4 py-3 bg-stone-50 dark:bg-stone-800 border-b border-stone-200 dark:border-stone-700 text-xs text-stone-500 dark:text-stone-400">
                {doneCount > 0 && <span className="text-emerald-600 dark:text-emerald-400 font-medium">{doneCount} done</span>}
                {uploadingCountDisplay > 0 && <span className="text-blue-500 font-medium">{uploadingCountDisplay} uploading</span>}
                {errorCount > 0 && <span className="text-red-500 font-medium">{errorCount} failed</span>}
                <div className="ml-auto flex gap-2">
                  {doneCount > 0 && (
                    <button type="button" onClick={clearDone} className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 text-xs underline">
                      Clear done
                    </button>
                  )}
                  {errorCount > 0 && (
                    <button type="button" onClick={retryErrors} className="text-red-400 hover:text-red-600 text-xs underline">
                      Retry errors
                    </button>
                  )}
                  {doneCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab("manage")}
                      className="text-emerald-600 dark:text-emerald-400 hover:underline text-xs font-medium flex items-center gap-1"
                    >
                      Go to Manage <ChevronRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* File list */}
              <div className="divide-y divide-stone-100 dark:divide-stone-800 max-h-96 overflow-y-auto">
                {queue.map(item => (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="h-10 w-10 rounded-lg overflow-hidden bg-stone-100 dark:bg-stone-800 flex-shrink-0">
                      <img src={item.preview} alt="" className="h-full w-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-stone-700 dark:text-stone-300 truncate font-medium">{item.file.name}</p>
                      <p className="text-xs text-stone-400 dark:text-stone-500">{formatBytes(item.file.size)}</p>
                    </div>
                    <div className="flex-shrink-0 w-24 text-right">
                      {item.status === "pending" && (
                        <span className="text-xs text-stone-400">Queued</span>
                      )}
                      {item.status === "uploading" && (
                        <div className="flex items-center gap-1.5 justify-end">
                          <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />
                          <span className="text-xs text-blue-500">Uploading</span>
                        </div>
                      )}
                      {item.status === "done" && (
                        <div className="flex items-center gap-1 justify-end text-emerald-600 dark:text-emerald-400">
                          <Check className="h-3.5 w-3.5" />
                          <span className="text-xs">Done</span>
                        </div>
                      )}
                      {item.status === "error" && (
                        <div className="flex items-center gap-1 justify-end text-red-500" title={item.error}>
                          <AlertCircle className="h-3.5 w-3.5" />
                          <span className="text-xs">Failed</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---- MANAGE TAB ---- */}
      {activeTab === "manage" && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Button
              size="sm"
              variant="outline"
              onClick={selectedIds.size === images.length ? clearSelection : selectAll}
              className="text-xs h-8"
            >
              {selectedIds.size === images.length && images.length > 0
                ? <><CheckSquare className="h-3.5 w-3.5 mr-1.5" />Deselect All</>
                : <><Square className="h-3.5 w-3.5 mr-1.5" />Select All</>
              }
            </Button>

            {selectedIds.size > 0 && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setCreatingGroup(true); setNewGroupName("") }}
                  className="text-xs h-8"
                >
                  <FolderPlus className="h-3.5 w-3.5 mr-1.5" />
                  Group {selectedIds.size} selected
                </Button>

                <SearchItem
                  value={null}
                  onSearch={searchPlants}
                  onSelect={opt => { void assignPlant(opt.id, [...selectedIds]); clearSelection() }}
                  placeholder="Assign plant to selected…"
                  title="Assign Plant to Selection"
                  hideTrigger
                  open={bulkAssignOpen}
                  onOpenChange={setBulkAssignOpen}
                  priorityZIndex={100}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setBulkAssignOpen(true)}
                  className="text-xs h-8"
                >
                  <Leaf className="h-3.5 w-3.5 mr-1.5" />
                  Assign Plant
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmDelete({ ids: [...selectedIds] })}
                  className="text-xs h-8 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Delete {selectedIds.size}
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={clearSelection}
                  className="text-xs h-8 text-stone-400"
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Clear
                </Button>
              </>
            )}

            {images.length === 0 && !loadingManage && (
              <span className="text-sm text-stone-400 dark:text-stone-500 italic ml-2">No images in dump yet — upload some!</span>
            )}
          </div>

          {/* Create group input */}
          {creatingGroup && (
            <div className="flex items-center gap-2 mb-4 bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 px-3 py-2">
              <FolderPlus className="h-4 w-4 text-stone-400 flex-shrink-0" />
              <Input
                placeholder="Group name (optional)…"
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") void createGroup(); if (e.key === "Escape") setCreatingGroup(false) }}
                className="h-7 text-sm border-none shadow-none focus-visible:ring-0 flex-1 bg-transparent"
                autoFocus
              />
              <Button size="sm" className="h-7 text-xs" onClick={() => void createGroup()} disabled={savingGroup}>
                {savingGroup ? <Loader2 className="h-3 w-3 animate-spin" /> : "Create Group"}
              </Button>
              <button type="button" onClick={() => setCreatingGroup(false)} className="text-stone-400 hover:text-stone-600">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {manageError && (
            <div className="mb-4 flex items-center gap-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-xl px-3 py-2 text-sm text-red-600 dark:text-red-400">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {manageError}
              <button type="button" onClick={() => setManageError(null)} className="ml-auto"><X className="h-3.5 w-3.5" /></button>
            </div>
          )}

          {loadingManage ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-8 w-8 text-stone-300 animate-spin" />
            </div>
          ) : (
            <div className="flex gap-4" style={{ minHeight: "calc(100vh - 200px)" }}>
              {/* Main grid */}
              <div className="flex-1 min-w-0">
                {/* Groups section */}
                {groups.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500 mb-3">
                      Groups ({groups.length})
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {groups.map(renderGroupCard)}
                    </div>
                  </div>
                )}

                {/* Ungrouped images */}
                {ungroupedImages.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500 mb-3">
                      Ungrouped ({ungroupedImages.length})
                      {selectedIds.size > 0 && (
                        <span className="ml-2 text-emerald-600 dark:text-emerald-400 normal-case font-normal">
                          {selectedIds.size} selected
                        </span>
                      )}
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                      {ungroupedImages.map(img => renderImageCard(img, false))}
                    </div>
                  </div>
                )}

                {images.length === 0 && !loadingManage && (
                  <div className="flex flex-col items-center justify-center py-24 text-stone-400 dark:text-stone-500 gap-3">
                    <ImageIcon className="h-12 w-12 opacity-30" />
                    <p className="text-sm">No images in dump. Upload some first.</p>
                    <Button size="sm" variant="outline" onClick={() => setActiveTab("upload")}>
                      <UploadCloud className="h-3.5 w-3.5 mr-2" />
                      Go to Upload
                    </Button>
                  </div>
                )}
              </div>

              {/* Detail panel — only shown when an image or group is selected */}
              {(detailImage || detailGroup) && (
                <div className="w-80 flex-shrink-0 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 overflow-hidden">
                  {renderDetailPanel()}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ---- IMAGE VIEWER ---- */}
      <ImageViewer
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
        images={viewerUrl ? [{ src: viewerUrl, alt: "Plant image" }] : []}
      />

      {/* ---- CONFIRM DELETE DIALOG ---- */}
      <Dialog open={!!confirmDelete} onOpenChange={open => !open && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {confirmDelete?.isGroup ? "Group" : "Image"}</DialogTitle>
            <DialogDescription>
              {confirmDelete?.isGroup
                ? `This will delete the group and all ${confirmDelete.ids.length} images in it permanently. This cannot be undone.`
                : `This will permanently delete ${confirmDelete?.ids.length === 1 ? "this image" : `${confirmDelete?.ids.length} images`}. This cannot be undone.`
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={() => void handleDelete()} disabled={deleting}>
              {deleting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Deleting…</> : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- SUBMIT CONFIRM DIALOG ---- */}
      <Dialog open={!!submitDialog} onOpenChange={open => !open && setSubmitDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Images to Plant</DialogTitle>
            <DialogDescription>
              {submitDialog && (
                <>
                  Add {submitDialog.ids.length} image{submitDialog.ids.length !== 1 ? "s" : ""} to{" "}
                  <strong>{submitDialog.plant?.name}</strong>? They will be moved to the plant's folder and removed from the dump.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSubmitDialog(null)} disabled={submitting}>Cancel</Button>
            <Button onClick={() => void handleSubmit()} disabled={submitting}>
              {submitting
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting…</>
                : <><CheckCircle2 className="h-4 w-4 mr-2" />Submit</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- SUCCESS DIALOG ---- */}
      <Dialog open={!!successInfo} onOpenChange={open => !open && setSuccessInfo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              Images Added Successfully
            </DialogTitle>
            <DialogDescription>
              {successInfo && (
                <>
                  <strong>{successInfo.count}</strong> image{successInfo.count !== 1 ? "s" : ""} were added to{" "}
                  <strong>{successInfo.plantName}</strong>.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="ghost" onClick={() => setSuccessInfo(null)}>Continue Working</Button>
            {successInfo && (
              <Button asChild>
                <Link to={`/plant/${successInfo.plantId}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Plant
                </Link>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AdminPlantDumpPage
