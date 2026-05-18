## Audit results

I scanned the admin pages for no-op handlers. Findings:

### Confirmed unwired (user-visible buttons that do nothing)

1. **`/admin/mapping/rural-services`** (`src/pages/AdminMappingRuralServices.tsx`)
   - `onPromote` — no-op. Same bug we just fixed on Facility Mapping.
   - `onReject` — no-op.
   - `onUpload` — no-op. The Upload CSV button in PipelineWorkspace is always rendered, so clicking it does nothing.

2. **`/admin/mapping/facilities`** (`src/pages/AdminMappingFacilities.tsx`)
   - `onUpload` — still no-op. Upload CSV button does nothing. (Promote/Reject were fixed in the last pass.)

### Not actually broken (no-ops by design)

3. **`/admin/mapping/facilities/staging`** and **`/admin/mapping/rural-services/staging`**
   - `onDeactivate` is a no-op, but these pages pass `verifiedRows={[]}`, so the Deactivate button is never rendered. Safe to leave.

## Proposed fixes

### A. Wire Rural Services live-management page (mirror of the Facility Mapping fix)

`src/pages/AdminMappingRuralServices.tsx`:
- `onPromote(id)` → `editRuralServiceRecord(id, { review_status: 'approved', verification_status: 'verified' })`, toast, refresh.
- `onReject(id)` → `editRuralServiceRecord(id, { review_status: 'rejected' })`, toast, refresh.

### B. Decide what to do about the Upload CSV button on the live-management pages

These two pages (`/admin/mapping/facilities` and `/admin/mapping/rural-services`) operate on already-live records. The actual CSV upload flow lives on the dedicated staging pipeline pages (`/admin/mapping/facilities/staging`, `/admin/mapping/rural-services/staging`).

Two options — pick one:
- **Option 1 (recommended):** Route the Upload button on the live page to the staging page. `onUpload` becomes a redirect to `/admin/mapping/facilities/staging` (or rural equivalent) with a toast explaining where uploads happen. Keeps the UI honest without duplicating the pipeline.
- **Option 2:** Hide the Upload section entirely on these pages. Would require a small `PipelineWorkspace` prop (e.g. `hideUpload`) to suppress that section. More invasive.

### C. Leave staging-page `onDeactivate` alone

Those pages never render the Deactivate button, so no work needed.

## Question for you

Which Upload behavior do you want on the live-management pages — **Option 1 (redirect to staging)** or **Option 2 (hide the upload block)**? I'll wire Promote/Reject on the Rural Services page either way.