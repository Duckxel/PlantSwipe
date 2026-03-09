const isPlainObject = (value) =>
  value !== null &&
  typeof value === 'object' &&
  (value.constructor === Object || Object.getPrototypeOf(value) === Object.prototype)

const sanitizeStringValue = (value) => {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const lower = trimmed.toLowerCase()
  if (lower === 'null' || lower === 'undefined') return undefined
  const stripped = trimmed.replace(/[0.,%\s]/g, '')
  if (stripped.length === 0) return undefined
  return trimmed
}

const sanitizeDeepOld = (value) => {
  if (typeof value === 'string') {
    const sanitized = sanitizeStringValue(value)
    return (sanitized === undefined ? undefined : sanitized)
  }
  if (Array.isArray(value)) {
    const sanitizedArray = value
      .map((item) => sanitizeDeepOld(item))
      .filter((item) => {
        if (item === undefined || item === null) return false
        if (Array.isArray(item) && item.length === 0) return false
        if (isPlainObject(item) && Object.keys(item).length === 0) return false
        return true
      })
    return sanitizedArray
  }
  if (isPlainObject(value)) {
    const result = {}
    for (const [key, entry] of Object.entries(value)) {
      const sanitized = sanitizeDeepOld(entry)
      if (sanitized === undefined || sanitized === null) continue
      if (Array.isArray(sanitized) && sanitized.length === 0) continue
      if (isPlainObject(sanitized) && Object.keys(sanitized).length === 0) continue
      result[key] = sanitized
    }
    return result
  }
  return value
}

const sanitizeDeepNew = (value) => {
  if (typeof value === 'string') {
    const sanitized = sanitizeStringValue(value)
    return (sanitized === undefined ? undefined : sanitized)
  }
  if (Array.isArray(value)) {
    const sanitizedArray = []
    for (let i = 0; i < value.length; i++) {
      const sanitized = sanitizeDeepNew(value[i])
      if (sanitized === undefined || sanitized === null) continue
      if (Array.isArray(sanitized) && sanitized.length === 0) continue

      let empty = false
      if (isPlainObject(sanitized)) {
        empty = true
        for (const _ in sanitized) { empty = false; break; }
      }
      if (empty) continue

      sanitizedArray.push(sanitized)
    }
    return sanitizedArray
  }
  if (isPlainObject(value)) {
    const result = {}
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        const sanitized = sanitizeDeepNew(value[key])
        if (sanitized === undefined || sanitized === null) continue
        if (Array.isArray(sanitized) && sanitized.length === 0) continue

        let empty = false
        if (isPlainObject(sanitized)) {
          empty = true
          for (const _ in sanitized) { empty = false; break; }
        }
        if (empty) continue

        result[key] = sanitized
      }
    }
    return result
  }
  return value
}

const testObj = {
  a: "  ",
  b: ["", "  ", "hello"],
  c: { d: "null", e: "undefined", f: "valid" },
  g: { h: {} },
  i: [ { j: [] }, { k: "foo" } ]
}

console.log(JSON.stringify(sanitizeDeepOld(testObj)))
console.log(JSON.stringify(sanitizeDeepNew(testObj)))

// Benchmark
const generateDeepObject = (depth) => {
  if (depth === 0) return { a: "test", b: ["valid", "invalid", "", null], c: { d: "  " } }
  return {
    val1: generateDeepObject(depth - 1),
    val2: [generateDeepObject(depth - 1), { }, []],
    val3: "   "
  }
}

const data = Array(10).fill(generateDeepObject(5))

console.time("Old")
for (let i=0; i<100; i++) sanitizeDeepOld(data)
console.timeEnd("Old")

console.time("New")
for (let i=0; i<100; i++) sanitizeDeepNew(data)
console.timeEnd("New")
