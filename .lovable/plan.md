

## Plan: Hide coverage gap circles when Coverage Radius is toggled off

**Problem**: When Coverage Gaps is ON but Coverage Radius is OFF, the gap overlay still calculates and displays circular cutouts around facilities. These circular holes in the red gap tint create visible "diluted color radius" shapes — the underlying zone colors show through in circles, making it look like radius circles are still present.

**Fix**: Add `coverageRadius` as a condition in the coverage gaps effect. When `coverageRadius` is off, clear the gaps layer too (since the gaps are defined by the radius).

### Changes

**`src/components/map/MapView.tsx`** — Coverage gaps `useEffect` (~line 396):

```diff
- if (!coverageGaps) return;
+ if (!coverageGaps || !coverageRadius) return;
```

Also add `coverageRadius` to the effect's dependency array (~line 462):

```diff
- }, [facilities, coverageGaps, radiusKm, focusedArea]);
+ }, [facilities, coverageGaps, coverageRadius, radiusKm, focusedArea]);
```

This ensures that when Coverage Radius is toggled off, the geometric subtraction overlay (which inherently produces circular shapes) is also removed.

