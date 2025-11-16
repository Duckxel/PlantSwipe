/**
 * Plant data structure matching PLANT-INFO-SCHEMA.json
 */

export type PlantSeason = "Spring" | "Summer" | "Autumn" | "Winter"

export interface PlantIdentifiers {
  scientificName?: string
  canonicalName?: string
  synonyms?: string[]
  commonNames?: string[]
  taxonRank?: "species" | "subspecies" | "variety" | "form" | "cultivar" | "hybrid"
  cultivarGroup?: string
  cultivar?: string
  family?: string
  genus?: string
  externalIds?: {
    gbif?: string
    powo?: string
    ipni?: string
    itis?: string
    wiki?: string
    kindwise?: string
    other?: Record<string, string>
  }
}

export interface PlantTraits {
  lifeCycle?: "annual" | "biennial" | "perennial"
  habit?: ("tree" | "shrub" | "vine" | "climber" | "herbaceous" | "succulent" | "grass" | "fern" | "aquatic")[]
  deciduousEvergreen?: "deciduous" | "evergreen" | "semi-evergreen"
  growthRate?: "slow" | "moderate" | "fast"
  thornsSpines?: boolean
  fragrance?: "none" | "light" | "moderate" | "strong"
  toxicity?: {
    toHumans?: "non-toxic" | "mild" | "moderate" | "severe"
    toPets?: "non-toxic" | "mild" | "moderate" | "severe"
  }
  allergenicity?: "low" | "medium" | "high"
  invasiveness?: {
    status?: "not invasive" | "regional risk" | "invasive"
    regions?: string[]
  }
}

export interface PlantDimensions {
  height?: {
    minCm?: number
    maxCm?: number
  }
  spread?: {
    minCm?: number
    maxCm?: number
  }
  spacing?: {
    rowCm?: number
    plantCm?: number
  }
  containerFriendly?: boolean
}

export interface ColorInfo {
  name: string
  hex?: string
}

export interface PlantPhenology {
  flowerColors?: ColorInfo[]
  leafColors?: ColorInfo[]
  floweringMonths?: number[]
  fruitingMonths?: number[]
  scentNotes?: string[]
}

export interface PlantEnvironment {
  sunExposure?: "full sun" | "partial sun" | "partial shade" | "full shade"
  lightIntensity?: "very high" | "high" | "medium" | "low"
  hardiness?: {
    usdaZones?: number[]
    rhsH?: string
  }
  climatePref?: ("tropical" | "subtropical" | "temperate" | "Mediterranean" | "arid" | "continental" | "oceanic")[]
  temperature?: {
    minC?: number
    maxC?: number
  }
  humidityPref?: "low" | "moderate" | "high"
  windTolerance?: "low" | "moderate" | "high"
  soil?: {
    texture?: ("sandy" | "loamy" | "silty" | "clayey")[]
    drainage?: "free-draining" | "moderate" | "poor"
    fertility?: "low" | "medium" | "high"
    pH?: {
      min?: number
      max?: number
    }
  }
}

export type PlantCareDifficulty =
  | "easy"
  | "moderate"
  | "advanced"
  | "Easy"
  | "Moderate"
  | "Hard"
  | "Difficult"
  | "Beginner"
  | "Intermediate"
  | "Expert"

export interface PlantCare {
  sunlight?: "Low" | "Medium" | "High" | "Full Sun" | "Partial Sun" | string
  water?: "Low" | "Medium" | "High" | string
  soil?: string
  difficulty?: PlantCareDifficulty
  maintenanceLevel?: "low" | "medium" | "high"
  watering?: {
    frequency?: {
      winter?: string
      spring?: string
      summer?: string
      autumn?: string
    }
    method?: "at soil" | "bottom water" | "soak and dry" | "drip" | "none (aquatic)"
    depthCm?: number
  }
  fertilizing?: {
    type?: "balanced NPK" | "high K" | "organic compost" | "slow-release" | "foliar"
    schedule?: string
  }
  pruning?: {
    bestMonths?: number[]
    method?: "light trim" | "hard prune" | "deadheading" | "thinning" | "renewal"
  }
  mulching?: {
    recommended?: boolean
    material?: string
  }
  stakingSupport?: boolean
  repottingIntervalYears?: number
}

