/**
 * Scheduled (Planned) Outreach Corridor Viability
 *
 * A county should only be classified `scheduled` (Field Response Available — Planned)
 * if there is a realistic outreach route from a known FTE anchor — not just thin
 * radius overlap on the edge of a buffer.
 *
 * This module gates scheduled classification by checking that BOTH the FTE anchor
 * and the target county sit on a shared, approved Nevada highway corridor that
 * is appropriate for planned travel from that anchor.
 *
 * Pure geometry — does NOT touch active/same-day logic, FTE locations, radius
 * math, or styling.
 */
import {
  nevadaHighwayCorridors,
  HIGHWAY_BUFFER_MI,
  type HighwayCorridor,
} from '@/data/highway-corridors';

const DEG_TO_RAD = Math.PI / 180;
const EARTH_RADIUS_MI = 3958.8;

/** Distance threshold (mi) for planned outreach reach from anchor. */
export const MAX_SCHEDULED_DISTANCE_MI = 180;

/** Minimum scheduled-ring area % required for planned classification. */
export const MIN_SCHEDULED_AREA_PERCENT = 15;

/** County centroid must be within this buffer (mi) of an approved corridor. */
const COUNTY_CORRIDOR_BUFFER_MI = 25;

/**
 * Per-anchor whitelist of corridors that constitute realistic planned-outreach
 * routes from that hub. Built from anchor geography:
 *   - Carson City FTE (Carson City) → I-80, US-50, US-395, US-95 (north reach via Fallon)
 *   - Pahrump FTE (Pahrump)        → NV-160, US-95 (south reach), I-15 (via Las Vegas)
 *
 * Anything not on this list is NOT a viable scheduled corridor for that anchor,
 * regardless of how close a buffer ring may overlap a county.
 */
const ANCHOR_CORRIDOR_WHITELIST: Record<string, string[]> = {
  // FTE label → allowed corridor ids
  'Carson City FTE': ['I-80', 'US-50', 'US-395', 'US-95'],
  'Pahrump FTE': ['NV-160', 'US-95', 'I-15'],
};

const haversineMi = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const dLat = (lat2 - lat1) * DEG_TO_RAD;
  const dLng = (lng2 - lng1) * DEG_TO_RAD;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG_TO_RAD) * Math.cos(lat2 * DEG_TO_RAD) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_MI * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const pointToSegmentMi = (
  pLat: number, pLng: number,
  aLat: number, aLng: number,
  bLat: number, bLng: number,
): number => {
  const dx = bLng - aLng;
  const dy = bLat - aLat;
  if (dx === 0 && dy === 0) return haversineMi(pLat, pLng, aLat, aLng);
  let t = ((pLng - aLng) * dx + (pLat - aLat) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));
  const closestLat = aLat + t * dy;
  const closestLng = aLng + t * dx;
  return haversineMi(pLat, pLng, closestLat, closestLng);
};

const minDistToCorridorMi = (lat: number, lng: number, corridor: HighwayCorridor): number => {
  let best = Infinity;
  const path = corridor.path;
  for (let i = 0; i < path.length - 1; i++) {
    const d = pointToSegmentMi(lat, lng, path[i][0], path[i][1], path[i + 1][0], path[i + 1][1]);
    if (d < best) best = d;
  }
  return best;
};

/**
 * Returns true iff the county centroid is within COUNTY_CORRIDOR_BUFFER_MI of
 * a corridor that the anchor itself sits on (within HIGHWAY_BUFFER_MI), AND
 * that corridor appears in the anchor's whitelist of viable outreach routes.
 *
 * Centroid overlap with an FTE buffer alone is NOT sufficient — there must be
 * a real shared road.
 */
export function hasViableScheduledCorridor(
  fteLabel: string,
  fteLat: number,
  fteLng: number,
  countyLat: number,
  countyLng: number,
): boolean {
  const allowed = ANCHOR_CORRIDOR_WHITELIST[fteLabel];
  if (!allowed || allowed.length === 0) return false;

  for (const corridor of nevadaHighwayCorridors) {
    if (!allowed.includes(corridor.id)) continue;
    const dAnchor = minDistToCorridorMi(fteLat, fteLng, corridor);
    if (dAnchor > HIGHWAY_BUFFER_MI) continue;
    const dCounty = minDistToCorridorMi(countyLat, countyLng, corridor);
    if (dCounty <= COUNTY_CORRIDOR_BUFFER_MI) return true;
  }
  return false;
}

export function distanceMi(
  lat1: number, lng1: number, lat2: number, lng2: number,
): number {
  return haversineMi(lat1, lng1, lat2, lng2);
}
