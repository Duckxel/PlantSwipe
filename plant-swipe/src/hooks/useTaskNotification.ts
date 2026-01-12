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

/**
 * ⚡ Fast direct query to check if user has pending tasks today
 * This bypasses the cache system for faster first-load response
 * Returns null if query fails (caller should fallback to cache)
 */
async function fastCheckPendingTasks(userId: string): Promise<boolean | null> {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const startOfDay = `${today}T00:00:00.000Z`
    const endOfDay = `${today}T23:59:59.999Z`

    // First, get user's garden IDs (fast query)
    const { data: gardens, error: gardensError } = await supabase
      .from("garden_members")
      .select("garden_id")
      .eq("user_id", userId)
    
    if (gardensError || !gardens || gardens.length === 0) {
      return null // Fallback to cache
    }

    const gardenIds = gardens.map(g => g.garden_id)

    // Quick check: are there ANY incomplete task occurrences for today in user's gardens?
    // This is a fast COUNT query with LIMIT 1 (we just need to know if any exist)
    // Note: garden_plant_task_occurrences doesn't have garden_id directly, need to join through garden_plant_tasks
    const { count, error: countError } = await supabase
      .from("garden_plant_task_occurrences")
      .select("id, garden_plant_tasks!inner(garden_id)", { count: "exact", head: true })
      .gte("due_at", startOfDay)
      .lte("due_at", endOfDay)
      .in("garden_plant_tasks.garden_id", gardenIds)
      .or("completed_at.is.null,completed_count.lt.required_count")
      .limit(1)

    if (countError) {
      // Try alternative approach: check if completed_count < required_count
      const { data: incomplete, error: incompleteError } = await supabase
        .from("garden_plant_task_occurrences")
        .select("id, completed_count, required_count, garden_plant_tasks!inner(garden_id)")
        .gte("due_at", startOfDay)
        .lte("due_at", endOfDay)
        .in("garden_plant_tasks.garden_id", gardenIds)
        .is("completed_at", null)
        .limit(1)

      if (incompleteError) {
        return null // Fallback to cache
      }

      return incomplete && incomplete.length > 0
    }

    return (count ?? 0) > 0
  } catch {
    return null // Fallback to cache
  }
}

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

  const refreshNotification = React.useCallback(async (forceRefreshCache = false, skipThrottle = false) => {
    const nextRequest = requestRef.current + 1
    requestRef.current = nextRequest

    if (!userId) {
      setState(false)
      return false
    }

    const now = Date.now()
    const today = new Date().toISOString().slice(0, 10)
    
    // ⚡ Skip throttle on first call or when explicitly requested
    if (!skipThrottle && !forceRefreshCache && now - lastRefreshTimeRef.current < 100) {
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

  // Initial mount: aggressive check for first-time visitors
  React.useEffect(() => {
    if (!userId) {
      setState(false)
      return
    }
    
    // On initial mount:
    // For first-time visitors, we run TWO checks in parallel for fastest response:
    // 1. Fast direct query (bypasses cache, very quick)
    // 2. Cache-based check (more accurate, may be slower)
    if (!initialRefreshDoneRef.current) {
      initialRefreshDoneRef.current = true
      
      // ⚡ Run fast check and cache check in parallel
      // The fast check will update UI immediately if it finds tasks
      // The cache check will update with accurate data shortly after
      
      // Fast path: direct database query (fastest for first-time visitors)
      fastCheckPendingTasks(userId).then((hasTasksFast) => {
        if (hasTasksFast !== null && mountedRef.current) {
          // Fast check succeeded - update immediately
          setState(hasTasksFast)
        }
      }).catch(() => {
        // Ignore fast check errors - cache check will handle it
      })

      // Normal path: cache-based check (more accurate)
      // Skip throttle (true) to ensure this runs immediately
      void refreshNotification(true, true)
    } else {
      void refreshNotification(false, false)
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
