import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import type { Plant, PlantSeason, PlantWateringSchedule } from "@/types/plant"
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

    const commonNames = useMemo(() => {
      const flat = plant.commonNames || plant.givenNames
      const legacy = plant.identity?.givenNames || plant.identity?.commonNames
      const prioritized = (flat && flat.length > 0) ? flat : legacy
      if (!prioritized) return []
      return prioritized.filter((name): name is string => typeof name === "string" && name.trim().length > 0)
    }, [plant.commonNames, plant.givenNames, plant.identity?.givenNames, plant.identity?.commonNames])

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
  const seasons = plant.season || plant.identity?.season || (plant.seasons as PlantSeason[] | undefined) || []

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

  const formatScheduleEntry = (schedule: PlantWateringSchedule) => {
    const quantity = schedule.quantity ?? undefined
    const timePeriod = schedule.timePeriod ? translateTimePeriod(schedule.timePeriod) : undefined
    if (quantity && timePeriod) return `${quantity} / ${timePeriod}`
    if (quantity) return `${quantity}x`
    if (timePeriod) return `${t('plantDetails.values.every')} ${timePeriod}`
    return t('plantDetails.values.scheduled')
  }

  const formatWateringNeed = (schedules?: PlantWateringSchedule[]) => {
    if (!schedules?.length) return t('plantDetails.values.flexible')
    const hot = schedules.find((s) => s.season === 'hot')
    const cold = schedules.find((s) => s.season === 'cold')
    if (hot && cold) {
      return `${formatScheduleEntry(hot)} / ${formatScheduleEntry(cold)}`
    }
    return formatScheduleEntry(schedules[0])
  }

    const careLevelArr = Array.isArray(plant.careLevel) ? plant.careLevel : []
    const maintenanceLevel =
      careLevelArr[0] || (plant.identity?.maintenanceLevel as string) || undefined

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

  const sunlightVal = Array.isArray(plant.sunlight) ? plant.sunlight[0] : (plant.plantCare?.levelSun as string | undefined)
  const hygro = plant.hygrometry ?? (plant.plantCare?.hygrometry as number | undefined)
  const tempMin = plant.temperatureMin ?? (plant.plantCare?.temperatureMin as number | undefined)
  const tempMax = plant.temperatureMax ?? (plant.plantCare?.temperatureMax as number | undefined)
  const tempIdeal = plant.temperatureIdeal ?? (plant.plantCare?.temperatureIdeal as number | undefined)
  const schedules = plant.wateringSchedules ?? (plant.plantCare?.watering as { schedules?: PlantWateringSchedule[] } | undefined)?.schedules

  const stats = [
    {
      label: t('plantDetails.stats.sunLevel'),
      value: translateLevelSun(sunlightVal),
      iconColor: "text-amber-500 dark:text-amber-400",
      iconBg: "bg-gradient-to-br from-amber-500 to-orange-500",
      iconShadow: "shadow-amber-500/30",
      chipBg: "bg-gradient-to-br from-amber-50 to-orange-50/50 dark:from-amber-950/40 dark:to-orange-950/20",
      chipBorder: "border-amber-200/60 dark:border-amber-700/30",
      labelColor: "text-amber-800/70 dark:text-amber-300/60",
      glowColor: "from-amber-300/30 to-orange-300/30 dark:from-amber-700/15 dark:to-orange-700/15",
      icon: <SunMedium className="h-3.5 w-3.5 lg:h-4.5 lg:w-4.5 text-white" />,
      visible: Boolean(sunlightVal),
    },
    {
      label: t('plantDetails.stats.wateringNeed'),
      value: formatWateringNeed(schedules),
      iconColor: "text-blue-500 dark:text-blue-400",
      iconBg: "bg-gradient-to-br from-blue-500 to-cyan-500",
      iconShadow: "shadow-blue-500/30",
      chipBg: "bg-gradient-to-br from-blue-50 to-cyan-50/50 dark:from-blue-950/40 dark:to-cyan-950/20",
      chipBorder: "border-blue-200/60 dark:border-blue-700/30",
      labelColor: "text-blue-800/70 dark:text-blue-300/60",
      glowColor: "from-blue-300/30 to-cyan-300/30 dark:from-blue-700/15 dark:to-cyan-700/15",
      icon: <Droplet className="h-3.5 w-3.5 lg:h-4.5 lg:w-4.5 text-white" />,
      visible: Boolean(schedules?.length),
    },
    {
      label: t('plantDetails.stats.humidity'),
      value: hygro !== undefined ? `${hygro}%` : t('plantDetails.values.ambient'),
      iconColor: "text-cyan-500 dark:text-cyan-400",
      iconBg: "bg-gradient-to-br from-cyan-500 to-teal-500",
      iconShadow: "shadow-cyan-500/30",
      chipBg: "bg-gradient-to-br from-cyan-50 to-teal-50/50 dark:from-cyan-950/40 dark:to-teal-950/20",
      chipBorder: "border-cyan-200/60 dark:border-cyan-700/30",
      labelColor: "text-cyan-800/70 dark:text-cyan-300/60",
      glowColor: "from-cyan-300/30 to-teal-300/30 dark:from-cyan-700/15 dark:to-teal-700/15",
      icon: <Droplets className="h-3.5 w-3.5 lg:h-4.5 lg:w-4.5 text-white" />,
      visible: hygro !== undefined,
    },
    {
      label: t('plantDetails.stats.maintenance'),
      value: translateMaintenance(maintenanceLevel),
      iconColor: "text-emerald-500 dark:text-emerald-400",
      iconBg: "bg-gradient-to-br from-emerald-500 to-teal-500",
      iconShadow: "shadow-emerald-500/30",
      chipBg: "bg-gradient-to-br from-emerald-50 to-teal-50/50 dark:from-emerald-950/40 dark:to-teal-950/20",
      chipBorder: "border-emerald-200/60 dark:border-emerald-700/30",
      labelColor: "text-emerald-800/70 dark:text-emerald-300/60",
      glowColor: "from-emerald-300/30 to-teal-300/30 dark:from-emerald-700/15 dark:to-teal-700/15",
      icon: <Wrench className="h-3.5 w-3.5 lg:h-4.5 lg:w-4.5 text-white" />,
      visible: Boolean(maintenanceLevel),
    },
    {
      label: t('plantDetails.stats.temperature'),
      value:
        tempMin !== undefined && tempMax !== undefined
          ? `${tempMin}°C to ${tempMax}°C`
          : tempIdeal !== undefined
          ? `${tempIdeal}°C`
          : t('plantDetails.values.stable'),
      iconColor: "text-rose-500 dark:text-rose-400",
      iconBg: "bg-gradient-to-br from-rose-500 to-pink-500",
      iconShadow: "shadow-rose-500/30",
      chipBg: "bg-gradient-to-br from-rose-50 to-pink-50/50 dark:from-rose-950/40 dark:to-pink-950/20",
      chipBorder: "border-rose-200/60 dark:border-rose-700/30",
      labelColor: "text-rose-800/70 dark:text-rose-300/60",
      glowColor: "from-rose-300/30 to-pink-300/30 dark:from-rose-700/15 dark:to-pink-700/15",
      icon: <Thermometer className="h-3.5 w-3.5 lg:h-4.5 lg:w-4.5 text-white" />,
      visible: tempMin !== undefined || tempMax !== undefined || tempIdeal !== undefined,
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
              {(plant.scientificNameSpecies || plant.scientificName || plant.identity?.scientificName) && (
                <p className="text-sm sm:text-base md:text-lg text-muted-foreground italic mt-1">{plant.scientificNameSpecies || plant.scientificName || plant.identity?.scientificName}</p>
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
            {(plant.presentation || plant.description || plant.identity?.overview) && (
              <p className="text-muted-foreground leading-relaxed text-sm sm:text-base">{plant.presentation || plant.description || plant.identity?.overview}</p>
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
        <div className="flex flex-wrap justify-center gap-2.5 sm:gap-3 lg:gap-3.5">
          {visibleStats.map((stat) => (
            <div
              key={stat.label}
              className={`group relative flex items-center gap-2.5 lg:gap-3 overflow-hidden rounded-2xl border px-3.5 py-2.5 lg:px-5 lg:py-3.5 transition-shadow duration-300 ${stat.chipBg} ${stat.chipBorder}`}
            >
              <div className={`pointer-events-none absolute -right-3 -top-3 h-16 w-16 lg:h-20 lg:w-20 rounded-full bg-gradient-to-br ${stat.glowColor} blur-2xl`} />
              <span className={`relative flex h-7 w-7 lg:h-9 lg:w-9 shrink-0 items-center justify-center rounded-lg lg:rounded-xl shadow-md ${stat.iconBg} ${stat.iconShadow}`}>
                {stat.icon}
              </span>
              <div className="relative min-w-0">
                <p className={`text-[10px] lg:text-xs leading-none font-medium ${stat.labelColor}`}>{stat.label}</p>
                <p className="mt-0.5 text-sm lg:text-base font-semibold leading-tight text-foreground">{stat.value}</p>
              </div>
            </div>
          ))}
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