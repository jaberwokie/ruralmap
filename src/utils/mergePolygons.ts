import union from '@turf/union';
import { polygon as turfPolygon } from '@turf/helpers';
import type { Feature, Polygon, MultiPolygon } from 'geojson';

/**
 * Merge an array of [lat, lng][] boundaries into a single GeoJSON Feature.
 * Turf expects [lng, lat] (GeoJSON standard), so we flip on input.
 */
export function mergePolygons(
  boundariesList: [number, number][][]
): Feature<Polygon | MultiPolygon> | null {
  if (boundariesList.length === 0) return null;

  const features = boundariesList.map(coords => {
    const ring = coords.map(([lat, lng]) => [lng, lat] as [number, number]);
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      ring.push([...first] as [number, number]);
    }
    return turfPolygon([ring]);
  });

  let merged = features[0] as Feature<Polygon | MultiPolygon>;
  for (let i = 1; i < features.length; i++) {
    const result = union(merged, features[i] as Feature<Polygon>);
    if (result) {
      merged = result as Feature<Polygon | MultiPolygon>;
    }
  }

  return merged;
}
