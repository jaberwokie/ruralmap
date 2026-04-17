/**
 * Normalization helpers for the Demand & Utilization datasets.
 * Used at index-build time so all joins (county <-> county, provider <-> provider)
 * are stable across ingest sources.
 */

const COUNTY_ALIASES: Record<string, string> = {
  CARSON: 'Carson City',
  'CARSON CITY': 'Carson City',
  WASHOE: 'Washoe',
  CLARK: 'Clark',
  CHURCHILL: 'Churchill',
  DOUGLAS: 'Douglas',
  ELKO: 'Elko',
  ESMERALDA: 'Esmeralda',
  EUREKA: 'Eureka',
  HUMBOLDT: 'Humboldt',
  LANDER: 'Lander',
  LINCOLN: 'Lincoln',
  LYON: 'Lyon',
  MINERAL: 'Mineral',
  NYE: 'Nye',
  PERSHING: 'Pershing',
  STOREY: 'Storey',
  'WHITE PINE': 'White Pine',
};

/**
 * Normalize a county name to the canonical form used by the rest of the app
 * (matches `nevada-counties.ts` `name` field). Trims, collapses whitespace,
 * strips a trailing " County" suffix, and applies known aliases.
 */
export const normalizeCounty = (input: unknown): string => {
  if (typeof input !== 'string') return '';
  const trimmed = input.trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';
  const stripped = trimmed.replace(/\s+county$/i, '');
  const upper = stripped.toUpperCase();
  if (COUNTY_ALIASES[upper]) return COUNTY_ALIASES[upper];
  // Title-case fallback
  return stripped
    .toLowerCase()
    .split(' ')
    .map((part) => (part.length === 0 ? part : part[0].toUpperCase() + part.slice(1)))
    .join(' ');
};

/**
 * Normalize a billing/rendering provider name into a stable join key.
 * Exact-match only — never used for fuzzy joins. Strips legal-suffix tokens
 * (LLC/INC/etc.), punctuation, and collapses whitespace.
 */
const PROVIDER_SUFFIX = /\b(LLC|INC|LTD|LLP|PC|PA|PLLC|CORP|CO|FQHC)\b/g;

export const normalizeProviderName = (input: unknown): string => {
  if (typeof input !== 'string') return '';
  const upper = input.toUpperCase();
  const noPunct = upper.replace(/[.,/()&'"]/g, ' ');
  const noSuffix = noPunct.replace(PROVIDER_SUFFIX, ' ');
  return noSuffix.replace(/\s+/g, ' ').trim();
};

/**
 * Aggregate / summary labels that must NEVER be treated as a provider identity.
 * Compared against the already-normalized provider name (uppercase, no punctuation).
 * Exact-match only — no fuzzy logic.
 */
const AGGREGATE_PROVIDER_LABELS: ReadonlySet<string> = new Set([
  'GRAND TOTAL',
  'TOTAL',
  'SUBTOTAL',
  'SUB TOTAL',
  'ALL PROVIDERS',
  'UNKNOWN TOTAL',
  'UNKNOWN',
  'TOTALS',
  'SUM',
]);

/** Returns true when the normalized provider name is an aggregate/summary row, not a real provider. */
export const isAggregateProviderLabel = (normalizedName: string): boolean => {
  if (!normalizedName) return true;
  return AGGREGATE_PROVIDER_LABELS.has(normalizedName);
};

/** Normalize a 5-digit zip; returns '' if invalid. */
export const normalizeZip = (input: unknown): string => {
  if (typeof input === 'number' && Number.isFinite(input)) {
    const s = String(Math.trunc(input));
    return s.length === 4 ? `0${s}` : s.length === 5 ? s : '';
  }
  if (typeof input !== 'string') return '';
  const digits = input.trim().replace(/\D/g, '');
  if (digits.length === 5) return digits;
  if (digits.length === 4) return `0${digits}`;
  return '';
};

/** Min-max normalize an iterable of (key, value) into (key, 0..1). */
export const minMaxNormalize = <K>(entries: Iterable<[K, number]>): Map<K, number> => {
  const arr: Array<[K, number]> = [];
  let min = Infinity;
  let max = -Infinity;
  for (const [k, v] of entries) {
    if (!Number.isFinite(v)) continue;
    arr.push([k, v]);
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const out = new Map<K, number>();
  if (arr.length === 0 || min === max) {
    for (const [k] of arr) out.set(k, 0);
    return out;
  }
  const span = max - min;
  for (const [k, v] of arr) out.set(k, (v - min) / span);
  return out;
};
