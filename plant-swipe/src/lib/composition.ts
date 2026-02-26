// ============================================================================
// Enum tools for plant fields — maps DB values ↔ UI labels
// Updated for new DB schema (Feb 2026)
// ============================================================================

type EnumConfig = {
  dbValue: string
  uiValue: string
  aliases?: readonly string[]
}

export interface EnumTools {
  readonly dbValues: readonly string[]
  readonly uiValues: readonly string[]
  toDb(value: unknown): string | null
  toUi(value: unknown): string | undefined
  toDbArray(value: unknown): string[]
  toUiArray(value: unknown): string[]
}

const canonicalize = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase()

function toArrayInput(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[]
  if (typeof value === 'string') {
    return value
      .split(/[,;/]+/)
      .map((entry) => entry.trim())
      .filter(Boolean)
  }
  return []
}

function createEnumTools(configs: readonly EnumConfig[]): EnumTools {
  const dbToUi = new Map<string, string>()
  const canonicalToDb = new Map<string, string>()
  configs.forEach(({ dbValue, uiValue, aliases }) => {
    dbToUi.set(dbValue, uiValue)
    canonicalToDb.set(canonicalize(dbValue), dbValue)
    canonicalToDb.set(canonicalize(uiValue), dbValue)
    aliases?.forEach((alias) => canonicalToDb.set(canonicalize(alias), dbValue))
  })

  const toDb = (value: unknown): string | null => {
    if (typeof value !== 'string') return null
    return canonicalToDb.get(canonicalize(value)) || null
  }

  const toUi = (value: unknown): string | undefined => {
    if (typeof value !== 'string') return undefined
    const dbValue = canonicalToDb.get(canonicalize(value))
    if (!dbValue) return undefined
    return dbToUi.get(dbValue)
  }

  const toDbArray = (value: unknown): string[] => {
    const candidates = toArrayInput(value)
    const result: string[] = []
    candidates.forEach((entry) => {
      const normalized = toDb(entry)
      if (normalized && !result.includes(normalized)) result.push(normalized)
    })
    return result
  }

  const toUiArray = (value: unknown): string[] => {
    const candidates = toArrayInput(value)
    const result: string[] = []
    candidates.forEach((entry) => {
      const normalized = toUi(entry)
      if (normalized && !result.includes(normalized)) result.push(normalized)
    })
    return result
  }

  return {
    dbValues: configs.map((item) => item.dbValue),
    uiValues: configs.map((item) => item.uiValue),
    toDb,
    toUi,
    toDbArray,
    toUiArray,
  }
}

// -- Section 2: Identity ------------------------------------------------------

export const utilityEnum = createEnumTools([
  { dbValue: 'edible', uiValue: 'Edible', aliases: ['comestible', 'food'] },
  { dbValue: 'ornamental', uiValue: 'Ornamental', aliases: ['ornemental', 'decorative'] },
  { dbValue: 'aromatic', uiValue: 'Aromatic' },
  { dbValue: 'medicinal', uiValue: 'Medicinal' },
  { dbValue: 'fragrant', uiValue: 'Fragrant', aliases: ['odorous', 'scented'] },
  { dbValue: 'cereal', uiValue: 'Cereal', aliases: ['grain'] },
  { dbValue: 'spice', uiValue: 'Spice', aliases: ['spices'] },
])

export const ediblePartEnum = createEnumTools([
  { dbValue: 'flower', uiValue: 'Flower', aliases: ['flowers'] },
  { dbValue: 'fruit', uiValue: 'Fruit', aliases: ['fruits'] },
  { dbValue: 'seed', uiValue: 'Seed', aliases: ['seeds'] },
  { dbValue: 'leaf', uiValue: 'Leaf', aliases: ['leaves'] },
  { dbValue: 'stem', uiValue: 'Stem', aliases: ['stems'] },
  { dbValue: 'bulb', uiValue: 'Bulb', aliases: ['bulbs'] },
  { dbValue: 'rhizome', uiValue: 'Rhizome', aliases: ['rhizomes', 'root', 'roots'] },
  { dbValue: 'bark', uiValue: 'Bark' },
  { dbValue: 'wood', uiValue: 'Wood' },
])

