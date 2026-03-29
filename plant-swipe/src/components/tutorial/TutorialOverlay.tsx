import React from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, X, Sparkles, Sprout, Heart, Info, BarChart3, Plus, ArrowDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTutorial, type TutorialStepId } from '@/context/TutorialContext'
import { useLanguageNavigate } from '@/lib/i18nRouting'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

type Rect = { top: number; left: number; width: number; height: number }

const STEP_ICONS: Partial<Record<TutorialStepId, React.ReactNode>> = {
  welcome: <Sparkles className="h-8 w-8 text-emerald-500" />,
  discovery_swipe: <ArrowDown className="h-6 w-6 text-emerald-500" />,
  discovery_like: <Heart className="h-6 w-6 text-rose-500" />,
  discovery_info: <Info className="h-6 w-6 text-blue-500" />,
  nav_gardens: <Sprout className="h-6 w-6 text-emerald-500" />,
  gardens_create: <Plus className="h-6 w-6 text-emerald-500" />,
  gardens_overview: <Sprout className="h-6 w-6 text-emerald-500" />,
  gardens_plants: <Sprout className="h-6 w-6 text-emerald-500" />,
  gardens_analytics: <BarChart3 className="h-6 w-6 text-purple-500" />,
  tutorial_complete: <Sparkles className="h-8 w-8 text-emerald-500" />,
}

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

    measure()

    const interval = setInterval(measure, 300)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)

    return () => {
      clearInterval(interval)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [selector, active])

  return rect
}

function SpotlightSvg({ rect, padding = 8 }: { rect: Rect; padding?: number }) {
  const x = rect.left - padding
  const y = rect.top - padding
  const w = rect.width + padding * 2
  const h = rect.height + padding * 2
  const r = Math.min(12, w / 2, h / 2)

  return (
    <svg
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 9998, width: '100vw', height: '100vh' }}
      viewBox={`0 0 ${window.innerWidth} ${window.innerHeight}`}
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
        fill="rgba(0,0,0,0.65)"
        mask="url(#tutorial-spotlight-mask)"
      />
    </svg>
  )
}

function ArrowPointer({ rect, placement }: { rect: Rect; placement: string }) {
  const style: React.CSSProperties = { position: 'fixed', zIndex: 9999 }

  if (placement === 'bottom') {
    style.left = rect.left + rect.width / 2 - 12
    style.top = rect.top + rect.height + 8
  } else if (placement === 'top') {
    style.left = rect.left + rect.width / 2 - 12
    style.top = rect.top - 32
  } else if (placement === 'left') {
    style.left = rect.left - 32
    style.top = rect.top + rect.height / 2 - 12
  } else {
    style.left = rect.left + rect.width + 8
    style.top = rect.top + rect.height / 2 - 12
  }

  const rotation = placement === 'bottom' ? 0 : placement === 'top' ? 180 : placement === 'left' ? 90 : 270

  return (
    <motion.div
      style={style}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1, y: placement === 'bottom' ? [0, 6, 0] : placement === 'top' ? [0, -6, 0] : 0 }}
      transition={{ y: { repeat: Infinity, duration: 1.2, ease: 'easeInOut' } }}
      className="pointer-events-none"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ transform: `rotate(${rotation}deg)` }}>
        <path d="M12 4L4 16h16L12 4z" fill="rgb(16 185 129)" />
      </svg>
    </motion.div>
  )
}

