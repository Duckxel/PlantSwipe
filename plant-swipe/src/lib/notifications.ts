/**
 * Notification System Library
 * 
 * Functions for managing in-app notifications, garden invites, and realtime subscriptions.
 */

import { supabase } from './supabaseClient'
import type { 
  Notification, 
  NotificationType, 
  NotificationStatus, 
  GardenInvite, 
  GardenInviteStatus,
  NotificationCounts 
} from '@/types/notification'

// ===== Notification CRUD =====

/**
 * Get all notifications for a user
 */
export async function getUserNotifications(
  userId: string,
  options?: { 
    status?: NotificationStatus
    limit?: number
    offset?: number 
  }
): Promise<Notification[]> {
  let query = supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (options?.status) {
    query = query.eq('status', options.status)
  }
  if (options?.limit) {
    query = query.limit(options.limit)
  }
  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 50) - 1)
  }

  const { data, error } = await query

  if (error) {
    // If table doesn't exist, return empty array
    if (error.message?.includes('does not exist') || error.code === '42P01') {
      console.warn('[notifications] Table does not exist yet')
      return []
    }
    throw new Error(error.message)
  }

  return (data || []).map(mapNotificationRow)
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'unread')

  if (error) {
    if (error.message?.includes('does not exist') || error.code === '42P01') {
      return 0
    }
    throw new Error(error.message)
  }

  return count || 0
}

/**
 * Get notification counts breakdown
 */
export async function getNotificationCounts(userId: string): Promise<NotificationCounts> {
  try {
    // Get total unread count
    const { count: unreadCount, error: unreadError } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'unread')

    if (unreadError && !unreadError.message?.includes('does not exist')) {
      throw unreadError
    }

    // Get friend request count
    const { count: friendRequestCount, error: frError } = await supabase
      .from('friend_requests')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', userId)
      .eq('status', 'pending')

    if (frError && !frError.message?.includes('does not exist')) {
      throw frError
    }

    // Get garden invite count
    const { count: gardenInviteCount, error: giError } = await supabase
      .from('garden_invites')
      .select('*', { count: 'exact', head: true })
      .eq('invitee_id', userId)
      .eq('status', 'pending')

    if (giError) {
      // If table doesn't exist or other error, return counts without garden invites
      if (!giError.message?.includes('does not exist')) {
        console.warn('[notifications] Error fetching garden invites:', giError)
      }
      return {
        total: (unreadCount || 0) + (friendRequestCount || 0),
        unread: unreadCount || 0,
        friendRequests: friendRequestCount || 0,
        gardenInvites: 0
      }
    }

    const total = (unreadCount || 0) + (friendRequestCount || 0) + (gardenInviteCount || 0)

    return {
      total,
      unread: unreadCount || 0,
      friendRequests: friendRequestCount || 0,
      gardenInvites: gardenInviteCount || 0
    }
  } catch (error) {
    console.warn('[notifications] Failed to get counts:', error)
    return { total: 0, unread: 0, friendRequests: 0, gardenInvites: 0 }
  }
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ status: 'read', read_at: new Date().toISOString() })
    .eq('id', notificationId)

  if (error) throw new Error(error.message)
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ status: 'read', read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('status', 'unread')

  if (error && !error.message?.includes('does not exist')) {
    throw new Error(error.message)
  }
}

/**
 * Dismiss a notification
 */
export async function dismissNotification(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ status: 'dismissed' })
    .eq('id', notificationId)

  if (error) throw new Error(error.message)
}

/**
 * Create a notification
 */
export async function createNotification(params: {
  userId: string
  type: NotificationType
  title: string
  message: string
  referenceId?: string | null
  metadata?: Record<string, unknown> | null
  actionUrl?: string | null
}): Promise<Notification> {
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      reference_id: params.referenceId || null,
      metadata: params.metadata || null,
      action_url: params.actionUrl || null,
      status: 'unread'
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return mapNotificationRow(data)
}

// ===== Garden Invites =====

/**
 * Get pending garden invites for a user
 */
export async function getPendingGardenInvites(userId: string): Promise<GardenInvite[]> {
  const { data, error } = await supabase
    .from('garden_invites')
    .select(`
      id,
      garden_id,
      inviter_id,
      invitee_id,
      role,
      status,
      message,
      created_at,
      responded_at,
      gardens!inner(name, cover_image_url)
    `)
    .eq('invitee_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) {
    if (error.message?.includes('does not exist') || error.code === '42P01') {
      return []
    }
    throw new Error(error.message)
  }

  if (!data || data.length === 0) return []

  // Get inviter profiles
  const inviterIds = [...new Set(data.map(d => d.inviter_id))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name')
    .in('id', inviterIds)

  const profileMap = new Map((profiles || []).map(p => [p.id, p.display_name]))

  return data.map(row => ({
    id: String(row.id),
    gardenId: String(row.garden_id),
    gardenName: (row.gardens as { name?: string })?.name || '',
    inviterId: String(row.inviter_id),
    inviterName: profileMap.get(row.inviter_id) || null,
    inviteeId: String(row.invitee_id),
    inviteeName: null,
    role: row.role as 'member' | 'owner',
    status: row.status as GardenInviteStatus,
    message: row.message || null,
    createdAt: String(row.created_at),
    respondedAt: row.responded_at ? String(row.responded_at) : null,
    gardenCoverImageUrl: (row.gardens as { cover_image_url?: string })?.cover_image_url || null
  }))
}

/**
 * Accept a garden invite
 */
export async function acceptGardenInvite(inviteId: string): Promise<void> {
  // Get the invite
  const { data: invite, error: fetchError } = await supabase
    .from('garden_invites')
    .select('garden_id, invitee_id, role')
    .eq('id', inviteId)
    .eq('status', 'pending')
    .single()

  if (fetchError) throw new Error(fetchError.message)
  if (!invite) throw new Error('Invite not found or already responded')

  // Add user as garden member
  const { error: memberError } = await supabase
    .from('garden_members')
    .insert({
      garden_id: invite.garden_id,
      user_id: invite.invitee_id,
      role: invite.role
    })

  if (memberError) throw new Error(memberError.message)

  // Update invite status
  const { error: updateError } = await supabase
    .from('garden_invites')
    .update({ 
      status: 'accepted', 
      responded_at: new Date().toISOString() 
    })
    .eq('id', inviteId)

  if (updateError) throw new Error(updateError.message)
}

/**
 * Decline a garden invite
 */
export async function declineGardenInvite(inviteId: string): Promise<void> {
  const { error } = await supabase
    .from('garden_invites')
    .update({ 
      status: 'declined', 
      responded_at: new Date().toISOString() 
    })
    .eq('id', inviteId)
    .eq('status', 'pending')

  if (error) throw new Error(error.message)
}

// ===== Helper Functions =====

function mapNotificationRow(row: Record<string, unknown>): Notification {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    type: row.type as NotificationType,
    title: String(row.title || ''),
    message: String(row.message || ''),
    referenceId: row.reference_id ? String(row.reference_id) : null,
    metadata: row.metadata as Record<string, unknown> | null,
    status: (row.status || 'unread') as NotificationStatus,
    createdAt: String(row.created_at),
    readAt: row.read_at ? String(row.read_at) : null,
    actionUrl: row.action_url ? String(row.action_url) : null
  }
}
