import React from "react"
import { getUserTasksTodayCached, refreshUserTaskCache } from "@/lib/gardens"
import { addGardenBroadcastListener } from "@/lib/realtime"
import { supabase } from "@/lib/supabaseClient"

type UseTaskNotificationOptions = {
  channelKey?: string
}

const ERROR_LOGGED = new Set<string>()
const REFRESH_INTERVAL_MS = 15_000 // ⚡ Reduced from 30s to 15s for more responsive updates
const LOCALSTORAGE_KEY = "task_notification_state"
const LOCALSTORAGE_SYNC_KEY = "task_notification_sync" // For cross-tab sync

// ⚡ Shared state across all hook instances for instant sync
let sharedHasUnfinished: boolean | null = null
let sharedUserId: string | null = null
const sharedListeners = new Set<(value: boolean) => void>()

function notifySharedListeners(value: boolean) {
  sharedHasUnfinished = value
  sharedListeners.forEach(listener => listener(value))
}

// ⚡ Read from localStorage on module load for instant initial state
function getPersistedState(userId: string | null): boolean {
  if (!userId || typeof window === "undefined") return false
  // First check shared state (fastest - already in memory)
  if (sharedHasUnfinished !== null && sharedUserId === userId) return sharedHasUnfinished
  // Then check localStorage
  try {
    const stored = localStorage.getItem(LOCALSTORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      // Only use if for same user and not too old (1 hour)
      if (parsed.userId === userId && Date.now() - parsed.timestamp < 3600000) {
        sharedHasUnfinished = parsed.hasUnfinished
        sharedUserId = userId
        return parsed.hasUnfinished
      }
    }
  } catch {
    // Ignore localStorage errors
  }
  return false
}

function persistState(userId: string, hasUnfinished: boolean) {
  if (typeof window === "undefined") return
  sharedUserId = userId
  try {
    const data = {
      userId,
      hasUnfinished,
      timestamp: Date.now()
    }
    localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(data))
    // ⚡ Also write to sync key to trigger storage events in other tabs
    localStorage.setItem(LOCALSTORAGE_SYNC_KEY, JSON.stringify({
      ...data,
      nonce: Math.random() // Ensure storage event fires even if value is same
    }))
  } catch {
    // Ignore localStorage errors
  }
}

