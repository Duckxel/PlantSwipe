
## 2024-11-20 - Fast Deep Object Sanitization in High-Volume Data Fetching
**Learning:** The `sanitizeDeep` function in `plantTranslationLoader.ts` is a critical hot path because it runs on *every* plant object returned from the database before rendering. Using chained `.map().filter()` for arrays and `Object.keys(obj).length === 0` to check for empty plain objects creates significant memory pressure and GC overhead due to constant intermediate array allocations on large deeply nested JSON datasets.
**Action:** Replace functional array chaining with single-pass `for` loops in recursive object sanitizers. Use a `for...in` loop that returns early (e.g. `isEmptyPlainObject`) instead of `Object.keys()` to check if an object is empty without allocating an array of keys.

## 2026-02-23 - Avoid intermediate allocations with map/filter chains in data loading loops
**Learning:** Chaining `.map().filter()` or `.filter().map()` creates intermediate arrays and forces multiple iterations. In hot paths like `loadPlantsWithTranslations`, `loadPlantPreviews`, and `preparedPlants` mapping (which run on hundreds or thousands of elements), these allocations compound and create unnecessary garbage collection pressure and slower processing.
**Action:** Replace map/filter chains with single-pass `for` loops that push to a pre-allocated array in data processing loops.

## 2026-03-01 - Optimizing chained array allocations in components
**Learning:** Chaining `.map().filter()` or `.split().filter()` within hot loops or frequently re-rendered components (e.g., inside `preparedPlants` memo or `SwipePage` rendering) creates multiple intermediate arrays, compounding garbage collection overhead.
**Action:** Replace map/filter chains and split/filter chains with single-pass `for` loops in hot data preparation and render paths to avoid intermediate array allocation and improve performance.

## 2026-03-02 - Eliminate array allocations in Map initialization for hot paths
**Learning:** Initializing a `Map` using `new Map(array.map(item => [key, value]))` creates a massive amount of garbage collection pressure on large collections because it allocates an intermediate array *and* a 2-element tuple array `[key, value]` for every single item in the original array.
**Action:** Replace `new Map(array.map(...))` in hot paths or large data transformations with an empty `Map` initialization followed by a single-pass `for` loop that calls `.set()`.
