

## Verify and Correct ~50 Approximate Coordinates in Rural Services

### Problem
After the bulk geocoding pass, approximately 50 records in `rural-services.ts` still have only 4-decimal-place precision (round numbers like `38.9480, -119.7440`), indicating they were estimated rather than geocoded to a specific building. These all have street addresses that can be verified.

### Scope

Records with addresses but only 4-decimal (~11m) precision, grouped by county:

**Carson City** (6 records): rs-5, rs-17, rs-18, rs-22, rs-23, rs-33
**Churchill** (5): rs-37, rs-40, rs-45, rs-48, rs-49
**Douglas/Gardnerville** (12): rs-53, rs-54, rs-55, rs-57, rs-58, rs-59, rs-60, rs-61, rs-62, rs-63, rs-65, rs-66
**Elko** (2): rs-73, rs-84
**Humboldt** (2): rs-102, rs-106
**Lander** (4): rs-110, rs-111, rs-113, rs-114/rs-116
**Lincoln** (2): rs-119, rs-122
**Lyon** (8): rs-128, rs-129/rs-130, rs-135, rs-140, rs-142/rs-147, rs-145, rs-148
**Mineral** (4): rs-151, rs-152, rs-153, rs-156
**White Pine** (2): rs-172, rs-176

### Changes

**File: `src/data/rural-services.ts`**

For each of the ~50 records listed above, look up the street address and update the `lat`/`lng` values to 5-decimal-place building-level coordinates. Records sharing the same physical address will get identical coordinates.

### What stays the same
- All record IDs, names, categories, phone numbers, counties
- Records with `notes: "city-center approx"` (no address to verify)
- Records already at 5-decimal precision from the previous geocoding pass
- Map rendering, tooltip, and clustering logic

### Technical details
- Primary file: `src/data/rural-services.ts`
- ~50 coordinate pairs will be updated to 5-decimal precision
- Will use AI-assisted address lookup to determine correct building-level coordinates
- Co-located services (same address, different suites) will share identical coordinates

