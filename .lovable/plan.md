# Read-only audit: credential architecture + member-address pin correctness

No files in this Nevada project were changed. Cross-project comparison was **not possible**: this project has cross-project sharing disabled, so the OpsFrame / New Mexico demo could not be read. To enable it: project name (top left) → Project tab → turn off "Disable cross-project sharing". The port list below is therefore written as a checklist against the New Mexico project, not as a verified diff.

## 1. The credential/API-key issue and how it was resolved

Root pattern: the live map and its lookups no longer depend on any paid third-party key. Every key-bearing dependency was either removed from the live path or made optional and fail-closed.

- Basemap: plain OpenStreetMap raster tiles (`MapView.tsx`, one `tileLayer` call). No map API key, no Google/Mapbox/Azure tile credential.
- Frontend variables: only the three auto-generated backend ones (project id, publishable key, URL). No `VITE_` geocoding or map credential exists anywhere in client code, and tests assert that.
- Member-address lookup: resolved fully server-side and in-database (see section 2). Internal lookups report `external_calls: 0`, so a missing provider key can no longer break member pinning.
- Resource/business geocoding: active chain is internal `resource_address` authority → U.S. Census Geocoder (keyless), inside `geocode-address` / `geocode-bulk`. Google Geocoding and public Nominatim are retired; `GOOGLE_GEOCODING_API_KEY` remains only as legacy and is unused by the active path. `census-geocode` is decommissioned (410).
- Credential ordering fix: the internal cache is consulted *before* any external provider is built, so a cache hit succeeds with the provider unconfigured (`cache_hit: true`, `external_calls: 0`) and no failure is attributed to an uncalled provider.
- Optional external member providers stay off: the generic private adapter and the native Azure Maps adapter both require `MEMBER_GEOCODER_APPROVED=true` plus complete config; absent that, the geocoder chain simply omits them. Known public geocoder hosts are refused outright.
- Error hygiene: stable failure codes only; no request URL, key, or service-role credential is ever echoed or logged.

Secret names in play (names only): `GEOCODE_CACHE_HMAC_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `GOOGLE_GEOCODING_API_KEY` (legacy, unused), `FCC_BDC_API_USERNAME` / `FCC_BDC_API_HASH_VALUE` (broadband ingestion only, still unset — that ingestion remains blocked), `LOVABLE_API_KEY`. Optional and unset: `MEMBER_GEOCODER_APPROVED`, `MEMBER_GEOCODER_PROVIDER`, `MEMBER_GEOCODER_ENDPOINT`, `MEMBER_GEOCODER_API_KEY`, `MEMBER_GEOCODER_AUTH_HEADER`, `MEMBER_GEOCODER_AUTH_SCHEME`, `MEMBER_GEOCODER_TIMEOUT_MS`, `AZURE_MAPS_SUBSCRIPTION_KEY`, `AZURE_MAPS_ENDPOINT`, `AZURE_MAPS_API_VERSION`. No values were read or shown.

## 2. Member-address pin/geocoding correctness

- Reference data: `public.tiger_street_ranges` — public Census TIGER/Line 2024 Nevada ADDRFEAT. Verified live: **273,192 rows across 17 counties**. No member data. RLS enabled with no policies, so only `service_role` reads it. Reloadable via `scripts/ingest-tiger-nevada.ts`.
- Database functions: `tiger_match_address`, `tiger_street_exists`, `tiger_interpolate_point` — all `SECURITY DEFINER`, service-role only, deterministic house-range + parity match with interpolation along the matched segment.
- Single normalizer: `supabase/functions/_shared/tigerStreetKey.ts` is shared by ingestion and lookup. Ordinal words normalize to digits (`Sixth St` → `6TH STREET`, `Twenty First St` → `21ST STREET`), including compound tens and the `twelth` typo. Stored `street_key` / `street_core` were regenerated in place with the same normalizer.
- ZIP fail-closed: when the member supplies a ZIP, a candidate must match it — no statewide fallback → `tiger_zip_mismatch`, no pin. Survivors must also sit in one county and within a 0.5 mi spread, else `tiger_ambiguous`. These two defects together caused the earlier `150 Sixth St, Ely` misplacement.
- Non-persistence: `resolve-address` calls the resolver with `persistResolved: false` and `persistUnresolved: false`, so a member search writes no raw address, canonical address, HMAC key, coordinate, or source metadata. Existing manual/coordinate-locked rows still outrank automation.
- Precision honesty: source `internal_tiger`, precision `street_range_interpolated`, confidence `medium`, `is_approximate: true`. City/ZIP-only input is never centroid-pinned; it fails closed to manual placement.
- Failure taxonomy surfaced in the UI (`useMemberAccess.ts`): `tiger_not_a_street_address`, `tiger_out_of_state`, `tiger_no_match`, `tiger_out_of_range`, `tiger_ambiguous`, `tiger_zip_mismatch`, `tiger_unavailable`. The old "lookup is not configured" message is gone.
- Endpoint hardening: member class only (any other `location_class` → 403), 2000-byte body cap, 300-char address cap, no address echoed in errors.
- Member pin rendering: `src/components/map/layers/MemberPinLayer.ts` — 32px navy/white pin, white halo under a heavy navy outline, solid navy core, firm shadow, draggable with `dragend` recentring, `zIndexOffset: 10000`, click/mousedown propagation stopped so the pin is never cleared by the map background handler. Shared resource pins use the same halo approach in `pinVisuals.ts`; selected state keeps the 1.25× scale cue plus ring shadows in `index.css`.
- Tests: `src/test/memberTigerGeocoder.test.ts` plus the boundary/policy suites (565 tests total at last full run).

## 3. Deltas to port to OpsFrame / New Mexico

Verify each against that project once cross-project sharing is enabled.

1. Remove key-bearing map/geocoding dependencies from the live path: OSM raster tiles, no `VITE_` map or geocoder variable.
2. Load state-scoped TIGER/Line ADDRFEAT reference data into a `tiger_street_ranges` table (New Mexico's 33 counties), RLS on with no policies, plus the three `SECURITY DEFINER` match/exists/interpolate functions.
3. Port `tigerStreetKey.ts` verbatim as the single normalizer for both ingestion and lookup, including ordinal-word normalization.
4. Port `tigerMemberGeocoder.ts` decision rules: ZIP hard constraint, one-county requirement, 0.5 mi spread ceiling, no fuzzy matching, explicit reject reasons.
5. Port the `resolve-address` shape: member-class-only authorization, HMAC lookup key, canonical resource match, internal authority, internal TIGER, optional disabled private/Azure adapters, `persistResolved: false`.
6. Replace the state's resource-geocoding provider with the keyless Census chain and the cache-before-provider ordering fix.
7. Port the pin contrast system (`MemberPinLayer.ts`, `pinVisuals.ts`, selected-state CSS).
8. Port the failure-code → user-message mapping so unresolved lookups explain the real reason instead of "not configured".
9. Swap all Nevada-specific constants: state bounds, county FIPS map, other-state token list, state-name regex.
10. Port the regression tests; they are what keeps ingestion and lookup normalization from drifting apart.

## Note on stale documentation (no change made)

`CONTEXT.md` section 19 still describes Google Geocoding as "the sole provider" for resource geocoding, which contradicts the Phase 2D retirement documented earlier in the same file. Worth correcting in a later, separate change.
