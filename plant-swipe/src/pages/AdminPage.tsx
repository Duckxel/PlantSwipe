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
import { RefreshCw, Server, Database, Github, ExternalLink, ShieldCheck, Mail, UserSearch, AlertTriangle, Gavel } from "lucide-react"
import { supabase } from '@/lib/supabaseClient'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'

export const AdminPage: React.FC = () => {

  const [syncing, setSyncing] = React.useState(false)
  
  const [backingUp, setBackingUp] = React.useState(false)

  const [restarting, setRestarting] = React.useState(false)
  const [pulling, setPulling] = React.useState(false)

  // Safely parse response body into JSON, tolerating HTML/error pages
  const safeJson = React.useCallback(async (resp: Response): Promise<any> => {
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
  }, [])

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

  // --- Health monitor: ping API, Admin, DB every minute ---
  type ProbeResult = {
    ok: boolean | null
    latencyMs: number | null
    updatedAt: number | null
    status: number | null
    errorCode: string | null
    errorMessage: string | null
  }
  const emptyProbe: ProbeResult = { ok: null, latencyMs: null, updatedAt: null, status: null, errorCode: null, errorMessage: null }
  const [apiProbe, setApiProbe] = React.useState<ProbeResult>(emptyProbe)
  const [adminProbe, setAdminProbe] = React.useState<ProbeResult>(emptyProbe)
  const [dbProbe, setDbProbe] = React.useState<ProbeResult>(emptyProbe)
  const [healthRefreshing, setHealthRefreshing] = React.useState<boolean>(false)

  // Track mount state to avoid setState on unmounted component during async probes
  const isMountedRef = React.useRef(true)
  React.useEffect(() => {
    return () => { isMountedRef.current = false }
  }, [])

  const probeEndpoint = React.useCallback(async (url: string, okCheck?: (body: any) => boolean): Promise<ProbeResult> => {
    const started = Date.now()
    try {
      const resp = await fetch(url, { headers: { 'Accept': 'application/json' }, credentials: 'same-origin' })
      const body = await safeJson(resp)
      const isOk = (typeof okCheck === 'function') ? (resp.ok && okCheck(body)) : (resp.ok && body?.ok === true)
      const latency = Date.now() - started
      if (isOk) {
        return { ok: true, latencyMs: latency, updatedAt: Date.now(), status: resp.status, errorCode: null, errorMessage: null }
      }
      // Derive error info when not ok
      const errorCodeFromBody = typeof body?.errorCode === 'string' && body.errorCode ? body.errorCode : null
      const errorMessageFromBody = typeof body?.error === 'string' && body.error ? body.error : null
      const fallbackCode = !resp.ok
        ? `HTTP_${resp.status}`
        : (errorCodeFromBody || 'CHECK_FAILED')
      return {
        ok: false,
        latencyMs: null,
        updatedAt: Date.now(),
        status: resp.status,
        errorCode: errorCodeFromBody || fallbackCode,
        errorMessage: errorMessageFromBody,
      }
    } catch {
      // Network/other failure
      return { ok: false, latencyMs: null, updatedAt: Date.now(), status: null, errorCode: 'NETWORK_ERROR', errorMessage: null }
    }
  }, [safeJson])

  const probeDbWithFallback = React.useCallback(async (): Promise<ProbeResult> => {
    const started = Date.now()
    try {
      // First try server DB health
      const resp = await fetch('/api/health/db', { headers: { 'Accept': 'application/json' }, credentials: 'same-origin' })
      const elapsedMs = Date.now() - started
      const body = await safeJson(resp)
      if (resp.ok && body?.ok === true) {
        return { ok: true, latencyMs: Number.isFinite(body?.latencyMs) ? body.latencyMs : elapsedMs, updatedAt: Date.now(), status: resp.status, errorCode: null, errorMessage: null }
      }
      // Not OK: derive error info
      const errorCodeFromBody = typeof body?.errorCode === 'string' && body.errorCode ? body.errorCode : null
      const errorMessageFromBody = typeof body?.error === 'string' && body.error ? body.error : null
      const fallbackCode = !resp.ok ? `HTTP_${resp.status}` : (errorCodeFromBody || 'CHECK_FAILED')
      // Fallback to client Supabase reachability
      const t2Start = Date.now()
      const { error } = await supabase.from('plants').select('id', { head: true, count: 'exact' }).limit(1)
      const t2 = Date.now() - t2Start
      if (!error) {
        return { ok: true, latencyMs: t2, updatedAt: Date.now(), status: null, errorCode: null, errorMessage: null }
      }
      return { ok: false, latencyMs: null, updatedAt: Date.now(), status: resp.status, errorCode: errorCodeFromBody || fallbackCode, errorMessage: errorMessageFromBody }
    } catch {
      try {
        // As a last resort, try an auth no-op which hits Supabase API
        await supabase.auth.getSession()
        return { ok: true, latencyMs: Date.now() - started, updatedAt: Date.now(), status: null, errorCode: null, errorMessage: null }
      } catch {
        return { ok: false, latencyMs: null, updatedAt: Date.now(), status: null, errorCode: 'NETWORK_ERROR', errorMessage: null }
      }
    }
  }, [safeJson])

  const runHealthProbes = React.useCallback(async () => {
    const [apiRes, adminRes, dbRes] = await Promise.all([
      probeEndpoint('/api/health', (b) => b?.ok === true),
      probeEndpoint('/api/admin/stats', (b) => b?.ok === true && typeof b?.profilesCount === 'number'),
      probeDbWithFallback(),
    ])
    if (isMountedRef.current) {
      setApiProbe(apiRes)
      setAdminProbe(adminRes)
      setDbProbe(dbRes)
    }
  }, [probeEndpoint, probeDbWithFallback])

  const refreshHealth = React.useCallback(async () => {
    if (healthRefreshing) return
    setHealthRefreshing(true)
    try {
      await runHealthProbes()
    } finally {
      if (isMountedRef.current) setHealthRefreshing(false)
    }
  }, [healthRefreshing, runHealthProbes])

  React.useEffect(() => {
    // Initial probe and auto-refresh every 60s
    runHealthProbes()
    const id = setInterval(runHealthProbes, 60_000)
    return () => clearInterval(id)
  }, [runHealthProbes])

  const StatusDot: React.FC<{ ok: boolean | null; title?: string }> = ({ ok, title }) => (
    <span
      className={
        `inline-block h-3 w-3 rounded-full ${ok === null ? 'bg-zinc-400' : ok ? 'bg-emerald-500' : 'bg-rose-500'}`
      }
      aria-label={ok === null ? 'unknown' : ok ? 'ok' : 'error'}
      title={title}
    />
  )

  const ErrorBadge: React.FC<{ code: string | null }> = ({ code }) => {
    if (!code) return null
    return (
      <span className="text-[11px] px-1.5 py-0.5 rounded border bg-rose-50 text-rose-700 border-rose-200">
        {code}
      </span>
    )
  }

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
      // Use visitors-stats endpoint to reflect "currently online" via recent uniques
      const resp = await fetch('/api/admin/visitors-stats', {
        headers: { 'Accept': 'application/json' },
        credentials: 'same-origin',
      })
      const data = await safeJson(resp)
      if (!resp.ok) {
        throw new Error(data?.error || `Request failed (${resp.status})`)
      }
      const num = Number(
        (data?.currentUniqueVisitors10m ??
        data?.uniqueIpsLast30m ??
        data?.uniqueIpsLast60m ??
        data?.onlineUsers)
      )
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

  // Auto-refresh visitors graph every 60 seconds
  React.useEffect(() => {
    const id = setInterval(() => {
      loadVisitorsStats({ initial: false })
    }, 60_000)
    return () => clearInterval(id)
  }, [loadVisitorsStats])

  // ---- Members tab state ----
  const [activeTab, setActiveTab] = React.useState<'overview' | 'members'>('overview')
  const [lookupEmail, setLookupEmail] = React.useState('')
  const [memberLoading, setMemberLoading] = React.useState(false)
  const [memberError, setMemberError] = React.useState<string | null>(null)
  const [memberData, setMemberData] = React.useState<{
    user: { id: string; email: string; created_at?: string } | null
    profile: any
    ips: string[]
    lastOnlineAt?: string | null
    lastIp?: string | null
    visitsCount?: number
    uniqueIpsCount?: number
    gardensOwned?: number
    gardensMember?: number
    gardensTotal?: number
    isBannedEmail?: boolean
    bannedReason?: string | null
    bannedAt?: string | null
    bannedIps?: string[]
  } | null>(null)
  const [banReason, setBanReason] = React.useState('')
  const [banSubmitting, setBanSubmitting] = React.useState(false)
  const [banOpen, setBanOpen] = React.useState(false)
  const [promoteOpen, setPromoteOpen] = React.useState(false)
  const [promoteSubmitting, setPromoteSubmitting] = React.useState(false)

  // Email autocomplete state
  const [emailSuggestions, setEmailSuggestions] = React.useState<Array<{ id: string; email: string }>>([])
  const [suggestionsOpen, setSuggestionsOpen] = React.useState(false)
  const [suggestLoading, setSuggestLoading] = React.useState(false)
  const [highlightIndex, setHighlightIndex] = React.useState<number>(-1)

  const lookupMember = React.useCallback(async () => {
    if (!lookupEmail || memberLoading) return
    setMemberLoading(true)
    setMemberError(null)
    setMemberData(null)
    try {
      const session = (await supabase.auth.getSession()).data.session
      const token = session?.access_token
      const url = `/api/admin/member?email=${encodeURIComponent(lookupEmail)}`
      const headers: Record<string,string> = { 'Accept': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`
      const resp = await fetch(url, { headers, credentials: 'same-origin' })
      const data = await safeJson(resp)
      if (!resp.ok) throw new Error(data?.error || `HTTP ${resp.status}`)
      setMemberData({
        user: data?.user || null,
        profile: data?.profile || null,
        ips: Array.isArray(data?.ips) ? data.ips : [],
        lastOnlineAt: data?.lastOnlineAt ?? null,
        lastIp: data?.lastIp ?? null,
        visitsCount: typeof data?.visitsCount === 'number' ? data.visitsCount : undefined,
        uniqueIpsCount: typeof data?.uniqueIpsCount === 'number' ? data.uniqueIpsCount : undefined,
        gardensOwned: typeof data?.gardensOwned === 'number' ? data.gardensOwned : undefined,
        gardensMember: typeof data?.gardensMember === 'number' ? data.gardensMember : undefined,
        gardensTotal: typeof data?.gardensTotal === 'number' ? data.gardensTotal : undefined,
        isBannedEmail: !!data?.isBannedEmail,
        bannedReason: data?.bannedReason ?? null,
        bannedAt: data?.bannedAt ?? null,
        bannedIps: Array.isArray(data?.bannedIps) ? data.bannedIps : [],
      })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setMemberError(msg || 'Lookup failed')
    } finally {
      setMemberLoading(false)
    }
  }, [lookupEmail, memberLoading, safeJson])

  const performBan = React.useCallback(async () => {
    if (!lookupEmail || banSubmitting) return
    setBanSubmitting(true)
    try {
      const session = (await supabase.auth.getSession()).data.session
      const token = session?.access_token
      const headers: Record<string,string> = { 'Content-Type': 'application/json', 'Accept': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`
      const resp = await fetch('/api/admin/ban', {
        method: 'POST',
        headers,
        credentials: 'same-origin',
        body: JSON.stringify({ email: lookupEmail, reason: banReason })
      })
      const data = await safeJson(resp)
      if (!resp.ok) throw new Error(data?.error || `HTTP ${resp.status}`)
      alert('User banned successfully')
      setBanReason('')
      setBanOpen(false)
      // Refresh lookup data to reflect deletion
      setMemberData(null)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      alert(`Ban failed: ${msg}`)
    } finally {
      setBanSubmitting(false)
    }
  }, [lookupEmail, banReason, banSubmitting, safeJson])

  const performPromote = React.useCallback(async () => {
    if (!lookupEmail || promoteSubmitting) return
    setPromoteSubmitting(true)
    try {
      const session = (await supabase.auth.getSession()).data.session
      const token = session?.access_token
      const headers: Record<string,string> = { 'Content-Type': 'application/json', 'Accept': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`
      const resp = await fetch('/api/admin/promote-admin', {
        method: 'POST',
        headers,
        credentials: 'same-origin',
        body: JSON.stringify({ email: lookupEmail })
      })
      const data = await safeJson(resp)
      if (!resp.ok) throw new Error(data?.error || `HTTP ${resp.status}`)
      alert('User promoted to admin successfully')
      setPromoteOpen(false)
      // Refresh profile info
      setMemberData((prev) => prev ? { ...prev, profile: { ...(prev.profile || {}), is_admin: true } } : prev)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      alert(`Promotion failed: ${msg}`)
    } finally {
      setPromoteSubmitting(false)
    }
  }, [lookupEmail, promoteSubmitting, safeJson])

  // Debounced email suggestions fetch
  React.useEffect(() => {
    let cancelled = false
    let timer: any = null
    const run = async () => {
      const q = lookupEmail.trim()
      if (q.length < 2) {
        setEmailSuggestions([])
        setSuggestionsOpen(false)
        setHighlightIndex(-1)
        return
      }
      setSuggestLoading(true)
      try {
        const token = (await supabase.auth.getSession()).data.session?.access_token
        const headers: Record<string,string> = { 'Accept': 'application/json' }
        if (token) headers['Authorization'] = `Bearer ${token}`
        const resp = await fetch(`/api/admin/member-suggest?q=${encodeURIComponent(q)}`, {
          headers,
          credentials: 'same-origin',
        })
        const data = await safeJson(resp)
        if (cancelled) return
        if (resp.ok && Array.isArray(data?.suggestions)) {
          setEmailSuggestions(data.suggestions.map((s: any) => ({ id: String(s.id), email: String(s.email) })))
          setSuggestionsOpen(true)
          setHighlightIndex(-1)
        } else {
          setEmailSuggestions([])
          setSuggestionsOpen(false)
          setHighlightIndex(-1)
        }
      } catch {
        if (!cancelled) {
          setEmailSuggestions([])
          setSuggestionsOpen(false)
          setHighlightIndex(-1)
        }
      } finally {
        if (!cancelled) setSuggestLoading(false)
      }
    }
    timer = setTimeout(run, 200)
    return () => { cancelled = true; if (timer) clearTimeout(timer) }
  }, [lookupEmail, safeJson])

  return (
    <div className="max-w-3xl mx-auto mt-8 px-4 md:px-0">
      <Card className="rounded-3xl">
        <CardContent className="p-6 md:p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-semibold tracking-tight">Admin Controls</div>
              <div className="text-sm opacity-60 mt-1">Admin actions: monitor and manage infrastructure.</div>
            </div>
            <div className="flex gap-2">
              <Button
                variant={activeTab === 'overview' ? 'default' : 'secondary'}
                className="rounded-2xl"
                onClick={() => setActiveTab('overview')}
              >Overview</Button>
              <Button
                variant={activeTab === 'members' ? 'default' : 'secondary'}
                className="rounded-2xl"
                onClick={() => setActiveTab('members')}
              >Members</Button>
            </div>
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
          <>
          {/* Health monitor */}
          <Card className="rounded-2xl">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Health monitor</div>
                  <div className="text-xs opacity-60">Auto‑ping every 60s</div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Refresh health"
                  onClick={refreshHealth}
                  disabled={healthRefreshing}
                  className="h-8 w-8"
                >
                  <RefreshCw className={`h-4 w-4 ${healthRefreshing ? 'animate-spin' : ''}`} />
                </Button>
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
                    <StatusDot ok={apiProbe.ok} title={!apiProbe.ok ? (apiProbe.errorCode || undefined) : undefined} />
                    {!apiProbe?.ok && <ErrorBadge code={apiProbe.errorCode} />}
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
                    <StatusDot ok={adminProbe.ok} title={!adminProbe.ok ? (adminProbe.errorCode || undefined) : undefined} />
                    {!adminProbe?.ok && <ErrorBadge code={adminProbe.errorCode} />}
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
                    <StatusDot ok={dbProbe.ok} title={!dbProbe.ok ? (dbProbe.errorCode || undefined) : undefined} />
                    {!dbProbe?.ok && <ErrorBadge code={dbProbe.errorCode} />}
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
                              margin={{ top: 10, right: 16, bottom: 14, left: 16 }}
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
                                padding={{ left: 12, right: 12 }}
                              />
                              <YAxis
                                allowDecimals={false}
                                domain={[0, Math.max(maxVal, 5)]}
                                tick={{ fontSize: 11, fill: '#525252' }}
                                axisLine={false}
                                tickLine={false}
                              />
                              <Tooltip content={<TooltipContent />} cursor={{ stroke: 'rgba(0,0,0,0.1)' }} />
                              <ReferenceLine
                                y={avgVal}
                                stroke="#a3a3a3"
                                strokeDasharray="4 4"
                                ifOverflow="extendDomain"
                                label={{ value: 'avg', position: 'insideRight', fill: '#737373', fontSize: 11, dx: -6 }}
                              />

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
          </>
          )}

          {/* Members Tab */}
          {activeTab === 'members' && (
            <div className="space-y-4">
              <Card className="rounded-2xl">
                <CardContent className="p-4 space-y-3">
                  <div className="text-sm font-medium flex items-center gap-2"><UserSearch className="h-4 w-4" /> Find member by email</div>
                  <div className="flex gap-2 relative">
                    <div className="flex-1 relative">
                      <input
                        className="w-full px-3 py-2 rounded-xl border"
                        placeholder="user@example.com"
                        value={lookupEmail}
                        onChange={(e) => setLookupEmail(e.target.value)}
                        onFocus={() => { if (emailSuggestions.length > 0) setSuggestionsOpen(true) }}
                        onBlur={() => setTimeout(() => setSuggestionsOpen(false), 120)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (suggestionsOpen && emailSuggestions.length > 0 && highlightIndex >= 0 && highlightIndex < emailSuggestions.length) {
                              e.preventDefault()
                              const chosen = emailSuggestions[highlightIndex]
                              setLookupEmail(chosen.email)
                              setSuggestionsOpen(false)
                            } else {
                              // Trigger lookup when pressing Enter with no suggestion selected
                              e.preventDefault()
                              lookupMember()
                            }
                            return
                          }
                          if (!suggestionsOpen || emailSuggestions.length === 0) return
                          if (e.key === 'ArrowDown') {
                            e.preventDefault()
                            setHighlightIndex((prev) => (prev + 1) % emailSuggestions.length)
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault()
                            setHighlightIndex((prev) => (prev - 1 + emailSuggestions.length) % emailSuggestions.length)
                          }
                        }}
                      />
                      {suggestionsOpen && emailSuggestions.length > 0 && (
                        <div className="absolute z-10 mt-1 w-full rounded-xl border bg-white shadow">
                          {emailSuggestions.map((s, idx) => (
                            <button
                              key={s.id}
                              type="button"
                              className={`w-full text-left px-3 py-2 text-sm rounded-xl ${idx === highlightIndex ? 'bg-neutral-100' : ''}`}
                              onMouseEnter={() => setHighlightIndex(idx)}
                              onMouseDown={(e) => {
                                e.preventDefault()
                                setLookupEmail(s.email)
                                setSuggestionsOpen(false)
                              }}
                            >
                              {s.email}
                            </button>
                          ))}
                          {suggestLoading && (
                            <div className="px-3 py-2 text-xs opacity-60">Loading…</div>
                          )}
                        </div>
                      )}
                    </div>
                    <Button className="rounded-2xl" onClick={lookupMember} disabled={memberLoading || !lookupEmail}>
                      <Mail className="h-4 w-4" /> Lookup
                    </Button>
                  </div>
                  {memberError && <div className="text-sm text-rose-600">{memberError}</div>}
                  {memberLoading && <div className="text-sm opacity-60">Looking up…</div>}
                  {memberData && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium opacity-70">Member profile</div>
                        <Dialog open={banOpen} onOpenChange={setBanOpen}>
                          <DialogTrigger asChild>
                            <Button
                              variant="destructive"
                              size="icon"
                              className="rounded-xl"
                              title="Ban user"
                              aria-label="Ban user"
                              disabled={!lookupEmail}
                            >
                              <Gavel className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Ban {lookupEmail || 'user'}</DialogTitle>
                              <DialogDescription>
                                This will delete the account and ban all known IPs for this user.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-2 mt-2">
                              <label className="text-xs opacity-60">Reason</label>
                              <textarea
                                className="min-h-[80px] px-3 py-2 rounded-xl border"
                                placeholder="Reason for ban"
                                value={banReason}
                                onChange={(e) => setBanReason(e.target.value)}
                              />
                            </div>
                            <DialogFooter>
                              <DialogClose asChild>
                                <Button variant="secondary">Cancel</Button>
                              </DialogClose>
                              <Button
                                variant="destructive"
                                onClick={performBan}
                                disabled={!lookupEmail || banSubmitting}
                              >
                                {banSubmitting ? 'Banning…' : 'Confirm ban'}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        <Dialog open={promoteOpen} onOpenChange={setPromoteOpen}>
                          <DialogTrigger asChild>
                            <Button
                              variant="secondary"
                              size="icon"
                              className="rounded-xl ml-2"
                              title="Promote to admin"
                              aria-label="Promote to admin"
                              disabled={!lookupEmail}
                            >
                              <ShieldCheck className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Promote {lookupEmail || 'user'} to Admin</DialogTitle>
                              <DialogDescription>
                                This grants full administrative privileges. Are you sure?
                              </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                              <DialogClose asChild>
                                <Button variant="secondary">Cancel</Button>
                              </DialogClose>
                              <Button
                                onClick={performPromote}
                                disabled={!lookupEmail || promoteSubmitting}
                              >
                                {promoteSubmitting ? 'Promoting…' : 'Confirm promote'}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                      <div className="text-sm">User: <span className="font-medium">{memberData.user?.email || '—'}</span>{memberData.user?.id ? (<span className="opacity-60"> · id {memberData.user.id}</span>) : null}</div>
                      <div className="text-sm">Admin: <span className="font-medium">{memberData.profile?.is_admin ? 'Yes' : 'No'}</span></div>
                      <div className="text-sm">Display name: <span className="font-medium">{memberData.profile?.display_name || '—'}</span></div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="text-sm">Last online: <span className="font-medium">{memberData.lastOnlineAt ? new Date(memberData.lastOnlineAt).toLocaleString() : '—'}</span></div>
                        <div className="text-sm">Last IP: <span className="font-medium">{memberData.lastIp || '—'}</span></div>
                        <div className="text-sm">Visits: <span className="font-medium tabular-nums">{memberData.visitsCount ?? '—'}</span></div>
                        <div className="text-sm">Unique IPs: <span className="font-medium tabular-nums">{memberData.uniqueIpsCount ?? '—'}</span></div>
                        <div className="text-sm">Gardens owned: <span className="font-medium tabular-nums">{memberData.gardensOwned ?? '—'}</span></div>
                        <div className="text-sm">Member of gardens: <span className="font-medium tabular-nums">{memberData.gardensMember ?? '—'}</span></div>
                        <div className="text-sm">Total gardens: <span className="font-medium tabular-nums">{memberData.gardensTotal ?? '—'}</span></div>
                      </div>
                      <div className="text-sm">Known IPs ({memberData.ips.length}):
                        <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-1">
                          {memberData.ips.map((ip) => (
                            <div key={ip} className="text-xs px-2 py-1 rounded-lg border bg-white">{ip}</div>
                          ))}
                          {memberData.ips.length === 0 && <div className="text-xs opacity-60">No IPs recorded</div>}
                        </div>
                      </div>
                      {(memberData.isBannedEmail || (memberData.bannedIps && memberData.bannedIps.length > 0)) && (
                        <div className="rounded-xl border p-3 bg-rose-50/60">
                          <div className="text-sm font-medium text-rose-700 flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Banned</div>
                          {memberData.isBannedEmail && (
                            <div className="text-sm mt-1">Email banned {memberData.bannedAt ? `on ${new Date(memberData.bannedAt).toLocaleString()}` : ''}{memberData.bannedReason ? ` — ${memberData.bannedReason}` : ''}</div>
                          )}
                          {memberData.bannedIps && memberData.bannedIps.length > 0 && (
                            <div className="text-sm mt-1">Blocked IPs:
                              <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-1">
                                {memberData.bannedIps.map(ip => (
                                  <div key={ip} className="text-xs px-2 py-1 rounded-lg border bg-white">{ip}</div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Ban action moved into member card header via hammer button */}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  )
}

export default AdminPage

