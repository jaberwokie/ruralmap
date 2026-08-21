/**
 * Phase 2C.1 — resource cache correctness closure.
 *
 * Covers the three correctness gaps found in Phase 2C at HEAD:
 *   A. internal reuse depended on the Google credential being present
 *   B. geocode-bulk did not write record-level geocode provenance
 *   C. "Geocode Static Data" nulled coordinates as preparation
 *
 * Behavioral tests exercise the shared resolution core. Wiring tests assert the
 * edge-function / admin-page contract that the core cannot observe on its own
 * (credential ordering, which columns are written, which filter is queried).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  computeResourceLookupKey,
  isProtectedCacheRow,
  resolveResourceAddress,
  type ResourceCachePorts,
  type ResourceCacheRow,
  type ResourceExternalPort,
} from '../../supabase/functions/_shared/resourceGeocodeCache';

const SECRET = 'test-secret-value-not-a-real-key';
const ADDR = '1000 N Division St, Carson City, NV 89703';

const ADDRESS_FN = readFileSync('supabase/functions/geocode-address/index.ts', 'utf8');
const BULK_FN = readFileSync('supabase/functions/geocode-bulk/index.ts', 'utf8');
const REVIEW_PAGE = readFileSync('src/pages/AdminGeocodeReview.tsx', 'utf8');
const SERVICES_PAGE = readFileSync('src/pages/AdminMappingServices.tsx', 'utf8');

interface Harness {
  ports: ResourceCachePorts;
  rows: Map<string, ResourceCacheRow>;
  calls: string[];
}

const harness = (geocoders: ResourceExternalPort[], seed: ResourceCacheRow[] = []): Harness => {
  const rows = new Map<string, ResourceCacheRow>();
  for (const r of seed) rows.set(r.lookup_key, r);
  const calls: string[] = [];
  const tracked = geocoders.map((g) => ({
    ...g,
    run: async (address: string) => { calls.push(g.name); return g.run(address); },
  }));
  return {
    rows,
    calls,
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
      touch: async () => {},
    },
  };
};

const cacheRow = (
  key: string,
  over: Partial<ResourceCacheRow> = {},
): ResourceCacheRow => ({
  lookup_key: key,
  location_class: 'resource_address',
  latitude: 39.1638,
  longitude: -119.7674,
  geocode_source: 'google',
  confidence: 'rooftop',
  precision: 'rooftop',
  county_name: 'Carson City',
  county_fips: '32510',
  state: 'NV',
  postal_code: '89703',
  is_manual: false,
  is_coordinate_locked: false,
  verified_at: null,
  source_metadata: { match_type: 'ROOFTOP' },
  ...over,
});

const googleOk: ResourceExternalPort = {
  name: 'google',
  run: async () => ({ lat: 39.1, lng: -119.7, confidence: 'rooftop', match_type: 'ROOFTOP' }),
};
const googleDown: ResourceExternalPort = {
  name: 'google',
  run: async () => { throw new Error('provider unavailable'); },
};

/* ───────────── 1-3. cache reuse must not depend on Google ───────────── */

describe('cache availability is independent of the Google credential', () => {
  it('1. cache hit resolves with an EMPTY provider chain (no Google key configured)', async () => {
    const key = await computeResourceLookupKey(ADDR, SECRET);
    // No geocoders at all — this is exactly the shape produced when
    // GOOGLE_GEOCODING_API_KEY is absent.
    const h = harness([], [cacheRow(key)]);
    const r = await resolveResourceAddress(h.ports, { address: ADDR });
    expect(r.resolved).toBe(true);
    expect(r.cache_hit).toBe(true);
    expect(r.external_calls).toBe(0);
    expect(h.calls.length).toBe(0);
    expect(r.lat).toBe(39.1638);
  });

  it('2. cache miss requires an available external provider', async () => {
    const withProvider = harness([googleOk]);
    const ok = await resolveResourceAddress(withProvider.ports, { address: ADDR });
    expect(ok.resolved).toBe(true);
    expect(ok.external_calls).toBe(1);

    const noProvider = harness([]);
    const bad = await resolveResourceAddress(noProvider.ports, { address: ADDR });
    expect(bad.resolved).toBe(false);
    expect(bad.failure).toBe('external_geocoding_unavailable');
    expect(bad.lat).toBeNull();
    expect(noProvider.rows.size).toBe(0); // no false cache row
  });

  it('3. geocode-address evaluates the credential only inside the provider chain', () => {
    const keyIdx = ADDRESS_FN.indexOf("Deno.env.get('GOOGLE_GEOCODING_API_KEY')");
    const secretIdx = ADDRESS_FN.indexOf("Deno.env.get('GEOCODE_CACHE_HMAC_SECRET')");
    const resolveIdx = ADDRESS_FN.indexOf('resolveResourceAddress(');
    expect(keyIdx).toBeGreaterThan(-1);
    // The credential is no longer a hard precondition of the whole request…
    expect(ADDRESS_FN).not.toMatch(/GOOGLE_GEOCODING_API_KEY not configured/);
    // …it is only used to decide whether a provider exists.
    expect(ADDRESS_FN).toContain('apiKey ? [googlePort] : []');
    expect(secretIdx).toBeGreaterThan(-1);
    expect(resolveIdx).toBeGreaterThan(secretIdx);
  });

  it('3b. missing credential yields a stable code only on a cache miss', () => {
    expect(ADDRESS_FN).toContain("error: 'google_credentials_missing'");
    // The credential-missing branch lives inside the unresolved path, before
    // any record stamp or cache mutation.
    const unresolvedIdx = ADDRESS_FN.indexOf('if (!resolution.resolved');
    const missingIdx = ADDRESS_FN.indexOf("error: 'google_credentials_missing'");
    const stampIdx = ADDRESS_FN.indexOf("coordinate_source: 'failed'");
    expect(missingIdx).toBeGreaterThan(unresolvedIdx);
    expect(missingIdx).toBeLessThan(stampIdx);
    // The credential is only interpolated into the provider request URL — it is
    // never placed in a response body, and its presence is reported as a boolean.
    expect(ADDRESS_FN).toContain('google_credentials_missing: !apiKey ? true : undefined');
    const responses = ADDRESS_FN.match(/return json\([\s\S]*?\);/g) ?? [];
    for (const r of responses) expect(r).not.toMatch(/\$\{apiKey\}|apiKey,|: apiKey/);
  });
});

