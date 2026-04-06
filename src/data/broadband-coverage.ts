/**
 * County-level broadband coverage data for rural Nevada.
 *
 * This file contains mock/placeholder data that can be replaced with
 * real FCC or state-level broadband data later. The structure is
 * designed to be swappable without changing downstream logic.
 */

export type DominantTechnology = 'Fiber' | 'Fixed Wireless' | 'Satellite' | 'Mixed' | 'Unknown';
export type BroadbandStatus = 'Served' | 'Underserved' | 'Unserved';

export interface CountyBroadbandData {
  countyName: string;
  /** % of population with ≥25/3 Mbps service */
  servedPercent: number;
  /** % of population with some service but below 25/3 Mbps */
  underservedPercent: number;
  /** % of population with no fixed broadband */
  unservedPercent: number;
  dominantTechnology: DominantTechnology;
  /** Derived from thresholds — do not hardcode per county */
  broadbandStatus: BroadbandStatus;
  /** Optional notes for operational context */
  notes?: string;
}

/** Derive broadband status from served/underserved/unserved percentages */
export const deriveBroadbandStatus = (
  servedPercent: number,
  underservedPercent: number,
  unservedPercent: number,
): BroadbandStatus => {
  if (servedPercent >= 60) return 'Served';
  if (unservedPercent >= 40) return 'Unserved';
  return 'Underserved';
};

/** Build a county record with auto-derived status */
const county = (
  countyName: string,
  servedPercent: number,
  underservedPercent: number,
  unservedPercent: number,
  dominantTechnology: DominantTechnology,
  notes?: string,
): CountyBroadbandData => ({
  countyName,
  servedPercent,
  underservedPercent,
  unservedPercent,
  dominantTechnology,
  broadbandStatus: deriveBroadbandStatus(servedPercent, underservedPercent, unservedPercent),
  notes,
});

/**
 * Mock broadband data for all rural Nevada counties.
 * Replace with real data from FCC BDC or state broadband office.
 */
export const COUNTY_BROADBAND_DATA: CountyBroadbandData[] = [
  county('Elko',        45, 30, 25, 'Fixed Wireless', 'Hub towns served; outlying areas rely on satellite'),
  county('Humboldt',    38, 28, 34, 'Fixed Wireless', 'Winnemucca core has DSL; rural areas largely unserved'),
  county('Lander',      22, 25, 53, 'Satellite',      'Battle Mountain has limited fixed wireless'),
  county('Eureka',      15, 20, 65, 'Satellite',      'Very low population density limits deployment'),
  county('White Pine',  40, 30, 30, 'Mixed',          'Ely has fiber; surrounding areas mixed'),
  county('Nye',         50, 25, 25, 'Mixed',          'Pahrump has cable; Tonopah area underserved'),
  county('Lincoln',     20, 25, 55, 'Satellite',      'Caliente and Pioche have minimal fixed service'),
  county('Pershing',    30, 30, 40, 'Fixed Wireless', 'Lovelock has some broadband; rest is sparse'),
  county('Mineral',     25, 30, 45, 'Satellite',      'Hawthorne has limited DSL'),
  county('Esmeralda',   10, 15, 75, 'Satellite',      'Least connected county in Nevada'),
  county('Lyon',        62, 25, 13, 'Mixed',          'Fernley and Dayton have cable/fiber expansion'),
  county('Churchill',   55, 25, 20, 'Mixed',          'Fallon has good coverage; rural pockets remain'),
  county('Douglas',     70, 20, 10, 'Fiber',          'Gardnerville/Minden well-served'),
  county('Storey',      60, 25, 15, 'Mixed',          'Virginia City area has improved access'),
  county('Carson City', 78, 15,  7, 'Fiber',          'Urban area with strong broadband infrastructure'),
  county('Clark',       85, 10,  5, 'Fiber',          'Metro Las Vegas — high broadband availability'),
  county('Washoe',      80, 12,  8, 'Fiber',          'Reno/Sparks metro well-served'),
];

/** Lookup map for O(1) access by county name */
export const BROADBAND_BY_COUNTY = new Map(
  COUNTY_BROADBAND_DATA.map((d) => [d.countyName, d]),
);

/** Get broadband data for a county, returns undefined if not found */
export const getCountyBroadband = (countyName: string): CountyBroadbandData | undefined =>
  BROADBAND_BY_COUNTY.get(countyName);
