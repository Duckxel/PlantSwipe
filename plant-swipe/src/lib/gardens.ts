import { supabase } from '@/lib/supabaseClient'
import type { Garden, GardenMember, GardenPlant, GardenPrivacy } from '@/types/garden'
import type { GardenTaskRow } from '@/types/garden'
import type { GardenPlantTask, GardenPlantTaskOccurrence, TaskType, TaskScheduleKind, TaskUnit } from '@/types/garden'
import type { Plant } from '@/types/plant'
import { getPrimaryPhotoUrl } from '@/lib/photos'
import type { SupportedLanguage } from './i18n'
import { mergePlantWithTranslation } from './plantTranslationLoader'

type PlantCareShape = NonNullable<Plant['plantCare']>

const LEVEL_SUN_MAP: Record<string, PlantCareShape['levelSun']> = {
  'low light': 'Low Light',
  shade: 'Shade',
  'partial sun': 'Partial Sun',
  'full sun': 'Full Sun',
}

const WATERING_TYPE_VALUES = ['surface', 'buried', 'hose', 'drop', 'drench'] as const
type WateringTypeValue = (typeof WATERING_TYPE_VALUES)[number]

const SOIL_TYPE_VALUES = [
  'Vermiculite',
  'Perlite',
  'Sphagnum moss',
  'rock wool',
  'Sand',
  'Gravel',
  'Potting Soil',
  'Peat',
  'Clay pebbles',
  'coconut fiber',
  'Bark',
  'Wood Chips',
] as const
type SoilTypeValue = (typeof SOIL_TYPE_VALUES)[number]

function normalizeLevelSun(value: unknown): PlantCareShape['levelSun'] | undefined {
  if (typeof value !== 'string') return undefined
  const mapped = LEVEL_SUN_MAP[value.toLowerCase()]
  return mapped
}

function normalizeWateringTypes(value: unknown): PlantCareShape['wateringType'] | undefined {
  if (!Array.isArray(value)) return undefined
  const filtered = value.filter(
    (entry): entry is WateringTypeValue =>
      typeof entry === 'string' && WATERING_TYPE_VALUES.includes(entry as WateringTypeValue),
  )
  return filtered.length ? filtered : undefined
}

function normalizeSoilTypes(value: unknown): PlantCareShape['soil'] | undefined {
  if (!Array.isArray(value)) return undefined
  const filtered = value.filter(
    (entry): entry is SoilTypeValue =>
      typeof entry === 'string' && SOIL_TYPE_VALUES.includes(entry as SoilTypeValue),
  )
  return filtered.length ? filtered : undefined
}

const missingSupabaseRpcs = new Set<string>()
const missingSupabaseTablesOrViews = new Set<string>()
let taskCachesDisabled = false

function disableTaskCachesOnce(reason: string, error?: any) {
  if (taskCachesDisabled) return
  taskCachesDisabled = true
  const detail = reason ? ` (${reason})` : ''
  console.warn(`[gardens] Task cache optimizations disabled${detail}; falling back to live aggregation only.`, error)
}

async function computeUserTaskTotalsFromLiveData(userId: string, date: string) {
  try {
    const { data: memberships } = await supabase
      .from('garden_members')
      .select('garden_id')
      .eq('user_id', userId)

    if (!memberships || memberships.length === 0) {
      return { totalDueCount: 0, totalCompletedCount: 0, gardensWithRemainingTasks: 0, totalGardens: 0 }
    }

    const gardenIds = memberships.map((m: any) => m.garden_id)
    const verifiedProg = await getGardensTodayProgressBatch(gardenIds, date)

    let totalDue = 0
    let totalCompleted = 0
    let gardensWithRemaining = 0

    for (const gid of gardenIds) {
      const prog = verifiedProg[gid] || { due: 0, completed: 0 }
      totalDue += prog.due
      totalCompleted += prog.completed
      if (prog.due > prog.completed) {
        gardensWithRemaining++
      }
    }

    return {
      totalDueCount: totalDue,
      totalCompletedCount: totalCompleted,
      gardensWithRemainingTasks: gardensWithRemaining,
      totalGardens: gardenIds.length,
    }
  } catch {
    return { totalDueCount: 0, totalCompletedCount: 0, gardensWithRemainingTasks: 0, totalGardens: 0 }
  }
}

async function computeUserGardenBreakdownFromLiveData(userId: string, date: string) {
  try {
    const { data: memberships } = await supabase
      .from('garden_members')
      .select('garden_id, gardens!inner(id, name)')
      .eq('user_id', userId)

    if (!memberships || memberships.length === 0) {
      return {}
    }

    const gardenIds = memberships.map((m: any) => m.garden_id)
    const verifiedProg = await getGardensTodayProgressBatch(gardenIds, date)

    const result: Record<string, {
      gardenName: string
      due: number
      completed: number
      hasRemainingTasks: boolean
      allTasksDone: boolean
    }> = {}

    for (const membership of memberships) {
      const gid = String(membership.garden_id)
      const prog = verifiedProg[gid] || { due: 0, completed: 0 }
      const hasRemaining = prog.due > prog.completed
      const garden = (membership as any).gardens
      result[gid] = {
        gardenName: garden ? garden.name : '',
        due: prog.due,
        completed: prog.completed,
        hasRemainingTasks: hasRemaining,
        allTasksDone: !hasRemaining && prog.due > 0,
      }
    }

    return result
  } catch {
    return {}
  }
}

function buildGardenProgressResult(
  gardenIds: string[],
  progress: Record<string, { due: number; completed: number }>
) {
  const result: Record<string, { due: number; completed: number; hasRemainingTasks?: boolean; allTasksDone?: boolean }> = {}
  for (const gid of gardenIds) {
    const prog = progress[gid] || { due: 0, completed: 0 }
    const hasRemaining = prog.due > prog.completed
    result[gid] = {
      due: prog.due,
      completed: prog.completed,
      hasRemainingTasks: hasRemaining,
      allTasksDone: !hasRemaining && prog.due > 0,
    }
  }
  return result
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const invalidGardenIdWarnings = new Set<string>()

function normalizeGardenId(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (!uuidPattern.test(trimmed)) {
    if (!invalidGardenIdWarnings.has(trimmed)) {
      invalidGardenIdWarnings.add(trimmed)
      console.warn(`[gardens] Ignoring invalid garden id "${trimmed}" while loading progress data`)
    }
    return null
  }
  return trimmed
}

function normalizeGardenIdList(values: string[]): { valid: string[]; invalid: string[] } {
  const seen = new Set<string>()
  const valid: string[] = []
  const invalid: string[] = []
  for (const raw of values) {
    const normalized = normalizeGardenId(raw)
    if (!normalized) {
      if (typeof raw === 'string') {
        const trimmed = raw.trim()
        if (trimmed) invalid.push(trimmed)
      }
      continue
    }
    if (seen.has(normalized)) continue
    seen.add(normalized)
    valid.push(normalized)
  }
  return { valid, invalid }
}

const markMissingResourceOnce = (set: Set<string>, name: string, kind: 'rpc' | 'table') => {
  if (!set.has(name)) {
    set.add(name)
    const label = kind === 'rpc' ? 'RPC function' : 'table or view'
    console.warn(`[supabase] ${label} "${name}" is not available; disabling related optimized paths.`)
  }
}

const includesResourceName = (text: string, resource: string) => {
  const lower = text.toLowerCase()
  const norm = resource.toLowerCase()
  return lower.includes(norm) || lower.includes(`public.${norm}`)
}

function isMissingRpcFunction(error: any, functionName: string): boolean {
  if (!error) return false
  const code = String(error.code ?? error.status ?? '').toUpperCase()
  const message = String(error.message ?? '').toLowerCase()
  const details = String(error.details ?? '').toLowerCase()
  const hint = String(error.hint ?? '').toLowerCase()
  const combined = `${message} ${details} ${hint}`
  const functionMissing =
    code === 'PGRST204' ||
    code === 'PGRST201' ||
    code === '42P01' ||
    code === '404' ||
    (combined.includes('could not find the function') && includesResourceName(combined, functionName)) ||
    (combined.includes('does not exist') && combined.includes('function') && includesResourceName(combined, functionName)) ||
    (combined.includes('schema cache') && includesResourceName(combined, functionName))
  if (functionMissing) {
    markMissingResourceOnce(missingSupabaseRpcs, functionName, 'rpc')
    return true
  }
  return false
}

function isRpcDependencyUnavailable(error: any, functionName: string): boolean {
  if (!error) return false
  const code = String(error.code ?? error.status ?? '').toUpperCase()
  const message = String(error.message ?? '').toLowerCase()
  const details = String(error.details ?? '').toLowerCase()
  const hint = String(error.hint ?? '').toLowerCase()
  const combined = `${message} ${details} ${hint}`
  const undefinedFunction =
    code === '42883' ||
    combined.includes('undefined function') ||
    (combined.includes('function') && (combined.includes('does not exist') || combined.includes("doesn't exist") || combined.includes('not exist')))

  if (undefinedFunction) {
    markMissingResourceOnce(missingSupabaseRpcs, functionName, 'rpc')
    return true
  }

  return false
}

function isMissingTableOrView(error: any, tableName: string): boolean {
  if (!error) return false
  const code = String(error.code ?? error.status ?? '').toUpperCase()
  const message = String(error.message ?? '').toLowerCase()
  const details = String(error.details ?? '').toLowerCase()
  const hint = String(error.hint ?? '').toLowerCase()
  const combined = `${message} ${details} ${hint}`
  const tableMissing =
    code === 'PGRST201' ||
    code === 'PGRST202' ||
    code === '42P01' ||
    code === '404' ||
    (combined.includes('does not exist') && includesResourceName(combined, tableName)) ||
    (combined.includes('not exist') && includesResourceName(combined, tableName)) ||
    (combined.includes('schema cache') && includesResourceName(combined, tableName)) ||
    (combined.includes('not found') && includesResourceName(combined, tableName))
  if (tableMissing) {
    markMissingResourceOnce(missingSupabaseTablesOrViews, tableName, 'table')
    return true
  }
  return false
}

export async function getGardenMemberCountsBatch(gardenIds: string[]): Promise<Record<string, number>> {
  const { valid: safeIds } = normalizeGardenIdList(gardenIds)
  if (safeIds.length === 0) return {}

  // Try RPC first
  const rpcName = 'get_garden_member_counts'
  if (!missingSupabaseRpcs.has(rpcName)) {
    try {
      const { data, error } = await supabase.rpc(rpcName, { _garden_ids: safeIds })
      if (!error && data && Array.isArray(data)) {
        const result: Record<string, number> = {}
        for (const row of data) {
          result[String(row.garden_id)] = Number(row.count ?? 0)
        }
        return result
      }
      if (error) {
        if (!(isMissingRpcFunction(error, rpcName) || isRpcDependencyUnavailable(error, rpcName))) {
          console.warn('[gardens] get_garden_member_counts RPC failed, falling back to client query:', error)
        }
      }
    } catch (err: any) {
      if (!(isMissingRpcFunction(err, rpcName) || isRpcDependencyUnavailable(err, rpcName))) {
        console.warn('[gardens] get_garden_member_counts RPC failed, falling back to client query:', err)
      }
    }
  }

  // Fallback: client query
  // Note: This fetches ALL member rows, which is inefficient for large gardens,
  // but we have to do it if RPC is unavailable.
  const { data: memberRows } = await supabase
    .from('garden_members')
    .select('garden_id')
    .in('garden_id', safeIds)
  
  const counts: Record<string, number> = {}
  if (memberRows) {
    for (const row of memberRows) {
      const gid = String(row.garden_id)
      counts[gid] = (counts[gid] || 0) + 1
    }
  }
  return counts
}

export async function listTasksForMultipleGardensMinimal(gardenIds: string[], _limitPerGarden: number = 500): Promise<Record<string, Array<{ id: string; type: TaskType; emoji: string | null; gardenPlantId: string }>>> {
  const { valid: safeIds } = normalizeGardenIdList(gardenIds)
  if (safeIds.length === 0) return {}

  const base = supabase.from('garden_plant_tasks')
  const selectMinimal = 'id, garden_id, type, emoji, garden_plant_id'
  const selectMinimalNoEmoji = 'id, garden_id, type, garden_plant_id'
  
  let { data, error } = await base
    .select(selectMinimal)
    .in('garden_id', safeIds)
    .order('created_at', { ascending: true })
    // .limit(...) // Can't limit per garden easily in one query without RPC, so fetch all (should be okay for minimal fields)
  
  if (error) {
    const msg = String(error.message || '')
    if (/column .*emoji.* does not exist/i.test(msg)) {
      const res = await base
        .select(selectMinimalNoEmoji)
        .in('garden_id', safeIds)
        .order('created_at', { ascending: true })
      data = res.data as any
      error = res.error as any
    }
  }
  if (error) throw new Error(error.message)

  const result: Record<string, Array<{ id: string; type: TaskType; emoji: string | null; gardenPlantId: string }>> = {}
  for (const r of (data || []) as any[]) {
    const gid = String(r.garden_id)
    if (!result[gid]) result[gid] = []
    result[gid].push({
      id: String(r.id),
      type: r.type,
      emoji: (r as any).emoji || null,
      gardenPlantId: String(r.garden_plant_id),
    })
  }
  return result
}

export async function getUserGardens(userId: string): Promise<Garden[]> {
  // Fetch garden ids where user is a member, then fetch gardens
  const { data: memberRows, error: memberErr } = await supabase
    .from('garden_members')
    .select('garden_id')
    .eq('user_id', userId)
  if (memberErr) throw new Error(memberErr.message)
  const gardenIds = (memberRows || []).map((r: { garden_id: string }) => r.garden_id)
  if (gardenIds.length === 0) return []
  
  // Try with privacy column first, fallback if column doesn't exist
  let gardens: any[] = []
  let gerr: any = null
  const result = await supabase
    .from('gardens')
    .select('id, name, cover_image_url, created_by, created_at, streak, privacy')
    .in('id', gardenIds)
  gardens = result.data || []
  gerr = result.error
  
  // If error mentions privacy column, try without it
  if (gerr && String(gerr.message || '').toLowerCase().includes('privacy')) {
    const fallbackResult = await supabase
      .from('gardens')
      .select('id, name, cover_image_url, created_by, created_at, streak')
      .in('id', gardenIds)
    gardens = fallbackResult.data || []
    gerr = fallbackResult.error
  }
  
  if (gerr) throw new Error(gerr.message)
  return gardens.map((g: any) => ({
    id: String(g.id),
    name: String(g.name),
    coverImageUrl: g.cover_image_url || null,
    createdBy: String(g.created_by),
    createdAt: String(g.created_at),
    streak: Number(g.streak ?? 0),
    privacy: (g.privacy || 'public') as GardenPrivacy,
  }))
}

export async function createGarden(params: { name: string; coverImageUrl?: string | null; ownerUserId: string; privacy?: GardenPrivacy }): Promise<Garden> {
  const { name, coverImageUrl = null, ownerUserId, privacy = 'public' } = params
  
  // Try with privacy column first, fallback if column doesn't exist
  let data: any = null
  let error: any = null
  const result = await supabase
    .from('gardens')
    .insert({ name, cover_image_url: coverImageUrl, created_by: ownerUserId, privacy })
    .select('id, name, cover_image_url, created_by, created_at, privacy')
    .single()
  data = result.data
  error = result.error
  
  // If error mentions privacy column, try without it
  if (error && String(error.message || '').toLowerCase().includes('privacy')) {
    const fallbackResult = await supabase
      .from('gardens')
      .insert({ name, cover_image_url: coverImageUrl, created_by: ownerUserId })
      .select('id, name, cover_image_url, created_by, created_at')
      .single()
    data = fallbackResult.data
    error = fallbackResult.error
  }
  
  if (error) throw new Error(error.message)
  const garden: Garden = {
    id: String(data.id),
    name: String(data.name),
    coverImageUrl: data.cover_image_url || null,
    createdBy: String(data.created_by),
    createdAt: String(data.created_at),
    privacy: ((data as any).privacy || privacy) as GardenPrivacy,
  }
  // Add owner as member
  const { error: merr } = await supabase
    .from('garden_members')
    .insert({ garden_id: garden.id, user_id: ownerUserId, role: 'owner' })
  if (merr) throw new Error(merr.message)
  return garden
}

export async function getGarden(gardenId: string): Promise<Garden | null> {
  // Try with new privacy column first
  let data: any = null
  let error: any = null
  
  const result = await supabase
    .from('gardens')
    .select('id, name, cover_image_url, created_by, created_at, streak, privacy, location_city, location_country, location_timezone, location_lat, location_lon, preferred_language')
    .eq('id', gardenId)
    .maybeSingle()
  
  if (result.error && result.error.message?.includes('privacy')) {
    // New column doesn't exist, try old is_public column
    const fallback1 = await supabase
      .from('gardens')
      .select('id, name, cover_image_url, created_by, created_at, streak, is_public, location_city, location_country, location_timezone, location_lat, location_lon, preferred_language')
      .eq('id', gardenId)
      .maybeSingle()
    
    if (fallback1.error && fallback1.error.message?.includes('is_public')) {
      // Neither column exists, use base schema
      const fallback2 = await supabase
        .from('gardens')
        .select('id, name, cover_image_url, created_by, created_at, streak, location_city, location_country, location_timezone, location_lat, location_lon, preferred_language')
        .eq('id', gardenId)
        .maybeSingle()
      data = fallback2.data
      error = fallback2.error
    } else {
      data = fallback1.data
      error = fallback1.error
    }
  } else {
    data = result.data
    error = result.error
  }
  
  if (error) throw new Error(error.message)
  if (!data) return null
  
  // Determine privacy value from available data
  let privacy: GardenPrivacy = 'public'
  if (data.privacy) {
    privacy = data.privacy as GardenPrivacy
  } else if (data.is_public !== undefined) {
    privacy = data.is_public ? 'public' : 'private'
  }
  
  return {
    id: String(data.id),
    name: String(data.name),
    coverImageUrl: data.cover_image_url || null,
    createdBy: String(data.created_by),
    createdAt: String(data.created_at),
    streak: Number((data as any).streak ?? 0),
    privacy,
    locationCity: data.location_city || null,
    locationCountry: data.location_country || null,
    locationTimezone: data.location_timezone || null,
    locationLat: data.location_lat || null,
    locationLon: data.location_lon || null,
    preferredLanguage: data.preferred_language || null,
  }
}

export async function updateGardenPrivacy(gardenId: string, privacy: GardenPrivacy): Promise<void> {
  const { error } = await supabase
    .from('gardens')
    .update({ privacy })
    .eq('id', gardenId)
  if (error) {
    // If the column doesn't exist yet, throw a user-friendly error
    if (error.message?.includes('privacy')) {
      throw new Error('Privacy feature not yet available. Please run database migration.')
    }
    throw new Error(error.message)
  }
}

/**
 * Deletes a garden and its cover image from storage.
 * This calls the server endpoint which handles both the database row deletion
 * and the storage cleanup for the cover image.
 */
export async function deleteGarden(gardenId: string): Promise<{ ok: boolean; coverDeleted?: boolean }> {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token
  if (!token) {
    throw new Error('You must be signed in to delete a garden')
  }
  
  const resp = await fetch(`/api/garden/${encodeURIComponent(gardenId)}`, {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })
  
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}))
    throw new Error(body?.error || `Failed to delete garden (status ${resp.status})`)
  }
  
  const result = await resp.json()
  return { ok: Boolean(result.ok), coverDeleted: Boolean(result.coverDeleted) }
}

