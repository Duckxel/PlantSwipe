import React from "react"
import { motion, AnimatePresence, type MotionValue } from "framer-motion"
import { ChevronLeft, ChevronRight, ChevronUp, Heart, Sparkles, PartyPopper, Palette, Wand2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Plant, PlantSeason } from "@/types/plant"
import { rarityTone, seasonBadge } from "@/constants/badges"
import { useTranslation } from "react-i18next"
import { Link } from "@/components/i18n/Link"

const colorTokenMap: Record<string, string> = {
  red: "#ef4444",
  pink: "#f472b6",
  yellow: "#facc15",
  white: "#f5f5f4",
  purple: "#c084fc",
  blue: "#60a5fa",
  orange: "#fb923c",
  green: "#4ade80",
  violet: "#a855f7",
  magenta: "#db2777",
  turquoise: "#2dd4bf",
  gold: "#fbbf24",
  amber: "#f59e0b",
  coral: "#fb7185",
  teal: "#5eead4",
  lilac: "#c4b5fd",
  lavender: "#c084fc",
  indigo: "#6366f1",
  bronze: "#b45309",
  brown: "#b45309",
  copper: "#d97706",
  silver: "#d1d5db",
  gray: "#9ca3af",
  black: "#1f2937",
}

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
  total: number
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
  total,
}) => {
  const { t } = useTranslation("common")

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

  const position = total > 0 ? ((index % total) + total) % total + 1 : null
  const statusLabel = position ? t("discoveryPage.status.position", { current: position, total }) : t("discoveryPage.status.empty")
  const meaning = current?.meaning?.trim()
  const colorChips = current?.colors?.slice(0, 6) ?? []
  const seedsCopy = current?.seedsAvailable ? t("discoveryPage.infoCard.seedsAvailable") : t("discoveryPage.infoCard.seedsUnavailable")
  const cardHeight = "min(680px, calc(100vh - 14rem))"

  const rarityKey = current?.rarity && rarityTone[current.rarity] ? current.rarity : "Common"
  const seasons = (current?.seasons ?? []) as PlantSeason[]

    return (
      <div className="max-w-5xl mx-auto mt-8 px-4 md:px-0 pb-16">
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative overflow-hidden rounded-[32px] border border-stone-200 dark:border-[#3e3e42] bg-gradient-to-br from-white via-emerald-50/60 to-stone-100 dark:from-[#1e1e1e] dark:via-[#252526] dark:to-[#171717] shadow-[0_30px_80px_-40px_rgba(16,185,129,0.45)]"
        >
          <div className="absolute inset-x-12 -top-24 h-56 rounded-full bg-emerald-200/40 dark:bg-emerald-500/10 blur-3xl" aria-hidden="true" />
          <div className="absolute inset-x-0 bottom-[-40%] h-72 rounded-full bg-emerald-100/50 dark:bg-emerald-500/10 blur-3xl" aria-hidden="true" />
          <div className="relative p-6 md:p-12 space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Badge className="rounded-2xl px-4 py-1 bg-white/80 dark:bg-[#252526]/80 backdrop-blur">
                {statusLabel}
              </Badge>
              <Badge variant="outline" className="rounded-2xl border-dashed">
                <Wand2 className="h-4 w-4 mr-1" />
                {t("common.discovery")}
              </Badge>
            </div>

            <div className="relative mx-auto w-full max-w-3xl" style={{ height: cardHeight }}>
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
                    className="absolute inset-0 cursor-grab active:cursor-grabbing select-none"
                  >
                    <Card className="h-full rounded-[28px] border border-white/60 dark:border-white/10 bg-white/85 dark:bg-[#111111]/85 backdrop-blur shadow-2xl">
                      <div className="relative h-2/3 rounded-t-[28px] overflow-hidden">
                        {current.image ? (
                          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${current.image})` }} />
                        ) : (
                          <div className="absolute inset-0 bg-gradient-to-br from-emerald-200 via-emerald-100 to-white" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
                        <div className="absolute top-4 left-4 z-20">
                          {position && (
                            <Badge className="rounded-2xl px-3 py-1 bg-black/60 text-white backdrop-blur">
                              <PartyPopper className="h-4 w-4 mr-1" />
                              {t("discoveryPage.status.position", { current: position, total })}
                            </Badge>
                          )}
                        </div>
                        <div className="absolute top-4 right-4 z-20">
                          <button
                            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                              e.stopPropagation()
                              onToggleLike && onToggleLike()
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
                        <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
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
                        </div>
                      </div>

                      <CardContent className="h-1/3 p-6 flex flex-col gap-4">
                        {current.description && (
                          <p className="text-sm text-stone-600 dark:text-stone-300 line-clamp-3">{current.description}</p>
                        )}

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-2xl border border-emerald-100/70 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-900/10 p-4 backdrop-blur-sm">
                            <div className="mb-1 text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300 font-semibold">
                              {t("discoveryPage.infoCard.meaningLabel")}
                            </div>
                            <p className="text-sm text-emerald-900 dark:text-emerald-100">
                              {meaning || t("discoveryPage.infoCard.meaningFallback")}
                            </p>
                          </div>

                          <div className="rounded-2xl border border-stone-200/80 dark:border-[#3e3e42]/60 bg-white/70 dark:bg-[#1f1f1f]/60 p-4 backdrop-blur-sm space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-xs uppercase tracking-wide opacity-70">{t("discoveryPage.infoCard.colorsLabel")}</span>
                              <Badge
                                className={`rounded-full text-[11px] font-medium border-none px-3 py-1 ${
                                  current?.seedsAvailable
                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200"
                                    : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200"
                                }`}
                              >
                                {seedsCopy}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {colorChips.length > 0 ? (
                                colorChips.map((color) => {
                                  const key = color.toLowerCase().split(/[\s-]/)[0]
                                  const swatch = colorTokenMap[key] ?? "#a8a29e"
                                  return (
                                    <span
                                      key={color}
                                      className="flex items-center gap-2 rounded-full border border-white/60 dark:border-white/10 bg-white/80 dark:bg-[#111111]/80 px-3 py-1 text-xs font-medium text-stone-700 dark:text-stone-100 shadow-sm"
                                    >
                                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: swatch }} />
                                      {color}
                                    </span>
                                  )
                                })
                              ) : (
                                <span className="text-xs text-stone-500 dark:text-stone-400">{t("plant.none")}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
                          <Button
                            variant="outline"
                            className="rounded-2xl flex-1 min-w-[120px]"
                            onClick={(e) => {
                              e.stopPropagation()
                              handlePrevious()
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                          >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            {t("plant.back")}
                          </Button>
                          <Button
                            className="rounded-2xl flex-1 min-w-[120px]"
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
                            variant="outline"
                            className="rounded-2xl flex-1 min-w-[120px]"
                            onClick={(e) => {
                              e.stopPropagation()
                              handlePass()
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                          >
                            {t("plant.next")}
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <EmptyState onReset={() => setIndex(0)} />
                  </div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
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
