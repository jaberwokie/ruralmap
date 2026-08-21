/**
 * Phase 2B.1 — hard privacy boundary tests.
 *
 * Proves that no member-address geocoding path in the browser touches an
 * external geocoder, and that the server-side retry chain preserves the
 * legacy rural behavior it replaced.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  buildQueryVariants,
  isHighwayAddress,
  NV_HIGHWAY_ALIASES,
} from '../../supabase/functions/_shared/geocodeNormalize';
import { resolveAddress } from './helpers/geocodePorts';
import type { GeocoderPort, ResolverPorts } from './helpers/geocodePorts';

const SECRET = 'test-secret-value-not-a-real-key';

const memberBrowserPath = readFileSync('src/hooks/useMemberAccess.ts', 'utf8');

describe('browser member-address path contains no external geocoder', () => {
  it('has no Nominatim URL', () => {
    expect(memberBrowserPath).not.toMatch(/nominatim/i);
  });

  it('has no Census geocoder or proxy call', () => {
    expect(memberBrowserPath).not.toMatch(/census/i);
    expect(memberBrowserPath).not.toMatch(/geocoding\.geo/i);
  });

  it('performs no raw fetch of the address', () => {
    expect(memberBrowserPath).not.toMatch(/\bfetch\(/);
  });

  it('calls only the internal resolver function', () => {
    expect(memberBrowserPath).toContain("'resolve-address'");
  });

  it('does not send an attacker-chooseable location_class', () => {
    expect(memberBrowserPath).not.toMatch(/location_class/);
  });
});

describe('server-side retry variant chain', () => {
  it('starts with the direct query', () => {
    const v = buildQueryVariants('123 Main St, Fallon, NV 89406');
    expect(v[0].strategy).toBe('direct');
    expect(v[0].level).toBe('street');
  });

  it('degrades street → city → zip', () => {
    const strategies = buildQueryVariants('123 Main St, Fallon, NV 89406').map(v => v.strategy);
    expect(strategies).toContain('abbreviation_variant');
    expect(strategies).toContain('city_zip');
    expect(strategies).toContain('zip');
  });

  it('adds highway alias retries last, including the no-house-number form', () => {
    const v = buildQueryVariants('1685 Schurz Hwy, Fallon, NV 89406');
    const strategies = v.map(x => x.strategy);
    expect(strategies).toContain('highway_alias');
    expect(strategies).toContain('highway_alias_without_number');
    expect(strategies.indexOf('highway_alias')).toBeGreaterThan(strategies.indexOf('direct'));
    const alias = v.find(x => x.strategy === 'highway_alias')!;
    expect(alias.q).toContain(NV_HIGHWAY_ALIASES['schurz hwy']);
  });

  it('strips suite/unit tokens', () => {
    const v = buildQueryVariants('123 Main St Suite 200, Ely, NV 89301');
    expect(v[0].q.toLowerCase()).not.toContain('suite');
  });

  it('flags highway addresses', () => {
    expect(isHighwayAddress('mile 12 US-95, NV')).toBe(true);
    expect(isHighwayAddress('123 Main St, Ely, NV')).toBe(false);
  });

  it('produces no duplicate queries', () => {
    const qs = buildQueryVariants('Ely, NV 89301').map(v => v.q.toLowerCase());
    expect(new Set(qs).size).toBe(qs.length);
  });
});

const harness = (geocoders: GeocoderPort[]) => {
  const upserts: Array<Record<string, unknown>> = [];
  const ports: ResolverPorts = {
    secret: SECRET,
    cacheLookup: async () => null,
    cacheUpsert: async (r) => { upserts.push(r as unknown as Record<string, unknown>); },
    cacheTouch: async () => {},
    geocoders,
    logEvent: () => {},
    now: () => '2026-01-01T00:00:00.000Z',
  };
  return { ports, upserts };
};

const failing = (name: GeocoderPort['name'] = 'nominatim'): GeocoderPort => ({
  name,
  failureCode: 'nominatim_failed',
  run: async () => null,
});

describe('resolver uses variants but caches under the original identity', () => {
  it('resolves via a later variant and reports its strategy', async () => {
    const calls: string[] = [];
    const geo: GeocoderPort = {
      name: 'nominatim',
      failureCode: 'nominatim_failed',
      run: async (q) => {
        calls.push(q);
        if (!/^89406/.test(q)) return null;
        return { lat: 39.47, lng: -118.77, confidence: 'low', precision: 'locality', county: 'Churchill' };
      },
    };
    const { ports, upserts } = harness([geo]);
    const res = await resolveAddress(ports, { address: '123 Fake St, Fallon, NV 89406' });
    expect(res.resolved).toBe(true);
    expect(res.strategy).toBe('zip');
    expect(res.is_approximate).toBe(true);
    expect(calls.length).toBeGreaterThan(1);
    expect(upserts).toHaveLength(1);
    // Cached under the original address identity, not the variant.
    expect(String(upserts[0].lookup_key)).toMatch(/^v1:[0-9a-f]{64}$/);
    expect((upserts[0].source_metadata as Record<string, unknown>).resolution_strategy).toBe('zip');
  });

  it('never persists raw address text for member addresses', async () => {
    const geo: GeocoderPort = {
      name: 'nominatim',
      failureCode: 'nominatim_failed',
      run: async () => ({
        lat: 39.47, lng: -118.77, confidence: 'high', precision: 'rooftop',
        label: '123 Fake St, Fallon, NV', county: 'Churchill',
      }),
    };
    const { ports, upserts } = harness([geo]);
    await resolveAddress(ports, { address: '123 Fake St, Fallon, NV 89406' });
    expect(JSON.stringify(upserts)).not.toMatch(/fake st/i);
  });

  it('honors the external call cap', async () => {
    const { ports } = harness([failing(), failing('census')]);
    const res = await resolveAddress(ports, {
      address: '1685 Schurz Hwy, Fallon, NV 89406',
      maxExternalCalls: 3,
    });
    expect(res.external_calls).toBe(3);
    expect(res.resolved).toBe(false);
    expect(res.manual_placement_required).toBe(true);
    expect(res.highway_address).toBe(true);
  });

  it('prefers a canonical Rural Tool resource over any external call', async () => {
    const geo: GeocoderPort = {
      name: 'nominatim',
      failureCode: 'nominatim_failed',
      run: async () => { throw new Error('must not be called'); },
    };
    const { ports } = harness([geo]);
    ports.canonicalMatch = async () => ({
      lat: 39.5, lng: -118.78, confidence: 'high', precision: 'rooftop',
      county: 'Churchill', source: 'canonical_resource',
    });
    const res = await resolveAddress(ports, { address: '123 Main St, Fallon, NV 89406' });
    expect(res.strategy).toBe('canonical_resource');
    expect(res.external_calls).toBe(0);
    expect(res.source).toBe('canonical_resource');
  });
});

describe('resolve-address server boundary configuration', () => {
  const fn = readFileSync('supabase/functions/resolve-address/index.ts', 'utf8');

  it('is a member-address-only resolver', () => {
    expect(fn).toContain("const MEMBER_CLASS: LocationClass = 'member_address'");
    expect(fn).toContain('location_class_forbidden');
  });

  it('exposes no elevated location classes to any role', () => {
    expect(fn).not.toMatch(/\['admin', 'ops', 'sysop'\]/);
    expect(fn).not.toMatch(/ELEVATED_CLASSES/);
  });

  it('does not echo internal errors to callers', () => {
    expect(fn).not.toMatch(/detail: String\(/);
  });

  it('rejects oversized payloads', () => {
    expect(fn).toContain('payload_too_large');
  });
});

