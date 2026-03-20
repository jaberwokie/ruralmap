
Goal

Add a lightweight “Data Confidence” layer for facilities so users can see whether a facility record is Verified, Likely Accurate, or Unverified in the facility detail/hover experience, without changing the map’s visual hierarchy.

What I found

- Facility data lives in `src/data/facilities.ts` and already has a clean classification system.
- The map and detail panel already centralize facility labels through helpers like `getFacilityClassification()` and `getFacilityTypeLabel()`.
- There is already a separate internal validation utility in `src/utils/facilityValidation.ts` with location-quality signals:
  - `verified`
  - `approximate`
  - `manual_review`
- Facility markers already consume that validation utility in `MapView.tsx`, but only for dev-mode validation styling/popup behavior.
- The sidebar filter system currently supports only:
  - type
  - county
  - service category
- You chose: no sidebar confidence filter for now.

Implementation plan

1. Add a public-facing confidence field to the facility model
- Extend `Facility` in `src/data/facilities.ts` with:
  - `dataConfidence: 'Verified' | 'Likely Accurate' | 'Unverified'`
- Add a shared label/type helper so UI uses one consistent source.

2. Auto-assign initial confidence using existing validation signals
- Reuse the logic already encoded in `src/utils/facilityValidation.ts` instead of inventing a second audit system.
- Map current validation signals into the new public confidence tiers:
  - `verified` + exact/trusted record context → `Verified`
  - `approximate` / street-level / reasonable address-based records → `Likely Accurate`
  - `manual_review`, generic facility classification, shared city-center fallback coordinates, malformed/conflicting location signals → `Unverified`
- Add a small helper in the facility data layer so assignments are deterministic and easy to update later.

3. Ensure every facility gets a confidence value
- Populate `defaultFacilities` through the new helper or explicitly attach confidence on every record.
- Keep this separate from visual facility classification so “type” and “confidence” do not get conflated.

4. Surface confidence in the UI subtly
- Update facility tooltip content in `src/components/map/MapView.tsx` to add:
  - `Data Confidence: Verified | Likely Accurate | Unverified`
- Update `FacilityContent` in `src/components/map/CoverageDetailPanel.tsx` to show the same line in small muted text.
- Keep styling neutral:
  - no icons
  - no bright warning colors
  - no source-detail exposure

5. Keep map impact minimal
- Do not add map labels, badges, or new symbols.
- Optional implementation detail:
  - only slightly reduce opacity for `Unverified` provider markers if it can be done subtly and consistently
  - otherwise leave map markers unchanged and keep confidence purely in tooltip/detail UI

6. Add audit support for internal review
- Extend the existing audit utilities in `src/data/facilities.ts` and/or `src/utils/facilityValidation.ts` to summarize:
  - total facilities
  - counts by confidence level
  - list of unverified facility names/ids
  - any missing confidence assignments
- Log the summary in dev mode from `src/pages/Index.tsx`, similar to the current classification audit.

7. Preserve current architecture
- No change to service presence, hospital/provider layer toggles, legends, or clustering.
- No public exposure of source-address or validation-notes details beyond the single confidence label.

Likely file changes

- `src/data/facilities.ts`
  - add `DataConfidence` type and helpers
  - assign/derive `dataConfidence`
  - add confidence audit helper
- `src/utils/facilityValidation.ts`
  - optionally add a mapper from internal validation confidence to public data confidence
- `src/components/map/MapView.tsx`
  - add `Data Confidence` line to facility tooltip
  - optionally apply a very subtle unverified opacity adjustment
- `src/components/map/CoverageDetailPanel.tsx`
  - add `Data Confidence` row to facility detail panel
- `src/pages/Index.tsx`
  - log dev-only confidence audit summary

Technical details

```text
Recommended mapping:
- verified -> Verified
- approximate -> Likely Accurate
- manual_review -> Unverified

Additional rule overrides:
- classification === 'facility' -> Unverified
- malformed / outside-county / shared fallback city-center patterns -> Unverified
```

Acceptance criteria

- Every facility has a confidence level
- Facility tooltip shows Data Confidence
- Facility detail panel shows Data Confidence
- No new visual clutter is added to the map
- Unverified records are easy to identify in the panel, but not alarmist
- Dev audit can list unverified facilities for future cleanup
