import React from "react"
import { getUserTasksTodayCached, refreshUserTaskCache } from "@/lib/gardens"
import { addGardenBroadcastListener } from "@/lib/realtime"
import { supabase } from "@/lib/supabaseClient"

type UseTaskNotificationOptions = {
  channelKey?: string
}

const ERROR_LOGGED = new Set<string>()
const REFRESH_INTERVAL_MS = 30_000 // Refresh every 30 seconds (more responsive)

export function useTaskNotification(userId: string | null | undefined, options?: UseTaskNotificationOptions) {
  const channelKey = options?.channelKey ?? "default"
  const [hasUnfinished, setHasUnfinished] = React.useState(false)
  const mountedRef = React.useRef(false)
  const stateRef = React.useRef(false)
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
  }, [])

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
    
    // Throttle refreshes - don't refresh more than once per 500ms unless forced
    if (!forceRefreshCache && now - lastRefreshTimeRef.current < 500) {
      return stateRef.current
    }
    lastRefreshTimeRef.current = now

    try {
      // If forcing cache refresh, do it first (but don't wait too long)
      if (forceRefreshCache) {
        try {
          await Promise.race([
            refreshUserTaskCache(userId, today),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
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
    if (refreshTimerRef.current !== null) {
      window.clearTimeout(refreshTimerRef.current)
    }
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null
      void refreshNotification(forceCache)
    }, 80)
  }, [userId, refreshNotification, setState])

  // Initial mount: force cache refresh to ensure fresh data
  React.useEffect(() => {
    if (!userId) {
      setState(false)
      return
    }
    // On initial mount, force a cache refresh to ensure we have fresh data
    if (!initialRefreshDoneRef.current) {
      initialRefreshDoneRef.current = true
      void refreshNotification(true) // Force cache refresh on mount
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

  React.useEffect(() => {
    if (!userId) return
    if (typeof window === "undefined") return

    const channelName = `rt-task-badge-${channelKey}-${userId}`

    const channel = supabase.channel(channelName)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "garden_plant_task_occurrences",
      }, () => scheduleRefresh(true)) // Force cache refresh
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "garden_plant_tasks",
      }, () => scheduleRefresh(true)) // Force cache refresh
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "garden_plants",
      }, () => scheduleRefresh(true)) // Force cache refresh

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

export default useTaskNotification
