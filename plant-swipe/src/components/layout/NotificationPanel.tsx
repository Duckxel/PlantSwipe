/**
 * NotificationPanel Component
 * 
 * A dropdown panel showing notifications, friend requests, and garden invites
 * with accept/decline actions.
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
  ArrowUpRight,
  Loader2,
  Users
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
  onRefresh: () => Promise<void>
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
      await onRefresh()
    } catch (e) {
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
      await onRefresh()
    } catch (e) {
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
      await onRefresh()
    } catch (e) {
      console.error('Failed to accept garden invite:', e)
    } finally {
      setProcessingId(null)
    }
  }

  const handleDeclineGardenInvite = async (inviteId: string) => {
    setProcessingId(inviteId)
    try {
      await declineGardenInvite(inviteId)
      await onRefresh()
    } catch (e) {
      console.error('Failed to decline garden invite:', e)
    } finally {
      setProcessingId(null)
    }
  }

  if (!isOpen || !position) return null

  const hasItems = friendRequests.length > 0 || gardenInvites.length > 0

  return createPortal(
    <div
      ref={panelRef}
      className="fixed z-[60] w-80 max-h-[70vh] overflow-hidden rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] shadow-xl"
      style={{ top: position.top, right: position.right }}
      role="menu"
      aria-label={t('notifications.title', { defaultValue: 'Notifications' })}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-stone-100 dark:border-[#2a2a2d]">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-amber-600" />
          <h3 className="font-semibold text-stone-900 dark:text-white">
            {t('notifications.title', { defaultValue: 'Notifications' })}
          </h3>
        </div>
      </div>

      {/* Content */}
      <div className="overflow-y-auto max-h-[calc(70vh-56px)]">
        {!hasItems ? (
          <div className="px-4 py-8 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-stone-100 dark:bg-[#2a2a2d] flex items-center justify-center">
              <Bell className="h-6 w-6 text-stone-400" />
            </div>
            <p className="text-sm text-stone-500 dark:text-stone-400">
              {t('notifications.empty', { defaultValue: 'No new notifications' })}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-stone-100 dark:divide-[#2a2a2d]">
            {/* Friend Requests Section */}
            {friendRequests.length > 0 && (
              <div className="p-3">
                <div className="flex items-center gap-2 px-1 mb-2">
                  <UserPlus className="h-4 w-4 text-blue-500" />
                  <span className="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                    {t('notifications.friendRequests', { defaultValue: 'Friend Requests' })}
                  </span>
                  <span className="ml-auto text-xs text-blue-500 font-medium">{friendRequests.length}</span>
                </div>
                <div className="space-y-2" role="list" aria-label={t('notifications.friendRequests', { defaultValue: 'Friend Requests' })}>
                  {friendRequests.map((request) => (
                    <div
                      key={request.id}
                      className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20"
                      role="listitem"
                      aria-label={`${t('notifications.friendRequests', { defaultValue: 'Friend request' })} from ${request.requester_profile?.display_name || t('friends.unknown', { defaultValue: 'Unknown' })}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                          <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-stone-900 dark:text-white truncate">
                            {request.requester_profile?.display_name || t('friends.unknown', { defaultValue: 'Unknown' })}
                          </p>
                          <p className="text-xs text-stone-500 dark:text-stone-400">
                            {t('notifications.wantsToBeYourFriend', { defaultValue: 'wants to be your friend' })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        {(() => {
                          const displayName = request.requester_profile?.display_name
                          if (displayName && displayName.trim()) {
                            return (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 rounded-lg text-xs"
                                onClick={() => {
                                  onClose()
                                  navigate(`/u/${encodeURIComponent(displayName)}`)
                                }}
                              >
                                <ArrowUpRight className="h-3.5 w-3.5 mr-1" />
                                {t('common.profile', { defaultValue: 'Profile' })}
                              </Button>
                            )
                          }
                          return null
                        })()}
                        <div className="flex-1" />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => handleRejectFriendRequest(request.id)}
                          disabled={processingId === request.id}
                        >
                          {processingId === request.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <X className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          className="h-8 rounded-lg text-xs bg-blue-600 hover:bg-blue-700"
                          onClick={() => handleAcceptFriendRequest(request.id)}
                          disabled={processingId === request.id}
                        >
                          {processingId === request.id ? (
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
                  ))}
                </div>
              </div>
            )}

            {/* Garden Invites Section */}
            {gardenInvites.length > 0 && (
              <div className="p-3">
                <div className="flex items-center gap-2 px-1 mb-2">
                  <Sprout className="h-4 w-4 text-emerald-500" />
                  <span className="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                    {t('notifications.gardenInvites', { defaultValue: 'Garden Invites' })}
                  </span>
                  <span className="ml-auto text-xs text-emerald-500 font-medium">{gardenInvites.length}</span>
                </div>
                <div className="space-y-2" role="list" aria-label={t('notifications.gardenInvites', { defaultValue: 'Garden Invites' })}>
                  {gardenInvites.map((invite) => (
                    <div
                      key={invite.id}
                      className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20"
                      role="listitem"
                      aria-label={`${t('notifications.gardenInvites', { defaultValue: 'Garden invite' })} to ${invite.gardenName} from ${invite.inviterName || t('friends.unknown', { defaultValue: 'Unknown' })}`}
                    >
                      <div className="flex items-start gap-3">
                        {invite.gardenCoverImageUrl ? (
                          <img 
                            src={invite.gardenCoverImageUrl} 
                            alt="" 
                            className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                            <Sprout className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-stone-900 dark:text-white truncate">
                            {invite.gardenName}
                          </p>
                          <p className="text-xs text-stone-500 dark:text-stone-400">
                            {t('notifications.invitedBy', { defaultValue: 'Invited by' })} {invite.inviterName || t('friends.unknown', { defaultValue: 'Unknown' })}
                          </p>
                        </div>
                      </div>
                      {invite.message && (
                        <p className="mt-2 text-xs text-stone-600 dark:text-stone-400 italic">
                          "{invite.message}"
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-3">
                        <div className="flex-1" />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => handleDeclineGardenInvite(invite.id)}
                          disabled={processingId === invite.id}
                        >
                          {processingId === invite.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <X className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          className="h-8 rounded-lg text-xs bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => handleAcceptGardenInvite(invite.id)}
                          disabled={processingId === invite.id}
                        >
                          {processingId === invite.id ? (
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
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer - View All */}
      {hasItems && (
        <div className="px-4 py-3 border-t border-stone-100 dark:border-[#2a2a2d]">
          <Button
            variant="ghost"
            className="w-full h-9 rounded-xl text-sm justify-center"
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
  onRefresh: () => Promise<void>
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
            className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-medium flex items-center justify-center ring-2 ring-white dark:ring-[#252526]"
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
