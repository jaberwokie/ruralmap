/**
 * Phase 2B — internal geocode authority tests.
 *
 * Covers privacy, resolution order, cache reuse, coordinate-lock protection,
 * external-provider resilience, and Nevada geography integrity.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  canonicalizeAddress,
  computeLookupKey,
  resolveNevadaCounty,
  NEVADA_COUNTY_FIPS,
  resolveAddress,
  type CachedResolution,
  type GeocoderPort,
  type ResolverPorts,
} from './helpers/geocodePorts';

const SECRET = 'test-secret-value-not-a-real-key';

const cachedRecord = (over: Partial<CachedResolution> = {}): CachedResolution => ({
  lookup_key: 'v1:' + 'a'.repeat(64),
  location_class: 'member_address',
  latitude: 39.5,
  longitude: -118.77,
  geocode_source: 'nominatim',
  confidence: 'high',
  precision: 'rooftop',
  county_name: 'Churchill',
  county_fips: '32001',
  state: 'NV',
  postal_code: '89406',
  is_manual: false,
  is_coordinate_locked: false,
  verified_at: null,
  expires_at: null,
  ...over,
});

interface Harness {
  ports: ResolverPorts;
  upserts: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
  calls: string[];
  store: Map<string, CachedResolution>;
}

const makeHarness = (opts: {
  cached?: CachedResolution | null;
  geocoders?: GeocoderPort[];
} = {}): Harness => {
  const upserts: Array<Record<string, unknown>> = [];
  const events: Array<Record<string, unknown>> = [];
  const calls: string[] = [];
  const store = new Map<string, CachedResolution>();
  if (opts.cached) store.set(opts.cached.location_class, opts.cached);

  const ports: ResolverPorts = {
    secret: SECRET,
    cacheLookup: async () => store.get('member_address') ?? null,
    cacheUpsert: async (record) => {
      const existing = store.get(record.location_class);
      if (existing && (existing.is_manual || existing.is_coordinate_locked)) return;
      upserts.push(record as unknown as Record<string, unknown>);
      store.set(record.location_class, record);
    },
    cacheTouch: async () => { calls.push('touch'); },
    geocoders: opts.geocoders ?? [],
    logEvent: (e) => { events.push(e as unknown as Record<string, unknown>); },
    now: () => '2026-08-21T00:00:00.000Z',
  };
  return { ports, upserts, events, calls, store };
};

const okGeocoder = (over: Partial<{ lat: number; lng: number; county: string }> = {}): GeocoderPort => ({
  name: 'nominatim',
  failureCode: 'nominatim_failed',
  run: vi.fn(async () => ({
    lat: over.lat ?? 39.4738,
    lng: over.lng ?? -118.7774,
    confidence: 'high',
    precision: 'rooftop',
    county: over.county ?? 'Churchill County',
    postal_code: '89406',
    label: '365 W A St, Fallon, NV 89406',
  })),
});

const failingGeocoder = (name: GeocoderPort['name'], failureCode: GeocoderPort['failureCode']): GeocoderPort => ({
  name,
  failureCode,
  run: vi.fn(async () => { throw new Error('service unavailable'); }),
});

// ── Privacy ───────────────────────────────────────────────────────────

describe('Phase 2B privacy', () => {
  it('never persists raw member address text in the cache record', async () => {
    const h = makeHarness({ geocoders: [okGeocoder()] });
    const address = '365 W A St, Fallon, NV 89406';
    await resolveAddress(h.ports, { address, locationClass: 'member_address' });

    expect(h.upserts).toHaveLength(1);
    const serialized = JSON.stringify(h.upserts[0]).toLowerCase();
    expect(serialized).not.toContain('365 w a st');
    expect(serialized).not.toContain('fallon');
    expect(serialized).not.toContain('a st,');
    expect(serialized).not.toContain(SECRET);
  });

  it('never writes raw member address text or the secret into lifecycle events', async () => {
    const h = makeHarness({ geocoders: [okGeocoder()] });
    await resolveAddress(h.ports, { address: '365 W A St, Fallon, NV 89406' });
    const serialized = JSON.stringify(h.events).toLowerCase();
    expect(serialized).not.toContain('fallon');
    expect(serialized).not.toContain('365');
    expect(serialized).not.toContain(SECRET);
    // Safe metadata is present.
    expect(serialized).toContain('churchill');
    expect(serialized).toContain('rooftop');
  });

  it('produces a deterministic keyed lookup for the same logical address', async () => {
    const a = canonicalizeAddress('365 W A St., Fallon, Nevada 89406-1234');
    const b = canonicalizeAddress('  365 w a st,  Fallon,  NV  89406 ');
    expect(a.canonical).toBe(b.canonical);
    const ka = await computeLookupKey(a.canonical, 'member_address', SECRET);
    const kb = await computeLookupKey(b.canonical, 'member_address', SECRET);
    expect(ka).toBe(kb);
  });

  it('produces different keys for different addresses and different secrets', async () => {
    const one = canonicalizeAddress('365 W A St, Fallon, NV 89406').canonical;
    const two = canonicalizeAddress('366 W A St, Fallon, NV 89406').canonical;
    const k1 = await computeLookupKey(one, 'member_address', SECRET);
    const k2 = await computeLookupKey(two, 'member_address', SECRET);
    const k3 = await computeLookupKey(one, 'member_address', 'a-different-secret');
    expect(k1).not.toBe(k2);
    expect(k1).not.toBe(k3);
  });

  it('is not a plain unsalted SHA-256 of the address and requires a secret', async () => {
    const canonical = canonicalizeAddress('365 W A St, Fallon, NV 89406').canonical;
    const key = await computeLookupKey(canonical, 'member_address', SECRET);

    const plain = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
    const plainHex = Array.from(new Uint8Array(plain)).map(b => b.toString(16).padStart(2, '0')).join('');
    expect(key).not.toContain(plainHex);

    await expect(computeLookupKey(canonical, 'member_address', '')).rejects.toThrow();
  });

  it('keeps the cache secret out of any client-reachable source module', async () => {
    const clientSources = import.meta.glob('/src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true });
    for (const [path, contents] of Object.entries(clientSources)) {
      if (path.includes('/test/')) continue;
      expect(String(contents)).not.toContain('GEOCODE_CACHE_HMAC_SECRET');
      expect(String(contents)).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    }
  });
});

// ── Resolution order + cache behavior ─────────────────────────────────

describe('Phase 2B resolution order', () => {
  it('internal cache hit avoids all external calls', async () => {
    const geocoder = okGeocoder();
    const h = makeHarness({ cached: cachedRecord(), geocoders: [geocoder] });
    const result = await resolveAddress(h.ports, { address: '365 W A St, Fallon, NV 89406' });

    expect(result.resolved).toBe(true);
    expect(result.cache_hit).toBe(true);
    expect(result.external_calls).toBe(0);
    expect(result.source).toBe('internal_cache');
    expect(geocoder.run).not.toHaveBeenCalled();
  });

  it('cache miss invokes the approved external chain and makes the result reusable', async () => {
    const geocoder = okGeocoder();
    const h = makeHarness({ geocoders: [geocoder] });
    const first = await resolveAddress(h.ports, { address: '365 W A St, Fallon, NV 89406' });

    expect(first.cache_hit).toBe(false);
    expect(first.external_calls).toBe(1);
    expect(first.source).toBe('nominatim');
    expect(geocoder.run).toHaveBeenCalledTimes(1);

    const second = await resolveAddress(h.ports, { address: '365 W A St, Fallon, NV 89406' });
    expect(second.cache_hit).toBe(true);
    expect(second.external_calls).toBe(0);
    expect(second.lat).toBe(first.lat);
    expect(second.lng).toBe(first.lng);
    expect(geocoder.run).toHaveBeenCalledTimes(1);
  });

  it('canonical resource coordinates outrank the cache and external chain', async () => {
    const geocoder = okGeocoder();
    const h = makeHarness({ cached: cachedRecord(), geocoders: [geocoder] });
    h.ports.canonicalMatch = async () => ({
      lat: 39.4601,
      lng: -118.78,
      confidence: 'high',
      precision: 'rooftop',
      county: 'Churchill',
      source: 'canonical_resource' as const,
    });
    const result = await resolveAddress(h.ports, { address: '365 W A St, Fallon, NV 89406' });
    expect(result.source).toBe('canonical_resource');
    expect(result.external_calls).toBe(0);
    expect(geocoder.run).not.toHaveBeenCalled();
  });

  it('manual coordinates outrank an automated result', async () => {
    const geocoder = okGeocoder({ lat: 36.1, lng: -115.1 });
    const manual = cachedRecord({
      is_manual: true,
      geocode_source: 'manual_verified',
      latitude: 39.1234,
      longitude: -118.1234,
      expires_at: '2020-01-01T00:00:00.000Z',
    });
    const h = makeHarness({ cached: manual, geocoders: [geocoder] });
    const result = await resolveAddress(h.ports, { address: '365 W A St, Fallon, NV 89406' });

    expect(result.source).toBe('manual_verified');
    expect(result.lat).toBe(39.1234);
    expect(result.is_manual).toBe(true);
    expect(h.upserts).toHaveLength(0);
  });

  it('coordinate lock cannot be silently overwritten', async () => {
    const geocoder = okGeocoder({ lat: 36.1, lng: -115.1 });
    const locked = cachedRecord({
      is_coordinate_locked: true,
      geocode_source: 'manual_verified',
      expires_at: '2020-01-01T00:00:00.000Z',
    });
    const h = makeHarness({ cached: locked, geocoders: [geocoder] });
    const result = await resolveAddress(h.ports, { address: '365 W A St, Fallon, NV 89406' });

    expect(result.is_coordinate_locked).toBe(true);
    expect(result.lat).toBe(locked.latitude);
    expect(h.store.get('member_address')!.latitude).toBe(locked.latitude);
    expect(h.upserts).toHaveLength(0);
  });

  it('leaves an unresolvable address unresolved instead of inventing coordinates', async () => {
    const h = makeHarness({ geocoders: [failingGeocoder('nominatim', 'nominatim_failed')] });
    const result = await resolveAddress(h.ports, {
      address: 'nowhere at all, NV',
      persistUnresolved: true,
    });

    expect(result.resolved).toBe(false);
    expect(result.lat).toBeNull();
    expect(result.lng).toBeNull();
    expect(result.failures).toContain('manual_resolution_required');
    expect(h.upserts[0].latitude).toBeNull();
  });


  it('rejects an out-of-Nevada hit for member addresses rather than accepting it', async () => {
    const h = makeHarness({ geocoders: [okGeocoder({ lat: 34.05, lng: -118.24 })] });
    const result = await resolveAddress(h.ports, { address: '1 Main St, Los Angeles, NV' });
    expect(result.resolved).toBe(false);
    expect(result.failures).toContain('nominatim_failed');
  });
});

// ── Resilience ────────────────────────────────────────────────────────

describe('Phase 2B external resilience', () => {
  it('resolves from the internal cache when Nominatim is unavailable', async () => {
    const h = makeHarness({
      cached: cachedRecord({ expires_at: '2020-01-01T00:00:00.000Z' }),
      geocoders: [failingGeocoder('nominatim', 'nominatim_failed')],
    });
    const result = await resolveAddress(h.ports, { address: '365 W A St, Fallon, NV 89406' });
    expect(result.resolved).toBe(true);
    expect(result.source).toBe('internal_cache');
    expect(result.failures).toContain('nominatim_failed');
  });

  it('resolves from the internal cache when Census is unavailable', async () => {
    const h = makeHarness({
      cached: cachedRecord({ expires_at: '2020-01-01T00:00:00.000Z' }),
      geocoders: [failingGeocoder('census', 'census_failed')],
    });
    const result = await resolveAddress(h.ports, { address: '365 W A St, Fallon, NV 89406' });
    expect(result.resolved).toBe(true);
    expect(result.failures).toContain('census_failed');
  });

  it('resolves when every external geocoder is unavailable but an internal hit exists', async () => {
    const h = makeHarness({
      cached: cachedRecord({ expires_at: '2020-01-01T00:00:00.000Z' }),
      geocoders: [
        failingGeocoder('nominatim', 'nominatim_failed'),
        failingGeocoder('census', 'census_failed'),
        failingGeocoder('google', 'google_failed'),
      ],
    });
    const result = await resolveAddress(h.ports, { address: '365 W A St, Fallon, NV 89406' });
    expect(result.resolved).toBe(true);
    expect(result.lat).toBe(39.5);
    expect(result.failures).toEqual(
      expect.arrayContaining(['nominatim_failed', 'census_failed', 'google_failed', 'external_geocoding_unavailable']),
    );
  });

  it('fails safely when every external geocoder is unavailable and nothing is cached', async () => {
    const h = makeHarness({
      geocoders: [
        failingGeocoder('nominatim', 'nominatim_failed'),
        failingGeocoder('census', 'census_failed'),
      ],
    });
    const result = await resolveAddress(h.ports, { address: '365 W A St, Fallon, NV 89406' });
    expect(result.resolved).toBe(false);
    expect(result.failures).toContain('external_geocoding_unavailable');
    expect(result.failures).toContain('manual_resolution_required');
  });

  it('partial external failure cannot corrupt an existing cached resolution', async () => {
    const existing = cachedRecord({ expires_at: '2020-01-01T00:00:00.000Z' });
    const h = makeHarness({
      cached: existing,
      geocoders: [
        failingGeocoder('nominatim', 'nominatim_failed'),
        { name: 'census', failureCode: 'census_failed', run: async () => null },
      ],
    });
    await resolveAddress(h.ports, { address: '365 W A St, Fallon, NV 89406' });
    const stored = h.store.get('member_address')!;
    expect(stored.latitude).toBe(existing.latitude);
    expect(stored.longitude).toBe(existing.longitude);
  });
});

// ── Geography ─────────────────────────────────────────────────────────

describe('Phase 2B Nevada geography integrity', () => {
  it('maps every Nevada county to its canonical FIPS code', () => {
    expect(Object.keys(NEVADA_COUNTY_FIPS)).toHaveLength(17);
    expect(resolveNevadaCounty('Churchill County')).toEqual({ name: 'Churchill', fips: '32001' });
    expect(resolveNevadaCounty('white pine')).toEqual({ name: 'White Pine', fips: '32033' });
    expect(resolveNevadaCounty('Carson City')).toEqual({ name: 'Carson City', fips: '32510' });
    // 32025 (Ormsby) no longer exists.
    expect(Object.values(NEVADA_COUNTY_FIPS)).not.toContain('32025');
  });

  it('returns null for non-Nevada county strings without rejecting the resolution', () => {
    expect(resolveNevadaCounty('Inyo County')).toBeNull();
    expect(resolveNevadaCounty(null)).toBeNull();
  });

  it('keeps highway/route address normalization deterministic and non-rewriting', () => {
    const a = canonicalizeAddress('1685 Schurz Hwy, Fallon, NV 89406');
    const b = canonicalizeAddress('1685 Schurz Hwy., Fallon, Nevada 89406');
    expect(a.canonical).toBe(b.canonical);
    // The route name itself is preserved — normalization never re-points it.
    expect(a.canonical).toContain('schurz hwy');
    expect(canonicalizeAddress('US-95, Schurz, NV').canonical).toContain('us-95');
  });

  it('preserves county metadata on an external resolution', async () => {
    const h = makeHarness({ geocoders: [okGeocoder({ county: 'Churchill County' })] });
    const result = await resolveAddress(h.ports, { address: '365 W A St, Fallon, NV 89406' });
    expect(result.county_name).toBe('Churchill');
    expect(result.county_fips).toBe('32001');
    expect(h.upserts[0].county_fips).toBe('32001');
  });
});
