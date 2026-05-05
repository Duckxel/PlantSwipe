import React from 'react'
import { ChevronDown, ChevronUp, History as HistoryIcon, Languages, Pencil, Plus, Sparkles, StickyNote, Trash2 } from 'lucide-react'
import type { PlantHistoryEntry, PlantHistoryAction } from '@/types/plantHistory'
import { fetchPlantHistory } from '@/lib/plantHistory'
import { fetchDisplayNames } from '@/lib/displayNameLookup'

interface Props {
  plantId: string | null | undefined
  refreshVersion?: number
  /** Optional initial open state. */
  defaultOpen?: boolean
}

const actionIcon = (action: PlantHistoryAction) => {
  switch (action) {
    case 'translate': return Languages
    case 'ai_fill': return Sparkles
    case 'note_add': return Plus
    case 'note_edit': return Pencil
    case 'note_delete': return Trash2
    case 'create': return Plus
    case 'status_change': return StickyNote
    default: return Pencil
  }
}

const actionColor = (action: PlantHistoryAction): string => {
  switch (action) {
    case 'translate': return 'text-indigo-600 dark:text-indigo-300'
    case 'ai_fill': return 'text-amber-600 dark:text-amber-300'
    case 'note_add': return 'text-emerald-600 dark:text-emerald-300'
    case 'note_edit': return 'text-sky-600 dark:text-sky-300'
    case 'note_delete': return 'text-red-600 dark:text-red-300'
    case 'create': return 'text-emerald-600 dark:text-emerald-300'
    case 'status_change': return 'text-purple-600 dark:text-purple-300'
    default: return 'text-stone-600 dark:text-stone-300'
  }
}

