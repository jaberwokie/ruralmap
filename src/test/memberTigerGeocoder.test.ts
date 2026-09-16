/**
 * Phase 2E — internal Nevada TIGER/Line member geocoder.
 *
 * These tests protect two things that matter more than convenience:
 *   1. The member address is EPHEMERAL — no row, no cache entry, no log.
 *   2. A wrong pin is worse than no pin — ambiguity and out-of-range fail closed.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  decideTigerMatch,
  geocodeMemberAddressLocally,
  createTigerMemberGeocoder,
  type TigerCandidate,
} from '../../supabase/functions/resolve-address/tigerMemberGeocoder.ts';
import { parseMemberAddress, normalizeStreetName } from '../../supabase/functions/_shared/tigerStreetKey.ts';
import { resolveAddress } from '../../supabase/functions/resolve-address/resolver.ts';
import { canonicalizeAddress } from '../../supabase/functions/_shared/geocodeNormalize.ts';

const src = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

const candidate = (over: Partial<TigerCandidate> = {}): TigerCandidate => ({
  street_key: 'GRISWOLD DRIVE',
  street_core: 'GRISWOLD',
  fullname: 'Griswold Dr',
  county_fips: '32007',
  tlid: '1',
  side: 'L',
  zip: '89801',
  from_hn: 1800,
  to_hn: 1898,
  parity: 'E',
  exact_key: true,
  zip_match: true,
  lat: 40.849687,
  lng: -115.761499,
  ...over,
});

const ports = (candidates: TigerCandidate[], exists = false) => ({
  matchAddress: vi.fn(async () => candidates),
  streetExists: vi.fn(async () => exists),
});

describe('street identity normalization is shared by ingestion and lookup', () => {
  it('canonicalizes abbreviations and directionals', () => {
    expect(normalizeStreetName('Griswold Dr').streetKey).toBe('GRISWOLD DRIVE');
    expect(normalizeStreetName('W 6th St').streetKey).toBe('WEST 6TH STREET');
    expect(normalizeStreetName('Ave F').streetKey).toBe('AVENUE F');
  });

  it('parses house number, street, city and ZIP out of member input', () => {
    const p = parseMemberAddress('1800 Griswold Dr, Elko, NV 89801');
    expect(p.houseNumber).toBe(1800);
    expect(p.streetKey).toBe('GRISWOLD DRIVE');
    expect(p.zip).toBe('89801');
    expect(p.isNevada).toBe(true);
    expect(p.isStreetAddress).toBe(true);
  });
});

describe('deterministic matching', () => {
  it('resolves an exact street with the house number inside the range', async () => {
    const p = ports([candidate()]);
    const out = await geocodeMemberAddressLocally(p, '1800 Griswold Dr, Elko, NV 89801');
    expect(out.resolved).toBe(true);
    if (out.resolved) {
      expect(out.lat).toBeCloseTo(40.849687, 5);
      expect(out.lng).toBeCloseTo(-115.761499, 5);
      expect(out.county_fips).toBe('32007');
    }
  });

  it('honors parity: the reference lookup receives the house number for range/parity filtering', async () => {
    const p = ports([candidate({ parity: 'O', from_hn: 701, to_hn: 899, lat: 38.526041, lng: -118.620972 })]);
    const out = await geocodeMemberAddressLocally(p, '825 6th St, Hawthorne, NV 89415');
    expect(p.matchAddress).toHaveBeenCalledWith(
      expect.objectContaining({ house: 825, streetKey: '6TH STREET', zip: '89415' }),
    );
    expect(out.resolved).toBe(true);
  });

  it('prefers the ZIP-matching candidate over same-named streets elsewhere', async () => {
    const out = decideTigerMatch(parseMemberAddress('825 6th St, Hawthorne, NV 89415'), [
      candidate({ zip: '89415', zip_match: true, lat: 38.526041, lng: -118.620972 }),
      candidate({ zip: '89101', zip_match: false, lat: 36.160317, lng: -115.145045 }),
    ]);
    expect(out.resolved).toBe(true);
    if (out.resolved) expect(out.lat).toBeCloseTo(38.526041, 4);
  });

  // Regression — `150 Sixth St, Ely, NV 89301` was pinned outside Ely.
  it('normalizes spelled-out numbered streets to the same identity as digits', () => {
    expect(normalizeStreetName('Sixth St').streetKey).toBe(normalizeStreetName('6th St').streetKey);
    expect(normalizeStreetName('Sixth St').streetKey).toBe('6TH STREET');
    expect(normalizeStreetName('E First South St').streetKey).toBe('EAST 1ST SOUTH STREET');
    expect(normalizeStreetName('Twelfth Ave').streetKey).toBe('12TH AVENUE');
    expect(normalizeStreetName('Twenty First St').streetKey).toBe('21ST STREET');
    expect(parseMemberAddress('150 Sixth St, Ely, NV 89301').streetKey).toBe('6TH STREET');
  });

  it('resolves the Ely address through the digit street key with its own ZIP', async () => {
    const p = ports([
      candidate({
        street_key: '6TH STREET', street_core: '6TH', fullname: '6th St',
        county_fips: '32033', zip: '89301', zip_match: true,
        from_hn: 100, to_hn: 298, parity: 'E', lat: 39.249197, lng: -114.892101,
      }),
    ]);
    const out = await geocodeMemberAddressLocally(p, '150 Sixth St, Ely, NV 89301');
    expect(p.matchAddress).toHaveBeenCalledWith(
      expect.objectContaining({ house: 150, streetKey: '6TH STREET', zip: '89301' }),
    );
    expect(out.resolved).toBe(true);
    if (out.resolved) {
      expect(out.county_fips).toBe('32033');
      expect(out.lat).toBeCloseTo(39.249197, 4);
      expect(out.lng).toBeCloseTo(-114.892101, 4);
    }
  });

  it('never falls back statewide when the supplied ZIP matches no candidate', async () => {
    const p = ports([
      candidate({ zip: '89422', zip_match: false, county_fips: '32021', lat: 38.394001, lng: -118.111878 }),
      candidate({ zip: '89835', zip_match: false, county_fips: '32007', lat: 41.116321, lng: -114.970871 }),
    ]);
    const out = await geocodeMemberAddressLocally(p, '150 Sixth St, Ely, NV 89301');
    expect(out).toEqual({ resolved: false, reason: 'zip_mismatch' });
  });

  it('the same street name in several Nevada towns cannot cross the ZIP boundary', () => {
    const out = decideTigerMatch(parseMemberAddress('150 6th St, Ely, NV 89301'), [
      candidate({ zip: '89101', zip_match: false, county_fips: '32003', lat: 36.16, lng: -115.14 }),
      candidate({ zip: '89801', zip_match: false, county_fips: '32007', lat: 40.83, lng: -115.76 }),
    ]);
    expect(out).toEqual({ resolved: false, reason: 'zip_mismatch' });
  });

  it('refuses ZIP-matching candidates that straddle two counties', () => {
    const out = decideTigerMatch(parseMemberAddress('150 6th St, Ely, NV 89301'), [
      candidate({ zip: '89301', zip_match: true, county_fips: '32033', lat: 39.249, lng: -114.892 }),
      candidate({ zip: '89301', zip_match: true, county_fips: '32011', lat: 39.251, lng: -114.893 }),
    ]);
    expect(out).toEqual({ resolved: false, reason: 'ambiguous' });
  });

  it('fails closed when the house number is outside every range', async () => {
    const p = ports([], true); // street known, no range covers the number
    const out = await geocodeMemberAddressLocally(p, '99999 Griswold Dr, Elko, NV 89801');
    expect(out).toEqual({ resolved: false, reason: 'house_number_out_of_range' });
  });

  it('fails closed on an unknown street', async () => {
    const p = ports([], false);
    const out = await geocodeMemberAddressLocally(p, '100 Nonexistent Fake Rd, Elko, NV 89801');
    expect(out).toEqual({ resolved: false, reason: 'unknown_street' });
  });

  it('refuses ambiguous candidates in different towns instead of guessing', async () => {
    const p = ports([
      candidate({ zip: '89801', zip_match: false, lat: 40.83, lng: -115.76 }),
      candidate({ zip: '89101', zip_match: false, lat: 36.16, lng: -115.14 }),
    ]);
    const out = await geocodeMemberAddressLocally(p, '825 6th St, Nevada');
    expect(out).toEqual({ resolved: false, reason: 'ambiguous' });
  });

  it('accepts tightly clustered candidates (both sides of the same block)', () => {
    const out = decideTigerMatch(parseMemberAddress('1800 Griswold Dr, Elko, NV 89801'), [
      candidate({ side: 'L', lat: 40.849687, lng: -115.761499 }),
      candidate({ side: 'R', lat: 40.849701, lng: -115.761402 }),
    ]);
    expect(out.resolved).toBe(true);
  });

  it('rejects a non-Nevada state instead of matching a same-named Nevada street', async () => {
    const p = ports([candidate()]);
    const out = await geocodeMemberAddressLocally(p, '1800 Griswold Dr, Boise, ID 83702');
    expect(out).toEqual({ resolved: false, reason: 'out_of_state' });
    expect(p.matchAddress).not.toHaveBeenCalled();
  });

  it('never centroid-pins a city/ZIP-only input', async () => {
    const p = ports([candidate()]);
    const out = await geocodeMemberAddressLocally(p, 'Elko, NV 89801');
    expect(out).toEqual({ resolved: false, reason: 'not_a_street_address' });
    expect(p.matchAddress).not.toHaveBeenCalled();
  });

  it('fails closed when the reference dataset cannot be queried', async () => {
    const out = await geocodeMemberAddressLocally(
      { matchAddress: async () => { throw new Error('db down'); } },
      '1800 Griswold Dr, Elko, NV 89801',
    );
    expect(out).toEqual({ resolved: false, reason: 'reference_data_unavailable' });
  });
});

describe('precision honesty', () => {
  it('reports street-range interpolation, never rooftop', async () => {
    const out = await geocodeMemberAddressLocally(ports([candidate()]), '1800 Griswold Dr, Elko, NV 89801');
    expect(out.resolved).toBe(true);
    if (out.resolved) {
      expect(out.precision).toBe('street_range_interpolated');
      expect(out.precision).not.toBe('rooftop');
    }
  });

  it('the resolver marks a street-range result approximate', async () => {
    const result = await runResolver({ candidates: [candidate()] });
    expect(result.resolved).toBe(true);
    expect(result.precision).toBe('street_range_interpolated');
    expect(result.is_approximate).toBe(true);
  });
});

describe('ZIP+4 normalization still applies', () => {
  it('truncated ZIP+4 forms normalize to the 5-digit ZIP', () => {
    for (const z of ['89801-1', '89801-12', '89801-123']) {
      expect(canonicalizeAddress(`1800 Griswold Dr, Elko, NV ${z}`).zip).toBe('89801');
    }
    expect(canonicalizeAddress('1800 Griswold Dr, Elko, NV 89801-1234').zip).toBe('89801');
  });

  it('a truncated ZIP+4 resolves identically to the valid ZIP form', async () => {
    const a = await geocodeMemberAddressLocally(ports([candidate()]), '1800 Griswold Dr, Elko, NV 89801');
    const b = await geocodeMemberAddressLocally(ports([candidate()]), '1800 Griswold Dr, Elko, NV 89801-1');
    expect(b).toEqual(a);
  });
});

// ── Resolver-level behavior (ephemerality, ordering) ────────────────────────

const runResolver = async (opts: {
  candidates: TigerCandidate[];
  cached?: unknown;
  canonical?: unknown;
}) => {
  const cacheUpsert = vi.fn(async () => {});
  const logs: unknown[] = [];
  const result = await resolveAddress(
    {
      secret: 'test-secret',
      canonicalMatch: async () => (opts.canonical ?? null) as never,
      cacheLookup: async () => (opts.cached ?? null) as never,
      cacheUpsert,
      cacheTouch: async () => {},
      geocoders: [createTigerMemberGeocoder({ matchAddress: async () => opts.candidates })],
      logEvent: (e) => { logs.push(e); },
      now: () => '2026-01-01T00:00:00.000Z',
    } as never,
    {
      address: '1800 Griswold Dr, Elko, NV 89801',
      locationClass: 'member_address',
      persistUnresolved: false,
      persistResolved: false,
    },
  );
  return { ...result, cacheUpsert, logs };
};

describe('member addresses are ephemeral', () => {
  it('a successful automatic lookup writes NO cache row', async () => {
    const r = await runResolver({ candidates: [candidate()] });
    expect(r.resolved).toBe(true);
    expect(r.cacheUpsert).not.toHaveBeenCalled();
  });

  it('nothing logged contains the address, house number, or the HMAC lookup key', async () => {
    const r = await runResolver({ candidates: [candidate()] });
    const text = JSON.stringify(r.logs);
    expect(text).not.toMatch(/griswold/i);
    expect(text).not.toContain('1800');
    expect(text).not.toContain('89801');
    expect(text).not.toMatch(/lookup_key/);
  });

  it('the member function asks the resolver not to persist resolved results', () => {
    const index = src('supabase/functions/resolve-address/index.ts');
    expect(index).toMatch(/persistResolved:\s*false/);
    expect(index).toMatch(/persistUnresolved:\s*false/);
  });

  it('the internal geocoder module contains no persistence or fetch call', () => {
    const mod = src('supabase/functions/resolve-address/tigerMemberGeocoder.ts');
    expect(mod).not.toMatch(/\bfetch\(/);
    expect(mod).not.toMatch(/\.insert\(|\.upsert\(|\.update\(/);
    expect(mod).not.toMatch(/console\.(log|warn|error)/);
  });
});

describe('authority order', () => {
  it('an existing manual/locked record outranks the internal lookup', async () => {
    const r = await runResolver({
      candidates: [candidate()],
      cached: {
        latitude: 41.1, longitude: -116.1, geocode_source: 'internal_cache',
        confidence: 'high', precision: 'rooftop', county_name: 'Elko', county_fips: '32007',
        state: 'NV', postal_code: '89801', is_manual: true, is_coordinate_locked: true,
        expires_at: null,
      },
    });
    expect(r.lat).toBeCloseTo(41.1, 3);
    expect(r.is_manual).toBe(true);
  });

  it('a canonical resource match still short-circuits before the internal lookup', async () => {
    const r = await runResolver({
      candidates: [candidate()],
      canonical: { lat: 39.5, lng: -119.8, county: 'Washoe', source: 'facilities' },
    });
    expect(r.lat).toBeCloseTo(39.5, 3);
  });

  it('an internal lookup is not counted as an external call', async () => {
    const r = await runResolver({ candidates: [candidate()] });
    expect(r.external_calls).toBe(0);
  });
});

describe('no third-party disclosure and no scope creep', () => {
  it('the member resolver references no public geocoding host', () => {
    for (const f of [
      'supabase/functions/resolve-address/tigerMemberGeocoder.ts',
      'supabase/functions/resolve-address/index.ts',
    ]) {
      const body = src(f).replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
      expect(body).not.toMatch(/nominatim\.openstreetmap\.org/);
      expect(body).not.toMatch(/geocoding\.geo\.census\.gov/);
      expect(body).not.toMatch(/maps\.googleapis\.com/);
      expect(body).not.toMatch(/api\.mapbox\.com/);
      expect(body).not.toMatch(/hereapi\.com/);
    }
  });

  it('the browser hook still calls only the internal resolver', () => {
    const hook = src('src/hooks/useMemberAccess.ts');
    expect(hook).toMatch(/functions\.invoke\(\s*\n?\s*'resolve-address'/);
    expect(hook).not.toMatch(/https?:\/\/[^\s'"]*(census|nominatim|googleapis|mapbox|here)/i);
  });

  it('the "not configured" message is gone now that the internal lookup is live', () => {
    expect(src('src/hooks/useMemberAccess.ts')).not.toMatch(/lookup is not configured/);
  });

  it('public-resource Census geocoding is untouched', () => {
    expect(src('supabase/functions/_shared/censusResourceGeocoder.ts')).toMatch(/geocoding\.geo\.census\.gov/);
  });

  it('the OSM basemap is untouched', () => {
    expect(src('src/components/map/MapView.tsx')).toMatch(/tile\.openstreetmap\.org/);
  });
});
