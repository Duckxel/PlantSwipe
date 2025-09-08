import { createClient } from '@supabase/supabase-js'
import { getEnvAny } from '@/lib/utils'

// Allow the same values to drive both frontend and dev API
const supabaseUrl = getEnvAny(['VITE_SUPABASE_URL', 'SUPABASE_URL'])
const supabaseAnonKey = getEnvAny(['VITE_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY'])

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'plantswipe.auth',
  },
})

export type ProfileRow = {
  id: string
  display_name: string | null
  avatar_url: string | null
  liked_plant_ids: string[] | null
}


