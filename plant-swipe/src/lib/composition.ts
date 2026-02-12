import type { Plant } from "@/types/plant"

const DB_VALUES = ['flowerbed', 'path', 'hedge', 'ground cover', 'pot'] as const
const UI_VALUES = ['Flowerbed', 'Path', 'Hedge', 'Ground Cover', 'Pot'] as const

export type CompositionDbValue = typeof DB_VALUES[number]
export type CompositionUiValue = typeof UI_VALUES[number]

const DB_VALUE_SET = new Set<string>(DB_VALUES)
const UI_VALUE_SET = new Set<string>(UI_VALUES)

const DB_TO_UI_MAP: Record<CompositionDbValue, CompositionUiValue> = {
  flowerbed: 'Flowerbed',
  path: 'Path',
  hedge: 'Hedge',
  'ground cover': 'Ground Cover',
  pot: 'Pot',
}

const UI_TO_DB_MAP = Object.entries(DB_TO_UI_MAP).reduce(
  (acc, [db, ui]) => {
    acc[ui as CompositionUiValue] = db as CompositionDbValue
    return acc
  },
  {} as Record<CompositionUiValue, CompositionDbValue>,
)

const UI_LOWER_TO_DB_MAP = UI_VALUES.reduce((acc, ui) => {
  acc[ui.toLowerCase()] = UI_TO_DB_MAP[ui]
  return acc
}, {} as Record<string, CompositionDbValue>)

function coerceDbValue(raw?: string | null): CompositionDbValue | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  const lower = trimmed.toLowerCase()
  if (DB_VALUE_SET.has(lower)) {
    return lower as CompositionDbValue
  }
  if (UI_VALUE_SET.has(trimmed)) {
    const mapped = UI_TO_DB_MAP[trimmed as CompositionUiValue]
    return mapped ?? null
  }
  return UI_LOWER_TO_DB_MAP[lower] || null
}

export function normalizeCompositionForDb(values?: string[] | null): CompositionDbValue[] {
  if (!values?.length) return []
  const result: CompositionDbValue[] = []
  for (const raw of values) {
    const dbValue = coerceDbValue(raw)
    if (!dbValue) continue
    if (!result.includes(dbValue)) result.push(dbValue)
  }
  return result
}

export function expandCompositionFromDb(values?: string[] | null): CompositionUiValue[] {
  if (!values?.length) return []
  const result: CompositionUiValue[] = []
  for (const raw of values) {
    // Ensure raw is a string before calling trim() - AI might return objects
    if (typeof raw !== 'string') continue
    const trimmed = raw.trim().toLowerCase()
    if (!trimmed) continue
    const uiValue = DB_TO_UI_MAP[trimmed as CompositionDbValue]
    if (uiValue && !result.includes(uiValue)) {
      result.push(uiValue)
    }
  }
  return result
}

const FOLIAGE_DB_VALUES = ['deciduous', 'evergreen', 'semi-evergreen', 'marcescent'] as const
type FoliageDbValue = typeof FOLIAGE_DB_VALUES[number]
type FoliageUiValue = NonNullable<NonNullable<Plant["identity"]>["foliagePersistance"]>
const FOLIAGE_DB_SET = new Set<string>(FOLIAGE_DB_VALUES)

const FOLIAGE_DB_TO_UI: Record<FoliageDbValue, FoliageUiValue> = {
  deciduous: 'Deciduous',
  evergreen: 'Evergreen',
  'semi-evergreen': 'Semi-Evergreen',
  marcescent: 'Marcescent',
}

const FOLIAGE_UI_TO_DB = Object.entries(FOLIAGE_DB_TO_UI).reduce(
  (acc, [db, ui]) => {
    acc[ui.toLowerCase()] = db as FoliageDbValue
    return acc
  },
  {} as Record<string, FoliageDbValue>,
)

function coerceFoliageDbValue(raw?: string | null): FoliageDbValue | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  const lower = trimmed.toLowerCase()
  if (FOLIAGE_DB_SET.has(lower)) {
    return lower as FoliageDbValue
  }
  return FOLIAGE_UI_TO_DB[lower] || null
}

export function normalizeFoliagePersistanceForDb(value?: string | null): FoliageDbValue | null {
  return coerceFoliageDbValue(value)
}

export function expandFoliagePersistanceFromDb(value?: string | null): FoliageUiValue | undefined {
  const dbValue = coerceFoliageDbValue(value)
  if (!dbValue) return undefined
  return FOLIAGE_DB_TO_UI[dbValue]
}

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

