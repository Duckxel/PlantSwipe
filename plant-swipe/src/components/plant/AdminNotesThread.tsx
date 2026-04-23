import React from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { MessageSquare, Pencil, Trash2, Check, X, Send } from 'lucide-react'
import type { PlantAdminNote } from '@/types/plantHistory'
import {
  createPlantAdminNote,
  deletePlantAdminNote,
  fetchPlantAdminNotes,
  updatePlantAdminNote,
} from '@/lib/plantAdminNotes'
import { fetchDisplayNames } from '@/lib/displayNameLookup'

interface Actor {
  id: string | null
}

interface Props {
  plantId: string | null | undefined
  actor: Actor
  /** Bumped by parent when external events (history panel refresh) should also refresh notes. */
  refreshVersion?: number
  /** Notify parent of changes (so the history panel can refetch). */
  onChanged?: () => void
}

const formatStamp = (iso: string): string => {
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const initialsFor = (name: string | null): string => {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() || '').join('') || '?'
}

export const AdminNotesThread: React.FC<Props> = ({ plantId, actor, refreshVersion = 0, onChanged }) => {
  const [notes, setNotes] = React.useState<PlantAdminNote[]>([])
  const [loading, setLoading] = React.useState(false)
  const [draft, setDraft] = React.useState('')
  const [posting, setPosting] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editDraft, setEditDraft] = React.useState('')
  const [nameById, setNameById] = React.useState<Map<string, string>>(new Map())

  const refresh = React.useCallback(async () => {
    if (!plantId) { setNotes([]); return }
    setLoading(true)
    try {
      const rows = await fetchPlantAdminNotes(plantId)
      setNotes(rows)
      const ids = rows.map((r) => r.authorId).filter((x): x is string => Boolean(x))
      setNameById(await fetchDisplayNames(ids))
    } finally {
      setLoading(false)
    }
  }, [plantId])

  React.useEffect(() => { void refresh() }, [refresh, refreshVersion])

  const resolveName = (note: PlantAdminNote): string =>
    (note.authorId && nameById.get(note.authorId)) || 'Unknown'

  const handleSubmit = async () => {
    if (!plantId || posting) return
    const body = draft.trim()
    if (!body) return
    setPosting(true)
    try {
      const note = await createPlantAdminNote(plantId, body, { authorId: actor.id })
      if (note) {
        setNotes((prev) => [...prev, note])
        setDraft('')
        onChanged?.()
      }
    } finally {
      setPosting(false)
    }
  }

  const beginEdit = (note: PlantAdminNote) => {
    setEditingId(note.id)
    setEditDraft(note.body)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditDraft('')
  }

  const commitEdit = async (note: PlantAdminNote) => {
    const next = editDraft.trim()
    if (!next || next === note.body) { cancelEdit(); return }
    const updated = await updatePlantAdminNote(note, next, { authorId: actor.id })
    if (updated) {
      setNotes((prev) => prev.map((n) => (n.id === note.id ? updated : n)))
      onChanged?.()
    }
    cancelEdit()
  }

  const remove = async (note: PlantAdminNote) => {
    const ok = await deletePlantAdminNote(note, { authorId: actor.id })
    if (ok) {
      setNotes((prev) => prev.filter((n) => n.id !== note.id))
      onChanged?.()
    }
  }

  if (!plantId) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 dark:border-[#3e3e42] p-5 text-sm text-muted-foreground">
        Save the plant first to enable admin notes.
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-sky-200/70 dark:border-sky-800/40 bg-sky-50/40 dark:bg-sky-950/10 shadow-sm">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-sky-200/60 dark:border-sky-800/30">
        <MessageSquare className="h-4 w-4 text-sky-700 dark:text-sky-300" />
        <h3 className="text-sm font-semibold text-sky-900 dark:text-sky-100">Admin Notes</h3>
        <span className="text-xs text-muted-foreground ml-auto">
          {notes.length > 0 ? `${notes.length} ${notes.length === 1 ? 'note' : 'notes'}` : 'No notes yet'}
        </span>
      </div>

      <div className="px-4 py-3 space-y-3 max-h-[420px] overflow-y-auto">
        {loading && !notes.length && (
          <div className="text-sm text-muted-foreground">Loading notes…</div>
        )}
        {!loading && !notes.length && (
          <div className="text-sm text-muted-foreground italic">
            No notes yet — start the conversation below.
          </div>
        )}
        {notes.map((note) => {
          const isEditing = editingId === note.id
          const edited = note.updatedAt && note.updatedAt !== note.createdAt
          return (
            <div key={note.id} className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-sky-600 text-white flex items-center justify-center text-xs font-semibold flex-shrink-0">
                {initialsFor(resolveName(note))}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline flex-wrap gap-2">
                  <span className="text-sm font-medium text-sky-900 dark:text-sky-100">
                    {resolveName(note)}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {formatStamp(note.createdAt)}
                    {edited ? ` · edited ${formatStamp(note.updatedAt)}` : ''}
                  </span>
                  {!isEditing && (
                    <span className="ml-auto flex items-center gap-1">
                      <button
                        type="button"
                        aria-label="Edit note"
                        className="p-1 rounded hover:bg-sky-100 dark:hover:bg-sky-900/40 text-sky-700 dark:text-sky-300"
                        onClick={() => beginEdit(note)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Delete note"
                        className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
                        onClick={() => remove(note)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  )}
                </div>
                {isEditing ? (
                  <div className="mt-1 space-y-2">
                    <Textarea
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      rows={3}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button size="sm" type="button" onClick={() => void commitEdit(note)}>
                        <Check className="h-3.5 w-3.5" /> Save
                      </Button>
                      <Button size="sm" type="button" variant="secondary" onClick={cancelEdit}>
                        <X className="h-3.5 w-3.5" /> Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-0.5 text-sm whitespace-pre-wrap text-stone-800 dark:text-stone-100 leading-snug">
                    {note.body}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="px-4 py-3 border-t border-sky-200/60 dark:border-sky-800/30 space-y-2">
        <Textarea
          placeholder="Write an internal note… (all note actions are recorded in History)"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              e.preventDefault()
              void handleSubmit()
            }
          }}
        />
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">Ctrl/⌘ + Enter to post</span>
          <Button type="button" size="sm" onClick={() => void handleSubmit()} disabled={posting || !draft.trim()}>
            <Send className="h-3.5 w-3.5" /> Post note
          </Button>
        </div>
      </div>
    </div>
  )
}

export default AdminNotesThread
