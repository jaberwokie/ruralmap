/**
 * Phase 2B.4 — native Azure Maps member-address geocoder boundary tests.
 *
 * The adapter must stay inert until NovumHealth explicitly approves Azure Maps
 * AND a server-side subscription key exists, must keep the credential in a
 * header and the address in the body, must fail closed, must never leak address
 * text, and must never be presented as a precise pin when Azure returned only
 * locality-level precision.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  readAzureMapsConfig,
  createAzureMapsMemberGeocoder,
  parseAzureBatchResponse,
  buildAzureBatchBody,
  AZURE_MAPS_PROVIDER,
  AZURE_MAPS_DEFAULT_ENDPOINT,
  type AzureMapsEnv,
  type AzureMapsConfig,
} from '../../supabase/functions/resolve-address/azureMapsMemberGeocoder.ts';
import { resolveAddress } from './helpers/geocodePorts';
import type { CachedResolution, ResolverPorts } from './helpers/geocodePorts';

const read = (p: string) => readFileSync(p, 'utf8');
const adapterSrc = read('supabase/functions/resolve-address/azureMapsMemberGeocoder.ts');
const resolverFn = read('supabase/functions/resolve-address/index.ts');
const genericAdapter = read('supabase/functions/resolve-address/privateMemberGeocoder.ts');

const KEY = 'test-azure-key-not-real';
const APPROVED: AzureMapsEnv = {
  MEMBER_GEOCODER_APPROVED: 'true',
  MEMBER_GEOCODER_PROVIDER: AZURE_MAPS_PROVIDER,
  AZURE_MAPS_SUBSCRIPTION_KEY: KEY,
};

const ADDRESS = '1800 griswold dr, elko, nv 89801';

const config = (): AzureMapsConfig => {
  const status = readAzureMapsConfig(APPROVED);
  if (!status.enabled) throw new Error('expected enabled config');
  return status.config;
};

const azureFeature = (
  overrides: Record<string, unknown> = {},
  coords: [number, number] = [-115.7631, 40.8324],
) => ({
  batchItems: [
    {
      features: [
        {
          geometry: { coordinates: coords },
          properties: {
            type: 'Address',
            confidence: 'High',
            matchCodes: ['Good'],
            address: {
              addressLine: '1800 Griswold Dr',
              postalCode: '89801',
              formattedAddress: '1800 Griswold Dr, Elko, NV 89801',
            },
            ...overrides,
          },
        },
      ],
    },
  ],
});

const okResponse = (payload: unknown) => ({
  ok: true,
  status: 200,
  json: async () => payload,
}) as unknown as Response;

// ── 1. Activation gate ─────────────────────────────────────────────────

describe('azure maps activation gate', () => {
  it('is disabled with no configuration', () => {
    expect(readAzureMapsConfig({})).toEqual({ enabled: false, reason: 'not_approved' });
  });

  it.each(['false', 'TRUE', '1', 'yes', ' true '])(
    'is disabled for non-exact approval value %s',
    (flag) => {
      expect(readAzureMapsConfig({ ...APPROVED, MEMBER_GEOCODER_APPROVED: flag })).toEqual({
        enabled: false,
        reason: 'not_approved',
      });
    },
  );

  it('is disabled when the provider token is not azure_maps', () => {
    expect(
      readAzureMapsConfig({ ...APPROVED, MEMBER_GEOCODER_PROVIDER: 'some_private_vendor' }),
    ).toEqual({ enabled: false, reason: 'provider_not_selected' });
  });

  it('is disabled when the subscription key is absent', () => {
    expect(readAzureMapsConfig({ ...APPROVED, AZURE_MAPS_SUBSCRIPTION_KEY: '  ' })).toEqual({
      enabled: false,
      reason: 'missing_credential',
    });
  });

  it.each([
    'http://atlas.microsoft.com/geocode:batch',
    'https://evil.example.com/geocode:batch',
    'https://maps.googleapis.com/maps/api/geocode/json',
    'not-a-url',
    'https://atlas.microsoft.com/geocode:batch?subscription-key=leaked',
  ])('rejects the endpoint %s', (endpoint) => {
    expect(readAzureMapsConfig({ ...APPROVED, AZURE_MAPS_ENDPOINT: endpoint })).toEqual({
      enabled: false,
      reason: 'invalid_endpoint',
    });
  });

  it('rejects a malformed api-version', () => {
    expect(readAzureMapsConfig({ ...APPROVED, AZURE_MAPS_API_VERSION: 'latest' })).toEqual({
      enabled: false,
      reason: 'invalid_endpoint',
    });
  });

  it('enables with approval + provider token + key, defaulting the endpoint', () => {
    const status = readAzureMapsConfig(APPROVED);
    expect(status.enabled).toBe(true);
    if (!status.enabled) return;
    expect(status.config.endpoint).toBe(AZURE_MAPS_DEFAULT_ENDPOINT);
    expect(status.config.apiVersion).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(status.config.timeoutMs).toBe(4000);
  });

  it.each([['0', 1000], ['999999', 10000], ['2500', 2500]] as const)(
    'clamps timeout %s to %s ms',
    (raw, expected) => {
      const status = readAzureMapsConfig({ ...APPROVED, MEMBER_GEOCODER_TIMEOUT_MS: raw });
      expect(status.enabled && status.config.timeoutMs).toBe(expected);
    },
  );
});

// ── 2. Transport shape: credential header-only, address body-only ───────

describe('azure request transport', () => {
  const capture = async (payload: unknown = azureFeature()) => {
    const calls: { url: string; init: RequestInit }[] = [];
    const port = createAzureMapsMemberGeocoder(config(), {
      fetchImpl: (async (url: string, init: RequestInit) => {
        calls.push({ url: String(url), init });
        return okResponse(payload);
      }) as unknown as typeof fetch,
    });
    const hit = await port.run(ADDRESS, ADDRESS);
    return { calls, hit };
  };

  it('POSTs with the address in the body and never in the URL', async () => {
    const { calls } = await capture();
    expect(calls).toHaveLength(1);
    expect(calls[0].init.method).toBe('POST');
    expect(calls[0].url).not.toContain('griswold');
    expect(calls[0].url).not.toContain('89801');
    expect(String(calls[0].init.body)).toContain('griswold');
  });

  it('sends the credential in the subscription-key header only', async () => {
    const { calls } = await capture();
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers['subscription-key']).toBe(KEY);
    expect(calls[0].url).not.toContain(KEY);
    expect(String(calls[0].init.body)).not.toContain(KEY);
  });

  it('puts only api-version in the query string', async () => {
    const { calls } = await capture();
    const url = new URL(calls[0].url);
    expect([...url.searchParams.keys()]).toEqual(['api-version']);
  });

  it('sends exactly one batch item with minimal constraints', async () => {
    const { calls } = await capture();
    const body = JSON.parse(String(calls[0].init.body));
    expect(body.batchItems).toHaveLength(1);
    expect(Object.keys(body.batchItems[0]).sort()).toEqual(['countryRegion', 'query', 'top']);
    expect(body.batchItems[0]).toMatchObject({ query: ADDRESS, top: 1, countryRegion: 'US' });
    expect(Object.keys(body)).toEqual(['batchItems']);
  });

  it('transmits no member identity or contextual fields', () => {
    const body = JSON.stringify(buildAzureBatchBody(ADDRESS));
    for (const forbidden of [
      'member_id', 'memberId', 'member_name', 'patient', 'insurance', 'medicaid',
      'diagnosis', 'program', 'session', 'user_id', 'userId', 'mpi', 'dob',
    ]) {
      expect(body).not.toContain(forbidden);
    }
  });

  it('accepts a valid Azure response as coordinates', async () => {
    const { hit } = await capture();
    expect(hit).toMatchObject({ lat: 40.8324, lng: -115.7631, precision: 'rooftop' });
  });

  it('discards Azure formatted address text', async () => {
    const { hit } = await capture();
    expect(hit?.label).toBeNull();
    expect(JSON.stringify(hit)).not.toContain('Griswold');
  });
});

// ── 3. Fail-closed behavior ────────────────────────────────────────────

describe('azure fail-closed behavior', () => {
  const runWith = async (impl: typeof fetch) =>
    createAzureMapsMemberGeocoder(config(), { fetchImpl: impl }).run(ADDRESS, ADDRESS);

  it('returns null on a non-2xx response', async () => {
    const res = await runWith((async () => ({ ok: false, status: 429, json: async () => ({}) })) as unknown as typeof fetch);
    expect(res).toBeNull();
  });

  it('returns null on a transport error / timeout abort', async () => {
    const res = await runWith((async () => {
      throw new Error('aborted');
    }) as unknown as typeof fetch);
    expect(res).toBeNull();
  });

  it('returns null on unparseable JSON', async () => {
    const res = await runWith((async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('bad json');
      },
    })) as unknown as typeof fetch);
    expect(res).toBeNull();
  });

  it.each([
    ['null payload', null],
    ['no batchItems', {}],
    ['empty batchItems', { batchItems: [] }],
    ['multiple batchItems', { batchItems: [{ features: [] }, { features: [] }] }],
    ['per-item error', { batchItems: [{ error: { code: 'BadRequest' } }] }],
    ['no features', { batchItems: [{ features: [] }] }],
    ['missing geometry', { batchItems: [{ features: [{ properties: {} }] }] }],
    ['non-numeric coordinates', { batchItems: [{ features: [{ geometry: { coordinates: ['a', 'b'] } }] }] }],
  ])('returns null for %s', (_label, payload) => {
    expect(parseAzureBatchResponse(payload)).toBeNull();
  });

  it('rejects the 0,0 sentinel', () => {
    expect(parseAzureBatchResponse(azureFeature({}, [0, 0]))).toBeNull();
  });

  it('rejects out-of-range coordinates', () => {
    expect(parseAzureBatchResponse(azureFeature({}, [-400, 99]))).toBeNull();
  });

  it('rejects a low-confidence result as ambiguous', () => {
    expect(parseAzureBatchResponse(azureFeature({ confidence: 'Low' }))).toBeNull();
  });

  it('rejects an explicitly ambiguous match code', () => {
    expect(parseAzureBatchResponse(azureFeature({ matchCodes: ['Ambiguous'] }))).toBeNull();
  });

  it.each(['Country', 'CountryRegion', 'AdminArea', 'State'])(
    'rejects the too-coarse result type %s',
    (type) => {
      expect(parseAzureBatchResponse(azureFeature({ type }))).toBeNull();
    },
  );
});

// ── 4. Precision honesty ───────────────────────────────────────────────

describe('azure precision honesty', () => {
  it('reports rooftop only for an address-level match with a house number', () => {
    expect(parseAzureBatchResponse(azureFeature())?.precision).toBe('rooftop');
  });

  it.each(['PostalCodeArea', 'Locality', 'Neighborhood', 'Street'])(
    'reports approximate for the %s result class',
    (type) => {
      expect(parseAzureBatchResponse(azureFeature({ type }))?.precision).toBe('approximate');
    },
  );

  it('reports approximate for an address class with no house number', () => {
    const payload = azureFeature({ address: { addressLine: 'Griswold Dr', postalCode: '89801' } });
    expect(parseAzureBatchResponse(payload)?.precision).toBe('approximate');
  });

  it('does not mislabel a locality-only Azure result for a street-level input', async () => {
    const port = createAzureMapsMemberGeocoder(config(), {
      fetchImpl: (async () => okResponse(azureFeature({ type: 'Locality' }))) as unknown as typeof fetch,
    });
    const result = await resolveAddress(portsWith([port]), { address: '1800 Griswold Dr, Elko, NV 89801' });
    expect(result.resolved).toBe(true);
    expect(result.precision).toBe('approximate');
    expect(result.is_approximate).toBe(true);
  });

  it('marks a rooftop Azure result for a street-level input as precise', async () => {
    const port = createAzureMapsMemberGeocoder(config(), {
      fetchImpl: (async () => okResponse(azureFeature())) as unknown as typeof fetch,
    });
    const result = await resolveAddress(portsWith([port]), { address: '1800 Griswold Dr, Elko, NV 89801' });
    expect(result.is_approximate).toBe(false);
    expect(result.precision).toBe('rooftop');
  });
});

// ── 5. Resolver integration: authority order, Nevada bounds, caching ────

interface Harness {
  ports: ResolverPorts;
  upserts: (CachedResolution & { source_metadata: Record<string, unknown> })[];
  logs: unknown[];
}

let harness: Harness;

const portsWith = (
  geocoders: ResolverPorts['geocoders'],
  cached: CachedResolution | null = null,
  canonicalHit: Awaited<ReturnType<NonNullable<ResolverPorts['canonicalMatch']>>> = null,
): ResolverPorts => {
  const upserts: Harness['upserts'] = [];
  const logs: unknown[] = [];
  const ports: ResolverPorts = {
    secret: 'unit-test-hmac-secret',
    canonicalMatch: canonicalHit ? async () => canonicalHit : undefined,
    cacheLookup: async () => cached,
    cacheUpsert: async (record) => {
      upserts.push(record);
    },
    cacheTouch: async () => {},
    geocoders,
    logEvent: (e) => {
      logs.push(e);
    },
    now: () => '2026-01-01T00:00:00.000Z',
  };
  harness = { ports, upserts, logs };
  return ports;
};

const lockedRecord = (): CachedResolution => ({
  lookup_key: 'ignored',
  location_class: 'member_address',
  latitude: 40.9,
  longitude: -115.8,
  geocode_source: 'manual_verified',
  confidence: 'high',
  precision: 'rooftop',
  county_name: 'Elko',
  county_fips: '32007',
  state: 'NV',
  postal_code: '89801',
  is_manual: true,
  is_coordinate_locked: true,
  verified_at: '2025-01-01T00:00:00.000Z',
  expires_at: null,
});

describe('azure inside the resolver', () => {
  it('is never called when manual/locked internal coordinates exist', async () => {
    let called = 0;
    const port = createAzureMapsMemberGeocoder(config(), {
      fetchImpl: (async () => {
        called++;
        return okResponse(azureFeature());
      }) as unknown as typeof fetch,
    });
    const result = await resolveAddress(portsWith([port], lockedRecord()), { address: ADDRESS });
    expect(called).toBe(0);
    expect(result.is_manual).toBe(true);
    expect(result.lat).toBe(40.9);
    expect(result.external_calls).toBe(0);
  });

  it('is never called when a canonical resource match exists', async () => {
    let called = 0;
    const port = createAzureMapsMemberGeocoder(config(), {
      fetchImpl: (async () => {
        called++;
        return okResponse(azureFeature());
      }) as unknown as typeof fetch,
    });
    const result = await resolveAddress(
      portsWith([port], null, {
        lat: 40.83,
        lng: -115.76,
        confidence: 'high',
        precision: 'rooftop',
        source: 'canonical_resource',
        county: 'Elko',
      } as never),
      { address: ADDRESS },
    );
    expect(called).toBe(0);
    expect(result.strategy).toBe('canonical_resource');
  });

  it('rejects an out-of-Nevada Azure coordinate', async () => {
    // Phoenix, AZ — valid coordinates, wrong state.
    const port = createAzureMapsMemberGeocoder(config(), {
      fetchImpl: (async () => okResponse(azureFeature({}, [-112.074, 33.4484]))) as unknown as typeof fetch,
    });
    const result = await resolveAddress(portsWith([port]), { address: ADDRESS });
    expect(result.resolved).toBe(false);
    expect(result.failures).toContain('member_geocoder_failed');
    expect(result.manual_placement_required).toBe(true);
  });

  it('reports member_geocoder_failed, not not_configured, when Azure fails', async () => {
    const port = createAzureMapsMemberGeocoder(config(), {
      fetchImpl: (async () => ({ ok: false, status: 500, json: async () => ({}) })) as unknown as typeof fetch,
    });
    const result = await resolveAddress(portsWith([port]), { address: ADDRESS });
    expect(result.failures).toContain('member_geocoder_failed');
    expect(result.failures).not.toContain('member_geocoder_not_configured');
  });

  it('keeps member_geocoder_not_configured when Azure is not activated', async () => {
    const result = await resolveAddress(portsWith([]), { address: ADDRESS });
    expect(result.failures).toContain('member_geocoder_not_configured');
    expect(result.resolved).toBe(false);
  });

  it('caches a success under the HMAC key with no address text anywhere', async () => {
    const port = createAzureMapsMemberGeocoder(config(), {
      fetchImpl: (async () => okResponse(azureFeature())) as unknown as typeof fetch,
    });
    const result = await resolveAddress(portsWith([port]), { address: ADDRESS });
    expect(result.resolved).toBe(true);

    expect(harness.upserts).toHaveLength(1);
    const record = harness.upserts[0];
    expect(record.lookup_key).toMatch(/^v1:[0-9a-f]{64}$/);
    expect(record.location_class).toBe('member_address');
    expect(record.geocode_source).toBe('private_member_geocoder');

    const serialized = `${JSON.stringify(record)}${JSON.stringify(harness.logs)}${JSON.stringify(result)}`;
    for (const leak of ['griswold', 'Griswold', '1800', KEY, 'atlas.microsoft.com', 'subscription-key']) {
      expect(serialized.toLowerCase()).not.toContain(leak.toLowerCase());
    }
  });
});

// ── 6. Source-level isolation guarantees ───────────────────────────────

describe('azure adapter isolation', () => {
  it('never logs anything from the adapter module', () => {
    expect(adapterSrc).not.toMatch(/console\./);
  });

  it('reads no configuration from client-visible variables', () => {
    expect(adapterSrc).not.toMatch(/import\.meta\.env/);
    expect(adapterSrc).not.toMatch(/VITE_/);
  });

  it('exposes no Azure key or member provider config to the browser bundle', () => {
    const clientFiles = [
      'src/hooks/useMemberAccess.ts',
      'src/components/map/MemberAccessSearch.tsx',
      '.env',
    ];
    for (const file of clientFiles) {
      const src = read(file);
      expect(src).not.toMatch(/AZURE_MAPS/);
      expect(src).not.toMatch(/atlas\.microsoft\.com/);
      expect(src).not.toMatch(/subscription-key/);
    }
  });

  it('is wired only into the server-side resolve-address function', () => {
    expect(resolverFn).toContain('readAzureMapsConfig');
    expect(resolverFn).toContain("Deno.env.get('AZURE_MAPS_SUBSCRIPTION_KEY')");
    expect(resolverFn).not.toMatch(/VITE_AZURE/);
  });

  it('keeps the generic private adapter and its disallowed-host protections', () => {
    expect(genericAdapter).toContain('DISALLOWED_HOSTS');
    for (const host of ['googleapis.com', 'census.gov', 'nominatim', 'mapbox.com', 'hereapi.com']) {
      expect(genericAdapter).toContain(host);
    }
    expect(resolverFn).toContain('createPrivateMemberGeocoder');
  });

  it('leaves public-resource Census geocoding untouched by the member path', () => {
    const census = read('supabase/functions/_shared/censusResourceGeocoder.ts');
    expect(census).not.toMatch(/AZURE_MAPS|atlas\.microsoft\.com/);
    expect(census).not.toMatch(/member_address/);
    expect(adapterSrc).not.toMatch(/census/i);
  });

  it('leaves the OSM basemap untouched', () => {
    const mapView = read('src/components/map/MapView.tsx');
    expect(mapView).toContain('tile.openstreetmap.org');
    expect(mapView).not.toMatch(/AZURE_MAPS|atlas\.microsoft\.com/);
  });
});