export const plantTypeEnum = createEnumTools([
  { dbValue: 'plant', uiValue: 'plant', aliases: ['herb', 'grass', 'fern', 'vine', 'bulb', 'perennial', 'annual', 'herbaceous', 'foliage', 'groundcover', 'ground cover', 'climber', 'creeper', 'aquatic', 'tropical', 'tropical plant', 'indoor', 'indoor plant', 'outdoor plant', 'ornamental plant', 'herbaceous plant', 'perennial plant', 'annual plant', 'houseplant', 'house plant', 'vegetable', 'vegetables', 'leafy', 'leafy plant', 'moss', 'mosses', 'lichen', 'lichens', 'epiphyte', 'epiphytes'] },
  { dbValue: 'flower', uiValue: 'flower', aliases: ['flowering plant', 'flowering', 'blooming', 'blossom', 'flowers', 'ornamental flower', 'wildflower', 'wild flower'] },
  { dbValue: 'bamboo', uiValue: 'bamboo', aliases: ['bamboos', 'bamboo plant'] },
  { dbValue: 'shrub', uiValue: 'shrub', aliases: ['bush', 'bushes', 'shrubs', 'subshrub', 'sub-shrub', 'woody shrub', 'flowering shrub'] },
  { dbValue: 'tree', uiValue: 'tree', aliases: ['trees', 'palm', 'palms', 'conifer', 'conifers', 'evergreen', 'deciduous', 'evergreen tree', 'deciduous tree', 'fruit tree', 'flowering tree', 'shade tree', 'ornamental tree'] },
  { dbValue: 'cactus', uiValue: 'cactus', aliases: ['cacti', 'cactuses', 'desert plant', 'desert cactus'] },
  { dbValue: 'succulent', uiValue: 'succulent', aliases: ['succulents', 'succulent plant', 'fat plant', 'fat plants'] },
])

export const utilityEnum = createEnumTools([
  { dbValue: 'comestible', uiValue: 'comestible', aliases: ['edible'] },
  { dbValue: 'ornemental', uiValue: 'ornemental', aliases: ['ornamental'] },
  { dbValue: 'produce_fruit', uiValue: 'produce_fruit', aliases: ['produce fruit', 'fruit'] },
  { dbValue: 'aromatic', uiValue: 'aromatic' },
  { dbValue: 'medicinal', uiValue: 'medicinal' },
  { dbValue: 'odorous', uiValue: 'odorous' },
  { dbValue: 'climbing', uiValue: 'climbing' },
  { dbValue: 'cereal', uiValue: 'cereal' },
  { dbValue: 'spice', uiValue: 'spice' },
])

export const comestiblePartEnum = createEnumTools([
  { dbValue: 'flower', uiValue: 'flower', aliases: ['flowers'] },
  { dbValue: 'fruit', uiValue: 'fruit', aliases: ['fruits'] },
  { dbValue: 'seed', uiValue: 'seed', aliases: ['seeds'] },
  { dbValue: 'leaf', uiValue: 'leaf', aliases: ['leaves'] },
  { dbValue: 'stem', uiValue: 'stem', aliases: ['stems'] },
  { dbValue: 'root', uiValue: 'root', aliases: ['roots'] },
  { dbValue: 'bulb', uiValue: 'bulb', aliases: ['bulbs'] },
  { dbValue: 'bark', uiValue: 'bark' },
  { dbValue: 'wood', uiValue: 'wood' },
])

export const fruitTypeEnum = createEnumTools([
  { dbValue: 'nut', uiValue: 'nut', aliases: ['nuts'] },
  { dbValue: 'seed', uiValue: 'seed', aliases: ['seeds'] },
  { dbValue: 'stone', uiValue: 'stone', aliases: ['drupe'] },
])

export const seasonEnum = createEnumTools([
  { dbValue: 'spring', uiValue: 'Spring', aliases: ['spr'] },
  { dbValue: 'summer', uiValue: 'Summer', aliases: ['sum'] },
  { dbValue: 'autumn', uiValue: 'Autumn', aliases: ['fall'] },
  { dbValue: 'winter', uiValue: 'Winter', aliases: ['win'] },
])

