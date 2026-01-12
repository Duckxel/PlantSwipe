/**
 * MobileNotificationSheet Component
 * 
 * A mobile-friendly bottom sheet for displaying notifications.
 * Uses the Sheet component for native-feeling slide-up interaction.
 * Includes time stamps, profile links, and accept/decline actions.
 */

import React from 'react'
import { useTranslation } from 'react-i18next'
import { useLanguageNavigate } from '@/lib/i18nRouting'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { 
  Bell, 
  UserPlus, 
  Sprout, 
  Check, 
  X, 
  User,
  Loader2,
  Inbox,
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

interface MobileNotificationSheetProps {
  isOpen: boolean
  onClose: () => void
  friendRequests: FriendRequest[]
  gardenInvites: GardenInvite[]
  onRefresh: () => Promise<void>
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

export function MobileNotificationSheet({
  isOpen,
  onClose,
  friendRequests,
  gardenInvites,
  onRefresh
}: MobileNotificationSheetProps) {
  const { t } = useTranslation('common')
  const navigate = useLanguageNavigate()
  const [processingId, setProcessingId] = React.useState<string | null>(null)

  // Friend request actions
  const handleAcceptFriendRequest = async (requestId: string) => {
    setProcessingId(requestId)
    try {
      await supabase.rpc('accept_friend_request', { _request_id: requestId })
      await onRefresh()
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
      await onRefresh()
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
      await onRefresh()
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
      await onRefresh()
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

  const hasItems = friendRequests.length > 0 || gardenInvites.length > 0
  const totalCount = friendRequests.length + gardenInvites.length

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[90vh] overflow-hidden flex flex-col px-0">
        {/* Header */}
        <SheetHeader className="px-6 pb-4 border-b border-stone-100 dark:border-[#2a2a2d] flex-shrink-0 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/25">
              <Bell className="h-6 w-6 text-white" />
            </div>
            <div>
              <SheetTitle className="text-left text-lg">
                {t('notifications.title', { defaultValue: 'Notifications' })}
              </SheetTitle>
              {hasItems && (
                <p className="text-sm text-stone-500 dark:text-stone-400">
                  {totalCount} {t('notifications.pending', { defaultValue: 'pending' })}
                </p>
              )}
            </div>
          </div>
        </SheetHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-5">
          {!hasItems ? (
            <div className="py-16 text-center">
              <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-stone-100 dark:bg-[#2a2a2d] flex items-center justify-center">
                <Inbox className="h-12 w-12 text-stone-300 dark:text-stone-600" />
              </div>
              <h3 className="text-lg font-semibold text-stone-700 dark:text-stone-300 mb-2">
                {t('notifications.allCaughtUp', { defaultValue: "You're all caught up!" })}
              </h3>
              <p className="text-sm text-stone-500 dark:text-stone-400 max-w-xs mx-auto">
                {t('notifications.emptyDescription', { defaultValue: "No new notifications. We'll let you know when something arrives." })}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Friend Requests Section */}
              {friendRequests.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3 px-2">
                    <UserPlus className="h-4 w-4 text-blue-500" />
                    <h3 className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider">
                      {t('notifications.friendRequests', { defaultValue: 'Friend Requests' })}
                    </h3>
                    <span className="ml-auto h-5 min-w-5 px-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-bold flex items-center justify-center">
                      {friendRequests.length}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {friendRequests.map((request) => {
                      const displayName = request.requester_profile?.display_name
                      const hasProfile = displayName && displayName.trim()
                      const isProcessing = processingId === request.id
                      
                      return (
                        <div
                          key={request.id}
                          className="group p-4 rounded-2xl bg-gradient-to-r from-blue-50/80 to-indigo-50/50 dark:from-blue-900/15 dark:to-indigo-900/10 border border-blue-100/80 dark:border-blue-800/30"
                        >
                          {/* User Info Row */}
                          <div className="flex items-start gap-4">
                            {/* Avatar - Clickable to view profile */}
                            <button
                              onClick={() => hasProfile && handleViewProfile(displayName)}
                              disabled={!hasProfile}
                              className={cn(
                                "relative flex-shrink-0 w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-500/25",
                                hasProfile && "cursor-pointer active:scale-95 transition-transform"
                              )}
                            >
                              {getInitials(displayName)}
                              {hasProfile && (
                                <div className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-white dark:bg-[#2a2a2d] flex items-center justify-center shadow-sm">
                                  <ExternalLink className="h-3 w-3 text-blue-500" />
                                </div>
                              )}
                            </button>
                            
                            <div className="flex-1 min-w-0 pt-1">
                              {/* Name - Clickable to view profile */}
                              {hasProfile ? (
                                <button
                                  onClick={() => handleViewProfile(displayName)}
                                  className="font-semibold text-stone-900 dark:text-white truncate block text-left active:text-blue-600 dark:active:text-blue-400"
                                >
                                  {displayName}
                                </button>
                              ) : (
                                <p className="font-semibold text-stone-900 dark:text-white truncate">
                                  {t('friends.unknown', { defaultValue: 'Unknown' })}
                                </p>
                              )}
                              <p className="text-sm text-stone-500 dark:text-stone-400 mt-0.5">
                                {t('notifications.wantsToBeYourFriend', { defaultValue: 'wants to be your friend' })}
                              </p>
                              {/* Timestamp */}
                              <div className="flex items-center gap-1.5 mt-2 text-xs text-stone-400 dark:text-stone-500">
                                <Clock className="h-3.5 w-3.5" />
                                <span>{formatRelativeTime(request.created_at)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-blue-100/50 dark:border-blue-800/20">
                            {hasProfile && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-10 rounded-xl text-sm text-stone-600 dark:text-stone-300 flex-1"
                                onClick={() => handleViewProfile(displayName)}
                              >
                                <User className="h-4 w-4 mr-2" />
                                {t('notifications.viewProfile', { defaultValue: 'View profile' })}
                              </Button>
                            )}
                            {!hasProfile && <div className="flex-1" />}
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-10 w-10 p-0 rounded-xl border-red-200 dark:border-red-800/50 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                              onClick={() => handleRejectFriendRequest(request.id)}
                              disabled={isProcessing}
                            >
                              {isProcessing ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                              ) : (
                                <X className="h-5 w-5" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              className="h-10 rounded-xl text-sm bg-blue-500 hover:bg-blue-600 text-white shadow-md shadow-blue-500/25 px-5"
                              onClick={() => handleAcceptFriendRequest(request.id)}
                              disabled={isProcessing}
                            >
                              {isProcessing ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                              ) : (
                                <>
                                  <Check className="h-4 w-4 mr-1.5" />
                                  {t('common.accept', { defaultValue: 'Accept' })}
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              {/* Garden Invites Section */}
              {gardenInvites.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3 px-2">
                    <Sprout className="h-4 w-4 text-emerald-500" />
                    <h3 className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider">
                      {t('notifications.gardenInvites', { defaultValue: 'Garden Invites' })}
                    </h3>
                    <span className="ml-auto h-5 min-w-5 px-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center justify-center">
                      {gardenInvites.length}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {gardenInvites.map((invite) => {
                      const hasInviterProfile = invite.inviterName && invite.inviterName.trim()
                      const isProcessing = processingId === invite.id
                      
                      return (
                        <div
                          key={invite.id}
                          className="group p-4 rounded-2xl bg-gradient-to-r from-emerald-50/80 to-teal-50/50 dark:from-emerald-900/15 dark:to-teal-900/10 border border-emerald-100/80 dark:border-emerald-800/30"
                        >
                          {/* Garden Info Row */}
                          <div className="flex items-start gap-4">
                            {/* Garden Image */}
                            {invite.gardenCoverImageUrl ? (
                              <img 
                                src={invite.gardenCoverImageUrl} 
                                alt="" 
                                className="w-14 h-14 rounded-xl object-cover flex-shrink-0 shadow-lg"
                              />
                            ) : (
                              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-500/25">
                                <Sprout className="h-7 w-7 text-white" />
                              </div>
                            )}
                            
                            <div className="flex-1 min-w-0 pt-1">
                              <p className="font-semibold text-stone-900 dark:text-white truncate">
                                {invite.gardenName}
                              </p>
                              {/* Inviter Info - Clickable */}
                              <div className="flex items-center gap-1.5 text-sm text-stone-500 dark:text-stone-400 mt-0.5">
                                <span>{t('notifications.invitedBy', { defaultValue: 'Invited by' })}</span>
                                {hasInviterProfile ? (
                                  <button
                                    onClick={() => handleViewProfile(invite.inviterName)}
                                    className="font-medium text-emerald-600 dark:text-emerald-400 underline-offset-2 hover:underline"
                                  >
                                    {invite.inviterName}
                                  </button>
                                ) : (
                                  <span>{t('friends.unknown', { defaultValue: 'Unknown' })}</span>
                                )}
                              </div>
                              {/* Timestamp */}
                              <div className="flex items-center gap-1.5 mt-2 text-xs text-stone-400 dark:text-stone-500">
                                <Clock className="h-3.5 w-3.5" />
                                <span>{formatRelativeTime(invite.createdAt)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Message if present */}
                          {invite.message && (
                            <div className="mt-3 px-4 py-3 rounded-xl bg-white/60 dark:bg-[#1a1a1c] text-sm text-stone-600 dark:text-stone-400 italic">
                              "{invite.message}"
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-emerald-100/50 dark:border-emerald-800/20">
                            {hasInviterProfile && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-10 rounded-xl text-sm text-stone-600 dark:text-stone-300 flex-1"
                                onClick={() => handleViewProfile(invite.inviterName)}
                              >
                                <User className="h-4 w-4 mr-2" />
                                {t('notifications.viewInviter', { defaultValue: 'View inviter' })}
                              </Button>
                            )}
                            {!hasInviterProfile && <div className="flex-1" />}
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-10 w-10 p-0 rounded-xl border-red-200 dark:border-red-800/50 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                              onClick={() => handleDeclineGardenInvite(invite.id)}
                              disabled={isProcessing}
                            >
                              {isProcessing ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                              ) : (
                                <X className="h-5 w-5" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              className="h-10 rounded-xl text-sm bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/25 px-5"
                              onClick={() => handleAcceptGardenInvite(invite.id)}
                              disabled={isProcessing}
                            >
                              {isProcessing ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                              ) : (
                                <>
                                  <Check className="h-4 w-4 mr-1.5" />
                                  {t('common.accept', { defaultValue: 'Accept' })}
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>

        {/* Footer - View All */}
        {hasItems && (
          <div className="flex-shrink-0 px-4 py-4 border-t border-stone-100 dark:border-[#2a2a2d] bg-stone-50/50 dark:bg-[#1a1a1c]">
            <Button
              variant="outline"
              className="w-full h-12 rounded-xl text-sm justify-center font-medium"
              onClick={() => {
                onClose()
                navigate('/friends')
              }}
            >
              {t('notifications.viewAllActivity', { defaultValue: 'View all activity' })}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

export default MobileNotificationSheet