/* ───────────── 4-5. force failure must not destroy the cache ───────────── */

describe('force with the provider unavailable', () => {
  it('4. failed forced refresh preserves last-known-good cache', async () => {
    const key = await computeResourceLookupKey(ADDR, SECRET);
    const h = harness([googleDown], [cacheRow(key, { confidence: 'range' })]);
    const r = await resolveResourceAddress(h.ports, { address: ADDR, force: true });
    expect(r.resolved).toBe(true);
    expect(r.lat).toBe(39.1638);
    expect(h.rows.get(key)!.latitude).toBe(39.1638);
    expect(h.rows.get(key)!.confidence).toBe('range');
    expect(h.rows.size).toBe(1);
  });

  it('5. failed force is distinguishable from a successful fresh refresh', async () => {
    const key = await computeResourceLookupKey(ADDR, SECRET);
    const failed = harness([googleDown], [cacheRow(key)]);
    const f = await resolveResourceAddress(failed.ports, { address: ADDR, force: true });
    expect(f.forced_refresh_failed).toBe(true);
    expect(f.cache_hit).toBe(true);
    expect(f.external_calls).toBe(1);

    const fresh = harness([googleOk], [cacheRow(key)]);
    const s = await resolveResourceAddress(fresh.ports, { address: ADDR, force: true });
    expect(s.forced_refresh_failed).toBe(false);
    expect(s.cache_hit).toBe(false);
    expect(s.lat).toBe(39.1);

    expect(ADDRESS_FN).toContain('forced_refresh_failed_cache_retained');
    expect(ADDRESS_FN).toContain('forced_refresh_succeeded');
  });

  it('5b. protected manual_verified authority still outranks force entirely', async () => {
    const key = await computeResourceLookupKey(ADDR, SECRET);
    const h = harness([googleOk], [cacheRow(key, {
      geocode_source: 'manual_verified', is_manual: true, is_coordinate_locked: true, confidence: 'manual',
    })]);
    const r = await resolveResourceAddress(h.ports, { address: ADDR, force: true });
    expect(r.cache_hit).toBe(true);
    expect(r.external_calls).toBe(0);
    expect(h.calls.length).toBe(0);
    expect(r.forced_refresh_failed).toBe(false);
  });
});

/* ───────────── 6-10. geocode-bulk record provenance ───────────── */

