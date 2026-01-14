## 2024-05-22 - Nested Loops in useMemo
**Learning:** Large arrays in nested loops within `useMemo` (e.g., O(G*P)) can be silent performance killers in React components.
**Action:** Always prefer creating a lookup map (O(P)) before iterating the main collection (O(G)), reducing complexity to O(P+G).

## 2024-05-23 - Empty Data Overwrite
**Learning:** The `loadPlantPreviews` loader returns `[]` on error, which causes the app to overwrite valid cached data in `localStorage` with an empty array, leading to "No results" states during partial outages.
**Action:** When implementing offline-first or caching strategies, ensure data loaders distinguish between "empty result" and "error" to prevent cache thrashing.
