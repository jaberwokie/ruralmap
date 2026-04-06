/**
 * Broadband feasibility classification for operational decision support.
 *
 * Evaluates whether a county can support remote/telehealth service
 * delivery based on broadband coverage data.
 */

import type { CountyBroadbandData, DominantTechnology } from '@/data/broadband-coverage';
import { getCountyBroadband } from '@/data/broadband-coverage';

export type RemoteFeasibility = 'High Remote Feasibility' | 'Moderate Remote Feasibility' | 'Low Remote Feasibility';

const STRONG_TECHNOLOGIES = new Set<DominantTechnology>(['Fiber', 'Mixed']);
const WEAK_TECHNOLOGIES = new Set<DominantTechnology>(['Satellite', 'Unknown']);

/**
 * Evaluate remote service feasibility from broadband data.
 */
export const getRemoteFeasibility = (data: CountyBroadbandData): RemoteFeasibility => {
  if (data.servedPercent >= 55 && STRONG_TECHNOLOGIES.has(data.dominantTechnology)) {
    return 'High Remote Feasibility';
  }
  if (data.unservedPercent >= 45 || WEAK_TECHNOLOGIES.has(data.dominantTechnology)) {
    return 'Low Remote Feasibility';
  }
  return 'Moderate Remote Feasibility';
};

/**
 * Get remote feasibility for a county by name.
 * Returns null if no broadband data exists for the county.
 */
export const getCountyRemoteFeasibility = (countyName: string): RemoteFeasibility | null => {
  const data = getCountyBroadband(countyName);
  if (!data) return null;
  return getRemoteFeasibility(data);
};

/**
 * Generate a short operational interpretation string for a county's broadband status.
 */
export const getBroadbandOperationalNote = (data: CountyBroadbandData): string => {
  const feasibility = getRemoteFeasibility(data);
  switch (feasibility) {
    case 'High Remote Feasibility':
      return 'Telehealth and remote coordination are viable primary delivery methods.';
    case 'Moderate Remote Feasibility':
      return 'Hybrid deployment recommended — remote where possible, in-person for coverage gaps.';
    case 'Low Remote Feasibility':
      return 'Mobile-first or in-person deployment is likely required. Broadband limitations restrict remote service delivery.';
  }
};

/** Feasibility color token class names */
export const FEASIBILITY_COLORS: Record<RemoteFeasibility, string> = {
  'High Remote Feasibility': 'text-staffing-high',
  'Moderate Remote Feasibility': 'text-engagement-watch',
  'Low Remote Feasibility': 'text-destructive',
};

/** Short label for badges */
export const FEASIBILITY_SHORT_LABELS: Record<RemoteFeasibility, string> = {
  'High Remote Feasibility': 'High',
  'Moderate Remote Feasibility': 'Moderate',
  'Low Remote Feasibility': 'Low',
};
