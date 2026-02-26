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
  wateringMode: 'care',
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
  separationCm: 'growth',
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
  infusionParts: 'consumption',
  infusionBenefits: 'consumption',
  infusionRecipeIdeas: 'consumption',
  medicinalBenefits: 'consumption',
  medicinalUsage: 'consumption',
  medicinalWarning: 'consumption',
  medicinalHistory: 'consumption',
  nutritionalValue: 'consumption',
  recipes: 'consumption',
  aromatherapyBenefits: 'consumption',
  essentialOilBlends: 'consumption',
  edibleOil: 'consumption',
  spiceMixes: 'consumption',

  // Section 8: Misc
  companionPlants: 'misc',
  biotopePlants: 'misc',
  beneficialPlants: 'misc',
  harmfulPlants: 'misc',
  plantTags: 'misc',
  biodiversityTags: 'misc',
  sources: 'misc',

  // Section 9: Meta
  status: 'meta',
  adminCommentary: 'meta',
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

/**
 * Map of boolean gate fields → their dependent fields.
 * When a gate is `false`, dependent fields should be hidden in the form
 * and skipped during AI fill.
 */
export const BOOLEAN_GATE_DEPS: Record<string, string[]> = {
  // Care section
  mulchingNeeded: ['mulchType', 'mulchAdvice'],
  // Growth section
  staking: ['stakingAdvice'],
  transplanting: ['transplantingTime', 'outdoorPlantingTime'],
  pruning: ['pruningMonth', 'pruningAdvice'],
}

/**
 * Map of utility enum values (DB format) → dependent fields.
 * When the utility array does NOT include the value, dependent fields are hidden.
 */
export const UTILITY_GATE_DEPS: Record<string, string[]> = {
  infusion: ['infusionParts', 'infusionBenefits', 'infusionRecipeIdeas', 'infusionMixes'],
  medicinal: ['medicinalBenefits', 'medicinalUsage', 'medicinalWarning', 'medicinalHistory'],
  aromatic: ['aromatherapyBenefits', 'essentialOilBlends'],
}

/** Reverse lookup: dependent field → its boolean gate field */
const _gateForField: Record<string, string> = {}
for (const [gate, deps] of Object.entries(BOOLEAN_GATE_DEPS)) {
  for (const dep of deps) _gateForField[dep] = gate
}

/** Reverse lookup: dependent field → its utility gate value (DB format) */
const _utilityGateForField: Record<string, string> = {}
for (const [utilVal, deps] of Object.entries(UTILITY_GATE_DEPS)) {
  for (const dep of deps) _utilityGateForField[dep] = utilVal
}

/** Return the gate field key that guards this field, or undefined if ungated */
export function getGateForField(fieldKey: string): string | undefined {
  return _gateForField[fieldKey] || (_utilityGateForField[fieldKey] ? 'utility' : undefined)
}

/** Check whether a field is gated off (its boolean gate is false or utility value is missing) */
export function isFieldGatedOff(plant: Record<string, unknown>, fieldKey: string): boolean {
  // Boolean gate check
  const boolGate = _gateForField[fieldKey]
  if (boolGate) return plant[boolGate] === false

  // Utility-based gate check
  const utilGate = _utilityGateForField[fieldKey]
  if (utilGate) {
    const utility = plant.utility
    if (!Array.isArray(utility)) return true
    const needle = utilGate.toLowerCase().replace(/[_\s-]/g, '')
    return !(utility as string[]).some(u =>
      typeof u === 'string' && u.toLowerCase().replace(/[_\s-]/g, '') === needle
    )
  }

  return false
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