export const toxicityEnum = createEnumTools([
  { dbValue: 'non_toxic', uiValue: 'Non-Toxic', aliases: ['non-toxic', 'nontoxic', 'safe'] },
  { dbValue: 'slightly_toxic', uiValue: 'Slightly Toxic', aliases: ['midly irritating', 'mildly irritating', 'mild'] },
  { dbValue: 'very_toxic', uiValue: 'Very Toxic', aliases: ['highly toxic', 'toxic'] },
  { dbValue: 'deadly', uiValue: 'Deadly', aliases: ['lethally toxic', 'lethal', 'fatal'] },
  { dbValue: 'undetermined', uiValue: 'Undetermined', aliases: ['unknown', 'not determined'] },
])

export const poisoningMethodEnum = createEnumTools([
  { dbValue: 'touch', uiValue: 'Touch', aliases: ['contact', 'skin contact'] },
  { dbValue: 'ingestion', uiValue: 'Ingestion', aliases: ['eating', 'swallowing'] },
  { dbValue: 'eye_contact', uiValue: 'Eye Contact', aliases: ['eyes'] },
  { dbValue: 'inhalation', uiValue: 'Inhalation', aliases: ['breathing', 'inhale'] },
  { dbValue: 'sap_contact', uiValue: 'Sap Contact', aliases: ['sap'] },
])

export const lifeCycleEnum = createEnumTools([
  { dbValue: 'annual', uiValue: 'Annual', aliases: ['annuals'] },
  { dbValue: 'biennial', uiValue: 'Biennial', aliases: ['biennials'] },
  { dbValue: 'perennial', uiValue: 'Perennial', aliases: ['perennials', 'perenials'] },
  { dbValue: 'succulent_perennial', uiValue: 'Succulent Perennial' },
  { dbValue: 'monocarpic', uiValue: 'Monocarpic' },
  { dbValue: 'short_cycle', uiValue: 'Short Cycle', aliases: ['fast growing'] },
  { dbValue: 'ephemeral', uiValue: 'Ephemeral', aliases: ['ephemerals'] },
])

export const averageLifespanEnum = createEnumTools([
  { dbValue: 'less_than_1_year', uiValue: 'Less than 1 year', aliases: ['< 1 year'] },
  { dbValue: '2_years', uiValue: '2 years' },
  { dbValue: '3_to_10_years', uiValue: '3–10 years', aliases: ['3 to 10 years'] },
  { dbValue: '10_to_50_years', uiValue: '10–50 years', aliases: ['10 to 50 years'] },
  { dbValue: 'over_50_years', uiValue: '50+ years', aliases: ['over 50 years'] },
])

export const foliagePersistenceEnum = createEnumTools([
  { dbValue: 'deciduous', uiValue: 'Deciduous' },
  { dbValue: 'evergreen', uiValue: 'Evergreen' },
  { dbValue: 'semi_evergreen', uiValue: 'Semi-Evergreen', aliases: ['semi-evergreen', 'semievergreen'] },
  { dbValue: 'marcescent', uiValue: 'Marcescent' },
  { dbValue: 'winter_dormant', uiValue: 'Winter Dormant', aliases: ['dormant in winter'] },
  { dbValue: 'dry_season_deciduous', uiValue: 'Dry Season Deciduous' },
])

export const livingSpaceEnum = createEnumTools([
  { dbValue: 'indoor', uiValue: 'Indoor', aliases: ['indoors'] },
  { dbValue: 'outdoor', uiValue: 'Outdoor', aliases: ['outdoors'] },
  { dbValue: 'both', uiValue: 'Both', aliases: ['indoor/outdoor'] },
  { dbValue: 'terrarium', uiValue: 'Terrarium' },
  { dbValue: 'greenhouse', uiValue: 'Greenhouse', aliases: ['glasshouse'] },
])

