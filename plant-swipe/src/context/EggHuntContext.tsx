import React, { createContext, useContext, useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import type { EventRow, EventEggRow } from '@/types/event'
import { getActiveEvent, getEventEggs, getUserFoundEggs, markEggFound, markEventCompleted } from '@/lib/events'

type EggHuntContextValue = {
  /** The active event, or null if none. */
  event: EventRow | null
  /** All eggs for the active event. */
  eggs: EventEggRow[]
  /** IDs of eggs the user has found. */
  foundEggIds: Set<string>
  /** Total egg count for the event. */
  totalEggs: number
  /** Number of eggs found by the user. */
  foundCount: number
  /** Whether the user completed the event. */
  completed: boolean
  /** Whether we're still loading. */
  loading: boolean
  /** Egg for the current page path (if any). */
  getEggForPage: (pagePath: string) => EventEggRow | undefined
  /** Called when a user clicks an egg. Returns the egg description. */
  collectEgg: (eggId: string) => Promise<string | null>
}

const EggHuntContext = createContext<EggHuntContextValue | undefined>(undefined)

export function EggHuntProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [event, setEvent] = useState<EventRow | null>(null)
  const [eggs, setEggs] = useState<EventEggRow[]>([])
  const [foundEggIds, setFoundEggIds] = useState<Set<string>>(new Set())
  const [completed, setCompleted] = useState(false)
  const [loading, setLoading] = useState(true)

  // Load active event + eggs + user progress
  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      const activeEvent = await getActiveEvent()
      if (cancelled) return

      if (!activeEvent) {
        setEvent(null)
        setEggs([])
        setFoundEggIds(new Set())
        setCompleted(false)
        setLoading(false)
        return
      }

      setEvent(activeEvent)
      const allEggs = await getEventEggs(activeEvent.id)
      if (cancelled) return
      setEggs(allEggs)

      if (user) {
        const found = await getUserFoundEggs(activeEvent.id)
        if (cancelled) return
        const ids = new Set(found.map((f) => f.egg_id))
        setFoundEggIds(ids)
        setCompleted(ids.size >= allEggs.length && allEggs.length > 0)
      } else {
        // For logged-out users, use localStorage as fallback
        const stored = localStorage.getItem(`egg_hunt_${activeEvent.id}`)
        if (stored) {
          try {
            const ids = new Set(JSON.parse(stored) as string[])
            setFoundEggIds(ids)
            setCompleted(ids.size >= allEggs.length && allEggs.length > 0)
          } catch {
            setFoundEggIds(new Set())
          }
        }
      }
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [user])

  const getEggForPage = useCallback(
    (pagePath: string) => {
      if (!event) return undefined
      // Normalize: strip language prefix and trailing slashes
      const normalized = pagePath.replace(/^\/(en|fr)/, '').replace(/\/+$/, '') || '/'
      return eggs.find((e) => e.page_path === normalized)
    },
    [event, eggs],
  )

  const collectEgg = useCallback(
    async (eggId: string): Promise<string | null> => {
      if (!event) return null
      const egg = eggs.find((e) => e.id === eggId)
      if (!egg) return null

      // Already found
      if (foundEggIds.has(eggId)) return egg.description

      if (user) {
        const ok = await markEggFound(event.id, eggId, user.id)
        if (!ok) return null
      }

      const newFound = new Set(foundEggIds)
      newFound.add(eggId)
      setFoundEggIds(newFound)

      // Persist for logged-out users
      if (!user) {
        localStorage.setItem(`egg_hunt_${event.id}`, JSON.stringify([...newFound]))
      }

      // Check completion
      if (newFound.size >= eggs.length && eggs.length > 0) {
        setCompleted(true)
        if (user) {
          await markEventCompleted(event.id, user.id)
        }
      }

      return egg.description
    },
    [event, eggs, foundEggIds, user],
  )

  return (
    <EggHuntContext.Provider
      value={{
        event,
        eggs,
        foundEggIds,
        totalEggs: eggs.length,
        foundCount: foundEggIds.size,
        completed,
        loading,
        getEggForPage,
        collectEgg,
      }}
    >
      {children}
    </EggHuntContext.Provider>
  )
}

export function useEggHunt() {
  const ctx = useContext(EggHuntContext)
  if (!ctx) throw new Error('useEggHunt must be used within EggHuntProvider')
  return ctx
}
