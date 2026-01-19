import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react"
import { useState, useCallback, useRef, useMemo } from "react"
import { Plus, Trash2, Image as ImageIcon, AlignLeft, AlignCenter, AlignRight, Maximize2, GripVertical, Move, X, Check } from "lucide-react"
import type { GridColumns, GridGap, ImageGridImage, ImageGridAlign } from "./image-grid-node-extension"
import { handleImageUpload, MAX_FILE_SIZE } from "@/lib/tiptap-utils"

// Default upload folder if not configured
const DEFAULT_UPLOAD_FOLDER = "image-grids"

const GAP_OPTIONS: { value: GridGap; label: string }[] = [
  { value: "none", label: "None" },
  { value: "sm", label: "Small" },
  { value: "md", label: "Medium" },
  { value: "lg", label: "Large" },
]

// Size presets
const SIZE_PRESETS = [
  { label: "Small", shortLabel: "S", value: "50%", percent: 50 },
  { label: "Medium", shortLabel: "M", value: "75%", percent: 75 },
  { label: "Large", shortLabel: "L", value: "90%", percent: 90 },
  { label: "Full", shortLabel: "Full", value: "100%", percent: 100 },
]

// Alignment options
const ALIGN_OPTIONS: { value: ImageGridAlign; label: string; Icon: typeof AlignLeft }[] = [
  { value: "left", label: "Left", Icon: AlignLeft },
  { value: "center", label: "Center", Icon: AlignCenter },
  { value: "right", label: "Right", Icon: AlignRight },
]