export async function refreshGardenStreak(gardenId: string, anchorDayIso?: string | null): Promise<void> {
  // Anchor defaults to yesterday in UTC if not provided
  let anchor = anchorDayIso
  if (!anchor) {
    const now = new Date()
    const y = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    y.setUTCDate(y.getUTCDate() - 1)
    anchor = y.toISOString().slice(0, 10)
  }
  const { error } = await supabase.rpc('update_garden_streak', { _garden_id: gardenId, _anchor_day: anchor })
  if (error) throw new Error(error.message)
}

export async function getGardenPlants(gardenId: string, language?: SupportedLanguage): Promise<Array<GardenPlant & { plant?: Plant | null; sortIndex?: number | null }>> {
  const { data, error } = await supabase
    .from('garden_plants')
    .select('id, garden_id, plant_id, nickname, seeds_planted, planted_at, expected_bloom_date, override_water_freq_unit, override_water_freq_value, plants_on_hand, health_status, notes, last_health_update')
    .eq('garden_id', gardenId)
    .order('sort_index', { ascending: true, nullsFirst: false })
  if (error) throw new Error(error.message)
  const rows = (data || []) as any[]
  if (rows.length === 0) return []
  const plantIds = Array.from(new Set(rows.map(r => r.plant_id)))
    const { data: plantRows } = await supabase
      .from('plants')
      .select('*, plant_images (id,link,use)')
      .in('id', plantIds)
  
  // Load translations for ALL languages (including English)
  // Only fetch name field to minimize egress (~90% reduction)
  let translationMap = new Map()
  const targetLanguage = language || 'en'
  const { data: translations } = await supabase
    .from('plant_translations')
    .select('plant_id, name')
    .eq('language', targetLanguage)
    .in('plant_id', plantIds)
  if (translations) {
    translations.forEach(t => {
      translationMap.set(t.plant_id, { name: t.name })
    })
  }
  
  const idToPlant: Record<string, Plant> = {}
  if (plantRows && plantRows.length > 0) {
    for (const p of plantRows) {
      if (!p || !p.id) continue
      try {
        const translation = translationMap.get(p.id) || null
        // Convert plant_images to photos format expected by mergePlantWithTranslation
        const images = Array.isArray(p.plant_images) ? p.plant_images : []
        const photos = images.map((img: any) => ({
          url: img.link || '',
          isPrimary: img.use === 'primary',
          isVertical: false
        }))
        // Find primary image or use first image as fallback
        const primaryImageUrl = images.find((img: any) => img.use === 'primary')?.link 
          || images.find((img: any) => img.use === 'discovery')?.link 
          || images[0]?.link 
          || p.image_url 
          || p.image
        const plantWithPhotos = { ...p, photos, image_url: primaryImageUrl }
        const mergedPlant = mergePlantWithTranslation(plantWithPhotos, translation)
        idToPlant[String(p.id)] = mergedPlant
      } catch (err) {
        console.error(`Error processing plant ${p.id}:`, err)
        // Continue processing other plants even if one fails
      }
    }
  }
  return rows.map(r => {
    const plantId = String(r.plant_id)
    return {
      id: String(r.id),
      gardenId: String(r.garden_id),
      plantId,
      nickname: r.nickname,
      seedsPlanted: Number(r.seeds_planted ?? 0),
      plantedAt: r.planted_at,
      expectedBloomDate: r.expected_bloom_date,
      overrideWaterFreqUnit: r.override_water_freq_unit || null,
      overrideWaterFreqValue: r.override_water_freq_value ?? null,
      plantsOnHand: Number(r.plants_on_hand ?? 0),
      healthStatus: r.health_status || null,
      notes: r.notes || null,
      lastHealthUpdate: r.last_health_update || null,
      plant: idToPlant[plantId] || null,
      sortIndex: (r as any).sort_index ?? null,
    }
  })
}

export async function addPlantToGarden(params: { gardenId: string; plantId: string; nickname?: string | null; seedsPlanted?: number; plantedAt?: string | null; expectedBloomDate?: string | null; plantsOnHand?: number }): Promise<GardenPlant> {
  const { gardenId, plantId, nickname = null, seedsPlanted = 0, plantedAt = null, expectedBloomDate = null, plantsOnHand = 0 } = params
  // Determine next sort_index to append to bottom
  const { data: maxRow } = await supabase
    .from('garden_plants')
    .select('sort_index')
    .eq('garden_id', gardenId)
    .order('sort_index', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()
  const nextIndex = Number((maxRow as any)?.sort_index ?? -1) + 1
  const { data, error } = await supabase
    .from('garden_plants')
    .insert({ garden_id: gardenId, plant_id: plantId, nickname, seeds_planted: seedsPlanted, planted_at: plantedAt, expected_bloom_date: expectedBloomDate, plants_on_hand: plantsOnHand, sort_index: nextIndex })
    .select('id, garden_id, plant_id, nickname, seeds_planted, planted_at, expected_bloom_date, plants_on_hand, sort_index')
    .single()
  if (error) throw new Error(error.message)
  return {
    id: String(data.id),
    gardenId: String(data.garden_id),
    plantId: String(data.plant_id),
    nickname: data.nickname,
    seedsPlanted: Number(data.seeds_planted ?? 0),
    plantedAt: data.planted_at,
    expectedBloomDate: data.expected_bloom_date,
    plantsOnHand: Number((data as any).plants_on_hand ?? 0),
  }
}

export async function updateGardenPlantsOrder(params: { gardenId: string; orderedIds: string[] }): Promise<void> {
  const { gardenId, orderedIds } = params
  // Batch update sort_index; keep it simple with sequential updates
  for (let i = 0; i < orderedIds.length; i++) {
    const id = orderedIds[i]
    await supabase.from('garden_plants').update({ sort_index: i }).eq('id', id).eq('garden_id', gardenId)
  }
}

// addDays kept previously for legacy helpers; remove unused util

export async function getGardenMembers(gardenId: string): Promise<GardenMember[]> {
  const { data, error } = await supabase
    .from('garden_members')
    .select('garden_id, user_id, role, joined_at')
    .eq('garden_id', gardenId)
  if (error) throw new Error(error.message)
  const rows = (data || []) as any[]
  const { data: profilesData, error: pErr } = await supabase.rpc('get_profiles_for_garden', { _garden_id: gardenId })
  if (pErr) throw new Error(pErr.message)
  const idToName: Record<string, string | null> = {}
  const idToEmail: Record<string, string | null> = {}
  const idToAccent: Record<string, string | null> = {}
  const idToAvatar: Record<string, string | null> = {}
  for (const r of (profilesData as any[]) || []) {
    const uid = String((r as any).user_id)
    idToName[uid] = (r as any).display_name || null
    idToEmail[uid] = (r as any).email || null
    idToAccent[uid] = (r as any).accent_key || null
    idToAvatar[uid] = (r as any).avatar_url || null
  }
  return rows.map((r: any) => ({
    gardenId: String(r.garden_id),
    userId: String(r.user_id),
    role: r.role,
    joinedAt: String(r.joined_at),
    displayName: idToName[String(r.user_id)] ?? null,
    email: idToEmail[String(r.user_id)] ?? null,
    accentKey: idToAccent[String(r.user_id)] ?? null,
    avatarUrl: idToAvatar[String(r.user_id)] ?? null,
  }))
}

export async function addGardenMember(params: { gardenId: string; userId: string; role?: 'member' | 'owner' }): Promise<void> {
  const { gardenId, userId, role = 'member' } = params
  const { error } = await supabase
    .from('garden_members')
    .insert({ garden_id: gardenId, user_id: userId, role })
  if (error) throw new Error(error.message)
}

export async function updateGardenMemberRole(params: { gardenId: string; userId: string; role: 'member' | 'owner' }): Promise<void> {
  const { gardenId, userId, role } = params
  
  // If demoting an owner to member, check if this is the last owner
  // If so, delete the garden properly (including cover image cleanup)
  if (role === 'member') {
    const { data: currentMember } = await supabase
      .from('garden_members')
      .select('role')
      .eq('garden_id', gardenId)
      .eq('user_id', userId)
      .maybeSingle()
    
    if (currentMember?.role === 'owner') {
      const { count } = await supabase
        .from('garden_members')
        .select('*', { count: 'exact', head: true })
        .eq('garden_id', gardenId)
        .eq('role', 'owner')
      
      if ((count ?? 0) <= 1) {
        // This is the last owner - delete the garden via server endpoint
        // which handles cover image cleanup
        await deleteGarden(gardenId)
        return
      }
    }
  }
  
  const { error } = await supabase
    .from('garden_members')
    .update({ role })
    .eq('garden_id', gardenId)
    .eq('user_id', userId)
  if (error) throw new Error(error.message)
}

export async function removeGardenMember(params: { gardenId: string; userId: string }): Promise<void> {
  const { gardenId, userId } = params
  
  // Check if the member being removed is the last owner
  // If so, delete the garden properly (including cover image cleanup)
  const { data: memberData } = await supabase
    .from('garden_members')
    .select('role')
    .eq('garden_id', gardenId)
    .eq('user_id', userId)
    .maybeSingle()
  
  if (memberData?.role === 'owner') {
    const { count } = await supabase
      .from('garden_members')
      .select('*', { count: 'exact', head: true })
      .eq('garden_id', gardenId)
      .eq('role', 'owner')
    
    if ((count ?? 0) <= 1) {
      // This is the last owner - delete the garden via server endpoint
      // which handles cover image cleanup
      await deleteGarden(gardenId)
      return
    }
  }
  
  const { error } = await supabase
    .from('garden_members')
    .delete()
    .eq('garden_id', gardenId)
    .eq('user_id', userId)
  if (error) throw new Error(error.message)
}

export async function addMemberByEmail(params: { gardenId: string; email: string; role?: 'member' | 'owner' }): Promise<{ ok: boolean; reason?: string }> {
  const { gardenId, email, role = 'member' } = params
  const { data, error } = await supabase.rpc('get_user_id_by_email', { _email: email })
  if (error) return { ok: false, reason: 'lookup_failed' }
  const userId = data as unknown as string | null
  if (!userId) return { ok: false, reason: 'no_account' }
  try {
    await addGardenMember({ gardenId, userId, role })
    return { ok: true }
  } catch (e) {
    return { ok: false, reason: 'insert_failed' }
  }
}

export async function addMemberByNameOrEmail(params: { gardenId: string; input: string; role?: 'member' | 'owner' }): Promise<{ ok: boolean; reason?: string }> {
  const { gardenId, input, role = 'member' } = params
  const val = input.trim()
  if (!val) return { ok: false, reason: 'invalid' }
  // If looks like email, use existing path
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(val)) {
    return await addMemberByEmail({ gardenId, email: val, role })
  }
  // Otherwise, treat as display name
  try {
    const { data, error } = await supabase.rpc('get_user_id_by_display_name', { _name: val })
    if (error) return { ok: false, reason: 'lookup_failed' }
    const userId = (data ? String(data) : null)
    if (!userId) return { ok: false, reason: 'no_account' }
    await addGardenMember({ gardenId, userId, role })
    return { ok: true }
  } catch (e) {
    return { ok: false, reason: 'insert_failed' }
  }
}

// Legacy watering schedule helpers removed in favor of Tasks v2 occurrences

// Legacy watering schedule helpers removed

export async function deleteGardenPlant(gardenPlantId: string): Promise<void> {
  const { error } = await supabase
    .from('garden_plants')
    .delete()
    .eq('id', gardenPlantId)
  if (error) throw new Error(error.message)
}

export async function fetchServerNowISO(): Promise<string> {
  try {
    const { data, error } = await supabase.rpc('get_server_now')
    if (!error && data) {
      return new Date(String(data)).toISOString()
    }
  } catch {}
  // Fallback to client time if RPC unavailable (CORS/network outage)
  return new Date().toISOString()
}

export async function upsertGardenTask(params: { gardenId: string; day: string; gardenPlantId?: string | null; success?: boolean }): Promise<void> {
  const { gardenId, day, gardenPlantId = null, success } = params
  const { error } = await supabase.rpc('touch_garden_task', { _garden_id: gardenId, _day: day, _plant_id: gardenPlantId, _set_success: success ?? null })
  if (error) throw new Error(error.message)
}

export async function getGardenTasks(gardenId: string, startDay: string, endDay: string): Promise<GardenTaskRow[]> {
  try {
    const params = new URLSearchParams({ start: startDay, end: endDay })
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData?.session?.access_token
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
      params.set('token', token)
    }
    const resp = await fetch(`/api/garden/${encodeURIComponent(gardenId)}/tasks?${params.toString()}`, {
      credentials: 'same-origin',
      headers,
    })
    if (resp.ok) {
      const body = await resp.json().catch(() => null)
      if (body && body.ok !== false && Array.isArray(body.tasks)) {
        return body.tasks.map((r: any) => ({
          id: String(r.id),
          gardenId: String(r.gardenId ?? r.garden_id ?? gardenId),
          day: String(r.day || '').slice(0, 10),
          taskType: String(r.taskType || r.task_type || 'watering'),
          gardenPlantIds: Array.isArray(r.gardenPlantIds ?? r.garden_plant_ids)
            ? (r.gardenPlantIds ?? r.garden_plant_ids)
            : [],
          success: Boolean(r.success),
        }))
      }
    }
  } catch {}

  const { data, error } = await supabase
    .from('garden_tasks')
    .select('id, garden_id, day, task_type, garden_plant_ids, success')
    .eq('garden_id', gardenId)
    .gte('day', startDay)
    .lte('day', endDay)
    .order('day', { ascending: true })
  if (error) throw new Error(error.message)
  return (data || []).map((r: any) => ({
    id: String(r.id),
    gardenId: String(r.garden_id),
    day: (r.day instanceof Date ? (r.day as Date).toISOString().slice(0, 10) : String(r.day).slice(0, 10)),
    taskType: 'watering',
    gardenPlantIds: Array.isArray(r.garden_plant_ids) ? r.garden_plant_ids : [],
    success: Boolean(r.success),
  }))
}

