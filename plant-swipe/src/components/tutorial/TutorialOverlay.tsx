import React from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronRight, ChevronLeft, X, Sparkles, Sprout, Heart, Info,
  BarChart3, Plus, PartyPopper, Search, ScanLine, ListChecks,
  Grid3X3, GraduationCap, ArrowLeftRight, Camera, Upload,
  LayoutDashboard, BookOpen, Droplets, Scissors, FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTutorial, type TutorialStepId } from '@/context/TutorialContext'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

/** Visual illustration rendered inside each tutorial card */
function StepIllustration({ stepId }: { stepId: TutorialStepId }) {
  const shared = 'flex items-center justify-center rounded-2xl w-full h-28 sm:h-32'

  switch (stepId) {
    case 'welcome':
      return (
        <div className={cn(shared, 'bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20')}>
          <div className="flex items-center gap-3">
            <Sparkles className="h-10 w-10 text-emerald-500" />
            <Sprout className="h-12 w-12 text-emerald-600" />
            <Sparkles className="h-10 w-10 text-emerald-500" />
          </div>
        </div>
      )
    case 'discovery_swipe':
      return (
        <div className={cn(shared, 'bg-gradient-to-br from-emerald-50 to-lime-50 dark:from-emerald-900/20 dark:to-lime-900/20')}>
          <div className="flex items-center gap-4">
            <div className="w-16 h-20 rounded-xl bg-white dark:bg-stone-800 shadow-lg border border-stone-200 dark:border-stone-700 flex items-center justify-center -rotate-6">
              <Sprout className="h-8 w-8 text-emerald-500" />
            </div>
            <ArrowLeftRight className="h-6 w-6 text-stone-400" />
            <div className="w-16 h-20 rounded-xl bg-white dark:bg-stone-800 shadow-lg border border-stone-200 dark:border-stone-700 flex items-center justify-center rotate-6">
              <Sprout className="h-8 w-8 text-emerald-500" />
            </div>
          </div>
        </div>
      )
    case 'discovery_like':
      return (
        <div className={cn(shared, 'bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-900/20 dark:to-pink-900/20')}>
          <div className="relative">
            <div className="w-20 h-24 rounded-xl bg-white dark:bg-stone-800 shadow-lg border border-stone-200 dark:border-stone-700 flex items-center justify-center">
              <Sprout className="h-10 w-10 text-emerald-500" />
            </div>
            <div className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-rose-500 flex items-center justify-center shadow-lg">
              <Heart className="h-4 w-4 text-white fill-white" />
            </div>
          </div>
        </div>
      )
    case 'discovery_info':
      return (
        <div className={cn(shared, 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20')}>
          <div className="flex items-center gap-3">
            <div className="w-16 h-20 rounded-xl bg-white dark:bg-stone-800 shadow-lg border border-stone-200 dark:border-stone-700 flex items-center justify-center">
              <Sprout className="h-8 w-8 text-emerald-500" />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-blue-500"><Droplets className="h-4 w-4" /><div className="h-1.5 w-12 rounded-full bg-blue-200 dark:bg-blue-800" /></div>
              <div className="flex items-center gap-1.5 text-amber-500"><Info className="h-4 w-4" /><div className="h-1.5 w-16 rounded-full bg-amber-200 dark:bg-amber-800" /></div>
              <div className="flex items-center gap-1.5 text-emerald-500"><Scissors className="h-4 w-4" /><div className="h-1.5 w-10 rounded-full bg-emerald-200 dark:bg-emerald-800" /></div>
            </div>
          </div>
        </div>
      )
    case 'encyclopedia_nav':
      return (
        <div className={cn(shared, 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20')}>
          <div className="flex items-center gap-3">
            <div className="h-10 px-4 rounded-xl bg-white dark:bg-stone-800 shadow border border-stone-200 dark:border-stone-700 flex items-center gap-2">
              <Search className="h-4 w-4 text-stone-400" />
              <div className="h-1.5 w-20 rounded-full bg-stone-200 dark:bg-stone-700" />
            </div>
            <BookOpen className="h-8 w-8 text-amber-500" />
          </div>
        </div>
      )
    case 'encyclopedia_categories':
      return (
        <div className={cn(shared, 'bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20')}>
          <div className="grid grid-cols-3 gap-2">
            {['🌵', '🌸', '🥬', '🌿', '🌻', '🐾'].map((emoji, i) => (
              <div key={i} className="w-12 h-12 rounded-xl bg-white dark:bg-stone-800 shadow border border-stone-200 dark:border-stone-700 flex items-center justify-center text-lg">
                {emoji}
              </div>
            ))}
          </div>
        </div>
      )
    case 'scan_identify':
      return (
        <div className={cn(shared, 'bg-gradient-to-br from-cyan-50 to-sky-50 dark:from-cyan-900/20 dark:to-sky-900/20')}>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-center gap-1">
              <Camera className="h-8 w-8 text-cyan-500" />
              <Upload className="h-5 w-5 text-cyan-400" />
            </div>
            <ChevronRight className="h-5 w-5 text-stone-300" />
            <div className="w-20 h-20 rounded-xl bg-white dark:bg-stone-800 shadow-lg border border-stone-200 dark:border-stone-700 flex flex-col items-center justify-center gap-1">
              <ScanLine className="h-6 w-6 text-emerald-500" />
              <div className="h-1 w-10 rounded-full bg-emerald-300 dark:bg-emerald-700" />
              <div className="h-1 w-8 rounded-full bg-stone-200 dark:bg-stone-700" />
            </div>
          </div>
        </div>
      )
    case 'nav_gardens':
      return (
        <div className={cn(shared, 'bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20')}>
          <div className="flex items-center gap-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="w-14 h-16 rounded-xl bg-white dark:bg-stone-800 shadow border border-stone-200 dark:border-stone-700 flex flex-col items-center justify-center gap-1">
                <Sprout className={cn("h-6 w-6", i === 1 ? "text-emerald-500" : i === 2 ? "text-lime-500" : "text-teal-500")} />
                <div className="h-1 w-8 rounded-full bg-stone-200 dark:bg-stone-700" />
              </div>
            ))}
          </div>
        </div>
      )
    case 'gardens_create':
      return (
        <div className={cn(shared, 'bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20')}>
          <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-emerald-300 dark:border-emerald-700 flex items-center justify-center bg-white/50 dark:bg-stone-800/50">
            <Plus className="h-10 w-10 text-emerald-400" />
          </div>
        </div>
      )
    case 'gardens_beginner':
      return (
        <div className={cn(shared, 'bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-900/20 dark:to-blue-900/20')}>
          <div className="flex items-center gap-3">
            <GraduationCap className="h-10 w-10 text-sky-500" />
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded-full bg-emerald-400" /><div className="h-1.5 w-16 rounded-full bg-stone-200 dark:bg-stone-700" /></div>
              <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded-full bg-emerald-400" /><div className="h-1.5 w-20 rounded-full bg-stone-200 dark:bg-stone-700" /></div>
              <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded-full border-2 border-stone-300 dark:border-stone-600" /><div className="h-1.5 w-14 rounded-full bg-stone-200 dark:bg-stone-700" /></div>
            </div>
          </div>
        </div>
      )
    case 'gardens_overview':
      return (
        <div className={cn(shared, 'bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20')}>
          <div className="flex gap-1.5">
            {[
              { icon: LayoutDashboard, label: 'Overview', active: true },
              { icon: Sprout, label: 'Plants', active: false },
              { icon: ListChecks, label: 'Tasks', active: false },
              { icon: BarChart3, label: 'Stats', active: false },
            ].map(({ icon: Icon, active }, i) => (
              <div key={i} className={cn(
                "flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg text-[10px]",
                active ? "bg-emerald-500 text-white" : "text-stone-400 dark:text-stone-500"
              )}>
                <Icon className="h-4 w-4" />
              </div>
            ))}
          </div>
        </div>
      )
    case 'gardens_plants':
      return (
        <div className={cn(shared, 'bg-gradient-to-br from-lime-50 to-green-50 dark:from-lime-900/20 dark:to-green-900/20')}>
          <div className="flex items-center gap-2">
            <div className="w-14 h-14 rounded-xl bg-white dark:bg-stone-800 shadow border border-stone-200 dark:border-stone-700 flex items-center justify-center">
              <Sprout className="h-7 w-7 text-emerald-500" />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="h-1.5 w-16 rounded-full bg-stone-300 dark:bg-stone-600" />
              <div className="flex items-center gap-1"><Droplets className="h-3 w-3 text-blue-400" /><span className="text-[10px] text-stone-400">3d ago</span></div>
              <div className="flex items-center gap-1"><Scissors className="h-3 w-3 text-orange-400" /><span className="text-[10px] text-stone-400">1w ago</span></div>
            </div>
          </div>
        </div>
      )
    case 'gardens_analytics':
      return (
        <div className={cn(shared, 'bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20')}>
          <div className="flex items-end gap-1.5">
            {[40, 65, 50, 80, 60, 75, 90].map((h, i) => (
              <div key={i} className="w-4 rounded-t-sm bg-purple-300 dark:bg-purple-700" style={{ height: `${h * 0.8}px` }} />
            ))}
          </div>
        </div>
      )
    case 'gardens_seedling':
      return (
        <div className={cn(shared, 'bg-gradient-to-br from-emerald-50 to-lime-50 dark:from-emerald-900/20 dark:to-lime-900/20')}>
          <div className="grid grid-cols-4 gap-1">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className={cn(
                "w-7 h-7 rounded border flex items-center justify-center text-xs",
                i < 5 ? "bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700" :
                i < 8 ? "bg-lime-100 dark:bg-lime-900/40 border-lime-300 dark:border-lime-700" :
                "bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700"
              )}>
                {i < 5 ? '🌱' : i < 8 ? '🌿' : ''}
              </div>
            ))}
          </div>
        </div>
      )
    case 'gardens_tasks':
      return (
        <div className={cn(shared, 'bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20')}>
          <div className="flex flex-col gap-2 w-40">
            {[
              { icon: Droplets, color: 'text-blue-500', done: true },
              { icon: Scissors, color: 'text-orange-500', done: true },
              { icon: FileText, color: 'text-stone-400', done: false },
            ].map(({ icon: Icon, color, done }, i) => (
              <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white dark:bg-stone-800 shadow-sm border border-stone-200/80 dark:border-stone-700/80">
                <div className={cn("h-4 w-4 rounded border-2 flex items-center justify-center text-[10px]",
                  done ? "bg-emerald-500 border-emerald-500 text-white" : "border-stone-300 dark:border-stone-600"
                )}>
                  {done && '✓'}
                </div>
                <Icon className={cn("h-3.5 w-3.5", color)} />
                <div className="h-1.5 flex-1 rounded-full bg-stone-200 dark:bg-stone-700" />
              </div>
            ))}
          </div>
        </div>
      )
    case 'tutorial_complete':
      return (
        <div className={cn(shared, 'bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20')}>
          <div className="flex items-center gap-3">
            <PartyPopper className="h-10 w-10 text-emerald-500" />
            <Sparkles className="h-8 w-8 text-amber-400" />
            <Sprout className="h-10 w-10 text-emerald-600" />
          </div>
        </div>
      )
    default:
      return null
  }
}

