/**
 * FCC Broadband Data Collection (BDC) Public Data API — acquisition protocol.
 *
 * PURE module: no Deno APIs, no network, no database. The edge runtime supplies
 * transport; vitest exercises the decision rules directly.
 *
 * Official contract (see docs/fcc-broadband-provenance.md §6 for citations):
 *   base            https://broadbandmap.fcc.gov/api/public/map
 *   auth headers    username, hash_value          (NOT Authorization)
 *   release list    GET /listAsOfDates
 *   file manifest   GET /downloads/listAvailabilityData/{as_of_date}
 *   file download   GET /downloads/downloadFile/availability/{file_id}
 *
 * Evidence that these routes exist and are credential-gated: unauthenticated
 * GETs return HTTP 401 {"status":"fail","status_code":401,...} while an unknown
 * route on the same API returns HTTP 405 "Method Not Available".
 */

import { FccIngestionError } from './failureCodes.ts';
import { NEVADA_COUNTY_FIPS, NEVADA_STATE_FIPS, NEVADA_STATE_USPS } from './nevadaCounties.ts';

export const FCC_API_BASE = 'https://broadbandmap.fcc.gov/api/public/map';

/** Secret NAMES only. Values live in the edge runtime environment. */
export const FCC_CREDENTIAL_ENV_NAMES = [
  'FCC_BDC_API_USERNAME',
  'FCC_BDC_API_HASH_VALUE',
] as const;

export interface FccCredentials {
  username: string;
  hashValue: string;
}

export const ACQUISITION_PROTOCOL_VERSION = 'fcc-bdc-public-data-api-v1';

/** Endpoint builders — the reproducible protocol. */
export const fccEndpoints = {
  listAsOfDates: () => `${FCC_API_BASE}/listAsOfDates`,
  listAvailabilityData: (asOfDate: string) =>
    `${FCC_API_BASE}/downloads/listAvailabilityData/${asOfDate}`,
  downloadFile: (fileId: string) =>
    `${FCC_API_BASE}/downloads/downloadFile/availability/${fileId}`,
};

/**
 * Resolve credentials from an environment reader.
 * Fails with fcc_credentials_missing and names — never values.
 */
export const resolveCredentials = (
  read: (name: string) => string | undefined,
): FccCredentials => {
  const missing = FCC_CREDENTIAL_ENV_NAMES.filter((n) => !(read(n) ?? '').trim());
  if (missing.length > 0) {
    throw new FccIngestionError(
      'fcc_credentials_missing',
      `FCC Public Data API credentials are not configured. Required secret names: ${missing.join(', ')}.`,
      { required_secret_names: missing },
    );
  }
  return {
    username: (read('FCC_BDC_API_USERNAME') ?? '').trim(),
    hashValue: (read('FCC_BDC_API_HASH_VALUE') ?? '').trim(),
  };
};

export const authHeaders = (creds: FccCredentials): Record<string, string> => ({
  username: creds.username,
  hash_value: creds.hashValue,
  Accept: 'application/json',
});

// ───────────────────────── Release discovery ─────────────────────────

export interface AsOfDateEntry {
  as_of_date?: string;
  data_type?: string;
  [k: string]: unknown;
}

