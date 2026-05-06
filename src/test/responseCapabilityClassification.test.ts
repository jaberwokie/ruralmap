import { describe, expect, it } from 'vitest';
import { driveMinutesToKm, getCountyCoverageBreakdown } from '@/utils/coverageZones';

describe('response capability county classification', () => {
  it('does not classify Churchill as field response available', () => {
    const breakdown = getCountyCoverageBreakdown('Churchill', driveMinutesToKm(90));

    expect(breakdown.primaryType).toBe('remote');
  });
});