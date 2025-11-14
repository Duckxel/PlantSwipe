import React from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createPortal } from "react-dom"
import { supabase } from "@/lib/supabaseClient"
import { useAuth } from "@/context/AuthContext"
import { EditProfileDialog, type EditProfileValues } from "@/components/profile/EditProfileDialog"
import { applyAccentByKey, saveAccentKey } from "@/lib/accent"
import { MapPin, User as UserIcon, UserPlus, Check, Lock, EyeOff, Flame, Sprout, Home, Trophy, Search as SearchIcon, Loader2, UserCheck } from "lucide-react"
import { useTranslation } from "react-i18next"
import i18n from "@/lib/i18n"
import { ProfilePageSkeleton } from "@/components/garden/GardenSkeletons"

type PublicProfile = {
  id: string
  username: string | null
  display_name: string | null
  country: string | null
  bio: string | null
  avatar_url: string | null
  is_admin?: boolean | null
  joined_at?: string | null
  last_seen_at?: string | null
  is_online?: boolean | null
  accent_key?: string | null
  is_private?: boolean | null
  disable_friend_requests?: boolean | null
  isAdminViewingPrivateNonFriend?: boolean | null
}

type PublicStats = {
  plantsTotal: number
  gardensCount: number
  currentStreak: number
  bestStreak: number
  friendsCount?: number
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
}

