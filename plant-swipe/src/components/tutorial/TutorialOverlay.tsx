import React from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronRight, ChevronLeft, X, Sparkles, Sprout, Heart, Info,
  BarChart3, Plus, PartyPopper, Search, ScanLine, ListChecks,
  Grid3X3, GraduationCap, ArrowLeftRight, LayoutDashboard,
  Hand,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTutorial, type TutorialStepId } from '@/context/TutorialContext'
import { useLanguageNavigate, usePathWithoutLanguage } from '@/lib/i18nRouting'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

const STEP_ICONS: Partial<Record<TutorialStepId, React.ReactNode>> = {
  welcome: <Sparkles className="h-5 w-5 text-emerald-500" />,
  discovery_swipe: <ArrowLeftRight className="h-5 w-5 text-emerald-500" />,
  discovery_like: <Heart className="h-5 w-5 text-rose-500" />,
  discovery_info: <Info className="h-5 w-5 text-blue-500" />,
  encyclopedia_nav: <Search className="h-5 w-5 text-amber-500" />,
  encyclopedia_categories: <Grid3X3 className="h-5 w-5 text-amber-500" />,
  scan_identify: <ScanLine className="h-5 w-5 text-cyan-500" />,
  nav_gardens: <Sprout className="h-5 w-5 text-emerald-500" />,
  gardens_create: <Plus className="h-5 w-5 text-emerald-500" />,
  gardens_beginner: <GraduationCap className="h-5 w-5 text-sky-500" />,
  gardens_overview: <LayoutDashboard className="h-5 w-5 text-emerald-500" />,
  gardens_plants: <Sprout className="h-5 w-5 text-lime-500" />,
  gardens_analytics: <BarChart3 className="h-5 w-5 text-purple-500" />,
  gardens_seedling: <Grid3X3 className="h-5 w-5 text-emerald-500" />,
  gardens_tasks: <ListChecks className="h-5 w-5 text-orange-500" />,
  tutorial_complete: <PartyPopper className="h-5 w-5 text-emerald-500" />,
}

/** Curved arrow SVG pointing in a direction */
function CurvedArrow({ direction, color }: { direction: 'up' | 'down' | 'left'; color: string }) {
  if (direction === 'up') return (
    <svg width="32" height="40" viewBox="0 0 32 40" fill="none">
      <path d="M16 38 C16 22, 16 14, 16 6" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M8 14 L16 4 L24 14" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M16 38 C16 22, 16 14, 16 6" stroke="white" strokeWidth="4.5" strokeLinecap="round" opacity="0.25" />
      <path d="M8 14 L16 4 L24 14" stroke="white" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.25" />
    </svg>
  )
  if (direction === 'down') return (
    <svg width="32" height="40" viewBox="0 0 32 40" fill="none">
      <path d="M16 2 C16 18, 16 26, 16 34" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M8 26 L16 36 L24 26" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M16 2 C16 18, 16 26, 16 34" stroke="white" strokeWidth="4.5" strokeLinecap="round" opacity="0.25" />
      <path d="M8 26 L16 36 L24 26" stroke="white" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.25" />
    </svg>
  )
  // left — curved
  return (
    <svg width="44" height="32" viewBox="0 0 44 32" fill="none">
      <path d="M40 16 C28 16, 18 16, 8 16" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M16 8 L6 16 L16 24" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M40 16 C28 16, 18 16, 8 16" stroke="white" strokeWidth="4.5" strokeLinecap="round" opacity="0.25" />
      <path d="M16 8 L6 16 L16 24" stroke="white" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.25" />
    </svg>
  )
}

const labelStyle = "text-[11px] font-bold tracking-wide uppercase text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]"

