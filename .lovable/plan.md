

## Fix: County boundaries not responding to toggle

**Root cause**: In `MapView.tsx` line 210-212, the county drawing effect returns early when `layers.counties` is `false` — but it does so *before* calling `clearLayers()`. This means previously rendered county lines and labels stay on the map.

### Change

**`src/components/map/MapView.tsx`** — Move the `clearLayers()` calls before the early return:

```
// Current (broken):
if (!countiesRef.current) return;
if (!layers.counties) return;
countiesRef.current.clearLayers();
labelsRef.current?.clearLayers();

// Fixed:
if (!countiesRef.current) return;
countiesRef.current.clearLayers();
labelsRef.current?.clearLayers();
if (!layers.counties) return;
```

This ensures layers are always cleared first, then only redrawn if the toggle is on.

