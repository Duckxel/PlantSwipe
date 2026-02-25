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
  // Center the heart on the tap position using negative margin (more reliable than transform)
  const heartSize = 96 // 24 * 4 = 96px (h-24 w-24)
  return (
    <motion.div
      className="pointer-events-none fixed z-[100]"
      style={{
        left: x - heartSize / 2,
        top: y - heartSize / 2,
      }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ 
        scale: [0, 1.3, 1, 1.1, 1],
        opacity: [0, 1, 1, 1, 0],
      }}
      transition={{ 
        duration: 1.5,
        times: [0, 0.15, 0.3, 0.7, 1],
        ease: "easeOut"
      }}
      onAnimationComplete={onComplete}
    >
      <Heart 
        className="h-24 w-24 text-rose-500 drop-shadow-[0_0_20px_rgba(244,63,94,0.5)]" 
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
import { resolveColorValue } from "@/lib/colors"
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

export const SwipePage = React.memo<SwipePageProps>(({
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
    
    // Heart animation state
    const [heartAnimations, setHeartAnimations] = React.useState<Array<{ id: string; x: number; y: number }>>([])
    
    // Double-tap threshold in milliseconds
    const DOUBLE_TAP_THRESHOLD = 300
    const DOUBLE_TAP_DISTANCE_THRESHOLD = 50 // Max distance between taps in pixels
    
    // Double-tap detection for mobile - refs must be declared before callbacks that use them
    const lastTapTimeRef = React.useRef<number>(0)
    const lastTapPosRef = React.useRef<{ x: number; y: number } | null>(null)
    
    // CRITICAL: Track button interactions to prevent tap detection interference
    // This uses an explicit timestamp-until approach which is more reliable than cooldown duration
    const blockTapsUntilRef = React.useRef<number>(0)
    
    // How long to block ALL tap processing after any button interaction (in ms)
    // This must be longer than the time between button press and swipe start
    const TAP_BLOCK_DURATION = 600
    
    // Block all tap processing for the specified duration
    // Called when any button on the card is interacted with
    const blockTapProcessing = React.useCallback(() => {
      // Set the "block until" timestamp
      blockTapsUntilRef.current = Date.now() + TAP_BLOCK_DURATION
      // Also clear any stored tap data to prevent double-tap detection
      lastTapTimeRef.current = 0
      lastTapPosRef.current = null
    }, [])
    
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
    
    // Reset double-tap tracking when plant changes (but DON'T clear heart animations - let them complete)
    React.useEffect(() => {
      lastTapPosRef.current = null
      lastTapTimeRef.current = 0
    }, [current?.id])
    
    // Handle tap on the card area (for double-tap detection and heart spam)
    const handleCardTap = React.useCallback((e: React.MouseEvent | React.TouchEvent) => {
      const now = Date.now()
      
      // CRITICAL: First check if taps are blocked due to recent button interaction
      // This is the primary defense against button taps interfering with swipe gestures
      // Must be checked BEFORE any other logic, including target checks
      if (now < blockTapsUntilRef.current) {
        // Taps are currently blocked - don't process this tap at all
        // Also don't record it as a potential first tap
        return
      }
      
      // Secondary check: Don't trigger on button clicks (backup safety)
      // This uses the event target, but Framer Motion's onTap might not preserve the original target
      if ((e.target as HTMLElement).closest('button')) {
        return
      }
      
      // Get tap position
      let clientX: number, clientY: number
      if ('touches' in e) {
        // Touch event - use changedTouches for touchend
        const touch = e.changedTouches?.[0] || e.touches?.[0]
        if (!touch) return
        clientX = touch.clientX
        clientY = touch.clientY
      } else {
        // Mouse event
        clientX = e.clientX
        clientY = e.clientY
      }
      
      const timeSinceLastTap = now - lastTapTimeRef.current
      const lastPos = lastTapPosRef.current
      
      // Check if this is a rapid tap (within threshold of last tap)
      if (lastPos && timeSinceLastTap < DOUBLE_TAP_THRESHOLD) {
        const distance = Math.sqrt(
          Math.pow(clientX - lastPos.x, 2) + Math.pow(clientY - lastPos.y, 2)
        )
        
        if (distance < DOUBLE_TAP_DISTANCE_THRESHOLD) {
          // Rapid tap detected - spawn heart! (allows spam)
          triggerDoubleTapLike(clientX, clientY)
          // Keep tracking for more spam - don't reset, just update position
          lastTapTimeRef.current = now
          lastTapPosRef.current = { x: clientX, y: clientY }
          return
        }
      }
      
      // Store this tap for potential double-tap
      lastTapTimeRef.current = now
      lastTapPosRef.current = { x: clientX, y: clientY }
    }, [triggerDoubleTapLike, DOUBLE_TAP_THRESHOLD, DOUBLE_TAP_DISTANCE_THRESHOLD])

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
  const seasons = (current?.season ?? current?.seasons ?? []) as PlantSeason[]
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

    // Card content WITH interactive buttons (for desktop)
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
        {/* Like button - desktop */}
        <div className="absolute top-4 right-4 z-40">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              if (onToggleLike) onToggleLike()
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            aria-pressed={liked}
            aria-label={liked ? "Unlike" : "Like"}
            className={`h-12 w-12 rounded-full flex items-center justify-center shadow-lg border-2 transition-all duration-150 active:scale-90 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
              liked ? "bg-rose-600 text-white border-rose-500 hover:bg-rose-700" : "bg-white text-black border-white hover:bg-gray-100"
            }`}
          >
            <Heart className={`h-6 w-6 ${liked ? "fill-current" : ""}`} />
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
          {(current.scientificNameSpecies || current.scientificName) && <p className="opacity-90 text-sm italic">{current.scientificNameSpecies || current.scientificName}</p>}
          <div className="mt-5 grid w-full gap-2 grid-cols-3">
            <Button
              className="rounded-2xl w-full text-white transition-colors bg-black/80 hover:bg-black"
              onClick={() => handlePrevious()}
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
              onClick={() => handleInfo()}
            >
              {t("plant.info")}
              <ChevronUp className="h-4 w-4 ml-1" />
            </Button>
            <Button
              className="rounded-2xl w-full text-white transition-colors bg-black/80 hover:bg-black"
              onClick={() => handlePass()}
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
                drag
                dragElastic={{ left: 0.25, right: 0.25, top: 0.15, bottom: 0.05 }}
                dragMomentum={false}
                style={{ x, y }}
                dragConstraints={{ left: -250, right: 250, top: -200, bottom: 0 }}
                onDragEnd={onDragEnd}
                initial={false}
                animate={{ opacity: 1, x: 0, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0 }}
                className="absolute inset-0 cursor-grab active:cursor-grabbing select-none"
                layout={false}
                onTap={(e) => handleCardTap(e as unknown as React.MouseEvent)}
              >
                {/* Card content with buttons INSIDE so they move together */}
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
                  
                  {/* Like button - inside card so it moves with swipe */}
                  {/* Wrapper uses capture phase to stop pointer events BEFORE they reach drag system */}
                  <div 
                    className="absolute top-4 right-4 z-[100]"
                    onPointerDownCapture={(e) => {
                      e.stopPropagation()
                      blockTapProcessing()
                    }}
                    onPointerMoveCapture={(e) => e.stopPropagation()}
                    onPointerUpCapture={(e) => e.stopPropagation()}
                    onTouchStartCapture={(e) => {
                      e.stopPropagation()
                      blockTapProcessing()
                    }}
                    onTouchMoveCapture={(e) => e.stopPropagation()}
                    onTouchEndCapture={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        blockTapProcessing()
                        if (onToggleLike) onToggleLike()
                      }}
                      aria-pressed={liked}
                      aria-label={liked ? "Unlike" : "Like"}
                      className={`h-14 w-14 rounded-full flex items-center justify-center shadow-lg border-2 transition-all duration-150 active:scale-90 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${
                        liked ? "bg-rose-600 text-white border-rose-500" : "bg-white text-black border-white"
                      }`}
                      style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                    >
                      <Heart className={`h-7 w-7 ${liked ? "fill-current" : ""}`} />
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
                    {(current.scientificNameSpecies || current.scientificName) && <p className="opacity-90 text-sm italic">{current.scientificNameSpecies || current.scientificName}</p>}
                    
                    {/* Navigation buttons - inside card so they move with swipe */}
                    {/* Wrapper uses capture phase to stop pointer events BEFORE they reach drag system */}
                    <div 
                      className="mt-5 grid w-full gap-2 grid-cols-3"
                      onPointerDownCapture={(e) => {
                        e.stopPropagation()
                        blockTapProcessing()
                      }}
                      onPointerMoveCapture={(e) => e.stopPropagation()}
                      onPointerUpCapture={(e) => e.stopPropagation()}
                      onTouchStartCapture={(e) => {
                        e.stopPropagation()
                        blockTapProcessing()
                      }}
                      onTouchMoveCapture={(e) => e.stopPropagation()}
                      onTouchEndCapture={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="rounded-2xl h-11 text-white bg-black/90 active:scale-95 flex items-center justify-center shadow-lg border border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                        onClick={(e) => { e.stopPropagation(); handlePrevious() }}
                        aria-label={t("plant.back")}
                        title={t("plant.back")}
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        className="rounded-2xl h-11 bg-white text-black active:scale-95 flex items-center justify-center shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                        onClick={(e) => { e.stopPropagation(); handleInfo() }}
                      >
                        {t("plant.info")}
                        <ChevronUp className="h-4 w-4 ml-1" />
                      </button>
                      <button
                        type="button"
                        className="rounded-2xl h-11 text-white bg-black/90 active:scale-95 flex items-center justify-center shadow-lg border border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                        onClick={(e) => { e.stopPropagation(); handlePass() }}
                        aria-label={t("plant.next")}
                        title={t("plant.next")}
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </Card>
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
})

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

  return (
    <div className={cn("pointer-events-auto", !isSidebarVariant && "basis-auto")}>
      <button
        type="button"
        aria-label={ariaLabel || undefined}
        aria-expanded={active}
        aria-pressed={active}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onClick={handleClick}
        onPointerDown={(event) => event.stopPropagation()}
        className={cn(
          "group relative flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white/80 focus-visible:ring-offset-transparent",
          !isSidebarVariant && "justify-end",
        )}
      >
        {active && (
          <div className={cn(detailBaseClass, detailWidthClass, "pointer-events-none absolute right-full top-1/2 -translate-y-1/2")}>
            {isColorVariant ? (
              <div className="flex flex-wrap gap-1.5">
                {item.colors!.map((color) => (
                  <span key={color.id} className="relative flex h-4 w-4 items-center justify-center">
                    <span
                      className="h-4 w-4 rounded-full border border-white/30"
                      style={{ backgroundColor: color.tone }}
                      aria-hidden="true"
                    />
                    <span className="sr-only">{color.label}</span>
                  </span>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-0.5 text-white">
                <span className="text-xs font-semibold leading-tight">{item.label}</span>
                {item.detailList?.length ? (
                  <span className="text-[11px] text-white leading-tight">
                    {item.detailList.join(", ")}
                  </span>
                ) : null}
              </div>
            )}
          </div>
        )}
        <span
          onMouseEnter={allowHover ? onActivate : undefined}
          onMouseLeave={allowHover ? onDeactivate : undefined}
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-black/65 text-white shadow-lg ring-offset-1 ring-offset-transparent",
            item.accentClass,
            active ? "ring-2 ring-white/80" : "ring-0",
            isColorVariant && "p-0",
          )}
        >
          {isColorVariant && item.colors?.length ? (
            <MultiColorFlowerIcon colors={item.colors} size={20} />
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
  const sunArr = Array.isArray(plant.sunlight) ? plant.sunlight : []
  const sunSource = sunArr[0] ?? (plant.environment?.sunExposure as string) ?? undefined
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

  const freqAmountRaw = plant.wateringFrequencyWarm ?? plant.waterFreqAmount ?? plant.waterFreqValue
  const freqAmount = typeof freqAmountRaw === "number" ? freqAmountRaw : Number(freqAmountRaw || 0)
  const freqPeriod = (plant.waterFreqPeriod || plant.waterFreqUnit) as "day" | "week" | "month" | "year" | undefined
  const waterTypeArr = Array.isArray(plant.wateringType) ? plant.wateringType : []
  const derivedWater = (deriveWaterLevelFromFrequency(freqPeriod, freqAmount) || waterTypeArr[0]) ?? undefined
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

  const originArr = Array.isArray(plant.origin) ? plant.origin : []
  const nativeRange = (originArr.length > 0 ? originArr : (plant.ecology?.nativeRange as string[]) ?? [])
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

  const isPotFriendly = plant.dimensions?.containerFriendly || (Array.isArray(plant.landscaping) && plant.landscaping.includes('pot'))
  if (isPotFriendly) {
    items.push({
      key: "pottable",
      label: t("discoveryPage.indicators.potFriendly", { defaultValue: "Pot friendly" }),
      description: t("discoveryPage.indicators.potFriendly", { defaultValue: "Pot friendly" }),
      icon: <Flower2 className="h-5 w-5" />,
      accentClass: "text-emerald-100",
    })
  }

  const utilityArray = (plant.utility ?? [])
    .map((util) => String(util))
    .filter((util) => util.trim().length > 0)
  const utilitySet = new Set(utilityArray.map((util) => util.toLowerCase().trim()))
  
  if (utilitySet.has("comestible") || utilitySet.has("edible")) {
    items.push({
      key: "edible",
      label: t("discoveryPage.indicators.edible", { defaultValue: "Edible" }),
      description: t("discoveryPage.indicators.edible", { defaultValue: "Edible" }),
      icon: <Utensils className="h-5 w-5" />,
      accentClass: "text-orange-100",
    })
  }

  const hasMedicinalContent = (plant.medicinalBenefits || plant.medicinalUsage || plant.usage?.adviceMedicinal) &&
    typeof (plant.medicinalBenefits || plant.medicinalUsage || plant.usage?.adviceMedicinal) === "string"
  if (utilitySet.has("medicinal") || hasMedicinalContent) {
    items.push({
      key: "medicinal",
      label: t("discoveryPage.indicators.medicinal", { defaultValue: "Medicinal" }),
      description: t("discoveryPage.indicators.medicinal", { defaultValue: "Medicinal" }),
      icon: <HeartPulse className="h-5 w-5" />,
      accentClass: "text-rose-100",
    })
  }

  const hasAromatherapy = plant.aromatherapy === true || plant.usage?.aromatherapy === true
  const hasFragrance = plant.fragrance === true
  if (utilitySet.has("aromatic") || hasAromatherapy || hasFragrance) {
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

/**
 * Multi-color flower icon that displays up to 5 colors as overlapping petals
 * Each petal is a large circle positioned around a center point
 */
interface MultiColorFlowerIconProps {
  colors: ColorSwatchDescriptor[]
  size?: number
}

const MultiColorFlowerIcon: React.FC<MultiColorFlowerIconProps> = ({ colors, size = 20 }) => {
  const displayColors = colors.slice(0, 5)
  const count = displayColors.length
  
  // For a single color, just show a circle
  if (count === 1) {
    return (
      <span
        className="flex items-center justify-center rounded-full border border-white/35"
        style={{ 
          backgroundColor: displayColors[0].tone,
          width: size,
          height: size,
        }}
        aria-hidden="true"
      />
    )
  }
  
  // Large overlapping circles arranged like flower petals
  // No center - just petals overlapping
  const viewBox = 24
  const center = viewBox / 2
  const petalRadius = 8 // Bigger petals for better visibility
  const petalDistance = 4 // Distance from center to petal center
  
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${viewBox} ${viewBox}`}
      aria-hidden="true"
      className="drop-shadow-sm"
    >
      {/* Petals - large overlapping circles, no center */}
      {displayColors.map((color, index) => {
        // Calculate position for this petal
        // Start from top (-90 degrees) and distribute evenly
        const angle = -90 + (360 / count) * index
        const radians = (angle * Math.PI) / 180
        
        // Petal center position (offset from center)
        const petalCenterX = center + Math.cos(radians) * petalDistance
        const petalCenterY = center + Math.sin(radians) * petalDistance
        
        return (
          <circle
            key={color.id}
            cx={petalCenterX}
            cy={petalCenterY}
            r={petalRadius}
            fill={color.tone}
            stroke="rgba(255,255,255,0.5)"
            strokeWidth={0.5}
          />
        )
      })}
    </svg>
  )
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
