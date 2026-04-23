

## Fix: Clip provider radius circles to Nevada boundary

### Root cause
Radius circles render in the `driveRadiiAbove` pane (z-index 500). The state mask (white inverse polygon over everything outside Nevada, z-index 640) sits **above** the circles, so it visually hides spillover into CA/UT/AZ — but **only where the mask itself is opaque**. The mask uses `fillOpacity: 0.45`, so radius arcs bleed through it as faint colored shapes outside the state line.

We don't want to make the mask fully opaque (that would hide the basemap context outside Nevada that's intentionally kept visible). Instead, **clip the radii layer itself to the Nevada polygon** using an SVG `clipPath` defined once and applied to the drive-radii pane.

### Approach — SVG clipPath on the drive-radii pane

Leaflet renders each pane as its own `<svg>` element. We inject a `<clipPath id="nevada-clip">` containing the Nevada polygon (in the pane's SVG coordinate space) and set `clip-path: url(#nevada-clip)` on the pane's root `<g>`. The clip is reprojected on every `zoomend` / `moveend` so it stays aligned as the user pans/zooms.

This clips **only** the drive-radii pane. Pins, county polygons, gap overlays, tribal layers, and the state mask are untouched.

### Changes (single file)

**File:** `src/components/map/MapView.tsx`

1. **New effect** that runs once after the map is created: builds an SVG `<defs><clipPath id="nevada-clip"><path/></clipPath></defs>` inside the drive-radii pane's `<svg>` element and applies `clip-path="url(#nevada-clip)"` to that pane's overlay `<g>`.

2. **Reproject the clip path** on `map.on('zoomend moveend viewreset')` by converting `nevadaBoundaryGeoJSON` lat/lng coords to layer-point coords using `map.latLngToLayerPoint(...)`, then writing the resulting SVG `d` attribute to the clip's `<path>`.

3. **Cleanup** on unmount: remove listeners and the injected `<defs>` node.

### Why this is the right fix
- Reuses the **existing** Nevada boundary geometry (`nevadaBoundaryGeoJSON`) — no second outline.
- Operates entirely at the SVG layer; **zero changes** to radius math, distance logic, gap detection, pane order, fill/stroke styling, or the recent `coverage-radius--gap` work.
- Border-adjacent arcs are clipped cleanly along the actual state line (border counties still show partial arcs as expected).
- Pins remain in the markers pane (z-index 650) — fully visible everywhere.

### Not touched
- Radius math / `radiusKm` / `coverageRadius`
- `coverageGaps` boolean and `coverage-radius--gap` styling
- Pane stacking (`driveRadiiAbove` stays at 500; `stateMask` at 640; `markers` at 650)
- Provider pins, county polygons, tribal layers, gap overlays, state mask, state outline
- Access tier classification and county logic

### QA after deploy
- Carson/Douglas radii no longer spill into California.
- Clark-area radii no longer spill into Arizona/Utah.
- In-state portions of every circle render identically to today (same fill, stroke, halo, dash, gap white-fill behavior).
- Pins remain fully visible, including border-adjacent ones.
- Access Gaps toggle still produces white-centered circles inside Nevada.
- Distance to Provider OFF → no visible change.

### Post-deploy report will include
- Clip shape: `nevadaBoundaryGeoJSON` (existing single source of truth)
- Layers clipped: drive-radii pane only (covers both halo and main circle)
- Confirmation: radius math, access logic, gap detection, and pane order untouched

