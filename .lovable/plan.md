
# Nye Rural Dataset Integration — Final Plan (v5)

Final addendum to the previously approved plan. Adds duplicate-field resolution, a minimum-usability rule, and schema version tagging. Everything else from v4 stands unchanged.

## Delta from v4

### 1. Duplicate field resolution (graduated, not all-abort)

`resolveHeaders()` returns two separate buckets instead of one `conflicts` list:

```ts
HeaderResolutionResult {
  status: 'allowed' | 'blocked'
  matchedExact: Array<{ source, canonical }>
  matchedViaAlias: Array<{ source, canonical }>
  unmapped: string[]
  missingRequired: string[]
  blocking_conflicts: Array<{ canonical, sources: string[] }>
  non_blocking_duplicates: Array<{
    canonical, primary: string, secondaries: string[]
  }>
}
```

**Identity-critical canonicals — hard abort on duplicate**
- `name`
- `address`
- `phone`

Two source headers resolving to any of these → `blocking_conflicts` entry, `status: 'blocked'`, import refused.

**Safe canonicals — non-blocking duplicate, append-only merge**
- `services_offered` (e.g. `description` + `services_offered`)
- `access_notes` (e.g. `notes` + `review_notes` + `access_notes`)
- `service_tags`

Resolution rule for safe duplicates:
- First encountered header wins as **primary source** (used as the field's base value)
- Additional headers become **secondary append-only sources**
- Per-row, secondaries flow through the existing controlled append helper (noise filter + dedupe + max-length cap from prior plans)
- Recorded once per file in the resolution report and once in the audit `details.duplicate_field_sources`

All other canonicals (city, state, zip, county, email, website, latitude, longitude, resource_class, mappable) remain hard-conflict if duplicated, since merge order would change record identity or geometry.

### 2. Minimum usability rule (per-row, non-blocking)

Inside `csvToStagingService`, after field mapping:

```ts
const hasLocation = !!(row.county || row.city || row.street_address);
const hasContact  = !!(row.phone || row.website);

if (!hasLocation && !hasContact) {
  row.mappable = false;
  row.validation_messages.push({
    severity: 'warning',
    field: 'name',
    message: 'Insufficient operational data — no usable location or contact information',
  });
}
```

Row is still ingested (list-only reference). `mappable=false` already excludes it from the map per the `useLiveVerifiedRecords` filter from prior plans. No new branch.

This rule runs **after** the government-default and category-normalization steps, so it cannot interfere with them.

### 3. Schema version tagging (audit-only)

Every audit entry written through this ingestion path includes:

```json
{ "schema_version": "nye_ingestion_v5" }
```

Applied in `mapping_audit_log.details` for:
- `header_resolution`
- `upload_started` / `upload_completed` (staging insert / import batch)
- `record_edited` written by the controlled upsert
- `record_edited` written for match-conflict flagging

No schema column. No table change. Filterable via JSONB query when needed.

### Updated header report example

```
Header Resolution Report
  Matched (exact):       name, city, state, zip, phone
  Matched (via alias):   address (← address_1)
  Non-blocking duplicates:
    services_offered  primary=description, append=services_offered
    access_notes      primary=notes, append=review_notes
  Unmapped (ignored):    internal_id
  Missing required:      (none)
  Blocking conflicts:    (none)
  → Import allowed: YES
```

If `blocking_conflicts.length > 0`:
```
  Blocking conflicts: name (source: name, provider_name)
  → Import allowed: NO    [Stage rows disabled]
```

## Files (delta from v4)

**Edited**
- `src/utils/serviceHeaderResolver.ts` — split `conflicts` into `blocking_conflicts` + `non_blocking_duplicates`; classify canonicals into identity-critical vs safe-append sets
- `src/utils/mappingPipelineCsv.ts` — accept `resolvedMap` with secondary sources, append safe duplicates per row, add minimum-usability check
- `src/utils/mappingPipelineStore.ts` — inject `schema_version: 'nye_ingestion_v5'` in all audit payloads on this path
- `src/types/mappingPipeline.ts` — updated `HeaderResolutionResult`; small `DuplicateFieldMapping` type
- `src/pages/AdminMappingServices.tsx` — render non-blocking duplicates as warnings; keep "Stage rows" enabled unless `blocking_conflicts.length > 0`

## Schema additions across the full plan (final, locked)

Only four columns total — all on `staging_services`, three mirrored on `verified_services`:
- `service_tags text`
- `resource_class text` (default `service`)
- `mappable boolean default true`
- `match_conflict boolean default false` *(staging only)*

No further schema changes.

## Constraints honored
- Identity-critical duplicates still hard-abort (no silent guessing on `name`/`address`/`phone`)
- Append-only merges already use noise filter, dedupe, and max-length caps from prior plans
- Minimum-usability rows are kept (list-only) rather than dropped — no data loss
- Audit version tag is metadata-only; no schema creep
- Provider/BH/verification/presentation logic untouched
- Existing default Services upload flow unchanged; v5 logic gated behind Nye mode flag
