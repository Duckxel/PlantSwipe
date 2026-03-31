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
  /** The fake page shown behind the tutorial card */
  demoPage: 'discovery' | 'encyclopedia' | 'scan' | 'gardens' | 'garden-dashboard' | 'none'
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  { id: 'welcome', demoPage: 'none' },
  { id: 'discovery_swipe', demoPage: 'discovery' },
  { id: 'discovery_like', demoPage: 'discovery' },
  { id: 'discovery_info', demoPage: 'discovery' },
  { id: 'encyclopedia_nav', demoPage: 'encyclopedia' },
  { id: 'encyclopedia_categories', demoPage: 'encyclopedia' },
  { id: 'scan_identify', demoPage: 'scan' },
  { id: 'nav_gardens', demoPage: 'gardens' },
  { id: 'gardens_create', demoPage: 'gardens' },
  { id: 'gardens_beginner', demoPage: 'garden-dashboard' },
  { id: 'gardens_overview', demoPage: 'garden-dashboard' },
  { id: 'gardens_plants', demoPage: 'garden-dashboard' },
  { id: 'gardens_analytics', demoPage: 'garden-dashboard' },
  { id: 'gardens_seedling', demoPage: 'garden-dashboard' },
  { id: 'gardens_tasks', demoPage: 'garden-dashboard' },
  { id: 'tutorial_complete', demoPage: 'none' },
]

type TutorialContextValue = {
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

  const value: TutorialContextValue = {
    active,
    currentStepIndex,
    currentStep,
    totalSteps: TUTORIAL_STEPS.length,
    next,
    prev,
    skip,
    startTutorial,
  }

  return (
    <TutorialContext.Provider value={value}>
      {children}
    </TutorialContext.Provider>
  )
}

export function useTutorial(): TutorialContextValue {
  const ctx = React.useContext(TutorialContext)
  if (!ctx) throw new Error('useTutorial must be used within TutorialProvider')
  return ctx
}
