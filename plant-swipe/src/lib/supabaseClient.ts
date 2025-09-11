import { createClient } from '@supabase/supabase-js'
import { getEnvAny } from '@/lib/utils'

// Allow the same values to drive both frontend and dev API
const supabaseUrl = getEnvAny(['VITE_SUPABASE_URL', 'SUPABASE_URL'])
const supabaseAnonKey = getEnvAny(['VITE_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY'])

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Disable URL session detection to avoid any unnecessary waiting on success paths
    detectSessionInUrl: false,
    storageKey: 'plantswipe.auth',
  },
})

export type ProfileRow = {
  id: string
  display_name: string | null
  avatar_url: string | null
  liked_plant_ids: string[] | null
}

// Garden-related table row types matching Supabase schema expectations
export type GardenRow = {
  id: string
  name: string
  cover_image_url: string | null
  created_by: string
  created_at: string
}

export type GardenMemberRow = {
  garden_id: string
  user_id: string
  role: 'owner' | 'member'
  joined_at: string
}

export type GardenPlantRow = {
  id: string
  garden_id: string
  plant_id: string
  nickname: string | null
  seeds_planted: number
  planted_at: string | null
  expected_bloom_date: string | null
}

export type GardenPlantEventRow = {
  id: string
  garden_plant_id: string
  event_type: 'water' | 'fertilize' | 'prune' | 'harvest' | 'note'
  occurred_at: string
  notes: string | null
  next_due_at: string | null
}

export type GardenInventoryRow = {
  id: string
  garden_id: string
  plant_id: string
  seeds_on_hand: number
  plants_on_hand: number
}

export type GardenTransactionRow = {
  id: string
  garden_id: string
  plant_id: string
  type: 'buy_seeds' | 'sell_seeds' | 'buy_plants' | 'sell_plants'
  quantity: number
  occurred_at: string
  notes: string | null
}


