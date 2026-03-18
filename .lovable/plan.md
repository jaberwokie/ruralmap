

## Plan: Single-Select Coverage Areas

Add area selector chips to the sidebar and update the map to fully hide non-selected areas (instead of just dimming them).

### Changes

**`src/components/map/Sidebar.tsx`**
- Add a new "Coverage Areas" section below the Layers section with three clickable chips: Area 1, Area 2, Area 3 (color-coded green/orange/blue).
- Clicking a chip sets `focusedArea`; clicking the active chip clears it.
- Requires new props: `focusedArea` and `onFocusedAreaChange`.

**`src/pages/Index.tsx`**
- Pass `focusedArea` and `setFocusedArea` down to `Sidebar`.

**`src/components/map/MapView.tsx`**
- In the coverage area drawing effect: when `focusedArea` is set, **skip rendering** non-focused areas entirely (instead of rendering them at low opacity).
- In the county drawing effect: skip rendering counties not in the focused area.
- In the markers effect: filter facilities to only show those in counties belonging to the focused area.
- In the coverage radius and gaps effects: already scoped to `focusedArea` — no change needed.
- Auto-zoom/fit the map to the focused area's bounds when one is selected.

### Sidebar UI

The chips will sit just below the Layers section:

```text
Coverage Areas
[● Area 1] [● Area 2] [● Area 3]   ← toggle chips, active = filled
```

Clicking "Area 1" isolates it on the map; clicking again shows all areas.

