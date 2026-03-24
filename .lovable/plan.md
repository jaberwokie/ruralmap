

## Show Street Names at Street-Level Zoom

### Problem
The map uses CartoDB's `light_nolabels` tile set, which strips all text labels including street names at every zoom level.

### Change

**File: `src/components/map/MapView.tsx`** (~line 1043)

Replace the tile URL from `light_nolabels` to `light_all` (same CartoDB style but with labels):

```typescript
// Before
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {

// After
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
```

This keeps the same clean light basemap aesthetic but adds street names, city labels, and other geographic text that becomes visible as you zoom in.

### What stays the same
- All pin layers, clustering, tooltips, overlays
- Map zoom/pan behavior, max zoom level
- No additional dependencies