export function ImageGridNode({ node, updateAttributes, selected, editor }: NodeViewProps) {
  const attrs = node.attrs as {
    images: ImageGridImage[] | undefined
    columns: GridColumns
    gap: GridGap
    rounded: boolean
    width?: string
    align?: ImageGridAlign
  }
  
  // Ensure images is always an array
  const images = Array.isArray(attrs.images) ? attrs.images : []
  const { columns = 2, gap = "md", rounded = true, width = "100%", align = "center" } = attrs

  // Get upload folder from extension storage, fallback to default
  const uploadFolder = useMemo(() => {
    try {
      // Access storage with type assertion since TipTap's storage is dynamically typed
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const storage = editor?.storage as any
      return storage?.imageGrid?.uploadFolder || DEFAULT_UPLOAD_FOLDER
    } catch {
      return DEFAULT_UPLOAD_FOLDER
    }
  }, [editor])

  const [isUploading, setIsUploading] = useState(false)
  const [isHovering, setIsHovering] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  // Focal point editing state
  const [editingFocalIndex, setEditingFocalIndex] = useState<number | null>(null)
  const [tempFocalPoint, setTempFocalPoint] = useState<{ x: number; y: number } | null>(null)
  const [isDraggingFocal, setIsDraggingFocal] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const focalImageRef = useRef<HTMLDivElement>(null)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)

  // Show controls when selected OR hovering
  const showControls = selected || isHovering

  // Parse current width percentage
  const currentWidthPercent = useMemo(() => {
    if (typeof width === "string" && width.endsWith("%")) {
      return parseInt(width, 10)
    }
    return 100
  }, [width])

  const gapClasses: Record<GridGap, string> = {
    none: "gap-0",
    sm: "gap-2",
    md: "gap-4",
    lg: "gap-6",
  }

  const getAlignClass = () => {
    switch (align) {
      case "left":
        return "justify-start"
      case "right":
        return "justify-end"
      default:
        return "justify-center"
    }
  }

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, direction: "left" | "right") => {
      e.preventDefault()
      e.stopPropagation()
      setIsResizing(true)
      startXRef.current = e.clientX
      startWidthRef.current = gridRef.current?.offsetWidth || 0

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = direction === "right" 
          ? moveEvent.clientX - startXRef.current 
          : startXRef.current - moveEvent.clientX
        
        const newWidth = Math.max(200, startWidthRef.current + delta)
        const containerWidth = containerRef.current?.offsetWidth || 600
        const widthPercent = Math.min(100, Math.max(30, Math.round((newWidth / containerWidth) * 100)))
        
        updateAttributes({ width: `${widthPercent}%` })
      }

      const handleMouseUp = () => {
        setIsResizing(false)
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
      }

      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    },
    [updateAttributes]
  )

  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value, 10)
      updateAttributes({ width: `${value}%` })
    },
    [updateAttributes]
  )

  // Start editing focal point for an image
  const startFocalEdit = useCallback((index: number, e: React.MouseEvent) => {
    e.stopPropagation()
    const img = images[index]
    setEditingFocalIndex(index)
    setTempFocalPoint({ x: img.focalX ?? 50, y: img.focalY ?? 50 })
  }, [images])

  // Handle focal point drag
  const handleFocalMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingFocal(true)

    const updateFocalFromEvent = (clientX: number, clientY: number) => {
      if (!focalImageRef.current) return
      const rect = focalImageRef.current.getBoundingClientRect()
      const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))
      const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100))
      setTempFocalPoint({ x: Math.round(x), y: Math.round(y) })
    }

    // Initial position from click
    updateFocalFromEvent(e.clientX, e.clientY)

    const handleMouseMove = (moveEvent: MouseEvent) => {
      updateFocalFromEvent(moveEvent.clientX, moveEvent.clientY)
    }

    const handleMouseUp = () => {
      setIsDraggingFocal(false)
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
  }, [])

  // Save focal point changes
  const saveFocalPoint = useCallback(() => {
    if (editingFocalIndex === null || !tempFocalPoint) return
    
    const newImages = [...images]
    newImages[editingFocalIndex] = {
      ...newImages[editingFocalIndex],
      focalX: tempFocalPoint.x,
      focalY: tempFocalPoint.y,
    }
    updateAttributes({ images: newImages })
    setEditingFocalIndex(null)
    setTempFocalPoint(null)
  }, [editingFocalIndex, tempFocalPoint, images, updateAttributes])

  // Cancel focal point editing
  const cancelFocalEdit = useCallback(() => {
    setEditingFocalIndex(null)
    setTempFocalPoint(null)
  }, [])

  // Reset focal point to center
  const resetFocalPoint = useCallback(() => {
    setTempFocalPoint({ x: 50, y: 50 })
  }, [])

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (!files || files.length === 0) return

      setIsUploading(true)
      const newImages: ImageGridImage[] = [...images]

      for (const file of Array.from(files)) {
        if (file.size > MAX_FILE_SIZE) {
          alert(`File ${file.name} is too large. Maximum size is 5MB.`)
          continue
        }

        try {
          const url = await handleImageUpload(file, undefined, undefined, { folder: uploadFolder })
          newImages.push({ src: url, alt: file.name })
        } catch (error) {
          console.error("Failed to upload image:", error)
          alert(`Failed to upload ${file.name}`)
        }
      }

      updateAttributes({ images: newImages })
      setIsUploading(false)
      
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    },
    [images, updateAttributes, uploadFolder]
  )

  const removeImage = useCallback(
    (index: number) => {
      const newImages = images.filter((_, i) => i !== index)
      updateAttributes({ images: newImages })
    },
    [images, updateAttributes]
  )

  const openFileDialog = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  return (
    <NodeViewWrapper
      data-type="image-grid"
      data-align={align}
      data-width={width}
      className="my-6 w-full"
      ref={containerRef}
    >
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />

      {images.length === 0 ? (
        // Empty state - prompt to add images
        <div
          className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-stone-300 bg-stone-50 py-12 transition-colors hover:border-emerald-400 hover:bg-emerald-50/50 dark:border-[#3e3e42] dark:bg-[#1a1a1d] dark:hover:border-emerald-600 dark:hover:bg-emerald-900/10"
          onClick={openFileDialog}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
            <ImageIcon className="h-7 w-7" />
          </div>
          <div className="text-center">
            <p className="font-medium text-stone-700 dark:text-stone-200">
              {isUploading ? "Uploading..." : "Add Images to Grid"}
            </p>
            <p className="text-sm text-stone-500 dark:text-stone-400">
              Click to upload multiple images
            </p>
          </div>
        </div>
      ) : (
        <div 
          className={`flex w-full ${getAlignClass()}`}
          style={{ textAlign: align }}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => !isResizing && setIsHovering(false)}
        >
          <div 
            className={`relative inline-block transition-all ${
              showControls ? "ring-2 ring-emerald-500/50 ring-offset-2 rounded-2xl" : ""
            }`}
            style={{ width, maxWidth: "100%" }}
            ref={gridRef}
          >
            {/* Image Grid */}
            <div
              className={`grid ${gapClasses[gap]}`}
              style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
            >
              {images.map((img, index) => {
                const focalX = img.focalX ?? 50
                const focalY = img.focalY ?? 50
                const isNotCentered = focalX !== 50 || focalY !== 50
                
                return (
                  <div
                    key={`${img.src}-${index}`}
                    className={`group relative overflow-hidden ${rounded ? "rounded-2xl" : ""}`}
                  >
                    <img
                      src={img.src}
                      alt={img.alt || ""}
                      className="h-auto w-full object-cover"
                      style={{ 
                        aspectRatio: "16/10",
                        objectPosition: `${focalX}% ${focalY}%`
                      }}
                      draggable={false}
                    />
                    {/* Focal point indicator (shows when not centered) */}
                    {isNotCentered && (
                      <div 
                        className="absolute w-3 h-3 bg-emerald-500 border-2 border-white rounded-full shadow-md pointer-events-none z-10 opacity-70"
                        style={{
                          left: `${focalX}%`,
                          top: `${focalY}%`,
                          transform: 'translate(-50%, -50%)'
                        }}
                      />
                    )}
                    {/* Overlay controls */}
                    <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={(e) => startFocalEdit(index, e)}
                        className="rounded-full bg-emerald-500 p-2 text-white transition-colors hover:bg-emerald-600"
                        title="Adjust crop position"
                      >
                        <Move className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="rounded-full bg-red-500 p-2 text-white transition-colors hover:bg-red-600"
                        title="Remove image"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Focal Point Editor Overlay */}
            {editingFocalIndex !== null && tempFocalPoint && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                <div className="relative max-w-3xl w-full mx-4">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2 text-white">
                      <Move className="h-5 w-5" />
                      <span className="font-medium">Adjust Crop Position</span>
                      <span className="text-white/60 text-sm ml-2">
                        Click or drag to set the focal point
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={resetFocalPoint}
                        className="px-3 py-1.5 text-sm text-white/80 hover:text-white transition-colors"
                      >
                        Reset to Center
                      </button>
                      <button
                        type="button"
                        onClick={cancelFocalEdit}
                        className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                        title="Cancel"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={saveFocalPoint}
                        className="p-2 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
                        title="Save"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Image with focal point editor */}
                  <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                    {/* Full uncropped image */}
                    <div
                      ref={focalImageRef}
                      className="relative cursor-crosshair select-none"
                      onMouseDown={handleFocalMouseDown}
                    >
                      <img
                        src={images[editingFocalIndex]?.src}
                        alt=""
                        className="w-full h-auto"
                        draggable={false}
                      />
                      
                      {/* Crop preview overlay - shows what will be visible */}
                      <div 
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background: `
                            linear-gradient(to right, rgba(0,0,0,0.5) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.5) 100%),
                            linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.5) 100%)
                          `
                        }}
                      />
                      
                      {/* Focal point crosshair */}
                      <div
                        className={`absolute w-8 h-8 pointer-events-none z-20 ${isDraggingFocal ? 'scale-110' : ''} transition-transform`}
                        style={{
                          left: `${tempFocalPoint.x}%`,
                          top: `${tempFocalPoint.y}%`,
                          transform: 'translate(-50%, -50%)'
                        }}
                      >
                        {/* Outer ring */}
                        <div className="absolute inset-0 rounded-full border-2 border-white shadow-lg" />
                        {/* Inner dot */}
                        <div className="absolute top-1/2 left-1/2 w-2 h-2 -translate-x-1/2 -translate-y-1/2 bg-emerald-500 rounded-full shadow-md" />
                        {/* Crosshair lines */}
                        <div className="absolute top-1/2 left-0 w-full h-px bg-white/50 -translate-y-1/2" />
                        <div className="absolute top-0 left-1/2 h-full w-px bg-white/50 -translate-x-1/2" />
                      </div>
                    </div>

                    {/* Preview strip - shows how the crop will look */}
                    <div className="mt-3 p-3 bg-black/40 rounded-xl">
                      <p className="text-white/60 text-xs mb-2">Preview (16:10 crop):</p>
                      <div 
                        className={`w-48 h-[120px] bg-cover ${rounded ? 'rounded-lg' : ''} mx-auto border border-white/20`}
                        style={{
                          backgroundImage: `url('${images[editingFocalIndex]?.src}')`,
                          backgroundPosition: `${tempFocalPoint.x}% ${tempFocalPoint.y}%`
                        }}
                      />
                      <p className="text-white/40 text-xs mt-2 text-center">
                        Position: {tempFocalPoint.x}% × {tempFocalPoint.y}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Resize handles - only when controls are shown */}
            {showControls && (
              <>
                {/* Left resize handle */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-6 flex items-center justify-center cursor-ew-resize group/handle -translate-x-1/2 z-10"
                  onMouseDown={(e) => handleMouseDown(e, "left")}
                >
                  <div className="flex flex-col items-center gap-0.5 p-1.5 rounded-lg bg-white/95 shadow-lg border border-stone-200/50 dark:bg-[#1a1a1d]/95 dark:border-[#3e3e42] transition-transform group-hover/handle:scale-110">
                    <GripVertical className="h-4 w-4 text-stone-400 dark:text-stone-500" />
                  </div>
                </div>

                {/* Right resize handle */}
                <div
                  className="absolute right-0 top-0 bottom-0 w-6 flex items-center justify-center cursor-ew-resize group/handle translate-x-1/2 z-10"
                  onMouseDown={(e) => handleMouseDown(e, "right")}
                >
                  <div className="flex flex-col items-center gap-0.5 p-1.5 rounded-lg bg-white/95 shadow-lg border border-stone-200/50 dark:bg-[#1a1a1d]/95 dark:border-[#3e3e42] transition-transform group-hover/handle:scale-110">
                    <GripVertical className="h-4 w-4 text-stone-400 dark:text-stone-500" />
                  </div>
                </div>

                {/* Size indicator badge */}
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-medium backdrop-blur-sm z-10">
                  {currentWidthPercent}%
                </div>
              </>
            )}

            {/* Controls toolbar */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50 p-2 dark:border-[#3e3e42] dark:bg-[#1a1a1d]">
              {/* Left section: Add & Columns */}
              <div className="flex items-center gap-2">
                {/* Add more images */}
                <button
                  type="button"
                  onClick={openFileDialog}
                  disabled={isUploading}
                  className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {isUploading ? "..." : "Add"}
                </button>

                <div className="h-4 w-px bg-stone-200 dark:bg-stone-700" />

                {/* Columns */}
                <div className="flex items-center gap-0.5 rounded-lg bg-stone-100/80 p-0.5 dark:bg-[#2a2a2d]">
                  {([2, 3, 4] as GridColumns[]).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => updateAttributes({ columns: c })}
                      title={`${c} columns`}
                      className={`rounded-md px-2 py-1 text-[11px] font-semibold transition-all ${
                        columns === c
                          ? "bg-emerald-500 text-white shadow-sm"
                          : "text-stone-500 hover:text-stone-700 hover:bg-white/60 dark:text-stone-400 dark:hover:text-stone-200 dark:hover:bg-white/10"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Middle section: Size controls */}
              <div className="flex items-center gap-2">
                <Maximize2 className="h-3 w-3 text-stone-400" />
                
                {/* Size preset buttons */}
                <div className="flex items-center gap-0.5 rounded-lg bg-stone-100/80 p-0.5 dark:bg-[#2a2a2d]">
                  {SIZE_PRESETS.map((preset) => {
                    const isActive = currentWidthPercent === preset.percent
                    return (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => updateAttributes({ width: preset.value })}
                        title={preset.label}
                        className={`rounded-md px-1.5 py-1 text-[10px] font-semibold transition-all ${
                          isActive
                            ? "bg-emerald-500 text-white shadow-sm"
                            : "text-stone-500 hover:text-stone-700 hover:bg-white/60 dark:text-stone-400 dark:hover:text-stone-200 dark:hover:bg-white/10"
                        }`}
                      >
                        {preset.shortLabel}
                      </button>
                    )
                  })}
                </div>

                {/* Slider */}
                <input
                  type="range"
                  min="30"
                  max="100"
                  value={currentWidthPercent}
                  onChange={handleSliderChange}
                  className="w-12 h-1 bg-stone-200 rounded-full appearance-none cursor-pointer dark:bg-stone-700 
                    [&::-webkit-slider-thumb]:appearance-none 
                    [&::-webkit-slider-thumb]:w-2.5 
                    [&::-webkit-slider-thumb]:h-2.5 
                    [&::-webkit-slider-thumb]:rounded-full 
                    [&::-webkit-slider-thumb]:bg-emerald-500 
                    [&::-webkit-slider-thumb]:cursor-pointer"
                  title="Drag to resize"
                />
              </div>

              {/* Right section: Alignment & Options */}
              <div className="flex items-center gap-2">
                {/* Alignment */}
                <div className="flex items-center gap-0.5 rounded-lg bg-stone-100/80 p-0.5 dark:bg-[#2a2a2d]">
                  {ALIGN_OPTIONS.map(({ value, label, Icon }) => {
                    const isActive = align === value
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => updateAttributes({ align: value })}
                        title={`Align ${label}`}
                        className={`rounded-md p-1 transition-all ${
                          isActive
                            ? "bg-emerald-500 text-white shadow-sm"
                            : "text-stone-500 hover:text-stone-700 hover:bg-white/60 dark:text-stone-400 dark:hover:text-stone-200 dark:hover:bg-white/10"
                        }`}
                      >
                        <Icon className="h-3 w-3" />
                      </button>
                    )
                  })}
                </div>

                <div className="h-4 w-px bg-stone-200 dark:bg-stone-700" />

                {/* Gap */}
                <select
                  value={gap}
                  onChange={(e) => updateAttributes({ gap: e.target.value as GridGap })}
                  className="rounded-md border border-stone-200 bg-white px-1.5 py-1 text-[10px] dark:border-[#3e3e42] dark:bg-[#0f0f11] dark:text-white"
                >
                  {GAP_OPTIONS.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>

                {/* Rounded */}
                <label className="flex cursor-pointer items-center gap-1 text-[10px] text-stone-500 dark:text-stone-400">
                  <input
                    type="checkbox"
                    checked={rounded}
                    onChange={(e) => updateAttributes({ rounded: e.target.checked })}
                    className="h-3 w-3 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  Round
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </NodeViewWrapper>
  )
}

export default ImageGridNode
