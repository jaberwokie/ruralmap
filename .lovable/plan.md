

## Problem

The zone overlays and county boundaries are independent layers, so zones don't actually disappear when counties toggle off. However, the zone border colors are very subtle (e.g. `hsla(217, 91%, 60%, 0.4)` at weight 1.5), and the zone fills are nearly transparent (`hsla(217, 91%, 60%, 0.12)`). The county boundaries (weight 2, solid gray) visually reinforce the zone shapes — without them, zones appear invisible.

## Fix — Make zone borders and fills more visible

In `src/components/map/MapView.tsx`, increase the zone styling so they're clearly visible independent of county boundaries:

1. **Increase `ZONE_BORDER_COLORS` opacity:**
   - primary: `0.4` → `0.7`
   - secondary: `0.3` → `0.55`
   - frontier: `0.2` → `0.4`

2. **Increase `ZONE_COLORS` (fill) opacity:**
   - primary: `0.12` → `0.18`
   - secondary: `0.08` → `0.14`
   - frontier: `0.05` → `0.10`

3. **Increase zone polygon border weight** from `1.5` → `2` in the zones `useEffect`.

This makes zones self-sufficient visually — they remain clearly visible whether county boundaries are on or off.

