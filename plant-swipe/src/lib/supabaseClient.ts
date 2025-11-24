import { createClient } from '@supabase/supabase-js'
import { getEnvAny } from '@/lib/utils'

// Frontend should only consume public env vars. Accept common prefixes for portability.
const supabaseUrl = getEnvAny([
  'VITE_SUPABASE_URL',
  'REACT_APP_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
])
const supabaseAnonKey = getEnvAny([
  'VITE_SUPABASE_ANON_KEY',
  'REACT_APP_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
])

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Disable URL session detection to avoid any unnecessary waiting on success paths
    detectSessionInUrl: false,
    storageKey: 'plantswipe.auth',
  },
  realtime: {
    // Reconnect automatically with exponential backoff
    reconnectAfterMs: (tries: number) => {
      // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
      return Math.min(1000 * Math.pow(2, tries), 30000)
    },
    // Heartbeat to detect connection issues
    heartbeatIntervalMs: 30000,
  },
  global: {
    // Add timeout to prevent hanging requests
    fetch: (url, options = {}) => {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s timeout
      
      return fetch(url, {
        ...options,
        signal: controller.signal,
      }).finally(() => {
        clearTimeout(timeoutId)
      })
    },
  },
})

export type ProfileRow = {
  id: string
  display_name: string | null
  liked_plant_ids: string[] | null
  is_admin?: boolean | null
  username?: string | null
  country?: string | null
  bio?: string | null
  favorite_plant?: string | null
  avatar_url?: string | null
  timezone?: string | null
  experience_years?: number | null
  accent_key?: string | null
  is_private?: boolean | null
  disable_friend_requests?: boolean | null
}

export type BlogPostRow = {
  id: string
  title: string
  slug: string
  body_html: string
  editor_data: Record<string, unknown> | null
  author_id: string
  author_name: string | null
  cover_image_url: string | null
  excerpt: string | null
  is_published: boolean
  published_at: string
  created_at: string
  updated_at: string
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


