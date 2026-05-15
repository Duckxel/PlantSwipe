import * as React from "react"
import {
  Loader2,
  RefreshCw,
  AlertTriangle,
  Calendar as CalendarIcon,
  CheckCircle2,
  PlayCircle,
  Save,
  Zap,
  Sparkles,
  Leaf,
  Shuffle,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { SearchItem, type SearchItemOption } from "@/components/ui/search-item"
import { buildAdminRequestHeaders } from "@/lib/adminAuth"
import { supabase } from "@/lib/supabaseClient"

type DayKey = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat"
const DAY_LIST: Array<{ key: DayKey; short: string; medium: string; full: string }> = [
  { key: "mon", short: "Mon", medium: "Mon", full: "Monday" },
  { key: "tue", short: "Tue", medium: "Tue", full: "Tuesday" },
  { key: "wed", short: "Wed", medium: "Wed", full: "Wednesday" },
  { key: "thu", short: "Thu", medium: "Thu", full: "Thursday" },
  { key: "fri", short: "Fri", medium: "Fri", full: "Friday" },
  { key: "sat", short: "Sat", medium: "Sat", full: "Saturday" },
  { key: "sun", short: "Sun", medium: "Sun", full: "Sunday" },
]

type BufferOrganization = { id: string; name: string }
type BufferChannel = { id: string; name: string; service: string }
type ScheduleConfig = {
  id: string
  enabled: boolean
  days_of_week: DayKey[]
  publish_time_local: string
  run_time_local: string
  timezone: string
  organization_id: string | null
  channel_ids: string[]
  upcoming_plant_id: string | null
  last_posted_plant_id?: string | null
  last_run_at?: string | null
  last_run_for_date?: string | null
  last_run_status?: string | null
  last_run_results?: unknown
}
type UpcomingPlant = {
  id: string
  name: string | null
  source: "pinned" | "featured-random" | "fallback-random"
} | null

const SUPPORTED_SERVICES = ["instagram", "facebook", "twitter"] as const
const SERVICE_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  twitter: "Twitter / X",
}
function isSupportedService(s: string): boolean {
  return (SUPPORTED_SERVICES as readonly string[]).includes(s)
}

function formatTimestamp(s?: string | null): string {
  if (!s) return "—"
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleString()
}

function sourceBadge(source: UpcomingPlant): { label: string; tone: "pinned" | "auto" } {
  if (!source) return { label: "—", tone: "auto" }
  if (source.source === "pinned") return { label: "Pinned", tone: "pinned" }
  if (source.source === "featured-random") return { label: "Auto · Featured this month", tone: "auto" }
  return { label: "Auto · Fallback (no featured plant)", tone: "auto" }
}

