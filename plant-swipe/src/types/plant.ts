export type PlantType = "plant" | "flower" | "bamboo" | "shrub" | "tree"
export type PlantTypeValue = "plant" | "bambu" | "shrub" | "tree" | "other"
export type PlantSubclassValue = "flower" | "vegetable" | "cereal" | "spice"
export type PlantSubSubclassValue = "fruit" | "seed" | "root" | "leaf" | "flower"
export type PlantActivityValue = "ornemental" | "comestible" | "aromatic" | "medicinal"
export type PlantSubActivityValue =
  | "climbing"
  | "hedge"
  | "massif"
  | "ground cover"
  | "seed"
  | "hull"
  | "core"

export interface PlantClassification {
  type?: PlantTypeValue
  subclass?: PlantSubclassValue
  subSubclass?: PlantSubSubclassValue
  activities?: PlantActivityValue[]
  subActivities?: Partial<Record<PlantActivityValue, PlantSubActivityValue[]>>
  [key: string]: any
}
export type PlantUtility =
  | "comestible"
  | "ornemental"
  | "produce_fruit"
  | "aromatic"
  | "medicinal"
  | "odorous"
  | "climbing"
  | "cereal"
  | "spice"

export type PlantComestiblePart =
  | "flower"
  | "fruit"
  | "seed"
  | "leaf"
  | "stem"
  | "root"
  | "bulb"
  | "bark"
  | "wood"

export type PlantFruitType = "nut" | "seed" | "stone"

export type PlantSeason = "Spring" | "Summer" | "Autumn" | "Winter"

export interface PlantImage {
  id?: string
  link?: string
  use?: "primary" | "discovery" | "other"
  // Legacy/compatibility fields
  url?: string
  isPrimary?: boolean
  isVertical?: boolean
  [key: string]: any
}

export interface PlantColor {
  id?: string
  name: string
  hexCode?: string
}

export interface ColorInfo {
  id?: string
  name: string
  hex?: string
}

export interface PlantIdentity {
  givenNames?: string[]
  scientificName?: string
  canonicalName?: string
  synonyms?: string[]
  commonNames?: string[]
  family?: string
  taxonRank?: string
  cultivarGroup?: string
  cultivar?: string
  genus?: string
  overview?: string
  promotionMonth?: number
  lifeCycle?: "Annual" | "Biennials" | "Perenials" | "Ephemerals" | "Monocarpic" | "Polycarpic"
  season?: PlantSeason[]
  foliagePersistance?: "Deciduous" | "Evergreen" | "Semi-Evergreen" | "Marcescent"
  spiked?: boolean
  toxicityHuman?: "Non-Toxic" | "Midly Irritating" | "Highly Toxic" | "Lethally Toxic"
  toxicityPets?: "Non-Toxic" | "Midly Irritating" | "Highly Toxic" | "Lethally Toxic"
  allergens?: string[]
  colors?: PlantColor[]
  scent?: boolean
  symbolism?: string[]
  livingSpace?: "Indoor" | "Outdoor" | "Both"
  composition?: ("Flowerbed" | "Path" | "Hedge" | "Ground Cover" | "Pot")[]
  maintenanceLevel?: "None" | "Low" | "Moderate" | "Heavy"
  externalIds?: Record<string, string | Record<string, string>>
  [key: string]: any
}

export interface PlantCareWatering {
  season?: string
  quantity?: string
  timePeriod?: "week" | "month" | "year"
  frequency?: string | { winter?: string; spring?: string; summer?: string; autumn?: string }
  method?: string
  depthCm?: number
  [key: string]: any
}

