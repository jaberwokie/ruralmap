/**
 * NDOT Mobility Managers — county-level transportation coordination context.
 *
 * Mobility Managers are NOT direct transportation providers. They coordinate
 * transportation access across assigned counties. They MUST NOT appear as map
 * pins, transit operators, providers, services, or factor into access scoring,
 * verification queues, utilization, or routing tiers.
 *
 * Source: NDOT Public Transit (https://www.dot.nv.gov/mobility/transit)
 */

export interface MobilityManager {
  id: string;
  name: string;
  organization: string;
  officePhone: string;
  email: string;
  address: string;
  /** County names (matched by exact county name). */
  coverageCounties: string[];
  notes?: string;
  category: 'mobility_manager';
  roleSummary: string;
  sourceUrl: string;
  sourceName: string;
  /** ISO date (YYYY-MM-DD). */
  lastVerified: string;
}

export const mobilityManagers: MobilityManager[] = [
  {
    id: 'mm-northwest-jackie-gonzalez',
    name: 'Jackie Gonzalez',
    organization: 'Access to Healthcare Network',
    officePhone: '775-284-8989 ext. 238',
    email: 'jackie@accesstohealthcare.org',
    address: '4001 S. Virginia St. Ste. F, Reno, NV 89502',
    coverageCounties: [
      'Carson City',
      'Churchill',
      'Douglas',
      'Humboldt',
      'Lander',
      'Lyon',
      'Mineral',
      'Pershing',
      'Storey',
      'Washoe',
    ],
    notes: 'Humboldt and Lander are marked by NDOT as counties served by multiple mobility managers.',
    category: 'mobility_manager',
    roleSummary: 'Coordinates transportation access across assigned counties.',
    sourceUrl: 'https://www.dot.nv.gov/mobility/transit',
    sourceName: 'NDOT',
    lastVerified: '2026-04-20',
  },
  {
    id: 'mm-southern-marlaina-porter',
    name: 'Marlaina Porter',
    organization: 'Nye Communities Coalition',
    officePhone: '775-727-9970 Ext. 236',
    email: 'Marlaina@nyecc.org',
    address: '1020 East Wilson Rd., Pahrump, NV 89048',
    coverageCounties: ['Clark', 'Esmeralda', 'Lincoln', 'Nye'],
    notes: 'Humboldt and Lander are marked by NDOT as counties served by multiple mobility managers.',
    category: 'mobility_manager',
    roleSummary: 'Coordinates transportation access across assigned counties.',
    sourceUrl: 'https://www.dot.nv.gov/mobility/transit',
    sourceName: 'NDOT',
    lastVerified: '2026-04-20',
  },
];

/**
 * Return all Mobility Managers whose coverage list includes the given county.
 * Match is exact on county name. Multiple managers per county are supported.
 */
export const getMobilityManagersForCounty = (county: string): MobilityManager[] => {
  if (!county) return [];
  return mobilityManagers.filter(mm => mm.coverageCounties.includes(county));
};

/**
 * NDOT explicitly notes these counties are served by more than one mobility
 * manager, even if our current seed dataset only contains a single matching
 * record. UI should disclose this so operators don't assume the list is final.
 */
export const COUNTIES_WITH_MULTIPLE_MOBILITY_MANAGERS: ReadonlySet<string> = new Set([
  'Humboldt',
  'Lander',
]);
