/**
 * MobileNotificationSheet Component
 * 
 * A mobile-friendly bottom sheet for displaying notifications.
 * Uses the Sheet component for native-feeling slide-up interaction.
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
  ArrowUpRight,
  Loader2,
  Inbox
} from 'lucide-react'
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

  const hasItems = friendRequests.length > 0 || gardenInvites.length > 0
  const totalCount = friendRequests.length + gardenInvites.length

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[90vh] overflow-hidden flex flex-col px-0">
        {/* Header */}
        <SheetHeader className="px-6 pb-4 border-b border-stone-100 dark:border-[#2a2a2d] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Bell className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <SheetTitle className="text-left">
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
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {!hasItems ? (
            <div className="py-16 text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-stone-100 dark:bg-[#2a2a2d] flex items-center justify-center">
                <Inbox className="h-10 w-10 text-stone-300 dark:text-stone-600" />
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
                    <h3 className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                      {t('notifications.friendRequests', { defaultValue: 'Friend Requests' })}
                    </h3>
                    <span className="ml-auto h-5 min-w-5 px-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-semibold flex items-center justify-center">
                      {friendRequests.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {friendRequests.map((request) => (
                      <div
                        key={request.id}
                        className="p-4 rounded-2xl bg-white dark:bg-[#2a2a2d] border border-stone-200/50 dark:border-[#3a3a3d] shadow-sm"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0 text-white font-semibold shadow-md shadow-blue-500/20">
                            {(request.requester_profile?.display_name || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-stone-900 dark:text-white truncate">
                              {request.requester_profile?.display_name || t('friends.unknown', { defaultValue: 'Unknown' })}
                            </p>
                            <p className="text-sm text-stone-500 dark:text-stone-400">
                              {t('notifications.wantsToBeYourFriend', { defaultValue: 'wants to be your friend' })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-4">
                          {request.requester_profile?.display_name && request.requester_profile.display_name.trim() && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-9 rounded-xl text-xs text-stone-600 dark:text-stone-300"
                              onClick={() => {
                                onClose()
                                navigate(`/u/${encodeURIComponent(request.requester_profile!.display_name!)}`)
                              }}
                            >
                              <ArrowUpRight className="h-3.5 w-3.5 mr-1" />
                              {t('common.profile', { defaultValue: 'Profile' })}
                            </Button>
                          )}
                          <div className="flex-1" />
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9 w-9 p-0 rounded-xl border-red-200 dark:border-red-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
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
                            size="sm"
                            className="h-9 rounded-xl text-xs bg-blue-500 hover:bg-blue-600 text-white shadow-sm shadow-blue-500/20"
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
                </section>
              )}

              {/* Garden Invites Section */}
              {gardenInvites.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3 px-2">
                    <Sprout className="h-4 w-4 text-emerald-500" />
                    <h3 className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                      {t('notifications.gardenInvites', { defaultValue: 'Garden Invites' })}
                    </h3>
                    <span className="ml-auto h-5 min-w-5 px-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center justify-center">
                      {gardenInvites.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {gardenInvites.map((invite) => (
                      <div
                        key={invite.id}
                        className="p-4 rounded-2xl bg-white dark:bg-[#2a2a2d] border border-stone-200/50 dark:border-[#3a3a3d] shadow-sm"
                      >
                        <div className="flex items-center gap-3">
                          {invite.gardenCoverImageUrl ? (
                            <img 
                              src={invite.gardenCoverImageUrl} 
                              alt="" 
                              className="w-12 h-12 rounded-xl object-cover flex-shrink-0 shadow-md"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-emerald-500/20">
                              <Sprout className="h-6 w-6 text-white" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-stone-900 dark:text-white truncate">
                              {invite.gardenName}
                            </p>
                            <p className="text-sm text-stone-500 dark:text-stone-400">
                              {t('notifications.invitedBy', { defaultValue: 'Invited by' })} {invite.inviterName || t('friends.unknown', { defaultValue: 'Unknown' })}
                            </p>
                          </div>
                        </div>
                        {invite.message && (
                          <p className="mt-3 text-sm text-stone-600 dark:text-stone-400 italic bg-stone-50 dark:bg-[#1e1e20] rounded-xl px-3 py-2">
                            "{invite.message}"
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-4">
                          <div className="flex-1" />
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9 w-9 p-0 rounded-xl border-red-200 dark:border-red-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
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
                            size="sm"
                            className="h-9 rounded-xl text-xs bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm shadow-emerald-500/20"
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
                </section>
              )}
            </div>
          )}
        </div>

        {/* Footer - View All */}
        {hasItems && (
          <div className="flex-shrink-0 px-4 py-4 border-t border-stone-100 dark:border-[#2a2a2d]">
            <Button
              variant="outline"
              className="w-full h-11 rounded-xl text-sm justify-center"
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
