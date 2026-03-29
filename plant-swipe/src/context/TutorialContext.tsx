import React from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'

export type TutorialStepId =
  | 'welcome'
  | 'discovery_swipe'
  | 'discovery_like'
  | 'discovery_info'
  | 'nav_gardens'
  | 'gardens_create'
  | 'gardens_overview'
  | 'gardens_plants'
  | 'gardens_analytics'
  | 'tutorial_complete'

export type TutorialStep = {
  id: TutorialStepId
  targetSelector?: string
  placement: 'center' | 'top' | 'bottom' | 'left' | 'right'
  route?: string
  highlightPadding?: number
  /** When true, the step is purely informational (no element highlight) */
  isModal?: boolean
  /** When true, falls back to modal if target element is not found in the DOM */
  fallbackToModal?: boolean
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  { id: 'welcome', placement: 'center', isModal: true },
  { id: 'discovery_swipe', targetSelector: '[data-tutorial="swipe-card"]', placement: 'bottom', route: '/discovery', fallbackToModal: true, highlightPadding: 12 },
  { id: 'discovery_like', targetSelector: '[data-tutorial="like-button"]', placement: 'top', route: '/discovery', fallbackToModal: true },
  { id: 'discovery_info', targetSelector: '[data-tutorial="info-button"]', placement: 'top', route: '/discovery', fallbackToModal: true },
  { id: 'nav_gardens', targetSelector: '[data-tutorial="nav-gardens"]', placement: 'top', route: '/discovery', fallbackToModal: true },
  { id: 'gardens_create', targetSelector: '[data-tutorial="create-garden"]', placement: 'bottom', route: '/gardens', fallbackToModal: true },
  { id: 'gardens_overview', placement: 'center', isModal: true, route: '/gardens' },
  { id: 'gardens_plants', placement: 'center', isModal: true, route: '/gardens' },
  { id: 'gardens_analytics', placement: 'center', isModal: true, route: '/gardens' },
  { id: 'tutorial_complete', placement: 'center', isModal: true },
]

type TutorialContextValue = {
  active: boolean
  currentStepIndex: number
  currentStep: TutorialStep | null
  totalSteps: number
  next: () => void
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
