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
import { resolve } from 'node:path';
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
  // Phase 2D: only `census` / `manual_verified` rows are reusable authority.
  geocode_source: 'census',
  confidence: 'low',
  precision: 'approximate',
  county_name: 'Carson City',
  county_fips: '32510',
  state: 'NV',
  postal_code: '89703',
  is_manual: false,
  is_coordinate_locked: false,
  verified_at: null,
  source_metadata: { match_type: 'census_onelineaddress' },
  ...over,
});

/**
 * Phase 2D: the approved external public-resource provider is the U.S. Census
 * Geocoder. Google is retired as an ACTIVE provider, so these ports model
 * Census availability instead.
 */
const providerOk: ResourceExternalPort = {
  name: 'census',
  run: async () => ({
    lat: 39.1, lng: -119.7, confidence: 'low',
    match_type: 'census_onelineaddress', precision: 'approximate',
  }),
};
const providerDown: ResourceExternalPort = {
  name: 'census',
  run: async () => { throw new Error('provider unavailable'); },
};

/* ───────────── 1-3. cache reuse must not depend on Google ───────────── */

describe('cache availability is independent of any provider credential', () => {
  it('1. cache hit resolves with an EMPTY provider chain (no external provider available)', async () => {
    const key = await computeResourceLookupKey(ADDR, SECRET);
    // No geocoders at all — this is exactly the shape produced when every
    // external provider is unavailable.
    const h = harness([], [cacheRow(key)]);
    const r = await resolveResourceAddress(h.ports, { address: ADDR });
    expect(r.resolved).toBe(true);
    expect(r.cache_hit).toBe(true);
    expect(r.external_calls).toBe(0);
    expect(h.calls.length).toBe(0);
    expect(r.lat).toBe(39.1638);
  });

  it('2. cache miss requires an available external provider', async () => {
    const withProvider = harness([providerOk]);
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

  it('3. geocode-address consults the internal cache before any provider', () => {
    const secretIdx = ADDRESS_FN.indexOf("Deno.env.get('GEOCODE_CACHE_HMAC_SECRET')");
    const resolveIdx = ADDRESS_FN.indexOf('resolveResourceAddress(');
    expect(secretIdx).toBeGreaterThan(-1);
    expect(resolveIdx).toBeGreaterThan(secretIdx);
    // No provider credential is a precondition of the request any more.
    expect(ADDRESS_FN).not.toMatch(/GOOGLE_GEOCODING_API_KEY not configured/);
    expect(ADDRESS_FN).not.toMatch(/apiKey \? \[googlePort\] : \[\]/);
  });

  it('3b. Google is retired as the active provider; Census is used instead', () => {
    expect(ADDRESS_FN).not.toMatch(/maps\.googleapis\.com/);
    expect(ADDRESS_FN).not.toContain("error: 'google_credentials_missing'");
    expect(ADDRESS_FN).toContain('createCensusPort');
    // No credential value can reach a response body.
    const responses = ADDRESS_FN.match(/return json\([\s\S]*?\);/g) ?? [];
    for (const r of responses) expect(r).not.toMatch(/\$\{apiKey\}|apiKey,|: apiKey/);
  });
});

/* ───────────── 4-5. force failure must not destroy the cache ───────────── */

describe('force with the provider unavailable', () => {
  it('4. failed forced refresh preserves last-known-good cache', async () => {
    const key = await computeResourceLookupKey(ADDR, SECRET);
    const h = harness([providerDown], [cacheRow(key, { confidence: 'range' })]);
    const r = await resolveResourceAddress(h.ports, { address: ADDR, force: true });
    expect(r.resolved).toBe(true);
    expect(r.lat).toBe(39.1638);
    expect(h.rows.get(key)!.latitude).toBe(39.1638);
    expect(h.rows.get(key)!.confidence).toBe('range');
    expect(h.rows.size).toBe(1);
  });

  it('5. failed force is distinguishable from a successful fresh refresh', async () => {
    const key = await computeResourceLookupKey(ADDR, SECRET);
    const failed = harness([providerDown], [cacheRow(key)]);
    const f = await resolveResourceAddress(failed.ports, { address: ADDR, force: true });
    expect(f.forced_refresh_failed).toBe(true);
    expect(f.cache_hit).toBe(true);
    expect(f.external_calls).toBe(1);

    const fresh = harness([providerOk], [cacheRow(key)]);
    const s = await resolveResourceAddress(fresh.ports, { address: ADDR, force: true });
    expect(s.forced_refresh_failed).toBe(false);
    expect(s.cache_hit).toBe(false);
    expect(s.lat).toBe(39.1);

    expect(ADDRESS_FN).toContain('forced_refresh_failed_cache_retained');
    expect(ADDRESS_FN).toContain('forced_refresh_succeeded');
  });

  it('5b. protected manual_verified authority still outranks force entirely', async () => {
    const key = await computeResourceLookupKey(ADDR, SECRET);
    const h = harness([providerOk], [cacheRow(key, {
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
  const resolvedIdx = BULK_FN.indexOf('if (resolution.resolved');
  const successBranch = BULK_FN.slice(
    resolvedIdx,
    BULK_FN.indexOf('} else {', resolvedIdx),
  );

  it('6. cache hit writes geocoded_lat / geocoded_lng', () => {
    expect(successBranch).toContain('update.geocoded_lat = resolution.lat');
    expect(successBranch).toContain('update.geocoded_lng = resolution.lng');
  });

  it('7. cache hit writes coordinate_source = internal_cache', () => {
    expect(successBranch).toContain("update.coordinate_source = resolution.cache_hit ? 'internal_cache' : resolution.geocode_provider");
  });

  it('8. cache hit preserves the ORIGINAL geocode_provider', async () => {
    expect(successBranch).toContain('update.geocode_provider = resolution.geocode_provider');
    const key = await computeResourceLookupKey(ADDR, SECRET);
    const h = harness([], [cacheRow(key, { geocode_source: 'census', confidence: 'low' })]);
    const r = await resolveResourceAddress(h.ports, { address: ADDR });
    expect(r.coordinate_source).toBe('internal_cache');
    expect(r.geocode_provider).toBe('census'); // not rewritten to internal_cache
    expect(r.confidence).toBe('low');          // never upgraded
  });

  it('9. a fresh Nominatim result carries provider / confidence / match fields', async () => {
    const nominatim: ResourceExternalPort = {
      name: 'census',
      run: async () => ({ lat: 38.9877, lng: -119.1626, confidence: 'high', match_type: 'address_full', precision: 'street' }),
    };
    const h = harness([nominatim]);
    const r = await resolveResourceAddress(h.ports, { address: ADDR });
    expect(r.coordinate_source).toBe('census');
    expect(r.geocode_provider).toBe('census');
    expect(r.confidence).toBe('high');
    expect(r.match_type).toBe('address_full');
    expect(successBranch).toContain('update.coordinate_confidence = resolution.confidence');
    expect(successBranch).toContain('update.geocode_match_type = resolution.match_type');
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
    expect(successBranch).toContain('update.access_notes = stampGeocodeTag(');
  });

  it('10c. bulk failure stamps the record but writes no cache row', async () => {
    const h = harness([providerDown]);
    const r = await resolveResourceAddress(h.ports, { address: ADDR });
    expect(r.resolved).toBe(false);
    expect(h.rows.size).toBe(0);
    expect(BULK_FN).toContain("update.coordinate_source = 'failed'");
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
    // Eligibility is now a read-only ID listing of records missing coords,
    // established once and submitted as stable explicit batches.
    expect(handler).toContain('listUnresolvedResourceIds');
    expect(handler).toContain('geocodeResourceIds');
  });

  it('16. access_notes are not globally erased as preparation', () => {
    expect(handler).not.toMatch(/access_notes:\s*null/);
  });

  it('16b. server-side lock protection still governs display columns', () => {
    // Bulk now enforces protection via the shared table contract (locks AND
    // curated manual coordinates); single-record still guards the display write.
    // Phase 2D.1 §3: BOTH functions now enforce protection through the one
    // shared eligibility contract instead of local inline checks.
    expect(BULK_FN).toContain('evaluateResourceEligibility');
    expect(ADDRESS_FN).toContain('evaluateResourceEligibility');
    const eligibility = readFileSync(
      resolve(process.cwd(), 'supabase/functions/_shared/resourceEligibility.ts'), 'utf8');
    expect(eligibility).toContain('isRecordCoordinateProtected(record, contract)');
    expect(eligibility).toContain('protected_manual_or_locked_coordinate');
  });
});
