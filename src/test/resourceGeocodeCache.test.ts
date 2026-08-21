/**
 * Phase 2C — internal public-resource geocode reuse.
 *
 * Behavioral tests for the shared resource-address authority used by both
 * `geocode-address` and `geocode-bulk`, plus regression guards proving the
 * Phase 2B member-address boundary is untouched.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  RESOURCE_LOCATION_CLASS,
  buildResourceAddress,
  computeResourceLookupKey,
  hasDeterministicIdentity,
  isProtectedCacheRow,
  isReviewConfidence,
  isUsableResourceCoordinate,
  resolveResourceAddress,
  seedManualResourceResolution,
  type ResourceCachePorts,
  type ResourceCacheRow,
  type ResourceExternalPort,
} from '../../supabase/functions/_shared/resourceGeocodeCache';
import { computeLookupKey, canonicalizeAddress } from '../../supabase/functions/_shared/geocodeNormalize';

const SECRET = 'test-secret-value-not-a-real-key';

const ADDR_A = '1000 N Division St, Carson City, NV 89703';
const ADDR_B = '705 Bridge St, Yerington, NV 89447';

interface Harness {
  ports: ResourceCachePorts;
  rows: Map<string, ResourceCacheRow>;
  calls: string[];
  touches: string[];
}

const harness = (
  geocoders: ResourceExternalPort[],
  seed: ResourceCacheRow[] = [],
): Harness => {
  const rows = new Map<string, ResourceCacheRow>();
  for (const r of seed) rows.set(r.lookup_key, r);
  const calls: string[] = [];
  const touches: string[] = [];
  const tracked = geocoders.map((g) => ({
    ...g,
    run: async (address: string) => {
      calls.push(g.name);
      return g.run(address);
    },
  }));
  return {
    rows,
    calls,
    touches,
    ports: {
      secret: SECRET,
      geocoders: tracked,
      now: () => '2026-08-21T00:00:00.000Z',
      lookup: async (key) => rows.get(key) ?? null,
      upsert: async (row) => {
        const existing = rows.get(row.lookup_key);
        if (existing && isProtectedCacheRow(existing) && row.geocode_source !== 'manual_verified') return;
        rows.set(row.lookup_key, row);
      },
      touch: async (key) => { touches.push(key); },
    },
  };
};

const googleOk: ResourceExternalPort = {
  name: 'google',
  run: async () => ({
    lat: 39.1638,
    lng: -119.7674,
    confidence: 'rooftop',
    match_type: 'ROOFTOP',
    precision: 'rooftop',
    county: 'Carson City',
  }),
};

const googleGeometric: ResourceExternalPort = {
  name: 'google',
  run: async () => ({
    lat: 39.1638,
    lng: -119.7674,
    confidence: 'geometric',
    match_type: 'GEOMETRIC_CENTER',
    precision: 'geometric',
  }),
};

const googleDown: ResourceExternalPort = {
  name: 'google',
  run: async () => { throw new Error('network down'); },
};

const googleOutOfBounds: ResourceExternalPort = {
  name: 'google',
  run: async () => ({ lat: 34.05, lng: -118.24, confidence: 'rooftop', match_type: 'ROOFTOP' }),
};

const googleNullCoords: ResourceExternalPort = {
  name: 'google',
  // deno-lint-ignore no-explicit-any
  run: async () => ({ lat: null as unknown as number, lng: null as unknown as number, confidence: 'rooftop' }),
};

const nominatimOk: ResourceExternalPort = {
  name: 'nominatim',
  run: async () => ({ lat: 38.9877, lng: -119.1626, confidence: 'high', match_type: 'address_full' }),
};

/* ─────────────────────────── CACHE IDENTITY ─────────────────────────── */

