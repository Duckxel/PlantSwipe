import type { Plant } from '@/types/plant'
import type { LogPlantHistoryInput } from '@/lib/plantHistory'

/* eslint-disable @typescript-eslint/no-explicit-any -- dynamic plant field reads */

// Fields we never report in history (noise, or tracked by their own action types).
const IGNORED_FIELDS = new Set<string>([
  'id',
  'updatedBy',
  'updatedTime',
  'createdBy',
  'createdAt',
  'createdTime',
  'meta',
  'adminCommentary', // replaced by plant_admin_notes
  // Nested aggregates already represented by flat fields:
  'identity',
  'plantCare',
  'growth',
  'danger',
  'ecology',
  'usage',
  'miscellaneous',
])

// Human label for field keys. Falls back to a titlecased version of the key.
const FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  scientificNameSpecies: 'Scientific name',
  family: 'Family',
  variety: 'Variety',
  commonNames: 'Common names',
  presentation: 'Presentation',
  featuredMonth: 'Featured months',
  plantType: 'Plant type',
  plantPart: 'Plant part',
  habitat: 'Habitat',
  climate: 'Climate',
  season: 'Season',
  utility: 'Utility',
  vegetable: 'Vegetable',
  ediblePart: 'Edible part',
  thorny: 'Thorny',
  toxicityHuman: 'Toxicity (human)',
  toxicityPets: 'Toxicity (pets)',
  lifeCycle: 'Life cycle',
  averageLifespan: 'Average lifespan',
  foliagePersistence: 'Foliage persistence',
  livingSpace: 'Living space',
  landscaping: 'Landscaping',
  plantHabit: 'Plant habit',
  multicolor: 'Multicolor',
  bicolor: 'Bicolor',
  careLevel: 'Care level',
  sunlight: 'Sunlight',
  temperatureMax: 'Temperature max',
  temperatureMin: 'Temperature min',
  temperatureIdeal: 'Temperature ideal',
  wateringType: 'Watering type',
  hygrometry: 'Hygrometry',
  specialNeeds: 'Special needs',
  substrate: 'Substrate',
  substrateMix: 'Substrate mix',
  mulchingNeeded: 'Mulching needed',
  mulchType: 'Mulch type',
  nutritionNeed: 'Nutrition need',
  fertilizer: 'Fertilizer',
  sowingMonth: 'Sowing months',
  floweringMonth: 'Flowering months',
  fruitingMonth: 'Fruiting months',
  harvestingMonth: 'Harvesting months',
  heightCm: 'Height (cm)',
  wingspanCm: 'Wingspan (cm)',
  separationCm: 'Separation (cm)',
  staking: 'Staking',
  division: 'Division',
  cultivationMode: 'Cultivation mode',
  sowingMethod: 'Sowing method',
  transplanting: 'Transplanting',
  pruning: 'Pruning',
  pruningMonth: 'Pruning months',
  conservationStatus: 'Conservation status',
  ecologicalStatus: 'Ecological status',
  biotopes: 'Biotopes',
  urbanBiotopes: 'Urban biotopes',
  ecologicalTolerance: 'Ecological tolerance',
  biodiversityRole: 'Biodiversity role',
  pollinatorsAttracted: 'Pollinators attracted',
  birdsAttracted: 'Birds attracted',
  mammalsAttracted: 'Mammals attracted',
  ecologicalManagement: 'Ecological management',
  ecologicalImpact: 'Ecological impact',
  infusionParts: 'Infusion parts',
  edibleOil: 'Edible oil',
  companionPlants: 'Companion plants',
  biotopePlants: 'Biotope plants',
  beneficialPlants: 'Beneficial plants',
  harmfulPlants: 'Harmful plants',
  plantTags: 'Plant tags',
  biodiversityTags: 'Biodiversity tags',
  sources: 'Sources',
  contributors: 'Contributors',
  status: 'Status',
  images: 'Images',
  colors: 'Colors',
  wateringSchedules: 'Watering schedules',
  recipes: 'Recipes',
  infusionMixes: 'Infusion mixes',
  origin: 'Origin',
  allergens: 'Allergens',
  poisoningSymptoms: 'Poisoning symptoms',
  soilAdvice: 'Soil advice',
  mulchAdvice: 'Mulch advice',
  fertilizerAdvice: 'Fertilizer advice',
  stakingAdvice: 'Staking advice',
  sowingAdvice: 'Sowing advice',
  transplantingTime: 'Transplanting time',
  outdoorPlantingTime: 'Outdoor planting time',
  pruningAdvice: 'Pruning advice',
  pests: 'Pests',
  diseases: 'Diseases',
  nutritionalValue: 'Nutritional value',
  recipesIdeas: 'Recipes ideas',
  infusionBenefits: 'Infusion benefits',
}

