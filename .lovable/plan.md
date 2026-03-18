

## Plan: Keep dashed coverage area outlines visible when Member Volume is active

Remove the early return on line 166 that hides zone overlays when member volume is on.

**`src/components/map/MapView.tsx`** — line 166:

```diff
- if (layers.memberVolume) return;
```

This lets the dashed coverage area boundaries render on top of (or beneath) the member volume choropleth, always visible when the Coverage Areas toggle is on.

