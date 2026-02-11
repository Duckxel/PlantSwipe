/**
 * ImageViewer — Unified fullscreen image viewer component.
 *
 * Built on Radix Dialog primitives so it correctly layers on top of
 * other Radix Dialogs (e.g. the Scan result dialog) without focus-trap
 * or event conflicts.
 *
 * Supports:
 *  - Single image or multi-image gallery mode
 *  - Zoom & pan (scroll wheel + drag, double-click)
 *  - Keyboard navigation (Escape, Arrow keys, +/- for zoom)
 *  - Touch swipe to navigate between images
 *  - Optional download button
 *  - Controls always visible
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
} from "lucide-react"
import { cn } from "@/lib/utils"

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ImageViewerImage {
  /** Image URL (required) */
  src: string
  /** Alt text */
  alt?: string
}

export interface ImageViewerProps {
  /** Whether the viewer is open */
  open: boolean
  /** Callback when the viewer should close */
  onClose: () => void
  /** Images to display. Pass a single-element array for single-image mode. */
  images: ImageViewerImage[]
  /** Index of the initially active image (default: 0) */
  initialIndex?: number
  /** Show zoom controls (default: true) */
  enableZoom?: boolean
  /** Show download button (default: false) */
  enableDownload?: boolean
  /** Accessible title for the viewer (sr-only) */
  title?: string
  /** Additional class on the root overlay */
  className?: string
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const MIN_ZOOM = 1
const MAX_ZOOM = 4
const ZOOM_STEP = 0.25
const SWIPE_THRESHOLD = 50
const SWIPE_MAX_TIME = 400

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const ImageViewer: React.FC<ImageViewerProps> = ({
  open,
  onClose,
  images,
  initialIndex = 0,
  enableZoom = true,
  enableDownload = false,
  title,
  className,
}) => {
  /* ---- state ---- */
  const [activeIndex, setActiveIndex] = useState(initialIndex)
  const [zoom, setZoom] = useState(MIN_ZOOM)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)

  /* ---- refs ---- */
  const panStartRef = useRef({ x: 0, y: 0 })
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const imageContainerRef = useRef<HTMLDivElement | null>(null)
  const wheelCleanupRef = useRef<(() => void) | null>(null)
  const enableZoomRef = useRef(enableZoom)
  const adjustZoomRef = useRef<(delta: number) => void>(() => {})

  /* ---- derived ---- */
  const hasMultiple = images.length > 1
  const activeImage = images[activeIndex] ?? images[0]

  /* ---- Reset when opening ---- */
  useEffect(() => {
    if (open) {
      setActiveIndex(initialIndex)
      setZoom(MIN_ZOOM)
      setOffset({ x: 0, y: 0 })
      setIsPanning(false)
    }
  }, [open, initialIndex])

  /* ---- Navigation ---- */
  const goToNext = useCallback(() => {
    if (activeIndex < images.length - 1) {
      setActiveIndex((i) => i + 1)
      setZoom(MIN_ZOOM)
      setOffset({ x: 0, y: 0 })
    }
  }, [activeIndex, images.length])

  const goToPrev = useCallback(() => {
    if (activeIndex > 0) {
      setActiveIndex((i) => i - 1)
      setZoom(MIN_ZOOM)
      setOffset({ x: 0, y: 0 })
    }
  }, [activeIndex])

