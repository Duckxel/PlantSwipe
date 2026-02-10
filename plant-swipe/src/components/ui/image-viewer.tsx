/**
 * ImageViewer — Unified fullscreen image viewer component.
 *
 * Supports:
 *  - Single image or multi-image gallery mode
 *  - Zoom & pan (scroll wheel + drag, or pinch on mobile)
 *  - Keyboard navigation (Escape, Arrow keys, +/- for zoom)
 *  - Touch swipe to navigate between images
 *  - Optional download button
 *  - Smooth open/close animations
 *  - Dark overlay with accessible controls
 *  - Auto-hiding controls with tap-to-toggle
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { createPortal } from "react-dom"
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
const CONTROLS_HIDE_DELAY = 4000

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
  const [showControls, setShowControls] = useState(true)
  const [isVisible, setIsVisible] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

  /* ---- refs ---- */
  const panStartRef = useRef({ x: 0, y: 0 })
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const imageContainerRef = useRef<HTMLDivElement>(null)
  // Stable refs for callbacks used in native event listeners
  const zoomRef = useRef(zoom)
  const enableZoomRef = useRef(enableZoom)
  const adjustZoomRef = useRef<(delta: number) => void>(() => {})

  /* ---- derived ---- */
  const hasMultiple = images.length > 1
  const activeImage = images[activeIndex] ?? images[0]

  /* ---- Reset when opening/closing ---- */
  useEffect(() => {
    if (open) {
      setActiveIndex(initialIndex)
      setZoom(MIN_ZOOM)
      setOffset({ x: 0, y: 0 })
      setIsPanning(false)
      setShowControls(true)
      setIsClosing(false)
      // Trigger enter animation
      requestAnimationFrame(() => setIsVisible(true))
      // Prevent body scroll
      document.body.style.overflow = "hidden"
    } else {
      setIsVisible(false)
      setIsClosing(false)
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [open, initialIndex])

  /* ---- Auto-hide controls ---- */
  const scheduleHideControls = useCallback(() => {
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current)
    controlsTimerRef.current = setTimeout(() => {
      setShowControls(false)
    }, CONTROLS_HIDE_DELAY)
  }, [])

  const revealControls = useCallback(() => {
    setShowControls(true)
    scheduleHideControls()
  }, [scheduleHideControls])

  useEffect(() => {
    if (!open) return
    // Show controls and start auto-hide timer when opening or changing image
    revealControls()
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current)
    }
  }, [open, activeIndex, revealControls])

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

  // Keep ref in sync for native event listener
  useEffect(() => { zoomRef.current = zoom }, [zoom])
  useEffect(() => { enableZoomRef.current = enableZoom }, [enableZoom])
  useEffect(() => { adjustZoomRef.current = adjustZoom }, [adjustZoom])

  const resetView = useCallback(() => {
    setZoom(MIN_ZOOM)
    setOffset({ x: 0, y: 0 })
  }, [])

  /* ---- Close with animation ---- */
  const handleClose = useCallback(() => {
    setIsClosing(true)
    setIsVisible(false)
    setTimeout(() => {
      onClose()
      setIsClosing(false)
    }, 200)
  }, [onClose])

  /* ---- Keyboard ---- */
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          e.preventDefault()
          handleClose()
          break
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
  }, [open, handleClose, goToNext, goToPrev, adjustZoom, resetView])

  /* ---- Pointer (pan) handlers ---- */
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (zoom <= MIN_ZOOM) return // No panning at 1x
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

  /* ---- Wheel zoom (native non-passive listener to prevent page scroll) ---- */
  useEffect(() => {
    const container = imageContainerRef.current
    if (!container || !open) return

    const handleWheelNative = (e: WheelEvent) => {
      if (!enableZoomRef.current) return
      e.preventDefault()
      e.stopPropagation()
      adjustZoomRef.current(e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)
    }

    // Use { passive: false } so preventDefault() actually works
    container.addEventListener("wheel", handleWheelNative, { passive: false })
    return () => {
      container.removeEventListener("wheel", handleWheelNative)
    }
  }, [open])

  /* ---- Touch swipe (when zoom === 1) ---- */
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    if (!touch) return
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    }
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

  /* ---- Tap to toggle controls ---- */
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      // Ignore clicks on buttons / interactive elements
      if ((e.target as HTMLElement).closest("button")) return
      if (zoom > MIN_ZOOM) return // don't toggle when zoomed — panning takes priority
      // Toggle: if controls are visible, hide them (and cancel timer);
      // if hidden, show them (and restart timer).
      setShowControls((prev) => {
        if (prev) {
          // Currently showing -> hide now
          if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current)
          return false
        }
        // Currently hidden -> show and schedule auto-hide
        scheduleHideControls()
        return true
      })
    },
    [zoom, scheduleHideControls],
  )

  /* ---- Double-click to zoom ---- */
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!enableZoom) return
      e.stopPropagation()
      if (zoom > MIN_ZOOM) {
        resetView()
      } else {
        setZoom(2)
      }
      revealControls()
    },
    [enableZoom, zoom, resetView, revealControls],
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
      // Fallback: open in new tab
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

  /* ---- Don't render if not open and not closing ---- */
  if (!open && !isClosing) return null

  const content = (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex flex-col transition-opacity duration-200",
        isVisible ? "opacity-100" : "opacity-0",
        className,
      )}
      role="dialog"
      aria-modal="true"
      aria-label={title ?? "Image viewer"}
      onClick={handleOverlayClick}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/95 backdrop-blur-sm" />

      {/* Top bar */}
      <div
        className={cn(
          "absolute top-0 left-0 right-0 z-20 transition-opacity duration-200",
          showControls ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
      >
        <div className="flex items-center justify-between px-3 py-3 bg-gradient-to-b from-black/60 to-transparent sm:px-5 sm:py-4">
          {/* Left: close */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              handleClose()
            }}
            className="rounded-full p-2.5 text-white/90 hover:text-white bg-white/10 hover:bg-white/20 transition-colors backdrop-blur-sm"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Center: counter */}
          {hasMultiple && (
            <span className="text-sm text-white/80 font-medium tabular-nums px-3 py-1 rounded-full bg-black/30 backdrop-blur-sm">
              {activeIndex + 1} / {images.length}
            </span>
          )}

          {/* Right: actions */}
          <div className="flex items-center gap-1.5">
            {enableDownload && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleDownload()
                }}
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
        ref={imageContainerRef}
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
        <div
          className={cn(
            "absolute bottom-0 left-0 right-0 z-20 transition-opacity duration-200",
            showControls ? "opacity-100" : "opacity-0 pointer-events-none",
          )}
        >
          <div className="flex items-center justify-center gap-2 px-4 pb-6 pt-8 bg-gradient-to-t from-black/60 to-transparent sm:pb-8">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                adjustZoom(-ZOOM_STEP)
              }}
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
              onClick={(e) => {
                e.stopPropagation()
                adjustZoom(ZOOM_STEP)
              }}
              disabled={zoom >= MAX_ZOOM}
              className="rounded-full p-2.5 text-white/90 hover:text-white bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:pointer-events-none transition-colors backdrop-blur-sm"
              aria-label="Zoom in"
            >
              <ZoomIn className="h-5 w-5" />
            </button>

            {zoom > MIN_ZOOM && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  resetView()
                }}
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
          className={cn(
            "absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 p-3 transition-opacity duration-200",
            "text-white active:scale-95",
            showControls ? "opacity-100" : "opacity-0 pointer-events-none",
          )}
          onClick={(e) => {
            e.stopPropagation()
            goToPrev()
          }}
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
          className={cn(
            "absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 p-3 transition-opacity duration-200",
            "text-white active:scale-95",
            showControls ? "opacity-100" : "opacity-0 pointer-events-none",
          )}
          onClick={(e) => {
            e.stopPropagation()
            goToNext()
          }}
          aria-label="Next image"
        >
          <div className="rounded-full p-2 bg-black/40 hover:bg-black/60 backdrop-blur-sm transition-colors">
            <ChevronRight className="h-6 w-6" />
          </div>
        </button>
      )}

      {/* Dot indicators for multiple images */}
      {hasMultiple && images.length <= 20 && (
        <div
          className={cn(
            "absolute bottom-16 sm:bottom-20 left-0 right-0 z-20 flex justify-center gap-1.5 transition-opacity duration-200",
            enableZoom ? "" : "bottom-6 sm:bottom-8",
            showControls ? "opacity-100" : "opacity-0",
          )}
        >
          {images.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={(e) => {
                e.stopPropagation()
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
    </div>
  )

  return createPortal(content, document.body)
}

/* ------------------------------------------------------------------ */
/*  Hook: useImageViewer                                               */
/* ------------------------------------------------------------------ */

/**
 * Convenience hook that manages open/close state and selected image(s)
 * for the ImageViewer component.
 *
 * Usage (single image):
 * ```tsx
 * const viewer = useImageViewer()
 * <img onClick={() => viewer.open("https://…")} />
 * <ImageViewer {...viewer.props} />
 * ```
 *
 * Usage (gallery):
 * ```tsx
 * const viewer = useImageViewer()
 * <img onClick={() => viewer.openGallery(images, 2)} />
 * <ImageViewer {...viewer.props} enableZoom />
 * ```
 */
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