export async function ensureDailyTasksForGardens(dayIso: string): Promise<void> {
  const { error } = await supabase.rpc('ensure_daily_tasks_for_gardens', { _day: dayIso })
  if (error) throw new Error(error.message)
}

export async function computeGardenTaskForDay(params: { gardenId: string; dayIso: string }): Promise<void> {
  const { gardenId, dayIso } = params
  const { error } = await supabase.rpc('compute_garden_task_for_day', { _garden_id: gardenId, _day: dayIso })
  if (error) throw new Error(error.message)
}

export async function getGardenTodayProgress(gardenId: string, dayIso: string): Promise<{ due: number; completed: number }> {
  // Tasks v2 only: compute from occurrences for the given day
  const tasks = await listGardenTasks(gardenId)
  if (tasks.length === 0) return { due: 0, completed: 0 }
  const start = `${dayIso}T00:00:00.000Z`
  const end = `${dayIso}T23:59:59.999Z`
  // Use full resync to avoid duplicate occurrences inflating counts
  await resyncTaskOccurrencesForGarden(gardenId, start, end)
  const occs = await listOccurrencesForTasks(tasks.map(t => t.id), start, end)
  let due = 0
  let completed = 0
  for (const o of occs) {
    const req = Math.max(1, Number(o.requiredCount || 1))
    const comp = Math.min(req, Number(o.completedCount || 0))
    due += req
    completed += comp
  }
  return { due, completed }
}

/**
 * Lightweight version that queries existing occurrences without resyncing.
 * Use this for fast initial loads - resync should happen separately for accuracy.
 */
export async function getGardenTodayProgressFast(gardenId: string, dayIso: string): Promise<{ due: number; completed: number }> {
  const tasks = await listGardenTasks(gardenId)
  if (tasks.length === 0) return { due: 0, completed: 0 }
  const start = `${dayIso}T00:00:00.000Z`
  const end = `${dayIso}T23:59:59.999Z`
  // Query existing occurrences without resyncing for speed
  const occs = await listOccurrencesForTasks(tasks.map(t => t.id), start, end)
  let due = 0
  let completed = 0
  for (const o of occs) {
    const req = Math.max(1, Number(o.requiredCount || 1))
    const comp = Math.min(req, Number(o.completedCount || 0))
    due += req
    completed += comp
  }
  return { due, completed }
}

/**
 * Ultra-lightweight version that uses PostgreSQL RPC function for server-side aggregation.
 * Returns only 2 numbers (due, completed) instead of fetching all occurrence rows.
 * Minimizes Supabase egress to absolute minimum - just a few bytes.
 */
export async function getGardenTodayProgressUltraFast(gardenId: string, dayIso: string): Promise<{ due: number; completed: number }> {
  const normalizedGardenId = normalizeGardenId(gardenId)
  if (!normalizedGardenId) {
    return { due: 0, completed: 0 }
  }
  const start = `${dayIso}T00:00:00.000Z`
  const end = `${dayIso}T23:59:59.999Z`
  
  // Try RPC function first (zero egress except return value)
  const rpcName = 'get_garden_today_progress'
  if (!missingSupabaseRpcs.has(rpcName)) {
    try {
      const { data, error } = await supabase.rpc(rpcName, {
          _garden_id: normalizedGardenId,
        _start_iso: start,
        _end_iso: end,
      })
      if (!error && data) {
        let payload: any = data
        if (typeof payload === 'string') {
          try {
            payload = JSON.parse(payload)
          } catch {
            payload = null
          }
        }
        const row = Array.isArray(payload) ? payload[0] : payload
        if (row && typeof row === 'object') {
          return {
            due: Number((row as any).due ?? 0),
            completed: Number((row as any).completed ?? 0),
          }
        }
      }
      if (error) {
        if (!(isMissingRpcFunction(error, rpcName) || isRpcDependencyUnavailable(error, rpcName))) {
          console.warn('[gardens] get_garden_today_progress RPC failed, falling back to client aggregation:', error)
        }
      }
    } catch (err) {
      if (!(isMissingRpcFunction(err, rpcName) || isRpcDependencyUnavailable(err, rpcName))) {
        console.warn('[gardens] get_garden_today_progress RPC failed, falling back to client aggregation:', err)
      }
    }
  }
  
  // Fallback: client-side aggregation (still minimal egress)
  const tasks = await listGardenTasksMinimal(normalizedGardenId)
  if (tasks.length === 0) return { due: 0, completed: 0 }
  const taskIds = tasks.map(t => t.id)
  
  // Use aggregation query to minimize egress - only fetch counts, not all rows
  const { data, error } = await supabase
    .from('garden_plant_task_occurrences')
    .select('required_count, completed_count', { count: 'exact', head: false })
    .in('task_id', taskIds)
    .gte('due_at', start)
    .lte('due_at', end)
  
  if (error) throw new Error(error.message)
  
  let due = 0
  let completed = 0
  for (const o of (data || [])) {
    const req = Math.max(1, Number(o.required_count ?? 1))
    const comp = Math.min(req, Number(o.completed_count ?? 0))
    due += req
    completed += comp
  }
  return { due, completed }
}

/**
 * Server-side batched progress calculation for multiple gardens.
 * Uses PostgreSQL RPC to minimize egress - returns only totals per garden.
 */
export async function getGardensTodayProgressBatch(gardenIds: string[], dayIso: string): Promise<Record<string, { due: number; completed: number }>> {
  const { valid: safeGardenIds } = normalizeGardenIdList(gardenIds)
  if (safeGardenIds.length === 0) {
    return {}
  }
  const start = `${dayIso}T00:00:00.000Z`
  const end = `${dayIso}T23:59:59.999Z`
  
  // Try RPC function first (minimal egress)
  const rpcName = 'get_gardens_today_progress_batch'
  if (!missingSupabaseRpcs.has(rpcName)) {
    try {
      const { data, error } = await supabase.rpc(rpcName, {
        _garden_ids: safeGardenIds,
        _start_iso: start,
        _end_iso: end,
      })
      if (!error && data) {
        let rows: any = data
        if (typeof rows === 'string') {
          try {
            rows = JSON.parse(rows)
          } catch {
            rows = null
          }
        }
        if (rows && !Array.isArray(rows) && typeof rows === 'object') {
          rows = [rows]
        }
        if (Array.isArray(rows)) {
          const result: Record<string, { due: number; completed: number }> = {}
          for (const row of rows) {
            if (!row) continue
            result[String((row as any).garden_id)] = {
              due: Number((row as any).due ?? 0),
              completed: Number((row as any).completed ?? 0),
            }
          }
          return result
        }
      }
      if (error) {
        if (!(isMissingRpcFunction(error, rpcName) || isRpcDependencyUnavailable(error, rpcName))) {
          console.warn('[gardens] get_gardens_today_progress_batch RPC failed, falling back to parallel queries:', error)
        }
      }
    } catch (err) {
      if (!(isMissingRpcFunction(err, rpcName) || isRpcDependencyUnavailable(err, rpcName))) {
        console.warn('[gardens] get_gardens_today_progress_batch RPC failed, falling back to parallel queries:', err)
      }
    }
  }
  
  // Fallback: parallel queries with minimal fields
  const results = await Promise.all(
    safeGardenIds.map(async (gid) => {
      try {
        const prog = await getGardenTodayProgressUltraFast(gid, dayIso)
        return [gid, prog] as [string, { due: number; completed: number }]
      } catch {
        return [gid, { due: 0, completed: 0 }] as [string, { due: number; completed: number }]
      }
    })
  )
  
  const result: Record<string, { due: number; completed: number }> = {}
  for (const [gid, prog] of results) {
    result[gid] = prog
  }
  return result
}

/**
 * Minimal version of listGardenTasks - only fetches essential fields for list view.
 * Reduces egress by ~70% compared to full task fetch.
 * Adds limit to prevent excessive data transfer.
 */
export async function listGardenTasksMinimal(gardenId: string, limit: number = 500): Promise<Array<{ id: string; type: TaskType; emoji: string | null; gardenPlantId: string }>> {
  const base = supabase.from('garden_plant_tasks')
  const selectMinimal = 'id, type, emoji, garden_plant_id'
  const selectMinimalNoEmoji = 'id, type, garden_plant_id'
  
  let { data, error } = await base
    .select(selectMinimal)
    .eq('garden_id', gardenId)
    .limit(limit) // Limit to prevent excessive egress
    .order('created_at', { ascending: true })
  if (error) {
    const msg = String(error.message || '')
    if (/column .*emoji.* does not exist/i.test(msg)) {
      const res = await base
        .select(selectMinimalNoEmoji)
        .eq('garden_id', gardenId)
        .limit(limit)
        .order('created_at', { ascending: true })
      data = res.data as any
      error = res.error as any
    }
  }
  if (error) throw new Error(error.message)
  return (data || []).map((r: any) => ({
    id: String(r.id),
    type: r.type,
    emoji: (r as any).emoji || null,
    gardenPlantId: String(r.garden_plant_id),
  }))
}

/**
 * Minimal version of getGardenPlants - only fetches essential fields for task sidebar.
 * Reduces egress by ~80% compared to full plant fetch.
 * Adds limit to prevent excessive data transfer.
 */
export async function getGardenPlantsMinimal(gardenIds: string[], limitPerGarden: number = 200): Promise<Array<{ id: string; gardenId: string; nickname: string | null; plantName: string | null }>> {
  if (gardenIds.length === 0) return []
  const { valid: safeGardenIds } = normalizeGardenIdList(gardenIds)
  if (safeGardenIds.length === 0) return []
  const { data, error } = await supabase
    .from('garden_plants')
    .select('id, garden_id, plant_id, nickname')
    .in('garden_id', safeGardenIds)
    .limit(limitPerGarden * safeGardenIds.length) // Total limit
    .order('sort_index', { ascending: true, nullsFirst: false })
  if (error) throw new Error(error.message)
  const rows = (data || []) as any[]
  if (rows.length === 0) return []
  
  const plantIds = Array.from(new Set(rows.map(r => r.plant_id)))
  // Only fetch name field - minimal egress
  const { data: plantRows } = await supabase
    .from('plants')
    .select('id, name')
    .in('id', plantIds)
    .limit(plantIds.length) // Explicit limit
  
  const idToPlantName: Record<string, string> = {}
  for (const p of plantRows || []) {
    idToPlantName[String(p.id)] = String(p.name || '')
  }
  
  return rows.map(r => ({
    id: String(r.id),
    gardenId: String(r.garden_id),
    nickname: r.nickname,
    plantName: idToPlantName[String(r.plant_id)] || null,
  }))
}

export async function userHasUnfinishedTasksToday(userId: string): Promise<boolean> {
  // Use cache for instant check - FASTEST approach
  const today = new Date().toISOString().slice(0, 10)
  try {
    const tasks = await getUserTasksTodayCached(userId, today)
    // Has unfinished tasks if there are gardens with remaining tasks OR if due > completed
    return tasks.gardensWithRemainingTasks > 0 || tasks.totalDueCount > tasks.totalCompletedCount
  } catch {
    // Fallback: return false on error (don't show notification)
    return false
  }
}

export async function getGardenInventory(gardenId: string): Promise<Array<{ plantId: string; seedsOnHand: number; plantsOnHand: number; plant?: Plant | null }>> {
  const { data, error } = await supabase
    .from('garden_inventory')
    .select('plant_id, seeds_on_hand, plants_on_hand')
    .eq('garden_id', gardenId)
  if (error) throw new Error(error.message)
  const rows = (data || []) as Array<{ plant_id: string; seeds_on_hand: number; plants_on_hand: number }>
  if (rows.length === 0) return []
  const plantIds = rows.map(r => String(r.plant_id))
  const { data: plantRows } = await supabase
    .from('plants')
    .select('id, name, scientific_name, colors, seasons, rarity, meaning, description, image_url, photos, seeds_available, level_sun, watering_type, soil, maintenance_level, classification')
    .in('id', plantIds)
  const idToPlant: Record<string, Plant> = {}
  for (const p of plantRows || []) {
    const levelSun = normalizeLevelSun(p.level_sun)
    const wateringTypes = normalizeWateringTypes(p.watering_type)
    const soilTypes = normalizeSoilTypes(p.soil)
    const maintenanceLevel = typeof p.maintenance_level === 'string' ? p.maintenance_level : undefined

    idToPlant[String(p.id)] = {
      id: String(p.id),
      name: String(p.name || ''),
      scientificName: String(p.scientific_name || ''),
      colors: Array.isArray(p.colors) ? p.colors.map(String) : [],
      seasons: Array.isArray(p.seasons) ? (p.seasons as unknown[]).map((s) => String(s)) as Plant['seasons'] : [],
      rarity: p.rarity || undefined,
      meaning: p.meaning || '',
      description: p.description || '',
      photos: Array.isArray(p.photos) ? p.photos : undefined,
      image: getPrimaryPhotoUrl(Array.isArray(p.photos) ? p.photos : []) || p.image_url || '',
      care: {
        levelSun,
        wateringType: wateringTypes,
        soil: soilTypes,
        maintenanceLevel,
        difficulty: maintenanceLevel,
      },
      seedsAvailable: Boolean(p.seeds_available ?? false),
      classification: typeof p.classification === 'string'
        ? JSON.parse(p.classification)
        : (p.classification as Plant['classification']) || undefined,
    }
  }
  return rows.map(r => ({
    plantId: String(r.plant_id),
    seedsOnHand: Number(r.seeds_on_hand ?? 0),
    plantsOnHand: Number(r.plants_on_hand ?? 0),
    plant: idToPlant[String(r.plant_id)] || null,
  }))
}

export async function adjustInventoryAndLogTransaction(params: { gardenId: string; plantId: string; seedsDelta?: number; plantsDelta?: number; transactionType: 'buy_seeds' | 'sell_seeds' | 'buy_plants' | 'sell_plants'; notes?: string | null }): Promise<void> {
  const { gardenId, plantId, seedsDelta = 0, plantsDelta = 0, transactionType, notes = null } = params
  // Ensure inventory row exists
  const { data: invRow } = await supabase
    .from('garden_inventory')
    .select('id, seeds_on_hand, plants_on_hand')
    .eq('garden_id', gardenId)
    .eq('plant_id', plantId)
    .maybeSingle()
  const currentSeeds = Number(invRow?.seeds_on_hand ?? 0)
  const currentPlants = Number(invRow?.plants_on_hand ?? 0)
  const nextSeeds = Math.max(0, currentSeeds + seedsDelta)
  const nextPlants = Math.max(0, currentPlants + plantsDelta)
  if (!invRow) {
    const { error: iErr } = await supabase
      .from('garden_inventory')
      .insert({ garden_id: gardenId, plant_id: plantId, seeds_on_hand: nextSeeds, plants_on_hand: nextPlants })
    if (iErr) throw new Error(iErr.message)
  } else {
    const { error: uErr } = await supabase
      .from('garden_inventory')
      .update({ seeds_on_hand: nextSeeds, plants_on_hand: nextPlants })
      .eq('garden_id', gardenId)
      .eq('plant_id', plantId)
    if (uErr) throw new Error(uErr.message)
  }
  // Log transaction
  const qty = Math.abs(seedsDelta !== 0 ? seedsDelta : plantsDelta)
  const { error: tErr } = await supabase
    .from('garden_transactions')
    .insert({ garden_id: gardenId, plant_id: plantId, type: transactionType, quantity: qty, occurred_at: new Date().toISOString(), notes })
  if (tErr) throw new Error(tErr.message)
}

export async function getGardenInstanceInventory(gardenId: string): Promise<Array<{ gardenPlantId: string; seedsOnHand: number; plantsOnHand: number }>> {
  const { data, error } = await supabase
    .from('garden_instance_inventory')
    .select('garden_plant_id, seeds_on_hand, plants_on_hand')
    .eq('garden_id', gardenId)
  if (error) throw new Error(error.message)
  return (data || []).map((r: any) => ({
    gardenPlantId: String(r.garden_plant_id),
    seedsOnHand: Number(r.seeds_on_hand ?? 0),
    plantsOnHand: Number(r.plants_on_hand ?? 0),
  }))
}

