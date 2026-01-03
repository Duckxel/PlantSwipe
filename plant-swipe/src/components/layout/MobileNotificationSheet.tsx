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
  Users,
  BellOff
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

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <SheetHeader className="flex-shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-amber-600" />
            {t('notifications.title', { defaultValue: 'Notifications' })}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6 mt-4">
          {!hasItems ? (
            <div className="py-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-stone-100 dark:bg-[#2a2a2d] flex items-center justify-center">
                <BellOff className="h-8 w-8 text-stone-400" />
              </div>
              <p className="text-sm text-stone-500 dark:text-stone-400 font-medium">
                {t('notifications.empty', { defaultValue: 'No new notifications' })}
              </p>
              <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">
                {t('notifications.emptySubtext', { defaultValue: "You're all caught up!" })}
              </p>
            </div>
          ) : (
            <div className="space-y-4 pb-4">
              {/* Friend Requests Section */}
              {friendRequests.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <UserPlus className="h-4 w-4 text-blue-500" />
                    <span className="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                      {t('notifications.friendRequests', { defaultValue: 'Friend Requests' })}
                    </span>
                    <span className="ml-auto px-2 py-0.5 rounded-full bg-blue-500 text-white text-xs font-medium">
                      {friendRequests.length}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {friendRequests.map((request) => (
                      <div
                        key={request.id}
                        className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                            <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-stone-900 dark:text-white">
                              {request.requester_profile?.display_name || t('friends.unknown', { defaultValue: 'Unknown' })}
                            </p>
                            <p className="text-xs text-stone-500 dark:text-stone-400">
                              {t('notifications.wantsToBeYourFriend', { defaultValue: 'wants to be your friend' })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          {request.requester_profile?.display_name && request.requester_profile.display_name.trim() && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-9 rounded-xl text-xs"
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
                            variant="ghost"
                            size="sm"
                            className="h-9 w-9 p-0 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
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
                            className="h-9 rounded-xl text-xs bg-blue-600 hover:bg-blue-700"
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
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Sprout className="h-4 w-4 text-emerald-500" />
                    <span className="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                      {t('notifications.gardenInvites', { defaultValue: 'Garden Invites' })}
                    </span>
                    <span className="ml-auto px-2 py-0.5 rounded-full bg-emerald-500 text-white text-xs font-medium">
                      {gardenInvites.length}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {gardenInvites.map((invite) => (
                      <div
                        key={invite.id}
                        className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20"
                      >
                        <div className="flex items-start gap-3">
                          {invite.gardenCoverImageUrl ? (
                            <img 
                              src={invite.gardenCoverImageUrl} 
                              alt="" 
                              className="w-10 h-10 rounded-xl object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                              <Sprout className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-stone-900 dark:text-white">
                              {invite.gardenName}
                            </p>
                            <p className="text-xs text-stone-500 dark:text-stone-400">
                              {t('notifications.invitedBy', { defaultValue: 'Invited by' })} {invite.inviterName || t('friends.unknown', { defaultValue: 'Unknown' })}
                            </p>
                          </div>
                        </div>
                        {invite.message && (
                          <p className="mt-2 text-xs text-stone-600 dark:text-stone-400 italic px-1">
                            "{invite.message}"
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-3">
                          <div className="flex-1" />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 w-9 p-0 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
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
                            className="h-9 rounded-xl text-xs bg-emerald-600 hover:bg-emerald-700"
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
          <div className="flex-shrink-0 pt-4 border-t border-stone-100 dark:border-[#2a2a2d]">
            <Button
              variant="ghost"
              className="w-full h-10 rounded-2xl text-sm justify-center"
              onClick={() => {
                onClose()
                navigate('/friends')
              }}
            >
              {t('notifications.viewAll', { defaultValue: 'View all notifications' })}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

export default MobileNotificationSheet
