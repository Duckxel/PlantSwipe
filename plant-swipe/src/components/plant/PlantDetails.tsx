import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Plant } from "@/types/plant"
import { Link } from "react-router-dom"
import { supabase } from "@/lib/supabaseClient"
import {
  Flame,
  SunMedium,
  Droplets,
  Thermometer,
  Heart,
  Leaf,
  Share2,
  ChevronLeft,
  ChevronRight,
  X,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  Fingerprint,
  Droplet,
  Sprout,
  ChefHat,
  ShieldAlert,
  Layers,
  Info,
  Users,
} from "lucide-react"
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
  PieChart,
  Pie,
} from "recharts"

interface PlantDetailsProps {
  plant: Plant
  liked?: boolean
  onToggleLike?: () => void
}

const Section: React.FC<{ title: string; children: React.ReactNode; icon: React.ReactNode }> = ({ title, children, icon }) => (
  <section className="rounded-[28px] border border-stone-200/70 dark:border-[#1e1f25] bg-gradient-to-br from-white/95 via-white to-emerald-50/70 dark:from-[#0e0f13] dark:via-[#0b0c10] dark:to-[#10171a] shadow-[0_35px_80px_-45px_rgba(16,185,129,0.55)] backdrop-blur">
    <div className="flex items-center gap-2 border-b border-white/70/60 dark:border-white/5 px-6 py-4">
      <span className="rounded-full bg-emerald-100/70 p-2 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300">
        {icon}
      </span>
      <CardTitle className="text-lg font-semibold text-foreground">{title}</CardTitle>
    </div>
    <CardContent className="p-6">{children}</CardContent>
  </section>
)

const InfoPill: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="inline-flex items-center rounded-full bg-emerald-100/80 dark:bg-emerald-900/50 px-3 py-1 text-xs font-medium text-emerald-900 dark:text-emerald-50">
    {children}
  </span>
)

const formatTimestamp = (value?: string | null) => {
  if (!value) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return undefined
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

const hasMeaningfulValue = (value: unknown): boolean => {
  if (value === null || value === undefined) return false
  if (typeof value === "boolean") return value
  if (typeof value === "number") return true
  if (typeof value === "string") return value.trim().length > 0
  if (Array.isArray(value)) return value.some(hasMeaningfulValue)
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).some(hasMeaningfulValue)
  return true
}

const hasSectionData = (...values: unknown[]) => values.some((value) => hasMeaningfulValue(value))

const CompanionCard: React.FC<{ id: string; name: string; image?: string }> = ({ id, name, image }) => (
  <Link
    to={`/plants/${id}`}
    className="group rounded-2xl border border-white/60 bg-white/90 p-3 shadow-[0_20px_45px_-35px_rgba(16,185,129,0.9)] transition hover:-translate-y-1 hover:shadow-[0_35px_65px_-35px_rgba(16,185,129,0.55)] dark:border-white/10 dark:bg-[#12151c]"
  >
    <div className="relative mb-3 overflow-hidden rounded-xl bg-emerald-50/80 dark:bg-emerald-500/10">
      {image ? (
        <img src={image} alt={name} className="h-36 w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" />
      ) : (
        <div className="flex h-36 items-center justify-center text-xs uppercase tracking-wide text-emerald-700/60 dark:text-emerald-200/80">
          No photo yet
        </div>
      )}
    </div>
    <div className="flex items-center justify-between gap-2">
      <div>
        <p className="text-sm font-semibold text-stone-900 dark:text-white">{name}</p>
        <p className="text-xs text-muted-foreground">Companion plant</p>
      </div>
      <ChevronRight className="h-4 w-4 text-emerald-500 transition group-hover:translate-x-1" />
    </div>
  </Link>
)

const FieldRow: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => {
  if (value === undefined || value === null || value === "") return null
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-muted/50 bg-muted/30 p-3 text-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-foreground leading-relaxed">{value}</div>
    </div>
  )
}

const colorPalette = ["#34d399", "#22d3ee", "#fbbf24", "#fb7185", "#c084fc", "#38bdf8"]

