# Nevada Rural Medicaid Access Tool — Project Context Document

**Last updated:** August 2026  
**Version:** 2.0 (merged)  
**Maintained by:** Maurice / NBH  
**Purpose:** Single authoritative reference for all Claude and Lovable sessions. Paste at the start of any new conversation to preserve continuity.

---

## 1. One-Sentence Summary

The Rural Medicaid Access Tool is a live operational decision system that translates rural geography, Medicaid network reality, field staffing, and member location into honest access guidance — without pretending that county borders equal care access.

---

## 2. What This Tool Is (and Is Not)

**Working names:** Rural Medicaid Access Tool / Rural Operations Map / Nevada Behavioral Health Rural Coverage & Capacity Map  
**Live URL:** https://ruraltool.iterum.systems/ (custom domain; `ruraltool.lovable.app` is the platform host). `ruralmap.opsframe.io` is a legacy/historical host, not the current deployment contract.

This is a **live operational decision system**, not a map, dashboard, network directory, or portfolio item.

Its purpose is to help frontline and operational teams understand:

- Where rural Medicaid members can realistically access care
- Where NBH has field response capacity
- Where coverage exists only through scheduled outreach or remote coordination
- How geography, drive time, staff capacity, connectivity, payer context, and provider distribution affect real-world access

The tool's value is in combining geography, drive-time logic, field staffing reality, provider availability, behavioral health access, service coordination, connectivity, and transportation constraints into honest access guidance.

The architecture may be transferable to other MCOs, states, and rural access environments — the core problem is not Nevada-specific. The data changes by market; the operational logic generalizes.

**Primary audience:** Internal NBH leadership and SSHP plan contacts  
**Secondary audience:** Field care coordinators; potential State of Nevada procurement reviewers

---

## 3. Organizational Context

| Entity                         | Role                                                    |
| ------------------------------ | ------------------------------------------------------- |
| NBH (Nevada Behavioral Health) | Builder and operator of the tool                        |
| SSHP (SilverSummit Healthplan) | Managed care organization; coverage model beneficiary   |
| Maurice                        | Strategic/operational lead; primary developer interface |

**NBH FTE Structure (current):**

- 2 onsite FTEs: Carson City and Pahrump
- 1 strictly remote FTE: CHW covering Humboldt, Pershing, Lander, Eureka, Elko, White Pine, Mineral, and Lincoln — coordinates appointments and addresses barriers remotely; no geographic field presence implied

---

## 4. Primary Operating Principle

**Do not represent access as binary.**

The tool must avoid simple "covered / not covered" logic. Rural access is tiered, conditional, and operationally constrained. Coverage tiers reflect operational reality, not administrative county boundaries.

### Coverage Tier Taxonomy

| Tier                      | Definition                                                                                                                                                                                                                   |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Active Field Coverage** | Same-day or near-term field response is operationally plausible. Tied to proximity to an FTE hub or active field zone.                                                                                                       |
| **Scheduled Outreach**    | In-person response may be possible but requires scheduling, batching, corridor planning, or staff coordination. Never describe as immediate or routine field availability.                                                   |
| **Remote Support Only**   | Remote coordination, telephonic support, telehealth linkage, CHW navigation, and transportation/resource planning are the realistic response path. This is not a failure state — it is an honest operational classification. |

### Field Capacity Anchors

- Carson City FTE hub
- Pahrump FTE hub
- Remote CHW team (see Section 3)

**The system must not assume an entire county is locally field-covered because one part of that county is near a hub.**

County Discontinuity example — Nye County is a standing regression test:

- A member near **Pahrump** → local field response may be available (Active Field Coverage)
- A member near **Tonopah** → should not receive Pahrump-based routing (Scheduled Outreach at best)

Northern Nye County = Scheduled Outreach. Southern Nye County = Active Field Coverage. This is a County Discontinuity — a single county whose internal geography produces meaningfully different coverage tiers. A Lovable prompt has been drafted to implement this classification; implement when ready.

---

## 5. Foundational Logic

### Point-Based Member Logic (Primary)

Member-level decisions must be point-based whenever possible. A member's latitude and longitude should drive:

- Nearest relevant provider/resource
- Field response viability
- Distance and drive-time classification
- Recommended next step and constraint language
- Whether local field response or remote coordination is more accurate

**County-level logic must never override point-based member logic.**

### County-Level Logic (Secondary)

County boundaries are appropriate for:

- Summary panels and coverage visualization
- Regional planning and capacity strain indicators
- Service gap analysis
- Operational grouping and policy discussion

---

## 6. Core Data Categories

| Category                         | Notes                                                                                                                               |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Provider Locations**           | Hospitals, clinics, verified care sites. Used in access calculations.                                                               |
| **Behavioral Health**            | BH providers and access points. Integrated into access gap logic. Purple visual treatment.                                          |
| **Services**                     | Social, operational, community services. Excluded from core access gap calculations unless intentionally changed.                   |
| **FTE Hubs / Field Anchors**     | Carson City, Pahrump, remote CHW. Define field response plausibility and operational reach.                                         |
| **County Boundaries**            | Orientation, filtering, and review. Not the primary source of member-level logic.                                                   |
| **Access Gaps**                  | Gap overlay based on meaningful provider access. Includes hospitals, clinics, BH. Excludes Services unless redefined.               |
| **Tier 1 Providers**             | Claims-based or priority highlighting. Highlights when Provider Locations is on; filters when off.                                  |
| **Tribal Nations**               | Contextual geographic layer. Color synchronized between map and legend. Clipped to Nevada boundary.                                 |
| **Connectivity Layers**          | Broadband and cellular coverage. Used to assess remote feasibility.                                                                 |
| **Transit / Corridor Layers**    | Rail corridor, local transit zones, transit providers. Transportation feasibility context.                                          |
| **SilverSummit / Payer Context** | Informational only. Non-authoritative. Must not alter operational scoring unless explicitly redesigned. Hidden in public-safe mode. |

**Data sources:**

- Resource directory (county panels): Balance of State CoC resource list — actively maintained; no need to caveat data integrity for internal audience
- Provider pins: Supabase (`verified_bh`, `verified_services`, `facilities`, `rural_services`) — fully database-driven as of Phase 4
- SSHP claims data: Incoming (deidentified) — to populate FTE Capacity & Load layer and validate tier assignments

---

## 7. Decision Assistant Logic

The Decision Assistant is a **care routing tool**, not a generic search result list.

It must consider:

- Member location (point-based)
- Service need and provider proximity
- Behavioral health availability
- Field response tier and FTE strain
- Drive-time and distance thresholds
- Corridor viability and connectivity feasibility
- Transportation constraints
- Whether the recommendation is operationally honest

**Required output elements:**

- Best next step
- Nearest viable resource if available
- Field response classification
- Constraint language
- Remote coordination language when appropriate
- No false certainty

The assistant must not recommend in-person field response where geography, staffing, or coverage logic does not support it.

**Standing regression test — Tonopah scenario:**  
A member enters a Tonopah address and selects Behavioral Health > Therapy. The system must not return "State of Nevada Rural Clinics - Pahrump" simply because Pahrump is in Nye County. The system must evaluate drive-time realism and field response capacity. If remote coordination is more honest, say that plainly.

