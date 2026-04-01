import React from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'

export type TutorialStepId =
  | 'welcome'
  | 'discovery_swipe'
  | 'discovery_like'
  | 'discovery_info'
  | 'encyclopedia_nav'
  | 'encyclopedia_categories'
  | 'scan_identify'
  | 'nav_gardens'
  | 'gardens_create'
  | 'gardens_beginner'
  | 'gardens_overview'
  | 'gardens_plants'
  | 'gardens_analytics'
  | 'gardens_seedling'
  | 'gardens_tasks'
  | 'tutorial_complete'

export type TutorialStep = {
  id: TutorialStepId
  /** Route to navigate to for this step (pages render with demo data) */
  route?: string
  /** CSS selector of an element to spotlight-highlight on this step */
  highlight?: string
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  { id: 'welcome' },
  { id: 'discovery_swipe', route: '/discovery' },
  { id: 'discovery_like', route: '/discovery' },
  { id: 'discovery_info', route: '/plants/43cd0d55-e799-4f2b-99fd-8dd7c7940530' },
  { id: 'encyclopedia_categories', route: '/search/categories' },
  { id: 'encyclopedia_nav', route: '/search' },
  { id: 'scan_identify', route: '/scan' },
  { id: 'nav_gardens', route: '/gardens' },
  { id: 'gardens_create', route: '/gardens', highlight: '[data-tutorial="create-garden"]' },
  { id: 'gardens_beginner', route: '/gardens', highlight: '[data-tutorial="garden-type-beginners"]' },
  { id: 'gardens_overview', route: '/garden/demo-garden-1/overview' },
  { id: 'gardens_plants', route: '/garden/demo-garden-1/plants' },
  { id: 'gardens_analytics', route: '/garden/demo-garden-1/analytics' },
  { id: 'gardens_seedling', route: '/garden/demo-garden-1/tray' },
  { id: 'gardens_tasks', route: '/garden/demo-garden-1/tasks' },
  { id: 'tutorial_complete' },
]

type TutorialContextValue = {
  /** True when the tutorial slideshow is running */
  active: boolean
  currentStepIndex: number
  currentStep: TutorialStep | null
  totalSteps: number
  next: () => void
  prev: () => void
  skip: () => void
  startTutorial: () => void
}

const TutorialContext = React.createContext<TutorialContextValue | undefined>(undefined)

export const TutorialProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, refreshProfile } = useAuth()
  const [active, setActive] = React.useState(false)
  const [currentStepIndex, setCurrentStepIndex] = React.useState(0)

  React.useEffect(() => {
    if (user && profile && profile.setup_completed === true && profile.email_verified === true && profile.tutorial_completed !== true) {
      setActive(true)
      setCurrentStepIndex(0)
    }
  }, [user, profile])

  const markComplete = React.useCallback(async () => {
    if (!user) return
    setActive(false)
    setCurrentStepIndex(0)
    await supabase
      .from('profiles')
      .update({ tutorial_completed: true })
      .eq('id', user.id)
    refreshProfile().catch(() => {})
  }, [user, refreshProfile])

  const next = React.useCallback(() => {
    setCurrentStepIndex(prev => {
      const nextIdx = prev + 1
      if (nextIdx >= TUTORIAL_STEPS.length) {
        markComplete()
        return prev
      }
      return nextIdx
    })
  }, [markComplete])

  const prev = React.useCallback(() => {
    setCurrentStepIndex(prev => Math.max(0, prev - 1))
  }, [])

  const skip = React.useCallback(() => {
    markComplete()
  }, [markComplete])

  const startTutorial = React.useCallback(() => {
    setActive(true)
    setCurrentStepIndex(0)
  }, [])

  const currentStep = active ? TUTORIAL_STEPS[currentStepIndex] ?? null : null

  return (
    <TutorialContext.Provider value={{
      active,
      currentStepIndex,
      currentStep,
      totalSteps: TUTORIAL_STEPS.length,
      next,
      prev,
      skip,
      startTutorial,
    }}>
      {children}
    </TutorialContext.Provider>
  )
}

export function useTutorial(): TutorialContextValue {
  const ctx = React.useContext(TutorialContext)
  if (!ctx) throw new Error('useTutorial must be used within TutorialProvider')
  return ctx
}
