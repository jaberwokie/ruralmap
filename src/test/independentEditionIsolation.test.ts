/**
 * Independent edition: guardrails against inherited NBH/SSHP operational claims.
 * These assertions do not establish database or distribution safety.
 */
import { describe, it, expect } from 'vitest';
import { fteCapacityData } from '@/data/fte-capacity';
import { getEngagementOwnership } from '@/utils/engagementOwnership';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('independent implementation — staffing and payer isolation', () => {
  it('has no inherited NBH staffing assignments', () => {
    expect(fteCapacityData).toEqual([]);
  });

  it('does not assert remote or in-person coverage for any county', () => {
    for (const county of ['Carson City', 'Nye', 'Mineral', 'Elko']) {
      const state = getEngagementOwnership(county, { lat: 39.16204, lng: -119.75747 });
      expect(state.inPersonAvailable).toBe(false);
      expect(state.telehealthAvailable).toBe(false);
      expect(state.ownershipType).toBe('none');
    }
  });

  it('does not depend on payer-specific source data in the Decision Assistant', () => {
    const src = readFileSync(resolve(__dirname, '../components/map/decision-assist/deriveDecisionAssist.ts'), 'utf8');
    expect(src).not.toMatch(/sshpCatchments|SilverSummit|payerPathwayContext|NBH coordination/);
    expect(src).not.toMatch(/computeFieldResponseStrain|getFTEForCounty|fteLoad/);
  });

  it('does not render the SSHP catchment layer', () => {
    const src = readFileSync(resolve(__dirname, '../components/map/MapView.tsx'), 'utf8');
    expect(src).not.toMatch(/sshpCatchments|SSHP_CATEGORY_COLOR|getValidSshpRoutes/);
  });
});
