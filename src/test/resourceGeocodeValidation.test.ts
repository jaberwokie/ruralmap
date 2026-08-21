/**
 * Phase 2D.1 — resource geocoding validation + legacy dry-run closure.
 *
 * Covers:
 *   - deterministic street-identity comparison (§2)
 *   - Census validation now requiring physical street identity (§2)
 *   - one shared eligibility/protection contract (§3)
 *   - superseded legacy provenance preservation (§4)
 *   - combined, read-only dry-run guarantees (§6-§12)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  parseStreet,
  compareStreetIdentity,
} from '../../supabase/functions/_shared/streetIdentity.ts';
import {
  validateCensusMatch,
  type CensusMatch,
} from '../../supabase/functions/_shared/censusResourceGeocoder.ts';
import { evaluateResourceEligibility } from '../../supabase/functions/_shared/resourceEligibility.ts';
import {
  buildSupersededMetadata,
  MAX_SUPERSESSION_HISTORY,
} from '../../supabase/functions/_shared/resourceCachePorts.ts';
import { getResourceTableContract } from '../../supabase/functions/_shared/resourceTableContracts.ts';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
const bulkSrc = read('supabase/functions/geocode-bulk/index.ts');
const singleSrc = read('supabase/functions/geocode-address/index.ts');

const match = (over: Partial<CensusMatch> = {}): CensusMatch => ({
  lat: 39.1638,
  lng: -119.7674,
  matchedAddress: '1000 E WILLIAM ST, CARSON CITY, NV, 89701',
  matchedState: 'NV',
  matchedZip: '89701',
  ...over,
} as CensusMatch);

// ── §2 street identity parsing ───────────────────────────────────────────────
describe('Phase 2D.1 §2 — street identity parsing', () => {
  it('extracts the house number', () => {
    expect(parseStreet('1000 E William St').houseNumber).toBe('1000');
  });

  it('expands street type aliases', () => {
    expect(parseStreet('1000 William St').streetType).toBe('street');
    expect(parseStreet('1000 William Street').streetType).toBe('street');
  });

  it('expands directional aliases at the edges', () => {
    expect(parseStreet('1000 E William St').directionals).toContain('east');
  });

  it('strips unit/suite noise', () => {
    expect(parseStreet('1000 William St Suite 200').core).toEqual(['william']);
  });

  it('ignores the city/state tail after the first comma', () => {
    expect(parseStreet('1000 William St, Carson City, NV').core).toEqual(['william']);
  });

  it('returns empty parse for blank input', () => {
    expect(parseStreet('').core).toEqual([]);
    expect(parseStreet(null).houseNumber).toBeNull();
  });

  it('keeps numbered highways as name tokens', () => {
    expect(parseStreet('100 Highway 50').core).toContain('highway');
  });
});

describe('Phase 2D.1 §2 — street identity comparison', () => {
  it('matches identical streets', () => {
    expect(compareStreetIdentity('1000 E William St', '1000 E WILLIAM ST, CARSON CITY, NV, 89701').verdict)
      .toBe('match');
  });

  it('matches across street-type abbreviation differences', () => {
    expect(compareStreetIdentity('1000 William Street', '1000 WILLIAM ST, NV').verdict).toBe('match');
  });

  it('rejects a different house number on the same street', () => {
    const r = compareStreetIdentity('1000 William St', '2000 WILLIAM ST, NV');
    expect(r.verdict).toBe('mismatch');
    expect(r.house_number_match).toBe(false);
  });

  it('rejects a completely different street in the same ZIP', () => {
    expect(compareStreetIdentity('1000 William St', '1000 CARSON ST, NV').verdict).toBe('mismatch');
  });

  it('reports insufficient evidence when the matched street is unavailable', () => {
    const r = compareStreetIdentity('1000 William St', '');
    expect(r.verdict).toBe('insufficient_evidence');
    expect(r.reason).toBe('matched_street_name_unavailable');
  });

  it('reports insufficient evidence when the source street is unavailable', () => {
    expect(compareStreetIdentity(null, '1000 WILLIAM ST').verdict).toBe('insufficient_evidence');
  });

  it('never returns a fuzzy/partial verdict value', () => {
    const verdicts = ['match', 'mismatch', 'insufficient_evidence'];
    expect(verdicts).toContain(compareStreetIdentity('1 A St', '1 B St').verdict);
  });
});

// ── §2 Census validation ─────────────────────────────────────────────────────
describe('Phase 2D.1 §2 — Census match validation requires street identity', () => {
  const source = { street_address: '1000 E William St', city: 'Carson City', state: 'NV', zip: '89701' };

  it('accepts a true street match', () => {
    const v = validateCensusMatch(source, match());
    expect(v.validation_status).toBe('accepted');
    expect(v.street_name_match).toBe(true);
  });

  it('rejects a same-ZIP unrelated street', () => {
    const v = validateCensusMatch(source, match({ matchedAddress: '1000 N CARSON ST, CARSON CITY, NV, 89701' }));
    expect(v.validation_status).toBe('rejected');
    expect(v.street_name_match).toBe(false);
  });

  it('rejects a house-number mismatch even with ZIP agreement', () => {
    const v = validateCensusMatch(source, match({ matchedAddress: '2500 E WILLIAM ST, CARSON CITY, NV, 89701' }));
    expect(v.validation_status).toBe('rejected');
    expect(v.house_number_match).toBe(false);
  });

  it('records the street verdict on rejection', () => {
    const v = validateCensusMatch(source, match({ matchedAddress: '1000 N CARSON ST, NV, 89701' }));
    expect(v.street_verdict).toBe('mismatch');
  });

  it('still rejects a ZIP mismatch before street comparison', () => {
    const v = validateCensusMatch(source, match({ matchedZip: '89501' }));
    expect(v.rejection_reason).toBe('zip_mismatch');
  });

  it('still rejects a state mismatch', () => {
    const v = validateCensusMatch(source, match({ matchedState: 'CA' }));
    expect(v.rejection_reason).toBe('state_mismatch');
  });

  it('still rejects a coordinate outside Nevada', () => {
    const v = validateCensusMatch(source, match({ lat: 34.05, lng: -118.24 }));
    expect(v.rejection_reason).toBe('coordinate_outside_nevada');
  });

  it('rejects a zero coordinate', () => {
    expect(validateCensusMatch(source, match({ lat: 0, lng: 0 })).rejection_reason).toBe('zero_coordinate');
  });

  it('rejects when no matched address is returned', () => {
    const v = validateCensusMatch(source, match({ matchedAddress: '' }));
    expect(v.rejection_reason).toBe('no_matched_address_returned');
  });

  it('rejects a source without street identity', () => {
    const v = validateCensusMatch({ ...source, street_address: 'Rural Route' }, match());
    expect(v.rejection_reason).toBe('source_address_lacks_street_identity');
  });

  it('exposes street evidence fields on every result', () => {
    const v = validateCensusMatch(source, match());
    expect(v).toHaveProperty('house_number_match');
    expect(v).toHaveProperty('street_name_match');
    expect(v).toHaveProperty('street_verdict');
  });
});

// ── §3 one protection contract everywhere ────────────────────────────────────
describe('Phase 2D.1 §3 — single eligibility/protection contract', () => {
  const contract = getResourceTableContract('verified_services')!;

  it('blocks soft-deleted records', () => {
    expect(evaluateResourceEligibility({ deleted_at: 'x', street_address: 'a' }, contract).reason)
      .toBe('soft_deleted');
  });

  it('blocks locked coordinates even when forced', () => {
    const r = evaluateResourceEligibility(
      { street_address: 'a', coordinate_locked: true },
      contract,
      { force: true },
    );
    expect(r.eligible).toBe(false);
    expect(r.reason).toBe('protected_manual_or_locked_coordinate');
  });

  it('blocks manual coordinates even when forced', () => {
    const r = evaluateResourceEligibility(
      { street_address: 'a', manual_lat: 39.1, manual_lng: -119.7 },
      contract,
      { force: true },
    );
    expect(r.reason).toBe('protected_manual_or_locked_coordinate');
  });

  it('blocks inactive records', () => {
    expect(evaluateResourceEligibility({ street_address: 'a', active_status: false }, contract).reason)
      .toBe('inactive_record');
  });

  it('blocks records without a street address', () => {
    expect(evaluateResourceEligibility({}, contract).reason).toBe('no_street_address');
  });

  it('skips records that already have coordinates unless forced', () => {
    const rec = { street_address: 'a', latitude: 39.1, longitude: -119.7 };
    expect(evaluateResourceEligibility(rec, contract).reason).toBe('already_has_coordinates');
    expect(evaluateResourceEligibility(rec, contract, { force: true }).eligible).toBe(true);
  });

  it('allows an eligible unresolved record', () => {
    expect(evaluateResourceEligibility({ street_address: 'a' }, contract).eligible).toBe(true);
  });

  it('is used by the single-record function', () => {
    expect(singleSrc).toMatch(/evaluateResourceEligibility/);
    expect(singleSrc).toMatch(/getResourceTableContract/);
  });

  it('is used by the bulk function', () => {
    expect(bulkSrc).toMatch(/evaluateResourceEligibility/);
  });

  it('gives the single-record path no independent lock bypass', () => {
    expect(singleSrc).not.toMatch(/force\s*&&\s*!?\s*record\.coordinate_locked/);
  });
});

// ── §4 superseded legacy provenance ──────────────────────────────────────────
describe('Phase 2D.1 §4 — superseded legacy provenance preservation', () => {
  const now = '2026-01-01T00:00:00.000Z';
  const legacy = {
    geocode_source: 'google',
    latitude: 39.1,
    longitude: -119.7,
    confidence: 'high',
    precision: 'rooftop',
    source_metadata: { note: 'keep me' },
  };

  it('records a supersession entry when replacing google', () => {
    const meta = buildSupersededMetadata(legacy, { provider: 'census' }, 'census', now);
    const hist = meta.superseded_resolution as Record<string, unknown>[];
    expect(hist).toHaveLength(1);
    expect(hist[0].previous_provider).toBe('google');
  });

  it('stores previous coordinates', () => {
    const hist = buildSupersededMetadata(legacy, {}, 'census', now)
      .superseded_resolution as Record<string, unknown>[];
    expect(hist[0].previous_latitude).toBe(39.1);
    expect(hist[0].previous_longitude).toBe(-119.7);
  });

  it('retains unrelated existing metadata keys', () => {
    expect(buildSupersededMetadata(legacy, {}, 'census', now).note).toBe('keep me');
  });

  it('lets incoming metadata win for current authority', () => {
    expect(buildSupersededMetadata(legacy, { note: 'new' }, 'census', now).note).toBe('new');
  });

  it('records nominatim supersession too', () => {
    const hist = buildSupersededMetadata({ ...legacy, geocode_source: 'nominatim' }, {}, 'census', now)
      .superseded_resolution as Record<string, unknown>[];
    expect(hist[0].previous_provider).toBe('nominatim');
  });

  it('does not add history for a non-legacy update', () => {
    const meta = buildSupersededMetadata({ geocode_source: 'census' }, {}, 'census', now);
    expect(meta.superseded_resolution).toBeUndefined();
  });

  it('never destroys earlier history on unrelated updates', () => {
    const prior = { source_metadata: { superseded_resolution: [{ previous_provider: 'google' }] }, geocode_source: 'census' };
    const meta = buildSupersededMetadata(prior, {}, 'census', now);
    expect((meta.superseded_resolution as unknown[]).length).toBe(1);
  });

  it('bounds history growth', () => {
    let existing: Record<string, unknown> = { ...legacy };
    for (let i = 0; i < MAX_SUPERSESSION_HISTORY + 3; i++) {
      const meta = buildSupersededMetadata(existing as never, {}, 'census', now);
      existing = { ...legacy, source_metadata: meta };
    }
    const final = buildSupersededMetadata(existing as never, {}, 'census', now);
    expect((final.superseded_resolution as unknown[]).length).toBeLessThanOrEqual(MAX_SUPERSESSION_HISTORY);
  });

  it('is applied on cache upsert', () => {
    const ports = read('supabase/functions/_shared/resourceCachePorts.ts');
    expect(ports).toMatch(/buildSupersededMetadata\(/);
  });
});

// ── §5 record-level legacy history ───────────────────────────────────────────
describe('Phase 2D.1 §5 — record-level legacy transition history', () => {
  it('bulk audit records previous and new provider', () => {
    expect(bulkSrc).toMatch(/previous_provider/);
    expect(bulkSrc).toMatch(/new_provider/);
  });

  it('bulk audit records the coordinate movement distance', () => {
    expect(bulkSrc).toMatch(/distance_meters/);
  });

  it('bulk audit flags legacy provider supersession', () => {
    expect(bulkSrc).toMatch(/legacy_provider_superseded/);
  });

  it('single-record audit flags legacy provider supersession', () => {
    expect(singleSrc).toMatch(/legacy_provider_superseded/);
  });
});

// ── §6-§12 combined read-only dry-run ────────────────────────────────────────
describe('Phase 2D.1 §6-§12 — combined dry-run', () => {
  it('uses the cache canonical identity, not raw address text', () => {
    expect(bulkSrc).toMatch(/const assembled = buildResourceAddress/);
    expect(bulkSrc).toMatch(/canonicalizeAddress\(assembled\)\.canonical/);
  });

  it('groups records by canonical identity across tables', () => {
    expect(bulkSrc).toMatch(/groups\.set\(identity/);
  });

  it('defaults to every supported resource table', () => {
    expect(bulkSrc).toMatch(/:\s*RESOURCE_TABLES;/);
  });

  it('reports every record sharing an address', () => {
    expect(bulkSrc).toMatch(/for \(const ref of g\.refs\)/);
  });

  it('reports distinct counters rather than record counts as addresses', () => {
    expect(bulkSrc).toMatch(/unique_canonical_legacy_addresses/);
    expect(bulkSrc).toMatch(/records_compared/);
    expect(bulkSrc).toMatch(/records_without_deterministic_address_identity/);
  });

  it('reports factual distance distribution and buckets', () => {
    expect(bulkSrc).toMatch(/distance_distribution/);
    expect(bulkSrc).toMatch(/buckets\[bucketDistance\(d\)\]/);
  });

  it('reports per-table inventory', () => {
    expect(bulkSrc).toMatch(/per_table/);
  });

  it('marks itself read-only and unmutated', () => {
    expect(bulkSrc).toMatch(/read_only: true/);
    expect(bulkSrc).toMatch(/mutated: false/);
  });

  it('never upserts or touches the cache in the dry-run path', () => {
    const start = bulkSrc.indexOf('const runCombinedDryRun');
    const body = bulkSrc.slice(start);
    expect(body).not.toMatch(/\.upsert\(/);
    expect(body).not.toMatch(/cache\.touch\(/);
    expect(body).not.toMatch(/\.update\(/);
  });

  it('slices deterministically without changing grouping', () => {
    expect(bulkSrc).toMatch(/orderedIdentities/);
    expect(bulkSrc).toMatch(/slice_offset/);
    expect(bulkSrc).toMatch(/next_offset/);
  });

  it('classifies existing provenance for each compared record', () => {
    expect(bulkSrc).toMatch(/existing_provenance_class/);
  });

  it('documents that HMAC-keyed cache rows cannot be revalidated alone', () => {
    expect(bulkSrc).toMatch(/cache_revalidation_note/);
  });

  it('exposes a combined client entry point', () => {
    const client = read('src/utils/resourceGeocodeClient.ts');
    expect(client).toMatch(/runCombinedLegacyDryRun/);
  });
});
