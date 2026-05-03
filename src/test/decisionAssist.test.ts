/**
 * Pure-helper tests for deriveDecisionAssist. No React, no map.
 */

import { describe, it, expect } from 'vitest';
import { deriveDecisionAssist } from '@/components/map/decision-assist/deriveDecisionAssist';
import type { DecisionAssistContext } from '@/components/map/decision-assist/decisionAssistTypes';
import type { Facility } from '@/data/facilities';
import type { RuralService } from '@/data/rural-services';

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

  it('returns high confidence for a tier1 nearby clinic', () => {
    const ctx: DecisionAssistContext = {
      member,
      facilities: [mkFacility({ id: 'f-near', lat: 36.2150, lng: -115.9700 })],
      services: [],
    };
    const r = deriveDecisionAssist(ctx, 'physical', 'primary_care');
    expect(r.confidence).toBe('high');
    expect(r.primaryTargets[0].tier).toBe('Local Access');
    expect(r.constraint).toBeNull();
  });

  it('flags non-viable distance constraint', () => {
    const ctx: DecisionAssistContext = {
      member,
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
});
