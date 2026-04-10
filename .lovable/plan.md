

## Fix Jackpot Community Health Center Coordinates

### Root cause

The previous "fix" changed rs-81 from `(41.98986, -114.6656)` to `(41.9830, -114.6748)`, moving it ~700m **south and west** of the real building. The actual address 950 Lady Luck Drive per Google Maps is at `(41.98866, -114.66603)`. The original coordinates were nearly correct; the "fix" made things worse.

The marker appears outside Nevada at low zoom because Jackpot is genuinely ~1.2km from the Idaho border. At full-state zoom, that distance is ~1-2 pixels — smaller than the marker icon. This is an inherent limitation of zoomed-out rendering for border towns, not a data error. The corrected coordinates will place the marker as accurately as possible.

### Change

**File**: `src/data/rural-services.ts`, line 158

| Field | Before (broken "fix") | After (Google Maps verified) |
|-------|----------------------|------------------------------|
| lat | 41.9830 | 41.98866 |
| lng | -114.6748 | -114.66603 |

These are the building-level coordinates from Google Maps for 950 Lady Luck Drive, Jackpot, NV 89825 — matching the project's 5-decimal-place coordinate standard.

### What this fixes

- Marker aligns with the actual clinic building when zoomed in
- At zoomed-out view, the marker will render at the boundary edge because the real town is ~1.2km from Idaho — this is geographically truthful

### What is NOT changed

- No other markers, no boundary data, no mask styling, no rendering logic, no filters, no routing tiers

