import area from '@turf/area';
import difference from '@turf/difference';
import intersect from '@turf/intersect';
import { featureCollection } from '@turf/helpers';
import type { Feature, Geometry, MultiPolygon, Point, Polygon } from 'geojson';

export type DebugIsolationGroup = 'counties' | 'operational' | 'drive' | 'engagement' | 'markers';

export interface DebugLayerDefinition {
  id: string;
  name: string;
  source: string;
  controllingToggle: string;
  drawOrder: number;
  group: DebugIsolationGroup | 'state' | 'labels' | 'highlights';
  filterKey: string;
  geometryKind: 'polygon' | 'point' | 'mixed';
}

export interface LayerDebugRecord extends DebugLayerDefinition {
  visible: boolean;
  rendered: boolean;
  duplicateSource: boolean;
  duplicateFilter: boolean;
  geometryConflict: boolean;
}

export interface SourceWarning {
  source: string;
  message: string;
  severity: 'warn' | 'info';
}

export interface SourceGeometryEntry {
  source: string;
  features: Array<Feature<Geometry> | null | undefined>;
  allowOverlap?: boolean;
  boundary?: Feature<Polygon | MultiPolygon>;
}

const OVERLAP_AREA_THRESHOLD = 50_000;
const COORDINATE_TOLERANCE = 0.0001;

const isPolygonFeature = (
  feature: Feature<Geometry> | null | undefined,
): feature is Feature<Polygon | MultiPolygon> =>
  !!feature && (feature.geometry?.type === 'Polygon' || feature.geometry?.type === 'MultiPolygon');

const isPointFeature = (feature: Feature<Geometry> | null | undefined): feature is Feature<Point> =>
  !!feature && feature.geometry?.type === 'Point';

const coordinatesEqual = (first: number[], second: number[]) =>
  Math.abs(first[0] - second[0]) <= COORDINATE_TOLERANCE && Math.abs(first[1] - second[1]) <= COORDINATE_TOLERANCE;

const validateRing = (ring: number[][]) => {
  if (ring.length < 4) return 'Ring has fewer than 4 coordinates.';
  if (!coordinatesEqual(ring[0], ring[ring.length - 1])) return 'Ring is not closed.';

  const invalidCoordinate = ring.find(([lng, lat]) => !Number.isFinite(lng) || !Number.isFinite(lat));
  if (invalidCoordinate) return 'Ring contains invalid coordinates.';

  return null;
};

const collectPolygonRings = (feature: Feature<Polygon | MultiPolygon>): number[][][] => {
  if (feature.geometry.type === 'Polygon') return feature.geometry.coordinates;
  return feature.geometry.coordinates.flat();
};

const walkCoordinates = (geometry: Geometry, visitor: (lng: number, lat: number) => void) => {
  switch (geometry.type) {
    case 'Point': {
      visitor(geometry.coordinates[0], geometry.coordinates[1]);
      return;
    }
    case 'Polygon': {
      geometry.coordinates.flat().forEach(([lng, lat]) => visitor(lng, lat));
      return;
    }
    case 'MultiPolygon': {
      geometry.coordinates.flat(2).forEach(([lng, lat]) => visitor(lng, lat));
      return;
    }
    default:
      return;
  }
};

const getFeatureBounds = (feature: Feature<Geometry> | Feature<Polygon | MultiPolygon>) => {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  walkCoordinates(feature.geometry, (lng, lat) => {
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
  });

  return [minLng, minLat, maxLng, maxLat] as const;
};

export const createLayerConflictMaps = (definitions: DebugLayerDefinition[]) => {
  const sourceCounts = new Map<string, number>();
  const filterCounts = new Map<string, number>();

  definitions.forEach((definition) => {
    sourceCounts.set(definition.source, (sourceCounts.get(definition.source) ?? 0) + 1);
    const filterFingerprint = `${definition.source}::${definition.filterKey}`;
    filterCounts.set(filterFingerprint, (filterCounts.get(filterFingerprint) ?? 0) + 1);
  });

  return {
    duplicateSources: new Set(
      Array.from(sourceCounts.entries())
        .filter(([, count]) => count > 1)
        .map(([source]) => source),
    ),
    duplicateFilters: new Set(
      Array.from(filterCounts.entries())
        .filter(([, count]) => count > 1)
        .map(([fingerprint]) => fingerprint),
    ),
  };
};