/** Animated gesture guide rendered on top of the discovery card during step 2 */
function SwipeGestureHints() {
  const { t } = useTranslation('common')
  return (
    <motion.div
      className="fixed inset-0 pointer-events-none flex items-center justify-center"
      style={{ zIndex: 9999 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ delay: 0.3 }}
    >
      <div className="relative flex flex-col items-center gap-0" style={{ width: 200, height: 240 }}>

        {/* Up — next plant */}
        <motion.div
          className="flex flex-col items-center"
          animate={{ y: [0, -6, 0] }}
          transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
        >
          <CurvedArrow direction="up" color="#34d399" />
          <span className={labelStyle} style={{ color: '#6ee7b7' }}>
            {t('tutorial.gesture.nextPlant', { defaultValue: 'Next plant' })}
          </span>
        </motion.div>

        {/* Middle row: left + center hand */}
        <div className="flex items-center gap-3 my-1">
          {/* Left — view details */}
          <motion.div
            className="flex items-center gap-1"
            animate={{ x: [-6, 0, -6] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
          >
            <CurvedArrow direction="left" color="#60a5fa" />
            <span className={labelStyle} style={{ color: '#93c5fd' }}>
              {t('tutorial.gesture.viewDetails', { defaultValue: 'Details' })}
            </span>
          </motion.div>

          {/* Center — double tap to like */}
          <motion.div
            className="flex flex-col items-center"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
          >
            <div className="relative">
              <Hand className="h-9 w-9 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]" strokeWidth={2.2} />
              <span className="absolute -top-1.5 -right-1.5 text-[9px] font-black text-white bg-rose-500 rounded-full h-4 w-4 flex items-center justify-center ring-2 ring-white/30">2</span>
            </div>
            <span className={labelStyle} style={{ color: '#fda4af', marginTop: 2 }}>
              {t('tutorial.gesture.doubleTapLike', { defaultValue: 'Like' })}
            </span>
          </motion.div>
        </div>

        {/* Down — previous plant */}
        <motion.div
          className="flex flex-col items-center"
          animate={{ y: [0, 6, 0] }}
          transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
        >
          <span className={labelStyle} style={{ color: '#6ee7b7' }}>
            {t('tutorial.gesture.previousPlant', { defaultValue: 'Previous' })}
          </span>
          <CurvedArrow direction="down" color="#34d399" />
        </motion.div>

      </div>
    </motion.div>
  )
}

function useIsMobile() {
  const [v, setV] = React.useState(() => typeof window !== 'undefined' ? window.innerWidth < 768 : false)
  React.useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const h = (e: MediaQueryListEvent) => setV(e.matches)
    mq.addEventListener('change', h)
    setV(mq.matches)
    return () => mq.removeEventListener('change', h)
  }, [])
  return v
}

const TUTORIAL_EXCLUDED_PATHS = ['/admin', '/setup', '/verify-email', '/forgot-password', '/password-change']

