/**
 * Lightweight rail proximity utilities. STRICTLY ADDITIVE.
 *
 * Mirrors the spirit of highway proximity but is fully separate. Rail rules
 * MUST NOT be merged into highway logic, scoring, verification, or queue.
 */
import {
  railCorridors,
  railStations,
  RAIL_NEAR_STATION_MI,
  RAIL_NEAR_CORRIDOR_MI,
  RAIL_LONG_DISTANCE_MIN_MI,
  RAIL_NORTHERN_LAT_MIN,
  type RailStation,
} from '@/data/rail-corridors';

const DEG_TO_RAD = Math.PI / 180;
const EARTH_RADIUS_MI = 3958.8;

const haversineMi = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const dLat = (lat2 - lat1) * DEG_TO_RAD;
  const dLng = (lng2 - lng1) * DEG_TO_RAD;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG_TO_RAD) * Math.cos(lat2 * DEG_TO_RAD) *
    Math.sin(dLng / 2) ** 2;
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
  return haversineMi(pLat, pLng, aLat + t * dy, aLng + t * dx);
};

interface PointLike { lat?: number; lng?: number }

/** Returns the nearest active rail station to a point (always returns one if any active). */
export const getNearestRailStation = (
  entity: PointLike | null | undefined,
): { station: RailStation; distanceMi: number } | null => {
  if (!entity || typeof entity.lat !== 'number' || typeof entity.lng !== 'number') return null;
  let best: { station: RailStation; distanceMi: number } | null = null;
  for (const station of railStations) {
    if (!station.active) continue;
    const d = haversineMi(entity.lat, entity.lng, station.lat, station.lng);
    if (!best || d < best.distanceMi) best = { station, distanceMi: d };
  }
  return best;
};

export const isNearRailStation = (
  entity: PointLike | null | undefined,
  thresholdMiles: number = RAIL_NEAR_STATION_MI,
): boolean => {
  const nearest = getNearestRailStation(entity);
  return !!nearest && nearest.distanceMi <= thresholdMiles;
};

export const isNearRailCorridor = (
  entity: PointLike | null | undefined,
  thresholdMiles: number = RAIL_NEAR_CORRIDOR_MI,
): boolean => {
  if (!entity || typeof entity.lat !== 'number' || typeof entity.lng !== 'number') return false;
  for (const corridor of railCorridors) {
    if (!corridor.active) continue;
    const path = corridor.coordinates;
    for (let i = 0; i < path.length - 1; i++) {
      const d = pointToSegmentMi(entity.lat, entity.lng, path[i][0], path[i][1], path[i + 1][0], path[i + 1][1]);
      if (d <= thresholdMiles) return true;
    }
  }
  return false;
};

export interface RailRelevanceResult {
  relevant: boolean;
  message?: string;
  /** Nearest station to the member, if any. */
  memberNearestStation?: { station: RailStation; distanceMi: number };
  /** Nearest station to the matched destination resource, if any. */
  destinationNearestStation?: { station: RailStation; distanceMi: number };
  /** The chosen long-distance destination resource considered. */
  destinationName?: string;
  destinationDistanceMi?: number;
}

/**
 * Determine whether rail context is meaningful for a member's access situation.
 *
 * Relevance requires (per spec):
 *  - member is in northern Nevada (lat ≥ RAIL_NORTHERN_LAT_MIN)
 *  - at least one long-distance (≥120 mi) destination resource also in northern corridor
 *  - at least one side of the trip is reasonably near a rail station
 */
export const evaluateRailRelevance = (
  member: PointLike | null | undefined,
  candidateDestinations: ReadonlyArray<{ name: string; lat: number; lng: number; distanceMi: number }>,
): RailRelevanceResult => {
  if (!member || typeof member.lat !== 'number' || typeof member.lng !== 'number') {
    return { relevant: false };
  }
  if (member.lat < RAIL_NORTHERN_LAT_MIN) {
    return { relevant: false };
  }

  // Find the closest qualifying long-distance northern destination.
  let bestDest: { name: string; lat: number; lng: number; distanceMi: number } | null = null;
  for (const dest of candidateDestinations) {
    if (dest.distanceMi < RAIL_LONG_DISTANCE_MIN_MI) continue;
    if (dest.lat < RAIL_NORTHERN_LAT_MIN) continue;
    if (!bestDest || dest.distanceMi < bestDest.distanceMi) bestDest = dest;
  }
  if (!bestDest) return { relevant: false };

  const memberNearestStation = getNearestRailStation(member) ?? undefined;
  const destinationNearestStation = getNearestRailStation(bestDest) ?? undefined;
  const memberNear = !!memberNearestStation && memberNearestStation.distanceMi <= RAIL_NEAR_STATION_MI;
  const destNear = !!destinationNearestStation && destinationNearestStation.distanceMi <= RAIL_NEAR_STATION_MI;
  if (!memberNear && !destNear) return { relevant: false };

  let message: string;
  if (destNear && memberNear) {
    message = `Rail corridor aligns with this long-distance route via ${destinationNearestStation!.station.city} station.`;
  } else if (destNear) {
    message = `Rail transfer option may support access to ${bestDest.name} via ${destinationNearestStation!.station.city} station.`;
  } else {
    message = `Northern corridor rail access may be feasible from ${memberNearestStation!.station.city} station.`;
  }

  return {
    relevant: true,
    message,
    memberNearestStation,
    destinationNearestStation,
    destinationName: bestDest.name,
    destinationDistanceMi: bestDest.distanceMi,
  };
};
