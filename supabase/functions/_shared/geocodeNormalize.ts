/**
 * Phase 2B — Canonical server-side address normalization + privacy-safe
 * cache keying for the internal geocode authority.
 *
 * This module is the SINGLE deterministic normalization implementation used by
 * the resolver edge function and by tests. It intentionally performs only
 * conservative, deterministic transformations. It does NOT rewrite rural
 * Nevada highway / route names, because that could change what location the
 * address means.
 *
 * PRIVACY: `canonicalizeAddress` output is never persisted for
 * `member_address` records. Only the HMAC-SHA-256 digest (keyed with the
 * server-only GEOCODE_CACHE_HMAC_SECRET) is stored.
 */

export type LocationClass =
  | 'member_address'
  | 'facility'
  | 'rural_service'
  | 'provider'
  | 'known_place'
  | 'manual';

export type GeocodeSource =
  | 'manual_verified'
  | 'canonical_resource'
  | 'internal_cache'
  | 'google'
  | 'census'
  | 'nominatim'
  | 'known_provider'
  | 'legacy_static'
  | 'unresolved';

export type GeocodeFailureCode =
  | 'internal_cache_miss'
  | 'nominatim_failed'
  | 'census_failed'
  | 'google_failed'
  | 'external_geocoding_unavailable'
  | 'manual_resolution_required';

/** Canonical Nevada county → FIPS. 32025 (Ormsby) is intentionally absent. */
export const NEVADA_COUNTY_FIPS: Record<string, string> = {
  'churchill': '32001',
  'clark': '32003',
  'douglas': '32005',
  'elko': '32007',
  'esmeralda': '32009',
  'eureka': '32011',
  'humboldt': '32013',
  'lander': '32015',
  'lincoln': '32017',
  'lyon': '32019',
  'mineral': '32021',
  'nye': '32023',
  'pershing': '32027',
  'storey': '32029',
  'washoe': '32031',
  'white pine': '32033',
  'carson city': '32510',
};

/**
 * Resolve a free-text county string to canonical `{ name, fips }`.
 * Returns null when the string does not deterministically match a Nevada
 * county — border / out-of-state resources are legitimately unmapped here
 * and are NOT rejected by the resolver.
 */
export const resolveNevadaCounty = (
  county: string | null | undefined,
): { name: string; fips: string } | null => {
  if (!county) return null;
  const key = county
    .toLowerCase()
    .replace(/\bcounty\b/g, '')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const fips = NEVADA_COUNTY_FIPS[key];
  if (!fips) return null;
  const name = key
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  return { name, fips };
};

export interface CanonicalAddress {
  /** Deterministic canonical form used for the HMAC lookup key. */
  canonical: string;
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  /** True when the input carried a numbered street component. */
  hasStreet: boolean;
}

const STATE_TOKENS = /\b(nevada|nev\.?|nv)\b/gi;

/**
 * Deterministic canonical normalization.
 *
 * Applied transformations (all reversible in meaning):
 *  - trim + collapse whitespace
 *  - lowercase
 *  - normalize punctuation (commas kept as field separators, periods dropped)
 *  - standardize the state token to `nv`
 *  - standardize ZIP to its 5-digit form when deterministic (ZIP+4 → ZIP5)
 *
 * Deliberately NOT applied: highway/route rewriting, suite stripping,
 * directional expansion, or street-type aliasing. Those are query-time
 * fallback strategies, not identity transformations.
 */
export const canonicalizeAddress = (input: string): CanonicalAddress => {
  const base = (input ?? '')
    .normalize('NFKC')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/\./g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/,{2,}/g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .toLowerCase();

  const zipMatch = base.match(/\b(\d{5})(?:-\d{4})?\b/);
  const zip = zipMatch?.[1] ?? null;

  let canonical = base
    .replace(STATE_TOKENS, 'nv')
    .replace(/\b(\d{5})-\d{4}\b/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[,\s]+|[,\s]+$/g, '')
    .trim();

  // Deduplicate a repeated trailing state token ("... nv, nv").
  canonical = canonical.replace(/(,\s*nv)(\s*,\s*nv)+$/, '$1');

  const m1 = canonical.match(/^(.+?),\s*([^,]+?),\s*nv\b/);
  const m2 = canonical.match(/^([^,]+?),\s*nv\b/);
  const street = m1 ? m1[1].trim() : null;
  const city = m1 ? m1[2].trim() : m2 ? m2[1].trim() : null;

  return {
    canonical,
    street,
    city,
    state: /\bnv\b/.test(canonical) ? 'NV' : null,
    zip,
    hasStreet: !!street && /\d/.test(street),
  };
};

const toHex = (buf: ArrayBuffer): string =>
  Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

/**
 * Keyed deterministic digest of the canonical address.
 *
 * HMAC-SHA-256 (NOT a plain SHA-256) because a bare address hash is trivially
 * reversible via dictionary/reconstruction attacks. The secret lives only in
 * the server environment (GEOCODE_CACHE_HMAC_SECRET) and is never returned to
 * the browser or written to database metadata.
 */
export const computeLookupKey = async (
  canonical: string,
  locationClass: LocationClass,
  secret: string,
): Promise<string> => {
  if (!secret) throw new Error('geocode_cache_secret_missing');
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${locationClass}|${canonical}`));
  return `v1:${toHex(sig)}`;
};

/** Nevada bounding box used for member-address validity. */
export const NV_BOUNDS = {
  west: -120.0064,
  east: -114.0396,
  south: 35.0019,
  north: 42.0022,
} as const;

export const isInNevada = (lat: number, lng: number): boolean =>
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  lat >= NV_BOUNDS.south &&
  lat <= NV_BOUNDS.north &&
  lng >= NV_BOUNDS.west &&
  lng <= NV_BOUNDS.east;
