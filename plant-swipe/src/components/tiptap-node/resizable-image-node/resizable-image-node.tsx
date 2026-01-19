import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react"
import { useState, useCallback, useRef, useMemo } from "react"
import { AlignLeft, AlignCenter, AlignRight, Maximize2, GripVertical } from "lucide-react"
import type { ImageAlign } from "./resizable-image-node-extension"

// Size presets with clearer labels
const SIZE_PRESETS = [
  { label: "Small", shortLabel: "S", value: "25%", percent: 25 },
  { label: "Medium", shortLabel: "M", value: "50%", percent: 50 },
  { label: "Large", shortLabel: "L", value: "75%", percent: 75 },
  { label: "Full Width", shortLabel: "Full", value: "100%", percent: 100 },
]

// Alignment options with labels
const ALIGN_OPTIONS: { value: ImageAlign; label: string; Icon: typeof AlignLeft }[] = [
  { value: "left", label: "Left", Icon: AlignLeft },
  { value: "center", label: "Center", Icon: AlignCenter },
  { value: "right", label: "Right", Icon: AlignRight },
]

export function ResizableImageNode({ node, updateAttributes, selected }: NodeViewProps) {
  const { src, alt, title, width, height, align } = node.attrs as {
    src: string
    alt?: string
    title?: string
    width?: number | string
    height?: number | string
    align?: ImageAlign
  }

  const [isResizing, setIsResizing] = useState(false)
  const [isHovering, setIsHovering] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)

  // Show controls when selected OR hovering
  const showControls = selected || isHovering || isResizing

  // Parse current width percentage
  const currentWidthPercent = useMemo(() => {
    if (typeof width === "number") {
      const containerWidth = containerRef.current?.offsetWidth || 600
      return Math.round((width / containerWidth) * 100)
    }
    if (typeof width === "string" && width.endsWith("%")) {
      return parseInt(width, 10)
    }
    return 100
  }, [width])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, direction: "left" | "right") => {
      e.preventDefault()
      e.stopPropagation()
      setIsResizing(true)
      startXRef.current = e.clientX
      startWidthRef.current = imageRef.current?.offsetWidth || 0

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = direction === "right" 
          ? moveEvent.clientX - startXRef.current 
          : startXRef.current - moveEvent.clientX
        
        const newWidth = Math.max(80, startWidthRef.current + delta)
        const containerWidth = containerRef.current?.offsetWidth || 600
        const widthPercent = Math.min(100, Math.max(10, Math.round((newWidth / containerWidth) * 100)))
        
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

  const getWidthValue = () => {
    if (typeof width === "number") return `${width}px`
    return width || "100%"
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

  return (
    <NodeViewWrapper
      data-type="resizable-image"
      data-align={align || "center"}
      className="my-6 w-full"
      ref={containerRef}
    >
      <div
        className={`flex w-full ${getAlignClass()}`}
        style={{ textAlign: align || "center" }}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => !isResizing && setIsHovering(false)}
      >
        <div 
          className={`relative inline-block transition-all duration-200 ${
            showControls ? "ring-2 ring-emerald-500/50 ring-offset-2 rounded-2xl" : ""
          }`}
        >
          {/* Image */}
          <img
            ref={imageRef}
            src={src}
            alt={alt || ""}
            title={title || ""}
            className={`rounded-2xl transition-all duration-200 ${
              isResizing ? "opacity-90" : ""
            }`}
            style={{
              width: getWidthValue(),
              height: height === "auto" || !height ? "auto" : height,
              maxWidth: "100%",
              minWidth: "80px",
            }}
            draggable={false}
          />

          {/* Controls overlay */}
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

              {/* Floating toolbar */}
              <div 
                className="absolute left-1/2 -translate-x-1/2 z-20 animate-in fade-in slide-in-from-bottom-2 duration-200"
                style={{ bottom: "-60px" }}
              >
                <div className="flex items-center gap-2 rounded-2xl border border-stone-200/80 bg-white/95 backdrop-blur-sm px-3 py-2 shadow-xl dark:border-[#3e3e42] dark:bg-[#1a1a1d]/95">
                  
                  {/* Size Section */}
                  <div className="flex items-center gap-2">
                    <Maximize2 className="h-3.5 w-3.5 text-stone-400" />
                    
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
                            className={`rounded-md px-2 py-1 text-[11px] font-semibold transition-all ${
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

                    {/* Slider for fine control */}
                    <div className="flex items-center gap-2 pl-1">
                      <input
                        type="range"
                        min="10"
                        max="100"
                        value={currentWidthPercent}
                        onChange={handleSliderChange}
                        className="w-16 h-1.5 bg-stone-200 rounded-full appearance-none cursor-pointer dark:bg-stone-700 
                          [&::-webkit-slider-thumb]:appearance-none 
                          [&::-webkit-slider-thumb]:w-3 
                          [&::-webkit-slider-thumb]:h-3 
                          [&::-webkit-slider-thumb]:rounded-full 
                          [&::-webkit-slider-thumb]:bg-emerald-500 
                          [&::-webkit-slider-thumb]:cursor-pointer
                          [&::-webkit-slider-thumb]:transition-transform
                          [&::-webkit-slider-thumb]:hover:scale-125
                          [&::-webkit-slider-thumb]:shadow-md"
                        title="Drag to resize"
                      />
                      <span className="text-[10px] font-medium text-stone-400 dark:text-stone-500 w-7 text-right tabular-nums">
                        {currentWidthPercent}%
                      </span>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="h-5 w-px bg-stone-200 dark:bg-stone-700" />

                  {/* Alignment Section */}
                  <div className="flex items-center gap-0.5 rounded-lg bg-stone-100/80 p-0.5 dark:bg-[#2a2a2d]">
                    {ALIGN_OPTIONS.map(({ value, label, Icon }) => {
                      const isActive = (align || "center") === value
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => updateAttributes({ align: value })}
                          title={`Align ${label}`}
                          className={`rounded-md p-1.5 transition-all ${
                            isActive
                              ? "bg-emerald-500 text-white shadow-sm"
                              : "text-stone-500 hover:text-stone-700 hover:bg-white/60 dark:text-stone-400 dark:hover:text-stone-200 dark:hover:bg-white/10"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Tooltip arrow */}
                <div className="absolute left-1/2 -translate-x-1/2 -top-1.5 w-3 h-3 rotate-45 bg-white border-l border-t border-stone-200/80 dark:bg-[#1a1a1d] dark:border-[#3e3e42]" />
              </div>

              {/* Size indicator badge (top-right corner) */}
              <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-medium backdrop-blur-sm">
                {currentWidthPercent}%
              </div>
            </>
          )}
        </div>
      </div>
    </NodeViewWrapper>
  )
}

export default ResizableImageNode
