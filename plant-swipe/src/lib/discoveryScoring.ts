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
  /** When true, build per-plant score breakdowns (admin only) */
  includeBreakdowns?: boolean
}

/** Breakdown of how a plant's discovery score was computed */
export interface ScoreBreakdown {
  total: number
  featuredMonth: number
  seasonal: number
  newPlant: number
  status: number
  interestMatch: number
  gardenType: number
  experience: number
  parentSafety: number
  alreadySeen: number
  alreadyLiked: number
  noImage: number
  random: number
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
const W_NO_IMAGE = -500
const W_RANDOM_MAX = 12

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ⚡ Bolt: Helper to check if a month matches without allocating closures
function hasMatchingMonth(months: string[] | null | undefined, currentMonth: number): boolean {
  if (!months || months.length === 0) return false
  for (let i = 0; i < months.length; i++) {
    if (monthSlugToNumber(months[i]) === currentMonth) {
      return true
    }
  }
  return false
}

/** Check if plant is seasonally relevant (sowing/flowering/fruiting/harvesting) this month */
function isRelevantThisMonth(plant: Plant, currentMonth: number): boolean {
  // ⚡ Bolt: Avoid allocating [plant.sowingMonth, ...] array and closures on every check
  return hasMatchingMonth(plant.sowingMonth, currentMonth) ||
         hasMatchingMonth(plant.floweringMonth, currentMonth) ||
         hasMatchingMonth(plant.fruitingMonth, currentMonth) ||
         hasMatchingMonth(plant.harvestingMonth, currentMonth)
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
): { sorted: Plant[]; breakdowns: Map<string, ScoreBreakdown> } {
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const canPersonalize =
    config.profile !== null &&
    config.profile.personalized_recommendations !== false
  const wantBreakdowns = config.includeBreakdowns === true

  const breakdowns = new Map<string, ScoreBreakdown>()

  // ⚡ Bolt: Use a single-pass for loop with pre-allocation instead of chained .map()
  // to prevent intermediate array allocations in this hot path
  const scored = new Array(plants.length)
  for (let i = 0; i < plants.length; i++) {
    const plant = plants[i]
    let score = 0

    const featuredMonth = isPlantOfTheMonth(plant, now) ? W_FEATURED_MONTH : 0
    const seasonal = isRelevantThisMonth(plant, currentMonth) ? W_SEASONAL : 0
    const newPlant = isNewPlant(plant, now) ? W_NEW_PLANT : 0
    const status = plant.status === 'approved' ? W_STATUS_APPROVED
      : plant.status === 'in_progress' ? W_STATUS_WIP
      : plant.status === 'rework' ? W_STATUS_REWORK : 0
    const interestMatch = canPersonalize ? scoreInterestMatch(plant, config.profile!) : 0
    const gardenType = canPersonalize ? scoreGardenTypeMatch(plant, config.profile!) : 0
    const experience = canPersonalize ? scoreExperienceMatch(plant, config.profile!) : 0
    const parentSafety = canPersonalize ? scoreParentSafety(plant, config.profile!) : 0
    const seenCount = config.seenIds.get(plant.id) ?? 0
    const alreadySeen = seenCount > 0 ? W_ALREADY_SEEN * seenCount : 0
    const alreadyLiked = config.likedIds.has(plant.id) ? W_ALREADY_LIKED : 0
    const hasImages = (plant.images && plant.images.length > 0)
      || (plant.photos && plant.photos.length > 0)
      || !!plant.image
    const noImage = hasImages ? 0 : W_NO_IMAGE
    const random = seededRandom(config.sessionSeed, plant.id) * W_RANDOM_MAX

    score = featuredMonth + seasonal + newPlant + status
      + interestMatch + gardenType + experience + parentSafety
      + alreadySeen + alreadyLiked + noImage + random

    if (wantBreakdowns) {
      breakdowns.set(plant.id, {
        total: score,
        featuredMonth, seasonal, newPlant, status,
        interestMatch, gardenType, experience, parentSafety,
        alreadySeen, alreadyLiked, noImage,
        random: Math.round(random * 10) / 10,
      })
    }

    scored[i] = { plant, score }
  }

  scored.sort((a, b) => b.score - a.score)

  // ⚡ Bolt: Return plants using single-pass loop instead of .map()
  // to avoid intermediate array allocations
  const sorted = new Array(scored.length)
  for (let i = 0; i < scored.length; i++) {
    sorted[i] = scored[i].plant
  }

  return { sorted, breakdowns }
}

// ---------------------------------------------------------------------------
// DB helpers for seen-plants history
// ---------------------------------------------------------------------------

/** How many days before seen-plant history expires and the plant resurfaces */
const SEEN_DECAY_DAYS = 30

/** Load plant IDs the user has seen within the last SEEN_DECAY_DAYS, with their seen counts */
export async function loadSeenPlantIds(userId: string): Promise<Map<string, number>> {
  try {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - SEEN_DECAY_DAYS)

    const { data } = await supabase
      .from('discovery_seen_plants')
      .select('plant_id, seen_count')
      .eq('user_id', userId)
      .gte('seen_at', cutoff.toISOString())

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
 * Uses a true upsert so it works correctly even if local state is stale
 * (e.g. effect fires before loadSeenPlantIds completes after a reload).
 */
export async function markPlantSeen(userId: string, plantId: string): Promise<void> {
  try {
    // Use raw rpc to do an atomic upsert with seen_count increment.
    // ON CONFLICT increments seen_count by 1 instead of relying on a
    // client-side currentCount that may be stale.
    const { error } = await supabase.rpc('upsert_discovery_seen_plant', {
      p_user_id: userId,
      p_plant_id: plantId,
    })
    if (error) {
      // Fallback: try simple upsert if the rpc doesn't exist yet
      await supabase
        .from('discovery_seen_plants')
        .upsert(
          {
            user_id: userId,
            plant_id: plantId,
            seen_at: new Date().toISOString(),
            seen_count: 1,
          },
          { onConflict: 'user_id,plant_id' }
        )
    }
  } catch {
    // Fire-and-forget — don't let tracking failures affect the UI
  }
}
