import type { PreparedPlant } from "../types/plant"

export interface NormalizedFilters {
  query: string
  type: string | null
  usageSet: Set<string>
  habitatSet: Set<string>
  maintenance: string | null
  livingSpaceSet: Set<string>
}

export interface FilterOptions {
  seasonFilter: string | null
  onlySeeds: boolean
  onlyFavorites: boolean
  petSafe: boolean
  humanSafe: boolean
  likedSet: Set<string>
  expandedColorFilterSet: Set<string> | null
}

/**
 * Pure function to filter plants based on normalized criteria.
 * Optimized for performance using Set intersections and size checks.
 */
export function filterPlants(
  plants: PreparedPlant[],
  filters: NormalizedFilters,
  options: FilterOptions
): PreparedPlant[] {
  const {
    query: lowerQuery,
    type: normalizedType,
    usageSet,
    habitatSet,
    maintenance: normalizedMaintenanceFilter,
    livingSpaceSet
  } = filters

  const {
    seasonFilter,
    onlySeeds,
    onlyFavorites,
    petSafe,
    humanSafe,
    likedSet,
    expandedColorFilterSet
  } = options

  // Pre-compute living space matching logic
  const livingSpaceCount = livingSpaceSet.size
  const requiresBoth = livingSpaceCount === 2
  const requiresIndoor = livingSpaceSet.has('indoor')
  const requiresOutdoor = livingSpaceSet.has('outdoor')

  return plants.filter((p) => {
    // Early exit pattern: check cheapest conditions first
    // Boolean checks are O(1) and fastest
    if (petSafe && !p._petSafe) return false
    if (humanSafe && !p._humanSafe) return false
    if (onlySeeds && !p.seedsAvailable) return false
    if (onlyFavorites && !likedSet.has(p.id)) return false

    // String equality checks - still O(1)
    if (normalizedType && p._typeLabel !== normalizedType) return false
    if (normalizedMaintenanceFilter && p._maintenance !== normalizedMaintenanceFilter) return false

    // Season filter - O(1) Set lookup
    if (seasonFilter && !p._seasonsSet.has(seasonFilter)) return false

    // Living space filter - pre-computed logic
    if (livingSpaceCount > 0) {
      if (requiresBoth) {
        if (p._livingSpace !== 'both') return false
      } else if (requiresIndoor) {
        if (p._livingSpace !== 'indoor' && p._livingSpace !== 'both') return false
      } else if (requiresOutdoor) {
        if (p._livingSpace !== 'outdoor' && p._livingSpace !== 'both') return false
      }
    }

    // Usage filter - AND logic (match ALL selected usages)
    // Optimization: Plant must have at least as many usages as requested
    if (usageSet.size > 0) {
      if (p._usageSet.size < usageSet.size) return false

      for (const usage of usageSet) {
        if (!p._usageSet.has(usage)) return false
      }
    }

    // Habitat filter - OR logic (match ANY selected habitat)
    if (habitatSet.size > 0) {
      let hasMatchingHabitat = false

      // Optimization: Iterate over the smaller set
      // Usually habitatSet (filters) is small (1-2), but can be larger than p._habitatSet (typically 1)
      if (habitatSet.size < p._habitatSet.size) {
        for (const h of habitatSet) {
          if (p._habitatSet.has(h)) {
            hasMatchingHabitat = true
            break
          }
        }
      } else {
        for (const h of p._habitatSet) {
          if (habitatSet.has(h)) {
            hasMatchingHabitat = true
            break
          }
        }
      }

      if (!hasMatchingHabitat) return false
    }

    // Color filter - OR logic (match ANY selected color or its variations)
    if (expandedColorFilterSet) {
      let hasMatchingColor = false

      // Optimization: Iterate over the smaller set
      // expandedColorFilterSet can be large (colors + children + translations)
      // p._colorTokens can also be large (colors + aliases + split tokens)
      // Checking size dynamically ensures optimal performance
      if (expandedColorFilterSet.size < p._colorTokens.size) {
        for (const color of expandedColorFilterSet) {
          if (p._colorTokens.has(color)) {
            hasMatchingColor = true
            break
          }
        }
      } else {
        for (const plantToken of p._colorTokens) {
          if (expandedColorFilterSet.has(plantToken)) {
            hasMatchingColor = true
            break
          }
        }
      }

      if (!hasMatchingColor) return false
    }

    // Search query - string includes is O(n*m) but unavoidable for substring search
    // Checked last as it's the most expensive operation
    if (lowerQuery && !p._searchString.includes(lowerQuery)) return false

    return true
  })
}