export const seasonEnum = createEnumTools([
  { dbValue: 'spring', uiValue: 'Spring', aliases: ['spr'] },
  { dbValue: 'summer', uiValue: 'Summer', aliases: ['sum'] },
  { dbValue: 'autumn', uiValue: 'Autumn', aliases: ['fall'] },
  { dbValue: 'winter', uiValue: 'Winter', aliases: ['win'] },
])

export const climateEnum = createEnumTools([
  { dbValue: 'polar', uiValue: 'Polar' },
  { dbValue: 'montane', uiValue: 'Montane', aliases: ['mountain'] },
  { dbValue: 'oceanic', uiValue: 'Oceanic' },
  { dbValue: 'degraded_oceanic', uiValue: 'Degraded Oceanic' },
  { dbValue: 'temperate_continental', uiValue: 'Temperate Continental', aliases: ['temperate'] },
  { dbValue: 'mediterranean', uiValue: 'Mediterranean' },
  { dbValue: 'tropical_dry', uiValue: 'Tropical Dry', aliases: ['arid'] },
  { dbValue: 'tropical_humid', uiValue: 'Tropical Humid', aliases: ['tropical'] },
  { dbValue: 'tropical_volcanic', uiValue: 'Tropical Volcanic' },
  { dbValue: 'tropical_cyclonic', uiValue: 'Tropical Cyclonic' },
  { dbValue: 'humid_insular', uiValue: 'Humid Insular' },
  { dbValue: 'subtropical_humid', uiValue: 'Subtropical Humid' },
  { dbValue: 'equatorial', uiValue: 'Equatorial' },
  { dbValue: 'windswept_coastal', uiValue: 'Windswept Coastal', aliases: ['coastal'] },
])

// -- Section 3: Care ----------------------------------------------------------

export const careLevelEnum = createEnumTools([
  { dbValue: 'easy', uiValue: 'Easy', aliases: ['none', 'low', 'minimal', 'beginner'] },
  { dbValue: 'moderate', uiValue: 'Moderate', aliases: ['medium', 'intermediate'] },
  { dbValue: 'complex', uiValue: 'Complex', aliases: ['heavy', 'high', 'advanced', 'expert'] },
])

export const sunlightEnum = createEnumTools([
  { dbValue: 'full_sun', uiValue: 'Full Sun', aliases: ['fullsun'] },
  { dbValue: 'partial_sun', uiValue: 'Partial Sun' },
  { dbValue: 'partial_shade', uiValue: 'Partial Shade', aliases: ['semi-shade'] },
  { dbValue: 'light_shade', uiValue: 'Light Shade' },
  { dbValue: 'deep_shade', uiValue: 'Deep Shade', aliases: ['shade', 'full shade'] },
  { dbValue: 'direct_light', uiValue: 'Direct Light', aliases: ['direct'] },
  { dbValue: 'bright_indirect_light', uiValue: 'Bright Indirect Light', aliases: ['bright indirect'] },
  { dbValue: 'medium_light', uiValue: 'Medium Light', aliases: ['low light'] },
  { dbValue: 'low_light', uiValue: 'Low Light' },
])

export const wateringTypeEnum = createEnumTools([
  { dbValue: 'hose', uiValue: 'Hose', aliases: ['hosepipe'] },
  { dbValue: 'surface', uiValue: 'Surface', aliases: ['surface watering', 'top watering'] },
  { dbValue: 'drip', uiValue: 'Drip', aliases: ['drop', 'drip line', 'drip irrigation'] },
  { dbValue: 'soaking', uiValue: 'Soaking', aliases: ['drench', 'drenching', 'bottom watering'] },
  { dbValue: 'wick', uiValue: 'Wick', aliases: ['wick watering', 'hoya'] },
])

// -- Section 4: Growth --------------------------------------------------------

