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
/* eslint-disable @typescript-eslint/no-explicit-any -- dynamic notification/push data */

// ===== Notification CRUD =====

const isMissingTableError = (error?: { message?: string; code?: string; status?: number | string }) => {
  if (!error) return false
  if (error.message?.includes('does not exist')) return true
  if (error.code === '42P01') return true
  if (error.code === '404' || error.status === 404 || error.status === '404') return true
  return false
}

/**
 * Get all notifications for a user
 * Note: The general 'notifications' table is not used in this app.
 * Notifications are tracked via friend_requests and garden_invites tables.
 */
export async function getUserNotifications(
  _userId: string,
  _options?: { 
    status?: NotificationStatus
    limit?: number
    offset?: number 
  }
): Promise<Notification[]> {
  // The 'notifications' table doesn't exist - notifications are handled
  // via friend_requests and garden_invites tables instead
  return []
}

/**
 * Get unread notification count for a user
 * Note: The general 'notifications' table is not used in this app.
 * Notifications are tracked via friend_requests and garden_invites tables.
 */
export async function getUnreadNotificationCount(_userId: string): Promise<number> {
  // The 'notifications' table doesn't exist - notifications are handled
  // via friend_requests and garden_invites tables instead
  return 0
}

/**
 * Get notification counts breakdown
 * Note: The general 'notifications' table is not used in this app.
 * Notifications are tracked via friend_requests and garden_invites tables.
 */
export async function getNotificationCounts(userId: string): Promise<NotificationCounts> {
  try {
    // Get friend request count
    const { count: friendRequestCount, error: frError } = await supabase
      .from('friend_requests')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', userId)
      .eq('status', 'pending')

    if (frError && !isMissingTableError(frError)) {
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
      if (!isMissingTableError(giError)) {
        console.warn('[notifications] Error fetching garden invites:', giError)
      }
      return {
        total: friendRequestCount || 0,
        unread: 0,
        friendRequests: friendRequestCount || 0,
        gardenInvites: 0,
        unreadMessages: 0,
        pendingTasks: 0
      }
    }

    const total = (friendRequestCount || 0) + (gardenInviteCount || 0)

    return {
      total,
      unread: 0, // The 'notifications' table doesn't exist - this is always 0
      friendRequests: friendRequestCount || 0,
      gardenInvites: gardenInviteCount || 0,
      unreadMessages: 0, // Will be populated by useNotifications hook
      pendingTasks: 0 // Will be populated by useNotifications hook
    }
  } catch (error) {
    console.warn('[notifications] Failed to get counts:', error)
    return { total: 0, unread: 0, friendRequests: 0, gardenInvites: 0, unreadMessages: 0, pendingTasks: 0 }
  }
}

/**
 * Mark a notification as read
 * Note: The general 'notifications' table is not used in this app.
 */
export async function markNotificationAsRead(_notificationId: string): Promise<void> {
  // The 'notifications' table doesn't exist - this is a no-op
}

/**
 * Mark all notifications as read for a user
 * Note: The general 'notifications' table is not used in this app.
 */
export async function markAllNotificationsAsRead(_userId: string): Promise<void> {
  // The 'notifications' table doesn't exist - this is a no-op
}

/**
 * Dismiss a notification
 * Note: The general 'notifications' table is not used in this app.
 */
export async function dismissNotification(_notificationId: string): Promise<void> {
  // The 'notifications' table doesn't exist - this is a no-op
}

/**
 * Create a notification
 * Note: The general 'notifications' table is not used in this app.
 * Push notifications are handled via the server API and user_notifications table.
 */
export async function createNotification(_params: {
  userId: string
  type: NotificationType
  title: string
  message: string
  referenceId?: string | null
  metadata?: Record<string, unknown> | null
  actionUrl?: string | null
}): Promise<Notification> {
  // The 'notifications' table doesn't exist
  throw new Error('General notifications are not supported. Use push notifications via the server API.')
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
    if (isMissingTableError(error)) {
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
    gardenName: (row.gardens as any)?.name || '',
    inviterId: String(row.inviter_id),
    inviterName: profileMap.get(row.inviter_id) || null,
    inviteeId: String(row.invitee_id),
    inviteeName: null,
    role: row.role as 'member' | 'owner',
    status: row.status as GardenInviteStatus,
    message: row.message || null,
    createdAt: String(row.created_at),
    respondedAt: row.responded_at ? String(row.responded_at) : null,
    gardenCoverImageUrl: (row.gardens as any)?.cover_image_url || null
  }))
}

