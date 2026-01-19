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

// Double-tap heart animation component
interface DoubleTapHeartProps {
  x: number
  y: number
  onComplete: () => void
}

const DoubleTapHeart: React.FC<DoubleTapHeartProps> = ({ x, y, onComplete }) => {
  return (
    <motion.div
      className="pointer-events-none fixed z-[100]"
      style={{
        left: x,
        top: y,
        transform: 'translate(-50%, -50%)',
      }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ 
        scale: [0, 1.2, 1],
        opacity: [0, 1, 1, 0],
      }}
      transition={{ 
        duration: 0.8,
        times: [0, 0.3, 0.5, 1],
        ease: "easeOut"
      }}
      onAnimationComplete={onComplete}
    >
      <Heart 
        className="h-24 w-24 text-rose-500 drop-shadow-lg" 
        fill="currentColor"
        strokeWidth={1.5}
      />
    </motion.div>
  )
}
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Plant, PlantSeason } from "@/types/plant"
import { rarityTone, seasonBadge } from "@/constants/badges"
import { useTranslation } from "react-i18next"
import type { TFunction } from "i18next"
import { Link } from "@/components/i18n/Link"
import { isNewPlant, isPlantOfTheMonth, isPopularPlant } from "@/lib/plantHighlights"
import { getDiscoveryPageImageUrl } from "@/lib/photos"
import { cn, deriveWaterLevelFromFrequency } from "@/lib/utils"
import { resolveColorValue, DEFAULT_PLANT_COLOR } from "@/lib/colors"
import { usePageMetadata } from "@/hooks/usePageMetadata"

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
  boostImagePriority?: boolean
}

