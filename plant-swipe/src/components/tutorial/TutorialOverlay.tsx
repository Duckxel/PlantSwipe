import React from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronRight, ChevronLeft, X, Sparkles, Sprout, Heart, Info,
  BarChart3, Plus, PartyPopper, Search, ScanLine, ListChecks,
  Grid3X3, GraduationCap, ArrowLeftRight, LayoutDashboard,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTutorial, type TutorialStepId } from '@/context/TutorialContext'
import { useLanguageNavigate } from '@/lib/i18nRouting'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabaseClient'

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

export function TutorialOverlay() {
  const { active, currentStep, currentStepIndex, totalSteps, next, prev, skip } = useTutorial()
  const { t } = useTranslation('common')
  const navigate = useLanguageNavigate()
  const isMobile = useIsMobile()
  const [dir, setDir] = React.useState(1)
  const lastRouteRef = React.useRef<string | null>(null)

  const handleNext = React.useCallback(() => { setDir(1); next() }, [next])
  const handlePrev = React.useCallback(() => { setDir(-1); prev() }, [prev])

  // Cache resolved demo plant ID so we only query once
  const demoPlantIdRef = React.useRef<string | null>(null)

  // Navigate to the step's route
  React.useEffect(() => {
    if (!active || !currentStep?.route) return

    let route = currentStep.route
    const needsDemoPlant = route.includes('__demo__')

    const doNavigate = (resolvedRoute: string) => {
      if (lastRouteRef.current !== resolvedRoute) {
        lastRouteRef.current = resolvedRoute
        navigate(resolvedRoute)
      }
    }

    if (needsDemoPlant) {
      if (demoPlantIdRef.current) {
        doNavigate(route.replace('__demo__', demoPlantIdRef.current))
      } else {
        // Find a real plant with an image
        supabase
          .from('plants')
          .select('id, plant_images!inner(link)')
          .limit(1)
          .then(({ data }) => {
            const id = data?.[0]?.id
            if (id) {
              demoPlantIdRef.current = id
              doNavigate(route.replace('__demo__', id))
            }
          })
      }
    } else {
      doNavigate(route)
    }
  }, [active, currentStep?.route, currentStep?.id, navigate])

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

  if (!active || !currentStep) return null

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
          style={{ zIndex: 10000 }}
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

          <div className={cn("p-5", isMobile && "pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]")}>
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
