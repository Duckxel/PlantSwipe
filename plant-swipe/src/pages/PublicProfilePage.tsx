import React from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { createPortal } from "react-dom"
import { supabase } from "@/lib/supabaseClient"
import { useAuth } from "@/context/AuthContext"

type PublicProfile = {
  id: string
  username: string | null
  display_name: string | null
  country: string | null
  bio: string | null
  favorite_plant: string | null
  avatar_url: string | null
}

type PublicStats = {
  plantsTotal: number
  bestStreak: number
}

type DayAgg = { day: string; completed: number; any_success: boolean }

export default function PublicProfilePage() {
  const params = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const displayParam = String(params.username || '')

  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [pp, setPp] = React.useState<PublicProfile | null>(null)
  const [stats, setStats] = React.useState<PublicStats | null>(null)
  const [monthDays, setMonthDays] = React.useState<DayAgg[]>([])

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
          favorite_plant: row.favorite_plant || null,
          avatar_url: row.avatar_url || null,
        })

        // Stats (only plants total and best streak)
        const { data: s, error: serr } = await supabase.rpc('get_user_profile_public_stats', { _user_id: userId })
        if (!serr && s) {
          const statRow = Array.isArray(s) ? s[0] : s
          setStats({
            plantsTotal: Number(statRow.plants_total || 0),
            bestStreak: Number(statRow.best_streak || 0),
          })
        }

        // Heatmap: last 30 days
        const today = new Date()
        const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
        const start = new Date(end)
        start.setUTCDate(end.getUTCDate() - 29)
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

  const grid = React.useMemo(() => {
    // Build 5 columns x 7 rows array in chronological order, then columnize
    const map = new Map<string, DayAgg>()
    for (const d of monthDays) map.set(d.day, d)
    const days: Array<{ date: string; value: number; success: boolean }> = []
    if (monthDays.length > 0) {
      const first = new Date(monthDays[0].day + 'T00:00:00Z')
      const last = new Date(monthDays[monthDays.length - 1].day + 'T00:00:00Z')
      for (let cur = new Date(first); cur <= last; cur.setUTCDate(cur.getUTCDate() + 1)) {
        const ymd = cur.toISOString().slice(0,10)
        const r = map.get(ymd)
        days.push(r ? { date: ymd, value: r.completed, success: r.any_success } : { date: ymd, value: 0, success: false })
      }
    }
    // chunk into columns of 7
    const cols: Array<Array<{ date: string; value: number; success: boolean }>> = []
    for (let i = 0; i < days.length; i += 7) cols.push(days.slice(i, i + 7))
    return cols
  }, [monthDays])

  const colorFor = (cell: { value: number; success: boolean } | null) => {
    if (!cell) return 'bg-stone-200'
    if (!cell.success && (cell.value || 0) <= 0) return 'bg-stone-200'
    const v = Math.max(0, Math.min(4, cell.value))
    return [
      'bg-emerald-100',
      'bg-emerald-200',
      'bg-emerald-300',
      'bg-emerald-400',
      'bg-emerald-500',
    ][v]
  }

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
                <div className="h-16 w-16 rounded-2xl bg-stone-200 overflow-hidden" aria-hidden>
                  {/* avatar placeholder */}
                </div>
                <div className="min-w-0">
                  <div className="text-2xl font-semibold truncate">{pp.display_name || pp.username || 'Member'}</div>
                  <div className="text-sm opacity-70">{pp.display_name}</div>
                  <div className="text-sm opacity-70 mt-1">{pp.country || ''}</div>
                </div>
                <div className="ml-auto flex items-center" ref={anchorRef}>
                  {isOwner ? (
                    <>
                      <Button className="rounded-2xl" variant="secondary" onClick={() => setMenuOpen((o) => !o)}>⋯</Button>
                      {menuOpen && menuPos && createPortal(
                        <div ref={menuRef} className="w-40 rounded-xl border bg-white shadow z-[60] p-1" style={{ position: 'fixed', top: menuPos.top, right: menuPos.right }}>
                          <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-50" onMouseDown={(e) => { e.stopPropagation(); setMenuOpen(false); navigate('/profile') }}>Edit</button>
                          <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-50" onMouseDown={async (e) => { e.stopPropagation(); setMenuOpen(false); navigate('/'); }}>Log out</button>
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
              {pp.favorite_plant && (
                <div className="text-sm"><span className="opacity-60">Favorite plant:</span> {pp.favorite_plant}</div>
              )}
            </CardContent>
          </Card>

          <div className="mt-4">
            <Card className="rounded-3xl">
              <CardContent className="p-6 md:p-8 space-y-4">
                <div className="text-lg font-semibold">Highlights</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <div className="rounded-xl border p-3 text-center">
                    <div className="text-[11px] opacity-60">Plants owned</div>
                    <div className="text-base font-semibold tabular-nums">{stats?.plantsTotal ?? '—'}</div>
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
                <div className="text-lg font-semibold">Past 30 days</div>
                <div className="grid grid-cols-5 gap-2">
                  {grid.map((col, cidx) => (
                    <div key={cidx} className="grid grid-rows-7 gap-1">
                      {Array.from({ length: 7 }).map((_, r) => {
                        const item = col[r] || null
                        const title = item ? `${item.date}: ${item.value} tasks` : ''
                        return <div key={r} className={`h-3 w-3 rounded ${colorFor(item)}`} title={title} />
                      })}
                    </div>
                  ))}
                </div>
                <div className="text-xs opacity-60">Gray = no activity • Green = completed days (darker = more tasks)</div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-4 text-center text-sm opacity-60">Public profile • Visible to everyone</div>
        </>
      )}
    </div>
  )
}

