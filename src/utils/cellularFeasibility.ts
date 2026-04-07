/**
 * Cellular/mobile feasibility classification for operational decision support.
 * Now uses FCC-derived data instead of mock estimates.
 */

import type { CountyCellularData, OperationalCellularReadiness, CellularReliability } from '@/data/cellular-coverage';
import { getCountyCellular, getReliabilityCategory } from '@/data/cellular-coverage';

export type MobileFeasibility = 'High Mobile Feasibility' | 'Moderate Mobile Feasibility' | 'Low Mobile Feasibility';

export const getMobileFeasibility = (data: CountyCellularData): MobileFeasibility => {
  switch (data.operationalCellularReadiness) {
    case 'High': return 'High Mobile Feasibility';
    case 'Mixed': return 'Moderate Mobile Feasibility';
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
  switch (data.operationalCellularReadiness) {
    case 'High':
      return 'Mobile coordination and phone-based engagement are reliable across most of the county.';
    case 'Mixed':
      return 'Intermittent connectivity — plan redundancy for phone-based workflows. Coverage varies by location.';
    case 'Low':
      return 'Phone contact unreliable in most areas. Expect failed connections and dropped calls outside population centers.';
  }
};

/** Color token class names using backward-compatible reliability categories */
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

export const getOperationalConnectivityProfile = (countyName: string): OperationalConnectivityProfile | null => {
  const data = getCountyCellular(countyName);
  if (!data) return null;

  const { getCountyRemoteFeasibility } = require('@/utils/broadbandFeasibility');
  const broadband = getCountyRemoteFeasibility(countyName);

  const bbHigh = broadband === 'High Remote Feasibility';
  const mobHigh = data.operationalCellularReadiness === 'High';
  const bbLow = broadband === 'Low Remote Feasibility';
  const mobLow = data.operationalCellularReadiness === 'Low';

  if (bbHigh && mobHigh) return 'Fully Connected';
  if (bbLow && mobLow) return 'Field-First Required';
  return 'Hybrid Required';
};