export const lifeCycleEnum = createEnumTools([
  { dbValue: 'annual', uiValue: 'Annual', aliases: ['annuals'] },
  { dbValue: 'biennials', uiValue: 'Biennials', aliases: ['biennial', 'biennials'] },
  { dbValue: 'perenials', uiValue: 'Perenials', aliases: ['perennial', 'perennials', 'perrenial', 'perrenials'] },
  { dbValue: 'ephemerals', uiValue: 'Ephemerals', aliases: ['ephemeral'] },
  { dbValue: 'monocarpic', uiValue: 'Monocarpic', aliases: ['monocarp'] },
  { dbValue: 'polycarpic', uiValue: 'Polycarpic', aliases: ['polycarp'] },
])

export const livingSpaceEnum = createEnumTools([
  { dbValue: 'indoor', uiValue: 'Indoor', aliases: ['indoors'] },
  { dbValue: 'outdoor', uiValue: 'Outdoor', aliases: ['outdoors'] },
  { dbValue: 'both', uiValue: 'Both' },
])

export const maintenanceLevelEnum = createEnumTools([
  { dbValue: 'none', uiValue: 'None', aliases: ['no', 'minimal'] },
  { dbValue: 'low', uiValue: 'Low', aliases: ['light'] },
  { dbValue: 'moderate', uiValue: 'Moderate', aliases: ['medium'] },
  { dbValue: 'heavy', uiValue: 'Heavy', aliases: ['high'] },
])

export const toxicityEnum = createEnumTools([
  { dbValue: 'non-toxic', uiValue: 'Non-Toxic', aliases: ['non toxic', 'safe'] },
  { dbValue: 'midly irritating', uiValue: 'Midly Irritating', aliases: ['mildly irritating'] },
  { dbValue: 'highly toxic', uiValue: 'Highly Toxic' },
  { dbValue: 'lethally toxic', uiValue: 'Lethally Toxic', aliases: ['lethal'] },
])

export const habitatEnum = createEnumTools([
  { dbValue: 'aquatic', uiValue: 'Aquatic' },
  { dbValue: 'semi-aquatic', uiValue: 'Semi-Aquatic', aliases: ['semiaquatic'] },
  { dbValue: 'wetland', uiValue: 'Wetland' },
  { dbValue: 'tropical', uiValue: 'Tropical' },
  { dbValue: 'temperate', uiValue: 'Temperate' },
  { dbValue: 'arid', uiValue: 'Arid', aliases: ['desert'] },
  { dbValue: 'mediterranean', uiValue: 'Mediterranean' },
  { dbValue: 'mountain', uiValue: 'Mountain' },
  { dbValue: 'grassland', uiValue: 'Grassland' },
  { dbValue: 'forest', uiValue: 'Forest' },
  { dbValue: 'coastal', uiValue: 'Coastal' },
  { dbValue: 'urban', uiValue: 'Urban' },
])

export const levelSunEnum = createEnumTools([
  { dbValue: 'low light', uiValue: 'Low Light', aliases: ['lowlight'] },
  { dbValue: 'shade', uiValue: 'Shade' },
  { dbValue: 'partial sun', uiValue: 'Partial Sun', aliases: ['partial shade'] },
  { dbValue: 'full sun', uiValue: 'Full Sun', aliases: ['fullsun'] },
])

export const wateringTypeEnum = createEnumTools([
  { dbValue: 'surface', uiValue: 'surface', aliases: ['surface watering'] },
  { dbValue: 'buried', uiValue: 'buried' },
  { dbValue: 'hose', uiValue: 'hose' },
  { dbValue: 'drop', uiValue: 'drop', aliases: ['drip', 'drip line'] },
  { dbValue: 'drench', uiValue: 'drench' },
])

export const divisionEnum = createEnumTools([
  { dbValue: 'seed', uiValue: 'Seed' },
  { dbValue: 'cutting', uiValue: 'Cutting' },
  { dbValue: 'division', uiValue: 'Division' },
  { dbValue: 'layering', uiValue: 'Layering' },
  { dbValue: 'grafting', uiValue: 'Grafting' },
  { dbValue: 'tissue separation', uiValue: 'Tissue Separation', aliases: ['tissue culture'] },
  { dbValue: 'bulb separation', uiValue: 'Bulb separation', aliases: ['bulb division'] },
])

