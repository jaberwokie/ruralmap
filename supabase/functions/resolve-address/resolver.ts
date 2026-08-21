/**
 * Phase 2B — Internal-first geocode resolver core.
 *
 * Pure and port-injected so the resolution order, cache behavior, privacy
 * guarantees, and failure taxonomy are unit-testable without Deno, network,
 * or a database.
 *
 * Resolution order (spec §5):
 *   1. canonical Rural Tool resource/location match (caller-supplied port)
 *   2. verified/manual locked internal coordinates
 *   3. internal geocode cache
 *   4. existing approved external geocoder chain
 *   5. approved approximate fallback (external chain's own approximate level)
 *   6. manual placement / unresolved state
 *
 * The resolver NEVER invents coordinates. Wrong coordinates are worse than no
 * coordinates.
 */
import {
  buildQueryVariants,
  canonicalizeAddress,
  computeLookupKey,
  isHighwayAddress,
  isInNevada,
  resolveNevadaCounty,
  type GeocodeFailureCode,
  type GeocodeSource,
  type LocationClass,
  type QueryVariant,
  type ResolutionStrategy,
} from '../_shared/geocodeNormalize.ts';


export interface CachedResolution {
  id?: string;
  lookup_key: string;
  location_class: LocationClass;
  latitude: number | null;
  longitude: number | null;
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
  expires_at: string | null;
}

export interface ExternalHit {
  lat: number;
  lng: number;
  confidence: string;
  precision: string;
  county?: string | null;
  postal_code?: string | null;
  /** Display label; NEVER persisted for member_address records. */
  label?: string | null;
}

export interface GeocoderPort {
  name: Extract<GeocodeSource, 'nominatim' | 'census' | 'google' | 'known_provider'>;
  failureCode: GeocodeFailureCode;
  run: (canonical: string, original: string) => Promise<ExternalHit | null>;
}

export interface ResolverPorts {
  secret: string;
  /** Canonical resource coordinates already owned by facilities/rural_services. */
  canonicalMatch?: (canonical: string) => Promise<ExternalHit & { source: GeocodeSource } | null>;
  cacheLookup: (lookupKey: string) => Promise<CachedResolution | null>;
  cacheUpsert: (record: CachedResolution & { source_metadata: Record<string, unknown> }) => Promise<void>;
  cacheTouch: (lookupKey: string, cacheHit: boolean) => Promise<void>;
  geocoders: GeocoderPort[];
  logEvent: (event: {
    event: string;
    location_class: LocationClass;
    source?: GeocodeSource | null;
    confidence?: string | null;
    precision?: string | null;
    county?: string | null;
    failures?: GeocodeFailureCode[];
  }) => void | Promise<void>;
  now: () => string;
}

export interface ResolveRequest {
  address: string;
  locationClass?: LocationClass;
  /** Member addresses are Nevada-scoped per current Rural Tool behavior. */
  requireNevada?: boolean;
  /** Override the query-variant chain (tests only). */
  variants?: QueryVariant[];
  /** Hard cap on external provider calls per request (abuse resistance). */
  maxExternalCalls?: number;
  /**
   * Phase 2B.2 — whether an unresolved (null-coordinate) row may be written to
   * the internal cache. Defaults to false: a null-coordinate row is never a
   * valid cache hit, so persisting one for every anonymous miss only lets an
   * unauthenticated caller grow the table without operational benefit.
   */
  persistUnresolved?: boolean;
}

export interface ResolveResult {
  resolved: boolean;
  lat: number | null;
  lng: number | null;
  source: GeocodeSource | null;
  confidence: string | null;
  precision: string | null;
  county_name: string | null;
  county_fips: string | null;
  cache_hit: boolean;
  external_calls: number;
  is_coordinate_locked: boolean;
  is_manual: boolean;
  failures: GeocodeFailureCode[];
  /** Which query strategy produced the result. */
  strategy: ResolutionStrategy | null;
  /** True when the winning query was coarser than the requested street. */
  is_approximate: boolean;
  /** True when the caller should fall back to manual map placement. */
  manual_placement_required: boolean;
  /** True when the address looks like a Nevada highway/milepost location. */
  highway_address: boolean;
  /** Present only for non-member classes; member addresses stay opaque. */
  label?: string | null;
}


const isUsable = (r: CachedResolution | null): r is CachedResolution =>
  !!r && typeof r.latitude === 'number' && typeof r.longitude === 'number';

const isExpired = (r: CachedResolution, nowIso: string): boolean =>
  !!r.expires_at && Date.parse(r.expires_at) <= Date.parse(nowIso);

/** Manual / locked / verified internal coordinates outrank all automation. */
const isAuthoritative = (r: CachedResolution): boolean =>
  r.is_manual || r.is_coordinate_locked || r.geocode_source === 'manual_verified';

