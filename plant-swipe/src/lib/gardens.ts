import { supabase } from '@/lib/supabaseClient'
import type { Garden, GardenMember, GardenPlant, GardenPlantEvent, GardenWateringScheduleRow, WaterFreqUnit } from '@/types/garden'
import type { Plant } from '@/types/plant'

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
    .select('id, name, cover_image_url, created_by, created_at')
    .in('id', gardenIds)
  if (gerr) throw new Error(gerr.message)
  return (gardens || []).map((g: { id: string; name: string; cover_image_url: string | null; created_by: string; created_at: string }) => ({
    id: String(g.id),
    name: String(g.name),
    coverImageUrl: g.cover_image_url || null,
    createdBy: String(g.created_by),
    createdAt: String(g.created_at),
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
    .select('id, name, cover_image_url, created_by, created_at')
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
  }
}

export async function getGardenPlants(gardenId: string): Promise<Array<GardenPlant & { plant?: Plant | null }>> {
  const { data, error } = await supabase
    .from('garden_plants')
    .select('id, garden_id, plant_id, nickname, seeds_planted, planted_at, expected_bloom_date, override_water_freq_unit, override_water_freq_value')
    .eq('garden_id', gardenId)
  if (error) throw new Error(error.message)
  const rows = (data || []) as any[]
  if (rows.length === 0) return []
  const plantIds = Array.from(new Set(rows.map(r => r.plant_id)))
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
      care: {
        sunlight: p.care_sunlight || 'Low',
        water: p.care_water || 'Low',
        soil: p.care_soil || '',
        difficulty: p.care_difficulty || 'Easy',
      },
      seedsAvailable: Boolean(p.seeds_available ?? false),
    }
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
    plant: idToPlant[String(r.plant_id)] || null,
  }))
}

export async function addPlantToGarden(params: { gardenId: string; plantId: string; nickname?: string | null; seedsPlanted?: number; plantedAt?: string | null; expectedBloomDate?: string | null }): Promise<GardenPlant> {
  const { gardenId, plantId, nickname = null, seedsPlanted = 0, plantedAt = null, expectedBloomDate = null } = params
  const { data, error } = await supabase
    .from('garden_plants')
    .insert({ garden_id: gardenId, plant_id: plantId, nickname, seeds_planted: seedsPlanted, planted_at: plantedAt, expected_bloom_date: expectedBloomDate })
    .select('id, garden_id, plant_id, nickname, seeds_planted, planted_at, expected_bloom_date')
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
  }
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function computeNextWaterDate(water: Plant['care']['water']): Date {
  const now = new Date()
  if (water === 'High') return addDays(now, 1)
  if (water === 'Medium') return addDays(now, 3)
  return addDays(now, 7)
}

export async function logWaterEvent(params: { gardenPlantId: string }): Promise<GardenPlantEvent> {
  // Determine next due from plant care
  const { data: gp, error: gperr } = await supabase
    .from('garden_plants')
    .select('id, plant_id')
    .eq('id', params.gardenPlantId)
    .single()
  if (gperr) throw new Error(gperr.message)
  const plantId = String(gp.plant_id)
  const { data: p } = await supabase
    .from('plants')
    .select('care_water')
    .eq('id', plantId)
    .single()
  const nextDue = computeNextWaterDate((p?.care_water || 'Low') as any)
  const nowIso = new Date().toISOString()
  const { data, error } = await supabase
    .from('garden_plant_events')
    .insert({ garden_plant_id: params.gardenPlantId, event_type: 'water', occurred_at: nowIso, next_due_at: nextDue.toISOString(), notes: null })
    .select('id, garden_plant_id, event_type, occurred_at, notes, next_due_at')
    .single()
  if (error) throw new Error(error.message)
  return {
    id: String(data.id),
    gardenPlantId: String(data.garden_plant_id),
    eventType: 'water',
    occurredAt: String(data.occurred_at),
    notes: data.notes,
    nextDueAt: data.next_due_at,
  }
}

