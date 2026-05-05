import React from "react"
import confetti from "canvas-confetti"
import {
  Download,
  Send,
  Loader2,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Calendar,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { buildAdminRequestHeaders } from "@/lib/adminAuth"

type BufferOrganization = { id: string; name: string }
type BufferChannel = { id: string; name: string; service: string }
type ScheduleResult = {
  channelId: string
  ok: boolean
  post?: { id: string; text: string; dueAt?: string | null }
  error?: string
}

const SUPPORTED_SERVICES = ["instagram", "facebook", "twitter"] as const
type SupportedService = (typeof SUPPORTED_SERVICES)[number]

const SERVICE_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  twitter: "Twitter / X",
}

function isSupportedService(service: string): service is SupportedService {
  return (SUPPORTED_SERVICES as readonly string[]).includes(service)
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

// Format a Date as a value usable by <input type="datetime-local"> (local TZ)
function toLocalInputValue(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = pad2(d.getMonth() + 1)
  const dd = pad2(d.getDate())
  const hh = pad2(d.getHours())
  const mi = pad2(d.getMinutes())
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
}

function downloadTextFile(filename: string, contents: string) {
  const blob = new Blob([contents], { type: "text/plain;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

function fireConfettiBurst() {
  const duration = 1200
  const end = Date.now() + duration
  const colors = ["#4ade80", "#22c55e", "#16a34a", "#facc15", "#f97316", "#ef4444", "#8b5cf6", "#3b82f6"]
  const frame = () => {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 70,
      origin: { x: 0, y: 0.7 },
      colors,
    })
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 70,
      origin: { x: 1, y: 0.7 },
      colors,
    })
    if (Date.now() < end) requestAnimationFrame(frame)
  }
  // Big initial burst from center
  confetti({
    particleCount: 140,
    spread: 90,
    startVelocity: 45,
    origin: { x: 0.5, y: 0.5 },
    colors,
  })
  frame()
}

const DEFAULT_TEMPLATE = `🌱 New from PlantSwipe!

Discover beautiful plants, build your dream garden, and connect with a community of plant lovers.

#plants #gardening #plantswipe`

const SCHEDULE_PRESETS: Array<{ label: string; minutesFromNow: number }> = [
  { label: "In 1 hour", minutesFromNow: 60 },
  { label: "In 3 hours", minutesFromNow: 180 },
  { label: "Tomorrow 9 AM", minutesFromNow: -1 }, // special-cased below
  { label: "Next Monday 9 AM", minutesFromNow: -2 }, // special-cased below
]

function presetToDate(label: string, minutesFromNow: number): Date {
  const now = new Date()
  if (minutesFromNow >= 0) {
    return new Date(now.getTime() + minutesFromNow * 60 * 1000)
  }
  if (label === "Tomorrow 9 AM") {
    const d = new Date(now)
    d.setDate(d.getDate() + 1)
    d.setHours(9, 0, 0, 0)
    return d
  }
  if (label === "Next Monday 9 AM") {
    const d = new Date(now)
    const day = d.getDay() // 0 Sun .. 6 Sat
    const diff = ((1 - day + 7) % 7) || 7 // days until next Monday
    d.setDate(d.getDate() + diff)
    d.setHours(9, 0, 0, 0)
    return d
  }
  return now
}