export const divisionEnum = createEnumTools([
  { dbValue: 'seed', uiValue: 'Seed', aliases: ['seeds', 'sowing'] },
  { dbValue: 'clump_division', uiValue: 'Clump Division', aliases: ['division', 'tissue separation'] },
  { dbValue: 'bulb_division', uiValue: 'Bulb Division', aliases: ['bulb separation'] },
  { dbValue: 'rhizome_division', uiValue: 'Rhizome Division' },
  { dbValue: 'cutting', uiValue: 'Cutting', aliases: ['cuttings', 'stem cutting'] },
  { dbValue: 'layering', uiValue: 'Layering', aliases: ['air layering'] },
  { dbValue: 'stolon', uiValue: 'Stolon', aliases: ['stolons', 'runner', 'runners'] },
  { dbValue: 'sucker', uiValue: 'Sucker', aliases: ['suckers', 'offshoot'] },
  { dbValue: 'grafting', uiValue: 'Grafting', aliases: ['graft'] },
  { dbValue: 'spore', uiValue: 'Spore', aliases: ['spores'] },
])

export const sowingMethodEnum = createEnumTools([
  { dbValue: 'open_ground', uiValue: 'Open Ground', aliases: ['direct', 'direct sowing'] },
  { dbValue: 'pot', uiValue: 'Pot', aliases: ['container'] },
  { dbValue: 'tray', uiValue: 'Tray', aliases: ['seed tray', 'cell', 'plug tray'] },
  { dbValue: 'greenhouse', uiValue: 'Greenhouse', aliases: ['indoor', 'under cover'] },
  { dbValue: 'mini_greenhouse', uiValue: 'Mini Greenhouse', aliases: ['propagator'] },
  { dbValue: 'broadcast', uiValue: 'Broadcast', aliases: ['scatter'] },
  { dbValue: 'row', uiValue: 'Row', aliases: ['in rows', 'drill'] },
])

// -- Section 6: Ecology -------------------------------------------------------

export const conservationStatusEnum = createEnumTools([
  { dbValue: 'least_concern', uiValue: 'Least Concern', aliases: ['safe', 'lc'] },
  { dbValue: 'near_threatened', uiValue: 'Near Threatened', aliases: ['at risk', 'nt'] },
  { dbValue: 'vulnerable', uiValue: 'Vulnerable', aliases: ['vu'] },
  { dbValue: 'endangered', uiValue: 'Endangered', aliases: ['en'] },
  { dbValue: 'critically_endangered', uiValue: 'Critically Endangered', aliases: ['critically endangered', 'cr'] },
  { dbValue: 'extinct_in_wild', uiValue: 'Extinct in Wild', aliases: ['ew'] },
  { dbValue: 'extinct', uiValue: 'Extinct', aliases: ['ex'] },
  { dbValue: 'data_deficient', uiValue: 'Data Deficient', aliases: ['dd'] },
  { dbValue: 'not_evaluated', uiValue: 'Not Evaluated', aliases: ['ne'] },
])

export const ecologicalToleranceEnum = createEnumTools([
  { dbValue: 'drought', uiValue: 'Drought', aliases: ['drought tolerant'] },
  { dbValue: 'scorching_sun', uiValue: 'Scorching Sun', aliases: ['intense sun'] },
  { dbValue: 'permanent_shade', uiValue: 'Permanent Shade', aliases: ['deep shade'] },
  { dbValue: 'excess_water', uiValue: 'Excess Water', aliases: ['waterlogging', 'flooding'] },
  { dbValue: 'frost', uiValue: 'Frost', aliases: ['frost tolerant', 'cold hardy'] },
  { dbValue: 'heatwave', uiValue: 'Heatwave', aliases: ['heat tolerant'] },
  { dbValue: 'wind', uiValue: 'Wind', aliases: ['wind tolerant', 'exposed'] },
])

export const ecologicalImpactEnum = createEnumTools([
  { dbValue: 'neutral', uiValue: 'Neutral' },
  { dbValue: 'favorable', uiValue: 'Favorable', aliases: ['positive', 'beneficial'] },
  { dbValue: 'potentially_invasive', uiValue: 'Potentially Invasive', aliases: ['potentially invasive'] },
  { dbValue: 'locally_invasive', uiValue: 'Locally Invasive', aliases: ['invasive'] },
])

// -- Shared -------------------------------------------------------------------