const safeJoin = (value?: string[]) => (Array.isArray(value) && value.length ? value.join(", ") : undefined)

const monthLookup = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

const monthsToBadges = (months?: number[]) =>
  Array.isArray(months) && months.length
    ? (
        <div className="flex flex-wrap gap-2">
          {months.map((m) => (
            <InfoPill key={m}>{monthLookup[m - 1] || m}</InfoPill>
          ))}
        </div>
      )
    : undefined

const booleanText = (value?: boolean) => (value ? "Yes" : undefined)

const DictionaryList: React.FC<{ value?: Record<string, string> }>
  = ({ value }) => {
    if (!value || !Object.keys(value).length) return null
    return (
      <div className="flex flex-wrap gap-2">
        {Object.entries(value).map(([k, v]) => (
          <div key={k} className="rounded-md bg-white/60 dark:bg-slate-800/50 px-3 py-2 shadow-sm ring-1 ring-muted/60">
            <div className="text-[11px] uppercase text-muted-foreground">{k}</div>
            <div className="text-sm text-foreground">{v}</div>
          </div>
        ))}
      </div>
    )
  }

const listOrTags = (values?: string[]) =>
  Array.isArray(values) && values.length ? (
    <div className="flex flex-wrap gap-2">
      {values.map((v) => (
        <InfoPill key={v}>{v}</InfoPill>
      ))}
    </div>
  ) : undefined

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

  const temperatureData = useMemo(() => {
    const rows = [
      { label: "Min", value: plant.plantCare?.temperatureMin },
      { label: "Ideal", value: plant.plantCare?.temperatureIdeal },
      { label: "Max", value: plant.plantCare?.temperatureMax },
    ].filter((r) => typeof r.value === "number") as { label: string; value: number }[]
    return rows
  }, [plant.plantCare?.temperatureIdeal, plant.plantCare?.temperatureMax, plant.plantCare?.temperatureMin])

    const wateringPieData = useMemo(() => {
      if (!plant.plantCare?.wateringType?.length) return []
      return plant.plantCare.wateringType.map((type, idx) => ({ name: type, value: 1, fill: colorPalette[idx % colorPalette.length] }))
    }, [plant.plantCare?.wateringType])

  const utilityBadges = plant.utility?.length ? plant.utility : []

  const seasons = plant.identity?.season || plant.seasons || []
  const companions = plant.miscellaneous?.companions?.filter(Boolean) ?? []
  const companionsKey = companions.join('|')
  const [companionDetails, setCompanionDetails] = useState<Array<{ id: string; name: string; image?: string }>>([])
  const shareFeedback =
    shareStatus === "copied" ? "Link copied" : shareStatus === "shared" ? "Shared!" : shareStatus === "error" ? "Share unavailable" : ""

  const identityHasContent = hasSectionData(
    plant.identity?.givenNames,
    plant.identity?.scientificName,
    plant.identity?.family,
    plant.identity?.promotionMonth,
    plant.identity?.lifeCycle,
    seasons,
    plant.identity?.foliagePersistance,
    plant.identity?.toxicityHuman,
    plant.identity?.toxicityPets,
    plant.identity?.allergens,
    plant.identity?.symbolism,
    plant.identity?.livingSpace,
    plant.identity?.composition,
    plant.identity?.maintenanceLevel,
    plant.identity?.spiked,
    plant.identity?.scent,
  )
  const plantCareHasContent = hasSectionData(
    plant.plantCare?.origin,
    plant.plantCare?.habitat,
    plant.plantCare?.temperatureMax,
    plant.plantCare?.temperatureMin,
    plant.plantCare?.temperatureIdeal,
    plant.plantCare?.levelSun,
    plant.plantCare?.hygrometry,
    plant.plantCare?.watering?.schedules,
    plant.plantCare?.wateringType,
    plant.plantCare?.division,
    plant.plantCare?.soil,
    plant.plantCare?.mulching,
    plant.plantCare?.nutritionNeed,
    plant.plantCare?.fertilizer,
    plant.plantCare?.adviceSoil,
    plant.plantCare?.adviceMulching,
    plant.plantCare?.adviceFertilizer,
  )
  const growthHasContent = hasSectionData(
    plant.growth?.sowingMonth,
    plant.growth?.floweringMonth,
    plant.growth?.fruitingMonth,
    plant.growth?.height,
    plant.growth?.wingspan,
    plant.growth?.tutoring,
    plant.growth?.adviceTutoring,
    plant.growth?.sowType,
    plant.growth?.separation,
    plant.growth?.transplanting,
    plant.growth?.adviceSowing,
    plant.growth?.cut,
  )
  const usageHasContent = hasSectionData(
    plant.usage?.adviceMedicinal,
    plant.usage?.nutritionalIntake,
    plant.usage?.infusion,
    plant.usage?.adviceInfusion,
    plant.usage?.infusionMix,
    plant.usage?.recipesIdeas,
    plant.usage?.aromatherapy,
    plant.usage?.spiceMixes,
  )
  const ecologyHasContent = hasSectionData(
    plant.ecology?.melliferous,
    plant.ecology?.polenizer,
    plant.ecology?.beFertilizer,
    plant.ecology?.groundEffect,
    plant.ecology?.conservationStatus,
  )
  const dangerHasContent = hasSectionData(plant.danger?.pests, plant.danger?.diseases)
  const miscHasContent = hasSectionData(
    companionDetails.length ? companionDetails : plant.miscellaneous?.companions,
    plant.miscellaneous?.tags,
    plant.miscellaneous?.sources,
  )
  const createdAtDisplay = formatTimestamp((plant.meta as any)?.createdTime || (plant.meta as any)?.createdAt)
  const updatedAtDisplay = formatTimestamp((plant.meta as any)?.updatedTime || (plant.meta as any)?.updatedAt)
  const metaHasContent = hasSectionData(
    plant.meta?.adminCommentary,
    plant.meta?.createdBy,
    plant.meta?.updatedBy,
    createdAtDisplay,
    updatedAtDisplay,
  )
  const galleryHasContent = Boolean(plant.images?.length)

  useEffect(() => {
    let ignore = false
    const loadCompanions = async () => {
      if (!companions.length) {
        setCompanionDetails([])
        return
      }
      try {
        const { data: plantsData } = await supabase
          .from('plants')
          .select('id,name')
          .in('id', companions)
        const ids = plantsData?.map((row) => row.id) ?? []
        let cover: Record<string, string | undefined> = {}
        if (ids.length) {
          const { data: imagesData } = await supabase
            .from('plant_images')
            .select('plant_id,link,use')
            .in('plant_id', ids)
          cover = (imagesData || []).reduce<Record<string, string | undefined>>((acc, row: any) => {
            const key = row?.plant_id as string
            if (!key) return acc
            if (row?.use === 'primary') {
              acc[key] = row?.link || acc[key]
              return acc
            }
            if (!acc[key]) acc[key] = row?.link || undefined
            return acc
          }, {})
        }
        if (!ignore) {
          setCompanionDetails(
            (plantsData || []).map((row) => ({
              id: row.id as string,
              name: row.name as string,
              image: cover[row.id as string],
            })),
          )
        }
      } catch {
        if (!ignore) setCompanionDetails([])
      }
    }
    loadCompanions()
    return () => {
      ignore = true
    }
  }, [companionsKey])

    return (
      <div className="space-y-6 pb-16">
        <div className="relative overflow-hidden rounded-3xl border border-muted/50 bg-gradient-to-br from-emerald-50 via-white to-amber-50 dark:from-[#0b1220] dark:via-[#0a0f1a] dark:to-[#05080f] shadow-lg">
          <div className="absolute inset-0 opacity-25 blur-3xl" style={{ background: "radial-gradient(circle at 20% 20%, #34d39926, transparent 40%), radial-gradient(circle at 80% 10%, #fb718526, transparent 35%), radial-gradient(circle at 60% 80%, #22d3ee26, transparent 45%)" }} />
            <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-2 sm:gap-3 pointer-events-auto">
            {onToggleLike && (
              <Button
                type="button"
                size="lg"
                variant={liked ? "default" : "secondary"}
                className="rounded-full px-6 py-3 text-base shadow-lg"
                onClick={onToggleLike}
              >
                <Heart className="mr-2 h-5 w-5" fill={liked ? "currentColor" : "none"} />
                {liked ? "Liked" : "Like"}
              </Button>
            )}
            <div className="flex flex-col items-end gap-1">
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="rounded-full px-5 py-3 text-base shadow-lg"
                onClick={handleShare}
              >
                <Share2 className="mr-2 h-5 w-5" />
                Share
              </Button>
              {shareFeedback && <span className="text-xs font-medium text-white drop-shadow">{shareFeedback}</span>}
            </div>
          </div>
          <div className="relative flex flex-col gap-4 p-4 pt-16 sm:p-6 lg:flex-row lg:gap-8 lg:p-8">
            <div className="flex-1 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="uppercase tracking-wide">{plant.plantType || "Plant"}</Badge>
              {utilityBadges.map((u) => (
                <Badge key={u} variant="outline" className="bg-white/70 dark:bg-slate-900/70">
                  {u}
                </Badge>
              ))}
              {seasons.length > 0 && <Badge variant="outline" className="bg-amber-100/60 text-amber-900 dark:bg-amber-900/30 dark:text-amber-50">{seasons.join(" • ")}</Badge>}
            </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-foreground">{plant.name}</h1>
                {plant.identity?.scientificName && (
                  <p className="text-lg text-muted-foreground italic">{plant.identity.scientificName}</p>
                )}
              </div>
            {plant.identity?.overview && <p className="text-muted-foreground leading-relaxed text-base">{plant.identity.overview}</p>}

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
                <div
                  className="relative z-0 aspect-[4/3] w-full overflow-hidden rounded-2xl border border-muted/60 bg-white/60 shadow-inner sm:w-80 lg:w-96"
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                >
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
                      <button
                        type="button"
                        className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white backdrop-blur hover:bg-black/60"
                        onClick={(event) => {
                          event.stopPropagation()
                          goToPrevImage()
                        }}
                        aria-label="Previous image"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white backdrop-blur hover:bg-black/60"
                        onClick={(event) => {
                          event.stopPropagation()
                          goToNextImage()
                        }}
                        aria-label="Next image"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                      <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2">
                        {images.map((_, idx) => (
                          <button
                            key={`dot-${idx}`}
                            type="button"
                            className={`h-2.5 w-2.5 rounded-full transition ${
                              idx === activeImageIndex ? "bg-white" : "bg-white/40"
                            }`}
                            onClick={(event) => {
                              event.stopPropagation()
                              setActiveImageIndex(idx)
                            }}
                            aria-label={`Go to image ${idx + 1}`}
                          />
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
        {viewerOpen && activeImage && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
            onClick={closeViewer}
          >
            <button
              type="button"
              className="absolute top-6 right-6 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
              onClick={(event) => {
                event.stopPropagation()
                closeViewer()
              }}
              aria-label="Close image viewer"
            >
              <X className="h-5 w-5" />
            </button>
            <div
              className="flex h-full w-full max-w-5xl flex-col items-center justify-center px-4"
              onClick={(event) => event.stopPropagation()}
            >
              <div
                className="relative max-h-[80vh] w-full overflow-hidden rounded-2xl border border-white/10 bg-black/60"
                onWheel={handleViewerWheel}
                onPointerDown={handleViewerPointerDown}
                onPointerMove={handleViewerPointerMove}
                onPointerUp={handleViewerPointerUp}
                onPointerLeave={handleViewerPointerUp}
              >
                <img
                  src={activeImage.link}
                  alt={plant.name}
                  draggable={false}
                  className="h-full w-full select-none object-contain"
                  style={{
                    transform: `translate(${viewerOffset.x}px, ${viewerOffset.y}px) scale(${viewerZoom})`,
                    cursor: isPanning ? "grabbing" : viewerZoom > 1 ? "grab" : "zoom-in",
                    transition: isPanning ? "none" : "transform 0.2s ease-out",
                  }}
                />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-white">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={(event) => {
                    event.stopPropagation()
                    adjustZoom(0.2)
                  }}
                >
                  <ZoomIn className="mr-1 h-4 w-4" />
                  Zoom in
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={(event) => {
                    event.stopPropagation()
                    adjustZoom(-0.2)
                  }}
                >
                  <ZoomOut className="mr-1 h-4 w-4" />
                  Zoom out
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={(event) => {
                    event.stopPropagation()
                    resetViewer()
                  }}
                >
                  <RefreshCw className="mr-1 h-4 w-4" />
                  Reset
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {plant.growth?.height !== undefined && (
          <Card className="bg-gradient-to-br from-emerald-500/90 to-emerald-700 text-white shadow-lg">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs uppercase text-white/80">Height</p>
                <p className="text-3xl font-bold">{plant.growth.height} cm</p>
              </div>
              <Flame className="h-10 w-10 text-white/80" />
            </CardContent>
          </Card>
        )}
        {plant.growth?.wingspan !== undefined && (
          <Card className="bg-gradient-to-br from-sky-400/90 to-blue-600 text-white shadow-lg">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs uppercase text-white/80">Wingspan</p>
                <p className="text-3xl font-bold">{plant.growth.wingspan} cm</p>
              </div>
              <Leaf className="h-10 w-10 text-white/80" />
            </CardContent>
          </Card>
        )}
        {plant.plantCare?.hygrometry !== undefined && (
          <Card className="bg-gradient-to-br from-cyan-400/90 to-teal-600 text-white shadow-lg">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs uppercase text-white/80">Humidity sweet spot</p>
                <p className="text-3xl font-bold">{plant.plantCare.hygrometry}%</p>
              </div>
              <Droplets className="h-10 w-10 text-white/80" />
            </CardContent>
          </Card>
        )}
        {plant.plantCare?.levelSun && (
          <Card className="bg-gradient-to-br from-amber-400/90 to-orange-600 text-white shadow-lg">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs uppercase text-white/80">Sun craving</p>
                <p className="text-2xl font-bold leading-tight">{plant.plantCare.levelSun}</p>
              </div>
              <SunMedium className="h-10 w-10 text-white/80" />
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {identityHasContent && (
          <Section title="Identity" icon={<Fingerprint className="h-4 w-4" />}>
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldRow label="Given Names" value={safeJoin(plant.identity?.givenNames)} />
              <FieldRow label="Family" value={plant.identity?.family} />
              <FieldRow label="Promotion Month" value={plant.identity?.promotionMonth ? monthLookup[plant.identity.promotionMonth - 1] || plant.identity.promotionMonth : undefined} />
              <FieldRow label="Life Cycle" value={plant.identity?.lifeCycle} />
              <FieldRow label="Seasons" value={seasons.length ? seasons.join(" • ") : undefined} />
              <FieldRow label="Foliage Persistance" value={plant.identity?.foliagePersistance} />
              <FieldRow label="Spiked" value={booleanText(plant.identity?.spiked)} />
              <FieldRow label="Toxicity (Human)" value={plant.identity?.toxicityHuman} />
              <FieldRow label="Toxicity (Pets)" value={plant.identity?.toxicityPets} />
              <FieldRow label="Allergens" value={listOrTags(plant.identity?.allergens)} />
              <FieldRow label="Scent" value={booleanText(plant.identity?.scent)} />
              <FieldRow label="Symbolism" value={listOrTags(plant.identity?.symbolism)} />
              <FieldRow label="Living Space" value={plant.identity?.livingSpace} />
              <FieldRow label="Composition" value={listOrTags(plant.identity?.composition as string[])} />
              <FieldRow label="Maintenance Level" value={plant.identity?.maintenanceLevel} />
            </div>
          </Section>
        )}

        {plantCareHasContent && (
          <Section title="Plant Care" icon={<Droplet className="h-4 w-4" />}>
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldRow label="Origin" value={listOrTags(plant.plantCare?.origin)} />
              <FieldRow label="Habitat" value={listOrTags(plant.plantCare?.habitat as string[])} />
              <FieldRow
                label="Watering"
                value={(() => {
                  const schedules = plant.plantCare?.watering && Array.isArray(plant.plantCare.watering.schedules)
                    ? plant.plantCare.watering.schedules
                    : []
                  if (schedules.length) {
                    return schedules
                      .filter((s) => s.season || s.quantity !== undefined || s.timePeriod)
                      .map((s) => {
                        const seasonLabel = s.season ? `${s.season}` : "Any season"
                        const qtyPart = s.quantity !== undefined ? `${s.quantity}` : ""
                        const periodPart = s.timePeriod ? `${qtyPart ? " / " : ""}${s.timePeriod}` : ""
                        const suffix = qtyPart || periodPart ? ` • ${qtyPart}${periodPart}` : ""
                        return `${seasonLabel}${suffix}`
                      })
                      .join(" | ")
                  }
                  if (plant.plantCare?.watering) {
                    return `${[plant.plantCare.watering.season, plant.plantCare.watering.quantity].filter(Boolean).join(" • ")} ${plant.plantCare.watering.timePeriod ? `/ ${plant.plantCare.watering.timePeriod}` : ""}`.trim()
                  }
                  return undefined
                })()}
              />
              <FieldRow label="Watering Type" value={listOrTags(plant.plantCare?.wateringType as string[])} />
              <FieldRow label="Division" value={listOrTags(plant.plantCare?.division as string[])} />
              <FieldRow label="Soil" value={listOrTags(plant.plantCare?.soil as string[])} />
              <FieldRow label="Mulching" value={listOrTags(plant.plantCare?.mulching as string[])} />
              <FieldRow label="Nutrition Need" value={listOrTags(plant.plantCare?.nutritionNeed as string[])} />
              <FieldRow label="Fertilizer" value={listOrTags(plant.plantCare?.fertilizer as string[])} />
              <FieldRow label="Advice Soil" value={plant.plantCare?.adviceSoil} />
              <FieldRow label="Advice Mulching" value={plant.plantCare?.adviceMulching} />
              <FieldRow label="Advice Fertilizer" value={plant.plantCare?.adviceFertilizer} />
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {temperatureData.length > 0 && (
                <Card className="border border-muted/60 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base font-semibold">
                      <Thermometer className="h-4 w-4 text-amber-500" />
                      Temperature window (°C)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={temperatureData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <XAxis dataKey="label" tickLine={false} axisLine={false} />
                        <YAxis hide domain={["dataMin - 5", "dataMax + 5"]} />
                        <Tooltip cursor={{ fill: "hsl(var(--muted))" }} />
                        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                          {temperatureData.map((_, idx) => (
                            <Cell key={idx} fill={colorPalette[idx % colorPalette.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {wateringPieData.length > 0 && (
                <Card className="border border-muted/60 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base font-semibold">
                      <Droplets className="h-4 w-4 text-sky-500" />
                      Watering style mix
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={wateringPieData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={2}>
                          {wateringPieData.map((entry, idx) => (
                            <Cell key={`cell-${idx}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </div>
          </Section>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {growthHasContent && (
          <Section title="Growth" icon={<Sprout className="h-4 w-4" />}>
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldRow label="Sowing Month" value={monthsToBadges(plant.growth?.sowingMonth)} />
              <FieldRow label="Flowering Month" value={monthsToBadges(plant.growth?.floweringMonth)} />
              <FieldRow label="Fruiting Month" value={monthsToBadges(plant.growth?.fruitingMonth)} />
              <FieldRow label="Tutoring" value={booleanText(plant.growth?.tutoring)} />
              <FieldRow label="Advice Tutoring" value={plant.growth?.adviceTutoring} />
              <FieldRow label="Sow Type" value={listOrTags(plant.growth?.sowType as string[])} />
              <FieldRow label="Separation" value={plant.growth?.separation ? `${plant.growth.separation} cm` : undefined} />
              <FieldRow label="Transplanting" value={booleanText(plant.growth?.transplanting)} />
              <FieldRow label="Advice Sowing" value={plant.growth?.adviceSowing} />
              <FieldRow label="Cut" value={plant.growth?.cut} />
            </div>
          </Section>
        )}

        {usageHasContent && (
          <Section title="Usage" icon={<ChefHat className="h-4 w-4" />}>
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldRow label="Advice Medicinal" value={plant.usage?.adviceMedicinal} />
              <FieldRow label="Nutritional Intake" value={listOrTags(plant.usage?.nutritionalIntake)} />
              <FieldRow label="Infusion" value={booleanText(plant.usage?.infusion)} />
              <FieldRow label="Advice Infusion" value={plant.usage?.adviceInfusion} />
              <FieldRow label="Infusion Mix" value={plant.usage?.infusionMix ? <DictionaryList value={plant.usage.infusionMix} /> : undefined} />
              <FieldRow label="Recipes Ideas" value={listOrTags(plant.usage?.recipesIdeas)} />
              <FieldRow label="Aromatherapy" value={booleanText(plant.usage?.aromatherapy)} />
              <FieldRow label="Spice Mixes" value={listOrTags(plant.usage?.spiceMixes)} />
            </div>
          </Section>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {ecologyHasContent && (
          <Section title="Ecology" icon={<Leaf className="h-4 w-4" />}>
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldRow label="Melliferous" value={booleanText(plant.ecology?.melliferous)} />
              <FieldRow label="Polenizer" value={listOrTags(plant.ecology?.polenizer as string[])} />
              <FieldRow label="Be Fertilizer" value={booleanText(plant.ecology?.beFertilizer)} />
              <FieldRow label="Ground Effect" value={plant.ecology?.groundEffect} />
              <FieldRow label="Conservation Status" value={plant.ecology?.conservationStatus} />
            </div>
          </Section>
        )}

        {dangerHasContent && (
          <Section title="Danger" icon={<ShieldAlert className="h-4 w-4" />}>
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldRow label="Pests" value={listOrTags(plant.danger?.pests)} />
              <FieldRow label="Diseases" value={listOrTags(plant.danger?.diseases)} />
            </div>
          </Section>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {miscHasContent && (
          <Section title="Companions & Tags" icon={<Users className="h-4 w-4" />}>
            <div className="space-y-4">
              {companionDetails.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {companionDetails.map((companion) => (
                    <CompanionCard key={companion.id} id={companion.id} name={companion.name} image={companion.image} />
                  ))}
                </div>
              ) : (
                <FieldRow label="Companions" value={listOrTags(plant.miscellaneous?.companions)} />
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <FieldRow label="Tags" value={listOrTags(plant.miscellaneous?.tags)} />
                <FieldRow
                  label="Sources"
                  value={(plant.miscellaneous?.sources || []).length ? (
                    <div className="space-y-2 text-sm">
                      {(plant.miscellaneous?.sources || []).map((src, idx) => (
                        <div key={`${src.name}-${idx}`} className="flex flex-col rounded border px-3 py-2 bg-white/70 dark:bg-[#151b15]">
                          <div className="font-medium">{src.name}</div>
                          {src.url && (
                            <a href={src.url} target="_blank" rel="noreferrer" className="text-blue-600 underline break-all">
                              {src.url}
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : undefined}
                />
              </div>
            </div>
          </Section>
        )}

        {metaHasContent && (
          <Section title="Meta" icon={<Info className="h-4 w-4" />}>
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldRow label="Author" value={plant.meta?.createdBy} />
              <FieldRow label="Created" value={createdAtDisplay} />
              <FieldRow label="Last Editor" value={plant.meta?.updatedBy} />
              <FieldRow label="Last Updated" value={updatedAtDisplay} />
              <FieldRow label="Admin Commentary" value={plant.meta?.adminCommentary} />
            </div>
          </Section>
        )}
      </div>

        {galleryHasContent ? (
          <Section title="Gallery" icon={<Layers className="h-4 w-4" />}>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {(plant.images ?? []).map((img) => (
                <div key={img.id || img.link} className="relative overflow-hidden rounded-xl border border-muted/60 bg-white/80 shadow-sm">
                  <img src={img.link} alt={plant.name} className="h-32 w-full object-cover sm:h-40" loading="lazy" />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1 text-[11px] uppercase tracking-wide text-white">
                    {img.use}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        ) : null}
    </div>
  )
}

export default PlantDetails
