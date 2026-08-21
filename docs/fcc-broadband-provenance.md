# FCC Broadband — Provenance Evidence Matrix (Phase 2A.1)

Read-only audit performed before any Phase 2A.1 code change. Scope: the FCC
broadband dataset only.

Artifacts audited:

- `public/data/nevada_broadband.json` (static fallback, 17 records)
- `src/data/broadband-coverage.ts` (application contract + derived fields)
- `supabase/functions/ingest-fcc-broadband/{transform,pipeline,index}.ts` (Phase 2A)
- migration `20260821182035_*.sql` (`data_sources`, `data_source_runs`)
- migration `20260821184652_*.sql` (`data_source_snapshots`, `broadband_county_coverage`)
- `data_sources` row `source_key = 'fcc_broadband'`

## 1. Evidence found in the repository

- `data_sources.source_url` for `fcc_broadband` is **NULL**. No authoritative
  FCC endpoint has ever been recorded. Phase 2A therefore could not have
  ingested FCC data; it validated the pipeline against the shape of the static
  JSON.
- `refresh_method` = "Manual replacement of public/data/nevada_broadband.json".
- `effective_date`, `source_version`, `content_hash`,
  `last_successful_ingestion_at` are all NULL. Status `unknown`.
- Phase 2A `transform.ts` validates *the static JSON shape* (`countyName`,
  `fiberShare`, …). That shape is a Rural Tool shape, not an FCC BDC shape.

### Internal-consistency test (decisive)

For all 17 counties in `public/data/nevada_broadband.json`:

- `pct_100_20_plus + pct_25_3_to_100_20 + pct_below_25_3 = 100.0` exactly
- `fiberShare + cableShare + fixedWirelessShare + satelliteShare = 100.0` exactly

Exact closure to 100.0 in every county, in both groups, is not a property of FCC
Broadband Data Collection availability data. FCC availability is reported per
provider per technology per Broadband Serviceable Location and **overlaps**:
technology percentages do not partition a county. A dataset where four
technology values always sum to exactly 100.0 is a constructed share/mix model,
not an FCC measurement.

Conclusion: the current static values are **editorial/analyst estimates
expressed in an FCC-flavoured vocabulary**. They are not reproducible from FCC
published data, and no evidence in the repository links any specific value to an
FCC release.

## 2. Field classification

| Field | Classification | Evidence |
|---|---|---|
| `pct_100_20_plus` | **unknown** (FCC-vocabulary concept, value provenance unestablished) | Speed tier 100/20 is an FCC concept; the values sum to 100 with the other two tiers and no FCC release is recorded. Reproducible from FCC data only as *% of county Broadband Serviceable Locations with ≥100/20 service* — see §4. |
| `pct_25_3_to_100_20` | **unknown** | Same. Band arithmetic (25/3 tier minus 100/20 tier) is FCC-derivable; the current value is not traceable. |
| `pct_below_25_3` | **unknown** | Same. FCC-derivable as `100 − pct(≥25/3)`. |
| `fiberShare` | **unknown / rural_tool_derived** | "Share" summing to 100 across four technologies is not an FCC output. FCC publishes per-technology *availability* (overlapping percentages), not mix shares. |
| `cableShare` | **unknown / rural_tool_derived** | Same. |
| `fixedWirelessShare` | **unknown / rural_tool_derived** | Same. |
| `satelliteShare` | **unknown / rural_tool_derived** | Same. FCC satellite (GSO/NGSO) availability is near-universal and cannot behave as a residual share. |
| `coverageUnevenness` | **manual/editorial** | Boolean judgement; no FCC field corresponds. Notes text explains it in prose. |
| `notes` | **manual/editorial** | Human prose naming specific towns ("Fallon town has cable/fiber…"). Not authored by the FCC. |
| `operationalReadiness` | **rural_tool_derived** | `deriveOperationalReadiness()` in `src/data/broadband-coverage.ts`. |
| `broadbandStatus` | **rural_tool_derived** | `deriveBroadbandStatus()`. |
| `dominantTechnology` | **rural_tool_derived** | `deriveDominantTech()`. |
| `servedPercent` / `underservedPercent` / `unservedPercent` | **rural_tool_derived** (legacy compat) | Computed in `parseRecords()` from the three tier percentages. |

