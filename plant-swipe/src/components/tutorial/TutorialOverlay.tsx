import React from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, X, Sparkles, Sprout, Heart, Info, BarChart3, Plus, ArrowDown, PartyPopper } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTutorial, type TutorialStepId } from '@/context/TutorialContext'
import { useLanguageNavigate } from '@/lib/i18nRouting'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

type Rect = { top: number; left: number; width: number; height: number }

const STEP_ICONS: Partial<Record<TutorialStepId, React.ReactNode>> = {
  welcome: <Sparkles className="h-7 w-7 text-emerald-500" />,
  discovery_swipe: <ArrowDown className="h-5 w-5 text-emerald-500" />,
  discovery_like: <Heart className="h-5 w-5 text-rose-500" />,
  discovery_info: <Info className="h-5 w-5 text-blue-500" />,
  nav_gardens: <Sprout className="h-5 w-5 text-emerald-500" />,
  gardens_create: <Plus className="h-5 w-5 text-emerald-500" />,
  gardens_overview: <Sprout className="h-5 w-5 text-emerald-500" />,
  gardens_plants: <Sprout className="h-5 w-5 text-emerald-500" />,
  gardens_analytics: <BarChart3 className="h-5 w-5 text-purple-500" />,
  tutorial_complete: <PartyPopper className="h-7 w-7 text-emerald-500" />,
}

// Mobile nav bar is ~60px + safe-area-inset-bottom
const MOBILE_NAV_HEIGHT = 72

function useTargetRect(selector: string | undefined, active: boolean): Rect | null {
  const [rect, setRect] = React.useState<Rect | null>(null)

  React.useEffect(() => {
    if (!active || !selector) {
      setRect(null)
      return
    }

    const measure = () => {
      const el = document.querySelector(selector)
      if (el) {
        const r = el.getBoundingClientRect()
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
      } else {
        setRect(null)
      }
    }

    // Initial + delayed measurement to let lazy elements render
    measure()
    const delay = setTimeout(measure, 350)

    const interval = setInterval(measure, 400)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)

    return () => {
      clearTimeout(delay)
      clearInterval(interval)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [selector, active])

  return rect
}

function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  )
  React.useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    setIsMobile(mq.matches)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isMobile
}

function SpotlightSvg({ rect, padding = 8 }: { rect: Rect; padding?: number }) {
  const [dims, setDims] = React.useState({ w: window.innerWidth, h: window.innerHeight })
  React.useEffect(() => {
    const update = () => setDims({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const x = rect.left - padding
  const y = rect.top - padding
  const w = rect.width + padding * 2
  const h = rect.height + padding * 2
  const r = Math.min(16, w / 2, h / 2)

  return (
    <svg
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 9998, width: '100vw', height: '100vh' }}
      viewBox={`0 0 ${dims.w} ${dims.h}`}
      preserveAspectRatio="none"
    >
      <defs>
        <mask id="tutorial-spotlight-mask">
          <rect width="100%" height="100%" fill="white" />
          <rect x={x} y={y} width={w} height={h} rx={r} ry={r} fill="black" />
        </mask>
      </defs>
      <rect
        width="100%"
        height="100%"
        fill="rgba(0,0,0,0.6)"
        mask="url(#tutorial-spotlight-mask)"
      />
    </svg>
  )
}

function ArrowPointer({ rect, placement }: { rect: Rect; placement: string }) {
  const style: React.CSSProperties = { position: 'fixed', zIndex: 9999 }

  if (placement === 'bottom') {
    style.left = rect.left + rect.width / 2 - 14
    style.top = rect.top + rect.height + 6
  } else if (placement === 'top') {
    style.left = rect.left + rect.width / 2 - 14
    style.top = rect.top - 34
  } else if (placement === 'left') {
    style.left = rect.left - 34
    style.top = rect.top + rect.height / 2 - 14
  } else {
    style.left = rect.left + rect.width + 6
    style.top = rect.top + rect.height / 2 - 14
  }

  const rotation = placement === 'bottom' ? 0 : placement === 'top' ? 180 : placement === 'left' ? 90 : 270

  return (
    <motion.div
      style={style}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{
        opacity: 1,
        scale: 1,
        y: placement === 'bottom' ? [0, 8, 0] : placement === 'top' ? [0, -8, 0] : 0,
        x: placement === 'left' ? [-8, 0, -8] : placement === 'right' ? [0, 8, 0] : 0,
      }}
      transition={{
        y: { repeat: Infinity, duration: 1, ease: 'easeInOut' },
        x: { repeat: Infinity, duration: 1, ease: 'easeInOut' },
      }}
      className="pointer-events-none"
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ transform: `rotate(${rotation}deg)` }}>
        <path d="M12 4L4 16h16L12 4z" fill="rgb(16 185 129)" stroke="white" strokeWidth="1" />
      </svg>
    </motion.div>
  )
}