---

## 8. Default Layer Philosophy

Fresh-load defaults should favor orientation and core access context — not overwhelm the user.

| State           | Layers                                                                                                                  |
| --------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Default ON**  | County Boundaries, Provider Locations, Behavioral Health                                                                |
| **Default OFF** | Services, Access Gaps, Tier 1 Providers, Tribal Nations, Connectivity, Transit/corridor layers, Internal/payer overlays |

---

## 9. Public Safe Mode

When `?public=1` or equivalent logic is active:

- Hide sensitive metrics, admin tools, mapping/editing/verification panels, audit/staging workflows, internal-only tags, debug tooling
- Preserve the public-facing decision story without exposing internal workflows
- Public Safe Mode must not break the map, legend, search, or public-facing explanation

**SSHP layer:** Currently disabled in public mode via three hard-coded guards. Not a route, not a visible toggle. Stored in `src/data/sshpCatchments.ts`.

---

## 10. Technical Architecture

### Stack

| Component      | Technology                                                                           |
| -------------- | ------------------------------------------------------------------------------------ |
| Frontend       | React + TypeScript, built and hosted via Lovable                                     |
| Backend / DB   | Supabase (PostgreSQL with RLS, Edge Functions, Auth)                                 |
| Mapping        | Leaflet, marker clustering, Turf.js geometry helpers                                 |
| Styling        | Tailwind CSS                                                                         |
| Geocoding — member addresses | Internal-only: `resolve-address` edge function (canonical resource match → HMAC-keyed internal cache). No approved external provider; unresolved → manual placement. See "Internal geocode authority". |
| Geocoding — public resources  | One server-side pipeline (admin/sysop only): internal `resource_address` authority → U.S. Census Geocoder. `geocode-bulk` (batch, stable IDs) and `geocode-address` (single record). Google Geocoding and public Nominatim are **retired** as active providers; `census-geocode` is decommissioned (410) |
| Error tracking | Not currently configured — no Sentry (or other monitoring) package in `package.json`; `ErrorBoundary` logs to the console only |
| Build tool     | Vite                                                                                 |
| Route loading  | `src/App.tsx` eagerly imports `Index` (main map) for fastest first paint; all other routes (auth, admin, briefing, platform) are lazy-loaded via `React.lazy` + `Suspense` so they don't block startup |
| Cross-tab sync | BroadcastChannel for verified record updates                                         |
| Domain         | Cloudflare / custom domain for public routing                                        |
| Deployment     | Manual publish via Lovable; no CI/CD pipeline yet                                    |

**Geocoding principle:** Wrong pin is worse than no pin. `bounded=1` may reject some valid addresses; that is preferable to incorrect placement. Multi-candidate validation with address structure comparison (street name, house number, ZIP) before accepting a result.

### Supabase Tables

| Table                                                 | Purpose                                                 |
| ----------------------------------------------------- | ------------------------------------------------------- |
| `staging_bh`, `staging_services`, `staging_providers` | Pipeline intake                                         |
| `verified_bh`, `verified_services`                    | Verified, geocoded live records                         |
| `facilities`                                          | Seeded Phase 3 (historical count 53; live count not verified) |
| `rural_services`                                      | Seeded Phase 3 (historical count 172; live count not verified) |
| `mapping_audit_log`                                   | Pipeline audit trail (written; not yet displayed in UI) |
| `user_roles`                                          | Role definitions for RBAC                               |
| `data_sources`                                        | Source Registry — provenance/governance metadata (Phase 6a) |
| `data_source_runs`                                    | Append-only source retrieval/ingestion health history       |
| `data_source_snapshots`                               | Immutable raw retrieval evidence per ingestion (Phase 6b)   |
| `broadband_county_coverage`                           | Normalized internalized FCC broadband dataset, 17 counties (Phase 6b) |
| `geocode_resolutions`                                 | Internal geocode authority/cache, HMAC-keyed, no raw addresses. Namespaces: `member_address` (Phase 6d), `resource_address` (Phase 6e) |


All seven data tables (`facilities`, `rural_services`, `verified_bh`, `verified_services`, `staging_bh`, `staging_services`, `staging_providers`) carry soft-delete columns: `deleted_at` (TIMESTAMPTZ), `deleted_by` (TEXT), `deleted_reason` (TEXT). RLS hides soft-deleted rows from all roles except sysop. No hard DELETEs are issued from the application layer on these tables.

### Source Registry (Phase 6a)

`data_sources` is the authoritative registry of where the Rural Tool's information originates. `data_source_runs` is its append-only retrieval/ingestion health history — it does **not** replace `mapping_audit_log`, which remains the application-data audit trail.

Rules:

- **No live rendering may depend on the registry.** The map, Decision Assist, coverage, Tier 1, Access Gap, and SSHP logic must all keep working with an empty registry. This is deliberate — the registry must not become a new single point of failure.
- `credential_reference` stores a variable **name** only (e.g. `GOOGLE_GEOCODING_API_KEY`). Secret values are never stored, fetched, or rendered.
- Source health is **calculated**, never hand-edited. `src/lib/sources/sourceHealth.ts` is the single source of truth: Current / Review Due / Stale / Failing / Unknown, derived from `status`, `last_verified_at`, `last_successful_ingestion_at`, `last_failed_ingestion_at`, `next_review_at`, and `stale_after_days`.
- Access: anon/viewer/staff none · ops read-only · admin read/write · sysop inherits admin. Enforced in RLS, not only in the UI. Public Safe Mode never reaches `/admin/data-sources`.

### Internalized ingestion (Phase 6b — FCC broadband)

Pipeline: authoritative source → server-side retrieval (`supabase/functions/ingest-fcc-broadband`) → immutable snapshot in `data_source_snapshots` → SHA-256 content hash → validation → transformation → atomic replacement of `broadband_county_coverage` → application read path → static JSON fallback.

Rules:

- Ingestion is admin/sysop-authenticated and runs server-side only. The service-role key never reaches the browser. Clients have `SELECT` only on `broadband_county_coverage` and no access at all to snapshots.
- Snapshots are append-only and immutable: every retrieval is preserved, none are deduplicated or overwritten. No UPDATE/DELETE policies exist for application roles.
- Replacement is all-or-nothing via `replace_broadband_county_coverage` (invoker rights, service-role only, refuses an empty dataset). A failed ingestion can never leave partial data or destroy the last known good dataset.
- A run is `success` only after retrieval **and** validation **and** transformation **and** normalized persistence succeed. HTTP 200 alone is not success.
- Validation requires exactly the 17 Nevada counties, each once, with finite in-range numeric metrics. An invalid upstream response is rejected before it can touch the normalized table.
- `src/data/broadband-coverage.ts` reads the normalized table first and falls back to `public/data/nevada_broadband.json` on error, empty result, or failed validation. The map is never dependent on live FCC availability. The fallback must not be removed.
- Source-health fields on `data_sources` are written only from actual ingestion evidence.

- Unknown provenance is stored as NULL and surfaced as a visible governance gap. Do not invent dates, cadences, URLs, or ownership.