/**
 * Get sent garden invites (invites user has sent)
 */
export async function getSentGardenInvites(userId: string): Promise<GardenInvite[]> {
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
    .eq('inviter_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    if (error.message?.includes('does not exist') || error.code === '42P01') {
      return []
    }
    throw new Error(error.message)
  }

  if (!data || data.length === 0) return []

  // Get invitee profiles
  const inviteeIds = [...new Set(data.map(d => d.invitee_id))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name')
    .in('id', inviteeIds)

  const profileMap = new Map((profiles || []).map(p => [p.id, p.display_name]))

  return data.map(row => ({
    id: String(row.id),
    gardenId: String(row.garden_id),
    gardenName: (row.gardens as any)?.name || '',
    inviterId: String(row.inviter_id),
    inviterName: null,
    inviteeId: String(row.invitee_id),
    inviteeName: profileMap.get(row.invitee_id) || null,
    role: row.role as 'member' | 'owner',
    status: row.status as GardenInviteStatus,
    message: row.message || null,
    createdAt: String(row.created_at),
    respondedAt: row.responded_at ? String(row.responded_at) : null,
    gardenCoverImageUrl: (row.gardens as any)?.cover_image_url || null
  }))
}

/**
 * Send a garden invite
 */
export async function sendGardenInvite(params: {
  gardenId: string
  inviterId: string
  inviteeId: string
  role?: 'member' | 'owner'
  message?: string | null
  inviterDisplayName?: string | null
}): Promise<GardenInvite> {
  const { gardenId, inviterId, inviteeId, role = 'member', message = null, inviterDisplayName } = params

  // Check if either user has blocked the other
  const { data: blockedData } = await supabase.rpc('are_users_blocked', {
    _user1_id: inviterId,
    _user2_id: inviteeId
  })
  if (blockedData === true) {
    throw new Error('Cannot send invite to this user')
  }

  // Check if user is already a member
  const { data: existingMember } = await supabase
    .from('garden_members')
    .select('id')
    .eq('garden_id', gardenId)
    .eq('user_id', inviteeId)
    .maybeSingle()

  if (existingMember) {
    throw new Error('User is already a member of this garden')
  }

  // Check if there's already a pending invite
  const { data: existingInvite } = await supabase
    .from('garden_invites')
    .select('id, status')
    .eq('garden_id', gardenId)
    .eq('invitee_id', inviteeId)
    .eq('status', 'pending')
    .maybeSingle()

  if (existingInvite) {
    throw new Error('User already has a pending invite for this garden')
  }

  // Create the invite
  const { data, error } = await supabase
    .from('garden_invites')
    .insert({
      garden_id: gardenId,
      inviter_id: inviterId,
      invitee_id: inviteeId,
      role,
      message,
      status: 'pending'
    })
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
    .single()

  if (error) throw new Error(error.message)

  const gardenName = (data.gardens as any)?.name || ''
  
  // Send push notification (fire and forget - don't block on this)
  // Get inviter display name if not provided
  let senderName = inviterDisplayName
  if (!senderName) {
    const { data: inviterProfile } = await supabase
      .from('profiles')
      .select('display_name, language')
      .eq('id', inviterId)
      .maybeSingle()
    senderName = inviterProfile?.display_name || 'Someone'
  }
  
  // Get invitee's language preference
  const { data: inviteeProfile } = await supabase
    .from('profiles')
    .select('language')
    .eq('id', inviteeId)
    .maybeSingle()
  const inviteeLanguage = inviteeProfile?.language || 'en'
  
  // Send push notification asynchronously
  sendGardenInvitePushNotification(inviteeId, senderName || 'Someone', gardenName, inviteeLanguage).catch(() => {
    // Silently fail - push notifications are best effort
  })

  return {
    id: String(data.id),
    gardenId: String(data.garden_id),
    gardenName,
    inviterId: String(data.inviter_id),
    inviterName: null,
    inviteeId: String(data.invitee_id),
    inviteeName: null,
    role: data.role as 'member' | 'owner',
    status: data.status as GardenInviteStatus,
    message: data.message || null,
    createdAt: String(data.created_at),
    respondedAt: null,
    gardenCoverImageUrl: (data.gardens as any)?.cover_image_url || null
  }
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

/**
 * Cancel a garden invite (by the inviter)
 */
export async function cancelGardenInvite(inviteId: string, inviterId: string): Promise<void> {
  const { error } = await supabase
    .from('garden_invites')
    .update({ 
      status: 'cancelled', 
      responded_at: new Date().toISOString() 
    })
    .eq('id', inviteId)
    .eq('inviter_id', inviterId)
    .eq('status', 'pending')

  if (error) throw new Error(error.message)
}

// ===== Privacy Settings =====

/**
 * Get user's garden invite privacy setting
 */
export async function getGardenInvitePrivacy(userId: string): Promise<'anyone' | 'friends_only'> {
  const { data, error } = await supabase
    .from('profiles')
    .select('garden_invite_privacy')
    .eq('id', userId)
    .maybeSingle()

  if (error || !data) {
    return 'anyone' // Default
  }

  return (data.garden_invite_privacy as 'anyone' | 'friends_only') || 'anyone'
}

/**
 * Update user's garden invite privacy setting
 */
export async function updateGardenInvitePrivacy(
  userId: string, 
  privacy: 'anyone' | 'friends_only'
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ garden_invite_privacy: privacy })
    .eq('id', userId)

  if (error) {
    // If column doesn't exist, ignore silently
    if (error.message?.includes('garden_invite_privacy')) {
      console.warn('[notifications] garden_invite_privacy column not found')
      return
    }
    throw new Error(error.message)
  }
}

