import type { Plant, ColorOption } from "@/types/plant"
import { formatClassificationLabel } from "@/constants/classification"
import { isPlantOfTheMonth } from "@/lib/plantHighlights"

export type ColorLookups = {
  nameMap: Map<string, ColorOption>
  idMap: Map<string, ColorOption>
  childrenMap: Map<string, ColorOption[]>
  translationMap: Map<string, ColorOption>
  aliasMap: Map<string, Set<string>>
}

// Optimized PreparedPlant: Uses arrays instead of Sets for O(1) creation overhead
// and efficient linear scans for small collections (< 10 items)
export type PreparedPlant = Plant & {
  _searchString: string
  _normalizedColors: string[]
  _colorTokens: string[]        // Optimized: array of tokens (was Set)
  _typeLabel: string | null
  _usageLabels: string[]
  // _usageSet removed (use _usageLabels array)
  _habitats: string[]
  // _habitatSet removed (use _habitats array)
  _maintenance: string
  _petSafe: boolean
  _humanSafe: boolean
  _livingSpace: string
  _seasons: string[]               // Normalized seasons array (was Set)
  _createdAtTs: number             // Pre-parsed timestamp for sorting
  _popularityLikes: number         // Pre-extracted popularity for sorting
  _hasImage: boolean               // Pre-computed image availability
  _isPromoted: boolean             // Pre-computed promotion status (Plant of the Month)
  _isInProgress: boolean           // Pre-computed status for sorting
}

const RE_SPLIT_COLOR = /[-_/]+/g
const RE_WHITESPACE = /\s+/

export function getPlantTypeLabel(classification?: Plant["classification"]): string | null {
  if (!classification?.type) return null
  const label = formatClassificationLabel(classification.type)
  return label || null
}

export function getPlantUsageLabels(plant: Plant): string[] {
  const labels: string[] = []

  // Get usage labels from utility field
  if (plant.utility && Array.isArray(plant.utility) && plant.utility.length > 0) {
    plant.utility.forEach((util) => {
      if (util) {
        const formatted = formatClassificationLabel(util)
        if (formatted && !labels.includes(formatted)) {
          labels.push(formatted)
        }
      }
    })
  }

  // Also check comestiblePart for edible-related labels
  if (plant.comestiblePart && Array.isArray(plant.comestiblePart) && plant.comestiblePart.length > 0) {
    const hasEdible = plant.comestiblePart.some(part => part && part.trim().length > 0)
    if (hasEdible) {
      const edibleLabel = formatClassificationLabel('comestible')
      if (edibleLabel && !labels.includes(edibleLabel)) {
        labels.push(edibleLabel)
      }
    }
  }

  // Check usage fields for additional indicators
  if (plant.usage?.aromatherapy) {
    const aromaticLabel = formatClassificationLabel('aromatic')
    if (aromaticLabel && !labels.includes(aromaticLabel)) {
      labels.push(aromaticLabel)
    }
  }

  if (plant.usage?.adviceMedicinal) {
    const medicinalLabel = formatClassificationLabel('medicinal')
    if (medicinalLabel && !labels.includes(medicinalLabel)) {
      labels.push(medicinalLabel)
    }
  }

  return labels
}

/**
 * Pre-calculate normalized values for all plants to optimize filter performance
 * This avoids repeating expensive string operations on every filter change.
 *
 * Optimization: Uses arrays instead of Sets for small collections (colors, usage, habitat)
 * to reduce memory allocation overhead (avoiding ~4000 Set objects for 1000 plants).
 * Linear scans on small arrays (< 10 items) are comparable to Set lookups.
 */
