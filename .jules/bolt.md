
## 2025-02-14 - Optimize nested mapping and Object.keys in hot paths
**Learning:** In deeply nested data structures (like plant schemas), using chained `.map().filter()` creates unnecessary intermediate arrays that strain the garbage collector. Additionally, using `Object.keys(obj).length === 0` inside recursive functions (like `sanitizeDeep`) to check for empty objects allocates a new string array every single time, which compounds quickly in recursive hot loops.
**Action:** Replace chained array operations with single-pass `for` or `reduce` loops. Replace `Object.keys().length === 0` checks with a helper function that uses a `for...in` loop to return early (`for (const _ in obj) return false; return true;`).