export interface PlantCare {
  origin?: string[]
  habitat?: ("Aquatic" | "Semi-Aquatic" | "Wetland" | "Tropical" | "Temperate" | "Arid" | "Mediterranean" | "Mountain" | "Grassland" | "Forest" | "Coastal" | "Urban")[]
  temperatureMax?: number
  temperatureMin?: number
  temperatureIdeal?: number
  levelSun?: "Low Light" | "Shade" | "Partial Sun" | "Full Sun"
  hygrometry?: number
  watering?: PlantCareWatering
  wateringType?: ("surface" | "buried" | "hose" | "drop" | "drench")[]
  division?: ("Seed" | "Cutting" | "Division" | "Layering" | "Grafting" | "Tissue Separation" | "Bulb separation")[]
  soil?: (
    | "Vermiculite"
    | "Perlite"
    | "Sphagnum moss"
    | "rock wool"
    | "Sand"
    | "Gravel"
    | "Potting Soil"
    | "Peat"
    | "Clay pebbles"
    | "coconut fiber"
    | "Bark"
    | "Wood Chips"
  )[]
  adviceSoil?: string
  adviceMulching?: string
  nutritionNeed?: (
    | "Nitrogen"
    | "Phosphorus"
    | "Potassium"
    | "Calcium"
    | "Magnesium"
    | "Sulfur"
    | "Iron"
    | "Boron"
    | "Manganese"
    | "Molybene"
    | "Chlorine"
    | "Copper"
    | "Zinc"
    | "Nitrate"
    | "Phosphate"
  )[]
  fertilizer?: (
    | "Granular fertilizer"
    | "Liquid Fertilizer"
    | "Meat Flour"
    | "Fish flour"
    | "Crushed bones"
    | "Crushed Horns"
    | "Slurry"
    | "Manure"
    | "Animal excrement"
    | "Sea Fertilizer"
    | "Yurals"
    | "Wine"
    | "guano"
    | "Coffee Grounds"
    | "Banana peel"
    | "Eggshell"
    | "Vegetable cooking water"
    | "Urine"
    | "Grass Clippings"
    | "Vegetable Waste"
    | "Natural Mulch"
  )[]
  adviceFertilizer?: string
  fertilizing?: {
    type?: string
    schedule?: string
    [key: string]: any
  }
  pruning?: {
    bestMonths?: number[]
    method?: string
    [key: string]: any
  }
  mulching?: {
    recommended?: boolean
    material?: string
    [key: string]: any
  }
  stakingSupport?: boolean
  repottingIntervalYears?: number
  sunlight?: string
  water?: string
  difficulty?: string
  maintenanceLevel?: string
  fertilizingNotes?: string
  pruningNotes?: string
  [key: string]: any
}

export interface PlantGrowth {
  sowingMonth?: number[]
  floweringMonth?: number[]
  fruitingMonth?: number[]
  height?: number
  wingspan?: number
  tutoring?: boolean
  adviceTutoring?: string
  sowType?: ("Direct" | "Indoor" | "Row" | "Hill" | "Broadcast" | "Seed Tray" | "Cell" | "Pot")[]
  separation?: number
  transplanting?: boolean
  adviceSowing?: string
  cut?: string
  sowingMonths?: number[]
  plantingOutMonths?: number[]
  hemisphere?: string
  [key: string]: any
}

export interface PlantUsage {
  adviceMedicinal?: string
  nutritionalIntake?: string[]
  infusion?: boolean
  adviceInfusion?: string
  infusionMix?: Record<string, string>
  recipesIdeas?: string[]
  aromatherapy?: boolean
  spiceMixes?: string[]
  gardenUses?: string[]
  indoorOutdoor?: string
  edibleParts?: string[]
  culinaryUses?: string[]
  medicinalUses?: string[]
  [key: string]: any
}

export interface PlantEcology {
  melliferous?: boolean
  polenizer?: (
    | "Bee"
    | "Wasp"
    | "Ant"
    | "Butterfly"
    | "Bird"
    | "Mosquito"
    | "Fly"
    | "Beetle"
    | "ladybug"
    | "Stagbeetle"
    | "Cockchafer"
    | "dungbeetle"
    | "weevil"
  )[]
  beFertilizer?: boolean
  groundEffect?: string
  conservationStatus?: "Safe" | "At Risk" | "Vulnerable" | "Endangered" | "Critically Endangered" | "Extinct"
  nativeRange?: string[]
  pollinators?: string[]
  wildlifeValue?: string[]
  hemisphere?: string
  [key: string]: any
}

export interface PlantDanger {
  pests?: string[]
  diseases?: string[]
}

