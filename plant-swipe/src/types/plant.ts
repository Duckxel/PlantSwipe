// ============================================================================
// Plant Types — Matches new DB schema (9 sections)
// ============================================================================

// -- Section 1: Base ----------------------------------------------------------

export type EncyclopediaCategory =
  | "tree" | "shrub" | "small_shrub" | "fruit_tree" | "bamboo"
  | "cactus_succulent" | "herbaceous" | "palm" | "fruit_plant"
  | "aromatic_plant" | "medicinal_plant" | "climbing_plant"
  | "vegetable_plant" | "perennial_plant" | "bulb_plant"
  | "rhizome_plant" | "indoor_plant" | "fern" | "moss_lichen"
  | "aquatic_semi_aquatic"

export type MonthSlug =
  | "january" | "february" | "march" | "april" | "may" | "june"
  | "july" | "august" | "september" | "october" | "november" | "december"

// -- Section 2: Identity ------------------------------------------------------

export type PlantUtility =
  | "edible" | "ornamental" | "aromatic" | "medicinal"
  | "fragrant" | "cereal" | "spice"

export type EdiblePart =
  | "flower" | "fruit" | "seed" | "leaf" | "stem"
  | "bulb" | "rhizome" | "bark" | "wood"

export type ToxicityLevel =
  | "non_toxic" | "slightly_toxic" | "very_toxic" | "deadly" | "undetermined"
  | "Non-Toxic" | "Midly Irritating" | "Highly Toxic" | "Lethally Toxic"

export type PoisoningMethod =
  | "touch" | "ingestion" | "eye_contact" | "inhalation" | "sap_contact"

export type LifeCycle =
  | "annual" | "biennial" | "perennial" | "succulent_perennial"
  | "monocarpic" | "short_cycle" | "ephemeral"

export type AverageLifespan =
  | "less_than_1_year" | "2_years" | "3_to_10_years"
  | "10_to_50_years" | "over_50_years"

export type FoliagePersistence =
  | "deciduous" | "evergreen" | "semi_evergreen"
  | "marcescent" | "winter_dormant" | "dry_season_deciduous"

export type LivingSpace =
  | "indoor" | "outdoor" | "both" | "terrarium" | "greenhouse"

export type PlantSeason = "spring" | "summer" | "autumn" | "winter" | "Spring" | "Summer" | "Autumn" | "Winter"

export type Climate =
  | "polar" | "montane" | "oceanic" | "degraded_oceanic"
  | "temperate_continental" | "mediterranean" | "tropical_dry"
  | "tropical_humid" | "tropical_volcanic" | "tropical_cyclonic"
  | "humid_insular" | "subtropical_humid" | "equatorial"
  | "windswept_coastal"

// -- Section 3: Care ----------------------------------------------------------

export type CareLevel = "easy" | "moderate" | "complex"

export type Sunlight =
  | "full_sun" | "partial_sun" | "partial_shade" | "light_shade"
  | "deep_shade" | "direct_light" | "bright_indirect_light"
  | "medium_light" | "low_light"

export type WateringType = "hose" | "surface" | "drip" | "soaking" | "wick"

// -- Section 4: Growth --------------------------------------------------------

export type DivisionType =
  | "seed" | "clump_division" | "bulb_division" | "rhizome_division"
  | "cutting" | "layering" | "stolon" | "sucker" | "grafting" | "spore"

export type SowingMethod =
  | "open_ground" | "pot" | "tray" | "greenhouse"
  | "mini_greenhouse" | "broadcast" | "row"

// -- Section 6: Ecology -------------------------------------------------------

export type ConservationStatus =
  | "least_concern" | "near_threatened" | "vulnerable" | "endangered"
  | "critically_endangered" | "extinct_in_wild" | "extinct"
  | "data_deficient" | "not_evaluated"

export type EcologicalTolerance =
  | "drought" | "scorching_sun" | "permanent_shade"
  | "excess_water" | "frost" | "heatwave" | "wind"

export type EcologicalImpact =
  | "neutral" | "favorable" | "potentially_invasive" | "locally_invasive"

// -- Section 9: Meta ----------------------------------------------------------

export type PlantStatus = "in_progress" | "rework" | "review" | "approved" | "in progres"

// ============================================================================
// Interfaces
// ============================================================================

export interface PlantImage {
  id?: string
  link?: string
  use?: "primary" | "discovery" | "other"
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

export interface PlantWateringSchedule {
  season?: string
  quantity?: number
  timePeriod?: "week" | "month" | "year"
}

export interface PlantSource {
  id?: string
  name: string
  url?: string
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
  name_fr?: string
  category: RecipeCategory
  time: RecipeTime
  link?: string
}

// ============================================================================
// Main Plant Interface — Flat structure matching new DB schema
// ============================================================================

export interface Plant {
  id: string
  name: string