export function useTaskNotification(userId: string | null | undefined, options?: UseTaskNotificationOptions) {
  const channelKey = options?.channelKey ?? "default"
  // ⚡ Initialize with persisted state for instant display
  const [hasUnfinished, setHasUnfinished] = React.useState(() => getPersistedState(userId ?? null))
  const mountedRef = React.useRef(false)
  const stateRef = React.useRef(hasUnfinished)
  const requestRef = React.useRef(0)
  const refreshTimerRef = React.useRef<number | null>(null)
  const intervalRef = React.useRef<number | null>(null)
  const initialRefreshDoneRef = React.useRef(false)
  const lastRefreshTimeRef = React.useRef<number>(0)

  const setState = React.useCallback((value: boolean) => {
    stateRef.current = value
    if (mountedRef.current) {
      setHasUnfinished(value)
    }
    // ⚡ Persist and sync across all hook instances
    if (userId) {
      persistState(userId, value)
      notifySharedListeners(value)
    }
  }, [userId])

  // ⚡ Subscribe to shared state updates from other hook instances
  React.useEffect(() => {
    const listener = (value: boolean) => {
      stateRef.current = value
      if (mountedRef.current) {
        setHasUnfinished(value)
      }
    }
    sharedListeners.add(listener)
    return () => {
      sharedListeners.delete(listener)
    }
  }, [])

  // ⚡ Cross-tab synchronization using storage events
  React.useEffect(() => {
    if (!userId || typeof window === "undefined") return

    const handleStorageChange = (e: StorageEvent) => {
      // Listen for changes to the sync key from other tabs
      if (e.key === LOCALSTORAGE_SYNC_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue)
          if (parsed.userId === userId) {
            stateRef.current = parsed.hasUnfinished
            if (mountedRef.current) {
              setHasUnfinished(parsed.hasUnfinished)
            }
            sharedHasUnfinished = parsed.hasUnfinished
          }
        } catch {
          // Ignore parse errors
        }
      }
    }

    window.addEventListener("storage", handleStorageChange)
    return () => window.removeEventListener("storage", handleStorageChange)
  }, [userId])

  const clearRefreshTimer = React.useCallback(() => {
    if (typeof window === "undefined") return
    if (refreshTimerRef.current !== null) {
      window.clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = null
    }
  }, [])

  const clearInterval = React.useCallback(() => {
    if (typeof window === "undefined") return
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  React.useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      clearRefreshTimer()
      clearInterval()
    }
  }, [clearRefreshTimer, clearInterval])

  const refreshNotification = React.useCallback(async (forceRefreshCache = false) => {
    const nextRequest = requestRef.current + 1
    requestRef.current = nextRequest

    if (!userId) {
      setState(false)
      return false
    }

    const now = Date.now()
    const today = new Date().toISOString().slice(0, 10)
    
    // ⚡ Reduced throttle from 500ms to 100ms for more responsive updates
    if (!forceRefreshCache && now - lastRefreshTimeRef.current < 100) {
      return stateRef.current
    }
    lastRefreshTimeRef.current = now

    try {
      // If forcing cache refresh, do it first (but don't wait too long)
      if (forceRefreshCache) {
        try {
          await Promise.race([
            refreshUserTaskCache(userId, today),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
          ])
        } catch {
          // Ignore timeout/errors - continue with cached read
        }
      }

      const tasks = await getUserTasksTodayCached(userId, today)
      const has = tasks.gardensWithRemainingTasks > 0 || tasks.totalDueCount > tasks.totalCompletedCount
      if (mountedRef.current && requestRef.current === nextRequest) {
        setState(has)
      }
      return has
    } catch (error) {
      if (!ERROR_LOGGED.has("task-badge")) {
        ERROR_LOGGED.add("task-badge")
        console.warn("[task-badge] failed to refresh notification state; keeping previous value", error)
      }
      return stateRef.current
    }
  }, [userId, setState])

  const scheduleRefresh = React.useCallback((forceCache = true) => {
    if (!userId) {
      setState(false)
      return
    }
    if (typeof window === "undefined") {
      void refreshNotification(forceCache)
      return
    }
    // ⚡ Clear any pending refresh and execute immediately (no 80ms delay)
    if (refreshTimerRef.current !== null) {
      window.clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = null
    }
    // Execute immediately for responsiveness
    void refreshNotification(forceCache)
  }, [userId, refreshNotification, setState])

  // Initial mount: fast check then background refresh
  React.useEffect(() => {
    if (!userId) {
      setState(false)
      return
    }
    
    // On initial mount:
    // 1. First, do a FAST check from cache (no refresh) for instant feedback
    // 2. Then, do a background refresh to ensure data is fresh
    if (!initialRefreshDoneRef.current) {
      initialRefreshDoneRef.current = true
      
      // Fast path: read from cache immediately (don't force refresh)
      void refreshNotification(false).then(() => {
        // Background: refresh cache after initial read completes
        // Use requestIdleCallback to avoid blocking
        if ("requestIdleCallback" in window) {
          window.requestIdleCallback(() => {
            void refreshNotification(true)
          }, { timeout: 2000 })
        } else {
          setTimeout(() => {
            void refreshNotification(true)
          }, 500)
        }
      })
    } else {
      void refreshNotification()
    }
  }, [userId, refreshNotification, setState])

  // Periodic refresh interval
  React.useEffect(() => {
    if (!userId || typeof window === "undefined") return
    
    clearInterval()
    intervalRef.current = window.setInterval(() => {
      void refreshNotification()
    }, REFRESH_INTERVAL_MS)
    
    return () => clearInterval()
  }, [userId, refreshNotification, clearInterval])

  // Visibility change: refresh when tab becomes visible
  React.useEffect(() => {
    if (!userId || typeof window === "undefined") return
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshNotification(true) // Force cache refresh when tab becomes visible
      }
    }
    
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [userId, refreshNotification])

  // Focus event: refresh when window gains focus
  React.useEffect(() => {
    if (!userId || typeof window === "undefined") return
    
    const handleFocus = () => {
      void refreshNotification()
    }
    
    window.addEventListener("focus", handleFocus)
    return () => window.removeEventListener("focus", handleFocus)
  }, [userId, refreshNotification])

  // ⚡ Route change detection - refresh when navigating between pages
  React.useEffect(() => {
    if (!userId || typeof window === "undefined") return

    // Listen for popstate (browser back/forward)
    const handlePopState = () => {
      void refreshNotification(true)
    }

    // Listen for pushState/replaceState via custom event
    const handleRouteChange = () => {
      void refreshNotification(true)
    }

    window.addEventListener("popstate", handlePopState)
    window.addEventListener("routechange", handleRouteChange)

    // Monkey-patch history methods to detect SPA navigation
    const originalPushState = history.pushState.bind(history)
    const originalReplaceState = history.replaceState.bind(history)

    history.pushState = function (...args) {
      originalPushState(...args)
      void refreshNotification(true)
    }

    history.replaceState = function (...args) {
      originalReplaceState(...args)
      // Don't refresh on replaceState to avoid loops, just dispatch event
    }

    return () => {
      window.removeEventListener("popstate", handlePopState)
      window.removeEventListener("routechange", handleRouteChange)
      history.pushState = originalPushState
      history.replaceState = originalReplaceState
    }
  }, [userId, refreshNotification])

  React.useEffect(() => {
    if (!userId || typeof window === "undefined") return
    const handler = () => { void refreshNotification() }
    try {
      window.addEventListener("garden:tasks_changed", handler as EventListener)
    } catch {}
    return () => {
      try { window.removeEventListener("garden:tasks_changed", handler as EventListener) } catch {}
    }
  }, [userId, refreshNotification])

  React.useEffect(() => {
    if (!userId) return
    let active = true
    let teardown: (() => Promise<void>) | null = null

    addGardenBroadcastListener((message) => {
      if (!active) return
      if (message.kind === "tasks" || message.kind === "general") {
        scheduleRefresh(true) // Always force cache refresh on broadcast
      }
    })
      .then((unsubscribe) => {
        if (!active) {
          unsubscribe().catch(() => {})
        } else {
          teardown = unsubscribe
        }
      })
      .catch(() => {})

    return () => {
      active = false
      if (teardown) teardown().catch(() => {})
    }
  }, [userId, scheduleRefresh])

  // ⚡ Subscribe to user-specific task cache updates
  // Instead of subscribing to all table changes (noisy), we subscribe to cache table changes
  // which are filtered by user_id
  React.useEffect(() => {
    if (!userId) return
    if (typeof window === "undefined") return

    const channelName = `rt-task-badge-${channelKey}-${userId}`

    const channel = supabase.channel(channelName)
      // Listen for changes to user's task cache (much more targeted than all occurrences)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "user_task_daily_cache",
        filter: `user_id=eq.${userId}`,
      }, () => {
        // Cache was updated, refresh immediately
        scheduleRefresh(false) // Don't need to refresh cache, just read it
      })
      // Also listen for garden-level cache changes that might affect this user
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "garden_task_daily_cache",
      }, () => {
        // Garden cache changed, might affect our count
        scheduleRefresh(true)
      })

    const subscription = channel.subscribe()
    if (subscription instanceof Promise) {
      subscription.catch(() => {})
    }

    return () => {
      clearRefreshTimer()
      try { supabase.removeChannel(channel) } catch {}
    }
  }, [userId, channelKey, scheduleRefresh, clearRefreshTimer])

  return { hasUnfinished, refresh: refreshNotification }
}

/**
 * ⚡ Utility function to immediately update task notification state from external sources
 * Call this when you have fresh task data (e.g., in GardenListPage after loading)
 * This provides instant feedback without waiting for cache refresh
 */
export function updateTaskNotificationState(userId: string, hasUnfinished: boolean) {
  if (!userId) return
  persistState(userId, hasUnfinished)
  notifySharedListeners(hasUnfinished)
  // Also dispatch custom event for any listeners
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new CustomEvent("garden:tasks_changed"))
    } catch {
      // Ignore
    }
  }
}

export default useTaskNotification