export const SwipePage: React.FC<SwipePageProps> = ({
  current,
  index: _index,
  setIndex,
  x,
  y,
  onDragEnd,
  handleInfo,
  handlePass,
  handlePrevious,
  liked = false,
  onToggleLike,
  boostImagePriority = false,
}) => {
  void _index // Prop kept for interface compatibility
      const { t } = useTranslation("common")
    const seoTitle = t("seo.home.title", { defaultValue: "Aphylia" })
      const seoDescription = t("seo.home.description", {
        defaultValue: "Swipe through curated species, unlock their lore, and save favorites in Aphylia's living encyclopedia.",
      })
      usePageMetadata({ title: seoTitle, description: seoDescription })
    const [isDesktop, setIsDesktop] = React.useState(() => (typeof window !== "undefined" ? window.innerWidth >= 768 : false))
    
    // Double-tap detection state (for mobile touch events)
    const lastTapRef = React.useRef<{ time: number; x: number; y: number } | null>(null)
    const [heartAnimations, setHeartAnimations] = React.useState<Array<{ id: string; x: number; y: number }>>([])

    
    // Double-tap threshold in milliseconds
    const DOUBLE_TAP_THRESHOLD = 300
    const DOUBLE_TAP_DISTANCE_THRESHOLD = 50 // Max distance between taps in pixels
    
    // Trigger heart animation and like action
    const triggerDoubleTapLike = React.useCallback((clientX: number, clientY: number) => {
      // Add heart animation at tap position
      const animationId = `heart-${Date.now()}`
      setHeartAnimations(prev => [...prev, { id: animationId, x: clientX, y: clientY }])
      
      // Only like if not already liked (double-tap doesn't unlike)
      if (!liked && onToggleLike) {
        onToggleLike()
      }
    }, [liked, onToggleLike])
    
    // Handle mobile double-tap detection
    const handleMobileDoubleTap = React.useCallback((clientX: number, clientY: number) => {
      const now = Date.now()
      const lastTap = lastTapRef.current
      
      if (lastTap) {
        const timeDiff = now - lastTap.time
        const distance = Math.sqrt(
          Math.pow(clientX - lastTap.x, 2) + Math.pow(clientY - lastTap.y, 2)
        )
        
        // Check if it's a valid double-tap (within time and distance threshold)
        if (timeDiff < DOUBLE_TAP_THRESHOLD && distance < DOUBLE_TAP_DISTANCE_THRESHOLD) {
          // Clear the last tap to prevent triple-tap triggering
          lastTapRef.current = null
          triggerDoubleTapLike(clientX, clientY)
          return true // Double-tap detected
        }
      }
      
      // Store this tap for potential double-tap detection
      lastTapRef.current = { time: now, x: clientX, y: clientY }
      return false // Not a double-tap
    }, [triggerDoubleTapLike])
    
    // Handle desktop double-click (native event)
    const handleDesktopDoubleClick = React.useCallback((e: React.MouseEvent) => {
      // Don't trigger on button clicks
      if ((e.target as HTMLElement).closest('button')) {
        return
      }
      triggerDoubleTapLike(e.clientX, e.clientY)
    }, [triggerDoubleTapLike])
    
    // Remove completed heart animations
    const removeHeartAnimation = React.useCallback((id: string) => {
      setHeartAnimations(prev => prev.filter(anim => anim.id !== id))
    }, [])
    
    // Clear heart animations when plant changes
    React.useEffect(() => {
      setHeartAnimations([])
      lastTapRef.current = null
    }, [current?.id])
    
    // Touch tracking for swipe-up gesture on mobile (to open info)
    const touchStartRef = React.useRef<{ x: number; y: number; time: number } | null>(null)
    
    const handleTouchStart = React.useCallback((e: React.TouchEvent) => {
      if (e.touches.length === 1) {
        touchStartRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          time: Date.now()
        }
      }
    }, [])
    
    const handleTouchEnd = React.useCallback((e: React.TouchEvent) => {
      if (!touchStartRef.current || e.changedTouches.length !== 1) {
        touchStartRef.current = null
        return
      }
      
      const touch = e.changedTouches[0]
      const deltaX = touch.clientX - touchStartRef.current.x
      const deltaY = touch.clientY - touchStartRef.current.y
      const deltaTime = Date.now() - touchStartRef.current.time
      
      // Check if this is a tap (minimal movement) vs a swipe
      const isTap = Math.abs(deltaX) < 15 && Math.abs(deltaY) < 15 && deltaTime < 300
      
      if (isTap) {
        // Don't trigger double-tap on button clicks
        if (!(e.target as HTMLElement).closest('button')) {
          // Check for double-tap
          handleMobileDoubleTap(touch.clientX, touch.clientY)
        }
        touchStartRef.current = null
        return
      }
      
      // Swipe up detection: significant upward movement, more vertical than horizontal, quick gesture
      const isSwipeUp = deltaY < -80 && Math.abs(deltaY) > Math.abs(deltaX) * 1.5 && deltaTime < 500
      
      if (isSwipeUp) {
        handleInfo()
      }
      
      touchStartRef.current = null
    }, [handleInfo, handleMobileDoubleTap])

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
          handlePrevious()
          break
        case "ArrowRight":
          e.preventDefault()
          handlePass()
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
  const prefersCoarsePointer = usePrefersCoarsePointer()

  const rarityKey = current?.rarity && rarityTone[current.rarity] ? current.rarity : "Common"
  const seasons = (current?.seasons ?? []) as PlantSeason[]
  const displayImage = React.useMemo(() => getDiscoveryPageImageUrl(current), [current])
  const shouldPrioritizeImage = Boolean(boostImagePriority && displayImage)
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

    // Card content component to avoid duplication
    const cardContent = current ? (
      <Card className="relative h-full w-full overflow-hidden bg-black text-white shadow-2xl rounded-[24px] border border-white/20 dark:border-white/10">
        {displayImage ? (
          <img
            src={displayImage}
            alt={current?.name ? `${current.name} preview` : 'Plant preview'}
            className="absolute inset-0 z-0 h-full w-full object-cover"
            loading={shouldPrioritizeImage ? 'eager' : 'lazy'}
            fetchPriority={shouldPrioritizeImage ? 'high' : 'auto'}
            decoding="async"
            width={960}
            height={1280}
            sizes="(max-width: 768px) 100vw, 70vw"
          />
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
        <div className="absolute top-4 right-4 z-30">
          <button
            type="button"
            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
              e.stopPropagation()
              e.preventDefault()
              if (onToggleLike) {
                onToggleLike()
              }
            }}
            onPointerDown={(e) => {
              e.stopPropagation()
            }}
            onPointerUp={(e) => {
              e.stopPropagation()
            }}
            onTouchStart={(e) => {
              e.stopPropagation()
            }}
            onTouchEnd={(e) => {
              e.stopPropagation()
            }}
            onMouseDown={(e) => {
              e.stopPropagation()
            }}
            aria-pressed={liked}
            aria-label={liked ? "Unlike" : "Like"}
            className={`h-10 w-10 rounded-full flex items-center justify-center shadow border transition pointer-events-auto ${
              liked ? "bg-rose-600 text-white border-rose-500" : "bg-white/90 text-black hover:bg-white"
            }`}
            style={{ touchAction: 'manipulation' }}
          >
            <Heart className={`h-5 w-5 ${liked ? "fill-current" : ""}`} />
          </button>
        </div>
        {current && (
          <PlantMetaRail
            plant={current}
            variant="sidebar"
            disableHoverActivation={prefersCoarsePointer}
          />
        )}
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
          <div className="mt-5 grid w-full gap-2 grid-cols-3 pointer-events-auto" style={{ touchAction: 'manipulation' }}>
            <Button
              className="rounded-2xl w-full text-white transition-colors bg-black/80 hover:bg-black"
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                handlePrevious()
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
              aria-label={t("plant.back")}
              title={`${t("plant.back")} (Left Arrow)`}
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
                e.preventDefault()
                handleInfo()
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
            >
              {t("plant.info")}
              <ChevronUp className="h-4 w-4 ml-1" />
            </Button>
            <Button
              className="rounded-2xl w-full text-white transition-colors bg-black/80 hover:bg-black"
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                handlePass()
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
              aria-label={t("plant.next")}
              title={`${t("plant.next")} (Right Arrow)`}
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
    ) : null

    // ==================== MOBILE LAYOUT ====================
    if (!isDesktop) {
      return (
        <div 
          className="relative w-full swipe-card-container px-2"
          style={{ 
            height: 'calc(100dvh - 120px)',
            minHeight: '450px',
            marginBottom: '8px',
          }}
        >
          <AnimatePresence initial={false} mode="sync">
            {current ? (
              <motion.div
                key={current.id}
                drag="x"
                dragElastic={0.25}
                dragMomentum={false}
                style={{ x }}
                dragConstraints={{ left: -250, right: 250 }}
                onDragEnd={onDragEnd}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                initial={false}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0 }}
                className="absolute inset-0 cursor-grab active:cursor-grabbing select-none"
                layout={false}
              >
                {cardContent}
              </motion.div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-stone-100 dark:bg-[#1e1e1e] rounded-[24px]">
                <EmptyState onReset={() => setIndex(0)} />
              </div>
            )}
          </AnimatePresence>
          
          {/* Double-tap heart animations */}
          <AnimatePresence>
            {heartAnimations.map(anim => (
              <DoubleTapHeart
                key={anim.id}
                x={anim.x}
                y={anim.y}
                onComplete={() => removeHeartAnimation(anim.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      )
    }

    // ==================== DESKTOP LAYOUT ====================
    return (
      <div
        className="max-w-5xl mx-auto mt-6 px-4 md:px-0 pb-16"
      >
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative overflow-hidden rounded-[32px] border border-stone-200 dark:border-[#3e3e42] bg-gradient-to-br from-white via-emerald-50/60 to-stone-100 dark:from-[#1e1e1e] dark:via-[#252526] dark:to-[#171717] shadow-[0_30px_80px_-40px_rgba(16,185,129,0.45)]"
        >
          <div className="pointer-events-none absolute inset-x-12 -top-24 h-56 rounded-full bg-emerald-200/40 dark:bg-emerald-500/10 blur-3xl" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-x-0 bottom-[-40%] h-72 rounded-full bg-emerald-100/50 dark:bg-emerald-500/10 blur-3xl" aria-hidden="true" />
          <div className="relative p-6 md:p-12 space-y-6">
            <div
              className="relative mx-auto w-full max-w-3xl min-h-[520px] swipe-card-container"
              style={{ height: desktopCardHeight }}
            >
              <AnimatePresence initial={false} mode="sync">
                {current ? (
                  <motion.div
                    key={current.id}
                    drag
                    dragElastic={{ left: 0.28, right: 0.28, top: 0.18, bottom: 0.08 }}
                    dragMomentum={false}
                    style={{ x, y }}
                    dragConstraints={{ left: -500, right: 500, top: -280, bottom: 0 }}
                    onDragEnd={onDragEnd}
                    onDoubleClick={handleDesktopDoubleClick}
                    initial={false}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.05 }}
                    className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing select-none"
                    layout={false}
                  >
                    {cardContent}
                  </motion.div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <EmptyState onReset={() => setIndex(0)} />
                  </div>
                )}
              </AnimatePresence>
              
              {/* Double-tap heart animations */}
              <AnimatePresence>
                {heartAnimations.map(anim => (
                  <DoubleTapHeart
                    key={anim.id}
                    x={anim.x}
                    y={anim.y}
                    onComplete={() => removeHeartAnimation(anim.id)}
                  />
                ))}
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

const useSupportsHover = () => {
  const [supportsHover, setSupportsHover] = React.useState<boolean>(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return true
    }
    return window.matchMedia("(hover: hover) and (pointer: fine)").matches
  })

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return
    }

    const mediaQuery = window.matchMedia("(hover: hover) and (pointer: fine)")
    const handleChange = (event: MediaQueryListEvent) => {
      setSupportsHover(event.matches)
    }

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange)
    } else if (typeof mediaQuery.addListener === "function") {
      mediaQuery.addListener(handleChange)
    }

    return () => {
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", handleChange)
      } else if (typeof mediaQuery.removeListener === "function") {
        mediaQuery.removeListener(handleChange)
      }
    }
  }, [])

  return supportsHover
}