export async function adjustInstanceInventoryAndLogTransaction(params: { gardenId: string; gardenPlantId: string; seedsDelta?: number; plantsDelta?: number; transactionType: 'buy_seeds' | 'sell_seeds' | 'buy_plants' | 'sell_plants'; notes?: string | null }): Promise<void> {
  const { gardenId, gardenPlantId, seedsDelta = 0, plantsDelta = 0, transactionType, notes = null } = params
  // Resolve plant_id for transaction log
  const { data: gpRow, error: gpErr } = await supabase
    .from('garden_plants')
    .select('plant_id')
    .eq('id', gardenPlantId)
    .maybeSingle()
  if (gpErr) throw new Error(gpErr.message)
  const plantId = String(gpRow?.plant_id || '')
  // Ensure instance inventory row exists and update
  const { data: invRow } = await supabase
    .from('garden_instance_inventory')
    .select('seeds_on_hand, plants_on_hand')
    .eq('garden_plant_id', gardenPlantId)
    .maybeSingle()
  const currentSeeds = Number(invRow?.seeds_on_hand ?? 0)
  const currentPlants = Number(invRow?.plants_on_hand ?? 0)
  const nextSeeds = Math.max(0, currentSeeds + seedsDelta)
  const nextPlants = Math.max(0, currentPlants + plantsDelta)
  if (!invRow) {
    const { error: iErr } = await supabase
      .from('garden_instance_inventory')
      .insert({ garden_id: gardenId, garden_plant_id: gardenPlantId, seeds_on_hand: nextSeeds, plants_on_hand: nextPlants })
    if (iErr) throw new Error(iErr.message)
  } else {
    const { error: uErr } = await supabase
      .from('garden_instance_inventory')
      .update({ seeds_on_hand: nextSeeds, plants_on_hand: nextPlants })
      .eq('garden_plant_id', gardenPlantId)
    if (uErr) throw new Error(uErr.message)
  }
  // Log transaction using species plant_id
  const qty = Math.abs(seedsDelta !== 0 ? seedsDelta : plantsDelta)
  const { error: tErr } = await supabase
    .from('garden_transactions')
    .insert({ garden_id: gardenId, plant_id: plantId, type: transactionType, quantity: qty, occurred_at: new Date().toISOString(), notes })
  if (tErr) throw new Error(tErr.message)
}

export async function upsertGardenPlantSchedule(params: { gardenPlantId: string; period: 'week' | 'month' | 'year'; amount: number; weeklyDays?: number[] | null; monthlyDays?: number[] | null; yearlyDays?: string[] | null; monthlyNthWeekdays?: string[] | null }): Promise<void> {
  const { gardenPlantId, period, amount, weeklyDays = null, monthlyDays = null, yearlyDays = null, monthlyNthWeekdays = null } = params
  // Try with monthly_nth_weekdays column first; if the column doesn't exist, fallback to upsert without it
  const attempt = async (includeNth: boolean) => {
    const payload: any = {
      garden_plant_id: gardenPlantId,
      period,
      amount,
      weekly_days: weeklyDays,
      monthly_days: monthlyDays,
      yearly_days: yearlyDays,
    }
    if (includeNth) payload.monthly_nth_weekdays = monthlyNthWeekdays
    return await supabase
      .from('garden_plant_schedule')
      .upsert(payload, { onConflict: 'garden_plant_id' })
  }
  let res = await attempt(true)
  if (res.error && /column .*monthly_nth_weekdays.* does not exist/i.test(res.error.message)) {
    res = await attempt(false)
  }
  if (res.error) throw new Error(res.error.message)
}

export async function getGardenPlantSchedule(gardenPlantId: string): Promise<{ period: 'week' | 'month' | 'year'; amount: number; weeklyDays?: number[] | null; monthlyDays?: number[] | null; yearlyDays?: string[] | null; monthlyNthWeekdays?: string[] | null } | null> {
  // Try selecting with monthly_nth_weekdays; fallback if column missing
  const selectWithNth = 'period, amount, weekly_days, monthly_days, yearly_days, monthly_nth_weekdays'
  const base = supabase.from('garden_plant_schedule')
  let q = base.select(selectWithNth).eq('garden_plant_id', gardenPlantId).maybeSingle()
  let { data, error } = await q
  if (error && /column .*monthly_nth_weekdays.* does not exist/i.test(error.message)) {
    const res2 = await base.select('period, amount, weekly_days, monthly_days, yearly_days').eq('garden_plant_id', gardenPlantId).maybeSingle()
    data = res2.data as any
    error = res2.error as any
  }
  if (error) throw new Error(error.message)
  if (!data) return null
  return {
    period: (data as any).period,
    amount: Number((data as any).amount ?? 0),
    weeklyDays: (data as any).weekly_days || null,
    monthlyDays: (data as any).monthly_days || null,
    yearlyDays: (data as any).yearly_days || null,
    monthlyNthWeekdays: (data as any).monthly_nth_weekdays || null,
  }
}

// ===== Tasks v2 helpers =====

export async function createDefaultWateringTask(params: { gardenId: string; gardenPlantId: string; unit: TaskUnit }): Promise<string> {
  const { gardenId, gardenPlantId, unit } = params
  const { data, error } = await supabase.rpc('create_default_watering_task', { _garden_id: gardenId, _garden_plant_id: gardenPlantId, _unit: unit })
  if (error) throw new Error(error.message)
  return String(data)
}

export async function upsertOneTimeTask(params: { gardenId: string; gardenPlantId: string; type: TaskType; customName?: string | null; kind: TaskScheduleKind; dueAt?: string | null; intervalAmount?: number | null; intervalUnit?: TaskUnit | null; requiredCount?: number | null }): Promise<string> {
  const { gardenId, gardenPlantId, type, customName = null, kind, dueAt = null, intervalAmount = null, intervalUnit = null, requiredCount = 1 } = params
  const { data, error } = await supabase.rpc('upsert_one_time_task', {
    _garden_id: gardenId,
    _garden_plant_id: gardenPlantId,
    _type: type,
    _custom_name: customName,
    _kind: kind,
    _due_at: dueAt,
    _amount: intervalAmount,
    _unit: intervalUnit,
    _required: requiredCount ?? 1,
  })
  if (error) throw new Error(error.message)
  return String(data)
}

export async function listPlantTasks(gardenPlantId: string): Promise<GardenPlantTask[]> {
  const base = supabase.from('garden_plant_tasks')
  const selectAll = 'id, garden_id, garden_plant_id, type, custom_name, emoji, schedule_kind, due_at, interval_amount, interval_unit, required_count, period, amount, weekly_days, monthly_days, yearly_days, monthly_nth_weekdays, created_at'
  const selectNoEmoji = 'id, garden_id, garden_plant_id, type, custom_name, schedule_kind, due_at, interval_amount, interval_unit, required_count, period, amount, weekly_days, monthly_days, yearly_days, monthly_nth_weekdays, created_at'
  const selectNoNth = 'id, garden_id, garden_plant_id, type, custom_name, emoji, schedule_kind, due_at, interval_amount, interval_unit, required_count, period, amount, weekly_days, monthly_days, yearly_days, created_at'
  const selectNoEmojiNoNth = 'id, garden_id, garden_plant_id, type, custom_name, schedule_kind, due_at, interval_amount, interval_unit, required_count, period, amount, weekly_days, monthly_days, yearly_days, created_at'
  // Try most complete select first, then gracefully fallback if optional columns are missing
  let { data, error } = await base.select(selectAll).eq('garden_plant_id', gardenPlantId).order('created_at', { ascending: true })
  if (error) {
    const msg = String(error.message || '')
    const noEmoji = /column .*emoji.* does not exist/i.test(msg)
    const noNth = /column .*monthly_nth_weekdays.* does not exist/i.test(msg)
    if (noEmoji && noNth) {
      const res = await base.select(selectNoEmojiNoNth).eq('garden_plant_id', gardenPlantId).order('created_at', { ascending: true })
      data = res.data as any
      error = res.error as any
    } else if (noEmoji) {
      const res = await base.select(selectNoEmoji).eq('garden_plant_id', gardenPlantId).order('created_at', { ascending: true })
      data = res.data as any
      error = res.error as any
    } else if (noNth) {
      const res = await base.select(selectNoNth).eq('garden_plant_id', gardenPlantId).order('created_at', { ascending: true })
      data = res.data as any
      error = res.error as any
    }
  }
  if (error) throw new Error(error.message)
  return (data || []).map((r: any) => ({
    id: String(r.id),
    gardenId: String(r.garden_id),
    gardenPlantId: String(r.garden_plant_id),
    type: r.type,
    customName: r.custom_name || null,
    emoji: (r as any).emoji || null,
    scheduleKind: r.schedule_kind,
    dueAt: r.due_at || null,
    intervalAmount: r.interval_amount ?? null,
    intervalUnit: r.interval_unit || null,
    requiredCount: Number(r.required_count ?? 1),
    period: r.period || null,
    amount: r.amount ?? null,
    weeklyDays: r.weekly_days || null,
    monthlyDays: r.monthly_days || null,
    yearlyDays: r.yearly_days || null,
    monthlyNthWeekdays: (r as any).monthly_nth_weekdays || null,
    createdAt: String(r.created_at),
  }))
}

export async function deletePlantTask(taskId: string): Promise<void> {
  const { error } = await supabase.from('garden_plant_tasks').delete().eq('id', taskId)
  if (error) throw new Error(error.message)
}

export async function listTaskOccurrences(taskId: string, windowDays = 60): Promise<GardenPlantTaskOccurrence[]> {
  const start = new Date()
  start.setDate(start.getDate() - windowDays)
  const end = new Date()
  end.setDate(end.getDate() + windowDays)
  const { data, error } = await supabase
    .from('garden_plant_task_occurrences')
    .select('id, task_id, garden_plant_id, due_at, required_count, completed_count, completed_at')
    .eq('task_id', taskId)
    .gte('due_at', start.toISOString())
    .lte('due_at', end.toISOString())
    .order('due_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data || []).map((r: any) => ({
    id: String(r.id),
    taskId: String(r.task_id),
    gardenPlantId: String(r.garden_plant_id),
    dueAt: String(r.due_at),
    requiredCount: Number(r.required_count ?? 1),
    completedCount: Number(r.completed_count ?? 0),
    completedAt: r.completed_at || null,
  }))
}

export async function progressTaskOccurrence(occurrenceId: string, increment = 1): Promise<void> {
  const { error } = await supabase.rpc('progress_task_occurrence', { _occurrence_id: occurrenceId, _increment: increment })
  if (error) throw new Error(error.message)
  
  // Refresh cache in background (don't block)
  // Get garden_id from occurrence
  try {
    const { data } = await supabase
      .from('garden_plant_task_occurrences')
      .select('task_id, garden_plant_tasks!inner(garden_id)')
      .eq('id', occurrenceId)
      .single()
    
    if (data && (data as any).garden_plant_tasks) {
      const gardenId = String((data as any).garden_plant_tasks.garden_id)
      const today = new Date().toISOString().slice(0, 10)
      
      // Refresh garden cache asynchronously
      refreshGardenTaskCache(gardenId, today).catch(() => {})
      
      // Also refresh user-level cache for all members of this garden
      const { data: members } = await supabase
        .from('garden_members')
        .select('user_id')
        .eq('garden_id', gardenId)
      
      if (members) {
        for (const member of members) {
          refreshUserTaskCache(String(member.user_id), today).catch(() => {})
        }
      }
    }
  } catch {
    // Silently fail - cache refresh is best effort
  }
}

export async function listGardenTasks(gardenId: string): Promise<GardenPlantTask[]> {
  const base = supabase.from('garden_plant_tasks')
  const selectAll = 'id, garden_id, garden_plant_id, type, custom_name, emoji, schedule_kind, due_at, interval_amount, interval_unit, required_count, period, amount, weekly_days, monthly_days, yearly_days, monthly_nth_weekdays, created_at'
  const selectNoEmoji = 'id, garden_id, garden_plant_id, type, custom_name, schedule_kind, due_at, interval_amount, interval_unit, required_count, period, amount, weekly_days, monthly_days, yearly_days, monthly_nth_weekdays, created_at'
  const selectNoNth = 'id, garden_id, garden_plant_id, type, custom_name, emoji, schedule_kind, due_at, interval_amount, interval_unit, required_count, period, amount, weekly_days, monthly_days, yearly_days, created_at'
  const selectNoEmojiNoNth = 'id, garden_id, garden_plant_id, type, custom_name, schedule_kind, due_at, interval_amount, interval_unit, required_count, period, amount, weekly_days, monthly_days, yearly_days, created_at'
  let { data, error } = await base.select(selectAll).eq('garden_id', gardenId).order('created_at', { ascending: true })
  if (error) {
    const msg = String(error.message || '')
    const noEmoji = /column .*emoji.* does not exist/i.test(msg)
    const noNth = /column .*monthly_nth_weekdays.* does not exist/i.test(msg)
    if (noEmoji && noNth) {
      const res = await base.select(selectNoEmojiNoNth).eq('garden_id', gardenId).order('created_at', { ascending: true })
      data = res.data as any
      error = res.error as any
    } else if (noEmoji) {
      const res = await base.select(selectNoEmoji).eq('garden_id', gardenId).order('created_at', { ascending: true })
      data = res.data as any
      error = res.error as any
    } else if (noNth) {
      const res = await base.select(selectNoNth).eq('garden_id', gardenId).order('created_at', { ascending: true })
      data = res.data as any
      error = res.error as any
    }
  }
  if (error) throw new Error(error.message)
  return (data || []).map((r: any) => ({
    id: String(r.id),
    gardenId: String(r.garden_id),
    gardenPlantId: String(r.garden_plant_id),
    type: r.type,
    customName: r.custom_name || null,
    emoji: (r as any).emoji || null,
    scheduleKind: r.schedule_kind,
    dueAt: r.due_at || null,
    intervalAmount: r.interval_amount ?? null,
    intervalUnit: r.interval_unit || null,
    requiredCount: Number(r.required_count ?? 1),
    period: r.period || null,
    amount: r.amount ?? null,
    weeklyDays: r.weekly_days || null,
    monthlyDays: r.monthly_days || null,
    yearlyDays: r.yearly_days || null,
    monthlyNthWeekdays: (r as any).monthly_nth_weekdays || null,
    createdAt: String(r.created_at),
  }))
}

function addInterval(date: Date, amount: number, unit: TaskUnit): Date {
  const d = new Date(date)
  if (unit === 'hour') d.setHours(d.getHours() + amount)
  else if (unit === 'day') d.setDate(d.getDate() + amount)
  else if (unit === 'week') d.setDate(d.getDate() + amount * 7)
  else if (unit === 'month') d.setMonth(d.getMonth() + amount)
  else if (unit === 'year') d.setFullYear(d.getFullYear() + amount)
  return d
}

export async function ensureTaskOccurrence(taskId: string, gardenPlantId: string, dueAtIso: string, requiredCount: number): Promise<void> {
  // Prefer idempotent upsert by (task_id, due_at). If the unique index doesn't
  // exist yet server-side, gracefully fall back to a manual ensure.
  try {
    const { error } = await supabase
      .from('garden_plant_task_occurrences')
      .upsert(
        { task_id: taskId, garden_plant_id: gardenPlantId, due_at: dueAtIso, required_count: requiredCount },
        { onConflict: 'task_id, due_at' }
      )
    if (error) throw error
  } catch (e: any) {
    const msg = String(e?.message || '')
    const noConstraint = /no unique|no exclusion constraint|ON CONFLICT specification/i.test(msg)
    if (!noConstraint) throw e
    // Fallback: pick an existing row (keep the one with the highest completed_count),
    // update its required_count to at least requiredCount, or insert if none exists.
    const { data: rows } = await supabase
      .from('garden_plant_task_occurrences')
      .select('id, completed_count, required_count')
      .eq('task_id', taskId)
      .eq('due_at', dueAtIso)
      .order('completed_count', { ascending: false, nullsFirst: false })
    if (Array.isArray(rows) && rows.length > 0) {
      const keeper = rows[0] as any
      const nextReq = Math.max(Number(keeper.required_count || 1), Math.max(1, Number(requiredCount || 1)))
      await supabase
        .from('garden_plant_task_occurrences')
        .update({ required_count: nextReq, garden_plant_id: gardenPlantId })
        .eq('id', String(keeper.id))
    } else {
      const { error: insErr } = await supabase
        .from('garden_plant_task_occurrences')
        .insert({ task_id: taskId, garden_plant_id: gardenPlantId, due_at: dueAtIso, required_count: requiredCount })
      if (insErr) throw new Error(insErr.message)
    }
  }
}