/**
 * On mobile, if a targeted step's tooltip can't fit below the highlighted element
 * (e.g. the element is mid-screen and the tooltip + mobile nav would clip),
 * we render the tooltip as a bottom sheet-style card anchored above the nav bar.
 */
function TooltipCard({
  rect,
  placement,
  stepId,
  stepIndex,
  totalSteps,
  onNext,
  onSkip,
  isMobile,
}: {
  rect: Rect | null
  placement: string
  stepId: TutorialStepId
  stepIndex: number
  totalSteps: number
  onNext: () => void
  onSkip: () => void
  isMobile: boolean
}) {
  const { t } = useTranslation('common')
  const isModal = !rect
  const isWelcome = stepId === 'welcome'
  const isComplete = stepId === 'tutorial_complete'

  // On mobile with a targeted step, always render as a bottom sheet
  // to avoid fighting with cramped vertical space
  const asMobileSheet = isMobile && !isModal && rect != null

  const containerClasses = cn(
    'border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#2d2d30] shadow-2xl',
    asMobileSheet
      ? 'fixed bottom-0 left-0 right-0 rounded-t-3xl px-5 pt-5 pb-6'
      : 'rounded-2xl p-5',
    isModal && !asMobileSheet && 'text-center'
  )

  const style: React.CSSProperties = { zIndex: 10000 }

  if (asMobileSheet) {
    style.position = 'fixed'
    style.paddingBottom = `calc(${MOBILE_NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px))`
  } else if (isModal) {
    style.position = 'fixed'
    style.left = '50%'
    style.top = '50%'
    style.transform = 'translate(-50%, -50%)'
    style.maxWidth = 'min(360px, calc(100vw - 32px))'
    style.width = '100%'
  } else if (rect) {
    // Desktop positioning
    style.position = 'fixed'
    style.maxWidth = '360px'
    style.width = 'calc(100vw - 32px)'
    const cardW = 344
    const cardH = 220
    const gap = 20

    if (placement === 'bottom') {
      style.left = Math.max(16, Math.min(rect.left + rect.width / 2 - cardW / 2, window.innerWidth - cardW - 16))
      style.top = Math.min(rect.top + rect.height + gap + 28, window.innerHeight - cardH - 16)
    } else if (placement === 'top') {
      style.left = Math.max(16, Math.min(rect.left + rect.width / 2 - cardW / 2, window.innerWidth - cardW - 16))
      style.top = Math.max(16, rect.top - cardH - gap - 28)
    } else if (placement === 'left') {
      style.left = Math.max(16, rect.left - cardW - gap)
      style.top = Math.max(16, Math.min(rect.top + rect.height / 2 - cardH / 2, window.innerHeight - cardH - 16))
    } else {
      style.left = Math.min(rect.left + rect.width + gap, window.innerWidth - cardW - 16)
      style.top = Math.max(16, Math.min(rect.top + rect.height / 2 - cardH / 2, window.innerHeight - cardH - 16))
    }
  }

  return (
    <motion.div
      style={style}
      initial={asMobileSheet
        ? { opacity: 0, y: 100 }
        : { opacity: 0, scale: 0.92 }
      }
      animate={asMobileSheet
        ? { opacity: 1, y: 0 }
        : { opacity: 1, scale: 1 }
      }
      exit={asMobileSheet
        ? { opacity: 0, y: 100 }
        : { opacity: 0, scale: 0.92 }
      }
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={containerClasses}
    >
      {/* Mobile sheet drag indicator */}
      {asMobileSheet && (
        <div className="flex justify-center mb-3">
          <div className="w-10 h-1 rounded-full bg-stone-300 dark:bg-stone-600" />
        </div>
      )}

      {/* Header row */}
      <div className={cn(
        "flex items-center gap-2 mb-3",
        (isModal && !asMobileSheet) ? "justify-center" : "justify-between"
      )}>
        <div className="flex items-center gap-2">
          {STEP_ICONS[stepId]}
          <span className="text-xs font-medium text-stone-400 dark:text-stone-500">
            {stepIndex + 1} / {totalSteps}
          </span>
        </div>
        {!(isModal && !asMobileSheet) && (
          <button
            onClick={onSkip}
            className="rounded-xl p-1.5 text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300 transition-colors active:scale-90"
            aria-label={t('tutorial.skip', { defaultValue: 'Skip tutorial' })}
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Title */}
      <h3 className={cn(
        "font-semibold text-stone-900 dark:text-stone-100 mb-1.5",
        (isWelcome || isComplete) ? "text-lg" : "text-base"
      )}>
        {t(`tutorial.steps.${stepId}.title`, { defaultValue: stepId })}
      </h3>

      {/* Description */}
      <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed mb-5">
        {t(`tutorial.steps.${stepId}.description`, { defaultValue: '' })}
      </p>

      {/* Action buttons — larger touch targets on mobile */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size={isMobile ? 'default' : 'sm'}
          className={cn(
            "rounded-xl text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200",
            isMobile && "min-h-[44px] text-sm"
          )}
          onClick={onSkip}
        >
          {t('tutorial.skipAll', { defaultValue: 'Skip tutorial' })}
        </Button>
        <div className="flex-1" />
        <Button
          size={isMobile ? 'default' : 'sm'}
          className={cn(
            "rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5 shadow-lg shadow-emerald-500/25",
            isMobile && "min-h-[44px] px-5 text-sm font-semibold"
          )}
          onClick={onNext}
        >
          {isComplete
            ? t('tutorial.finish', { defaultValue: 'Get started!' })
            : isWelcome
              ? t('tutorial.start', { defaultValue: "Let's go!" })
              : t('tutorial.next', { defaultValue: 'Next' })}
          {!isComplete && <ChevronRight className="h-4 w-4" />}
        </Button>
      </div>

      {/* Progress dots */}
      <div className="flex items-center justify-center gap-1.5 mt-4">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 rounded-full transition-all duration-200",
              i === stepIndex
                ? "w-5 bg-emerald-500"
                : i < stepIndex
                  ? "w-1.5 bg-emerald-300 dark:bg-emerald-700"
                  : "w-1.5 bg-stone-200 dark:bg-stone-600"
            )}
          />
        ))}
      </div>
    </motion.div>
  )
}

