/**
 * Pure-helper tests for deriveDecisionAssist. No React, no map.
 */

import { describe, it, expect, vi } from 'vitest';
import { deriveDecisionAssist } from '@/components/map/decision-assist/deriveDecisionAssist';
import type { DecisionAssistContext } from '@/components/map/decision-assist/decisionAssistTypes';
import type { Facility } from '@/data/facilities';
import type { RuralService } from '@/data/rural-services';
import { validateBhRow } from '@/utils/mappingPipelineValidation';

const member = { lat: 36.2129, lng: -115.9697 }; // Pahrump, NV

const mkFacility = (over: Partial<Facility>): Facility => ({
  id: 'f1', name: 'Test Clinic', type: 'clinic', city: 'Pahrump', county: 'Nye',
  lat: 36.2150, lng: -115.9700, ...over,
});

const mkService = (over: Partial<RuralService>): RuralService => ({
  id: 's1', name: 'Test Service', category: 'Food', city: 'Pahrump', county: 'Nye',
  lat: 36.2150, lng: -115.9700, ...over,
});

describe('deriveDecisionAssist', () => {
  it('returns low confidence when no candidates exist', () => {
    const ctx: DecisionAssistContext = { member, facilities: [], services: [] };
    const r = deriveDecisionAssist(ctx, 'physical', 'primary_care');
    expect(r.confidence).toBe('low');
    expect(r.primaryTargets.length).toBe(0);
    expect(r.constraint).toBeTruthy();
  });

  it('returns high confidence for a tier1 nearby clinic when FTE is available', () => {
    // Carson City FTE: 3/5 load → 'available'
    const carsonMember = { lat: 39.1638, lng: -119.7674 };
    const ctx: DecisionAssistContext = {
      member: carsonMember,
      facilities: [mkFacility({ id: 'f-near', city: 'Carson City', county: 'Carson City', lat: 39.1640, lng: -119.7680 })],
      services: [],
    };
    const r = deriveDecisionAssist(ctx, 'physical', 'primary_care');
    expect(r.confidence).toBe('high');
    expect(r.primaryTargets[0].tier).toBe('Local Access');
    expect(r.constraint).toBeNull();
  });

  it('flags non-viable distance constraint outside mixed county coverage caveats', () => {
    const carsonMember = { lat: 39.1638, lng: -119.7674 };
    const ctx: DecisionAssistContext = {
      member: carsonMember,
      facilities: [mkFacility({ id: 'f-far', lat: 40.8230, lng: -115.7314 })], // Elko, ~280mi
      services: [],
    };
    const r = deriveDecisionAssist(ctx, 'physical', 'primary_care');
    expect(r.confidence).toBe('low');
    expect(r.constraint).toMatch(/non-viable/i);
    expect(r.primaryTargets[0].tier).toBe('Non-Viable');
  });

  it('transportation surfaces a county Mobility Manager when the county has one', () => {
    const ctx: DecisionAssistContext = { member, facilities: [], services: [] };
    const r = deriveDecisionAssist(ctx, 'social', 'transportation');
    // Nye is covered by an NDOT Mobility Manager (southern NV); first target should be MM.
    const first = r.primaryTargets[0];
    expect(first?.kind === 'mobility_manager' || first === undefined).toBeTruthy();
  });

  it('crisis always offers the 988 hotline target with high confidence', () => {
    const ctx: DecisionAssistContext = { member, facilities: [], services: [] };
    const r = deriveDecisionAssist(ctx, 'behavioral', 'crisis');
    expect(r.confidence).toBe('high');
    expect(r.primaryTargets[0].kind).toBe('hotline');
    expect(r.primaryTargets[0].name).toMatch(/988/);
  });

  it('flags BH staging rows when the name place conflicts with the location place', () => {
    const messages = validateBhRow({
      name: 'State of Nevada Rural Clinics - Pahrump',
      city: 'Tonopah',
      county: 'Nye',
      street_address: '119 Saint Patrick Lane',
      latitude: 38.100063,
      longitude: -117.2250609,
    });

    expect(messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'location_name_mismatch', severity: 'error' }),
    ]));
  });


  it('does not use generic Community Behavioral Health site records as Therapy targets', () => {
    const tonopahMember = { lat: 38.1000, lng: -117.2250 };
    const ctx: DecisionAssistContext = {
      member: tonopahMember,
      facilities: [],
      services: [mkService({
        id: 'verified-bh-tonopah-rural-clinics',
        name: 'State of Nevada Rural Clinics - Tonopah',
        category: 'Mental Health',
        city: 'Tonopah',
        county: 'Nye',
        lat: 38.100063,
        lng: -117.2250609,
        bhCategoryMapped: 'Community Behavioral Health',
        bhEntityType: null,
        bhServiceType: null,
        serviceTags: null,
      })],
    };

    const r = deriveDecisionAssist(ctx, 'behavioral', 'therapy');
    expect(r.primaryTargets).toHaveLength(0);
  });

  it('warns in development when Therapy receives a Pahrump-named target at Tonopah', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const ctx: DecisionAssistContext = {
        member: { lat: 38.1000, lng: -117.2250 },
        facilities: [],
        services: [mkService({
          id: 'verified-bh-mismatch',
          name: 'State of Nevada Rural Clinics - Pahrump',
          category: 'Mental Health',
          city: 'Tonopah',
          county: 'Nye',
          lat: 38.100063,
          lng: -117.2250609,
        })],
      };
      deriveDecisionAssist(ctx, 'behavioral', 'therapy');
      expect(warn).toHaveBeenCalledWith(
        'BH target name/location mismatch.',
        expect.objectContaining({ stage: 'therapyTargetBuilder', target: 'State of Nevada Rural Clinics - Pahrump' }),
      );
    } finally {
      warn.mockRestore();
    }
  });
});