export async function getGardenMembers(gardenId: string): Promise<GardenMember[]> {
  const { data, error } = await supabase
    .from('garden_members')
    .select('garden_id, user_id, role, joined_at, profiles:profiles(display_name)')
    .eq('garden_id', gardenId)
  if (error) throw new Error(error.message)
  return (data || []).map((r: any) => ({
    gardenId: String(r.garden_id),
    userId: String(r.user_id),
    role: r.role,
    joinedAt: String(r.joined_at),
    displayName: r.profiles?.display_name ?? null,
  }))
}

export async function addGardenMember(params: { gardenId: string; userId: string; role?: 'member' | 'owner' }): Promise<void> {
  const { gardenId, userId, role = 'member' } = params
  const { error } = await supabase
    .from('garden_members')
    .insert({ garden_id: gardenId, user_id: userId, role })
  if (error) throw new Error(error.message)
}

export async function addMemberByEmail(params: { gardenId: string; email: string }): Promise<{ ok: boolean; reason?: string }> {
  const { gardenId, email } = params
  const { data: userRow } = await supabase
    .from('profiles')
    .select('id')
    .ilike('email', email)
    .maybeSingle()
  if (!userRow?.id) return { ok: false, reason: 'no_account' }
  try {
    await addGardenMember({ gardenId, userId: userRow.id, role: 'member' })
    return { ok: true }
  } catch (e) {
    return { ok: false, reason: 'insert_failed' }
  }
}

export async function fetchScheduleForPlants(gardenPlantIds: string[], windowDays = 30): Promise<Record<string, GardenWateringScheduleRow[]>> {
  if (gardenPlantIds.length === 0) return {}
  const start = new Date()
  start.setDate(start.getDate() - windowDays)
  const startStr = start.toISOString().slice(0,10)
  const end = new Date()
  end.setDate(end.getDate() + windowDays)
  const endStr = end.toISOString().slice(0,10)
  const { data, error } = await supabase
    .from('garden_watering_schedule')
    .select('id, garden_plant_id, due_date, completed_at')
    .gte('due_date', startStr)
    .lte('due_date', endStr)
    .in('garden_plant_id', gardenPlantIds)
  if (error) throw new Error(error.message)
  const acc: Record<string, GardenWateringScheduleRow[]> = {}
  for (const r of data || []) {
    const key = String((r as any).garden_plant_id)
    if (!acc[key]) acc[key] = []
    acc[key].push({
      id: String((r as any).id),
      gardenPlantId: key,
      dueDate: String((r as any).due_date),
      completedAt: (r as any).completed_at || null,
    })
  }
  // Sort by dueDate
  for (const k of Object.keys(acc)) {
    acc[k].sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  }
  return acc
}

export async function reseedSchedule(gardenPlantId: string, daysAhead = 60): Promise<void> {
  const { error } = await supabase.rpc('reseed_watering_schedule', { _garden_plant_id: gardenPlantId, _days_ahead: daysAhead })
  if (error) throw new Error(error.message)
}

export async function markGardenPlantWatered(gardenPlantId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_garden_plant_watered', { _garden_plant_id: gardenPlantId })
  if (error) throw new Error(error.message)
}

export async function updateGardenPlantFrequency(params: { gardenPlantId: string; unit: WaterFreqUnit; value: number }): Promise<void> {
  const { gardenPlantId, unit, value } = params
  const { error } = await supabase
    .from('garden_plants')
    .update({ override_water_freq_unit: unit, override_water_freq_value: value })
    .eq('id', gardenPlantId)
  if (error) throw new Error(error.message)
}

export async function deleteGardenPlant(gardenPlantId: string): Promise<void> {
  const { error } = await supabase
    .from('garden_plants')
    .delete()
    .eq('id', gardenPlantId)
  if (error) throw new Error(error.message)
}

export async function fetchServerNowISO(): Promise<string> {
  const { data, error } = await supabase.rpc('get_server_now')
  if (error) throw new Error(error.message)
  const iso = new Date(String(data)).toISOString()
  return iso
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

