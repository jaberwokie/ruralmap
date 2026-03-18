/**
 * Operational Coverage Model
 *
 * Defines staffing-based coverage zones aligned to real FTE positions.
 * Does NOT use radius/circle logic — uses county polygons as zone boundaries.
 */

export type CoverageType = 'active' | 'scheduled' | 'remote';

export interface OperationalZone {
  id: string;
  coverageType: CoverageType;
  fte: string;              // e.g. "Carson City FTE", "Pahrump FTE", "Remote Team"
  counties: string[];       // County names included in this zone
  label: string;            // Display label
  description: string;      // Short tooltip description
}

export const COVERAGE_TYPE_LABELS: Record<CoverageType, string> = {
  active: 'Active Field Coverage',
  scheduled: 'Scheduled Outreach',
  remote: 'Remote Support Only',
};

export const COVERAGE_TYPE_DESCRIPTIONS: Record<CoverageType, string> = {
  active: 'Same-day in-person response available',
  scheduled: 'Planned outreach, not immediate response',
  remote: 'Telephonic/virtual coordination only',
};

export const operationalZones: OperationalZone[] = [
  {
    id: 'carson-active',
    coverageType: 'active',
    fte: 'Carson City FTE',
    counties: ['Carson City', 'Douglas', 'Lyon', 'Washoe'],
    label: 'Carson City FTE — Active',
    description: 'Same-day in-person response available',
  },
  {
    id: 'carson-scheduled',
    coverageType: 'scheduled',
    fte: 'Carson City FTE',
    counties: ['Churchill', 'Storey'],
    label: 'Carson City FTE — Scheduled',
    description: 'Planned outreach, not immediate response',
  },
  {
    id: 'pahrump-active',
    coverageType: 'active',
    fte: 'Pahrump FTE',
    counties: ['Nye', 'Clark'],
    label: 'Pahrump FTE — Active',
    description: 'Same-day in-person response available',
  },
  {
    id: 'pahrump-scheduled',
    coverageType: 'scheduled',
    fte: 'Pahrump FTE',
    counties: ['Esmeralda'],
    label: 'Pahrump FTE — Scheduled',
    description: 'Planned outreach, not immediate response',
  },
  {
    id: 'remote',
    coverageType: 'remote',
    fte: 'Remote Team',
    counties: ['Humboldt', 'Pershing', 'Lander', 'Eureka', 'Elko', 'White Pine', 'Mineral', 'Lincoln'],
    label: 'Remote Coverage',
    description: 'Telephonic/virtual coordination only',
  },
];

/** Look up the operational zone for a given county */
export function getOperationalZone(countyName: string): OperationalZone | undefined {
  return operationalZones.find(z => z.counties.includes(countyName));
}

/** Build a county→zone lookup map */
export const COUNTY_OPERATIONAL_MAP = new Map<string, OperationalZone>(
  operationalZones.flatMap(z => z.counties.map(c => [c, z] as [string, OperationalZone]))
);
