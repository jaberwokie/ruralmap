/**
 * Phase 2C — Internal public-RESOURCE geocode authority.
 *
 * Shared, port-injected core used by BOTH `geocode-address` and `geocode-bulk`
 * so a public facility/service/provider address is externally geocoded once,
 * validated once, and then reusable across records, tables and functions.
 *
 * HARD SEPARATION: this module only ever touches the `resource_address`
 * location_class namespace. It never reads or writes private member cache
 * rows, and the Phase 2B member boundary (no approved external provider for
 * member addresses) is untouched.
 *
 * Cache identity is deterministic EXACT canonical address equality. No fuzzy,
 * name, county-only or ZIP-only matching: wrong coordinates are worse than
 * another external lookup.
 */
import {
  canonicalizeAddress,
  computeLookupKey,
  isInNevada,
  resolveNevadaCounty,
  type GeocodeSource,
} from './geocodeNormalize.ts';

/** Dedicated cache namespace for public/business resource addresses. */
export const RESOURCE_LOCATION_CLASS = 'resource_address' as const;

/** Confidence levels that must stay visible to Admin > Geocode Review. */
export const REVIEW_CONFIDENCES = ['geometric', 'approximate', 'low', 'failed'] as const;

export const isReviewConfidence = (confidence: string | null | undefined): boolean =>
  !!confidence && (REVIEW_CONFIDENCES as readonly string[]).includes(confidence);

export interface ResourceAddressParts {
  street_address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}

/** Canonical resource tables own the address text; we only derive identity. */
export const buildResourceAddress = (parts: ResourceAddressParts): string => {
  const clean = (v: unknown) => (typeof v === 'string' ? v.trim() : v ? String(v) : '');
  const state = clean(parts.state) || 'NV';
  const zip = clean(parts.zip);
  // `STATE ZIP` (space, not comma) so identity matches the ordinary written form.
  const tail = zip ? `${state} ${zip}` : state;
  return [clean(parts.street_address), clean(parts.city), tail].filter(Boolean).join(', ');
};

/**
 * Deterministic keyed identity for a public resource address.
 * HMAC-SHA-256(secret, "resource_address|<canonical address>").
 */
export const computeResourceLookupKey = (
  address: string,
  secret: string,
): Promise<string> =>
  computeLookupKey(canonicalizeAddress(address).canonical, RESOURCE_LOCATION_CLASS, secret);

/** Identity is only usable when the address carries a real street component. */
export const hasDeterministicIdentity = (address: string): boolean => {
  const canon = canonicalizeAddress(address);
  return canon.hasStreet && !!canon.city;
};

export interface ResourceCacheRow {
  id?: string;
  lookup_key: string;
  location_class: typeof RESOURCE_LOCATION_CLASS;
  latitude: number | null;
  longitude: number | null;
  /** ORIGINAL resolving provider — never rewritten to `internal_cache`. */
  geocode_source: GeocodeSource;
  confidence: string | null;
  precision: string | null;
  county_name: string | null;
  county_fips: string | null;
  state: string | null;
  postal_code: string | null;
  is_manual: boolean;
  is_coordinate_locked: boolean;
  verified_at: string | null;
  source_metadata?: Record<string, unknown>;
}

export interface ResourceExternalHit {
  lat: number;
  lng: number;
  confidence: string;
  /** Provider match/precision token (e.g. Google `location_type`). */
  match_type?: string | null;
  precision?: string | null;
  county?: string | null;
  postal_code?: string | null;
}

export interface ResourceExternalPort {
  name: Extract<GeocodeSource, 'google' | 'nominatim' | 'census'>;
  run: (address: string) => Promise<ResourceExternalHit | null>;
}

export interface ResourceCachePorts {
  secret: string;
  lookup: (lookupKey: string) => Promise<ResourceCacheRow | null>;
  upsert: (row: ResourceCacheRow & { source_metadata: Record<string, unknown> }) => Promise<void>;
  touch: (lookupKey: string) => Promise<void>;
  geocoders: ResourceExternalPort[];
  now: () => string;
}