  // -- Section 1: Base --------------------------------------------------------
  scientificNameSpecies?: string
  scientificNameVariety?: string
  family?: string
  encyclopediaCategory?: EncyclopediaCategory[]
  featuredMonth?: string[]

  // -- Section 2: Identity ----------------------------------------------------
  // Translatable (from plant_translations)
  commonNames?: string[]
  presentation?: string
  origin?: string[]
  allergens?: string[]
  poisoningSymptoms?: string
  // Non-translatable (from plants table)
  climate?: Climate[]
  season?: PlantSeason[]
  utility?: PlantUtility[]
  ediblePart?: EdiblePart[]
  thorny?: boolean
  toxicityHuman?: ToxicityLevel
  toxicityPets?: ToxicityLevel
  poisoningMethod?: PoisoningMethod[]
  lifeCycle?: LifeCycle[]
  averageLifespan?: AverageLifespan[]
  foliagePersistence?: FoliagePersistence[]
  livingSpace?: LivingSpace[]
  landscaping?: string[]
  plantHabit?: string[]
  multicolor?: boolean
  bicolor?: boolean

  // -- Section 3: Care --------------------------------------------------------
  careLevel?: CareLevel[]
  sunlight?: Sunlight[]
  temperatureMax?: number
  temperatureMin?: number
  temperatureIdeal?: number
  wateringFrequencyWarm?: number
  wateringFrequencyCold?: number
  wateringType?: WateringType[]
  hygrometry?: number
  mistingFrequency?: number
  specialNeeds?: string[]
  substrate?: string[]
  substrateMix?: string[]
  mulchingNeeded?: boolean
  mulchType?: string[]
  nutritionNeed?: string[]
  fertilizer?: string[]
  // Translatable
  soilAdvice?: string
  mulchAdvice?: string
  fertilizerAdvice?: string

  // Watering schedules (from related table)
  wateringSchedules?: PlantWateringSchedule[]

  // -- Section 4: Growth ------------------------------------------------------
  sowingMonth?: string[]
  floweringMonth?: string[]
  fruitingMonth?: string[]
  heightCm?: number
  wingspanCm?: number
  staking?: boolean
  division?: DivisionType[]
  cultivationMode?: string[]
  sowingMethod?: SowingMethod[]
  transplanting?: boolean
  pruning?: boolean
  pruningMonth?: string[]
  // Translatable
  stakingAdvice?: string
  sowingAdvice?: string
  transplantingTime?: string
  outdoorPlantingTime?: string
  pruningAdvice?: string

  // -- Section 5: Danger ------------------------------------------------------
  pests?: string[]
  diseases?: string[]

  // -- Section 6: Ecology -----------------------------------------------------
  conservationStatus?: ConservationStatus[]
  ecologicalStatus?: string[]
  biotopes?: string[]
  urbanBiotopes?: string[]
  ecologicalTolerance?: EcologicalTolerance[]
  biodiversityRole?: string[]
  pollinatorsAttracted?: string[]
  birdsAttracted?: string[]
  mammalsAttracted?: string[]
  ecologicalManagement?: string[]
  ecologicalImpact?: EcologicalImpact[]
  // Translatable
  beneficialRoles?: string[]
  harmfulRoles?: string[]
  symbiosis?: string[]
  symbiosisNotes?: string

  // -- Section 7: Consumption -------------------------------------------------
  infusion?: boolean
  infusionParts?: string[]
  medicinal?: boolean
  aromatherapy?: boolean
  fragrance?: boolean
  edibleOil?: "yes" | "no" | "unknown"
  // Translatable
  nutritionalValue?: string
  recipesIdeas?: string[]
  recipes?: PlantRecipe[]
  infusionBenefits?: string
  infusionRecipeIdeas?: string
  medicinalBenefits?: string
  medicinalUsage?: string
  medicinalWarning?: string
  medicinalHistory?: string
  aromatherapyBenefits?: string
  essentialOilBlends?: string
  // Related tables
  infusionMixes?: Record<string, string>
  spiceMixes?: string[]

  // -- Section 8: Misc --------------------------------------------------------
  companionPlants?: string[]
  biotopePlants?: string[]
  beneficialPlants?: string[]
  harmfulPlants?: string[]
  varieties?: string[]
  sponsoredShopIds?: string[]
  // Translatable
  plantTags?: string[]
  biodiversityTags?: string[]

