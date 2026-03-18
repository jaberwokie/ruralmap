

## Fixed Hover Detail Panel for Coverage Areas

### Approach

Replace the floating Leaflet tooltip on coverage area polygons with a fixed React panel overlaid in the top-right corner of the map. MapView will expose a hover state via a new callback prop; the panel renders as a sibling overlay in `Index.tsx`.

### Changes

**1. `src/components/map/MapView.tsx`**
- Add a new prop: `onAreaHover: (area: CoverageArea | null) => void`
- In the coverage area drawing effect (lines 140-193), remove `geoLayer.bindTooltip(...)` calls
- Instead, attach `mouseover` and `mouseout` events on each `geoLayer` to call `onAreaHover(area)` / `onAreaHover(null)`

**2. `src/components/map/CoverageDetailPanel.tsx`** (new file)
- A compact fixed-position panel component
- Props: `hoveredArea: CoverageArea | null`
- When `hoveredArea` is null: show "Hover over a coverage area to view details"
- When set: show area label from `COVERAGE_AREA_LABELS`, county list with member counts from `memberVolumeData`, and a Total row
- Styling: `bg-white/90 backdrop-blur-sm border border-border rounded-lg shadow-md`, positioned `absolute top-3 right-3`, width ~220px
- On small screens: slightly smaller text, same position

**3. `src/pages/Index.tsx`**
- Add `hoveredArea` state (`CoverageArea | null`)
- Pass `onAreaHover` callback to `MapView`
- Render `<CoverageDetailPanel>` as a sibling overlay inside the map container div, positioned absolutely in top-right

### Visual behavior
- Panel title "Coverage Area Details" is always visible
- Content transitions smoothly between areas (no layout jumps — fixed min-width)
- Does not interfere with map controls (Leaflet zoom is top-left by default)