export interface PlantMiscellaneous {
  companions?: string[]
  tags?: string[]
  source?: Record<string, string>
  [key: string]: any
}

export interface PlantMeta {
  status?: "In Progres" | "Rework" | "Review" | "Approved"
  adminCommentary?: string
  createdBy?: string
  createdTime?: string
  updatedBy?: string
  updatedTime?: string
  createdAt?: string
  rarity?: string
  tags?: string[]
  funFact?: string
  sourceReferences?: string[]
  authorNotes?: string
  [key: string]: any
}

export interface Plant {
  id: string
  name: string
  scientificName?: string
  meaning?: string
  plantType?: PlantType
  utility?: PlantUtility[]
  comestiblePart?: PlantComestiblePart[]
  fruitType?: PlantFruitType[]
  images?: PlantImage[]
  identity?: PlantIdentity
  plantCare?: PlantCare
  care?: PlantCare
  phenology?: PlantPhenology
  environment?: PlantEnvironment
  planting?: PlantPlanting & { calendar?: PlantPlanting }
  growth?: PlantGrowth
  usage?: PlantUsage
  ecology?: PlantEcology
  danger?: PlantDanger
  miscellaneous?: PlantMiscellaneous
  meta?: PlantMeta
  classification?: PlantClassification
  colors?: string[]
  seasons?: PlantSeason[]
  description?: string
  photos?: PlantImage[]
  image?: string
  seedsAvailable?: boolean
  popularity?: { likes?: number; [key: string]: any }
  rarity?: string
  waterFreqAmount?: number
  waterFreqValue?: string
  waterFreqPeriod?: string
  waterFreqUnit?: string
  [key: string]: any
  // Legacy structured properties retained for backward compatibility
  identifiers?: PlantIdentity
  traits?: Record<string, unknown>
  dimensions?: Record<string, unknown>
  propagation?: Record<string, unknown>
  usageLegacy?: Record<string, unknown>
  commerce?: Record<string, unknown>
  problems?: Record<string, unknown>
  classificationLegacy?: Record<string, unknown>
}

// Legacy compatibility aliases (older components still import these names)
export type PlantIdentifiers = PlantIdentity
export interface PlantTraits {
  dogFriendly?: boolean
  catFriendly?: boolean
  toxicity?: { toHumans?: string; toPets?: string }
  [key: string]: any
}
export interface PlantDimensions {
  height?: { minCm?: number; maxCm?: number }
  spread?: { minCm?: number; maxCm?: number }
  spacing?: { rowCm?: number; plantCm?: number }
  [key: string]: any
}
export interface PlantPhenology {
  bloomMonths?: string[]
  fruitMonths?: string[]
  seasons?: string[]
  flowerColors?: ColorInfo[]
  leafColors?: ColorInfo[]
  scentNotes?: string[]
  [key: string]: any
}
export interface PlantEnvironment {
  soil?: { texture?: string[]; drainage?: string[]; fertility?: string[]; pH?: { min?: number; max?: number } }
  climate?: { usdaZones?: string[]; rhsH?: string[] }
  moisture?: { min?: number; max?: number }
  light?: string
  sunExposure?: string
  [key: string]: any
}
export interface PlantPropagation {
  methods?: string[]
  stratification?: string
  germination?: { germinationDays?: { min?: number; max?: number } }
  [key: string]: any
}
export type PlantUsageLegacy = PlantUsage
export type PlantEcologyLegacy = PlantEcology
export interface PlantCommerce {
  availabilityRegions?: string[]
  distributors?: string[]
  [key: string]: any
}
export interface PlantProblems {
  pests?: string[]
  diseases?: string[]
  [key: string]: any
}
export interface PlantPlanting {
  hemisphere?: string
  sowingMonths?: number[]
  plantingOutMonths?: number[]
  promotionMonth?: number
  sitePrep?: string[]
  companionPlants?: string[]
  avoidNear?: string[]
  [key: string]: any
}
export type PlantMetaLegacy = PlantMeta
export type PlantClassificationLegacy = PlantClassification
export type PlantPhoto = PlantImage
