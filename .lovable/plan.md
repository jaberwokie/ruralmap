

## Problem

The heat layer currently weights by raw unengaged member count alone. This makes high-volume counties (Nye, Lyon, Carson City) dominate regardless of engagement severity or staff coverage. The visual doesn't answer "where should I deploy staff?" — it just shows "where are the most people."

## Composite Priority Score

Replace the single-metric weighting with a blended score per county:

```text
score = (0.40 × unengaged_norm) + (0.35 × severity_norm) + (0.25 × coverage_gap)
```

| Component | Source | Logic |
|-----------|--------|-------|
| **Unengaged scale** (40%) | `unengagedMembers / max(unengagedMembers)` | Raw count, normalized 0–1 |
| **Engagement severity** (35%) | `1 - engagementRate` | Low rate = high severity. A county at 8% scores 0.92 |
| **Staff coverage gap** (25%) | Field FTE presence check | No field hub = 1.0; field hub present = 0.0; remote-only = 0.7 |

Field vs remote distinction uses `fteCapacityData`: entries with `hubLocation !== null` are field; `hubLocation === null` is remote-only. Remote coverage is partial credit, not full.

### What changes visually

Using the actual data, this shifts priority away from counties like Carson City (field staff present, moderate engagement rate) and toward counties like Elko and White Pine (remote-only coverage, low engagement rates, meaningful unengaged counts).

## Implementation

### File: `src/utils/utilizationAggregation.ts`

Add a new function `getCompositeEngagementPriority(county)` that returns a 0–1 score using the formula above. Uses existing `memberVolumeData`, `engagedMemberVolumeData`, and `fteCapacityData`.

Add a helper `hasFieldCoverage(county): 'field' | 'remote' | 'none'` to distinguish coverage types.

### File: `src/components/map/MapView.tsx`

In the Priority heat layer effect (~line 2280–2307):
- Replace `metrics.unengagedMembers / maxVal` with the composite score from the new utility function.
- Keep the same `Math.pow(score, 0.45)` non-linear scaling, cutoff, spread, and heat layer config — only the input weight changes.

### No changes to
- Sidebar structure, layout, Boundaries view, detail panel, markers, filters, selection behavior, or any other layer.

### Files touched
- `src/utils/utilizationAggregation.ts` — add ~25 lines (composite score + field coverage helper)
- `src/components/map/MapView.tsx` — modify ~5 lines in the Priority effect to use the new score

