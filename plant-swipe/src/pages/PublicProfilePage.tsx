import React from "react"
import { useParams } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { createPortal } from "react-dom"
import { supabase } from "@/lib/supabaseClient"
import { useAuth } from "@/context/AuthContext"
import { EditProfileDialog, type EditProfileValues } from "@/components/profile/EditProfileDialog"
import { applyAccentByKey, saveAccentKey, getAccentOption, type AccentKey } from "@/lib/accent"
import { validateUsername } from "@/lib/username"
import { MapPin, User as UserIcon, UserPlus, Check, Lock, EyeOff, Flame, Sprout, Home, Trophy, UserCheck, Share2, MoreVertical, AlertTriangle, Ban, MessageCircle, Bug, Medal, Briefcase, ExternalLink, Leaf } from "lucide-react"
import { ProfileNameBadges } from "@/components/profile/UserRoleBadges"
import type { UserRole } from "@/constants/userRoles"
import { hasBugCatcherRole } from "@/constants/userRoles"
import { SearchInput } from "@/components/ui/search-input"
import { useTranslation } from "react-i18next"
import i18n from "@/lib/i18n"
import { ProfilePageSkeleton } from "@/components/garden/GardenSkeletons"
import { usePageMetadata } from "@/hooks/usePageMetadata"
import { BookmarksSection } from "@/components/profile/BookmarksSection"
import { PublicGardensSection } from "@/components/profile/PublicGardensSection"
import { useLanguageNavigate } from "@/lib/i18nRouting"
import { Link } from "@/components/i18n/Link"
import { ReportUserDialog } from "@/components/moderation/ReportUserDialog"
import { BlockUserDialog } from "@/components/moderation/BlockUserDialog"
import { hasBlockedUser, unblockUser, isBlockedByUser } from "@/lib/moderation"
import { getOrCreateConversation } from "@/lib/messaging"
import { sendFriendRequestPushNotification, refreshAppBadge } from "@/lib/notifications"

type PublicProfile = {
  id: string
  username: string | null
  display_name: string | null
  city: string | null
  country: string | null
  bio: string | null
  avatar_url: string | null
  is_admin?: boolean | null
  roles?: UserRole[] | null
  joined_at?: string | null
  last_seen_at?: string | null
  is_online?: boolean | null
  accent_key?: string | null
  is_private?: boolean | null
  disable_friend_requests?: boolean | null
  isAdminViewingPrivateNonFriend?: boolean | null
  experience_level?: string | null
  job?: string | null
  profile_link?: string | null
  show_country?: boolean | null
  is_banned?: boolean | null
}

type PublicStats = {
  plantsTotal: number
  gardensCount: number
  currentStreak: number
  bestStreak: number
  friendsCount?: number
  // Bug Catcher stats
  bugPoints?: number
  bugCatcherRank?: number
}

type DayAgg = { day: string; completed: number; any_success: boolean }

type ProfileSuggestion = {
  id: string
  displayName: string | null
  username: string | null
  country: string | null
  avatarUrl: string | null
  isPrivate: boolean
  isFriend: boolean
  isSelf: boolean
  canView: boolean
  isBanned: boolean
}

