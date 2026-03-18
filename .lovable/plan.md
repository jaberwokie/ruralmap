

## Plan: Coverage Areas toggle shows/hides all areas regardless of focus

**Root cause**: Line 179 in `MapView.tsx` skips rendering non-focused areas. The toggle should control visibility of all areas globally; the focus chips should only control zoom/detail, not hide zones.

### Change

**`src/components/map/MapView.tsx`** — Remove the focus-based filtering in the zones drawing effect (line 179):

```diff
  areas.forEach(area => {
-   // Skip non-focused areas entirely when a focus is active
-   if (focusedArea && area !== focusedArea) return;
```

This makes the zones toggle a simple all-on/all-off control. The focus chips will still control auto-zoom, county boundaries, and the detail panel, but all three coverage area overlays will always render when the toggle is on.

