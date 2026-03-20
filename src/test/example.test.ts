import { describe, expect, it } from 'vitest';
import { getCountyEngagementMetrics, getFilteredEngagementPriorityCounties, getTopUnengagedCounties } from '@/utils/utilizationAggregation';

describe('county engagement priority metrics', () => {
  it('calculates county engagement metrics from baseline datasets', () => {
    const lyon = getCountyEngagementMetrics('Lyon');

    expect(lyon.totalMembers).toBe(5285);
    expect(lyon.engagedMembers).toBe(771);
    expect(lyon.unengagedMembers).toBe(4514);
    expect(lyon.engagementRate).toBeCloseTo(771 / 5285, 5);
  });

  it('ranks counties by highest unengaged members with engagement rate as tie-breaker', () => {
    const topFive = getTopUnengagedCounties(5).map((county) => county.county);

    expect(topFive).toEqual(['Nye', 'Lyon', 'Carson City', 'Elko', 'Clark']);
  });

  it('filters outreach priorities to counties below the engagement-rate threshold', () => {
    const belowTwentyPercent = getFilteredEngagementPriorityCounties({ belowRateThreshold: 0.2 });

    expect(belowTwentyPercent.length).toBeGreaterThan(0);
    expect(belowTwentyPercent.every((county) => county.engagementRate < 0.2)).toBe(true);
    expect(belowTwentyPercent.some((county) => county.county === 'Lyon')).toBe(true);
    expect(belowTwentyPercent.some((county) => county.county === 'Nye')).toBe(false);
  });
});
