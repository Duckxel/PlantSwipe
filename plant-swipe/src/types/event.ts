export type EventRow = {
  id: string
  name: string
  description: string | null
  starts_at: string | null
  ends_at: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type EventEggRow = {
  id: string
  event_id: string
  page_path: string
  description: string
  position_seed: number
  created_at: string
}

export type EventUserEggRow = {
  id: string
  event_id: string
  egg_id: string
  user_id: string
  found_at: string
}

export type EventCompletionRow = {
  id: string
  event_id: string
  user_id: string
  completed_at: string
}
