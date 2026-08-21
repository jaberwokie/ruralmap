/**
 * Phase 2D — Provider-safe resource geocoding consolidation.
 *
 * Proves:
 *   - one server-side pipeline (no browser geocoding, no open proxy)
 *   - Census is the only ACTIVE external public-resource provider
 *   - legacy Google/Nominatim cache rows are not treated as durable authority
 *   - validation rejects unverifiable matches (no reverse spot check needed)
 *   - stable ID batching, tag-only access_notes edits, manual/locked authority
 *   - member-address boundary remains untouched
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

import {
  extractCensusMatch,
  validateCensusMatch,
  createCensusPort,
  hasStreetIdentity,
  CENSUS_PROVENANCE,
  CENSUS_BENCHMARK,
  geodesicMeters,
} from '../../supabase/functions/_shared/censusResourceGeocoder.ts';
import {
  RESOURCE_TABLES,
  getResourceTableContract,
  isRecordCoordinateProtected,
} from '../../supabase/functions/_shared/resourceTableContracts.ts';
import {
  classifyResourceCacheSource,
  resolveResourceAddress,
  buildResourceAddress,
  type ResourceCachePorts,
  type ResourceCacheRow,
} from '../../supabase/functions/_shared/resourceGeocodeCache.ts';
import { stampGeocodeTag, stripGeocodeTag, parseGeocodeTag } from '../utils/geocodeTags';

const read = (p: string) => readFileSync(p, 'utf8');

const BULK_FN = read('supabase/functions/geocode-bulk/index.ts');
const ADDRESS_FN = read('supabase/functions/geocode-address/index.ts');
const CENSUS_PROXY = read('supabase/functions/census-geocode/index.ts');
const BROWSER_GEOCODE = read('src/utils/serviceGeocode.ts');
const MEMBER_RESOLVER = read('supabase/functions/resolve-address/index.ts');
const MEMBER_HOOK = read('src/hooks/useMemberAccess.ts');
const CLIENT = read('src/utils/resourceGeocodeClient.ts');
const STORE = read('src/utils/mappingPipelineStore.ts');
const PROVIDER_STORE = read('src/utils/providerStagingStore.ts');

const NV = { lat: 39.5296, lng: -119.8138 };

const censusPayload = (over: Record<string, unknown> = {}) => ({
  result: {
    addressMatches: [
      {
        matchedAddress: '1000 W MOANA LN, RENO, NV, 89509',
        coordinates: { x: NV.lng, y: NV.lat },
        addressComponents: { state: 'NV', zip: '89509' },
        ...over,
      },
    ],
  },
});

const SOURCE = {
  street_address: '1000 W Moana Ln',
  city: 'Reno',
  state: 'NV',
  zip: '89509',
};

const makePorts = (
  rows: Map<string, ResourceCacheRow>,
  geocoders: ResourceCachePorts['geocoders'],
): ResourceCachePorts & { upserts: ResourceCacheRow[]; touches: string[] } => {
  const upserts: ResourceCacheRow[] = [];
  const touches: string[] = [];
  return {
    secret: 'test-secret',
    upserts,
    touches,
    lookup: async (k) => rows.get(k) ?? null,
    upsert: async (r) => { upserts.push(r); rows.set(r.lookup_key, r); },
    touch: async (k) => { touches.push(k); },
    geocoders,
    now: () => '2026-01-01T00:00:00.000Z',
  };
};

const cacheRow = (over: Partial<ResourceCacheRow>): ResourceCacheRow => ({
  lookup_key: 'k',
  location_class: 'resource_address',
  latitude: NV.lat,
  longitude: NV.lng,
  geocode_source: 'census',
  confidence: 'low',
  precision: 'approximate',
  county_name: 'Washoe',
  county_fips: '32031',
  state: 'NV',
  postal_code: '89509',
  is_manual: false,
  is_coordinate_locked: false,
  verified_at: null,
  source_metadata: {},
  ...over,
});

/* ────────── 1-4. No browser geocoding, no open proxy ────────── */

