/**
 * FCC broadband ingestion — pure validation + transformation.
 *
 * No Deno APIs, no network, no database. Imported by index.ts (edge runtime)
 * and directly by the vitest suite.
 *
 * The transformation target is the CURRENT application contract defined in
 * src/data/broadband-coverage.ts. No new metrics, no unit changes, no
 * reinterpretation of values.
 */

export const TRANSFORMATION_VERSION = 'broadband-county-v1';

/** The 17 Nevada counties (16 counties + Carson City independent city). */
export const NEVADA_COUNTIES = [
  'Carson City',
  'Churchill',
  'Clark',
  'Douglas',
  'Elko',
  'Esmeralda',
  'Eureka',
  'Humboldt',
  'Lander',
  'Lincoln',
  'Lyon',
  'Mineral',
  'Nye',
  'Pershing',
  'Storey',
  'Washoe',
  'White Pine',
] as const;

export const EXPECTED_COUNTY_COUNT = NEVADA_COUNTIES.length;

export type ValidationCode =
  | 'unparseable_payload'
  | 'unexpected_shape'
  | 'no_nevada_records'
  | 'invalid_county_identifier'
  | 'duplicate_county'
  | 'missing_county'
  | 'invalid_numeric_field'
  | 'missing_required_field';

export class BroadbandValidationError extends Error {
  code: ValidationCode;
  constructor(code: ValidationCode, message: string) {
    super(message);
    this.name = 'BroadbandValidationError';
    this.code = code;
  }
}

export interface NormalizedBroadbandRow {
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

/** Same rule the application already uses: strip a trailing " County". */
export const normalizeCountyName = (raw: string): string =>
  String(raw ?? '').replace(/\s+County$/i, '').trim();

export const countyKey = (name: string): string =>
  normalizeCountyName(name).toLowerCase().replace(/\s+/g, '_');

const NUMERIC_FIELDS = [
  'pct_100_20_plus',
  'pct_25_3_to_100_20',
  'pct_below_25_3',
  'fiberShare',
  'cableShare',
  'fixedWirelessShare',
  'satelliteShare',
] as const;

const readNumber = (record: Record<string, unknown>, field: string, county: string): number => {
  if (!(field in record) || record[field] === null || record[field] === undefined) {
    throw new BroadbandValidationError(
      'missing_required_field',
      `${county}: required field "${field}" is missing`,
    );
  }
  const value = record[field];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new BroadbandValidationError(
      'invalid_numeric_field',
      `${county}: field "${field}" is not a finite number (got ${JSON.stringify(value)})`,
    );
  }
  if (value < 0 || value > 100) {
    throw new BroadbandValidationError(
      'invalid_numeric_field',
      `${county}: field "${field}" is outside the 0-100 percentage range (${value})`,
    );
  }
  return value;
};

/** Parse a raw response body. Throws on unparseable JSON. */
export const parsePayload = (body: string): unknown => {
  try {
    return JSON.parse(body);
  } catch (err) {
    throw new BroadbandValidationError(
      'unparseable_payload',
      `Response body is not valid JSON: ${(err as Error).message}`,
    );
  }
};

/**
 * Validate + transform an authoritative payload into normalized rows.
 *
 * Requires exactly the 17 known Nevada counties, each exactly once, with
 * finite numeric metrics. Any violation throws — an invalid upstream response
 * must never reach the normalized table.
 */
export const validateAndTransform = (payload: unknown): NormalizedBroadbandRow[] => {
  if (!Array.isArray(payload)) {
    throw new BroadbandValidationError(
      'unexpected_shape',
      'Expected the payload to be an array of county records',
    );
  }

  const records = payload.filter(
    (r): r is Record<string, unknown> => !!r && typeof r === 'object' && !Array.isArray(r),
  );

  const nevada = records.filter((r) => NEVADA_COUNTIES.includes(
    normalizeCountyName(String(r.countyName ?? '')) as (typeof NEVADA_COUNTIES)[number],
  ));

  if (nevada.length === 0) {
    throw new BroadbandValidationError(
      'no_nevada_records',
      'No identifiable Nevada county records in the payload',
    );
  }

  // Any record that carries a county name we do not recognise is a mapping
  // failure, not something to silently drop.
  for (const record of records) {
    const raw = String(record.countyName ?? '').trim();
    if (!raw) {
      throw new BroadbandValidationError(
        'invalid_county_identifier',
        'A record has no countyName',
      );
    }
    const name = normalizeCountyName(raw);
    if (!NEVADA_COUNTIES.includes(name as (typeof NEVADA_COUNTIES)[number])) {
      throw new BroadbandValidationError(
        'invalid_county_identifier',
        `Unrecognized Nevada county identifier: "${raw}"`,
      );
    }
  }

  const seen = new Set<string>();
  const rows: NormalizedBroadbandRow[] = [];

  for (const record of nevada) {
    const county_name = normalizeCountyName(String(record.countyName));
    const key = countyKey(county_name);
    if (seen.has(key)) {
      throw new BroadbandValidationError('duplicate_county', `Duplicate county record: ${county_name}`);
    }
    seen.add(key);

    for (const field of NUMERIC_FIELDS) readNumber(record, field, county_name);

    rows.push({
      county_key: key,
      county_name,
      pct_100_20_plus: readNumber(record, 'pct_100_20_plus', county_name),
      pct_25_3_to_100_20: readNumber(record, 'pct_25_3_to_100_20', county_name),
      pct_below_25_3: readNumber(record, 'pct_below_25_3', county_name),
      fiber_share: readNumber(record, 'fiberShare', county_name),
      cable_share: readNumber(record, 'cableShare', county_name),
      fixed_wireless_share: readNumber(record, 'fixedWirelessShare', county_name),
      satellite_share: readNumber(record, 'satelliteShare', county_name),
      coverage_unevenness: Boolean(record.coverageUnevenness),
      notes: record.notes === null || record.notes === undefined ? null : String(record.notes),
    });
  }

  const missing = NEVADA_COUNTIES.filter((c) => !seen.has(countyKey(c)));
  if (missing.length > 0) {
    throw new BroadbandValidationError(
      'missing_county',
      `Missing Nevada counties: ${missing.join(', ')}`,
    );
  }

  rows.sort((a, b) => a.county_key.localeCompare(b.county_key));
  return rows;
};

/**
 * Deterministic SHA-256 of the raw retrieved body.
 * Hashed over the exact bytes received, so identical upstream data always
 * produces an identical hash.
 */
export const contentHash = async (body: string): Promise<string> => {
  const bytes = new TextEncoder().encode(body);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};
