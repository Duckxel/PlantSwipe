
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

## 2026-03-25 - Optimize swipeList generation to reduce GC overhead
**Learning:** In `swipeList` generation, chained `.map().filter()` calls and `new Map(array.map(p => [p.id, p]))` created significant garbage collection pressure on each render cycle. These patterns allocate multiple intermediate arrays that are immediately discarded.
**Action:** Replace chained `.map().filter()` with single-pass `for` loops and replace `new Map(array.map(...))` with loop-based `.set()` initialization in frequently re-rendered list generation code.

## 2026-03-29 - Pre-allocate arrays in discovery scoring hot paths
**Learning:** In `scoreDiscoveryPlants` (in `discoveryScoring.ts`), functional `.map()` operations on scoring arrays created intermediate allocations on every scoring pass. For large plant collections this compounds into measurable GC pauses.
**Action:** Replace `.map()` with pre-allocated arrays and index-based `for` loops in scoring functions that run on every discovery feed refresh.
## 2025-03-09 - Pitfalls of Overzealous Primitive Fast-Paths
**Learning:** In deeply recursive data parsers like `sanitizeDeep` (handling translations/JSON payloads), adding an early return for primitives (`null`, `number`, `boolean`) actually creates a pessimization. Because the payload consists almost entirely of strings, objects, and arrays, these extra `typeof` checks evaluate true rarely, adding useless branch overhead to the hot paths.
**Action:** Before adding fast-paths to hot loops, consider the shape of the data. Only add fast-paths if the targeted data type makes up a statistically significant portion of the inputs.

## 2025-03-09 - Optimizing Set Initializations in Hooks
**Learning:** Initializing Sets using array mappers inside frequently run `useMemo` hooks (e.g., `new Set(filters.map(f => f.toLowerCase()))`) creates intermediate arrays that trigger garbage collection spikes, especially when dealing with multiple sets simultaneously.
**Action:** Replace `new Set(arr.map())` patterns with empty Set instantiation followed by a single-pass `for` loop calling `.add()`.
