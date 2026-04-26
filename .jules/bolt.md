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

## 2024-05-19 - Avoid .map on large database responses and use isEmptyPlainObject
**Learning:** Using `.map` directly on thousands of database rows (like in `loadPlantsWithTranslations` and `preparedPlants` mapping) creates large intermediate arrays that cause significant garbage collection pressure. Similarly, using `Object.keys(obj).length > 0` in mappers allocates unnecessary arrays just to check if an object is empty.
**Action:** Replace `.map` on large datasets with pre-allocated arrays (`new Array(length)`) and single-pass `for` loops. Replace `Object.keys(obj).length > 0` with a helper like `!isEmptyPlainObject(obj)` that uses a `for...in` early return.
## 2026-03-31 - Eliminate intermediate array allocations in Set initialization for filter normalization
**Learning:** The `normalizedFilters` `useMemo` block in `PlantSwipe.tsx` initialized 8 separate `Set`s using `new Set(arr.map(x => x.toLowerCase()))`. In frequently triggered render paths, this generates unnecessary intermediate array allocations for each field on every filter interaction.
**Action:** When creating a `Set` from a mapped array, define an external helper function (e.g., `createLowercasedSet`) that iterates through the input with a `for` loop and adds elements directly to an empty `Set`. This maintains readability while eliminating intermediate allocations.

## 2026-04-03 - Combine multiple aggregations in single-pass loops
**Learning:** Performing multiple `.reduce()` or chained `.filter().length` operations over the same array to calculate related metrics (e.g., total required tasks and total completed tasks) increases time complexity to O(2N) and adds unnecessary function call overhead.
**Action:** Replace multiple `.reduce()` calls or `.filter().length` chains on the same array with a single-pass `for` loop that computes all required aggregates simultaneously, avoiding intermediate array allocations and reducing loop overhead.
## 2026-04-03 - Combine multiple aggregations in single-pass loops
**Learning:** Performing multiple `.reduce()` or chained `.filter().length` operations over the same array to calculate related metrics (e.g., total required tasks and total completed tasks) increases time complexity to O(2N) and adds unnecessary function call overhead.
**Action:** Replace multiple `.reduce()` calls or `.filter().length` chains on the same array with a single-pass `for` loop that computes all required aggregates simultaneously, avoiding intermediate array allocations and reducing loop overhead.
## 2024-05-18 - Replacing multiple reduce calls with single-pass for loops
**Learning:** In data processing functions that iterate over an array multiple times to calculate aggregate values (e.g., maximum required count and sum of completed tasks), using multiple `.reduce()` calls adds unnecessary function call overhead and time complexity.
**Action:** Use a single-pass `for` loop to compute multiple aggregates simultaneously to avoid intermediate loop allocations and overhead.
## 2026-04-03 - Prevent array allocation from Object.values() in recursive functions
**Learning:** Using `Object.values(obj).some(...)` in recursive functions (like `hasMeaningfulContent`) or heavily accessed components creates significant GC pressure by allocating intermediate arrays of values for every object node traversed.
**Action:** Replace `Object.values(obj).some(...)` with `for...in` loops in recursive checkers and hot path validations to prevent intermediate array allocation and allow for fast early returns.
## 2026-04-18 - Avoid unnecessary loop optimization for split/map/filter chains in composition parsing
**Learning:** Optimizing a `.split().map().filter()` chain into a single-pass `for` loop in a utility function (`toArrayInput`) that parses short comma-separated strings represents a classic micro-optimization. The overhead of iterating a 2-3 item array is negligible compared to the readability cost. The user explicitly requested to avoid optimizations that sacrifice readability for zero measurable impact.
**Action:** Do not blindly convert all array chains to `for` loops. Reserve imperative loop structures for true hot paths iterating over large datasets (like rendering loops or global data processing).
