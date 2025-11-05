import { supabase } from '@/lib/supabaseClient'
import type { Garden, GardenMember, GardenPlant } from '@/types/garden'
import type { GardenTaskRow } from '@/types/garden'
import type { GardenPlantTask, GardenPlantTaskOccurrence, TaskType, TaskScheduleKind, TaskUnit } from '@/types/garden'
import type { Plant } from '@/types/plant'
import type { SupportedLanguage } from './i18n'
import { mergePlantWithTranslation } from './plantTranslationLoader'

export async function getUserGardens(userId: string): Promise<Garden[]> {
  // Fetch garden ids where user is a member, then fetch gardens
  const { data: memberRows, error: memberErr } = await supabase
    .from('garden_members')
    .select('garden_id')
    .eq('user_id', userId)
  if (memberErr) throw new Error(memberErr.message)
  const gardenIds = (memberRows || []).map((r: { garden_id: string }) => r.garden_id)
  if (gardenIds.length === 0) return []
  const { data: gardens, error: gerr } = await supabase
    .from('gardens')
    .select('id, name, cover_image_url, created_by, created_at, streak')
    .in('id', gardenIds)
  if (gerr) throw new Error(gerr.message)
  return (gardens || []).map((g: { id: string; name: string; cover_image_url: string | null; created_by: string; created_at: string }) => ({
    id: String(g.id),
    name: String(g.name),
    coverImageUrl: g.cover_image_url || null,
    createdBy: String(g.created_by),
    createdAt: String(g.created_at),
    streak: Number((g as any).streak ?? 0),
  }))
}

export async function createGarden(params: { name: string; coverImageUrl?: string | null; ownerUserId: string }): Promise<Garden> {
  const { name, coverImageUrl = null, ownerUserId } = params
  const { data, error } = await supabase
    .from('gardens')
    .insert({ name, cover_image_url: coverImageUrl, created_by: ownerUserId })
    .select('id, name, cover_image_url, created_by, created_at')
    .single()
  if (error) throw new Error(error.message)
  const garden: Garden = {
    id: String(data.id),
    name: String(data.name),
    coverImageUrl: data.cover_image_url || null,
    createdBy: String(data.created_by),
    createdAt: String(data.created_at),
  }
  // Add owner as member
  const { error: merr } = await supabase
    .from('garden_members')
    .insert({ garden_id: garden.id, user_id: ownerUserId, role: 'owner' })
  if (merr) throw new Error(merr.message)
  return garden
}