export const resolveAddress = async (
  ports: ResolverPorts,
  req: ResolveRequest,
): Promise<ResolveResult> => {
  const locationClass: LocationClass = req.locationClass ?? 'member_address';
  const requireNevada = req.requireNevada ?? locationClass === 'member_address';
  const failures: GeocodeFailureCode[] = [];
  const addFailure = (code: GeocodeFailureCode) => {
    if (!failures.includes(code)) failures.push(code);
  };
  const nowIso = ports.now();
  const isMember = locationClass === 'member_address';

  const canon = canonicalizeAddress(req.address);
  const lookupKey = await computeLookupKey(canon.canonical, locationClass, ports.secret);
  const highwayAddress = isHighwayAddress(req.address);

  const countyOf = (county: string | null | undefined) => resolveNevadaCounty(county);

  const base = {
    highway_address: highwayAddress,
    manual_placement_required: false,
  };

  // ── 1. Canonical Rural Tool resource coordinates ─────────────────────
  if (ports.canonicalMatch) {
    const hit = await ports.canonicalMatch(canon.canonical);
    if (hit) {
      const county = countyOf(hit.county);
      await ports.logEvent({
        event: 'cache_hit',
        location_class: locationClass,
        source: hit.source,
        confidence: hit.confidence,
        precision: hit.precision,
        county: county?.name ?? null,
      });
      return {
        ...base,
        resolved: true,
        lat: hit.lat,
        lng: hit.lng,
        source: hit.source,
        confidence: hit.confidence,
        precision: hit.precision,
        county_name: county?.name ?? null,
        county_fips: county?.fips ?? null,
        cache_hit: true,
        external_calls: 0,
        is_coordinate_locked: true,
        is_manual: false,
        failures,
        strategy: 'canonical_resource',
        is_approximate: false,
        label: isMember ? null : hit.label ?? null,
      };
    }
  }

  const cached = await ports.cacheLookup(lookupKey);

  // ── 2 + 3. Internal authority, then internal cache ───────────────────
  if (isUsable(cached)) {
    const authoritative = isAuthoritative(cached);
    if (authoritative || !isExpired(cached, nowIso)) {
      await ports.cacheTouch(lookupKey, true);
      await ports.logEvent({
        event: 'cache_hit',
        location_class: locationClass,
        source: authoritative ? cached.geocode_source : 'internal_cache',
        confidence: cached.confidence,
        precision: cached.precision,
        county: cached.county_name,
      });
      return {
        ...base,
        resolved: true,
        lat: cached.latitude,
        lng: cached.longitude,
        source: authoritative ? cached.geocode_source : 'internal_cache',
        confidence: cached.confidence,
        precision: cached.precision,
        county_name: cached.county_name,
        county_fips: cached.county_fips,
        cache_hit: true,
        external_calls: 0,
        is_coordinate_locked: cached.is_coordinate_locked,
        is_manual: cached.is_manual,
        failures,
        strategy: 'direct',
        is_approximate: canon.hasStreet && cached.precision !== 'rooftop',
      };
    }
  } else {
    addFailure('internal_cache_miss');
    await ports.logEvent({ event: 'cache_miss', location_class: locationClass });
  }

  // ── 4 + 5. Approved external chain, across server-side query variants ─
  // Every retry strategy that used to run in the browser now runs here. The
  // raw member address never leaves the server boundary.
  const variants: QueryVariant[] = req.variants ?? buildQueryVariants(req.address);
  const maxExternalCalls = req.maxExternalCalls ?? 18;
  let externalCalls = 0;

  for (const variant of variants) {
    for (const geocoder of ports.geocoders) {
      if (externalCalls >= maxExternalCalls) break;
      externalCalls++;
      let hit: ExternalHit | null = null;
      try {
        hit = await geocoder.run(variant.q, variant.q);
      } catch {
        hit = null;
      }
      if (!hit || !Number.isFinite(hit.lat) || !Number.isFinite(hit.lng)) {
        addFailure(geocoder.failureCode);
        continue;
      }
      if (requireNevada && !isInNevada(hit.lat, hit.lng)) {
        addFailure(geocoder.failureCode);
        continue;
      }

      const county = countyOf(hit.county);
      const isApproximate = canon.hasStreet && variant.level !== 'street';

      // A later automated result must never silently overwrite locked/manual
      // coordinates. If a locked record exists we return IT, not the new hit.
      if (cached && isAuthoritative(cached) && isUsable(cached)) {
        await ports.cacheTouch(lookupKey, true);
        return {
          ...base,
          resolved: true,
          lat: cached.latitude,
          lng: cached.longitude,
          source: cached.geocode_source,
          confidence: cached.confidence,
          precision: cached.precision,
          county_name: cached.county_name,
          county_fips: cached.county_fips,
          cache_hit: true,
          external_calls: externalCalls,
          is_coordinate_locked: cached.is_coordinate_locked,
          is_manual: true,
          failures,
          strategy: 'direct',
          is_approximate: false,
        };
      }

      // Cache identity is ALWAYS the original canonical address, never the
      // retry variant — so the next identical search is a pure cache hit.
      await ports.cacheUpsert({
        lookup_key: lookupKey,
        location_class: locationClass,
        latitude: hit.lat,
        longitude: hit.lng,
        geocode_source: geocoder.name,
        confidence: hit.confidence,
        precision: hit.precision,
        county_name: county?.name ?? null,
        county_fips: county?.fips ?? null,
        state: canon.state,
        postal_code: hit.postal_code ?? canon.zip,
        is_manual: false,
        is_coordinate_locked: false,
        verified_at: null,
        expires_at: null, // No Rural Tool expiration policy exists yet (spec §9).
        // PRIVACY: no raw address text for member_address records.
        source_metadata: {
          resolver: 'phase2b',
          resolving_source: geocoder.name,
          precision: hit.precision,
          resolution_strategy: variant.strategy,
          query_level: variant.level,
          is_approximate: isApproximate,
          ...(isMember ? {} : { label: hit.label ?? null }),
        },
      });

      await ports.logEvent({
        event: 'external_resolution',
        location_class: locationClass,
        source: geocoder.name,
        confidence: hit.confidence,
        precision: hit.precision,
        county: county?.name ?? null,
        failures,
      });

      return {
        ...base,
        resolved: true,
        lat: hit.lat,
        lng: hit.lng,
        source: geocoder.name,
        confidence: hit.confidence,
        precision: hit.precision,
        county_name: county?.name ?? null,
        county_fips: county?.fips ?? null,
        cache_hit: false,
        external_calls: externalCalls,
        is_coordinate_locked: false,
        is_manual: false,
        failures,
        strategy: variant.strategy,
        is_approximate: isApproximate,
        label: isMember ? null : hit.label ?? null,
      };
    }
    if (externalCalls >= maxExternalCalls) break;
  }

  // Every external provider failed. If an internal (even expired) resolution
  // exists, the Rural Tool still resolves the location. Core §16 condition.
  if (isUsable(cached)) {
    await ports.cacheTouch(lookupKey, true);
    addFailure('external_geocoding_unavailable');
    await ports.logEvent({
      event: 'cache_hit',
      location_class: locationClass,
      source: 'internal_cache',
      confidence: cached.confidence,
      precision: cached.precision,
      county: cached.county_name,
      failures,
    });
    return {
      ...base,
      resolved: true,
      lat: cached.latitude,
      lng: cached.longitude,
      source: 'internal_cache',
      confidence: cached.confidence,
      precision: cached.precision,
      county_name: cached.county_name,
      county_fips: cached.county_fips,
      cache_hit: true,
      external_calls: externalCalls,
      is_coordinate_locked: cached.is_coordinate_locked,
      is_manual: cached.is_manual,
      failures,
      strategy: 'direct',
      is_approximate: canon.hasStreet && cached.precision !== 'rooftop',
    };
  }

  // ── 6. Unresolved. No coordinates are invented. ──────────────────────
  if (externalCalls > 0) addFailure('external_geocoding_unavailable');
  if (ports.geocoders.length === 0) addFailure('no_approved_external_provider');
  addFailure('manual_resolution_required');

  // Negative caching is deliberately NOT permanent: a null-coordinate row is
  // never a valid cache hit, and by default it is not written at all.
  if (req.persistUnresolved) {
    await ports.cacheUpsert({
      lookup_key: lookupKey,
      location_class: locationClass,
      latitude: null,
      longitude: null,
      geocode_source: 'unresolved',
      confidence: null,
      precision: null,
      county_name: null,
      county_fips: null,
      state: canon.state,
      postal_code: canon.zip,
      is_manual: false,
      is_coordinate_locked: false,
      verified_at: null,
      expires_at: null,
      source_metadata: { resolver: 'phase2b', failures },
    });
  }

  await ports.logEvent({
    event: 'resolution_failed',
    location_class: locationClass,
    source: null,
    failures,
  });

  return {
    ...base,
    resolved: false,
    lat: null,
    lng: null,
    source: null,
    confidence: null,
    precision: null,
    county_name: null,
    county_fips: null,
    cache_hit: false,
    external_calls: externalCalls,
    is_coordinate_locked: false,
    is_manual: false,
    failures,
    strategy: null,
    is_approximate: false,
    manual_placement_required: true,
  };
};
