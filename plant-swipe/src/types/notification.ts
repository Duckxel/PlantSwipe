/**
 * Notification System Types
 * 
 * Types for in-app notifications including friend requests, garden invites, etc.
 */

export type NotificationType = 
  | 'friend_request'
  | 'friend_request_accepted'
  | 'garden_invite'
  | 'garden_invite_accepted'
  | 'task_reminder'
  | 'new_message'
  | 'system'

export type NotificationStatus = 'unread' | 'read' | 'dismissed'

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  title: string
  message: string
  /** Reference ID for the related entity (friend request ID, garden invite ID, etc.) */
  referenceId: string | null
  /** Additional metadata stored as JSON */
  metadata: Record<string, unknown> | null
  status: NotificationStatus
  createdAt: string
  readAt: string | null
  /** URL to navigate to when clicking the notification */
  actionUrl: string | null
}

export type GardenInviteStatus = 'pending' | 'accepted' | 'declined' | 'cancelled'

export interface GardenInvite {
  id: string
  gardenId: string
  gardenName: string
  inviterId: string
  inviterName: string | null
  inviteeId: string
  inviteeName: string | null
  role: 'member' | 'owner'
  status: GardenInviteStatus
  message: string | null
  createdAt: string
  respondedAt: string | null
  /** Garden cover image for display */
  gardenCoverImageUrl: string | null
}

export type GardenInvitePrivacy = 'anyone' | 'friends_only'

export interface NotificationCounts {
  total: number
  unread: number
  friendRequests: number
  gardenInvites: number
  unreadMessages: number
  pendingTasks: number
}
