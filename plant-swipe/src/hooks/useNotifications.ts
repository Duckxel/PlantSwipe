/**
 * useNotifications Hook
 * 
 * React hook for managing notification state with realtime updates.
 * Optimised for fast badge updates: polls every 6 s while the tab is
 * visible, pauses when hidden, and re-fetches instantly on focus /
 * visibility change / broadcast events.  All data sources are queried
 * in a single parallel Promise.all to minimise latency.
 */

import React from 'react'
import { supabase } from '@/lib/supabaseClient'
import {
  getPendingGardenInvites,
  onNotificationRefresh
} from '@/lib/notifications'
import { getUnreadMessageCount } from '@/lib/messaging'
import { getUserTasksTodayCached } from '@/lib/gardens'
import type { GardenInvite, NotificationCounts } from '@/types/notification'

type FriendRequest = {
  id: string
  requester_id: string
  recipient_id: string
  created_at: string
  status: 'pending' | 'accepted' | 'rejected'
  requester_profile?: {
    id: string
    display_name: string | null
  }
}

interface UseNotificationsOptions {
  /** Polling interval in ms (default: 6000) */
  pollInterval?: number
  /** Channel key for realtime subscriptions */
  channelKey?: string
}

interface UseNotificationsReturn {
  /** Total count of actionable items (friend requests + garden invites + tasks) */
  totalCount: number
  /** Breakdown of notification counts */
  counts: NotificationCounts
  /** Pending friend requests */
  friendRequests: FriendRequest[]
  /** Pending garden invites */
  gardenInvites: GardenInvite[]
  /** Loading state */
  loading: boolean
  /** Error message if any */
  error: string | null
  /** Refresh all notification data (pass true to force bypass throttle) */
  refresh: (force?: boolean) => Promise<void>
  /** Whether there are any unread notifications */
  hasUnread: boolean
}

const ERROR_LOGGED = new Set<string>()
const MAX_ERROR_LOG_SIZE = 50
const POLL_INTERVAL_MS = 6_000

function trackError(key: string): boolean {
  if (ERROR_LOGGED.has(key)) return false
  if (ERROR_LOGGED.size >= MAX_ERROR_LOG_SIZE) ERROR_LOGGED.clear()
  ERROR_LOGGED.add(key)
  return true
}

const EMPTY_COUNTS: NotificationCounts = {
  total: 0,
  unread: 0,
  friendRequests: 0,
  gardenInvites: 0,
  unreadMessages: 0,
  pendingTasks: 0,
}

