/**
 * FTE Capacity & Load Model
 *
 * Configurable baseline capacity per FTE and current mock load data.
 * Values will be replaced with real data in a future phase.
 */

export type LoadStatus = 'available' | 'near' | 'over';

/**
 * Physical anchor site for a field FTE — the boots-on-the-ground host site
 * where the CHW operates from. Used as the operational origin for coverage.
 * Remote FTEs do not have an anchor site.
 */
export interface FTEAnchorSite {
  /** Host organization / site name (e.g., "FISH", "NYECC") */
  name: string;
  /** Long-form description for detail panels */
  fullName?: string;
  /** Site classification (community partner, clinic, coalition, etc.) */
  type: string;
  /** Street address for verification / display */
  address?: string;
}

export interface FTECapacity {
  id: string;
  label: string;
  /** Max engagements/interactions per day */
  capacity: number;
  /** Current load (mock) */
  currentLoad: number;
  /**
   * Hub location for map indicator. For field FTEs this is the physical
   * anchor-site coordinate (see `anchorSite`). Null = remote FTE (sidebar only).
   */
  hubLocation: { lat: number; lng: number } | null;
  /**
   * Physical anchor site for field FTEs. Present iff `hubLocation` is set.
   * Remote FTEs leave this undefined — no fake site is assigned.
   */
  anchorSite?: FTEAnchorSite;
  /** Field vs remote classification (derived but stored for clarity) */
  deployment: 'field' | 'remote';
  /** Counties served by this FTE */
  counties: string[];
}

/** Configurable capacity baselines */
export const FTE_CAPACITY_CONFIG = {
  carsonFieldPerDay: 5,
  pahrumpFieldPerDay: 4,
  remoteCoordinationPerDay: 12,
};

export const fteCapacityData: FTECapacity[] = [
  {
    id: 'carson',
    label: 'Carson City FTE',
    capacity: FTE_CAPACITY_CONFIG.carsonFieldPerDay,
    currentLoad: 3,
    // Anchored at FISH (Friends In Service Helping), Carson City
    hubLocation: { lat: 39.16204, lng: -119.75747 },
    anchorSite: {
      name: 'FISH',
      fullName: 'Friends In Service Helping',
      type: 'Community partner site',
      address: '138 E Long St, Carson City, NV',
    },
    deployment: 'field',
    counties: ['Carson City', 'Douglas', 'Lyon', 'Washoe', 'Churchill', 'Storey'],
  },
  {
    id: 'pahrump',
    label: 'Pahrump FTE',
    capacity: FTE_CAPACITY_CONFIG.pahrumpFieldPerDay,
    currentLoad: 4,
    // Anchored at NYECC (Nye Communities Coalition), Pahrump
    hubLocation: { lat: 36.21290, lng: -115.96974 },
    anchorSite: {
      name: 'NYECC',
      fullName: 'Nye Communities Coalition',
      type: 'Community coalition site',
      address: '1845 E Calvada Blvd, Pahrump, NV',
    },
    deployment: 'field',
    counties: ['Nye', 'Clark', 'Esmeralda'],
  },
  {
    id: 'remote',
    label: 'Remote FTE',
    capacity: FTE_CAPACITY_CONFIG.remoteCoordinationPerDay,
    currentLoad: 6,
    hubLocation: null, // remote — no physical anchor by design
    deployment: 'remote',
    counties: ['Humboldt', 'Pershing', 'Lander', 'Eureka', 'Elko', 'White Pine', 'Mineral', 'Lincoln'],
  },
];

export function getLoadStatus(current: number, capacity: number): LoadStatus {
  const ratio = current / capacity;
  if (ratio >= 1) return 'over';
  if (ratio >= 0.7) return 'near';
  return 'available';
}

export const LOAD_STATUS_LABELS: Record<LoadStatus, string> = {
  available: 'Available',
  near: 'Near Capacity',
  over: 'At / Over Capacity',
};

export const LOAD_STATUS_COLORS: Record<LoadStatus, { bg: string; text: string; dot: string }> = {
  available: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'hsl(152, 69%, 40%)' },
  near: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'hsl(38, 92%, 50%)' },
  over: { bg: 'bg-red-50', text: 'text-red-700', dot: 'hsl(0, 72%, 51%)' },
};

/** Role colors — base identity per FTE */
export const FTE_ROLE_COLORS: Record<string, { primary: string; light: string; border: string }> = {
  carson:  { primary: 'hsl(174, 50%, 40%)', light: 'bg-teal-50',   border: 'border-teal-200' },
  pahrump: { primary: 'hsl(217, 70%, 50%)', light: 'bg-blue-50',   border: 'border-blue-200' },
  remote:  { primary: 'hsl(270, 30%, 55%)', light: 'bg-purple-50', border: 'border-purple-200' },
};

export const LOAD_STATUS_GUIDANCE: Record<LoadStatus, string> = {
  available: 'Can accept new engagements',
  near: 'Limited availability — prioritize critical cases',
  over: 'No additional capacity — route externally or schedule',
};

/** Look up the FTE assigned to a county */
export function getFTEForCounty(county: string): FTECapacity | undefined {
  return fteCapacityData.find(f => f.counties.includes(county));
}

/** County → FTE lookup map */
export const COUNTY_FTE_MAP = new Map<string, FTECapacity>(
  fteCapacityData.flatMap(f => f.counties.map(c => [c, f] as [string, FTECapacity]))
);