export const timePeriodEnum = createEnumTools([
  { dbValue: 'week', uiValue: 'week', aliases: ['weekly', 'per week', 'weeks', 'wk'] },
  { dbValue: 'month', uiValue: 'month', aliases: ['monthly', 'per month', 'months', 'mo'] },
  { dbValue: 'year', uiValue: 'year', aliases: ['yearly', 'annual', 'per year', 'years', 'yr'] },
])

export const recipeCategoryEnum = createEnumTools([
  { dbValue: 'breakfast_brunch', uiValue: 'Breakfast & Brunch', aliases: ['breakfast', 'brunch'] },
  { dbValue: 'starters_appetizers', uiValue: 'Starters & Appetizers', aliases: ['starters', 'appetizers'] },
  { dbValue: 'soups_salads', uiValue: 'Soups & Salads', aliases: ['soups', 'salads', 'soup', 'salad'] },
  { dbValue: 'main_courses', uiValue: 'Main Courses', aliases: ['main course', 'main', 'entree'] },
  { dbValue: 'side_dishes', uiValue: 'Side Dishes', aliases: ['side dish', 'sides'] },
  { dbValue: 'desserts', uiValue: 'Desserts', aliases: ['dessert', 'sweet'] },
  { dbValue: 'drinks', uiValue: 'Drinks', aliases: ['drink', 'beverage'] },
  { dbValue: 'other', uiValue: 'Other' },
])

export const recipeTimeEnum = createEnumTools([
  { dbValue: 'quick', uiValue: 'Quick and Effortless', aliases: ['quick and effortless', 'fast', 'easy'] },
  { dbValue: '30_plus', uiValue: '30+ minutes Meals', aliases: ['30+ minutes', '30 plus', '30min'] },
  { dbValue: 'slow_cooking', uiValue: 'Slow Cooking', aliases: ['slow', 'slow cook'] },
  { dbValue: 'undefined', uiValue: 'Undefined', aliases: ['unknown', 'n/a'] },
])

// ============================================================================
// Legacy aliases — old names still imported by existing code
// ============================================================================

/** @deprecated Use ediblePartEnum */
export const comestiblePartEnum = ediblePartEnum
/** @deprecated Use foliagePersistenceEnum */
export const foliagePersistanceEnum = foliagePersistenceEnum
/** @deprecated Removed in new schema */
export const fruitTypeEnum = createEnumTools([
  { dbValue: 'nut', uiValue: 'nut' },
  { dbValue: 'seed', uiValue: 'seed' },
  { dbValue: 'stone', uiValue: 'stone' },
])
/** @deprecated Use climateEnum */
export const habitatEnum = climateEnum
/** @deprecated Use sunlightEnum */
export const levelSunEnum = sunlightEnum
/** @deprecated Use careLevelEnum */
export const maintenanceLevelEnum = careLevelEnum
/** @deprecated Use ediblePartEnum */
export const soilEnum = createEnumTools([]) // substrate is now free-form
/** @deprecated Use mulchType (no enum, free-form) */
export const mulchingEnum = createEnumTools([])
/** @deprecated Removed - now free-form */
export const nutritionNeedEnum = createEnumTools([])
/** @deprecated Removed - now free-form */
export const fertilizerEnum = createEnumTools([])
/** @deprecated Use sowingMethodEnum */
export const sowTypeEnum = sowingMethodEnum
/** @deprecated Replaced by pollinatorsAttracted (free-form) */
export const polenizerEnum = createEnumTools([])

// Legacy composition helpers — kept for backward compatibility
export type CompositionDbValue = string
export type CompositionUiValue = string

export function normalizeCompositionForDb(values?: string[] | null): string[] {
  if (!values?.length) return []
  return values.map(v => v.toLowerCase().replace(/\s+/g, '_')).filter(Boolean)
}

export function expandCompositionFromDb(values?: string[] | null): string[] {
  if (!values?.length) return []
  return values
}

export function normalizeFoliagePersistanceForDb(value?: string | null): string | null {
  if (!value) return null
  return foliagePersistenceEnum.toDb(value)
}

export function expandFoliagePersistanceFromDb(value?: string | null): string | undefined {
  if (!value) return undefined
  return foliagePersistenceEnum.toUi(value)
}