export function useNotifications(
  userId: string | null | undefined,
  options?: UseNotificationsOptions
): UseNotificationsReturn {
  const channelKey = options?.channelKey ?? 'default'
  const pollInterval = options?.pollInterval ?? POLL_INTERVAL_MS

  const [counts, setCounts] = React.useState<NotificationCounts>(EMPTY_COUNTS)
  const [friendRequests, setFriendRequests] = React.useState<FriendRequest[]>([])
  const [gardenInvites, setGardenInvites] = React.useState<GardenInvite[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const mountedRef = React.useRef(true)
  const lastRefreshRef = React.useRef<number>(0)

  const refresh = React.useCallback(async (force?: boolean) => {
    if (!userId) {
      setCounts(EMPTY_COUNTS)
      setFriendRequests([])
      setGardenInvites([])
      setLoading(false)
      return
    }

    const now = Date.now()
    if (!force && now - lastRefreshRef.current < 400) return
    lastRefreshRef.current = now

    try {
      const today = new Date().toISOString().slice(0, 10)

      // Single parallel batch — every data source at once
      const [
        friendRequestsData,
        gardenInvitesData,
        unreadMsgCount,
        taskData,
      ] = await Promise.all([
        loadFriendRequests(userId),
        getPendingGardenInvites(userId).catch(() => [] as GardenInvite[]),
        getUnreadMessageCount().catch(() => 0),
        getUserTasksTodayCached(userId, today).catch(() => ({
          gardensWithRemainingTasks: 0,
          totalDueCount: 0,
          totalCompletedCount: 0,
        })),
      ])

      if (!mountedRef.current) return

      const friendRequestCount = friendRequestsData.length
      const gardenInviteCount = gardenInvitesData.length
      const pendingTaskCount = Math.max(
        0,
        (taskData.totalDueCount || 0) - (taskData.totalCompletedCount || 0),
      )

      const mergedCounts: NotificationCounts = {
        total: friendRequestCount + gardenInviteCount + unreadMsgCount,
        unread: 0,
        friendRequests: friendRequestCount,
        gardenInvites: gardenInviteCount,
        unreadMessages: unreadMsgCount,
        pendingTasks: pendingTaskCount,
      }

      setCounts(mergedCounts)
      setFriendRequests(friendRequestsData)
      setGardenInvites(gardenInvitesData)
      setError(null)
    } catch (e: unknown) {
      if (trackError('notifications')) {
        console.warn('[useNotifications] Failed to load notifications:', e)
      }
      if (mountedRef.current) {
        setError(
          e instanceof Error ? e.message : 'Failed to load notifications',
        )
      }
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [userId])

  // Initial load
  React.useEffect(() => {
    mountedRef.current = true
    refresh()
    return () => { mountedRef.current = false }
  }, [refresh])

  // Polling — only ticks while the tab is visible, pauses when hidden
  React.useEffect(() => {
    if (!userId || typeof window === 'undefined') return

    let timer: ReturnType<typeof setInterval> | null = null

    function start() {
      stop()
      timer = setInterval(() => {
        if (document.visibilityState === 'visible') refresh()
      }, pollInterval)
    }
    function stop() {
      if (timer) { clearInterval(timer); timer = null }
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        refresh(true)
        start()
      } else {
        stop()
      }
    }

    const onFocus = () => refresh(true)

    start()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onFocus)

    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onFocus)
    }
  }, [userId, pollInterval, refresh])

  // Listen for broadcast refresh events from other components
  React.useEffect(() => {
    if (!userId) return
    return onNotificationRefresh(() => refresh(true))
  }, [userId, refresh])

  // Realtime subscriptions
  React.useEffect(() => {
    if (!userId || typeof window === 'undefined') return

    const channelName = `notifications-${channelKey}-${userId}`
    const channel = supabase.channel(channelName)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'friend_requests',
        filter: `recipient_id=eq.${userId}`
      }, () => refresh(true))
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'friend_requests',
        filter: `requester_id=eq.${userId}`
      }, () => refresh(true))
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'garden_invites',
        filter: `invitee_id=eq.${userId}`
      }, () => refresh(true))
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages'
      }, () => refresh(true))

    channel.subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        console.warn('[useNotifications] Realtime channel error, falling back to polling')
      }
    })

    return () => {
      try { supabase.removeChannel(channel) } catch {}
    }
  }, [userId, channelKey, refresh])

  const totalCount = counts.friendRequests + counts.gardenInvites + counts.pendingTasks
  const hasUnread = totalCount > 0

  return {
    totalCount,
    counts,
    friendRequests,
    gardenInvites,
    loading,
    error,
    refresh,
    hasUnread
  }
}

/**
 * Load pending friend requests with requester profiles in one pass.
 * This replaces both the old getNotificationCounts friend-request query
 * AND the separate loadFriendRequests — avoiding a duplicate round-trip.
 */
async function loadFriendRequests(userId: string): Promise<FriendRequest[]> {
  const { data, error } = await supabase
    .from('friend_requests')
    .select('id, requester_id, recipient_id, created_at, status')
    .eq('recipient_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) {
    if (error.message?.includes('does not exist')) return []
    throw error
  }

  if (!data || data.length === 0) return []

  const requesterIds = data.map(r => r.requester_id)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name')
    .in('id', requesterIds)

  const profileMap = new Map((profiles || []).map(p => [p.id, p]))

  return data.map(r => ({
    ...r,
    requester_profile: profileMap.get(r.requester_id) || { id: r.requester_id, display_name: null }
  }))
}

export default useNotifications
