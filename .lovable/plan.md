## Problem

When Lander is selected, two green community-service pins appear in Winnemucca and Lovelock (outside Lander's polygon).

**Root cause:** `src/data/rural-services.ts` legitimately tags `rs-109` and `rs-112` as `county: "Lander"` (Lander-serving outreach, with notes like "Serves Lander from Winnemucca"), but their `lat/lng` are in Humboldt/Pershing. The current filter in `src/components/map/MapView.tsx` (`filteredRuralServices`) matches on the metadata county string only — so pins render at the wrong geographic county.

## Fix

In `src/components/map/MapView.tsx`, add a geometric pin-scoping pass on top of the metadata filter. Only the leaf marker lists are filtered; panel/list counts (which derive from `filteredRuralServices`) keep all Lander-tagged records so the "Local Resource Network" panel still shows the cross-border outreach entries.

Steps:

1. Add a memo `selectedCountyPolygon` resolving the boundary array for `selectedCounty` from `nevadaCounties` (already imported).
2. Add an inline `isInsideSelectedCounty(lat, lng)` callback using the existing ray-cast point-in-polygon pattern from `src/utils/countyLookup.ts`. Returns `true` when no county is selected (no-op).
3. In `filteredCommunityServices` and `filteredBehavioralHealthServices` memos, after the existing category filter, also drop services whose coordinates fail `isInsideSelectedCounty`.

Effects:

- Lander click no longer renders the two stray pins in Winnemucca/Lovelock.
- Same logic applies whenever any county is selected — pins are guaranteed to render inside the polygon.
- `filteredRuralServices` is unchanged, so detail-panel counts and "Local Resource Network" entries stay intact.
- Facilities (provider pins) are out of scope — the reported issue is service pins only. Facility data is centrally curated and already coordinate-validated.

## Scope

- One file: `src/components/map/MapView.tsx` (lines ~789–806 region only).
- No changes to data files, panel code, or rendering layers.