### FCC authoritative binding (Phase 6c — Phase 2A.1)

`fcc_broadband` is bound to the FCC Broadband Data Collection Public Data API, base `https://broadbandmap.fcc.gov/api/public/map`. Full field-level provenance, the derivation specification, and the methodology differences are in `docs/fcc-broadband-provenance.md` — read it before changing any broadband ingestion code.

Acquisition protocol (`fcc-bdc-public-data-api-v1`), server-side only:

1. `GET /listAsOfDates` → newest `data_type = "availability"` release, never a future date, never a filing deadline.
2. `GET /downloads/listAvailabilityData/{as_of_date}` → manifest.
3. Select only the **Fixed Broadband Summary by Geography Type** artifact — the one public file carrying the county denominator. Other states' availability files are never downloaded.
4. `GET /downloads/downloadFile/availability/{file_id}` → raw bytes.

Rules:

- Credentials are the edge-runtime secrets `FCC_BDC_API_USERNAME` and `FCC_BDC_API_HASH_VALUE`, sent as the `username` / `hash_value` request headers. Values are never stored in the database, logged, or returned; every operator-facing message passes through credential redaction. If either is unset the run fails closed with `fcc_credentials_missing` and nothing else executes.
- Raw retrieved bytes are SHA-256 hashed and written unmodified to the private `source-evidence` bucket **before** any parsing or transformation. `data_source_snapshots.source_artifacts` is a JSONB **array** of `{file_name, file_id, role, sha256, byte_size, storage_bucket, storage_path}`.
- Derivation (`fcc-bdc-summary-county-v1`): rows where `geography_type = County`, `area_data_type = Total`, `biz_res = R`, `geography_id` in the 17 Nevada county FIPS. Denominator is the FCC's `total_units` (Broadband Serviceable Location units). Speed tiers use `technology = "All Terrestrial"` — satellite codes 60/61 are excluded because `pct_below_25_3` means "satellite-only or no coverage".
- `pct_100_20_plus = speed_100_20 × 100`, `pct_25_3_to_100_20 = (speed_25_3 − speed_100_20) × 100`, `pct_below_25_3 = (1 − speed_25_3) × 100`. Half-up rounding to 1 decimal, applied once.
- The `*_share` values, `coverage_unevenness`, and `notes` are Rural Tool interpretation, not FCC measurements. They are **carried forward** from the dataset in effect. FCC per-technology availability is overlapping and must never be converted into a share that sums to 100. If carried values are missing for a county the run fails rather than inventing shares.
- Every failure resolves to exactly one code in `failureCodes.ts` (`fcc_credentials_missing`, `fcc_authentication_failed`, `fcc_release_discovery_failed`, `fcc_no_valid_release`, `fcc_manifest_failed`, `fcc_nevada_files_missing`, `fcc_download_failed`, `fcc_source_hash_failed`, `fcc_source_parse_failed`, `fcc_validation_failed`, `fcc_transformation_failed`, `fcc_persistence_failed`), stored in `data_source_runs.failure_code` with the stage in `run_metadata`. A failed run never mutates `broadband_county_coverage`; the source is marked `failing` and the application keeps reading the previous dataset, then the static JSON.
- `POST { "dry_run": true }` acquires, hashes, stores evidence, and derives without replacing the dataset. `POST { "as_of_date": "YYYY-MM-DD" }` pins a release.
- Live authoritative ingestion is blocked until the two FCC secrets are configured. Unauthenticated probes of the FCC API return HTTP 401, confirming the credential boundary.



### Internal geocode authority (Phase 6d — Phase 2B / 2B.1 / 2B.2)

Member address resolution is internal-only. The browser calls exactly one endpoint — the `resolve-address` edge function — which owns normalization, canonical resource matching, and cache lookup. `resolve-address` is a **member-address resolver only**.

**Member address data boundary (hard rule).** A member address may be sent to: the Rural Tool's own server boundary, its internal HMAC-keyed geocode authority, and canonical NovumHealth-controlled data. It may **not** be sent to public Nominatim, the Census Geocoder, any other public/undocumented third party, or any browser-side geocoder. Current status:

```
member_address_external_provider = none_approved
```

Public Nominatim is prohibited for this purpose (OSMF policy forbids submitting personal/confidential material). The Census Geocoder has no documented project approval to receive member addresses, so it is disabled for `member_address` as well. For **public business/resource** addresses, the Census Geocoder is the approved external provider, reached only server-side through the administrative functions (`geocode-address`, `geocode-bulk`); public Nominatim is retired there too (Phase 2D). Do not add an external provider to the member path without recording the approval here first.

Member resolution order (fixed, do not reorder):

1. exact canonical Rural Tool resource match — canonicalized-address equality against `facilities`, `rural_services`, `verified_services`, `verified_bh`
2. verified / manual / coordinate-locked internal coordinates
3. internal geocode cache (`geocode_resolutions`)
4. approved member-address geocoder — **none currently exists**
5. unresolved → manual placement offered

Rules:

- **Hard privacy boundary.** `src/hooks/useMemberAccess.ts` contains no external geocoder call and no raw `fetch` of the address. If the server boundary is unreachable the path **fails closed** into manual map placement.
- **One authority (Phase 2B.2).** The browser performs no second coordinate resolution. The former three-token fuzzy matching against `defaultFacilities` / `enrichedRuralServices` and the hardcoded `KNOWN_PROVIDER_COORDINATES` list are removed: they could place a member after the authoritative resolver returned unresolved. Wrong coordinates are worse than no coordinates. Coordinate ownership for those resources belongs to the canonical database tables, which the server now matches directly.
- **Canonical matching is exact only.** Canonicalized-address equality, valid coordinates, Nevada validation, `deleted_at IS NULL`, `mappable = true` for live map tables, curated `manual_lat/lng` preferred over automated coordinates, coordinate locks respected. No fuzzy matching of member input to a resource, and no duplication of resource coordinates into a competing table.
- **Retry intelligence is server-side.** `buildQueryVariants` in `supabase/functions/_shared/geocodeNormalize.ts` owns the ordered strategies (`direct` → `abbreviation_variant` → `street_city_zip` → `city_zip` → `zip` → `highway_alias` → `highway_alias_without_number`). It is retained for a future approved provider and for administrative resource geocoding; with no approved member provider it currently drives zero external calls.
- **`location_class` is not exposed.** Every caller is pinned to `member_address`; any other supplied class returns `location_class_forbidden` (403) regardless of role. No role lookup occurs here, so **Ops cannot cause a service-role geocode write** — consistent with the project's role model (viewer/staff/ops read-only, admin/sysop write). Canonical resource maintenance uses the administrative geocoding pathways.
- **Abuse resistance.** Bodies over 2000 bytes → `payload_too_large`; addresses over 300 characters → `invalid_address`. With no external provider in the member path, an anonymous request performs zero outbound calls. Unresolved anonymous searches are **not persisted** (`persistUnresolved: false`), so an anonymous caller cannot grow `geocode_resolutions` with unlimited null-coordinate rows. Privacy-safe aggregate failure telemetry is still logged.
- **Privacy.** `geocode_resolutions` stores no raw address text for `member_address` records. The key is `lookup_key = "v1:" + HMAC-SHA-256(GEOCODE_CACHE_HMAC_SECRET, "<location_class>|<canonical address>")`. The secret is server-only. Responses never return `lookup_key`, canonicalized address, `source_metadata`, database IDs, or HMAC material, and never echo the submitted address in an error.
- **No permanent negative caching.** A null-coordinate row is never a valid cache hit; a later request stays eligible once canonical data improves or an approved provider is added.
- **Coordinate locks and manual coordinates outrank all automation**, enforced in the resolver and by a database trigger.
- Failures are distinguishable: `internal_cache_miss`, `nominatim_failed`, `census_failed`, `google_failed`, `external_geocoding_unavailable`, `no_approved_external_provider`, `manual_resolution_required`.
- **Self-reliance condition:** a known member location resolves from canonical data or the internal cache with zero external calls and zero external disclosure.
- `expires_at` is nullable and unset — no cache-expiration policy exists yet.
- Admin surface `/admin/geocode-health` shows aggregate counts only (Ops read-only, Admin/SysOp maintenance, Viewer/Staff denied, suppressed in Public Safe Mode).
- The `service_role` key is used only inside `resolve-address` for cache reads/writes. It is never returned, logged, or exposed.
- Tests: `src/test/geocodeInternalAuthority.test.ts`, `src/test/geocodeBoundary.test.ts`, `src/test/memberGeocodePolicy.test.ts`, `src/test/memberCanonicalMatch.test.ts` (behavioral canonical-matcher coverage).

