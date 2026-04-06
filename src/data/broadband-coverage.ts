/**
 * County-level broadband coverage data for rural Nevada.
 *
 * Loads real FCC-derived data from /data/nevada_broadband.json at runtime.
 * The dataset is fetched once and cached for the lifetime of the session.
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

/** Derive broadband status from served/underserved/unserved percentages */
export const deriveBroadbandStatus = (
  servedPercent: number,
  _underservedPercent: number,
  unservedPercent: number,
): BroadbandStatus => {
  if (servedPercent >= 60) return 'Served';
  if (unservedPercent >= 40) return 'Unserved';
  return 'Underserved';
};

/** Normalize a county name: remove trailing " County", trim whitespace */
const normalizeCountyName = (raw: string): string =>
  raw.replace(/\s+County$/i, '').trim();

/** Validate and coerce a broadband status string */
const coerceBroadbandStatus = (raw: string | undefined, served: number, underserved: number, unserved: number): BroadbandStatus => {
  if (raw === 'Served' || raw === 'Underserved' || raw === 'Unserved') return raw;
  return deriveBroadbandStatus(served, underserved, unserved);
};

// ── Runtime state ──

let _data: CountyBroadbandData[] = [];
let _map: Map<string, CountyBroadbandData> = new Map();
let _loaded = false;
let _loadPromise: Promise<void> | null = null;
const _listeners: Array<() => void> = [];

/** Subscribe to data-ready events. Returns unsubscribe function. */
export const onBroadbandDataReady = (cb: () => void): (() => void) => {
  if (_loaded) {
    cb();
    return () => {};
  }
  _listeners.push(cb);
  return () => {
    const idx = _listeners.indexOf(cb);
    if (idx >= 0) _listeners.splice(idx, 1);
  };
};

/** Parse raw JSON records into typed broadband data */
const parseRecords = (raw: unknown[]): CountyBroadbandData[] =>
  raw
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
    .map((r) => {
      const countyName = normalizeCountyName(String(r.countyName ?? ''));
      const servedPercent = Number(r.servedPercent ?? 0);
      const underservedPercent = Number(r.underservedPercent ?? 0);
      const unservedPercent = Number(r.unservedPercent ?? 0);
      const dominantTechnology = (r.dominantTechnology ?? 'Unknown') as DominantTechnology;
      const broadbandStatus = coerceBroadbandStatus(r.broadbandStatus as string | undefined, servedPercent, underservedPercent, unservedPercent);
      return { countyName, servedPercent, underservedPercent, unservedPercent, dominantTechnology, broadbandStatus };
    })
    .filter((d) => d.countyName.length > 0);

/** Fetch the broadband dataset. Safe to call multiple times — deduplicates. */
export const loadBroadbandData = (): Promise<void> => {
  if (_loadPromise) return _loadPromise;
  _loadPromise = (async () => {
    try {
      const resp = await fetch('/data/nevada_broadband.json');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      if (!Array.isArray(json)) throw new Error('Expected array');
      _data = parseRecords(json);
      _map = new Map(_data.map((d) => [d.countyName, d]));
      _loaded = true;
      if (import.meta.env.DEV) {
        console.info('[Broadband] Loaded', _data.length, 'county records from /data/nevada_broadband.json');
      }
    } catch (err) {
      console.warn('[Broadband] Failed to load dataset:', err);
      _data = [];
      _map = new Map();
      _loaded = true; // mark loaded so UI doesn't hang — overlay will be empty
    }
    _listeners.forEach((cb) => { try { cb(); } catch {} });
    _listeners.length = 0;
  })();
  return _loadPromise;
};

/** Whether data has finished loading (success or failure) */
export const isBroadbandDataLoaded = (): boolean => _loaded;

/** All loaded county broadband records */
export const getBroadbandData = (): CountyBroadbandData[] => _data;

/** Lookup map for O(1) access by county name */
export const getBroadbandByCountyMap = (): Map<string, CountyBroadbandData> => _map;

// Keep legacy named exports so existing consumers compile without changes
/** @deprecated Use getBroadbandData() — this is a live reference that updates after load */
export const COUNTY_BROADBAND_DATA: CountyBroadbandData[] = _data;

/** @deprecated Use getBroadbandByCountyMap() */
export const BROADBAND_BY_COUNTY: Map<string, CountyBroadbandData> = _map;

/** Get broadband data for a county, returns undefined if not found */
export const getCountyBroadband = (countyName: string): CountyBroadbandData | undefined =>
  _map.get(countyName);
