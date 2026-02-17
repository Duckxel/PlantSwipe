## 2024-05-22 - Nested Loops in useMemo
**Learning:** Large arrays in nested loops within `useMemo` (e.g., O(G*P)) can be silent performance killers in React components.
**Action:** Always prefer creating a lookup map (O(P)) before iterating the main collection (O(G)), reducing complexity to O(P+G).

## 2024-05-22 - Set Intersection Optimization
**Learning:** When checking intersection of two Sets in a filter loop, iterating the larger Set (e.g. expanded filters) to check existence in the smaller Set (e.g. item attributes) is O(Large * N). Inverting it to iterate the smaller Set is O(Small * N).
**Action:** Always iterate the smaller collection when checking intersection between two Sets/Maps.

## 2025-01-22 - Extracted Inner Components to Fix Re-Mounting
**Learning:** Defining components inside other components (e.g. `const FilterControls = ...` inside `PlantSwipe`) causes them to be re-created on every render. This forces React to unmount and remount the DOM subtree, losing state and focus, and causing performance issues.
**Action:** Always extract components to separate functions (even if in same file) or files. Pass dependencies as props. If prop drilling is heavy, consider Context or grouping props, but extraction is non-negotiable for performance.

## 2024-05-22 - Regex Logic Mismatch
**Learning:** When replacing `str.replace(/[chars]/g, '')` logic with `!/[^chars]/.test(str)`, be extremely careful about what `chars` represents. In the original code, `[0.,%\s]` only matched the digit '0', not all digits. Assuming it meant 'digits' led to a regression where valid numeric strings like "123" were dropped.
**Action:** Always verify the exact set of characters matched by a regex in the legacy code before optimizing it, especially when dealing with data sanitization. Use unit tests with numeric edge cases ("123", "0", "0.0") to catch these regressions.
