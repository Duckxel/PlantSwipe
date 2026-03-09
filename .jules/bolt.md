
## 2024-11-20 - Fast Deep Object Sanitization in High-Volume Data Fetching
**Learning:** The `sanitizeDeep` function in `plantTranslationLoader.ts` is a critical hot path because it runs on *every* plant object returned from the database before rendering. Using chained `.map().filter()` for arrays and `Object.keys(obj).length === 0` to check for empty plain objects creates significant memory pressure and GC overhead due to constant intermediate array allocations on large deeply nested JSON datasets.
**Action:** Replace functional array chaining with single-pass `for` loops in recursive object sanitizers. Use a `for...in` loop that returns early (e.g. `isEmptyPlainObject`) instead of `Object.keys()` to check if an object is empty without allocating an array of keys.
