import React, { createContext, useContext, useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import type { EventRow, EventItemRow } from '@/types/event'
import { getActiveEvent, getEventItems, getUserProgress, markItemFound, markEventCompleted } from '@/lib/events'

type EggHuntContextValue = {
  /** The active event, or null if none. */
  event: EventRow | null
  /** All items (eggs) for the active event. */
  items: EventItemRow[]
  /** IDs of items the user has found. */
  foundItemIds: Set<string>
  /** Total item count for the event. */
  totalItems: number
  /** Number of items found by the user. */
  foundCount: number
  /** Whether the user completed the event. */
  completed: boolean
  /** Whether we're still loading. */
  loading: boolean
  /** Item for the current page path (if any). */
  getItemForPage: (pagePath: string) => EventItemRow | undefined
  /** Called when a user clicks an item. Returns the item description. */
  collectItem: (itemId: string) => Promise<string | null>
}

const EggHuntContext = createContext<EggHuntContextValue | undefined>(undefined)

export function EggHuntProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [event, setEvent] = useState<EventRow | null>(null)
  const [items, setItems] = useState<EventItemRow[]>([])
  const [foundItemIds, setFoundItemIds] = useState<Set<string>>(new Set())
  const [completed, setCompleted] = useState(false)
  const [loading, setLoading] = useState(true)

  // Load active event + items + user progress
  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      const activeEvent = await getActiveEvent()
      if (cancelled) return

      if (!activeEvent) {
        setEvent(null)
        setItems([])
        setFoundItemIds(new Set())
        setCompleted(false)
        setLoading(false)
        return
      }

      setEvent(activeEvent)
      const allItems = await getEventItems(activeEvent.id)
      if (cancelled) return
      setItems(allItems)

      if (user) {
        const progress = await getUserProgress(activeEvent.id)
        if (cancelled) return
        const ids = new Set(progress.map((p) => p.item_id))
        setFoundItemIds(ids)
        setCompleted(ids.size >= allItems.length && allItems.length > 0)
      } else {
        // For logged-out users, use localStorage as fallback
        const stored = localStorage.getItem(`event_progress_${activeEvent.id}`)
        if (stored) {
          try {
            const ids = new Set(JSON.parse(stored) as string[])
            setFoundItemIds(ids)
            setCompleted(ids.size >= allItems.length && allItems.length > 0)
          } catch {
            setFoundItemIds(new Set())
          }
        }
      }
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [user])

  const getItemForPage = useCallback(
    (pagePath: string) => {
      if (!event) return undefined
      // Normalize: strip language prefix and trailing slashes
      const normalized = pagePath.replace(/^\/(en|fr)/, '').replace(/\/+$/, '') || '/'
      return items.find((item) => item.page_path === normalized)
    },
    [event, items],
  )

  const collectItem = useCallback(
    async (itemId: string): Promise<string | null> => {
      if (!event) return null
      const item = items.find((i) => i.id === itemId)
      if (!item) return null

      // Already found
      if (foundItemIds.has(itemId)) return item.description

      if (user) {
        const ok = await markItemFound(event.id, itemId, user.id)
        if (!ok) return null
      }

      const newFound = new Set(foundItemIds)
      newFound.add(itemId)
      setFoundItemIds(newFound)

      // Persist for logged-out users
      if (!user) {
        localStorage.setItem(`event_progress_${event.id}`, JSON.stringify([...newFound]))
      }

      // Check completion
      if (newFound.size >= items.length && items.length > 0) {
        setCompleted(true)
        if (user) {
          await markEventCompleted(event.id, user.id)
        }
      }

      return item.description
    },
    [event, items, foundItemIds, user],
  )

  return (
    <EggHuntContext.Provider
      value={{
        event,
        items,
        foundItemIds,
        totalItems: items.length,
        foundCount: foundItemIds.size,
        completed,
        loading,
        getItemForPage,
        collectItem,
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
