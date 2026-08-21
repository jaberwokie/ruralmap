/**
 * Canonical Nevada county crosswalk (Phase 2A.1).
 *
 * Federal Information Processing Standards (FIPS) county codes are the
 * authoritative internal identifier while processing raw FCC data. County-name
 * strings are used ONLY at the compatibility boundary where the normalized
 * record is handed to the existing Rural Tool broadband contract.
 *
 * Source of the codes: U.S. Census Bureau / FIPS 6-4 state 32 (Nevada).
 * 16 counties + Carson City (independent city, FIPS 32510).
 */

export const NEVADA_STATE_FIPS = '32';
export const NEVADA_STATE_USPS = 'NV';

export interface NevadaCounty {
  /** 5-digit county FIPS (state + county). */
  fips: string;
  /** Rural Tool contract name (no " County" suffix). */
  name: string;
}

export const NEVADA_COUNTY_FIPS: readonly NevadaCounty[] = [
  { fips: '32001', name: 'Churchill' },
  { fips: '32003', name: 'Clark' },
  { fips: '32005', name: 'Douglas' },
  { fips: '32007', name: 'Elko' },
  { fips: '32009', name: 'Esmeralda' },
  { fips: '32011', name: 'Eureka' },
  { fips: '32013', name: 'Humboldt' },
  { fips: '32015', name: 'Lander' },
  { fips: '32017', name: 'Lincoln' },
  { fips: '32019', name: 'Lyon' },
  { fips: '32021', name: 'Mineral' },
  { fips: '32023', name: 'Nye' },
  { fips: '32027', name: 'Pershing' },
  { fips: '32029', name: 'Storey' },
  { fips: '32031', name: 'Washoe' },
  { fips: '32033', name: 'White Pine' },
  { fips: '32510', name: 'Carson City' },
] as const;

export const EXPECTED_NEVADA_COUNTY_COUNT = NEVADA_COUNTY_FIPS.length; // 17

const BY_FIPS = new Map(NEVADA_COUNTY_FIPS.map((c) => [c.fips, c]));

/** Normalize an FCC geography identifier to a 5-digit FIPS string. */
export const toCountyFips = (raw: unknown): string | null => {
  const digits = String(raw ?? '').trim().replace(/\D/g, '');
  if (digits.length === 0) return null;
  const padded = digits.padStart(5, '0');
  return padded.length === 5 ? padded : null;
};

export const isNevadaCountyFips = (fips: string | null): boolean =>
  !!fips && BY_FIPS.has(fips);

export const countyNameForFips = (fips: string): string | null =>
  BY_FIPS.get(fips)?.name ?? null;

/** Rural Tool county_key convention (lowercase, underscores). */
export const countyKeyForName = (name: string): string =>
  name.toLowerCase().replace(/\s+/g, '_');

/** FIPS codes missing from a produced set — used by validation. */
export const missingNevadaCounties = (seen: Iterable<string>): string[] => {
  const have = new Set(seen);
  return NEVADA_COUNTY_FIPS.filter((c) => !have.has(c.fips)).map((c) => c.fips);
};
