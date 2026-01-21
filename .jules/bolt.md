## 2024-05-22 - Nested Loops in useMemo
**Learning:** Large arrays in nested loops within `useMemo` (e.g., O(G*P)) can be silent performance killers in React components.
**Action:** Always prefer creating a lookup map (O(P)) before iterating the main collection (O(G)), reducing complexity to O(P+G).

## 2024-05-22 - Set Intersection Optimization
**Learning:** When checking intersection of two Sets in a filter loop, iterating the larger Set (e.g. expanded filters) to check existence in the smaller Set (e.g. item attributes) is O(Large * N). Inverting it to iterate the smaller Set is O(Small * N).
**Action:** Always iterate the smaller collection when checking intersection between two Sets/Maps.

## 2024-05-22 - Hoisted Regex in Loops
**Learning:** Inline regex literals in loops (especially in `split` or `replace`) are re-allocated on every iteration in some engines. Hoisting them to module-level constants provided a 4x speedup in tight loops.
**Action:** Hoist regexes used in `map`/`forEach` loops over large datasets.
