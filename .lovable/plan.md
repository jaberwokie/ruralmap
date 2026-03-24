

## Deduplicate Cross-Layer Pins

### Problem
Multiple facilities appear as pins in **both** the Provider Locations layer (from `facilities.ts`) and the Rural Services / Behavioral Health layer (from `rural-services.ts`), producing 2-3 stacked pins at the same address. The user screenshot shows this at South Lyon Medical Center in Yerington.

### Identified Duplicates

Records in `rural-services.ts` that duplicate entries already in `facilities.ts`:

| Rural Service ID | Name | Duplicates Facility ID |
|---|---|---|
| rs-143 | South Lyon Medical Center | h7 |
| rs-178 | William Bee Ririe Hospital | h5 |
| rs-179 | Nevada Health Centers Ely | c5 |
| rs-104 | Humboldt General Hospital | h9 |
| rs-77 | Nevada Health Centers - Elko | c4 |
| rs-163 | Nevada Health Centers Pahrump | c1 |
| rs-126 | Grover C. Dils Medical Center | h10 |
| rs-164 | Desert View Hospital BH Services | h1 (same address, BH dept) |

Additionally, within `facilities.ts` itself:
- **t7** (Carson Tahoe Physician Clinics) shares the exact same address/coordinates as **h3** (Carson Tahoe Regional Medical Center) — these are legitimately different entities (hospital vs. physician clinic) but stack visually.

### Changes

**File: `src/data/rural-services.ts`**
- Remove the 7 records that are exact name+address duplicates of hospitals/clinics already in `facilities.ts`: rs-143, rs-178, rs-179, rs-104, rs-77, rs-163, rs-126
- Keep rs-164 (Desert View Hospital **BH Services**) — it's a distinct service department at the same address, which is a valid separate entry for the services layer

### What stays the same
- All facility records in `facilities.ts` (no changes)
- All non-duplicate rural service records
- Map rendering, tooltip, and clustering logic
- The overlap resolution system will continue to handle legitimate co-located but distinct services

### Impact
- Eliminates 7 duplicate pins that appear when both Provider Locations and Rural Services layers are active
- South Lyon Medical Center will show as a single hospital pin instead of a hospital + green service pin stacked together
- Same fix applies to William Bee Ririe, Humboldt General, NHC clinics, and Grover C. Dils

