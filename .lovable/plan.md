

## Problem

Tier 1 providers are added to the same `markerClusterGroup` as hospitals and clinics. When clustered, they lose their green diamond identity and appear as generic blue cluster bubbles. Toggling Tier 1 off changes cluster counts (8→4, 11 disappears) confirming they're being absorbed into clusters.

## Solution

**Render Tier 1 markers on their own layer, outside the cluster group**, so they always display as individual green diamonds and never merge into blue clusters.

### Changes in `src/components/map/MapView.tsx`

1. Add a new `tier1Ref = useRef<L.LayerGroup>()` layer group, initialized alongside the others.
2. In the marker-drawing `useEffect`:
   - Skip `tier1` facilities from the `clusterGroup` loop.
   - Add a separate loop that renders Tier 1 markers directly onto `tier1Ref.current` (no clustering).
3. Clear `tier1Ref` at the top of the effect alongside `markersRef`.

This keeps hospitals and clinics clustered (blue bubbles) while Tier 1 providers always render as standalone green diamonds.

