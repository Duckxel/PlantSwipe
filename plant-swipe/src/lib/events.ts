import { supabase } from '@/lib/supabaseClient'
import type { EventRow, EventItemRow, EventUserProgressRow } from '@/types/event'

/** Fetch the currently active event (if any), with translations applied for the given language. */
export async function getActiveEvent(lang?: string): Promise<EventRow | null> {
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
  const event = data as EventRow

  // Apply translation overlay if a non-default language is requested
  if (lang && lang !== 'en') {
    const { data: translation } = await supabase
      .from('event_translations')
      .select('name, description')
      .eq('event_id', event.id)
      .eq('language', lang)
      .single()

    if (translation) {
      if (translation.name) event.name = translation.name
      if (translation.description) event.description = translation.description
    }
  }

  return event
}

/** Fetch all items (eggs) for a given event, with translations applied for the given language. */
export async function getEventItems(eventId: string, lang?: string): Promise<EventItemRow[]> {
  const { data, error } = await supabase
    .from('event_items')
    .select('*')
    .eq('event_id', eventId)

  if (error || !data) return []
  const items = data as EventItemRow[]

  // Apply translation overlays
  if (lang && lang !== 'en' && items.length > 0) {
    const itemIds = items.map((i) => i.id)
    const { data: translations } = await supabase
      .from('event_item_translations')
      .select('item_id, description')
      .in('item_id', itemIds)
      .eq('language', lang)

    if (translations) {
      const translationMap = new Map(translations.map((t) => [t.item_id, t.description]))
      for (const item of items) {
        const translated = translationMap.get(item.id)
        if (translated) item.description = translated
      }
    }
  }

  return items
}

/** Fetch items the current user has already found for a given event. */
export async function getUserProgress(eventId: string, userId: string): Promise<EventUserProgressRow[]> {
  const { data, error } = await supabase
    .from('event_user_progress')
    .select('*')
    .eq('event_id', eventId)
    .eq('user_id', userId)

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