describe('geocode-bulk record provenance', () => {
  const successBranch = BULK_FN.slice(
    BULK_FN.indexOf('if (resolution.resolved'),
    BULK_FN.indexOf('} else {'),
  );

  it('6. cache hit writes geocoded_lat / geocoded_lng', () => {
    expect(successBranch).toContain('geocoded_lat: resolution.lat');
    expect(successBranch).toContain('geocoded_lng: resolution.lng');
  });

  it('7. cache hit writes coordinate_source = internal_cache', () => {
    expect(successBranch).toContain("resolution.cache_hit ? 'internal_cache' : resolution.geocode_provider");
  });

  it('8. cache hit preserves the ORIGINAL geocode_provider', async () => {
    expect(successBranch).toContain('geocode_provider: resolution.geocode_provider');
    const key = await computeResourceLookupKey(ADDR, SECRET);
    const h = harness([], [cacheRow(key, { geocode_source: 'census', confidence: 'low' })]);
    const r = await resolveResourceAddress(h.ports, { address: ADDR });
    expect(r.coordinate_source).toBe('internal_cache');
    expect(r.geocode_provider).toBe('census'); // not rewritten to internal_cache
    expect(r.confidence).toBe('low');          // never upgraded
  });

  it('9. a fresh Nominatim result carries provider / confidence / match fields', async () => {
    const nominatim: ResourceExternalPort = {
      name: 'nominatim',
      run: async () => ({ lat: 38.9877, lng: -119.1626, confidence: 'high', match_type: 'address_full', precision: 'street' }),
    };
    const h = harness([nominatim]);
    const r = await resolveResourceAddress(h.ports, { address: ADDR });
    expect(r.coordinate_source).toBe('nominatim');
    expect(r.geocode_provider).toBe('nominatim');
    expect(r.confidence).toBe('high');
    expect(r.match_type).toBe('address_full');
    expect(successBranch).toContain('coordinate_confidence: resolution.confidence');
    expect(successBranch).toContain('geocode_match_type: resolution.match_type');
    expect(successBranch).toContain('last_geocoded_at');
  });

  it('10. a fresh Census result carries provider / confidence / match fields', async () => {
    const census: ResourceExternalPort = {
      name: 'census',
      run: async () => ({ lat: 39.5, lng: -119.8, confidence: 'low', match_type: 'census_onelineaddress', precision: 'approximate' }),
    };
    const h = harness([census]);
    const r = await resolveResourceAddress(h.ports, { address: ADDR });
    expect(r.coordinate_source).toBe('census');
    expect(r.geocode_provider).toBe('census');
    expect(r.confidence).toBe('low');
    expect(r.match_type).toBe('census_onelineaddress');
    expect(r.review_required).toBe(true);
  });

  it('10b. access_notes tagging is retained for downstream UI', () => {
    expect(successBranch).toContain('access_notes: tag');
  });

  it('10c. bulk failure stamps the record but writes no cache row', async () => {
    const h = harness([googleDown]);
    const r = await resolveResourceAddress(h.ports, { address: ADDR });
    expect(r.resolved).toBe(false);
    expect(h.rows.size).toBe(0);
    expect(BULK_FN).toContain("coordinate_source: 'failed'");
  });
});

/* ───────────── 11. low-confidence review must actually work ───────────── */

describe('Admin Geocode Review eligibility', () => {
  it('11. low-confidence nominatim / census / internal_cache results stay reviewable', () => {
    const filter = REVIEW_PAGE.slice(
      REVIEW_PAGE.indexOf('const REVIEW_OR_FILTER'),
      REVIEW_PAGE.indexOf('const confidenceLabel'),
    );
    for (const src of ['google', 'nominatim', 'census', 'internal_cache']) {
      expect(filter).toContain(src);
    }
    for (const conf of ['geometric', 'approximate', 'low']) {
      expect(filter).toContain(conf);
    }
    expect(filter).toContain('coordinate_source.eq.failed');
  });

  it('11b. explanatory copy no longer claims the queue is Google-only', () => {
    expect(REVIEW_PAGE).not.toMatch(/failed Google geocoding results/);
  });
});

/* ───────────── 12-16. no destructive coordinate clearing ───────────── */

describe('Geocode Static Data is non-destructive', () => {
  const handler = SERVICES_PAGE.slice(
    SERVICES_PAGE.indexOf('const handleGeocodeStaticData'),
    SERVICES_PAGE.indexOf('const handleGeocodeUnresolved'),
  );

  it('12. locked/valid facility coordinates are not cleared', () => {
    expect(handler).not.toMatch(/from\('facilities'\)[\s\S]*?update\(\{[^}]*lat:\s*null/);
  });

  it('13. locked/valid rural-service coordinates are not cleared', () => {
    expect(handler).not.toMatch(/from\('rural_services'\)[\s\S]*?update\(\{[^}]*lat:\s*null/);
  });

  it('14. manual coordinate columns are never touched by preparation', () => {
    expect(handler).not.toMatch(/manual_lat/);
    expect(handler).not.toMatch(/manual_lng/);
    expect(handler).not.toMatch(/coordinate_locked:/);
  });

  it('15. no global coordinate erase remains anywhere in the handler', () => {
    expect(handler).not.toMatch(/lat:\s*null/);
    expect(handler).not.toMatch(/lng:\s*null/);
    // Eligibility is now a read-only count of records already missing coords.
    expect(handler).toContain(".is('lat', null)");
    expect(handler).toContain("count: 'exact', head: true");
  });

  it('16. access_notes are not globally erased as preparation', () => {
    expect(handler).not.toMatch(/access_notes:\s*null/);
  });

  it('16b. server-side lock protection still governs display columns', () => {
    expect(BULK_FN).toContain('if (!row.coordinate_locked)');
    expect(ADDRESS_FN).toContain('if (!record.coordinate_locked)');
  });
});
