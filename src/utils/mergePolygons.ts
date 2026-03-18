import union from '@turf/union';
import { polygon as turfPolygon, featureCollection } from '@turf/helpers';
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

  // Single polygon — no union needed
  if (features.length === 1) {
    return features[0] as unknown as Feature<Polygon | MultiPolygon>;
  }

  // @turf/union v7+ expects a FeatureCollection
  const fc = featureCollection(features);
  const result = union(fc as any);
  return (result as unknown as Feature<Polygon | MultiPolygon>) ?? null;
}
