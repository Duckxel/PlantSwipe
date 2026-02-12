export type PlantType = "plant" | "flower" | "bamboo" | "shrub" | "tree" | "cactus" | "succulent"
export type PlantTypeValue = "plant" | "bambu" | "shrub" | "tree" | "cactus" | "succulent" | "other"
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
  [key: string]: unknown
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
  [key: string]: unknown
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
  multicolor?: boolean
  bicolor?: boolean
  scent?: boolean
  symbolism?: string[]
  livingSpace?: "Indoor" | "Outdoor" | "Both"
  composition?: ("Flowerbed" | "Path" | "Hedge" | "Ground Cover" | "Pot")[]
  maintenanceLevel?: "None" | "Low" | "Moderate" | "Heavy"
  externalIds?: Record<string, string | Record<string, string>>
  [key: string]: unknown
}

export interface PlantWateringSchedule {
  season?: string
  quantity?: number
  timePeriod?: "week" | "month" | "year"
}

export interface PlantCareWatering {
  season?: string
  quantity?: number
  timePeriod?: "week" | "month" | "year"
  frequency?: string | { winter?: string; spring?: string; summer?: string; autumn?: string }
  method?: string
  depthCm?: number
  schedules?: PlantWateringSchedule[]
  [key: string]: unknown
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
    [key: string]: unknown
  }
  pruning?: {
    bestMonths?: number[]
    method?: string
    [key: string]: unknown
  }
  mulching?: {
    recommended?: boolean
    material?: string
    [key: string]: unknown
  }
  stakingSupport?: boolean
  repottingIntervalYears?: number
  sunlight?: string
  water?: string
  difficulty?: string
  maintenanceLevel?: string
  fertilizingNotes?: string
  pruningNotes?: string
  [key: string]: unknown
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
  [key: string]: unknown
}

export type RecipeCategory =
  | "Breakfast & Brunch"
  | "Starters & Appetizers"
  | "Soups & Salads"
  | "Main Courses"
  | "Side Dishes"
  | "Desserts"
  | "Drinks"
  | "Other"

export type RecipeTime =
  | "Quick and Effortless"
  | "30+ minutes Meals"
  | "Slow Cooking"
  | "Undefined"

export interface PlantRecipe {
  id?: string
  name: string
  category: RecipeCategory
  time: RecipeTime
  link?: string
}

export interface PlantUsage {
  adviceMedicinal?: string
  nutritionalIntake?: string[]
  infusion?: boolean
  adviceInfusion?: string
  infusionMix?: Record<string, string>
  recipesIdeas?: string[]
  recipes?: PlantRecipe[]
  aromatherapy?: boolean
  spiceMixes?: string[]
  gardenUses?: string[]
  indoorOutdoor?: string
  edibleParts?: string[]
  culinaryUses?: string[]
  medicinalUses?: string[]
  [key: string]: unknown
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
  [key: string]: unknown
}

export interface PlantDanger {
  pests?: string[]
  diseases?: string[]
}

export interface PlantMiscellaneous {
  companions?: string[]
  tags?: string[]
  sources?: PlantSource[]
  [key: string]: unknown
}

export interface PlantSource {
  id?: string
  name: string
  url?: string
}

export interface PlantMeta {
  status?: "In Progres" | "Rework" | "Review" | "Approved"
  adminCommentary?: string
  contributors?: string[]
  createdBy?: string
  createdTime?: string
  updatedBy?: string
  updatedTime?: string
  createdAt?: string
  updatedAt?: string
  rarity?: string
  tags?: string[]
  funFact?: string
  sourceReferences?: string[]
  authorNotes?: string
  [key: string]: unknown
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
  multicolor?: boolean
  bicolor?: boolean
  seasons?: PlantSeason[]
  description?: string
  photos?: PlantImage[]
  image?: string
  seedsAvailable?: boolean
  popularity?: { likes?: number; [key: string]: unknown }
  rarity?: string
  waterFreqAmount?: number
  waterFreqValue?: string
  waterFreqPeriod?: string
  waterFreqUnit?: string
  [key: string]: unknown
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
  lifeCycle?: string
  habit?: string[]
  deciduousEvergreen?: string
  growthRate?: string
  thornsSpines?: boolean
  fragrance?: string
  dogFriendly?: boolean
  catFriendly?: boolean
  toxicity?: { toHumans?: string; toPets?: string }
  allergenicity?: string
  invasiveness?: { status?: string; regions?: string[] }
  [key: string]: unknown
}
export interface PlantDimensions {
  height?: { minCm?: number; maxCm?: number }
  spread?: { minCm?: number; maxCm?: number }
  spacing?: { rowCm?: number; plantCm?: number }
  containerFriendly?: boolean
  [key: string]: unknown
}
export interface PlantPhenology {
  bloomMonths?: string[]
  fruitMonths?: string[]
  floweringMonths?: number[]
  fruitingMonths?: number[]
  seasons?: string[]
  flowerColors?: ColorInfo[]
  leafColors?: ColorInfo[]
  scentNotes?: string[]
  [key: string]: unknown
}
export interface PlantEnvironment {
  soil?: { texture?: string[]; drainage?: string; fertility?: string; pH?: { min?: number; max?: number } }
  climate?: { usdaZones?: string[]; rhsH?: string[] }
  hardiness?: { usdaZones?: number[]; rhsH?: string }
  temperature?: { minC?: number; maxC?: number }
  moisture?: { min?: number; max?: number }
  light?: string
  lightIntensity?: string
  sunExposure?: string
  climatePref?: string[]
  humidityPref?: string
  windTolerance?: string
  [key: string]: unknown
}
export interface PlantPropagation {
  methods?: string[]
  stratification?: string
  seed?: { stratification?: string; germinationDays?: { min?: number; max?: number } }
  germination?: { germinationDays?: { min?: number; max?: number } }
  [key: string]: unknown
}
export type PlantUsageLegacy = PlantUsage
export type PlantEcologyLegacy = PlantEcology
export interface PlantCommerce {
  availabilityRegions?: string[]
  distributors?: string[]
  seedsAvailable?: boolean
  [key: string]: unknown
}
export interface PlantProblems {
  pests?: string[]
  diseases?: string[]
  hazards?: string[]
  [key: string]: unknown
}
export interface PlantPlanting {
  hemisphere?: string
  sowingMonths?: number[]
  plantingOutMonths?: number[]
  promotionMonth?: number
  calendar?: {
    hemisphere?: string
    sowingMonths?: number[]
    plantingOutMonths?: number[]
    promotionMonth?: number
  }
  sitePrep?: string[]
  companionPlants?: string[]
  avoidNear?: string[]
  [key: string]: unknown
}
export type PlantMetaLegacy = PlantMeta
export type PlantClassificationLegacy = PlantClassification
export type PlantPhoto = PlantImage

export type ColorOption = {
  id: string
  name: string
  hexCode: string
  isPrimary: boolean
  parentIds: string[]
  translations: Record<string, string>
}