export default function PublicProfilePage() {
  const params = useParams()
  const navigate = useNavigate()
  const { user, profile, refreshProfile, signOut, deleteAccount } = useAuth()
  const { t } = useTranslation('common')
  const displayParam = String(params.username || '')

  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [pp, setPp] = React.useState<PublicProfile | null>(null)
  const [stats, setStats] = React.useState<PublicStats | null>(null)
  const [monthDays, setMonthDays] = React.useState<DayAgg[]>([])
  const [privateInfo, setPrivateInfo] = React.useState<{ id: string; email: string | null } | null>(null)
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
            .select('id, display_name, country, bio, avatar_url, is_admin, accent_key, is_private, disable_friend_requests')
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
        const profileIsPrivate = Boolean(row.is_private || false)
        const isOwnerViewing = user?.id === userId
        const viewerIsAdmin = Boolean(profile?.is_admin || false)
        
        // Check if viewer can see this profile
        let viewerCanSee = true
        let isAdminViewingPrivateNonFriend = false
        if (profileIsPrivate && !isOwnerViewing && !viewerIsAdmin) {
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
        } else if (profileIsPrivate && !isOwnerViewing && viewerIsAdmin) {
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
          country: row.country || null,
          bio: row.bio || null,
          avatar_url: row.avatar_url || null,
          is_admin: Boolean(row.is_admin || false),
          joined_at: row.joined_at ? String(row.joined_at) : null,
          last_seen_at: row.last_seen_at ? String(row.last_seen_at) : null,
          is_online: Boolean(row.is_online || false),
          accent_key: row.accent_key || null,
          is_private: profileIsPrivate,
          disable_friend_requests: Boolean(row.disable_friend_requests || false),
          isAdminViewingPrivateNonFriend: isAdminViewingPrivateNonFriend,
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

  const isOwner = user?.id && pp?.id && user.id === pp.id

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

  // Load private info for owners
  React.useEffect(() => {
    let cancelled = false
    const loadPrivate = async () => {
      try {
        if (!isOwner || !user?.id) { setPrivateInfo(null); return }
        const { data, error } = await supabase.rpc('get_user_private_info', { _user_id: user.id })
        if (!error) {
          const row = Array.isArray(data) ? data[0] : data
          if (!cancelled) setPrivateInfo(row ? { id: String(row.id), email: row.email || null } : null)
        }
      } catch {}
    }
    loadPrivate()
    return () => { cancelled = true }
  }, [isOwner, user?.id])

  const [menuOpen, setMenuOpen] = React.useState(false)
  const anchorRef = React.useRef<HTMLDivElement | null>(null)
  const menuRef = React.useRef<HTMLDivElement | null>(null)
  const [menuPos, setMenuPos] = React.useState<{ top: number; right: number } | null>(null)

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
      // Check if there's an existing request (including rejected/accepted ones)
      const { data: existingRequest } = await supabase
        .from('friend_requests')
        .select('id, status')
        .eq('requester_id', user.id)
        .eq('recipient_id', pp.id)
        .maybeSingle()
      
      if (existingRequest) {
        if (existingRequest.status === 'pending') {
          setFriendStatus('request_sent')
          setFriendRequestId(existingRequest.id)
          setFriendRequestLoading(false)
          return
        }
        // If rejected or accepted, update it to pending (allows resending after removal/rejection)
        if (existingRequest.status === 'rejected' || existingRequest.status === 'accepted') {
          const { data, error: err } = await supabase
            .from('friend_requests')
            .update({ status: 'pending' })
            .eq('id', existingRequest.id)
            .select('id')
            .single()
          
          if (err) throw err
          setFriendStatus('request_sent')
          setFriendRequestId(data.id)
          setFriendRequestLoading(false)
          return
        }
      }
      
      // No existing request, create a new one
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
    } catch (e: any) {
      setEditError(e?.message || t('profile.editProfile.failedToSendFriendRequest'))
    } finally {
      setFriendRequestLoading(false)
    }
  }, [user?.id, pp?.id, isOwner])

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

  return (
    <div className="max-w-5xl mx-auto mt-8 px-4 md:px-0">
      {user?.id && (
        <div ref={searchContainerRef} className="relative mb-6">
          <label
            htmlFor="profile-user-search"
            className="block text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400"
          >
            {t('profile.searchUsers.label')}
          </label>
            <div className="relative mt-2">
              <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" aria-hidden />
              <Input
                id="profile-user-search"
                value={searchTerm}
                autoComplete="off"
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
                className="pl-12 pr-10 rounded-2xl"
              />
              {searchLoading && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-stone-400" aria-hidden />
              )}
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
                        const secondaryText = !suggestion.canView && !suggestion.isSelf
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
                                  {!suggestion.isFriend && !suggestion.isSelf && suggestion.isPrivate && (
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
        <div className="p-8 text-center">
          <div className="text-sm text-red-600 mb-2">{error}</div>
          <Button asChild variant="secondary"><Link to="/">{t('profile.backHome')}</Link></Button>
        </div>
      )}
      {!loading && !error && pp && (
        <>
          <Card className="rounded-3xl">
            <CardContent className="p-6 md:p-8 space-y-4">
              <div className="flex items-start gap-4">
                <div className="h-16 w-16 rounded-2xl bg-stone-200 overflow-hidden flex items-center justify-center" aria-hidden>
                  <UserIcon
                    className="h-8 w-8 text-black"
                  />
                </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-2xl font-semibold truncate">{pp.display_name || pp.username || t('profile.member')}</div>
                        {pp.isAdminViewingPrivateNonFriend && (
                          <div title={t('profile.privateProfileViewedByAdmin')}>
                            <EyeOff className="h-5 w-5 text-stone-500 opacity-70" />
                          </div>
                        )}
                        <span className={`text-[11px] px-2 py-0.5 rounded-full border ${pp.is_admin ? 'bg-emerald-200 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100 border-emerald-300 dark:border-emerald-700' : 'bg-stone-50 text-stone-700 border-stone-200'}`}>{pp.is_admin ? t('profile.admin') : t('profile.member')}</span>
                      </div>
                  {canViewProfile && (
                    <>
                      <div className="text-sm opacity-70 mt-1 flex items-center gap-1">{pp.country ? (<><MapPin className="h-4 w-4" />{pp.country}</>) : ''}</div>
                      <div className="text-xs opacity-70 mt-1 flex items-center gap-2">
                        {pp.is_online ? (
                          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-500" />{t('profile.currentlyOnline')}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-stone-300" />{formatLastSeen(pp.last_seen_at)}</span>
                        )}
                        {pp.joined_at && (
                          <span>
                            • {t('profile.joined')} {new Date(pp.joined_at).toLocaleDateString(i18n.language)}
                            {stats?.friendsCount != null && stats.friendsCount > 0 && (
                              <span className="ml-2">• {stats.friendsCount} {stats.friendsCount !== 1 ? t('profile.friends') : t('profile.friend')}</span>
                            )}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
                <div className="ml-auto flex items-center gap-2" ref={anchorRef}>
                  {isOwner ? (
                    <>
                      <Button className="rounded-2xl" variant="secondary" onClick={() => setMenuOpen((o) => !o)}>⋯</Button>
                      {menuOpen && menuPos && createPortal(
                        <div ref={menuRef} className="w-40 rounded-xl border border-stone-300 dark:border-[#3e3e42] bg-white dark:bg-[#252526] shadow z-[60] p-1" style={{ position: 'fixed', top: menuPos.top, right: menuPos.right }}>
                          <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-50 dark:hover:bg-[#2d2d30] text-black dark:text-white" onMouseDown={(e) => { e.stopPropagation(); setMenuOpen(false); setEditOpen(true) }}>{t('profile.edit')}</button>
                          <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-50 dark:hover:bg-[#2d2d30] text-black dark:text-white" onMouseDown={async (e) => { e.stopPropagation(); setMenuOpen(false); await signOut(); navigate('/') }}>{t('profile.logout')}</button>
                          <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-50 dark:hover:bg-[#2d2d30] text-red-600 dark:text-red-400" onMouseDown={async (e) => { e.stopPropagation(); setMenuOpen(false); await deleteAccount() }}>{t('profile.deleteAccount')}</button>
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
                        <div className="flex flex-col items-end gap-1">
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
                    </>
                  ) : null}
                </div>
              </div>
              {canViewProfile && pp.bio && (
                <div className="text-sm opacity-90">{pp.bio}</div>
              )}
              {!canViewProfile && !isOwner && pp.is_private && (
                <div className="mt-4 p-4 rounded-xl bg-stone-50 border border-stone-200 flex items-start gap-3">
                  <Lock className="h-5 w-5 mt-0.5 text-stone-600 shrink-0" />
                  <div>
                    <div className="text-sm font-medium text-stone-900 mb-1">
                      {t('profile.privateProfile.title')}
                    </div>
                    <div className="text-xs opacity-70 text-stone-700">
                      {t('profile.privateProfile.description')}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {canViewProfile && (
            <>
              <div className="mt-4">
                <Card className="rounded-3xl">
                  <CardContent className="p-6 md:p-8 space-y-4">
                    <div className="text-lg font-semibold">{t('profile.highlights')}</div>
                    <div className="flex flex-col md:flex-row items-center justify-center gap-0">
                      {/* Task completion grid - left side */}
                      <div className="flex-1 flex justify-center items-center">
                        <div className="grid grid-rows-4 grid-flow-col auto-cols-max gap-1.5 sm:gap-2">
                          {daysFlat.map((item: { date: string; value: number; success: boolean }, idx: number) => (
                            <div
                              key={idx}
                              tabIndex={0}
                              className={`h-8 w-8 sm:h-10 sm:w-10 rounded-[4px] ${colorFor(item)}`}
                              onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => showTooltip(e.currentTarget as HTMLDivElement, item)}
                              onMouseLeave={hideTooltip}
                              onFocus={(e: React.FocusEvent<HTMLDivElement>) => showTooltip(e.currentTarget as HTMLDivElement, item)}
                              onBlur={hideTooltip}
                              aria-label={`${new Date(item.date).toLocaleDateString(i18n.language)}: ${item.value} ${t('profile.tasks')}${item.success ? `, ${t('profile.completedDay')}` : ''}`}
                            />
                          ))}
                        </div>
                      </div>
                      
                      {/* Thin divider line */}
                      <div className="hidden md:block w-px h-full min-h-[200px] bg-stone-300 dark:bg-[#3e3e42] mx-2" />
                      
                      {/* Highlight cards - right side, 2x2 grid */}
                      <div className="flex-1 flex justify-center items-center">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-xl border p-4 text-center min-w-[120px]">
                            <div className="flex items-center justify-center gap-1.5 mb-2">
                              <Sprout className="h-5 w-5 text-emerald-600" />
                              <div className="text-xs opacity-60">{t('profile.plantsOwned')}</div>
                            </div>
                            <div className="text-xl font-semibold tabular-nums">{stats?.plantsTotal ?? '—'}</div>
                          </div>
                          <div className="rounded-xl border p-4 text-center min-w-[120px]">
                            <div className="flex items-center justify-center gap-1.5 mb-2">
                              <Home className="h-5 w-5 text-blue-600" />
                              <div className="text-xs opacity-60">{t('profile.gardens')}</div>
                            </div>
                            <div className="text-xl font-semibold tabular-nums">{stats?.gardensCount ?? '—'}</div>
                          </div>
                          <div className="rounded-xl border p-4 text-center min-w-[120px]">
                            <div className="flex items-center justify-center gap-1.5 mb-2">
                              <Flame className="h-5 w-5 text-orange-500" />
                              <div className="text-xs opacity-60">{t('profile.currentStreak')}</div>
                            </div>
                            <div className="text-xl font-semibold tabular-nums">{stats?.currentStreak ?? '—'}</div>
                          </div>
                          <div className="rounded-xl border p-4 text-center min-w-[120px]">
                            <div className="flex items-center justify-center gap-1.5 mb-2">
                              <Trophy className="h-5 w-5 text-amber-500" />
                              <div className="text-xs opacity-60">{t('profile.longestStreak')}</div>
                            </div>
                            <div className="text-xl font-semibold tabular-nums">{stats?.bestStreak ?? '—'}</div>
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
            </>
          )}

          {isOwner && privateInfo && (
            <div className="mt-4">
              <Card className="rounded-3xl">
                <CardContent className="p-6 md:p-8 space-y-2">
                  <div className="text-lg font-semibold">{t('profile.privateInfo.title')}</div>
                  <div className="text-sm opacity-60">{t('profile.privateInfo.description')}</div>
                  <div className="grid sm:grid-cols-2 gap-3 mt-2">
                    <div className="rounded-xl border p-3">
                      <div className="text-[11px] opacity-60">{t('profile.privateInfo.userId')}</div>
                      <div className="text-xs break-all">{privateInfo.id || '-'}</div>
                    </div>
                    <div className="rounded-xl border p-3">
                      <div className="text-[11px] opacity-60">{t('profile.privateInfo.email')}</div>
                      <div className="text-sm">{privateInfo.email || (user as any)?.email || '-'}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}


          {isOwner && (
            <EditProfileDialog
              open={editOpen}
              onOpenChange={setEditOpen}
              initial={{
                display_name: (pp.display_name || ''),
                country: (pp.country || ''),
                bio: (pp.bio || ''),
                timezone: (profile?.timezone || ''),
                experience_years: (profile?.experience_years != null ? String(profile.experience_years) : ''),
                accent_key: null,
              }}
              submitting={editSubmitting}
              error={editError}
              onSubmit={async (vals: EditProfileValues) => {
                if (!user?.id) return
                setEditError(null)
                setEditSubmitting(true)
                try {
                  // Ensure display name unique and valid
                  const dn = (vals.display_name || '').trim()
                  if (dn.length === 0) { setEditError(t('profile.editProfile.displayNameRequired')); return }
                  const nameCheck = await supabase
                    .from('profiles')
                    .select('id')
                    .ilike('display_name', dn)
                    .neq('id', user.id)
                    .maybeSingle()
                  if (nameCheck.data?.id) { setEditError(t('profile.editProfile.displayNameTaken')); return }

                  const updates: Record<string, any> = {
                    id: user.id,
                    display_name: dn,
                    country: vals.country || null,
                    bio: vals.bio || null,
                    timezone: vals.timezone || null,
                    experience_years: vals.experience_years ? Number(vals.experience_years) : null,
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
                  if (dn && dn !== displayParam) {
                    navigate(`/u/${encodeURIComponent(dn)}`, { replace: true })
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
        </>
      )}
    </div>
  )
}

