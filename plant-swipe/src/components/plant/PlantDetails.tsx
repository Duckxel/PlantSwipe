import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Plant, PlantWateringSchedule } from "@/types/plant"
import {
  SunMedium,
  Droplets,
  Thermometer,
  Heart,
  Share2,
  ChevronLeft,
  ChevronRight,
  X,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  Droplet,
} from "lucide-react"

interface PlantDetailsProps {
  plant: Plant
  liked?: boolean
  onToggleLike?: () => void
}

export const PlantDetails: React.FC<PlantDetailsProps> = ({ plant, liked, onToggleLike }) => {
  const images = (plant.images || []).filter((img): img is NonNullable<typeof img> & { link: string } => Boolean(img?.link))
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const activeImage = images[activeImageIndex] || null
  const [shareStatus, setShareStatus] = useState<"idle" | "copied" | "shared" | "error">("idle")
  const shareTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerZoom, setViewerZoom] = useState(1)
  const [viewerOffset, setViewerOffset] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const touchStartRef = useRef<number | null>(null)

  useEffect(() => {
    setActiveImageIndex(0)
  }, [plant.id])

  useEffect(() => {
    if (activeImageIndex >= images.length && images.length > 0) {
      setActiveImageIndex(0)
    }
  }, [images.length, activeImageIndex])

  useEffect(() => {
    return () => {
      if (shareTimeoutRef.current) clearTimeout(shareTimeoutRef.current)
    }
  }, [])

  const heroColors = useMemo(() => plant.identity?.colors?.filter((c) => c.hexCode) || [], [plant.identity?.colors])

  const goToNextImage = useCallback(() => {
    if (!images.length) return
    setActiveImageIndex((idx) => (idx + 1) % images.length)
  }, [images.length])

  const goToPrevImage = useCallback(() => {
    if (!images.length) return
    setActiveImageIndex((idx) => (idx - 1 + images.length) % images.length)
  }, [images.length])

  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    touchStartRef.current = event.touches[0]?.clientX ?? null
  }, [])

  const handleTouchEnd = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (touchStartRef.current === null) return
      const delta = (event.changedTouches[0]?.clientX ?? 0) - touchStartRef.current
      touchStartRef.current = null
      if (Math.abs(delta) < 40) return
      if (delta > 0) goToPrevImage()
      else goToNextImage()
    },
    [goToNextImage, goToPrevImage],
  )

  const handleShare = useCallback(async () => {
    if (typeof window === "undefined") return
    const shareUrl = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({
          title: plant.name,
          text: plant.identity?.overview || undefined,
          url: shareUrl,
        })
        setShareStatus("shared")
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl)
        setShareStatus("copied")
      } else {
        setShareStatus("error")
      }
    } catch {
      setShareStatus("error")
    }
    if (shareTimeoutRef.current) clearTimeout(shareTimeoutRef.current)
    shareTimeoutRef.current = setTimeout(() => setShareStatus("idle"), 2500)
  }, [plant.identity?.overview, plant.name])

  const openViewer = useCallback(() => {
    if (!activeImage) return
    setViewerOpen(true)
  }, [activeImage])

  const closeViewer = useCallback(() => {
    setViewerOpen(false)
  }, [])

  const adjustZoom = useCallback((delta: number) => {
    setViewerZoom((prev) => Math.min(4, Math.max(1, parseFloat((prev + delta).toFixed(2)))))
  }, [])

  const resetViewer = useCallback(() => {
    setViewerZoom(1)
    setViewerOffset({ x: 0, y: 0 })
  }, [])

  const handleViewerWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      event.preventDefault()
      adjustZoom(event.deltaY < 0 ? 0.15 : -0.15)
    },
    [adjustZoom],
  )

  const handleViewerPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault()
      setIsPanning(true)
      event.currentTarget.setPointerCapture(event.pointerId)
      panStartRef.current = { x: event.clientX - viewerOffset.x, y: event.clientY - viewerOffset.y }
    },
    [viewerOffset.x, viewerOffset.y],
  )

  const handleViewerPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isPanning) return
      setViewerOffset({
        x: event.clientX - panStartRef.current.x,
        y: event.clientY - panStartRef.current.y,
      })
    },
    [isPanning],
  )

  const handleViewerPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setIsPanning(false)
  }, [])

  useEffect(() => {
    if (!viewerOpen) {
      setViewerZoom(1)
      setViewerOffset({ x: 0, y: 0 })
      setIsPanning(false)
      return
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        setViewerOpen(false)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [viewerOpen])

  const utilityBadges = plant.utility?.length ? plant.utility : []
  const seasons = plant.identity?.season || plant.seasons || []
  const shareFeedback =
    shareStatus === "copied"
      ? "Link copied"
      : shareStatus === "shared"
      ? "Shared!"
      : shareStatus === "error"
      ? "Share unavailable"
      : ""

  const formatWateringNeed = (schedules?: PlantWateringSchedule[]) => {
    if (!schedules?.length) return "Flexible"
    const schedule = schedules[0]
    const quantity = schedule.quantity ?? undefined
    const timePeriod = schedule.timePeriod?.replace(/[_-]/g, " ").toLowerCase()

    if (quantity && timePeriod) return `${quantity} / ${timePeriod}`
    if (quantity) return `${quantity}x`
    if (timePeriod) return `Every ${timePeriod}`
    return "Scheduled"
  }

  const stats = [
    {
      label: "Sun Level",
      value: plant.plantCare?.levelSun || "Adaptive",
      gradient: "from-amber-400/90 to-orange-600",
      icon: <SunMedium className="h-6 w-6 sm:h-8 sm:w-8 md:h-10 md:w-10 text-white/80" />,
      visible: Boolean(plant.plantCare?.levelSun),
    },
      {
        label: "Watering Need",
        value: formatWateringNeed(plant.plantCare?.watering?.schedules),
        gradient: "from-blue-400/90 to-cyan-600",
        icon: <Droplet className="h-6 w-6 sm:h-8 sm:w-8 md:h-10 md:w-10 text-white/80" />,
        visible: Boolean(plant.plantCare?.watering?.schedules?.length),
      },
    {
      label: "Humidity",
      value: plant.plantCare?.hygrometry !== undefined ? `${plant.plantCare.hygrometry}%` : "Ambient",
      gradient: "from-cyan-400/90 to-teal-600",
      icon: <Droplets className="h-6 w-6 sm:h-8 sm:w-8 md:h-10 md:w-10 text-white/80" />,
      visible: plant.plantCare?.hygrometry !== undefined,
    },
    {
      label: "Temperature",
      value:
        plant.plantCare?.temperatureMin !== undefined && plant.plantCare?.temperatureMax !== undefined
          ? `${plant.plantCare.temperatureMin}°-${plant.plantCare.temperatureMax}°C`
          : plant.plantCare?.temperatureIdeal !== undefined
          ? `${plant.plantCare.temperatureIdeal}°C`
          : "Stable",
      gradient: "from-red-400/90 to-pink-600",
      icon: <Thermometer className="h-6 w-6 sm:h-8 sm:w-8 md:h-10 md:w-10 text-white/80" />,
      visible:
        plant.plantCare?.temperatureMin !== undefined ||
        plant.plantCare?.temperatureMax !== undefined ||
        plant.plantCare?.temperatureIdeal !== undefined,
    },
  ]

  return (
    <div className="space-y-4 sm:space-y-6 pb-12 sm:pb-16">
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-muted/50 bg-gradient-to-br from-emerald-50 via-white to-amber-50 dark:from-[#0b1220] dark:via-[#0a0f1a] dark:to-[#05080f] shadow-lg">
        <div
          className="absolute inset-0 opacity-25 blur-3xl"
          style={{
            background:
              "radial-gradient(circle at 20% 20%, #34d39926, transparent 40%), radial-gradient(circle at 80% 10%, #fb718526, transparent 35%), radial-gradient(circle at 60% 80%, #22d3ee26, transparent 45%)",
          }}
        />
        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 flex flex-col items-end gap-1.5 sm:gap-2 md:gap-3 pointer-events-auto">
          {onToggleLike && (
            <Button
              type="button"
              size="lg"
              variant={liked ? "default" : "secondary"}
              className="rounded-full px-4 py-2 sm:px-6 sm:py-3 text-sm sm:text-base shadow-lg"
              onClick={onToggleLike}
            >
              <Heart className="mr-1.5 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" fill={liked ? "currentColor" : "none"} />
              <span className="hidden sm:inline">{liked ? "Liked" : "Like"}</span>
              <span className="sm:hidden">{liked ? "✓" : "♡"}</span>
            </Button>
          )}
          <div className="flex flex-col items-end gap-1">
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="rounded-full px-4 py-2 sm:px-5 sm:py-3 text-sm sm:text-base shadow-lg"
              onClick={handleShare}
            >
              <Share2 className="mr-1.5 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden sm:inline">Share</span>
            </Button>
            {shareFeedback && <span className="text-[10px] sm:text-xs font-medium text-white drop-shadow">{shareFeedback}</span>}
          </div>
        </div>
        <div className="relative flex flex-col gap-3 sm:gap-4 p-3 pt-14 sm:p-4 sm:pt-16 md:p-6 lg:flex-row lg:gap-8 lg:p-8">
          <div className="flex-1 space-y-3 sm:space-y-4">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <Badge variant="secondary" className="uppercase tracking-wide text-[10px] sm:text-xs px-2 sm:px-3 py-0.5 sm:py-1">
                {plant.plantType || "Plant"}
              </Badge>
              {utilityBadges.map((u) => (
                <Badge key={u} variant="outline" className="bg-white/70 dark:bg-slate-900/70 text-[10px] sm:text-xs px-2 sm:px-3 py-0.5 sm:py-1">
                  {u}
                </Badge>
              ))}
              {seasons.length > 0 && (
                <Badge variant="outline" className="bg-amber-100/60 text-amber-900 dark:bg-amber-900/30 dark:text-amber-50 text-[10px] sm:text-xs px-2 sm:px-3 py-0.5 sm:py-1">
                  {seasons.join(" • ")}
                </Badge>
              )}
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground leading-tight">{plant.name}</h1>
              {plant.identity?.scientificName && (
                <p className="text-sm sm:text-base md:text-lg text-muted-foreground italic mt-1">{plant.identity.scientificName}</p>
              )}
            </div>
            {plant.identity?.overview && (
              <p className="text-muted-foreground leading-relaxed text-sm sm:text-base">{plant.identity.overview}</p>
            )}
            {heroColors.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">Palette</span>
                {heroColors.map((c) => (
                  <div key={c.id || c.hexCode} className="flex items-center gap-2 rounded-full border border-muted/50 bg-white/70 px-3 py-1 shadow-sm dark:bg-slate-900/50">
                    <span className="h-4 w-4 rounded-full border" style={{ backgroundColor: c.hexCode }} />
                    <span className="text-xs font-medium">{c.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex w-full justify-center lg:w-auto">
            {activeImage ? (
              <div className="relative z-0 aspect-[4/3] w-full overflow-hidden rounded-2xl border border-muted/60 bg-white/60 shadow-inner sm:w-80 lg:w-96" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
                <img
                  src={activeImage.link}
                  alt={plant.name}
                  className="h-full w-full cursor-zoom-in object-cover transition-transform duration-500"
                  onClick={openViewer}
                  draggable={false}
                  loading="lazy"
                />
                {images.length > 1 && (
                  <>
                    <button type="button" className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white backdrop-blur hover:bg-black/60" onClick={(event) => { event.stopPropagation(); goToPrevImage() }} aria-label="Previous image">
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white backdrop-blur hover:bg-black/60" onClick={(event) => { event.stopPropagation(); goToNextImage() }} aria-label="Next image">
                      <ChevronRight className="h-5 w-5" />
                    </button>
                    <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2">
                      {images.map((_, idx) => (
                        <button key={`dot-${idx}`} type="button" className={`h-2.5 w-2.5 rounded-full transition ${idx === activeImageIndex ? "bg-white" : "bg-white/40"}`} onClick={(event) => { event.stopPropagation(); setActiveImageIndex(idx) }} aria-label={`Go to image ${idx + 1}`} />
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex aspect-[4/3] w-full items-center justify-center rounded-2xl border border-dashed border-muted/60 bg-white/40 text-sm text-muted-foreground sm:w-80 lg:w-96">
                No image yet
              </div>
            )}
          </div>
        </div>
      </div>

      {viewerOpen && activeImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm" onClick={closeViewer}>
          <button type="button" className="absolute top-6 right-6 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20" onClick={(event) => { event.stopPropagation(); closeViewer() }} aria-label="Close image viewer">
            <X className="h-5 w-5" />
          </button>
          <div className="flex h-full w-full max-w-5xl flex-col items-center justify-center px-4" onClick={(event) => event.stopPropagation()}>
            <div className="relative max-h-[80vh] w-full overflow-hidden rounded-2xl border border-white/10 bg-black/60" onWheel={handleViewerWheel} onPointerDown={handleViewerPointerDown} onPointerMove={handleViewerPointerMove} onPointerUp={handleViewerPointerUp} onPointerLeave={handleViewerPointerUp}>
              <img src={activeImage.link} alt={plant.name} draggable={false} className="h-full w-full select-none object-contain" style={{ transform: `translate(${viewerOffset.x}px, ${viewerOffset.y}px) scale(${viewerZoom})`, cursor: isPanning ? "grabbing" : viewerZoom > 1 ? "grab" : "zoom-in", transition: isPanning ? "none" : "transform 0.2s ease-out" }} />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-white">
              <Button type="button" variant="secondary" size="sm" onClick={(event) => { event.stopPropagation(); adjustZoom(0.2) }}>
                <ZoomIn className="mr-1 h-4 w-4" />
                Zoom in
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={(event) => { event.stopPropagation(); adjustZoom(-0.2) }}>
                <ZoomOut className="mr-1 h-4 w-4" />
                Zoom out
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={(event) => { event.stopPropagation(); resetViewer() }}>
                <RefreshCw className="mr-1 h-4 w-4" />
                Reset
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) =>
          stat.visible ? (
            <Card key={stat.label} className={`bg-gradient-to-br ${stat.gradient} text-white shadow-lg`}>
              <CardContent className="flex items-center justify-between p-3 sm:p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] sm:text-xs uppercase text-white/80 truncate">{stat.label}</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold leading-tight truncate">{stat.value}</p>
                </div>
                <div className="ml-2 flex-shrink-0">{stat.icon}</div>
              </CardContent>
            </Card>
          ) : null,
        )}
      </div>

    </div>
  )
}

export default PlantDetails
