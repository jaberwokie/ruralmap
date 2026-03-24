

## Zoom-Aware Pin Sizing for Top 20 Providers

### Problem
When Top 20 is active, pins are scaled by total visits at all zoom levels via `getScaledPinSize`. At statewide zoom, the size differences make the view cluttered and visually unappealing. Size variation only makes sense when zoomed in enough to inspect individual providers.

### Change

**File: `src/components/map/MapView.tsx`** (~line 1515)

Replace the current unconditional scaling with a zoom-aware check:
- When `topProvidersOnly` is active **and** the map zoom is below a threshold (e.g., zoom < 11), use the uniform base pin size for all 20 markers
- When zoomed in at 11+, apply `getScaledPinSize` as it does today

This keeps the zoomed-out view clean and uniform, while still showing engagement-proportional sizing when the user drills in.

```
// Before
const scaledSize = showUtilization && util
  ? getScaledPinSize(MAP_PIN_VISUALS.providerLocations.size, util.totalVisits)
  : MAP_PIN_VISUALS.providerLocations.size;

// After
const useUniformSize = topProvidersOnly && mapZoom < 11;
const scaledSize = showUtilization && util && !useUniformSize
  ? getScaledPinSize(MAP_PIN_VISUALS.providerLocations.size, util.totalVisits)
  : MAP_PIN_VISUALS.providerLocations.size;
```

Single line-level change, no other files affected.