export async function syncTaskOccurrencesForGarden(gardenId: string, startIso: string, endIso: string): Promise<void> {
  const tasks = await listGardenTasks(gardenId)
  const start = new Date(startIso)
  const end = new Date(endIso)
  for (const t of tasks) {
    if (t.scheduleKind === 'one_time_date') {
      if (!t.dueAt) continue
      const due = new Date(t.dueAt)
      if (due >= start && due <= end) {
        await ensureTaskOccurrence(t.id, t.gardenPlantId, due.toISOString(), t.requiredCount)
      }
    } else if (t.scheduleKind === 'one_time_duration') {
      const anchor = new Date(t.createdAt)
      const amount = Number(t.intervalAmount || 1)
      const unit = (t.intervalUnit || 'day') as TaskUnit
      const due = addInterval(anchor, amount, unit)
      if (due >= start && due <= end) {
        await ensureTaskOccurrence(t.id, t.gardenPlantId, due.toISOString(), t.requiredCount)
      }
    } else if (t.scheduleKind === 'repeat_duration') {
      const amount = Number(t.intervalAmount || 1)
      const unit = (t.intervalUnit || 'week') as TaskUnit
      let cur = new Date(t.createdAt)
      // Align to first occurrence >= start
      while (cur < start) {
        cur = addInterval(cur, amount, unit)
        // guard: avoid infinite loops if invalid config
        if (amount <= 0) break
      }
      while (cur <= end) {
        await ensureTaskOccurrence(t.id, t.gardenPlantId, cur.toISOString(), t.requiredCount)
        cur = addInterval(cur, amount, unit)
      }
    } else if (t.scheduleKind === 'repeat_pattern') {
      const period = (t.period || 'week') as 'week' | 'month' | 'year'
      // Iterate each day between start and end and match to pattern
      const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), 12, 0, 0))
      const endDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate(), 12, 0, 0))
      const weeklyDays = (t.weeklyDays || []) as number[]
      const monthlyDays = (t.monthlyDays || []) as number[]
      const monthlyNthWeekdays = (t.monthlyNthWeekdays || []) as string[]
      const yearlyDays = (t.yearlyDays || []) as string[]
      while (cur <= endDay) {
        const m = cur.getUTCMonth() + 1
        const d = cur.getUTCDate()
        const weekday = cur.getUTCDay() // 0=Sun..6=Sat
        const mm = String(m).padStart(2, '0')
        const dd = String(d).padStart(2, '0')
        const ymd = `${mm}-${dd}`
        let match = false
        if (period === 'week') {
          match = weeklyDays.includes(weekday)
        } else if (period === 'month') {
          if (monthlyDays.includes(d)) match = true
          if (!match && monthlyNthWeekdays.length > 0) {
            const weekIndex = Math.floor((d - 1) / 7) + 1 // 1..4
            const key = `${weekIndex}-${weekday}`
            if (monthlyNthWeekdays.includes(key)) match = true
          }
        } else if (period === 'year') {
          // Backward compatibility: support legacy MM-DD dates and new MM-weekIndex-weekday keys
          if (yearlyDays.includes(ymd)) {
            match = true
          } else if (yearlyDays.length > 0) {
            const weekIndex = Math.floor((d - 1) / 7) + 1 // 1..4
            const key = `${mm}-${weekIndex}-${weekday}`
            if (yearlyDays.includes(key)) match = true
          }
        }
        if (match) {
          await ensureTaskOccurrence(t.id, t.gardenPlantId, cur.toISOString(), t.requiredCount)
        }
        cur.setUTCDate(cur.getUTCDate() + 1)
      }
    }
  }
}

/**
 * Regenerates task occurrences for the given garden and window by:
 * - inserting any missing occurrences that should exist per current schedules
 * - deleting occurrences that no longer match any task's schedule (stale/ghosts)
 * - updating required_count for existing occurrences if the schedule's requirement changed
 */
export async function resyncTaskOccurrencesForGarden(gardenId: string, startIso: string, endIso: string): Promise<void> {
  const tasks = await listGardenTasks(gardenId)
  if (tasks.length === 0) return
  const start = new Date(startIso)
  const end = new Date(endIso)

  // Normalize keys by day (YYYY-MM-DD) to avoid time drift causing duplicates or lost progress
  const toDay = (d: Date) => new Date(d).toISOString().slice(0, 10)
  const dayToNoonIso = (day: string) => `${day}T12:00:00.000Z`

  // Compute expected occurrences based on current task definitions
  type Expected = { taskId: string; gardenPlantId: string; dueAtIso: string; requiredCount: number; dayKey: string }
  const expectedByKey = new Map<string, Expected>()

  const addExpected = (taskId: string, gardenPlantId: string, due: Date, required: number) => {
    const day = toDay(due)
    const dueIso = dayToNoonIso(day)
    const key = `${taskId}::${day}`
    // Only keep the highest requirement if duplicates somehow arise
    const prev = expectedByKey.get(key)
    if (!prev || prev.requiredCount < required) {
      expectedByKey.set(key, { taskId, gardenPlantId, dueAtIso: dueIso, requiredCount: required, dayKey: key })
    }
  }

  for (const t of tasks) {
    const reqCount = Math.max(1, Number(t.requiredCount || 1))
    if (t.scheduleKind === 'one_time_date') {
      if (!t.dueAt) continue
      const due = new Date(t.dueAt)
      if (due >= start && due <= end) addExpected(t.id, t.gardenPlantId, due, reqCount)
    } else if (t.scheduleKind === 'one_time_duration') {
      const anchor = new Date(t.createdAt)
      const amount = Math.max(1, Number(t.intervalAmount || 1))
      const unit = (t.intervalUnit || 'day') as TaskUnit
      const due = addInterval(anchor, amount, unit)
      if (due >= start && due <= end) addExpected(t.id, t.gardenPlantId, due, reqCount)
    } else if (t.scheduleKind === 'repeat_duration') {
      const amount = Math.max(1, Number(t.intervalAmount || 1))
      const unit = (t.intervalUnit || 'week') as TaskUnit
      if (amount <= 0) continue
      let cur = new Date(t.createdAt)
      while (cur < start) {
        cur = addInterval(cur, amount, unit)
      }
      while (cur <= end) {
        addExpected(t.id, t.gardenPlantId, cur, reqCount)
        cur = addInterval(cur, amount, unit)
      }
    } else if (t.scheduleKind === 'repeat_pattern') {
      const period = (t.period || 'week') as 'week' | 'month' | 'year'
      const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), 12, 0, 0))
      const endDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate(), 12, 0, 0))
      const weeklyDays = (t.weeklyDays || []) as number[]
      const monthlyDays = (t.monthlyDays || []) as number[]
      const monthlyNthWeekdays = (t.monthlyNthWeekdays || []) as string[]
      const yearlyDays = (t.yearlyDays || []) as string[]
      while (cur <= endDay) {
        const m = cur.getUTCMonth() + 1
        const d = cur.getUTCDate()
        const weekday = cur.getUTCDay()
        const mm = String(m).padStart(2, '0')
        const dd = String(d).padStart(2, '0')
        const ymd = `${mm}-${dd}`
        let match = false
        if (period === 'week') {
          match = weeklyDays.includes(weekday)
        } else if (period === 'month') {
          if (monthlyDays.includes(d)) match = true
          if (!match && monthlyNthWeekdays.length > 0) {
            const weekIndex = Math.floor((d - 1) / 7) + 1
            const key = `${weekIndex}-${weekday}`
            if (monthlyNthWeekdays.includes(key)) match = true
          }
        } else if (period === 'year') {
          if (yearlyDays.includes(ymd)) {
            match = true
          } else if (yearlyDays.length > 0) {
            const weekIndex = Math.floor((d - 1) / 7) + 1
            const key = `${mm}-${weekIndex}-${weekday}`
            if (yearlyDays.includes(key)) match = true
          }
        }
        if (match) addExpected(t.id, t.gardenPlantId, cur, reqCount)
        cur.setUTCDate(cur.getUTCDate() + 1)
      }
    }
  }

  const taskIds = Array.from(new Set(tasks.map(t => t.id)))
  const existing = await listOccurrencesForTasks(taskIds, startIso, endIso)
  const existingByKey = new Map<string, { id: string; requiredCount: number; completedCount: number }>()
  const dupGroups = new Map<string, Array<{ id: string; requiredCount: number; completedCount: number }>>()
  for (const o of existing) {
    const day = toDay(new Date(o.dueAt))
    const key = `${o.taskId}::${day}`
    const entry = { id: o.id, requiredCount: Number(o.requiredCount || 1), completedCount: Number(o.completedCount || 0) }
    if (!dupGroups.has(key)) dupGroups.set(key, [])
    dupGroups.get(key)!.push(entry)
  }
  // Dedupe: for keys with multiple rows, consolidate progress and keep a single row
  for (const [key, rows] of dupGroups.entries()) {
    if (rows.length <= 1) {
      const r0 = rows[0]
      if (r0) existingByKey.set(key, { id: r0.id, requiredCount: r0.requiredCount, completedCount: r0.completedCount })
      continue
    }
    // Merge counts across duplicates
    const exp = expectedByKey.get(key)
    const maxRequiredFromExisting = rows.reduce((m, r) => Math.max(m, Number(r.requiredCount || 1)), 1)
    const expectedRequired = exp ? Math.max(1, Number(exp.requiredCount || 1)) : 1
    const mergedRequired = Math.max(maxRequiredFromExisting, expectedRequired)
    const sumCompleted = rows.reduce((s, r) => s + Math.min(Number(r.requiredCount || 1), Number(r.completedCount || 0)), 0)
    const mergedCompleted = Math.min(mergedRequired, sumCompleted)
    // Choose keeper: the one with highest completedCount, fallback to first
    const keeper = rows.slice().sort((a, b) => (b.completedCount - a.completedCount) || (b.requiredCount - a.requiredCount))[0]
    const dupIds = rows.filter(r => r.id !== keeper.id).map(r => r.id)
    // Update keeper to merged values
    await supabase
      .from('garden_plant_task_occurrences')
      .update({ required_count: mergedRequired, completed_count: mergedCompleted })
      .eq('id', keeper.id)
    // Delete duplicates
    if (dupIds.length > 0) {
      await supabase.from('garden_plant_task_occurrences').delete().in('id', dupIds)
    }
    existingByKey.set(key, { id: keeper.id, requiredCount: mergedRequired, completedCount: mergedCompleted })
  }
  // Ensure singletons are recorded in existingByKey
  for (const [key, rows] of dupGroups.entries()) {
    if (rows.length === 1 && !existingByKey.has(key)) {
      const r0 = rows[0]
      existingByKey.set(key, { id: r0.id, requiredCount: r0.requiredCount, completedCount: r0.completedCount })
    }
  }

  // Determine operations
  const toInsert: Expected[] = []
  const toUpdate: Array<{ id: string; requiredCount: number; completedCount: number }> = []
  const existingKeys = new Set(Array.from(existingByKey.keys()))
  for (const [key, exp] of expectedByKey.entries()) {
    if (!existingKeys.has(key)) {
      toInsert.push(exp)
    } else {
      const ex = existingByKey.get(key)!
      const nextReq = Math.max(ex.completedCount, exp.requiredCount)
      if (ex.requiredCount !== nextReq) {
        toUpdate.push({ id: ex.id, requiredCount: nextReq, completedCount: ex.completedCount })
      }
    }
  }
  const expectedKeys = new Set(expectedByKey.keys())
  const toDeleteIds: string[] = []
  for (const [key, ex] of existingByKey.entries()) {
    if (!expectedKeys.has(key)) toDeleteIds.push(ex.id)
  }

  // Apply deletes first to avoid duplicates then inserts/updates
  if (toDeleteIds.length > 0) {
    await supabase.from('garden_plant_task_occurrences').delete().in('id', toDeleteIds)
  }
  for (const ins of toInsert) {
    await ensureTaskOccurrence(ins.taskId, ins.gardenPlantId, ins.dueAtIso, ins.requiredCount)
  }
  for (const upd of toUpdate) {
    await supabase
      .from('garden_plant_task_occurrences')
      .update({ required_count: upd.requiredCount })
      .eq('id', upd.id)
  }
}

export async function resyncMultipleGardensTasks(gardenIds: string[], startIso: string, endIso: string): Promise<void> {
  if (gardenIds.length === 0) return

  // Try RPC first (fast path)
  const rpcName = 'ensure_gardens_tasks_occurrences'
  if (!missingSupabaseRpcs.has(rpcName)) {
    try {
      const { error } = await supabase.rpc(rpcName, {
        _garden_ids: gardenIds,
        _start_iso: startIso,
        _end_iso: endIso,
      })
      if (!error) return

      if (error && !(isMissingRpcFunction(error, rpcName) || isRpcDependencyUnavailable(error, rpcName))) {
        console.warn('[gardens] ensure_gardens_tasks_occurrences RPC failed, falling back to parallel JS:', error)
      }
    } catch (err: any) {
      if (!(isMissingRpcFunction(err, rpcName) || isRpcDependencyUnavailable(err, rpcName))) {
        console.warn('[gardens] ensure_gardens_tasks_occurrences RPC failed, falling back to parallel JS:', err)
      }
    }
  }

  // Fallback to parallel JS calls (batch in chunks of 5 to avoid connection limits)
  const chunkSize = 5
  for (let i = 0; i < gardenIds.length; i += chunkSize) {
    const chunk = gardenIds.slice(i, i + chunkSize)
    await Promise.all(chunk.map(gid => resyncTaskOccurrencesForGarden(gid, startIso, endIso)))
  }
}

export async function createPatternTask(params: {
  gardenId: string
  gardenPlantId: string
  type: TaskType
  customName?: string | null
  emoji?: string | null
  period: 'week' | 'month' | 'year'
  amount: number
  weeklyDays?: number[] | null
  monthlyDays?: number[] | null
  yearlyDays?: string[] | null
  monthlyNthWeekdays?: string[] | null
  requiredCount?: number | null
}): Promise<string> {
  const { gardenId, gardenPlantId, type, customName = null, emoji = null, period, amount, weeklyDays = null, monthlyDays = null, yearlyDays = null, monthlyNthWeekdays = null, requiredCount = 1 } = params
  // Attempt insert with graceful fallbacks for optional columns (emoji, monthly_nth_weekdays)
  const attempt = async (includeEmoji: boolean, includeNth: boolean) => {
    const payload: any = {
      garden_id: gardenId,
      garden_plant_id: gardenPlantId,
      type,
      custom_name: customName,
      schedule_kind: 'repeat_pattern',
      period,
      amount,
      weekly_days: weeklyDays,
      monthly_days: monthlyDays,
      yearly_days: yearlyDays,
      required_count: requiredCount ?? 1,
    }
    if (includeNth) payload.monthly_nth_weekdays = monthlyNthWeekdays
    if (includeEmoji && type === 'custom') payload.emoji = emoji || null
    return await supabase
      .from('garden_plant_tasks')
      .insert(payload)
      .select('id')
      .single()
  }
  let includeEmoji = true
  let includeNth = true
  let { data, error } = await attempt(includeEmoji, includeNth)
  // Handle missing columns by retrying without them
  if (error) {
    const msg = String(error.message || '')
    const noNth = /column .*monthly_nth_weekdays.* does not exist/i.test(msg)
    const noEmoji = /column .*emoji.* does not exist/i.test(msg)
    if (noNth) includeNth = false
    if (noEmoji) includeEmoji = false
    if (noNth || noEmoji) {
      const res2 = await attempt(includeEmoji, includeNth)
      data = res2.data as any
      error = res2.error as any
    }
  }
  if (error) throw new Error(error.message)
  return String((data as any).id)
}