### Internal public-resource geocode reuse (Phase 6e — Phase 2C)

Public facility/service/provider addresses are externally geocoded **once**, validated once, then reused as internal geospatial knowledge. This is a separate namespace from member addresses.

- **Cache namespace:** `geocode_resolutions.location_class = 'resource_address'`, keyed by `HMAC-SHA-256(GEOCODE_CACHE_HMAC_SECRET, "resource_address|<canonical address>")`. The member namespace (`member_address`) and the resource namespace never read or write each other's rows. `member_address_external_provider = none_approved` is unchanged.
- **Shared core:** `supabase/functions/_shared/resourceGeocodeCache.ts` (pure, port-injected) plus the Supabase adapter `supabase/functions/_shared/resourceCachePorts.ts`. Both `geocode-address` (Google) and `geocode-bulk` (Nominatim bounded → Census → Nominatim unbounded) use this one core and one cache; neither calls the member `resolve-address` endpoint.
- **Resource resolution order:** manual/locked canonical record coordinates → protected (manual_verified) cache authority → internal `resource_address` cache → approved external provider → unresolved/reviewable.
- **Identity is exact only.** Deterministic canonical address equality (street + city required). No fuzzy name, county-only, or ZIP-only collapsing. Records without a deterministic identity still geocode, but are not cached.
- **Cross-record / cross-table / cross-function reuse.** The same exact canonical address in `facilities`, `rural_services`, `verified_services`, `verified_bh` or `staging_providers` reuses one entry, in either direction between `geocode-address` and `geocode-bulk`. Within a bulk batch, only the first occurrence of an address can cost an external call.
- **Provenance is two-valued.** `coordinate_source` = how *this record* received the coordinate (`google` | `internal_cache` | `failed`); `geocode_provider` = how it was *originally* resolved (`google` | `nominatim` | `census`). `coordinate_confidence` and `geocode_match_type` are preserved from the original resolution; a low-confidence cached result is never upgraded. Cache `source_metadata` carries `match_type`, `resolved_at`, `resolved_by`.
- **Review is preserved.** `AdminGeocodeReview` accepts `internal_cache` as a receiving source, so a reused low-confidence (geometric/approximate/low) result stays in the review queue.
- **Manual/locked precedence.** Display coordinate columns are never overwritten when `coordinate_locked = true`; a `manual_verified` cache row is never replaced by Google, Nominatim, Census, or automated cache refresh (enforced in the adapter and by the existing `geocode_resolutions_protect_locked` trigger).
- **Force semantics.** `force: true` bypasses automated cache reuse to obtain a fresh provider result, but never bypasses protected/manual cache authority. A failed force preserves the last known good cache entry.
- **Never cached:** failed provider responses, missing/non-finite coordinates, `0,0`, out-of-Nevada results, malformed payloads.
- **Failure behavior.** External provider unavailable + known address → resolves from cache. Unknown address + external failure → unresolved and reviewable, with no false cache row.
- **Authorization unchanged:** `geocode-address` and `geocode-bulk` remain Admin/SysOp only; all cache writes happen server-side through those functions. No client writes `geocode_resolutions`; no SECURITY DEFINER function was added.
- **Error hygiene:** both functions now return stable codes (`geocode_unresolved`, `geocode_internal_error`, `geocode_bulk_internal_error`, `record_update_failed`) and never echo the Google request URL, API key, service-role credentials, or database internals.
- `/admin/geocode-health` distinguishes member cache vs resource cache counts; `resource_address` appears in the location-class breakdown.
- Record-level fields (`geocoded_lat/lng`, `coordinate_source`, `coordinate_confidence`, `geocode_provider`, `geocode_match_type`, `last_geocoded_at`) are retained — Phase 2C adds cross-record reuse on top of them.
- Existing-data bootstrap (seeding the cache from trustworthy existing rows) is implemented as a library primitive only (`seedManualResourceResolution`) and is **not** wired to an admin operation yet — recommended follow-up.
- Tests: `src/test/resourceGeocodeCache.test.ts` (28 tests: identity, cross-record/cross-table/cross-function reuse, manual/lock precedence, force, provenance, failures, authorization, member-boundary regression).

**Phase 2C.1 corrections (correctness closure):**

- **Cache reuse does not depend on a provider credential.** `geocode-address` consults the internal authority before building any external provider chain: cache hit + provider unavailable → success with `cache_hit: true`, `external_calls: 0`. (Phase 2D superseded the Google-specific `google_credentials_missing` branch when Google was retired as the active provider.)
- **Force failure never destroys cache.** A forced refresh that fails retains the last known good internal result and reports `forced_refresh_failed: true` with `refresh_status: forced_refresh_failed_cache_retained` (vs `forced_refresh_succeeded`). Protected `manual_verified` authority still outranks force entirely.
- **`geocode-bulk` writes record provenance.** Every successful bulk result now populates `geocoded_lat`, `geocoded_lng`, `coordinate_source` (`internal_cache` for reuse, else the resolving provider), `coordinate_confidence`, `geocode_provider` (original resolver), `geocode_match_type`, `last_geocoded_at`. `access_notes` tagging is retained for existing UI. Failures stamp `coordinate_source = 'failed'` only and never write cache.
- **Review queue is provider-agnostic.** `AdminGeocodeReview` accepts `google | nominatim | census | internal_cache` with `geometric | approximate | low`, plus `failed`. Copy no longer claims the queue is Google-only.
- **No destructive preparation.** `AdminMappingServices.handleGeocodeStaticData` no longer nulls `lat`/`lng`/`access_notes` across all facilities and rural services. Eligibility is server-side (`geocode-bulk` selects rows missing coordinates); known-valid, manual and locked coordinates are untouched. A deliberate "refresh all automated coordinates" force workflow does not exist and must not be improvised.
- Tests: `src/test/resourceCacheCorrectness.test.ts` (22 tests).

