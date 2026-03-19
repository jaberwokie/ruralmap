/**
 * FTE-Centered Coverage Zone Computation
 *
 * Generates continuous drive-time coverage zones from FTE base locations,
 * merges overlapping zones, and clips to Nevada state boundary.
 */
import buffer from '@turf/buffer';
import union from '@turf/union';
import intersect from '@turf/intersect';
import turfArea from '@turf/area';
import { point as turfPoint, featureCollection } from '@turf/helpers';
import type { Feature, Polygon, MultiPolygon } from 'geojson';
import { fteCapacityData } from '@/data/fte-capacity';
import { nevadaBoundaryGeoJSON } from '@/data/nevada-boundary';
import { nevadaCounties } from '@/data/nevada-counties';
import { mergePolygons, clipPolygon } from '@/utils/mergePolygons';
import { ACTIVE_COVERAGE_RADIUS_KM } from '@/data/operational-coverage';

const nevadaFeature: Feature<Polygon> = {
  type: 'Feature',
  properties: {},
  geometry: nevadaBoundaryGeoJSON,
};

// ── Active coverage zone (merged FTE buffers, clipped to NV) ──

let _activeZoneCache: Feature<Polygon | MultiPolygon> | null | undefined;

export function getActiveCoverageZone(): Feature<Polygon | MultiPolygon> | null {
  if (_activeZoneCache !== undefined) return _activeZoneCache;
  _activeZoneCache = computeActiveCoverageZone();
  return _activeZoneCache;
}

function computeActiveCoverageZone(): Feature<Polygon | MultiPolygon> | null {
  const fieldFtes = fteCapacityData.filter(f => f.hubLocation);
  if (fieldFtes.length === 0) return null;

  const buffers = fieldFtes.map(f => {
    const pt = turfPoint([f.hubLocation!.lng, f.hubLocation!.lat]);
    return buffer(pt, ACTIVE_COVERAGE_RADIUS_KM, { units: 'kilometers' }) as Feature<Polygon>;
  });

  let merged: Feature<Polygon | MultiPolygon> = buffers[0];
  for (let i = 1; i < buffers.length; i++) {
    const fc = featureCollection([merged, buffers[i]]);
    const u = union(fc as any);
    if (u) merged = u as Feature<Polygon | MultiPolygon>;
  }

  // Clip to Nevada
  const fc = featureCollection([merged, nevadaFeature]);
  const clipped = intersect(fc as any);
  return (clipped as Feature<Polygon | MultiPolygon>) ?? null;
}

// ── Per-county coverage breakdown ──

export interface CountyCoverageBreakdown {
  activePercent: number;
  scheduledPercent: number;
  anchoringFtes: string[];
  primaryType: 'active' | 'scheduled';
}

let _breakdownCache: Map<string, CountyCoverageBreakdown> | undefined;

export function getCountyCoverageBreakdown(county: string): CountyCoverageBreakdown {
  if (!_breakdownCache) {
    _breakdownCache = computeAllBreakdowns();
  }
  return _breakdownCache.get(county) ?? {
    activePercent: 0,
    scheduledPercent: 100,
    anchoringFtes: [],
    primaryType: 'scheduled',
  };
}

function computeAllBreakdowns(): Map<string, CountyCoverageBreakdown> {
  const result = new Map<string, CountyCoverageBreakdown>();
  const activeZone = getActiveCoverageZone();

  // Per-FTE buffers for anchoring info
  const fteBuffers = fteCapacityData
    .filter(f => f.hubLocation)
    .map(f => ({
      label: f.label,
      zone: buffer(
        turfPoint([f.hubLocation!.lng, f.hubLocation!.lat]),
        ACTIVE_COVERAGE_RADIUS_KM,
        { units: 'kilometers' }
      ) as Feature<Polygon>,
    }));

  nevadaCounties.forEach(county => {
    try {
      const merged = mergePolygons([county.boundaries]);
      if (!merged) return;
      const clipped = clipPolygon(merged, nevadaFeature as any);
      if (!clipped) return;

      const countyArea = turfArea(clipped);
      if (countyArea === 0) return;

      let activeArea = 0;
      if (activeZone) {
        try {
          const fc = featureCollection([clipped, activeZone]);
          const ix = intersect(fc as any);
          if (ix) activeArea = turfArea(ix);
        } catch { /* no intersection */ }
      }

      const activePercent = Math.min(100, Math.round((activeArea / countyArea) * 100));
      const scheduledPercent = 100 - activePercent;

      const anchoringFtes: string[] = [];
      fteBuffers.forEach(fb => {
        try {
          const fc = featureCollection([clipped, fb.zone]);
          const ix = intersect(fc as any);
          if (ix) anchoringFtes.push(fb.label);
        } catch { /* no intersection */ }
      });

      result.set(county.name, {
        activePercent,
        scheduledPercent,
        anchoringFtes,
        primaryType: activePercent >= 50 ? 'active' : 'scheduled',
      });
    } catch (e) {
      console.error(`Coverage breakdown error for ${county.name}:`, e);
    }
  });

  return result;
}
