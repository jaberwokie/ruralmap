

## Fix: White seams in Coverage Gaps layer

### Root Cause

The Coverage Gaps layer (lines 350–413 in `MapView.tsx`) unions all hospital/clinic radius buffers, then computes `difference(nevada, mergedCoverage)` to show uncovered areas. The Turf.js `union` operation produces micro-gaps at buffer intersection edges — these become thin white slivers in the rendered gap polygon.

### Solution

Apply a small **buffer-then-debuffer** (morphological close) to the merged coverage geometry before computing the difference. This fills micro-gaps between adjacent circles:

1. After unioning all buffers, apply `buffer(merged, 0.5, 'kilometers')` to expand slightly
2. Then `buffer(result, -0.5, 'kilometers')` to shrink back — this closes internal seams without changing the overall shape
3. Then compute `difference(nevada, cleaned)` as before

### File Changes

**`src/components/map/MapView.tsx`** (lines ~374–393):
- After the `union(featureCollection(buffers))` call, add a morphological close pass:
  ```
  const expanded = buffer(mergedCoverage, 0.5, { units: 'kilometers' });
  const cleaned = buffer(expanded, -0.5, { units: 'kilometers' });
  ```
- Use `cleaned` instead of `mergedCoverage` in the `difference()` call

This is a 3-line change in one file. Performance impact is negligible — two buffer operations on a single pre-merged polygon.

### Validation
- Storey County area (north): seams between Carson and Pahrump radius overlap should disappear
- Nye/Clark border: gap between Pahrump-centered buffers and Clark clinic buffers should render as continuous red fill with no white lines

