import { describe, expect, it } from 'vitest';
import { getCountyEngagementMetrics, getFilteredEngagementPriorityCounties, getTopUnengagedCounties } from '@/utils/utilizationAggregation';

describe('independent edition — no inherited member engagement numbers', () => {
  it('does not assert member engagement counts in Lyon', () => {
    const lyon = getCountyEngagementMetrics('Lyon');
    expect(lyon.totalMembers).toBe(0);
    expect(lyon.engagedMembers).toBe(0);
    expect(lyon.unengagedMembers).toBe(0);
  });

  it('does not rank counties using missing SSHP member counts', () => {
    expect(getTopUnengagedCounties(5)).toEqual([]);
  });

  it('does not identify payer-based outreach priority counties', () => {
    expect(getFilteredEngagementPriorityCounties({ belowRateThreshold: 0.2 })).toEqual([]);
  });
});
