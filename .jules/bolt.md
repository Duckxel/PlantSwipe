## 2024-05-22 - Nested Loops in useMemo
**Learning:** Large arrays in nested loops within `useMemo` (e.g., O(G*P)) can be silent performance killers in React components.
**Action:** Always prefer creating a lookup map (O(P)) before iterating the main collection (O(G)), reducing complexity to O(P+G).

## 2024-05-22 - Set Intersection Optimization
**Learning:** When checking intersection of two Sets in a filter loop, iterating the larger Set (e.g. expanded filters) to check existence in the smaller Set (e.g. item attributes) is O(Large * N). Inverting it to iterate the smaller Set is O(Small * N).
**Action:** Always iterate the smaller collection when checking intersection between two Sets/Maps.

## 2025-01-22 - Extracted Inner Components to Fix Re-Mounting
**Learning:** Defining components inside other components (e.g. `const FilterControls = ...` inside `PlantSwipe`) causes them to be re-created on every render. This forces React to unmount and remount the DOM subtree, losing state and focus, and causing performance issues.
**Action:** Always extract components to separate functions (even if in same file) or files. Pass dependencies as props. If prop drilling is heavy, consider Context or grouping props, but extraction is non-negotiable for performance.

## 2025-01-23 - Erasable Syntax Only & Class Optimization
**Learning:** When `erasableSyntaxOnly: true` is set in `tsconfig.json`, TypeScript prevents usage of syntax that cannot be simply erased to valid JS (like `private`/`public` fields or enum merging).
**Action:** Use standard ES class syntax (constructor assignment or public fields without keywords) instead of TypeScript access modifiers.
**Learning:** Creating thousands of object literals with multiple closures inside a `map` loop (e.g. `preparedPlants`) creates massive memory pressure.
**Action:** Replace closure-heavy object literals with a lightweight Class wrapper to share methods via prototype and reduce per-instance memory overhead.
