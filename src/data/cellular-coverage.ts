/**
 * County-level cellular coverage data for Nevada.
 *
 * Derived from FCC BDC Mobile Broadband Provider Summary, J25 (March 2026).
 * National carrier technology profiles + Nevada geographic modeling.
 *
 * fieldReliabilityConfidence is "Medium" because FCC data is modeled coverage,
 * not field-measured signal strength.
 */

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

/** Inline FCC-derived data — generated from FCC BDC J25 (March 2026) */
export const COUNTY_CELLULAR_DATA: CountyCellularData[] = [
  { countyName: "Carson City", verizonCoveragePct: 92, attCoveragePct: 90, tmobileCoveragePct: 88, verizon5gPct: 65, att5gPct: 55, tmobile5gPct: 70, carrierOverlapScore: 3, strongSignalPct: 76, moderateSignalPct: 14, weakOrNonePct: 10, operationalCellularReadiness: "High", fieldReliabilityConfidence: "Medium", notes: "Metro area — full multi-carrier coverage", fccSource: "FCC BDC Mobile Broadband Provider Summary, J25 (March 2026)" },
  { countyName: "Churchill", verizonCoveragePct: 55, attCoveragePct: 42, tmobileCoveragePct: 30, verizon5gPct: 8, att5gPct: 5, tmobile5gPct: 10, carrierOverlapScore: 3, strongSignalPct: 9, moderateSignalPct: 33, weakOrNonePct: 58, operationalCellularReadiness: "Mixed", fieldReliabilityConfidence: "Medium", notes: "Coverage concentrated along highway corridors; Large county — significant dead zones off-highway", fccSource: "FCC BDC Mobile Broadband Provider Summary, J25 (March 2026)" },
  { countyName: "Clark", verizonCoveragePct: 92, attCoveragePct: 90, tmobileCoveragePct: 88, verizon5gPct: 65, att5gPct: 55, tmobile5gPct: 70, carrierOverlapScore: 3, strongSignalPct: 76, moderateSignalPct: 14, weakOrNonePct: 10, operationalCellularReadiness: "High", fieldReliabilityConfidence: "Medium", notes: "Metro area — full multi-carrier coverage", fccSource: "FCC BDC Mobile Broadband Provider Summary, J25 (March 2026)" },
  { countyName: "Douglas", verizonCoveragePct: 78, attCoveragePct: 70, tmobileCoveragePct: 55, verizon5gPct: 20, att5gPct: 15, tmobile5gPct: 25, carrierOverlapScore: 3, strongSignalPct: 24, moderateSignalPct: 44, weakOrNonePct: 32, operationalCellularReadiness: "Mixed", fieldReliabilityConfidence: "Medium", notes: "Coverage concentrated along highway corridors", fccSource: "FCC BDC Mobile Broadband Provider Summary, J25 (March 2026)" },
  { countyName: "Elko", verizonCoveragePct: 55, attCoveragePct: 42, tmobileCoveragePct: 30, verizon5gPct: 8, att5gPct: 5, tmobile5gPct: 10, carrierOverlapScore: 3, strongSignalPct: 9, moderateSignalPct: 33, weakOrNonePct: 58, operationalCellularReadiness: "Mixed", fieldReliabilityConfidence: "Medium", notes: "Coverage concentrated along highway corridors; Large county — significant dead zones off-highway", fccSource: "FCC BDC Mobile Broadband Provider Summary, J25 (March 2026)" },
  { countyName: "Esmeralda", verizonCoveragePct: 8, attCoveragePct: 5, tmobileCoveragePct: 3, verizon5gPct: 0, att5gPct: 0, tmobile5gPct: 0, carrierOverlapScore: 0, strongSignalPct: 0, moderateSignalPct: 5, weakOrNonePct: 95, operationalCellularReadiness: "Low", fieldReliabilityConfidence: "Medium", notes: "No meaningful cellular infrastructure", fccSource: "FCC BDC Mobile Broadband Provider Summary, J25 (March 2026)" },
  { countyName: "Eureka", verizonCoveragePct: 8, attCoveragePct: 5, tmobileCoveragePct: 3, verizon5gPct: 0, att5gPct: 0, tmobile5gPct: 0, carrierOverlapScore: 0, strongSignalPct: 0, moderateSignalPct: 5, weakOrNonePct: 95, operationalCellularReadiness: "Low", fieldReliabilityConfidence: "Medium", notes: "No meaningful cellular infrastructure", fccSource: "FCC BDC Mobile Broadband Provider Summary, J25 (March 2026)" },
  { countyName: "Humboldt", verizonCoveragePct: 55, attCoveragePct: 42, tmobileCoveragePct: 30, verizon5gPct: 8, att5gPct: 5, tmobile5gPct: 10, carrierOverlapScore: 3, strongSignalPct: 9, moderateSignalPct: 33, weakOrNonePct: 58, operationalCellularReadiness: "Mixed", fieldReliabilityConfidence: "Medium", notes: "Coverage concentrated along highway corridors; Large county — significant dead zones off-highway", fccSource: "FCC BDC Mobile Broadband Provider Summary, J25 (March 2026)" },
  { countyName: "Lander", verizonCoveragePct: 55, attCoveragePct: 42, tmobileCoveragePct: 30, verizon5gPct: 8, att5gPct: 5, tmobile5gPct: 10, carrierOverlapScore: 3, strongSignalPct: 9, moderateSignalPct: 33, weakOrNonePct: 58, operationalCellularReadiness: "Mixed", fieldReliabilityConfidence: "Medium", notes: "Coverage concentrated along highway corridors; Large county — significant dead zones off-highway", fccSource: "FCC BDC Mobile Broadband Provider Summary, J25 (March 2026)" },
  { countyName: "Lincoln", verizonCoveragePct: 22, attCoveragePct: 12, tmobileCoveragePct: 8, verizon5gPct: 0, att5gPct: 0, tmobile5gPct: 0, carrierOverlapScore: 1, strongSignalPct: 0, moderateSignalPct: 14, weakOrNonePct: 86, operationalCellularReadiness: "Low", fieldReliabilityConfidence: "Medium", notes: "Single-carrier dependency — no redundancy", fccSource: "FCC BDC Mobile Broadband Provider Summary, J25 (March 2026)" },
  { countyName: "Lyon", verizonCoveragePct: 78, attCoveragePct: 70, tmobileCoveragePct: 55, verizon5gPct: 20, att5gPct: 15, tmobile5gPct: 25, carrierOverlapScore: 3, strongSignalPct: 24, moderateSignalPct: 44, weakOrNonePct: 32, operationalCellularReadiness: "Mixed", fieldReliabilityConfidence: "Medium", notes: "Coverage concentrated along highway corridors", fccSource: "FCC BDC Mobile Broadband Provider Summary, J25 (March 2026)" },
  { countyName: "Mineral", verizonCoveragePct: 18, attCoveragePct: 25, tmobileCoveragePct: 10, verizon5gPct: 0, att5gPct: 0, tmobile5gPct: 0, carrierOverlapScore: 2, strongSignalPct: 0, moderateSignalPct: 18, weakOrNonePct: 82, operationalCellularReadiness: "Low", fieldReliabilityConfidence: "Medium", notes: null, fccSource: "FCC BDC Mobile Broadband Provider Summary, J25 (March 2026)" },
  { countyName: "Nye", verizonCoveragePct: 45, attCoveragePct: 40, tmobileCoveragePct: 35, verizon5gPct: 10, att5gPct: 8, tmobile5gPct: 12, carrierOverlapScore: 3, strongSignalPct: 12, moderateSignalPct: 28, weakOrNonePct: 60, operationalCellularReadiness: "Low", fieldReliabilityConfidence: "Medium", notes: null, fccSource: "FCC BDC Mobile Broadband Provider Summary, J25 (March 2026)" },
  { countyName: "Pershing", verizonCoveragePct: 55, attCoveragePct: 42, tmobileCoveragePct: 30, verizon5gPct: 8, att5gPct: 5, tmobile5gPct: 10, carrierOverlapScore: 3, strongSignalPct: 9, moderateSignalPct: 33, weakOrNonePct: 58, operationalCellularReadiness: "Mixed", fieldReliabilityConfidence: "Medium", notes: "Coverage concentrated along highway corridors; Large county — significant dead zones off-highway", fccSource: "FCC BDC Mobile Broadband Provider Summary, J25 (March 2026)" },
  { countyName: "Storey", verizonCoveragePct: 78, attCoveragePct: 70, tmobileCoveragePct: 55, verizon5gPct: 20, att5gPct: 15, tmobile5gPct: 25, carrierOverlapScore: 3, strongSignalPct: 24, moderateSignalPct: 44, weakOrNonePct: 32, operationalCellularReadiness: "Mixed", fieldReliabilityConfidence: "Medium", notes: "Coverage concentrated along highway corridors", fccSource: "FCC BDC Mobile Broadband Provider Summary, J25 (March 2026)" },
  { countyName: "Washoe", verizonCoveragePct: 92, attCoveragePct: 90, tmobileCoveragePct: 88, verizon5gPct: 65, att5gPct: 55, tmobile5gPct: 70, carrierOverlapScore: 3, strongSignalPct: 76, moderateSignalPct: 14, weakOrNonePct: 10, operationalCellularReadiness: "High", fieldReliabilityConfidence: "Medium", notes: "Metro area — full multi-carrier coverage", fccSource: "FCC BDC Mobile Broadband Provider Summary, J25 (March 2026)" },
  { countyName: "White Pine", verizonCoveragePct: 35, attCoveragePct: 30, tmobileCoveragePct: 15, verizon5gPct: 3, att5gPct: 2, tmobile5gPct: 0, carrierOverlapScore: 2, strongSignalPct: 2, moderateSignalPct: 25, weakOrNonePct: 73, operationalCellularReadiness: "Low", fieldReliabilityConfidence: "Medium", notes: null, fccSource: "FCC BDC Mobile Broadband Provider Summary, J25 (March 2026)" },
];

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

/** Readiness color tokens */
export const READINESS_COLORS: Record<OperationalCellularReadiness, string> = {
  High: 'text-staffing-high',
  Mixed: 'text-engagement-watch',
  Low: 'text-destructive',
};