export interface SelectedRelease {
  asOfDate: string;
  dataType: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Deterministic selection rule (documented, not inferred at runtime):
 *
 *   1. Keep only entries whose `data_type` is exactly "availability"
 *      (the published fixed/mobile availability release family). Filing
 *      windows and challenge vintages are excluded.
 *   2. Keep only entries whose `as_of_date` is a valid ISO calendar date.
 *   3. Discard any as-of date in the future relative to `today`.
 *   4. Select the maximum remaining ISO date (lexicographic == chronological).
 *   5. Ties are impossible: as-of dates are unique per data_type.
 *
 * A filing deadline or collection period is never selected merely because it
 * appears in the response.
 */
export const selectLatestPublishedRelease = (
  entries: unknown,
  today: Date,
): SelectedRelease => {
  const rows: AsOfDateEntry[] = Array.isArray(entries)
    ? (entries as AsOfDateEntry[])
    : Array.isArray((entries as { data?: unknown })?.data)
      ? ((entries as { data: AsOfDateEntry[] }).data)
      : [];

  if (rows.length === 0) {
    throw new FccIngestionError(
      'fcc_release_discovery_failed',
      'FCC listAsOfDates returned no entries.',
    );
  }

  const todayIso = today.toISOString().slice(0, 10);
  const candidates = rows
    .filter((r) => String(r.data_type ?? '').trim().toLowerCase() === 'availability')
    .map((r) => String(r.as_of_date ?? '').trim())
    .filter((d) => ISO_DATE.test(d) && !Number.isNaN(Date.parse(d)) && d <= todayIso)
    .sort();

  const asOfDate = candidates[candidates.length - 1];
  if (!asOfDate) {
    throw new FccIngestionError(
      'fcc_no_valid_release',
      'No published FCC fixed-availability release (data_type="availability") with a non-future as-of date was advertised.',
      { advertised: rows.length },
    );
  }
  return { asOfDate, dataType: 'availability' };
};

// ───────────────────────── Manifest discovery ─────────────────────────

export interface ManifestFile {
  file_id?: string | number;
  file_name?: string;
  file_type?: string;
  category?: string;
  subcategory?: string;
  state_fips?: string | number | null;
  state_name?: string | null;
  technology_code?: string | number | null;
  technology_code_desc?: string | null;
  [k: string]: unknown;
}

export interface RequiredArtifact {
  fileId: string;
  fileName: string;
  /** Why this artifact is required — recorded in snapshot provenance. */
  role: 'fixed_summary_by_geography';
  category: string | null;
  subcategory: string | null;
}

const asText = (v: unknown): string => String(v ?? '').trim();
const lower = (v: unknown): string => asText(v).toLowerCase();

/**
 * The ONE public artifact that carries a county-level denominator:
 * "Fixed Broadband Summary by Geography Type"
 *   bdc_us_fixed_broadband_summary_by_geography_{as_of}_{revision}.zip
 *
 * It is published as a single nationwide file — the FCC does not publish a
 * per-state equivalent at county granularity. Nevada restriction therefore
 * happens on the county FIPS rows inside the file, not at download time.
 *
 * Per-state per-technology location-level availability CSVs are deliberately
 * NOT downloaded: they carry no unit counts and no county identifier, so they
 * cannot produce a county denominator without the licensed Broadband
 * Serviceable Location Fabric.
 */
export const selectRequiredNevadaArtifacts = (manifest: unknown): RequiredArtifact[] => {
  const rows: ManifestFile[] = Array.isArray(manifest)
    ? (manifest as ManifestFile[])
    : Array.isArray((manifest as { data?: unknown })?.data)
      ? ((manifest as { data: ManifestFile[] }).data)
      : [];

  if (rows.length === 0) {
    throw new FccIngestionError(
      'fcc_manifest_failed',
      'FCC availability manifest returned no files for the selected release.',
    );
  }

  const isSummaryByGeography = (r: ManifestFile): boolean => {
    const name = lower(r.file_name);
    const label = `${lower(r.category)} ${lower(r.subcategory)}`;
    const nameMatch =
      name.includes('fixed_broadband_summary_by_geography') ||
      (name.includes('fixed') && name.includes('summary') && name.includes('geography'));
    const labelMatch =
      label.includes('summary by geography') &&
      (label.includes('fixed') || name.includes('fixed'));
    return nameMatch || labelMatch;
  };

  /** Nationwide scope: no state_fips, or explicitly Nevada. */
  const isInScope = (r: ManifestFile): boolean => {
    const fips = asText(r.state_fips);
    const stateName = lower(r.state_name);
    if (!fips && !stateName) return true; // nationwide file
    if (fips && fips.padStart(2, '0') === NEVADA_STATE_FIPS) return true;
    return stateName === 'nevada' || stateName === lower(NEVADA_STATE_USPS);
  };

  const matches = rows.filter((r) => isSummaryByGeography(r) && isInScope(r));

  if (matches.length === 0) {
    throw new FccIngestionError(
      'fcc_nevada_files_missing',
      'The FCC manifest for the selected release contains no "Fixed Broadband Summary by Geography Type" artifact, which is the only public file carrying a county-level denominator.',
      { manifest_rows: rows.length },
    );
  }

  const artifacts = matches
    .map((r) => ({
      fileId: asText(r.file_id),
      fileName: asText(r.file_name) || `fcc_fixed_summary_by_geography_${asText(r.file_id)}`,
      role: 'fixed_summary_by_geography' as const,
      category: asText(r.category) || null,
      subcategory: asText(r.subcategory) || null,
    }))
    .filter((a) => a.fileId.length > 0);

  if (artifacts.length === 0) {
    throw new FccIngestionError(
      'fcc_nevada_files_missing',
      'Matching FCC summary artifact carries no file_id, so it cannot be downloaded reproducibly.',
    );
  }

  // Deterministic order so multi-artifact run identity is stable.
  artifacts.sort((a, b) => a.fileName.localeCompare(b.fileName) || a.fileId.localeCompare(b.fileId));
  return artifacts;
};

// ───────────────────────── Technology crosswalk ─────────────────────────

/**
 * FCC BDC FIXED technology codes (Data Downloads spec, fixed availability file).
 * Codes appear in the location-level availability CSVs; the summary-by-geography
 * file uses the descriptive names / rollups in FCC_SUMMARY_TECHNOLOGY.
 */
export const FCC_FIXED_TECHNOLOGY_CODES: Record<string, string> = {
  '0': 'Other',
  '10': 'Copper Wire',
  '40': 'Coaxial Cable / HFC',
  '50': 'Optical Carrier / Fiber to the Premises',
  '60': 'Geostationary Satellite',
  '61': 'Non-geostationary Satellite',
  '70': 'Unlicensed Fixed Wireless',
  '71': 'Licensed Fixed Wireless',
  '72': 'Licensed-by-Rule Fixed Wireless',
};

/** Technology labels used by the summary-by-geography file. */
export const FCC_SUMMARY_TECHNOLOGY = {
  /** Speed-tier numerators. Satellite EXCLUDED — see provenance doc §4. */
  SPEED_TIERS: 'All Terrestrial',
  FIBER: 'Fiber',
  CABLE: 'Cable',
  FIXED_WIRELESS: 'All Fixed Wireless',
  SATELLITE: 'All Satellite',
} as const;

/** Explicit inclusion/exclusion record persisted with every run. */
export const TECHNOLOGY_TREATMENT = {
  speed_tiers: {
    summary_technology: FCC_SUMMARY_TECHNOLOGY.SPEED_TIERS,
    included_codes: ['10', '40', '50', '70', '71', '72'],
    excluded_codes: ['60', '61'],
    reason:
      'The Rural Tool contract defines pct_below_25_3 as "satellite-only or no coverage", so geostationary (60) and non-geostationary (61) satellite cannot count as served in a speed tier.',
  },
  technology_availability: {
    fiber: ['50'],
    cable: ['40'],
    fixed_wireless: ['70', '71', '72'],
    satellite: ['60', '61'],
    note: 'Per-technology values are overlapping availability percentages, not a mix that sums to 100.',
  },
} as const;

/** Aggregate identity across multiple source artifacts (deterministic). */
export const aggregateArtifactIdentity = (
  hashes: { fileName: string; sha256: string }[],
): string =>
  hashes
    .slice()
    .sort((a, b) => a.fileName.localeCompare(b.fileName))
    .map((h) => `${h.fileName}:${h.sha256}`)
    .join('|');

export const NEVADA_COUNTY_FIPS_LIST = NEVADA_COUNTY_FIPS.map((c) => c.fips);