`fcc_direct` count: **0**. `fcc_derived` count: **0** for values as they exist
today. Nothing currently in the Rural Tool broadband dataset can be attributed
to a specific FCC release.

## 3. Consequence for Phase 2A.1

Because `notes` and `coverageUnevenness` are editorial, they must not be written
into an immutable FCC raw snapshot as if the FCC authored them. Phase 2A.1
therefore separates:

```
FCC source artifacts → hashed raw evidence → FCC-derived county metrics
Rural Tool logic     → coverageUnevenness / notes / readiness / status labels
```

The normalized table keeps the existing columns (no contract change), but
provenance is recorded per run: which columns came from the FCC artifacts of a
given release, and which are carried Rural Tool values.

## 4. Derivation specification (target methodology)

Applies only once a live authoritative acquisition is possible. Every FCC-derived
percentage is defined as numerator / denominator × 100 with an explicit
geographic grouping, technology treatment, and speed threshold.

- **Geographic grouping**: Nevada county, keyed by 5-digit county FIPS
  (state FIPS `32`; 16 counties + Carson City `32510`). County-name strings are
  used only at the Rural Tool compatibility boundary.
- **Denominator**: total Broadband Serviceable Locations (BSLs) in the county as
  published by the FCC for the selected release. **This denominator is not
  computable from the raw availability files alone** — those files enumerate
  provider/location service records, not the county BSL universe. The BSL
  universe comes from the FCC Broadband Serviceable Location Fabric, which is
  licensed and not publicly downloadable. It is therefore only usable if the FCC
  publishes a county-level summary that carries the denominator itself.
- **Numerator (speed tiers)**: count of distinct BSLs in the county with at
  least one *terrestrial* fixed residential offering meeting the threshold.
  Distinct BSL counting is mandatory: multiple providers serving the same
  location must not be counted twice.
- **Speed thresholds**: `≥100/20 Mbps` and `≥25/3 Mbps` exactly as the FCC
  defines them (downstream/upstream advertised speeds).
- **Band arithmetic**:
  - `pct_100_20_plus = BSL(≥100/20) / BSL(total) × 100`
  - `pct_25_3_to_100_20 = (BSL(≥25/3) − BSL(≥100/20)) / BSL(total) × 100`
  - `pct_below_25_3 = 100 − BSL(≥25/3) / BSL(total) × 100`
  - These three partition the county by construction and sum to 100 without
    tuning.
- **Technology treatment**: satellite (GSO/NGSO) is **excluded** from the speed
  tier numerators — the Rural Tool contract documents `pct_below_25_3` as
  "satellite-only or no coverage", so satellite service cannot count as served.
  Satellite is retained separately as an availability measure.
- **Technology measures**: per-technology values are *availability* percentages
  (`BSL served by technology T / BSL total × 100`) and are **overlapping**. They
  do not sum to 100. The current `*Share` fields are a different quantity. This
  is a methodology difference and is reported, not tuned away.

## 5. Blockers recorded

1. No FCC Public Data API credentials are configured for this project.
   `https://broadbandmap.fcc.gov/api/public/map/listAsOfDates` returns
   HTTP 401 `{"status":"fail","status_code":401,"message":"Unauthorized"}`
   without them, so release discovery cannot run.
2. The county BSL denominator required to reproduce the existing percentage
   fields depends on an FCC-published county summary or on the licensed
   Broadband Serviceable Location Fabric.
3. The existing `*Share` fields are not reproducible under any defensible FCC
   methodology, because they are a mix model that sums to 100. Reproducing them
   would require changing what the Rural Tool means by "share" — a business
   logic change, which Phase 2A.1 does not make.