/**
 * Check if user can send garden invite to another user
 * Respects the invitee's privacy settings
 */
export async function canSendGardenInvite(
  inviterId: string, 
  inviteeId: string
): Promise<{ canInvite: boolean; reason?: string }> {
  // Get invitee's privacy setting
  const privacy = await getGardenInvitePrivacy(inviteeId)

  if (privacy === 'anyone') {
    return { canInvite: true }
  }

  // Check if they are friends
  const { data: friendship } = await supabase
    .from('friends')
    .select('id')
    .eq('user_id', inviteeId)
    .eq('friend_id', inviterId)
    .maybeSingle()

  if (friendship) {
    return { canInvite: true }
  }

  return { 
    canInvite: false, 
    reason: 'User only accepts garden invites from friends' 
  }
}

// ===== App Badge Management =====

// Custom event name for notification refresh broadcasts
const NOTIFICATION_REFRESH_EVENT = 'aphylia:notification-refresh'

/**
 * Broadcast a notification refresh event
 * Components using useNotifications hook will listen for this and refresh
 */
export function broadcastNotificationRefresh(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(NOTIFICATION_REFRESH_EVENT))
  }
}

/**
 * Subscribe to notification refresh events
 * Returns an unsubscribe function
 */
export function onNotificationRefresh(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  
  const handler = () => callback()
  window.addEventListener(NOTIFICATION_REFRESH_EVENT, handler)
  return () => window.removeEventListener(NOTIFICATION_REFRESH_EVENT, handler)
}

/**
 * Clear the app badge (notification count indicator on app icon)
 * Call this when user has viewed/dismissed notifications
 */
export async function clearAppBadge(): Promise<void> {
  try {
    if ('clearAppBadge' in navigator) {
      await (navigator as any).clearAppBadge()
    }
  } catch (err) {
    // Badge API not supported or permission denied - silently fail
    console.debug('[badge] Could not clear app badge:', err)
  }
}

/**
 * Set the app badge count
 * @param count - Number to display on app icon (0 clears the badge)
 */
export async function setAppBadge(count: number): Promise<void> {
  try {
    if (count <= 0) {
      await clearAppBadge()
      return
    }
    if ('setAppBadge' in navigator) {
      await (navigator as any).setAppBadge(count)
    }
  } catch (err) {
    // Badge API not supported or permission denied - silently fail
    console.debug('[badge] Could not set app badge:', err)
  }
}

