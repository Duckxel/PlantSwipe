
## 2024-11-20 - Fast Deep Object Sanitization in High-Volume Data Fetching
**Learning:** The `sanitizeDeep` function in `plantTranslationLoader.ts` is a critical hot path because it runs on *every* plant object returned from the database before rendering. Using chained `.map().filter()` for arrays and `Object.keys(obj).length === 0` to check for empty plain objects creates significant memory pressure and GC overhead due to constant intermediate array allocations on large deeply nested JSON datasets.
**Action:** Replace functional array chaining with single-pass `for` loops in recursive object sanitizers. Use a `for...in` loop that returns early (e.g. `isEmptyPlainObject`) instead of `Object.keys()` to check if an object is empty without allocating an array of keys.

## 2026-02-23 - Avoid intermediate allocations with map/filter chains in data loading loops
**Learning:** Chaining `.map().filter()` or `.filter().map()` creates intermediate arrays and forces multiple iterations. In hot paths like `loadPlantsWithTranslations`, `loadPlantPreviews`, and `preparedPlants` mapping (which run on hundreds or thousands of elements), these allocations compound and create unnecessary garbage collection pressure and slower processing.
**Action:** Replace map/filter chains with single-pass `for` loops that push to a pre-allocated array in data processing loops.

## 2026-03-01 - Optimizing chained array allocations in components
**Learning:** Chaining `.map().filter()` or `.split().filter()` within hot loops or frequently re-rendered components (e.g., inside `preparedPlants` memo or `SwipePage` rendering) creates multiple intermediate arrays, compounding garbage collection overhead.
**Action:** Replace map/filter chains and split/filter chains with single-pass `for` loops in hot data preparation and render paths to avoid intermediate array allocation and improve performance.

## 2026-03-05 - Avoid chained string and array methods for hot render paths
**Learning:** Functions like `formatIndicatorValue` in `SwipePage.tsx` were heavily used during rendering (via `buildIndicatorItems` and `buildColorSwatches`), executing on every component update. The chained execution of `.toString().replace(/[_\-/+]/g, " ").trim().split(/\s+/).map(...).join(" ")` resulted in multiple allocations of strings and arrays per call, creating unnecessary garbage collection overhead in hot render loops.
**Action:** Replace functional array method chains (`.split().map().join()`) with single-pass `for` loops in hot render paths when processing simple string formatting. This eliminates intermediate array allocations and string creation entirely for high-frequency renders.
