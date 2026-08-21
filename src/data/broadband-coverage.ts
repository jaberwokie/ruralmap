/**
 * County-level broadband coverage data for rural Nevada.
 *
 * Read path (Phase 2A):
 *   1. normalized `broadband_county_coverage` table (internalized dataset)
 *   2. fallback: /data/nevada_broadband.json (unchanged static snapshot)
 *
 * The map never calls FCC directly. Uses distribution-based model —
 * NOT max-value-across-technologies.
 */
import { supabase } from '@/integrations/supabase/client';


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

/** Row shape of the normalized `broadband_county_coverage` table. */
interface NormalizedRow {
  county_name: string;
  pct_100_20_plus: number | null;
  pct_25_3_to_100_20: number | null;
  pct_below_25_3: number | null;
  fiber_share: number | null;
  cable_share: number | null;
  fixed_wireless_share: number | null;
  satellite_share: number | null;
  coverage_unevenness: boolean | null;
  notes: string | null;
}

/** Map normalized DB rows onto the raw record shape parseRecords expects. */
export const normalizedRowsToRaw = (rows: NormalizedRow[]): Record<string, unknown>[] =>
  rows.map((r) => ({
    countyName: r.county_name,
    pct_100_20_plus: r.pct_100_20_plus,
    pct_25_3_to_100_20: r.pct_25_3_to_100_20,
    pct_below_25_3: r.pct_below_25_3,
    fiberShare: r.fiber_share,
    cableShare: r.cable_share,
    fixedWirelessShare: r.fixed_wireless_share,
    satelliteShare: r.satellite_share,
    coverageUnevenness: r.coverage_unevenness ?? false,
    notes: r.notes ?? undefined,
  }));

const DB_NUMERIC_FIELDS: (keyof NormalizedRow)[] = [
  'pct_100_20_plus', 'pct_25_3_to_100_20', 'pct_below_25_3',
  'fiber_share', 'cable_share', 'fixed_wireless_share', 'satellite_share',
];

/** A normalized DB row is usable only when it already carries real numbers. */
export const isUsableNormalizedRow = (row: NormalizedRow): boolean =>
  typeof row.county_name === 'string' && row.county_name.trim().length > 0 &&
  DB_NUMERIC_FIELDS.every((f) => typeof row[f] === 'number' && Number.isFinite(row[f] as number));

/** A usable dataset has rows and finite core metrics on every row. */
export const isUsableBroadbandDataset = (records: CountyBroadbandData[]): boolean =>
  records.length > 0 &&
  records.every((d) =>
    d.countyName.length > 0 &&
    Number.isFinite(d.pct_100_20_plus) &&
    Number.isFinite(d.pct_25_3_to_100_20) &&
    Number.isFinite(d.pct_below_25_3),
  );


const publish = (records: CountyBroadbandData[]): void => {
  COUNTY_BROADBAND_DATA.length = 0;
  COUNTY_BROADBAND_DATA.push(...records);
  BROADBAND_BY_COUNTY.clear();
  records.forEach((d) => BROADBAND_BY_COUNTY.set(d.countyName, d));
};

/** Attempt the normalized internalized dataset. Returns null when unusable. */
const loadFromDatabase = async (): Promise<CountyBroadbandData[] | null> => {
  try {
    const { data, error } = await supabase
      .from('broadband_county_coverage')
      .select(
        'county_name, pct_100_20_plus, pct_25_3_to_100_20, pct_below_25_3, fiber_share, cable_share, fixed_wireless_share, satellite_share, coverage_unevenness, notes',
      );
    if (error) throw new Error(error.message);
    if (!Array.isArray(data) || data.length === 0) return null;
    const records = parseRecords(normalizedRowsToRaw(data as NormalizedRow[]));
    return isUsableBroadbandDataset(records) ? records : null;
  } catch (err) {
    console.warn('[Broadband] Normalized dataset unavailable:', err);
    return null;
  }
};

/** Static fallback — unchanged behaviour. */
const loadFromStaticJson = async (): Promise<CountyBroadbandData[] | null> => {
  try {
    const resp = await fetch('/data/nevada_broadband.json');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    if (!Array.isArray(json)) throw new Error('Expected array');
    const records = parseRecords(json);
    return isUsableBroadbandDataset(records) ? records : null;
  } catch (err) {
    console.warn('[Broadband] Failed to load static fallback:', err);
    return null;
  }
};

/**
 * Load the broadband dataset: normalized table first, static JSON fallback.
 * Safe to call multiple times — deduplicates.
 */
export const loadBroadbandData = (): Promise<boolean> => {
  if (_loadPromise) return _loadPromise;
  _loadPromise = (async () => {
    const fromDb = await loadFromDatabase();
    if (fromDb) {
      publish(fromDb);
      console.info('[Broadband] Loaded', fromDb.length, 'county records from normalized dataset');
      return true;
    }
    const fromStatic = await loadFromStaticJson();
    if (fromStatic) {
      publish(fromStatic);
      console.info('[Broadband] Loaded', fromStatic.length, 'county records from /data/nevada_broadband.json (fallback)');
      return true;
    }
    return false;
  })();
  return _loadPromise;
};

/** Test-only: clear the memoized load so a fresh path can be exercised. */
export const __resetBroadbandLoadForTests = (): void => {
  _loadPromise = null;
  COUNTY_BROADBAND_DATA.length = 0;
  BROADBAND_BY_COUNTY.clear();
};


/** Get broadband data for a county, returns undefined if not found. */
export const getCountyBroadband = (countyName: string): CountyBroadbandData | undefined =>
  BROADBAND_BY_COUNTY.get(normalizeCountyName(countyName));