### Provider-safe resource geocoding consolidation (Phase 6f — Phase 2D)

Public-resource geocoding is now **one server-side, cache-first, provider-safe pipeline**. Member-address resolution is unchanged (`member_address_external_provider = none_approved`).

- **Active provider chain:** internal approved `resource_address` authority → **U.S. Census Geocoder** (`Public_AR_Current` benchmark, `onelineaddress`). Nothing else. Google Geocoding is retired as an active resource provider (`GOOGLE_GEOCODING_API_KEY` is legacy and unused by the active path); public Nominatim is retired from production resource geocoding (search *and* reverse).
- **No browser geocoding.** `src/utils/serviceGeocode.ts` performs zero network calls and holds only types plus `[geocode:...]` tag helpers. The single browser entry point is `src/utils/resourceGeocodeClient.ts`, which invokes the authenticated `geocode-bulk` function. The standalone `census-geocode` proxy is decommissioned and returns `410 deprecated_endpoint`.
- **Cache authority vs legacy rows.** Only `census` and `manual_verified` cache rows are durable reusable authority (`classifyResourceCacheSource` → `approved_authority`). Historical `google` / `nominatim` rows are classified `legacy_*_revalidation_required`, do **not** satisfy a lookup, and are re-resolved through Census. Existing record coordinates are left in place until a deliberate operation revalidates them.
- **Server-side validation replaces the reverse spot check.** `validateCensusMatch` requires a source street identity (number + name), a returned `matchedAddress`, non-zero coordinates, Nevada bounds, and state/ZIP compatibility when both sides supply them. Rejection reasons are stable codes (`source_address_lacks_street_identity`, `no_census_match`, `coordinate_outside_nevada`, `state_mismatch`, `zip_mismatch`, …). Census results are labelled honestly: `confidence = low`, `precision = approximate`, `match_type = census_onelineaddress` — never `rooftop`.
- **Stable ID batching.** Callers establish the eligible ID set once (`listUnresolvedResourceIds`) and submit explicit ID chunks (≤50 client-side, ≤200 server-side). The retired offset pagination over a shrinking `lat IS NULL` set silently skipped records. Addresses are deduplicated within a batch, so only the first occurrence can cost an external call.
- **Table contracts.** `supabase/functions/_shared/resourceTableContracts.ts` is the single source of truth for the 9 supported tables (`facilities`, `rural_services`, `verified_services`, `verified_bh`, `staging_services`, `staging_bh`, `staging_facilities`, `staging_rural_services`, `staging_providers`): coordinate column names (`lat/lng` vs `latitude/longitude`), provenance columns, `access_notes`, `mappable`, `active_status`, soft delete, lock and manual columns. Unknown tables are rejected.
- **Eligibility (server-side):** skip soft-deleted, `mappable = false`, `active_status = false`, missing street address, records that already have coordinates (unless `force`), and **manual/locked** records (`protected_manual_or_locked_coordinate`). Manual and locked coordinates outrank cache, Census, retry and force.
- **`access_notes` integrity.** Only the structured `[geocode:...]` token is replaced (`stampGeocodeTag` / `stripGeocodeTag`, shared client and server). Human operational text is preserved verbatim. Nothing is nulled as preparation — the Admin bulk action on live facilities/rural services now re-geocodes exactly the selected IDs with `force: true` instead of clearing coordinates and notes first.
- **Record-level provenance** is written for every result: `coordinate_source` (`internal_cache` | `census` | `failed`), `geocode_provider` (original resolver), `coordinate_confidence`, `geocode_match_type`, `geocoded_lat/lng`, `last_geocoded_at`. A cached low-confidence result is never upgraded, and a failure never attributes a provider that was not called.
- **Dry-run legacy inventory.** `geocode-bulk` accepts `mode: 'dry_run_revalidation'` (Admin/SysOp): it inventories records carrying legacy Google/Nominatim provenance, re-resolves them through Census in memory, and reports agreement distance — **no writes, no cache mutation**. Production legacy replacement is a separate, deliberate future operation and has NOT been performed.
- **Tests:** `src/test/resourceGeocodeConsolidation.test.ts` (39 tests). `resourceGeocodeCache.test.ts` and `resourceCacheCorrectness.test.ts` were updated to the Census provider contract. Full suite: 322 tests green.






### Key Files and Hooks

| File                               | Purpose                                                        |
| ---------------------------------- | -------------------------------------------------------------- |
| `src/hooks/useFacilityData.ts`     | Reads facilities from Supabase                                 |
| `src/hooks/useRuralServiceData.ts` | Reads rural services from Supabase                             |
| `src/hooks/useMemberAccess.ts`     | Member address geocoding and access analysis                   |
| `src/hooks/useMapLayers.ts`        | Layer toggle state including `sshpCatchments`                  |
| `src/data/sshpCatchments.ts`       | SSHP overlay data (static; disabled in public mode)            |
| `src/components/ErrorBoundary.tsx` | App-level error boundary; logs to console (no monitoring service) |
| `src/utils/csvExport.ts`           | CSV export utility (built; not yet wired into all admin pages) |

### Auth and Roles

Role tiers: **sysop | admin | ops | staff | viewer**.

- **SysOp**: superset of Admin plus recovery capabilities. Inherits every Admin permission. Additionally can see and restore soft-deleted records across all data tables via `/sysop`. Assigned ONLY by direct DB write (or auto-assignment on signup) to the two hardcoded operator emails: `mcloutier@nvbhs.com`, `mcloutier@protonmail.com`. **No UI exists to assign, view, or modify SysOp accounts.** Admin user-management RPCs hide SysOp users and refuse to assign or alter the SysOp role.
- **Admin**: full system access — user management, role assignment, ingestion approval, pipeline promotion, verified record edits, mapping configuration, data import, destructive actions, credentials/security settings.
- **Ops**: full authenticated map access (same as any signed-in internal user) plus read-only backend/admin-area operational visibility. Ops CAN view the Admin home, Mapping workspace, Geocode Review, Unmapped Top Utilized Providers, and the dedicated `/admin/ops-access` page. Ops CANNOT add/remove users, change roles, approve ingestions, promote staged records, edit/delete verified records, modify mapping configuration, access metrics/training, change system settings, perform destructive actions, or access credential/security settings. All write controls remain gated by `perms.canImportData` / `perms.canApplyVerification` / `perms.canEditMapData` (Admin-only).
- **Staff**: full authenticated map access at `/` only. No backend/admin routing, no mapping admin visibility, no ingestion or geocode review, no unmapped provider report, no operational data capture.
- **Viewer**: standard limited access.
- **Public-safe mode**: collapses effective role to `viewer`; no internal backend or admin access.

Route guards:

