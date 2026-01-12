/**
 * NotificationPanel Component
 * 
 * A dropdown panel showing notifications, friend requests, and garden invites
 * with accept/decline actions, time stamps, and profile links.
 */

import React from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useLanguageNavigate } from '@/lib/i18nRouting'
import { Button } from '@/components/ui/button'
import { 
  Bell, 
  UserPlus, 
  Sprout, 
  Check, 
  X, 
  User,
  Loader2,
  Clock,
  ExternalLink
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabaseClient'
import { acceptGardenInvite, declineGardenInvite } from '@/lib/notifications'
import type { GardenInvite } from '@/types/notification'

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

interface NotificationPanelProps {
  isOpen: boolean
  onClose: () => void
  anchorRef: React.RefObject<HTMLElement | null>
  friendRequests: FriendRequest[]
  gardenInvites: GardenInvite[]
  onRefresh: (force?: boolean) => Promise<void>
}

/**
 * Format a date string to relative time (e.g., "2h ago", "Yesterday")
 */
function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSeconds = Math.floor(diffMs / 1000)
    const diffMinutes = Math.floor(diffSeconds / 60)
    const diffHours = Math.floor(diffMinutes / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffSeconds < 60) return 'Just now'
    if (diffMinutes < 60) return `${diffMinutes}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

/**
 * Get initials from a display name
 */
function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.charAt(0).toUpperCase()
}

export function NotificationPanel({
  isOpen,
  onClose,
  anchorRef,
  friendRequests,
  gardenInvites,
  onRefresh
}: NotificationPanelProps) {
  const { t } = useTranslation('common')
  const navigate = useLanguageNavigate()
  const panelRef = React.useRef<HTMLDivElement>(null)
  const [position, setPosition] = React.useState<{ top: number; right: number } | null>(null)
  const [processingId, setProcessingId] = React.useState<string | null>(null)

  // Calculate panel position
  const updatePosition = React.useCallback(() => {
    const anchor = anchorRef.current
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    setPosition({
      top: rect.bottom + 8,
      right: Math.max(8, window.innerWidth - rect.right)
    })
  }, [anchorRef])

  // Close on click outside
  React.useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (panelRef.current?.contains(target)) return
      if (anchorRef.current?.contains(target)) return
      onClose()
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('click', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    updatePosition()

    return () => {
      document.removeEventListener('click', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [isOpen, onClose, updatePosition, anchorRef])

  // Friend request actions
  const handleAcceptFriendRequest = async (requestId: string) => {
    setProcessingId(requestId)
    try {
      await supabase.rpc('accept_friend_request', { _request_id: requestId })
      await onRefresh(true) // Force refresh to bypass throttle
    } catch (e: any) {
      console.error('Failed to accept friend request:', e)
    } finally {
      setProcessingId(null)
    }
  }

  const handleRejectFriendRequest = async (requestId: string) => {
    setProcessingId(requestId)
    try {
      await supabase
        .from('friend_requests')
        .update({ status: 'rejected' })
        .eq('id', requestId)
      await onRefresh(true) // Force refresh to bypass throttle
    } catch (e: any) {
      console.error('Failed to reject friend request:', e)
    } finally {
      setProcessingId(null)
    }
  }

  // Garden invite actions
  const handleAcceptGardenInvite = async (inviteId: string) => {
    setProcessingId(inviteId)
    try {
      await acceptGardenInvite(inviteId)
      await onRefresh(true) // Force refresh to bypass throttle
    } catch (e: any) {
      console.error('Failed to accept garden invite:', e)
    } finally {
      setProcessingId(null)
    }
  }

  const handleDeclineGardenInvite = async (inviteId: string) => {
    setProcessingId(inviteId)
    try {
      await declineGardenInvite(inviteId)
      await onRefresh(true) // Force refresh to bypass throttle
    } catch (e: any) {
      console.error('Failed to decline garden invite:', e)
    } finally {
      setProcessingId(null)
    }
  }

  // Navigate to user profile
  const handleViewProfile = (displayName: string | null | undefined) => {
    if (!displayName?.trim()) return
    onClose()
    navigate(`/u/${encodeURIComponent(displayName)}`)
  }

  if (!isOpen || !position) return null

  const hasItems = friendRequests.length > 0 || gardenInvites.length > 0

  return createPortal(
    <div
      ref={panelRef}
      className="fixed z-[60] w-[360px] max-h-[75vh] overflow-hidden rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] shadow-2xl shadow-black/10 dark:shadow-black/30"
      style={{ top: position.top, right: position.right }}
      role="menu"
      aria-label={t('notifications.title', { defaultValue: 'Notifications' })}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-stone-100 dark:border-[#2a2a2d] bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/25">
            <Bell className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-stone-900 dark:text-white">
              {t('notifications.title', { defaultValue: 'Notifications' })}
            </h3>
            {hasItems && (
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {friendRequests.length + gardenInvites.length} {t('notifications.pending', { defaultValue: 'pending' })}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="overflow-y-auto max-h-[calc(75vh-80px)]">
        {!hasItems ? (
          <div className="px-5 py-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-stone-100 dark:bg-[#2a2a2d] flex items-center justify-center">
              <Bell className="h-8 w-8 text-stone-300 dark:text-stone-600" />
            </div>
            <p className="text-sm font-medium text-stone-600 dark:text-stone-400">
              {t('notifications.empty', { defaultValue: 'No new notifications' })}
            </p>
            <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">
              {t('notifications.emptySubtitle', { defaultValue: "You're all caught up!" })}
            </p>
          </div>
        ) : (
          <div className="p-3 space-y-3">
            {/* Friend Requests */}
            {friendRequests.length > 0 && (
              <div>
                <div className="flex items-center gap-2 px-2 mb-2">
                  <UserPlus className="h-3.5 w-3.5 text-blue-500" />
                  <span className="text-[11px] font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider">
                    {t('notifications.friendRequests', { defaultValue: 'Friend Requests' })}
                  </span>
                  <span className="ml-auto text-[11px] text-blue-500 font-bold">{friendRequests.length}</span>
                </div>
                <div className="space-y-2">
                  {friendRequests.map((request) => {
                    const displayName = request.requester_profile?.display_name
                    const hasProfile = displayName && displayName.trim()
                    const isProcessing = processingId === request.id
                    
                    return (
                      <div
                        key={request.id}
                        className="group p-3 rounded-xl bg-gradient-to-r from-blue-50/80 to-indigo-50/50 dark:from-blue-900/15 dark:to-indigo-900/10 border border-blue-100/80 dark:border-blue-800/30 hover:border-blue-200 dark:hover:border-blue-700/50 transition-colors"
                      >
                        {/* User Info Row */}
                        <div className="flex items-start gap-3">
                          {/* Avatar - Clickable to view profile */}
                          <button
                            onClick={() => hasProfile && handleViewProfile(displayName)}
                            disabled={!hasProfile}
                            className={cn(
                              "relative flex-shrink-0 w-11 h-11 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-semibold text-sm shadow-md shadow-blue-500/20",
                              hasProfile && "cursor-pointer hover:ring-2 hover:ring-blue-400/50 hover:ring-offset-2 dark:hover:ring-offset-[#1e1e20] transition-all"
                            )}
                            title={hasProfile ? t('notifications.viewProfile', { defaultValue: 'View profile' }) : undefined}
                          >
                            {getInitials(displayName)}
                            {hasProfile && (
                              <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-white dark:bg-[#2a2a2d] flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                                <ExternalLink className="h-2.5 w-2.5 text-blue-500" />
                              </div>
                            )}
                          </button>
                          
                          <div className="flex-1 min-w-0">
                            {/* Name - Clickable to view profile */}
                            {hasProfile ? (
                              <button
                                onClick={() => handleViewProfile(displayName)}
                                className="text-sm font-semibold text-stone-900 dark:text-white truncate block hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-left"
                              >
                                {displayName}
                              </button>
                            ) : (
                              <p className="text-sm font-semibold text-stone-900 dark:text-white truncate">
                                {t('friends.unknown', { defaultValue: 'Unknown' })}
                              </p>
                            )}
                            <p className="text-xs text-stone-500 dark:text-stone-400">
                              {t('notifications.wantsToBeYourFriend', { defaultValue: 'wants to be your friend' })}
                            </p>
                            {/* Timestamp */}
                            <div className="flex items-center gap-1 mt-1 text-[10px] text-stone-400 dark:text-stone-500">
                              <Clock className="h-3 w-3" />
                              <span>{formatRelativeTime(request.created_at)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-blue-100/50 dark:border-blue-800/20">
                          {hasProfile && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 rounded-lg text-xs text-stone-600 dark:text-stone-300 hover:text-blue-600 dark:hover:text-blue-400"
                              onClick={() => handleViewProfile(displayName)}
                            >
                              <User className="h-3.5 w-3.5 mr-1.5" />
                              {t('notifications.viewProfile', { defaultValue: 'View profile' })}
                            </Button>
                          )}
                          <div className="flex-1" />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 rounded-lg text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30"
                            onClick={() => handleRejectFriendRequest(request.id)}
                            disabled={isProcessing}
                            title={t('common.decline', { defaultValue: 'Decline' })}
                          >
                            {isProcessing ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <X className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            className="h-8 rounded-lg text-xs bg-blue-500 hover:bg-blue-600 text-white shadow-sm shadow-blue-500/25"
                            onClick={() => handleAcceptFriendRequest(request.id)}
                            disabled={isProcessing}
                          >
                            {isProcessing ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Check className="h-3.5 w-3.5 mr-1" />
                                {t('common.accept', { defaultValue: 'Accept' })}
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Garden Invites */}
            {gardenInvites.length > 0 && (
              <div>
                <div className="flex items-center gap-2 px-2 mb-2">
                  <Sprout className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-[11px] font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider">
                    {t('notifications.gardenInvites', { defaultValue: 'Garden Invites' })}
                  </span>
                  <span className="ml-auto text-[11px] text-emerald-500 font-bold">{gardenInvites.length}</span>
                </div>
                <div className="space-y-2">
                  {gardenInvites.map((invite) => {
                    const hasInviterProfile = invite.inviterName && invite.inviterName.trim()
                    const isProcessing = processingId === invite.id
                    
                    return (
                      <div
                        key={invite.id}
                        className="group p-3 rounded-xl bg-gradient-to-r from-emerald-50/80 to-teal-50/50 dark:from-emerald-900/15 dark:to-teal-900/10 border border-emerald-100/80 dark:border-emerald-800/30 hover:border-emerald-200 dark:hover:border-emerald-700/50 transition-colors"
                      >
                        {/* Garden Info Row */}
                        <div className="flex items-start gap-3">
                          {/* Garden Image */}
                          {invite.gardenCoverImageUrl ? (
                            <img 
                              src={invite.gardenCoverImageUrl} 
                              alt="" 
                              className="w-11 h-11 rounded-xl object-cover flex-shrink-0 shadow-md"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-emerald-500/20">
                              <Sprout className="h-5 w-5 text-white" />
                            </div>
                          )}
                          
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-stone-900 dark:text-white truncate">
                              {invite.gardenName}
                            </p>
                            {/* Inviter Info - Clickable */}
                            <div className="flex items-center gap-1 text-xs text-stone-500 dark:text-stone-400">
                              <span>{t('notifications.invitedBy', { defaultValue: 'Invited by' })}</span>
                              {hasInviterProfile ? (
                                <button
                                  onClick={() => handleViewProfile(invite.inviterName)}
                                  className="font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                                >
                                  {invite.inviterName}
                                </button>
                              ) : (
                                <span>{t('friends.unknown', { defaultValue: 'Unknown' })}</span>
                              )}
                            </div>
                            {/* Timestamp */}
                            <div className="flex items-center gap-1 mt-1 text-[10px] text-stone-400 dark:text-stone-500">
                              <Clock className="h-3 w-3" />
                              <span>{formatRelativeTime(invite.createdAt)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Message if present */}
                        {invite.message && (
                          <div className="mt-2 px-3 py-2 rounded-lg bg-white/60 dark:bg-[#1a1a1c] text-xs text-stone-600 dark:text-stone-400 italic">
                            "{invite.message}"
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-emerald-100/50 dark:border-emerald-800/20">
                          {hasInviterProfile && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 rounded-lg text-xs text-stone-600 dark:text-stone-300 hover:text-emerald-600 dark:hover:text-emerald-400"
                              onClick={() => handleViewProfile(invite.inviterName)}
                            >
                              <User className="h-3.5 w-3.5 mr-1.5" />
                              {t('notifications.viewInviter', { defaultValue: 'View inviter' })}
                            </Button>
                          )}
                          <div className="flex-1" />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 rounded-lg text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30"
                            onClick={() => handleDeclineGardenInvite(invite.id)}
                            disabled={isProcessing}
                            title={t('common.decline', { defaultValue: 'Decline' })}
                          >
                            {isProcessing ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <X className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            className="h-8 rounded-lg text-xs bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm shadow-emerald-500/25"
                            onClick={() => handleAcceptGardenInvite(invite.id)}
                            disabled={isProcessing}
                          >
                            {isProcessing ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Check className="h-3.5 w-3.5 mr-1" />
                                {t('common.accept', { defaultValue: 'Accept' })}
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer - View All */}
      {hasItems && (
        <div className="px-4 py-3 border-t border-stone-100 dark:border-[#2a2a2d] bg-stone-50/50 dark:bg-[#1a1a1c]">
          <Button
            variant="ghost"
            className="w-full h-9 rounded-xl text-sm justify-center hover:bg-stone-100 dark:hover:bg-[#2a2a2d]"
            onClick={() => {
              onClose()
              navigate('/friends')
            }}
          >
            {t('notifications.viewAll', { defaultValue: 'View all' })}
          </Button>
        </div>
      )}
    </div>,
    document.body
  )
}

/**
 * NotificationBell Component
 * 
 * A bell icon button that shows notification count and opens the notification panel.
 */
interface NotificationBellProps {
  totalCount: number
  friendRequests: FriendRequest[]
  gardenInvites: GardenInvite[]
  onRefresh: (force?: boolean) => Promise<void>
  className?: string
}

export function NotificationBell({
  totalCount,
  friendRequests,
  gardenInvites,
  onRefresh,
  className
}: NotificationBellProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const buttonRef = React.useRef<HTMLButtonElement>(null)

  return (
    <>
      <div className={cn("relative", className)}>
        <Button
          ref={buttonRef}
          variant="secondary"
          size="icon"
          className="rounded-2xl h-9 w-9"
          onClick={(e) => {
            e.stopPropagation()
            setIsOpen(!isOpen)
          }}
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
        </Button>
        {totalCount > 0 && (
          <span
            className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-medium flex items-center justify-center ring-2 ring-white dark:ring-[#252526] animate-in zoom-in-50 duration-200"
            aria-hidden="true"
          >
            {totalCount > 99 ? '99+' : totalCount}
          </span>
        )}
      </div>
      <NotificationPanel
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        anchorRef={buttonRef}
        friendRequests={friendRequests}
        gardenInvites={gardenInvites}
        onRefresh={onRefresh}
      />
    </>
  )
}

export default NotificationPanel
