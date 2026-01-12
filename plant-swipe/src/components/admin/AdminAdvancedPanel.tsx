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
  ChevronRight,
  ExternalLink,
  Loader2,
  XCircle,
  Clock,
  Copy,
  Palette,
  Users,
} from "lucide-react"
import { AdminColorsPanel } from "./AdminColorsPanel"
import { AdminTeamPanel } from "./AdminTeamPanel"

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
      detail: Record<string, unknown> | null
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
      } catch {
        // Clipboard API not available
      }
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
      detail: Record<string, unknown> | null
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
        const globalEnv = globalThis as { __ENV__?: { VITE_ADMIN_STATIC_TOKEN?: string } }
        const adminToken = globalEnv.__ENV__?.VITE_ADMIN_STATIC_TOKEN
        if (adminToken) headers["X-Admin-Token"] = String(adminToken)
      } catch {
        // Ignore env access errors
      }
      const r = await fetch("/api/admin/admin-logs?days=30", {
        headers,
        credentials: "same-origin",
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(data?.error || `HTTP → ${r.status}`)
      const list = Array.isArray(data?.logs) ? data.logs : []
      setLogs(list)
      setVisibleCount(Math.min(20, list.length || 20))
    } catch (e: unknown) {
      const err = e as { message?: string }
      setError(err?.message || "Failed to load logs")
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
          const globalEnv = globalThis as { __ENV__?: { VITE_ADMIN_STATIC_TOKEN?: string } }
          adminToken = String(globalEnv.__ENV__?.VITE_ADMIN_STATIC_TOKEN || "") || null
        } catch {
          // Ignore env access errors
        }
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
          } catch {
            // Ignore parse errors
          }
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
          } catch {
            // Ignore parse errors
          }
        })
        es.onerror = () => {
          // Ignore SSE errors - connection will retry automatically
        }
      } catch {
        // Ignore SSE setup errors
      }
    })()
    return () => {
      try {
        es?.close()
      } catch {
        // Ignore close errors
      }
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
          <div className="flex items-center gap-2 text-sm opacity-60">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading...</span>
          </div>
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

type SitemapStats = {
  total: number
  byType: Record<string, number>
  byPriority: Record<string, number>
  byLanguage: Record<string, number>
  withLastmod: number
}

// Priority color mapping for visual indicators
const getPriorityColor = (priority: string | undefined) => {
  const p = parseFloat(priority || "0.5")
  if (p >= 0.9) return "bg-emerald-500 text-white"
  if (p >= 0.7) return "bg-emerald-400 text-white"
  if (p >= 0.5) return "bg-amber-400 text-white"
  if (p >= 0.3) return "bg-orange-400 text-white"
  return "bg-stone-400 text-white"
}


// Get type icon based on URL path
const getTypeIcon = (pathname: string) => {
  if (pathname.includes("/blog")) return "📝"
  if (pathname.includes("/plants")) return "🌱"
  if (pathname.includes("/garden")) return "🏡"
  if (pathname.includes("/bookmarks")) return "🔖"
  if (pathname.includes("/u/")) return "👤"
  if (pathname.includes("/contact")) return "📧"
  if (pathname.includes("/search")) return "🔍"
  if (pathname.includes("/discovery")) return "✨"
  if (pathname.includes("/download")) return "📥"
  if (pathname.includes("/pricing")) return "💰"
  if (pathname.includes("/about")) return "ℹ️"
  if (pathname.includes("/terms")) return "📋"
  if (pathname === "/" || pathname === "/fr") return "🏠"
  return "📄"
}

const SitemapTab: React.FC = () => {
  const [entries, setEntries] = React.useState<SitemapEntry[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [filter, setFilter] = React.useState("")
  const [typeFilter, setTypeFilter] = React.useState<string>("all")
  const [langFilter, setLangFilter] = React.useState<string>("all")
  const [priorityFilter, setPriorityFilter] = React.useState<string>("all")
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(new Set(["root"]))
  const [viewMode, setViewMode] = React.useState<"grouped" | "list">("grouped")

  const loadSitemap = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch("/sitemap.xml")
      if (!resp.ok) throw new Error(`Failed to fetch sitemap: ${resp.status}`)
      const text = await resp.text()
      
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
      // Auto-expand first few groups
      const groups = new Set<string>(["root"])
      parsed.slice(0, 50).forEach((entry) => {
        try {
          const url = new URL(entry.loc)
          const pathParts = url.pathname.split("/").filter(Boolean)
          const group = pathParts[0] || "root"
          groups.add(group)
        } catch {
          // ignore
        }
      })
      setExpandedGroups(groups)
    } catch (e: unknown) {
      const err = e as { message?: string }
      setError(err?.message || "Failed to load sitemap")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadSitemap()
  }, [loadSitemap])

  // Calculate statistics
  const stats = React.useMemo<SitemapStats>(() => {
    const byType: Record<string, number> = {}
    const byPriority: Record<string, number> = {}
    const byLanguage: Record<string, number> = {}
    let withLastmod = 0

    entries.forEach((entry) => {
      try {
        const url = new URL(entry.loc)
        const pathParts = url.pathname.split("/").filter(Boolean)
        
        // Detect language
        const lang = pathParts[0] === "fr" ? "fr" : "en"
        byLanguage[lang] = (byLanguage[lang] || 0) + 1
        
        // Detect type (skip language prefix)
        const typePart = lang === "fr" ? pathParts[1] : pathParts[0]
        const type = typePart || "home"
        byType[type] = (byType[type] || 0) + 1
        
        // Priority grouping
        const p = parseFloat(entry.priority || "0.5")
        const pGroup = p >= 0.9 ? "0.9-1.0" : p >= 0.7 ? "0.7-0.8" : p >= 0.5 ? "0.5-0.6" : "0.1-0.4"
        byPriority[pGroup] = (byPriority[pGroup] || 0) + 1
        
        if (entry.lastmod) withLastmod++
      } catch {
        byType["other"] = (byType["other"] || 0) + 1
      }
    })

    return { total: entries.length, byType, byPriority, byLanguage, withLastmod }
  }, [entries])

  // Get unique types for filter dropdown
  const availableTypes = React.useMemo(() => {
    return Object.keys(stats.byType).sort((a, b) => {
      if (a === "home") return -1
      if (b === "home") return 1
      return (stats.byType[b] || 0) - (stats.byType[a] || 0)
    })
  }, [stats.byType])

  // Filter entries
  const filteredEntries = React.useMemo(() => {
    const filtered = entries.filter((entry) => {
      // Text filter
      if (filter.trim()) {
        const q = filter.toLowerCase()
        if (!entry.loc.toLowerCase().includes(q)) return false
      }
      
      try {
        const url = new URL(entry.loc)
        const pathParts = url.pathname.split("/").filter(Boolean)
        
        // Language filter
        if (langFilter !== "all") {
          const lang = pathParts[0] === "fr" ? "fr" : "en"
          if (lang !== langFilter) return false
        }
        
        // Type filter
        if (typeFilter !== "all") {
          const lang = pathParts[0] === "fr" ? "fr" : "en"
          const typePart = lang === "fr" ? pathParts[1] : pathParts[0]
          const type = typePart || "home"
          if (type !== typeFilter) return false
        }
        
        // Priority filter
        if (priorityFilter !== "all") {
          const p = parseFloat(entry.priority || "0.5")
          if (priorityFilter === "high" && p < 0.7) return false
          if (priorityFilter === "medium" && (p < 0.5 || p >= 0.7)) return false
          if (priorityFilter === "low" && p >= 0.5) return false
        }
      } catch {
        return typeFilter === "all" || typeFilter === "other"
      }
      
      return true
    })
    // Sort: English first, then other languages, then by URL
    filtered.sort((a, b) => {
      const aIsEn = !a.loc.includes("/fr/") && !a.loc.endsWith("/fr")
      const bIsEn = !b.loc.includes("/fr/") && !b.loc.endsWith("/fr")
      if (aIsEn && !bIsEn) return -1
      if (!aIsEn && bIsEn) return 1
      return a.loc.localeCompare(b.loc)
    })
    return filtered
  }, [entries, filter, typeFilter, langFilter, priorityFilter])

  // Group entries by path segment
  const groupedEntries = React.useMemo(() => {
    const groups: Record<string, SitemapEntry[]> = {}
    filteredEntries.forEach((entry) => {
      try {
        const url = new URL(entry.loc)
        const pathParts = url.pathname.split("/").filter(Boolean)
        // Skip language prefix for grouping
        const lang = pathParts[0] === "fr" ? "fr" : "en"
        const groupPart = lang === "fr" ? pathParts[1] : pathParts[0]
        const group = groupPart || "root"
        if (!groups[group]) groups[group] = []
        groups[group].push(entry)
      } catch {
        if (!groups["other"]) groups["other"] = []
        groups["other"].push(entry)
      }
    })
    // Sort entries within each group: English first, then French, then by URL
    Object.keys(groups).forEach((group) => {
      groups[group].sort((a, b) => {
        const aIsEn = !a.loc.includes("/fr/") && !a.loc.endsWith("/fr")
        const bIsEn = !b.loc.includes("/fr/") && !b.loc.endsWith("/fr")
        if (aIsEn && !bIsEn) return -1
        if (!aIsEn && bIsEn) return 1
        return a.loc.localeCompare(b.loc)
      })
    })
    return groups
  }, [filteredEntries])

  const groupOrder = Object.keys(groupedEntries).sort((a, b) => {
    if (a === "root") return -1
    if (b === "root") return 1
    return (groupedEntries[b]?.length || 0) - (groupedEntries[a]?.length || 0)
  })

  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(group)) {
        next.delete(group)
      } else {
        next.add(group)
      }
      return next
    })
  }

  const expandAll = () => setExpandedGroups(new Set(groupOrder))
  const collapseAll = () => setExpandedGroups(new Set())

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      const now = new Date()
      const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
      if (diffDays === 0) return "Today"
      if (diffDays === 1) return "Yesterday"
      if (diffDays < 7) return `${diffDays}d ago`
      if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="space-y-4">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                <Map className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-stone-900 dark:text-stone-100">{stats.total}</p>
                <p className="text-xs text-stone-500 dark:text-stone-400">Total URLs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                <span className="text-lg">🌐</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-stone-900 dark:text-stone-100">
                  {Object.keys(stats.byLanguage).length}
                </p>
                <p className="text-xs text-stone-500 dark:text-stone-400">Languages</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-900/30">
                <span className="text-lg">📁</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-stone-900 dark:text-stone-100">
                  {Object.keys(stats.byType).length}
                </p>
                <p className="text-xs text-stone-500 dark:text-stone-400">Content Types</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/30">
                <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-stone-900 dark:text-stone-100">{stats.withLastmod}</p>
                <p className="text-xs text-stone-500 dark:text-stone-400">With Dates</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Priority Distribution */}
      <Card className="rounded-xl">
        <CardContent className="p-4">
          <h4 className="text-sm font-medium mb-3">Priority Distribution</h4>
          <div className="flex gap-1 h-6 rounded-lg overflow-hidden">
            {["0.9-1.0", "0.7-0.8", "0.5-0.6", "0.1-0.4"].map((range) => {
              const count = stats.byPriority[range] || 0
              const pct = stats.total > 0 ? (count / stats.total) * 100 : 0
              if (pct === 0) return null
              const colors: Record<string, string> = {
                "0.9-1.0": "bg-emerald-500",
                "0.7-0.8": "bg-emerald-400",
                "0.5-0.6": "bg-amber-400",
                "0.1-0.4": "bg-orange-400",
              }
              return (
                <div
                  key={range}
                  className={`${colors[range]} relative group cursor-help`}
                  style={{ width: `${pct}%`, minWidth: pct > 0 ? "20px" : 0 }}
                  title={`${range}: ${count} URLs (${pct.toFixed(1)}%)`}
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[10px] font-medium text-white/90 truncate px-1">
                      {pct >= 10 ? `${count}` : ""}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-stone-500 dark:text-stone-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Critical (0.9-1.0)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span> High (0.7-0.8)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span> Medium (0.5-0.6)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-400"></span> Low (0.1-0.4)
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Main Explorer Card */}
      <Card className="rounded-2xl">
        <CardContent className="p-4">
          {/* Header with filters */}
          <div className="flex flex-col gap-4 mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium">Sitemap Explorer</h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  {filteredEntries.length === entries.length
                    ? `${entries.length} URLs indexed`
                    : `${filteredEntries.length} of ${entries.length} URLs`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={viewMode === "grouped" ? "default" : "outline"}
                  className="rounded-lg text-xs h-8"
                  onClick={() => setViewMode("grouped")}
                >
                  Grouped
                </Button>
                <Button
                  size="sm"
                  variant={viewMode === "list" ? "default" : "outline"}
                  className="rounded-lg text-xs h-8"
                  onClick={() => setViewMode("list")}
                >
                  List
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="rounded-xl h-8 w-8"
                  onClick={loadSitemap}
                  disabled={loading}
                  aria-label="Refresh sitemap"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="rounded-xl h-8 w-8"
                  onClick={() => window.open("/sitemap.xml", "_blank")}
                  aria-label="Open raw sitemap"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search URLs..."
                className="h-8 px-3 text-sm rounded-lg border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1a1a1d] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 min-w-[180px] flex-1 sm:flex-none"
              />
              
              <select
                value={langFilter}
                onChange={(e) => setLangFilter(e.target.value)}
                className="h-8 px-2 text-sm rounded-lg border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1a1a1d] focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="all">All Languages</option>
                <option value="en">🇺🇸 English</option>
                <option value="fr">🇫🇷 French</option>
              </select>
              
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="h-8 px-2 text-sm rounded-lg border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1a1a1d] focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="all">All Types</option>
                {availableTypes.map((type) => {
                  const typeLabels: Record<string, string> = {
                    home: "🏠 Home",
                    u: "👤 Profiles",
                    bookmarks: "🔖 Bookmarks",
                    garden: "🏡 Gardens",
                    plants: "🌱 Plants",
                    blog: "📝 Blog",
                    discovery: "✨ Discovery",
                    pricing: "💰 Pricing",
                    contact: "📧 Contact",
                    search: "🔍 Search",
                    download: "📥 Download",
                    about: "ℹ️ About",
                    terms: "📋 Terms",
                  }
                  return (
                    <option key={type} value={type}>
                      {typeLabels[type] || type} ({stats.byType[type]})
                    </option>
                  )
                })}
              </select>
              
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="h-8 px-2 text-sm rounded-lg border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1a1a1d] focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="all">All Priorities</option>
                <option value="high">🔥 High (≥0.7)</option>
                <option value="medium">⚡ Medium (0.5-0.6)</option>
                <option value="low">📉 Low (&lt;0.5)</option>
              </select>

              {(filter || typeFilter !== "all" || langFilter !== "all" || priorityFilter !== "all") && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs text-stone-500 hover:text-stone-700"
                  onClick={() => {
                    setFilter("")
                    setTypeFilter("all")
                    setLangFilter("all")
                    setPriorityFilter("all")
                  }}
                >
                  Clear filters
                </Button>
              )}
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
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
              <p className="text-sm text-stone-500">Loading sitemap...</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12">
              <Map className="h-12 w-12 text-stone-300 dark:text-stone-600 mx-auto mb-3" />
              <p className="text-sm text-stone-500 dark:text-stone-400">
                No sitemap entries found. Make sure /sitemap.xml exists.
              </p>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-stone-500 dark:text-stone-400">
                No URLs match your filters.
              </p>
            </div>
          ) : viewMode === "list" ? (
            /* List View */
            <div className="rounded-xl border border-stone-200 dark:border-[#3e3e42] overflow-hidden">
              <div className="max-h-[500px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-stone-50 dark:bg-[#1a1a1d] sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-medium text-stone-600 dark:text-stone-300">URL</th>
                      <th className="text-center px-2 py-2.5 font-medium text-stone-600 dark:text-stone-300 w-20">Priority</th>
                      <th className="text-center px-2 py-2.5 font-medium text-stone-600 dark:text-stone-300 w-24 hidden sm:table-cell">Freq</th>
                      <th className="text-center px-2 py-2.5 font-medium text-stone-600 dark:text-stone-300 w-24 hidden md:table-cell">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-[#2a2a2d]">
                    {filteredEntries.slice(0, 200).map((entry, idx) => {
                      let pathname = entry.loc
                      try {
                        pathname = new URL(entry.loc).pathname
                      } catch {
                        // Keep original
                      }
                      return (
                        <tr key={idx} className="hover:bg-stone-50 dark:hover:bg-[#1a1a1d] transition-colors">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className="text-base flex-shrink-0">{getTypeIcon(pathname)}</span>
                              <a
                                href={entry.loc}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-600 dark:text-emerald-400 hover:underline truncate max-w-[300px]"
                              >
                                {pathname}
                              </a>
                            </div>
                          </td>
                          <td className="px-2 py-2.5 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(entry.priority)}`}>
                              {entry.priority || "0.5"}
                            </span>
                          </td>
                          <td className="px-2 py-2.5 text-center text-stone-500 dark:text-stone-400 hidden sm:table-cell">
                            {entry.changefreq || "-"}
                          </td>
                          <td className="px-2 py-2.5 text-center text-stone-500 dark:text-stone-400 hidden md:table-cell">
                            {entry.lastmod ? formatDate(entry.lastmod) : "-"}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {filteredEntries.length > 200 && (
                  <div className="px-4 py-3 text-center text-xs text-stone-500 bg-stone-50 dark:bg-[#1a1a1d] border-t border-stone-200 dark:border-[#3e3e42]">
                    Showing 200 of {filteredEntries.length} URLs. Use filters to narrow down.
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Grouped View */
            <div className="space-y-3">
              {/* Expand/Collapse controls */}
              <div className="flex items-center gap-2 text-xs">
                <button
                  onClick={expandAll}
                  className="text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  Expand all
                </button>
                <span className="text-stone-300 dark:text-stone-600">•</span>
                <button
                  onClick={collapseAll}
                  className="text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  Collapse all
                </button>
              </div>

              {groupOrder.map((group) => {
                const isExpanded = expandedGroups.has(group)
                const groupEntries = groupedEntries[group] || []
                const avgPriority = groupEntries.reduce((sum, e) => sum + parseFloat(e.priority || "0.5"), 0) / groupEntries.length
                
                return (
                  <div key={group} className="rounded-xl border border-stone-200 dark:border-[#3e3e42] overflow-hidden">
                    <button
                      onClick={() => toggleGroup(group)}
                      className="w-full px-4 py-3 bg-stone-50 dark:bg-[#1a1a1d] border-b border-stone-200 dark:border-[#3e3e42] hover:bg-stone-100 dark:hover:bg-[#252528] transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <ChevronRight className={`h-4 w-4 text-stone-400 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                          <span className="text-base">{getTypeIcon(`/${group}`)}</span>
                          <span className="font-medium text-sm">
                            /{group === "root" ? "" : group}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(avgPriority.toFixed(1))}`}>
                            avg {avgPriority.toFixed(1)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-stone-500 dark:text-stone-400 bg-stone-200 dark:bg-[#2a2a2d] px-2 py-0.5 rounded-full">
                            {groupEntries.length} URLs
                          </span>
                        </div>
                      </div>
                    </button>
                    
                    {isExpanded && (
                      <div className="divide-y divide-stone-100 dark:divide-[#2a2a2d] max-h-[350px] overflow-y-auto">
                        {groupEntries.map((entry, idx) => {
                          let pathname = entry.loc
                          try {
                            pathname = new URL(entry.loc).pathname
                          } catch {
                            // Keep original
                          }
                          const isAltLang = pathname.startsWith("/fr")
                          
                          return (
                            <div
                              key={idx}
                              className={cn(
                                "px-4 py-2.5 hover:bg-stone-50 dark:hover:bg-[#1a1a1d] transition-colors",
                                isAltLang && "bg-blue-50/50 dark:bg-blue-900/10"
                              )}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 min-w-0">
                                  {isAltLang ? (
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium flex-shrink-0">
                                      FR
                                    </span>
                                  ) : (
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-stone-100 dark:bg-[#2a2a2d] text-stone-500 dark:text-stone-400 font-medium flex-shrink-0">
                                      EN
                                    </span>
                                  )}
                                  <a
                                    href={entry.loc}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline truncate"
                                  >
                                    {pathname}
                                  </a>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(entry.priority)}`}>
                                    {entry.priority || "0.5"}
                                  </span>
                                  {entry.changefreq && (
                                    <span className="text-xs text-stone-400 dark:text-stone-500 hidden sm:inline w-16 text-right">
                                      {entry.changefreq}
                                    </span>
                                  )}
                                  {entry.lastmod && (
                                    <span className="text-xs text-stone-400 dark:text-stone-500 hidden md:inline w-20 text-right">
                                      {formatDate(entry.lastmod)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Type Breakdown */}
      <Card className="rounded-xl">
        <CardContent className="p-4">
          <h4 className="text-sm font-medium mb-3">URLs by Content Type</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {availableTypes.map((type) => {
              const count = stats.byType[type] || 0
              const pct = stats.total > 0 ? ((count / stats.total) * 100).toFixed(1) : "0"
              return (
                <button
                  key={type}
                  onClick={() => setTypeFilter(typeFilter === type ? "all" : type)}
                  className={cn(
                    "flex items-center gap-2 p-2.5 rounded-lg border transition-colors text-left",
                    typeFilter === type
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                      : "border-stone-200 dark:border-[#3e3e42] hover:border-stone-300 dark:hover:border-[#4e4e52]"
                  )}
                >
                  <span className="text-lg">{getTypeIcon(`/${type}`)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {type === "home" ? "Home" : type === "u" ? "Profiles" : type === "bookmarks" ? "Bookmarks" : type === "garden" ? "Gardens" : type}
                    </p>
                    <p className="text-xs text-stone-500 dark:text-stone-400">{count} ({pct}%)</p>
                  </div>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ========================
// MAIN PANEL COMPONENT
// ========================
type AdvancedView = "logs" | "sitemap" | "colors" | "team"

export const AdminAdvancedPanel: React.FC = () => {
  const location = useLocation()
  
  const activeView: AdvancedView = React.useMemo(() => {
    if (location.pathname.includes("/advanced/sitemap")) return "sitemap"
    if (location.pathname.includes("/advanced/colors")) return "colors"
    if (location.pathname.includes("/advanced/team")) return "team"
    return "logs"
  }, [location.pathname])

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:gap-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-white">Advanced</h1>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-1">
            Logs, sitemap visualization, colors, and team management
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
            to="/admin/advanced/colors"
            className={cn(
              "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap flex-shrink-0",
              activeView === "colors"
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/25"
                : "bg-stone-100 dark:bg-[#2a2a2d] text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-[#3a3a3d]"
            )}
          >
            <Palette className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Colors
          </Link>
          <Link
            to="/admin/advanced/team"
            className={cn(
              "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap flex-shrink-0",
              activeView === "team"
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/25"
                : "bg-stone-100 dark:bg-[#2a2a2d] text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-[#3a3a3d]"
            )}
          >
            <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Team
          </Link>
        </div>
      </div>

      {/* Content */}
      {activeView === "logs" && <LogsTab />}
      {activeView === "sitemap" && <SitemapTab />}
      {activeView === "colors" && <AdminColorsPanel />}
      {activeView === "team" && <AdminTeamPanel />}
    </div>
  )
}
