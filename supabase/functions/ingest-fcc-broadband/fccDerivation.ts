/**
 * FCC BDC → Nevada county derivation (Phase 2A.1). PURE module.
 *
 * Input: the decompressed CSV text of
 *   bdc_us_fixed_broadband_summary_by_geography_{as_of}_{revision}.csv
 *
 * Documented derivation (denominator, numerator, grouping, technology, speed):
 *
 *   grouping     geography_type = "County", geography_id = 5-digit county FIPS,
 *                restricted to Nevada (state FIPS 32), area_data_type = "Total",
 *                biz_res = "R" (residential units)
 *   denominator  total_units — "a sum of the units in all of the broadband
 *                serviceable locations, taken from the Broadband Serviceable
 *                Location Fabric, in the geography" (FCC Data Downloads spec).
 *                The FCC publishes the percentages already divided by this
 *                denominator, so the licensed Fabric itself is not required.
 *   numerator    units at broadband serviceable locations with reported fixed
 *                service at or above the tier, technology = "All Terrestrial"
 *                (satellite codes 60/61 excluded).
 *   speed tiers  speed_25_3 and speed_100_20 (decimal fractions in the file)
 *
 *   pct_100_20_plus     = speed_100_20 * 100
 *   pct_25_3_to_100_20  = (speed_25_3 - speed_100_20) * 100
 *   pct_below_25_3      = (1 - speed_25_3) * 100
 *
 * These three partition the county by construction and sum to 100 with no
 * tuning. Rounding: half-up to 1 decimal place, applied once, at the end.
 *
 * Per-technology availability (fiber/cable/fixed wireless/satellite) is also
 * derived, but as OVERLAPPING availability percentages at the 25/3 tier. It is
 * NOT the Rural Tool "*Share" mix (which sums to 100). The two quantities are
 * different; this module never converts one into the other.
 */

import { FccIngestionError } from './failureCodes.ts';
import { FCC_SUMMARY_TECHNOLOGY, TECHNOLOGY_TREATMENT } from './fccAcquisition.ts';
import {
  EXPECTED_NEVADA_COUNTY_COUNT,
  countyKeyForName,
  countyNameForFips,
  isNevadaCountyFips,
  missingNevadaCounties,
  toCountyFips,
} from './nevadaCounties.ts';

export const DERIVATION_VERSION = 'fcc-bdc-summary-county-v1';

export const REQUIRED_COLUMNS = [
  'area_data_type',
  'geography_type',
  'geography_id',
  'biz_res',
  'technology',
  'total_units',
  'speed_25_3',
  'speed_100_20',
] as const;

export interface CountyFccMetrics {
  county_fips: string;
  county_key: string;
  county_name: string;
  /** FCC-derived, satellite excluded. */
  pct_100_20_plus: number;
  pct_25_3_to_100_20: number;
  pct_below_25_3: number;
  /** FCC-derived overlapping availability at the 25/3 tier. */
  fcc_fiber_availability: number | null;
  fcc_cable_availability: number | null;
  fcc_fixed_wireless_availability: number | null;
  fcc_satellite_availability: number | null;
  /** Denominator actually used. */
  total_units: number;
}

// ───────────────────────── CSV parsing ─────────────────────────

/** RFC4180-ish splitter: handles quoted fields and embedded commas/quotes. */
export const splitCsvLine = (line: string): string[] => {
  const out: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { out.push(field); field = ''; }
    else field += ch;
  }
  out.push(field);
  return out.map((f) => f.trim());
};

export const parseCsv = (text: string): Record<string, string>[] => {
  const lines = String(text ?? '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    throw new FccIngestionError(
      'fcc_source_parse_failed',
      'FCC summary artifact contains no data rows.',
    );
  }
  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length > 0) {
    throw new FccIngestionError(
      'fcc_source_parse_failed',
      `FCC summary artifact is missing required columns: ${missing.join(', ')}. Present: ${header.join(', ')}.`,
      { missing_columns: missing },
    );
  }
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => { row[h] = cells[i] ?? ''; });
    return row;
  });
};

// ───────────────────────── Derivation ─────────────────────────

/** Half-up rounding to 1 decimal, applied exactly once. */
export const round1 = (n: number): number => Math.round((n + Number.EPSILON) * 10) / 10;

/**
 * Parse an FCC decimal fraction. Empty string is NOT silently zero: it means
 * "not reported", which invalidates the county rather than fabricating 0%.
 */
