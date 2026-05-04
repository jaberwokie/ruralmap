
## Goal

Add a controlled category system to the existing Services ingestion pipeline. Preserve every other piece of the pipeline (staging, verified, dedup, geocode, audit, RLS, routes, UI shell). No changes to Provider or BH ingestion.

## Scope (additive only)

- Add two columns to `staging_services` and `verified_services`:
  - `category_raw text` — original CSV value, never mutated after import
  - `category_mapped text` — one of the 15 controlled values, or null
- Add an auto-mapper that assigns `category_mapped` from `category_raw` using a synonym table; unknowns leave it null.
- Block promotion when `category_mapped` is null (parallel to how blocked imports work today).
- Add a category-mapping control to the staging review (edit dialog dropdown) so admins can set/correct `category_mapped`.
- Existing free-text `service_category` column stays untouched to avoid breaking the active map layer; it is now redundant with `category_raw` but removing it would be a non-additive change.

## Controlled category list (locked)

Food, Housing, Transportation, Medical, Behavioral Health, Substance Use, Senior Services, Disability Services, Financial Assistance, Employment, Legal, Domestic Violence, Clothing, Utilities, Community Support.

## Auto-mapping rules

Case-insensitive substring match on `category_raw` against a synonym table. First match wins. Examples:

```text
food, pantry, meal, food bank          -> Food
shelter, transitional housing, housing -> Housing
bus, rideshare, transport, mobility    -> Transportation
clinic, primary care, medical, health  -> Medical
counsel, therapy, mental health, bh    -> Behavioral Health
substance, sud, detox, mat, recovery   -> Substance Use
senior, elder, aging                   -> Senior Services
disab, idd, accessib                   -> Disability Services
financ, benefit, assist, utility help  -> Financial Assistance
employ, job, work, vocational          -> Employment
legal, attorney, law                   -> Legal
domestic violence, dv, ipv             -> Domestic Violence
cloth, apparel                         -> Clothing
utility, power, water, energy          -> Utilities
community, peer, outreach, support     -> Community Support
```

No match -> `category_mapped = null`. Row still enters staging.

## Files

**New**

- `src/utils/serviceCategoryMap.ts` — exports `SERVICE_CATEGORIES` (15 values), `autoMapCategory(raw)`, type `ServiceCategory`.

**Migration (new)**

```sql
ALTER TABLE public.staging_services
  ADD COLUMN category_raw text,
  ADD COLUMN category_mapped text;

ALTER TABLE public.verified_services
  ADD COLUMN category_raw text,
  ADD COLUMN category_mapped text;
```

No CHECK constraint on `category_mapped` (we enforce in app to keep it additive and reversible). RLS untouched.

**Edited (minimal)**

- `src/types/mappingPipeline.ts` — add `category_raw` + `category_mapped` to `StagingServiceRow` and `VerifiedServiceRow`.
- `src/utils/mappingPipelineCsv.ts` — in `csvToStagingService`, populate `category_raw = row.service_category`, then `category_mapped = autoMapCategory(category_raw)`.
- `src/utils/mappingPipelineStore.ts` — in `promoteStagingService` (and the bulk variant), reject rows whose `category_mapped` is null with a clear reason; carry the two columns through to `verified_services` insert.
- `src/pages/AdminMappingServices.tsx`:
  - Add a `Category` column showing `category_mapped` with a small badge if null ("Needs mapping").
  - Add `category_mapped` to `EDITABLE_FIELDS` as a `select` with the 15 controlled values.
  - Add a one-line note in the validation rules block: "Promotion blocked until category_mapped is set."
- `src/components/admin/EditRecordDialog.tsx` — extend `EditableField` with optional `type: 'select'` + `options: string[]` (the dialog already handles other types; this is the smallest extension needed).

**Untouched (verified)**

- Provider pipeline (`AdminMappingProviders.tsx`, `csvImport.ts`, `importedFacilitiesStore.ts`).
- BH pipeline (`AdminMappingBehavioralHealth.tsx`, `staging_bh`, `verified_bh`).
- Verification Queue, Audit History, map layers, filters, public/private behavior.
- `serviceUpsertMatch.ts` dedup logic (already matches your spec: name+city+county -> name+phone -> name+address).
- RLS policies.

## Promotion gate

In `promoteStagingService` and `promoteStagingServicesBulk`:

- If `row.category_mapped` is null or not in the controlled list, skip with reason `"category_mapped required"` and surface in the existing toast/failures UI.
- Bulk promote already returns `{promoted, skipped, failed, failures}` — reuses that path, no new UI shape.

## Map-facing behavior

- Map layer continues to read from `verified_services` exactly as today. No renderer changes.
- Records without coords still respect the existing `mappable` flag (list-only in county panels, no pin). Unchanged.

## Audit

Promotions, rejections, and edits already write to `mapping_audit_log` via `mappingPipelineStore`. The new columns are included in the existing `details` payload by virtue of being on the row. No new audit action types.

## Verify after build

- Typecheck clean.
- `/admin/mapping/services` loads, shows new `Category` column.
- Upload a CSV with `service_category = "food pantry"` -> stages with `category_raw="food pantry"`, `category_mapped="Food"`, promotable.
- Upload with `service_category = "frobnicator"` -> stages with `category_raw="frobnicator"`, `category_mapped=null`, promote attempt skipped with "category_mapped required". Set via edit dialog -> promote succeeds.
- Provider upload at `/admin/mapping/providers` still works unchanged.
- BH page renders unchanged.
- Map Services layer renders the same pins.
