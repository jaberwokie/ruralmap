---
name: Operational Coverage Model Intent
description: FTE-centered drive-time coverage; counties classified by geometric reality, never blanket assumptions
type: feature
---
Both Response Capability and Field Coverage Status are derived from real FTE base locations and merged drive-time buffers — never from county-wide assumptions or `counties[]` membership alone.

Geometry (in `src/utils/coverageZones.ts`):
- Active zone = merged FTE buffers at the configured Field Response Radius (~0–90 min equivalent at 80 km/h).
- Scheduled zone = merged FTE buffers at radius × 1.5 (~90–150 min). Ring = scheduled − active.
- Remote = county area outside both.
- `CountyCoverageBreakdown` exposes `activePercent`, `scheduledPercent` (ring only), `remotePercent`, `anchoringFtes`, and `primaryType`.

Conservative county classification (bias toward operational reality, never optimism):
- `active` — `activePercent ≥ 60` AND at least one anchoring FTE.
- `scheduled` — `activePercent + scheduledPercent ≥ 40`.
- `remote` — otherwise.

Field Coverage Status (`src/utils/fieldCoverageStatus.ts`):
- `countyHasFieldCoverage` requires `activePercent ≥ 25` at the default radius. Pure FTE-`counties[]` membership is no longer sufficient — it would over-promise on partial counties (Far-NW Washoe, Far-N/NE Nye).

Edge cases handled geometrically (no hard-coded county names):
- Far-NW Washoe (Black Rock corner) and Far-N/NE Nye (Tonopah and beyond) sit far outside any FTE buffer, so their county-wide `activePercent` stays low → classified as Scheduled or Remote, not Same-Day.

UI behavior:
- Sidebar Field Coverage Status counts and Response Capability legend both read `breakdown.primaryType`, so they update immediately when the Field Response Radius slider or FTE locations change.
- Single source of truth: `getResponseCapabilityCategory` returns `breakdown.primaryType`; no parallel thresholding.

Constraints:
- Do not introduce parallel classifiers anywhere else.
- Do not classify by county centroid or by `fteCapacityData[].counties` membership for response/coverage display.
