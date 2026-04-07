/**
 * County-level cellular coverage data for Nevada.
 *
 * Derived from FCC BDC Nevada mobile availability geometry
 * (4G LTE and 5G-NR, J25 31mar2026).
 *
 * This dataset does NOT include carrier-specific breakdowns.
 * fieldReliabilityConfidence is "Medium" — FCC geometry is modeled, not field-measured.
 */

import cellularJson from '/data/nevada_cellular.json';

export type OperationalCellularReadiness = 'High' | 'Mixed' | 'Low';

export interface CountyCellularData {
  countyName: string;
  lteCoveragePct: number;
  fiveGCoveragePct: number;
  strongSignalPct: number;
  moderateSignalPct: number;
  weakOrNonePct: number;
  operationalCellularReadiness: OperationalCellularReadiness;
  fieldReliabilityConfidence: string;
  dataSource: string;
  dataLimitations: string;
}

// ── Backward-compatible types for downstream consumers ──
export type CellularReliability = 'Strong' | 'Moderate' | 'Weak' | 'None';

/** FCC-derived data loaded from public/data/nevada_cellular.json */
export const COUNTY_CELLULAR_DATA: CountyCellularData[] = cellularJson as CountyCellularData[];

/** Lookup map */
export const CELLULAR_BY_COUNTY = new Map(
  COUNTY_CELLULAR_DATA.map((d) => [d.countyName, d]),
);

/** Get cellular data for a county */
export const getCountyCellular = (countyName: string): CountyCellularData | undefined =>
  CELLULAR_BY_COUNTY.get(countyName);

/** Derive a backward-compatible reliability category from signal distribution */
export const getReliabilityCategory = (data: CountyCellularData): CellularReliability => {
  if (data.strongSignalPct >= 50) return 'Strong';
  if (data.strongSignalPct >= 25) return 'Moderate';
  if (data.strongSignalPct + data.moderateSignalPct >= 15) return 'Weak';
  return 'None';
};

/** Readiness color tokens */
export const READINESS_COLORS: Record<OperationalCellularReadiness, string> = {
  High: 'text-staffing-high',
  Mixed: 'text-engagement-watch',
  Low: 'text-destructive',
};
