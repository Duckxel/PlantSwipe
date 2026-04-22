import { supabase } from '@/lib/supabaseClient'
import type { PlantHistoryAction, PlantHistoryEntry } from '@/types/plantHistory'

/* eslint-disable @typescript-eslint/no-explicit-any -- dynamic supabase rows */

const MAX_SNIPPET_LEN = 240

const clip = (s: string | null | undefined): string | null => {
  if (s == null) return null
  if (s.length <= MAX_SNIPPET_LEN) return s
  return s.slice(0, MAX_SNIPPET_LEN - 1) + '…'
}

const rowToEntry = (row: any): PlantHistoryEntry => ({
  id: row.id,
  plantId: row.plant_id,
  authorId: row.author_id ?? null,
  action: row.action as PlantHistoryAction,
  field: row.field ?? null,
  summary: row.summary ?? null,
  oldValue: row.old_value ?? null,
  newValue: row.new_value ?? null,
  createdAt: row.created_at,
})

export interface LogPlantHistoryInput {
  plantId: string
  authorId?: string | null
  action: PlantHistoryAction
  field?: string | null
  summary?: string | null
  oldValue?: string | null
  newValue?: string | null
}

export async function logPlantHistory(input: LogPlantHistoryInput): Promise<void> {
  if (!input.plantId) return
  const payload = {
    plant_id: input.plantId,
    author_id: input.authorId ?? null,
    action: input.action,
    field: input.field ?? null,
    summary: clip(input.summary),
    old_value: clip(input.oldValue),
    new_value: clip(input.newValue),
  }
  const { error } = await supabase.from('plant_history').insert(payload)
  if (error) {
    // History is best-effort; log but never block the main action.
    console.warn('[plantHistory] insert failed', error.message)
  }
}

export async function logPlantHistoryBatch(entries: LogPlantHistoryInput[]): Promise<void> {
  if (!entries.length) return
  const payload = entries.map((e) => ({
    plant_id: e.plantId,
    author_id: e.authorId ?? null,
    action: e.action,
    field: e.field ?? null,
    summary: clip(e.summary),
    old_value: clip(e.oldValue),
    new_value: clip(e.newValue),
  }))
  const { error } = await supabase.from('plant_history').insert(payload)
  if (error) {
    console.warn('[plantHistory] batch insert failed', error.message)
  }
}

export async function fetchPlantHistory(plantId: string, limit = 200): Promise<PlantHistoryEntry[]> {
  if (!plantId) return []
  const { data, error } = await supabase
    .from('plant_history')
    .select('*')
    .eq('plant_id', plantId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    console.warn('[plantHistory] fetch failed', error.message)
    return []
  }
  return (data || []).map(rowToEntry)
}
