import React from "react"
import { useAuth } from "@/context/AuthContext"

export type Notification = {
  id: string
  title: string
  message: string
  delivery_status: string
  delivered_at: string | null
  scheduled_for: string
  seen_at: string | null
  cta_url: string | null
  payload: any
}

export function useNotifications() {
  const { user } = useAuth()
  const [notifications, setNotifications] = React.useState<Notification[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // Track unseen count
  const unseenCount = React.useMemo(() => {
    return notifications.filter(n => !n.seen_at).length
  }, [notifications])

  const fetchNotifications = React.useCallback(async () => {
    if (!user) {
      setNotifications([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const res = await fetch('/api/notifications')
      if (!res.ok) {
        throw new Error('Failed to fetch notifications')
      }
      const data = await res.json()
      setNotifications(Array.isArray(data.notifications) ? data.notifications : [])
      setError(null)
    } catch (err: any) {
      console.error('Error fetching notifications:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user])

  const markAsRead = React.useCallback(async (id: string) => {
    // Optimistic update
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, seen_at: new Date().toISOString() } : n))

    try {
      await fetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
        method: 'POST'
      })
    } catch (err) {
      console.error('Error marking notification as read:', err)
      // Revert if needed, but usually fine to just log
    }
  }, [])

  const markAllAsRead = React.useCallback(async () => {
    const unseenIds = notifications.filter(n => !n.seen_at).map(n => n.id)
    if (unseenIds.length === 0) return

    // Optimistic update
    setNotifications(prev => prev.map(n => ({ ...n, seen_at: n.seen_at || new Date().toISOString() })))

    try {
      // We don't have a bulk read endpoint yet, so we loop or could add one.
      // For now, let's just do it individually in parallel (limit concurrency if needed)
      // Or better, assume the server handles it if we refresh.
      // But let's try to send requests.
      await Promise.all(unseenIds.map(id =>
        fetch(`/api/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' })
      ))
    } catch (err) {
      console.error('Error marking all as read:', err)
    }
  }, [notifications])

  // Initial fetch
  React.useEffect(() => {
    fetchNotifications()

    // Poll every minute
    const interval = setInterval(fetchNotifications, 60000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  return {
    notifications,
    loading,
    error,
    unseenCount,
    refresh: fetchNotifications,
    markAsRead,
    markAllAsRead
  }
}
