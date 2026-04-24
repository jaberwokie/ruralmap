Churchill is not slipping through the planned/corridor branch anymore. The current marker comes from the county response classification source used by the map:

- `src/components/map/MapView.tsx` builds the Response Capability markers from `getCountyCoverageBreakdown(county, coverageRadiusKm)`
- `src/components/map/responseCapabilityVisuals.ts` returns `breakdown.primaryType` directly
- `src/utils/coverageZones.ts` still marks a county as `active` whenever `activePercent >= 60 && anchoringFtes.length > 0`

That means Churchill can still show a field-response pin even after the scheduled/planned logic was tightened, because the active branch is separate and currently more permissive.

## What to change

### 1) Fix the source classification, not just the pin
Update `src/utils/coverageZones.ts` so Churchill cannot remain `active` from edge-only same-day overlap.

Implementation approach:
- keep the existing active coverage radius math and buffered zone generation unchanged
- replace the current raw `activePercent >= 60` gate with an anchor-aware county eligibility check for county-level `active` classification
- only return `active` when the chosen field anchor provides meaningful same-day county coverage, not just a clipped edge or a buffer touching a sliver of the county
- leave the scheduled corridor logic in place and only evaluate it after the stricter active check fails

This fixes the problem at the single source of truth used by the map marker.

### 2) Keep Churchill from reappearing through display-only helpers
Audit the display surfaces that still infer field coverage from weaker rules so they stay consistent after the classification fix:
- `src/utils/fieldCoverageStatus.ts`
- `src/components/map/CoverageDetailPanel.tsx`

Specifically:
- remove any logic path where Churchill can still be described as having primary field coverage just because it appears in `fteCapacityData.counties[]`
- keep these helpers aligned with the corrected county response truth so the map pin, hover card, and county panel agree

### 3) Preserve all unrelated behavior
Do not change:
- scheduled/planned corridor math except where it is already downstream of the active gate
- drive radius geometry
- remote support placement
- FTE locations
- response capability marker styling
- pane stacking
- clipping

## QA
Verify these cases after the change:
- Churchill no longer renders a Same-Day or Planned field-response marker
- Churchill falls to `remote` if it does not pass the stricter active test and still does not pass planned corridor rules
- Nye remains correct
- Lincoln remains correct
- Humboldt remains remote
- counties with true same-day field reach remain active
- county detail language no longer contradicts the marker state for Churchill

## Technical details
Files to update:
- `src/utils/coverageZones.ts` — tighten county-level `active` classification
- `src/utils/fieldCoverageStatus.ts` — align display-only field coverage truth if needed
- `src/components/map/CoverageDetailPanel.tsx` — remove assignment-based fallback wording if it contradicts the corrected classification

Expected outcome:
- Churchill’s field-response pin disappears because the county-level classification source no longer treats weak edge overlap as county-wide field availability
- the scheduled/planned fix remains intact
- the map and county panel stay in sync