export const soilEnum = createEnumTools([
  { dbValue: 'vermiculite', uiValue: 'Vermiculite' },
  { dbValue: 'perlite', uiValue: 'Perlite' },
  { dbValue: 'sphagnum moss', uiValue: 'Sphagnum moss', aliases: ['sphagnum'] },
  { dbValue: 'rock wool', uiValue: 'rock wool', aliases: ['rockwool'] },
  { dbValue: 'sand', uiValue: 'Sand' },
  { dbValue: 'gravel', uiValue: 'Gravel' },
  { dbValue: 'potting soil', uiValue: 'Potting Soil' },
  { dbValue: 'peat', uiValue: 'Peat' },
  { dbValue: 'clay pebbles', uiValue: 'Clay pebbles', aliases: ['clay pebbles'] },
  { dbValue: 'coconut fiber', uiValue: 'coconut fiber', aliases: ['coconut coir'] },
  { dbValue: 'bark', uiValue: 'Bark' },
  { dbValue: 'wood chips', uiValue: 'Wood Chips' },
])

export const mulchingEnum = createEnumTools([
  { dbValue: 'wood chips', uiValue: 'Wood Chips' },
  { dbValue: 'bark', uiValue: 'Bark' },
  { dbValue: 'green manure', uiValue: 'Green Manure' },
  { dbValue: 'cocoa bean hulls', uiValue: 'Cocoa Bean Hulls' },
  { dbValue: 'buckwheat hulls', uiValue: 'Buckwheat Hulls' },
  { dbValue: 'cereal straw', uiValue: 'Cereal Straw' },
  { dbValue: 'hemp straw', uiValue: 'Hemp Straw' },
  { dbValue: 'woven fabric', uiValue: 'Woven Fabric' },
  { dbValue: 'pozzolana', uiValue: 'Pozzolana' },
  { dbValue: 'crushed slate', uiValue: 'Crushed Slate' },
  { dbValue: 'clay pellets', uiValue: 'Clay Pellets' },
])

export const nutritionNeedEnum = createEnumTools([
  { dbValue: 'nitrogen', uiValue: 'Nitrogen' },
  { dbValue: 'phosphorus', uiValue: 'Phosphorus', aliases: ['phosphorous'] },
  { dbValue: 'potassium', uiValue: 'Potassium' },
  { dbValue: 'calcium', uiValue: 'Calcium' },
  { dbValue: 'magnesium', uiValue: 'Magnesium' },
  { dbValue: 'sulfur', uiValue: 'Sulfur' },
  { dbValue: 'iron', uiValue: 'Iron' },
  { dbValue: 'boron', uiValue: 'Boron' },
  { dbValue: 'manganese', uiValue: 'Manganese' },
  { dbValue: 'molybene', uiValue: 'Molybene', aliases: ['molybdenum'] },
  { dbValue: 'chlorine', uiValue: 'Chlorine' },
  { dbValue: 'copper', uiValue: 'Copper' },
  { dbValue: 'zinc', uiValue: 'Zinc' },
  { dbValue: 'nitrate', uiValue: 'Nitrate' },
  { dbValue: 'phosphate', uiValue: 'Phosphate' },
])

export const fertilizerEnum = createEnumTools([
  { dbValue: 'granular fertilizer', uiValue: 'Granular fertilizer' },
  { dbValue: 'liquid fertilizer', uiValue: 'Liquid Fertilizer' },
  { dbValue: 'meat flour', uiValue: 'Meat Flour' },
  { dbValue: 'fish flour', uiValue: 'Fish flour' },
  { dbValue: 'crushed bones', uiValue: 'Crushed bones' },
  { dbValue: 'crushed horns', uiValue: 'Crushed Horns' },
  { dbValue: 'slurry', uiValue: 'Slurry' },
  { dbValue: 'manure', uiValue: 'Manure' },
  { dbValue: 'animal excrement', uiValue: 'Animal excrement' },
  { dbValue: 'sea fertilizer', uiValue: 'Sea Fertilizer' },
  { dbValue: 'yurals', uiValue: 'Yurals' },
  { dbValue: 'wine', uiValue: 'Wine' },
  { dbValue: 'guano', uiValue: 'guano' },
  { dbValue: 'coffee grounds', uiValue: 'Coffee Grounds' },
  { dbValue: 'banana peel', uiValue: 'Banana peel' },
  { dbValue: 'eggshell', uiValue: 'Eggshell' },
  { dbValue: 'vegetable cooking water', uiValue: 'Vegetable cooking water' },
  { dbValue: 'urine', uiValue: 'Urine' },
  { dbValue: 'grass clippings', uiValue: 'Grass Clippings' },
  { dbValue: 'vegetable waste', uiValue: 'Vegetable Waste' },
  { dbValue: 'natural mulch', uiValue: 'Natural Mulch' },
])

