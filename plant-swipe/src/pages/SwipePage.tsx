import React from "react"
import { motion, AnimatePresence, type MotionValue } from "framer-motion"
import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Heart,
  Sparkles,
  PartyPopper,
  Palette,
  Flame,
  Sun,
  SunMedium,
  SunDim,
  Droplets,
  Droplet,
  Slash,
  Globe2,
  MapPin,
  Flower2,
  Utensils,
  HeartPulse,
  Wind,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Plant, PlantSeason } from "@/types/plant"
import { rarityTone, seasonBadge } from "@/constants/badges"
import { useTranslation } from "react-i18next"
import type { TFunction } from "i18next"
import { Link } from "@/components/i18n/Link"
import { isNewPlant, isPlantOfTheMonth, isPopularPlant } from "@/lib/plantHighlights"
import { getVerticalPhotoUrl } from "@/lib/photos"
import { cn, deriveWaterLevelFromFrequency } from "@/lib/utils"
import { resolveColorValue, DEFAULT_PLANT_COLOR } from "@/lib/colors"

interface SwipePageProps {
  current: Plant | undefined
  index: number
  setIndex: (i: number) => void
  x: MotionValue<number>
  y: MotionValue<number>
  onDragEnd: (_: unknown, info: { offset: { x: number; y: number }; velocity: { x: number; y: number } }) => void
  handleInfo: () => void
  handlePass: () => void
  handlePrevious: () => void
  liked?: boolean
  onToggleLike?: () => void
}

