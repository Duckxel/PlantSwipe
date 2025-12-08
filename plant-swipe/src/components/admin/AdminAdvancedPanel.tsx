import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useLocation } from "react-router-dom"
import { Link } from "@/components/i18n/Link"
import { supabase } from "@/lib/supabaseClient"
import {
  RefreshCw,
  ScrollText,
  Map,
  AlertTriangle,
  ChevronRight,
  ExternalLink,
  Loader2,
  XCircle,
  CheckCircle2,
  Clock,
  Copy,
} from "lucide-react"

// ========================
// LOGS TAB (existing AdminLogs functionality)
// ========================
const LogsTab: React.FC = () => {
  const [logs, setLogs] = React.useState<
    Array<{
      occurred_at: string
      admin_id?: string | null
      admin_name: string | null
      action: string
      target: string | null
      detail: any
    }>
  >([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [visibleCount, setVisibleCount] = React.useState<number>(20)

  const copyTextToClipboard = React.useCallback(
    async (text: string): Promise<boolean> => {
      try {
        if (
          navigator &&
          navigator.clipboard &&
          typeof navigator.clipboard.writeText === "function"
        ) {
          await navigator.clipboard.writeText(text)
          return true
        }
      } catch {}
      try {
        const ta = document.createElement("textarea")
        ta.value = text
        ta.style.position = "fixed"
        ta.style.opacity = "0"
        document.body.appendChild(ta)
        ta.focus()
        ta.select()
        const ok = document.execCommand("copy")
        document.body.removeChild(ta)
        return ok
      } catch {
        return false
      }
    },
    [],
  )

  const formatLogLine = React.useCallback(
    (l: {
      occurred_at: string
      admin_id?: string | null
      admin_name: string | null
      action: string
      target: string | null
      detail: any
    }): string => {
      const ts = l.occurred_at ? new Date(l.occurred_at).toLocaleString() : ""
      const who = (l.admin_name && String(l.admin_name).trim()) || "Admin"
      const act = l.action || ""
      const tgt = l.target ? ` → ${l.target}` : ""
      const det = l.detail ? ` → ${JSON.stringify(l.detail)}` : ""
      return `${ts} :: 👤 ${who} // 🔹 ${act}${tgt}${det}`
    },
    [],
  )

  const copyVisibleLogs = React.useCallback(async () => {
    const subset = logs.slice(0, visibleCount)
    const text = subset.map(formatLogLine).join("\n")
    await copyTextToClipboard(text)
  }, [logs, visibleCount, copyTextToClipboard, formatLogLine])

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const session = (await supabase.auth.getSession()).data.session
      const token = session?.access_token
      const headers: Record<string, string> = { Accept: "application/json" }
      if (token) headers["Authorization"] = `Bearer ${token}`
      try {
        const adminToken = (globalThis as any)?.__ENV__?.VITE_ADMIN_STATIC_TOKEN
        if (adminToken) headers["X-Admin-Token"] = String(adminToken)
      } catch {}
      const r = await fetch("/api/admin/admin-logs?days=30", {
        headers,
        credentials: "same-origin",
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(data?.error || `HTTP → ${r.status}`)
      const list = Array.isArray(data?.logs) ? data.logs : []
      setLogs(list)
      setVisibleCount(Math.min(20, list.length || 20))
    } catch (e: any) {
      setError(e?.message || "Failed to load logs")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

  // Live stream of admin logs via SSE
  React.useEffect(() => {
    let es: EventSource | null = null
    let updating = false
    ;(async () => {
      try {
        const session = (await supabase.auth.getSession()).data.session
        const token = session?.access_token
        let adminToken: string | null = null
        try {
          adminToken =
            String((globalThis as any)?.__ENV__?.VITE_ADMIN_STATIC_TOKEN || "") ||
            null
        } catch {}
        const q: string[] = []
        if (token) q.push(`token=${encodeURIComponent(token)}`)
        if (adminToken) q.push(`admin_token=${encodeURIComponent(adminToken)}`)
        const url = `/api/admin/admin-logs/stream${q.length ? "?" + q.join("&") : ""}`
        es = new EventSource(url)
        es.addEventListener("snapshot", (ev: MessageEvent) => {
          try {
            const data = JSON.parse(String(ev.data || "{}"))
            const list = Array.isArray(data?.logs) ? data.logs : []
            setLogs(list)
            setVisibleCount(Math.min(20, list.length || 20))
          } catch {}
        })
        es.addEventListener("append", (ev: MessageEvent) => {
          try {
            const row = JSON.parse(String(ev.data || "{}"))
            if (updating) return
            updating = true
            setLogs((prev) => [row, ...prev].slice(0, 2000))
            setTimeout(() => {
              updating = false
            }, 0)
          } catch {}
        })
        es.onerror = () => {}
      } catch {}
    })()
    return () => {
      try {
        es?.close()
      } catch {}
    }
  }, [])

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium">Admin logs - last 30 days</div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              className="rounded-2xl h-8 px-3"
              onClick={copyVisibleLogs}
              disabled={loading}
              aria-label="Copy logs"
            >
              <Copy className="h-4 w-4 mr-1.5" />
              Copy
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="rounded-2xl"
              onClick={load}
              disabled={loading}
              aria-label="Refresh logs"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
        {error && <div className="text-sm text-rose-600">{error}</div>}
        {loading ? (
          <div className="text-sm opacity-60">Loading...</div>
        ) : logs.length === 0 ? (
          <div className="text-sm opacity-60">No admin activity logged.</div>
        ) : (
          <>
            <div className="bg-black text-green-300 rounded-2xl p-3 text-[11px] font-mono overflow-y-auto overflow-x-hidden max-h-[480px] space-y-2">
              {logs.slice(0, visibleCount).map((l, idx) => (
                <div key={idx} className="whitespace-pre-wrap break-words">
                  {formatLogLine(l)}
                </div>
              ))}
            </div>
            {logs.length > visibleCount && (
              <div className="flex justify-end mt-2">
                <Button
                  variant="outline"
                  className="rounded-2xl h-8 px-3"
                  onClick={() => setVisibleCount((c) => Math.min(c + 50, logs.length))}
                >
                  Show more
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ========================
// SITEMAP TAB
// ========================
type SitemapEntry = {
  loc: string
  lastmod?: string
  changefreq?: string
  priority?: string
}

const SitemapTab: React.FC = () => {
  const [entries, setEntries] = React.useState<SitemapEntry[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [filter, setFilter] = React.useState("")

  const loadSitemap = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch("/sitemap.xml")
      if (!resp.ok) throw new Error(`Failed to fetch sitemap: ${resp.status}`)
      const text = await resp.text()
      
      // Parse XML
      const parser = new DOMParser()
      const doc = parser.parseFromString(text, "application/xml")
      const parseError = doc.querySelector("parsererror")
      if (parseError) throw new Error("Invalid sitemap XML")

      const urlElements = doc.querySelectorAll("url")
      const parsed: SitemapEntry[] = Array.from(urlElements).map((urlEl) => ({
        loc: urlEl.querySelector("loc")?.textContent || "",
        lastmod: urlEl.querySelector("lastmod")?.textContent || undefined,
        changefreq: urlEl.querySelector("changefreq")?.textContent || undefined,
        priority: urlEl.querySelector("priority")?.textContent || undefined,
      }))
      setEntries(parsed)
    } catch (e: any) {
      setError(e?.message || "Failed to load sitemap")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadSitemap()
  }, [loadSitemap])

  const filteredEntries = React.useMemo(() => {
    if (!filter.trim()) return entries
    const q = filter.toLowerCase()
    return entries.filter((e) => e.loc.toLowerCase().includes(q))
  }, [entries, filter])

  // Group entries by path segment
  const groupedEntries = React.useMemo(() => {
    const groups: Record<string, SitemapEntry[]> = {}
    filteredEntries.forEach((entry) => {
      try {
        const url = new URL(entry.loc)
        const pathParts = url.pathname.split("/").filter(Boolean)
        const group = pathParts[0] || "root"
        if (!groups[group]) groups[group] = []
        groups[group].push(entry)
      } catch {
        if (!groups["other"]) groups["other"] = []
        groups["other"].push(entry)
      }
    })
    return groups
  }, [filteredEntries])

  const groupOrder = Object.keys(groupedEntries).sort((a, b) => {
    if (a === "root") return -1
    if (b === "root") return 1
    return a.localeCompare(b)
  })

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-medium">Sitemap Explorer</h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {entries.length} URLs indexed
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter URLs..."
                className="h-9 px-3 text-sm rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1a1a1d] focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
              <Button
                size="icon"
                variant="outline"
                className="rounded-xl"
                onClick={loadSitemap}
                disabled={loading}
                aria-label="Refresh sitemap"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
              <Button
                size="icon"
                variant="outline"
                className="rounded-xl"
                onClick={() => window.open("/sitemap.xml", "_blank")}
                aria-label="Open raw sitemap"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 mb-4">
              <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                <XCircle className="h-4 w-4" />
                {error}
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12 text-sm text-stone-500">
              No sitemap entries found. Make sure /sitemap.xml exists.
            </div>
          ) : (
            <div className="space-y-4">
              {groupOrder.map((group) => (
                <div key={group} className="rounded-xl border border-stone-200 dark:border-[#3e3e42] overflow-hidden">
                  <div className="px-4 py-2.5 bg-stone-50 dark:bg-[#1a1a1d] border-b border-stone-200 dark:border-[#3e3e42]">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium capitalize">
                        /{group === "root" ? "" : group}
                      </span>
                      <span className="text-xs text-stone-500 dark:text-stone-400">
                        {groupedEntries[group].length} URLs
                      </span>
                    </div>
                  </div>
                  <div className="divide-y divide-stone-100 dark:divide-[#2a2a2d] max-h-[300px] overflow-y-auto">
                    {groupedEntries[group].map((entry, idx) => {
                      let pathname = entry.loc
                      try {
                        pathname = new URL(entry.loc).pathname
                      } catch {}
                      return (
                        <div
                          key={idx}
                          className="px-4 py-2.5 hover:bg-stone-50 dark:hover:bg-[#1a1a1d] transition-colors"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <ChevronRight className="h-3.5 w-3.5 text-stone-400 flex-shrink-0" />
                              <a
                                href={entry.loc}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline truncate"
                              >
                                {pathname}
                              </a>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-stone-500 dark:text-stone-400 flex-shrink-0">
                              {entry.priority && (
                                <span className="px-1.5 py-0.5 rounded bg-stone-100 dark:bg-[#2a2a2d]">
                                  P: {entry.priority}
                                </span>
                              )}
                              {entry.changefreq && (
                                <span className="hidden sm:inline">{entry.changefreq}</span>
                              )}
                              {entry.lastmod && (
                                <span className="hidden md:inline">
                                  {new Date(entry.lastmod).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ========================
// ERROR LOGS TAB
// ========================
type ErrorLogEntry = {
  id: string
  timestamp: string
  source: "api" | "admin_api" | "frontend"
  level: "error" | "warn" | "info"
  message: string
  stack?: string
  endpoint?: string
  statusCode?: number
  userId?: string
}

const ErrorLogsTab: React.FC = () => {
  const [logs, setLogs] = React.useState<ErrorLogEntry[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [sourceFilter, setSourceFilter] = React.useState<"all" | "api" | "admin_api">("all")
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set())
  const [isLive, setIsLive] = React.useState(false)

  const loadErrorLogs = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const session = (await supabase.auth.getSession()).data.session
      const token = session?.access_token
      const headers: Record<string, string> = { Accept: "application/json" }
      if (token) headers["Authorization"] = `Bearer ${token}`
      try {
        const adminToken = (globalThis as any)?.__ENV__?.VITE_ADMIN_STATIC_TOKEN
        if (adminToken) headers["X-Admin-Token"] = String(adminToken)
      } catch {}
      
      const r = await fetch("/api/admin/error-logs?days=7", {
        headers,
        credentials: "same-origin",
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`)
      const list = Array.isArray(data?.logs) ? data.logs : []
      setLogs(list)
    } catch (e: any) {
      setError(e?.message || "Failed to load error logs")
      // Show placeholder data if API doesn't exist yet
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadErrorLogs()
  }, [loadErrorLogs])

  // Live stream of error logs via SSE
  React.useEffect(() => {
    let es: EventSource | null = null
    let updating = false
    ;(async () => {
      try {
        const session = (await supabase.auth.getSession()).data.session
        const token = session?.access_token
        let adminToken: string | null = null
        try {
          adminToken =
            String((globalThis as any)?.__ENV__?.VITE_ADMIN_STATIC_TOKEN || "") ||
            null
        } catch {}
        const q: string[] = []
        if (token) q.push(`token=${encodeURIComponent(token)}`)
        if (adminToken) q.push(`admin_token=${encodeURIComponent(adminToken)}`)
        const url = `/api/admin/error-logs/stream${q.length ? "?" + q.join("&") : ""}`
        es = new EventSource(url)
        es.addEventListener("snapshot", (ev: MessageEvent) => {
          try {
            const data = JSON.parse(String(ev.data || "{}"))
            const list = Array.isArray(data?.logs) ? data.logs : []
            setLogs(list)
            setIsLive(true)
          } catch {}
        })
        es.addEventListener("append", (ev: MessageEvent) => {
          try {
            const row = JSON.parse(String(ev.data || "{}")) as ErrorLogEntry
            if (updating) return
            updating = true
            setLogs((prev) => [row, ...prev].slice(0, 500))
            setTimeout(() => {
              updating = false
            }, 0)
          } catch {}
        })
        es.onopen = () => setIsLive(true)
        es.onerror = () => setIsLive(false)
      } catch {}
    })()
    return () => {
      try {
        es?.close()
      } catch {}
    }
  }, [])

  const filteredLogs = React.useMemo(() => {
    if (sourceFilter === "all") return logs
    return logs.filter((l) => l.source === sourceFilter)
  }, [logs, sourceFilter])

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const getLevelColor = (level: string) => {
    switch (level) {
      case "error":
        return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
      case "warn":
        return "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
      default:
        return "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400"
    }
  }

  const getSourceColor = (source: string) => {
    switch (source) {
      case "api":
        return "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
      case "admin_api":
        return "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400"
      default:
        return "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400"
    }
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium">Error Logs</h3>
                {isLive && (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    LIVE
                  </span>
                )}
                {logs.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                    {logs.length} {logs.length === 1 ? "error" : "errors"}
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                API errors journal - real-time monitoring
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value as any)}
                className="h-9 px-3 text-sm rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1a1a1d] focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="all">All Sources</option>
                <option value="api">Node API</option>
                <option value="admin_api">Python Admin API</option>
              </select>
              <Button
                size="icon"
                variant="outline"
                className="rounded-xl"
                onClick={loadErrorLogs}
                disabled={loading}
                aria-label="Refresh error logs"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 mb-4">
              <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" />
                {error}
              </div>
              <p className="text-xs text-amber-500 dark:text-amber-500 mt-1">
                Error logs are stored in memory and will be cleared on server restart.
              </p>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
              <p className="text-sm font-medium text-stone-900 dark:text-white">No errors found</p>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                {isLive ? "Monitoring for errors in real-time..." : "Everything is running smoothly!"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-xl border border-stone-200 dark:border-[#3e3e42] overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleExpand(log.id)}
                    className="w-full px-4 py-3 flex items-start gap-3 hover:bg-stone-50 dark:hover:bg-[#1a1a1d] transition-colors text-left"
                  >
                    <AlertTriangle className={cn(
                      "h-4 w-4 mt-0.5 flex-shrink-0",
                      log.level === "error" ? "text-red-500" : "text-amber-500"
                    )} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", getLevelColor(log.level))}>
                          {log.level.toUpperCase()}
                        </span>
                        <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", getSourceColor(log.source))}>
                          {log.source === "admin_api" ? "Python API" : "Node API"}
                        </span>
                        {log.endpoint && (
                          <span className="text-[10px] text-stone-500 dark:text-stone-400 font-mono">
                            {log.endpoint}
                          </span>
                        )}
                        {log.statusCode && (
                          <span className="text-[10px] text-stone-500 dark:text-stone-400">
                            HTTP {log.statusCode}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-stone-900 dark:text-white truncate">
                        {log.message}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-stone-500 dark:text-stone-400">
                        <Clock className="h-3 w-3" />
                        {new Date(log.timestamp).toLocaleString()}
                      </div>
                    </div>
                    <ChevronRight className={cn(
                      "h-4 w-4 text-stone-400 transition-transform flex-shrink-0",
                      expandedIds.has(log.id) && "rotate-90"
                    )} />
                  </button>
                  
                  {expandedIds.has(log.id) && log.stack && (
                    <div className="px-4 py-3 bg-stone-900 dark:bg-black border-t border-stone-200 dark:border-[#3e3e42]">
                      <pre className="text-[11px] text-green-400 font-mono whitespace-pre-wrap break-words overflow-x-auto">
                        {log.stack}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ========================
// MAIN PANEL COMPONENT
// ========================
type AdvancedView = "logs" | "sitemap" | "errors"

export const AdminAdvancedPanel: React.FC = () => {
  const location = useLocation()
  
  const activeView: AdvancedView = React.useMemo(() => {
    if (location.pathname.includes("/advanced/sitemap")) return "sitemap"
    if (location.pathname.includes("/advanced/errors")) return "errors"
    return "logs"
  }, [location.pathname])

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:gap-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-white">Advanced</h1>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-1">
            Logs, sitemap visualization, and error debugging tools
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mb-1 scrollbar-hide">
          <Link
            to="/admin/advanced"
            className={cn(
              "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap flex-shrink-0",
              activeView === "logs"
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/25"
                : "bg-stone-100 dark:bg-[#2a2a2d] text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-[#3a3a3d]"
            )}
          >
            <ScrollText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Logs
          </Link>
          <Link
            to="/admin/advanced/sitemap"
            className={cn(
              "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap flex-shrink-0",
              activeView === "sitemap"
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/25"
                : "bg-stone-100 dark:bg-[#2a2a2d] text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-[#3a3a3d]"
            )}
          >
            <Map className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Sitemap
          </Link>
          <Link
            to="/admin/advanced/errors"
            className={cn(
              "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap flex-shrink-0",
              activeView === "errors"
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/25"
                : "bg-stone-100 dark:bg-[#2a2a2d] text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-[#3a3a3d]"
            )}
          >
            <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Error Logs
          </Link>
        </div>
      </div>

      {/* Content */}
      {activeView === "logs" && <LogsTab />}
      {activeView === "sitemap" && <SitemapTab />}
      {activeView === "errors" && <ErrorLogsTab />}
    </div>
  )
}