export async function updatePatternTask(params: {
  taskId: string
  type?: TaskType
  customName?: string | null
  emoji?: string | null
  period?: 'week' | 'month' | 'year'
  amount?: number | null
  weeklyDays?: number[] | null
  monthlyDays?: number[] | null
  yearlyDays?: string[] | null
  monthlyNthWeekdays?: string[] | null
  requiredCount?: number | null
}): Promise<void> {
  const { taskId, type, customName, emoji, period, amount, weeklyDays, monthlyDays, yearlyDays, monthlyNthWeekdays, requiredCount } = params
  const basePayload: any = {}
  if (type) basePayload.type = type
  if (customName !== undefined) basePayload.custom_name = customName
  if (emoji !== undefined) basePayload.emoji = emoji
  if (period) basePayload.period = period
  if (amount !== undefined && amount !== null) basePayload.amount = amount
  if (weeklyDays !== undefined) basePayload.weekly_days = weeklyDays
  if (monthlyDays !== undefined) basePayload.monthly_days = monthlyDays
  if (yearlyDays !== undefined) basePayload.yearly_days = yearlyDays
  if (monthlyNthWeekdays !== undefined) basePayload.monthly_nth_weekdays = monthlyNthWeekdays
  if (requiredCount !== undefined && requiredCount !== null) basePayload.required_count = requiredCount
  basePayload.schedule_kind = 'repeat_pattern'

  const attempt = async (includeEmoji: boolean, includeNth: boolean) => {
    const pl: any = { ...basePayload }
    if (!includeEmoji) delete pl.emoji
    if (!includeNth) delete pl.monthly_nth_weekdays
    return await supabase
      .from('garden_plant_tasks')
      .update(pl)
      .eq('id', taskId)
  }
  let includeEmoji = true
  let includeNth = true
  let { error } = await attempt(includeEmoji, includeNth)
  if (error) {
    const msg = String(error.message || '')
    const noNth = /column .*monthly_nth_weekdays.* does not exist/i.test(msg)
    const noEmoji = /column .*emoji.* does not exist/i.test(msg)
    if (noNth) includeNth = false
    if (noEmoji) includeEmoji = false
    if (noNth || noEmoji) {
      const res2 = await attempt(includeEmoji, includeNth)
      error = res2.error as any
    }
  }
  if (error) throw new Error(error.message)
}

export async function listOccurrencesForTasks(taskIds: string[], startIso: string, endIso: string): Promise<GardenPlantTaskOccurrence[]> {
  if (taskIds.length === 0) return []
  const { data, error } = await supabase
    .from('garden_plant_task_occurrences')
    .select('id, task_id, garden_plant_id, due_at, required_count, completed_count, completed_at')
    .in('task_id', taskIds)
    .gte('due_at', startIso)
    .lte('due_at', endIso)
    .order('due_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data || []).map((r: any) => ({
    id: String(r.id),
    taskId: String(r.task_id),
    gardenPlantId: String(r.garden_plant_id),
    dueAt: String(r.due_at),
    requiredCount: Number(r.required_count ?? 1),
    completedCount: Number(r.completed_count ?? 0),
    completedAt: r.completed_at || null,
  }))
}

/**
 * Batched version that fetches occurrences for multiple gardens at once.
 * Reduces egress by combining queries and minimizing round trips.
 * Adds limit to prevent excessive data transfer.
 */
export async function listOccurrencesForMultipleGardens(
  gardenTaskIds: Record<string, string[]>,
  startIso: string,
  endIso: string,
  limitPerGarden: number = 1000 // Limit to prevent excessive egress
): Promise<Record<string, GardenPlantTaskOccurrence[]>> {
  const allTaskIds = Array.from(new Set(Object.values(gardenTaskIds).flat()))
  if (allTaskIds.length === 0) return {}

  // Try RPC function first for server-side optimization
  const rpcName = 'get_task_occurrences_batch'
  if (!missingSupabaseRpcs.has(rpcName)) {
    try {
      const { data, error } = await supabase.rpc(rpcName, {
        _task_ids: allTaskIds,
        _start_iso: startIso,
        _end_iso: endIso,
        _limit_per_task: limitPerGarden,
      })
      if (!error && data && Array.isArray(data)) {
        // Group by garden using task_id -> garden_id mapping
        const taskToGarden: Record<string, string> = {}
        for (const [gardenId, taskIds] of Object.entries(gardenTaskIds)) {
          for (const taskId of taskIds) {
            taskToGarden[taskId] = gardenId
          }
        }

        const result: Record<string, GardenPlantTaskOccurrence[]> = {}
        for (const r of data) {
          const taskId = String(r.task_id)
          const gardenId = taskToGarden[taskId]
          if (!gardenId) continue

          if (!result[gardenId]) result[gardenId] = []
          result[gardenId].push({
            id: String(r.id),
            taskId,
            gardenPlantId: String(r.garden_plant_id),
            dueAt: String(r.due_at),
            requiredCount: Number(r.required_count ?? 1),
            completedCount: Number(r.completed_count ?? 0),
            completedAt: r.completed_at || null,
          })
        }
        return result
      }
      if (error) {
        if (!(isMissingRpcFunction(error, rpcName) || isRpcDependencyUnavailable(error, rpcName))) {
          console.warn('[gardens] get_task_occurrences_batch RPC failed, falling back to regular query:', error)
        }
      }
    } catch (err) {
      if (!(isMissingRpcFunction(err, rpcName) || isRpcDependencyUnavailable(err, rpcName))) {
        console.warn('[gardens] get_task_occurrences_batch RPC failed, falling back to regular query:', err)
      }
    }
  }

  // Fallback: Single query with limit to prevent excessive egress
  const { data, error } = await supabase
    .from('garden_plant_task_occurrences')
    .select('id, task_id, garden_plant_id, due_at, required_count, completed_count, completed_at')
    .in('task_id', allTaskIds)
    .gte('due_at', startIso)
    .lte('due_at', endIso)
    .order('due_at', { ascending: true })
    .limit(limitPerGarden * Object.keys(gardenTaskIds).length) // Total limit
  
  if (error) throw new Error(error.message)
  
  // Group by garden using task_id -> garden_id mapping
  const taskToGarden: Record<string, string> = {}
  for (const [gardenId, taskIds] of Object.entries(gardenTaskIds)) {
    for (const taskId of taskIds) {
      taskToGarden[taskId] = gardenId
    }
  }
  
  const result: Record<string, GardenPlantTaskOccurrence[]> = {}
  for (const r of (data || [])) {
    const taskId = String(r.task_id)
    const gardenId = taskToGarden[taskId]
    if (!gardenId) continue
    
    if (!result[gardenId]) result[gardenId] = []
    result[gardenId].push({
      id: String(r.id),
      taskId,
      gardenPlantId: String(r.garden_plant_id),
      dueAt: String(r.due_at),
      requiredCount: Number(r.required_count ?? 1),
      completedCount: Number(r.completed_count ?? 0),
      completedAt: r.completed_at || null,
    })
  }
  
  return result
}

// Return a mapping from occurrenceId -> list of users who progressed/completed it
export async function listCompletionsForOccurrences(occurrenceIds: string[]): Promise<Record<string, Array<{ userId: string; displayName: string | null }>>> {
  if (occurrenceIds.length === 0) return {}
  // Fetch raw completion rows
  const { data: rows, error } = await supabase
    .from('garden_task_user_completions')
    .select('occurrence_id, user_id')
    .in('occurrence_id', occurrenceIds)
  if (error) throw new Error(error.message)
  const uniquePairs = new Map<string, { occurrenceId: string; userId: string }>()
  for (const r of (rows || []) as any[]) {
    const occId = String((r as any).occurrence_id)
    const uid = String((r as any).user_id)
    uniquePairs.set(`${occId}::${uid}`, { occurrenceId: occId, userId: uid })
  }
  const pairs = Array.from(uniquePairs.values())
  const userIds = Array.from(new Set(pairs.map(p => p.userId)))
  // Resolve display names from profiles
  const { data: profs } = await supabase
    .from('profiles')
    .select('id, display_name')
    .in('id', userIds)
  const idToName: Record<string, string | null> = {}
  for (const p of (profs || []) as any[]) {
    idToName[String(p.id)] = (p as any).display_name || null
  }
  const map: Record<string, Array<{ userId: string; displayName: string | null }>> = {}
  for (const { occurrenceId, userId } of pairs) {
    if (!map[occurrenceId]) map[occurrenceId] = []
    map[occurrenceId].push({ userId, displayName: idToName[userId] ?? null })
  }
  return map
}


// ===== Cached Task Data Functions =====
// These functions use pre-computed cache tables for faster performance

/**
 * Get cached daily progress for a garden (uses cache table)
 */
export async function getGardenTodayProgressCached(gardenId: string, dayIso: string): Promise<{ due: number; completed: number; hasRemainingTasks?: boolean; allTasksDone?: boolean }> {
  const normalizedGardenId = normalizeGardenId(gardenId)
  if (!normalizedGardenId) {
    return { due: 0, completed: 0, hasRemainingTasks: false, allTasksDone: true }
  }
  const tableName = 'garden_task_daily_cache'
  if (!missingSupabaseTablesOrViews.has(tableName)) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('due_count, completed_count, has_remaining_tasks, all_tasks_done')
        .eq('garden_id', normalizedGardenId)
        .eq('cache_date', dayIso)
        .maybeSingle()
      
      if (error) {
        if (isMissingTableOrView(error, tableName)) {
          // Disable future attempts
        }
      } else if (data) {
        const due = Number(data.due_count ?? 0)
        const completed = Number(data.completed_count ?? 0)
        
        // Verify cache: if cache says no tasks, verify by computing from real data
        if (due === 0 && completed === 0 && Boolean(data.all_tasks_done ?? true)) {
          // Cache says no tasks - verify this is correct
          const verified = await getGardenTodayProgressUltraFast(normalizedGardenId, dayIso)
          if (verified.due > 0 || verified.completed > 0) {
            // Cache is wrong - use real data and trigger refresh
            const hasRemaining = verified.due > verified.completed
            if (!taskCachesDisabled) {
              setTimeout(() => {
                refreshGardenTaskCache(normalizedGardenId, dayIso).catch(() => {})
              }, 0)
            }
            return {
              ...verified,
              hasRemainingTasks: hasRemaining,
              allTasksDone: !hasRemaining && verified.due > 0,
            }
          }
        }
        
        return {
          due,
          completed,
          hasRemainingTasks: Boolean(data.has_remaining_tasks ?? false),
          allTasksDone: Boolean(data.all_tasks_done ?? true),
        }
      }
    } catch (err) {
      if (!isMissingTableOrView(err, tableName)) {
        console.warn('[gardens] getGardenTodayProgressCached failed, falling back to RPC:', err)
      }
    }
  }
  
  // Fallback: use RPC function (computes from real data)
  const prog = await getGardenTodayProgressUltraFast(normalizedGardenId, dayIso)
  const hasRemaining = prog.due > prog.completed
  // Trigger background cache refresh
  if (!taskCachesDisabled) {
    setTimeout(() => {
      refreshGardenTaskCache(normalizedGardenId, dayIso).catch(() => {})
    }, 0)
  }
  return {
    ...prog,
    hasRemainingTasks: hasRemaining,
    allTasksDone: !hasRemaining && prog.due > 0,
  }
}

/**
 * Get batched progress for multiple gardens (DIRECT cache read - FASTEST)
 * Directly queries cache table without RPC overhead
 * WITH FALLBACK: Verifies cache correctness and computes from real data if cache is wrong
 */
export async function getGardensTodayProgressBatchCached(gardenIds: string[], dayIso: string): Promise<Record<string, { due: number; completed: number; hasRemainingTasks?: boolean; allTasksDone?: boolean }>> {
  if (gardenIds.length === 0) return {}
  const { valid: safeGardenIds } = normalizeGardenIdList(gardenIds)
  if (safeGardenIds.length === 0) return {}
  if (taskCachesDisabled) {
    const verifiedProg = await getGardensTodayProgressBatch(gardenIds, dayIso)
    return buildGardenProgressResult(gardenIds, verifiedProg)
  }

  try {
    // OPTIMIZED: Direct query to cache table - FASTEST approach
    // If table doesn't exist, cacheErr will indicate that - handle gracefully
    const tableName = 'garden_task_daily_cache'
    let cacheData: any[] | null = null
    let cacheErr: any = null
    if (!missingSupabaseTablesOrViews.has(tableName)) {
      try {
        const response = await supabase
          .from(tableName)
          .select('garden_id, due_count, completed_count, has_remaining_tasks, all_tasks_done')
            .in('garden_id', safeGardenIds)
          .eq('cache_date', dayIso)
        cacheData = response.data
        cacheErr = response.error
        if (cacheErr && isMissingTableOrView(cacheErr, tableName)) {
          cacheData = null
        }
      } catch (err) {
        if (!isMissingTableOrView(err, tableName)) {
          console.warn('[gardens] getGardensTodayProgressBatchCached cache query failed, falling back:', err)
        }
      }
    }

    const result: Record<string, { due: number; completed: number; hasRemainingTasks?: boolean; allTasksDone?: boolean }> = {}
    
    // Build result from cache (if available and no error)
    if (!cacheErr && cacheData) {
      for (const row of cacheData) {
        const gid = String(row.garden_id)
        const due = Number(row.due_count ?? 0)
        const completed = Number(row.completed_count ?? 0)
        result[gid] = {
          due,
          completed,
          hasRemainingTasks: Boolean(row.has_remaining_tasks ?? false),
          allTasksDone: Boolean(row.all_tasks_done ?? true),
        }
      }
    }
    
    // Fill in missing gardens - VERIFY by computing from real data
    const gardensToVerify: string[] = []
    for (const gid of gardenIds) {
      if (!result[gid]) {
        gardensToVerify.push(gid)
      } else {
        // Verify cache: if cache says all done but we suspect there might be tasks, verify
        const cached = result[gid]
        if (cached.due === 0 && cached.completed === 0 && cached.allTasksDone) {
          gardensToVerify.push(gid)
        }
      }
    }
    
    // Compute from real data for gardens without cache or suspicious cache
    if (gardensToVerify.length > 0) {
      const verifiedProg = await getGardensTodayProgressBatch(gardensToVerify, dayIso)
      for (const gid of gardensToVerify) {
        const prog = verifiedProg[gid] || { due: 0, completed: 0 }
        const hasRemaining = prog.due > prog.completed
        result[gid] = {
          due: prog.due,
          completed: prog.completed,
          hasRemainingTasks: hasRemaining,
          allTasksDone: !hasRemaining && prog.due > 0,
        }
        // Trigger background cache refresh for missing/wrong cache
          if (!taskCachesDisabled) {
            const normalizedGid = normalizeGardenId(gid)
            if (normalizedGid) {
              setTimeout(() => {
                refreshGardenTaskCache(normalizedGid, dayIso).catch(() => {})
              }, 0)
            }
          }
      }
    }
    
    return result
  } catch {
    // On error, compute from real data as fallback
    try {
      const verifiedProg = await getGardensTodayProgressBatch(gardenIds, dayIso)
      return buildGardenProgressResult(gardenIds, verifiedProg)
    } catch {
      const fallback: Record<string, { due: number; completed: number; hasRemainingTasks?: boolean; allTasksDone?: boolean }> = {}
      for (const gid of gardenIds) {
        fallback[gid] = { due: 0, completed: 0, hasRemainingTasks: false, allTasksDone: true }
      }
      return fallback
    }
  }
}

/**
 * Get cached today's occurrences for a garden
 */
export async function getGardenTodayOccurrencesCached(gardenId: string, dayIso: string): Promise<Array<{
  id: string
  taskId: string
  gardenPlantId: string
  dueAt: string
  requiredCount: number
  completedCount: number
  completedAt: string | null
  taskType: 'water' | 'fertilize' | 'harvest' | 'cut' | 'custom'
  taskEmoji: string | null
}>> {
  try {
    const { data, error } = await supabase
      .from('garden_task_occurrences_today_cache')
      .select('occurrence_id, task_id, garden_plant_id, task_type, task_emoji, due_at, required_count, completed_count, completed_at')
      .eq('garden_id', gardenId)
      .eq('cache_date', dayIso)
      .order('due_at', { ascending: true })
    
    if (!error && data && Array.isArray(data)) {
      return data.map((r: any) => ({
        id: String(r.occurrence_id),
        taskId: String(r.task_id),
        gardenPlantId: String(r.garden_plant_id),
        dueAt: String(r.due_at),
        requiredCount: Number(r.required_count ?? 1),
        completedCount: Number(r.completed_count ?? 0),
        completedAt: r.completed_at || null,
        taskType: (r.task_type || 'custom') as 'water' | 'fertilize' | 'harvest' | 'cut' | 'custom',
        taskEmoji: r.task_emoji || null,
      }))
    }
  } catch {
    // Fallback to regular query
  }
  
  // Fallback: use regular query
  const tasks = await listGardenTasksMinimal(gardenId)
  if (tasks.length === 0) return []
  const startIso = `${dayIso}T00:00:00.000Z`
  const endIso = `${dayIso}T23:59:59.999Z`
  const occs = await listOccurrencesForTasks(tasks.map(t => t.id), startIso, endIso)
  const taskTypeById: Record<string, 'water' | 'fertilize' | 'harvest' | 'cut' | 'custom'> = {}
  const taskEmojiById: Record<string, string | null> = {}
  for (const t of tasks) {
    taskTypeById[t.id] = t.type
    taskEmojiById[t.id] = t.emoji || null
  }
  return occs.map(o => ({
    ...o,
    completedAt: o.completedAt ?? null,
    taskType: taskTypeById[o.taskId] || 'custom',
    taskEmoji: taskEmojiById[o.taskId] || null,
  }))
}

