import { describe, expect, it } from 'vitest';
import { driveMinutesToKm, getCountyCoverageBreakdown } from '@/utils/coverageZones';
import { getCountyResponseClassification } from '@/utils/fieldResponseStrain';
import { getFieldCoverageStatus } from '@/utils/fieldCoverageStatus';

describe('response capability county classification', () => {
  it('does not classify Churchill as field response available', () => {
    const radiusKm = driveMinutesToKm(90);
    const breakdown = getCountyCoverageBreakdown('Churchill', radiusKm);

    expect(breakdown.primaryType).toBe('remote');
    expect(getCountyResponseClassification('Churchill', radiusKm).level).toBe('noSameDay');
    expect(getFieldCoverageStatus('Churchill').hasFieldCoverage).toBe(false);
  });
});