import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react"
import { useState, useCallback, useRef, useEffect } from "react"
import { AlignLeft, AlignCenter, AlignRight, Maximize2, Minimize2 } from "lucide-react"
import type { ImageAlign } from "./resizable-image-node-extension"

const SIZE_PRESETS = [
  { label: "S", value: "25%" },
  { label: "M", value: "50%" },
  { label: "L", value: "75%" },
  { label: "Full", value: "100%" },
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
  const [showControls, setShowControls] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, direction: "left" | "right") => {
      e.preventDefault()
      setIsResizing(true)
      startXRef.current = e.clientX
      startWidthRef.current = imageRef.current?.offsetWidth || 0

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = direction === "right" 
          ? moveEvent.clientX - startXRef.current 
          : startXRef.current - moveEvent.clientX
        
        const newWidth = Math.max(100, startWidthRef.current + delta)
        const containerWidth = containerRef.current?.offsetWidth || 600
        const widthPercent = Math.min(100, Math.round((newWidth / containerWidth) * 100))
        
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
      className={`my-4 ${selected ? "ring-2 ring-emerald-500 ring-offset-4 rounded-2xl" : ""}`}
      ref={containerRef}
    >
      <div
        className={`flex ${getAlignClass()}`}
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => !isResizing && setShowControls(false)}
      >
        <div className="group relative inline-block">
          {/* Image */}
          <img
            ref={imageRef}
            src={src}
            alt={alt || ""}
            title={title || ""}
            className="rounded-2xl transition-shadow"
            style={{
              width: getWidthValue(),
              height: height === "auto" || !height ? "auto" : height,
              maxWidth: "100%",
            }}
          />

          {/* Resize handles */}
          {showControls && (
            <>
              {/* Left handle */}
              <div
                className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize"
                onMouseDown={(e) => handleMouseDown(e, "left")}
              >
                <div className="flex h-12 w-4 items-center justify-center rounded-full bg-white/90 shadow-lg dark:bg-[#1a1a1d]/90">
                  <div className="h-6 w-1 rounded-full bg-stone-400" />
                </div>
              </div>

              {/* Right handle */}
              <div
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 cursor-ew-resize"
                onMouseDown={(e) => handleMouseDown(e, "right")}
              >
                <div className="flex h-12 w-4 items-center justify-center rounded-full bg-white/90 shadow-lg dark:bg-[#1a1a1d]/90">
                  <div className="h-6 w-1 rounded-full bg-stone-400" />
                </div>
              </div>

              {/* Control bar */}
              <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-xl border border-stone-200 bg-white p-1 shadow-lg dark:border-[#3e3e42] dark:bg-[#1a1a1d]">
                {/* Size presets */}
                {SIZE_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => updateAttributes({ width: preset.value })}
                    className={`rounded-lg px-2 py-1 text-xs font-medium transition-all ${
                      width === preset.value
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}

                <div className="mx-1 h-4 w-px bg-stone-200 dark:bg-stone-700" />

                {/* Alignment */}
                {(["left", "center", "right"] as ImageAlign[]).map((a) => {
                  const Icon = a === "left" ? AlignLeft : a === "center" ? AlignCenter : AlignRight
                  return (
                    <button
                      key={a}
                      type="button"
                      onClick={() => updateAttributes({ align: a })}
                      className={`rounded-lg p-1.5 transition-all ${
                        align === a
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : "text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </NodeViewWrapper>
  )
}

export default ResizableImageNode
