// ============================================================================
// Plant form categories — 9 sections matching the DB schema specification
// ============================================================================

export type PlantFormCategory =
  | 'base'
  | 'identity'
  | 'care'
  | 'growth'
  | 'danger'
  | 'ecology'
  | 'consumption'
  | 'misc'
  | 'meta'

export const plantFormCategoryOrder: PlantFormCategory[] = [
  'base',
  'identity',
  'care',
  'growth',
  'danger',
  'ecology',
  'consumption',
  'misc',
  'meta',
]

const fieldCategoryMap: Record<string, PlantFormCategory> = {
  // Section 1: Base
  encyclopediaCategory: 'base',
  scientificNameSpecies: 'base',
  scientificNameVariety: 'base',
  family: 'base',
  commonNames: 'base',
  presentation: 'base',
  featuredMonth: 'base',
  colors: 'base',
  images: 'base',

  // Section 2: Identity
  origin: 'identity',
  climate: 'identity',
  season: 'identity',
  utility: 'identity',
  ediblePart: 'identity',
  thorny: 'identity',
  toxicityHuman: 'identity',
  toxicityPets: 'identity',
  poisoningMethod: 'identity',
  poisoningSymptoms: 'identity',
  allergens: 'identity',
  lifeCycle: 'identity',
  averageLifespan: 'identity',
  foliagePersistence: 'identity',
  livingSpace: 'identity',
  landscaping: 'identity',
  plantHabit: 'identity',
  multicolor: 'identity',
  bicolor: 'identity',

  // Section 3: Care
  careLevel: 'care',
  sunlight: 'care',
  temperatureMax: 'care',
  temperatureMin: 'care',
  temperatureIdeal: 'care',
  wateringFrequencyWarm: 'care',
  wateringFrequencyCold: 'care',
  wateringType: 'care',
  hygrometry: 'care',
  mistingFrequency: 'care',
  specialNeeds: 'care',
  substrate: 'care',
  substrateMix: 'care',
  soilAdvice: 'care',
  mulchingNeeded: 'care',
  mulchType: 'care',
  mulchAdvice: 'care',
  nutritionNeed: 'care',
  fertilizer: 'care',
  fertilizerAdvice: 'care',

  // Section 4: Growth
  sowingMonth: 'growth',
  floweringMonth: 'growth',
  fruitingMonth: 'growth',
  heightCm: 'growth',
  wingspanCm: 'growth',
  staking: 'growth',
  stakingAdvice: 'growth',
  division: 'growth',
  cultivationMode: 'growth',
  sowingMethod: 'growth',
  transplanting: 'growth',
  transplantingTime: 'growth',
  outdoorPlantingTime: 'growth',
  sowingAdvice: 'growth',
  pruning: 'growth',
  pruningMonth: 'growth',
  pruningAdvice: 'growth',

  // Section 5: Danger
  pests: 'danger',
  diseases: 'danger',

  // Section 6: Ecology
  conservationStatus: 'ecology',
  ecologicalStatus: 'ecology',
  biotopes: 'ecology',
  urbanBiotopes: 'ecology',
  ecologicalTolerance: 'ecology',
  biodiversityRole: 'ecology',
  pollinatorsAttracted: 'ecology',
  birdsAttracted: 'ecology',
  mammalsAttracted: 'ecology',
  beneficialRoles: 'ecology',
  harmfulRoles: 'ecology',
  symbiosis: 'ecology',
  symbiosisNotes: 'ecology',
  ecologicalManagement: 'ecology',
  ecologicalImpact: 'ecology',

  // Section 7: Consumption
  infusion: 'consumption',
  infusionParts: 'consumption',
  infusionBenefits: 'consumption',
  infusionRecipeIdeas: 'consumption',
  medicinal: 'consumption',
  medicinalBenefits: 'consumption',
  medicinalUsage: 'consumption',
  medicinalWarning: 'consumption',
  medicinalHistory: 'consumption',
  nutritionalValue: 'consumption',
  recipes: 'consumption',
  aromatherapy: 'consumption',
  aromatherapyBenefits: 'consumption',
  essentialOilBlends: 'consumption',
  fragrance: 'consumption',
  edibleOil: 'consumption',
  spiceMixes: 'consumption',

  // Section 8: Misc
  companionPlants: 'misc',
  biotopePlants: 'misc',
  beneficialPlants: 'misc',
  harmfulPlants: 'misc',
  varieties: 'misc',
  plantTags: 'misc',
  biodiversityTags: 'misc',
  sources: 'misc',

  // Section 9: Meta
  status: 'meta',
  adminCommentary: 'meta',
  userNotes: 'meta',
  contributors: 'meta',

  // Legacy aliases (map old names to new categories)
  plantType: 'base',
  identity: 'identity',
  plantCare: 'care',
  growth: 'growth',
  usage: 'consumption',
  ecology: 'ecology',
  danger: 'danger',
  miscellaneous: 'misc',
  meta: 'meta',
  description: 'base',
  basics: 'base',
}

export function mapFieldToCategory(fieldKey: string): PlantFormCategory {
  return fieldCategoryMap[fieldKey] || 'base'
}

export type CategoryProgress = Record<
  PlantFormCategory,
  { total: number; completed: number; status: 'idle' | 'filling' | 'done' }
>

export function createEmptyCategoryProgress(): CategoryProgress {
  return plantFormCategoryOrder.reduce<CategoryProgress>((acc, key) => {
    acc[key] = { total: 0, completed: 0, status: 'idle' }
    return acc
  }, {} as CategoryProgress)
}

export function buildCategoryProgress(fieldKeys: string[]): CategoryProgress {
  const progress = createEmptyCategoryProgress()

  for (const key of fieldKeys) {
    const category = mapFieldToCategory(key)
    progress[category] = {
      total: (progress[category]?.total || 0) + 1,
      completed: progress[category]?.completed || 0,
      status: 'filling',
    }
  }

  return progress
}
