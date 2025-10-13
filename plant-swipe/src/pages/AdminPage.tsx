import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { RefreshCw, Server, Database, Github, ExternalLink, ShieldCheck, ShieldX, UserSearch, AlertTriangle, Gavel, Search, ChevronDown, GitBranch } from "lucide-react"
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
  const countryCodeToName = React.useCallback((code: string): string => {
    try {
      const c = String(code || '').toUpperCase()
      if (!c) return ''
      if ((Intl as any)?.DisplayNames) {
        try {
          const dn = new (Intl as any).DisplayNames([navigator.language || 'en'], { type: 'region' })
          const name = dn.of(c)
          return name || c
        } catch {}
      }
      return c
    } catch { return code }
  }, [])

  const [syncing, setSyncing] = React.useState(false)
  
  // Backup disabled for now

  const [restarting, setRestarting] = React.useState(false)
  const [pulling, setPulling] = React.useState(false)
  const [consoleOpen, setConsoleOpen] = React.useState<boolean>(false)
  const [consoleLines, setConsoleLines] = React.useState<string[]>([])
  const [reloadReady, setReloadReady] = React.useState<boolean>(false)
  const consoleRef = React.useRef<HTMLDivElement | null>(null)
  React.useEffect(() => {
    if (!consoleOpen) return
    const el = consoleRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [consoleLines, consoleOpen])

  const copyTextToClipboard = React.useCallback(async (text: string): Promise<boolean> => {
    try {
      if (navigator && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(text)
        return true
      }
    } catch {}
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.focus()
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }, [])

  const getAllLogsText = React.useCallback((): string => {
    return consoleLines.join('\n')
  }, [consoleLines])

  const getErrorLinesText = React.useCallback((): string => {
    const rx = /(^|\b)(err|error|failed|failure|exception|traceback|fatal|npm\s+err!|^npm\s+err)/i
    const lines = consoleLines.filter(l => rx.test(l))
    return lines.length > 0 ? lines.join('\n') : 'No error-like lines detected.'
  }, [consoleLines])

  const appendConsole = React.useCallback((line: string) => {
    setConsoleLines(prev => [...prev, line])
  }, [])

  const reloadPage = React.useCallback(() => {
    try { window.location.reload() } catch {}
  }, [])

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
      setConsoleOpen(true)
      appendConsole('[sync] Sync DB Schema: starting…')
      const session = (await supabase.auth.getSession()).data.session
      const token = session?.access_token
      if (!token) {
        appendConsole('[sync] You must be signed in to run schema sync')
        return
      }
      // Try Node API first
      let resp = await fetch('/api/admin/sync-schema', {
        method: 'GET',
        headers: (() => {
          const h: Record<string, string> = { 'Accept': 'application/json' }
          if (token) h['Authorization'] = `Bearer ${token}`
          const adminToken = (globalThis as any)?.__ENV__?.VITE_ADMIN_STATIC_TOKEN
          if (adminToken) h['X-Admin-Token'] = String(adminToken)
          return h
        })(),
        credentials: 'same-origin',
      })
      if (resp.status === 405) {
        // Try POST on Node if GET blocked
        resp = await fetch('/api/admin/sync-schema', {
          method: 'POST',
          headers: (() => {
            const h: Record<string, string> = { 'Content-Type': 'application/json', 'Accept': 'application/json' }
            if (token) h['Authorization'] = `Bearer ${token}`
            const adminToken = (globalThis as any)?.__ENV__?.VITE_ADMIN_STATIC_TOKEN
            if (adminToken) h['X-Admin-Token'] = String(adminToken)
            return h
          })(),
          credentials: 'same-origin',
        })
      }
      // If Node API failed, fallback to local Admin API proxied by nginx
      if (!resp.ok) {
        const adminHeaders: Record<string, string> = { 'Accept': 'application/json' }
        try { const adminToken = (globalThis as any)?.__ENV__?.VITE_ADMIN_STATIC_TOKEN; if (adminToken) adminHeaders['X-Admin-Token'] = String(adminToken) } catch {}
        let respAdmin = await fetch('/admin/sync-schema', { method: 'GET', headers: adminHeaders, credentials: 'same-origin' })
        if (respAdmin.status === 405) {
          respAdmin = await fetch('/admin/sync-schema', { method: 'POST', headers: { ...adminHeaders, 'Content-Type': 'application/json' }, credentials: 'same-origin', body: '{}' })
        }
        resp = respAdmin
      }
      const body = await safeJson(resp)
      if (!resp.ok) {
        throw new Error(body?.error || `Request failed (${resp.status})`)
      }
      appendConsole('[sync] Schema synchronized successfully')
      const summary = body?.summary
      if (summary && typeof summary === 'object') {
        try {
          const missingTables: string[] = Array.isArray(summary?.tables?.missing) ? summary.tables.missing : []
          const missingFunctions: string[] = Array.isArray(summary?.functions?.missing) ? summary.functions.missing : []
          const missingExtensions: string[] = Array.isArray(summary?.extensions?.missing) ? summary.extensions.missing : []
          const hasMissing = missingTables.length + missingFunctions.length + missingExtensions.length > 0
          appendConsole('[sync] Post‑sync verification:')
          appendConsole(`- Tables OK: ${(summary?.tables?.present || []).length}/${(summary?.tables?.required || []).length}`)
          appendConsole(`- Functions OK: ${(summary?.functions?.present || []).length}/${(summary?.functions?.required || []).length}`)
          appendConsole(`- Extensions OK: ${(summary?.extensions?.present || []).length}/${(summary?.extensions?.required || []).length}`)
          if (hasMissing) {
            if (missingTables.length) appendConsole(`- Missing tables: ${missingTables.join(', ')}`)
            if (missingFunctions.length) appendConsole(`- Missing functions: ${missingFunctions.join(', ')}`)
            if (missingExtensions.length) appendConsole(`- Missing extensions: ${missingExtensions.join(', ')}`)
          } else {
            appendConsole('- All required objects present')
          }
        } catch {}
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      appendConsole(`[sync] Failed to sync schema: ${message}`)
    } finally {
      setSyncing(false)
    }
  }

  const restartServer = async () => {
    if (restarting) return
    setRestarting(true)
    try {
      setConsoleOpen(true)
      appendConsole('[restart] Restart requested…')
      setReloadReady(false)
      const session = (await supabase.auth.getSession()).data.session
      const token = session?.access_token
      if (!token) {
        appendConsole('[restart] You must be signed in to restart the server')
        return
      }
      // First attempt: restart via Node API (preserves Authorization)
      const nodeHeaders = (() => {
        const h: Record<string, string> = { 'Accept': 'application/json' }
        if (token) h['Authorization'] = `Bearer ${token}`
        const adminToken = (globalThis as any)?.__ENV__?.VITE_ADMIN_STATIC_TOKEN
        if (adminToken) h['X-Admin-Token'] = String(adminToken)
        return h
      })()
      const nodePostHeaders = { ...nodeHeaders, 'Content-Type': 'application/json' }

      let nodeResp: Response | null = null
      try {
        nodeResp = await fetch('/api/admin/restart-server', {
          method: 'POST',
          headers: nodePostHeaders,
          credentials: 'same-origin',
          body: '{}',
        })
      } catch {}
      if (nodeResp && nodeResp.status === 405) {
        try {
          nodeResp = await fetch('/api/admin/restart-server', {
            method: 'GET',
            headers: nodeHeaders,
            credentials: 'same-origin',
          })
        } catch {}
      }

      let ok = false
      let nodeErrorMsg = 'Restart request failed'
      if (nodeResp) {
        const b = await safeJson(nodeResp)
        ok = nodeResp.ok && (b?.ok === true)
        if (!ok) nodeErrorMsg = b?.error || `Request failed (${nodeResp.status})`
      }

      // Fallback: call local Admin API via nginx if Node endpoint not reachable/forbidden
      if (!ok) {
        const adminToken = (globalThis as any)?.__ENV__?.VITE_ADMIN_STATIC_TOKEN
        if (adminToken) {
          const adminHeaders: Record<string, string> = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Admin-Token': String(adminToken),
          }
          // Service name defaults server-side; send explicit as a hint
          const adminResp = await fetch('/admin/restart-app', {
            method: 'POST',
            headers: adminHeaders,
            credentials: 'same-origin',
            body: JSON.stringify({ service: 'plant-swipe-node' }),
          })
          const ab = await safeJson(adminResp)
          if (!adminResp.ok || ab?.ok !== true) {
            throw new Error(ab?.error || `Admin restart failed (${adminResp.status})`)
          }
        } else {
          throw new Error(nodeErrorMsg)
        }
      }

      // Wait for API to come back healthy to avoid 502s; do NOT auto-reload
      const deadline = Date.now() + 30_000
      let healthy = false
      while (Date.now() < deadline) {
        try {
          const r = await fetch('/api/health', { headers: { 'Accept': 'application/json' }, credentials: 'same-origin' })
          const b = await safeJson(r)
          if (r.ok && (b?.ok === true)) { healthy = true; break }
        } catch {}
        await new Promise(res => setTimeout(res, 1000))
      }
      if (healthy) {
        appendConsole('[restart] Server healthy. You can reload the page when ready.')
      } else {
        appendConsole('[restart] Timed out waiting for server health. You may try reloading manually.')
      }
      setReloadReady(true)

    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      appendConsole(`[restart] Failed to restart server: ${message}`)
    } finally {
      setRestarting(false)
    }
  }

  const [onlineUsers, setOnlineUsers] = React.useState<number>(0)
  const [registeredCount, setRegisteredCount] = React.useState<number | null>(null)
  const [registeredLoading, setRegisteredLoading] = React.useState<boolean>(true)
  const [registeredRefreshing, setRegisteredRefreshing] = React.useState<boolean>(false)
  const [registeredUpdatedAt, setRegisteredUpdatedAt] = React.useState<number | null>(null)
  const [onlineLoading, setOnlineLoading] = React.useState<boolean>(true)
  const [onlineRefreshing, setOnlineRefreshing] = React.useState<boolean>(false)
  const [onlineUpdatedAt, setOnlineUpdatedAt] = React.useState<number | null>(null)
  const [visitorsLoading, setVisitorsLoading] = React.useState<boolean>(true)
  const [visitorsRefreshing, setVisitorsRefreshing] = React.useState<boolean>(false)
  const [visitorsUpdatedAt, setVisitorsUpdatedAt] = React.useState<number | null>(null)
  const [visitorsSeries, setVisitorsSeries] = React.useState<Array<{ date: string; uniqueVisitors: number }>>([])
  const [visitorsTotalUnique7d, setVisitorsTotalUnique7d] = React.useState<number>(0)
  const [topCountries, setTopCountries] = React.useState<Array<{ country: string; visits: number; pct?: number }>>([])
  const [otherCountries, setOtherCountries] = React.useState<{ count: number; visits: number; pct?: number } | null>(null)
  const [topReferrers, setTopReferrers] = React.useState<Array<{ source: string; visits: number; pct?: number }>>([])
  const [otherReferrers, setOtherReferrers] = React.useState<{ count: number; visits: number; pct?: number } | null>(null)
  // Distinct, high-contrast palette for readability
  const countryColors = ['#10b981','#3b82f6','#ef4444','#f59e0b','#8b5cf6','#14b8a6','#6366f1','#d946ef','#06b6d4','#84cc16','#fb7185','#f97316']
  const referrerColors = ['#111827','#3b82f6','#ef4444','#10b981','#f59e0b','#8b5cf6']
  // Connected IPs (last 60 minutes)
  const [ips, setIps] = React.useState<string[]>([])
  const [ipsLoading, setIpsLoading] = React.useState<boolean>(true)
  const [ipsRefreshing, setIpsRefreshing] = React.useState<boolean>(false)
  const [ipsOpen, setIpsOpen] = React.useState<boolean>(false)
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

  // Presence fallback removed by request: rely on DB-backed API only

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
      const headers: Record<string, string> = { 'Accept': 'application/json' }
      try {
        const token = (await supabase.auth.getSession()).data.session?.access_token
        if (token) headers['Authorization'] = `Bearer ${token}`
        const staticToken = (globalThis as any)?.__ENV__?.VITE_ADMIN_STATIC_TOKEN
        if (staticToken) headers['X-Admin-Token'] = staticToken
      } catch {}
      const resp = await fetch(url, { headers, credentials: 'same-origin' })
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

  

  // ---- Branch management state ----
  const [branchesLoading, setBranchesLoading] = React.useState<boolean>(true)
  const [branchesRefreshing, setBranchesRefreshing] = React.useState<boolean>(false)
  const [branchOptions, setBranchOptions] = React.useState<string[]>([])
  const [currentBranch, setCurrentBranch] = React.useState<string>("")
  const [selectedBranch, setSelectedBranch] = React.useState<string>("")

  const loadBranches = React.useCallback(async (opts?: { initial?: boolean }) => {
    const isInitial = !!opts?.initial
    if (isInitial) setBranchesLoading(true)
    else setBranchesRefreshing(true)
    try {
      const headersNode: Record<string, string> = { 'Accept': 'application/json' }
      try {
        const session = (await supabase.auth.getSession()).data.session
        const token = session?.access_token
        if (token) headersNode['Authorization'] = `Bearer ${token}`
      } catch {}
      const respNode = await fetch('/api/admin/branches', { headers: headersNode, credentials: 'same-origin' })
      let data = await safeJson(respNode)
      // Guard against accidental inclusion of non-branch items
      if (Array.isArray(data?.branches)) {
        data.branches = data.branches.filter((b: string) => b && b !== 'origin' && b !== 'HEAD')
      }
      let ok = respNode.ok && Array.isArray(data?.branches)
      if (!ok) {
        const adminHeaders: Record<string, string> = { 'Accept': 'application/json' }
        try {
          const adminToken = (globalThis as any)?.__ENV__?.VITE_ADMIN_STATIC_TOKEN
          if (adminToken) adminHeaders['X-Admin-Token'] = String(adminToken)
        } catch {}
        const respAdmin = await fetch('/admin/branches', { headers: adminHeaders, credentials: 'same-origin' })
        data = await safeJson(respAdmin)
        if (Array.isArray(data?.branches)) {
          data.branches = data.branches.filter((b: string) => b && b !== 'origin' && b !== 'HEAD')
        }
        if (!respAdmin.ok || !Array.isArray(data?.branches)) throw new Error(data?.error || `HTTP ${respAdmin.status}`)
      }
      const branches: string[] = data.branches
      const current: string = String(data.current || '')
      setBranchOptions(branches)
      setCurrentBranch(current)
      setSelectedBranch((prev) => {
        if (!prev) return current
        return branches.includes(prev) ? prev : current
      })
    } catch {
      if (isInitial) {
        setBranchOptions([])
        setCurrentBranch('')
        setSelectedBranch('')
      }
    } finally {
      if (isInitial) setBranchesLoading(false)
      else setBranchesRefreshing(false)
    }
  }, [safeJson])

  React.useEffect(() => {
    loadBranches({ initial: true })
  }, [loadBranches])

  const pullLatest = async () => {
    if (pulling) return
    setPulling(true)
    try {
      // Use streaming endpoint for live logs
      setConsoleLines([])
      setConsoleOpen(true)
      appendConsole('[pull] Pull & Build: starting…')
      if (selectedBranch && selectedBranch !== currentBranch) {
        appendConsole(`[pull] Will switch to branch: ${selectedBranch}`)
      } else if (currentBranch) {
        appendConsole(`[pull] Staying on branch: ${currentBranch}`)
      }
      setReloadReady(false)
      const session = (await supabase.auth.getSession()).data.session
      const token = session?.access_token
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`
      try {
        const adminToken = (globalThis as any)?.__ENV__?.VITE_ADMIN_STATIC_TOKEN
        if (adminToken) headers['X-Admin-Token'] = String(adminToken)
      } catch {}
      const branchParam = (selectedBranch && selectedBranch !== currentBranch) ? `?branch=${encodeURIComponent(selectedBranch)}` : ''
      let resp: Response | null = null
      // Try Node server SSE first
      try {
        resp = await fetch(`/api/admin/pull-code/stream${branchParam}`, {
          method: 'GET',
          headers,
          credentials: 'same-origin',
        })
      } catch {}
      // Fallback to Admin API SSE if Node is down or forbidden
      if (!resp || !resp.ok || !resp.body) {
        const adminHeaders: Record<string, string> = {}
        try {
          const adminToken = (globalThis as any)?.__ENV__?.VITE_ADMIN_STATIC_TOKEN
          if (adminToken) adminHeaders['X-Admin-Token'] = String(adminToken)
        } catch {}
        try {
          resp = await fetch(`/admin/pull-code/stream${branchParam}`, {
            method: 'GET',
            headers: adminHeaders,
            credentials: 'same-origin',
          })
        } catch {}
      }
      if (!resp || !resp.ok || !resp.body) {
        // Last resort: fire-and-forget refresh via Admin API without stream
        const adminHeadersBg: Record<string, string> = { 'Content-Type': 'application/json', 'Accept': 'application/json' }
        try {
          const adminToken = (globalThis as any)?.__ENV__?.VITE_ADMIN_STATIC_TOKEN
          if (adminToken) adminHeadersBg['X-Admin-Token'] = String(adminToken)
        } catch {}
        const bg = await fetch(`/admin/pull-code${branchParam}`, { method: 'POST', headers: adminHeadersBg, credentials: 'same-origin', body: '{}' })
        const bgBody = await safeJson(bg)
        if (!bg.ok || bgBody?.ok !== true) {
          throw new Error(bgBody?.error || `Refresh failed (${bg.status})`)
        }
        appendConsole('[pull] Started background refresh via Admin API.')
        // Skip SSE consumption
      } else {
        const reader = resp.body.getReader()
        const decoder = new TextDecoder()
        let buf = ''
        const append = (line: string) => appendConsole(line)
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          let idx
          while ((idx = buf.indexOf('\n')) >= 0) {
            const raw = buf.slice(0, idx)
            buf = buf.slice(idx + 1)
            const line = raw.replace(/\r$/, '')
            if (!line) continue
            if (line.startsWith('data:')) {
              const payload = line.slice(5).trimStart()
              append(payload)
            } else if (!/^(:|event:|id:|retry:)/.test(line)) {
              append(line)
            }
          }
        }
      }

      // Ensure both Admin API and Node API are restarted after build
      try {
        const adminToken = (globalThis as any)?.__ENV__?.VITE_ADMIN_STATIC_TOKEN
        if (adminToken) {
          await fetch('/admin/restart-app', {
            method: 'POST',
            headers: { 'X-Admin-Token': String(adminToken), 'Content-Type': 'application/json', 'Accept': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ service: 'admin-api' })
          }).catch(() => {})
        }
      } catch {}
      // Then restart the Node service via our API (includes health poll)
      try { await restartServer() } catch {}
      try { await loadBranches({ initial: false }) } catch {}
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      appendConsole(`[pull] Failed to pull & build: ${message}`)
    } finally {
      setPulling(false)
    }
  }

  // Backup UI disabled for now


  // Loader for total registered accounts (DB first via admin API; fallback to client count)
  const loadRegisteredCount = React.useCallback(async (opts?: { initial?: boolean }) => {
    const isInitial = !!opts?.initial
    if (isInitial) setRegisteredLoading(true)
    else setRegisteredRefreshing(true)
    try {
      const session = (await supabase.auth.getSession()).data.session
      const token = session?.access_token
      const headers: Record<string, string> = { 'Accept': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`
      try {
        const adminToken = (globalThis as any)?.__ENV__?.VITE_ADMIN_STATIC_TOKEN
        if (adminToken) headers['X-Admin-Token'] = String(adminToken)
      } catch {}
      const resp = await fetch('/api/admin/stats', { headers, credentials: 'same-origin' })
      const data = await safeJson(resp)
      if (resp.ok && typeof data?.profilesCount === 'number') {
        setRegisteredCount(data.profilesCount)
        setRegisteredUpdatedAt(Date.now())
        return
      }
      // Fallback: client-side count (may be limited by RLS)
      const { count, error } = await supabase.from('profiles').select('id', { count: 'exact', head: true })
      setRegisteredCount(error ? null : (count ?? 0))
      setRegisteredUpdatedAt(Date.now())
    } catch {
      try {
        const { count, error } = await supabase.from('profiles').select('id', { count: 'exact', head: true })
        setRegisteredCount(error ? null : (count ?? 0))
        setRegisteredUpdatedAt(Date.now())
      } catch {}
    } finally {
      if (isInitial) setRegisteredLoading(false)
      else setRegisteredRefreshing(false)
    }
  }, [safeJson])

  React.useEffect(() => {
    loadRegisteredCount({ initial: true })
  }, [loadRegisteredCount])

  // Auto-refresh registered accounts every 60 seconds
  React.useEffect(() => {
    const id = setInterval(() => { loadRegisteredCount({ initial: false }) }, 60_000)
    return () => clearInterval(id)
  }, [loadRegisteredCount])


  // Loader for "Currently online" (unique IPs in the last 60 minutes, DB-only)
  const loadOnlineUsers = React.useCallback(async (opts?: { initial?: boolean }) => {
    const isInitial = !!opts?.initial
    if (isInitial) setOnlineLoading(true)
    else setOnlineRefreshing(true)
    try {
      // Use dedicated endpoint backed by DB counts; forward Authorization so REST fallback can pass RLS
      const token = (await supabase.auth.getSession()).data.session?.access_token
      const resp = await fetch('/api/admin/online-users', {
        headers: (() => {
          const h: Record<string, string> = { 'Accept': 'application/json' }
          if (token) h['Authorization'] = `Bearer ${token}`
          const adminToken = (globalThis as any)?.__ENV__?.VITE_ADMIN_STATIC_TOKEN
          if (adminToken) h['X-Admin-Token'] = String(adminToken)
          return h
        })(),
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
      // Keep last known value on error
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

  // Loader for list of connected IPs (unique IPs past N minutes; default 60)
  const loadOnlineIpsList = React.useCallback(async (opts?: { initial?: boolean; minutes?: number }) => {
    const isInitial = !!opts?.initial
    const minutes = Number.isFinite(opts?.minutes as number) && (opts?.minutes as number)! > 0 ? Math.floor(opts!.minutes as number) : 60
    if (isInitial) setIpsLoading(true)
    else setIpsRefreshing(true)
    try {
      const session = (await supabase.auth.getSession()).data.session
      const token = session?.access_token
      const headers: Record<string, string> = { 'Accept': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`
      try {
        const adminToken = (globalThis as any)?.__ENV__?.VITE_ADMIN_STATIC_TOKEN
        if (adminToken) headers['X-Admin-Token'] = String(adminToken)
      } catch {}
      const resp = await fetch(`/api/admin/online-ips?minutes=${encodeURIComponent(String(minutes))}` , { headers, credentials: 'same-origin' })
      const data = await safeJson(resp)
      if (!resp.ok) throw new Error(data?.error || `HTTP ${resp.status}`)
      const list: string[] = Array.isArray(data?.ips) ? data.ips.map((s: any) => String(s)).filter(Boolean) : []
      setIps(list)
    } catch {
      // keep last
    } finally {
      if (isInitial) setIpsLoading(false)
      else setIpsRefreshing(false)
    }
  }, [safeJson])

  // Initial load and auto-refresh every 60s
  React.useEffect(() => {
    loadOnlineIpsList({ initial: true })
  }, [loadOnlineIpsList])
  React.useEffect(() => {
    const id = setInterval(() => { loadOnlineIpsList({ initial: false }) }, 60_000)
    return () => clearInterval(id)
  }, [loadOnlineIpsList])

  // Load visitors stats (last 7 days)
  const [visitorsWindowDays, setVisitorsWindowDays] = React.useState<7 | 30>(7)
  const loadVisitorsStats = React.useCallback(async (opts?: { initial?: boolean }) => {
    const isInitial = !!opts?.initial
    if (isInitial) setVisitorsLoading(true)
    else setVisitorsRefreshing(true)
    try {
      const resp = await fetch(`/api/admin/visitors-stats?days=${visitorsWindowDays}`, {
        headers: { 'Accept': 'application/json' },
        credentials: 'same-origin',
      })
      const data = await safeJson(resp)
      if (!resp.ok) throw new Error(data?.error || `Request failed (${resp.status})`)
      const series: Array<{ date: string; uniqueVisitors: number }> = Array.isArray(data?.series7d)
        ? data.series7d.map((d: any) => ({ date: String(d.date), uniqueVisitors: Number(d.uniqueVisitors ?? d.unique_visitors ?? 0) }))
        : []
      setVisitorsSeries(series)
      // Fetch weekly unique total from dedicated endpoint to keep requests separate
      try {
        const totalResp = await fetch('/api/admin/visitors-unique-7d', {
          headers: { 'Accept': 'application/json' },
          credentials: 'same-origin',
        })
        const totalData = await safeJson(totalResp)
        if (totalResp.ok) {
          const total7d = Number(totalData?.uniqueIps7d ?? totalData?.weeklyUniqueIps7d ?? 0)
          setVisitorsTotalUnique7d(Number.isFinite(total7d) ? total7d : 0)
        }
      } catch {}
      // Load sources breakdown in parallel
      try {
        const sb = await fetch(`/api/admin/sources-breakdown?days=${visitorsWindowDays}`, { headers: { 'Accept': 'application/json' }, credentials: 'same-origin' })
        const sbd = await safeJson(sb)
        if (sb.ok) {
          const tc = Array.isArray(sbd?.topCountries)
            ? sbd.topCountries.map((r: { country?: string; visits?: number }) => ({ country: String(r.country || ''), visits: Number(r.visits || 0) }))
                .filter((x: { country: string }) => !!x.country)
            : []
          const oc = sbd?.otherCountries && typeof sbd.otherCountries === 'object' ? { count: Number(sbd.otherCountries.count || 0), visits: Number(sbd.otherCountries.visits || 0) } : null
          const totalCountryVisits = tc.reduce((a: number, b: any) => a + (b.visits || 0), 0) + (oc?.visits || 0)
          const countriesWithPct = totalCountryVisits > 0
            ? tc.map((x: { country: string; visits: number }) => ({ ...x, pct: (x.visits / totalCountryVisits) * 100 }))
            : tc.map((x: { country: string; visits: number }) => ({ ...x, pct: 0 }))
          const ocWithPct = oc ? { ...oc, pct: totalCountryVisits > 0 ? (oc.visits / totalCountryVisits) * 100 : 0 } : null

          const tr = Array.isArray(sbd?.topReferrers) ? sbd.topReferrers.map((r: { source?: string; visits?: number }) => ({ source: String(r.source || 'direct'), visits: Number(r.visits || 0) })) : []
          const orf = sbd?.otherReferrers && typeof sbd.otherReferrers === 'object' ? { count: Number(sbd.otherReferrers.count || 0), visits: Number(sbd.otherReferrers.visits || 0) } : null
          const totalRefVisits = tr.reduce((a: number, b: any) => a + (b.visits || 0), 0) + (orf?.visits || 0)
          const refsWithPct = totalRefVisits > 0
            ? tr.map((x: { source: string; visits: number }) => ({ ...x, pct: (x.visits / totalRefVisits) * 100 }))
            : tr.map((x: { source: string; visits: number }) => ({ ...x, pct: 0 }))
          const orfWithPct = orf ? { ...orf, pct: totalRefVisits > 0 ? (orf.visits / totalRefVisits) * 100 : 0 } : null

          setTopCountries(countriesWithPct)
          setOtherCountries(ocWithPct)
          setTopReferrers(refsWithPct)
          setOtherReferrers(orfWithPct)
        }
      } catch {}
      setVisitorsUpdatedAt(Date.now())
    } catch {
      // keep last known
    } finally {
      if (isInitial) setVisitorsLoading(false)
      else setVisitorsRefreshing(false)
    }
  }, [visitorsWindowDays, safeJson])

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
    plantsTotal?: number
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
  const [demoteOpen, setDemoteOpen] = React.useState(false)
  const [demoteSubmitting, setDemoteSubmitting] = React.useState(false)

  // Container ref for Members tab to run form-field validation logs
  const membersContainerRef = React.useRef<HTMLDivElement | null>(null)

  // Email/username autocomplete state
  const [emailSuggestions, setEmailSuggestions] = React.useState<Array<{ id: string; email: string | null; display_name?: string | null }>>([])
  const [suggestionsOpen, setSuggestionsOpen] = React.useState(false)
  const [suggestLoading, setSuggestLoading] = React.useState(false)
  const [highlightIndex, setHighlightIndex] = React.useState<number>(-1)

  // IP lookup state
  const [ipLookup, setIpLookup] = React.useState('')
  const [ipLoading, setIpLoading] = React.useState(false)
  const [ipError, setIpError] = React.useState<string | null>(null)
  const [ipResults, setIpResults] = React.useState<Array<{ id: string; email: string | null; display_name: string | null; last_seen_at: string | null }>>([])
  const [ipUsed, setIpUsed] = React.useState<string | null>(null)
  const [ipUsersCount, setIpUsersCount] = React.useState<number | null>(null)
  const [ipConnectionsCount, setIpConnectionsCount] = React.useState<number | null>(null)
  const [ipLastSeenAt, setIpLastSeenAt] = React.useState<string | null>(null)

  // Member visits (last 30 days)
  const [memberVisitsLoading, setMemberVisitsLoading] = React.useState<boolean>(false)
  const [memberVisitsSeries, setMemberVisitsSeries] = React.useState<Array<{ date: string; visits: number }>>([])
  const [memberVisitsTotal30d, setMemberVisitsTotal30d] = React.useState<number>(0)
  const [memberVisitsUpdatedAt, setMemberVisitsUpdatedAt] = React.useState<number | null>(null)

  const loadMemberVisitsSeries = React.useCallback(async (userId: string, opts?: { initial?: boolean }) => {
    if (!userId) return
    const isInitial = !!opts?.initial
    if (isInitial) setMemberVisitsLoading(true)
    try {
      const session = (await supabase.auth.getSession()).data.session
      const token = session?.access_token
      const headers: Record<string, string> = { 'Accept': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`
      try {
        const adminToken = (globalThis as any)?.__ENV__?.VITE_ADMIN_STATIC_TOKEN
        if (adminToken) headers['X-Admin-Token'] = String(adminToken)
      } catch {}
      const resp = await fetch(`/api/admin/member-visits-series?userId=${encodeURIComponent(userId)}`, { headers, credentials: 'same-origin' })
      const data = await safeJson(resp)
      if (!resp.ok) throw new Error(data?.error || `HTTP ${resp.status}`)
      const series = Array.isArray(data?.series30d) ? data.series30d.map((d: any) => ({ date: String(d.date), visits: Number(d.visits || 0) })) : []
      setMemberVisitsSeries(series)
      const total = Number(data?.total30d || 0)
      setMemberVisitsTotal30d(Number.isFinite(total) ? total : 0)
      setMemberVisitsUpdatedAt(Date.now())
    } catch {
      // keep last
    } finally {
      if (isInitial) setMemberVisitsLoading(false)
    }
  }, [safeJson])

  const lookupMember = React.useCallback(async () => {
    if (!lookupEmail || memberLoading) return
    setMemberLoading(true)
    setMemberError(null)
    setMemberData(null)
    try {
      const session = (await supabase.auth.getSession()).data.session
      const token = session?.access_token
      const url = `/api/admin/member?q=${encodeURIComponent(lookupEmail)}`
      const headers: Record<string,string> = { 'Accept': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`
      try {
        const adminToken = (globalThis as any)?.__ENV__?.VITE_ADMIN_STATIC_TOKEN
        if (adminToken) headers['X-Admin-Token'] = String(adminToken)
      } catch {}
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
        plantsTotal: typeof data?.plantsTotal === 'number' ? data.plantsTotal : undefined,
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

  const lookupByIp = React.useCallback(async () => {
    const ip = ipLookup.trim()
    if (!ip || ipLoading) return
    setIpLoading(true)
    setIpError(null)
    setIpResults([])
    setIpUsed(null)
    setIpUsersCount(null)
    setIpConnectionsCount(null)
    setIpLastSeenAt(null)
    try {
      const session = (await supabase.auth.getSession()).data.session
      const token = session?.access_token
      const headers: Record<string, string> = { 'Accept': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`
      try {
        const adminToken = (globalThis as any)?.__ENV__?.VITE_ADMIN_STATIC_TOKEN
        if (adminToken) headers['X-Admin-Token'] = String(adminToken)
      } catch {}
      const resp = await fetch(`/api/admin/members-by-ip?ip=${encodeURIComponent(ip)}`, { headers, credentials: 'same-origin' })
      const data = await safeJson(resp)
      if (!resp.ok) throw new Error(data?.error || `HTTP ${resp.status}`)
      const users = Array.isArray(data?.users)
        ? data.users.map((u: any) => ({ id: String(u.id), email: u?.email ?? null, display_name: u?.display_name ?? null, last_seen_at: u?.last_seen_at ?? null }))
        : []
      setIpResults(users)
      setIpUsed(typeof data?.ip === 'string' ? data.ip : ip)
      if (typeof data?.usersCount === 'number') setIpUsersCount(data.usersCount)
      if (typeof data?.connectionsCount === 'number') setIpConnectionsCount(data.connectionsCount)
      if (typeof data?.lastSeenAt === 'string') setIpLastSeenAt(data.lastSeenAt)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setIpError(msg || 'IP lookup failed')
    } finally {
      setIpLoading(false)
    }
  }, [ipLookup, ipLoading, safeJson])

  // Auto-load visits series when a member is selected
  React.useEffect(() => {
    const uid = memberData?.user?.id
    if (uid) {
      loadMemberVisitsSeries(uid, { initial: true })
    } else {
      setMemberVisitsSeries([])
      setMemberVisitsTotal30d(0)
      setMemberVisitsUpdatedAt(null)
    }
  }, [memberData?.user?.id, loadMemberVisitsSeries])

  const performBan = React.useCallback(async () => {
    if (!lookupEmail || banSubmitting) return
    setBanSubmitting(true)
    try {
      const session = (await supabase.auth.getSession()).data.session
      const token = session?.access_token
      const headers: Record<string,string> = { 'Content-Type': 'application/json', 'Accept': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`
      try {
        const adminToken = (globalThis as any)?.__ENV__?.VITE_ADMIN_STATIC_TOKEN
        if (adminToken) headers['X-Admin-Token'] = String(adminToken)
      } catch {}
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
      try {
        const adminToken = (globalThis as any)?.__ENV__?.VITE_ADMIN_STATIC_TOKEN
        if (adminToken) headers['X-Admin-Token'] = String(adminToken)
      } catch {}
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

  const performDemote = React.useCallback(async () => {
    if (!lookupEmail || demoteSubmitting) return
    setDemoteSubmitting(true)
    try {
      const session = (await supabase.auth.getSession()).data.session
      const token = session?.access_token
      const headers: Record<string,string> = { 'Content-Type': 'application/json', 'Accept': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`
      try {
        const adminToken = (globalThis as any)?.__ENV__?.VITE_ADMIN_STATIC_TOKEN
        if (adminToken) headers['X-Admin-Token'] = String(adminToken)
      } catch {}
      const resp = await fetch('/api/admin/demote-admin', {
        method: 'POST',
        headers,
        credentials: 'same-origin',
        body: JSON.stringify({ email: lookupEmail })
      })
      const data = await safeJson(resp)
      if (!resp.ok) throw new Error(data?.error || `HTTP ${resp.status}`)
      alert('Admin removed successfully')
      setDemoteOpen(false)
      // Refresh profile info
      setMemberData((prev) => prev ? { ...prev, profile: { ...(prev.profile || {}), is_admin: false } } : prev)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      alert(`Demotion failed: ${msg}`)
    } finally {
      setDemoteSubmitting(false)
    }
  }, [lookupEmail, demoteSubmitting, safeJson])

  // Debounced email/username suggestions fetch
  React.useEffect(() => {
    let cancelled = false
    let timer: any = null
    const run = async () => {
      const q = lookupEmail.trim()
      if (q.length < 1) {
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
        try {
          const adminToken = (globalThis as any)?.__ENV__?.VITE_ADMIN_STATIC_TOKEN
          if (adminToken) headers['X-Admin-Token'] = String(adminToken)
        } catch {}
        const resp = await fetch(`/api/admin/member-suggest?q=${encodeURIComponent(q)}`, {
          headers,
          credentials: 'same-origin',
        })
        const data = await safeJson(resp)
        if (cancelled) return
        if (resp.ok && Array.isArray(data?.suggestions)) {
          setEmailSuggestions(data.suggestions.map((s: any) => ({ id: String(s.id), email: s?.email ? String(s.email) : null, display_name: s?.display_name ? String(s.display_name) : null })))
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

  // Console diagnostic: log any form fields missing both id and name within Members tab
  React.useEffect(() => {
    if (activeTab !== 'members') return
    const container = membersContainerRef.current
    if (!container) return
    const t = setTimeout(() => {
      const fields = Array.from(container.querySelectorAll('input, textarea, select')) as Array<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
      const violations = fields.filter(el => !(el.getAttribute('id') || el.getAttribute('name')))
      if (violations.length > 0) {
        violations.forEach(el => {
          console.warn('A form field element has neither an id nor a name attribute:', el)
        })
      } else {
        console.info('Member Lookup: all form fields have an id or a name.')
      }
    }, 0)
    return () => clearTimeout(t)
  }, [activeTab])

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
              {reloadReady && (
                <div className="mb-3 rounded-xl border bg-amber-50/70 p-3 flex items-center justify-between gap-3">
                  <div className="text-sm">Server restart complete. Reload when convenient.</div>
                  <Button className="rounded-xl" onClick={reloadPage}>Reload page</Button>
                </div>
              )}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Health monitor</div>
                  <div className="text-xs opacity-60">Auto‑ping every 60s</div>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Refresh health"
                  onClick={refreshHealth}
                  disabled={healthRefreshing}
                  className="h-8 w-8 rounded-xl border bg-white text-black hover:bg-stone-50"
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

          {/* Branch selector */}
          <Card className="rounded-2xl">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <GitBranch className="h-4 w-4 opacity-70" />
                  <div className="text-sm font-medium truncate">Branch</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-xs opacity-60 hidden sm:block">Current:</div>
                  <Badge variant="outline" className="rounded-full">
                    {branchesLoading ? '—' : (currentBranch || 'unknown')}
                  </Badge>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <select
                  className="rounded-xl border px-3 py-2 text-sm bg-white"
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  disabled={branchesLoading || branchesRefreshing}
                  aria-label="Select branch"
                >
                  {branchesLoading ? (
                    <option value="">Loading…</option>
                  ) : branchOptions.length === 0 ? (
                    <option value="">No branches found</option>
                  ) : (
                    branchOptions.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))
                  )}
                </select>
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => loadBranches({ initial: false })}
                  disabled={branchesLoading || branchesRefreshing}
                >
                  <RefreshCw className={`h-4 w-4 ${branchesRefreshing ? 'animate-spin' : ''}`} />
                  Refresh branches
                </Button>
              </div>
              <div className="text-xs opacity-60 mt-2">
                Changing branch takes effect when you run Pull & Build.
              </div>
              {/* Action buttons moved into Branch card */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
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
              </div>
            </CardContent>
          </Card>

            {/* Admin Console */}
            <div className="mt-3">
              <button
                type="button"
                className="flex items-center gap-2 text-sm font-medium"
                onClick={() => setConsoleOpen(o => !o)}
                aria-expanded={consoleOpen}
                aria-controls="admin-console"
              >
                <ChevronDown className={`h-4 w-4 transition-transform ${consoleOpen ? 'rotate-180' : ''}`} />
                Admin Console
                {consoleLines.length > 0 && (
                  <span className="text-xs opacity-60">({consoleLines.length} lines)</span>
                )}
              </button>
              {consoleOpen && (
                <div className="mt-2" id="admin-console">
                  <div
                    ref={consoleRef}
                    className="h-48 overflow-auto rounded-xl border bg-black text-white text-xs p-3 font-mono whitespace-pre-wrap"
                    aria-live="polite"
                  >
                    {consoleLines.length === 0 ? 'No messages yet.' : consoleLines.join('\n')}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="rounded-xl"
                      onClick={() => setConsoleOpen(false)}
                      title="Hide console"
                    >Hide</Button>
                    <Button
                      size="sm"
                      className="rounded-xl"
                      onClick={() => { setConsoleLines([]); setConsoleOpen(true) }}
                      title="Clear console"
                    >Clear</Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl"
                      onClick={async () => {
                        const ok = await copyTextToClipboard(getAllLogsText())
                        if (!ok) alert('Copy failed. You can still select and copy manually.')
                      }}
                      title="Copy all console lines to clipboard"
                    >Copy all</Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl"
                      onClick={async () => {
                        const ok = await copyTextToClipboard(getErrorLinesText())
                        if (!ok) alert('Copy failed. You can still select and copy manually.')
                      }}
                      title="Copy only error-like lines to clipboard"
                    >Copy errors</Button>
                  </div>
                </div>
              )}
            </div>

          <div className="pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <Card className="rounded-2xl">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm opacity-60">Currently online</div>
                      <div className="text-xs opacity-60">{onlineUpdatedAt ? `Updated ${formatTimeAgo(onlineUpdatedAt)}` : 'Updated —'}</div>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Refresh currently online"
                      onClick={() => { loadOnlineUsers({ initial: false }); loadOnlineIpsList({ initial: false }) }}
                      disabled={onlineLoading || onlineRefreshing || ipsLoading || ipsRefreshing}
                      className="h-8 w-8 rounded-xl border bg-white text-black hover:bg-stone-50"
                    >
                      <RefreshCw className={`h-4 w-4 ${(onlineLoading || onlineRefreshing || ipsLoading || ipsRefreshing) ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                  <div className="text-2xl font-semibold tabular-nums mt-1">
                    {onlineLoading ? '—' : onlineUsers}
                  </div>
                  {/* Collapsible Connected IPs under Currently online */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        className="flex items-center gap-2 text-sm font-medium"
                        onClick={() => setIpsOpen(o => !o)}
                        aria-expanded={ipsOpen}
                        aria-controls="connected-ips"
                      >
                        <ChevronDown className={`h-4 w-4 transition-transform ${ipsOpen ? 'rotate-180' : ''}`} />
                        IPs
                      </button>
                      <div />
                    </div>
                    {ipsOpen && (
                      <div className="mt-2" id="connected-ips">
                        <div className="rounded-xl border bg-white p-3 max-h-48 overflow-auto">
                          {ipsLoading ? (
                            <div className="text-sm opacity-60">Loading…</div>
                          ) : ips.length === 0 ? (
                            <div className="text-sm opacity-60">No IPs.</div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {ips.map((ip) => (
                                <Badge key={ip} variant="outline" className="rounded-full px-2 py-1 text-xs">{ip}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-2xl">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm opacity-60">Registered accounts</div>
                      <div className="text-xs opacity-60">{registeredUpdatedAt ? `Updated ${formatTimeAgo(registeredUpdatedAt)}` : 'Updated —'}</div>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Refresh registered accounts"
                      onClick={() => loadRegisteredCount({ initial: false })}
                      disabled={registeredLoading || registeredRefreshing}
                      className="h-8 w-8 rounded-xl border bg-white text-black hover:bg-stone-50"
                    >
                      <RefreshCw className={`h-4 w-4 ${registeredLoading || registeredRefreshing ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                  <div className="text-2xl font-semibold tabular-nums mt-1">
                    {registeredLoading ? '—' : (registeredCount ?? '—')}
                  </div>
                </CardContent>
              </Card>
            </div>
            <Card className="rounded-2xl">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium">Unique visitors — last {visitorsWindowDays} days</div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className={`text-xs px-2 py-1 rounded-lg border ${visitorsWindowDays === 7 ? 'bg-black text-white' : 'bg-white'}`}
                          onClick={() => setVisitorsWindowDays(7)}
                          aria-pressed={visitorsWindowDays === 7}
                        >7d</button>
                        <button
                          type="button"
                          className={`text-xs px-2 py-1 rounded-lg border ${visitorsWindowDays === 30 ? 'bg-black text-white' : 'bg-white'}`}
                          onClick={() => setVisitorsWindowDays(30)}
                          aria-pressed={visitorsWindowDays === 30}
                        >30d</button>
                      </div>
                    </div>
                    <div className="text-xs opacity-60">{visitorsUpdatedAt ? `Updated ${formatTimeAgo(visitorsUpdatedAt)}` : 'Updated —'}</div>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Refresh visitors"
                    onClick={() => loadVisitorsStats({ initial: false })}
                    disabled={visitorsLoading || visitorsRefreshing}
                    className="h-8 w-8 rounded-xl border bg-white text-black hover:bg-stone-50"
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
                    // Prefer unique total across the full week from API; fallback to sum
                    const totalVal = (visitorsTotalUnique7d && Number.isFinite(visitorsTotalUnique7d))
                      ? visitorsTotalUnique7d
                      : values.reduce((acc, val) => acc + val, 0)
                    const avgVal = Math.round(totalVal / values.length)

                    const formatDow = (isoDate: string) => {
                      try {
                        if (visitorsWindowDays === 30) return ''
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
                        <div className="w-full flex justify-center">
                          <div className="h-64 w-full max-w-3xl">
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
                        {/* Sources breakdown */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                          <div className="rounded-xl border p-3 md:col-span-2">
                            <div className="text-sm font-medium mb-2">Top countries</div>
                            {topCountries.length === 0 ? (
                              <div className="text-sm opacity-60">No data.</div>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="col-span-2 min-h-[150px]">
                                  <ResponsiveContainer width="100%" height={150}>
                                    <PieChart>
                                      <Pie
                                        data={topCountries}
                                        dataKey="visits"
                                        nameKey="country"
                                        innerRadius={36}
                                        outerRadius={64}
                                        paddingAngle={3}
                                      >
                                        {(() => {
                                          const slices: Array<{ country: string; visits: number }> = [...topCountries]
                                          if (otherCountries && otherCountries.visits > 0) {
                                            slices.push({ country: `Other (${otherCountries.count})`, visits: otherCountries.visits })
                                          }
                                          return slices.map((entry, index) => (
                                            <Cell key={`cell-${entry.country}`} fill={countryColors[index % countryColors.length]} />
                                          ))
                                        })()}
                                      </Pie>
                                    </PieChart>
                                  </ResponsiveContainer>
                                </div>
                                <div className="flex flex-col gap-2">
                                  {topCountries.slice(0, 3).map((c, idx) => (
                                    <div key={c.country} className="flex items-center justify-between">
                                      <div className="flex-1 flex items-center gap-2 min-w-0">
                                        <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: countryColors[idx % countryColors.length] }} />
                                        <span className="text-sm truncate">{countryCodeToName(c.country)}</span>
                                      </div>
                                      <span className="text-sm tabular-nums">{Math.round(c.pct || 0)}%</span>
                                    </div>
                                  ))}
                                  {otherCountries && otherCountries.visits > 0 && (
                                    <div className="flex items-center justify-between">
                                      <div className="flex-1 flex items-center gap-2 min-w-0">
                                        <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: countryColors[4 % countryColors.length] }} />
                                        <span className="text-sm truncate">Other ({otherCountries.count})</span>
                                      </div>
                                      <span className="text-sm tabular-nums">{Math.round(otherCountries?.pct || 0)}%</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="rounded-xl border p-3 md:col-span-1">
                            <div className="text-sm font-medium mb-2">Top referrers</div>
                            {topReferrers.length === 0 ? (
                              <div className="text-sm opacity-60">No data.</div>
                            ) : (
                              <div className="flex flex-col gap-2">
                                {topReferrers.slice(0, 5).map((r, idx) => (
                                  <div key={r.source} className="flex items-center justify-between">
                                    <div className="flex-1 flex items-center gap-2 min-w-0">
                                      <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: referrerColors[idx % referrerColors.length] }} />
                                      <span className="text-sm truncate">{r.source}</span>
                                    </div>
                                    <span className="text-sm tabular-nums">{Math.round(r.pct || 0)}%</span>
                                  </div>
                                ))}
                                {otherReferrers && otherReferrers.visits > 0 && (
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1 flex items-center gap-2 min-w-0">
                                      <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: referrerColors[4 % referrerColors.length] }} />
                                      <span className="text-sm truncate">Other ({otherReferrers.count})</span>
                                    </div>
                                    <span className="text-sm tabular-nums">{Math.round(otherReferrers.pct || 0)}%</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
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
            <div className="space-y-4" ref={membersContainerRef}>
          <Card className="rounded-2xl">
                <CardContent className="p-4 space-y-3">
                  <div className="text-sm font-medium flex items-center gap-2"><UserSearch className="h-4 w-4" /> Find member by email or username</div>
                  <div className="flex gap-2 relative">
                    <div className="flex-1 relative">
                  <Input
                    id="member-email"
                    name="member-email"
                    autoComplete="email"
                    aria-label="Member email or username"
                    className="rounded-xl"
                    placeholder="user@example.com or username"
                    value={lookupEmail}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLookupEmail(e.target.value)}
                    onFocus={() => { if (emailSuggestions.length > 0) setSuggestionsOpen(true) }}
                    onBlur={() => setTimeout(() => setSuggestionsOpen(false), 120)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (suggestionsOpen && emailSuggestions.length > 0 && highlightIndex >= 0 && highlightIndex < emailSuggestions.length) {
                          e.preventDefault()
                          const chosen = emailSuggestions[highlightIndex]
                          const typed = lookupEmail.trim()
                          const nextVal = typed.includes('@') ? (chosen.email || chosen.display_name || '') : (chosen.display_name || chosen.email || '')
                          setLookupEmail(nextVal)
                          setSuggestionsOpen(false)
                        } else {
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
                    <div className="absolute z-10 mt-1 w-full rounded-xl border bg-white shadow-md max-h-60 overflow-auto" role="listbox">
                          {emailSuggestions.map((s, idx) => (
                            <button
                              key={s.id}
                              type="button"
                          className={`w-full text-left px-3 py-2 text-sm rounded-xl ${idx === highlightIndex ? 'bg-neutral-100' : ''}`}
                          role="option"
                          aria-selected={idx === highlightIndex}
                              onMouseEnter={() => setHighlightIndex(idx)}
                              onMouseDown={(e) => {
                                e.preventDefault()
                                const typed = lookupEmail.trim()
                                const nextVal = typed.includes('@') ? (s.email || s.display_name || '') : (s.display_name || s.email || '')
                                setLookupEmail(nextVal)
                                setSuggestionsOpen(false)
                              }}
                            >
                              <div className="truncate">{s.display_name || s.email || ''}</div>
                              {s.display_name && s.email && s.display_name !== s.email && (
                                <div className="text-xs opacity-60 truncate">{s.email}</div>
                              )}
                            </button>
                          ))}
                          {suggestLoading && (
                            <div className="px-3 py-2 text-xs opacity-60">Loading…</div>
                          )}
                        </div>
                      )}
                    </div>
                    <Button className="rounded-2xl" onClick={lookupMember} disabled={memberLoading || !lookupEmail}>
                      <Search className="h-4 w-4" /> Lookup
                    </Button>
                  </div>
              {memberError && <div className="text-sm text-rose-600">{memberError}</div>}
              {memberLoading && (
                <div className="space-y-3" aria-live="polite">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-neutral-200 animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-neutral-200 rounded w-40 animate-pulse" />
                      <div className="h-3 bg-neutral-200 rounded w-60 animate-pulse" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="h-16 rounded-xl border bg-white animate-pulse" />
                    ))}
                  </div>
                </div>
              )}
              {!memberLoading && !memberError && !memberData && (
                <div className="text-sm opacity-60">Search for a member to see details.</div>
              )}
              {memberData && (
                <div className="space-y-4">
                  {(() => {
                    const nameOrEmail = (memberData.profile?.display_name || memberData.user?.email || '').trim()
                    const initial = (nameOrEmail[0] || '?').toUpperCase()
                    return (
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-14 w-14 rounded-full bg-gradient-to-br from-emerald-200 to-green-300 text-emerald-900 flex items-center justify-center font-semibold shadow-inner">
                            {initial}
                          </div>
                          <div className="min-w-0">
                            <div className="text-base md:text-lg font-semibold truncate">
                              {memberData.profile?.display_name || memberData.user?.email || '—'}
                            </div>
                            <div className="text-xs opacity-70 truncate">
                              {memberData.user?.email || '—'}{memberData.user?.id ? (<span className="opacity-60"> · id {memberData.user.id}</span>) : null}
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {memberData.profile?.is_admin && (
                                <Badge variant="outline" className="rounded-full px-2 py-0.5 bg-emerald-100 text-emerald-800 border-emerald-200 flex items-center gap-1">
                                  <ShieldCheck className="h-3 w-3" /> Admin
                                </Badge>
                              )}
                              {memberData.isBannedEmail && (
                                <Badge variant="destructive" className="rounded-full px-2 py-0.5">Banned</Badge>
                              )}
                              {memberData.lastOnlineAt && (
                                <Badge variant="outline" className="rounded-full px-2 py-0.5">Last online {new Date(memberData.lastOnlineAt).toLocaleString()}</Badge>
                              )}
                              {memberData.user?.created_at && (
                                <Badge variant="outline" className="rounded-full px-2 py-0.5">Joined {new Date(memberData.user.created_at).toLocaleDateString()}</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {memberData.profile?.is_admin ? (
                            <Dialog open={demoteOpen} onOpenChange={setDemoteOpen}>
                              <DialogTrigger asChild>
                                <Button
                                  variant="destructive"
                                  size="icon"
                                  className="rounded-xl"
                                  title="Remove admin"
                                  aria-label="Remove admin"
                                  disabled={!lookupEmail}
                                >
                                  <ShieldX className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Remove admin from {lookupEmail || 'user'}</DialogTitle>
                                  <DialogDescription>
                                    This will revoke administrative privileges and make the user a normal member.
                                  </DialogDescription>
                                </DialogHeader>
                                <DialogFooter>
                                  <DialogClose asChild>
                                    <Button variant="secondary">Cancel</Button>
                                  </DialogClose>
                                  <Button
                                    variant="destructive"
                                    onClick={performDemote}
                                    disabled={!lookupEmail || demoteSubmitting}
                                  >
                                    {demoteSubmitting ? 'Removing…' : 'Confirm remove'}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          ) : (
                            <Dialog open={promoteOpen} onOpenChange={setPromoteOpen}>
                              <DialogTrigger asChild>
                                <Button
                                  variant="secondary"
                                  size="icon"
                                  className="rounded-xl"
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
                          )}
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
                                <label htmlFor="ban-reason" className="text-xs opacity-60">Reason</label>
                                <Textarea
                                  id="ban-reason"
                                  name="ban-reason"
                                  className="min-h-[100px]"
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
                        </div>
                      </div>
                    )
                  })()}

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div className="rounded-xl border p-3 text-center">
                      <div className="text-[11px] opacity-60">Visits</div>
                      <div className="text-base font-semibold tabular-nums">{memberData.visitsCount ?? '—'}</div>
                    </div>
                    <div className="rounded-xl border p-3 text-center">
                      <div className="text-[11px] opacity-60">Unique IPs</div>
                      <div className="text-base font-semibold tabular-nums">{memberData.uniqueIpsCount ?? '—'}</div>
                    </div>
                    <div className="rounded-xl border p-3 text-center">
                      <div className="text-[11px] opacity-60">Total plants</div>
                      <div className="text-base font-semibold tabular-nums">{memberData.plantsTotal ?? '—'}</div>
                    </div>
                    <div className="rounded-xl border p-3 text-center">
                      <div className="text-[11px] opacity-60">Last IP</div>
                      <div className="text-base font-semibold tabular-nums truncate" title={memberData.lastIp || undefined}>{memberData.lastIp || '—'}</div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs font-medium uppercase tracking-wide opacity-60">Known IPs ({memberData.ips.length})</div>
                    <div className="flex flex-wrap gap-1">
                      {memberData.ips.map((ip) => (
                        <Badge key={ip} variant="outline" className="rounded-full">{ip}</Badge>
                      ))}
                      {memberData.ips.length === 0 && <div className="text-xs opacity-60">No IPs recorded</div>}
                    </div>
                  </div>

                  <Card className="rounded-2xl">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div>
                          <div className="text-sm font-medium">Visits — last 30 days</div>
                          <div className="text-xs opacity-60">{memberVisitsUpdatedAt ? `Updated ${formatTimeAgo(memberVisitsUpdatedAt)}` : 'Updated —'}</div>
                        </div>
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label="Refresh visits"
                          onClick={() => { if (memberData?.user?.id) loadMemberVisitsSeries(memberData.user.id, { initial: true }) }}
                          disabled={memberVisitsLoading || !memberData?.user?.id}
                          className="h-8 w-8 rounded-xl border bg-white text-black hover:bg-stone-50"
                        >
                          <RefreshCw className={`h-4 w-4 ${memberVisitsLoading ? 'animate-spin' : ''}`} />
                        </Button>
                      </div>

                      {memberVisitsLoading ? (
                        <div className="text-sm opacity-60">Loading…</div>
                      ) : memberVisitsSeries.length === 0 ? (
                        <div className="text-sm opacity-60">No data yet.</div>
                      ) : (
                        (() => {
                          const values = memberVisitsSeries.map(d => d.visits)
                          const maxVal = Math.max(...values, 1)
                          const avgVal = Math.round((values.reduce((a, b) => a + b, 0)) / values.length)
                          const formatShort = (iso: string) => {
                            try {
                              const dt = new Date(iso + 'T00:00:00Z')
                              return new Intl.DateTimeFormat(undefined, { month: 'numeric', day: 'numeric', timeZone: 'UTC' }).format(dt)
                            } catch { return iso }
                          }
                          const formatFull = (iso: string) => {
                            try {
                              const dt = new Date(iso + 'T00:00:00Z')
                              return new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(dt)
                            } catch { return iso }
                          }
                          const TooltipContent = ({ active, payload, label }: any) => {
                            if (!active || !payload || payload.length === 0) return null
                            const current = payload[0]?.value as number
                            return (
                              <div className="rounded-xl border bg-white/90 backdrop-blur p-3 shadow-lg">
                                <div className="text-xs opacity-60">{formatFull(label)}</div>
                                <div className="mt-1 text-base font-semibold tabular-nums">{current}</div>
                              </div>
                            )
                          }
                          return (
                            <div>
                              <div className="text-sm font-medium mb-2">Total last 30 days: <span className="tabular-nums">{memberVisitsTotal30d}</span></div>
                              <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                  <ComposedChart data={memberVisitsSeries} margin={{ top: 10, right: 16, bottom: 14, left: 16 }}>
                                    <defs>
                                      <linearGradient id="mVisitsLine" x1="0" y1="0" x2="1" y2="0">
                                        <stop offset="0%" stopColor="#065f46" />
                                        <stop offset="100%" stopColor="#10b981" />
                                      </linearGradient>
                                      <linearGradient id="mVisitsArea" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                                        <stop offset="100%" stopColor="#10b981" stopOpacity={0.06} />
                                      </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                                    <XAxis dataKey="date" tickFormatter={formatShort} tick={{ fontSize: 11, fill: '#525252' }} axisLine={false} tickLine={false} interval={4} padding={{ left: 12, right: 12 }} />
                                    <YAxis allowDecimals={false} domain={[0, Math.max(maxVal, 5)]} tick={{ fontSize: 11, fill: '#525252' }} axisLine={false} tickLine={false} />
                                    <Tooltip content={<TooltipContent />} cursor={{ stroke: 'rgba(0,0,0,0.1)' }} />
                                    <ReferenceLine y={avgVal} stroke="#a3a3a3" strokeDasharray="4 4" ifOverflow="extendDomain" label={{ value: 'avg', position: 'insideRight', fill: '#737373', fontSize: 11, dx: -6 }} />
                                    <Area type="monotone" dataKey="visits" fill="url(#mVisitsArea)" stroke="none" animationDuration={600} />
                                    <Line type="monotone" dataKey="visits" stroke="url(#mVisitsLine)" strokeWidth={3} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: '#065f46', fill: '#ffffff' }} animationDuration={700} />
                                  </ComposedChart>
                                </ResponsiveContainer>
                              </div>
                            </div>
                          )
                        })()
                      )}
                    </CardContent>
                  </Card>

                  {(memberData.isBannedEmail || (memberData.bannedIps && memberData.bannedIps.length > 0)) && (
                    <div className="rounded-xl border p-3 bg-rose-50/60">
                      <div className="text-sm font-medium text-rose-700 flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Banned details</div>
                      {memberData.isBannedEmail && (
                        <div className="text-sm mt-1">Email banned {memberData.bannedAt ? `on ${new Date(memberData.bannedAt).toLocaleString()}` : ''}{memberData.bannedReason ? ` — ${memberData.bannedReason}` : ''}</div>
                      )}
                      {memberData.bannedIps && memberData.bannedIps.length > 0 && (
                        <div className="text-sm mt-1">Blocked IPs:
                          <div className="mt-1 flex flex-wrap gap-1">
                            {memberData.bannedIps.map(ip => (
                              <Badge key={ip} variant="outline" className="rounded-full bg-white">{ip}</Badge>
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

          {/* IP Search Card */}
          {activeTab === 'members' && (
            <Card className="rounded-2xl">
              <CardContent className="p-4 space-y-3">
                <div className="text-sm font-medium flex items-center gap-2"><UserSearch className="h-4 w-4" /> Find users by IP address</div>
                <div className="flex gap-2">
                  <Input
                    id="member-ip"
                    name="member-ip"
                    autoComplete="off"
                    aria-label="IP address"
                    className="rounded-xl"
                    placeholder="e.g. 203.0.113.42"
                    value={ipLookup}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIpLookup(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); lookupByIp() } }}
                  />
                  <Button className="rounded-2xl" onClick={lookupByIp} disabled={ipLoading || !ipLookup.trim()}>
                    <Search className="h-4 w-4" /> Search IP
                  </Button>
                </div>
                {ipError && <div className="text-sm text-rose-600">{ipError}</div>}
                {ipLoading && (
                  <div className="space-y-2" aria-live="polite">
                    <div className="h-4 bg-neutral-200 rounded w-52 animate-pulse" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-20 rounded-xl border bg-white animate-pulse" />
                      ))}
                    </div>
                  </div>
                )}
                {!ipLoading && ipResults && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="rounded-xl border p-3 text-center">
                        <div className="text-[11px] opacity-60">IP</div>
                        <div className="text-base font-semibold tabular-nums truncate" title={ipUsed || undefined}>{ipUsed || '—'}</div>
                      </div>
                      <div className="rounded-xl border p-3 text-center">
                        <div className="text-[11px] opacity-60">Users</div>
                        <div className="text-base font-semibold tabular-nums">{ipUsersCount ?? ipResults.length}</div>
                      </div>
                      <div className="rounded-xl border p-3 text-center">
                        <div className="text-[11px] opacity-60">Connections</div>
                        <div className="text-base font-semibold tabular-nums">{ipConnectionsCount ?? '—'}</div>
                      </div>
                    </div>
                    <div className="text-xs opacity-60">Last seen: {ipLastSeenAt ? new Date(ipLastSeenAt).toLocaleString() : '—'}</div>
                    {ipResults.length === 0 ? (
                      <div className="text-sm opacity-60">No users found for this IP.</div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {ipResults.map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            className="text-left rounded-2xl border p-3 bg-white hover:bg-stone-50"
                            onClick={() => {
                              const nextVal = (u.email || u.display_name || '').trim()
                              if (!nextVal) return
                              setLookupEmail(nextVal)
                              setTimeout(() => { lookupMember() }, 0)
                            }}
                          >
                            <div className="text-sm font-semibold truncate">{u.display_name || u.email || 'User'}</div>
                            <div className="text-xs opacity-70 truncate">{u.email || '—'}</div>
                            {u.last_seen_at && (
                              <div className="text-[11px] opacity-60 mt-0.5">Last seen {new Date(u.last_seen_at).toLocaleString()}</div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

    </div>
  )
}

export default AdminPage

