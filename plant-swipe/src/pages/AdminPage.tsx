import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RefreshCw, Server, Database, Github, ExternalLink } from "lucide-react"
import { supabase } from '@/lib/supabaseClient'

export const AdminPage: React.FC = () => {

  const [syncing, setSyncing] = React.useState(false)
  
  const [backingUp, setBackingUp] = React.useState(false)

  const [restarting, setRestarting] = React.useState(false)
  const [pulling, setPulling] = React.useState(false)

  const runSyncSchema = async () => {
    if (syncing) return
    setSyncing(true)
    try {
      const session = (await supabase.auth.getSession()).data.session
      const token = session?.access_token
      if (!token) {
        alert('You must be signed in to run schema sync')
        return
      }
      // Try GET first to avoid 405s from proxies that block POST
      let resp = await fetch('/api/admin/sync-schema', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      if (resp.status === 405) {
        // Fallback to POST if GET is blocked
        resp = await fetch('/api/admin/sync-schema', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        })
      }
      const body = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        throw new Error(body?.error || `Request failed (${resp.status})`)
      }
      alert('Schema synchronized successfully')
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      alert(`Failed to sync schema: ${message}`)
    } finally {
      setSyncing(false)
    }
  }

  const restartServer = async () => {
    if (restarting) return
    setRestarting(true)
    try {
      const session = (await supabase.auth.getSession()).data.session
      const token = session?.access_token
      if (!token) {
        alert('You must be signed in to restart the server')
        return
      }
      // Try POST first to ensure Authorization header is preserved across proxies
      let resp = await fetch('/api/admin/restart-server', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: '{}',
      })
      if (resp.status === 405) {
        // Fallback to GET if POST is blocked
        resp = await fetch('/api/admin/restart-server', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })
      }
      const body = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        throw new Error(body?.error || `Request failed (${resp.status})`)
      }
      // Give the server a moment to restart, then reload client
      setTimeout(() => {
        window.location.reload()
      }, 1000)

    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      alert(`Failed to restart server: ${message}`)
    } finally {
      setRestarting(false)
    }
  }

  const [uniqueIpsLast60m, setUniqueIpsLast60m] = React.useState<number>(0)
  const [registeredCount, setRegisteredCount] = React.useState<number | null>(null)
  // Visitors (last 7 days)
  const [visitorsSeries, setVisitorsSeries] = React.useState<Array<{ date: string; uniqueVisitors: number }>>([])
  const [visitorsLoading, setVisitorsLoading] = React.useState<boolean>(true)
  const [visitorsError, setVisitorsError] = React.useState<string | null>(null)
  // No subtitle needed below the card

  const pullLatest = async () => {
    if (pulling) return
    setPulling(true)
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      // Try POST first to ensure Authorization header is preserved across proxies
      let res = await fetch('/api/admin/pull-code', {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : undefined,
        body: token ? '{}' : undefined,
      })
      if (res.status === 405) {
        // Fallback to GET if POST is blocked
        res = await fetch('/api/admin/pull-code', {
          method: 'GET',
          headers: token ? { 'Authorization': `Bearer ${token}` } : undefined,
        })
      }
      if (!res.ok) {
        let body: any = {}
        try {
          body = await res.json()
        } catch {
          const text = await res.text().catch(() => '')
          throw new Error(text?.slice(0, 200) || `Request failed (${res.status})`)
        }
        throw new Error(body?.error || `Request failed (${res.status})`)
      }
      setTimeout(() => { window.location.reload() }, 800)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      alert(`Failed to pull & build: ${message}`)
    } finally {
      setPulling(false)
    }
  }

  const runBackup = async () => {
    if (backingUp) return
    setBackingUp(true)
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      if (!token) {
        alert('You must be signed in to back up the database')
        return
      }

      const start = await fetch('/api/admin/backup-db', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })
      const startBody: { token?: string; filename?: string; error?: string } = await start.json().catch(() => ({} as { token?: string; filename?: string; error?: string }))
      if (!start.ok) {
        throw new Error(startBody?.error || `Backup failed (${start.status})`)
      }
      const dlToken = startBody?.token
      const filename: string = startBody?.filename || 'backup.sql.gz'
      if (!dlToken) throw new Error('Missing download token from server')

      const downloadUrl = `/api/admin/download-backup?token=${encodeURIComponent(dlToken)}`
      const resp = await fetch(downloadUrl, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (!resp.ok) {
        const errBody: { error?: string } = await resp.json().catch(() => ({} as { error?: string }))
        throw new Error(errBody?.error || `Download failed (${resp.status})`)
      }
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      alert(`Backup failed: ${message}`)
    } finally {
      setBackingUp(false)
    }
  }

  // Use server-side metric: unique IPs in last 60 minutes
  React.useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setInterval> | null = null
    const load = async () => {
      try {
        const token = (await supabase.auth.getSession()).data.session?.access_token
        if (!token) return
        const resp = await fetch('/api/admin/visitors-stats', { headers: { 'Authorization': `Bearer ${token}` } })
        const data = await resp.json().catch(() => ({}))
        if (resp.ok && !cancelled) {
          const val: number = Number.isFinite(Number(data?.uniqueIpsLast60m)) ? Number(data.uniqueIpsLast60m) : 0
          setUniqueIpsLast60m(val)
        }
      } catch {}
    }
    load().catch(() => {})
    timer = setInterval(() => { load().catch(() => {}) }, 20_000)
    return () => { cancelled = true; if (timer) clearInterval(timer) }
  }, [])

  // Fetch total registered accounts (admin API first to bypass RLS; fallback to client count)
  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const token = (await supabase.auth.getSession()).data.session?.access_token
        if (token) {
          const resp = await fetch('/api/admin/stats', { headers: { 'Authorization': `Bearer ${token}` } })
          if (resp.ok) {
            const data = await resp.json().catch(() => ({}))
            const val = typeof data?.profilesCount === 'number' ? data.profilesCount : null
            if (!cancelled && val !== null) { setRegisteredCount(val); return }
          }
        }
      } catch {}
      // Fallback: client-side count (will be limited by RLS to own row)
      const { count, error } = await supabase.from('profiles').select('id', { count: 'exact', head: true })
      if (!cancelled) setRegisteredCount(error ? null : (count ?? 0))
    })()
    return () => { cancelled = true }
  }, [])

  // Fetch unique IPs (last 7 days) for the chart
  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      setVisitorsLoading(true)
      setVisitorsError(null)
      try {
        const token = (await supabase.auth.getSession()).data.session?.access_token
        if (!token) {
          throw new Error('Not authenticated')
        }
        const resp = await fetch('/api/admin/visitors-stats', { headers: { 'Authorization': `Bearer ${token}` } })
        const data = await resp.json().catch(() => ({}))
        if (!resp.ok) {
          throw new Error(data?.error || `Request failed (${resp.status})`)
        }
        const series: Array<{ date: string; uniqueVisitors: number }> = Array.isArray(data?.series7d) ? data.series7d : []
        if (!cancelled) setVisitorsSeries(series)
        // Update the online card metric as well (60m)
        const unique60: number = Number.isFinite(Number(data?.uniqueIpsLast60m)) ? Number(data.uniqueIpsLast60m) : 0
        if (!cancelled) setUniqueIpsLast60m(unique60)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        if (!cancelled) setVisitorsError(msg || 'Failed to load visitors stats')
      } finally {
        if (!cancelled) setVisitorsLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Inline chart (SVG) using Tailwind chart palette via CSS variables
  type VisitorsDatum = { date: string; uniqueVisitors: number }
  type VisitorsPoint = { x: number; y: number }
  function VisitorsLineChart(props: { data: VisitorsDatum[] }): React.ReactElement {
    const data: VisitorsDatum[] = props.data
    const containerRef = React.useRef<HTMLDivElement | null>(null)
    const [hoverIndex, setHoverIndex] = React.useState<number | null>(null)
    const n: number = data.length
    const values: number[] = data.map((d: VisitorsDatum) => Math.max(0, Number(d.uniqueVisitors || 0)))
    const maxVal: number = Math.max(5, ...values)
    const w = 800
    const h = 240
    const m = { top: 14, right: 12, bottom: 36, left: 40 }
    const iw = w - m.left - m.right
    const ih = h - m.top - m.bottom
    const stepX: number = n > 1 ? (iw / (n - 1)) : 0
    const xAt = (i: number): number => m.left + (stepX * i)
    const yAt = (v: number): number => m.top + (ih - (ih * (v / (maxVal || 1))))
    const points: VisitorsPoint[] = values.map((v: number, i: number) => ({ x: xAt(i), y: yAt(v) }))

    const pathD = React.useMemo<string>(() => {
      if (points.length === 0) return ''
      if (points.length === 1) return `M ${points[0].x} ${points[0].y}`
      const s = 0.7 // smoothing factor
      let d = `M ${points[0].x} ${points[0].y}`
      for (let i = 0; i < points.length - 1; i++) {
        const p0: VisitorsPoint = points[Math.max(0, i - 1)]
        const p1: VisitorsPoint = points[i]
        const p2: VisitorsPoint = points[i + 1]
        const p3: VisitorsPoint = points[Math.min(points.length - 1, i + 2)]
        const c1x = p1.x + (p2.x - p0.x) / 6 * s
        const c1y = p1.y + (p2.y - p0.y) / 6 * s
        const c2x = p2.x - (p3.x - p1.x) / 6 * s
        const c2y = p2.y - (p3.y - p1.y) / 6 * s
        d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`
      }
      return d
    }, [points])

    const areaD = React.useMemo<string>(() => {
      if (points.length === 0) return ''
      const baseline = yAt(0)
      if (points.length === 1) return `M ${points[0].x} ${baseline} L ${points[0].x} ${points[0].y} L ${points[0].x} ${baseline} Z`
      const s = 0.7
      let d = `M ${points[0].x} ${baseline} L ${points[0].x} ${points[0].y}`
      for (let i = 0; i < points.length - 1; i++) {
        const p0: VisitorsPoint = points[Math.max(0, i - 1)]
        const p1: VisitorsPoint = points[i]
        const p2: VisitorsPoint = points[i + 1]
        const p3: VisitorsPoint = points[Math.min(points.length - 1, i + 2)]
        const c1x = p1.x + (p2.x - p0.x) / 6 * s
        const c1y = p1.y + (p2.y - p0.y) / 6 * s
        const c2x = p2.x - (p3.x - p1.x) / 6 * s
        const c2y = p2.y - (p3.y - p1.y) / 6 * s
        d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`
      }
      const last: VisitorsPoint = points[points.length - 1]
      d += ` L ${last.x} ${baseline} Z`
      return d
    }, [points])

    const xLabels: string[] = data.map((d: VisitorsDatum) => {
      const dt = new Date(d.date)
      return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    })

    const todayIdx: number = data.length - 1

    return (
      <div ref={containerRef} className="relative">
        <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Visitors last 7 days" className="w-full h-[240px]">
          <defs>
            <linearGradient id="visitorsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity="0.20" />
              <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Gridlines */}
          {Array.from({ length: 5 }).map((_: unknown, i: number) => {
            const y = m.top + (ih * (i / 4))
            return (
              <line key={i} x1={m.left} x2={m.left + iw} y1={y} y2={y} stroke="hsl(var(--border))" strokeDasharray="3 4" />
            )
          })}

          {/* Area fill */}
          {areaD && (
            <path d={areaD} fill="url(#visitorsGradient)" />
          )}

          {/* Line */}
          {pathD && (
            <path d={pathD} fill="none" stroke="hsl(var(--chart-1))" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
          )}

          {/* Points */}
          {points.map((p: VisitorsPoint, i: number) => (
            <g key={i}>
              <circle
                cx={p.x}
                cy={p.y}
                r={hoverIndex === i ? 6 : 5}
                fill={i === todayIdx ? 'hsl(var(--primary))' : 'white'}
                stroke={i === todayIdx ? 'hsl(var(--primary))' : 'hsl(var(--chart-1))'}
                strokeWidth={i === todayIdx ? 3 : 2}
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex((cur: number | null) => (cur === i ? null : cur))}
              >
                <title>{`${xLabels[i]}: ${values[i]} visitors`}</title>
              </circle>
            </g>
          ))}

          {/* X axis labels */}
          {xLabels.map((label: string, i: number) => (
            <text key={i} x={xAt(i)} y={h - 8} textAnchor="middle" fontSize={12} fill="hsl(var(--muted-foreground))">{label}</text>
          ))}
        </svg>

        {/* Tooltip (simplified) */}
        {hoverIndex !== null && points[hoverIndex] && (
          <div
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-[110%] rounded-lg bg-white/95 shadow-md ring-1 ring-black/5 px-2 py-0.5 text-[11px]"
            style={{ left: `${((points[hoverIndex].x) / w) * 100}%`, top: `${((points[hoverIndex].y) / h) * 100}%` }}
          >
            <div className="font-medium tabular-nums">{values[hoverIndex]} <span className="opacity-60">• {xLabels[hoverIndex]}</span></div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto mt-8 px-4 md:px-0">
      <Card className="rounded-3xl">
        <CardContent className="p-6 md:p-8 space-y-6">
          <div>
            <div className="text-2xl font-semibold tracking-tight">Admin Controls</div>
            <div className="text-sm opacity-60 mt-1">Admin actions: monitor and manage infrastructure.</div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Button className="rounded-2xl w-full" onClick={restartServer} disabled={restarting}>
              <Server className="h-4 w-4" />
              <RefreshCw className="h-4 w-4" />
              <span>{restarting ? 'Restarting…' : 'Restart Server'}</span>
            </Button>
            <Button className="rounded-2xl w-full" variant="secondary" onClick={pullLatest} disabled={pulling}>
              <Github className="h-4 w-4" />
              <RefreshCw className="h-4 w-4" />
              <span>{pulling ? 'Pulling…' : 'Pull & Build'}</span>
            </Button>
            <Button className="rounded-2xl w-full" variant="destructive" onClick={runSyncSchema} disabled={syncing}>
              <Database className="h-4 w-4" />
              <span>{syncing ? 'Syncing Schema…' : 'Sync DB Schema'}</span>
            </Button>
            <Button className="rounded-2xl w-full" onClick={runBackup} disabled={backingUp}>
              <Database className="h-4 w-4" />
              <span>{backingUp ? 'Creating Backup…' : 'Backup DB'}</span>
            </Button>
          </div>

          <div className="pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <Card className="rounded-2xl">
                <CardContent className="p-4">
                  <div className="text-sm opacity-60">Currently online (last 60m)</div>
                  <div className="text-2xl font-semibold">{uniqueIpsLast60m}</div>
                </CardContent>
              </Card>
              <Card className="rounded-2xl">
                <CardContent className="p-4">
                  <div className="text-sm opacity-60">Registered accounts</div>
                  <div className="text-2xl font-semibold">{registeredCount ?? '—'}</div>
                </CardContent>
              </Card>
            </div>
            <Card className="rounded-2xl mb-4">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-baseline justify-between mb-3">
                  <div className="text-sm opacity-60">Visitors (last 7 days)</div>
                  {!visitorsLoading && !visitorsError && visitorsSeries.length > 0 && (
                    <div className="text-sm opacity-70">Today: <span className="font-medium">{visitorsSeries[visitorsSeries.length - 1]?.uniqueVisitors ?? 0}</span></div>
                  )}
                </div>
                {visitorsError && (
                  <div className="text-sm text-red-600">{visitorsError}</div>
                )}
                {visitorsLoading && !visitorsError && (
                  <div className="h-[240px] w-full animate-pulse rounded-xl bg-muted" />
                )}
                {!visitorsLoading && !visitorsError && (
                  <VisitorsLineChart data={visitorsSeries} />
                )}
              </CardContent>
            </Card>
            <div className="text-xs font-medium uppercase tracking-wide opacity-60 mb-2">Quick Links</div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" className="rounded-2xl">
                <a href="https://github.com/Duckxel/PlantSwipe" target="_blank" rel="noreferrer">
                  <Github className="h-4 w-4" />
                  <span>GitHub</span>
                  <ExternalLink className="h-3 w-3 opacity-70" />
                </a>
              </Button>
              <Button asChild variant="outline" className="rounded-2xl">
                <a href="https://supabase.com/dashboard/project/lxnkcguwewrskqnyzjwi" target="_blank" rel="noreferrer">
                  <span className="inline-block h-3 w-3 rounded-sm bg-emerald-500" />
                  <span>Supabase</span>
                  <ExternalLink className="h-3 w-3 opacity-70" />
                </a>
              </Button>
              <Button asChild variant="outline" className="rounded-2xl">
                <a href="https://cloud.linode.com/linodes/84813440/metrics" target="_blank" rel="noreferrer">
                  <span className="inline-block h-3 w-3 rounded-sm bg-blue-600" />
                  <span>Linode</span>
                  <ExternalLink className="h-3 w-3 opacity-70" />
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  )
}

export default AdminPage

