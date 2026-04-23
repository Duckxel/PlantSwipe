import { supabase } from '@/lib/supabaseClient'

/**
 * Fetch current display_name for a set of profile ids.
 * Returns a map keyed by profile id. Missing/failed lookups are omitted
 * so callers can fall back to their snapshot copy of the name.
 */
export async function fetchDisplayNames(ids: Iterable<string>): Promise<Map<string, string>> {
  const unique = Array.from(new Set(Array.from(ids).filter((x): x is string => Boolean(x))))
  const out = new Map<string, string>()
  if (!unique.length) return out
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name')
    .in('id', unique)
  if (error) {
    console.warn('[displayNameLookup] fetch failed', error.message)
    return out
  }
  for (const row of data || []) {
    if (row?.id && row?.display_name) out.set(row.id as string, row.display_name as string)
  }
  return out
}