/**
 * Refresh the app badge based on current unread counts
 * Also broadcasts a refresh event for in-app notification UI
 * Fetches friend requests, garden invites, and unread messages to update badge
 */
export async function refreshAppBadge(userId: string): Promise<void> {
  try {
    const counts = await getNotificationCounts(userId)
    const totalUnread = counts.total + counts.unreadMessages
    await setAppBadge(totalUnread)
    // Also broadcast to update in-app notification UI
    broadcastNotificationRefresh()
  } catch (err) {
    console.debug('[badge] Could not refresh app badge:', err)
  }
}

/**
 * Close any active notifications for a specific tag (e.g., conversation)
 * Call this when user reads a message to dismiss the notification
 */
export async function closeNotificationsForTag(tag: string): Promise<void> {
  try {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      const registration = await navigator.serviceWorker.ready
      const notifications = await registration.getNotifications({ tag })
      notifications.forEach(notification => notification.close())
    }
  } catch (err) {
    console.debug('[badge] Could not close notifications:', err)
  }
}

// ===== Push Notifications =====

type InstantPushType = 'friend_request' | 'garden_invite' | 'friend_request_accepted' | 'garden_invite_accepted'

interface SendInstantPushParams {
  recipientId: string
  type: InstantPushType
  title: string
  body: string
  data?: Record<string, unknown>
}

/**
 * Send an instant push notification to a user's device
 * Used for friend requests and garden invites
 */
export async function sendInstantPushNotification(params: SendInstantPushParams): Promise<{ sent: boolean; reason?: string }> {
  const { recipientId, type, title, body, data } = params
  
  try {
    const session = (await supabase.auth.getSession()).data.session
    const token = session?.access_token
    
    if (!token) {
      console.warn('[push] Cannot send notification: not authenticated')
      return { sent: false, reason: 'NOT_AUTHENTICATED' }
    }
    
    const response = await fetch('/api/push/instant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      credentials: 'same-origin',
      body: JSON.stringify({ recipientId, type, title, body, data })
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.warn('[push] Failed to send notification:', errorData?.error || response.status)
      return { sent: false, reason: errorData?.error || 'REQUEST_FAILED' }
    }
    
    const result = await response.json()
    return { sent: result.sent ?? false, reason: result.reason }
  } catch (err) {
    console.warn('[push] Error sending notification:', (err as Error)?.message)
    return { sent: false, reason: 'ERROR' }
  }
}

/**
 * Send a push notification for a friend request
 */
export async function sendFriendRequestPushNotification(
  recipientId: string,
  senderDisplayName: string,
  language: string = 'en'
): Promise<{ sent: boolean }> {
  const translations: Record<string, { title: string; body: string }> = {
    en: {
      title: 'New Friend Request',
      body: `${senderDisplayName} wants to be your friend`
    },
    fr: {
      title: 'Nouvelle demande d\'ami',
      body: `${senderDisplayName} souhaite être votre ami(e)`
    }
  }
  
  const t = translations[language] || translations.en
  
  return sendInstantPushNotification({
    recipientId,
    type: 'friend_request',
    title: t.title,
    body: t.body,
    data: { senderDisplayName }
  })
}

/**
 * Send a push notification for a garden invite
 */
export async function sendGardenInvitePushNotification(
  recipientId: string,
  senderDisplayName: string,
  gardenName: string,
  language: string = 'en'
): Promise<{ sent: boolean }> {
  const translations: Record<string, { title: string; body: string }> = {
    en: {
      title: 'Garden Invitation',
      body: `${senderDisplayName} invited you to join "${gardenName}"`
    },
    fr: {
      title: 'Invitation de jardin',
      body: `${senderDisplayName} vous a invité(e) à rejoindre "${gardenName}"`
    }
  }
  
  const t = translations[language] || translations.en
  
  return sendInstantPushNotification({
    recipientId,
    type: 'garden_invite',
    title: t.title,
    body: t.body,
    data: { senderDisplayName, gardenName }
  })
}