  /* ---- Zoom helpers ---- */
  const adjustZoom = useCallback((delta: number) => {
    setZoom((prev) => {
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, parseFloat((prev + delta).toFixed(2))))
      if (next === MIN_ZOOM) setOffset({ x: 0, y: 0 })
      return next
    })
  }, [])

  useEffect(() => { enableZoomRef.current = enableZoom }, [enableZoom])
  useEffect(() => { adjustZoomRef.current = adjustZoom }, [adjustZoom])

  const resetView = useCallback(() => {
    setZoom(MIN_ZOOM)
    setOffset({ x: 0, y: 0 })
  }, [])

  /* ---- Keyboard (arrow keys, zoom keys — Escape handled by Radix) ---- */
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault()
          goToPrev()
          break
        case "ArrowRight":
          e.preventDefault()
          goToNext()
          break
        case "+":
        case "=":
          e.preventDefault()
          adjustZoom(ZOOM_STEP)
          break
        case "-":
          e.preventDefault()
          adjustZoom(-ZOOM_STEP)
          break
        case "0":
          e.preventDefault()
          resetView()
          break
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, goToNext, goToPrev, adjustZoom, resetView])

  /* ---- Pointer (pan) handlers ---- */
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (zoom <= MIN_ZOOM) return
      e.preventDefault()
      setIsPanning(true)
      e.currentTarget.setPointerCapture(e.pointerId)
      panStartRef.current = { x: e.clientX - offset.x, y: e.clientY - offset.y }
    },
    [zoom, offset.x, offset.y],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isPanning) return
      setOffset({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      })
    },
    [isPanning],
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
      setIsPanning(false)
    },
    [],
  )

  /* ---- Wheel zoom (callback ref to attach native non-passive listener) ---- */
  const imageContainerCallbackRef = useCallback((node: HTMLDivElement | null) => {
    // Cleanup previous listener
    if (wheelCleanupRef.current) {
      wheelCleanupRef.current()
      wheelCleanupRef.current = null
    }
    imageContainerRef.current = node
    if (!node) return

    const handleWheelNative = (e: WheelEvent) => {
      if (!enableZoomRef.current) return
      e.preventDefault()
      adjustZoomRef.current(e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)
    }

    node.addEventListener("wheel", handleWheelNative, { passive: false })
    wheelCleanupRef.current = () => node.removeEventListener("wheel", handleWheelNative)
  }, [])

  /* ---- Touch swipe (when zoom === 1) ---- */
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    if (!touch) return
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() }
  }, [])

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStartRef.current || zoom > MIN_ZOOM) {
        touchStartRef.current = null
        return
      }
      const touch = e.changedTouches[0]
      if (!touch) return
      const dx = touch.clientX - touchStartRef.current.x
      const dy = touch.clientY - touchStartRef.current.y
      const dt = Date.now() - touchStartRef.current.time
      touchStartRef.current = null
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE_THRESHOLD && dt < SWIPE_MAX_TIME) {
        if (dx > 0) goToPrev()
        else goToNext()
        if (navigator.vibrate) navigator.vibrate(10)
      }
    },
    [zoom, goToNext, goToPrev],
  )

  /* ---- Double-click to zoom ---- */
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!enableZoom) return
      e.stopPropagation()
      if (zoom > MIN_ZOOM) resetView()
      else setZoom(2)
    },
    [enableZoom, zoom, resetView],
  )

  /* ---- Download ---- */
  const handleDownload = useCallback(async () => {
    if (!activeImage) return
    try {
      const response = await fetch(activeImage.src)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = activeImage.alt
        ? `${activeImage.alt.replace(/[^a-z0-9_-]/gi, "_").substring(0, 60)}.jpg`
        : "image.jpg"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      window.open(activeImage.src, "_blank", "noopener,noreferrer")
    }
  }, [activeImage])

  /* ---- Image transform style ---- */
  const imageStyle = useMemo<React.CSSProperties>(
    () => ({
      transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
      cursor: isPanning ? "grabbing" : zoom > MIN_ZOOM ? "grab" : "default",
      transition: isPanning ? "none" : "transform 0.2s ease-out",
    }),
    [offset.x, offset.y, zoom, isPanning],
  )

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(o) => { if (!o) onClose() }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-0 z-[201] flex flex-col outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            className,
          )}
          // Prevent closing when clicking on our own UI (we close via X button / Escape)
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          aria-label={title ?? "Image viewer"}
        >
          <DialogPrimitive.Title className="sr-only">
            {title ?? "Image viewer"}
          </DialogPrimitive.Title>

          {/* Top bar */}
          <div className="absolute top-0 left-0 right-0 z-20">
            <div className="flex items-center justify-between px-3 py-3 bg-gradient-to-b from-black/60 to-transparent sm:px-5 sm:py-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2.5 text-white/90 hover:text-white bg-white/10 hover:bg-white/20 transition-colors backdrop-blur-sm"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>

              {hasMultiple && (
                <span className="text-sm text-white/80 font-medium tabular-nums px-3 py-1 rounded-full bg-black/30 backdrop-blur-sm">
                  {activeIndex + 1} / {images.length}
                </span>
              )}

              <div className="flex items-center gap-1.5">
                {enableDownload && (
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="rounded-full p-2.5 text-white/90 hover:text-white bg-white/10 hover:bg-white/20 transition-colors backdrop-blur-sm"
                    aria-label="Download"
                  >
                    <Download className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Image area */}
          <div
            ref={imageContainerCallbackRef}
            className="relative flex-1 flex items-center justify-center overflow-hidden"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onDoubleClick={handleDoubleClick}
          >
            {activeImage && (
              <img
                key={activeImage.src}
                src={activeImage.src}
                alt={activeImage.alt ?? ""}
                className="max-w-full max-h-full object-contain select-none pointer-events-none"
                style={imageStyle}
                draggable={false}
              />
            )}
          </div>

          {/* Bottom bar: zoom controls */}
          {enableZoom && (
            <div className="absolute bottom-0 left-0 right-0 z-20">
              <div className="flex items-center justify-center gap-2 px-4 pb-6 pt-8 bg-gradient-to-t from-black/60 to-transparent sm:pb-8">
                <button
                  type="button"
                  onClick={() => adjustZoom(-ZOOM_STEP)}
                  disabled={zoom <= MIN_ZOOM}
                  className="rounded-full p-2.5 text-white/90 hover:text-white bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:pointer-events-none transition-colors backdrop-blur-sm"
                  aria-label="Zoom out"
                >
                  <ZoomOut className="h-5 w-5" />
                </button>

                <span className="text-xs text-white/70 font-medium tabular-nums w-12 text-center">
                  {Math.round(zoom * 100)}%
                </span>

                <button
                  type="button"
                  onClick={() => adjustZoom(ZOOM_STEP)}
                  disabled={zoom >= MAX_ZOOM}
                  className="rounded-full p-2.5 text-white/90 hover:text-white bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:pointer-events-none transition-colors backdrop-blur-sm"
                  aria-label="Zoom in"
                >
                  <ZoomIn className="h-5 w-5" />
                </button>

                {zoom > MIN_ZOOM && (
                  <button
                    type="button"
                    onClick={resetView}
                    className="rounded-full p-2.5 text-white/90 hover:text-white bg-white/10 hover:bg-white/20 transition-colors backdrop-blur-sm ml-1"
                    aria-label="Reset zoom"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Navigation arrows */}
          {hasMultiple && activeIndex > 0 && (
            <button
              type="button"
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 p-3 text-white active:scale-95"
              onClick={goToPrev}
              aria-label="Previous image"
            >
              <div className="rounded-full p-2 bg-black/40 hover:bg-black/60 backdrop-blur-sm transition-colors">
                <ChevronLeft className="h-6 w-6" />
              </div>
            </button>
          )}
          {hasMultiple && activeIndex < images.length - 1 && (
            <button
              type="button"
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 p-3 text-white active:scale-95"
              onClick={goToNext}
              aria-label="Next image"
            >
              <div className="rounded-full p-2 bg-black/40 hover:bg-black/60 backdrop-blur-sm transition-colors">
                <ChevronRight className="h-6 w-6" />
              </div>
            </button>
          )}

          {/* Dot indicators */}
          {hasMultiple && images.length <= 20 && (
            <div
              className={cn(
                "absolute left-0 right-0 z-20 flex justify-center gap-1.5",
                enableZoom ? "bottom-16 sm:bottom-20" : "bottom-6 sm:bottom-8",
              )}
            >
              {images.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setActiveIndex(idx)
                    setZoom(MIN_ZOOM)
                    setOffset({ x: 0, y: 0 })
                  }}
                  className={cn(
                    "h-2 w-2 rounded-full transition-all",
                    idx === activeIndex
                      ? "bg-white scale-110"
                      : "bg-white/40 hover:bg-white/60",
                  )}
                  aria-label={`Go to image ${idx + 1}`}
                />
              ))}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/* ------------------------------------------------------------------ */
/*  Hook: useImageViewer                                               */
/* ------------------------------------------------------------------ */

export function useImageViewer() {
  const [isOpen, setIsOpen] = useState(false)
  const [images, setImages] = useState<ImageViewerImage[]>([])
  const [initialIndex, setInitialIndex] = useState(0)

  const open = useCallback((src: string, alt?: string) => {
    setImages([{ src, alt }])
    setInitialIndex(0)
    setIsOpen(true)
  }, [])

  const openGallery = useCallback(
    (imgs: ImageViewerImage[], startIndex = 0) => {
      setImages(imgs)
      setInitialIndex(startIndex)
      setIsOpen(true)
    },
    [],
  )

  const close = useCallback(() => {
    setIsOpen(false)
  }, [])

  const props = useMemo(
    () => ({
      open: isOpen,
      onClose: close,
      images,
      initialIndex,
    }),
    [isOpen, close, images, initialIndex],
  )

  return { isOpen, open, openGallery, close, props }
}

export default ImageViewer
