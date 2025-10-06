import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from 'recharts'
import { RefreshCw, Server, Database, Github, ExternalLink, ShieldCheck } from "lucide-react"
import { supabase } from '@/lib/supabaseClient'

export const AdminPage: React.FC = () => {

  const [syncing, setSyncing] = React.useState(false)
  
  const [backingUp, setBackingUp] = React.useState(false)

  const [restarting, setRestarting] = React.useState(false)
  const [pulling, setPulling] = React.useState(false)

  // Safely parse response body into JSON, tolerating HTML/error pages
  const safeJson = async (resp: Response): Promise<any> => {
    try {
      const contentType = (resp.headers.get('content-type') || '').toLowerCase()
      const text = await resp.text().catch(() => '')
      if (contentType.includes('application/json') || /^[\s\n]*[\[{]/.test(text)) {
        try { return JSON.parse(text) } catch { return {} }
      }
      return {}
    } catch {
      return {}
    }
  }

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
          'Accept': 'application/json',
        },
        credentials: 'same-origin',
      })
      if (resp.status === 405) {
        // Fallback to POST if GET is blocked
        resp = await fetch('/api/admin/sync-schema', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          credentials: 'same-origin',
        })
      }
      const body = await safeJson(resp)
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
          'Accept': 'application/json',
        },
        credentials: 'same-origin',
        body: '{}',
      })
      if (resp.status === 405) {
        // Fallback to GET if POST is blocked
        resp = await fetch('/api/admin/restart-server', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
          credentials: 'same-origin',
        })
      }
      const body = await safeJson(resp)
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

  const [onlineUsers, setOnlineUsers] = React.useState<number>(0)
  const [registeredCount, setRegisteredCount] = React.useState<number | null>(null)
  const [onlineLoading, setOnlineLoading] = React.useState<boolean>(true)
  const [onlineRefreshing, setOnlineRefreshing] = React.useState<boolean>(false)
  const [onlineUpdatedAt, setOnlineUpdatedAt] = React.useState<number | null>(null)
  const [visitorsLoading, setVisitorsLoading] = React.useState<boolean>(true)
  const [visitorsRefreshing, setVisitorsRefreshing] = React.useState<boolean>(false)
  const [visitorsUpdatedAt, setVisitorsUpdatedAt] = React.useState<number | null>(null)
  const [visitorsSeries, setVisitorsSeries] = React.useState<Array<{ date: string; uniqueVisitors: number }>>([])
  // Tick every minute to update the "Updated X ago" label without refetching
  const [nowMs, setNowMs] = React.useState<number>(() => Date.now())
  React.useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])
  // No subtitle needed below the card

  const formatTimeAgo = (ts: number): string => {
    const diff = Math.max(0, nowMs - ts)
    const s = Math.floor(diff / 1000)
    if (s < 45) return 'just now'
    const m = Math.floor(s / 60)
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    const d = Math.floor(h / 24)
    return `${d}d ago`
  }

  // --- Health monitor: ping API, Admin, DB every second ---
  type ProbeResult = { ok: boolean | null; latencyMs: number | null; updatedAt: number | null }
  const [apiProbe, setApiProbe] = React.useState<ProbeResult>({ ok: null, latencyMs: null, updatedAt: null })
  const [adminProbe, setAdminProbe] = React.useState<ProbeResult>({ ok: null, latencyMs: null, updatedAt: null })
  const [dbProbe, setDbProbe] = React.useState<ProbeResult>({ ok: null, latencyMs: null, updatedAt: null })

  const probeEndpoint = React.useCallback(async (url: string, okCheck?: (body: any) => boolean): Promise<ProbeResult> => {
    const started = Date.now()
    try {
      const resp = await fetch(url, { headers: { 'Accept': 'application/json' }, credentials: 'same-origin' })
      const body = await safeJson(resp)
      const ok = (typeof okCheck === 'function') ? okCheck(body) && resp.ok : (resp.ok && body?.ok === true)
      return { ok, latencyMs: Date.now() - started, updatedAt: Date.now() }
    } catch {
      return { ok: false, latencyMs: Date.now() - started, updatedAt: Date.now() }
    }
  }, [safeJson])

  React.useEffect(() => {
    let cancelled = false
    const run = async () => {
      const [apiRes, adminRes, dbRes] = await Promise.all([
        probeEndpoint('/api/health', (b) => b?.ok === true),
        probeEndpoint('/api/admin/stats', (b) => b?.ok === true && typeof b?.profilesCount === 'number'),
        probeEndpoint('/api/health/db', (b) => b?.ok === true),
      ])
      if (!cancelled) {
        setApiProbe(apiRes)
        setAdminProbe(adminRes)
        setDbProbe(dbRes)
      }
    }
    // initial
    run()
    const id = setInterval(run, 1000)
    return () => { cancelled = true; clearInterval(id) }
  }, [probeEndpoint])

  const StatusDot: React.FC<{ ok: boolean | null }> = ({ ok }) => (
    <span
      className={
        `inline-block h-3 w-3 rounded-full ${ok === null ? 'bg-zinc-400' : ok ? 'bg-emerald-500' : 'bg-rose-500'}`
      }
      aria-label={ok === null ? 'unknown' : ok ? 'ok' : 'error'}
    />
  )

  // Fallback to Supabase Realtime presence if API is unavailable
  const getPresenceCountOnce = React.useCallback(async (): Promise<number | null> => {
    try {
      const key = `admin_${Math.random().toString(36).slice(2, 10)}`
      const channel: any = (supabase as any).channel('global-presence', { config: { presence: { key } } })
      return await new Promise<number | null>((resolve) => {
        let settled = false
        const finish = (val: number | null) => {
          if (settled) return
          settled = true
          try { channel.untrack?.() } catch {}
          try { (supabase as any).removeChannel(channel) } catch {}
          resolve(val)
        }
        const timer = setTimeout(() => finish(null), 2000)
        channel.on('presence', { event: 'sync' }, () => {
          try {
            const state = channel.presenceState?.() || {}
            const count = Object.values(state as Record<string, any[]>).reduce((acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0), 0)
            clearTimeout(timer)
            finish(Number.isFinite(count) ? count : 0)
          } catch {
            clearTimeout(timer)
            finish(null)
          }
        })
        channel.subscribe((status: any) => {
          if (status === 'SUBSCRIBED') {
            try { channel.track({ admin_probe: true, at: new Date().toISOString() }) } catch {}
          }
        })
      })
    } catch {
      return null
    }
  }, [])

  const pullLatest = async () => {
    if (pulling) return
    setPulling(true)
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      // Try POST first to ensure Authorization header is preserved across proxies
      let res = await fetch('/api/admin/pull-code', {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Accept': 'application/json' } : { 'Accept': 'application/json' },
        body: token ? '{}' : undefined,
        credentials: 'same-origin',
      })
      if (res.status === 405) {
        // Fallback to GET if POST is blocked
        res = await fetch('/api/admin/pull-code', {
          method: 'GET',
          headers: token ? { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' } : { 'Accept': 'application/json' },
          credentials: 'same-origin',
        })
      }
      if (!res.ok) {
        const body: any = await safeJson(res)
        if (!body || Object.keys(body).length === 0) {
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
          'Accept': 'application/json',
        },
        credentials: 'same-origin',
      })
      const startBody: { token?: string; filename?: string; error?: string } = await safeJson(start)
      if (!start.ok) {
        throw new Error(startBody?.error || `Backup failed (${start.status})`)
      }
      const dlToken = startBody?.token
      const filename: string = startBody?.filename || 'backup.sql.gz'
      if (!dlToken) throw new Error('Missing download token from server')

      const downloadUrl = `/api/admin/download-backup?token=${encodeURIComponent(dlToken)}`
      const resp = await fetch(downloadUrl, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/gzip' },
        credentials: 'same-origin',
      })
      if (!resp.ok) {
        const errText = await resp.text().catch(() => '')
        let errBody: { error?: string } = {}
        try { errBody = JSON.parse(errText) } catch {}
        throw new Error(errBody?.error || errText?.slice(0, 200) || `Download failed (${resp.status})`)
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


  // Shared loader for visitors stats (used on initial load and manual refresh)
  const loadOnlineUsers = React.useCallback(async (opts?: { initial?: boolean }) => {
    const isInitial = !!opts?.initial
    if (isInitial) setOnlineLoading(true)
    else setOnlineRefreshing(true)
    try {
      const resp = await fetch('/api/admin/online-users', {
        headers: { 'Accept': 'application/json' },
        credentials: 'same-origin',
      })
      const data = await safeJson(resp)
      if (!resp.ok) {
        throw new Error(data?.error || `Request failed (${resp.status})`)
      }
      const num = Number(data?.onlineUsers)
      setOnlineUsers(Number.isFinite(num) ? num : 0)
      setOnlineUpdatedAt(Date.now())
    } catch {
      // Fallback to presence count
      try {
        const pc = await getPresenceCountOnce()
        if (pc !== null) {
          setOnlineUsers(Math.max(0, pc))
          setOnlineUpdatedAt(Date.now())
        }
      } catch {}
    } finally {
      if (isInitial) setOnlineLoading(false)
      else setOnlineRefreshing(false)
    }
  }, [])

  // Initial load (page load only)
  React.useEffect(() => {
    loadOnlineUsers({ initial: true })
  }, [loadOnlineUsers])

  // Auto-refresh the "Currently online" count every minute
  React.useEffect(() => {
    const intervalId = setInterval(() => {
      loadOnlineUsers({ initial: false })
    }, 60_000)
    return () => clearInterval(intervalId)
  }, [loadOnlineUsers])

  // Load visitors stats (last 7 days)
  const loadVisitorsStats = React.useCallback(async (opts?: { initial?: boolean }) => {
    const isInitial = !!opts?.initial
    if (isInitial) setVisitorsLoading(true)
    else setVisitorsRefreshing(true)
    try {
      const resp = await fetch('/api/admin/visitors-stats', {
        headers: { 'Accept': 'application/json' },
        credentials: 'same-origin',
      })
      const data = await safeJson(resp)
      if (!resp.ok) throw new Error(data?.error || `Request failed (${resp.status})`)
      const series: Array<{ date: string; uniqueVisitors: number }> = Array.isArray(data?.series7d)
        ? data.series7d.map((d: any) => ({ date: String(d.date), uniqueVisitors: Number(d.uniqueVisitors ?? d.unique_visitors ?? 0) }))
        : []
      setVisitorsSeries(series)
      setVisitorsUpdatedAt(Date.now())
    } catch {
      // keep last known
    } finally {
      if (isInitial) setVisitorsLoading(false)
      else setVisitorsRefreshing(false)
    }
  }, [])

  React.useEffect(() => {
    loadVisitorsStats({ initial: true })
  }, [loadVisitorsStats])

  return (
    <div className="max-w-3xl mx-auto mt-8 px-4 md:px-0">
      <Card className="rounded-3xl">
        <CardContent className="p-6 md:p-8 space-y-6">
          <div>
            <div className="text-2xl font-semibold tracking-tight">Admin Controls</div>
            <div className="text-sm opacity-60 mt-1">Admin actions: monitor and manage infrastructure.</div>
          </div>

          {/* Health monitor */}
          <Card className="rounded-2xl">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Health monitor</div>
                  <div className="text-xs opacity-60">Pinging every second</div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                <div className="flex items-center justify-between rounded-xl border p-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Server className="h-4 w-4 opacity-70" />
                    <div className="text-sm truncate">API</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs tabular-nums opacity-60">
                      {apiProbe.latencyMs !== null ? `${apiProbe.latencyMs} ms` : '—'}
                    </div>
                    <StatusDot ok={apiProbe.ok} />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-xl border p-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <ShieldCheck className="h-4 w-4 opacity-70" />
                    <div className="text-sm truncate">Admin API</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs tabular-nums opacity-60">
                      {adminProbe.latencyMs !== null ? `${adminProbe.latencyMs} ms` : '—'}
                    </div>
                    <StatusDot ok={adminProbe.ok} />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-xl border p-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Database className="h-4 w-4 opacity-70" />
                    <div className="text-sm truncate">Database</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs tabular-nums opacity-60">
                      {dbProbe.latencyMs !== null ? `${dbProbe.latencyMs} ms` : '—'}
                    </div>
                    <StatusDot ok={dbProbe.ok} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

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
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm opacity-60">Currently online</div>
                      <div className="text-xs opacity-60">{onlineUpdatedAt ? `Updated ${formatTimeAgo(onlineUpdatedAt)}` : 'Updated —'}</div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Refresh currently online"
                      onClick={() => loadOnlineUsers({ initial: false })}
                      disabled={onlineLoading || onlineRefreshing}
                      className="h-8 w-8"
                    >
                      <RefreshCw className={`h-4 w-4 ${onlineLoading || onlineRefreshing ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                  <div className="text-2xl font-semibold tabular-nums mt-1">
                    {onlineLoading ? '—' : onlineUsers}
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-2xl">
                <CardContent className="p-4">
                  <div className="text-sm opacity-60">Registered accounts</div>
                  <div className="text-2xl font-semibold">{registeredCount ?? '—'}</div>
                </CardContent>
              </Card>
            </div>
            <Card className="rounded-2xl">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div>
                    <div className="text-sm font-medium">Unique visitors — last 7 days</div>
                    <div className="text-xs opacity-60">{visitorsUpdatedAt ? `Updated ${formatTimeAgo(visitorsUpdatedAt)}` : 'Updated —'}</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Refresh visitors"
                    onClick={() => loadVisitorsStats({ initial: false })}
                    disabled={visitorsLoading || visitorsRefreshing}
                    className="h-8 w-8"
                  >
                    <RefreshCw className={`h-4 w-4 ${visitorsLoading || visitorsRefreshing ? 'animate-spin' : ''}`} />
                  </Button>
                </div>

                {visitorsLoading ? (
                  <div className="text-sm opacity-60">Loading…</div>
                ) : visitorsSeries.length === 0 ? (
                  <div className="text-sm opacity-60">No data yet.</div>
                ) : (
                  (() => {
                    const values = visitorsSeries.map(d => d.uniqueVisitors)
                    const maxVal = Math.max(...values, 1)
                    const totalVal = values.reduce((acc, val) => acc + val, 0)
                    const avgVal = Math.round(totalVal / values.length)

                    const formatDow = (isoDate: string) => {
                      try {
                        const dt = new Date(isoDate + 'T00:00:00Z')
                        return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dt.getUTCDay()]
                      } catch {
                        return isoDate
                      }
                    }

                    const formatFullDate = (isoDate: string) => {
                      try {
                        const dt = new Date(isoDate + 'T00:00:00Z')
                        return new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(dt)
                      } catch {
                        return isoDate
                      }
                    }

                    const TooltipContent = ({ active, payload, label }: any) => {
                      if (!active || !payload || payload.length === 0) return null
                      const current = payload[0]?.value as number
                      const idx = visitorsSeries.findIndex(d => d.date === label)
                      const prev = idx > 0 ? visitorsSeries[idx - 1]?.uniqueVisitors ?? 0 : 0
                      const delta = current - prev
                      const pct = prev > 0 ? Math.round((delta / prev) * 100) : null
                      const up = delta > 0
                      const down = delta < 0
                      return (
                        <div className="rounded-xl border bg-white/90 backdrop-blur p-3 shadow-lg">
                          <div className="text-xs opacity-60">{formatFullDate(label)}</div>
                          <div className="mt-1 text-base font-semibold tabular-nums">{current}</div>
                          <div className="text-xs mt-0.5">
                            <span className={up ? 'text-emerald-600' : down ? 'text-rose-600' : 'text-neutral-600'}>
                              {delta === 0 ? 'No change' : `${up ? '+' : ''}${delta}${pct !== null ? ` (${pct}%)` : ''}`}
                            </span>
                            <span className="opacity-60"> vs previous day</span>
                          </div>
                          <div className="text-[11px] opacity-70 mt-1">7‑day avg: <span className="font-medium">{avgVal}</span></div>
                        </div>
                      )
                    }

                    return (
                      <div>
                        <div className="text-sm font-medium mb-2">Total for the whole week: <span className="tabular-nums">{totalVal}</span></div>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart
                              data={visitorsSeries}
                              margin={{ top: 10, right: 8, bottom: 8, left: 0 }}
                            >
                              <defs>
                                <linearGradient id="visitsLineGrad" x1="0" y1="0" x2="1" y2="0">
                                  <stop offset="0%" stopColor="#111827" />
                                  <stop offset="100%" stopColor="#6b7280" />
                                </linearGradient>
                                <linearGradient id="visitsAreaGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#111827" stopOpacity={0.35} />
                                  <stop offset="100%" stopColor="#111827" stopOpacity={0.05} />
                                </linearGradient>
                              </defs>

                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                              <XAxis
                                dataKey="date"
                                tickFormatter={formatDow}
                                tick={{ fontSize: 11, fill: '#525252' }}
                                axisLine={false}
                                tickLine={false}
                                interval={0}
                              />
                              <YAxis
                                allowDecimals={false}
                                domain={[0, Math.max(maxVal, 5)]}
                                tick={{ fontSize: 11, fill: '#525252' }}
                                axisLine={false}
                                tickLine={false}
                              />
                              <Tooltip content={<TooltipContent />} cursor={{ stroke: 'rgba(0,0,0,0.1)' }} />
                              <ReferenceLine y={avgVal} stroke="#a3a3a3" strokeDasharray="4 4" ifOverflow="extendDomain" label={{ value: 'avg', position: 'right', fill: '#737373', fontSize: 11 }} />

                              <Area type="monotone" dataKey="uniqueVisitors" fill="url(#visitsAreaGrad)" stroke="none" animationDuration={600} />
                              <Line
                                type="monotone"
                                dataKey="uniqueVisitors"
                                stroke="url(#visitsLineGrad)"
                                strokeWidth={3}
                                dot={false}
                                activeDot={{ r: 5, strokeWidth: 2, stroke: '#111827', fill: '#ffffff' }}
                                animationDuration={700}
                              />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )
                  })()
                )}
              </CardContent>
            </Card>
            <div className="text-xs font-medium uppercase tracking-wide opacity-60 mt-6 mb-2">Quick Links</div>
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