describe('cache identity', () => {
  it('1. same exact canonical address produces the same lookup key', async () => {
    const a = await computeResourceLookupKey(ADDR_A, SECRET);
    const b = await computeResourceLookupKey('1000 N. Division St., Carson City, Nevada 89703-1234', SECRET);
    expect(a).toBe(b);
  });

  it('2. a different address produces a different key', async () => {
    expect(await computeResourceLookupKey(ADDR_A, SECRET)).not.toBe(
      await computeResourceLookupKey(ADDR_B, SECRET),
    );
  });

  it('3. resource_address namespace differs from member_address namespace', async () => {
    const resourceKey = await computeResourceLookupKey(ADDR_A, SECRET);
    const memberKey = await computeLookupKey(canonicalizeAddress(ADDR_A).canonical, 'member_address', SECRET);
    expect(resourceKey).not.toBe(memberKey);
    expect(RESOURCE_LOCATION_CLASS).toBe('resource_address');
  });

  it('4. the resource path never queries the member_address class', async () => {
    const classes: string[] = [];
    const h = harness([googleOk]);
    const ports: ResourceCachePorts = {
      ...h.ports,
      lookup: async (key) => { classes.push(key); return null; },
    };
    await resolveResourceAddress(ports, { address: ADDR_A });
    const memberKey = await computeLookupKey(canonicalizeAddress(ADDR_A).canonical, 'member_address', SECRET);
    expect(classes).not.toContain(memberKey);
    const src = readFileSync('supabase/functions/_shared/resourceGeocodeCache.ts', 'utf8');
    expect(src).not.toMatch(/member_address/);
    const adapter = readFileSync('supabase/functions/_shared/resourceCachePorts.ts', 'utf8');
    expect(adapter).toContain('RESOURCE_LOCATION_CLASS');
    expect(adapter).not.toMatch(/member_address/);
  });

  it('rejects addresses without deterministic identity', () => {
    expect(hasDeterministicIdentity(ADDR_A)).toBe(true);
    expect(hasDeterministicIdentity('Elko County, NV')).toBe(false);
  });
});

/* ────────────────────────── CROSS-RECORD REUSE ────────────────────────── */

describe('cross-record reuse', () => {
  it('5-7. first address calls external, caches, second identical address is a zero-call cache hit', async () => {
    const h = harness([googleOk]);
    const first = await resolveResourceAddress(h.ports, { address: ADDR_A });
    expect(first.cache_hit).toBe(false);
    expect(first.external_calls).toBe(1);
    expect(first.cache_written).toBe(true);
    expect(h.rows.size).toBe(1);

    const second = await resolveResourceAddress(h.ports, { address: ADDR_A });
    expect(second.cache_hit).toBe(true);
    expect(second.external_calls).toBe(0);
    expect(h.calls).toEqual(['google']);
    expect(second.lat).toBe(first.lat);
    expect(second.lng).toBe(first.lng);
  });

  it('8-9. any resource table reuses the same entry — identity is the address, not the table', async () => {
    const h = harness([googleOk]);
    await resolveResourceAddress(h.ports, { address: buildResourceAddress({ street_address: '1000 N Division St', city: 'Carson City', state: 'NV', zip: '89703' }) });
    // rural_service / verified service / provider row with the same address:
    const reuse = await resolveResourceAddress(h.ports, { address: ADDR_A });
    expect(reuse.cache_hit).toBe(true);
    expect(h.calls.length).toBe(1);
    expect(h.rows.size).toBe(1);
  });
});

/* ───────────────────────── CROSS-FUNCTION REUSE ───────────────────────── */