const fraction = (raw: string, field: string, county: string): number => {
  const text = String(raw ?? '').trim();
  if (text.length === 0) {
    throw new FccIngestionError(
      'fcc_validation_failed',
      `${county}: FCC field "${field}" is empty; refusing to treat a missing value as 0.`,
    );
  }
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0 || value > 1.0000001) {
    throw new FccIngestionError(
      'fcc_validation_failed',
      `${county}: FCC field "${field}" is not a 0–1 fraction (got "${text}").`,
    );
  }
  return Math.min(value, 1);
};

const optionalFraction = (row: Record<string, string> | undefined, field: string): number | null => {
  if (!row) return null;
  const text = String(row[field] ?? '').trim();
  if (!text) return null;
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0 || value > 1.0000001) return null;
  return round1(Math.min(value, 1) * 100);
};

const AREA_TOTAL = 'total';
const GEO_COUNTY = 'county';
const BIZ_RES = 'r';

export interface DerivationSummary {
  version: string;
  denominator: string;
  grouping: Record<string, string>;
  formulas: Record<string, string>;
  technology_treatment: typeof TECHNOLOGY_TREATMENT;
  rows_considered: number;
  counties_derived: number;
}

export interface DerivationOutput {
  metrics: CountyFccMetrics[];
  summary: DerivationSummary;
}

/**
 * Derive the 17 Nevada county records. Throws rather than emitting a partial
 * dataset: an incomplete derivation must never reach the normalized table.
 */
export const deriveNevadaCounties = (csvText: string): DerivationOutput => {
  const rows = parseCsv(csvText);

  const nevadaCountyRows = rows.filter((r) => {
    if (String(r.area_data_type ?? '').trim().toLowerCase() !== AREA_TOTAL) return false;
    if (String(r.geography_type ?? '').trim().toLowerCase() !== GEO_COUNTY) return false;
    if (String(r.biz_res ?? '').trim().toLowerCase() !== BIZ_RES) return false;
    return isNevadaCountyFips(toCountyFips(r.geography_id));
  });

  if (nevadaCountyRows.length === 0) {
    throw new FccIngestionError(
      'fcc_validation_failed',
      'FCC summary artifact contains no Nevada county rows (area_data_type=Total, geography_type=County, biz_res=R).',
      { rows_scanned: rows.length },
    );
  }

  const byCounty = new Map<string, Map<string, Record<string, string>>>();
  for (const row of nevadaCountyRows) {
    const fips = toCountyFips(row.geography_id)!;
    const tech = String(row.technology ?? '').trim().toLowerCase();
    if (!byCounty.has(fips)) byCounty.set(fips, new Map());
    const bucket = byCounty.get(fips)!;
    if (bucket.has(tech)) {
      throw new FccIngestionError(
        'fcc_validation_failed',
        `Duplicate FCC row for county ${fips} technology "${row.technology}" — refusing to double-count.`,
      );
    }
    bucket.set(tech, row);
  }

  const metrics: CountyFccMetrics[] = [];

  for (const [fips, bucket] of byCounty) {
    const county_name = countyNameForFips(fips)!;
    const tierRow = bucket.get(FCC_SUMMARY_TECHNOLOGY.SPEED_TIERS.toLowerCase());
    if (!tierRow) {
      throw new FccIngestionError(
        'fcc_validation_failed',
        `${county_name}: no "${FCC_SUMMARY_TECHNOLOGY.SPEED_TIERS}" row, so the speed-tier numerators cannot be derived.`,
      );
    }

    const totalUnits = Number(String(tierRow.total_units ?? '').replace(/,/g, ''));
    if (!Number.isFinite(totalUnits) || totalUnits <= 0) {
      throw new FccIngestionError(
        'fcc_validation_failed',
        `${county_name}: total_units denominator is missing or non-positive.`,
      );
    }

    const s25 = fraction(tierRow.speed_25_3, 'speed_25_3', county_name);
    const s100 = fraction(tierRow.speed_100_20, 'speed_100_20', county_name);
    if (s100 > s25 + 1e-9) {
      throw new FccIngestionError(
        'fcc_validation_failed',
        `${county_name}: speed_100_20 (${s100}) exceeds speed_25_3 (${s25}); tiers are not nested as documented.`,
      );
    }

    metrics.push({
      county_fips: fips,
      county_key: countyKeyForName(county_name),
      county_name,
      pct_100_20_plus: round1(s100 * 100),
      pct_25_3_to_100_20: round1((s25 - s100) * 100),
      pct_below_25_3: round1((1 - s25) * 100),
      fcc_fiber_availability: optionalFraction(
        bucket.get(FCC_SUMMARY_TECHNOLOGY.FIBER.toLowerCase()), 'speed_25_3'),
      fcc_cable_availability: optionalFraction(
        bucket.get(FCC_SUMMARY_TECHNOLOGY.CABLE.toLowerCase()), 'speed_25_3'),
      fcc_fixed_wireless_availability: optionalFraction(
        bucket.get(FCC_SUMMARY_TECHNOLOGY.FIXED_WIRELESS.toLowerCase()), 'speed_25_3'),
      fcc_satellite_availability: optionalFraction(
        bucket.get(FCC_SUMMARY_TECHNOLOGY.SATELLITE.toLowerCase()), 'speed_25_3'),
      total_units: totalUnits,
    });
  }

  const missing = missingNevadaCounties(metrics.map((m) => m.county_fips));
  if (missing.length > 0) {
    throw new FccIngestionError(
      'fcc_validation_failed',
      `FCC release does not cover every Nevada county. Missing FIPS: ${missing.join(', ')}.`,
      { missing_fips: missing },
    );
  }
  if (metrics.length !== EXPECTED_NEVADA_COUNTY_COUNT) {
    throw new FccIngestionError(
      'fcc_validation_failed',
      `Expected ${EXPECTED_NEVADA_COUNTY_COUNT} Nevada counties, derived ${metrics.length}.`,
    );
  }

  metrics.sort((a, b) => a.county_fips.localeCompare(b.county_fips));

  return {
    metrics,
    summary: {
      version: DERIVATION_VERSION,
      denominator:
        'total_units — sum of units at all Broadband Serviceable Locations in the county, per the FCC Broadband Serviceable Location Fabric, as published by the FCC in the summary-by-geography artifact.',
      grouping: {
        geography_type: 'County',
        geography_id: '5-digit county FIPS (Nevada state FIPS 32)',
        area_data_type: 'Total',
        biz_res: 'R (residential units)',
      },
      formulas: {
        pct_100_20_plus: 'speed_100_20 * 100',
        pct_25_3_to_100_20: '(speed_25_3 - speed_100_20) * 100',
        pct_below_25_3: '(1 - speed_25_3) * 100',
        technology_availability: 'per-technology speed_25_3 * 100 (OVERLAPPING availability, not a 100% mix)',
      },
      technology_treatment: TECHNOLOGY_TREATMENT,
      rows_considered: nevadaCountyRows.length,
      counties_derived: metrics.length,
    },
  };
};

