import * as React from "react"
import {
  Loader2,
  RefreshCw,
  Puzzle,
  Calendar as CalendarIcon,
  AlertTriangle,
  Sparkles,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  AdminExportBufferSchedule,
} from "@/components/admin/AdminExportBufferSchedule"
import { AdminExportAphydleAutomation } from "@/components/admin/AdminExportAphydleAutomation"

// Reuse the same Aphydle URL resolver semantics as the landing page so this
// panel works on aphylia.app, staging mirrors, and dev (where it falls back
// to https://aphydle.aphylia.app/). The override knob is VITE_APHYDLE_URL.
function getAphydleApiBase(): string {
  const override = (import.meta.env.VITE_APHYDLE_URL as string | undefined)?.trim()
  if (override) {
    try { return new URL(override).origin } catch { /* fall through */ }
  }
  const candidate =
    (typeof window !== "undefined" && window.location?.origin) ||
    (import.meta.env.VITE_SITE_URL as string | undefined) ||
    "https://aphylia.app"
  try {
    const parsed = new URL(candidate)
    let host = parsed.hostname
    if (host.startsWith("www.")) host = host.slice(4)
    if (!host.startsWith("aphydle.")) host = `aphydle.${host}`
    return `${parsed.protocol}//${host}`
  } catch {
    return "https://aphydle.aphylia.app"
  }
}

type AphydleManifestCard = {
  index: number
  level: number
  kind: "title" | "hint" | "cta" | string
  hintLabel: string | null
  url: string
  bytes?: number
}

type AphydleManifest = {
  puzzleNo: number
  puzzleDate: string
  plant: {
    id: string
    commonName: string
    scientificName: string
    family?: string | null
    imageUrl?: string | null
  }
  cards: AphydleManifestCard[]
  downloadAllUrl: string
  size?: { width: number; height: number }
  format?: string
}

const WEEKDAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const MONTH_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

function formatPuzzleDate(iso: string): { long: string; numeric: string } {
  // The manifest uses YYYY-MM-DD; parse explicitly to avoid TZ surprises.
  const parts = iso.split("-").map((s) => Number.parseInt(s, 10))
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    return { long: iso, numeric: iso }
  }
  const [y, m, d] = parts
  const date = new Date(Date.UTC(y, m - 1, d))
  const dayName = WEEKDAY_LONG[date.getUTCDay()] || ""
  const monthName = MONTH_LONG[m - 1] || ""
  return {
    long: `${dayName}, ${monthName} ${d}, ${y}`,
    numeric: `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`,
  }
}

function buildPuzzleCaption(manifest: AphydleManifest, playUrl: string): string {
  const { long, numeric } = formatPuzzleDate(manifest.puzzleDate)
  const num = String(manifest.puzzleNo).padStart(2, "0")
  const lines: string[] = []
  lines.push(`🌿 Aphydle Puzzle #${num} — ${long}`)
  lines.push("")
  lines.push(`Today (${numeric}), a new mystery plant is hiding behind five cards.`)
  lines.push("Each hint reveals a little more — foliage, climate, living space, and a final clue.")
  lines.push("Can you name it before the cards run out?")
  lines.push("")
  lines.push(`🎯 Play today's puzzle → ${playUrl}`)
  lines.push("🌱 New puzzle every day at midnight UTC.")
  lines.push("")
  lines.push("#aphydle #aphylia #plantgame #botanyquiz #dailypuzzle #plantsofinstagram #plantcare")
  return lines.join("\n")
}

async function fetchPuzzleCardBlobs(
  base: string,
  cards: AphydleManifestCard[],
): Promise<Blob[]> {
  const blobs: Blob[] = []
  // Sort by index so cards arrive in the canonical order (1..5).
  const ordered = [...cards].sort((a, b) => (a.index || 0) - (b.index || 0))
  for (const card of ordered) {
    const url = card.url.startsWith("http") ? card.url : `${base}${card.url}`
    const resp = await fetch(url, { credentials: "omit" })
    if (!resp.ok) {
      throw new Error(`Failed to fetch card ${card.index} from Aphydle (${resp.status})`)
    }
    const blob = await resp.blob()
    blobs.push(blob)
  }
  return blobs
}