function TooltipCard({
  rect,
  placement,
  stepId,
  stepIndex,
  totalSteps,
  onNext,
  onSkip,
}: {
  rect: Rect | null
  placement: string
  stepId: TutorialStepId
  stepIndex: number
  totalSteps: number
  onNext: () => void
  onSkip: () => void
}) {
  const { t } = useTranslation('common')
  const isModal = !rect
  const cardRef = React.useRef<HTMLDivElement>(null)
  const [cardSize, setCardSize] = React.useState({ w: 320, h: 200 })

  React.useEffect(() => {
    if (cardRef.current) {
      setCardSize({ w: cardRef.current.offsetWidth, h: cardRef.current.offsetHeight })
    }
  }, [stepId])

  const style: React.CSSProperties = {
    position: 'fixed',
    zIndex: 10000,
    maxWidth: 'min(360px, calc(100vw - 32px))',
    width: '100%',
  }

  if (isModal) {
    style.left = '50%'
    style.top = '50%'
    style.transform = 'translate(-50%, -50%)'
  } else if (rect) {
    const gap = 16
    if (placement === 'bottom') {
      style.left = Math.max(16, Math.min(rect.left + rect.width / 2 - cardSize.w / 2, window.innerWidth - cardSize.w - 16))
      style.top = Math.min(rect.top + rect.height + gap + 24, window.innerHeight - cardSize.h - 16)
    } else if (placement === 'top') {
      style.left = Math.max(16, Math.min(rect.left + rect.width / 2 - cardSize.w / 2, window.innerWidth - cardSize.w - 16))
      style.top = Math.max(16, rect.top - cardSize.h - gap - 24)
    } else if (placement === 'left') {
      style.left = Math.max(16, rect.left - cardSize.w - gap)
      style.top = Math.max(16, Math.min(rect.top + rect.height / 2 - cardSize.h / 2, window.innerHeight - cardSize.h - 16))
    } else {
      style.left = Math.min(rect.left + rect.width + gap, window.innerWidth - cardSize.w - 16)
      style.top = Math.max(16, Math.min(rect.top + rect.height / 2 - cardSize.h / 2, window.innerHeight - cardSize.h - 16))
    }
  }

  const isWelcome = stepId === 'welcome'
  const isComplete = stepId === 'tutorial_complete'

  return (
    <motion.div
      ref={cardRef}
      style={style}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#2d2d30] shadow-2xl p-5",
        isModal && "text-center"
      )}
    >
      <div className={cn("flex items-start gap-2 mb-3", isModal ? "justify-center" : "justify-between")}>
        <div className="flex items-center gap-2">
          {STEP_ICONS[stepId]}
          <span className="text-xs font-medium text-stone-400 dark:text-stone-500">
            {stepIndex + 1}/{totalSteps}
          </span>
        </div>
        {!isModal && (
          <button
            onClick={onSkip}
            className="rounded-lg p-1 text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300 transition-colors"
            aria-label={t('tutorial.skip', { defaultValue: 'Skip tutorial' })}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <h3 className="text-base font-semibold text-stone-900 dark:text-stone-100 mb-1.5">
        {t(`tutorial.steps.${stepId}.title`, { defaultValue: stepId })}
      </h3>
      <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed mb-4">
        {t(`tutorial.steps.${stepId}.description`, { defaultValue: '' })}
      </p>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="rounded-xl text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
          onClick={onSkip}
        >
          {t('tutorial.skipAll', { defaultValue: 'Skip tutorial' })}
        </Button>
        <div className="flex-1" />
        <Button
          size="sm"
          className="rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white gap-1"
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
      <div className="flex items-center justify-center gap-1 mt-3">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 rounded-full transition-all duration-200",
              i === stepIndex ? "w-4 bg-emerald-500" : i < stepIndex ? "w-1.5 bg-emerald-300 dark:bg-emerald-700" : "w-1.5 bg-stone-200 dark:bg-stone-600"
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

  React.useEffect(() => {
    if (!active || !currentStep?.route) return
    if (lastRouteRef.current !== currentStep.route) {
      lastRouteRef.current = currentStep.route
      setNavigating(true)
      navigate(currentStep.route)
      const timer = setTimeout(() => setNavigating(false), 500)
      return () => clearTimeout(timer)
    }
  }, [active, currentStep?.route, currentStep?.id, navigate])

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
    }, 250)
    return () => clearTimeout(timer)
  }, [active, currentStep?.targetSelector, currentStep?.id])

  if (!active || !currentStep || navigating) return null

  const isExplicitModal = currentStep.isModal
  const hasFallback = currentStep.fallbackToModal && !targetRect
  const isModal = isExplicitModal || hasFallback
  const showSpotlight = !isModal && targetRect

  return createPortal(
    <AnimatePresence mode="wait">
      <div key={currentStep.id}>
        {/* Dark overlay */}
        {isModal && (
          <motion.div
            className="fixed inset-0"
            style={{ zIndex: 9998, backgroundColor: 'rgba(0,0,0,0.65)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
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

        {/* Arrow pointer */}
        {showSpotlight && <ArrowPointer rect={targetRect} placement={currentStep.placement} />}

        {/* Tooltip card */}
        <TooltipCard
          rect={isModal ? null : targetRect}
          placement={currentStep.placement}
          stepId={currentStep.id}
          stepIndex={currentStepIndex}
          totalSteps={totalSteps}
          onNext={next}
          onSkip={skip}
        />
      </div>
    </AnimatePresence>,
    document.body
  )
}
