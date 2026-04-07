/**
 * County-level broadband coverage data for rural Nevada.
 *
 * Loads real FCC-derived data from /data/nevada_broadband.json at runtime.
 * Uses distribution-based model — NOT max-value-across-technologies.
 */

export type OperationalBroadbandReadiness = 'High' | 'Mixed' | 'Low';
export type BroadbandStatus = 'Served' | 'Underserved' | 'Unserved';

export interface CountyBroadbandData {
  countyName: string;
  /** % of county with ≥100/20 Mbps from any terrestrial technology */
  pct_100_20_plus: number;
  /** % of county with 25/3–100/20 Mbps */
  pct_25_3_to_100_20: number;
  /** % of county below 25/3 Mbps (satellite-only or no coverage) */
  pct_below_25_3: number;
  /** Technology share percentages (should sum to ~100) */
  fiberShare: number;
  cableShare: number;
  fixedWirelessShare: number;
  satelliteShare: number;
  /** Whether coverage varies significantly across the county */
  coverageUnevenness: boolean;
  /** Derived operational readiness */
  operationalReadiness: OperationalBroadbandReadiness;
  /** Legacy compat — derived from distribution */
  broadbandStatus: BroadbandStatus;
  /** Legacy compat — derived from shares */
  dominantTechnology: string;
  /** Served/underserved/unserved percents for legacy compat */
  servedPercent: number;
  underservedPercent: number;
  unservedPercent: number;
  notes?: string;
}

// ── Normalize county name: strip trailing " County", trim ──
const normalizeCountyName = (raw: string): string =>
  raw.replace(/\s+County$/i, '').trim();

/** Derive operational readiness from distribution + technology mix */
export const deriveOperationalReadiness = (
  pct100: number,
  satelliteShare: number,
  fiberShare: number,
  cableShare: number,
): OperationalBroadbandReadiness => {
  const terrestrialShare = fiberShare + cableShare;
  if (pct100 >= 70 && terrestrialShare >= 50) return 'High';
  if (pct100 <= 30 || satelliteShare >= 55) return 'Low';
  return 'Mixed';
};

/** Derive broadband status from distribution */
export const deriveBroadbandStatus = (
  pct100: number,
  pctBelow25: number,
): BroadbandStatus => {
  if (pct100 >= 70) return 'Served';
  if (pctBelow25 >= 50) return 'Unserved';
  return 'Underserved';
};

/** Derive dominant technology label from shares */
const deriveDominantTech = (fiber: number, cable: number, fw: number, sat: number): string => {
  const max = Math.max(fiber, cable, fw, sat);
  if (max === fiber) return 'Fiber';
  if (max === cable) return 'Cable';
  if (max === fw) return 'Fixed Wireless';
  return 'Satellite';
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
      const pct_100_20_plus = Number(r.pct_100_20_plus ?? 0);
      const pct_25_3_to_100_20 = Number(r.pct_25_3_to_100_20 ?? 0);
      const pct_below_25_3 = Number(r.pct_below_25_3 ?? 0);
      const fiberShare = Number(r.fiberShare ?? 0);
      const cableShare = Number(r.cableShare ?? 0);
      const fixedWirelessShare = Number(r.fixedWirelessShare ?? 0);
      const satelliteShare = Number(r.satelliteShare ?? 0);
      const coverageUnevenness = Boolean(r.coverageUnevenness);
      const notes = r.notes ? String(r.notes) : undefined;

      const operationalReadiness = deriveOperationalReadiness(pct_100_20_plus, satelliteShare, fiberShare, cableShare);
      const broadbandStatus = deriveBroadbandStatus(pct_100_20_plus, pct_below_25_3);
      const dominantTechnology = deriveDominantTech(fiberShare, cableShare, fixedWirelessShare, satelliteShare);

      // Legacy compat mapping
      const servedPercent = pct_100_20_plus;
      const underservedPercent = pct_25_3_to_100_20;
      const unservedPercent = pct_below_25_3;

      return {
        countyName, pct_100_20_plus, pct_25_3_to_100_20, pct_below_25_3,
        fiberShare, cableShare, fixedWirelessShare, satelliteShare,
        coverageUnevenness, operationalReadiness, broadbandStatus, dominantTechnology,
        servedPercent, underservedPercent, unservedPercent, notes,
      };
    })
    .filter((d) => d.countyName.length > 0);

/**
 * Fetch the broadband dataset from /data/nevada_broadband.json.
 * Safe to call multiple times — deduplicates.
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

/** Get broadband data for a county, returns undefined if not found. */
export const getCountyBroadband = (countyName: string): CountyBroadbandData | undefined =>
  BROADBAND_BY_COUNTY.get(normalizeCountyName(countyName));
