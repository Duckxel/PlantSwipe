## 2024-05-22 - Nested Loops in useMemo
**Learning:** Large arrays in nested loops within `useMemo` (e.g., O(G*P)) can be silent performance killers in React components.
**Action:** Always prefer creating a lookup map (O(P)) before iterating the main collection (O(G)), reducing complexity to O(P+G).
