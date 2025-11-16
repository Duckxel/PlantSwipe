import React from "react"
import { motion, AnimatePresence, type MotionValue } from "framer-motion"
import { ChevronLeft, ChevronRight, ChevronUp, Heart, Sparkles, PartyPopper, Palette, Flame } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Plant, PlantSeason } from "@/types/plant"
import { rarityTone, seasonBadge } from "@/constants/badges"
import { useTranslation } from "react-i18next"
import { Link } from "@/components/i18n/Link"
import { isNewPlant, isPlantOfTheMonth, isPopularPlant } from "@/lib/plantHighlights"

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

  const rarityKey = current?.rarity && rarityTone[current.rarity] ? current.rarity : "Common"
  const seasons = (current?.seasons ?? []) as PlantSeason[]
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
        className="max-w-5xl mx-auto mt-4 sm:mt-6 px-1 sm:px-4 md:px-0 pb-[140px] md:pb-16"
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
              className="relative mx-auto w-full max-w-none md:max-w-3xl min-h-[520px] md:min-h-0"
              style={isDesktop ? { height: desktopCardHeight } : { minHeight: "calc(100vh - 7rem)" }}
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
                      {current.image ? (
                        <div className="absolute inset-0 z-0 bg-cover bg-center" style={{ backgroundImage: `url(${current.image})` }} />
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
                      </div>
                    </Card>
                  </motion.div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <EmptyState onReset={() => setIndex(0)} />
                  </div>
                )}
              </AnimatePresence>
              {current && (
                <div
                  className="mt-4 grid w-full gap-2 pb-4 sm:grid-cols-3 sm:gap-3 sm:pb-0"
                  style={!isDesktop ? { paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" } : undefined}
                >
                  <Button variant="outline" className="rounded-2xl w-full" onClick={handlePrevious}>
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    {t("plant.back")}
                  </Button>
                  <Button className="rounded-2xl w-full" onClick={handleInfo}>
                    {t("plant.info")}
                    <ChevronUp className="h-4 w-4 ml-1" />
                  </Button>
                  <Button variant="outline" className="rounded-2xl w-full" onClick={handlePass}>
                    {t("plant.next")}
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
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
