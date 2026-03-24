

## White-Fill Distance-to-Provider Circles When Access Gaps Active

### Problem
When both "Distance to Provider" and "Access Gaps" are toggled on, the provider radius circles use semi-transparent blue/red fills that blend into the red access gap overlay, making it hard to distinguish covered vs. uncovered areas.

### Change

**File: `src/components/map/MapView.tsx`** (~lines 1637-1652)

When `coverageGaps` is true, override the `fill` color for all radius circles to white (`hsla(0, 0%, 100%, 0.85)`) regardless of access tier or facility type. Keep the stroke colors as-is for visual distinction. This creates a clear white "covered" area contrasting against the red "gap" fill.

```
// After computing colors based on accessTier...
if (coverageGaps) {
  colors.fill = 'hsla(0, 0%, 100%, 0.85)';
}
```

Add `coverageGaps` to the effect's dependency array (line 1677).

### Impact
- Covered areas render as white-filled circles, clearly separating them from the red access gap regions
- Stroke colors and dash patterns still indicate tier quality
- No change when Access Gaps is off — normal colored fills remain

