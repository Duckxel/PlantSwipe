
import { performance } from 'perf_hooks';

// Copying sanitizeDeep and helpers from plantTranslationLoader.ts
const sanitizeStringValue = (value: string): string | undefined => {
  const trimmed = value.trim()
  if (!trimmed) return undefined

  const lower = trimmed.toLowerCase()
  if (lower === 'null' || lower === 'undefined') return undefined

  const stripped = trimmed.replace(/[0.,%\s]/g, '')
  if (stripped.length === 0) return undefined

  return trimmed
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null &&
  typeof value === 'object' &&
  (value.constructor === Object || Object.getPrototypeOf(value) === Object.prototype)

const sanitizeDeep = <T>(value: T): T => {
  if (typeof value === 'string') {
    const sanitized = sanitizeStringValue(value)
    return (sanitized === undefined ? undefined : sanitized) as T
  }

  if (Array.isArray(value)) {
    const sanitizedArray = value
      .map((item) => sanitizeDeep(item))
      .filter((item) => {
        if (item === undefined || item === null) return false
        if (Array.isArray(item) && item.length === 0) return false
        if (isPlainObject(item) && Object.keys(item).length === 0) return false
        return true
      })
    return sanitizedArray as unknown as T
  }

  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value)) {
      const sanitized = sanitizeDeep(entry)
      if (sanitized === undefined || sanitized === null) continue
      if (Array.isArray(sanitized) && sanitized.length === 0) continue
      if (isPlainObject(sanitized) && Object.keys(sanitized).length === 0) continue
      result[key] = sanitized
    }
    return result as T
  }

  return value
}

// Mock Plant Object
const mockPlant = {
  id: "123",
  name: "  Monstera Deliciosa  ",
  identity: {
    scientificName: "Monstera deliciosa",
    family: "Araceae",
    commonNames: ["Swiss Cheese Plant", "Split-leaf Philodendron", ""],
    nullValue: null,
    undefinedValue: undefined,
    emptyString: "   ",
    nestedEmpty: {
       empty: {},
       arr: []
    }
  },
  usage: {
    gardenUses: ["Ornamental", "Indoor"],
    medicinalUses: [],
    culinaryUses: undefined
  },
  ecology: {
     nativeRange: "Tropical forests of southern Mexico",
     wildlifeValue: null
  },
  colors: ["Green", "Variegated"],
  seasons: [], // Empty array, should be removed
  meta: {
    createdAt: "2023-01-01T00:00:00Z",
    updatedAt: "2023-01-02T00:00:00Z"
  }
};

const COUNT = 2000;

console.log("Benchmarking sanitizeDeep with", COUNT, "iterations...");

const start = performance.now();
for (let i = 0; i < COUNT; i++) {
  sanitizeDeep(mockPlant);
}
const end = performance.now();

console.log(`Total time: ${(end - start).toFixed(2)}ms`);
console.log(`Time per item: ${((end - start) / COUNT).toFixed(4)}ms`);

const sanitized = sanitizeDeep(mockPlant);
console.log("Sanitized output keys:", Object.keys(sanitized));
// Check if seasons is removed
console.log("Has seasons?", 'seasons' in sanitized);
