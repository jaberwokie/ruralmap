

## Fix: Pane stacking for provider radius circles

**File:** `src/components/map/MapView.tsx` (two edits only)

### Edit 1 — Add new pane to `PANE_CONFIG`
Insert after `tribalNations`, before `stateMask`:
```ts
// Provider radius circles — above gap overlays and tribal polygons,
// below state mask and all marker panes. Non-interactive.
driveRadiiAbove: { id: 'drive-radii-above-pane', zIndex: 500, interactive: false },
```

### Edit 2 — Repoint backward-compat alias in `MAP_PANES`
Replace:
```ts
driveRadii: PANE_CONFIG.basePolygons.id,
```
with:
```ts
driveRadii: PANE_CONFIG.driveRadiiAbove.id,
```

### Resulting pane order
| Pane | z-index |
|---|---|
| basePolygons | 200 |
| coverage | 300 |
| countyInteractive (gap overlays) | 350 |
| tribalNations | 450 |
| **driveRadiiAbove (NEW)** | **500** |
| stateMask | 640 |
| markers | 650 |
| providerMarkers | 660 |

### Not touched
- Gap detection logic / `coverageGaps` boolean
- `coverage-radius--gap` class and CSS
- Circle fill, stroke, halo styling
- Marker panes, clustering, pin rendering
- Any other layer or filter logic

Both existing call sites that use `MAP_PANES.driveRadii` (halo + main circle) automatically pick up the new pane.

### Post-deploy report
- New pane z-index: **500** (`drive-radii-above-pane`)
- `MAP_PANES.driveRadii` now → `PANE_CONFIG.driveRadiiAbove.id`
- Gap detection and `coverage-radius--gap` styling untouched

