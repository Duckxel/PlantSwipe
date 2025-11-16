import type {
  PlantActivityValue,
  PlantClassification,
  PlantSubActivityValue,
  PlantSubSubclassValue,
  PlantSubclassValue,
  PlantTypeValue,
} from "@/types/plant"

export const PLANT_TYPE_OPTIONS: PlantTypeValue[] = ["plant", "bambu", "shrub", "tree", "other"]

export const PLANT_SUBCLASS_OPTIONS: Record<PlantTypeValue, PlantSubclassValue[]> = {
  plant: ["flower", "vegetable", "cereal", "spice"],
  bambu: [],
  shrub: [],
  tree: [],
  other: [],
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
    const hasEntries = Object.values(value).some((entry) => {
      if (Array.isArray(entry)) {
        return entry.length > 0
      }
      return entry !== undefined && entry !== null && String(entry).trim().length > 0
    })
    return hasEntries ? value : undefined
  }
  if (typeof value === "string" && value.trim().length === 0) {
    return undefined
  }
  return value
}

export function hasClassificationData(classification?: PlantClassification | null): boolean {
  if (!classification) return false
  return Object.keys(classification).some((key) => {
    const typedKey = key as keyof PlantClassification
    return normalizeClassificationValue(classification, typedKey) !== undefined
  })
}

export function formatClassificationLabel(value?: string | null): string {
  if (!value) return ""
  return value
    .split(/\s+/)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ")
}
