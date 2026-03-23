import { supabase } from '@/lib/supabaseClient'
import type { EventRow, EventItemRow, EventUserProgressRow } from '@/types/event'

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

/** Fetch all items (eggs) for a given event. */
export async function getEventItems(eventId: string): Promise<EventItemRow[]> {
  const { data, error } = await supabase
    .from('event_items')
    .select('*')
    .eq('event_id', eventId)

  if (error || !data) return []
  return data as EventItemRow[]
}

/** Fetch items the current user has already found for a given event. */
export async function getUserProgress(eventId: string): Promise<EventUserProgressRow[]> {
  const { data, error } = await supabase
    .from('event_user_progress')
    .select('*')
    .eq('event_id', eventId)

  if (error || !data) return []
  return data as EventUserProgressRow[]
}

/** Mark an item as found by the current user. Returns true on success. */
export async function markItemFound(eventId: string, itemId: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('event_user_progress')
    .insert({ event_id: eventId, item_id: itemId, user_id: userId })

  // unique violation means already found — still counts as success
  if (error && error.code !== '23505') return false
  return true
}

/** Record event completion (registration) for a user. */
export async function markEventCompleted(eventId: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('event_registrations')
    .insert({ event_id: eventId, user_id: userId })

  if (error && error.code !== '23505') return false
  return true
}
