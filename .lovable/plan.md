

## Plan: Coverage Gaps suppresses other colored layers

When the Coverage Gaps toggle is ON, hide the zone overlays and member volume choropleth so only the gap fill color is visible on the map.

### Changes in `src/components/map/MapView.tsx`

1. **Zones effect** (~line 162): Add `coverageGaps` check — clear and skip drawing zones when `coverageGaps` is true. Add `coverageGaps` to dependency array.

2. **Member Volume effect** (~line 440+): Add `coverageGaps` check — clear and skip drawing choropleth when `coverageGaps` is true. Add `coverageGaps` to dependency array.

3. **Coverage Gaps effect**: Remove the `!coverageRadius` early-return guard (since gaps should now work independently of radius toggle). The gap layer should render whenever `coverageGaps` is ON, using the current `radiusKm` for the geometric subtraction.

This ensures the map shows only the red gap tint (plus state boundary, markers, and county lines if toggled) when Coverage Gaps is active.