const formatTime = (iso: string): string => {
  const d = new Date(iso)
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

const formatDateHeading = (iso: string): string => {
  const d = new Date(iso)
  const today = new Date()
  const same = d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate()
  const yday = new Date(today); yday.setDate(today.getDate() - 1)
  const isYday = d.getFullYear() === yday.getFullYear() && d.getMonth() === yday.getMonth() && d.getDate() === yday.getDate()
  if (same) return 'Today'
  if (isYday) return 'Yesterday'
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

const hourBucket = (iso: string): string => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`
}

const dateBucket = (iso: string): string => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

interface EntryGroup {
  key: string
  authorId: string | null
  hour: string
  startIso: string
  endIso: string
  entries: PlantHistoryEntry[]
}

/**
 * Group consecutive entries with the same (author_id, calendar-hour).
 * Unknown authors (no author_id — profile deleted) are grouped together as 'anon'.
 * Both groups and the entries inside each group are returned newest-first.
 */
function groupEntries(entries: PlantHistoryEntry[]): EntryGroup[] {
  // Iterate oldest-first to build groups; we reverse afterwards for display.
  const ascending = [...entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const groups: EntryGroup[] = []
  const identity = (e: PlantHistoryEntry) => e.authorId || 'anon'
  for (const e of ascending) {
    const bucket = hourBucket(e.createdAt)
    const last = groups[groups.length - 1]
    const lastIdentity = last ? (last.authorId || 'anon') : null
    if (last && last.hour === bucket && lastIdentity === identity(e)) {
      last.entries.push(e)
      last.endIso = e.createdAt
    } else {
      groups.push({
        key: `${bucket}-${identity(e)}-${e.id}`,
        authorId: e.authorId || null,
        hour: bucket,
        startIso: e.createdAt,
        endIso: e.createdAt,
        entries: [e],
      })
    }
  }
  // Reverse entries inside each group so the newest change appears at the top,
  // matching the newest-first ordering of the groups themselves.
  for (const g of groups) g.entries.reverse()
  return groups.reverse()
}

const initialsFor = (name: string | null): string => {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() || '').join('') || '?'
}

export const PlantHistoryPanel: React.FC<Props> = ({ plantId, refreshVersion = 0, defaultOpen = false }) => {
  const [entries, setEntries] = React.useState<PlantHistoryEntry[]>([])
  const [loading, setLoading] = React.useState(false)
  const [open, setOpen] = React.useState(defaultOpen)
  const [nameById, setNameById] = React.useState<Map<string, string>>(new Map())

  const refresh = React.useCallback(async () => {
    if (!plantId) { setEntries([]); return }
    setLoading(true)
    try {
      const rows = await fetchPlantHistory(plantId, 300)
      setEntries(rows)
      const ids = rows.map((r) => r.authorId).filter((x): x is string => Boolean(x))
      setNameById(await fetchDisplayNames(ids))
    } finally {
      setLoading(false)
    }
  }, [plantId])

  React.useEffect(() => { void refresh() }, [refresh, refreshVersion])

  const resolveName = React.useCallback(
    (authorId: string | null): string =>
      (authorId && nameById.get(authorId)) || 'Unknown',
    [nameById],
  )

  const groups = React.useMemo(() => groupEntries(entries), [entries])

  // Render with day headings inserted whenever the calendar day changes.
  const rendered = React.useMemo(() => {
    const out: React.ReactNode[] = []
    let prevDate: string | null = null
    for (const g of groups) {
      const dBucket = dateBucket(g.startIso)
      if (dBucket !== prevDate) {
        out.push(
          <div
            key={`heading-${dBucket}`}
            className="sticky top-0 z-10 -mx-4 px-4 py-1 bg-stone-100/90 dark:bg-[#1b1b1d]/90 backdrop-blur border-y border-stone-200/70 dark:border-[#3e3e42]/60 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
          >
            {formatDateHeading(g.startIso)}
          </div>,
        )
        prevDate = dBucket
      }
      const displayName = resolveName(g.authorId)
      out.push(
        <div key={g.key} className="flex gap-3 pt-2 pb-2 border-b border-stone-200/40 dark:border-[#3e3e42]/30 last:border-b-0">
          <div className="h-7 w-7 rounded-full bg-stone-300 dark:bg-stone-700 text-stone-800 dark:text-stone-100 flex items-center justify-center text-[10px] font-semibold flex-shrink-0">
            {initialsFor(displayName)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-xs font-semibold text-stone-800 dark:text-stone-100">
                {displayName}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {formatTime(g.startIso)}{g.entries.length > 1 ? ` · ${g.entries.length} changes` : ''}
              </span>
            </div>
            <ul className="mt-1 space-y-0.5">
              {g.entries.map((e) => {
                const Icon = actionIcon(e.action)
                return (
                  <li key={e.id} className="flex items-center gap-2 text-[12px] leading-snug">
                    <Icon className={`h-3 w-3 flex-shrink-0 ${actionColor(e.action)}`} />
                    <span className="text-muted-foreground tabular-nums text-[10px] w-10">
                      {formatTime(e.createdAt)}
                    </span>
                    <span className="truncate text-stone-700 dark:text-stone-200" title={e.summary || undefined}>
                      {e.summary || e.field || e.action}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>,
      )
    }
    return out
  }, [groups, resolveName])

  return (
    <div className="rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white/80 dark:bg-[#17171a]/80">
      <button
        type="button"
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-stone-50 dark:hover:bg-[#1f1f22] rounded-2xl transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <HistoryIcon className="h-4 w-4 text-stone-600 dark:text-stone-300" />
        <h3 className="text-sm font-semibold text-stone-800 dark:text-stone-100">Change History</h3>
        <span className="text-xs text-muted-foreground ml-2">
          {loading ? 'loading…' : entries.length > 0 ? `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}` : 'No history yet'}
        </span>
        <span className="ml-auto text-muted-foreground">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4 max-h-[420px] overflow-y-auto">
          {!plantId ? (
            <p className="text-sm text-muted-foreground">Save the plant to start tracking history.</p>
          ) : !entries.length && !loading ? (
            <p className="text-sm text-muted-foreground italic">No changes recorded yet.</p>
          ) : (
            <div className="divide-y divide-stone-200/30 dark:divide-[#3e3e42]/20">
              {rendered}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default PlantHistoryPanel