describe('cross-function reuse', () => {
  it('10-11. geocode-address and geocode-bulk share one cache in both directions', async () => {
    const shared = harness([googleOk]);
    // geocode-address style resolution (Google port)
    await resolveResourceAddress(shared.ports, { address: ADDR_A });

    // geocode-bulk style resolution reuses it (Nominatim port never runs)
    const bulkCalls: string[] = [];
    const bulkPorts: ResourceCachePorts = {
      ...shared.ports,
      geocoders: [{ name: 'nominatim', run: async (a) => { bulkCalls.push('nominatim'); return nominatimOk.run(a); } }],
    };
    const viaBulk = await resolveResourceAddress(bulkPorts, { address: ADDR_A });
    expect(viaBulk.cache_hit).toBe(true);
    expect(bulkCalls).toEqual([]);
    expect(viaBulk.geocode_provider).toBe('google');

    // A bulk-created entry is reusable by the address function.
    const bulkOnly = harness([nominatimOk]);
    await resolveResourceAddress(bulkOnly.ports, { address: ADDR_B });
    const viaAddress = await resolveResourceAddress(
      { ...bulkOnly.ports, geocoders: [googleOk] },
      { address: ADDR_B },
    );
    expect(viaAddress.cache_hit).toBe(true);
    expect(viaAddress.geocode_provider).toBe('nominatim');
  });

  it('both edge functions build ports from the one shared adapter', () => {
    const addr = readFileSync('supabase/functions/geocode-address/index.ts', 'utf8');
    const bulk = readFileSync('supabase/functions/geocode-bulk/index.ts', 'utf8');
    expect(addr).toContain('createResourceCachePorts');
    expect(bulk).toContain('createResourceCachePorts');
    expect(addr).toContain('resolveResourceAddress');
    expect(bulk).toContain('resolveResourceAddress');
    // Neither depends on the member resolve-address HTTP endpoint.
    expect(addr).not.toMatch(/resolve-address/);
    expect(bulk).not.toMatch(/resolve-address/);
  });
});

/* ─────────────────────────── LOCK / MANUAL ─────────────────────────── */

const manualRow = (key: string): ResourceCacheRow => ({
  lookup_key: key,
  location_class: RESOURCE_LOCATION_CLASS,
  latitude: 39.5,
  longitude: -119.8,
  geocode_source: 'manual_verified',
  confidence: 'manual',
  precision: 'rooftop',
  county_name: 'Washoe',
  county_fips: '32031',
  state: 'NV',
  postal_code: null,
  is_manual: true,
  is_coordinate_locked: true,
  verified_at: '2026-01-01T00:00:00.000Z',
  source_metadata: {},
});

describe('manual / locked precedence', () => {
  it('12-13. manual/locked canonical coordinates are not overwritten by the resource path', () => {
    // Coordinate ownership lives in the edge functions: locked rows never get
    // their display columns rewritten.
    const addr = readFileSync('supabase/functions/geocode-address/index.ts', 'utf8');
    expect(addr).toContain('if (!record.coordinate_locked)');
    const bulk = readFileSync('supabase/functions/geocode-bulk/index.ts', 'utf8');
    expect(bulk).toContain('if (!row.coordinate_locked)');
  });

  it('14. automated results cannot replace manual_verified cache authority', async () => {
    const key = await computeResourceLookupKey(ADDR_A, SECRET);
    const h = harness([googleOk], [manualRow(key)]);
    const res = await resolveResourceAddress(h.ports, { address: ADDR_A, force: true });
    expect(h.calls).toEqual([]);
    expect(res.lat).toBe(39.5);
    expect(res.geocode_provider).toBe('manual_verified');
    expect(h.rows.get(key)?.geocode_source).toBe('manual_verified');
  });

  it('15. force: true bypasses normal automated cache reuse', async () => {
    const h = harness([googleOk]);
    await resolveResourceAddress(h.ports, { address: ADDR_A });
    const forced = await resolveResourceAddress(h.ports, { address: ADDR_A, force: true });
    expect(forced.cache_hit).toBe(false);
    expect(forced.external_calls).toBe(1);
    expect(h.calls).toEqual(['google', 'google']);
  });

  it('16. a failed force preserves the last known good cache entry', async () => {
    const h = harness([googleOk]);
    const good = await resolveResourceAddress(h.ports, { address: ADDR_A });
    const failing: ResourceCachePorts = { ...h.ports, geocoders: [googleDown] };
    const forced = await resolveResourceAddress(failing, { address: ADDR_A, force: true });
    expect(forced.resolved).toBe(true);
    expect(forced.cache_hit).toBe(true);
    expect(forced.lat).toBe(good.lat);
    expect(h.rows.size).toBe(1);
  });

  it('seeds manual authority only from valid curated coordinates', async () => {
    const h = harness([]);
    expect(await seedManualResourceResolution(h.ports, ADDR_A, { lat: 39.16, lng: -119.76 })).toBe(true);
    expect(await seedManualResourceResolution(h.ports, ADDR_B, { lat: null, lng: null })).toBe(false);
    expect(await seedManualResourceResolution(h.ports, ADDR_B, { lat: 34.05, lng: -118.24 })).toBe(false);
    expect(await seedManualResourceResolution(h.ports, 'Elko County, NV', { lat: 40.8, lng: -115.7 })).toBe(false);
  });
});

