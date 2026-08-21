# Nevada Rural Medicaid Access Tool — Project Context Document

**Last updated:** May 2026  
**Version:** 2.0 (merged)  
**Maintained by:** Maurice / NBH  
**Purpose:** Single authoritative reference for all Claude and Lovable sessions. Paste at the start of any new conversation to preserve continuity.

---

## 1. One-Sentence Summary

The Rural Medicaid Access Tool is a live operational decision system that translates rural geography, Medicaid network reality, field staffing, and member location into honest access guidance — without pretending that county borders equal care access.

---

## 2. What This Tool Is (and Is Not)

**Working names:** Rural Medicaid Access Tool / Rural Operations Map / Nevada Behavioral Health Rural Coverage & Capacity Map  
**Live URL:** ruralmap.opsframe.io

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
| Geocoding      | Nominatim (Nevada-bounded, multi-candidate validation, address structure comparison) |
| Error tracking | Sentry (integrated)                                                                  |
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
| `facilities`                                          | 53 records (seeded Phase 3)                             |
| `rural_services`                                      | 172 records (seeded Phase 3)                            |
| `mapping_audit_log`                                   | Pipeline audit trail (written; not yet displayed in UI) |
| `user_roles`                                          | Role definitions for RBAC                               |
| `data_sources`                                        | Source Registry — provenance/governance metadata (Phase 6a) |
| `data_source_runs`                                    | Append-only source retrieval/ingestion health history       |
| `data_source_snapshots`                               | Immutable raw retrieval evidence per ingestion (Phase 6b)   |
| `broadband_county_coverage`                           | Normalized internalized FCC broadband dataset, 17 counties (Phase 6b) |


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


### Key Files and Hooks

| File                               | Purpose                                                        |
| ---------------------------------- | -------------------------------------------------------------- |
| `src/hooks/useFacilityData.ts`     | Reads facilities from Supabase                                 |
| `src/hooks/useRuralServiceData.ts` | Reads rural services from Supabase                             |
| `src/hooks/useMemberAccess.ts`     | Member address geocoding and access analysis                   |
| `src/hooks/useMapLayers.ts`        | Layer toggle state including `sshpCatchments`                  |
| `src/data/sshpCatchments.ts`       | SSHP overlay data (static; disabled in public mode)            |
| `src/components/ErrorBoundary.tsx` | App-level error boundary, wired to Sentry                      |
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
| **Phase 5 (partial)** | Sentry integrated; ErrorBoundary wired; admin navigation normalized                                                | ✅     |
| **Phase 6a**          | Source Registry foundation: `data_sources` + `data_source_runs` with role-scoped RLS, deterministic source-health helper, `/admin/data-sources` governance surface, admin-only gap warnings, 19 seeded sources from repository evidence. No live data source changed. | ✅     |
| **Phase 5b**          | SysOp role tier added (sysop > admin > ops > staff > viewer); soft delete implemented on 7 tables; `/sysop` deletion recovery queue built; auto-assign trigger hardcoded to operator emails; admin RPCs hardened to refuse sysop targets; audit log captures delete and restore events | ✅     |
| **Phase 6b**          | FCC broadband internalized end-to-end: `data_source_snapshots` (immutable raw evidence) + `broadband_county_coverage` (17 normalized counties), server-side `ingest-fcc-broadband` edge function with atomic all-or-nothing replacement, application reads the normalized table with static JSON fallback retained. Authoritative FCC URL still UNKNOWN. | ✅     |
| **Phase 6c**          | FCC broadband bound to the real BDC Public Data API: credentialed server-side acquisition (fail-closed on missing secrets), release discovery, county summary artifact selection, immutable hashed raw evidence in the private `source-evidence` bucket, reproducible `fcc-bdc-summary-county-v1` derivation with satellite excluded, single-code failure taxonomy, dry-run mode, and a per-run FCC-vs-current comparison report. Provenance and methodology differences documented in `docs/fcc-broadband-provenance.md`. Live authoritative run pending FCC credentials. | ◑ blocked on credentials |


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
| Rate limiting on Edge Functions                         | None on `census-geocode`, `geocode-bulk`, `invite-user`                | Medium       |
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

Address-to-coordinate enrichment for `facilities` and `staging_providers` records.

### Provider
- **Google Geocoding API** is the sole provider.
- API key stored as `GOOGLE_GEOCODING_API_KEY` in Supabase Edge Function secrets.
- Key is restricted to the Geocoding API only — no other Google services.

### Edge function
- Path: `supabase/functions/geocode-address/index.ts`
- Deployed name: `geocode-address`
- Accepts `POST { table: "facilities" | "staging_providers", id: string, force?: boolean }`
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
- `manual_lat`, `manual_lng` exist on `facilities` only.
- Used for human-entered corrections that should survive re-geocoding.
- Staging providers have no manual override columns — corrections happen at promotion or after live.
