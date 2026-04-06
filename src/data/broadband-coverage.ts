/**
 * County-level broadband coverage data for rural Nevada.
 *
 * Loads real FCC-derived data from /data/nevada_broadband.json at runtime.
 * Fetched once and cached for the session lifetime.
 */

export type DominantTechnology = 'Fiber' | 'Fixed Wireless' | 'Satellite' | 'Mixed' | 'Unknown' | 'Any Technology';
export type BroadbandStatus = 'Served' | 'Underserved' | 'Unserved';

export interface CountyBroadbandData {
  countyName: string;
  servedPercent: number;
  underservedPercent: number;
  unservedPercent: number;
  dominantTechnology: DominantTechnology;
  broadbandStatus: BroadbandStatus;
  notes?: string;
}

/** Derive broadband status from percentages */
export const deriveBroadbandStatus = (
  servedPercent: number,
  _underservedPercent: number,
  unservedPercent: number,
): BroadbandStatus => {
  if (servedPercent >= 60) return 'Served';
  if (unservedPercent >= 40) return 'Unserved';
  return 'Underserved';
};

// ── Normalize county name: strip trailing " County", trim ──
const normalizeCountyName = (raw: string): string =>
  raw.replace(/\s+County$/i, '').trim();

const coerceStatus = (raw: unknown, s: number, u2: number, u3: number): BroadbandStatus => {
  if (raw === 'Served' || raw === 'Underserved' || raw === 'Unserved') return raw;
  return deriveBroadbandStatus(s, u2, u3);
};

// ── Shared mutable arrays/maps — consumers import these references ──

/** All loaded county broadband records (mutated in place after fetch) */
export const COUNTY_BROADBAND_DATA: CountyBroadbandData[] = [];

/** O(1) lookup by county name (mutated in place after fetch) */
export const BROADBAND_BY_COUNTY = new Map<string, CountyBroadbandData>();

let _loadPromise: Promise<boolean> | null = null;

/** Parse raw JSON into typed records */
const parseRecords = (raw: unknown[]): CountyBroadbandData[] =>
  raw
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
    .map((r) => {
      const countyName = normalizeCountyName(String(r.countyName ?? ''));
      const servedPercent = Number(r.servedPercent ?? 0);
      const underservedPercent = Number(r.underservedPercent ?? 0);
      const unservedPercent = Number(r.unservedPercent ?? 0);
      const dominantTechnology = (r.dominantTechnology ?? 'Unknown') as DominantTechnology;
      const broadbandStatus = coerceStatus(r.broadbandStatus, servedPercent, underservedPercent, unservedPercent);
      return { countyName, servedPercent, underservedPercent, unservedPercent, dominantTechnology, broadbandStatus };
    })
    .filter((d) => d.countyName.length > 0);

/**
 * Fetch the broadband dataset from /data/nevada_broadband.json.
 * Safe to call multiple times — deduplicates.
 * Returns true if data loaded successfully.
 */
export const loadBroadbandData = (): Promise<boolean> => {
  if (_loadPromise) return _loadPromise;
  _loadPromise = (async () => {
    try {
      const resp = await fetch('/data/nevada_broadband.json');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      if (!Array.isArray(json)) throw new Error('Expected array');
      const records = parseRecords(json);

      // Mutate shared exported references in place so all consumers see data
      COUNTY_BROADBAND_DATA.length = 0;
      COUNTY_BROADBAND_DATA.push(...records);
      BROADBAND_BY_COUNTY.clear();
      records.forEach((d) => BROADBAND_BY_COUNTY.set(d.countyName, d));

      console.info('[Broadband] Loaded', records.length, 'county records from /data/nevada_broadband.json');
      return true;
    } catch (err) {
      console.warn('[Broadband] Failed to load dataset:', err);
      return false;
    }
  })();
  return _loadPromise;
};

/** Get broadband data for a county, returns undefined if not found.
 *  Normalizes the input name to handle "County" suffix variants. */
export const getCountyBroadband = (countyName: string): CountyBroadbandData | undefined =>
  BROADBAND_BY_COUNTY.get(normalizeCountyName(countyName));