/* ─────────────────────────────── PROVENANCE ─────────────────────────────── */

describe('provenance', () => {
  it('17-18. cache hits preserve the original provider, confidence and precision', async () => {
    const h = harness([googleGeometric]);
    const first = await resolveResourceAddress(h.ports, { address: ADDR_A });
    const hit = await resolveResourceAddress(h.ports, { address: ADDR_A });
    expect(hit.geocode_provider).toBe('google');
    expect(hit.confidence).toBe(first.confidence);
    expect(hit.precision).toBe(first.precision);
    expect(hit.match_type).toBe('GEOMETRIC_CENTER');
  });

  it('19. low-confidence cache reuse remains review-required', async () => {
    const h = harness([googleGeometric]);
    await resolveResourceAddress(h.ports, { address: ADDR_A });
    const hit = await resolveResourceAddress(h.ports, { address: ADDR_A });
    expect(hit.review_required).toBe(true);
    expect(isReviewConfidence('approximate')).toBe(true);
    expect(isReviewConfidence('rooftop')).toBe(false);
    // Review queue accepts internal_cache as a receiving source.
    const review = readFileSync('src/pages/AdminGeocodeReview.tsx', 'utf8');
    expect(review).toContain('internal_cache');
  });

  it('20. cache reuse is distinguishable from a fresh external call', async () => {
    const h = harness([googleOk]);
    const fresh = await resolveResourceAddress(h.ports, { address: ADDR_A });
    const cached = await resolveResourceAddress(h.ports, { address: ADDR_A });
    expect(fresh.coordinate_source).toBe('google');
    expect(cached.coordinate_source).toBe('internal_cache');
    expect(cached.geocode_provider).toBe('google');
  });
});

/* ─────────────────────────────── FAILURES ─────────────────────────────── */

describe('failure behavior', () => {
  it('21. external failure with a cache hit still resolves', async () => {
    const key = await computeResourceLookupKey(ADDR_A, SECRET);
    const h = harness([googleDown], [{ ...manualRow(key), is_manual: false, is_coordinate_locked: false, geocode_source: 'google', confidence: 'rooftop' }]);
    const res = await resolveResourceAddress(h.ports, { address: ADDR_A });
    expect(res.resolved).toBe(true);
    expect(res.cache_hit).toBe(true);
  });

  it('22-23. external failure without a cache fails safely and writes nothing', async () => {
    const h = harness([googleDown]);
    const res = await resolveResourceAddress(h.ports, { address: ADDR_A });
    expect(res.resolved).toBe(false);
    expect(res.lat).toBeNull();
    expect(res.failure).toBe('external_geocoding_unavailable');
    expect(h.rows.size).toBe(0);
  });

  it('24. null coordinates are never coerced to 0 and never cached', async () => {
    const h = harness([googleNullCoords]);
    const res = await resolveResourceAddress(h.ports, { address: ADDR_A });
    expect(res.lat).toBeNull();
    expect(res.lng).toBeNull();
    expect(h.rows.size).toBe(0);
    expect(isUsableResourceCoordinate(0, 0, true)).toBe(false);
    expect(isUsableResourceCoordinate(null, null, true)).toBe(false);
  });

  it('25. out-of-Nevada results are not cached', async () => {
    const h = harness([googleOutOfBounds]);
    const res = await resolveResourceAddress(h.ports, { address: ADDR_A });
    expect(res.resolved).toBe(false);
    expect(h.rows.size).toBe(0);
  });
});