export const AdminExportAphydlePanel: React.FC = () => {
  const apiBase = React.useMemo(() => getAphydleApiBase(), [])
  const playUrl = React.useMemo(() => `${apiBase}/`, [apiBase])

  const [manifest, setManifest] = React.useState<AphydleManifest | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string>("")

  const loadManifest = React.useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const resp = await fetch(`${apiBase}/api/puzzle/today`, { credentials: "omit" })
      const data = await resp.json().catch(() => null)
      if (!resp.ok) {
        throw new Error(
          (data && typeof data === "object" && "error" in data && typeof data.error === "string"
            ? data.error
            : `Failed to load Aphydle puzzle (${resp.status})`),
        )
      }
      if (!data || !Array.isArray(data.cards)) {
        throw new Error("Aphydle returned an unexpected manifest shape")
      }
      setManifest(data as AphydleManifest)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load Aphydle puzzle")
      setManifest(null)
    } finally {
      setLoading(false)
    }
  }, [apiBase])

  React.useEffect(() => { void loadManifest() }, [loadManifest])

  const caption = React.useMemo(
    () => (manifest ? buildPuzzleCaption(manifest, playUrl) : ""),
    [manifest, playUrl],
  )

  const cardCount = manifest?.cards?.length || 0
  const dateLabels = React.useMemo(
    () => (manifest ? formatPuzzleDate(manifest.puzzleDate) : null),
    [manifest],
  )

  const getCardBlobs = React.useCallback(async (): Promise<Blob[]> => {
    if (!manifest) throw new Error("No Aphydle puzzle loaded")
    return fetchPuzzleCardBlobs(apiBase, manifest.cards)
  }, [manifest, apiBase])

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border p-4 bg-white/90 dark:bg-[#17171a]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-stone-500 mb-1">
              Aphydle · Today's Puzzle
            </div>
            <div className="text-sm text-stone-500 break-all">
              <span className="font-mono">{apiBase}/api/puzzle/today</span>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadManifest()}
            disabled={loading}
            className="gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        </div>

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>{error}</div>
          </div>
        )}

        {manifest && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#1a1a1d] p-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-stone-500">
                <Puzzle className="h-3.5 w-3.5" /> Puzzle
              </div>
              <div className="mt-1 text-2xl font-bold tabular-nums">
                #{String(manifest.puzzleNo).padStart(2, "0")}
              </div>
              {dateLabels && (
                <div className="mt-1 inline-flex items-center gap-1.5 text-xs text-stone-500">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {dateLabels.long} <span className="opacity-60">· {dateLabels.numeric}</span>
                </div>
              )}
            </div>
            <div className="rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#1a1a1d] p-3 flex items-start gap-3">
              {manifest.plant.imageUrl ? (
                <img
                  src={manifest.plant.imageUrl}
                  alt={manifest.plant.commonName}
                  loading="lazy"
                  className="h-16 w-16 rounded-lg object-cover bg-stone-200 dark:bg-stone-800 shrink-0"
                />
              ) : (
                <div className="h-16 w-16 rounded-lg bg-stone-200 dark:bg-stone-800 shrink-0 flex items-center justify-center text-2xl">
                  🌿
                </div>
              )}
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-wide text-stone-500">Mystery plant</div>
                <div className="font-semibold truncate">{manifest.plant.commonName}</div>
                <div className="text-xs italic text-stone-500 truncate">
                  {manifest.plant.scientificName}
                </div>
                {manifest.plant.family && (
                  <div className="text-[11px] text-stone-400 truncate">
                    {manifest.plant.family}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {manifest && (
          <div className="mt-4">
            <div className="text-xs uppercase tracking-[0.2em] text-stone-500 mb-2 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Cards · {cardCount} × {manifest.size?.width || 1080}×{manifest.size?.height || 1080}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {manifest.cards
                .slice()
                .sort((a, b) => (a.index || 0) - (b.index || 0))
                .map((card) => {
                  const url = card.url.startsWith("http") ? card.url : `${apiBase}${card.url}`
                  return (
                    <div
                      key={card.index}
                      className="rounded-xl overflow-hidden border border-stone-200 dark:border-stone-700 bg-black/5 dark:bg-black/20"
                    >
                      <div className="aspect-square bg-stone-100 dark:bg-stone-900">
                        <img
                          src={url}
                          alt={`Aphydle card ${card.index}`}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="px-2 py-1.5 text-[11px] flex items-center justify-between">
                        <span className="font-mono uppercase tracking-wider text-stone-500">
                          {String(card.index).padStart(2, "0")} · {card.kind}
                        </span>
                        {card.hintLabel && (
                          <span className="text-stone-700 dark:text-stone-200 truncate">
                            {card.hintLabel}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        )}
      </div>

      {manifest && caption && (
        <div className="rounded-2xl border bg-white/90 dark:bg-[#17171a] p-4 space-y-3">
          <div className="text-xs uppercase tracking-[0.2em] text-stone-500">
            Post caption (auto-generated from manifest)
          </div>
          <pre className="m-0 p-3 rounded-xl bg-[#0f1011] font-mono text-[13px] leading-relaxed text-stone-100 whitespace-pre-wrap break-words border border-stone-300 dark:border-stone-700/60 max-h-[280px] overflow-auto">
            {caption}
          </pre>
        </div>
      )}

      <AdminExportAphydleAutomation />

      {manifest && caption && (
        <AdminExportBufferSchedule
          caption={caption}
          getCardBlobs={getCardBlobs}
          cardCount={cardCount}
          plantName={`Aphydle #${manifest.puzzleNo}`}
          disabled={loading}
        />
      )}
    </div>
  )
}

export default AdminExportAphydlePanel
