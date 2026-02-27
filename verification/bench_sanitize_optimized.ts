
import { performance } from 'perf_hooks';

// Pre-compiled regex for better performance
const STRIP_REGEX = /[0.,%\s]/g

const sanitizeStringValue = (value: string): string | undefined => {
  const trimmed = value.trim()
  if (!trimmed) return undefined

  // Check for literal "null" or "undefined" strings
  if (trimmed.length < 10) { // Optimization: only check short strings
    const lower = trimmed.toLowerCase()
    if (lower === 'null' || lower === 'undefined') return undefined
  }

  // Remove digits, common numeric punctuation, percent symbols, and whitespace
  // If nothing remains, the string only contained placeholder characters like "0", "0.0", "0%" etc.
  const stripped = trimmed.replace(STRIP_REGEX, '')
  if (stripped.length === 0) return undefined

  return trimmed
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null &&
  typeof value === 'object' &&
  (value.constructor === Object || Object.getPrototypeOf(value) === Object.prototype)

// Optimized deep sanitizer that avoids excessive object/array creation
const sanitizeDeep = <T>(value: T): T => {
  if (typeof value === 'string') {
    const sanitized = sanitizeStringValue(value)
    return (sanitized === undefined ? undefined : sanitized) as T
  }

  if (Array.isArray(value)) {
    // Optimization: Use single loop with push instead of map().filter()
    // This avoids iterating twice and creating intermediate arrays
    const result: any[] = []
    for (let i = 0; i < value.length; i++) {
      const sanitized = sanitizeDeep(value[i])
      if (sanitized === undefined || sanitized === null) continue
      if (Array.isArray(sanitized) && sanitized.length === 0) continue
      if (isPlainObject(sanitized)) {
        // Check for empty object without creating keys array if possible
        // using for...in loop is faster than Object.keys(obj).length for just checking emptiness
        let isEmpty = true
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for (const _ in sanitized) {
          isEmpty = false
          break
        }
        if (isEmpty) continue
      }
      result.push(sanitized)
    }
    return result as unknown as T
  }

  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {}
    // Optimization: Use for...in loop instead of Object.entries()
    // This avoids creating an array of [key, value] pairs
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        const sanitized = sanitizeDeep((value as Record<string, unknown>)[key])

        if (sanitized === undefined || sanitized === null) continue
        if (Array.isArray(sanitized) && sanitized.length === 0) continue
        if (isPlainObject(sanitized)) {
           // Check for empty object
           let isEmpty = true
           // eslint-disable-next-line @typescript-eslint/no-unused-vars
           for (const _ in sanitized) {
             isEmpty = false
             break
           }
           if (isEmpty) continue
        }

        result[key] = sanitized
      }
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
