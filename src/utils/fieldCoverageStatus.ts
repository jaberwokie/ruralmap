/**
 * FTE Field Coverage Status — single source of truth for whether a county
 * has any assigned in-person field FTE.
 *
 * IMPORTANT: This is a *display-language gate only*. It does not change any
 * routing scores, access tiers, utilization logic, or map layers. It exists
 * so the UI can speak truthfully about whether in-person engagement is
 * actually possible in a given county, vs. only remote coordination.
 */

import { fteCapacityData } from '@/data/fte-capacity';

export interface FieldCoverageStatus {
  /** At least one FTE with a physical hub (hubLocation !== null) serves this county. */
  hasFieldCoverage: boolean;
  /** At least one remote-only FTE (hubLocation === null) serves this county. */
  hasRemoteCoverage: boolean;
}

const _cache = new Map<string, FieldCoverageStatus>();

export function getFieldCoverageStatus(county: string): FieldCoverageStatus {
  const cached = _cache.get(county);
  if (cached) return cached;
  const serving = fteCapacityData.filter(f => f.counties.includes(county));
  const status: FieldCoverageStatus = {
    hasFieldCoverage: serving.some(f => f.hubLocation !== null),
    hasRemoteCoverage: serving.some(f => f.hubLocation === null),
  };
  _cache.set(county, status);
  return status;
}

/** Convenience: does this county have any in-person FTE field coverage? */
export function countyHasFieldCoverage(county: string | null | undefined): boolean {
  if (!county) return false;
  return getFieldCoverageStatus(county).hasFieldCoverage;
}
