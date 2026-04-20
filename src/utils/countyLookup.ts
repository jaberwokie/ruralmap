import { nevadaCounties } from '@/data/nevada-counties';

/** Ray-cast point-in-polygon test. Polygon vertices are [lat, lng] pairs. */
const pointInPolygon = (lat: number, lng: number, polygon: [number, number][]): boolean => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [yi, xi] = polygon[i];
    const [yj, xj] = polygon[j];
    const intersects = ((xi > lng) !== (xj > lng))
      && (lat < ((yj - yi) * (lng - xi)) / ((xj - xi) || Number.EPSILON) + yi);
    if (intersects) inside = !inside;
  }
  return inside;
};

/**
 * Resolve which Nevada county a lat/lng falls within. Returns the county name,
 * or null if the point is outside every county polygon.
 *
 * Used for contextual lookups (e.g. surfacing the Mobility Manager that covers
 * a member's county). Does not affect any access scoring or routing logic.
 */
export const getCountyForLocation = (lat: number, lng: number): string | null => {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  for (const county of nevadaCounties) {
    if (pointInPolygon(lat, lng, county.boundaries)) return county.name;
  }
  return null;
};