export function TutorialOverlay() {
  const { active, currentStep, currentStepIndex, totalSteps, next, skip } = useTutorial()
  const navigate = useLanguageNavigate()
  const targetRect = useTargetRect(currentStep?.targetSelector, active)
  const [navigating, setNavigating] = React.useState(false)
  const lastRouteRef = React.useRef<string | null>(null)
  const isMobile = useIsMobile()

  // Navigate to the step's route when it changes
  React.useEffect(() => {
    if (!active || !currentStep?.route) return
    if (lastRouteRef.current !== currentStep.route) {
      lastRouteRef.current = currentStep.route
      setNavigating(true)
      navigate(currentStep.route)
      const timer = setTimeout(() => setNavigating(false), 600)
      return () => clearTimeout(timer)
    }
  }, [active, currentStep?.route, currentStep?.id, navigate])

  // Reset route ref when tutorial ends
  React.useEffect(() => {
    if (!active) lastRouteRef.current = null
  }, [active])

  // Keyboard navigation (desktop only)
  React.useEffect(() => {
    if (!active) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') skip()
      if (e.key === 'Enter' || e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [active, next, skip])

  // Scroll target into view
  React.useEffect(() => {
    if (!active || !currentStep?.targetSelector) return
    const timer = setTimeout(() => {
      const el = document.querySelector(currentStep.targetSelector!)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [active, currentStep?.targetSelector, currentStep?.id])

  // Lock body scroll while tutorial is active to prevent background scrolling
  React.useEffect(() => {
    if (!active) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [active])

  if (!active || !currentStep || navigating) return null

  const isExplicitModal = currentStep.isModal
  const hasFallback = currentStep.fallbackToModal && !targetRect
  const isModal = isExplicitModal || hasFallback
  const showSpotlight = !isModal && targetRect

  return createPortal(
    <AnimatePresence mode="wait">
      <div key={currentStep.id} className="tutorial-overlay">
        {/* Dark overlay for modal steps */}
        {isModal && (
          <motion.div
            className="fixed inset-0"
            style={{ zIndex: 9998, backgroundColor: 'rgba(0,0,0,0.6)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          />
        )}

        {/* Spotlight for targeted steps */}
        {showSpotlight && <SpotlightSvg rect={targetRect} padding={currentStep.highlightPadding ?? 8} />}

        {/* Click-blocking overlay for targeted steps */}
        {showSpotlight && (
          <div
            className="fixed inset-0"
            style={{ zIndex: 9999, cursor: 'default' }}
            onClick={(e) => e.stopPropagation()}
          />
        )}

        {/* Arrow pointer (desktop only — mobile uses bottom sheet) */}
        {showSpotlight && !isMobile && (
          <ArrowPointer rect={targetRect} placement={currentStep.placement} />
        )}

        {/* Tooltip card */}
        <TooltipCard
          rect={isModal ? null : targetRect}
          placement={currentStep.placement}
          stepId={currentStep.id}
          stepIndex={currentStepIndex}
          totalSteps={totalSteps}
          onNext={next}
          onSkip={skip}
          isMobile={isMobile}
        />
      </div>
    </AnimatePresence>,
    document.body
  )
}
