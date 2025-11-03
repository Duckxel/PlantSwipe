import React from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useAuth } from "@/context/AuthContext"
import { supabase } from "@/lib/supabaseClient"
import { User, Search, UserPlus, Check, X, ArrowRight, ArrowUpRight } from "lucide-react"
import { createPortal } from "react-dom"

type FriendRequest = {
  id: string
  requester_id: string
  recipient_id: string
  created_at: string
  status: 'pending' | 'accepted' | 'rejected'
  requester_profile?: {
    id: string
    display_name: string | null
    email?: string | null
  }
  recipient_profile?: {
    id: string
    display_name: string | null
    email?: string | null
  }
}

type Friend = {
  id: string
  user_id: string
  friend_id: string
  created_at: string
  friend_profile?: {
    id: string
    display_name: string | null
    email?: string | null
  }
}

type SearchResult = {
  id: string
  display_name: string | null
  email?: string | null
  is_friend?: boolean
  is_pending?: boolean
}

export const FriendsPage: React.FC = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [friends, setFriends] = React.useState<Friend[]>([])
  const [pendingRequests, setPendingRequests] = React.useState<FriendRequest[]>([])
  const [sentPendingRequests, setSentPendingRequests] = React.useState<FriendRequest[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [menuOpenFriendId, setMenuOpenFriendId] = React.useState<string | null>(null)
  const [menuPos, setMenuPos] = React.useState<{ top: number; right: number } | null>(null)
  const [confirmingRemove, setConfirmingRemove] = React.useState<string | null>(null)
  const [addFriendDialogOpen, setAddFriendDialogOpen] = React.useState(false)
  const [dialogSearchQuery, setDialogSearchQuery] = React.useState("")
  const [dialogSearchResults, setDialogSearchResults] = React.useState<SearchResult[]>([])
  const [dialogSearching, setDialogSearching] = React.useState(false)
  const menuRefs = React.useRef<Map<string, HTMLDivElement>>(new Map())
  const anchorRefs = React.useRef<Map<string, HTMLDivElement>>(new Map())

  const loadFriends = React.useCallback(async () => {
    if (!user?.id) return
    try {
      const { data, error: err } = await supabase
        .from('friends')
        .select(`
          id,
          user_id,
          friend_id,
          created_at
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      
      if (err) throw err
      
      // Fetch friend profiles separately
      const friendIds = (data || []).map(f => f.friend_id)
      if (friendIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', friendIds)
        
        // Fetch emails for friends using RPC function
        const emailPromises = friendIds.map(async (id) => {
          try {
            const { data: emailData } = await supabase.rpc('get_friend_email', { _friend_id: id })
            return { id, email: emailData || null }
          } catch {
            return { id, email: null }
          }
        })
        const emails = await Promise.all(emailPromises)
        const emailMap = new Map(emails.map(e => [e.id, e.email]))
        
        const profileMap = new Map((profiles || []).map(p => [p.id, p]))
        const friendsWithProfiles = (data || []).map(f => ({
          ...f,
          friend_profile: {
            ...(profileMap.get(f.friend_id) || { id: f.friend_id, display_name: null }),
            email: emailMap.get(f.friend_id) || null
          }
        }))
        setFriends(friendsWithProfiles as Friend[])
      } else {
        setFriends([])
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load friends')
    }
  }, [user?.id])

  const loadSentPendingRequests = React.useCallback(async () => {
    if (!user?.id) return
    try {
      const { data, error: err } = await supabase
        .from('friend_requests')
        .select(`
          id,
          requester_id,
          recipient_id,
          created_at,
          status
        `)
        .eq('requester_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
      
      if (err) throw err
      
      // Fetch recipient profiles separately
      const recipientIds = (data || []).map(r => r.recipient_id)
      if (recipientIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', recipientIds)
        
        // Fetch emails using RPC function for friends
        const emailPromises = recipientIds.map(async (id) => {
          try {
            const { data: emailData } = await supabase.rpc('get_friend_email', { _friend_id: id })
            return { id, email: emailData || null }
          } catch {
            return { id, email: null }
          }
        })
        const emails = await Promise.all(emailPromises)
        const emailMap = new Map(emails.map(e => [e.id, e.email]))
        
        const profileMap = new Map((profiles || []).map(p => [p.id, p]))
        const requestsWithProfiles = (data || []).map(r => ({
          ...r,
          recipient_profile: {
            id: r.recipient_id,
            display_name: profileMap.get(r.recipient_id)?.display_name || null,
            email: emailMap.get(r.recipient_id) || null
          }
        }))
        setSentPendingRequests(requestsWithProfiles as FriendRequest[])
      } else {
        setSentPendingRequests([])
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load sent pending requests')
    }
  }, [user?.id])

  const loadPendingRequests = React.useCallback(async () => {
    if (!user?.id) return
    try {
      const { data, error: err } = await supabase
        .from('friend_requests')
        .select(`
          id,
          requester_id,
          recipient_id,
          created_at,
          status
        `)
        .eq('recipient_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
      
      if (err) throw err
      
      // Fetch requester profiles separately
      const requesterIds = (data || []).map(r => r.requester_id)
      if (requesterIds.length > 0) {
        const { data: profiles, error: profileErr } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', requesterIds)
        
        if (profileErr) {
          console.error('Error fetching requester profiles:', profileErr)
        }
        
        // Fetch emails using RPC function (only for users who sent friend requests to you)
        const emailPromises = requesterIds.map(async (id) => {
          try {
            const { data: emailData } = await supabase.rpc('get_friend_request_requester_email', { _requester_id: id })
            return { id, email: emailData || null }
          } catch (e) {
            console.error('Error fetching email for requester:', id, e)
            return { id, email: null }
          }
        })
        const emails = await Promise.all(emailPromises)
        const emailMap = new Map(emails.map(e => [e.id, e.email]))
        
        const profileMap = new Map((profiles || []).map(p => [p.id, p]))
        const requestsWithProfiles = (data || []).map(r => {
          const profile = profileMap.get(r.requester_id)
          return {
            ...r,
            requester_profile: {
              id: r.requester_id,
              display_name: profile?.display_name || null,
              email: emailMap.get(r.requester_id) || null
            }
          }
        })
        setPendingRequests(requestsWithProfiles as FriendRequest[])
      } else {
        setPendingRequests([])
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load friend requests')
    }
  }, [user?.id])

  React.useEffect(() => {
    if (!user?.id) {
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all([loadFriends(), loadPendingRequests(), loadSentPendingRequests()]).finally(() => {
      setLoading(false)
    })
  }, [user?.id, loadFriends, loadPendingRequests, loadSentPendingRequests])

  const handleDialogSearch = React.useCallback(async () => {
    if (!dialogSearchQuery.trim() || !user?.id) {
      setDialogSearchResults([])
      return
    }
    setDialogSearching(true)
    try {
      const query = dialogSearchQuery.trim()
      
      // Search by display_name (username)
      // Note: Email search would require server endpoint, so we search by username
      const { data, error: err } = await supabase
        .from('profiles')
        .select('id, display_name')
        .ilike('display_name', `%${query}%`)
        .neq('id', user.id)
        .limit(3)
      
      if (err) throw err
      
      let results: SearchResult[] = []
      if (data) {
        results = data.map(p => ({
          id: p.id,
          display_name: p.display_name || null,
          email: null,
          is_friend: false
        }))
      }
      
      // If query looks like an email, try to find user by email via server endpoint
      if (query.includes('@')) {
        try {
          const response = await fetch(`/api/admin/member?q=${encodeURIComponent(query)}`, {
            credentials: 'same-origin'
          })
          if (response.ok) {
            const memberData = await response.json()
            if (memberData.id && memberData.id !== user.id) {
              // Check if already in results
              const existingIndex = results.findIndex(r => r.id === memberData.id)
              if (existingIndex >= 0) {
                results[existingIndex].email = memberData.email || null
              } else {
                results.unshift({
                  id: memberData.id,
                  display_name: memberData.profile?.display_name || null,
                  email: memberData.email || null,
                  is_friend: false
                })
              }
            }
          }
        } catch (e) {
          // Ignore email search errors
        }
      }
      
      // Get friend IDs and check which results are already friends
      const friendIds = new Set(friends.map(f => f.friend_id))
      
      // Get pending request IDs
      const { data: sentRequests } = await supabase
        .from('friend_requests')
        .select('recipient_id')
        .eq('requester_id', user.id)
        .eq('status', 'pending')
      
      const requestIds = new Set([
        ...pendingRequests.map(r => r.requester_id),
        ...(sentRequests?.map(r => r.recipient_id) || [])
      ])
      
      // Mark friends and pending requests
      const filteredResults = results
        .filter(r => r.id !== user.id)
        .map(r => ({
          ...r,
          is_friend: friendIds.has(r.id),
          is_pending: requestIds.has(r.id)
        }))
        .slice(0, 3) // Limit to top 3
      
      setDialogSearchResults(filteredResults)
    } catch (e: any) {
      setError(e?.message || 'Search failed')
    } finally {
      setDialogSearching(false)
    }
  }, [dialogSearchQuery, user?.id, friends, pendingRequests])

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      handleDialogSearch()
    }, 300)
    return () => clearTimeout(timeout)
  }, [dialogSearchQuery, handleDialogSearch])

  const sendFriendRequest = React.useCallback(async (recipientId: string) => {
    if (!user?.id) return
    try {
      // Check if already friends
      const { data: existingFriend } = await supabase
        .from('friends')
        .select('id')
        .eq('user_id', user.id)
        .eq('friend_id', recipientId)
        .maybeSingle()
      
      if (existingFriend) {
        setError('Already friends with this user')
        return
      }
      
      // Check if request already exists (including rejected/accepted ones)
      const { data: existingRequest } = await supabase
        .from('friend_requests')
        .select('id, status')
        .eq('requester_id', user.id)
        .eq('recipient_id', recipientId)
        .maybeSingle()
      
      if (existingRequest) {
        if (existingRequest.status === 'pending') {
          setError('Friend request already sent')
          return
        }
        // If rejected or accepted, update it to pending (allows resending after removal/rejection)
        if (existingRequest.status === 'rejected' || existingRequest.status === 'accepted') {
          const { error: err } = await supabase
            .from('friend_requests')
            .update({ status: 'pending' })
            .eq('id', existingRequest.id)
          
          if (err) throw err
          // Refresh search results
          handleDialogSearch()
          await loadPendingRequests()
          setError(null)
          return
        }
      }
      
      // No existing request, create a new one
      const { error: err } = await supabase
        .from('friend_requests')
        .insert({
          requester_id: user.id,
          recipient_id: recipientId,
          status: 'pending'
        })
      
      if (err) throw err
      
      // Refresh search results and pending requests
      handleDialogSearch()
      await Promise.all([loadPendingRequests(), loadSentPendingRequests()])
      setError(null)
      // Optionally close dialog after successful send
      // setAddFriendDialogOpen(false)
    } catch (e: any) {
      setError(e?.message || 'Failed to send friend request')
    }
  }, [user?.id, handleDialogSearch, loadPendingRequests, loadSentPendingRequests])

  const acceptRequest = React.useCallback(async (requestId: string) => {
    try {
      const { error: err } = await supabase.rpc('accept_friend_request', {
        _request_id: requestId
      })
      
      if (err) throw err
      
      // Refresh both lists
      await Promise.all([loadFriends(), loadPendingRequests(), loadSentPendingRequests()])
      setError(null)
    } catch (e: any) {
      setError(e?.message || 'Failed to accept friend request')
    }
  }, [loadFriends, loadPendingRequests, loadSentPendingRequests])

  const rejectRequest = React.useCallback(async (requestId: string) => {
    try {
      const { error: err } = await supabase
        .from('friend_requests')
        .update({ status: 'rejected' })
        .eq('id', requestId)
      
      if (err) throw err
      
      await Promise.all([loadPendingRequests(), loadSentPendingRequests()])
      setError(null)
    } catch (e: any) {
      setError(e?.message || 'Failed to reject friend request')
    }
  }, [loadPendingRequests, loadSentPendingRequests])

  const removeFriend = React.useCallback(async (friendId: string) => {
    if (!user?.id) return
    setConfirmingRemove(null)
    setMenuOpenFriendId(null)
    try {
      // Remove bidirectional friendship - delete both directions
      await Promise.all([
        supabase.from('friends').delete().eq('user_id', user.id).eq('friend_id', friendId),
        supabase.from('friends').delete().eq('user_id', friendId).eq('friend_id', user.id)
      ])
      
      // Clean up old friend_request records (both directions) to allow resending requests
      await Promise.all([
        supabase.from('friend_requests').delete().eq('requester_id', user.id).eq('recipient_id', friendId),
        supabase.from('friend_requests').delete().eq('requester_id', friendId).eq('recipient_id', user.id)
      ])
      
      await loadFriends()
      setError(null)
    } catch (e: any) {
      setError(e?.message || 'Failed to remove friend')
    }
  }, [user?.id, loadFriends])

  // Handle menu positioning and click outside
  React.useEffect(() => {
    if (!menuOpenFriendId) return
    const menuRef = menuRefs.current.get(menuOpenFriendId)
    const anchorRef = anchorRefs.current.get(menuOpenFriendId)
    
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (menuRef && menuRef.contains(t)) return
      if (anchorRef && anchorRef.contains(t)) return
      setMenuOpenFriendId(null)
      setConfirmingRemove(null)
    }
    const onKey = (e: KeyboardEvent) => { 
      if (e.key === 'Escape') {
        setMenuOpenFriendId(null)
        setConfirmingRemove(null)
      }
    }
    const recompute = () => {
      if (!anchorRef) return
      const r = anchorRef.getBoundingClientRect()
      setMenuPos({ top: r.bottom + 8, right: Math.max(0, window.innerWidth - r.right) })
    }
    document.addEventListener('click', onDoc)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', recompute)
    window.addEventListener('scroll', recompute, true)
    recompute()
    return () => {
      document.removeEventListener('click', onDoc)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', recompute)
      window.removeEventListener('scroll', recompute, true)
    }
  }, [menuOpenFriendId])

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto mt-8 px-4 md:px-0">
        <Card className="rounded-3xl">
          <CardContent className="p-6 md:p-8 text-center">
            <p className="text-sm opacity-60">Please log in to manage friends</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto mt-8 px-4 md:px-0">
      <div className={`flex flex-col lg:grid gap-6 items-stretch ${
        pendingRequests.length > 0 || sentPendingRequests.length > 0 
          ? 'lg:grid-cols-[300px_1fr_300px]' 
          : 'lg:grid-cols-1'
      }`}>
        {/* Spacer for left side when received requests don't exist */}
        {pendingRequests.length === 0 && sentPendingRequests.length > 0 && (
          <div className="hidden lg:block"></div>
        )}
        
        {/* Pending Requests I Received - Top on mobile, Left on desktop */}
        {pendingRequests.length > 0 && (
          <Card className="rounded-3xl w-full lg:w-[300px] lg:flex-shrink-0 order-1 lg:order-1 h-full">
            <CardContent className="p-6 md:p-8 space-y-4 h-full flex flex-col">
              <div className="text-xl font-semibold">Pending Invitations</div>
              <div className="space-y-2">
                {pendingRequests.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between p-3 rounded-xl border bg-white"
                  >
                    <div className="flex flex-col gap-1 flex-1">
                      <div className="flex items-center gap-2">
                        <User className="h-5 w-5 opacity-60" />
                        <span className="font-medium">
                          {request.requester_profile?.display_name || 'Unknown'}
                        </span>
                      </div>
                      {request.requester_profile?.email && (
                        <div className="text-xs opacity-60 pl-7">
                          {request.requester_profile.email}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {request.requester_profile?.display_name && (
                        <Button
                          className="rounded-xl"
                          variant="secondary"
                          size="sm"
                          onClick={() => navigate(`/u/${encodeURIComponent(request.requester_profile?.display_name || '')}`)}
                        >
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        className="rounded-xl"
                        variant="default"
                        size="sm"
                        onClick={() => acceptRequest(request.id)}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        className="rounded-xl"
                        variant="secondary"
                        size="sm"
                        onClick={() => rejectRequest(request.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Friends List Card - Middle */}
        <Card className="rounded-3xl w-full lg:max-w-2xl lg:mx-auto order-2 lg:order-2 h-full">
          <CardContent className="p-6 md:p-8 space-y-6 h-full flex flex-col">
            {/* Title and Add Friend Button */}
            <div className="flex items-center justify-between">
              <div className="text-2xl font-semibold">Friends</div>
              <Button
                className="rounded-xl"
                variant="default"
                onClick={() => {
                  setAddFriendDialogOpen(true)
                  setDialogSearchQuery("")
                  setDialogSearchResults([])
                }}
              >
                <UserPlus className="h-4 w-4 mr-2" /> Add Friend
              </Button>
            </div>
            
            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-xl">{error}</div>
            )}

            {/* Friends list */}
            <div className="space-y-2">
              <div className="text-sm font-medium">
                Your Friends ({friends.length})
              </div>
              {loading ? (
                <div className="text-xs opacity-60">Loading...</div>
              ) : friends.length === 0 ? (
                <div className="text-xs opacity-60 p-4 rounded-xl border text-center">
                  No friends yet. Search for people above to add friends!
                </div>
              ) : (
                <div className="space-y-2">
                  {friends.map((friend) => (
                    <div
                      key={friend.id}
                      className="flex items-center justify-between p-3 rounded-xl border bg-white"
                    >
                      <div className="flex flex-col gap-1 flex-1">
                        <div className="flex items-center gap-2">
                          <User className="h-5 w-5 opacity-60" />
                          <span className="font-medium">
                            {friend.friend_profile?.display_name || 'Unknown'}
                          </span>
                        </div>
                        {friend.friend_profile?.email && (
                          <div className="text-xs opacity-60 pl-7">
                            {friend.friend_profile.email}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {friend.friend_profile?.display_name && (
                          <Button
                            variant="secondary"
                            size="icon"
                            className="rounded-full h-8 w-8"
                            aria-label="View profile"
                            onClick={() => navigate(`/u/${encodeURIComponent(friend.friend_profile?.display_name || '')}`)}
                          >
                            <ArrowUpRight className="h-4 w-4" />
                          </Button>
                        )}
                        <div ref={(el) => { if (el) anchorRefs.current.set(friend.id, el) }}>
                          <Button
                            variant="secondary"
                            size="icon"
                            className="rounded-full h-8 w-8"
                            aria-label="Friend options"
                            onClick={(e) => {
                              e.stopPropagation()
                              setMenuOpenFriendId(menuOpenFriendId === friend.id ? null : friend.id)
                              setConfirmingRemove(null)
                            }}
                          >
                            ?
                          </Button>
                          {menuOpenFriendId === friend.id && menuPos && createPortal(
                            <div 
                              ref={(el) => { if (el) menuRefs.current.set(friend.id, el) }}
                              className="w-40 rounded-xl border bg-white shadow z-[60] p-1" 
                              style={{ position: 'fixed', top: menuPos.top, right: menuPos.right }}
                            >
                              {confirmingRemove === friend.id ? (
                                <>
                                  <div className="px-3 py-2 text-xs text-red-600 mb-1">
                                    Remove {friend.friend_profile?.display_name || 'friend'}?
                                  </div>
                                  <div className="flex gap-1">
                                    <button 
                                      className="flex-1 px-2 py-1.5 rounded-lg hover:bg-red-50 text-red-600 text-xs font-medium"
                                      onMouseDown={(e) => { e.stopPropagation(); removeFriend(friend.friend_id) }}
                                    >
                                      Confirm
                                    </button>
                                    <button 
                                      className="flex-1 px-2 py-1.5 rounded-lg hover:bg-stone-50 text-xs"
                                      onMouseDown={(e) => { e.stopPropagation(); setConfirmingRemove(null); setMenuOpenFriendId(null) }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <button 
                                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-50 text-red-600"
                                  onMouseDown={(e) => { e.stopPropagation(); setConfirmingRemove(friend.id) }}
                                >
                                  Remove friend
                                </button>
                              )}
                            </div>,
                            document.body
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pending Requests I Sent - Bottom on mobile, Right on desktop */}
        {sentPendingRequests.length > 0 && (
          <Card className="rounded-3xl w-full lg:w-[300px] lg:flex-shrink-0 order-3 lg:order-3 h-full">
            <CardContent className="p-6 md:p-8 space-y-4 h-full flex flex-col">
              <div className="text-xl font-semibold">Sent Requests</div>
              <div className="space-y-2">
                {sentPendingRequests.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between p-3 rounded-xl border bg-white"
                  >
                    <div className="flex flex-col gap-1 flex-1">
                      <div className="flex items-center gap-2">
                        <User className="h-5 w-5 opacity-60" />
                        <span className="font-medium">
                          {request.recipient_profile?.display_name || 'Unknown'}
                        </span>
                      </div>
                      {request.recipient_profile?.email && (
                        <div className="text-xs opacity-60 pl-7">
                          {request.recipient_profile.email}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {request.recipient_profile?.display_name && (
                        <Button
                          variant="secondary"
                          size="icon"
                          className="rounded-full h-8 w-8"
                          aria-label="View profile"
                          onClick={() => navigate(`/u/${encodeURIComponent(request.recipient_profile?.display_name || '')}`)}
                        >
                          <ArrowUpRight className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        className="rounded-xl"
                        variant="secondary"
                        size="sm"
                        disabled
                      >
                        Pending
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Spacer for right side when sent requests don't exist */}
        {sentPendingRequests.length === 0 && pendingRequests.length > 0 && (
          <div className="hidden lg:block"></div>
        )}
      </div>

      {/* Add Friend Dialog */}
      <Dialog open={addFriendDialogOpen} onOpenChange={setAddFriendDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Add Friend</DialogTitle>
            <DialogDescription>
              Search for users by username or email
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-60" />
              <Input
                className="pl-9"
                placeholder="Search by username or email..."
                value={dialogSearchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDialogSearchQuery(e.target.value)}
              />
            </div>
            {dialogSearching && <div className="text-xs opacity-60">Searching...</div>}
            {dialogSearchResults.length > 0 && (
              <div className="space-y-2">
                {dialogSearchResults.map((result) => (
                  <div
                    key={result.id}
                    className="flex items-center justify-between p-3 rounded-xl border bg-white"
                  >
                    <div className="flex flex-col gap-1 flex-1">
                      <div className="flex items-center gap-2">
                        <User className="h-5 w-5 opacity-60" />
                        <span className="font-medium">{result.display_name || 'Unknown'}</span>
                      </div>
                      {result.email && (
                        <div className="text-xs opacity-60 pl-7">{result.email}</div>
                      )}
                    </div>
                    <Button
                      className="rounded-xl"
                      variant={result.is_friend ? "secondary" : result.is_pending ? "secondary" : "default"}
                      size="sm"
                      onClick={() => !result.is_friend && !result.is_pending && sendFriendRequest(result.id)}
                      disabled={result.is_friend || result.is_pending}
                    >
                      {result.is_friend ? (
                        <>
                          <Check className="h-4 w-4 mr-1" /> Friends
                        </>
                      ) : result.is_pending ? (
                        <>
                          Pending
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-4 w-4 mr-1" /> Add Friend
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {dialogSearchQuery && !dialogSearching && dialogSearchResults.length === 0 && (
              <div className="text-xs opacity-60 text-center py-4">No users found</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