export const AdminExportAphyliaAutomation: React.FC = () => {
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [running, setRunning] = React.useState(false)
  const [loadError, setLoadError] = React.useState<string>("")
  const [saveMsg, setSaveMsg] = React.useState<string>("")
  const [saveErr, setSaveErr] = React.useState<string>("")
  const [runMsg, setRunMsg] = React.useState<string>("")
  const [runErr, setRunErr] = React.useState<string>("")
  const [reservedMinutes, setReservedMinutes] = React.useState<string[]>([])

  const [enabled, setEnabled] = React.useState(false)
  const [daysSelected, setDaysSelected] = React.useState<Record<DayKey, boolean>>({
    sun: false, mon: false, tue: false, wed: false, thu: false, fri: false, sat: false,
  })
  const [publishTime, setPublishTime] = React.useState("13:00")
  const [runTime, setRunTime] = React.useState("04:00")
  const [serverTimezone, setServerTimezone] = React.useState("UTC")
  const [serverName, setServerName] = React.useState<string>("UNKNOWN")
  const [isAutomationRunner, setIsAutomationRunner] = React.useState<boolean>(false)

  const [organizations, setOrganizations] = React.useState<BufferOrganization[]>([])
  const [organizationId, setOrganizationId] = React.useState<string>("")
  const [orgLoading, setOrgLoading] = React.useState(false)
  const [orgError, setOrgError] = React.useState<string>("")

  const [channels, setChannels] = React.useState<BufferChannel[]>([])
  const [channelsLoading, setChannelsLoading] = React.useState(false)
  const [channelsError, setChannelsError] = React.useState<string>("")
  const [selectedChannels, setSelectedChannels] = React.useState<Record<string, boolean>>({})

  // Plant picker — null/empty means "Auto (random Featured)"
  const [upcomingPlantId, setUpcomingPlantId] = React.useState<string>("")
  const [upcomingPreview, setUpcomingPreview] = React.useState<UpcomingPlant>(null)
  const [pickedPlantOption, setPickedPlantOption] = React.useState<SearchItemOption | null>(null)

  const [lastRunAt, setLastRunAt] = React.useState<string | null>(null)
  const [lastRunStatus, setLastRunStatus] = React.useState<string | null>(null)
  const [lastRunForDate, setLastRunForDate] = React.useState<string | null>(null)
  const [lastPostedPlantId, setLastPostedPlantId] = React.useState<string | null>(null)

  // -- Loaders -----------------------------------------------------------
  const loadConfig = React.useCallback(async () => {
    setLoading(true)
    setLoadError("")
    try {
      const headers = await buildAdminRequestHeaders({ Accept: "application/json" })
      const resp = await fetch("/api/admin/aphylia-schedule", { headers })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(data?.error || `Failed (${resp.status})`)
      setReservedMinutes(Array.isArray(data?.reservedMinutes) ? data.reservedMinutes : [])
      setServerTimezone(typeof data?.serverTimezone === "string" ? data.serverTimezone : "UTC")
      setServerName(typeof data?.serverName === "string" ? data.serverName : "UNKNOWN")
      setIsAutomationRunner(data?.isAutomationRunner === true)
      const cfg: ScheduleConfig = data?.config || ({} as ScheduleConfig)
      setEnabled(!!cfg.enabled)
      const next: Record<DayKey, boolean> = { sun: false, mon: false, tue: false, wed: false, thu: false, fri: false, sat: false }
      for (const d of cfg.days_of_week || []) {
        if (d in next) next[d as DayKey] = true
      }
      setDaysSelected(next)
      if (cfg.publish_time_local) setPublishTime(cfg.publish_time_local)
      if (cfg.run_time_local) setRunTime(cfg.run_time_local)
      if (cfg.organization_id) setOrganizationId(cfg.organization_id)
      const chSel: Record<string, boolean> = {}
      for (const id of cfg.channel_ids || []) chSel[id] = true
      setSelectedChannels(chSel)
      setUpcomingPlantId(cfg.upcoming_plant_id || "")
      setLastRunAt(cfg.last_run_at || null)
      setLastRunStatus(cfg.last_run_status || null)
      setLastRunForDate(cfg.last_run_for_date || null)
      setLastPostedPlantId(cfg.last_posted_plant_id || null)
      setUpcomingPreview((data?.upcoming || null) as UpcomingPlant)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load schedule")
    } finally {
      setLoading(false)
    }
  }, [])

  const loadOrganizations = React.useCallback(async () => {
    setOrgLoading(true)
    setOrgError("")
    try {
      const headers = await buildAdminRequestHeaders({ Accept: "application/json" })
      const resp = await fetch("/api/admin/buffer/organizations", { headers })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(data?.error || `Failed (${resp.status})`)
      const orgs: BufferOrganization[] = Array.isArray(data?.organizations) ? data.organizations : []
      setOrganizations(orgs)
      setOrganizationId((prev) => prev || (orgs[0]?.id ?? ""))
    } catch (e) {
      setOrgError(e instanceof Error ? e.message : "Failed to load organizations")
    } finally {
      setOrgLoading(false)
    }
  }, [])

  const loadChannels = React.useCallback(async (orgId: string) => {
    if (!orgId) return
    setChannelsLoading(true)
    setChannelsError("")
    try {
      const headers = await buildAdminRequestHeaders({ Accept: "application/json" })
      const resp = await fetch(`/api/admin/buffer/channels?organizationId=${encodeURIComponent(orgId)}`, { headers })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(data?.error || `Failed (${resp.status})`)
      const all: BufferChannel[] = Array.isArray(data?.channels) ? data.channels : []
      const filtered = all.filter((c) => isSupportedService((c.service || "").toLowerCase()))
      setChannels(filtered)
    } catch (e) {
      setChannelsError(e instanceof Error ? e.message : "Failed to load channels")
      setChannels([])
    } finally {
      setChannelsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void loadConfig()
    void loadOrganizations()
  }, [loadConfig, loadOrganizations])

  React.useEffect(() => {
    if (organizationId) void loadChannels(organizationId)
  }, [organizationId, loadChannels])

  // -- Plant search (mirrors AdminExportPanel.searchPlants) -------------
  const searchPlants = React.useCallback(
    async (query: string): Promise<SearchItemOption[]> => {
      let q = supabase
        .from("plants")
        .select("id,name,scientific_name_species,status")
        .or("status.is.null,status.neq.in_progress")
        .order("name")
        .limit(30)
      if (query.trim()) q = q.ilike("name", `%${query.trim()}%`)
      const { data } = await q
      if (!data?.length) return []
      const ids = data.map((p) => (p as { id: string }).id)
      const [imgsRes, transRes] = await Promise.all([
        supabase
          .from("plant_images")
          .select("plant_id,link")
          .in("plant_id", ids)
          .eq("use", "primary"),
        supabase
          .from("plant_translations")
          .select("plant_id,language,variety")
          .in("plant_id", ids)
          .eq("language", "en"),
      ])
      const imgMap = new Map(
        ((imgsRes.data as { plant_id: string; link: string }[]) || []).map(
          (i) => [i.plant_id, i.link],
        ),
      )
      const varMap = new Map(
        ((transRes.data as { plant_id: string; variety: string | null }[]) || []).map(
          (t) => [t.plant_id, (t.variety || "").trim()],
        ),
      )
      return data.map((p) => {
        const id = (p as { id: string }).id
        return {
          id,
          label: ((p as { name?: string }).name as string) || "Unknown",
          description: varMap.get(id) || "",
          meta: imgMap.get(id) || "",
        }
      })
    },
    [],
  )

  // Load the current pinned plant's option once so the trigger displays the
  // name (the SearchItem is async so it doesn't know the label otherwise).
  React.useEffect(() => {
    if (!upcomingPlantId) {
      setPickedPlantOption(null)
      return
    }
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from("plants")
        .select("id,name")
        .eq("id", upcomingPlantId)
        .maybeSingle()
      if (!cancelled && data) {
        setPickedPlantOption({
          id: (data as { id: string }).id,
          label: ((data as { name?: string }).name as string) || "Unknown",
        })
      }
    })()
    return () => { cancelled = true }
  }, [upcomingPlantId])

  // -- Validation helpers ------------------------------------------------
  const runTimeReserved = React.useMemo(
    () => reservedMinutes.includes(runTime),
    [reservedMinutes, runTime],
  )
  const selectedDayKeys = React.useMemo(
    () => (Object.keys(daysSelected) as DayKey[]).filter((d) => daysSelected[d]),
    [daysSelected],
  )
  const selectedChannelIds = React.useMemo(
    () => Object.keys(selectedChannels).filter((id) => selectedChannels[id]),
    [selectedChannels],
  )

  // -- Mutations ---------------------------------------------------------
  const saveConfig = async () => {
    setSaveMsg("")
    setSaveErr("")
    if (runTimeReserved) {
      setSaveErr(`Run time ${runTime} clashes with a reserved system job. Pick another minute.`)
      return
    }
    if (enabled && !selectedDayKeys.length) {
      setSaveErr("Pick at least one day of the week before enabling.")
      return
    }
    if (enabled && !selectedChannelIds.length) {
      setSaveErr("Pick at least one channel before enabling.")
      return
    }
    setSaving(true)
    try {
      const headers = await buildAdminRequestHeaders({
        "Content-Type": "application/json",
        Accept: "application/json",
      })
      const resp = await fetch("/api/admin/aphylia-schedule", {
        method: "PUT",
        headers,
        body: JSON.stringify({
          enabled,
          days_of_week: selectedDayKeys,
          publish_time_local: publishTime,
          run_time_local: runTime,
          organization_id: organizationId || null,
          channel_ids: selectedChannelIds,
          upcoming_plant_id: upcomingPlantId || null,
        }),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(data?.error || `Save failed (${resp.status})`)
      setSaveMsg("Saved")
      window.setTimeout(() => setSaveMsg(""), 3000)
      await loadConfig()
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "Failed to save schedule")
    } finally {
      setSaving(false)
    }
  }

  const runNow = async (dryRun: boolean) => {
    setRunErr("")
    setRunMsg("")
    setRunning(true)
    try {
      const headers = await buildAdminRequestHeaders({
        "Content-Type": "application/json",
        Accept: "application/json",
      })
      const resp = await fetch("/api/admin/aphylia-schedule/run-now", {
        method: "POST",
        headers,
        body: JSON.stringify({ dryRun }),
      })
      const data = await resp.json().catch(() => ({}))
      if (resp.status >= 400 && resp.status < 500) {
        throw new Error(data?.error || `Run failed (${resp.status})`)
      }
      const ok = data?.ok === true
      const summary = data?.results
        ? data.results.map((r: { service?: string; ok: boolean; error?: string }) =>
            `${SERVICE_LABELS[r.service || ""] || r.service || "?"}: ${r.ok ? "ok" : (r.error || "failed")}`,
          ).join(" · ")
        : (data?.error ? `error — ${data.error}` : "")
      const dryTag = dryRun ? "(dry run) " : ""
      const plantTag = data?.pickedPlant?.name ? ` · ${data.pickedPlant.name}` : ""
      setRunMsg(`${dryTag}${ok ? "Done" : "Partial"}${plantTag}${summary ? ` — ${summary}` : ""}`)
      await loadConfig()
    } catch (e) {
      setRunErr(e instanceof Error ? e.message : "Failed to run schedule")
    } finally {
      setRunning(false)
    }
  }

  // -- Render ------------------------------------------------------------
  const channelsByService = React.useMemo(() => {
    const map: Record<string, BufferChannel[]> = {}
    for (const c of channels) {
      const key = (c.service || "").toLowerCase()
      if (!map[key]) map[key] = []
      map[key].push(c)
    }
    return map
  }, [channels])

  const toggleDay = (k: DayKey) => setDaysSelected((prev) => ({ ...prev, [k]: !prev[k] }))
  const toggleChannel = (id: string) => setSelectedChannels((prev) => ({ ...prev, [id]: !prev[id] }))

  const upcomingBadge = sourceBadge(upcomingPreview)

  return (
    <div className="rounded-2xl border bg-white/90 dark:bg-[#17171a] p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-stone-500">
            Aphylia daily automation
          </div>
          <div className="text-xs text-stone-400 mt-0.5">
            Renders + posts plant cards on Buffer on the chosen days. Pick a specific plant or
            leave it on Auto to draw a random plant from this month's Featured pool each run.
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-2"
          onClick={() => { void loadConfig(); void loadOrganizations() }}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Reload
        </Button>
      </div>

      {loadError && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>{loadError}</div>
        </div>
      )}

      {/* Enable */}
      <div className="flex items-center justify-between rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#1a1a1d] p-3">
        <div>
          <div className="text-sm font-semibold flex items-center gap-2">
            <Zap className="h-4 w-4 text-emerald-500" />
            Automation
          </div>
          <div className="text-xs text-stone-500">
            When enabled, the runner renders the upcoming plant's cards at the chosen run time
            and schedules them on Buffer for the chosen publish time on selected days.
          </div>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>

      {/* Upcoming plant — picker + preview */}
      <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/20 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <Label className="text-xs uppercase tracking-wide text-stone-500 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
            Upcoming plant
          </Label>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              upcomingBadge.tone === "pinned"
                ? "bg-emerald-600 text-white"
                : "bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300"
            }`}
          >
            {upcomingBadge.label}
          </span>
        </div>
        <div className="mb-2 flex items-center gap-2 text-sm">
          <Leaf className="h-4 w-4 text-emerald-600" />
          <span className="font-semibold text-stone-900 dark:text-stone-100 truncate">
            {upcomingPreview?.name || "—"}
          </span>
          {upcomingPreview?.id && (
            <span className="font-mono text-[11px] text-stone-500 truncate">
              ({upcomingPreview.id})
            </span>
          )}
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-start">
          <div>
            <Label className="mb-1 block text-[11px] uppercase tracking-wide text-stone-500">
              Pin a specific plant (optional)
            </Label>
            <SearchItem
              value={upcomingPlantId || null}
              onSelect={(opt) => {
                setUpcomingPlantId(opt.id)
                setPickedPlantOption(opt)
              }}
              onClear={() => {
                setUpcomingPlantId("")
                setPickedPlantOption(null)
              }}
              onSearch={searchPlants}
              initialOption={pickedPlantOption}
              placeholder="Auto: pick a random Featured plant"
              title="Pick the upcoming Aphylia plant"
              searchPlaceholder="Search plants by name…"
              emptyMessage="No plants matching that search."
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 sm:mt-5"
            onClick={() => {
              setUpcomingPlantId("")
              setPickedPlantOption(null)
            }}
            disabled={!upcomingPlantId}
            title="Clear pinned plant — automation will pick a random Featured plant on each run"
          >
            <Shuffle className="h-4 w-4" />
            Use Auto
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-stone-500">
          When no plant is pinned, the runner draws a random plant from this month's Featured pool
          (falls back to any active plant if none are featured this month).
        </p>
      </div>

      {/* Days of the week */}
      <div>
        <Label className="mb-2 block text-xs uppercase tracking-wide text-stone-500">
          Days to publish
        </Label>
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2 w-full">
          {DAY_LIST.map((d) => {
            const active = !!daysSelected[d.key]
            return (
              <button
                key={d.key}
                type="button"
                title={d.full}
                aria-pressed={active}
                onClick={() => toggleDay(d.key)}
                className={`h-10 w-full rounded-xl border text-sm font-semibold transition-colors px-1 ${
                  active
                    ? "bg-emerald-600 text-white border-emerald-600 shadow"
                    : "bg-white dark:bg-[#1a1a1d] border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
                }`}
              >
                <span className="hidden md:inline">{d.full}</span>
                <span className="hidden sm:inline md:hidden">{d.medium}</span>
                <span className="sm:hidden">{d.short}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Runner / timezone info */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#1a1a1d] px-3 py-2 text-xs">
        <span className="font-semibold uppercase tracking-wide text-stone-500">Server</span>
        <span className="rounded-full border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/60 px-2 py-0.5 font-mono">
          {serverName}
        </span>
        <span className="rounded-full border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/60 px-2 py-0.5 font-mono">
          {serverTimezone}
        </span>
        <span className="font-semibold uppercase tracking-wide text-stone-500">Runner</span>
        {isAutomationRunner ? (
          <span className="rounded-full border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-emerald-700 dark:text-emerald-300">
            this box is the recurring runner
          </span>
        ) : (
          <span className="rounded-full border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 text-amber-800 dark:text-amber-200">
            recurring runner is OFF here (only fires when VITE_SERVER_NAME=MAIN)
          </span>
        )}
      </div>

      {/* Times */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="aphylia-publish-time" className="mb-1 block text-xs uppercase tracking-wide text-stone-500">
            Publish time ({serverTimezone})
          </Label>
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-stone-500" />
            <Input
              id="aphylia-publish-time"
              type="time"
              step={60}
              value={publishTime}
              onChange={(e) => setPublishTime(e.target.value)}
            />
          </div>
          <p className="mt-1 text-[11px] text-stone-500">
            The dueAt time Buffer should publish the post (same day as the run).
          </p>
        </div>
        <div>
          <Label htmlFor="aphylia-run-time" className="mb-1 block text-xs uppercase tracking-wide text-stone-500">
            Run time ({serverTimezone})
          </Label>
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-stone-500" />
            <Input
              id="aphylia-run-time"
              type="time"
              step={60}
              value={runTime}
              onChange={(e) => setRunTime(e.target.value)}
            />
          </div>
          {runTimeReserved ? (
            <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">
              {runTime} is reserved by a system job — pick another minute.
            </p>
          ) : (
            <p className="mt-1 text-[11px] text-stone-500">
              When the runner fires (typically a few hours before publish). Reserved: {reservedMinutes.join(", ") || "—"}.
            </p>
          )}
        </div>
      </div>

      {/* Org + channels */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="aphylia-org" className="mb-1 block text-xs uppercase tracking-wide text-stone-500">
            Buffer organization
          </Label>
          {orgLoading ? (
            <div className="flex items-center gap-2 text-sm text-stone-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : orgError ? (
            <div className="text-sm text-red-600 dark:text-red-400">{orgError}</div>
          ) : organizations.length === 0 ? (
            <div className="text-sm text-stone-500">No organizations.</div>
          ) : (
            <Select id="aphylia-org" value={organizationId} onChange={(e) => setOrganizationId(e.target.value)}>
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>{o.name || o.id}</option>
              ))}
            </Select>
          )}
        </div>
        <div className="text-xs text-stone-500 self-end">
          {selectedChannelIds.length} channel{selectedChannelIds.length === 1 ? "" : "s"} · {selectedDayKeys.length} day{selectedDayKeys.length === 1 ? "" : "s"} selected
        </div>
      </div>

      <div>
        <Label className="mb-1 block text-xs uppercase tracking-wide text-stone-500">Channels</Label>
        {channelsLoading ? (
          <div className="flex items-center gap-2 text-sm text-stone-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading channels…
          </div>
        ) : channelsError ? (
          <div className="text-sm text-red-600 dark:text-red-400">{channelsError}</div>
        ) : channels.length === 0 ? (
          <div className="text-sm text-stone-500">No supported channels for this org.</div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {SUPPORTED_SERVICES.map((service) => {
              const list = channelsByService[service] || []
              if (!list.length) return null
              return (
                <div key={service} className="rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#1a1a1d] p-3">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                    {SERVICE_LABELS[service]}
                  </div>
                  <div className="space-y-1.5">
                    {list.map((c) => (
                      <label key={c.id} className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={!!selectedChannels[c.id]}
                          onChange={() => toggleChannel(c.id)}
                          className="h-4 w-4 rounded border-input"
                        />
                        <span className="truncate">{c.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Last run */}
      <div className="rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#1a1a1d] p-3 text-xs text-stone-600 dark:text-stone-300">
        <div className="font-semibold uppercase tracking-wide text-stone-500 mb-1">Last run</div>
        <div>When: <span className="text-stone-800 dark:text-stone-100">{formatTimestamp(lastRunAt)}</span></div>
        <div>For date: <span className="text-stone-800 dark:text-stone-100">{lastRunForDate || "—"}</span></div>
        <div>Status: <span className="text-stone-800 dark:text-stone-100">{lastRunStatus || "—"}</span></div>
        <div>Plant: <span className="text-stone-800 dark:text-stone-100 font-mono">{lastPostedPlantId || "—"}</span></div>
      </div>

      {/* Save / Run errors */}
      {saveErr && (
        <div className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-700 dark:bg-red-950/40 dark:text-red-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>{saveErr}</div>
        </div>
      )}
      {runErr && (
        <div className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-700 dark:bg-red-950/40 dark:text-red-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>{runErr}</div>
        </div>
      )}
      {runMsg && (
        <div className="flex items-start gap-2 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <div>{runMsg}</div>
        </div>
      )}

      {/* Buttons */}
      <div className="flex flex-col-reverse items-stretch justify-end gap-2 sm:flex-row sm:items-center">
        <div className="text-xs text-stone-500 sm:mr-auto">
          {saveMsg && <span className="text-emerald-600 dark:text-emerald-400">{saveMsg}</span>}
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => void runNow(true)}
          disabled={running || saving || !selectedChannelIds.length}
          className="gap-2"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
          Dry run
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => void runNow(false)}
          disabled={running || saving || !selectedChannelIds.length}
          className="gap-2"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
          Run now
        </Button>
        <Button
          type="button"
          onClick={() => void saveConfig()}
          disabled={saving || running}
          className="gap-2"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save
        </Button>
      </div>
    </div>
  )
}

export default AdminExportAphyliaAutomation
