

## Plan: Replace Test Tier 1 Data with Real CSV Data

**What changes:**

1. **`src/data/facilities.ts`** — Remove the 4 test Tier 1 entries (t1–t4) and replace with 15 real providers from the uploaded CSV. Each will have:
   - `type: "tier1"`, `tier: "tier1"`
   - A `service` or `notes` field indicating BH or PCP
   - A `volume` field added to the `Facility` interface (optional number) to capture visit volume data
   - Unique IDs (`t1`–`t15`)

2. **`src/data/facilities.ts` (interface)** — Add optional `volume?: number` and `service?: string` fields to the `Facility` interface to preserve the CSV's Volume and Service columns.

3. **`src/components/map/DetailPanel.tsx`** — Display volume and service type in the detail panel when available (e.g., "BH · 9,533 visits").

**Note:** Many Las Vegas/Clark County providers share the same coordinates (36.1699, -115.1398). They will stack on the map — the existing marker click behavior will still work, though clustered markers will overlap. This is accurate to the source data.