/* ───────────────────────────── AUTHORIZATION ───────────────────────────── */

describe('authorization', () => {
  const addr = readFileSync('supabase/functions/geocode-address/index.ts', 'utf8');
  const bulk = readFileSync('supabase/functions/geocode-bulk/index.ts', 'utf8');

  it('26-28. anonymous, staff, viewer and ops have no resource cache write path', () => {
    for (const src of [addr, bulk]) {
      expect(src).toMatch(/Unauthorized/);
      expect(src).toMatch(/'admin'/);
      expect(src).toMatch(/'sysop'/);
      expect(src).not.toMatch(/'ops'/);
      expect(src).not.toMatch(/'staff'/);
    }
  });

  it('29-30. admin and sysop write only through the administrative edge path', () => {
    for (const src of [addr, bulk]) {
      expect(src).toContain("roleRow.role !== 'admin' && roleRow.role !== 'sysop'");
      expect(src).toContain('SUPABASE_SERVICE_ROLE_KEY');
    }
    // No browser-side write into the cache table.
    const clientSrc = readFileSync('src/utils/triggerGeocode.ts', 'utf8');
    expect(clientSrc).not.toMatch(/geocode_resolutions/);
  });

  it('never returns the Google key, request URL or internal error text', () => {
    expect(addr).not.toMatch(/error: `Google API request failed/);
    expect(addr).toContain("'geocode_internal_error'");
    expect(addr).not.toMatch(/json\(\{ error: String\(err\) \}/);
  });
});

/* ───────────────────────────── REGRESSION ───────────────────────────── */

describe('member-address boundary regression', () => {
  const resolverIndex = readFileSync('supabase/functions/resolve-address/index.ts', 'utf8');
  const memberHook = readFileSync('src/hooks/useMemberAccess.ts', 'utf8');

  it('31. member resolution still has no approved external provider', () => {
    expect(resolverIndex).toContain('none_approved');
    expect(resolverIndex).not.toMatch(/nominatim\.openstreetmap/i);
    expect(resolverIndex).not.toMatch(/geocoding\.geo\.census/i);
    expect(resolverIndex).not.toMatch(/maps\.googleapis/i);
  });

  it('32-33. the browser member path and manual placement are unchanged', () => {
    expect(memberHook).toContain("'resolve-address'");
    expect(memberHook).not.toMatch(/resource_address/);
    expect(memberHook).not.toMatch(/geocode-address|geocode-bulk/);
    expect(memberHook).not.toMatch(/\bfetch\(/);
  });

  it('34. resource geocoding never writes member cache rows and vice versa', () => {
    const resourceCore = readFileSync('supabase/functions/_shared/resourceGeocodeCache.ts', 'utf8');
    expect(resourceCore).toContain("'resource_address'");
    expect(resolverIndex).not.toMatch(/resource_address/);
  });

  it('35-38. Decision Assist, Access Gap, Tier 1 and Public Safe Mode files were untouched by the resource cache', () => {
    for (const f of [
      'src/lib/operational/accessGaps.ts',
      'src/utils/tier1Detection.ts',
      'src/hooks/usePublicSafeMode.ts',
    ]) {
      expect(readFileSync(f, 'utf8')).not.toMatch(/resource_address/);
    }
  });
});