export interface ResolveResourceRequest {
  address: string;
  /** Deliberate Admin re-geocode: bypass automated cache reuse. */
  force?: boolean;
  /** Public resource records are Nevada-scoped in the Rural Tool. */
  requireNevada?: boolean;
}

export interface ResolveResourceResult {
  resolved: boolean;
  lat: number | null;
  lng: number | null;
  /** How THIS record received the coordinate. */
  coordinate_source: 'internal_cache' | 'manual_verified' | GeocodeSource | 'failed' | null;
  /** How the coordinate was ORIGINALLY resolved. */
  geocode_provider: GeocodeSource | null;
  confidence: string | null;
  precision: string | null;
  match_type: string | null;
  county_name: string | null;
  county_fips: string | null;
  cache_hit: boolean;
  external_calls: number;
  is_manual: boolean;
  is_coordinate_locked: boolean;
  /** True when the receiving record must stay in the Geocode Review queue. */
  review_required: boolean;
  /** Stable failure code — never a provider URL or raw provider payload. */
  failure: string | null;
  cache_written: boolean;
  /**
   * Phase 2C.1 — true when `force` was requested, the external refresh did NOT
   * succeed, and the previous internal result was retained. Callers must not
   * present this as a fresh provider refresh.
   */
  forced_refresh_failed: boolean;
}

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