describe('browser geocoding is removed', () => {
  it('1. serviceGeocode makes no network calls', () => {
    expect(BROWSER_GEOCODE).not.toMatch(/fetch\(/);
    expect(BROWSER_GEOCODE).not.toMatch(/nominatim\.openstreetmap\.org/i);
    expect(BROWSER_GEOCODE).not.toMatch(/geocoding\.geo\.census\.gov/i);
    expect(BROWSER_GEOCODE).not.toMatch(/maps\.googleapis\.com/i);
  });

  it('2. no browser reverse-geocode spot check remains', () => {
    expect(BROWSER_GEOCODE).not.toMatch(/spotCheckCoordinate\s*=/);
    expect(BROWSER_GEOCODE).not.toMatch(/\/reverse/);
  });

  it('3. the only browser entry point is the authenticated edge function', () => {
    expect(CLIENT).toMatch(/functions\.invoke\('geocode-bulk'/);
    expect(CLIENT).not.toMatch(/https?:\/\//);
  });

  it('4. census-geocode standalone proxy performs no geocoding', () => {
    expect(CENSUS_PROXY).not.toMatch(/geocoding\.geo\.census\.gov/);
    expect(CENSUS_PROXY).toMatch(/410/);
    expect(CENSUS_PROXY).toMatch(/deprecated_endpoint/);
  });
});

/* ────────── 5-8. Google/Nominatim retired as active providers ────────── */

describe('active external provider is Census only', () => {
  it('5. geocode-address no longer calls Google', () => {
    expect(ADDRESS_FN).not.toMatch(/maps\.googleapis\.com/);
    expect(ADDRESS_FN).toMatch(/createCensusPort/);
  });

  it('6. geocode-bulk no longer calls Nominatim', () => {
    expect(BULK_FN).not.toMatch(/nominatim\.openstreetmap\.org/i);
  });

  it('7. geocode-bulk uses the shared validated Census port', () => {
    expect(BULK_FN).toMatch(/createCensusPort/);
  });

  it('8. Census benchmark is pinned to a documented current identifier', () => {
    expect(CENSUS_BENCHMARK).toBe('Public_AR_Current');
  });
});

/* ────────── 9-13. Legacy cache rows are not durable authority ────────── */

describe('legacy cache classification', () => {
  it('9. census and manual_verified are approved authority', () => {
    expect(classifyResourceCacheSource('census')).toBe('approved_authority');
    expect(classifyResourceCacheSource('manual_verified')).toBe('approved_authority');
  });

  it('10. google and nominatim rows are legacy', () => {
    expect(classifyResourceCacheSource('google')).toBe('legacy_google_revalidation_required');
    expect(classifyResourceCacheSource('nominatim')).toBe('legacy_nominatim_revalidation_required');
  });

  it('11. a legacy google row does not satisfy a lookup', async () => {
    const rows = new Map<string, ResourceCacheRow>();
    const ports = makePorts(rows, [
      createCensusPort({ source: SOURCE, fetchRaw: async () => censusPayload() }),
    ]);
    const address = buildResourceAddress(SOURCE);
    // Pre-seed a legacy row under the real key.
    const seed = makePorts(rows, []);
    await resolveResourceAddress(seed, { address }); // no geocoders → no write
    rows.set(
      [...rows.keys()][0] ?? 'unused',
      cacheRow({ geocode_source: 'google', confidence: 'rooftop' }),
    );

    const res = await resolveResourceAddress(ports, { address });
    expect(res.resolved).toBe(true);
    // Re-resolved externally rather than reusing the legacy coordinate.
    expect(res.external_calls).toBe(1);
    expect(res.geocode_provider).toBe('census');
  });

  it('12. an approved census row is reused with zero external calls', async () => {
    const rows = new Map<string, ResourceCacheRow>();
    const address = buildResourceAddress(SOURCE);
    const warm = makePorts(rows, [
      createCensusPort({ source: SOURCE, fetchRaw: async () => censusPayload() }),
    ]);
    const first = await resolveResourceAddress(warm, { address });
    expect(first.external_calls).toBe(1);

    const cold = makePorts(rows, [
      createCensusPort({
        source: SOURCE,
        fetchRaw: async () => { throw new Error('must not be called'); },
      }),
    ]);
    const second = await resolveResourceAddress(cold, { address });
    expect(second.cache_hit).toBe(true);
    expect(second.external_calls).toBe(0);
    expect(second.coordinate_source).toBe('internal_cache');
    expect(second.geocode_provider).toBe('census');
  });

  it('13. manual/verified authority still outranks everything', async () => {
    const rows = new Map<string, ResourceCacheRow>();
    const address = buildResourceAddress(SOURCE);
    const seed = makePorts(rows, [
      createCensusPort({ source: SOURCE, fetchRaw: async () => censusPayload() }),
    ]);
    const first = await resolveResourceAddress(seed, { address });
    const key = [...rows.keys()][0];
    rows.set(key, cacheRow({
      lookup_key: key,
      geocode_source: 'manual_verified',
      is_manual: true,
      is_coordinate_locked: true,
      confidence: 'manual',
    }));
    expect(first.resolved).toBe(true);

    const forced = makePorts(rows, [
      createCensusPort({
        source: SOURCE,
        fetchRaw: async () => { throw new Error('must not be called'); },
      }),
    ]);
    const res = await resolveResourceAddress(forced, { address, force: true });
    expect(res.external_calls).toBe(0);
    expect(res.is_coordinate_locked).toBe(true);
    expect(res.geocode_provider).toBe('manual_verified');
  });
});

/* ────────── 14-21. Server-side validation replaces spot checks ────────── */

describe('census validation', () => {
  it('14. accepts a fully corroborated Nevada match', () => {
    const d = validateCensusMatch(SOURCE, extractCensusMatch(censusPayload()));
    expect(d.validation_status).toBe('accepted');
    expect(d.state_match).toBe(true);
    expect(d.zip_match).toBe(true);
  });

  it('15. rejects a source address with no street identity', () => {
    const d = validateCensusMatch(
      { ...SOURCE, street_address: 'Reno area' },
      extractCensusMatch(censusPayload()),
    );
    expect(d.validation_status).toBe('rejected');
    expect(d.rejection_reason).toBe('source_address_lacks_street_identity');
  });

  it('16. rejects when Census returns no match', () => {
    const d = validateCensusMatch(SOURCE, extractCensusMatch({ result: { addressMatches: [] } }));
    expect(d.rejection_reason).toBe('no_census_match');
  });

  it('17. rejects coordinates outside Nevada', () => {
    const d = validateCensusMatch(
      SOURCE,
      extractCensusMatch(censusPayload({ coordinates: { x: -83.0, y: 40.0 } })),
    );
    expect(d.rejection_reason).toBe('coordinate_outside_nevada');
  });

  it('18. rejects a state mismatch', () => {
    const d = validateCensusMatch(
      SOURCE,
      extractCensusMatch(censusPayload({ addressComponents: { state: 'CA', zip: '89509' } })),
    );
    expect(d.rejection_reason).toBe('state_mismatch');
  });

  it('19. rejects a ZIP mismatch', () => {
    const d = validateCensusMatch(
      SOURCE,
      extractCensusMatch(censusPayload({ addressComponents: { state: 'NV', zip: '89701' } })),
    );
    expect(d.rejection_reason).toBe('zip_mismatch');
  });

  it('20. a rejected match yields no coordinate from the port', async () => {
    const port = createCensusPort({
      source: SOURCE,
      fetchRaw: async () => censusPayload({ addressComponents: { state: 'CA', zip: '90001' } }),
    });
    expect(await port.run('1000 W Moana Ln, Reno, NV 89509')).toBeNull();
  });

  it('21. Census provenance is never labelled rooftop', () => {
    expect(CENSUS_PROVENANCE.precision).toBe('approximate');
    expect(CENSUS_PROVENANCE.confidence).toBe('low');
    expect(CENSUS_PROVENANCE.match_type).toBe('census_onelineaddress');
  });

  it('22. street identity requires a number and a name', () => {
    expect(hasStreetIdentity('1000 W Moana Ln')).toBe(true);
    expect(hasStreetIdentity('Moana Ln')).toBe(false);
    expect(hasStreetIdentity('89509')).toBe(false);
    expect(hasStreetIdentity('')).toBe(false);
  });
});

/* ────────── 23-27. Stable ID batching ────────── */

describe('stable id batching', () => {
  it('23. the client submits explicit ids, never numeric offsets', () => {
    expect(CLIENT).toMatch(/ids: batch/);
    // Resolution requests carry ids only. The sole numeric offset in the
    // client belongs to the READ-ONLY combined dry-run slicing (Phase 2D.1 §9).
    const resolveSection = CLIENT.slice(0, CLIENT.indexOf('runCombinedLegacyDryRun'));
    expect(resolveSection).not.toMatch(/offset:/);
  });

  it('24. the server accepts an explicit id list', () => {
    expect(BULK_FN).toMatch(/ids/);
    expect(BULK_FN).toMatch(/\.in\('id'/);
  });

  it('25. the server no longer paginates by range/offset', () => {
    expect(BULK_FN).not.toMatch(/\.range\(/);
  });

  it('26. every store bulk wrapper delegates to the server pipeline', () => {
    const names = [
      'geocodeStagingServicesBulk',
      'geocodeStagingBhBulk',
      'geocodeFacilitiesBulk',
      'geocodeRuralServicesBulk',
      'geocodeStagingFacilitiesBulk',
      'geocodeStagingRuralServicesBulk',
    ];
    for (const n of names) {
      expect(STORE).toMatch(new RegExp(`export const ${n}`));
    }
    expect(STORE).toMatch(/geocodeResourceIds/);
    expect(PROVIDER_STORE).toMatch(/geocodeResourceIds/);
  });

  it('27. stores no longer import a browser geocoding engine', () => {
    expect(STORE).not.toMatch(/geocodeMany/);
    expect(STORE).not.toMatch(/spotCheckCoordinate/);
    expect(PROVIDER_STORE).not.toMatch(/geocodeMany/);
  });
});

/* ────────── 28-32. Table contracts, protection, access_notes ────────── */

describe('table contracts and record protection', () => {
  it('28. all nine resource tables are covered', () => {
    expect(RESOURCE_TABLES).toHaveLength(9);
    for (const t of [
      'facilities', 'rural_services', 'verified_services', 'verified_bh',
      'staging_services', 'staging_bh', 'staging_facilities',
      'staging_rural_services', 'staging_providers',
    ]) {
      expect(getResourceTableContract(t)).toBeTruthy();
    }
  });

  it('29. live tables use lat/lng and staging tables use latitude/longitude', () => {
    expect(getResourceTableContract('facilities')!.latColumn).toBe('lat');
    expect(getResourceTableContract('rural_services')!.lngColumn).toBe('lng');
    expect(getResourceTableContract('staging_services')!.latColumn).toBe('latitude');
    expect(getResourceTableContract('verified_bh')!.latColumn).toBe('latitude');
  });

  it('30. unknown tables are rejected', () => {
    expect(getResourceTableContract('user_roles')).toBeNull();
    expect(getResourceTableContract('auth.users')).toBeNull();
  });

  it('31. locked and manually placed records are protected', () => {
    const c = getResourceTableContract('facilities')!;
    expect(isRecordCoordinateProtected({ coordinate_locked: true }, c)).toBe(true);
    expect(isRecordCoordinateProtected({ manual_lat: 39.5, manual_lng: -119.8 }, c)).toBe(true);
    // Protection is never inferred from merely having a coordinate.
    expect(isRecordCoordinateProtected({ coordinate_locked: false, lat: 39.5, lng: -119.8 }, c)).toBe(false);
  });

  it('32. access_notes keeps human content and replaces only the geocode tag', () => {
    const human = 'Call ahead; back entrance after 5pm.';
    const stamped = stampGeocodeTag(human, 'census_onelineaddress', 'low', '2026-01-01');
    expect(stamped).toContain(human);
    expect(parseGeocodeTag(stamped)?.strategy).toBe('census_onelineaddress');

    const restamped = stampGeocodeTag(stamped, 'failed', 'low', '2026-02-01');
    expect(restamped).toContain(human);
    expect((restamped.match(/\[geocode:/g) ?? []).length).toBe(1);
    expect(stripGeocodeTag(restamped)).toBe(human);
  });

  it('33. no caller wipes access_notes or coordinates as preparation', () => {
    for (const src of [
      read('src/pages/AdminMappingServices.tsx'),
      read('src/pages/AdminMappingFacilities.tsx'),
      read('src/pages/AdminMappingRuralServices.tsx'),
    ]) {
      expect(src).not.toMatch(/access_notes:\s*null/);
      expect(src).not.toMatch(/lat:\s*null,\s*lng:\s*null/);
    }
  });
});

/* ────────── 34-38. Failure safety, security, member boundary ────────── */

describe('failure safety and boundaries', () => {
  it('34. a failed forced refresh retains last-known-good internal knowledge', async () => {
    const rows = new Map<string, ResourceCacheRow>();
    const address = buildResourceAddress(SOURCE);
    const warm = makePorts(rows, [
      createCensusPort({ source: SOURCE, fetchRaw: async () => censusPayload() }),
    ]);
    await resolveResourceAddress(warm, { address });

    const down = makePorts(rows, [
      createCensusPort({ source: SOURCE, fetchRaw: async () => null }),
    ]);
    const res = await resolveResourceAddress(down, { address, force: true });
    expect(res.resolved).toBe(true);
    expect(res.forced_refresh_failed).toBe(true);
    expect(res.lat).toBeCloseTo(NV.lat, 4);
    expect(down.upserts).toHaveLength(0);
  });

  it('35. total failure never writes a cache row', async () => {
    const rows = new Map<string, ResourceCacheRow>();
    const ports = makePorts(rows, [
      createCensusPort({ source: SOURCE, fetchRaw: async () => null }),
    ]);
    const res = await resolveResourceAddress(ports, { address: buildResourceAddress(SOURCE) });
    expect(res.resolved).toBe(false);
    expect(ports.upserts).toHaveLength(0);
    expect(res.failure).toBe('external_geocoding_unavailable');
  });

  it('36. bulk and single-record functions require an active admin/sysop role', () => {
    for (const fn of [BULK_FN, ADDRESS_FN]) {
      expect(fn).toMatch(/auth\.getUser/);
      expect(fn).toMatch(/user_roles/);
      expect(fn).toMatch(/is_active/);
      expect(fn).toMatch(/sysop/);
      expect(fn).toMatch(/403/);
    }
  });

  it('37. member-address resolution is untouched by resource geocoding', () => {
    expect(MEMBER_RESOLVER).toMatch(/member_address/);
    expect(MEMBER_RESOLVER).not.toMatch(/resourceGeocodeCache|censusResourceGeocoder/);
    expect(MEMBER_HOOK).not.toMatch(/geocode-bulk|geocode-address|resourceGeocodeClient/);
    expect(MEMBER_HOOK).toMatch(/resolve-address/);
  });

  it('38. dry-run comparison distance helper is sane', () => {
    expect(geodesicMeters(NV.lat, NV.lng, NV.lat, NV.lng)).toBeCloseTo(0, 6);
    const d = geodesicMeters(NV.lat, NV.lng, NV.lat + 0.01, NV.lng);
    expect(d).toBeGreaterThan(1000);
    expect(d).toBeLessThan(1200);
  });

  it('39. dry-run mode is read-only', () => {
    expect(BULK_FN).toMatch(/dry_run_revalidation/);
    const dry = BULK_FN.slice(BULK_FN.indexOf('const runDryRun'));
    expect(dry.slice(0, dry.indexOf('\n};'))).not.toMatch(/\.update\(/);
  });
});
