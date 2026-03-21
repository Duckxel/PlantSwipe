import { supabase } from '@/lib/supabaseClient'
import type { EventRow, EventEggRow, EventUserEggRow } from '@/types/event'

/** Fetch the currently active event (if any). */
export async function getActiveEvent(): Promise<EventRow | null> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('is_active', true)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gte.${now}`)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) return null
  return data as EventRow
}

/** Fetch all eggs for a given event. */
export async function getEventEggs(eventId: string): Promise<EventEggRow[]> {
  const { data, error } = await supabase
    .from('event_eggs')
    .select('*')
    .eq('event_id', eventId)

  if (error || !data) return []
  return data as EventEggRow[]
}

/** Fetch eggs the current user has already found for a given event. */
export async function getUserFoundEggs(eventId: string): Promise<EventUserEggRow[]> {
  const { data, error } = await supabase
    .from('event_user_eggs')
    .select('*')
    .eq('event_id', eventId)

  if (error || !data) return []
  return data as EventUserEggRow[]
}

/** Mark an egg as found by the current user. Returns true if newly found. */
export async function markEggFound(eventId: string, eggId: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('event_user_eggs')
    .insert({ event_id: eventId, egg_id: eggId, user_id: userId })

  // unique violation means already found — still counts as success
  if (error && error.code !== '23505') return false
  return true
}

/** Record event completion for a user. */
export async function markEventCompleted(eventId: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('event_completions')
    .insert({ event_id: eventId, user_id: userId })

  if (error && error.code !== '23505') return false
  return true
}
