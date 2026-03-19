/**
 * Personalized Discovery Scoring Algorithm
 *
 * Scores plants for each user based on:
 * - User interests (onboarding: looking_for, garden_type, experience_level, parent)
 * - Monthly promotion (featuredMonth)
 * - Seasonal relevance (sowing, flowering, fruiting, harvesting months)
 * - Plant data quality (status: approved vs in_progress)
 * - Exploration history (seen plants persisted in DB, liked plants)
 * - Controlled randomness (session-scoped seed for variety)
 *
 * GDPR: personalized factors only apply when profile.personalized_recommendations !== false
 */

import type { Plant } from '@/types/plant'
import type { ProfileRow } from '@/lib/supabaseClient'
import { isPlantOfTheMonth, isNewPlant, isDangerouslyToxic } from '@/lib/plantHighlights'
import { monthSlugToNumber } from '@/lib/months'
import { supabase } from '@/lib/supabaseClient'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DiscoveryConfig {
  profile: ProfileRow | null
  likedIds: Set<string>
  /** Map of plant ID → seen count (how many times the user has swiped past it) */
  seenIds: Map<string, number>
  sessionSeed: number
}

// ---------------------------------------------------------------------------
// Scoring weights
// ---------------------------------------------------------------------------

const W_FEATURED_MONTH = 25
const W_INTEREST_MATCH = 20
const W_SEASONAL = 15
const W_GARDEN_TYPE = 15
const W_EXPERIENCE = 10
const W_NEW_PLANT = 10
const W_STATUS_APPROVED = 10
const W_STATUS_WIP = -20
const W_STATUS_REWORK = -5
const W_PARENT_TOXIC = -30
const W_ALREADY_LIKED = -25
const W_ALREADY_SEEN = -15
const W_RANDOM_MAX = 12

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check if plant is seasonally relevant (sowing/flowering/fruiting/harvesting) this month */
function isRelevantThisMonth(plant: Plant, currentMonth: number): boolean {
  const monthArrays = [
    plant.sowingMonth,
    plant.floweringMonth,
    plant.fruitingMonth,
    plant.harvestingMonth,
  ]
  return monthArrays.some(months =>
    months?.some(slug => monthSlugToNumber(slug) === currentMonth),
  )
}

/** Score based on user's looking_for preference vs plant utility */
function scoreInterestMatch(plant: Plant, profile: ProfileRow): number {
  const utils = plant.utility
  if (!utils || utils.length === 0) return 0

  switch (profile.looking_for) {
    case 'eat':
      return utils.includes('edible') ? W_INTEREST_MATCH : 0
    case 'ornamental':
      return utils.includes('ornamental') ? W_INTEREST_MATCH : 0
    case 'various':
      // Small boost if plant has any utility match
      return (utils.includes('edible') || utils.includes('ornamental')) ? 5 : 0
    default:
      return 0
  }
}

/** Score based on user's garden type vs plant living space */
function scoreGardenTypeMatch(plant: Plant, profile: ProfileRow): number {
  const spaces = plant.livingSpace
  if (!spaces || spaces.length === 0) return 0

  switch (profile.garden_type) {
    case 'inside':
      return (spaces.includes('indoor') || spaces.includes('terrarium'))
        ? W_GARDEN_TYPE : 0
    case 'outside':
      return (spaces.includes('outdoor') || spaces.includes('greenhouse'))
        ? W_GARDEN_TYPE : 0
    case 'both':
      return 5 // Small boost for all plants
    default:
      return 0
  }
}

/** Score based on user experience vs plant care level */
function scoreExperienceMatch(plant: Plant, profile: ProfileRow): number {
  const levels = plant.careLevel
  if (!levels || levels.length === 0) return 0

  switch (profile.experience_level) {
    case 'novice':
      return levels.includes('easy') ? W_EXPERIENCE : 0
    case 'intermediate':
      return levels.includes('moderate') ? W_EXPERIENCE : 0
    case 'expert':
      return levels.includes('complex') ? W_EXPERIENCE : 0
    default:
      return 0
  }
}

