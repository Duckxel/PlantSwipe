import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Plant, PlantWateringSchedule } from "@/types/plant"
import { useTranslation } from "react-i18next"
import {
    SunMedium,
    Droplets,
    Thermometer,
    ChevronLeft,
    ChevronRight,
    Droplet,
    Wrench,
  } from "lucide-react"
import { useImageViewer, ImageViewer } from "@/components/ui/image-viewer"

interface PlantDetailsProps {
  plant: Plant
  /** @deprecated Now handled in PlantInfoPage header */
  liked?: boolean
  /** @deprecated Now handled in PlantInfoPage header */
  onToggleLike?: () => void
  /** @deprecated Now handled in PlantInfoPage header */
  onBookmark?: () => void
  /** @deprecated Now handled in PlantInfoPage header */
  isBookmarked?: boolean
}

export const PlantDetails: React.FC<PlantDetailsProps> = ({ plant }) => {
  const { t } = useTranslation('common')
  const images = (plant.images || []).filter((img): img is NonNullable<typeof img> & { link: string } => Boolean(img?.link))
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const activeImage = images[activeImageIndex] || null
  const imageViewer = useImageViewer()
  const touchStartRef = useRef<number | null>(null)

  useEffect(() => {
    setActiveImageIndex(0)
  }, [plant.id])

  useEffect(() => {
    if (activeImageIndex >= images.length && images.length > 0) {
      setActiveImageIndex(0)
    }
  }, [images.length, activeImageIndex])

    const heroColors = useMemo(() => plant.identity?.colors?.filter((c) => c.hexCode) || [], [plant.identity?.colors])
    const commonNames = useMemo(() => {
      const prioritized =
        plant.identity?.givenNames && plant.identity.givenNames.length > 0
          ? plant.identity.givenNames
          : plant.identity?.commonNames
      if (!prioritized) return []
      return prioritized.filter((name): name is string => typeof name === "string" && name.trim().length > 0)
    }, [plant.identity?.givenNames, plant.identity?.commonNames])

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

  const openViewer = useCallback(() => {
    if (!images.length) return
    const viewerImages = images.map((img) => ({ src: img.link, alt: plant.name }))
    imageViewer.openGallery(viewerImages, activeImageIndex)
  }, [images, activeImageIndex, plant.name, imageViewer])

  const utilityBadges = plant.utility?.length ? plant.utility : []
  const seasons = plant.identity?.season || plant.seasons || []

  const translateUtility = (utility: string) => {
    const key = `plantDetails.utility.${utility.toLowerCase().replace(/[_\s-]/g, '')}`
    const translated = t(key, { defaultValue: '' })
    return translated || utility.replace(/_/g, ' ')
  }

  const translateSeason = (season: string) => {
    const key = `plantDetails.seasons.${season.toLowerCase()}`
    const translated = t(key, { defaultValue: '' })
    return translated || season
  }

  const translatePlantType = (type?: string) => {
    if (!type) return t('plantDetails.plantType.plant')
    const key = `plantDetails.plantType.${type.toLowerCase()}`
    const translated = t(key, { defaultValue: '' })
    return translated || type
  }

  const translateTimePeriod = (period: string) => {
    const key = `plantDetails.timePeriods.${period.toLowerCase().replace(/[_-\s]/g, '')}`
    const translated = t(key, { defaultValue: '' })
    return translated || period.replace(/[_-]/g, " ").toLowerCase()
  }

  const formatWateringNeed = (schedules?: PlantWateringSchedule[]) => {
    if (!schedules?.length) return t('plantDetails.values.flexible')
    const schedule = schedules[0]
    const quantity = schedule.quantity ?? undefined
    const timePeriod = schedule.timePeriod ? translateTimePeriod(schedule.timePeriod) : undefined

    if (quantity && timePeriod) return `${quantity} / ${timePeriod}`
    if (quantity) return `${quantity}x`
    if (timePeriod) return `${t('plantDetails.values.every')} ${timePeriod}`
    return t('plantDetails.values.scheduled')
  }

    const maintenanceLevel =
      plant.identity?.maintenanceLevel || plant.plantCare?.maintenanceLevel || plant.care?.maintenanceLevel || undefined

  const translateLevelSun = (levelSun?: string) => {
    if (!levelSun) return t('plantDetails.values.adaptive')
    const key = `plantDetails.sunLevels.${levelSun.toLowerCase().replace(/[_\s-]/g, '')}`
    const translated = t(key, { defaultValue: '' })
    return translated || levelSun
  }

  const translateMaintenance = (level?: string) => {
    if (!level) return t('plantDetails.values.adaptive')
    const key = `plantDetails.maintenanceLevels.${level.toLowerCase().replace(/[_\s-]/g, '')}`
    const translated = t(key, { defaultValue: '' })
    return translated || level
  }

  const stats = [
    {
      label: t('plantDetails.stats.sunLevel'),
      value: translateLevelSun(plant.plantCare?.levelSun),
      gradient: "from-amber-400/90 to-orange-600",
      icon: <SunMedium className="h-5 w-5 sm:h-8 sm:w-8 md:h-10 md:w-10 text-white/80" />,
      visible: Boolean(plant.plantCare?.levelSun),
    },
      {
        label: t('plantDetails.stats.wateringNeed'),
        value: formatWateringNeed(plant.plantCare?.watering?.schedules),
        gradient: "from-blue-400/90 to-cyan-600",
        icon: <Droplet className="h-5 w-5 sm:h-8 sm:w-8 md:h-10 md:w-10 text-white/80" />,
        visible: Boolean(plant.plantCare?.watering?.schedules?.length),
      },
    {
      label: t('plantDetails.stats.humidity'),
      value: plant.plantCare?.hygrometry !== undefined ? `${plant.plantCare.hygrometry}%` : t('plantDetails.values.ambient'),
      gradient: "from-cyan-400/90 to-teal-600",
      icon: <Droplets className="h-5 w-5 sm:h-8 sm:w-8 md:h-10 md:w-10 text-white/80" />,
      visible: plant.plantCare?.hygrometry !== undefined,
    },
      {
        label: t('plantDetails.stats.maintenance'),
        value: translateMaintenance(maintenanceLevel),
        gradient: "from-emerald-400/90 to-lime-500",
        icon: <Wrench className="h-5 w-5 sm:h-8 sm:w-8 md:h-10 md:w-10 text-white/80" />,
        visible: Boolean(maintenanceLevel),
      },
    {
      label: t('plantDetails.stats.temperature'),
      value:
        plant.plantCare?.temperatureMin !== undefined && plant.plantCare?.temperatureMax !== undefined
          ? `${plant.plantCare.temperatureMin}°C to ${plant.plantCare.temperatureMax}°C`
          : plant.plantCare?.temperatureIdeal !== undefined
          ? `${plant.plantCare.temperatureIdeal}°C`
          : t('plantDetails.values.stable'),
      gradient: "from-red-400/90 to-pink-600",
      icon: <Thermometer className="h-5 w-5 sm:h-8 sm:w-8 md:h-10 md:w-10 text-white/80" />,
      visible:
        plant.plantCare?.temperatureMin !== undefined ||
        plant.plantCare?.temperatureMax !== undefined ||
        plant.plantCare?.temperatureIdeal !== undefined,
    },
  ]

  const visibleStats = stats.filter((stat) => stat.visible)

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
        <div className="relative flex flex-col gap-3 sm:gap-4 p-3 sm:p-4 md:p-6 lg:flex-row lg:gap-8 lg:p-8">
          <div className="flex-1 space-y-3 sm:space-y-4">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <Badge variant="secondary" className="uppercase tracking-wide text-[10px] sm:text-xs px-2 sm:px-3 py-0.5 sm:py-1">
                {translatePlantType(plant.plantType)}
              </Badge>
              {utilityBadges.map((u) => (
                <Badge key={u} variant="outline" className="bg-white/70 dark:bg-slate-900/70 text-[10px] sm:text-xs px-2 sm:px-3 py-0.5 sm:py-1">
                  {translateUtility(u)}
                </Badge>
              ))}
              {seasons.length > 0 && (
                <Badge variant="outline" className="bg-amber-100/60 text-amber-900 dark:bg-amber-900/30 dark:text-amber-50 text-[10px] sm:text-xs px-2 sm:px-3 py-0.5 sm:py-1">
                  {seasons.map(s => translateSeason(s)).join(" • ")}
                </Badge>
              )}
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground leading-tight">{plant.name}</h1>
              {plant.identity?.scientificName && (
                <p className="text-sm sm:text-base md:text-lg text-muted-foreground italic mt-1">{plant.identity.scientificName}</p>
              )}
                {commonNames.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {commonNames.map((name, idx) => (
                      <span
                        key={`given-name-${idx}-${name}`}
                        className="rounded-full border border-muted/40 bg-white/80 px-2.5 py-0.5 text-[11px] uppercase tracking-wide text-muted-foreground dark:bg-slate-900/60 dark:border-stone-700/60"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                )}
            </div>
            {plant.identity?.overview && (
              <p className="text-muted-foreground leading-relaxed text-sm sm:text-base">{plant.identity.overview}</p>
            )}
            {heroColors.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">{t('plantDetails.palette')}</span>
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
                {t('plantDetails.noImage')}
              </div>
            )}
          </div>
        </div>
      </div>

      {visibleStats.length > 0 && (
          <div className="rounded-[28px] border border-white/40 bg-white/70 px-3 py-3 shadow-inner backdrop-blur-sm dark:border-white/10 dark:bg-white/5 sm:px-6 sm:py-6">
            <div className="grid grid-cols-2 lg:flex gap-2.5 sm:gap-4">
              {visibleStats.map((stat, idx) => (
                <Card
                  key={stat.label}
                  className={`bg-gradient-to-br ${stat.gradient} text-white shadow-lg lg:flex-1 lg:min-w-0 ${
                    visibleStats.length % 2 !== 0 && idx === visibleStats.length - 1
                      ? 'col-span-2 lg:col-span-1'
                      : ''
                  }`}
                >
                  <CardContent className="flex items-center justify-between p-2.5 sm:p-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] sm:text-xs uppercase text-white/80 leading-tight">{stat.label}</p>
                      <p className="text-base sm:text-xl md:text-2xl font-bold leading-tight break-words">{stat.value}</p>
                    </div>
                    <div className="ml-1.5 sm:ml-2 flex-shrink-0">{stat.icon}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

      <ImageViewer
        {...imageViewer.props}
        enableZoom
        title={t('plantDetails.viewer.title', { defaultValue: 'Plant image viewer' })}
      />
    </div>
  )
}

export default PlantDetails