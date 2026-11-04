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

/**
 * No organization-specific staffing assignments ship with the independent edition.
 * A partner may configure verified staffing separately in its own isolated backend.
 * Never infer coverage or staff availability from public provider locations.
 */
export const FTE_CAPACITY_CONFIG = {
  carsonFieldPerDay: 0,
  pahrumpFieldPerDay: 0,
  remoteCoordinationPerDay: 0,
};

export const fteCapacityData: FTECapacity[] = [];

export function getLoadStatus(current: number, capacity: number): LoadStatus {
  if (capacity <= 0) return 'over';
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
export const FTE_ROLE_COLORS: Record<string, { primary: string; light: string; border: string }> = {};

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