export async function getGarden(gardenId: string): Promise<Garden | null> {
  const { data, error } = await supabase
    .from('gardens')
    .select('id, name, cover_image_url, created_by, created_at, streak')
    .eq('id', gardenId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return {
    id: String(data.id),
    name: String(data.name),
    coverImageUrl: data.cover_image_url || null,
    createdBy: String(data.created_by),
    createdAt: String(data.created_at),
    streak: Number((data as any).streak ?? 0),
  }
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
    .select('id, garden_id, plant_id, nickname, seeds_planted, planted_at, expected_bloom_date, override_water_freq_unit, override_water_freq_value, plants_on_hand')
    .eq('garden_id', gardenId)
    .order('sort_index', { ascending: true, nullsFirst: false })
  if (error) throw new Error(error.message)
  const rows = (data || []) as any[]
  if (rows.length === 0) return []
  const plantIds = Array.from(new Set(rows.map(r => r.plant_id)))
  const { data: plantRows } = await supabase
    .from('plants')
    .select('id, name, scientific_name, colors, seasons, rarity, meaning, description, image_url, care_sunlight, care_water, care_soil, care_difficulty, seeds_available, water_freq_unit, water_freq_value, water_freq_period, water_freq_amount')
    .in('id', plantIds)
  
  // Always load translations for the specified language (including English)
  // This ensures plants created in one language display correctly in another
  // OPTIMIZED: Only select needed translation fields to reduce egress
  let translationMap = new Map()
  if (language) {
    const { data: translations } = await supabase
      .from('plant_translations')
      .select('plant_id, language, name, scientific_name, meaning, description, care_soil')
      .eq('language', language)
      .in('plant_id', plantIds)
    if (translations) {
      translations.forEach(t => {
        translationMap.set(t.plant_id, t)
      })
    }
  }
  
  const idToPlant: Record<string, Plant> = {}
  for (const p of plantRows || []) {
    const translation = translationMap.get(p.id) || null
    const mergedPlant = mergePlantWithTranslation(p, translation)
    idToPlant[String(p.id)] = mergedPlant
  }
  return rows.map(r => ({
    id: String(r.id),
    gardenId: String(r.garden_id),
    plantId: String(r.plant_id),
    nickname: r.nickname,
    seedsPlanted: Number(r.seeds_planted ?? 0),
    plantedAt: r.planted_at,
    expectedBloomDate: r.expected_bloom_date,
    overrideWaterFreqUnit: r.override_water_freq_unit || null,
    overrideWaterFreqValue: r.override_water_freq_value ?? null,
    plantsOnHand: Number(r.plants_on_hand ?? 0),
    plant: idToPlant[String(r.plant_id)] || null,
    sortIndex: (r as any).sort_index ?? null,
  }))
}

export async function addPlantToGarden(params: { gardenId: string; plantId: string; nickname?: string | null; seedsPlanted?: number; plantedAt?: string | null; expectedBloomDate?: string | null }): Promise<GardenPlant> {
  const { gardenId, plantId, nickname = null, seedsPlanted = 0, plantedAt = null, expectedBloomDate = null } = params
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
    .insert({ garden_id: gardenId, plant_id: plantId, nickname, seeds_planted: seedsPlanted, planted_at: plantedAt, expected_bloom_date: expectedBloomDate, plants_on_hand: 0, sort_index: nextIndex })
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
  for (const r of (profilesData as any[]) || []) {
    const uid = String((r as any).user_id)
    idToName[uid] = (r as any).display_name || null
    idToEmail[uid] = (r as any).email || null
    idToAccent[uid] = (r as any).accent_key || null
  }
  return rows.map((r: any) => ({
    gardenId: String(r.garden_id),
    userId: String(r.user_id),
    role: r.role,
    joinedAt: String(r.joined_at),
    displayName: idToName[String(r.user_id)] ?? null,
    email: idToEmail[String(r.user_id)] ?? null,
    accentKey: idToAccent[String(r.user_id)] ?? null,
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
  const { error } = await supabase
    .from('garden_members')
    .update({ role })
    .eq('garden_id', gardenId)
    .eq('user_id', userId)
  if (error) throw new Error(error.message)
}

export async function removeGardenMember(params: { gardenId: string; userId: string }): Promise<void> {
  const { gardenId, userId } = params
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
    day: (r.day instanceof Date ? (r.day as Date).toISOString().slice(0,10) : String(r.day).slice(0,10)),
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

export async function userHasUnfinishedTasksToday(userId: string): Promise<boolean> {
  const gardens = await getUserGardens(userId)
  if (gardens.length === 0) return false
  const nowIso = await fetchServerNowISO()
  const today = nowIso.slice(0, 10)
  for (const g of gardens) {
    try {
      const prog = await getGardenTodayProgress(g.id, today)
      if (prog.due > prog.completed) return true
    } catch {}
  }
  return false
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
  // OPTIMIZED: Only select fields needed for inventory display to reduce egress
  const { data: plantRows } = await supabase
    .from('plants')
    .select('id, name, scientific_name, colors, seasons, rarity, meaning, description, image_url, care_sunlight, care_water, care_soil, care_difficulty, seeds_available')
    .in('id', plantIds)
  const idToPlant: Record<string, Plant> = {}
  for (const p of plantRows || []) {
    idToPlant[String(p.id)] = {
      id: String(p.id),
      name: String(p.name),
      scientificName: String(p.scientific_name || ''),
      colors: Array.isArray(p.colors) ? p.colors.map(String) : [],
      seasons: Array.isArray(p.seasons) ? p.seasons.map(String) as any : [],
      rarity: p.rarity,
      meaning: p.meaning || '',
      description: p.description || '',
      image: p.image_url || '',
      care: { sunlight: p.care_sunlight || 'Low', water: p.care_water || 'Low', soil: p.care_soil || '', difficulty: p.care_difficulty || 'Easy' },
      seedsAvailable: Boolean(p.seeds_available ?? false),
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

// OPTIMIZED: Reduced default window to reduce egress - only load what's needed
export async function listTaskOccurrences(taskId: string, windowDays = 30): Promise<GardenPlantTaskOccurrence[]> {
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

