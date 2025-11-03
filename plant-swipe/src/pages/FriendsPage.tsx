import React from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/context/AuthContext"
import { supabase } from "@/lib/supabaseClient"
import { User, Search, UserPlus, Check, X } from "lucide-react"

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
}

type Friend = {
  id: string
  user_id: string
  friend_id: string
  created_at: string
  friend_profile?: {
    id: string
    display_name: string | null
  }
}

type SearchResult = {
  id: string
  display_name: string | null
}

export const FriendsPage: React.FC = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = React.useState("")
  const [friends, setFriends] = React.useState<Friend[]>([])
  const [pendingRequests, setPendingRequests] = React.useState<FriendRequest[]>([])
  const [searchResults, setSearchResults] = React.useState<SearchResult[]>([])
  const [loading, setLoading] = React.useState(true)
  const [searching, setSearching] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

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
        
        const profileMap = new Map((profiles || []).map(p => [p.id, p]))
        const friendsWithProfiles = (data || []).map(f => ({
          ...f,
          friend_profile: profileMap.get(f.friend_id)
        }))
        setFriends(friendsWithProfiles as Friend[])
      } else {
        setFriends([])
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load friends')
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
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', requesterIds)
        
        // Fetch emails using RPC function (only for users who sent friend requests to you)
        const emailPromises = requesterIds.map(async (id) => {
          try {
            const { data: emailData } = await supabase.rpc('get_friend_request_requester_email', { _requester_id: id })
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
          requester_profile: {
            ...profileMap.get(r.requester_id),
            email: emailMap.get(r.requester_id) || null
          }
        }))
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
    Promise.all([loadFriends(), loadPendingRequests()]).finally(() => {
      setLoading(false)
    })
  }, [user?.id, loadFriends, loadPendingRequests])

  const handleSearch = React.useCallback(async () => {
    if (!searchQuery.trim() || !user?.id) {
      setSearchResults([])
      return
    }
    setSearching(true)
    try {
      // Search for users by display name
      const { data, error: err } = await supabase
        .from('profiles')
        .select('id, display_name')
        .ilike('display_name', `%${searchQuery.trim()}%`)
        .neq('id', user.id)
        .limit(10)
      
      if (err) throw err
      
      // Filter out users who are already friends or have pending requests
      const friendIds = new Set(friends.map(f => f.friend_id))
      
      // Get pending requests sent by current user (not rejected ones)
      const { data: sentRequests } = await supabase
        .from('friend_requests')
        .select('recipient_id')
        .eq('requester_id', user.id)
        .eq('status', 'pending')
      
      const requestIds = new Set([
        ...pendingRequests.map(r => r.requester_id),
        ...(sentRequests?.map(r => r.recipient_id) || [])
      ])
      
      const filtered = (data || []).filter(p => 
        !friendIds.has(p.id) && 
        !requestIds.has(p.id) &&
        p.id !== user.id
      )
      
      setSearchResults(filtered as SearchResult[])
    } catch (e: any) {
      setError(e?.message || 'Search failed')
    } finally {
      setSearching(false)
    }
  }, [searchQuery, user?.id, friends, pendingRequests])

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      handleSearch()
    }, 300)
    return () => clearTimeout(timeout)
  }, [searchQuery, handleSearch])

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
          handleSearch()
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
      
      // Refresh search results
      handleSearch()
      setError(null)
    } catch (e: any) {
      setError(e?.message || 'Failed to send friend request')
    }
  }, [user?.id, handleSearch])

  const acceptRequest = React.useCallback(async (requestId: string) => {
    try {
      const { error: err } = await supabase.rpc('accept_friend_request', {
        _request_id: requestId
      })
      
      if (err) throw err
      
      // Refresh both lists
      await Promise.all([loadFriends(), loadPendingRequests()])
      handleSearch()
      setError(null)
    } catch (e: any) {
      setError(e?.message || 'Failed to accept friend request')
    }
  }, [loadFriends, loadPendingRequests, handleSearch])

  const rejectRequest = React.useCallback(async (requestId: string) => {
    try {
      const { error: err } = await supabase
        .from('friend_requests')
        .update({ status: 'rejected' })
        .eq('id', requestId)
      
      if (err) throw err
      
      await loadPendingRequests()
      setError(null)
    } catch (e: any) {
      setError(e?.message || 'Failed to reject friend request')
    }
  }, [loadPendingRequests])

  const removeFriend = React.useCallback(async (friendId: string) => {
    if (!user?.id) return
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
    <div className="max-w-3xl mx-auto mt-8 px-4 md:px-0">
      <Card className="rounded-3xl">
        <CardContent className="p-6 md:p-8 space-y-6">
          <div className="text-2xl font-semibold">Friends</div>
          
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-xl">{error}</div>
          )}

          {/* Search for new friends */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Search for people</div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-60" />
              <Input
                className="pl-9"
                placeholder="Search by display name..."
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              />
            </div>
            {searching && <div className="text-xs opacity-60">Searching...</div>}
            {searchResults.length > 0 && (
              <div className="space-y-2 mt-2">
                {searchResults.map((result) => (
                  <div
                    key={result.id}
                    className="flex items-center justify-between p-3 rounded-xl border bg-white"
                  >
                    <div className="flex items-center gap-2">
                      <User className="h-5 w-5 opacity-60" />
                      <span className="font-medium">{result.display_name || 'Unknown'}</span>
                    </div>
                    <Button
                      className="rounded-xl"
                      variant="secondary"
                      size="sm"
                      onClick={() => sendFriendRequest(result.id)}
                    >
                      <UserPlus className="h-4 w-4 mr-1" /> Send Request
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {searchQuery && !searching && searchResults.length === 0 && (
              <div className="text-xs opacity-60 mt-2">No users found</div>
            )}
          </div>

          {/* Pending friend requests */}
          {pendingRequests.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Pending Requests</div>
              {pendingRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between p-3 rounded-xl border bg-white"
                >
                  <div className="flex flex-col gap-1">
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
                    <Button
                      className="rounded-xl"
                      variant="default"
                      size="sm"
                      onClick={() => acceptRequest(request.id)}
                    >
                      <Check className="h-4 w-4 mr-1" /> Accept
                    </Button>
                    <Button
                      className="rounded-xl"
                      variant="secondary"
                      size="sm"
                      onClick={() => rejectRequest(request.id)}
                    >
                      <X className="h-4 w-4 mr-1" /> Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
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
                    <button
                      className="flex items-center gap-2 hover:opacity-70 transition"
                      onClick={() => navigate(`/u/${encodeURIComponent(friend.friend_profile?.display_name || '')}`)}
                    >
                      <User className="h-5 w-5 opacity-60" />
                      <span className="font-medium">
                        {friend.friend_profile?.display_name || 'Unknown'}
                      </span>
                    </button>
                    <Button
                      className="rounded-xl"
                      variant="secondary"
                      size="sm"
                      onClick={() => removeFriend(friend.friend_id)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
