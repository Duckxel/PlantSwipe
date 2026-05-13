import type {
  PlantActivityValue,
  PlantClassification,
  PlantSubActivityValue,
  PlantSubSubclassValue,
  PlantSubclassValue,
  PlantTypeValue,
} from "@/types/plant"

export const PLANT_TYPE_OPTIONS: PlantTypeValue[] = ["herb", "shrub", "tree", "climber", "succulent", "fern", "moss", "grass"]

export const PLANT_SUBCLASS_OPTIONS: Record<PlantTypeValue, PlantSubclassValue[]> = {
  herb: ["flower", "vegetable", "cereal", "spice"],
  shrub: [],
  tree: [],
  climber: [],
  succulent: [],
  fern: [],
  moss: [],
  grass: [],
}

export const PLANT_SUBSUBCLASS_OPTIONS: Record<PlantSubclassValue, PlantSubSubclassValue[]> = {
  flower: [],
  vegetable: ["fruit", "seed", "root", "leaf", "flower"],
  cereal: [],
  spice: [],
}

export const PLANT_ACTIVITY_OPTIONS: PlantActivityValue[] = ["ornemental", "comestible", "aromatic", "medicinal"]

export const PLANT_SUBACTIVITY_OPTIONS: Record<PlantActivityValue, PlantSubActivityValue[]> = {
  ornemental: ["climbing", "hedge", "massif", "ground cover"],
  comestible: ["seed", "hull", "core"],
  aromatic: [],
  medicinal: [],
}

export function normalizeClassificationValue<T extends keyof PlantClassification>(
  classification: PlantClassification | undefined,
  key: T
): PlantClassification[T] | undefined {
  if (!classification) return undefined
  const value = classification[key]
  if (value === undefined || value === null) return undefined
  if (Array.isArray(value) && value.length === 0) return undefined
  if (typeof value === "object" && !Array.isArray(value)) {
    // ⚡ Bolt: Replace Object.values().some() with a for...in loop to avoid intermediate array allocation
    let hasEntries = false
    for (const k in value) {
      const entry = (value as Record<string, unknown>)[k]
      if (Array.isArray(entry)) {
        if (entry.length > 0) {
          hasEntries = true
          break
        }
      } else if (entry !== undefined && entry !== null && String(entry).trim().length > 0) {
        hasEntries = true
        break
      }
    }
    return hasEntries ? value : undefined
  }
  if (typeof value === "string" && value.trim().length === 0) {
    return undefined
  }
  return value
}

export function hasClassificationData(classification?: PlantClassification | null): boolean {
  if (!classification) return false
  // ⚡ Bolt: Replace Object.keys().some() with a for...in loop to avoid intermediate array allocation
  for (const key in classification) {
    const typedKey = key as keyof PlantClassification
    if (normalizeClassificationValue(classification, typedKey) !== undefined) {
      return true
    }
  }
  return false
}

export function formatClassificationLabel(value?: string | null): string {
  if (!value) return ""
  return value
    .split(/\s+/)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ")
}
