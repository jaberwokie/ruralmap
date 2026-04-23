
Fix the real source of the white-circle bleed: it is not just the radius layer. The current `coverageGaps` geometry in `src/components/map/MapView.tsx` still subtracts hospital/clinic buffers even when `Provider Locations` is off, so the red gap polygon leaves white circular holes behind.

## What to change

### 1) Build one shared active coverage source list in `src/components/map/MapView.tsx`
Create a single memoized provider list used by both:
- the Access View radius renderer
- the Access Gaps geometry builder

It should include only active sources:
- `layers.serviceLocations` (or `topProvidersOnly`) → hospitals + clinics from the facility dataset
- `layers.behavioralHealth` → behavioral health locations from `ruralServices`

Structure:
```ts
const activeCoverageProviders = useMemo(() => {
  const providerFacilities = (topProvidersOnly ? providerVisibleFacilities : filteredFacilities)
    .filter((f) => Number.isFinite(f.lat) && Number.isFinite(f.lng))
    .filter((f) => {
      if (f.type === 'hospital' || f.type === 'clinic') return layers.serviceLocations || topProvidersOnly;
      return false;
    });

  const behavioralHealthProviders = layers.behavioralHealth
    ? ruralServices.filter((s) => isBehavioralHealthService(s) && Number.isFinite(s.lat) && Number.isFinite(s.lng))
    : [];

  return [
    ...providerFacilities.map((p) => ({ lat: p.lat, lng: p.lng, kind: 'provider' as const, source: p })),
    ...behavioralHealthProviders.map((p) => ({ lat: p.lat, lng: p.lng, kind: 'behavioralHealth' as const, source: p })),
  ];
}, [...]);
```

### 2) Gate the radius render effect off that shared list
In the coverage-radius effect:
- keep `if (!coverageRadius) return`
- replace the current local `hasActiveRadiusSources` / `visibleFacilities` logic with the shared list
- if `activeCoverageProviders.length === 0`, return after clearing layers
- render circles from `activeCoverageProviders`

This keeps the current radius math and styling, but removes stale or mismatched radii.

### 3) Gate the Access Gaps geometry off the same shared list
In the `coverageGaps` effect:
- remove the current ungated `hospitalAndClinicPoints = facilities.filter(...)`
- use `activeCoverageProviders` as the only subtraction input

Behavior becomes:
- no active sources → full Nevada gap polygon, no white holes
- only Provider Locations active → only hospital/clinic coverage subtracts
- only Behavioral Health active → only BH coverage subtracts
- both active → both subtract

### 4) Leave everything else alone
Do not touch:
- radius distance math
- gap morphology / `buffer` / `union` / `difference`
- pane stacking
- Nevada clipping
- `coverage-radius--gap`
- circle fill/stroke styling
- clustering
- marker rendering
- county logic

## Why this fixes the screenshot
The screenshot shows white circles even with source toggles off because the gap polygon is still being cut by hospital/clinic coverage from an ungated dataset. Reusing one active provider list removes that mismatch.

## File to patch
- `src/components/map/MapView.tsx`

## QA to run after implementation
- Provider Locations OFF + Behavioral Health OFF + Access Gaps ON → no white circles/holes anywhere; Nevada fills as a full gap
- Provider Locations ON + Behavioral Health OFF → only hospital/clinic coverage appears
- Provider Locations OFF + Behavioral Health ON → only BH coverage appears
- Both ON → combined behavior
- Distance to Provider OFF → no radius circles render
- Access Gaps ON still works, but only from active sources
- Recent pane-stacking and Nevada clipping fixes remain unchanged

## Report back after implementation
- where the shared active coverage provider list was constructed
- that both the radius renderer and gap geometry now use it
- confirmation that radius math, gap morphology, pane order, and styling were untouched
