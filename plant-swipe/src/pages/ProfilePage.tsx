import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/context/AuthContext"
import { supabase } from "@/lib/supabaseClient"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useNavigate } from "react-router-dom"

type FunStats = {
  loading: boolean
  createdAt: string | null
  daysHere: number | null
  gardensOwned: number | null
  gardensMember: number | null
  gardensTotal: number | null
  plantsTotal: number | null
  favorites: number | null
  bestStreak: number | null
}

export const ProfilePage: React.FC = () => {
  const { user, profile, refreshProfile, signOut, deleteAccount } = useAuth()
  const navigate = useNavigate()
  const [displayName, setDisplayName] = React.useState(profile?.display_name || "")
  const [username, setUsername] = React.useState<string>(profile?.username || "")
  const [country, setCountry] = React.useState<string>(profile?.country || "")
  const [bio, setBio] = React.useState<string>(profile?.bio || "")
  const [favoritePlant, setFavoritePlant] = React.useState<string>(profile?.favorite_plant || "")
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
    gardensOwned: null,
    gardensMember: null,
    gardensTotal: null,
    plantsTotal: null,
    favorites: null,
    bestStreak: null,
  })

  React.useEffect(() => {
    setDisplayName(profile?.display_name || "")
    setUsername(profile?.username || "")
    setCountry(profile?.country || "")
    setBio(profile?.bio || "")
    setFavoritePlant(profile?.favorite_plant || "")
    setTimezone(profile?.timezone || "")
    setExperienceYears(profile?.experience_years != null ? String(profile.experience_years) : "")
  }, [profile?.display_name])

  // If username exists, offer quick link to public page
  const publicPath = (username || '').trim() ? `/u/${(username || '').toLowerCase()}` : null

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
      // Username validation & availability
      const uname = (username || '').trim().toLowerCase()
      if (uname.length > 0) {
        if (!/^([a-z0-9_]{3,20})$/.test(uname)) {
          setError('Username must be 3-20 chars, letters/numbers/_ only')
          return
        }
        // Allow keeping own username
        if (uname !== (profile?.username || '')) {
          const { data: available, error: uerr } = await supabase.rpc('is_username_available', { _username: uname })
          if (uerr) { setError(uerr.message); return }
          if (available === false) { setError('Username not available'); return }
        }
      }
      const { error: uerr } = await supabase
        .from('profiles')
        .upsert({ id: user.id, display_name: displayName, username: uname || null, country: (country || null), bio: (bio || null), favorite_plant: (favoritePlant || null), timezone: (timezone || null), experience_years: (experienceYears ? Number(experienceYears) : null) }, { onConflict: 'id' })
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

        let gardensOwned = 0
        let gardensMember = 0
        let gardensTotal = 0
        let plantsTotal = 0
        let bestStreak = 0

        if (uid) {
          const membersRes = await supabase
            .from('garden_members')
            .select('garden_id')
            .eq('user_id', uid)
          const gardenIds: string[] = Array.isArray(membersRes.data) ? membersRes.data.map((r: any) => String(r.garden_id)) : []
          gardensMember = gardenIds.length
          gardensTotal = gardenIds.length

          const ownedRes = await supabase
            .from('gardens')
            .select('id', { count: 'exact', head: true })
            .eq('created_by', uid)
          if (!ownedRes.error) gardensOwned = ownedRes.count ?? 0

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
          }
        }

        if (!cancelled) {
          setFunStats({
            loading: false,
            createdAt,
            daysHere,
            gardensOwned,
            gardensMember,
            gardensTotal,
            plantsTotal,
            favorites,
            bestStreak,
          })
        }
      } catch {
        if (!cancelled) setFunStats((prev: FunStats) => ({ ...prev, loading: false }))
      }
    }
    load()
    return () => { cancelled = true }
  }, [user?.id, profile?.liked_plant_ids])

  return (
    <div className="max-w-3xl mx-auto mt-8 px-4 md:px-0">
      <Card className="rounded-3xl">
        <CardContent className="p-6 md:p-8 space-y-4">
          {/* Removed User ID from UI */}
          <div className="grid gap-2">
            <Label htmlFor="profile-email">Email</Label>
            <Input id="profile-email" name="email" value={(user as any)?.email || ''} disabled />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-display-name">Display name</Label>
            <Input id="profile-display-name" name="displayName" value={displayName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-username">Username</Label>
            <Input id="profile-username" name="username" value={username || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)} />
            <div className="text-xs opacity-60">Public profile: /u/{(username || '').toLowerCase()}</div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-country">Country</Label>
            <Input id="profile-country" name="country" value={country || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCountry(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-favorite-plant">Favorite plant</Label>
            <Input id="profile-favorite-plant" name="favoritePlant" value={favoritePlant || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFavoritePlant(e.target.value)} />
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
                <div className="text-xs break-all">{privateInfo?.id || '—'}</div>
              </div>
              <div className="rounded-xl border p-3">
                <div className="text-[11px] opacity-60">Email</div>
                <div className="text-sm">{privateInfo?.email || (user as any)?.email || '—'}</div>
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
                  {funStats.loading ? '—' : (funStats.createdAt ? new Date(funStats.createdAt).toLocaleDateString() : '—')}
                </div>
              </div>
              <div className="rounded-xl border p-3 text-center">
                <div className="text-[11px] opacity-60">Days in the garden</div>
                <div className="text-base font-semibold tabular-nums">{funStats.loading ? '—' : (funStats.daysHere ?? '—')}</div>
              </div>
              <div className="rounded-xl border p-3 text-center">
                <div className="text-[11px] opacity-60">Gardens you started</div>
                <div className="text-base font-semibold tabular-nums">{funStats.loading ? '—' : (funStats.gardensOwned ?? '—')}</div>
              </div>
              <div className="rounded-xl border p-3 text-center">
                <div className="text-[11px] opacity-60">Gardens you're in</div>
                <div className="text-base font-semibold tabular-nums">{funStats.loading ? '—' : (funStats.gardensMember ?? '—')}</div>
              </div>
              <div className="rounded-xl border p-3 text-center">
                <div className="text-[11px] opacity-60">Plants you're tending</div>
                <div className="text-base font-semibold tabular-nums">{funStats.loading ? '—' : (funStats.plantsTotal ?? '—')}</div>
              </div>
              <div className="rounded-xl border p-3 text-center">
                <div className="text-[11px] opacity-60">Favorites saved</div>
                <div className="text-base font-semibold tabular-nums">{funStats.loading ? '—' : (funStats.favorites ?? 0)}</div>
              </div>
              <div className="rounded-xl border p-3 text-center">
                <div className="text-[11px] opacity-60">Best streak</div>
                <div className="text-base font-semibold tabular-nums">{funStats.loading ? '—' : (funStats.bestStreak ?? '—')}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