/**
 * Get cached weekly task statistics for a garden
 */
export async function getGardenWeeklyStatsCached(gardenId: string, weekStartDate: string): Promise<{
  totalTasksByDay: number[]
  waterTasksByDay: number[]
  fertilizeTasksByDay: number[]
  harvestTasksByDay: number[]
  cutTasksByDay: number[]
  customTasksByDay: number[]
} | null> {
  try {
    const { data, error } = await supabase
      .from('garden_task_weekly_cache')
      .select('total_tasks_by_day, water_tasks_by_day, fertilize_tasks_by_day, harvest_tasks_by_day, cut_tasks_by_day, custom_tasks_by_day')
      .eq('garden_id', gardenId)
      .eq('week_start_date', weekStartDate)
      .maybeSingle()
    
    if (!error && data) {
      return {
        totalTasksByDay: (data.total_tasks_by_day || [0,0,0,0,0,0,0]).map(Number),
        waterTasksByDay: (data.water_tasks_by_day || [0,0,0,0,0,0,0]).map(Number),
        fertilizeTasksByDay: (data.fertilize_tasks_by_day || [0,0,0,0,0,0,0]).map(Number),
        harvestTasksByDay: (data.harvest_tasks_by_day || [0,0,0,0,0,0,0]).map(Number),
        cutTasksByDay: (data.cut_tasks_by_day || [0,0,0,0,0,0,0]).map(Number),
        customTasksByDay: (data.custom_tasks_by_day || [0,0,0,0,0,0,0]).map(Number),
      }
    }
  } catch {
    // Fallback to computation
  }
  
  return null
}

/**
 * Get cached task counts per plant
 */
export async function getGardenPlantTaskCountsCached(gardenId: string): Promise<Record<string, { taskCount: number; dueTodayCount: number }>> {
  try {
    const { data, error } = await supabase
      .from('garden_plant_task_counts_cache')
      .select('garden_plant_id, task_count, due_today_count')
      .eq('garden_id', gardenId)
    
    if (!error && data && Array.isArray(data)) {
      const result: Record<string, { taskCount: number; dueTodayCount: number }> = {}
      for (const row of data) {
        result[String(row.garden_plant_id)] = {
          taskCount: Number(row.task_count ?? 0),
          dueTodayCount: Number(row.due_today_count ?? 0),
        }
      }
      return result
    }
  } catch {
    // Fallback to computation
  }
  
  return {}
}

/**
 * Refresh cache for a garden (call after mutations)
 */
export async function refreshGardenTaskCache(gardenId: string, cacheDate?: string): Promise<void> {
  const date = cacheDate || new Date().toISOString().slice(0, 10)
  const rpcName = 'refresh_garden_task_cache'
  if (taskCachesDisabled) return
  if (missingSupabaseRpcs.has(rpcName)) return
  try {
    const { error } = await supabase.rpc(rpcName, {
      _garden_id: gardenId,
      _cache_date: date,
    })
    if (error) {
      if (isMissingRpcFunction(error, rpcName) || isRpcDependencyUnavailable(error, rpcName)) return
      disableTaskCachesOnce(`${rpcName} error`, error)
      throw error
    }
  } catch (e) {
    if (isMissingRpcFunction(e, rpcName) || isRpcDependencyUnavailable(e, rpcName)) return
    disableTaskCachesOnce(`${rpcName} exception`, e)
    // Silently fail - cache refresh is best effort (but log once)
    console.warn('[gardens] Failed to refresh cache:', e)
  }
}

/**
 * Cleanup old cache entries (call periodically)
 */
export async function cleanupOldGardenTaskCache(): Promise<void> {
  const rpcName = 'cleanup_old_garden_task_cache'
  if (missingSupabaseRpcs.has(rpcName)) return
  try {
    const { error } = await supabase.rpc(rpcName)
    if (error) {
      if (isMissingRpcFunction(error, rpcName) || isRpcDependencyUnavailable(error, rpcName)) return
      throw error
    }
  } catch (e) {
    if (isMissingRpcFunction(e, rpcName) || isRpcDependencyUnavailable(e, rpcName)) return
    console.warn('[gardens] Failed to cleanup old cache:', e)
  }
}

/**
 * Quick check if a garden has remaining tasks (uses cache)
 */
export async function gardenHasRemainingTasks(gardenId: string, dayIso?: string): Promise<boolean> {
  const date = dayIso || new Date().toISOString().slice(0, 10)
  const normalizedGardenId = normalizeGardenId(gardenId)
  if (!normalizedGardenId) return false
  const rpcName = 'garden_has_remaining_tasks'
  if (!missingSupabaseRpcs.has(rpcName)) {
    try {
      const { data, error } = await supabase.rpc(rpcName, {
        _garden_id: normalizedGardenId,
        _cache_date: date,
      })
      if (!error && typeof data === 'boolean') {
        return data
      }
      if (error && !(isMissingRpcFunction(error, rpcName) || isRpcDependencyUnavailable(error, rpcName))) {
        console.warn('[gardens] garden_has_remaining_tasks RPC failed, falling back to computation:', error)
      }
    } catch (err) {
      if (!(isMissingRpcFunction(err, rpcName) || isRpcDependencyUnavailable(err, rpcName))) {
        console.warn('[gardens] garden_has_remaining_tasks RPC failed, falling back to computation:', err)
      }
    }
  }

  // Fallback: compute if cache missing
    const prog = await getGardenTodayProgressCached(normalizedGardenId, date)
  return prog.due > prog.completed
}

/**
 * Quick check if all garden tasks are done (uses cache)
 */
export async function gardenAllTasksDone(gardenId: string, dayIso?: string): Promise<boolean> {
  const date = dayIso || new Date().toISOString().slice(0, 10)
  const normalizedGardenId = normalizeGardenId(gardenId)
  if (!normalizedGardenId) return false
  const rpcName = 'garden_all_tasks_done'
  if (!missingSupabaseRpcs.has(rpcName)) {
    try {
      const { data, error } = await supabase.rpc(rpcName, {
        _garden_id: normalizedGardenId,
        _cache_date: date,
      })
      if (!error && typeof data === 'boolean') {
        return data
      }
      if (error && !(isMissingRpcFunction(error, rpcName) || isRpcDependencyUnavailable(error, rpcName))) {
        console.warn('[gardens] garden_all_tasks_done RPC failed, falling back to computation:', error)
      }
    } catch (err) {
      if (!(isMissingRpcFunction(err, rpcName) || isRpcDependencyUnavailable(err, rpcName))) {
        console.warn('[gardens] garden_all_tasks_done RPC failed, falling back to computation:', err)
      }
    }
  }

  // Fallback: compute if cache missing
    const prog = await getGardenTodayProgressCached(normalizedGardenId, date)
  return prog.due === 0 || prog.completed >= prog.due
}

/**
 * Batch check remaining tasks for multiple gardens (uses cache)
 */
export async function gardensHaveRemainingTasks(gardenIds: string[], dayIso?: string): Promise<Record<string, boolean>> {
  if (gardenIds.length === 0) return {}
  const date = dayIso || new Date().toISOString().slice(0, 10)
  const { valid: safeGardenIds } = normalizeGardenIdList(gardenIds)
  if (safeGardenIds.length === 0) {
    const empty: Record<string, boolean> = {}
    for (const gid of gardenIds) {
      empty[String(gid)] = false
    }
    return empty
  }
  const result: Record<string, boolean> = {}
  const rpcName = 'gardens_have_remaining_tasks'
  if (!missingSupabaseRpcs.has(rpcName)) {
    try {
      const { data, error } = await supabase.rpc(rpcName, {
        _garden_ids: safeGardenIds,
        _cache_date: date,
      })
      if (!error && data && Array.isArray(data)) {
        for (const row of data) {
          result[String(row.garden_id)] = Boolean(row.has_remaining_tasks)
        }
        // Fill in missing gardens
        for (const gid of safeGardenIds) {
          if (result[gid] === undefined) {
            // Fallback to individual check
            result[gid] = await gardenHasRemainingTasks(gid, date)
          }
        }
        for (const gid of gardenIds) {
          const key = String(gid)
          if (result[key] === undefined) {
            result[key] = false
          }
        }
        return result
      }
      if (error && !(isMissingRpcFunction(error, rpcName) || isRpcDependencyUnavailable(error, rpcName))) {
        console.warn('[gardens] gardens_have_remaining_tasks RPC failed, falling back to individual checks:', error)
      }
    } catch (err) {
      if (!(isMissingRpcFunction(err, rpcName) || isRpcDependencyUnavailable(err, rpcName))) {
        console.warn('[gardens] gardens_have_remaining_tasks RPC failed, falling back to individual checks:', err)
      }
    }
  }

  // Fallback: check each garden individually
  await Promise.all(
    safeGardenIds.map(async (gid) => {
      result[gid] = await gardenHasRemainingTasks(gid, date)
    })
  )
  for (const gid of gardenIds) {
    const key = String(gid)
    if (result[key] === undefined) {
      result[key] = false
    }
  }
  return result
}

// ===== User-level Task Cache Functions =====

/**
 * Get user's total task counts across all gardens (DIRECT cache read - FASTEST)
 * Directly queries cache tables without RPC overhead
 * WITH FALLBACK: Verifies cache correctness and computes from real data if cache is wrong
 */
export async function getUserTasksTodayCached(userId: string, dayIso?: string): Promise<{
  totalDueCount: number
  totalCompletedCount: number
  gardensWithRemainingTasks: number
  totalGardens: number
}> {
  const date = dayIso || new Date().toISOString().slice(0, 10)
  if (taskCachesDisabled) {
    return computeUserTaskTotalsFromLiveData(userId, date)
  }
  const gardenDailyTable = 'garden_task_daily_cache'
  
  try {
    // Direct query to user cache table - FASTEST approach
    const userTable = 'user_task_daily_cache'
    let userCache: any | null = null
    let userCacheErr: any = null
    if (!missingSupabaseTablesOrViews.has(userTable)) {
      try {
        const response = await supabase
          .from(userTable)
          .select('total_due_count, total_completed_count, gardens_with_remaining_tasks, total_gardens')
          .eq('user_id', userId)
          .eq('cache_date', date)
          .maybeSingle()
        userCache = response.data
        userCacheErr = response.error
        if (userCacheErr && isMissingTableOrView(userCacheErr, userTable)) {
          userCache = null
        }
      } catch (err) {
        if (!isMissingTableOrView(err, userTable)) {
          console.warn('[gardens] getUserTasksTodayCached user cache query failed, falling back:', err)
        }
      }
    }
    
    if (!userCacheErr && userCache) {
      const totalDue = Number(userCache.total_due_count ?? 0)
      const totalCompleted = Number(userCache.total_completed_count ?? 0)
      
      // Verify cache: if cache says no tasks, verify by checking garden cache
      if (totalDue === 0 && totalCompleted === 0) {
        // Cache says no tasks - verify this is correct by checking garden cache
        const { data: memberships } = await supabase
          .from('garden_members')
          .select('garden_id')
          .eq('user_id', userId)
        
        if (memberships && memberships.length > 0) {
          const gardenIds = memberships.map((m: any) => m.garden_id)
          let gardenCache: any[] | null = null
          if (!missingSupabaseTablesOrViews.has(gardenDailyTable)) {
            try {
              const response = await supabase
                .from(gardenDailyTable)
                .select('due_count, completed_count, has_remaining_tasks')
                .in('garden_id', gardenIds)
                .eq('cache_date', date)
              if (response.error) {
                if (isMissingTableOrView(response.error, gardenDailyTable)) {
                  gardenCache = null
                }
              } else {
                gardenCache = response.data
              }
            } catch (err) {
              if (!isMissingTableOrView(err, gardenDailyTable)) {
                console.warn('[gardens] getUserTasksTodayCached garden cache query failed, falling back:', err)
              }
            }
          }
          
          // If garden cache shows tasks but user cache says zero, compute from garden cache
          if (gardenCache && gardenCache.length > 0) {
            let verifiedDue = 0
            let verifiedCompleted = 0
            let gardensWithRemaining = 0
            
            for (const row of gardenCache) {
              verifiedDue += Number(row.due_count ?? 0)
              verifiedCompleted += Number(row.completed_count ?? 0)
              if (row.has_remaining_tasks) {
                gardensWithRemaining++
              }
            }
            
            // If garden cache shows different values, use garden cache (more accurate)
            if (verifiedDue > 0 || verifiedCompleted > 0) {
              // Trigger background refresh of user cache
              if (!taskCachesDisabled) {
                setTimeout(() => {
                  refreshUserTaskCache(userId, date).catch(() => {})
                }, 0)
              }
              
              return {
                totalDueCount: verifiedDue,
                totalCompletedCount: verifiedCompleted,
                gardensWithRemainingTasks: gardensWithRemaining,
                totalGardens: gardenIds.length,
              }
            }
          }
        }
      }
      
      return {
        totalDueCount: totalDue,
        totalCompletedCount: totalCompleted,
        gardensWithRemainingTasks: Number(userCache.gardens_with_remaining_tasks ?? 0),
        totalGardens: Number(userCache.total_gardens ?? 0),
      }
    }
    
    // If user cache doesn't exist, try aggregating from garden cache (still fast)
    const { data: memberships } = await supabase
      .from('garden_members')
      .select('garden_id')
      .eq('user_id', userId)
    
    if (!memberships || memberships.length === 0) {
      return { totalDueCount: 0, totalCompletedCount: 0, gardensWithRemainingTasks: 0, totalGardens: 0 }
    }
    
      const gardenIds = memberships.map((m: any) => m.garden_id)
      
      // Direct query to garden cache - aggregate in one query
      let gardenCache: any[] | null = null
      let gardenCacheErr: any = null
      if (!missingSupabaseTablesOrViews.has(gardenDailyTable)) {
        try {
          const response = await supabase
            .from(gardenDailyTable)
            .select('due_count, completed_count, has_remaining_tasks')
            .in('garden_id', gardenIds)
            .eq('cache_date', date)
          gardenCache = response.data
          gardenCacheErr = response.error
          if (gardenCacheErr && isMissingTableOrView(gardenCacheErr, gardenDailyTable)) {
            gardenCache = null
          }
        } catch (err) {
          if (!isMissingTableOrView(err, gardenDailyTable)) {
            console.warn('[gardens] getUserTasksTodayCached garden cache aggregation failed, falling back:', err)
          }
        }
      }
    
    if (!gardenCacheErr && gardenCache && gardenCache.length > 0) {
      let totalDue = 0
      let totalCompleted = 0
      let gardensWithRemaining = 0

      for (const row of gardenCache) {
        totalDue += Number(row.due_count ?? 0)
        totalCompleted += Number(row.completed_count ?? 0)
        if (row.has_remaining_tasks) {
          gardensWithRemaining++
        }
      }

      // Trigger background refresh of user cache (non-blocking)
      if (!taskCachesDisabled) {
        setTimeout(() => {
          refreshUserTaskCache(userId, date).catch(() => {})
        }, 0)
      }
      
      return {
        totalDueCount: totalDue,
        totalCompletedCount: totalCompleted,
        gardensWithRemainingTasks: gardensWithRemaining,
        totalGardens: gardenIds.length,
      }
    }
    
    // If no cache exists, COMPUTE FROM REAL DATA (fail-safe)
    // This ensures we never show wrong information
    const liveTotals = await computeUserTaskTotalsFromLiveData(userId, date)

    // Trigger background cache refresh (non-blocking)
    if (!taskCachesDisabled) {
      setTimeout(() => {
        refreshUserTaskCache(userId, date).catch(() => {})
        gardenIds.forEach(gid => {
          refreshGardenTaskCache(gid, date).catch(() => {})
        })
      }, 0)
    }

    return liveTotals
  } catch {
    // On error, try to compute from real data as fallback
    return computeUserTaskTotalsFromLiveData(userId, date)
  }
}

