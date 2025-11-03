import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/context/AuthContext"
import { supabase } from "@/lib/supabaseClient"
import { useNavigate } from "react-router-dom"

type FunStats = {
  loading: boolean
  createdAt: string | null
  daysHere: number | null
  plantsTotal: number | null
  favorites: number | null
  gardensCount: number | null
  currentStreak: number | null
  bestStreak: number | null
  friendsCount: number | null
}

export const ProfilePage: React.FC = () => {
  const { user, profile, refreshProfile, signOut, deleteAccount } = useAuth()
  const navigate = useNavigate()
  const [displayName, setDisplayName] = React.useState(profile?.display_name || "")
  const [country, setCountry] = React.useState<string>(profile?.country || "")
  const [bio, setBio] = React.useState<string>(profile?.bio || "")
  const [timezone, setTimezone] = React.useState<string>(profile?.timezone || "")
  const [experienceYears, setExperienceYears] = React.useState<string>(profile?.experience_years != null ? String(profile.experience_years) : "")
  const [privateInfo, setPrivateInfo] = React.useState<{ id: string; email: string | null } | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [ok, setOk] = React.useState<string | null>(null)
  const [funStats, setFunStats] = React.useState<FunStats>({
    loading: true,
    createdAt: null,
    daysHere: null,
    plantsTotal: null,
    favorites: null,
    gardensCount: null,
    currentStreak: null,
    bestStreak: null,
    friendsCount: null,
  })

  React.useEffect(() => {
    setDisplayName(profile?.display_name || "")
    setCountry(profile?.country || "")
    setBio(profile?.bio || "")
    setTimezone(profile?.timezone || "")
    setExperienceYears(profile?.experience_years != null ? String(profile.experience_years) : "")
  }, [profile?.display_name])

  // Public path via display name (slug-insensitive)
  const publicPath = (displayName || '').trim() ? `/u/${encodeURIComponent(displayName)}` : null

  const save = async () => {
    setError(null)
    setOk(null)
    if (!user?.id) return
    setSaving(true)
    try {
      // Ensure unique display name (case-insensitive), excluding current user
      const check = await supabase
        .from('profiles')
        .select('id')
        .ilike('display_name', displayName)
        .neq('id', user.id)
        .maybeSingle()
      if (check.data?.id) {
        setError('Display name already taken')
        return
      }
      // Display name uniqueness (case-insensitive), excluding current user
      if ((displayName || '').trim().length === 0) { setError('Display name required'); return }
      const dn = (displayName || '').trim()
      const nameCheck = await supabase
        .from('profiles')
        .select('id')
        .ilike('display_name', dn)
        .neq('id', user.id)
        .maybeSingle()
      if (nameCheck.data?.id) { setError('Display name already taken'); return }
      const { error: uerr } = await supabase
        .from('profiles')
        .upsert({ id: user.id, display_name: dn, country: (country || null), bio: (bio || null), timezone: (timezone || null), experience_years: (experienceYears ? Number(experienceYears) : null) }, { onConflict: 'id' })
      if (uerr) {
        setError(uerr.message)
        return
      }
      await refreshProfile()
      setOk('Profile saved')
    } finally {
      setSaving(false)
    }
  }

  React.useEffect(() => {
    let cancelled = false
    const loadPrivate = async () => {
      try {
        if (!user?.id) { setPrivateInfo(null); return }
        const { data, error } = await supabase.rpc('get_user_private_info', { _user_id: user.id })
        if (!error) {
          const row = Array.isArray(data) ? data[0] : data
          if (!cancelled) setPrivateInfo(row ? { id: String(row.id), email: row.email || null } : null)
        }
      } catch {}
    }
    loadPrivate()
    return () => { cancelled = true }
  }, [user?.id])

  React.useEffect(() => {
    let cancelled = false
    const load = async () => {
      setFunStats((prev: FunStats) => ({ ...prev, loading: true }))
      try {
        const uid = user?.id || null
        const favorites = Array.isArray(profile?.liked_plant_ids) ? profile.liked_plant_ids.length : 0
        let createdAt: string | null = null
        let daysHere: number | null = null
        try {
          const u = (await supabase.auth.getUser()).data.user
          if (u?.created_at) {
            createdAt = String(u.created_at)
            const start = new Date(createdAt)
            const now = new Date()
            const diffDays = Math.max(0, Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
            daysHere = diffDays
          }
        } catch {}

        let plantsTotal = 0
        let gardensCount = 0
        let currentStreak = 0
        let bestStreak = 0

        if (uid) {
          const membersRes = await supabase
            .from('garden_members')
            .select('garden_id')
            .eq('user_id', uid)
          const gardenIds: string[] = Array.isArray(membersRes.data) ? membersRes.data.map((r: any) => String(r.garden_id)) : []
          gardensCount = gardenIds.length

          if (gardenIds.length > 0) {
            const plantsRes = await supabase
              .from('garden_plants')
              .select('id', { count: 'exact', head: true })
              .in('garden_id', gardenIds)
            if (!plantsRes.error) plantsTotal = plantsRes.count ?? 0

            const bestRes = await supabase
              .from('gardens')
              .select('streak')
              .in('id', gardenIds)
              .order('streak', { ascending: false, nullsFirst: true })
              .limit(1)
            if (!bestRes.error) {
              const s = Array.isArray(bestRes.data) && bestRes.data[0] ? Number((bestRes.data[0] as any).streak ?? 0) : 0
              bestStreak = Number.isFinite(s) ? s : 0
            }

            // Current streak across all gardens (AND) using RPC
            const today = new Date()
            const anchor = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
            anchor.setUTCDate(anchor.getUTCDate() - 1)
            const anchorIso = anchor.toISOString().slice(0,10)
            const { data: cur, error: cerr } = await supabase.rpc('compute_user_current_streak', { _user_id: uid, _anchor_day: anchorIso })
            if (!cerr && typeof cur === 'number') currentStreak = Number(cur)
          }
        }

        // Friend count
        let friendsCount = 0
        if (uid) {
          const { data: friendCount, error: ferr } = await supabase.rpc('get_friend_count', { _user_id: uid })
          if (!ferr && typeof friendCount === 'number') friendsCount = friendCount
        }

        if (!cancelled) {
          setFunStats({
            loading: false,
            createdAt,
            daysHere,
            plantsTotal,
            favorites,
            gardensCount,
            currentStreak,
            bestStreak,
            friendsCount,
          })
        }
      } catch {
        if (!cancelled) setFunStats((prev: FunStats) => ({ ...prev, loading: false }))
      }
    }
    load()
    return () => { cancelled = true }
  }, [user?.id, profile?.liked_plant_ids])

  // Realtime: apply live profile changes (display name, accent, etc.)
  React.useEffect(() => {
    if (!user?.id) return
    const channel = supabase.channel('rt-self-profile')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` }, () => {
        refreshProfile().catch(() => {})
      })
      .subscribe()
    return () => { try { supabase.removeChannel(channel) } catch {} }
  }, [user?.id, refreshProfile])

  return (
    <div className="max-w-3xl mx-auto mt-8 px-4 md:px-0">
      <Card className="rounded-3xl">
        <CardContent className="p-6 md:p-8 space-y-4">
          
          <div className="grid gap-2">
            <Label htmlFor="profile-email">Email</Label>
            <Input id="profile-email" name="email" value={(user as any)?.email || ''} disabled />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-display-name">Display name</Label>
            <div className="flex items-center gap-4">
              <Input id="profile-display-name" name="displayName" value={displayName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value)} />
              <div className="text-sm opacity-60 whitespace-nowrap">
                {funStats.loading ? '...' : `${funStats.friendsCount ?? 0} friend${(funStats.friendsCount ?? 0) !== 1 ? 's' : ''}`}
              </div>
            </div>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="profile-country">Country</Label>
            <Input id="profile-country" name="country" value={country || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCountry(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-timezone">Timezone</Label>
            <Input id="profile-timezone" name="timezone" value={timezone || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTimezone(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-exp">Years of experience with plants</Label>
            <Input id="profile-exp" name="experienceYears" type="number" inputMode="numeric" value={experienceYears} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExperienceYears(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-bio">Bio</Label>
            <Input id="profile-bio" name="bio" value={bio || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBio(e.target.value)} />
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          {ok && <div className="text-sm text-green-600">{ok}</div>}
          <div className="flex gap-2">
            <Button className="rounded-2xl" onClick={save} disabled={saving}>Save</Button>
            <Button className="rounded-2xl" variant="secondary" onClick={signOut}>Logout</Button>
            <Button className="rounded-2xl" variant="destructive" onClick={async () => { await deleteAccount() }}>Delete account</Button>
            {publicPath && (
              <Button className="rounded-2xl" variant="secondary" onClick={() => navigate(publicPath!)}>View public</Button>
            )}
          </div>
        </CardContent>
      </Card>
      <div className="mt-4">
        <Card className="rounded-3xl">
          <CardContent className="p-6 md:p-8 space-y-2">
            <div className="text-lg font-semibold">Private Info</div>
            <div className="text-sm opacity-60">Only visible to you (and admins)</div>
            <div className="grid sm:grid-cols-2 gap-3 mt-2">
              <div className="rounded-xl border p-3">
                <div className="text-[11px] opacity-60">User ID</div>
                <div className="text-xs break-all">{privateInfo?.id || '?'}</div>
              </div>
              <div className="rounded-xl border p-3">
                <div className="text-[11px] opacity-60">Email</div>
                <div className="text-sm">{privateInfo?.email || (user as any)?.email || '?'}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="mt-4">
        <Card className="rounded-3xl">
          <CardContent className="p-6 md:p-8 space-y-4">
            <div className="text-lg font-semibold">Your Fun Stats</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div className="rounded-xl border p-3 text-center">
                <div className="text-[11px] opacity-60">Member since</div>
                <div className="text-base font-semibold">
                  {funStats.loading ? '?' : (funStats.createdAt ? new Date(funStats.createdAt).toLocaleDateString() : '?')}
                </div>
              </div>
              <div className="rounded-xl border p-3 text-center">
                <div className="text-[11px] opacity-60">Days in the garden</div>
                <div className="text-base font-semibold tabular-nums">{funStats.loading ? '?' : (funStats.daysHere ?? '?')}</div>
              </div>
              <div className="rounded-xl border p-3 text-center">
                <div className="text-[11px] opacity-60">Plants you're tending</div>
                <div className="text-base font-semibold tabular-nums">{funStats.loading ? '?' : (funStats.plantsTotal ?? '?')}</div>
              </div>
              <div className="rounded-xl border p-3 text-center">
                <div className="text-[11px] opacity-60">Favorites saved</div>
                <div className="text-base font-semibold tabular-nums">{funStats.loading ? '?' : (funStats.favorites ?? 0)}</div>
              </div>
                  <div className="rounded-xl border p-3 text-center">
                    <div className="text-[11px] opacity-60">Gardens</div>
                    <div className="text-base font-semibold tabular-nums">{funStats.loading ? '?' : (funStats.gardensCount ?? 0)}</div>
                  </div>
                  <div className="rounded-xl border p-3 text-center">
                    <div className="text-[11px] opacity-60">Current streak</div>
                    <div className="text-base font-semibold tabular-nums">{funStats.loading ? '?' : (funStats.currentStreak ?? 0)}</div>
                  </div>
              <div className="rounded-xl border p-3 text-center">
                    <div className="text-[11px] opacity-60">Longest streak</div>
                    <div className="text-base font-semibold tabular-nums">{funStats.loading ? '?' : (funStats.bestStreak ?? '?')}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


