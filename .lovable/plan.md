

## Refactor: Three Continuous Coverage Areas

### County Assignments (mutually exclusive)

- **Area 1 — South (blue):** Nye, Esmeralda, Mineral
- **Area 2 — North/East (orange):** Elko, Humboldt, Lander, Eureka, White Pine, Lincoln
- **Area 3 — West (third color, e.g. teal/purple):** Washoe, Carson City, Douglas, Lyon, Storey, Churchill, Pershing

### Data Changes — `src/data/nevada-counties.ts`

1. Replace the `zone` type from `'primary' | 'secondary' | 'frontier' | 'none'` with `'area1' | 'area2' | 'area3'`
2. Reassign every county's `zone` per the assignments above
3. Add a new utility function `mergeCountyBoundaries(counties: CountyData[]): [number, number][][]` that takes all counties in a group, computes a merged outer boundary using a convex-hull-like approach (since these are simplified rectangles sharing edges, we can use Turf.js `union` or manually compute a merged polygon from the combined coordinate sets)

**Approach for merging:** Install `@turf/turf` (or `@turf/union` + `@turf/helpers`) to dissolve multiple polygons into one. Convert each county's `[lat,lng][]` boundaries to GeoJSON Polygons, iteratively union them, then convert back to Leaflet `[lat,lng][]` format. This handles concavities and shared edges properly.

### Map Changes — `src/components/map/MapView.tsx`

1. Update `ZONE_COLORS` and `ZONE_BORDER_COLORS` to three area keys with blue, orange, and a third color (suggest green-teal `hsl(160, 60%, 45%)`)
2. Replace the zone-drawing `useEffect` (lines 149-166):
   - Group counties by area (`area1`, `area2`, `area3`)
   - For each group, merge boundaries using Turf union into one GeoJSON polygon
   - Render one single `L.geoJSON` polygon per area (not per county)
   - Apply uniform opacity, stroke weight (2), and fill styling

### Sidebar Changes — `src/components/map/Sidebar.tsx`

1. Update the `LAYER_CONFIG` entry for zones label from "Operational Zones" to "Coverage Areas" (or keep as-is if preferred)

### Dependencies

- Install `@turf/union` and `@turf/helpers` for polygon merging

### Layer Order

Coverage polygons rendered on `zonesRef` (already sits between county boundaries and markers in the current layer stack).

