/**
 * Phase 2D.1 final closure — real force semantics for single-record
 * `geocode-address`, and correct caller intent classification.
 *
 * Non-force = new record / background enrichment (never replaces existing
 * coordinates). Force = the address deliberately changed, or an operator asked
 * for a re-geocode. Manual / locked coordinates are protected either way.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { evaluateResourceEligibility } from '../../supabase/functions/_shared/resourceEligibility.ts';
import { getResourceTableContract } from '../../supabase/functions/_shared/resourceTableContracts.ts';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
const singleSrc = read('supabase/functions/geocode-address/index.ts');
const triggerSrc = read('src/utils/triggerGeocode.ts');
const facilityStoreSrc = read('src/utils/mappingPipelineStore.ts');
const providerStoreSrc = read('src/utils/providerStagingStore.ts');
const reviewSrc = read('src/pages/AdminGeocodeReview.tsx');

const facilities = getResourceTableContract('facilities')!;
const stagingProviders = getResourceTableContract('staging_providers')!;

const facilityRecord = (over: Record<string, unknown> = {}) => ({
  street_address: '1000 E William St',
  city: 'Carson City',
  state: 'NV',
  lat: 39.1638,
  lng: -119.7674,
  coordinate_locked: false,
  mappable: true,
  ...over,
});

const providerRecord = (over: Record<string, unknown> = {}) => ({
  street_address: '900 S Stewart St',
  state: 'NV',
  latitude: 39.16,
  longitude: -119.76,
  coordinate_locked: false,
  active_status: true,
  ...over,
});

describe('§1 geocode-address uses the real request force flag', () => {
  it('1. non-force + existing coordinate → skipped as already_has_coordinates', () => {
    const gate = evaluateResourceEligibility(facilityRecord(), facilities, { force: false });
    expect(gate.eligible).toBe(false);
    expect(gate.reason).toBe('already_has_coordinates');
  });

  it('2. non-force + existing coordinate → zero Census calls (skip returns before resolution)', () => {
    // The eligibility gate runs before the HMAC secret, the cache and Census.
    const gateIdx = singleSrc.indexOf('evaluateResourceEligibility');
    const secretIdx = singleSrc.indexOf('GEOCODE_CACHE_HMAC_SECRET');
    const resolveIdx = singleSrc.indexOf('resolveResourceAddress(');
    expect(gateIdx).toBeGreaterThan(-1);
    expect(gateIdx).toBeLessThan(secretIdx);
    expect(gateIdx).toBeLessThan(resolveIdx);
    // And the gate short-circuits with a skip response.
    expect(singleSrc).toContain('if (!gate.eligible)');
    expect(singleSrc).toMatch(/if \(!gate\.eligible\)[\s\S]{0,400}skipped: true/);
  });

  it('3. non-force skip does not mutate provenance (no update before the skip return)', () => {
    const gateIdx = singleSrc.indexOf('if (!gate.eligible)');
    const skipReturnEnd = singleSrc.indexOf('const addressParts', gateIdx);
    const beforeSkip = singleSrc.slice(0, skipReturnEnd);
    expect(beforeSkip).not.toMatch(/\.update\(/);
    expect(beforeSkip).not.toContain("coordinate_source: 'failed'");
    expect(beforeSkip).not.toContain('last_geocoded_at');
  });

  it('3b. the unconditional force bypass is gone', () => {
    expect(singleSrc).toContain('evaluateResourceEligibility(record, contract, { force: !!force })');
    expect(singleSrc).not.toContain('allowExistingCoordinates: true');
    expect(singleSrc).not.toMatch(/evaluateResourceEligibility\([^)]*\{\s*\n\s*force: true,/);
  });

  it('7. force=true + automated coordinate is eligible for re-resolution', () => {
    const gate = evaluateResourceEligibility(
      facilityRecord({ coordinate_source: 'census', geocode_provider: 'census' }),
      facilities,
      { force: true },
    );
    expect(gate.eligible).toBe(true);
  });

  it('8. force=true + manual coordinate remains protected', () => {
    const gate = evaluateResourceEligibility(
      facilityRecord({ manual_lat: 39.2, manual_lng: -119.8, coordinate_source: 'manual' }),
      facilities,
      { force: true },
    );
    expect(gate.eligible).toBe(false);
    expect(gate.reason).toBe('protected_manual_or_locked_coordinate');
  });

  it('9. force=true + coordinate_locked remains protected', () => {
    const gate = evaluateResourceEligibility(
      facilityRecord({ coordinate_locked: true }),
      facilities,
      { force: true },
    );
    expect(gate.eligible).toBe(false);
    expect(gate.reason).toBe('protected_manual_or_locked_coordinate');
  });

  it('9b. force never bypasses soft delete, inactive or non-mappable', () => {
    expect(
      evaluateResourceEligibility(facilityRecord({ deleted_at: '2026-01-01' }), facilities, { force: true }).reason,
    ).toBe('soft_deleted');
    expect(
      evaluateResourceEligibility(facilityRecord({ mappable: false }), facilities, { force: true }).reason,
    ).toBe('list_only_not_mappable');
    expect(
      evaluateResourceEligibility(providerRecord({ active_status: false }), stagingProviders, { force: true }).reason,
    ).toBe('inactive_record');
  });

  it('10. missing-coordinate new record still geocodes normally without force', () => {
    const gate = evaluateResourceEligibility(
      facilityRecord({ lat: null, lng: null }),
      facilities,
      { force: false },
    );
    expect(gate.eligible).toBe(true);
    const provider = evaluateResourceEligibility(
      providerRecord({ latitude: null, longitude: null }),
      stagingProviders,
      { force: false },
    );
    expect(provider.eligible).toBe(true);
  });
});

describe('§2/§3 caller intent', () => {
  it('trigger helper defaults to non-force and only sends force when asked', () => {
    expect(triggerSrc).toContain('opts: { force?: boolean } = {}');
    expect(triggerSrc).toContain("force ? { table, id, force: true } : { table, id }");
  });

  it('6. address-change workflows invoke force=true', () => {
    // editFacilityRecord
    expect(facilityStoreSrc).toMatch(
      /hasOwnProperty\.call\(changes, 'street_address'\)[\s\S]{0,200}triggerGeocodeAddress\('facilities', id, \{ force: true \}\)/,
    );
    // editProviderStaging
    expect(providerStoreSrc).toMatch(
      /hasOwnProperty\.call\(changes, 'street_address'\)[\s\S]{0,200}triggerGeocodeAddress\('staging_providers', id, \{ force: true \}\)/,
    );
  });

  it('4. imported staging providers are enriched non-force', () => {
    expect(providerStoreSrc).toContain("triggerGeocodeAddress('staging_providers', row.id);");
    expect(providerStoreSrc).not.toContain("triggerGeocodeAddress('staging_providers', row.id, { force: true })");
    // Non-force + coordinates present → skipped, so imported coordinates survive.
    const imported = evaluateResourceEligibility(providerRecord(), stagingProviders, { force: false });
    expect(imported.reason).toBe('already_has_coordinates');
  });

  it('5. promoted facilities are enriched non-force and keep carried-over coordinates', () => {
    expect(facilityStoreSrc).toContain("triggerGeocodeAddress('facilities', liveId);");
    expect(facilityStoreSrc).not.toContain("triggerGeocodeAddress('facilities', liveId, { force: true })");
    const promoted = evaluateResourceEligibility(facilityRecord(), facilities, { force: false });
    expect(promoted.reason).toBe('already_has_coordinates');
  });

  it('force is never inferred for unrelated edits', () => {
    const forceCalls = [...facilityStoreSrc.matchAll(/triggerGeocodeAddress\([^)]*force: true[^)]*\)/g)];
    expect(forceCalls).toHaveLength(1);
    const providerForceCalls = [...providerStoreSrc.matchAll(/triggerGeocodeAddress\([^)]*force: true[^)]*\)/g)];
    expect(providerForceCalls).toHaveLength(1);
  });
});

describe('§5 Geocode Review copy reflects the active provider', () => {
  it('does not describe Google or Nominatim as currently approved providers', () => {
    expect(reviewSrc).not.toMatch(/approved (resource )?provider[s]? \(Google/i);
    expect(reviewSrc).not.toMatch(/any approved provider \(Google, Nominatim, Census\)/i);
    expect(reviewSrc).toMatch(/Census is the active external provider/i);
    expect(reviewSrc).toMatch(/retired/i);
  });

  it('still keeps legacy provenance reviewable in the filter', () => {
    expect(reviewSrc).toContain('coordinate_source.in.(google,nominatim,census,internal_cache)');
  });
});
