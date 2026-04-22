import { supabase } from '@/lib/supabaseClient'
import type { PlantAdminNote } from '@/types/plantHistory'
import { logPlantHistory } from '@/lib/plantHistory'

/* eslint-disable @typescript-eslint/no-explicit-any -- dynamic supabase rows */

const rowToNote = (row: any): PlantAdminNote => ({
  id: row.id,
  plantId: row.plant_id,
  authorId: row.author_id ?? null,
  authorName: row.author_name ?? null,
  body: row.body,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

export async function fetchPlantAdminNotes(plantId: string): Promise<PlantAdminNote[]> {
  if (!plantId) return []
  const { data, error } = await supabase
    .from('plant_admin_notes')
    .select('*')
    .eq('plant_id', plantId)
    .order('created_at', { ascending: true })
  if (error) {
    console.warn('[plantAdminNotes] fetch failed', error.message)
    return []
  }
  return (data || []).map(rowToNote)
}

interface Actor {
  authorId?: string | null
  authorName?: string | null
}

export async function createPlantAdminNote(
  plantId: string,
  body: string,
  actor: Actor,
): Promise<PlantAdminNote | null> {
  const trimmed = body.trim()
  if (!plantId || !trimmed) return null
  const { data, error } = await supabase
    .from('plant_admin_notes')
    .insert({
      plant_id: plantId,
      author_id: actor.authorId ?? null,
      author_name: actor.authorName ?? null,
      body: trimmed,
    })
    .select('*')
    .maybeSingle()
  if (error || !data) {
    console.warn('[plantAdminNotes] create failed', error?.message)
    return null
  }
  await logPlantHistory({
    plantId,
    authorId: actor.authorId,
    authorName: actor.authorName,
    action: 'note_add',
    summary: 'Added note',
    newValue: trimmed,
  })
  return rowToNote(data)
}

export async function updatePlantAdminNote(
  note: PlantAdminNote,
  nextBody: string,
  actor: Actor,
): Promise<PlantAdminNote | null> {
  const trimmed = nextBody.trim()
  if (!trimmed || trimmed === note.body) return note
  const { data, error } = await supabase
    .from('plant_admin_notes')
    .update({ body: trimmed, updated_at: new Date().toISOString() })
    .eq('id', note.id)
    .select('*')
    .maybeSingle()
  if (error || !data) {
    console.warn('[plantAdminNotes] update failed', error?.message)
    return null
  }
  await logPlantHistory({
    plantId: note.plantId,
    authorId: actor.authorId,
    authorName: actor.authorName,
    action: 'note_edit',
    summary: note.authorName && note.authorName !== actor.authorName
      ? `Edited note by ${note.authorName}`
      : 'Edited note',
    oldValue: note.body,
    newValue: trimmed,
  })
  return rowToNote(data)
}

export async function deletePlantAdminNote(
  note: PlantAdminNote,
  actor: Actor,
): Promise<boolean> {
  const { error } = await supabase
    .from('plant_admin_notes')
    .delete()
    .eq('id', note.id)
  if (error) {
    console.warn('[plantAdminNotes] delete failed', error.message)
    return false
  }
  await logPlantHistory({
    plantId: note.plantId,
    authorId: actor.authorId,
    authorName: actor.authorName,
    action: 'note_delete',
    summary: note.authorName && note.authorName !== actor.authorName
      ? `Deleted note by ${note.authorName}`
      : 'Deleted own note',
    oldValue: note.body,
  })
  return true
}