/**
 * Get per-garden task counts for a user (DIRECT cache read - FASTEST)
 * Directly queries cache tables without RPC overhead
 * WITH FALLBACK: Verifies cache correctness and computes from real data if cache is wrong
 */
export async function getUserGardensTasksTodayCached(userId: string, dayIso?: string): Promise<Record<string, {
  gardenName: string
  due: number
  completed: number
  hasRemainingTasks: boolean
  allTasksDone: boolean
}>> {
  const date = dayIso || new Date().toISOString().slice(0, 10)
  if (taskCachesDisabled) {
    return computeUserGardenBreakdownFromLiveData(userId, date)
  }

  try {
    // OPTIMIZED: Get gardens and cache in parallel - FASTEST approach
    const [membershipsResult, cacheResult] = await Promise.all([
      supabase
        .from('garden_members')
        .select('garden_id, gardens!inner(id, name)')
        .eq('user_id', userId),
      supabase
        .from('garden_task_daily_cache')
        .select('garden_id, due_count, completed_count, has_remaining_tasks, all_tasks_done')
        .eq('cache_date', date)
    ])
    
    const { data: memberships, error: memErr } = membershipsResult
    const { data: cacheData, error: cacheErr } = cacheResult
    
    // If cache table doesn't exist, cacheErr will indicate that - handle gracefully
    if (memErr || !memberships || memberships.length === 0) {
      return {}
    }
    
    const gardenIds = memberships.map((m: any) => m.garden_id)
    const gardenNameMap: Record<string, string> = {}
    memberships.forEach((m: any) => {
      const g = m.gardens
      if (g) gardenNameMap[g.id] = g.name
    })
    
    // Filter cache data to only gardens user is member of (if cache exists)
    const filteredCache = (cacheData || []).filter((row: any) => 
      gardenIds.includes(String(row.garden_id))
    )
    
    const result: Record<string, {
      gardenName: string
      due: number
      completed: number
      hasRemainingTasks: boolean
      allTasksDone: boolean
    }> = {}
    
    // Build result from cache (if available and no error)
    if (!cacheErr && filteredCache.length > 0) {
      for (const row of filteredCache) {
        const gid = String(row.garden_id)
        const due = Number(row.due_count ?? 0)
        const completed = Number(row.completed_count ?? 0)
        result[gid] = {
          gardenName: gardenNameMap[gid] || '',
          due,
          completed,
          hasRemainingTasks: Boolean(row.has_remaining_tasks ?? false),
          allTasksDone: Boolean(row.all_tasks_done ?? true),
        }
      }
    }
    
    // Fill in gardens without cache - VERIFY by computing from real data
    const gardensToVerify: string[] = []
    for (const gid of gardenIds) {
      if (!result[gid]) {
        gardensToVerify.push(gid)
      } else {
        // Verify cache correctness: if cache says all done but we suspect there might be tasks, verify
        const cached = result[gid]
        if (cached.due === 0 && cached.completed === 0 && cached.allTasksDone) {
          // Cache says no tasks - verify this is correct
          gardensToVerify.push(gid)
        }
      }
    }
    
    // Compute from real data for gardens without cache or suspicious cache
    if (gardensToVerify.length > 0) {
      const verifiedProg = await getGardensTodayProgressBatch(gardensToVerify, date)
      for (const gid of gardensToVerify) {
        const prog = verifiedProg[gid] || { due: 0, completed: 0 }
        const hasRemaining = prog.due > prog.completed
        result[gid] = {
          gardenName: gardenNameMap[gid] || '',
          due: prog.due,
          completed: prog.completed,
          hasRemainingTasks: hasRemaining,
          allTasksDone: !hasRemaining && prog.due > 0,
        }
        // Trigger background cache refresh for missing/wrong cache
        if (!taskCachesDisabled) {
          setTimeout(() => {
            refreshGardenTaskCache(gid, date).catch(() => {})
          }, 0)
        }
      }
    }
    
    return result
  } catch {
    // On error, try to compute from real data as fallback
    return computeUserGardenBreakdownFromLiveData(userId, date)
  }
}

/**
 * Refresh user-level cache (call after mutations)
 */
export async function refreshUserTaskCache(userId: string, cacheDate?: string): Promise<void> {
  const date = cacheDate || new Date().toISOString().slice(0, 10)
  const rpcName = 'refresh_user_task_daily_cache'
  if (taskCachesDisabled) return
  if (missingSupabaseRpcs.has(rpcName)) return
  try {
    const { error } = await supabase.rpc(rpcName, {
      _user_id: userId,
      _cache_date: date,
    })
    if (error) {
      if (isMissingRpcFunction(error, rpcName) || isRpcDependencyUnavailable(error, rpcName)) return
      disableTaskCachesOnce(`${rpcName} error`, error)
      throw error
    }
  } catch (e) {
    if (isMissingRpcFunction(e, rpcName) || isRpcDependencyUnavailable(e, rpcName)) return
    disableTaskCachesOnce(`${rpcName} exception`, e)
    // Silently fail - cache refresh is best effort
    console.warn('[gardens] Failed to refresh user cache:', e)
  }
}

// ===== Activity logs =====
export type GardenActivityKind = 'plant_added' | 'plant_updated' | 'plant_deleted' | 'task_completed' | 'task_progressed' | 'note'
export type GardenActivity = {
  id: string
  gardenId: string
  actorId: string | null
  actorName: string | null
  actorColor: string | null
  kind: GardenActivityKind
  message: string
  plantName?: string | null
  taskName?: string | null
  occurredAt: string
}

export async function listGardenActivityToday(gardenId: string, todayIso?: string | null): Promise<GardenActivity[]> {
  const today = todayIso || new Date().toISOString().slice(0,10)
  const start = `${today}T00:00:00.000Z`
  const end = `${today}T23:59:59.999Z`
  // Attempt server-assisted fetch first to support environments without direct Supabase access
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData?.session?.access_token
    if (token) {
      const params = new URLSearchParams({ day: today })
      const resp = await fetch(`/api/garden/${encodeURIComponent(gardenId)}/activity?${params.toString()}`, {
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })
      if (resp.ok) {
        const body = await resp.json().catch(() => null)
        if (body && body.ok !== false && Array.isArray(body?.activity)) {
          return body.activity.map((r: any) => ({
            id: String(r.id),
            gardenId: String(r.gardenId ?? r.garden_id ?? gardenId),
            actorId: r.actorId ? String(r.actorId) : r.actor_id ? String(r.actor_id) : null,
            actorName: r.actorName ?? r.actor_name ?? null,
            actorColor: r.actorColor ?? r.actor_color ?? null,
            kind: r.kind,
            message: r.message,
            plantName: r.plantName ?? r.plant_name ?? null,
            taskName: r.taskName ?? r.task_name ?? null,
            occurredAt: String(r.occurredAt ?? r.occurred_at ?? ''),
          }))
        }
      }
    }
  } catch {}

  const { data, error } = await supabase
    .from('garden_activity_logs')
    .select('id, garden_id, actor_id, actor_name, actor_color, kind, message, plant_name, task_name, occurred_at')
    .eq('garden_id', gardenId)
    .gte('occurred_at', start)
    .lte('occurred_at', end)
    .order('occurred_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data || []).map((r: any) => ({
    id: String(r.id),
    gardenId: String(r.garden_id),
    actorId: r.actor_id ? String(r.actor_id) : null,
    actorName: r.actor_name || null,
    actorColor: r.actor_color || null,
    kind: r.kind,
    message: r.message,
    plantName: r.plant_name || null,
    taskName: r.task_name || null,
    occurredAt: String(r.occurred_at),
  }))
}

export async function logGardenActivity(params: { gardenId: string; kind: GardenActivityKind; message: string; plantName?: string | null; taskName?: string | null; actorColor?: string | null }): Promise<void> {
  const { gardenId, kind, message, plantName = null, taskName = null, actorColor = null } = params
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData?.session?.access_token
    if (token) {
      const resp = await fetch(`/api/garden/${encodeURIComponent(gardenId)}/activity`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ kind, message, plantName, taskName, actorColor }),
      })
      if (resp.ok) {
        const body = await resp.json().catch(() => null)
        if (!body || body.ok !== false) return
      }
    }
  } catch {}
  const { error } = await supabase.rpc('log_garden_activity', {
    _garden_id: gardenId,
    _kind: kind,
    _message: message,
    _plant_name: plantName,
    _task_name: taskName,
    _actor_color: actorColor,
  })
  if (error) throw new Error(error.message)
}

/**
 * Extended garden type with plant preview data for profile display
 */
export interface PublicGardenWithPreview extends Garden {
  plantCount: number
  previewPlants: Array<{
    id: string
    name: string
    nickname: string | null
    imageUrl: string | null
  }>
  ownerDisplayName: string | null
}

/**
 * Get all public gardens for a user, with plant preview data
 * Used for displaying gardens on the public profile page
 */
export async function getUserPublicGardens(userId: string): Promise<PublicGardenWithPreview[]> {
  // Fetch garden ids where user is a member (owner or member)
  const { data: memberRows, error: memberErr } = await supabase
    .from('garden_members')
    .select('garden_id, role')
    .eq('user_id', userId)
  
  if (memberErr) throw new Error(memberErr.message)
  const gardenIds = (memberRows || []).map((r: { garden_id: string }) => r.garden_id)
  if (gardenIds.length === 0) return []
  
  // Fetch gardens with privacy = 'public' only
  let gardens: any[] = []
  let gerr: any = null
  
  const result = await supabase
    .from('gardens')
    .select('id, name, cover_image_url, created_by, created_at, streak, privacy')
    .in('id', gardenIds)
    .eq('privacy', 'public')
  
  gardens = result.data || []
  gerr = result.error
  
  // If error mentions privacy column, try filtering client-side
  if (gerr && String(gerr.message || '').toLowerCase().includes('privacy')) {
    const fallbackResult = await supabase
      .from('gardens')
      .select('id, name, cover_image_url, created_by, created_at, streak')
      .in('id', gardenIds)
    gardens = (fallbackResult.data || []).filter((g: any) => !g.is_private)
    gerr = fallbackResult.error
  }
  
  if (gerr) throw new Error(gerr.message)
  if (gardens.length === 0) return []
  
  const publicGardenIds = gardens.map((g: any) => String(g.id))
  
  // Fetch plant counts and preview plants for each garden
  const { data: gardenPlants, error: gpErr } = await supabase
    .from('garden_plants')
    .select('id, garden_id, plant_id, nickname, sort_index')
    .in('garden_id', publicGardenIds)
    .order('sort_index', { ascending: true })
  
  if (gpErr) console.error('Error fetching garden plants:', gpErr)
  
  // Group plants by garden
  const plantsByGarden: Record<string, any[]> = {}
  for (const gp of gardenPlants || []) {
    const gid = String(gp.garden_id)
    if (!plantsByGarden[gid]) plantsByGarden[gid] = []
    plantsByGarden[gid].push(gp)
  }
  
  // Collect unique plant IDs for image fetching
  // Validate that plant IDs are valid UUIDs or numeric IDs to avoid malformed queries
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const numericIdRegex = /^\d+$/
  const isValidPlantId = (id: string): boolean => uuidRegex.test(id) || numericIdRegex.test(id)
  
  const allPlantIds = new Set<string>()
  for (const plants of Object.values(plantsByGarden)) {
    for (const p of plants) {
      if (p.plant_id) {
        const plantId = String(p.plant_id).trim()
        if (plantId && isValidPlantId(plantId)) {
          allPlantIds.add(plantId)
        }
      }
    }
  }
  
  // Fetch plant details with images
  const plantsMap: Record<string, { name: string; imageUrl: string | null }> = {}
  if (allPlantIds.size > 0) {
    const { data: plantRows, error: pErr } = await supabase
      .from('plants')
      .select('id, common_name, plant_images(link, use)')
      .in('id', Array.from(allPlantIds))
    
    if (!pErr && plantRows) {
      for (const p of plantRows) {
        const images = Array.isArray((p as any).plant_images) ? (p as any).plant_images : []
        const photos = images.map((img: any) => ({
          url: img.link || '',
          isPrimary: img.use === 'primary',
          isVertical: false
        }))
        const primaryUrl = getPrimaryPhotoUrl(photos) || (photos[0]?.url || null)
        plantsMap[String(p.id)] = {
          name: (p as any).common_name || '',
          imageUrl: primaryUrl
        }
      }
    }
  }
  
  // Fetch owner display names
  const ownerIds = [...new Set(gardens.map((g: any) => String(g.created_by)))]
  const ownerNamesMap: Record<string, string | null> = {}
  if (ownerIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name')
      .in('id', ownerIds)
    
    if (profiles) {
      for (const p of profiles) {
        ownerNamesMap[String(p.id)] = p.display_name || null
      }
    }
  }
  
  // Build result with preview data
  return gardens.map((g: any) => {
    const gid = String(g.id)
    const gardenPlantsList = plantsByGarden[gid] || []
    
    // Get up to 4 preview plants with images
    const previewPlants = gardenPlantsList.slice(0, 4).map((gp: any) => {
      const plantId = String(gp.plant_id)
      const plantData = plantsMap[plantId] || { name: '', imageUrl: null }
      return {
        id: String(gp.id),
        name: plantData.name,
        nickname: gp.nickname || null,
        imageUrl: plantData.imageUrl
      }
    })
    
    return {
      id: gid,
      name: String(g.name),
      coverImageUrl: g.cover_image_url || null,
      createdBy: String(g.created_by),
      createdAt: String(g.created_at),
      streak: Number(g.streak ?? 0),
      privacy: 'public' as GardenPrivacy,
      plantCount: gardenPlantsList.length,
      previewPlants,
      ownerDisplayName: ownerNamesMap[String(g.created_by)] || null
    }
  })
}


// ----- Garden Analytics Types and Functions -----

export interface DailyStat {
  date: string
  due: number
  completed: number
  success: boolean
  water: number
  fertilize: number
  harvest: number
  cut: number
  custom: number
}

export interface WeeklyStats {
  tasksCompleted: number
  tasksDue: number
  completionRate: number
  trend: 'up' | 'down' | 'stable'
  trendValue: number
  tasksByType: {
    water: number
    fertilize: number
    harvest: number
    cut: number
    custom: number
  }
}

export interface MemberContribution {
  userId: string
  displayName: string
  tasksCompleted: number
  percentage: number
  color: string
}

export interface PlantStats {
  total: number
  species: number
  needingAttention: number
  healthy: number
}

export interface GardenAnalytics {
  dailyStats: DailyStat[]
  weeklyStats: WeeklyStats
  memberContributions: MemberContribution[]
  plantStats: PlantStats
}

export interface PlantTip {
  plantName: string
  tip: string
  priority: 'high' | 'medium' | 'low'
}

export interface GardenAdvice {
  id: string
  weekStart: string
  adviceText: string
  adviceSummary: string
  focusAreas: string[]
  plantSpecificTips: PlantTip[]
  improvementScore: number | null
  generatedAt: string
}

export interface AdviceResponse {
  ok: boolean
  advice: GardenAdvice | null
  message?: string
}

export interface AnalyticsResponse {
  ok: boolean
  analytics: GardenAnalytics
  error?: string
}

/**
 * Fetch garden analytics data from the server
 */
export async function fetchGardenAnalytics(gardenId: string): Promise<AnalyticsResponse> {
  const { data: session } = await supabase.auth.getSession()
  const token = session?.session?.access_token
  
  const response = await fetch(`/api/garden/${gardenId}/analytics`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    credentials: 'include',
  })
  
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Failed to fetch analytics' }))
    throw new Error(err.error || 'Failed to fetch analytics')
  }
  
  return response.json()
}

/**
 * Fetch or generate garden AI advice
 */
export async function fetchGardenAdvice(gardenId: string, forceRefresh = false): Promise<AdviceResponse> {
  const { data: session } = await supabase.auth.getSession()
  const token = session?.session?.access_token
  
  const url = `/api/garden/${gardenId}/advice${forceRefresh ? '?refresh=true' : ''}`
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    credentials: 'include',
  })
  
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Failed to fetch advice' }))
    throw new Error(err.error || 'Failed to fetch advice')
  }
  
  return response.json()
}

