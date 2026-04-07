/**
 * County-level cellular coverage data for Nevada.
 *
 * Derived from FCC BDC Mobile Broadband Provider Summary, J25 (March 2026).
 * National carrier technology profiles + Nevada geographic modeling.
 *
 * fieldReliabilityConfidence is "Medium" because FCC data is modeled coverage,
 * not field-measured signal strength.
 */

import cellularJson from '/data/nevada_cellular.json';

export type OperationalCellularReadiness = 'High' | 'Mixed' | 'Low';

export interface CountyCellularData {
  countyName: string;
  verizonCoveragePct: number;
  attCoveragePct: number;
  tmobileCoveragePct: number;
  verizon5gPct: number;
  att5gPct: number;
  tmobile5gPct: number;
  carrierOverlapScore: number; // 0–3
  strongSignalPct: number;
  moderateSignalPct: number;
  weakOrNonePct: number;
  operationalCellularReadiness: OperationalCellularReadiness;
  fieldReliabilityConfidence: string;
  notes: string | null;
  fccSource: string;
}

// ── Backward-compatible types for downstream consumers ──
export type CellularReliability = 'Strong' | 'Moderate' | 'Weak' | 'None';

export interface CarrierPresence {
  verizon: boolean;
  att: boolean;
  tmobile: boolean;
}

/** Load from generated JSON */
export const COUNTY_CELLULAR_DATA: CountyCellularData[] = (cellularJson as CountyCellularData[]);

/** Lookup map */
export const CELLULAR_BY_COUNTY = new Map(
  COUNTY_CELLULAR_DATA.map((d) => [d.countyName, d]),
);

/** Get cellular data for a county */
export const getCountyCellular = (countyName: string): CountyCellularData | undefined =>
  CELLULAR_BY_COUNTY.get(countyName);

/** Derive a backward-compatible reliability category from signal distribution */
export const getReliabilityCategory = (data: CountyCellularData): CellularReliability => {
  if (data.strongSignalPct >= 40 && data.carrierOverlapScore >= 2) return 'Strong';
  if (data.moderateSignalPct >= 20 && data.carrierOverlapScore >= 1) return 'Moderate';
  if (data.strongSignalPct + data.moderateSignalPct >= 10) return 'Weak';
  return 'None';
};

/** Derive carrier presence booleans */
export const getCarrierPresence = (data: CountyCellularData): CarrierPresence => ({
  verizon: data.verizonCoveragePct > 15,
  att: data.attCoveragePct > 15,
  tmobile: data.tmobileCoveragePct > 15,
});

/** Format carrier presence as compact string (e.g. "V · A · T") */
export const formatCarriers = (data: CountyCellularData): string => {
  const parts: string[] = [];
  if (data.verizonCoveragePct > 15) parts.push('V');
  if (data.attCoveragePct > 15) parts.push('A');
  if (data.tmobileCoveragePct > 15) parts.push('T');
  return parts.length > 0 ? parts.join(' · ') : '—';
};

/** Format carrier presence from CarrierPresence object (legacy compat) */
export const formatCarrierPresence = (carriers: CarrierPresence): string => {
  const parts: string[] = [];
  if (carriers.verizon) parts.push('V');
  if (carriers.att) parts.push('A');
  if (carriers.tmobile) parts.push('T');
  return parts.length > 0 ? parts.join(' · ') : '—';
};

/** Readiness color tokens */
export const READINESS_COLORS: Record<OperationalCellularReadiness, string> = {
  High: 'text-staffing-high',
  Mixed: 'text-engagement-watch',
  Low: 'text-destructive',
};
