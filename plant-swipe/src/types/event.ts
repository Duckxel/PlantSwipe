// ── PERMANENT tables ─────────────────────────────────────────

/** Row from the `events` table — event definitions (kept forever). */
export type EventRow = {
  id: string
  name: string
  description: string | null
  event_type: string
  starts_at: string | null
  ends_at: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

/** Row from `event_registrations` — users who completed an event (kept forever). */
export type EventRegistrationRow = {
  id: string
  event_id: string
  user_id: string
  completed_at: string
}

// ── TEMPORARY tables (cleared after event ends) ──────────────

/** Row from `event_items` — collectible items (eggs, etc.). Cleared on cleanup. */
export type EventItemRow = {
  id: string
  event_id: string
  page_path: string
  description: string
  position_seed: number
  created_at: string
}

/** Row from `event_user_progress` — per-user discovery tracking. Cleared on cleanup. */
export type EventUserProgressRow = {
  id: string
  event_id: string
  item_id: string
  user_id: string
  found_at: string
}
