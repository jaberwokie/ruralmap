# Response Capability Classification Rule

## County Classification

A county is only classified as **Active** or **Scheduled** when there is at least one real, anchored FTE whose active drive-time buffer actually touches the county.

- **Active** — the county's anchoring FTEs cover ≥60% of its area with same-day drive-time reach, and the county centroid falls within the active radius.
- **Scheduled** — the county's anchoring FTEs provide meaningful combined active + scheduled coverage (≥40% total, ≥15% scheduled ring), and a viable highway corridor exists between the nearest field anchor and the county.

## Remote Default

If no anchored FTE exists — no matter how close the nearest hub is, how much scheduled-ring geometry overlaps the county edge, or how viable the corridor appears — the county **must** be classified as:

- **Remote** — telephonic / virtual coordination only.

## Why the Anchor Gate Exists

Geometric reach alone (scheduled ring overlap, corridor reach, or distance proximity) is not sufficient to classify a county as having field response capability. A county must have a real, operational FTE base whose active buffer meaningfully covers it. This prevents counties like Churchill from being incorrectly classified as "available" or "scheduled" based purely on proximity to hubs in other counties.

## What Does NOT Qualify as an Anchor

- A nearby FTE in a neighboring county whose buffer does not reach this county's area.
- Planned, future, or hypothetical coverage that does not yet have an operational base.
- Geometric corridor reach without an actual FTE hub at the source.

## Implementation Reference

The single source of truth for this logic is `getCountyCoverageBreakdown` in `src/utils/coverageZones.ts`, which computes:

- `activePercent` — share of county area inside the active FTE drive-time zone.
- `scheduledPercent` — share in the outer scheduled ring (excluding active).
- `anchoringFtes` — list of FTEs whose active buffer actually intersects the county polygon.
- `primaryType` — the final classification, gated by `hasAnchoringFte`.

All UI counts, legend labels, and map markers read `primaryType` directly. No secondary classifier overrides it.
