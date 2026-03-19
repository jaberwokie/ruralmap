/**
 * FTE-Centered Coverage Zone Computation
 *
 * Generates continuous drive-time coverage zones from FTE base locations,
 * merges overlapping zones, and clips to Nevada state boundary.
 * All functions accept a radiusKm parameter for configurable thresholds.
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

const nevadaFeature: Feature<Polygon> = {
  type: 'Feature',
  properties: {},
  geometry: nevadaBoundaryGeoJSON,
};

// ── Active coverage zone (merged FTE buffers, clipped to NV) ──

const _activeZoneCache = new Map<number, Feature<Polygon | MultiPolygon> | null>();

export function getActiveCoverageZone(radiusKm: number): Feature<Polygon | MultiPolygon> | null {
  if (_activeZoneCache.has(radiusKm)) return _activeZoneCache.get(radiusKm)!;
  const result = computeActiveCoverageZone(radiusKm);
  _activeZoneCache.set(radiusKm, result);
  return result;
}

function computeActiveCoverageZone(radiusKm: number): Feature<Polygon | MultiPolygon> | null {
  const fieldFtes = fteCapacityData.filter(f => f.hubLocation);
  if (fieldFtes.length === 0) return null;

  const buffers = fieldFtes.map(f => {
    const pt = turfPoint([f.hubLocation!.lng, f.hubLocation!.lat]);
    return buffer(pt, radiusKm, { units: 'kilometers' }) as Feature<Polygon>;
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

const _breakdownCache = new Map<number, Map<string, CountyCoverageBreakdown>>();

export function getCountyCoverageBreakdown(county: string, radiusKm: number): CountyCoverageBreakdown {
  if (!_breakdownCache.has(radiusKm)) {
    _breakdownCache.set(radiusKm, computeAllBreakdowns(radiusKm));
  }
  return _breakdownCache.get(radiusKm)!.get(county) ?? {
    activePercent: 0,
    scheduledPercent: 100,
    anchoringFtes: [],
    primaryType: 'scheduled',
  };
}

function computeAllBreakdowns(radiusKm: number): Map<string, CountyCoverageBreakdown> {
  const result = new Map<string, CountyCoverageBreakdown>();
  const activeZone = getActiveCoverageZone(radiusKm);

  // Per-FTE buffers for anchoring info
  const fteBuffers = fteCapacityData
    .filter(f => f.hubLocation)
    .map(f => ({
      label: f.label,
      zone: buffer(
        turfPoint([f.hubLocation!.lng, f.hubLocation!.lat]),
        radiusKm,
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

/** Convert drive-time minutes to radius km (assuming ~80 km/h rural average) */
export function driveMinutesToKm(minutes: number): number {
  return Math.round((minutes / 60) * 80);
}

/** Convert radius km to approximate drive-time minutes */
export function kmToDriveMinutes(km: number): number {
  return Math.round((km / 80) * 60);
}

/** Convert km to miles for display (1 km ≈ 0.621371 mi) */
export function kmToMiles(km: number): number {
  return Math.round(km * 0.621371);
}
