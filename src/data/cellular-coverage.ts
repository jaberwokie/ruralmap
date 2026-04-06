/**
 * County-level cellular coverage data for rural Nevada.
 *
 * Mock/placeholder data — replace with real carrier coverage data later.
 * Structure is designed to be swappable without changing downstream logic.
 */

export type CellularReliability = 'Strong' | 'Moderate' | 'Weak' | 'None';

export interface CarrierPresence {
  verizon: boolean;
  att: boolean;
  tmobile: boolean;
}

export interface CountyCellularData {
  countyName: string;
  carriers: CarrierPresence;
  /** 0–100 composite signal strength score */
  signalStrengthScore: number;
  /** Derived from score + carrier availability */
  reliabilityCategory: CellularReliability;
  notes?: string;
}

/** Derive reliability from signal score and carrier presence */
export const deriveCellularReliability = (
  signalStrengthScore: number,
  carriers: CarrierPresence,
): CellularReliability => {
  const carrierCount = [carriers.verizon, carriers.att, carriers.tmobile].filter(Boolean).length;
  if (carrierCount === 0) return 'None';
  if (signalStrengthScore >= 65 && carrierCount >= 2) return 'Strong';
  if (signalStrengthScore >= 35 && carrierCount >= 1) return 'Moderate';
  if (signalStrengthScore >= 10) return 'Weak';
  return 'None';
};

const county = (
  countyName: string,
  signalStrengthScore: number,
  carriers: CarrierPresence,
  notes?: string,
): CountyCellularData => ({
  countyName,
  carriers,
  signalStrengthScore,
  reliabilityCategory: deriveCellularReliability(signalStrengthScore, carriers),
  notes,
});

const c = (v: boolean, a: boolean, t: boolean): CarrierPresence => ({ verizon: v, att: a, tmobile: t });

/**
 * Mock cellular data for rural Nevada counties.
 * Replace with real carrier coverage data.
 */
export const COUNTY_CELLULAR_DATA: CountyCellularData[] = [
  county('Elko',        55, c(true, true, false),   'Coverage along I-80 corridor; dead zones in backcountry'),
  county('Humboldt',    45, c(true, false, false),   'Winnemucca has Verizon; rural areas spotty'),
  county('Lander',      30, c(true, false, false),   'Battle Mountain has limited signal; gaps south'),
  county('Eureka',      12, c(false, false, false),  'Extremely sparse — nearly no reliable coverage'),
  county('White Pine',  50, c(true, true, false),    'Ely has service; gaps on Highway 93 south'),
  county('Nye',         60, c(true, true, true),     'Pahrump well-covered; Tonopah area weaker'),
  county('Lincoln',     25, c(true, false, false),   'Caliente has weak signal; Highway 93 gaps'),
  county('Pershing',    35, c(true, false, false),   'I-80 corridor only; Lovelock marginal'),
  county('Mineral',     28, c(false, true, false),   'Hawthorne has AT&T; surrounding area poor'),
  county('Esmeralda',    5, c(false, false, false),  'No meaningful cellular infrastructure'),
  county('Lyon',        72, c(true, true, true),     'Fernley and Dayton well-served'),
  county('Churchill',   65, c(true, true, false),    'Fallon has good coverage; NAS Fallon area served'),
  county('Douglas',     78, c(true, true, true),     'Minden/Gardnerville — strong multi-carrier'),
  county('Storey',      70, c(true, true, false),    'Virginia City corridor covered'),
  county('Carson City', 85, c(true, true, true),     'Urban — full multi-carrier coverage'),
  county('Clark',       90, c(true, true, true),     'Metro Las Vegas — strong coverage'),
  county('Washoe',      88, c(true, true, true),     'Reno/Sparks metro — strong coverage'),
];

/** Lookup map for O(1) access by county name */
export const CELLULAR_BY_COUNTY = new Map(
  COUNTY_CELLULAR_DATA.map((d) => [d.countyName, d]),
);

/** Get cellular data for a county */
export const getCountyCellular = (countyName: string): CountyCellularData | undefined =>
  CELLULAR_BY_COUNTY.get(countyName);

/** Format carrier presence as compact string (e.g. "V · A · T") */
export const formatCarriers = (carriers: CarrierPresence): string => {
  const parts: string[] = [];
  if (carriers.verizon) parts.push('V');
  if (carriers.att) parts.push('A');
  if (carriers.tmobile) parts.push('T');
  return parts.length > 0 ? parts.join(' · ') : '—';
};
