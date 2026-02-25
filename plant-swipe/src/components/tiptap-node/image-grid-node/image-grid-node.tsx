import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react"
import { useState, useCallback, useRef, useMemo } from "react"
import { Plus, Trash2, Image as ImageIcon, AlignLeft, AlignCenter, AlignRight, Maximize2, GripVertical, Crop, X, Check, RotateCcw } from "lucide-react"
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
  
  // Ensure images is always an array (memoized to avoid dependency churn in hooks)
  const images = useMemo(() => (Array.isArray(attrs.images) ? attrs.images : []), [attrs.images])
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
  
  // Crop editor state
  const [editingCropIndex, setEditingCropIndex] = useState<number | null>(null)
  const [cropPosition, setCropPosition] = useState({ x: 50, y: 50 }) // Center position as percentage
  const [isDraggingCrop, setIsDraggingCrop] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const cropContainerRef = useRef<HTMLDivElement>(null)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)
  const dragStartRef = useRef({ x: 0, y: 0, cropX: 0, cropY: 0 })

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

  // Start editing crop for an image
  const startCropEdit = useCallback((index: number, e: React.MouseEvent) => {
    e.stopPropagation()
    const img = images[index]
    setEditingCropIndex(index)
    setCropPosition({ x: img.focalX ?? 50, y: img.focalY ?? 50 })
  }, [images])

  // Handle crop rectangle drag - pan the image within the crop window
  // Dragging RIGHT should show more of the LEFT side (decrease object-position x) - like moving a photo under a window
  // Dragging DOWN should show more of the TOP side (decrease object-position y)
  const handleCropMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingCrop(true)
    
    // Store initial values in ref
    const startX = e.clientX
    const startY = e.clientY
    const startCropX = cropPosition.x
    const startCropY = cropPosition.y
    
    dragStartRef.current = {
      x: startX,
      y: startY,
      cropX: startCropX,
      cropY: startCropY,
    }

    const handleMouseMove = (moveEvent: MouseEvent | TouchEvent) => {
      if (!cropContainerRef.current) return
      
      // Handle both mouse and touch events
      const clientX = 'touches' in moveEvent ? moveEvent.touches[0]?.clientX ?? 0 : moveEvent.clientX
      const clientY = 'touches' in moveEvent ? moveEvent.touches[0]?.clientY ?? 0 : moveEvent.clientY
      
      const containerRect = cropContainerRef.current.getBoundingClientRect()
      
      const deltaX = clientX - dragStartRef.current.x
      const deltaY = clientY - dragStartRef.current.y
      
      // Moving mouse right = image appears to move right under the window = show more LEFT side = DECREASE object-position
      // This creates an intuitive "dragging photo under magnifying glass" feel
      const sensitivity = 1.2  // Increased for better responsiveness
      const deltaXPercent = -(deltaX / containerRect.width) * 100 * sensitivity
      const deltaYPercent = -(deltaY / containerRect.height) * 100 * sensitivity
      
      const newX = Math.max(0, Math.min(100, dragStartRef.current.cropX + deltaXPercent))
      const newY = Math.max(0, Math.min(100, dragStartRef.current.cropY + deltaYPercent))
      
      setCropPosition({ x: Math.round(newX), y: Math.round(newY) })
    }

    const handleMouseUp = () => {
      setIsDraggingCrop(false)
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      document.removeEventListener("touchmove", handleMouseMove)
      document.removeEventListener("touchend", handleMouseUp)
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
    document.addEventListener("touchmove", handleMouseMove, { passive: false })
    document.addEventListener("touchend", handleMouseUp)
  }, [cropPosition])

  // Save crop changes
  const saveCrop = useCallback(() => {
    if (editingCropIndex === null) return
    
    const newImages = [...images]
    newImages[editingCropIndex] = {
      ...newImages[editingCropIndex],
      focalX: cropPosition.x,
      focalY: cropPosition.y,
    }
    updateAttributes({ images: newImages })
    setEditingCropIndex(null)
  }, [editingCropIndex, cropPosition, images, updateAttributes])

  // Cancel crop editing
  const cancelCropEdit = useCallback(() => {
    setEditingCropIndex(null)
  }, [])

  // Reset crop to center
  const resetCrop = useCallback(() => {
    setCropPosition({ x: 50, y: 50 })
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
                // Use live cropPosition when this image is being edited, otherwise use saved values
                const isBeingEdited = editingCropIndex === index
                const focalX = isBeingEdited ? cropPosition.x : (img.focalX ?? 50)
                const focalY = isBeingEdited ? cropPosition.y : (img.focalY ?? 50)
                const isNotCentered = focalX !== 50 || focalY !== 50
                
                return (
                  <div
                    key={`${img.src}-${index}`}
                    className={`group relative overflow-hidden ${rounded ? "rounded-2xl" : ""} ${isBeingEdited ? "ring-2 ring-emerald-500 ring-offset-2" : ""}`}
                  >
                    <img
                      src={img.src}
                      alt={img.alt || ""}
                      className="h-auto w-full"
                      style={{ 
                        objectFit: 'cover',
                        objectPosition: `${focalX}% ${focalY}%`
                      }}
                      draggable={false}
                    />
                    {/* Focal point indicator (shows when not centered or when being edited) */}
                    {(isNotCentered || isBeingEdited) && (
                      <div 
                        className={`absolute w-3 h-3 border-2 border-white rounded-full shadow-md pointer-events-none z-10 transition-all duration-75 ${isBeingEdited ? "bg-emerald-400 opacity-100 w-4 h-4" : "bg-emerald-500 opacity-70"}`}
                        style={{
                          left: `${focalX}%`,
                          top: `${focalY}%`,
                          transform: 'translate(-50%, -50%)'
                        }}
                      />
                    )}
                    {/* Overlay controls */}
                    <div className={`absolute inset-0 flex items-center justify-center gap-2 bg-black/50 transition-opacity ${isBeingEdited ? "opacity-0 pointer-events-none" : "opacity-0 group-hover:opacity-100"}`}>
                      <button
                        type="button"
                        onClick={(e) => startCropEdit(index, e)}
                        className="rounded-full bg-emerald-500 p-2 text-white transition-colors hover:bg-emerald-600"
                        title="Adjust crop area"
                      >
                        <Crop className="h-4 w-4" />
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

            {/* Compact Crop Editor Overlay */}
            {editingCropIndex !== null && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                <div className="relative bg-[#1a1a1d] rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between p-3 border-b border-white/10">
                    <div className="flex items-center gap-2 text-white">
                      <Crop className="h-4 w-4 text-emerald-400" />
                      <span className="font-medium text-sm">Adjust Crop</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={resetCrop}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-white/70 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Reset
                      </button>
                      <button
                        type="button"
                        onClick={cancelCropEdit}
                        className="p-1.5 rounded-md hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                        title="Cancel"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={saveCrop}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium transition-colors"
                      >
                        <Check className="h-3 w-3" />
                        Apply
                      </button>
                    </div>
                  </div>

                  {/* Crop Editor - Single image with drag to adjust position */}
                  <div className="p-4">
                    <div 
                      ref={cropContainerRef}
                      className={`relative w-full cursor-grab ${isDraggingCrop ? 'ring-2 ring-emerald-400 cursor-grabbing' : 'ring-2 ring-white/50 hover:ring-emerald-300'} overflow-hidden aspect-video`}
                      style={{ 
                        borderRadius: rounded ? '12px' : '0',
                        backgroundImage: `url('${images[editingCropIndex]?.src}')`,
                        backgroundSize: 'cover',
                        backgroundPosition: `${cropPosition.x}% ${cropPosition.y}%`,
                        backgroundRepeat: 'no-repeat',
                      }}
                      onMouseDown={handleCropMouseDown}
                      onTouchStart={(e) => {
                        // Handle touch events for mobile
                        const touch = e.touches[0]
                        if (touch) {
                          const syntheticEvent = {
                            preventDefault: () => e.preventDefault(),
                            stopPropagation: () => e.stopPropagation(),
                            clientX: touch.clientX,
                            clientY: touch.clientY,
                          } as React.MouseEvent
                          handleCropMouseDown(syntheticEvent)
                        }
                      }}
                    >
                      {/* Corner handles */}
                      <div className="absolute top-1 left-1 w-2.5 h-2.5 bg-white rounded-sm shadow-md pointer-events-none" />
                      <div className="absolute top-1 right-1 w-2.5 h-2.5 bg-white rounded-sm shadow-md pointer-events-none" />
                      <div className="absolute bottom-1 left-1 w-2.5 h-2.5 bg-white rounded-sm shadow-md pointer-events-none" />
                      <div className="absolute bottom-1 right-1 w-2.5 h-2.5 bg-white rounded-sm shadow-md pointer-events-none" />
                      
                      {/* Rule of thirds grid */}
                      <div className="absolute inset-0 pointer-events-none" style={{ borderRadius: rounded ? '12px' : '0', overflow: 'hidden' }}>
                        <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/30" />
                        <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/30" />
                        <div className="absolute top-1/3 left-0 right-0 h-px bg-white/30" />
                        <div className="absolute top-2/3 left-0 right-0 h-px bg-white/30" />
                      </div>
                      
                      {/* Drag hint */}
                      {!isDraggingCrop && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="bg-black/60 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                            </svg>
                            Drag to adjust
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Position info */}
                    <div className="mt-3 text-center text-white/40 text-xs">
                      Crop position: {cropPosition.x}%, {cropPosition.y}%
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
            <div
              className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50 p-2 dark:border-[#3e3e42] dark:bg-[#1a1a1d]"
              contentEditable={false}
            >
              {/* Left section: Add & Columns & Aspect Ratio */}
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