/**
 * Compatibility boundary: FCC facts + carried Rural Tool interpretation →
 * the existing `broadband_county_coverage` row shape.
 *
 * The `*_share`, `coverage_unevenness` and `notes` columns are Rural Tool
 * values (see docs/fcc-broadband-provenance.md). They are CARRIED FORWARD from
 * the currently active dataset, never invented from FCC availability, because
 * they are a different quantity than FCC per-technology availability.
 */
export interface CarriedRuralToolValues {
  county_key: string;
  fiber_share: number;
  cable_share: number;
  fixed_wireless_share: number;
  satellite_share: number;
  coverage_unevenness: boolean;
  notes: string | null;
}

export interface NormalizedCountyRow {
  county_key: string;
  county_name: string;
  pct_100_20_plus: number;
  pct_25_3_to_100_20: number;
  pct_below_25_3: number;
  fiber_share: number;
  cable_share: number;
  fixed_wireless_share: number;
  satellite_share: number;
  coverage_unevenness: boolean;
  notes: string | null;
}

export const toNormalizedRows = (
  metrics: CountyFccMetrics[],
  carried: CarriedRuralToolValues[],
): NormalizedCountyRow[] => {
  const carriedByKey = new Map(carried.map((c) => [c.county_key, c]));
  return metrics.map((m) => {
    const c = carriedByKey.get(m.county_key);
    if (!c) {
      throw new FccIngestionError(
        'fcc_transformation_failed',
        `No carried Rural Tool interpretation values for ${m.county_name}; refusing to invent share values.`,
      );
    }
    return {
      county_key: m.county_key,
      county_name: m.county_name,
      pct_100_20_plus: m.pct_100_20_plus,
      pct_25_3_to_100_20: m.pct_25_3_to_100_20,
      pct_below_25_3: m.pct_below_25_3,
      fiber_share: c.fiber_share,
      cable_share: c.cable_share,
      fixed_wireless_share: c.fixed_wireless_share,
      satellite_share: c.satellite_share,
      coverage_unevenness: c.coverage_unevenness,
      notes: c.notes,
    };
  });
};
