import L from 'leaflet';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import buffer from '@turf/buffer';
import difference from '@turf/difference';
import union from '@turf/union';
import { point as turfPoint, featureCollection } from '@turf/helpers';
import { nevadaBoundaryGeoJSON } from '@/data/nevada-boundary';

interface RenderAccessGapOverlayOptions {
  group: L.LayerGroup;
  pane: string;
  activeProviders: Array<{ lat: number; lng: number }>;
  radiusKm: number;
  onClick: (
    payload: { type: 'coverageGap'; radiusKm: number },
    event: L.LeafletEvent,
  ) => void;
}

/**
 * Renders the Access Gap (coverage gap) overlay — red region representing
 * Nevada area NOT covered by any active provider buffer at `radiusKm`.
 *
 * Caller controls visibility by gating the call (e.g. `if (!coverageGaps) return;`).
 * This helper unconditionally clears the group, then either:
 *   - draws the entire Nevada boundary as gap (when no eligible providers), or
 *   - subtracts the merged+morphologically-closed coverage from Nevada.
 */
export function renderAccessGapOverlay({
  group,
  pane,
  activeProviders,
  radiusKm,
  onClick,
}: RenderAccessGapOverlayOptions) {
  group.clearLayers();

  const analysisFeature: Feature<Polygon | MultiPolygon> = {
    type: 'Feature',
    properties: {},
    geometry: nevadaBoundaryGeoJSON,
  };

  if (activeProviders.length === 0) {
    const geoLayer = L.geoJSON(analysisFeature as never, {
      style: {
        color: 'hsla(0, 84%, 60%, 0.5)',
        weight: 1.5,
        fillColor: 'hsla(0, 84%, 60%, 0.15)',
        fillOpacity: 1,
      },
    });
    group.addLayer(geoLayer);
    return;
  }

  try {
    const buffers = activeProviders.map((p) => {
      const pt = turfPoint([p.lng, p.lat]);
      return buffer(pt, radiusKm, { units: 'kilometers' }) as Feature<Polygon>;
    });

    // Union all buffers in one pass to eliminate internal overlap seams.
    // Fallback keeps every buffer if Turf returns null for non-overlapping sets.
    const mergedCoverage =
      (union(featureCollection(buffers) as never) as Feature<Polygon | MultiPolygon> | null) ??
      ({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'MultiPolygon',
          coordinates: buffers.map((b) => b.geometry.coordinates),
        },
      } as Feature<MultiPolygon>);

    // Morphological close: expand then shrink to seal micro-gaps between adjacent buffers
    const expanded = buffer(mergedCoverage, 0.5, { units: 'kilometers' });
    const cleaned = expanded
      ? buffer(expanded, -0.5, { units: 'kilometers' }) ?? mergedCoverage
      : mergedCoverage;

    const fc = featureCollection([analysisFeature, cleaned]);
    const gapGeometry = difference(fc as never);

    if (gapGeometry) {
      const geoLayer = L.geoJSON(gapGeometry as never, {
        pane,
        style: {
          color: 'hsla(0, 84%, 60%, 0.13)',
          weight: 0,
          fillColor: 'hsla(0, 84%, 60%, 0.13)',
          fillOpacity: 1,
        },
      });
      geoLayer.on('click', (e: L.LeafletEvent) => {
        onClick({ type: 'coverageGap', radiusKm }, e);
      });
      group.addLayer(geoLayer);
    }
  } catch (e) {
    console.error('Coverage gap calculation error:', e);
  }
}