export const collectGeometryWarnings = (
  sources: SourceGeometryEntry[],
  expectedBoundary: Feature<Polygon | MultiPolygon>,
) => {
  const warnings: SourceWarning[] = [];
  const overlappingSources = new Set<string>();
  const expectedBounds = getFeatureBounds(expectedBoundary);

  sources.forEach(({ source, features, allowOverlap = false, boundary = expectedBoundary }) => {
    const validFeatures = features.filter(Boolean) as Feature<Geometry>[];

    if (validFeatures.length === 0) {
      return;
    }

    validFeatures.forEach((feature, index) => {
      if (!feature.geometry) {
        warnings.push({ source, severity: 'warn', message: `Feature ${index + 1} has null geometry.` });
        return;
      }

      if (isPolygonFeature(feature)) {
        collectPolygonRings(feature).forEach((ring) => {
          const ringIssue = validateRing(ring);
          if (ringIssue) {
            warnings.push({ source, severity: 'warn', message: `Feature ${index + 1}: ${ringIssue}` });
          }
        });

        try {
          const outsideGeometry = difference(featureCollection([feature, boundary]) as any) as Feature<Polygon | MultiPolygon> | null;
          if (outsideGeometry && area(outsideGeometry) > OVERLAP_AREA_THRESHOLD) {
            warnings.push({
              source,
              severity: 'warn',
              message: `Feature ${index + 1} extends outside the Nevada boundary and may render beyond intended map bounds.`,
            });
          }
        } catch {
          warnings.push({
            source,
            severity: 'warn',
            message: `Feature ${index + 1} could not be clipped against the Nevada boundary.`,
          });
        }
      }

      if (isPointFeature(feature)) {
        const [lng, lat] = feature.geometry.coordinates;
        if (
          lng < expectedBounds[0] - 0.25 ||
          lng > expectedBounds[2] + 0.25 ||
          lat < expectedBounds[1] - 0.25 ||
          lat > expectedBounds[3] + 0.25
        ) {
          warnings.push({
            source,
            severity: 'warn',
            message: `Point feature ${index + 1} is outside expected Nevada bounds.`,
          });
        }
      }

      const [minLng, minLat, maxLng, maxLat] = getFeatureBounds(feature);
      if (
        minLng < expectedBounds[0] - 0.25 ||
        minLat < expectedBounds[1] - 0.25 ||
        maxLng > expectedBounds[2] + 0.25 ||
        maxLat > expectedBounds[3] + 0.25
      ) {
        warnings.push({
          source,
          severity: 'warn',
          message: `Feature ${index + 1} has bounds outside the expected Nevada extent.`,
        });
      }
    });

    if (!allowOverlap) {
      const polygonFeatures = validFeatures.filter(isPolygonFeature);
      for (let i = 0; i < polygonFeatures.length; i += 1) {
        for (let j = i + 1; j < polygonFeatures.length; j += 1) {
          try {
            const overlap = intersect(featureCollection([polygonFeatures[i], polygonFeatures[j]]) as any) as Feature<Polygon | MultiPolygon> | null;
            if (overlap && area(overlap) > OVERLAP_AREA_THRESHOLD) {
              overlappingSources.add(source);
              warnings.push({
                source,
                severity: 'warn',
                message: `Features ${i + 1} and ${j + 1} overlap and may cause duplicate fill or bleed artifacts.`,
              });
              return;
            }
          } catch {
            warnings.push({
              source,
              severity: 'warn',
              message: `Could not validate overlap between polygon features ${i + 1} and ${j + 1}.`,
            });
          }
        }
      }
    }
  });

  return { warnings, overlappingSources };
};