/**
 * Phase 2B.2 — member-address data-boundary and authorization tests.
 *
 * Architectural rule under test:
 *   member_address_external_provider = none_approved
 *
 * A member address may reach only: the Rural Tool server boundary, its
 * internal HMAC geocode authority, and canonical NovumHealth-owned data.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolveAddress } from './helpers/geocodePorts';
import type {
  CachedResolution,
  GeocoderPort,
  ResolverPorts,
} from './helpers/geocodePorts';

const SECRET = 'test-secret-value-not-a-real-key';

const resolverFn = readFileSync('supabase/functions/resolve-address/index.ts', 'utf8');
const browserPath = readFileSync('src/hooks/useMemberAccess.ts', 'utf8');

// ── Member privacy: external disclosure ───────────────────────────────

describe('member-address resolver sends the address to no external provider', () => {
  it('contains no public Nominatim endpoint', () => {
    expect(resolverFn).not.toMatch(/nominatim\.openstreetmap\.org/i);
    expect(resolverFn).not.toMatch(/nominatimPort/);
  });

  it('contains no Census geocoder endpoint', () => {
    expect(resolverFn).not.toMatch(/geocoding\.geo\.census\.gov/i);
    expect(resolverFn).not.toMatch(/censusPort/);
  });

  it('registers an empty approved-geocoder list', () => {
    expect(resolverFn).toMatch(/geocoders:\s*\[\]/);
  });

  it('documents the provider status explicitly', () => {
    expect(resolverFn).toContain('member_address_external_provider = none_approved');
  });

  it('performs no outbound fetch of the address', () => {
    expect(resolverFn).not.toMatch(/\bfetch\(/);
  });
});

describe('browser member path has no external geocoder', () => {
  it('has no Nominatim or Census call', () => {
    expect(browserPath).not.toMatch(/nominatim/i);
    expect(browserPath).not.toMatch(/census/i);
  });

  it('performs no raw fetch', () => {
    expect(browserPath).not.toMatch(/\bfetch\(/);
  });

  it('calls only the internal resolver', () => {
    expect(browserPath).toContain("'resolve-address'");
  });
});

// ── Client fuzzy placement removal ────────────────────────────────────

describe('no client-side second coordinate authority', () => {
  it('has no three-token fuzzy match threshold', () => {
    expect(browserPath).not.toMatch(/matchCount\s*>=\s*3/);
    expect(browserPath).not.toMatch(/tokenMatch/);
  });

  it('does not place a member from bundled facility/service datasets', () => {
    expect(browserPath).not.toMatch(/defaultFacilities/);
    expect(browserPath).not.toMatch(/enrichedRuralServices/);
  });

  it('retains no hardcoded provider coordinates', () => {
    expect(browserPath).not.toMatch(/KNOWN_PROVIDER_COORDINATES/);
  });

  it('offers manual placement when the server is unresolved or unavailable', () => {
    expect(browserPath).toContain('setManualPlacementMode(true)');
    expect(browserPath).toContain('place the member location manually');
  });
});

// ── location_class authorization ──────────────────────────────────────

describe('location_class authorization is role-independent', () => {
  it('pins the class to member_address', () => {
    expect(resolverFn).toContain("const MEMBER_CLASS: LocationClass = 'member_address'");
    expect(resolverFn).toContain('const locationClass: LocationClass = MEMBER_CLASS');
  });

  it('rejects any other class for every caller (viewer/staff/ops/admin/sysop)', () => {
    expect(resolverFn).toContain('location_class_forbidden');
    // No role lookup exists, so no role can request an elevated class.
    expect(resolverFn).not.toMatch(/user_roles/);
    expect(resolverFn).not.toMatch(/auth\.getUser/);
  });

  it('never grants Ops a service-role geocode write path', () => {
    expect(resolverFn).not.toMatch(/'ops'/);
  });
});

// ── Canonical coverage ────────────────────────────────────────────────
// Behavioral coverage of the canonical matcher (table set, deleted/mappable/
// active gating, exact equality, manual coordinates, Nevada bounds) lives in
// `src/test/memberCanonicalMatch.test.ts`.

describe('canonical matching is the only in-repo coordinate authority', () => {
  it('delegates canonical matching to the shared extracted matcher', () => {
    expect(resolverFn).toContain('createCanonicalMatch');
  });
});


// ── Resolver behavior with no approved external provider ──────────────

const harness = (over: { cached?: CachedResolution | null; geocoders?: GeocoderPort[] } = {}) => {
  const upserts: Array<Record<string, unknown>> = [];
  const ports: ResolverPorts = {
    secret: SECRET,
    cacheLookup: async () => over.cached ?? null,
    cacheUpsert: async (r) => { upserts.push(r as unknown as Record<string, unknown>); },
    cacheTouch: async () => {},
    geocoders: over.geocoders ?? [],
    logEvent: () => {},
    now: () => '2026-08-21T00:00:00.000Z',
  };
  return { ports, upserts };
};

const cached = (over: Partial<CachedResolution> = {}): CachedResolution => ({
  lookup_key: 'v1:' + 'a'.repeat(64),
  location_class: 'member_address',
  latitude: 39.4738,
  longitude: -118.7774,
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

describe('member resolution chain with no approved external provider', () => {
  it('resolves a canonical exact match with zero external calls', async () => {
    const { ports } = harness();
    ports.canonicalMatch = async () => ({
      lat: 39.5, lng: -118.78, confidence: 'high', precision: 'rooftop',
      county: 'Churchill', source: 'canonical_resource',
    });
    const res = await resolveAddress(ports, { address: '123 Main St, Fallon, NV 89406' });
    expect(res.resolved).toBe(true);
    expect(res.strategy).toBe('canonical_resource');
    expect(res.external_calls).toBe(0);
  });

  it('resolves an existing internal cache hit with zero external calls', async () => {
    const { ports } = harness({ cached: cached() });
    const res = await resolveAddress(ports, { address: '365 W A St, Fallon, NV 89406' });
    expect(res.resolved).toBe(true);
    expect(res.source).toBe('internal_cache');
    expect(res.external_calls).toBe(0);
  });

  it('returns unresolved + manual placement for an unknown address, with no external call', async () => {
    const { ports } = harness();
    const res = await resolveAddress(ports, { address: '9999 Unknown Rd, Ely, NV 89301' });
    expect(res.resolved).toBe(false);
    expect(res.external_calls).toBe(0);
    expect(res.manual_placement_required).toBe(true);
    expect(res.failures).toContain('no_approved_external_provider');
    expect(res.failures).toContain('manual_resolution_required');
  });

  it('does not persist an unresolved null-coordinate record by default', async () => {
    const { ports, upserts } = harness();
    await resolveAddress(ports, { address: '9999 Unknown Rd, Ely, NV 89301' });
    expect(upserts).toHaveLength(0);
  });

  it('treats a null-coordinate row as a miss, not a permanent negative cache hit', async () => {
    const { ports } = harness({
      cached: cached({ latitude: null, longitude: null, geocode_source: 'unresolved' }),
    });
    ports.canonicalMatch = async () => ({
      lat: 39.5, lng: -118.78, confidence: 'high', precision: 'rooftop',
      county: 'Churchill', source: 'canonical_resource',
    });
    const res = await resolveAddress(ports, { address: '123 Main St, Fallon, NV 89406' });
    expect(res.resolved).toBe(true);
    expect(res.source).toBe('canonical_resource');
  });

  it('never persists raw member address text', async () => {
    const { ports, upserts } = harness({ geocoders: [] });
    await resolveAddress(ports, { address: '123 Fake St, Fallon, NV 89406', persistUnresolved: true });
    expect(JSON.stringify(upserts)).not.toMatch(/fake st/i);
  });
});
