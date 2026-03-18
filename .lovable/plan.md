

## Plan: Style Cluster Marker with Tier 1 Colors

The cluster marker currently uses a blue color (`hsl(217 91% 60%)`), but since it only clusters Tier 1 facilities, it should match the Tier 1 green color (`hsl(142 71% 45%)`).

### Change: `src/index.css` (lines 183-198)

Update `.cluster-marker` styles:
- `background`: change from `hsl(217 91% 60%)` to `hsl(142 71% 45%)` (Tier 1 green)
- `box-shadow`: change from `hsla(217, 91%, 60%, 0.3)` to `hsla(142, 71%, 45%, 0.3)`

This ensures the cluster bubble visually matches the Tier 1 diamond markers it represents.

