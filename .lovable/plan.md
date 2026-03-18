

## Pin Color Standardization + Legend Update

### 1. MapView.tsx — Neutral Pin Colors

**Marker rendering** (lines 218-273): Replace area-based `AREA_MARKER_COLORS[area]` color logic with fixed neutral colors:
- Default: `#1F2937` (charcoal)
- White halo: `border: 2px solid white; box-shadow: 0 0 0 1px rgba(255,255,255,0.8), 0 1px 3px rgba(0,0,0,0.3)`

Remove the `AREA_MARKER_COLORS` import since pins no longer use area colors.

**Hover state**: Add `:hover` background change to `#374151` via inline style `onmouseover`/`onmouseout` on the marker div.

**Coverage radii** (lines 194-216): Keep area-colored — no change needed.

### 2. Sidebar.tsx — Legend Section

Add a new "Legend" section below the Layers panel with two clear entries:
- **Locations**: A charcoal circle (`#1F2937`) + label "Clinics / FQHCs"
- **Coverage Areas**: Three small colored squares (green/orange/blue) with Area 1/2/3 labels

This ensures pins and regions are visually distinct in the legend — no color-matching.

### 3. nevada-counties.ts — Cleanup

Remove or deprecate `AREA_MARKER_COLORS` export since it's no longer consumed by MapView.

### Files Changed
- `src/components/map/MapView.tsx` — neutral pin colors, white halo, hover state
- `src/components/map/Sidebar.tsx` — add Legend section
- `src/data/nevada-counties.ts` — remove `AREA_MARKER_COLORS`