/** Penalty for toxic plants when user has kids/pets */
function scoreParentSafety(plant: Plant, profile: ProfileRow): number {
  if (!profile.parent) return 0
  return isDangerouslyToxic(plant) ? W_PARENT_TOXIC : 0
}

/**
 * Deterministic per-session randomness using a simple string hash.
 * Returns a stable float in [0, 1) for a given seed + plantId combination.
 */
function seededRandom(seed: number, plantId: string): number {
  let hash = 0
  const str = `${seed}-${plantId}`
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash % 1000) / 1000
}

// ---------------------------------------------------------------------------
// Main scoring function
// ---------------------------------------------------------------------------

export function scoreDiscoveryPlants(
  plants: Plant[],
  config: DiscoveryConfig,
): Plant[] {
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const canPersonalize =
    config.profile !== null &&
    config.profile.personalized_recommendations !== false

  const scored = plants.map(plant => {
    let score = 0

    // --- Universal factors (always applied) ---
    if (isPlantOfTheMonth(plant, now)) score += W_FEATURED_MONTH
    if (isRelevantThisMonth(plant, currentMonth)) score += W_SEASONAL
    if (isNewPlant(plant, now)) score += W_NEW_PLANT

    // Plant status
    if (plant.status === 'approved') score += W_STATUS_APPROVED
    if (plant.status === 'in_progress') score += W_STATUS_WIP
    if (plant.status === 'rework') score += W_STATUS_REWORK

    // --- Personalized factors (only if consented & logged in) ---
    if (canPersonalize) {
      score += scoreInterestMatch(plant, config.profile!)
      score += scoreGardenTypeMatch(plant, config.profile!)
      score += scoreExperienceMatch(plant, config.profile!)
      score += scoreParentSafety(plant, config.profile!)
    }

    // --- Exploration factors (logged-in users) ---
    const seenCount = config.seenIds.get(plant.id) ?? 0
    if (seenCount > 0) score += W_ALREADY_SEEN * seenCount
    if (config.likedIds.has(plant.id)) score += W_ALREADY_LIKED

    // --- Session randomness ---
    score += seededRandom(config.sessionSeed, plant.id) * W_RANDOM_MAX

    return { plant, score }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored.map(s => s.plant)
}

// ---------------------------------------------------------------------------
// DB helpers for seen-plants history
// ---------------------------------------------------------------------------

/** Load all plant IDs the user has previously seen, with their seen counts */
export async function loadSeenPlantIds(userId: string): Promise<Map<string, number>> {
  try {
    const { data } = await supabase
      .from('discovery_seen_plants')
      .select('plant_id, seen_count')
      .eq('user_id', userId)

    const map = new Map<string, number>()
    for (const r of data || []) {
      map.set(r.plant_id as string, (r.seen_count as number) || 1)
    }
    return map
  } catch {
    // Non-critical — if the table doesn't exist yet or query fails, return empty
    return new Map()
  }
}

/**
 * Record that a user has seen a plant in discovery (fire-and-forget).
 * Uses upsert: on first sight inserts; on repeat updates seen_at and increments seen_count.
 */
export async function markPlantSeen(userId: string, plantId: string, currentCount: number): Promise<void> {
  try {
    if (currentCount === 0) {
      // First time seeing this plant — insert
      await supabase
        .from('discovery_seen_plants')
        .insert({
          user_id: userId,
          plant_id: plantId,
          seen_at: new Date().toISOString(),
          seen_count: 1,
        })
    } else {
      // Already seen — increment seen_count
      await supabase
        .from('discovery_seen_plants')
        .update({
          seen_at: new Date().toISOString(),
          seen_count: currentCount + 1,
        })
        .eq('user_id', userId)
        .eq('plant_id', plantId)
    }
  } catch {
    // Fire-and-forget — don't let tracking failures affect the UI
  }
}
