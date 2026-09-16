/**
 * Phase 2B.3 — private member-address geocoder boundary tests.
 *
 * The adapter must be inert until NovumHealth explicitly approves and
 * configures a private, BAA-covered endpoint, must never accept a public
 * consumer geocoder, must fail closed, and must never leak address text.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  readMemberGeocoderConfig,
  createPrivateMemberGeocoder,
  normalizeProviderResponse,
  type MemberGeocoderEnv,
} from '../../supabase/functions/resolve-address/privateMemberGeocoder.ts';
import { resolveAddress } from './helpers/geocodePorts';
import type { CachedResolution, ResolverPorts } from './helpers/geocodePorts';

const adapterSrc = readFileSync('supabase/functions/resolve-address/privateMemberGeocoder.ts', 'utf8');
const resolverFn = readFileSync('supabase/functions/resolve-address/index.ts', 'utf8');
const browserPath = readFileSync('src/hooks/useMemberAccess.ts', 'utf8');

const FULL: MemberGeocoderEnv = {
  MEMBER_GEOCODER_APPROVED: 'true',
  MEMBER_GEOCODER_PROVIDER: 'approved_private_vendor',
  MEMBER_GEOCODER_ENDPOINT: 'https://geo.internal.example.org/v1/resolve',
  MEMBER_GEOCODER_API_KEY: 'test-token-not-real',
};

// ── 1. Activation requires explicit approval + complete config ─────────

describe('adapter activation gate', () => {
  it('is disabled with no configuration at all', () => {
    expect(readMemberGeocoderConfig({})).toEqual({ enabled: false, reason: 'not_approved' });
  });

  it('is disabled when the approval flag is absent even with full config', () => {
    const { MEMBER_GEOCODER_APPROVED: _drop, ...rest } = FULL;
    expect(readMemberGeocoderConfig(rest).enabled).toBe(false);
  });

  it.each(['false', 'TRUE', '1', 'yes', ' true '])(
    'is disabled for a non-exact approval value: %s',
    (flag) => {
      const status = readMemberGeocoderConfig({ ...FULL, MEMBER_GEOCODER_APPROVED: flag });
      expect(status).toEqual({ enabled: false, reason: 'not_approved' });
    },
  );

  it.each(['MEMBER_GEOCODER_PROVIDER', 'MEMBER_GEOCODER_ENDPOINT', 'MEMBER_GEOCODER_API_KEY'] as const)(
    'is disabled when %s is missing',
    (key) => {
      const status = readMemberGeocoderConfig({ ...FULL, [key]: '' });
      expect(status).toEqual({ enabled: false, reason: 'incomplete_config' });
    },
  );

  it('rejects a non-HTTPS endpoint', () => {
    const status = readMemberGeocoderConfig({
      ...FULL,
      MEMBER_GEOCODER_ENDPOINT: 'http://geo.internal.example.org/v1/resolve',
    });
    expect(status).toEqual({ enabled: false, reason: 'insecure_endpoint' });
  });

  it.each([
    'https://maps.googleapis.com/maps/api/geocode/json',
    'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress',
    'https://nominatim.openstreetmap.org/search',
    'https://api.mapbox.com/geocoding/v5',
    'https://geocode.search.hereapi.com/v1/geocode',
  ])('refuses the disallowed public provider %s', (endpoint) => {
    const status = readMemberGeocoderConfig({ ...FULL, MEMBER_GEOCODER_ENDPOINT: endpoint });
    expect(status).toEqual({ enabled: false, reason: 'disallowed_public_provider' });
  });

  it('enables only with approval plus complete private config', () => {
    const status = readMemberGeocoderConfig(FULL);
    expect(status.enabled).toBe(true);
    if (!status.enabled) return;
    expect(status.config.provider).toBe('approved_private_vendor');
    expect(status.config.timeoutMs).toBe(4000);
  });

  it('clamps the configured timeout into a safe range', () => {
    const low = readMemberGeocoderConfig({ ...FULL, MEMBER_GEOCODER_TIMEOUT_MS: '10' });
    const high = readMemberGeocoderConfig({ ...FULL, MEMBER_GEOCODER_TIMEOUT_MS: '999999' });
    expect(low.enabled && low.config.timeoutMs).toBe(1000);
    expect(high.enabled && high.config.timeoutMs).toBe(10000);
  });
});

// ── 2. No browser-side provider call or credential ─────────────────────

describe('no browser-side provider surface', () => {
  it('keeps every provider config name out of client code', () => {
    for (const name of [
      'MEMBER_GEOCODER_PROVIDER',
      'MEMBER_GEOCODER_ENDPOINT',
      'MEMBER_GEOCODER_API_KEY',
      'MEMBER_GEOCODER_APPROVED',
    ]) {
      expect(browserPath).not.toContain(name);
    }
  });

  it('exposes no VITE_-prefixed member geocoder variable anywhere in client code', () => {
    expect(browserPath).not.toMatch(/VITE_MEMBER_GEOCODER/);
  });

  it('still performs no raw fetch from the browser member path', () => {
    expect(browserPath).not.toMatch(/\bfetch\(/);
    expect(browserPath).toContain("'resolve-address'");
  });

  it('keeps the outbound provider call inside the server adapter only', () => {
    expect(adapterSrc).toMatch(/doFetch\(config\.endpoint/);
    expect(resolverFn).not.toMatch(/\bfetch\(/);
  });

  it('reads provider config only from server-side Deno env', () => {
    expect(resolverFn).toMatch(/Deno\.env\.get\('MEMBER_GEOCODER_APPROVED'\)/);
    expect(adapterSrc).not.toMatch(/import\.meta\.env/);
  });
});

// ── 3. Response validation / fail closed ──────────────────────────────

describe('provider response validation fails closed', () => {
  it.each([
    null,
    undefined,
    'not json',
    {},
    { resolved: false, lat: 39.5, lng: -118.7 },
    { lat: 'x', lng: 'y' },
    { lat: 0, lng: 0 },
    { lat: 200, lng: -118.7 },
    { lat: 39.5 },
  ])('rejects malformed payload %#', (payload) => {
    expect(normalizeProviderResponse(payload)).toBeNull();
  });

  it('accepts a minimal valid payload and discards any formatted address', () => {
    const hit = normalizeProviderResponse({
      resolved: true,
      lat: 40.8324,
      lng: -115.7631,
      confidence: 'high',
      precision: 'rooftop',
      formatted_address: '1800 Griswold Dr, Elko NV',
    });
    expect(hit).toEqual({
      lat: 40.8324,
      lng: -115.7631,
      confidence: 'high',
      precision: 'rooftop',
      county: null,
      postal_code: null,
      label: null,
    });
  });

  it('accepts latitude/longitude aliases', () => {
    expect(normalizeProviderResponse({ latitude: 39.5, longitude: -118.7 })?.lat).toBe(39.5);
  });

  it('returns null on a non-2xx provider response', async () => {
    const port = createPrivateMemberGeocoder(
      { provider: 'p', endpoint: 'https://x.example.org/r', apiKey: 'k', authHeader: 'Authorization', authScheme: 'Bearer', timeoutMs: 1000 },
      { fetchImpl: async () => new Response('nope', { status: 502 }) },
    );
    expect(await port.run('123 main st, fallon, nv 89406', '')).toBeNull();
  });

  it('returns null when the provider call throws or aborts (timeout path)', async () => {
    const port = createPrivateMemberGeocoder(
      { provider: 'p', endpoint: 'https://x.example.org/r', apiKey: 'k', authHeader: 'Authorization', authScheme: 'Bearer', timeoutMs: 1000 },
      { fetchImpl: async () => { throw new Error('AbortError'); } },
    );
    expect(await port.run('123 main st, fallon, nv 89406', '')).toBeNull();
  });

  it('sends only the normalized address, over POST, with the credential in a header', async () => {
    let seenUrl = '';
    let seenInit: RequestInit | undefined;
    const port = createPrivateMemberGeocoder(
      { provider: 'p', endpoint: 'https://x.example.org/r', apiKey: 'secret-k', authHeader: 'X-Api-Key', authScheme: '', timeoutMs: 1000 },
      {
        fetchImpl: async (url, init) => {
          seenUrl = String(url);
          seenInit = init;
          return new Response(JSON.stringify({ lat: 39.5, lng: -118.7 }), { status: 200 });
        },
      },
    );
    await port.run('123 main st, fallon, nv 89406', '');
    expect(seenUrl).toBe('https://x.example.org/r');
    expect(seenInit?.method).toBe('POST');
    expect(JSON.parse(String(seenInit?.body))).toEqual({ address: '123 main st, fallon, nv 89406' });
    expect((seenInit?.headers as Record<string, string>)['X-Api-Key']).toBe('secret-k');
  });

  it('transmits no member identity, program, or session context', async () => {
    let body = '';
    const port = createPrivateMemberGeocoder(
      { provider: 'p', endpoint: 'https://x.example.org/r', apiKey: 'k', authHeader: 'Authorization', authScheme: 'Bearer', timeoutMs: 1000 },
      {
        fetchImpl: async (_u, init) => {
          body = String(init?.body);
          return new Response(JSON.stringify({ lat: 39.5, lng: -118.7 }), { status: 200 });
        },
      },
    );
    await port.run('123 main st, fallon, nv 89406', '');
    expect(Object.keys(JSON.parse(body))).toEqual(['address']);
    for (const forbidden of ['member', 'name', 'id', 'insurance', 'diagnosis', 'program', 'session']) {
      expect(Object.keys(JSON.parse(body))).not.toContain(forbidden);
    }
  });
});

// ── 4/5/6. Resolver integration: order, cache, provenance, taxonomy ────

const cached = (over: Partial<CachedResolution> = {}): CachedResolution => ({
  lookup_key: 'v1:' + 'a'.repeat(64),
  location_class: 'member_address',
  latitude: 39.4738,
  longitude: -118.7774,
  geocode_source: 'internal_cache',
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

const harness = (opts: { cached?: CachedResolution | null; provider?: unknown } = {}) => {
  const upserts: Array<Record<string, unknown>> = [];
  const logs: Array<Record<string, unknown>> = [];
  let providerCalls = 0;
  const geocoder = createPrivateMemberGeocoder(
    { provider: 'approved_private_vendor', endpoint: 'https://geo.internal.example.org/v1/resolve', apiKey: 'k', authHeader: 'Authorization', authScheme: 'Bearer', timeoutMs: 1000 },
    {
      fetchImpl: async () => {
        providerCalls++;
        return new Response(JSON.stringify(opts.provider ?? { lat: 40.8324, lng: -115.7631, confidence: 'high', precision: 'rooftop' }), { status: 200 });
      },
    },
  );
  const ports: ResolverPorts = {
    secret: 'test-secret-value-not-a-real-key',
    cacheLookup: async () => opts.cached ?? null,
    cacheUpsert: async (r) => { upserts.push(r as unknown as Record<string, unknown>); },
    cacheTouch: async () => {},
    geocoders: [geocoder],
    logEvent: (e) => { logs.push(e as unknown as Record<string, unknown>); },
    now: () => '2026-09-16T00:00:00.000Z',
  };
  return { ports, upserts, logs, calls: () => providerCalls };
};

describe('resolver keeps internal authority ahead of the private provider', () => {
  it('short-circuits on a canonical match without calling the provider', async () => {
    const h = harness();
    h.ports.canonicalMatch = async () => ({
      lat: 39.5, lng: -118.78, confidence: 'high', precision: 'rooftop',
      county: 'Churchill', source: 'canonical_resource',
    });
    const res = await resolveAddress(h.ports, { address: '123 Main St, Fallon, NV 89406' });
    expect(res.strategy).toBe('canonical_resource');
    expect(res.external_calls).toBe(0);
    expect(h.calls()).toBe(0);
  });

  it('short-circuits on an internal cache hit without calling the provider', async () => {
    const h = harness({ cached: cached() });
    const res = await resolveAddress(h.ports, { address: '365 W A St, Fallon, NV 89406' });
    expect(res.source).toBe('internal_cache');
    expect(h.calls()).toBe(0);
  });

  it('never overwrites a manual/locked internal record with a provider result', async () => {
    const h = harness({
      cached: cached({ is_manual: true, is_coordinate_locked: true, geocode_source: 'manual_verified', expires_at: '2020-01-01T00:00:00.000Z' }),
    });
    const res = await resolveAddress(h.ports, { address: '365 W A St, Fallon, NV 89406' });
    expect(res.source).toBe('manual_verified');
    expect(res.lat).toBe(39.4738);
    expect(h.upserts).toHaveLength(0);
  });
});

describe('successful private provider resolution', () => {
  it('returns valid coordinates and caches them under the HMAC key with provider provenance', async () => {
    const h = harness();
    const res = await resolveAddress(h.ports, { address: '1800 Griswold Dr, Elko, NV 89801-1' });
    expect(res.resolved).toBe(true);
    expect(res.lat).toBeCloseTo(40.8324, 4);
    expect(res.source).toBe('private_member_geocoder');
    expect(h.calls()).toBeGreaterThan(0);

    expect(h.upserts).toHaveLength(1);
    const row = h.upserts[0] as Record<string, unknown>;
    expect(String(row.lookup_key)).toMatch(/^v\d+:[0-9a-f]{64}$/);
    expect(row.geocode_source).toBe('private_member_geocoder');
    expect(row.is_manual).toBe(false);
    expect(row.is_coordinate_locked).toBe(false);
  });

  it('stores no raw address text and no credential in the cache record or logs', async () => {
    const h = harness();
    await resolveAddress(h.ports, { address: '1800 Griswold Dr, Elko, NV 89801' });
    const dump = JSON.stringify({ upserts: h.upserts, logs: h.logs }).toLowerCase();
    expect(dump).not.toContain('griswold');
    expect(dump).not.toContain('1800');
    expect(dump).not.toContain('secret');
    expect(dump).not.toContain('geo.internal.example.org');
  });

  it('rejects a provider hit outside Nevada rather than placing the member', async () => {
    const h = harness({ provider: { lat: 34.05, lng: -118.24, confidence: 'high', precision: 'rooftop' } });
    const res = await resolveAddress(h.ports, { address: '1800 Griswold Dr, Elko, NV 89801' });
    expect(res.resolved).toBe(false);
    expect(res.manual_placement_required).toBe(true);
    expect(res.failures).toContain('member_geocoder_failed');
  });
});

describe('failure taxonomy stays distinct', () => {
  it('reports member_geocoder_failed when a configured provider is attempted and fails', async () => {
    const h = harness({ provider: { resolved: false } });
    const res = await resolveAddress(h.ports, { address: '9999 Unknown Rd, Ely, NV 89301' });
    expect(res.failures).toContain('member_geocoder_failed');
    expect(res.failures).not.toContain('member_geocoder_not_configured');
    expect(res.failures).toContain('manual_resolution_required');
  });

  it('reports member_geocoder_not_configured when no provider is configured', async () => {
    const h = harness();
    h.ports.geocoders = [];
    const res = await resolveAddress(h.ports, { address: '9999 Unknown Rd, Ely, NV 89301' });
    expect(res.failures).toContain('member_geocoder_not_configured');
    expect(res.failures).not.toContain('member_geocoder_failed');
  });

  it('gives the browser a distinct message per failure mode', () => {
    expect(browserPath).toContain('member_geocoder_not_configured');
    expect(browserPath).toContain('member_geocoder_failed');
    expect(browserPath).toContain('Automatic member address lookup is not configured');
    expect(browserPath).toContain('Automatic address lookup did not complete');
    expect(browserPath).toContain('Address resolution service is unavailable');
    expect(browserPath).toContain('place the member location manually — click the approximate location along the highway');
  });
});

// ── 7. Untouched neighbours ───────────────────────────────────────────

describe('resource geocoding and the basemap remain untouched', () => {
  it('leaves the public-resource Census geocoder intact and separate', () => {
    const census = readFileSync('supabase/functions/_shared/censusResourceGeocoder.ts', 'utf8');
    expect(census).toMatch(/geocoding\.geo\.census\.gov/);
    expect(census).not.toMatch(/MEMBER_GEOCODER/);
    expect(census).not.toMatch(/createPrivateMemberGeocoder/);
  });

  it('does not let the member path invoke the resource geocoding functions', () => {
    for (const src of [resolverFn, adapterSrc, browserPath]) {
      expect(src).not.toMatch(/invoke\(\s*'geocode-(address|bulk)'/);
      expect(src).not.toMatch(/location_class:\s*'resource_address'/);
    }
  });

  it('keeps the OpenStreetMap basemap tiles unchanged', () => {
    const mapView = readFileSync('src/components/map/MapView.tsx', 'utf8');
    expect(mapView).toMatch(/tile\.openstreetmap\.org/);
    expect(mapView).not.toMatch(/MEMBER_GEOCODER/);
  });
});
