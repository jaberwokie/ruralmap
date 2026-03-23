

## Fix: Top 20 Providers as True Exclusive Rendering Mode

### Root Cause

The screenshot shows the exact problem: when Top 20 is ON, service markers (green), behavioral health markers (purple), and cluster counts all still render. This is because:

1. The previous fix **removed** the exclusive mode logic from `Index.tsx` that turned off conflicting layer toggles
2. The render effect in `MapView.tsx` (lines 1391-1502) renders service/BH markers based solely on `layers.services` and `layers.behavioralHealth` — it never checks `topProvidersOnly`
3. The markers still get added to `pointClusterRef` (line 1609), producing cluster count badges

### Fix Strategy

Apply the exclusive mode at the **render level** inside `MapView.tsx`, not by manipulating toggle state in `Index.tsx`. This means the sidebar toggles stay visually as-is, but when `topProvidersOnly` is active, the renderer skips all non-provider marker layers.

### Changes

**File: `src/components/map/MapView.tsx`** — render effect (~line 1317)

1. When `topProvidersOnly` is true, skip rendering service presence markers (lines 1391-1446) and behavioral health markers (lines 1448-1503) entirely — treat both blocks as if their toggle is off
2. When `topProvidersOnly` is true, skip adding anything to `pointClusterRef` (line 1608-1609) — no cluster badges
3. The provider marker block (lines 1505-1598) already uses `providerVisibleFacilities` which resolves to the top-20 dataset — this is correct and stays

Concretely, change these conditions:
- Line 1391: `if (layers.services)` → `if (layers.services && !topProvidersOnly)`
- Line 1448: `if (layers.behavioralHealth)` → `if (layers.behavioralHealth && !topProvidersOnly)`

This ensures when Top 20 is active:
- Only the 20 provider pin markers render (via `topProviderMarkersRef`, no clustering)
- No service dots, no BH dots, no cluster count badges
- County boundaries and utilization shading still render normally (controlled by separate layer groups)

**No changes to**: `Index.tsx`, sidebar, toggle state management, marker styling, ranking logic.

