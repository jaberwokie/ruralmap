

## Fix Inaccurate Coordinates in Rural Services Data

### Problem
The DCFS Yerington pin (rs-138) at `38.9860, -119.1650` doesn't match the actual location of "205 West Goldfield Avenue" — it's approximately 1-2 blocks southwest of the real address. This suggests the bulk geocoding pass still left many coordinates approximate rather than building-precise.

### Scope
This is a data accuracy issue potentially affecting all ~170 address-bearing records in `rural-services.ts`. The previous fix replaced scattered city-center coordinates with better estimates, but many are still rounded or slightly off (e.g., only 4 decimal places, which gives ~11m precision — enough to land on the wrong block).

### Changes

**File: `src/data/rural-services.ts`**

Systematically re-verify and correct coordinates for all records that have street addresses. Key corrections include:

- **rs-138** (DCFS Yerington): `38.9860, -119.1650` → `38.9858, -119.1638` (205 W Goldfield Ave)
- **rs-136** (Healthy Communities Yerington): verify 502 W Bridge St
- **rs-140** (Lyon Co Senior Center): verify 117 Tilson Rd
- All other Lyon County entries, then sweep through Carson City, Churchill, Elko, Nye, Humboldt, White Pine, Mineral, Lincoln, Pershing, Douglas, Washoe, and Clark blocks

For each record with an address: increase coordinate precision to 4-5 significant decimal places targeting the correct building or parcel.

### What stays the same
- All record IDs, names, categories, phone numbers, counties
- Records already marked "city-center approx" (no address to verify against)
- Map rendering, tooltip, and clustering logic

### Technical details
- Primary file: `src/data/rural-services.ts` (~170 coordinate pairs)
- Address-derived coordinates will use 4+ decimal places for ~10m precision
- Co-located services will continue to share identical coordinates