export const sowTypeEnum = createEnumTools([
  { dbValue: 'direct', uiValue: 'Direct' },
  { dbValue: 'indoor', uiValue: 'Indoor' },
  { dbValue: 'row', uiValue: 'Row' },
  { dbValue: 'hill', uiValue: 'Hill' },
  { dbValue: 'broadcast', uiValue: 'Broadcast' },
  { dbValue: 'seed tray', uiValue: 'Seed Tray', aliases: ['seed trays', 'seedtray'] },
  { dbValue: 'cell', uiValue: 'Cell' },
  { dbValue: 'pot', uiValue: 'Pot' },
])

export const polenizerEnum = createEnumTools([
  { dbValue: 'bee', uiValue: 'Bee' },
  { dbValue: 'wasp', uiValue: 'Wasp' },
  { dbValue: 'ant', uiValue: 'Ant' },
  { dbValue: 'butterfly', uiValue: 'Butterfly' },
  { dbValue: 'bird', uiValue: 'Bird' },
  { dbValue: 'mosquito', uiValue: 'Mosquito' },
  { dbValue: 'fly', uiValue: 'Fly' },
  { dbValue: 'beetle', uiValue: 'Beetle' },
  { dbValue: 'ladybug', uiValue: 'ladybug', aliases: ['ladybird'] },
  { dbValue: 'stagbeetle', uiValue: 'Stagbeetle', aliases: ['stag beetle'] },
  { dbValue: 'cockchafer', uiValue: 'Cockchafer' },
  { dbValue: 'dungbeetle', uiValue: 'dungbeetle', aliases: ['dung beetle'] },
  { dbValue: 'weevil', uiValue: 'weevil' },
])

export const conservationStatusEnum = createEnumTools([
  { dbValue: 'safe', uiValue: 'Safe' },
  { dbValue: 'at risk', uiValue: 'At Risk', aliases: ['atrisk'] },
  { dbValue: 'vulnerable', uiValue: 'Vulnerable' },
  { dbValue: 'endangered', uiValue: 'Endangered' },
  { dbValue: 'critically endangered', uiValue: 'Critically Endangered', aliases: ['criticallyendangered'] },
  { dbValue: 'extinct', uiValue: 'Extinct' },
])

export const timePeriodEnum = createEnumTools([
  { dbValue: 'week', uiValue: 'week', aliases: ['weekly', 'per week', 'per-week', 'weeks', 'wk', 'wks'] },
  { dbValue: 'month', uiValue: 'month', aliases: ['monthly', 'per month', 'per-month', 'months', 'mo', 'mos'] },
  { dbValue: 'year', uiValue: 'year', aliases: ['yearly', 'annual', 'annually', 'per year', 'per-year', 'years', 'yr', 'yrs'] },
])

export const recipeCategoryEnum = createEnumTools([
  { dbValue: 'breakfast_brunch', uiValue: 'Breakfast & Brunch', aliases: ['breakfast', 'brunch'] },
  { dbValue: 'starters_appetizers', uiValue: 'Starters & Appetizers', aliases: ['starters', 'appetizers', 'appetizer', 'starter'] },
  { dbValue: 'soups_salads', uiValue: 'Soups & Salads', aliases: ['soups', 'salads', 'soup', 'salad'] },
  { dbValue: 'main_courses', uiValue: 'Main Courses', aliases: ['main course', 'main', 'mains', 'entree', 'entrees'] },
  { dbValue: 'side_dishes', uiValue: 'Side Dishes', aliases: ['side dish', 'sides', 'side'] },
  { dbValue: 'desserts', uiValue: 'Desserts', aliases: ['dessert', 'sweet', 'sweets'] },
  { dbValue: 'drinks', uiValue: 'Drinks', aliases: ['drink', 'beverage', 'beverages'] },
  { dbValue: 'other', uiValue: 'Other' },
])

export const recipeTimeEnum = createEnumTools([
  { dbValue: 'quick', uiValue: 'Quick and Effortless', aliases: ['quick and effortless', 'fast', 'easy', 'quick & effortless'] },
  { dbValue: '30_plus', uiValue: '30+ minutes Meals', aliases: ['30+ minutes', '30 plus', '30min', '30 minutes', 'medium'] },
  { dbValue: 'slow_cooking', uiValue: 'Slow Cooking', aliases: ['slow', 'slow cook', 'long'] },
  { dbValue: 'undefined', uiValue: 'Undefined', aliases: ['unknown', 'n/a', 'na'] },
])
