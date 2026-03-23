

## Tighten Nevada State Boundary to High-Resolution GeoJSON

### Problem
The current `nevada-boundary.ts` contains only **21 coordinate pairs** — an extremely coarse approximation of Nevada's state line. Every overlay that clips to this boundary (coverage gaps, operational coverage, grey non-service areas) bleeds well beyond the actual state border, as visible in the screenshot.

### Solution
Replace the boundary data with a **~290-point** high-resolution polygon sourced from US Census TIGER/Line data (via `glynnbird/usstatesgeojson`). This is the same authoritative Census source referenced in the file's original comment, just at proper resolution.

### Changes

**File: `src/data/nevada-boundary.ts`** — Complete replacement

Replace the 21-point coordinate array with the ~290-point polygon extracted from the TIGER-derived GeoJSON. The export signature (`nevadaBoundaryGeoJSON: GeoJSON.Polygon`) stays identical — no consumers need to change.

All downstream code that references `nevadaBoundaryGeoJSON` (MapView.tsx, coverageZones.ts, mergePolygons.ts) will automatically render tighter overlays with zero code changes needed.

### What stays the same
- Export name and type (`GeoJSON.Polygon`)
- All consuming code in MapView, coverageZones, mergePolygons
- No map styling or layer logic changes
- No UI changes

### Impact
Every clipped overlay — coverage gaps (red), operational coverage (teal/grey), county clipping — will now conform tightly to the actual Nevada state line instead of cutting across neighboring states.

