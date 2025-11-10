import React from "react"
import { getUserTasksTodayCached } from "@/lib/gardens"
import { addGardenBroadcastListener } from "@/lib/realtime"
import { supabase } from "@/lib/supabaseClient"

type UseTaskNotificationOptions = {
  channelKey?: string
}

const ERROR_LOGGED = new Set<string>()

export function useTaskNotification(userId: string | null | undefined, options?: UseTaskNotificationOptions) {
  const channelKey = options?.channelKey ?? "default"
  const [hasUnfinished, setHasUnfinished] = React.useState(false)
  const mountedRef = React.useRef(false)
  const stateRef = React.useRef(false)
  const requestRef = React.useRef(0)
  const refreshTimerRef = React.useRef<number | null>(null)

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

  React.useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      clearRefreshTimer()
    }
  }, [clearRefreshTimer])

  const refreshNotification = React.useCallback(async () => {
    const nextRequest = requestRef.current + 1
    requestRef.current = nextRequest

    if (!userId) {
      setState(false)
      return false
    }

    const today = new Date().toISOString().slice(0, 10)

    try {
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

  const scheduleRefresh = React.useCallback(() => {
    if (!userId) {
      setState(false)
      return
    }
    if (typeof window === "undefined") {
      void refreshNotification()
      return
    }
    if (refreshTimerRef.current !== null) {
      window.clearTimeout(refreshTimerRef.current)
    }
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null
      void refreshNotification()
    }, 80)
  }, [userId, refreshNotification, setState])

  React.useEffect(() => {
    if (!userId) {
      setState(false)
      return
    }
    void refreshNotification()
  }, [userId, refreshNotification, setState])

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
        scheduleRefresh()
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
      }, () => scheduleRefresh())
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "garden_plant_tasks",
      }, () => scheduleRefresh())
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "garden_plants",
      }, () => scheduleRefresh())

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