  // -- Section 9: Meta --------------------------------------------------------
  status?: PlantStatus
  adminCommentary?: string
  userNotes?: string
  createdBy?: string
  createdTime?: string
  updatedBy?: string
  updatedTime?: string
  contributors?: string[]
  sources?: PlantSource[]

  // -- Display / UI -----------------------------------------------------------
  images?: PlantImage[]
  image?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  colors?: PlantColor[] | any[]
  colorNames?: string[]
  popularity?: { likes?: number; rank?: number; [key: string]: unknown }

  // Translatable misc
  sourceName?: string
  sourceUrl?: string

  // Catch-all for legacy/dynamic fields
  [key: string]: unknown

  // =========================================================================
  // LEGACY fields — kept for backward compatibility during migration
  // These map to old nested structures; new code should use flat fields above
  // =========================================================================
  /** @deprecated Use flat fields instead */
  plantType?: string
  /** @deprecated Use commonNames */
  givenNames?: string[]
  /** @deprecated Use scientificNameSpecies */
  scientificName?: string
  /** @deprecated Use presentation */
  overview?: string
  /** @deprecated Use presentation */
  description?: string
  /** @deprecated Use flat fields */
  identity?: Record<string, unknown>
  /** @deprecated Use flat fields */
  plantCare?: Record<string, unknown>
  /** @deprecated Use flat fields */
  care?: Record<string, unknown>
  /** @deprecated Use flat fields */
  growth?: Record<string, unknown>
  /** @deprecated Use flat fields */
  usage?: Record<string, unknown>
  /** @deprecated Use flat fields */
  ecology?: Record<string, unknown>
  /** @deprecated Use flat fields */
  danger?: Record<string, unknown>
  /** @deprecated Use flat fields */
  miscellaneous?: Record<string, unknown>
  /** @deprecated Use flat fields */
  meta?: Record<string, unknown>
}

// ============================================================================
// Color option type (for color picker)
// ============================================================================

export type ColorOption = {
  id: string
  name: string
  hexCode: string
  isPrimary: boolean
  parentIds: string[]
  translations: Record<string, string>
}

// ============================================================================
// Legacy type aliases — kept so existing imports don't break
// ============================================================================

/** @deprecated Use EncyclopediaCategory */
export type PlantType = "plant" | "flower" | "bamboo" | "shrub" | "tree" | "cactus" | "succulent"
/** @deprecated Use EdiblePart */
export type PlantComestiblePart = EdiblePart
/** @deprecated */
export type PlantFruitType = "nut" | "seed" | "stone"
/** @deprecated */
export type PlantTypeValue = string
/** @deprecated */
export type PlantSubclassValue = string
/** @deprecated */
export type PlantSubSubclassValue = string
/** @deprecated */
export type PlantActivityValue = string
/** @deprecated */
export type PlantSubActivityValue = string

/* eslint-disable @typescript-eslint/no-explicit-any */
/** @deprecated Use flat Plant interface. Kept permissive (any) so legacy code compiles. */
export interface PlantIdentity { [key: string]: any }
/** @deprecated */ export interface PlantCare { [key: string]: any }
/** @deprecated */ export interface PlantCareWatering { [key: string]: any }
/** @deprecated */ export interface PlantGrowth { [key: string]: any }
/** @deprecated */ export interface PlantUsage { [key: string]: any }
/** @deprecated */ export interface PlantEcology { [key: string]: any }
/** @deprecated */ export interface PlantDanger { [key: string]: any }
/** @deprecated */ export interface PlantMiscellaneous { [key: string]: any }
/** @deprecated */ export interface PlantMeta { [key: string]: any }
/** @deprecated */ export interface PlantClassification { [key: string]: any }
/** @deprecated */ export type PlantIdentifiers = PlantIdentity
/** @deprecated */ export interface PlantTraits { [key: string]: any }
/** @deprecated */ export interface PlantDimensions { [key: string]: any }
/** @deprecated */ export interface PlantPhenology { [key: string]: any }
/** @deprecated */ export interface PlantEnvironment { [key: string]: any }
/** @deprecated */ export interface PlantPropagation { [key: string]: any }
/** @deprecated */ export type PlantUsageLegacy = PlantUsage
/** @deprecated */ export type PlantEcologyLegacy = PlantEcology
/** @deprecated */ export interface PlantCommerce { [key: string]: any }
/** @deprecated */ export interface PlantProblems { [key: string]: any }
/** @deprecated */ export interface PlantPlanting { [key: string]: any }
/** @deprecated */ export type PlantMetaLegacy = PlantMeta
/** @deprecated */ export type PlantClassificationLegacy = PlantClassification
/** @deprecated */ export type PlantPhoto = PlantImage
/* eslint-enable @typescript-eslint/no-explicit-any */