const usePrefersCoarsePointer = () => {
  const [isCoarse, setIsCoarse] = React.useState<boolean>(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false
    }
    return window.matchMedia("(pointer: coarse)").matches
  })

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined
    }

    const mediaQuery = window.matchMedia("(pointer: coarse)")
    const handleChange = (event: MediaQueryListEvent) => {
      setIsCoarse(event.matches)
    }

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange)
    } else if (typeof mediaQuery.addListener === "function") {
      mediaQuery.addListener(handleChange)
    }

    return () => {
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", handleChange)
      } else if (typeof mediaQuery.removeListener === "function") {
        mediaQuery.removeListener(handleChange)
      }
    }
  }, [])

  return isCoarse
}

const PlantMetaRail: React.FC<{
  plant: Plant
  variant: "sidebar" | "inline"
  disableHoverActivation?: boolean
}> = ({ plant, variant, disableHoverActivation = false }) => {
  const { t } = useTranslation("common")
  const [activeKey, setActiveKey] = React.useState<string | null>(null)
  const items = React.useMemo(() => buildIndicatorItems(plant, t), [plant, t])
  const supportsHover = useSupportsHover()

  React.useEffect(() => {
    setActiveKey(null)
  }, [plant.id, variant])

  if (!items.length) return null

  if (variant === "inline") {
    return (
      <div className="flex flex-col items-end gap-2">
        {items.map((item) => (
          <IndicatorPill
            key={item.key}
            item={item}
            active={activeKey === item.key}
            onActivate={() => setActiveKey(item.key)}
            onDeactivate={() => setActiveKey((prev) => (prev === item.key ? null : prev))}
            supportsHover={supportsHover}
            variant="inline"
            disableHoverActivation={disableHoverActivation}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="absolute inset-y-6 right-3 z-30 flex flex-col items-end justify-center gap-3 md:gap-4">
      {items.map((item) => (
        <IndicatorPill
          key={item.key}
          item={item}
          active={activeKey === item.key}
          onActivate={() => setActiveKey(item.key)}
          onDeactivate={() => setActiveKey((prev) => (prev === item.key ? null : prev))}
          supportsHover={supportsHover}
          variant="sidebar"
          disableHoverActivation={disableHoverActivation}
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
  supportsHover: boolean
  variant: "sidebar" | "inline"
  disableHoverActivation?: boolean
}

const IndicatorPill: React.FC<IndicatorPillProps> = ({
  item,
  active,
  onActivate,
  onDeactivate,
  supportsHover,
  variant,
  disableHoverActivation = false,
}) => {
  const isColorVariant = item.variant === "color" && (item.colors?.length ?? 0) > 0
  const ariaLabel = `${item.description ?? ""}${item.description ? ": " : ""}${item.ariaValue ?? item.label}`.trim()
  const isSidebarVariant = variant === "sidebar"
  const allowHover = supportsHover && !disableHoverActivation
  const keyboardFocusRef = React.useRef(false)

  const handleFocus = React.useCallback(
    (event: React.FocusEvent<HTMLButtonElement>) => {
      if (disableHoverActivation) {
        let isKeyboardFocus = true
        if (typeof event.currentTarget.matches === "function") {
          try {
            isKeyboardFocus = event.currentTarget.matches(":focus-visible")
          } catch {
            isKeyboardFocus = true
          }
        }
        keyboardFocusRef.current = isKeyboardFocus
        if (!isKeyboardFocus) return
      }
      onActivate()
    },
    [disableHoverActivation, onActivate],
  )

  const handleBlur = React.useCallback(() => {
      if (disableHoverActivation) {
        if (!keyboardFocusRef.current) {
          return
        }
      }
      keyboardFocusRef.current = false
      onDeactivate()
    },
    [disableHoverActivation, onDeactivate],
  )

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    if (active) {
      onDeactivate()
    } else {
      onActivate()
    }
  }

  const detailBaseClass = cn(
    "rounded-2xl border border-white/15 bg-black/70 px-3 py-2 text-left shadow-xl backdrop-blur-md",
    isSidebarVariant ? "mr-3" : "mr-2",
  )

  const detailWidthClass = isSidebarVariant
    ? isColorVariant
      ? "max-w-[240px]"
      : "max-w-[220px]"
    : "max-w-[min(260px,calc(100vw-5rem))]"

  const detailMotionProps = { initial: { opacity: 0, x: 16 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: 16 } }

  return (
    <div className={cn("pointer-events-auto", !isSidebarVariant && "basis-auto")}>
      <button
        type="button"
        aria-label={ariaLabel || undefined}
        aria-expanded={active}
        aria-pressed={active}
        onMouseEnter={allowHover ? onActivate : undefined}
        onMouseLeave={allowHover ? onDeactivate : undefined}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onClick={handleClick}
        onPointerDown={(event) => event.stopPropagation()}
        className={cn(
          "group relative flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white/80 focus-visible:ring-offset-transparent",
          !isSidebarVariant && "justify-end",
        )}
      >
        <AnimatePresence>
          {active && (
            <motion.div className={cn(detailBaseClass, detailWidthClass)} {...detailMotionProps}>
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
  const sunSource = (plant.environment?.sunExposure || plant.care?.sunlight || plant.plantCare?.sunlight) ?? undefined
  const sunLevel = resolveSunLevel(typeof sunSource === 'string' ? sunSource : undefined)
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
  const derivedWater = (deriveWaterLevelFromFrequency(freqPeriod, freqAmount) || plant.care?.water || plant.plantCare?.water) ?? undefined
  const waterLevel = resolveWaterLevel(typeof derivedWater === 'string' ? derivedWater : undefined)
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

  // Check utility field for usage indicators - normalize to lowercase for comparison
  const utilityArray = (plant.utility ?? [])
    .map((util) => String(util))
    .filter((util) => util.trim().length > 0)
  const utilitySet = new Set(utilityArray.map((util) => util.toLowerCase().trim()))
  
  // Edible: Only show if utility explicitly has "comestible"
  // The utility field is the source of truth - comestiblePart is just data, not a display indicator
  if (utilitySet.has("comestible")) {
    items.push({
      key: "edible",
      label: t("discoveryPage.indicators.edible", { defaultValue: "Edible" }),
      description: t("discoveryPage.indicators.edible", { defaultValue: "Edible" }),
      icon: <Utensils className="h-5 w-5" />,
      accentClass: "text-orange-100",
    })
  }

  // Medicinal: Only show if utility explicitly has "medicinal" OR adviceMedicinal has meaningful content
  const hasMedicinalAdvice = plant.usage?.adviceMedicinal && 
    typeof plant.usage.adviceMedicinal === "string" && 
    plant.usage.adviceMedicinal.trim().length > 0
  if (utilitySet.has("medicinal") || hasMedicinalAdvice) {
    items.push({
      key: "medicinal",
      label: t("discoveryPage.indicators.medicinal", { defaultValue: "Medicinal" }),
      description: t("discoveryPage.indicators.medicinal", { defaultValue: "Medicinal" }),
      icon: <HeartPulse className="h-5 w-5" />,
      accentClass: "text-rose-100",
    })
  }

  // Aromatic: Only show if utility explicitly has "aromatic" OR aromatherapy is true OR scent is true
  const hasAromatherapy = plant.usage?.aromatherapy === true
  const hasScent = plant.identity?.scent === true
  if (utilitySet.has("aromatic") || hasAromatherapy || hasScent) {
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
      return <BrightnessHighIcon />
    case "low":
      return <BrightnessLowIcon />
    default:
      return <BrightnessMediumIcon />
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

const normalizeDescriptor = (value?: string | null): string => {
  if (!value) return ""
  return value
    .toString()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_/+-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

const includesAny = (value: string, tokens: string[]) => tokens.some((token) => value.includes(token))

// ⚡ Performance: Hoisted constants to avoid allocation on every function call
const SUN_HIGH_TOKENS = ["full sun", "direct sun", "bright light", "very bright", "brightness 7", "plein soleil"]
const SUN_MEDIUM_TOKENS = ["partial sun", "partial shade", "filtered sun", "indirect light", "medium light", "brightness medium"]
const SUN_LOW_TOKENS = ["full shade", "shade only", "no sun", "no sunlight", "low light", "brightness empty", "no sun necessary", "shade tolerant"]

const resolveSunLevel = (value?: string | null): IndicatorLevel | null => {
  const normalized = normalizeDescriptor(value)
  if (!normalized) return null

  if (includesAny(normalized, SUN_HIGH_TOKENS)) return "high"
  if (includesAny(normalized, SUN_MEDIUM_TOKENS)) return "medium"
  if (includesAny(normalized, SUN_LOW_TOKENS)) return "low"

  if (normalized.includes("partial shade")) return "medium"
  if (normalized.includes("partial")) return "medium"
  if (normalized.includes("shade")) return normalized.includes("partial") ? "medium" : "low"
  if (normalized.includes("sun")) return normalized.includes("partial") ? "medium" : "high"
  if (normalized.includes("high") || normalized.includes("bright")) return "high"
  if (normalized.includes("medium") || normalized.includes("moderate") || normalized.includes("indirect")) return "medium"
  if (normalized.includes("low") || normalized.includes("dark")) return "low"

  return null
}

// ⚡ Performance: Hoisted constants to avoid allocation on every function call
const WATER_HIGH_TOKENS = ["keep moist", "moist soil", "soak", "wet", "daily", "frequent", "humidity high", "high humidity", "high water", "constant moisture", "plenty of water"]
const WATER_MEDIUM_TOKENS = ["medium", "moderate", "balanced", "weekly", "every few days", "humidity mid", "average", "regular", "even moisture"]
const WATER_LOW_TOKENS = ["low", "dry", "drought", "sparingly", "infrequent", "monthly", "humidity low", "succulent", "well-drained", "allow soil to dry"]

const resolveWaterLevel = (value?: string | null): IndicatorLevel | null => {
  const normalized = normalizeDescriptor(value)
  if (!normalized) return null

  if (includesAny(normalized, WATER_HIGH_TOKENS) || normalized === "high") return "high"
  if (includesAny(normalized, WATER_MEDIUM_TOKENS) || normalized === "medium") return "medium"
  if (includesAny(normalized, WATER_LOW_TOKENS) || normalized === "low") return "low"

  if (normalized.includes("frequent") || normalized.includes("often")) return "high"
  if (normalized.includes("weekly") || normalized.includes("regular") || normalized.includes("average")) return "medium"
  if (normalized.includes("rarely") || normalized.includes("seldom") || normalized.includes("little")) return "low"

  return null
}

const BrightnessHighIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.7}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="4.5" />
    <line x1="12" y1="1.5" x2="12" y2="4" />
    <line x1="12" y1="20" x2="12" y2="22.5" />
    <line x1="1.5" y1="12" x2="4" y2="12" />
    <line x1="20" y1="12" x2="22.5" y2="12" />
    <line x1="4.6" y1="4.6" x2="6.8" y2="6.8" />
    <line x1="17.2" y1="17.2" x2="19.4" y2="19.4" />
    <line x1="4.6" y1="19.4" x2="6.8" y2="17.2" />
    <line x1="17.2" y1="6.8" x2="19.4" y2="4.6" />
  </svg>
)

const BrightnessMediumIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.7}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="4.5" />
    <line x1="12" y1="2" x2="12" y2="5" />
    <line x1="12" y1="19" x2="12" y2="22" />
    <line x1="2" y1="12" x2="5" y2="12" />
    <line x1="19" y1="12" x2="22" y2="12" />
  </svg>
)

const BrightnessLowIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.7}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="5" strokeDasharray="2.5 3" />
    <circle cx="12" cy="12" r="2" fill="currentColor" opacity={0.35} />
  </svg>
)

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
  // Primary source: plant.identity?.colors (array of PlantColor objects)
  const identityColors: string[] = []
  if (plant.identity?.colors && Array.isArray(plant.identity.colors)) {
    plant.identity.colors.forEach((color) => {
      if (!color || typeof color !== "object") return
      
      // Handle PlantColor object with name and hexCode
      const plantColor = color as { name?: string; hexCode?: string }
      if (plantColor.hexCode && typeof plantColor.hexCode === "string" && plantColor.hexCode.trim().length > 0) {
        identityColors.push(plantColor.hexCode.trim())
      } else if (plantColor.name && typeof plantColor.name === "string" && plantColor.name.trim().length > 0) {
        identityColors.push(plantColor.name.trim())
      }
    })
  }

  // Secondary source: plant.colors (legacy array of strings)
  const legacyColors: string[] = []
  if (Array.isArray(plant.colors)) {
    plant.colors.forEach((color) => {
      if (typeof color === "string" && color.trim().length > 0) {
        legacyColors.push(color.trim())
      }
    })
  }

  // Tertiary source: phenology colors (fallback)
  const fallbackColors: string[] = []
  if (identityColors.length === 0 && legacyColors.length === 0) {
    plant.phenology?.flowerColors?.forEach((color) => {
      if (color?.hex && typeof color.hex === "string" && color.hex.trim().length > 0) {
        fallbackColors.push(color.hex.trim())
      } else if (color?.name && typeof color.name === "string" && color.name.trim().length > 0) {
        fallbackColors.push(color.name.trim())
      }
    })
    plant.phenology?.leafColors?.forEach((color) => {
      if (color?.hex && typeof color.hex === "string" && color.hex.trim().length > 0) {
        fallbackColors.push(color.hex.trim())
      } else if (color?.name && typeof color.name === "string" && color.name.trim().length > 0) {
        fallbackColors.push(color.name.trim())
      }
    })
  }

  // Use identity colors first, then legacy colors, then fallback
  const palette = identityColors.length > 0 ? identityColors : (legacyColors.length > 0 ? legacyColors : fallbackColors)

  return palette
    .map((color, index) => {
      const resolvedTone = resolveColorValue(color)
      const label = formatIndicatorValue(color)
      return {
        id: `${color}-${index}`,
        label: label || resolvedTone,
        tone: resolvedTone,
      }
    })
    .filter((entry) => entry.tone && entry.tone.length > 0)
}
