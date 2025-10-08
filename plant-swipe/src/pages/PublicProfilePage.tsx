import React from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { createPortal } from "react-dom"
import { supabase } from "@/lib/supabaseClient"
import { useAuth } from "@/context/AuthContext"
import { EditProfileDialog, type EditProfileValues } from "@/components/profile/EditProfileDialog"
import { applyAccentByKey, saveAccentKey } from "@/lib/accent"
import { MapPin, User as UserIcon } from "lucide-react"

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
}

type PublicStats = {
  plantsTotal: number
  gardensCount: number
  currentStreak: number
  bestStreak: number
}

type DayAgg = { day: string; completed: number; any_success: boolean }

export default function PublicProfilePage() {
  const params = useParams()
  const navigate = useNavigate()
  const { user, profile, refreshProfile, signOut } = useAuth()
  const displayParam = String(params.username || '')

  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [pp, setPp] = React.useState<PublicProfile | null>(null)
  const [stats, setStats] = React.useState<PublicStats | null>(null)
  const [monthDays, setMonthDays] = React.useState<DayAgg[]>([])
  

  const formatLastSeen = React.useCallback((iso: string | null | undefined) => {
    if (!iso) return 'A long time ago'
    const last = new Date(iso)
    const now = new Date()
    const diffMs = Math.max(0, now.getTime() - last.getTime())
    const diffMin = Math.floor(diffMs / (60 * 1000))
    const diffHours = Math.floor(diffMin / 60)
    const diffDays = Math.floor(diffHours / 24)
    const diffWeeks = Math.floor(diffDays / 7)
    if (diffMin <= 10) return 'Online'
    if (diffHours < 1) return 'Online'
    if (diffHours === 1) return '1 hour ago'
    if (diffHours < 6) return 'Few hours ago'
    if (diffDays === 1) return '1 day ago'
    if (diffDays <= 6) return 'Few days ago'
    if (diffWeeks <= 3) return 'Few weeks ago'
    return 'A long time ago'
  }, [])

  React.useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        // Basic profile by display name
        const { data: rows, error: perr } = await supabase.rpc('get_profile_public_by_display_name', { _name: displayParam })
        if (perr) throw perr
        const row = Array.isArray(rows) ? rows[0] : rows
        if (!row) {
          setError('User not found')
          setLoading(false)
          return
        }
        const userId = String(row.id)
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
        })

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

        // Heatmap: last 28 days (7x4 grid)
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
      } catch (e: any) {
        setError(e?.message || 'Failed to load profile')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [displayParam])

  const isOwner = user?.id && pp?.id && user.id === pp.id
  const [menuOpen, setMenuOpen] = React.useState(false)
  const anchorRef = React.useRef<HTMLDivElement | null>(null)
  const menuRef = React.useRef<HTMLDivElement | null>(null)
  const [menuPos, setMenuPos] = React.useState<{ top: number; right: number } | null>(null)

  const [editOpen, setEditOpen] = React.useState(false)
  const [editSubmitting, setEditSubmitting] = React.useState(false)
  const [editError, setEditError] = React.useState<string | null>(null)

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
    // Render as GitHub-style: 7 rows (days), columns are weeks
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
    if (!cell || cell.value <= 0) return 'bg-stone-200'
    if (maxCount <= 0) return 'bg-stone-200'
    const ratio = cell.value / maxCount
    if (ratio <= 0.25) return 'bg-emerald-100'
    if (ratio <= 0.5) return 'bg-emerald-300'
    if (ratio <= 0.75) return 'bg-emerald-500'
    return 'bg-emerald-700'
  }

  const [tooltip, setTooltip] = React.useState<{ top: number; left: number; date: string; value: number; success: boolean } | null>(null)
  const showTooltip = (el: HTMLElement, cell: { date: string; value: number; success: boolean }) => {
    const r = el.getBoundingClientRect()
    const top = Math.max(8, r.top - 8)
    const left = r.left + r.width / 2
    setTooltip({ top, left, date: cell.date, value: cell.value, success: cell.success })
  }
  const hideTooltip = () => setTooltip(null)

  return (
    <div className="max-w-3xl mx-auto mt-8 px-4 md:px-0">
      {loading && <div className="p-8 text-center text-sm opacity-60">Loading profile…</div>}
      {error && !loading && (
        <div className="p-8 text-center">
          <div className="text-sm text-red-600 mb-2">{error}</div>
          <Button asChild variant="secondary"><Link to="/">Back home</Link></Button>
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
                    <div className="text-2xl font-semibold truncate">{pp.display_name || pp.username || 'Member'}</div>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full border ${pp.is_admin ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-stone-50 text-stone-700 border-stone-200'}`}>{pp.is_admin ? 'Admin' : 'Member'}</span>
                  </div>
                  <div className="text-sm opacity-70 mt-1 flex items-center gap-1">{pp.country ? (<><MapPin className="h-4 w-4" />{pp.country}</>) : ''}</div>
                  <div className="text-xs opacity-70 mt-1 flex items-center gap-2">
                    {pp.is_online ? (
                      <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />Currently online</span>
                    ) : (
                      <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-stone-300" />{formatLastSeen(pp.last_seen_at)}</span>
                    )}
                    {pp.joined_at && <span>• Joined {new Date(pp.joined_at).toLocaleDateString()}</span>}
                  </div>
                </div>
                <div className="ml-auto flex items-center" ref={anchorRef}>
                  {isOwner ? (
                    <>
                      <Button className="rounded-2xl" variant="secondary" onClick={() => setMenuOpen((o) => !o)}>⋯</Button>
                      {menuOpen && menuPos && createPortal(
                        <div ref={menuRef} className="w-40 rounded-xl border bg-white shadow z-[60] p-1" style={{ position: 'fixed', top: menuPos.top, right: menuPos.right }}>
                          <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-50" onMouseDown={(e) => { e.stopPropagation(); setMenuOpen(false); setEditOpen(true) }}>Edit</button>
                          <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-50" onMouseDown={async (e) => { e.stopPropagation(); setMenuOpen(false); await signOut(); navigate('/') }}>Log out</button>
                          <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-50 text-red-600" onMouseDown={(e) => { e.stopPropagation(); setMenuOpen(false); navigate('/profile') }}>Delete account</button>
                        </div>,
                        document.body
                      )}
                    </>
                  ) : null}
                </div>
              </div>
              {pp.bio && (
                <div className="text-sm opacity-90">{pp.bio}</div>
              )}
            </CardContent>
          </Card>

          <div className="mt-4">
            <Card className="rounded-3xl">
              <CardContent className="p-6 md:p-8 space-y-4">
                <div className="text-lg font-semibold">Highlights</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="rounded-xl border p-3 text-center">
                    <div className="text-[11px] opacity-60">Plants owned</div>
                    <div className="text-base font-semibold tabular-nums">{stats?.plantsTotal ?? '—'}</div>
                  </div>
                  <div className="rounded-xl border p-3 text-center">
                    <div className="text-[11px] opacity-60">Gardens</div>
                    <div className="text-base font-semibold tabular-nums">{stats?.gardensCount ?? '—'}</div>
                  </div>
                  <div className="rounded-xl border p-3 text-center">
                    <div className="text-[11px] opacity-60">Current streak</div>
                    <div className="text-base font-semibold tabular-nums">{stats?.currentStreak ?? '—'}</div>
                  </div>
                  <div className="rounded-xl border p-3 text-center">
                    <div className="text-[11px] opacity-60">Longest streak</div>
                    <div className="text-base font-semibold tabular-nums">{stats?.bestStreak ?? '—'}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-4">
            <Card className="rounded-3xl">
              <CardContent className="p-6 md:p-8 space-y-4">
                <div className="text-lg font-semibold">Past 28 days</div>
                <div className="overflow-x-auto">
                  <div className="grid grid-rows-7 grid-flow-col auto-cols-max gap-[2px]">
                    {daysFlat.map((item: { date: string; value: number; success: boolean }, idx: number) => (
                      <div
                        key={idx}
                        tabIndex={0}
                        className={`h-3.5 w-3.5 sm:h-4 sm:w-4 rounded-[2px] ${colorFor(item)}`}
                        onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => showTooltip(e.currentTarget as HTMLDivElement, item)}
                        onMouseLeave={hideTooltip}
                        onFocus={(e: React.FocusEvent<HTMLDivElement>) => showTooltip(e.currentTarget as HTMLDivElement, item)}
                        onBlur={hideTooltip}
                        title={`${item.value} tasks on ${new Date(item.date).toLocaleDateString()}`}
                        aria-label={`${new Date(item.date).toLocaleDateString()}: ${item.value} tasks${item.success ? ', completed day' : ''}`}
                      />
                    ))}
                  </div>
                </div>
                
                {tooltip && createPortal(
                  <div
                    className="fixed z-[70] pointer-events-none"
                    style={{ top: tooltip.top, left: tooltip.left, transform: 'translate(-50%, -100%)' }}
                  >
                    <div className="rounded-xl border bg-white shadow px-3 py-2">
                      <div className="text-xs font-medium">{new Date(tooltip.date).toLocaleDateString()}</div>
                      <div className="text-[11px] opacity-70">{tooltip.value} tasks{tooltip.success ? ' • Completed day' : ''}</div>
                    </div>
                  </div>,
                  document.body
                )}
              </CardContent>
            </Card>
          </div>


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
                  if (dn.length === 0) { setEditError('Display name required'); return }
                  const nameCheck = await supabase
                    .from('profiles')
                    .select('id')
                    .ilike('display_name', dn)
                    .neq('id', user.id)
                    .maybeSingle()
                  if (nameCheck.data?.id) { setEditError('Display name already taken'); return }

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