export function preparePlants(plants: Plant[], colorLookups: ColorLookups): PreparedPlant[] {
  const { aliasMap } = colorLookups
  const now = new Date()

  // ⚡ Bolt: Cache tokenization results for unique color strings
  // This avoids redundant regex splitting and alias lookups for common colors (e.g. "green")
  // repeated across thousands of plants.
  const colorTokenCache = new Map<string, string[]>()

  const getTokensForColor = (color: string): string[] => {
    const cached = colorTokenCache.get(color)
    if (cached) {
      return cached
    }

    // Use a Set locally for deduplication during tokenization
    const tokensSet = new Set<string>()
    tokensSet.add(color)

    // Check aliases for the full color string (e.g. "dark-green" -> "vert fonce")
    const fullColorAliases = aliasMap.get(color)
    if (fullColorAliases) {
      for (const alias of fullColorAliases) {
        tokensSet.add(alias)
      }
    }

    // Split compound colors and add individual tokens
    const splitTokens = color.replace(RE_SPLIT_COLOR, ' ').split(RE_WHITESPACE).filter(Boolean)
    splitTokens.forEach(token => {
      tokensSet.add(token)

      // O(1) expansion of tokens to all their aliases (canonical + translations)
      // Uses the pre-calculated aliasMap to avoid object iteration
      const aliases = aliasMap.get(token)
      if (aliases) {
        // Fast add of all aliases
        for (const alias of aliases) {
          tokensSet.add(alias)
        }
      }
    })

    const tokens = Array.from(tokensSet)
    colorTokenCache.set(color, tokens)
    return tokens
  }

  return plants.map((p) => {
    // Colors - build array (for iteration)
    const legacyColors = Array.isArray(p.colors) ? p.colors.map((c: string) => String(c)) : []
    const identityColors = Array.isArray(p.identity?.colors)
      ? p.identity.colors.map((c) => (typeof c === 'object' && c?.name ? c.name : String(c)))
      : []
    const colors = [...legacyColors, ...identityColors]
    const normalizedColors = colors.map(c => c.toLowerCase().trim())

    // Pre-tokenize compound colors (e.g., "red-orange" -> ["red", "orange"])
    // This avoids regex operations during filtering
    // Enhanced: Also add translations for bi-directional matching
    // (e.g., plant with "red" will also match filter "rouge")
    // Optimized: Use array instead of Set on the plant object
    const colorTokensSet = new Set<string>()
    normalizedColors.forEach(color => {
      const cachedTokens = getTokensForColor(color)
      for (const t of cachedTokens) {
        colorTokensSet.add(t)
      }
    })
    const colorTokens = Array.from(colorTokensSet)

    // Search string - includes name, scientific name, meaning, colors, common names and synonyms
    // This allows users to search by any name they might know the plant by
    const commonNames = (p.identity?.commonNames || []).join(' ')
    const synonyms = (p.identity?.synonyms || []).join(' ')
    const givenNames = (p.identity?.givenNames || []).join(' ')
    const searchString = `${p.name} ${p.scientificName || ''} ${p.meaning || ''} ${colors.join(" ")} ${commonNames} ${synonyms} ${givenNames}`.toLowerCase()

    // Type
    const typeLabel = getPlantTypeLabel(p.classification)?.toLowerCase() ?? null

    // Usage - array only
    const usageLabels = getPlantUsageLabels(p).map((label) => label.toLowerCase())
    // _usageSet removed

    // Habitat - array only
    const habitats = (p.plantCare?.habitat || p.care?.habitat || []).map((h) => h.toLowerCase())
    // _habitatSet removed

    // Maintenance
    const maintenance = (p.identity?.maintenanceLevel || p.plantCare?.maintenanceLevel || p.care?.maintenanceLevel || '').toLowerCase()

    // Toxicity
    const petSafe = (p.identity?.toxicityPets || '').toLowerCase().replace(/[\s-]/g, '') === 'nontoxic'
    const humanSafe = (p.identity?.toxicityHuman || '').toLowerCase().replace(/[\s-]/g, '') === 'nontoxic'

    // Living space
    const livingSpace = (p.identity?.livingSpace || '').toLowerCase()

    // Seasons - normalized to strings for safe filtering
    const seasons = Array.isArray(p.seasons) ? p.seasons.map(s => String(s)) : []

    // Pre-parse createdAt for faster sorting (avoid Date.parse on each sort comparison)
    const createdAtValue = p.meta?.createdAt
    const createdAtTs = createdAtValue ? Date.parse(createdAtValue) : 0
    const createdAtTsFinal = Number.isNaN(createdAtTs) ? 0 : createdAtTs

    // Pre-extract popularity for faster sorting
    const popularityLikes = p.popularity?.likes ?? 0

    // Pre-compute image availability for Discovery page filtering
    const hasLegacyImage = Boolean(p.image)
    const hasImagesArray = Array.isArray(p.images) && p.images.some((img) => img?.link)
    const hasImage = hasLegacyImage || hasImagesArray

    // Pre-compute promotion status
    const isPromoted = isPlantOfTheMonth(p, now)

    // Pre-compute in-progress status
    const status = p.meta?.status?.toLowerCase()
    const isInProgress = status === 'in progres' || status === 'in progress'

    return {
      ...p,
      _searchString: searchString,
      _normalizedColors: normalizedColors,
      _colorTokens: colorTokens,
      _typeLabel: typeLabel,
      _usageLabels: usageLabels,
      _habitats: habitats,
      _maintenance: maintenance,
      _petSafe: petSafe,
      _humanSafe: humanSafe,
      _livingSpace: livingSpace,
      _seasons: seasons,
      _createdAtTs: createdAtTsFinal,
      _popularityLikes: popularityLikes,
      _hasImage: hasImage,
      _isPromoted: isPromoted,
      _isInProgress: isInProgress
    } as PreparedPlant
  })
}