export function TutorialOverlay() {
  const { active, currentStep, currentStepIndex, totalSteps, next, prev, skip } = useTutorial()
  const { t, ready: i18nReady } = useTranslation('common')
  const navigate = useLanguageNavigate()
  const pathWithoutLang = usePathWithoutLanguage()
  const isMobile = useIsMobile()
  const isExcludedPage = TUTORIAL_EXCLUDED_PATHS.some(p => pathWithoutLang.startsWith(p))
  const [dir, setDir] = React.useState(1)
  const lastRouteRef = React.useRef<string | null>(null)

  const handleNext = React.useCallback(() => { setDir(1); next() }, [next])
  const handlePrev = React.useCallback(() => { setDir(-1); prev() }, [prev])

  // Navigate to /discovery when tutorial ends (finish or skip)
  const wasActiveRef = React.useRef(false)
  React.useEffect(() => {
    if (active) { wasActiveRef.current = true; return }
    if (wasActiveRef.current) {
      wasActiveRef.current = false
      navigate('/discovery')
    }
  }, [active, navigate])

  // Navigate to the step's route (skip on excluded pages like /admin)
  React.useEffect(() => {
    if (!active || !currentStep?.route || isExcludedPage) return
    if (lastRouteRef.current !== currentStep.route) {
      lastRouteRef.current = currentStep.route
      navigate(currentStep.route)
    }
  }, [active, currentStep?.route, currentStep?.id, navigate, isExcludedPage])

  React.useEffect(() => {
    if (!active) lastRouteRef.current = null
  }, [active])

  // Keyboard nav
  React.useEffect(() => {
    if (!active) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') skip()
      if (e.key === 'Enter' || e.key === 'ArrowRight') handleNext()
      if (e.key === 'ArrowLeft') handlePrev()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [active, handleNext, handlePrev, skip])

  // Track highlighted element position
  const [highlightRect, setHighlightRect] = React.useState<{ top: number; left: number; width: number; height: number } | null>(null)
  React.useEffect(() => {
    if (!active || !currentStep?.highlight) { setHighlightRect(null); return }
    const measure = () => {
      const el = document.querySelector(currentStep.highlight!)
      if (el) {
        const r = el.getBoundingClientRect()
        setHighlightRect({ top: r.top, left: r.left, width: r.width, height: r.height })
      }
    }
    // Delay to let page render after navigation
    const t1 = setTimeout(measure, 400)
    const t2 = setTimeout(measure, 800)
    const iv = setInterval(measure, 500)
    window.addEventListener('scroll', measure, true)
    return () => { clearTimeout(t1); clearTimeout(t2); clearInterval(iv); window.removeEventListener('scroll', measure, true) }
  }, [active, currentStep?.highlight, currentStep?.id])

  if (!active || !currentStep || isExcludedPage || !i18nReady) return null

  const stepId = currentStep.id
  const isWelcome = stepId === 'welcome'
  const isComplete = stepId === 'tutorial_complete'
  const canGoBack = currentStepIndex > 0
  const hasRoute = !!currentStep.route

  return createPortal(
    <>
      {/* Dark overlay — full for welcome/complete, partial for page steps */}
      <motion.div
        className="fixed inset-0"
        style={{ zIndex: 9998, backgroundColor: hasRoute ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.6)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
      />

      {/* Spotlight highlight ring on a specific element */}
      {highlightRect && (
        <motion.div
          className="fixed pointer-events-none"
          style={{
            zIndex: 9999,
            top: highlightRect.top - 6,
            left: highlightRect.left - 6,
            width: highlightRect.width + 12,
            height: highlightRect.height + 12,
            borderRadius: 16,
            border: '2.5px solid rgb(16 185 129)',
            boxShadow: '0 0 0 4000px rgba(0,0,0,0.35), 0 0 20px 4px rgba(16,185,129,0.4)',
          }}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: [1, 1.03, 1] }}
          transition={{ scale: { repeat: Infinity, duration: 2, ease: 'easeInOut' } }}
        />
      )}

      {/* Gesture hints on discovery card */}
      {stepId === 'discovery_swipe' && <SwipeGestureHints />}

      {/* Floating tutorial card */}
      <AnimatePresence mode="wait" custom={dir}>
        <motion.div
          key={stepId}
          custom={dir}
          className={cn(
            "fixed border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#2d2d30] shadow-2xl overflow-hidden",
            isMobile
              ? "bottom-0 left-0 right-0 rounded-t-3xl"
              : hasRoute
                ? "bottom-6 left-1/2 w-full max-w-md rounded-2xl"
                : "top-1/2 left-1/2 w-full max-w-md rounded-2xl"
          )}
          style={isMobile
            ? { zIndex: 10000, maxHeight: '70vh', overflowY: 'auto' }
            : { zIndex: 10000 }
          }
          initial={isMobile
            ? { y: 200, opacity: 0 }
            : hasRoute
              ? { opacity: 0, x: dir > 0 ? 60 : -60, y: 0 }
              : { opacity: 0, scale: 0.92, x: '-50%', y: '-50%' }
          }
          animate={isMobile
            ? { y: 0, opacity: 1 }
            : hasRoute
              ? { opacity: 1, x: '-50%', y: 0 }
              : { opacity: 1, scale: 1, x: '-50%', y: '-50%' }
          }
          exit={isMobile
            ? { y: 200, opacity: 0 }
            : { opacity: 0, x: dir > 0 ? -60 : 60 }
          }
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          {/* Drag handle (mobile) */}
          {isMobile && (
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-stone-300 dark:bg-stone-600" />
            </div>
          )}

          <div className={cn("p-5", isMobile && "pb-[calc(1.25rem+72px+env(safe-area-inset-bottom,0px))]")}>
            {/* Header */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                {STEP_ICONS[stepId]}
                <span className="text-xs font-medium text-stone-400 dark:text-stone-500">
                  {currentStepIndex + 1} / {totalSteps}
                </span>
              </div>
              <button
                onClick={skip}
                className="rounded-xl p-1.5 text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300 transition-colors active:scale-90"
                aria-label={t('tutorial.skip', { defaultValue: 'Skip tutorial' })}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Title */}
            <h3 className={cn("font-semibold text-stone-900 dark:text-stone-100 mb-1", (isWelcome || isComplete) ? 'text-lg' : 'text-base')}>
              {t(`tutorial.steps.${stepId}.title`, { defaultValue: stepId })}
            </h3>

            {/* Description */}
            <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed mb-4">
              {t(`tutorial.steps.${stepId}.description`, { defaultValue: '' })}
            </p>

            {/* Buttons */}
            <div className="flex items-center gap-2">
              {canGoBack ? (
                <Button variant="ghost" size={isMobile ? 'default' : 'sm'} className={cn("rounded-xl text-stone-500", isMobile && "min-h-[44px]")} onClick={handlePrev}>
                  <ChevronLeft className="h-4 w-4 mr-1" />{t('tutorial.back', { defaultValue: 'Back' })}
                </Button>
              ) : (
                <Button variant="ghost" size={isMobile ? 'default' : 'sm'} className={cn("rounded-xl text-stone-500", isMobile && "min-h-[44px]")} onClick={skip}>
                  {t('tutorial.skipAll', { defaultValue: 'Skip tutorial' })}
                </Button>
              )}
              <div className="flex-1" />
              <Button
                size={isMobile ? 'default' : 'sm'}
                className={cn("rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5 shadow-lg shadow-emerald-500/25", isMobile && "min-h-[44px] px-5 text-sm font-semibold")}
                onClick={handleNext}
              >
                {isComplete ? t('tutorial.finish', { defaultValue: 'Get started!' }) : isWelcome ? t('tutorial.start', { defaultValue: "Let's go!" }) : t('tutorial.next', { defaultValue: 'Next' })}
                {!isComplete && <ChevronRight className="h-4 w-4" />}
              </Button>
            </div>

            {/* Progress dots */}
            <div className="flex items-center justify-center gap-1 mt-3">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div key={i} className={cn("h-1.5 rounded-full transition-all duration-200", i === currentStepIndex ? "w-4 bg-emerald-500" : i < currentStepIndex ? "w-1.5 bg-emerald-300 dark:bg-emerald-700" : "w-1.5 bg-stone-200 dark:bg-stone-600")} />
              ))}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </>,
    document.body
  )
}
