

## Audit: Pin-to-Address Accuracy Across All Data Layers

### Findings

**Facilities (`facilities.ts`) — 38 records**

Hospitals (h1–h15) and base clinics (c1–c8) appear reasonably geocoded with building-level precision. The recent t1–t15 corrections improved Clark/Nye/Elko providers. Remaining issues:

- **c3** ("Nevada Health Centers Fallon"): address is just "E Williams Ave" — no street number, coordinate is approximate
- **c5** shares the exact same address as **h5** (1500 Avenue H, Ely) but has a slightly different lat/lng — likely co-located, coordinates should match exactly
- **t4** (Mindspace, Henderson): address says Henderson but city field says "Las Vegas" — should be "Henderson"
- **t1** (Beautiful Mind): `dataConfidence` is "Likely Accurate" — coordinate is corridor-placed, not verified to the building at 4955 S Durango Dr

**Rural Services (`rural-services.ts`) — 180 records: SYSTEMIC ISSUE**

Nearly all 180 rural service coordinates are **manually scattered from city-center points**, not geocoded from their listed addresses. The file even defines a `scatter()` helper (line 38) for this purpose. Evidence:

- Carson City services (rs-1 through rs-33): all coordinates cluster in a ~0.02-degree band around `39.16, -119.77` regardless of actual address
- Fallon services (rs-34 through rs-52): all cluster around `39.47, -118.78`
- Gardnerville, Elko, Winnemucca, etc. — same pattern
- Services that share the same physical address have **different** coordinates (e.g., rs-34, rs-36, rs-38 all at "270 S. Maine Street" Fallon but each has unique lat/lng)
- Services with no address at all still have coordinates (city-center fallbacks)

This means **every green and purple service pin is approximate to within ~0.5–1 mile of its true location**.

### Proposed Fix

**Phase 1 — Facility data cleanup (small, immediate)**

File: `src/data/facilities.ts`
- Fix **t4** city to "Henderson"
- Align **c5** coordinates to match **h5** (co-located)
- Add street number to **c3** address ("490 E Williams Ave" per NHC records)
- Upgrade t1 confidence after address verification

**Phase 2 — Rural services geocoding (large, systematic)**

File: `src/data/rural-services.ts`
- For all 180 records that have a street address: replace the scattered city-center coordinates with address-derived GPS coordinates
- For records sharing the same physical address: use identical coordinates (not artificial scatter)
- For records with no address: keep current city-center approximation but add `notes: "city-center approx"`
- Remove the unused `scatter()` helper function

This is a data-intensive update affecting ~150+ coordinate pairs. The addresses are already in the data — the coordinates just need to match them.

### What stays the same
- All names, categories, phone numbers, county assignments
- Map rendering logic, tooltip behavior, cluster settings
- Facility hospitals and most clinic coordinates (already building-level)

### Impact
- All green (service) and purple (behavioral health) pins will render at their actual street addresses instead of scattered city-center approximations
- Same-address services will stack correctly and be handled by the existing overlap resolution logic
- Pin-to-address verification via tooltips will show accurate alignment