export const isUsableResourceCoordinate = (
  lat: unknown,
  lng: unknown,
  requireNevada: boolean,
): boolean => {
  if (!finite(lat) || !finite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  if (requireNevada && !isInNevada(lat, lng)) return false;
  return true;
};

const isCacheHitUsable = (row: ResourceCacheRow | null, requireNevada: boolean): row is ResourceCacheRow =>
  !!row && isUsableResourceCoordinate(row.latitude, row.longitude, requireNevada);

/** Manual / locked / verified cache authority outranks all automation. */
export const isProtectedCacheRow = (row: ResourceCacheRow): boolean =>
  row.is_manual || row.is_coordinate_locked || row.geocode_source === 'manual_verified';

const fromCache = (row: ResourceCacheRow): ResolveResourceResult => ({
  resolved: true,
  lat: row.latitude,
  lng: row.longitude,
  coordinate_source: 'internal_cache',
  geocode_provider: row.geocode_source,
  confidence: row.confidence,
  precision: row.precision,
  match_type: (row.source_metadata?.match_type as string | undefined) ?? null,
  county_name: row.county_name,
  county_fips: row.county_fips,
  cache_hit: true,
  external_calls: 0,
  is_manual: row.is_manual,
  is_coordinate_locked: row.is_coordinate_locked,
  review_required: !isProtectedCacheRow(row) && isReviewConfidence(row.confidence),
  failure: null,
  cache_written: false,
  forced_refresh_failed: false,
});

/**
 * Resource resolution (cache-first, external only on miss).
 *
 * Coordinate ownership by the canonical record (manual/locked columns) is
 * enforced by the CALLING edge function — this core answers "what coordinate
 * does this exact public address resolve to, and how".
 */
export const resolveResourceAddress = async (
  ports: ResourceCachePorts,
  req: ResolveResourceRequest,
): Promise<ResolveResourceResult> => {
  const requireNevada = req.requireNevada ?? true;
  const address = (req.address ?? '').trim();

  const unresolved = (failure: string): ResolveResourceResult => ({
    resolved: false,
    lat: null,
    lng: null,
    coordinate_source: 'failed',
    geocode_provider: null,
    confidence: null,
    precision: null,
    match_type: null,
    county_name: null,
    county_fips: null,
    cache_hit: false,
    external_calls: 0,
    is_manual: false,
    is_coordinate_locked: false,
    review_required: true,
    failure,
    cache_written: false,
    forced_refresh_failed: false,
  });

  if (!address) return unresolved('missing_address');

  const identity = hasDeterministicIdentity(address);
  const lookupKey = identity ? await computeResourceLookupKey(address, ports.secret) : null;
  const existing = lookupKey ? await ports.lookup(lookupKey) : null;

  // Protected (manual/verified) cache authority is never bypassed, even by force.
  if (isCacheHitUsable(existing, requireNevada) && isProtectedCacheRow(existing)) {
    if (lookupKey) await ports.touch(lookupKey);
    return fromCache(existing);
  }

  if (!req.force && isCacheHitUsable(existing, requireNevada)) {
    if (lookupKey) await ports.touch(lookupKey);
    return fromCache(existing);
  }

  // ── Cache miss (or deliberate force) → approved external provider chain ──
  let externalCalls = 0;
  let hit: ResourceExternalHit | null = null;
  let provider: ResourceExternalPort['name'] | null = null;

  for (const g of ports.geocoders) {
    externalCalls += 1;
    let candidate: ResourceExternalHit | null = null;
    try {
      candidate = await g.run(address);
    } catch {
      candidate = null;
    }
    if (!candidate) continue;
    if (!isUsableResourceCoordinate(candidate.lat, candidate.lng, requireNevada)) continue;
    hit = candidate;
    provider = g.name;
    break;
  }

  if (!hit || !provider) {
    // Failure must never damage reusable internal knowledge.
    if (isCacheHitUsable(existing, requireNevada)) {
      // Phase 2C.1: a failed FORCED refresh must never destroy last-known-good
      // internal knowledge, and must not masquerade as a fresh provider result.
      if (lookupKey) await ports.touch(lookupKey);
      return {
        ...fromCache(existing),
        external_calls: externalCalls,
        forced_refresh_failed: !!req.force,
      };
    }
    return { ...unresolved('external_geocoding_unavailable'), external_calls: externalCalls };
  }

  const county = resolveNevadaCounty(hit.county);
  const precision = hit.precision ?? hit.match_type ?? null;
  let cacheWritten = false;

  if (lookupKey) {
    await ports.upsert({
      lookup_key: lookupKey,
      location_class: RESOURCE_LOCATION_CLASS,
      latitude: hit.lat,
      longitude: hit.lng,
      geocode_source: provider,
      confidence: hit.confidence,
      precision,
      county_name: county?.name ?? null,
      county_fips: county?.fips ?? null,
      state: 'NV',
      postal_code: hit.postal_code ?? null,
      is_manual: false,
      is_coordinate_locked: false,
      verified_at: null,
      source_metadata: {
        match_type: hit.match_type ?? null,
        resolved_at: ports.now(),
        resolved_by: provider,
      },
    });
    cacheWritten = true;
  }

  return {
    resolved: true,
    lat: hit.lat,
    lng: hit.lng,
    coordinate_source: provider,
    geocode_provider: provider,
    confidence: hit.confidence,
    precision,
    match_type: hit.match_type ?? null,
    county_name: county?.name ?? null,
    county_fips: county?.fips ?? null,
    cache_hit: false,
    external_calls: externalCalls,
    is_manual: false,
    is_coordinate_locked: false,
    review_required: isReviewConfidence(hit.confidence),
    failure: null,
    cache_written: cacheWritten,
    forced_refresh_failed: false,
  };
};

/**
 * Seed reusable internal authority from a CURATED manual/verified coordinate.
 * Returns false when the row does not meet the deterministic-identity or
 * geographic-validity bar (never fabricate provenance to fill the cache).
 */
export const seedManualResourceResolution = async (
  ports: ResourceCachePorts,
  address: string,
  coords: { lat: unknown; lng: unknown },
  opts: { requireNevada?: boolean; verifiedAt?: string | null } = {},
): Promise<boolean> => {
  const requireNevada = opts.requireNevada ?? true;
  if (!hasDeterministicIdentity(address)) return false;
  if (!isUsableResourceCoordinate(coords.lat, coords.lng, requireNevada)) return false;

  const lookupKey = await computeResourceLookupKey(address, ports.secret);
  await ports.upsert({
    lookup_key: lookupKey,
    location_class: RESOURCE_LOCATION_CLASS,
    latitude: coords.lat as number,
    longitude: coords.lng as number,
    geocode_source: 'manual_verified',
    confidence: 'manual',
    precision: 'rooftop',
    county_name: null,
    county_fips: null,
    state: 'NV',
    postal_code: null,
    is_manual: true,
    is_coordinate_locked: true,
    verified_at: opts.verifiedAt ?? ports.now(),
    source_metadata: { seeded_at: ports.now(), seeded_from: 'manual_coordinate' },
  });
  return true;
};
