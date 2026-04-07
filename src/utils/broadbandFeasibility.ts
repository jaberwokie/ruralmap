/**
 * Broadband feasibility classification for operational decision support.
 *
 * Uses distribution-based county broadband data to evaluate
 * whether remote/telehealth service delivery is viable.
 */

import type { CountyBroadbandData, OperationalBroadbandReadiness } from '@/data/broadband-coverage';
import { getCountyBroadband } from '@/data/broadband-coverage';

export type RemoteFeasibility = 'High Remote Feasibility' | 'Moderate Remote Feasibility' | 'Low Remote Feasibility';

/**
 * Evaluate remote service feasibility from broadband distribution data.
 */
export const getRemoteFeasibility = (data: CountyBroadbandData): RemoteFeasibility => {
  if (data.operationalReadiness === 'High') return 'High Remote Feasibility';
  if (data.operationalReadiness === 'Low') return 'Low Remote Feasibility';
  return 'Moderate Remote Feasibility';
};

/**
 * Get remote feasibility for a county by name.
 */
export const getCountyRemoteFeasibility = (countyName: string): RemoteFeasibility | null => {
  const data = getCountyBroadband(countyName);
  if (!data) return null;
  return getRemoteFeasibility(data);
};

/**
 * Generate operational interpretation based on distribution data.
 */
export const getBroadbandOperationalNote = (data: CountyBroadbandData): string => {
  const parts: string[] = [];

  if (data.operationalReadiness === 'High') {
    parts.push('Telehealth and remote coordination are viable primary delivery methods.');
  } else if (data.operationalReadiness === 'Low') {
    parts.push('Mobile-first or in-person deployment is likely required. Broadband limitations restrict remote service delivery.');
  } else {
    parts.push('Hybrid deployment recommended — remote where possible, in-person for coverage gaps.');
  }

  if (data.coverageUnevenness) {
    parts.push('Coverage varies significantly across this county — do not assume uniform access.');
  }

  if (data.satelliteShare >= 50) {
    parts.push(`${data.satelliteShare.toFixed(0)}% of coverage is satellite-only, which is unreliable for real-time telehealth.`);
  }

  return parts.join(' ');
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

/** Readiness colors */
export const READINESS_COLORS: Record<OperationalBroadbandReadiness, string> = {
  'High': 'text-staffing-high',
  'Mixed': 'text-engagement-watch',
  'Low': 'text-destructive',
};
