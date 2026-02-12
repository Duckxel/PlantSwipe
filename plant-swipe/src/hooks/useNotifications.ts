/**
 * useNotifications Hook
 * 
 * React hook for managing notification state with realtime updates.
 */

import React from 'react'
import { supabase } from '@/lib/supabaseClient'
import {
  getNotificationCounts,
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
  /** Polling interval in ms (default: 30000) */
  pollInterval?: number
  /** Channel key for realtime subscriptions */
  channelKey?: string
}

interface UseNotificationsReturn {
  /** Total count of actionable items (friend requests + garden invites) */
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
const MAX_ERROR_LOG_SIZE = 50 // Limit the number of unique errors we track
const REFRESH_INTERVAL_MS = 15_000 // Poll every 15 seconds as fallback

function trackError(key: string): boolean {
  if (ERROR_LOGGED.has(key)) return false
  // If we've tracked too many errors, clear and start fresh
  if (ERROR_LOGGED.size >= MAX_ERROR_LOG_SIZE) {
    ERROR_LOGGED.clear()
  }
  ERROR_LOGGED.add(key)
  return true
}

export function useNotifications(
  userId: string | null | undefined,
  options?: UseNotificationsOptions
): UseNotificationsReturn {
  const channelKey = options?.channelKey ?? 'default'
  const pollInterval = options?.pollInterval ?? REFRESH_INTERVAL_MS

  const [counts, setCounts] = React.useState<NotificationCounts>({
    total: 0,
    unread: 0,
    friendRequests: 0,
    gardenInvites: 0,
    unreadMessages: 0,
    pendingTasks: 0
  })
  const [friendRequests, setFriendRequests] = React.useState<FriendRequest[]>([])
  const [gardenInvites, setGardenInvites] = React.useState<GardenInvite[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const mountedRef = React.useRef(true)
  const lastRefreshRef = React.useRef<number>(0)

  const refresh = React.useCallback(async (force?: boolean) => {
    if (!userId) {
      setCounts({ total: 0, unread: 0, friendRequests: 0, gardenInvites: 0, unreadMessages: 0, pendingTasks: 0 })
      setFriendRequests([])
      setGardenInvites([])
      setLoading(false)
      return
    }

    // Throttle refreshes to max once per 500ms (unless forced)
    const now = Date.now()
    if (!force && now - lastRefreshRef.current < 500) {
      return
    }
    lastRefreshRef.current = now

    try {
      const today = new Date().toISOString().slice(0, 10)

      // Fetch all data in parallel
      const [countsData, friendRequestsData, gardenInvitesData, unreadMsgCount, taskData] = await Promise.all([
        getNotificationCounts(userId),
        loadFriendRequests(userId),
        getPendingGardenInvites(userId).catch(() => []),
        getUnreadMessageCount().catch(() => 0),
        getUserTasksTodayCached(userId, today).catch(() => ({ gardensWithRemainingTasks: 0, totalDueCount: 0, totalCompletedCount: 0 }))
      ])

      if (!mountedRef.current) return

      // Calculate pending tasks count
      const pendingTaskCount = Math.max(0, (taskData.totalDueCount || 0) - (taskData.totalCompletedCount || 0))

      // Merge message count and task count into countsData
      const mergedCounts = {
        ...countsData,
        unreadMessages: unreadMsgCount,
        pendingTasks: pendingTaskCount,
        total: countsData.total + unreadMsgCount
      }

      setCounts(mergedCounts)
      setFriendRequests(friendRequestsData)
      setGardenInvites(gardenInvitesData)
      setError(null)
    } catch (e: any) {
      if (trackError('notifications')) {
        console.warn('[useNotifications] Failed to load notifications:', e)
      }
      if (mountedRef.current) {
        setError(e?.message || 'Failed to load notifications')
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }, [userId])

  // Initial load
  React.useEffect(() => {
    mountedRef.current = true
    refresh()
    return () => {
      mountedRef.current = false
    }
  }, [refresh])

  // Polling interval
  React.useEffect(() => {
    if (!userId || typeof window === 'undefined') return

    const intervalId = window.setInterval(() => {
      refresh()
    }, pollInterval)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [userId, pollInterval, refresh])

  // Visibility change - refresh when tab becomes visible
  React.useEffect(() => {
    if (!userId || typeof window === 'undefined') return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [userId, refresh])

  // Listen for broadcast refresh events from other components
  React.useEffect(() => {
    if (!userId) return
    
    return onNotificationRefresh(() => {
      refresh(true)
    })
  }, [userId, refresh])

  // Realtime subscriptions
  React.useEffect(() => {
    if (!userId || typeof window === 'undefined') return

    const channelName = `notifications-${channelKey}-${userId}`
    const channel = supabase.channel(channelName)
      // Listen for friend request changes (both as recipient and requester)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'friend_requests',
        filter: `recipient_id=eq.${userId}`
      }, () => {
        // Force refresh to bypass throttle for realtime events
        refresh(true)
      })
      // Also listen for changes where user is the requester (to update sent requests)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'friend_requests',
        filter: `requester_id=eq.${userId}`
      }, () => {
        refresh(true)
      })
      // Listen for garden invite changes
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'garden_invites',
        filter: `invitee_id=eq.${userId}`
      }, () => {
        refresh(true)
      })
      // Listen for new messages (via conversations that user is part of)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages'
      }, () => {
        refresh(true)
      })

    // Subscribe with status callback for debugging
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        // Successfully subscribed to realtime updates
      } else if (status === 'CHANNEL_ERROR') {
        console.warn('[useNotifications] Realtime channel error, falling back to polling')
      }
    })

    return () => {
      try {
        supabase.removeChannel(channel)
      } catch {}
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
 * Load pending friend requests for a user
 */
async function loadFriendRequests(userId: string): Promise<FriendRequest[]> {
  const { data, error } = await supabase
    .from('friend_requests')
    .select('id, requester_id, recipient_id, created_at, status')
    .eq('recipient_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) {
    if (error.message?.includes('does not exist')) {
      return []
    }
    throw error
  }

  if (!data || data.length === 0) return []

  // Get requester profiles
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