export const AdminExportPage: React.FC = () => {
  const [text, setText] = React.useState<string>(DEFAULT_TEMPLATE)
  const [filename, setFilename] = React.useState<string>("plantswipe-post.txt")

  const [organizations, setOrganizations] = React.useState<BufferOrganization[]>([])
  const [organizationId, setOrganizationId] = React.useState<string>("")
  const [orgLoading, setOrgLoading] = React.useState<boolean>(false)
  const [orgError, setOrgError] = React.useState<string>("")

  const [channels, setChannels] = React.useState<BufferChannel[]>([])
  const [channelsLoading, setChannelsLoading] = React.useState<boolean>(false)
  const [channelsError, setChannelsError] = React.useState<string>("")
  const [selectedChannels, setSelectedChannels] = React.useState<Record<string, boolean>>({})

  // Default schedule: 1 hour from now
  const initialSchedule = React.useMemo(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000)
    return toLocalInputValue(d)
  }, [])
  const [scheduleAt, setScheduleAt] = React.useState<string>(initialSchedule)
  const [addToQueue, setAddToQueue] = React.useState<boolean>(false)

  const [submitting, setSubmitting] = React.useState<boolean>(false)
  const [submitError, setSubmitError] = React.useState<string>("")
  const [results, setResults] = React.useState<ScheduleResult[] | null>(null)
  const [showSuccess, setShowSuccess] = React.useState<boolean>(false)

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
      if (orgs.length && !organizationId) {
        setOrganizationId(orgs[0].id)
      }
    } catch (e) {
      setOrgError(e instanceof Error ? e.message : "Failed to load organizations")
    } finally {
      setOrgLoading(false)
    }
  }, [organizationId])

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
      // Default-select all supported channels
      const next: Record<string, boolean> = {}
      filtered.forEach((c) => { next[c.id] = true })
      setSelectedChannels(next)
    } catch (e) {
      setChannelsError(e instanceof Error ? e.message : "Failed to load channels")
      setChannels([])
      setSelectedChannels({})
    } finally {
      setChannelsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadOrganizations().catch(() => {})
  }, [loadOrganizations])

  React.useEffect(() => {
    if (organizationId) {
      loadChannels(organizationId).catch(() => {})
    } else {
      setChannels([])
      setSelectedChannels({})
    }
  }, [organizationId, loadChannels])

  const toggleChannel = (id: string) => {
    setSelectedChannels((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const handleDownload = () => {
    const safeName = filename.trim() || "plantswipe-post.txt"
    const finalName = safeName.endsWith(".txt") ? safeName : `${safeName}.txt`
    downloadTextFile(finalName, text)
  }

  const handlePresetClick = (label: string, minutesFromNow: number) => {
    const d = presetToDate(label, minutesFromNow)
    setScheduleAt(toLocalInputValue(d))
    setAddToQueue(false)
  }

  const selectedChannelIds = React.useMemo(
    () => Object.keys(selectedChannels).filter((id) => selectedChannels[id]),
    [selectedChannels],
  )

  const handleSchedule = async () => {
    setSubmitError("")
    setResults(null)
    if (!text.trim()) {
      setSubmitError("Post text cannot be empty")
      return
    }
    if (!selectedChannelIds.length) {
      setSubmitError("Select at least one channel")
      return
    }
    let dueAtIso: string | null = null
    if (!addToQueue) {
      const t = Date.parse(scheduleAt)
      if (Number.isNaN(t)) {
        setSubmitError("Pick a valid schedule date and time")
        return
      }
      if (t <= Date.now()) {
        setSubmitError("Schedule must be in the future")
        return
      }
      dueAtIso = new Date(t).toISOString()
    }

    setSubmitting(true)
    try {
      const headers = await buildAdminRequestHeaders({
        "Content-Type": "application/json",
        Accept: "application/json",
      })
      const resp = await fetch("/api/admin/buffer/post", {
        method: "POST",
        headers,
        body: JSON.stringify({
          text,
          channelIds: selectedChannelIds,
          dueAt: dueAtIso,
        }),
      })
      const data = await resp.json().catch(() => ({}))
      const list: ScheduleResult[] = Array.isArray(data?.results) ? data.results : []
      setResults(list)
      const allOk = list.length > 0 && list.every((r) => r.ok)
      if (!resp.ok && !list.length) {
        throw new Error(data?.error || `Schedule failed (${resp.status})`)
      }
      if (allOk) {
        fireConfettiBurst()
        setShowSuccess(true)
      } else {
        const failed = list.filter((r) => !r.ok)
        if (failed.length) {
          setSubmitError(`Some posts failed: ${failed.map((f) => f.error || "Unknown").join("; ")}`)
        } else if (!resp.ok) {
          setSubmitError(data?.error || `Schedule failed (${resp.status})`)
        }
      }
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Failed to schedule post")
    } finally {
      setSubmitting(false)
    }
  }

  const channelsByService = React.useMemo(() => {
    const map: Record<string, BufferChannel[]> = {}
    for (const c of channels) {
      const key = (c.service || "").toLowerCase()
      if (!map[key]) map[key] = []
      map[key].push(c)
    }
    return map
  }, [channels])

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:py-10">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Export & Schedule</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate a text post, download it as a file, and optionally schedule it on Instagram, Facebook, or Twitter via Buffer.
          </p>
        </div>
      </div>

      {/* Generate / Download */}
      <section className="mb-8 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-emerald-500" />
          <h2 className="text-lg font-semibold">Generated text</h2>
        </div>
        <div className="grid gap-4">
          <div>
            <Label htmlFor="export-text" className="mb-1 block text-sm">Description</Label>
            <Textarea
              id="export-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder="Write the post description that will be downloaded and scheduled..."
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {text.length} characters · this same text is used for both the downloaded file and the social post.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Label htmlFor="export-filename" className="mb-1 block text-sm">Filename</Label>
              <Input
                id="export-filename"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="plantswipe-post.txt"
              />
            </div>
            <Button onClick={handleDownload} variant="secondary" className="gap-2">
              <Download className="h-4 w-4" />
              Download .txt
            </Button>
          </div>
        </div>
      </section>

      {/* Schedule via Buffer */}
      <section className="mb-8 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Send className="h-5 w-5 text-emerald-500" />
            <h2 className="text-lg font-semibold">Schedule on social media</h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={() => {
              loadOrganizations().catch(() => {})
              if (organizationId) loadChannels(organizationId).catch(() => {})
            }}
            disabled={orgLoading || channelsLoading}
          >
            <RefreshCw className={`h-4 w-4 ${orgLoading || channelsLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <div className="grid gap-5">
          {/* Organization */}
          <div>
            <Label htmlFor="buffer-org" className="mb-1 block text-sm">Buffer organization</Label>
            {orgLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading organizations...
              </div>
            ) : orgError ? (
              <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <div className="font-medium">Could not load organizations</div>
                  <div className="opacity-80">{orgError}</div>
                  <div className="mt-1 text-xs opacity-70">Make sure the BUFFER environment variable is set on the server.</div>
                </div>
              </div>
            ) : organizations.length === 0 ? (
              <div className="text-sm text-muted-foreground">No organizations found.</div>
            ) : (
              <Select
                id="buffer-org"
                value={organizationId}
                onChange={(e) => setOrganizationId(e.target.value)}
              >
                {organizations.map((o) => (
                  <option key={o.id} value={o.id}>{o.name || o.id}</option>
                ))}
              </Select>
            )}
          </div>

          {/* Channels */}
          <div>
            <Label className="mb-1 block text-sm">Channels</Label>
            {channelsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading channels...
              </div>
            ) : channelsError ? (
              <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>{channelsError}</div>
              </div>
            ) : channels.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No Instagram, Facebook, or Twitter channels are connected to this Buffer organization.
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {SUPPORTED_SERVICES.map((service) => {
                  const list = channelsByService[service] || []
                  if (!list.length) return null
                  return (
                    <div key={service} className="rounded-lg border border-border bg-background p-3">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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

          {/* Schedule time */}
          <div>
            <Label htmlFor="schedule-at" className="mb-1 block text-sm">When should it post?</Label>

            <div className="mb-3 flex flex-wrap gap-2">
              {SCHEDULE_PRESETS.map((p) => (
                <Button
                  key={p.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handlePresetClick(p.label, p.minutesFromNow)}
                >
                  {p.label}
                </Button>
              ))}
              <Button
                type="button"
                variant={addToQueue ? "default" : "outline"}
                size="sm"
                onClick={() => setAddToQueue((v) => !v)}
              >
                {addToQueue ? "✓ Add to Buffer queue" : "Add to Buffer queue"}
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Input
                id="schedule-at"
                type="datetime-local"
                value={scheduleAt}
                onChange={(e) => {
                  setScheduleAt(e.target.value)
                  setAddToQueue(false)
                }}
                disabled={addToQueue}
                className="max-w-xs"
              />
              {addToQueue ? (
                <span className="text-xs text-muted-foreground">Buffer will pick the next slot in your queue.</span>
              ) : (
                <span className="text-xs text-muted-foreground">Local time</span>
              )}
            </div>
          </div>

          {submitError && (
            <div className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-700 dark:bg-red-950/40 dark:text-red-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>{submitError}</div>
            </div>
          )}

          <div className="flex flex-col-reverse items-stretch justify-end gap-2 sm:flex-row sm:items-center">
            <div className="text-xs text-muted-foreground sm:mr-auto">
              {selectedChannelIds.length} channel{selectedChannelIds.length === 1 ? "" : "s"} selected
            </div>
            <Button
              onClick={handleSchedule}
              disabled={submitting || !selectedChannelIds.length}
              className="gap-2"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {submitting ? "Scheduling..." : "Schedule post"}
            </Button>
          </div>
        </div>
      </section>

      {/* Success modal with confetti */}
      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              Scheduled!
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p>
              Your post was scheduled successfully on {results?.length || 0} channel
              {(results?.length || 0) === 1 ? "" : "s"}.
            </p>
            {results && results.length > 0 && (
              <ul className="space-y-1 rounded-md bg-secondary/50 p-3 text-xs">
                {results.map((r, i) => {
                  const ch = channels.find((c) => c.id === r.channelId)
                  const when = r.post?.dueAt ? new Date(r.post.dueAt).toLocaleString() : "Queued"
                  return (
                    <li key={`${r.channelId}-${i}`} className="flex items-center justify-between gap-2">
                      <span className="truncate">{ch ? `${SERVICE_LABELS[ch.service] || ch.service} · ${ch.name}` : r.channelId}</span>
                      <span className="text-muted-foreground">{when}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowSuccess(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AdminExportPage
