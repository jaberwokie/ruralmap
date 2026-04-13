/**
 * Lightweight highway proximity check.
 * Determines if a point is within HIGHWAY_BUFFER_MI of any major corridor segment.
 */
import { nevadaHighwayCorridors, HIGHWAY_BUFFER_MI, type HighwayCorridor } from '@/data/highway-corridors';

const DEG_TO_RAD = Math.PI / 180;
const EARTH_RADIUS_MI = 3958.8;

/** Haversine distance in miles */
const haversineMi = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const dLat = (lat2 - lat1) * DEG_TO_RAD;
  const dLng = (lng2 - lng1) * DEG_TO_RAD;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG_TO_RAD) * Math.cos(lat2 * DEG_TO_RAD) *
    Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_MI * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/**
 * Minimum distance (mi) from point to a line segment (great-circle approximation
 * using flat-earth projection — acceptable for <50mi segments in Nevada's latitude range).
 */
const pointToSegmentMi = (
  pLat: number, pLng: number,
  aLat: number, aLng: number,
  bLat: number, bLng: number,
): number => {
  // Project onto segment using flat approximation then measure with haversine
  const dx = bLng - aLng;
  const dy = bLat - aLat;
  if (dx === 0 && dy === 0) return haversineMi(pLat, pLng, aLat, aLng);

  let t = ((pLng - aLng) * dx + (pLat - aLat) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));

  const closestLat = aLat + t * dy;
  const closestLng = aLng + t * dx;
  return haversineMi(pLat, pLng, closestLat, closestLng);
};

export interface HighwayAccessResult {
  hasAccess: boolean;
  /** Nearest corridor id + label, if within buffer */
  corridor?: { id: string; label: string };
  /** Distance to nearest corridor segment in miles */
  distanceMi?: number;
}

/**
 * Check if a point is within the buffer distance of any major highway corridor.
 */
export const checkHighwayAccess = (
  lat: number,
  lng: number,
  bufferMi: number = HIGHWAY_BUFFER_MI,
): HighwayAccessResult => {
  let bestDist = Infinity;
  let bestCorridor: HighwayCorridor | null = null;

  for (const corridor of nevadaHighwayCorridors) {
    const path = corridor.path;
    for (let i = 0; i < path.length - 1; i++) {
      const d = pointToSegmentMi(lat, lng, path[i][0], path[i][1], path[i + 1][0], path[i + 1][1]);
      if (d < bestDist) {
        bestDist = d;
        bestCorridor = corridor;
      }
    }
  }

  if (bestDist <= bufferMi && bestCorridor) {
    return {
      hasAccess: true,
      corridor: { id: bestCorridor.id, label: bestCorridor.label },
      distanceMi: Math.round(bestDist * 10) / 10,
    };
  }

  return { hasAccess: false };
};