- `perms.isSysOp` — `/sysop` only. SysOp also passes every `perms.isAdmin` check because `isAdmin` is now defined as `role === 'admin' || isSysOp`.
- `perms.isAdmin` — Admin-only pages: `/admin/users`, `/admin/metrics`, `/admin/training`, and all mapping write/approve/promote/edit/delete/configuration actions. SysOp inherits.
- `perms.canAccessOps` (Admin/SysOp OR Ops) — `/admin` home, `/admin/ops-access`, `/admin/mapping/*` (read view), `/admin/geocode-review` (read view), `/admin/unmapped-providers` (read + CSV export). Writes inside still require `isAdmin`.
- Staff is excluded from every `/admin/*` and `/sysop` route. Staff continues to have full authenticated map access at `/`.
- `/ops/*` (Field Ops surface): `OpsLayout.tsx` gates to Admin OR Ops. Routes: `/ops` (home), `/ops/data-capture` (standalone CHW Note / Attempted Contact form that calls existing `logEvent`), `/ops/activity` (user's own `user_events` rows filtered to `chw_note_added` / `attempted_contact_marked`). No new tables; no provider-panel reuse. Map header dropdown shows a "Field Ops" link to `/ops` for Admin or Ops only.
- Public-safe mode collapses the effective role to `viewer`, so it fails every admin and sysop guard.
- `AdminMappingLayout.tsx` is the canonical admin navigation pattern.
- DB enum `public.app_role` includes `viewer | staff | ops | admin | sysop`; `admin_set_user_role` accepts only the first four and rejects any attempt to assign or modify `sysop`.

Authoritative standalone RBAC reference: `rbac-spec-v3.md` (May 2026) — supersedes all prior role definitions.

### Soft delete + SysOp recovery

Tables with soft-delete support (columns `deleted_at`, `deleted_by`, `deleted_reason`):
`facilities`, `rural_services`, `verified_bh`, `verified_services`, `staging_bh`, `staging_services`, `staging_providers`.

- RLS hides rows where `deleted_at IS NOT NULL` from every role except `sysop`. The anon (public map) policies on `verified_*` also require `deleted_at IS NULL`.
- No hard `DELETE` is issued from the app on these tables. Existing pipeline flows (`rejectStaging*`, status changes) update `review_status` rather than deleting; any future delete handler must write `deleted_at`, `deleted_by` (actor email), and optional `deleted_reason` instead.
- `/sysop` page (sysop-only) renders a single panel — **Deletion Recovery Queue** — listing every soft-deleted record across the seven tables with type, name/id, deleter email, timestamp, reason, and a Restore action.
- Restore calls `sysop_restore_record(table, id)` (SECURITY DEFINER), which clears the three deleted_* columns and writes a `record_restored` row to `mapping_audit_log` with the sysop's id + email.

---

## 11. Data Pipeline

**Verified-records approach — preferred flow:**

1. Import / ingest
2. Stage
3. Validate
4. Geocode (if needed)
5. Review
6. Promote to verified
7. Merge into live map

**Principles:**

- Staging data must not pollute live operational layers
- Verified records are the source of truth for live map rendering
- Promote/edit/deactivate behavior propagates across tabs via BroadcastChannel
- Deduplication prevents duplicate pin explosion

**Provider dedupe priority:** NPI → Name + county + city → Phone → Address

---

## 12. Admin System

### Admin Pages and Navigation Pattern

Every admin page follows this exact structure — no exceptions:

| Position  | Element                                                                     |
| --------- | --------------------------------------------------------------------------- |
| Top-left  | Breadcrumb using `Button asChild variant="ghost" size="sm"` wrapping `Link` |
| Top-right | `Back to Map` button using same `Button asChild` pattern linking to `/`     |

| Page               | Route                           | Breadcrumb         |
| ------------------ | ------------------------------- | ------------------ |
| Admin Home         | `/admin`                        | "Admin" title      |
| User Management    | `/admin/users`                  | ← Admin            |
| Unmapped Providers | `/admin/unmapped`               | ← Admin            |
| Staff Training     | `/admin/training`               | ← Admin / Training |
| Data Sources       | `/admin/data-sources`           | ← Admin            |

#### Mapping nav — grouped dropdowns

| Group      | Item                      | Route                                  |
| ---------- | ------------------------- | -------------------------------------- |
| Overview   | Overview                  | `/admin/mapping`                       |
| Ingestion  | Provider Mapping          | `/admin/mapping/providers`             |
|            | Provider Metadata         | `/admin/mapping/provider-metadata`     |
|            | Service Mapping           | `/admin/mapping/services`              |
|            | Behavioral Health         | `/admin/mapping/behavioral-health`     |
| Staging    | Facility Staging          | `/admin/mapping/facilities-staging`    |
|            | Behavioral Health Staging | `/admin/mapping/behavioral-health`       |
|            | Rural Services Staging    | `/admin/mapping/rural-services-staging`|
| Review     | Verification Queue        | `/admin/mapping/verification-queue`    |
|            | Verification Outreach Log | `/admin/mapping/audit-history`         |
|            | Data Pipeline Log         | `/admin/mapping/pipeline-audit`        |
| Live Data  | Facilities (Live)         | `/admin/mapping/facilities`            |
|            | Rural Services (Live)     | `/admin/mapping/rural-services`        |
|            | Metrics                   | `/admin/metrics`                       |

Note: Behavioral Health is accessible from both Ingestion (raw import) and Staging (review/promote). Same page, two logical entry points by design.

### Ops Pages

| Page               | Route               | Breadcrumb         | Access      |
| ------------------ | ------------------- | ------------------ | ----------- |
| Ops Home           | `/ops`              | "Field Ops" title  | Admin + Ops |
| Field Data Entry   | `/ops/data-capture` | ← Field Ops        | Admin + Ops |
| My Activity        | `/ops/activity`     | ← Field Ops        | Admin + Ops |

New admin pages must follow this pattern without exception.

---

## 12a. Ops System

Ops routing uses `OpsLayout.tsx`, gated on `perms.isAdmin || perms.isOps`. Ops users have no access to `/admin/*`. A "Field Ops" entry in the authenticated map header dropdown is visible to Admin and Ops only.

Data capture (`/ops/data-capture`) is a standalone form — county, provider name, entry type (CHW Note / Attempted Contact), note text. Calls existing `logEvent` utility; writes to existing `user_events` table. No new tables.

Activity log (`/ops/activity`) reads `user_events` for the current user only, filtered to `chw_note_added` and `attempted_contact_marked`. RLS enforced at the database layer.

Ops cannot access: `/admin/*` routing, ingestion approval, staged-record promotion, verified-record editing, mapping configuration, user/role management, or any destructive actions.

---


## 13. Completed Phases

| Phase                 | Summary                                                                                                            | Status |
| --------------------- | ------------------------------------------------------------------------------------------------------------------ | ------ |
| **Phase 1**           | Schema created; 225 records seeded from static files; geocode-validated with confidence stamps                     | ✅     |
| **Phase 2**           | Map reads from Supabase; static files retained as fallback                                                         | ✅     |
| **Phase 3**           | Admin UI for Facilities (53 records) and Rural Services (172 records); pipeline pattern; geocode confidence column | ✅     |
| **Phase 4**           | All map-rendering consumers migrated to Supabase hooks; `Sidebar.tsx` and `Index.tsx` off static imports           | ✅     |
| **Phase 5 (partial)** | ErrorBoundary wired (console-only; no monitoring service configured in current HEAD); admin navigation normalized                                                | ✅     |
| **Phase 6a**          | Source Registry foundation: `data_sources` + `data_source_runs` with role-scoped RLS, deterministic source-health helper, `/admin/data-sources` governance surface, admin-only gap warnings, 19 seeded sources from repository evidence. No live data source changed. | ✅     |
| **Phase 5b**          | SysOp role tier added (sysop > admin > ops > staff > viewer); soft delete implemented on 7 tables; `/sysop` deletion recovery queue built; auto-assign trigger hardcoded to operator emails; admin RPCs hardened to refuse sysop targets; audit log captures delete and restore events | ✅     |
| **Phase 6b**          | FCC broadband internalized end-to-end: `data_source_snapshots` (immutable raw evidence) + `broadband_county_coverage` (17 normalized counties), server-side `ingest-fcc-broadband` edge function with atomic all-or-nothing replacement, application reads the normalized table with static JSON fallback retained. Authoritative FCC endpoint later established in Phase 6c (`https://broadbandmap.fcc.gov/api/public/map`, protocol `fcc-bdc-public-data-api-v1`); binding/code complete, live authoritative ingestion still blocked pending FCC credentials. | ✅     |
| **Phase 6c**          | FCC broadband bound to the real BDC Public Data API: credentialed server-side acquisition (fail-closed on missing secrets), release discovery, county summary artifact selection, immutable hashed raw evidence in the private `source-evidence` bucket, reproducible `fcc-bdc-summary-county-v1` derivation with satellite excluded, single-code failure taxonomy, dry-run mode, and a per-run FCC-vs-current comparison report. Provenance and methodology differences documented in `docs/fcc-broadband-provenance.md`. Live authoritative run pending FCC credentials. | ◑ blocked on credentials |
| **Phase 6d**          | Internal geocode authority: `geocode_resolutions` keyed by server-side HMAC digest (no raw member address stored), `resolve-address` edge function moving member geocoding behind the server boundary, internal-first resolution order with external geocoders demoted to fallback, coordinate-lock/manual precedence enforced in resolver and trigger, distinguishable failure taxonomy, `/admin/geocode-health` aggregate surface (Ops read-only), 22 privacy/resolution/resilience/geography tests. Known locations now resolve with zero external calls, including when every external geocoder is unavailable. | ✅     |
| **Phase 6d.1**        | Phase 2B.1 hardening: browser member path fails closed with no external geocoder calls, retry-variant + highway-alias chain moved server-side, production `canonicalMatch` against `verified_services`/`verified_bh`, `location_class` authorization (public callers pinned to `member_address`), payload/call caps, opaque error codes, 19 boundary tests in `src/test/geocodeBoundary.test.ts`. | ✅     |
| **Phase 6d.2**        | Phase 2B.2 production-safety closure: `resolve-address` is a member-address-only resolver (no elevated classes, so Ops can never drive a service-role geocode write), public Nominatim and Census removed from `member_address` resolution (`member_address_external_provider = none_approved`), canonical exact matching extended to `facilities`/`rural_services` with mappable/deleted/lock/manual-coordinate semantics (matcher extracted to `resolve-address/canonicalMatch.ts`; `verified_services`/`verified_bh` additionally require `active_status = true`), client-side three-token fuzzy placement and `KNOWN_PROVIDER_COORDINATES` removed, anonymous unresolved searches no longer persisted, 25 policy tests in `src/test/memberGeocodePolicy.test.ts` plus 19 behavioral matcher tests in `src/test/memberCanonicalMatch.test.ts`. | ✅     |
| **Phase 6e**          | Phase 2C internal public-resource geocode reuse: `resource_address` cache namespace, shared `_shared/resourceGeocodeCache.ts` + `_shared/resourceCachePorts.ts` used by both `geocode-address` and `geocode-bulk`, cache-first resolution with exact canonical identity, cross-record/cross-table/cross-function reuse, two-valued provenance (`coordinate_source` = internal_cache vs `geocode_provider` = original resolver), manual/locked and force semantics preserved, low-confidence reuse still reviewable, no caching of failures/out-of-bounds/null coordinates, stable error codes, 28 tests in `src/test/resourceGeocodeCache.test.ts`. A second identical public resource address costs zero external geocoder calls. | ✅     |
| **Phase 6e.1**        | Phase 2C.1 resource cache correctness closure: `geocode-address` credential ordering fixed so internal reuse works with Google unconfigured/unavailable (`google_credentials_missing` only on cache miss, no record stamp, no cache mutation), failed forced refresh retains last-known-good cache and is distinguishable via `forced_refresh_failed` / `refresh_status`, `geocode-bulk` now writes full record-level provenance (`geocoded_lat/lng`, `coordinate_source`, `coordinate_confidence`, `geocode_provider`, `geocode_match_type`, `last_geocoded_at`) so Nominatim/Census low-confidence results enter Admin Geocode Review, review filter/copy made provider-agnostic, destructive `lat/lng/access_notes` pre-clear removed from `Geocode Static Data` (locked and manual coordinates can no longer be erased), 22 tests in `src/test/resourceCacheCorrectness.test.ts`. | ✅     |


**Note:** `CoverageDetailPanel` retains static data by design — baseline gap calculations require stable reference data. This is intentional, not a gap.

---

## 14. Open Work

### Phase 5 Remaining

| Item                                                    | Notes                                                                  | Priority     |
| ------------------------------------------------------- | ---------------------------------------------------------------------- | ------------ |
| Staff role write access                                 | Staff currently redirected to `/`; too restrictive for field operators | Medium       |
| Audit log UI                                            | `mapping_audit_log` written but no display component                   | Medium       |
| CSV export on Facilities and Rural Services admin pages | `csvExport.ts` exists; not wired in                                    | Low          |
| Multi-tenant scoping                                    | No tenant model; `organization_name` is descriptive text only          | Future       |
| Rate limiting on Edge Functions                         | None on `geocode-bulk`, `invite-user` (both admin/sysop-gated; `census-geocode` is decommissioned) | Medium       |
| CI/CD and staging environment                           | Manual publish only                                                    | Future       |
| DB backup / PITR verification                           | Unconfirmed                                                            | Pre-contract |
| Formal availability / recovery documentation            | Not written                                                            | Pre-contract |

### Coverage and Claims

| Item                          | Notes                                                                                                                         |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| SSHP deidentified claims data | Incoming; analysis plan needed for member counts by county, BH utilization, source geography, zero-utilization identification |
| County Discontinuity — Nye   | Lovable prompt drafted; northern = Scheduled Outreach, southern = Active Field Coverage                                       |
| Mobile / tablet layout pass   | Done — input-first mobile surface at `src/components/mobile/MobileEntry.tsx` rendered at `<768px`; laptop (768–1279px) keeps 320px sidebar + tightened detail-panel text; desktop unchanged. |

---

## 15. Lovable Working Conventions

These rules apply to every prompt sent to Lovable. Do not deviate.

1. **Read first, always.** Start with a read-only audit. Never build without inspecting relevant files first.
2. **Scope-lock every prompt.** Specify exact file scope. Lovable must not touch files outside declared scope.
3. **Match existing patterns.** Before adding any component, instruct Lovable to read the canonical reference file and match it exactly. Do not introduce new patterns.
4. **TypeScript clean confirmation required.** Every prompt must end with a request to confirm `tsc --noEmit` exits clean.
5. **No refactoring without explicit instruction.** Tighten the specific failure point only. Never allow system-wide refactors scoped as "fixes."
6. **Design token rule.** Use `text-primary`, `var(--color-*)`, and design tokens — never hardcoded values like `text-blue-600`.
7. **One concern per prompt.** Do not bundle multiple logical changes.
8. **Validate rendered output.** Confirm map behavior, pin visibility, and layer logic after each meaningful change. Do not assume the fix worked without verifying the rendered result.
9. **Surgical over broad.** Locate emitting/source files before cleanup. Prefer targeted fixes. Preserve operational logic unless the change explicitly targets it.

---

## 16. Critical Non-Regressions

Any update must be tested against these risks:

- Search stops selecting or filtering correctly
- Provider pins disappear or fail to render
- Behavioral Health layer fails to merge live records
- Access Gap logic starts including Services unintentionally
- Tier 1 layer switches highlight/filter behavior incorrectly
- Member pin becomes hidden or too visually dominant
- Public Safe Mode exposes internal tools or metrics
- Debug tooling leaks into public mode
- Tribal colors diverge between map and legend
- County-level logic overrides member point logic
- Pahrump routing recommended for central/northern Nye members without qualifying logic
- Marker clustering fails (plugin factory captured too early)
- Map overlays leak outside Nevada boundary
- Legend shows layers that are not currently active
- Fresh-load defaults become too noisy
- `CoverageDetailPanel` static data is accidentally migrated to live DB queries

---

## 17. Settled Decisions (Do Not Revisit)

- **Drive-time over county boundaries** — coverage tiers are operational, not administrative. Foundational.
- **CoC resource list integrity** — actively maintained. No caveating needed for internal audience.
- **CoverageDetailPanel uses static data by design** — baseline gap calculations require stable reference data. Intentional.
- **SSHP layer hidden in public mode** — disabled via three hard-coded guards. Not a route or visible toggle.
- **Wrong pin is worse than no pin** — geocoder rejects mismatches rather than accepting first-hit results.
- **Services excluded from access gap logic** — unless explicitly redesigned and documented.
- **No hard deletes from application layer** — all deletions on data tables write soft-delete columns. Recovery is SysOp-only via `/sysop`. Foundational to audit integrity.
- **RPC authorization must be explicit for both admin and sysop** — app-layer `isAdmin` (which resolves true for both roles) does not propagate to the database layer. Any RPC that gates on `has_role('admin')` must also check `has_role('sysop')` explicitly. This applies to all existing and future admin RPCs. Sysop row-hiding and modification protection remain in place regardless.
- **Edge functions that write data must authenticate in-function** — Lovable edge functions deploy with `verify_jwt = false`, so `geocode-address` and `geocode-bulk` verify the caller's bearer token via `auth.getUser()` and require an active `admin`/`sysop` row in `user_roles` before any read or write. `geocode-bulk` caps per-call batch size at 100. Client callers must use `supabase.functions.invoke` (never raw `fetch`) so the session token is attached.
- **`anon` cannot execute SECURITY DEFINER functions** — `EXECUTE` is granted to `authenticated`/`service_role` only. `has_role` remains executable by `authenticated` because RLS policies depend on it.

---

## 18. Builder Checklist

Before changing any component, verify:

1. Does this preserve point-based member logic?
2. Does this preserve the difference between active, scheduled, and remote support?
3. Does this avoid overstating field availability?
4. Does this keep public-safe boundaries intact?
5. Does this avoid mixing Services into access-gap logic unless intentional?
6. Does this keep data staging separate from verified live records?
7. Does this keep visual layers synchronized with the legend?
8. Does this keep the default view understandable?
9. Does this avoid broad refactors where a surgical fix is safer?
10. Does the rendered output prove the change worked?

---

## 19. Geocoding Pipeline

Administrative address-to-coordinate enrichment for **public resource records** (never member addresses — those are handled only by `resolve-address`).

### Provider
- **Google Geocoding API** is the sole provider.
- API key stored as `GOOGLE_GEOCODING_API_KEY` in Supabase Edge Function secrets.
- Key is restricted to the Geocoding API only — no other Google services.

### Edge function
- Path: `supabase/functions/geocode-address/index.ts`
- Deployed name: `geocode-address`
- Accepts `POST { table, id, force? }` where `table` is one of `facilities`, `rural_services`, `verified_services`, `verified_bh`, `staging_providers`.
- Requires a bearer token belonging to an active `admin` or `sysop` role; all other callers receive 401/403.
- Column semantics: `facilities` / `rural_services` use `lat`/`lng`; `verified_services`, `verified_bh`, `staging_providers` use `latitude`/`longitude`.
- Calls Google with Nevada/US component bias, maps `location_type` → `coordinate_confidence` (`rooftop` | `range` | `geometric` | `approximate`).

### Trigger path
- Helper: `src/utils/triggerGeocode.ts` — fire-and-forget invocation, errors logged but never surfaced to the user.
- Called from:
  - `src/utils/mappingPipelineStore.ts` — on facility edit when `street_address` changes, and on promotion upsert when `street_address` is present.
  - `src/utils/providerStagingStore.ts` — on staging insert for rows with `street_address`, and on staging edit when `street_address` changes.
- Never called on map load, read, or render.

### Cache-once pattern
Google is called once per address. Results are stored on the record:
- `geocoded_lat`, `geocoded_lng` — raw Google result, never overwritten by display logic.
- `coordinate_source` — `'google'` on success, `'failed'` on no-result.
- `coordinate_confidence` — mapped from Google's `location_type`.
- `geocode_match_type` — raw Google `location_type` (or status code on failure).
- `geocode_provider` — `'google'`.
- `last_geocoded_at` — ISO timestamp of the last attempt.

Re-geocoding only happens when `street_address` changes (which re-triggers the helper) or when `force: true` is passed explicitly.

### Lock semantics
- `coordinate_locked = true` prevents any overwrite of display coordinates.
- Enforced **inside the edge function**: locked records short-circuit before the Google call unless `force: true` is passed, and even on a forced refresh the display columns are not written when locked (only the `geocoded_*` cache columns are updated).

### Display coordinates
- Facilities: `lat`, `lng`
- Staging providers: `latitude`, `longitude`
- These are updated from the Google result on success **unless `coordinate_locked = true`**.
- Map rendering reads from these display columns, not from `geocoded_*`.

### Manual corrections
- `manual_lat`, `manual_lng` exist on `facilities`, `rural_services`, `verified_services`, and `verified_bh` (per generated database types); curated manual coordinates are preferred over automated ones by the canonical matcher.
- Used for human-entered corrections that should survive re-geocoding.
- Staging providers have no manual override columns — corrections happen at promotion or after live.