export default function PublicProfilePage() {
  const params = useParams()
  const navigate = useLanguageNavigate()
  const { user, profile, refreshProfile, signOut, deleteAccount } = useAuth()
  const { t } = useTranslation('common')
  const displayParam = String(params.username || '')

  // Handle logout - stay on page unless it requires authentication
  const handleLogout = React.useCallback(async () => {
    await signOut()
    // If viewing /u/_me (which requires auth to resolve), redirect to home
    // Otherwise stay on the current profile page (public profiles are viewable by anyone)
    if (displayParam === '_me') {
      navigate('/')
    }
    // For all other profile pages (/u/USERNAME), stay on the page
  }, [signOut, navigate, displayParam])

  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [pp, setPp] = React.useState<PublicProfile | null>(null)
  const [stats, setStats] = React.useState<PublicStats | null>(null)
  const [monthDays, setMonthDays] = React.useState<DayAgg[]>([])
  const [canViewProfile, setCanViewProfile] = React.useState(true)
  const [searchTerm, setSearchTerm] = React.useState('')
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [searchResults, setSearchResults] = React.useState<ProfileSuggestion[]>([])
  const [searchLoading, setSearchLoading] = React.useState(false)
  const [searchError, setSearchError] = React.useState<string | null>(null)
  const searchContainerRef = React.useRef<HTMLDivElement | null>(null)
  const searchRequestRef = React.useRef(0)
  const trimmedSearchTerm = searchTerm.trim()
  const needsMoreInput = trimmedSearchTerm.length < 2
  const fallbackProfileTitle = t('seo.profile.fallbackTitle', { defaultValue: 'Aphylia grower profile' })
  const fallbackProfileDescription = t('seo.profile.fallbackDescription', {
    defaultValue: 'Browse public gardens, streaks, and highlights from Aphylia growers.',
  })
  const preferredDisplayName = React.useMemo(() => {
    const candidate =
      (pp?.display_name && pp.display_name.trim()) ||
      (pp?.username && pp.username.trim()) ||
      (displayParam && displayParam !== '_me' ? displayParam : '')
    return candidate ? candidate.trim() : ''
  }, [pp?.display_name, pp?.username, displayParam])
  const seoTitle = preferredDisplayName
    ? t('seo.profile.title', { name: preferredDisplayName, defaultValue: `${preferredDisplayName} on Aphylia` })
    : fallbackProfileTitle
  const bioDescription = typeof pp?.bio === 'string' ? pp.bio.trim() : ''
  const seoDescription =
    bioDescription ||
    (preferredDisplayName
      ? t('seo.profile.description', {
          name: preferredDisplayName,
          defaultValue: `See shared gardens, stats, and activity from ${preferredDisplayName}.`,
        })
      : fallbackProfileDescription)
  usePageMetadata({ 
    title: seoTitle, 
    description: seoDescription,
    image: pp?.avatar_url ?? undefined,
    url: preferredDisplayName ? `/u/${encodeURIComponent(preferredDisplayName)}` : undefined,
  })


  const formatLastSeen = React.useCallback((iso: string | null | undefined) => {
    if (!iso) return t('profile.aLongTimeAgo')
    const last = new Date(iso)
    const now = new Date()
    const diffMs = Math.max(0, now.getTime() - last.getTime())
    const diffMin = Math.floor(diffMs / (60 * 1000))
    const diffHours = Math.floor(diffMin / 60)
    const diffDays = Math.floor(diffHours / 24)
    const diffWeeks = Math.floor(diffDays / 7)
    if (diffMin <= 10) return t('profile.online')
    if (diffHours < 1) return t('profile.online')
    if (diffHours === 1) return t('profile.oneHourAgo')
    if (diffHours < 6) return t('profile.fewHoursAgo')
    if (diffDays === 1) return t('profile.oneDayAgo')
    if (diffDays <= 6) return t('profile.fewDaysAgo')
    if (diffWeeks <= 3) return t('profile.fewWeeksAgo')
    return t('profile.aLongTimeAgo')
  }, [t])

  React.useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        // Handle special case: if displayParam is "_me", look up by user ID
        let row: any = null
        if (displayParam === '_me' && user?.id) {
          // Look up current user by ID
          const { data: profileData, error: pErr } = await supabase
            .from('profiles')
            .select('id, display_name, city, country, bio, avatar_url, is_admin, roles, accent_key, is_private, disable_friend_requests, experience_level, job, profile_link, show_country')
            .eq('id', user.id)
            .maybeSingle()
          if (!pErr && profileData) {
            const { data: authUser } = await supabase.auth.getUser()
            row = {
              ...profileData,
              joined_at: authUser?.user?.created_at || null,
              last_seen_at: null,
              is_online: false,
            }
          }
        } else {
          // Basic profile by display name
          const { data: rows, error: perr } = await supabase.rpc('get_profile_public_by_display_name', { _name: displayParam })
          if (perr) throw perr
          row = Array.isArray(rows) ? rows[0] : rows
        }
        
        if (!row) {
          setError(t('profile.userNotFound'))
          setLoading(false)
          return
        }
        const userId = String(row.id)
        
        // Fetch roles if not already included in the row data
        let profileRoles: UserRole[] | null = null
        if (!row.roles) {
          try {
            const { data: rolesData } = await supabase
              .from('profiles')
              .select('roles')
              .eq('id', userId)
              .maybeSingle()
            if (rolesData && Array.isArray(rolesData.roles)) {
              profileRoles = rolesData.roles
            }
          } catch {}
        } else if (Array.isArray(row.roles)) {
          profileRoles = row.roles
        }
        // Merge roles into row for use later
        row = { ...row, roles: profileRoles }
        
        const profileIsPrivate = Boolean(row.is_private || false)
        const isOwnerViewing = user?.id === userId
        const viewerIsAdmin = Boolean(profile?.is_admin || false)
        
        // Check if viewer can see this profile
        let viewerCanSee = true
        let isAdminViewingPrivateNonFriend = false
        let treatingAsPrivateDueToBlock = false
        
        // Check if the profile owner has blocked the viewer
        // If blocked, treat the profile as private (even if it's not)
        if (!isOwnerViewing && user?.id) {
          const blockedByOwner = await isBlockedByUser(userId)
          if (blockedByOwner && !viewerIsAdmin) {
            // Profile owner blocked the viewer - show as private
            viewerCanSee = false
            treatingAsPrivateDueToBlock = true
          }
        }
        
        if (!treatingAsPrivateDueToBlock && profileIsPrivate && !isOwnerViewing && !viewerIsAdmin) {
          // Check if they are friends
          if (user?.id) {
            // Check if friendship exists in either direction
            const { data: friendCheck1 } = await supabase
              .from('friends')
              .select('id')
              .eq('user_id', user.id)
              .eq('friend_id', userId)
              .maybeSingle()
            
            const { data: friendCheck2 } = await supabase
              .from('friends')
              .select('id')
              .eq('user_id', userId)
              .eq('friend_id', user.id)
              .maybeSingle()
            
            viewerCanSee = Boolean(friendCheck1?.id || friendCheck2?.id)
          } else {
            viewerCanSee = false
          }
        } else if (!treatingAsPrivateDueToBlock && profileIsPrivate && !isOwnerViewing && viewerIsAdmin) {
          // Admin viewing private profile - check if they're friends
          if (user?.id) {
            const { data: friendCheck1 } = await supabase
              .from('friends')
              .select('id')
              .eq('user_id', user.id)
              .eq('friend_id', userId)
              .maybeSingle()
            
            const { data: friendCheck2 } = await supabase
              .from('friends')
              .select('id')
              .eq('user_id', userId)
              .eq('friend_id', user.id)
              .maybeSingle()
            
            const isFriend = Boolean(friendCheck1?.id || friendCheck2?.id)
            if (!isFriend) {
              isAdminViewingPrivateNonFriend = true
              // Log admin visit to private profile
              try {
                const session = (await supabase.auth.getSession()).data.session
                const token = session?.access_token
                const headers: Record<string, string> = { 'Content-Type': 'application/json' }
                if (token) headers.Authorization = `Bearer ${token}`
                await fetch('/api/admin/log-action', {
                  method: 'POST',
                  headers,
                  credentials: 'same-origin',
                  body: JSON.stringify({
                    action: 'view_private_profile',
                    target: userId,
                    detail: {
                      profile_display_name: row.display_name || null,
                      profile_is_private: true,
                      admin_is_friend: false,
                      via: 'profile_page'
                    }
                  })
                }).catch(() => {}) // Don't block if logging fails
              } catch {}
            }
            viewerCanSee = true // Admins can always see private profiles
          }
        }
        
        setCanViewProfile(viewerCanSee)
        
        setPp({
          id: userId,
          username: null,
          display_name: row.display_name || null,
          city: row.city || null,
          country: row.country || null,
          bio: row.bio || null,
          avatar_url: row.avatar_url || null,
          is_admin: Boolean(row.is_admin || false),
          roles: Array.isArray(row.roles) ? row.roles : null,
          joined_at: row.joined_at ? String(row.joined_at) : null,
          last_seen_at: row.last_seen_at ? String(row.last_seen_at) : null,
          is_online: Boolean(row.is_online || false),
          accent_key: row.accent_key || null,
          is_private: profileIsPrivate,
          disable_friend_requests: Boolean(row.disable_friend_requests || false),
          isAdminViewingPrivateNonFriend: isAdminViewingPrivateNonFriend,
          experience_level: row.experience_level || null,
          job: row.job || null,
          profile_link: row.profile_link || null,
          show_country: row.show_country != null ? Boolean(row.show_country) : true,
          is_banned: Boolean(row.is_banned || false),
        })

        // Only load stats and data if user can view profile
        if (viewerCanSee) {
          // Stats (plants total, gardens count, current and best streak)
          const { data: s, error: serr } = await supabase.rpc('get_user_profile_public_stats', { _user_id: userId })
          if (!serr && s) {
            const statRow = Array.isArray(s) ? s[0] : s
            setStats({
              plantsTotal: Number(statRow.plants_total || 0),
              gardensCount: Number(statRow.gardens_count || 0),
              currentStreak: Number(statRow.current_streak || 0),
              bestStreak: Number(statRow.longest_streak || 0),
            })
          }

          // Friend count
          const { data: friendCount, error: ferr } = await supabase.rpc('get_friend_count', { _user_id: userId })
          if (!ferr && typeof friendCount === 'number') {
            setStats((prev) => prev ? { ...prev, friendsCount: friendCount } : null)
          } else {
            setStats((prev) => prev ? { ...prev, friendsCount: 0 } : null)
          }

          // Bug Catcher stats (if user has bug_catcher role)
          if (hasBugCatcherRole(profileRoles)) {
            const { data: profilePoints } = await supabase
              .from('profiles')
              .select('bug_points')
              .eq('id', userId)
              .single()
            
            const { data: bugRank } = await supabase.rpc('get_bug_catcher_rank', { _user_id: userId })
            
            setStats((prev) => prev ? {
              ...prev,
              bugPoints: profilePoints?.bug_points || 0,
              bugCatcherRank: bugRank || 0
            } : null)
          }

          // Heatmap: last 28 days (4 rows × 7 columns)
          const today = new Date()
          const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
          const start = new Date(end)
          start.setUTCDate(end.getUTCDate() - 27)
          const startIso = start.toISOString().slice(0,10)
          const endIso = end.toISOString().slice(0,10)
          const { data: series, error: herr } = await supabase.rpc('get_user_daily_tasks', { _user_id: userId, _start: startIso, _end: endIso })
          if (!herr && Array.isArray(series)) {
            const days: DayAgg[] = series.map((r: any) => ({ day: String(r.day).slice(0,10), completed: Number(r.completed || 0), any_success: Boolean(r.any_success) }))
            setMonthDays(days)
          } else {
            setMonthDays([])
          }
        } else {
          // Clear stats if can't view
          setStats(null)
          setMonthDays([])
        }
      } catch (e: any) {
        setError(e?.message || t('profile.failedToLoad'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [displayParam, user?.id])

  const isOwner = Boolean(user?.id && pp?.id && user.id === pp.id)

  React.useEffect(() => {
    setSearchTerm('')
    setSearchOpen(false)
    setSearchResults([])
    setSearchError(null)
  }, [displayParam])

  React.useEffect(() => {
    if (!searchOpen) return
    const handlePointer = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node
      if (searchContainerRef.current && !searchContainerRef.current.contains(target)) {
        setSearchOpen(false)
      }
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSearchOpen(false)
    }
    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('touchstart', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('touchstart', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [searchOpen])

  React.useEffect(() => {
      if (!searchOpen || !user?.id) {
      searchRequestRef.current += 1
      setSearchLoading(false)
      if (!searchOpen) setSearchError(null)
      setSearchResults([])
      return
    }
      if (trimmedSearchTerm.length < 2) {
      searchRequestRef.current += 1
      setSearchLoading(false)
      setSearchError(null)
      setSearchResults([])
      return
    }
    const requestId = ++searchRequestRef.current
    const fallbackError = t('profile.searchUsers.error')
    setSearchLoading(true)
    setSearchError(null)
    const handle = window.setTimeout(async () => {
      try {
        const { data, error } = await supabase.rpc('search_user_profiles', {
          _term: trimmedSearchTerm,
          _limit: 3,
        })
        if (requestId !== searchRequestRef.current) return
        if (error) {
          setSearchError(fallbackError)
          setSearchResults([])
          return
        }
        if (Array.isArray(data)) {
          setSearchResults(data.map((row: any) => ({
            id: String(row.id),
            displayName: row.display_name ?? null,
            username: row.username ?? null,
            country: row.country ?? null,
            avatarUrl: row.avatar_url ?? null,
            isPrivate: Boolean(row.is_private),
            isFriend: Boolean(row.is_friend),
            isSelf: Boolean(row.is_self),
            canView: Boolean(row.can_view),
            isBanned: Boolean(row.is_banned),
          })))
          setSearchError(null)
        } else {
          setSearchResults([])
        }
      } catch {
        if (requestId !== searchRequestRef.current) return
        setSearchError(fallbackError)
        setSearchResults([])
      } finally {
        if (requestId === searchRequestRef.current) {
          setSearchLoading(false)
        }
      }
    }, 200)
    return () => {
      window.clearTimeout(handle)
    }
  }, [trimmedSearchTerm, searchOpen, user?.id, t])


  const [menuOpen, setMenuOpen] = React.useState(false)
  const anchorRef = React.useRef<HTMLDivElement | null>(null)
  const menuRef = React.useRef<HTMLDivElement | null>(null)
  const [menuPos, setMenuPos] = React.useState<{ top: number; right: number } | null>(null)

  // Other user menu (report/block) state
  const [otherMenuOpen, setOtherMenuOpen] = React.useState(false)
  const otherMenuAnchorRef = React.useRef<HTMLDivElement | null>(null)
  const otherMenuRef = React.useRef<HTMLDivElement | null>(null)
  const [otherMenuPos, setOtherMenuPos] = React.useState<{ top: number; right: number } | null>(null)
  
  // Report/Block dialog state
  const [reportDialogOpen, setReportDialogOpen] = React.useState(false)
  const [blockDialogOpen, setBlockDialogOpen] = React.useState(false)
  const [isBlocked, setIsBlocked] = React.useState(false)
  const [blockLoading, setBlockLoading] = React.useState(false)
  const [messageLoading, setMessageLoading] = React.useState(false)

  // Share button state
  const [shareStatus, setShareStatus] = React.useState<'idle' | 'copied' | 'error'>('idle')
  const shareTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    return () => {
      if (shareTimeoutRef.current) clearTimeout(shareTimeoutRef.current)
    }
  }, [])

  const handleShare = React.useCallback(async () => {
    if (typeof window === 'undefined') return
    const shareUrl = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({
          title: preferredDisplayName || t('profile.member'),
          url: shareUrl,
        })
        setShareStatus('copied')
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl)
        setShareStatus('copied')
      } else {
        setShareStatus('error')
      }
    } catch {
      // User cancelled or error
      setShareStatus('error')
    }
    if (shareTimeoutRef.current) clearTimeout(shareTimeoutRef.current)
    shareTimeoutRef.current = setTimeout(() => setShareStatus('idle'), 2500)
  }, [preferredDisplayName, t])

  const [editOpen, setEditOpen] = React.useState(false)
  const [editSubmitting, setEditSubmitting] = React.useState(false)
  const [editError, setEditError] = React.useState<string | null>(null)

  // Auto-open edit dialog if user has no display_name
  React.useEffect(() => {
    if (isOwner && !pp?.display_name && displayParam === '_me') {
      setEditOpen(true)
    }
  }, [isOwner, pp?.display_name, displayParam])

  // Friend request state
  const [friendStatus, setFriendStatus] = React.useState<'none' | 'friends' | 'request_sent' | 'request_received'>('none')
  const [friendRequestId, setFriendRequestId] = React.useState<string | null>(null)
  const [friendRequestLoading, setFriendRequestLoading] = React.useState(false)
  const [friendsSince, setFriendsSince] = React.useState<string | null>(null)

  // Check friend status
  React.useEffect(() => {
    if (!user?.id || !pp?.id || isOwner) {
      setFriendStatus('none')
      setFriendsSince(null)
      return
    }
    let cancelled = false
    const checkStatus = async () => {
      try {
        // Check if already friends
        const { data: friendCheck } = await supabase
          .from('friends')
          .select('id, created_at')
          .eq('user_id', user.id)
          .eq('friend_id', pp.id)
          .maybeSingle()
        
        if (friendCheck && !cancelled) {
          setFriendStatus('friends')
          setFriendsSince(friendCheck.created_at ? String(friendCheck.created_at) : null)
          return
        }

        // Check for pending requests
        const { data: sentRequest } = await supabase
          .from('friend_requests')
          .select('id')
          .eq('requester_id', user.id)
          .eq('recipient_id', pp.id)
          .eq('status', 'pending')
          .maybeSingle()
        
        if (sentRequest && !cancelled) {
          setFriendStatus('request_sent')
          setFriendRequestId(sentRequest.id)
          setFriendsSince(null)
          return
        }

        const { data: receivedRequest } = await supabase
          .from('friend_requests')
          .select('id')
          .eq('requester_id', pp.id)
          .eq('recipient_id', user.id)
          .eq('status', 'pending')
          .maybeSingle()
        
        if (receivedRequest && !cancelled) {
          setFriendStatus('request_received')
          setFriendRequestId(receivedRequest.id)
          setFriendsSince(null)
          return
        }

        if (!cancelled) {
          setFriendStatus('none')
          setFriendsSince(null)
        }
      } catch {}
    }
    checkStatus()
    return () => { cancelled = true }
  }, [user?.id, pp?.id, isOwner])

  const sendFriendRequest = React.useCallback(async () => {
    if (!user?.id || !pp?.id || isOwner) return
    setFriendRequestLoading(true)
    try {
      // Check if there's an existing request in EITHER direction
      const { data: existingRequest } = await supabase
        .from('friend_requests')
        .select('id, status, requester_id')
        .or(`and(requester_id.eq.${user.id},recipient_id.eq.${pp.id}),and(requester_id.eq.${pp.id},recipient_id.eq.${user.id})`)
        .maybeSingle()
      
      if (existingRequest) {
        if (existingRequest.status === 'pending') {
          // If there's a pending request FROM the other user TO us, accept it instead
          if (existingRequest.requester_id === pp.id) {
            const { error: acceptErr } = await supabase.rpc('accept_friend_request', {
              _request_id: existingRequest.id
            })
            if (acceptErr) throw acceptErr
            setFriendStatus('friends')
            setFriendsSince(new Date().toISOString())
            setFriendRequestLoading(false)
            return
          }
          // Our request is already pending
          setFriendStatus('request_sent')
          setFriendRequestId(existingRequest.id)
          setFriendRequestLoading(false)
          return
        }
        
        // For rejected or accepted requests, delete the old one first
        // This ensures we can always create a new request
        if (existingRequest.status === 'rejected' || existingRequest.status === 'accepted') {
          await supabase
            .from('friend_requests')
            .delete()
            .eq('id', existingRequest.id)
        }
      }
      
      // Create a new friend request
      const { data, error: err } = await supabase
        .from('friend_requests')
        .insert({
          requester_id: user.id,
          recipient_id: pp.id,
          status: 'pending'
        })
        .select('id')
        .single()
      
      if (err) throw err
      setFriendStatus('request_sent')
      setFriendRequestId(data.id)
      
      // Send push notification to recipient
      const senderName = profile?.display_name || 'Someone'
      const { data: recipientProfile } = await supabase
        .from('profiles')
        .select('language')
        .eq('id', pp.id)
        .maybeSingle()
      sendFriendRequestPushNotification(pp.id, senderName, recipientProfile?.language || 'en').catch(() => {})
    } catch (e: any) {
      setEditError(e?.message || t('profile.editProfile.failedToSendFriendRequest'))
    } finally {
      setFriendRequestLoading(false)
    }
  }, [user?.id, pp?.id, isOwner, profile?.display_name])

  const acceptFriendRequest = React.useCallback(async () => {
    if (!friendRequestId || !user?.id || !pp?.id) return
    setFriendRequestLoading(true)
    try {
      const { error: err } = await supabase.rpc('accept_friend_request', {
        _request_id: friendRequestId
      })
      
      if (err) throw err
      
      // Fetch the friendship record to get the created_at date
      const { data: friendship } = await supabase
        .from('friends')
        .select('created_at')
        .eq('user_id', user.id)
        .eq('friend_id', pp.id)
        .maybeSingle()
      
      setFriendStatus('friends')
      if (friendship?.created_at) {
        setFriendsSince(String(friendship.created_at))
      } else {
        setFriendsSince(new Date().toISOString())
      }
      
      // Refresh app badge after accepting friend request
      refreshAppBadge(user.id).catch(() => {})
    } catch (e: any) {
      setEditError(e?.message || t('profile.editProfile.failedToAcceptFriendRequest'))
    } finally {
      setFriendRequestLoading(false)
    }
  }, [friendRequestId, user?.id, pp?.id])

  React.useEffect(() => {
    if (!menuOpen) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (menuRef.current && menuRef.current.contains(t)) return
      if (anchorRef.current && anchorRef.current.contains(t)) return
      setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    const recompute = () => {
      const a = anchorRef.current
      if (!a) return
      const r = a.getBoundingClientRect()
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
  }, [menuOpen])

  // Handle other user menu (report/block) positioning
  React.useEffect(() => {
    if (!otherMenuOpen) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (otherMenuRef.current && otherMenuRef.current.contains(t)) return
      if (otherMenuAnchorRef.current && otherMenuAnchorRef.current.contains(t)) return
      setOtherMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOtherMenuOpen(false) }
    const recompute = () => {
      const a = otherMenuAnchorRef.current
      if (!a) return
      const r = a.getBoundingClientRect()
      setOtherMenuPos({ top: r.bottom + 8, right: Math.max(0, window.innerWidth - r.right) })
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
  }, [otherMenuOpen])

  // Check if user is blocked
  React.useEffect(() => {
    if (!user?.id || !pp?.id || isOwner) return
    hasBlockedUser(pp.id).then(setIsBlocked).catch(() => {})
  }, [user?.id, pp?.id, isOwner])

  // Handle unblock
  const handleUnblock = React.useCallback(async () => {
    if (!pp?.id) return
    setBlockLoading(true)
    try {
      await unblockUser(pp.id)
      setIsBlocked(false)
    } catch (e) {
      console.error('Failed to unblock:', e)
    } finally {
      setBlockLoading(false)
    }
  }, [pp?.id])

  // Handle starting a conversation with this user
  const handleStartConversation = React.useCallback(async () => {
    if (!pp?.id || friendStatus !== 'friends') return
    setMessageLoading(true)
    try {
      const conversationId = await getOrCreateConversation(pp.id)
      navigate(`/messages?conversation=${conversationId}`)
    } catch (e) {
      console.error('Failed to start conversation:', e)
    } finally {
      setMessageLoading(false)
    }
  }, [pp?.id, friendStatus, navigate])

  const daysFlat = React.useMemo(() => {
    // Build a fixed 28-day window (UTC)
    // Render as GitHub-like packed columns: 4 rows, 7 columns (top→bottom flow)
    const end = new Date(Date.UTC(
      new Date().getUTCFullYear(),
      new Date().getUTCMonth(),
      new Date().getUTCDate()
    ))
    const start = new Date(end)
    start.setUTCDate(end.getUTCDate() - 27)

    const dayToAgg = new Map<string, DayAgg>()
    for (const d of monthDays) dayToAgg.set(d.day, d)

    const items: Array<{ date: string; value: number; success: boolean }> = []
    for (let i = 0; i < 28; i++) {
      const cur = new Date(start)
      cur.setUTCDate(start.getUTCDate() + i)
      const ymd = cur.toISOString().slice(0, 10)
      const agg = dayToAgg.get(ymd)
      items.push(agg ? { date: ymd, value: agg.completed, success: agg.any_success } : { date: ymd, value: 0, success: false })
    }
    return items
  }, [monthDays])

  // Compute max value to scale color intensity like GitHub contributions
  const maxCount = React.useMemo(() => monthDays.reduce((m, d) => Math.max(m, d.completed || 0), 0), [monthDays])

  const colorFor = (cell: { value: number; success: boolean } | null) => {
    if (!cell) return 'bg-stone-200 dark:bg-stone-700'
    // Grey: Tasks were not accomplished that day (tasks were due but not all completed)
    if (!cell.success) return 'bg-stone-200 dark:bg-stone-700'
    // Green: Either no tasks were needed OR all tasks were done
    // Light mode: lighter color = fewer tasks, darker color = more tasks
    // Dark mode: darker color = fewer tasks, lighter color = more tasks
    if (maxCount <= 0) return 'bg-emerald-400 dark:bg-emerald-800'
    const ratio = (cell.value || 0) / maxCount
    if (ratio <= 0) return 'bg-emerald-300 dark:bg-emerald-900'
    if (ratio <= 0.25) return 'bg-emerald-400 dark:bg-emerald-800'
    if (ratio <= 0.5) return 'bg-emerald-500 dark:bg-emerald-700'
    if (ratio <= 0.75) return 'bg-emerald-600 dark:bg-emerald-600'
    return 'bg-emerald-700 dark:bg-emerald-500'
  }

  const [tooltip, setTooltip] = React.useState<{ top: number; left: number; date: string; value: number; success: boolean } | null>(null)
  const showTooltip = (el: HTMLElement, cell: { date: string; value: number; success: boolean }) => {
    const r = el.getBoundingClientRect()
    const top = Math.max(8, r.top - 8)
    const left = r.left + r.width / 2
    setTooltip({ top, left, date: cell.date, value: cell.value, success: cell.success })
  }
  const hideTooltip = () => setTooltip(null)

  const handleSelectSuggestion = React.useCallback((suggestion: ProfileSuggestion) => {
    if (!suggestion) return
    searchRequestRef.current += 1
    setSearchOpen(false)
    setSearchTerm('')
    setSearchResults([])
    setSearchError(null)
    const target = suggestion.displayName || suggestion.username
    if (suggestion.isSelf && (!target || target.trim() === '')) {
      navigate('/u/_me')
      return
    }
    if (target) {
      navigate(`/u/${encodeURIComponent(target)}`)
    }
  }, [navigate])

  const glassCard =
    "rounded-[24px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/90 dark:bg-[#17171a]/90 shadow-[0_25px_70px_-45px_rgba(15,23,42,0.65)]"
  const profileHeroCard =
    "relative overflow-hidden rounded-[32px] border border-stone-200 dark:border-[#3e3e42] bg-gradient-to-br from-emerald-100/60 via-white to-stone-100 dark:from-[#252526] dark:via-[#1e1e1e] dark:to-[#171717] shadow-[0_35px_60px_-15px_rgba(16,185,129,0.35)]"

  return (
    <div className="max-w-5xl mx-auto mt-8 px-4 md:px-0 pb-16 space-y-6">
      {user?.id && (
        <div ref={searchContainerRef} className="relative mb-6">
          <label
            htmlFor="profile-user-search"
            className="block text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400"
          >
            {t('profile.searchUsers.label')}
          </label>
            <div className="mt-2">
              <SearchInput
                id="profile-user-search"
                value={searchTerm}
                autoComplete="off"
                loading={searchLoading}
                onChange={(event) => {
                  const { value } = event.target
                  setSearchTerm(value)
                  if (!searchOpen) setSearchOpen(true)
                }}
                onFocus={() => setSearchOpen(true)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && searchResults.length > 0) {
                    event.preventDefault()
                    handleSelectSuggestion(searchResults[0])
                  }
                }}
                placeholder={t('profile.searchUsers.placeholder')}
                className="rounded-2xl"
              />
            </div>
            {searchOpen && !needsMoreInput && (
              <div className="absolute z-40 mt-2 w-full overflow-hidden rounded-2xl border border-stone-300 bg-white shadow-xl dark:border-[#3e3e42] dark:bg-[#252526]">
                {searchError && (
                  <div className="px-3 py-2 text-xs text-red-600">
                    {searchError}
                  </div>
                )}
                {!searchError && searchResults.length === 0 && !searchLoading && (
                  <div className="px-3 py-4 text-sm text-stone-500 dark:text-stone-400">
                    {t('profile.searchUsers.noResults')}
                  </div>
                )}
                  {!searchError && searchResults.length > 0 && (
                    <ul className="max-h-64 overflow-auto py-1">
                      {searchResults.map((suggestion) => {
                        const secondaryText = suggestion.isBanned
                          ? t('profile.searchUsers.bannedHint')
                          : !suggestion.canView && !suggestion.isSelf
                            ? t('profile.searchUsers.privateHint')
                            : suggestion.country || ''
                        return (
                          <li key={suggestion.id}>
                            <button
                              type="button"
                              onMouseDown={(event) => {
                                event.preventDefault()
                                handleSelectSuggestion(suggestion)
                              }}
                              className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-stone-50 focus:bg-stone-50 dark:hover:bg-[#2d2d30] dark:focus:bg-[#2d2d30]"
                            >
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-100 dark:bg-[#2d2d30]">
                                <UserIcon className="h-5 w-5 text-stone-500 dark:text-stone-300" aria-hidden />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 text-sm font-medium text-stone-900 dark:text-stone-100">
                                  <span className="truncate">
                                    {suggestion.displayName || suggestion.username || t('profile.member')}
                                  </span>
                                  {suggestion.isFriend && !suggestion.isSelf && (
                                    <span
                                      className="inline-flex items-center text-emerald-600 dark:text-emerald-400"
                                      title={t('profile.friends')}
                                      aria-label={t('profile.friends')}
                                    >
                                      <UserCheck className="h-4 w-4" aria-hidden />
                                    </span>
                                  )}
                                  {!suggestion.isFriend && !suggestion.isSelf && suggestion.isBanned && (
                                    <span
                                      className="inline-flex items-center text-red-500 dark:text-red-400"
                                      title={t('profile.searchUsers.bannedTooltip')}
                                      aria-label={t('profile.searchUsers.bannedTooltip')}
                                    >
                                      <Ban className="h-4 w-4" aria-hidden />
                                    </span>
                                  )}
                                  {!suggestion.isFriend && !suggestion.isSelf && suggestion.isPrivate && !suggestion.isBanned && (
                                    <span
                                      className="inline-flex items-center text-stone-400"
                                      title={t('profile.searchUsers.privateTooltip')}
                                      aria-label={t('profile.searchUsers.privateTooltip')}
                                    >
                                      <EyeOff className="h-4 w-4" aria-hidden />
                                    </span>
                                  )}
                                </div>
                                {secondaryText && (
                                  <div className="truncate text-xs text-stone-500 dark:text-stone-400">
                                    {secondaryText}
                                  </div>
                                )}
                              </div>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
              </div>
            )}
        </div>
      )}
      {loading && <ProfilePageSkeleton />}
      {error && !loading && (
        <div className={`${glassCard} p-8 text-center text-sm text-red-600`}>
          <p className="mb-2">{error}</p>
          <Button asChild variant="secondary" className="rounded-2xl">
            <Link to="/">{t("profile.backHome")}</Link>
          </Button>
        </div>
      )}
        {!loading && !error && pp && (
          <>
            <Card className={profileHeroCard}>
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute -top-6 -right-8 h-32 w-32 rounded-full bg-emerald-200/60 dark:bg-emerald-500/15 blur-3xl" />
                <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-emerald-100/60 dark:bg-emerald-500/10 blur-3xl" />
              </div>
              <CardContent className="relative z-10 p-6 md:p-8 space-y-4">
              {/* Profile header - stacks on mobile, row on tablet+ */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                {/* Avatar - centered on mobile */}
                <div className="h-16 w-16 shrink-0 rounded-2xl bg-stone-200 overflow-hidden flex items-center justify-center mx-auto sm:mx-0" aria-hidden>
                  <UserIcon
                    className="h-8 w-8 text-black"
                  />
                </div>
                {/* Profile info - takes remaining space */}
                <div className="flex-1 min-w-0 text-center sm:text-left">
                  <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
                    <div className="flex items-center gap-1 min-w-0 max-w-full">
                      <span 
                        className="text-xl sm:text-2xl font-semibold truncate max-w-[200px] sm:max-w-[300px]"
                        style={pp.accent_key ? { color: getAccentOption(pp.accent_key as AccentKey)?.hex } : undefined}
                      >
                        {pp.display_name || pp.username || t('profile.member')}
                      </span>
                      <ProfileNameBadges roles={pp.roles} isAdmin={pp.is_admin ?? false} size="md" />
                    </div>
                    {pp.is_banned && (
                      <div title={t('profile.bannedProfileViewedByAdmin')} className="flex items-center gap-1">
                        <Ban className="h-5 w-5 text-red-500 dark:text-red-400" />
                        <span className="text-xs font-medium text-red-500 dark:text-red-400">{t('profile.bannedBadge')}</span>
                      </div>
                    )}
                    {pp.isAdminViewingPrivateNonFriend && !pp.is_banned && (
                      <div title={t('profile.privateProfileViewedByAdmin')}>
                        <EyeOff className="h-5 w-5 text-stone-500 opacity-70" />
                      </div>
                    )}
                    {!pp.roles?.length && !pp.is_admin && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full border bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-600">{t('profile.member')}</span>
                    )}
                  </div>
                  {canViewProfile && (
                    <>
                      {/* Country + Job info line */}
                      <div className="text-sm opacity-70 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 justify-center sm:justify-start">
                        {pp.show_country !== false && pp.country ? (
                          <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{pp.country}</span>
                        ) : null}
                        {pp.job ? (
                          <span className="inline-flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" />{pp.job}</span>
                        ) : null}
                        {pp.experience_level ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                            <Leaf className="h-3 w-3" />
                            {t(`setup.experience.${pp.experience_level}`, { defaultValue: pp.experience_level })}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs opacity-70 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 justify-center sm:justify-start">
                        {pp.is_online ? (
                          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-500" />{t('profile.currentlyOnline')}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-stone-300" />{formatLastSeen(pp.last_seen_at)}</span>
                        )}
                        {pp.joined_at && (
                          <span>
                            • {t('profile.joined')} {new Date(pp.joined_at).toLocaleDateString(i18n.language)}
                          </span>
                        )}
                        {stats?.friendsCount != null && stats.friendsCount > 0 && (
                          <span>• {stats.friendsCount} {stats.friendsCount !== 1 ? t('profile.friends') : t('profile.friend')}</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
                {/* Action buttons - centered on mobile, right-aligned on tablet+ */}
                <div className="flex items-center justify-center sm:justify-end gap-2 shrink-0 w-full sm:w-auto" ref={anchorRef}>
                  {isOwner ? (
                    <>
                      <Button className="rounded-2xl self-start" variant="secondary" onClick={() => setMenuOpen((o) => !o)}>⋯</Button>
                      {menuOpen && menuPos && createPortal(
                        <div ref={menuRef} className="w-48 rounded-xl border border-stone-300 dark:border-[#3e3e42] bg-white dark:bg-[#252526] shadow z-[60] p-1" style={{ position: 'fixed', top: menuPos.top, right: menuPos.right }}>
                          <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-50 dark:hover:bg-[#2d2d30] text-black dark:text-white flex items-center gap-2" onMouseDown={(e) => { e.stopPropagation(); setMenuOpen(false); handleShare() }}>
                            <Share2 className="h-4 w-4" />
                            {shareStatus === 'copied' ? t('plantInfo.shareCopied', { defaultValue: 'Copied!' }) : t('common.share', { defaultValue: 'Share' })}
                          </button>
                          <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-50 dark:hover:bg-[#2d2d30] text-black dark:text-white flex items-center gap-2" onMouseDown={(e) => { e.stopPropagation(); setMenuOpen(false); setEditOpen(true) }}>{t('profile.edit')}</button>
                          <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-50 dark:hover:bg-[#2d2d30] text-black dark:text-white flex items-center gap-2" onMouseDown={async (e) => { e.stopPropagation(); setMenuOpen(false); await handleLogout() }}>{t('profile.logout')}</button>
                          <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-50 dark:hover:bg-[#2d2d30] text-red-600 dark:text-red-400 flex items-center gap-2" onMouseDown={async (e) => { e.stopPropagation(); setMenuOpen(false); await deleteAccount() }}>{t('profile.deleteAccount')}</button>
                        </div>,
                        document.body
                      )}
                    </>
                  ) : user?.id && !pp.disable_friend_requests ? (
                    <>
                      {friendStatus === 'none' && (
                        <Button 
                          className="rounded-2xl" 
                          variant="default" 
                          onClick={sendFriendRequest}
                          disabled={friendRequestLoading}
                        >
                          <UserPlus className="h-4 w-4 mr-2" /> {t('profile.friendRequest')}
                        </Button>
                      )}
                      {friendStatus === 'request_sent' && (
                        <Button className="rounded-2xl" variant="secondary" disabled>
                          {t('profile.requestSent')}
                        </Button>
                      )}
                      {friendStatus === 'request_received' && (
                        <Button 
                          className="rounded-2xl" 
                          variant="default" 
                          onClick={acceptFriendRequest}
                          disabled={friendRequestLoading}
                        >
                          <Check className="h-4 w-4 mr-2" /> {t('profile.acceptRequest')}
                        </Button>
                      )}
                      {friendStatus === 'friends' && (
                        <div className="flex flex-col items-center sm:items-end gap-1">
                          <Button className="rounded-2xl" variant="secondary" disabled>
                            {t('profile.friends')}
                          </Button>
                          {friendsSince && (
                            <div className="text-[10px] opacity-60">
                              {t('profile.since')} {new Date(friendsSince).toLocaleDateString(i18n.language)}
                            </div>
                          )}
                        </div>
                      )}
                      {/* 3-dots menu for report/block */}
                      <div ref={otherMenuAnchorRef}>
                        <Button 
                          className="rounded-2xl self-start" 
                          variant="ghost" 
                          size="icon"
                          onClick={() => setOtherMenuOpen((o) => !o)}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </div>
                      {otherMenuOpen && otherMenuPos && createPortal(
                        <div 
                          ref={otherMenuRef} 
                          className="w-48 rounded-xl border border-stone-300 dark:border-[#3e3e42] bg-white dark:bg-[#252526] shadow-lg z-[60] p-1" 
                          style={{ position: 'fixed', top: otherMenuPos.top, right: otherMenuPos.right }}
                        >
                          {/* Share button */}
                          <button 
                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-50 dark:hover:bg-[#2d2d30] text-black dark:text-white flex items-center gap-2" 
                            onMouseDown={(e) => { 
                              e.stopPropagation(); 
                              setOtherMenuOpen(false); 
                              handleShare();
                            }}
                          >
                            <Share2 className="h-4 w-4" />
                            {shareStatus === 'copied' ? t('plantInfo.shareCopied', { defaultValue: 'Copied!' }) : t('common.share', { defaultValue: 'Share' })}
                          </button>
                          {/* Message button - only for friends */}
                          {friendStatus === 'friends' && (
                            <button 
                              className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-50 dark:hover:bg-[#2d2d30] text-black dark:text-white flex items-center gap-2" 
                              onMouseDown={async (e) => { 
                                e.stopPropagation(); 
                                setOtherMenuOpen(false); 
                                await handleStartConversation();
                              }}
                              disabled={messageLoading}
                            >
                              <MessageCircle className="h-4 w-4" />
                              {t('profile.message', { defaultValue: 'Message' })}
                            </button>
                          )}
                          {isBlocked ? (
                            <button 
                              className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-50 dark:hover:bg-[#2d2d30] text-black dark:text-white flex items-center gap-2" 
                              onMouseDown={async (e) => { 
                                e.stopPropagation(); 
                                setOtherMenuOpen(false); 
                                await handleUnblock();
                              }}
                              disabled={blockLoading}
                            >
                              <Ban className="h-4 w-4" />
                              {t('moderation.block.unblock')}
                            </button>
                          ) : (
                            <button 
                              className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-50 dark:hover:bg-[#2d2d30] text-black dark:text-white flex items-center gap-2" 
                              onMouseDown={(e) => { 
                                e.stopPropagation(); 
                                setOtherMenuOpen(false); 
                                setBlockDialogOpen(true);
                              }}
                            >
                              <Ban className="h-4 w-4" />
                              {t('moderation.block.title')}
                            </button>
                          )}
                          <button 
                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-50 dark:hover:bg-[#2d2d30] text-red-600 dark:text-red-400 flex items-center gap-2" 
                            onMouseDown={(e) => { 
                              e.stopPropagation(); 
                              setOtherMenuOpen(false); 
                              setReportDialogOpen(true);
                            }}
                          >
                            <AlertTriangle className="h-4 w-4" />
                            {t('moderation.report.title')}
                          </button>
                        </div>,
                        document.body
                      )}
                    </>
                  ) : user?.id ? (
                    /* User is logged in but friend requests are disabled - still show 3-dots menu */
                    <>
                      <div ref={otherMenuAnchorRef}>
                        <Button 
                          className="rounded-2xl" 
                          variant="ghost" 
                          size="icon"
                          onClick={() => setOtherMenuOpen((o) => !o)}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </div>
                      {otherMenuOpen && otherMenuPos && createPortal(
                        <div 
                          ref={otherMenuRef} 
                          className="w-48 rounded-xl border border-stone-300 dark:border-[#3e3e42] bg-white dark:bg-[#252526] shadow-lg z-[60] p-1" 
                          style={{ position: 'fixed', top: otherMenuPos.top, right: otherMenuPos.right }}
                        >
                          {/* Share button */}
                          <button 
                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-50 dark:hover:bg-[#2d2d30] text-black dark:text-white flex items-center gap-2" 
                            onMouseDown={(e) => { 
                              e.stopPropagation(); 
                              setOtherMenuOpen(false); 
                              handleShare();
                            }}
                          >
                            <Share2 className="h-4 w-4" />
                            {shareStatus === 'copied' ? t('plantInfo.shareCopied', { defaultValue: 'Copied!' }) : t('common.share', { defaultValue: 'Share' })}
                          </button>
                          {/* Message button - only for friends */}
                          {friendStatus === 'friends' && (
                            <button 
                              className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-50 dark:hover:bg-[#2d2d30] text-black dark:text-white flex items-center gap-2" 
                              onMouseDown={async (e) => { 
                                e.stopPropagation(); 
                                setOtherMenuOpen(false); 
                                await handleStartConversation();
                              }}
                              disabled={messageLoading}
                            >
                              <MessageCircle className="h-4 w-4" />
                              {t('profile.message', { defaultValue: 'Message' })}
                            </button>
                          )}
                          {isBlocked ? (
                            <button 
                              className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-50 dark:hover:bg-[#2d2d30] text-black dark:text-white flex items-center gap-2" 
                              onMouseDown={async (e) => { 
                                e.stopPropagation(); 
                                setOtherMenuOpen(false); 
                                await handleUnblock();
                              }}
                              disabled={blockLoading}
                            >
                              <Ban className="h-4 w-4" />
                              {t('moderation.block.unblock')}
                            </button>
                          ) : (
                            <button 
                              className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-50 dark:hover:bg-[#2d2d30] text-black dark:text-white flex items-center gap-2" 
                              onMouseDown={(e) => { 
                                e.stopPropagation(); 
                                setOtherMenuOpen(false); 
                                setBlockDialogOpen(true);
                              }}
                            >
                              <Ban className="h-4 w-4" />
                              {t('moderation.block.title')}
                            </button>
                          )}
                          <button 
                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-50 dark:hover:bg-[#2d2d30] text-red-600 dark:text-red-400 flex items-center gap-2" 
                            onMouseDown={(e) => { 
                              e.stopPropagation(); 
                              setOtherMenuOpen(false); 
                              setReportDialogOpen(true);
                            }}
                          >
                            <AlertTriangle className="h-4 w-4" />
                            {t('moderation.report.title')}
                          </button>
                        </div>,
                        document.body
                      )}
                    </>
                  ) : (
                    /* Non-logged-in users - show share button only */
                    <>
                      <div ref={otherMenuAnchorRef}>
                        <Button 
                          className="rounded-2xl" 
                          variant="ghost" 
                          size="icon"
                          onClick={() => setOtherMenuOpen((o) => !o)}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </div>
                      {otherMenuOpen && otherMenuPos && createPortal(
                        <div 
                          ref={otherMenuRef} 
                          className="w-48 rounded-xl border border-stone-300 dark:border-[#3e3e42] bg-white dark:bg-[#252526] shadow-lg z-[60] p-1" 
                          style={{ position: 'fixed', top: otherMenuPos.top, right: otherMenuPos.right }}
                        >
                          <button 
                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-50 dark:hover:bg-[#2d2d30] text-black dark:text-white flex items-center gap-2" 
                            onMouseDown={(e) => { 
                              e.stopPropagation(); 
                              setOtherMenuOpen(false); 
                              handleShare();
                            }}
                          >
                            <Share2 className="h-4 w-4" />
                            {shareStatus === 'copied' ? t('plantInfo.shareCopied', { defaultValue: 'Copied!' }) : t('common.share', { defaultValue: 'Share' })}
                          </button>
                        </div>,
                        document.body
                      )}
                    </>
                  )}
                </div>
              </div>
              {canViewProfile && pp.bio && (
                <div className="text-sm opacity-90 text-center sm:text-left">{pp.bio}</div>
              )}
              {canViewProfile && pp.profile_link && (
                <div className="text-center sm:text-left">
                  <a
                    href={pp.profile_link.startsWith('http') ? pp.profile_link : `https://${pp.profile_link}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:underline transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {(() => {
                      try {
                        const url = new URL(pp.profile_link.startsWith('http') ? pp.profile_link : `https://${pp.profile_link}`)
                        return url.hostname.replace(/^www\./, '')
                      } catch {
                        return pp.profile_link
                      }
                    })()}
                  </a>
                </div>
              )}
              {!canViewProfile && !isOwner && pp.is_private && (
                <div className="mt-4 p-4 rounded-xl bg-stone-50 dark:bg-stone-900/50 border border-stone-200 dark:border-stone-700 flex items-start gap-3">
                  <Lock className="h-5 w-5 mt-0.5 text-stone-600 dark:text-stone-400 shrink-0" />
                  <div>
                    <div className="text-sm font-medium text-stone-900 dark:text-stone-100 mb-1">
                      {t('profile.privateProfile.title')}
                    </div>
                    <div className="text-xs opacity-70 text-stone-700 dark:text-stone-300">
                      {t('profile.privateProfile.description')}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
            </Card>

            {pp.is_banned && profile?.is_admin && (
              <div className="mt-4 p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 flex items-start gap-3">
                <Ban className="h-5 w-5 mt-0.5 text-red-600 dark:text-red-400 shrink-0" />
                <div>
                  <div className="text-sm font-medium text-red-900 dark:text-red-100 mb-1">
                    {t('profile.bannedProfile.title')}
                  </div>
                  <div className="text-xs opacity-70 text-red-700 dark:text-red-300">
                    {t('profile.bannedProfile.description')}
                  </div>
                </div>
              </div>
            )}

            {canViewProfile && (
              <>
                <div className="mt-4">
                  <Card className={glassCard}>
                    <CardContent className="p-6 md:p-8 space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-lg font-semibold">{t("profile.highlights")}</div>
                        {/* Bug Catcher Badge - simple inline display */}
                        {pp.roles && hasBugCatcherRole(pp.roles) && stats?.bugPoints !== undefined && (stats.bugPoints > 0 || (stats.bugCatcherRank && stats.bugCatcherRank <= 10)) && (
                          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-100 dark:bg-stone-800 text-sm">
                            <Bug className="h-4 w-4 text-orange-500" />
                            <span className="font-medium tabular-nums">{stats.bugPoints} pts</span>
                            {stats.bugCatcherRank && stats.bugCatcherRank > 0 && (
                              <>
                                <span className="text-stone-400">•</span>
                                <span className="text-stone-600 dark:text-stone-400">#{stats.bugCatcherRank}</span>
                              </>
                            )}
                            {stats.bugCatcherRank && stats.bugCatcherRank <= 10 && (
                              <Medal className="h-3.5 w-3.5 text-amber-500" />
                            )}
                          </div>
                        )}
                      </div>
                    <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-0">
                      {/* Task completion grid - left side */}
                      <div className="flex-1 flex justify-center items-center py-2">
                        <div className="grid grid-rows-4 grid-flow-col auto-cols-max gap-1.5 sm:gap-2">
                          {daysFlat.map((item: { date: string; value: number; success: boolean }, idx: number) => (
                            <div
                              key={idx}
                              tabIndex={0}
                              className={`h-7 w-7 sm:h-10 sm:w-10 rounded-[4px] ${colorFor(item)}`}
                              onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => showTooltip(e.currentTarget as HTMLDivElement, item)}
                              onMouseLeave={hideTooltip}
                              onFocus={(e: React.FocusEvent<HTMLDivElement>) => showTooltip(e.currentTarget as HTMLDivElement, item)}
                              onBlur={hideTooltip}
                              aria-label={`${new Date(item.date).toLocaleDateString(i18n.language)}: ${item.value} ${t('profile.tasks')}${item.success ? `, ${t('profile.completedDay')}` : ''}`}
                            />
                          ))}
                        </div>
                      </div>
                      
                      {/* Horizontal divider on mobile, vertical on desktop */}
                      <div className="w-full h-px md:hidden bg-stone-200 dark:bg-[#3e3e42]" />
                      <div className="hidden md:block w-px h-full min-h-[200px] bg-stone-300 dark:bg-[#3e3e42] mx-4" />
                      
                      {/* Highlight cards - right side, 2x2 grid */}
                      <div className="flex-1 flex justify-center items-center py-2">
                        <div className="grid grid-cols-2 gap-2 sm:gap-3">
                          <div className="rounded-xl border border-stone-200 dark:border-[#3e3e42] p-3 sm:p-4 text-center min-w-[100px] sm:min-w-[120px]">
                            <div className="flex items-center justify-center gap-1 sm:gap-1.5 mb-1.5 sm:mb-2">
                              <Sprout className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
                              <div className="text-[10px] sm:text-xs opacity-60">{t('profile.plantsOwned')}</div>
                            </div>
                            <div className="text-lg sm:text-xl font-semibold tabular-nums">{stats?.plantsTotal ?? '—'}</div>
                          </div>
                          <div className="rounded-xl border border-stone-200 dark:border-[#3e3e42] p-3 sm:p-4 text-center min-w-[100px] sm:min-w-[120px]">
                            <div className="flex items-center justify-center gap-1 sm:gap-1.5 mb-1.5 sm:mb-2">
                              <Home className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                              <div className="text-[10px] sm:text-xs opacity-60">{t('profile.gardens')}</div>
                            </div>
                            <div className="text-lg sm:text-xl font-semibold tabular-nums">{stats?.gardensCount ?? '—'}</div>
                          </div>
                          <div className="rounded-xl border border-stone-200 dark:border-[#3e3e42] p-3 sm:p-4 text-center min-w-[100px] sm:min-w-[120px]">
                            <div className="flex items-center justify-center gap-1 sm:gap-1.5 mb-1.5 sm:mb-2">
                              <Flame className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />
                              <div className="text-[10px] sm:text-xs opacity-60">{t('profile.currentStreak')}</div>
                            </div>
                            <div className="text-lg sm:text-xl font-semibold tabular-nums">{stats?.currentStreak ?? '—'}</div>
                          </div>
                          <div className="rounded-xl border border-stone-200 dark:border-[#3e3e42] p-3 sm:p-4 text-center min-w-[100px] sm:min-w-[120px]">
                            <div className="flex items-center justify-center gap-1 sm:gap-1.5 mb-1.5 sm:mb-2">
                              <Trophy className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500" />
                              <div className="text-[10px] sm:text-xs opacity-60">{t('profile.longestStreak')}</div>
                            </div>
                            <div className="text-lg sm:text-xl font-semibold tabular-nums">{stats?.bestStreak ?? '—'}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                {tooltip && createPortal(
                  <div
                    className="fixed z-[70] pointer-events-none"
                    style={{ top: tooltip.top, left: tooltip.left, transform: 'translate(-50%, -100%)' }}
                  >
                    <div className="rounded-xl border border-stone-300 dark:border-[#3e3e42] bg-white dark:bg-[#252526] shadow px-3 py-2">
                      <div className="text-xs font-medium">{new Date(tooltip.date).toLocaleDateString(i18n.language)}</div>
                      <div className="text-[11px] opacity-70">{tooltip.value} {t('profile.tasks')}{tooltip.success ? ` • ${t('profile.completedDay')}` : ''}</div>
                    </div>
                  </div>,
                  document.body
                )}
              </CardContent>
            </Card>
          </div>
          
          <PublicGardensSection userId={pp.id} isOwner={isOwner} />
          
          <BookmarksSection userId={pp.id} isOwner={isOwner} isFriend={friendStatus === 'friends'} userIsPrivate={pp.is_private || false} />
            </>
          )}



          {isOwner && (
            <EditProfileDialog
              open={editOpen}
              onOpenChange={setEditOpen}
              initial={{
                display_name: (pp.display_name || ''),
                city: (pp.city || ''),
                country: (pp.country || ''),
                bio: (pp.bio || ''),
                job: (pp.job || ''),
                profile_link: (pp.profile_link || ''),
                show_country: pp.show_country !== false,
                accent_key: (pp.accent_key as AccentKey) || null,
              }}
              submitting={editSubmitting}
              error={editError}
              onSubmit={async (vals: EditProfileValues) => {
                if (!user?.id) return
                setEditError(null)
                setEditSubmitting(true)
                try {
                  // Validate display name (username)
                  const validationResult = validateUsername(vals.display_name || '')
                  if (!validationResult.valid) {
                    setEditError(validationResult.error || t('profile.editProfile.invalidDisplayName'))
                    return
                  }
                  // original = user's chosen casing (for storage); normalized = lowercase (for uniqueness check)
                  const originalDn = validationResult.original!
                  const normalizedDn = validationResult.normalized!
                  
                  // Check display name uniqueness (case-insensitive, using normalized lowercase)
                  const nameCheck = await supabase
                    .from('profiles')
                    .select('id')
                    .ilike('display_name', normalizedDn)
                    .neq('id', user.id)
                    .maybeSingle()
                  if (nameCheck.data?.id) { setEditError(t('profile.editProfile.displayNameTaken')); return }

                  const updates: Record<string, any> = {
                    id: user.id,
                    display_name: originalDn,
                    city: vals.city || null,
                    country: vals.country || null,
                    bio: vals.bio || null,
                    job: vals.job || null,
                    profile_link: vals.profile_link || null,
                    show_country: vals.show_country,
                  }

                  const { error: uerr } = await supabase.from('profiles').upsert(updates, { onConflict: 'id' })
                  if (uerr) { setEditError(uerr.message); return }

                  // Apply accent if chosen
                  if (vals.accent_key) {
                    applyAccentByKey(vals.accent_key)
                    saveAccentKey(vals.accent_key)
                    // Persist accent key in DB as well
                    await supabase.from('profiles').update({ accent_key: vals.accent_key }).eq('id', user.id)
                  }

                  // Refresh UI
                  await refreshProfile().catch(() => {})
                  setEditOpen(false)
                  // Reload public profile data by navigating to new slug if changed
                  if (originalDn && originalDn !== displayParam) {
                    navigate(`/u/${encodeURIComponent(originalDn)}`, { replace: true })
                  } else {
                    // Re-run effect by toggling param changes via navigation no-op
                    navigate(0)
                  }
                } finally {
                  setEditSubmitting(false)
                }
              }}
            />
          )}
          
          {/* Report User Dialog */}
          {pp && !isOwner && (
            <ReportUserDialog
              open={reportDialogOpen}
              onOpenChange={setReportDialogOpen}
              userId={pp.id}
              displayName={pp.display_name}
            />
          )}
          
          {/* Block User Dialog */}
          {pp && !isOwner && (
            <BlockUserDialog
              open={blockDialogOpen}
              onOpenChange={setBlockDialogOpen}
              userId={pp.id}
              displayName={pp.display_name}
              onBlocked={() => setIsBlocked(true)}
            />
          )}
        </>
      )}
    </div>
  )
}
