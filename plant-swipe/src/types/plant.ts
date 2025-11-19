export type PlantType = "plant" | "flower" | "bamboo" | "shrub" | "tree"
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
  link: string
  use: "primary" | "discovery" | "other"
}

export interface PlantColor {
  id?: string
  name: string
  hexCode?: string
}

export interface PlantIdentity {
  givenNames?: string[]
  scientificName?: string
  family?: string
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
}

export interface PlantCareWatering {
  season?: string
  quantity?: string
  timePeriod?: "week" | "month" | "year"
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
  mulching?: (
    | "Wood Chips"
    | "Bark"
    | "Green Manure"
    | "Cocoa Bean Hulls"
    | "Buckwheat Hulls"
    | "Cereal Straw"
    | "Hemp Straw"
    | "Woven Fabric"
    | "Pozzolana"
    | "Crushed Slate"
    | "Clay Pellets"
  )[]
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
}

export interface PlantDanger {
  pests?: string[]
  diseases?: string[]
}

export interface PlantMiscellaneous {
  companions?: string[]
  tags?: string[]
  source?: Record<string, string>
}

export interface PlantMeta {
  status?: "In Progres" | "Rework" | "Review" | "Approved"
  adminCommentary?: string
  createdBy?: string
  createdTime?: string
  updatedBy?: string
  updatedTime?: string
}

export interface Plant {
  id: string
  name: string
  plantType?: PlantType
  utility?: PlantUtility[]
  comestiblePart?: PlantComestiblePart[]
  fruitType?: PlantFruitType[]
  images?: PlantImage[]
  identity?: PlantIdentity
  plantCare?: PlantCare
  growth?: PlantGrowth
  usage?: PlantUsage
  ecology?: PlantEcology
  danger?: PlantDanger
  miscellaneous?: PlantMiscellaneous
  meta?: PlantMeta
  // Legacy structured properties retained for backward compatibility
  identifiers?: PlantIdentity
  traits?: Record<string, unknown>
  dimensions?: Record<string, unknown>
  phenology?: Record<string, unknown>
  environment?: Record<string, unknown>
  care?: Record<string, unknown>
  propagation?: Record<string, unknown>
  usageLegacy?: Record<string, unknown>
  commerce?: Record<string, unknown>
  problems?: Record<string, unknown>
  planting?: Record<string, unknown>
  classification?: Record<string, unknown>
  colors?: string[]
  seasons?: PlantSeason[]
  description?: string
  photos?: PlantImage[]
}

// Legacy compatibility aliases (older components still import these names)
export type PlantIdentifiers = PlantIdentity
export type PlantTraits = Record<string, unknown>
export type PlantDimensions = Record<string, unknown>
export type PlantPhenology = Record<string, unknown>
export type PlantEnvironment = Record<string, unknown>
export type PlantPropagation = Record<string, unknown>
export type PlantUsageLegacy = Record<string, unknown>
export type PlantEcologyLegacy = Record<string, unknown>
export type PlantCommerce = Record<string, unknown>
export type PlantProblems = Record<string, unknown>
export type PlantPlanting = Record<string, unknown>
export type PlantMetaLegacy = Record<string, unknown>
export type PlantClassification = Record<string, unknown>
export type PlantPhoto = PlantImage
export type PlantActivityValue = string
export type PlantSubActivityValue = string