export interface PlantPropagation {
  methods?: ("seed" | "cuttings" | "division" | "layering" | "grafting" | "tissue culture")[]
  seed?: {
    stratification?: "none" | "cold-moist" | "warm" | "scarification"
    germinationDays?: {
      min?: number
      max?: number
    }
  }
}

export interface PlantUsage {
  gardenUses?: ("border" | "mass planting" | "hedge" | "groundcover" | "specimen" | "container" | "climber" | "wildlife garden" | "cut flower" | "fragrance")[]
  indoorOutdoor?: "outdoor" | "indoor" | "both"
  edibleParts?: ("none" | "leaf" | "flower" | "fruit" | "seed" | "root" | "stem")[]
  culinaryUses?: string[]
  medicinalUses?: string[]
}

export interface PlantEcology {
  nativeRange?: string[]
  pollinators?: string[]
  wildlifeValue?: string[]
  conservationStatus?: "NE" | "DD" | "LC" | "NT" | "VU" | "EN" | "CR" | "EW" | "EX"
}

export interface PlantCommerce {
  seedsAvailable?: boolean
}

export interface PlantProblems {
  pests?: string[]
  diseases?: string[]
  hazards?: string[]
}

export interface PlantPlanting {
  calendar?: {
    hemisphere?: "north" | "south" | "equatorial"
    sowingMonths?: number[]
    plantingOutMonths?: number[]
    promotionMonth?: number
  }
  sitePrep?: string[]
  companionPlants?: string[]
  avoidNear?: string[]
}

export interface PlantMeta {
  rarity?: "common" | "uncommon" | "rare" | "very rare"
  tags?: string[]
  funFact?: string
  sourceReferences?: string[]
  authorNotes?: string
  createdAt?: string
  updatedAt?: string
  createdBy?: string
  updatedBy?: string
}

export type PlantTypeValue = "plant" | "bambu" | "shrub" | "tree" | "other"
export type PlantSubclassValue = "flower" | "vegetable" | "cereal" | "spice"
export type PlantSubSubclassValue = "fruit" | "seed" | "root" | "leaf" | "flower"
export type PlantActivityValue = "ornemental" | "comestible" | "aromatic" | "medicinal"
export type PlantSubActivityValue = "climbing" | "hedge" | "massif" | "ground cover" | "seed" | "hull" | "core"

export interface PlantClassification {
  type?: PlantTypeValue
  subclass?: PlantSubclassValue
  subSubclass?: PlantSubSubclassValue
  activities?: PlantActivityValue[]
  subActivities?: Partial<Record<PlantActivityValue, PlantSubActivityValue[]>>
}

export interface PlantPopularity {
  likes?: number
  rank?: number
  isTopPick?: boolean
}

export interface Plant {
  id: string
  // Legacy name field for backward compatibility
  name: string
  image?: string
  // New structured format
  identifiers?: PlantIdentifiers
  traits?: PlantTraits
  dimensions?: PlantDimensions
  phenology?: PlantPhenology
  environment?: PlantEnvironment
  care?: PlantCare
  propagation?: PlantPropagation
  usage?: PlantUsage
  ecology?: PlantEcology
  commerce?: PlantCommerce
  problems?: PlantProblems
  planting?: PlantPlanting
  meta?: PlantMeta
  classification?: PlantClassification
  // Legacy fields for backward compatibility
  scientificName?: string
  colors: string[]
  seasons: PlantSeason[]
  rarity?: "Common" | "Uncommon" | "Rare" | "Legendary"
  meaning?: string
  description?: string
  seedsAvailable?: boolean
  waterFreqUnit?: 'day' | 'week' | 'month' | 'year'
  waterFreqValue?: number | null
  waterFreqPeriod?: 'week' | 'month' | 'year'
  waterFreqAmount?: number | null
  popularity?: PlantPopularity
}
