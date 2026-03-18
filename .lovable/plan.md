

## Plan: Auto-enable Service Locations + Coverage Radius when Coverage Gaps is toggled ON

When the user enables **Coverage Gaps**, the map should also show **Service Locations** and **Coverage Radius** so the context is visible.

### Changes

**`src/pages/Index.tsx`** — Update `handleCoverageGapsChange`:
- When `coverageGaps` is toggled ON, also set `layers.serviceLocations = true` and `coverageRadius = true`.
- When toggled OFF, leave the other toggles as-is (user may still want them visible).

