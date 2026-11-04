/**
 * Independent edition: guardrails against inherited NBH/SSHP operational claims.
 * These assertions do not establish database or distribution safety.
 */
import { describe, it, expect } from 'vitest';
import { fteCapacityData } from '@/data/fte-capacity';
import { defaultFacilities } from '@/data/facilities';
import { memberVolumeData } from '@/data/member-volume';
import { engagedMemberVolumeData } from '@/data/engaged-member-volume';
import { providerUtilizationData } from '@/data/provider-utilization';
import { loadUtilizationDataset } from '@/data/utilization';
import { existsSync } from 'node:fs';
import { getEngagementOwnership } from '@/utils/engagementOwnership';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('independent implementation — staffing and payer isolation', () => {
  it('retains previously listed clinic location pins without claims ranking attributes', () => {
    const formerRankedClinics = defaultFacilities.filter(f => /^t\\d+$/.test(f.id));
    expect(formerRankedClinics).toHaveLength(15);
    expect(formerRankedClinics.every(f => Number.isFinite(f.lat) && Number.isFinite(f.lng))).toBe(true);
    expect(defaultFacilities.every(f => f.volume === undefined && f.tier !== 'tier1')).toBe(true);
  });
  it('ships no payer member, engagement or provider claims rows', () => {
    expect(memberVolumeData).toEqual([]);
    expect(engagedMemberVolumeData).toEqual([]);
    expect(providerUtilizationData).toEqual([]);
  });

  it('returns no payer dataset records from the utilization loader', async () => {
    const data = await loadUtilizationDataset();
    expect(data.zipDemand).toEqual([]);
    expect(data.countyGap).toEqual([]);
    expect(data.providerUtil).toEqual([]);
    expect(data.tribal).toEqual([]);
    expect(data.zipRollup).toEqual([]);
  });

  it('contains no published legacy utilization JSON assets', () => {
    for (const file of ['zip_member_demand.json', 'county_gap_summary.json', 'provider_util_flat.json', 'tribal_provider_summary.json', 'zip_provider_rollup.json']) {
      expect(existsSync(resolve(__dirname, '../../public/data/utilization', file))).toBe(false);
    }
  });
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
