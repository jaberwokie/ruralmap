# Iterum Rural Access Nevada — ingestion audit and consolidation plan (read-only)

Nothing in this project or its database was changed. Evidence came from reading files, searching the code, and running aggregate counts (no member rows, no secret values). `tsc --noEmit` and the test suite were **not run**. I read CLAUDE.md in full. For CONTEXT.md I read only its outline plus §6, §10 (tables) and §11–12, not all of it. That was less than you asked for, so the full read is step 0 of implementation.

## 1. Current pipelines (evidence-backed)

```text
A. Services (SDoH)
/admin/mapping/services -> mappingPipelineCsv + serviceHeaderResolver + serviceCategoryMap
 -> staging_services (514: 422 "clean_services_upload.csv" pending, 92 Nye xlsx approved)
 -> serviceValidation / serviceUpsertMatch (dedupe) -> promoteStagingService(Bulk)
 -> verified_services (92, all from Nye_Rural_App_Ingestion_Schema.xlsx)
 -> useLiveVerifiedRecords -> ServiceMarkerLayer, Sidebar, Decision Assist

B. Behavioral health
/admin/mapping/behavioral-health -> mappingPipelineCsv + bhCategoryMap/bhAccessTags/bhSourceTrust
 -> staging_bh (69) -> promoteStagingBh -> verified_bh (69: 56 bh_physical_sites.csv, 13 bh_telehealth.csv)
 -> useLiveVerifiedRecords -> BehavioralHealthMarkerLayer; /admin/mapping/behavioral-health-live reads verified_bh

C. Facilities (hospitals/clinics)
/admin/mapping/facilities-staging -> staging_facilities (56) -> promoteStagingFacility
 -> facilities (53 live) -> staticDataStore.listFacilitiesFromDb -> useFacilityData -> ProviderMarkerLayer
 Fallback: if DB returns 0 rows, src/data/facilities.ts (defaultFacilities) renders instead.
 Also merged in: importedFacilitiesStore (browser localStorage), fed by /admin/mapping/providers via csvImport.

D. Rural services (legacy SDoH set)
/admin/mapping/rural-services-staging -> staging_rural_services (175) -> rural_services (172)
 -> staticDataStore.listRuralServicesFromDb -> useRuralServiceData (+ src/data/rural-services.ts, enriched-rural-services.ts)

E. Provider staging
/admin/mapping/providers -> providerStagingStore -> staging_providers (0 rows) -> geocode review only; no promotion target found.

F. Seeding: seedStaticData (called from AdminMappingServices) writes static TS arrays into facilities / rural_services.
```

Geocoding has three separate jobs. Keep them separate:
- **Public resources:** `geocode-address` / `geocode-bulk` check the internal cache in `geocode_resolutions` first, then call the free Census geocoder. Coordinates are written onto the resource row. `census-geocode` is decommissioned.
- **Member address:** `resolve-address` uses the internal TIGER street table (`tiger_street_ranges`: 273,192 rows, 17 counties) and saves nothing. `geocode_resolutions` holds 0 rows right now.
- **Manual correction:** the `manual_lat`/`manual_lng` columns plus `coordinate_locked` on the record itself.

## 2. Status of each part

| Item | Status | Evidence |
|---|---|---|
| A, B (staging -> verified) | Active | Live rows plus map consumers |
| C facilities DB path | Active | 53 live rows, `useFacilityData` |
| C static fallback `data/facilities.ts` | Redundant (the DB is populated) | Only used when the DB is empty |
| C `importedFacilitiesStore` / `csvImport` | Legacy, saves to the browser only | Merged into the map list; not stored in the DB |
| D `rural_services` + `staging_rural_services` | Active, but overlaps A in purpose | Two separate services models exist |
| E `staging_providers` + `providerStagingStore` | Uncertain / dead | 0 rows, no promotion path |
| F `seedStaticData` | Legacy | One-time migration helper |
| `/admin/mapping/import` (80 lines), `/verification-queue` (26 lines) | Uncertain (hub or stub) | Small pages; contents not reviewed in depth |
| `/admin/provider-mapping-import` | Redundant | A redirect only |

## 3. Minimal safe consolidation for the new product

Target: one intake per entity, `CSV -> staging_<entity> -> validate/dedupe -> verified_<entity> -> map`.
- Entities: `verified_facilities` (hospitals/clinics), `verified_bh`, `verified_services` (absorbs `rural_services`). Later: `verified_pharmacies`, using the same shared contract.
- One shared parser (`mappingPipelineCsv` + header resolver) and one shared promotion function per entity.
- Dedupe priority, carried over unchanged: NPI -> name + county + city -> phone -> address.
- Remove the static fallback arrays once the data is preserved in the DB. An empty DB should show an explicit empty state, not old built-in data.

