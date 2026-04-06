/**
 * Cellular/mobile feasibility classification for operational decision support.
 */

import type { CountyCellularData, CellularReliability } from '@/data/cellular-coverage';
import { getCountyCellular } from '@/data/cellular-coverage';
import { getCountyRemoteFeasibility, type RemoteFeasibility } from '@/utils/broadbandFeasibility';

export type MobileFeasibility = 'High Mobile Feasibility' | 'Moderate Mobile Feasibility' | 'Low Mobile Feasibility';

export const getMobileFeasibility = (data: CountyCellularData): MobileFeasibility => {
  switch (data.reliabilityCategory) {
    case 'Strong': return 'High Mobile Feasibility';
    case 'Moderate': return 'Moderate Mobile Feasibility';
    default: return 'Low Mobile Feasibility';
  }
};

export const getCountyMobileFeasibility = (countyName: string): MobileFeasibility | null => {
  const data = getCountyCellular(countyName);
  if (!data) return null;
  return getMobileFeasibility(data);
};

/** Operational interpretation text */
export const getCellularOperationalNote = (data: CountyCellularData): string => {
  switch (data.reliabilityCategory) {
    case 'Strong':
      return 'Mobile coordination and phone-based engagement are reliable.';
    case 'Moderate':
      return 'Intermittent connectivity — plan redundancy for phone-based workflows.';
    case 'Weak':
      return 'Phone contact unreliable. Expect failed connections and dropped calls.';
    case 'None':
      return 'No cellular reliance possible. Require in-person or pre-coordinated contact.';
  }
};

/** Color token class names */
export const RELIABILITY_COLORS: Record<CellularReliability, string> = {
  'Strong': 'text-staffing-high',
  'Moderate': 'text-engagement-watch',
  'Weak': 'text-destructive',
  'None': 'text-muted-foreground',
};

export const RELIABILITY_SHORT_LABELS: Record<CellularReliability, string> = {
  'Strong': 'Strong',
  'Moderate': 'Moderate',
  'Weak': 'Weak',
  'None': 'None',
};

// ── Combined connectivity profile ──

export type OperationalConnectivityProfile = 'Fully Connected' | 'Hybrid Required' | 'Field-First Required';

/**
 * Combines broadband and cellular feasibility into a single operational profile.
 * Designed for future UI integration.
 */
export const getOperationalConnectivityProfile = (countyName: string): OperationalConnectivityProfile | null => {
  const broadband = getCountyRemoteFeasibility(countyName);
  const mobile = getCountyMobileFeasibility(countyName);
  if (!broadband && !mobile) return null;

  const bbHigh = broadband === 'High Remote Feasibility';
  const mobHigh = mobile === 'High Mobile Feasibility';
  const bbLow = broadband === 'Low Remote Feasibility';
  const mobLow = mobile === 'Low Mobile Feasibility';

  if (bbHigh && mobHigh) return 'Fully Connected';
  if (bbLow && mobLow) return 'Field-First Required';
  return 'Hybrid Required';
};
