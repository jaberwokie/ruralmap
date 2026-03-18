

## Plan: Hide coverage area dashed outlines when Member Volume is active

**Problem**: When the Member Volume choropleth is toggled on, the dashed coverage area zone borders remain visible underneath, clashing with the solid county borders of the choropleth.

### Change

**`src/components/map/MapView.tsx`** — In the zones drawing effect (~line 164), skip rendering zone overlays when member volume is active:

```diff
  // At the start of the zones useEffect:
- if (!layers.zones && !focusedArea) return;
+ if (layers.memberVolume) return;
+ if (!layers.zones && !focusedArea) return;
```

Add `layers.memberVolume` to the dependency array of that effect.

This ensures coverage area polygons (with their dashed outlines) are completely hidden when the member volume choropleth is displayed, letting only the choropleth's solid borders show.