const STEP_HEADER_ICONS: Partial<Record<TutorialStepId, React.ReactNode>> = {
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

export function TutorialOverlay() {
  const { active, currentStep, currentStepIndex, totalSteps, next, prev, skip } = useTutorial()
  const { t } = useTranslation('common')
  const isMobile = useIsMobile()
  const [direction, setDirection] = React.useState(1)

  const handleNext = React.useCallback(() => { setDirection(1); next() }, [next])
  const handlePrev = React.useCallback(() => { setDirection(-1); prev() }, [prev])

  React.useEffect(() => {
    if (!active) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') skip()
      if (e.key === 'Enter' || e.key === 'ArrowRight') handleNext()
      if (e.key === 'ArrowLeft') handlePrev()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [active, handleNext, handlePrev, skip])

  React.useEffect(() => {
    if (!active) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [active])

  if (!active || !currentStep) return null

  const stepId = currentStep.id
  const isWelcome = stepId === 'welcome'
  const isComplete = stepId === 'tutorial_complete'
  const canGoBack = currentStepIndex > 0

  const cardStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 10000,
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    maxWidth: isMobile ? 'calc(100vw - 32px)' : '420px',
    width: '100%',
  }

  return createPortal(
    <>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0"
        style={{ zIndex: 9998, backgroundColor: 'rgba(0,0,0,0.6)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      />

      {/* Card */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={stepId}
          custom={direction}
          style={cardStyle}
          initial={{ opacity: 0, x: direction > 0 ? 60 : -60 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction > 0 ? -60 : 60 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#2d2d30] shadow-2xl overflow-hidden"
        >
          {/* Illustration */}
          <StepIllustration stepId={stepId} />

          {/* Content */}
          <div className="p-5">
            {/* Header row */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                {STEP_HEADER_ICONS[stepId]}
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
            <h3 className={cn(
              "font-semibold text-stone-900 dark:text-stone-100 mb-1.5",
              (isWelcome || isComplete) ? 'text-lg' : 'text-base'
            )}>
              {t(`tutorial.steps.${stepId}.title`, { defaultValue: stepId })}
            </h3>

            {/* Description */}
            <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed mb-5">
              {t(`tutorial.steps.${stepId}.description`, { defaultValue: '' })}
            </p>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              {canGoBack ? (
                <Button
                  variant="ghost"
                  size={isMobile ? 'default' : 'sm'}
                  className={cn("rounded-xl text-stone-500 dark:text-stone-400", isMobile && "min-h-[44px]")}
                  onClick={handlePrev}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  {t('tutorial.back', { defaultValue: 'Back' })}
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size={isMobile ? 'default' : 'sm'}
                  className={cn("rounded-xl text-stone-500 dark:text-stone-400", isMobile && "min-h-[44px]")}
                  onClick={skip}
                >
                  {t('tutorial.skipAll', { defaultValue: 'Skip tutorial' })}
                </Button>
              )}
              <div className="flex-1" />
              <Button
                size={isMobile ? 'default' : 'sm'}
                className={cn(
                  "rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5 shadow-lg shadow-emerald-500/25",
                  isMobile && "min-h-[44px] px-5 text-sm font-semibold"
                )}
                onClick={handleNext}
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
                    i === currentStepIndex
                      ? "w-5 bg-emerald-500"
                      : i < currentStepIndex
                        ? "w-1.5 bg-emerald-300 dark:bg-emerald-700"
                        : "w-1.5 bg-stone-200 dark:bg-stone-600"
                  )}
                />
              ))}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </>,
    document.body
  )
}