**Proposed for removal** (the dependencies were found by search; each needs a final reference check before deletion):
- Pages: `AdminMappingProviders`, `AdminMappingProviderMetadata`, `AdminMappingImport`, `AdminMappingVerificationQueue`, `AdminUnmappedProviders`, `AdminMetrics`, `AdminTraining`, `Ops*`, `Briefing`, and the redirect route.
- Helpers: `importedFacilitiesStore`, `csvImport`, `providerStagingStore`, `seedStaticData`, `providerEnrichment*`, `providerNotesStore`, `unmappedProviders`, `verificationCsvImport`, `verificationPriorityQueue`.
- Static data, after export: `data/facilities.ts`, `data/rural-services.ts`, `enriched-rural-services.ts`.
- Several map files import these (Sidebar, MapView, Decision Assist, accessGaps, memberAccess), so removal must happen in dependency order.

**Fields and provenance to keep:**
- Identity, address and contact: name, address, phone, website, county, NPI.
- Category and service-type fields.
- `lat`/`lng`, `geocoded_*`, `manual_*`, `coordinate_source/locked/confidence`, `geocode_provider/match_type`, `last_geocoded_at`.
- `verification_status/source/date/confidence`, `source_file_name`, `source_row_number`, `import_batch_id`.
- `promoted_at`, `staging_id`, the soft-delete columns.
- The `data_sources` registry (20 rows), plus `data_source_runs` / `data_source_snapshots`.

## 4. Must NOT migrate into an independent product

- **Claims and utilization:** `data/utilization.ts`, `provider-utilization`, `sshpCatchments`, `public/data/utilization/*`, `providerClaimsMetrics`, `utilizationAggregation`, the Tier 1 claims logic.
- **Staffing:** `fte-capacity`, `fieldResponseStrain`, `fieldCoverageStatus`, `remoteSupportPlacement`, the field-hub constants.
- **Member and engagement data:** `member-volume`, `engaged-member-volume`, `engagementOwnership`.
- **Branding and payer content:** NBH/NovumHealth logos and QR code, SilverSummit/payer content, the `mobility-managers` notes, NBH-specific help and training text.
- **Accounts and logins:** `handle_new_user` has two personal emails hard-coded as sysop. Leave out `user_roles`, `pending_admin_emails`, `user_events`, `invite-user` and all auth users. Write a fresh role setup instead.
- **Member-address lookup** (`resolve-address`, TIGER): do not include it in the first version. No CareSource member flow exists, and adding it reintroduces PHI scope.
- **Records excluded until reviewed:** `staging_services` rows still pending review (422) — move only verified rows. All `mapping_audit_log` rows (it records who did what and when).

## 5. Isolation: unverified

The platform documentation describes a remix as copying the codebase. It does not say whether a remix gets its own database, copies data or secrets, or shares this backend. **Isolation is not assumed.** Checks to run inside the new project before any data load:
1. Its backend project ID differs from this project's (in its project settings and `.env`).
2. Its row counts are 0 (or its tables don't exist yet) for `facilities`, `verified_*`, `geocode_resolutions`, `user_roles` and auth users.
3. Its secrets list does not contain `GEOCODE_CACHE_HMAC_SECRET` or any `MEMBER_GEOCODER_*` / `AZURE_*` secrets carried over from this project.
4. A test write in the new project leaves this project's counts unchanged (re-run the aggregate counts here).

Safer than remixing: start a fresh project and move data in as exported CSVs of verified public rows only.

## 6. Data preservation checks (before and after the move)

- Row counts per verified table: 53 / 69 / 92 / 172.
- Counts per `source_file_name`.
- Count of rows with locked or manual coordinates.
- A checksum of id + lat/lng + name for each table.
- Spot-check 10 pins per category on the map.

## 7. Exact first implementation scope (in the new project, not this one)

0. Read CONTEXT.md in full.
1. `supabase/migrations/<new>_resource_core.sql`:
   - `data_sources` registry.
   - `staging_/verified_` tables for facilities, bh and services, with the provenance and coordinate columns.
   - Row-level security: public read of verified, non-deleted rows; admin-only writes.
   - New `app_role`, with no hard-coded emails.
2. `supabase/functions/_shared/resourceTableContracts.ts`, `geocode-address`, `geocode-bulk`: port these, Census only, with the cache-first order.
3. `src/utils/resourcePipelineStore.ts`: one module covering list, upload, validate, dedupe and promote for all entities. It replaces `mappingPipelineStore`, `providerStagingStore`, `importedFacilitiesStore` and `staticDataStore`.
4. `src/utils/mappingPipelineCsv.ts`, `serviceHeaderResolver.ts`, `serviceValidation.ts`, `zipNormalize.ts`, `countyNormalize.ts`: port these.
5. `src/pages/AdminIntake.tsx`: one intake page with tabs for each entity.
6. `src/hooks/useResources.ts`: feeds the existing marker layers (`ProviderMarkerLayer`, `BehavioralHealthMarkerLayer`, `ServiceMarkerLayer`, `pinVisuals.ts`).
7. Seed: CSV export of verified public rows from this project. The export is the one step that reads this project's data, and it needs your separate approval.