const titleCase = (key: string): string =>
  key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim()

export const labelForField = (key: string): string => FIELD_LABELS[key] ?? titleCase(key)

const normalize = (v: any): any => {
  if (v == null) return null
  if (typeof v === 'string') {
    const t = v.trim()
    return t.length ? t : null
  }
  if (Array.isArray(v)) {
    return v.length ? v.map(normalize) : null
  }
  if (typeof v === 'object') {
    const keys = Object.keys(v).sort()
    if (!keys.length) return null
    const obj: any = {}
    for (const k of keys) {
      const nv = normalize((v as any)[k])
      if (nv !== null && nv !== undefined) obj[k] = nv
    }
    return Object.keys(obj).length ? obj : null
  }
  return v
}

const equal = (a: any, b: any): boolean => {
  const na = normalize(a)
  const nb = normalize(b)
  if (na === nb) return true
  if (na == null || nb == null) return na == null && nb == null
  if (typeof na !== typeof nb) return false
  if (typeof na === 'object') {
    try {
      return JSON.stringify(na) === JSON.stringify(nb)
    } catch {
      return false
    }
  }
  return false
}

const MAX_SNIPPET = 180

const shortRepr = (v: any): string | null => {
  const n = normalize(v)
  if (n == null) return null
  let s: string
  if (typeof n === 'string') s = n
  else if (Array.isArray(n)) s = n.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(', ')
  else if (typeof n === 'object') {
    try { s = JSON.stringify(n) } catch { s = String(n) }
  } else s = String(n)
  if (s.length > MAX_SNIPPET) return s.slice(0, MAX_SNIPPET - 1) + '…'
  return s
}

export interface DiffActor {
  authorId?: string | null
  authorName?: string | null
}

/**
 * Build history entries for every field that changed between oldPlant and newPlant.
 * Entries are NOT written to the DB here — caller should pass them to logPlantHistoryBatch.
 */
export function buildPlantFieldDiff(
  plantId: string,
  oldPlant: Plant | null | undefined,
  newPlant: Plant,
  actor: DiffActor,
  extraIgnored: Iterable<string> = [],
): LogPlantHistoryInput[] {
  const ignored = new Set([...IGNORED_FIELDS, ...extraIgnored])
  const result: LogPlantHistoryInput[] = []
  const keys = new Set<string>([
    ...Object.keys(oldPlant || {}),
    ...Object.keys(newPlant || {}),
  ])
  for (const key of keys) {
    if (ignored.has(key)) continue
    const before = (oldPlant as any)?.[key]
    const after = (newPlant as any)?.[key]
    if (equal(before, after)) continue
    const label = labelForField(key)
    const action = key === 'status' ? 'status_change' : 'field_change'
    result.push({
      plantId,
      authorId: actor.authorId ?? null,
      authorName: actor.authorName ?? null,
      action,
      field: key,
      summary: `Changed ${label}`,
      oldValue: shortRepr(before),
      newValue: shortRepr(after),
    })
  }
  return result
}