export const SwipePage: React.FC<SwipePageProps> = ({
  current,
  index,
  setIndex,
  x,
  y,
  onDragEnd,
  handleInfo,
  handlePass,
  handlePrevious,
  liked = false,
  onToggleLike,
  }) => {
    const { t } = useTranslation("common")
    const [isDesktop, setIsDesktop] = React.useState(() => (typeof window !== "undefined" ? window.innerWidth >= 768 : false))

    React.useEffect(() => {
      if (typeof window === "undefined") return
      const handleResize = () => {
        setIsDesktop(window.innerWidth >= 768)
      }
      window.addEventListener("resize", handleResize)
      return () => {
        window.removeEventListener("resize", handleResize)
      }
    }, [])

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault()
          handlePass()
          break
        case "ArrowRight":
          e.preventDefault()
          handlePrevious()
          break
        case "ArrowUp":
          e.preventDefault()
          handleInfo()
          break
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [handleInfo, handlePass, handlePrevious])

  const desktopCardHeight = "min(720px, calc(100vh - 12rem))"
  const mobileCardHeight = "calc(100vh - 13rem)"

  const rarityKey = current?.rarity && rarityTone[current.rarity] ? current.rarity : "Common"
  const seasons = (current?.seasons ?? []) as PlantSeason[]
  const displayImage = React.useMemo(() => {
    if (!current) return ""
    const vertical = getVerticalPhotoUrl(current.photos ?? [])
    return vertical || current.image || ""
  }, [current])
  const highlightBadges = React.useMemo(() => {
    if (!current) return []
    const badges: Array<{ key: string; label: string; icon: React.ReactNode; className: string }> = []
    if (isPlantOfTheMonth(current)) {
      badges.push({
        key: "promotion",
        label: t("discoveryPage.tags.plantOfMonth"),
        className: "bg-amber-400/90 text-amber-950",
        icon: <Sparkles className="h-4 w-4 mr-1" />,
      })
    }
    if (isNewPlant(current)) {
      badges.push({
        key: "new",
        label: t("discoveryPage.tags.new"),
        className: "bg-emerald-500/90 text-white",
        icon: <PartyPopper className="h-4 w-4 mr-1" />,
      })
    }
    if (isPopularPlant(current)) {
      badges.push({
        key: "popular",
        label: t("discoveryPage.tags.popular"),
        className: "bg-rose-600/90 text-white",
        icon: <Flame className="h-4 w-4 mr-1" />,
      })
    }
    return badges
  }, [current, t])

    return (
      <div
        className="max-w-5xl mx-auto -mt-2 sm:mt-6 px-1 sm:px-4 md:px-0 pb-[140px] md:pb-16"
        style={!isDesktop ? { paddingBottom: "calc(env(safe-area-inset-bottom) + 140px)" } : undefined}
      >
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative overflow-visible md:overflow-hidden rounded-[32px] border border-stone-200 dark:border-[#3e3e42] bg-gradient-to-br from-white via-emerald-50/60 to-stone-100 dark:from-[#1e1e1e] dark:via-[#252526] dark:to-[#171717] shadow-[0_30px_80px_-40px_rgba(16,185,129,0.45)]"
      >
        <div className="absolute inset-x-12 -top-24 h-56 rounded-full bg-emerald-200/40 dark:bg-emerald-500/10 blur-3xl" aria-hidden="true" />
        <div className="absolute inset-x-0 bottom-[-40%] h-72 rounded-full bg-emerald-100/50 dark:bg-emerald-500/10 blur-3xl" aria-hidden="true" />
          <div className="relative p-2 sm:p-6 md:p-12 space-y-6">
            <div
              className="relative mx-auto w-full max-w-none md:max-w-3xl min-h-[520px]"
              style={isDesktop ? { height: desktopCardHeight } : { height: mobileCardHeight }}
            >
              <AnimatePresence initial={false} mode="wait">
                {current ? (
                  <motion.div
                    key={`${current.id}-${index}`}
                    drag
                    dragElastic={0.28}
                    dragMomentum={false}
                    style={{ x, y }}
                    dragConstraints={{ left: -500, right: 500, top: -500, bottom: 500 }}
                    onDragEnd={onDragEnd}
                    initial={{ scale: 0.94, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.94, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="relative h-full w-full cursor-grab active:cursor-grabbing select-none"
                  >
                      <Card className="relative h-full w-full overflow-hidden rounded-[28px] border border-white/60 dark:border-white/10 bg-black text-white shadow-2xl">
                        {displayImage ? (
                          <div className="absolute inset-0 z-0 bg-cover bg-center" style={{ backgroundImage: `url(${displayImage})` }} />
                      ) : (
                        <div className="absolute inset-0 z-0 bg-gradient-to-br from-emerald-200 via-emerald-100 to-white" />
                      )}
                      <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/80 via-black/30 to-transparent" aria-hidden="true" />
                      <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/10 via-transparent to-black/80" aria-hidden="true" />
                      {highlightBadges.length > 0 && (
                        <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
                          {highlightBadges.map((badge) => (
                            <Badge key={badge.key} className={`rounded-2xl px-3 py-1 text-xs font-semibold flex items-center backdrop-blur ${badge.className}`}>
                              {badge.icon}
                              {badge.label}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <div className="absolute top-4 right-4 z-20">
                        <button
                          onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                            e.stopPropagation()
                            if (onToggleLike) {
                              onToggleLike()
                            }
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                          aria-pressed={liked}
                          aria-label={liked ? "Unlike" : "Like"}
                          className={`h-10 w-10 rounded-full flex items-center justify-center shadow border transition ${
                            liked ? "bg-rose-600 text-white border-rose-500" : "bg-white/90 text-black hover:bg-white"
                          }`}
                        >
                          <Heart className={`h-5 w-5 ${liked ? "fill-current" : ""}`} />
                        </button>
                      </div>
                        <PlantMetaRail plant={current} />
                      <div className="absolute bottom-0 left-0 right-0 z-20 p-6 pb-8 text-white">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <Badge className={`${rarityTone[rarityKey]} backdrop-blur bg-opacity-90`}>{current?.rarity ?? "Common"}</Badge>
                          {seasons.map((s) => {
                            const badgeClass = seasonBadge[s] ?? "bg-stone-200/70 dark:bg-stone-700/70 text-stone-900 dark:text-stone-100"
                            return (
                              <span key={s} className={`text-[11px] px-2.5 py-1 rounded-full shadow ${badgeClass}`}>
                                {s}
                              </span>
                            )
                          })}
                        </div>
                        <h2 className="text-3xl font-semibold tracking-tight drop-shadow-sm">{current.name}</h2>
                        {current.scientificName && <p className="opacity-90 text-sm italic">{current.scientificName}</p>}
                        <div
                          className="mt-5 grid w-full gap-2 pb-2 grid-cols-3 sm:gap-3 sm:pb-0"
                          style={!isDesktop ? { paddingBottom: "calc(env(safe-area-inset-bottom) + 8px)" } : undefined}
                        >
                          <Button
                            className={`rounded-2xl w-full text-white transition-colors ${
                              isDesktop ? "bg-black hover:bg-black/90" : "bg-black/80 hover:bg-black"
                            }`}
                            onClick={(e) => {
                              e.stopPropagation()
                              handlePrevious()
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                            aria-label={t("plant.back")}
                          >
                            {isDesktop ? (
                              <>
                                <ChevronLeft className="h-4 w-4 mr-1" />
                                {t("plant.back")}
                              </>
                            ) : (
                              <ChevronLeft className="h-5 w-5" />
                            )}
                          </Button>
                          <Button
                            className="rounded-2xl w-full bg-white/95 text-black hover:bg-white"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleInfo()
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                          >
                            {t("plant.info")}
                            <ChevronUp className="h-4 w-4 ml-1" />
                          </Button>
                          <Button
                            className={`rounded-2xl w-full text-white transition-colors ${
                              isDesktop ? "bg-black hover:bg-black/90" : "bg-black/80 hover:bg-black"
                            }`}
                            onClick={(e) => {
                              e.stopPropagation()
                              handlePass()
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                            aria-label={t("plant.next")}
                          >
                            {isDesktop ? (
                              <>
                                {t("plant.next")}
                                <ChevronRight className="h-4 w-4 ml-1" />
                              </>
                            ) : (
                              <ChevronRight className="h-5 w-5" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <EmptyState onReset={() => setIndex(0)} />
                  </div>
                )}
              </AnimatePresence>
          </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-3 sm:pt-4">
            <Button asChild className="rounded-2xl">
              <Link to="/search">
                <Sparkles className="h-4 w-4 mr-2" />
                {t("discoveryPage.hero.ctaPrimary")}
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-2xl">
              <Link to="/gardens">
                <Palette className="h-4 w-4 mr-2" />
                {t("discoveryPage.hero.ctaSecondary")}
              </Link>
            </Button>
          </div>
        </div>
      </motion.section>
    </div>
  )
}

const EmptyState = ({ onReset }: { onReset: () => void }) => {
  const { t } = useTranslation("common")
  return (
    <Card className="relative overflow-hidden rounded-[28px] border border-dashed border-stone-200/80 dark:border-[#3e3e42]/80 bg-white/90 dark:bg-[#1f1f1f]/90 backdrop-blur text-center shadow-lg max-w-lg w-full">
      <div className="absolute -top-32 right-10 h-56 w-56 rounded-full bg-emerald-200/40 dark:bg-emerald-500/10 blur-3xl" aria-hidden="true" />
      <div className="absolute -bottom-24 left-10 h-56 w-56 rounded-full bg-emerald-100/50 dark:bg-emerald-500/10 blur-3xl" aria-hidden="true" />
      <div className="relative p-10 space-y-6">
        <Badge variant="outline" className="rounded-2xl border-dashed w-fit mx-auto">
          <Sparkles className="h-4 w-4 mr-1" />
          {t("plant.noResults")}
        </Badge>
        <CardHeader className="space-y-3 text-center">
          <CardTitle className="text-xl flex items-center justify-center gap-2">
            <PartyPopper className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
            {t("discoveryPage.empty.title")}
          </CardTitle>
          <CardDescription className="text-sm text-stone-600 dark:text-stone-400">
            {t("discoveryPage.empty.subtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button variant="secondary" className="rounded-2xl" onClick={onReset}>
            {t("discoveryPage.empty.reset")}
          </Button>
        </CardContent>
      </div>
    </Card>
  )
}

const PlantMetaRail: React.FC<{ plant: Plant }> = ({ plant }) => {
  const { t } = useTranslation("common")
  const [activeKey, setActiveKey] = React.useState<string | null>(null)
  const items = React.useMemo(() => buildIndicatorItems(plant, t), [plant, t])

  React.useEffect(() => {
    setActiveKey(null)
  }, [plant.id])

  if (!items.length) return null

  return (
    <div className="absolute inset-y-6 right-3 z-30 flex flex-col items-end justify-center gap-3 md:gap-4">
      {items.map((item) => (
        <IndicatorPill
          key={item.key}
          item={item}
          active={activeKey === item.key}
          onActivate={() => setActiveKey(item.key)}
          onDeactivate={() => setActiveKey((prev) => (prev === item.key ? null : prev))}
        />
      ))}
    </div>
  )
}

interface ColorSwatchDescriptor {
  id: string
  label: string
  tone: string
}

interface IndicatorItem {
  key: string
  label: string
  description?: string
  icon?: React.ReactNode
  accentClass?: string
  detailList?: string[]
  variant?: "default" | "color"
  colors?: ColorSwatchDescriptor[]
  ariaValue?: string
}

interface IndicatorPillProps {
  item: IndicatorItem
  active: boolean
  onActivate: () => void
  onDeactivate: () => void
}

const IndicatorPill: React.FC<IndicatorPillProps> = ({ item, active, onActivate, onDeactivate }) => {
  const isColorVariant = item.variant === "color" && (item.colors?.length ?? 0) > 0
  const ariaLabel = `${item.description ?? ""}${item.description ? ": " : ""}${item.ariaValue ?? item.label}`.trim()

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    if (active) {
      onDeactivate()
    } else {
      onActivate()
    }
  }

  return (
    <div className="pointer-events-auto">
      <button
        type="button"
        aria-label={ariaLabel || undefined}
        aria-expanded={active}
        aria-pressed={active}
        onMouseEnter={onActivate}
        onMouseLeave={onDeactivate}
        onFocus={onActivate}
        onBlur={onDeactivate}
        onClick={handleClick}
        onPointerDown={(event) => event.stopPropagation()}
        className="group relative flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white/80 focus-visible:ring-offset-transparent"
      >
        <AnimatePresence>
          {active && (
            <motion.div
              className={cn(
                "mr-3 rounded-2xl border border-white/15 bg-black/70 px-3 py-2 text-left shadow-xl backdrop-blur-md",
                isColorVariant ? "max-w-[240px]" : "max-w-[220px]",
              )}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
            >
              {isColorVariant ? (
                <div className="flex flex-wrap gap-1.5">
                  {item.colors!.map((color) => (
                    <span key={color.id} className="relative flex h-4 w-4 items-center justify-center">
                      <span
                        className="h-4 w-4 rounded-full border border-white/30"
                        style={{ backgroundColor: color.tone }}
                        title={color.label}
                        aria-hidden="true"
                      />
                      <span className="sr-only">{color.label}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-0.5 text-white">
                  {item.description && (
                    <span className="text-[10px] uppercase tracking-[0.25em] text-white/60">
                      {item.description}
                    </span>
                  )}
                  <span className="text-xs font-semibold leading-tight">{item.label}</span>
                  {item.detailList?.length ? (
                    <span className="text-[11px] text-white/70 leading-tight">
                      {item.detailList.join(", ")}
                    </span>
                  ) : null}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        <span
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-black/65 text-white shadow-lg transition ring-offset-1 ring-offset-transparent",
            item.accentClass,
            active ? "ring-2 ring-white/80" : "ring-0",
            isColorVariant && "p-0",
          )}
        >
            {isColorVariant ? (
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full border border-white/35"
                style={{ backgroundColor: item.colors?.[0]?.tone ?? DEFAULT_PLANT_COLOR }}
                aria-hidden="true"
              />
            ) : (
              item.icon
            )}
        </span>
      </button>
    </div>
  )
}

type IndicatorLevel = "high" | "medium" | "low"

const SUN_ACCENTS: Record<IndicatorLevel, string> = {
  high: "text-amber-200",
  medium: "text-amber-100",
  low: "text-stone-100",
}

const WATER_ACCENTS: Record<IndicatorLevel, string> = {
  high: "text-cyan-200",
  medium: "text-sky-100",
  low: "text-blue-100",
}

const buildIndicatorItems = (plant: Plant, t: TFunction<"common">): IndicatorItem[] => {
  const items: IndicatorItem[] = []
  const sunSource = plant.environment?.sunExposure || plant.care?.sunlight
  const sunLevel = resolveSunLevel(sunSource)
  if (sunSource && sunLevel) {
    items.push({
      key: "sun",
      label: formatIndicatorValue(sunSource) || t("discoveryPage.indicators.sunLevel", { defaultValue: "Sun level" }),
      description: t("discoveryPage.indicators.sunLevel", { defaultValue: "Sun level" }),
      icon: getSunIcon(sunLevel),
      accentClass: SUN_ACCENTS[sunLevel],
      ariaValue: formatIndicatorValue(sunSource),
    })
  }

  const freqAmountRaw = plant.waterFreqAmount ?? plant.waterFreqValue
  const freqAmount = typeof freqAmountRaw === "number" ? freqAmountRaw : Number(freqAmountRaw || 0)
  const freqPeriod = (plant.waterFreqPeriod || plant.waterFreqUnit) as "day" | "week" | "month" | "year" | undefined
  const derivedWater = deriveWaterLevelFromFrequency(freqPeriod, freqAmount) || plant.care?.water
  const waterLevel = resolveWaterLevel(derivedWater)
  if (derivedWater && waterLevel) {
    items.push({
      key: "water",
      label: formatIndicatorValue(derivedWater) || t("discoveryPage.indicators.waterLevel", { defaultValue: "Water level" }),
      description: t("discoveryPage.indicators.waterLevel", { defaultValue: "Water level" }),
      icon: getWaterIcon(waterLevel),
      accentClass: WATER_ACCENTS[waterLevel],
      ariaValue: formatIndicatorValue(derivedWater),
    })
  }

  const nativeRange = (plant.ecology?.nativeRange ?? [])
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry): entry is string => Boolean(entry))
  if (nativeRange.length) {
    items.push({
      key: "origin",
      label: nativeRange[0],
      description: t("discoveryPage.indicators.origin", { defaultValue: "Origin" }),
      icon: (
        <span className="relative flex items-center justify-center">
          <Globe2 className="h-5 w-5" />
          <MapPin className="absolute -bottom-0.5 -right-0.5 h-3 w-3" />
        </span>
      ),
      accentClass: "text-sky-100",
      detailList: nativeRange.slice(1),
      ariaValue: nativeRange.join(", "),
    })
  }

  if (plant.dimensions?.containerFriendly) {
    items.push({
      key: "pottable",
      label: t("discoveryPage.indicators.potFriendly", { defaultValue: "Pot friendly" }),
      description: t("discoveryPage.indicators.potFriendly", { defaultValue: "Pot friendly" }),
      icon: <Flower2 className="h-5 w-5" />,
      accentClass: "text-emerald-100",
    })
  }

  const activitySet = new Set(
    (plant.classification?.activities ?? [])
      .map((activity) => (typeof activity === "string" ? activity.toLowerCase() : null))
      .filter((entry): entry is string => Boolean(entry)),
  )

  if (activitySet.has("comestible")) {
    items.push({
      key: "edible",
      label: t("discoveryPage.indicators.edible", { defaultValue: "Edible" }),
      description: t("discoveryPage.indicators.edible", { defaultValue: "Edible" }),
      icon: <Utensils className="h-5 w-5" />,
      accentClass: "text-orange-100",
    })
  }

  if (activitySet.has("medicinal")) {
    items.push({
      key: "medicinal",
      label: t("discoveryPage.indicators.medicinal", { defaultValue: "Medicinal" }),
      description: t("discoveryPage.indicators.medicinal", { defaultValue: "Medicinal" }),
      icon: <HeartPulse className="h-5 w-5" />,
      accentClass: "text-rose-100",
    })
  }

  if (activitySet.has("aromatic")) {
    items.push({
      key: "aromatic",
      label: t("discoveryPage.indicators.aromatic", { defaultValue: "Aromatic" }),
      description: t("discoveryPage.indicators.aromatic", { defaultValue: "Aromatic" }),
      icon: <Wind className="h-5 w-5" />,
      accentClass: "text-lime-100",
    })
  }

  const colorSwatches = buildColorSwatches(plant)
  if (colorSwatches.length) {
    items.push({
      key: "colors",
      label: colorSwatches[0].label,
      description: t("discoveryPage.indicators.colors", { defaultValue: "Colors" }),
      variant: "color",
      colors: colorSwatches,
      ariaValue: colorSwatches.map((color) => color.label).join(", "),
    })
  }

  return items
}

const getSunIcon = (level: IndicatorLevel) => {
  switch (level) {
    case "high":
      return <Sun className="h-5 w-5" />
    case "low":
      return <SunDim className="h-5 w-5" />
    default:
      return <SunMedium className="h-5 w-5" />
  }
}

const getWaterIcon = (level: IndicatorLevel) => {
  switch (level) {
    case "high":
      return <Droplets className="h-5 w-5" />
    case "low":
      return (
        <span className="relative flex items-center justify-center">
          <Droplet className="h-5 w-5 opacity-70" />
          <Slash className="absolute h-4 w-4 text-white" strokeWidth={2} />
        </span>
      )
    default:
      return <Droplet className="h-5 w-5" />
  }
}

const normalizeDescriptor = (value?: string | null): string => value?.toString().trim().toLowerCase() ?? ""

const includesAny = (value: string, tokens: string[]) => tokens.some((token) => value.includes(token))

const resolveSunLevel = (value?: string | null): IndicatorLevel | null => {
  const normalized = normalizeDescriptor(value)
  if (!normalized) return null

  const sunHighTokens = ["full sun", "direct sun", "bright light", "very bright", "brightness 7", "plein soleil"]
  const sunMediumTokens = ["partial sun", "partial shade", "filtered sun", "indirect light", "medium light", "brightness medium"]
  const sunLowTokens = ["full shade", "shade only", "no sun", "no sunlight", "low light", "brightness empty", "no sun necessary"]

  if (includesAny(normalized, sunHighTokens)) return "high"
  if (includesAny(normalized, sunMediumTokens)) return "medium"
  if (includesAny(normalized, sunLowTokens)) return "low"

  if (normalized.includes("partial shade")) return "medium"
  if (normalized.includes("partial")) return "medium"
  if (normalized.includes("shade")) return normalized.includes("partial") ? "medium" : "low"
  if (normalized.includes("sun")) return normalized.includes("partial") ? "medium" : "high"
  if (normalized.includes("high") || normalized.includes("bright")) return "high"
  if (normalized.includes("medium") || normalized.includes("moderate") || normalized.includes("indirect")) return "medium"
  if (normalized.includes("low") || normalized.includes("dark")) return "low"

  return null
}

const resolveWaterLevel = (value?: string | null): IndicatorLevel | null => {
  const normalized = normalizeDescriptor(value)
  if (!normalized) return null

  const waterHighTokens = ["keep moist", "moist soil", "soak", "wet", "daily", "frequent", "humidity high", "high humidity", "high water", "constant moisture"]
  const waterMediumTokens = ["medium", "moderate", "balanced", "weekly", "every few days", "humidity mid", "average", "regular"]
  const waterLowTokens = ["low", "dry", "drought", "sparingly", "infrequent", "monthly", "humidity low", "succulent", "well-drained"]

  if (includesAny(normalized, waterHighTokens) || normalized === "high") return "high"
  if (includesAny(normalized, waterMediumTokens) || normalized === "medium") return "medium"
  if (includesAny(normalized, waterLowTokens) || normalized === "low") return "low"

  if (normalized.includes("frequent") || normalized.includes("often")) return "high"
  if (normalized.includes("weekly") || normalized.includes("regular") || normalized.includes("average")) return "medium"
  if (normalized.includes("rarely") || normalized.includes("seldom") || normalized.includes("little")) return "low"

  return null
}

const formatIndicatorValue = (value?: string | null): string => {
  if (!value) return ""
  return value
    .toString()
    .trim()
    .split(/\s+/)
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : ""))
    .join(" ")
}

const buildColorSwatches = (plant: Plant): ColorSwatchDescriptor[] => {
  const directColors = Array.isArray(plant.colors) ? plant.colors : []
  const normalizedDirect = directColors.filter((color): color is string => typeof color === "string" && color.trim().length > 0)

  const fallbackColors: string[] = []
  if (!normalizedDirect.length) {
    plant.phenology?.flowerColors?.forEach((color) => {
      if (color?.hex) {
        fallbackColors.push(color.hex)
      } else if (color?.name) {
        fallbackColors.push(color.name)
      }
    })
    plant.phenology?.leafColors?.forEach((color) => {
      if (color?.hex) {
        fallbackColors.push(color.hex)
      } else if (color?.name) {
        fallbackColors.push(color.name)
      }
    })
  }

  const palette = normalizedDirect.length ? normalizedDirect : fallbackColors

  return palette
    .map((color, index) => ({
      id: `${color}-${index}`,
      label: formatIndicatorValue(color),
      tone: resolveColorValue(color),
    }))
    .filter((entry) => entry.label.length > 0 || Boolean(entry.tone))
}
