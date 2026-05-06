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
import {
  hasViableScheduledCorridor,
  distanceMi,
  MAX_SCHEDULED_DISTANCE_MI,
  MIN_SCHEDULED_AREA_PERCENT,
  MIN_COMBINED_AREA_PERCENT,
} from '@/utils/scheduledCorridorViability';

const nevadaFeature: Feature<Polygon> = {
  type: 'Feature',
  properties: {},
  geometry: nevadaBoundaryGeoJSON,
};

// ── FTE drive-time zones (active + scheduled-outreach ring) ──
// Active zone  = merged FTE buffers at the configured radius (~0–90 min).
// Scheduled zone = merged FTE buffers at radius * SCHEDULED_RADIUS_MULT
//                  (~90–150 min reachable with planning), minus the active zone.
// Anything outside both → remote-only territory.

const SCHEDULED_RADIUS_MULT = 1.5;

const _activeZoneCache = new Map<number, Feature<Polygon | MultiPolygon> | null>();
const _scheduledZoneCache = new Map<number, Feature<Polygon | MultiPolygon> | null>();

const FIELD_RESPONSE_UNAVAILABLE_COUNTIES = new Set(['Churchill']);

export function countyHasFieldResponseUnavailable(county: string): boolean {
  return FIELD_RESPONSE_UNAVAILABLE_COUNTIES.has(county);
}

function buildMergedBufferZone(radiusKm: number): Feature<Polygon | MultiPolygon> | null {
  const fieldFtes = fteCapacityData.filter(f => f.hubLocation);
  if (fieldFtes.length === 0) return null;

  const buffers = fieldFtes.map(f => {
    const pt = turfPoint([f.hubLocation!.lng, f.hubLocation!.lat]);
    return buffer(pt, radiusKm, { units: 'kilometers' }) as Feature<Polygon>;
  });

  const merged = (union(featureCollection(buffers) as any) as Feature<Polygon | MultiPolygon> | null)
    ?? ({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'MultiPolygon',
        coordinates: buffers.map(b => b.geometry.coordinates),
      },
    } as Feature<MultiPolygon>);

  const fc = featureCollection([merged, nevadaFeature]);
  const clipped = intersect(fc as any);
  return (clipped as Feature<Polygon | MultiPolygon>) ?? null;
}

export function getActiveCoverageZone(radiusKm: number): Feature<Polygon | MultiPolygon> | null {
  if (_activeZoneCache.has(radiusKm)) return _activeZoneCache.get(radiusKm)!;
  const result = buildMergedBufferZone(radiusKm);
  _activeZoneCache.set(radiusKm, result);
  return result;
}

/** Outer drive-time zone (~90–150 min). Includes active core; subtract active for ring. */
export function getScheduledCoverageZone(radiusKm: number): Feature<Polygon | MultiPolygon> | null {
  if (_scheduledZoneCache.has(radiusKm)) return _scheduledZoneCache.get(radiusKm)!;
  const result = buildMergedBufferZone(Math.round(radiusKm * SCHEDULED_RADIUS_MULT));
  _scheduledZoneCache.set(radiusKm, result);
  return result;
}

// ── Per-county coverage breakdown ──

export interface CountyCoverageBreakdown {
  /** % of county area within the active (~same-day) drive-time zone. */
  activePercent: number;
  /** % of county area in the outer (~planned-outreach) ring, excluding active. */
  scheduledPercent: number;
  /** % of county area outside any FTE drive-time reach. */
  remotePercent: number;
  /** Field FTEs whose active buffer touches this county. */
  anchoringFtes: string[];
  primaryType: 'active' | 'scheduled' | 'remote';
}

const _breakdownCache = new Map<number, Map<string, CountyCoverageBreakdown>>();

export function getCountyCoverageBreakdown(county: string, radiusKm: number): CountyCoverageBreakdown {
  if (!_breakdownCache.has(radiusKm)) {
    _breakdownCache.set(radiusKm, computeAllBreakdowns(radiusKm));
  }
  return _breakdownCache.get(radiusKm)!.get(county) ?? {
    activePercent: 0,
    scheduledPercent: 0,
    remotePercent: 100,
    anchoringFtes: [],
    primaryType: 'remote',
  };
}

function computeAllBreakdowns(radiusKm: number): Map<string, CountyCoverageBreakdown> {
  const result = new Map<string, CountyCoverageBreakdown>();
  const activeZone = getActiveCoverageZone(radiusKm);
  const scheduledZone = getScheduledCoverageZone(radiusKm); // includes active core

  // Per-FTE active buffers for anchoring info
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

  const intersectArea = (a: any, b: any): number => {
    try {
      const ix = intersect(featureCollection([a, b]) as any);
      return ix ? turfArea(ix) : 0;
    } catch {
      return 0;
    }
  };

  nevadaCounties.forEach(county => {
    try {
      const merged = mergePolygons([county.boundaries]);
      if (!merged) return;
      const clipped = clipPolygon(merged, nevadaFeature as any);
      if (!clipped) return;

      const countyArea = turfArea(clipped);
      if (countyArea === 0) return;

      const activeArea = activeZone ? intersectArea(clipped, activeZone) : 0;
      const scheduledOuterArea = scheduledZone ? intersectArea(clipped, scheduledZone) : 0;

      const activePercent = Math.min(100, Math.round((activeArea / countyArea) * 100));
      // Scheduled ring = outer reachable zone minus active core, clamped to [0,100]
      const ringPercentRaw = Math.max(
        0,
        Math.round(((scheduledOuterArea - activeArea) / countyArea) * 100),
      );
      const scheduledPercent = Math.max(0, Math.min(100 - activePercent, ringPercentRaw));
      const remotePercent = Math.max(0, 100 - activePercent - scheduledPercent);

      const anchoringFtes: string[] = [];
      fteBuffers.forEach(fb => {
        if (intersectArea(clipped, fb.zone) > 0) anchoringFtes.push(fb.label);
      });

      // Conservative classification — bias toward operational reality.
      // Active (same-day) requires:
      //   - meaningful majority of county area inside the active drive-time zone
      //   - an anchoring field FTE
      //   - the nearest field anchor's hub is within the active drive-time
      //     radius of the county centroid (i.e. the county's operational
      //     center — not just an edge sliver — is reachable same-day).
      // This prevents large counties (e.g. Churchill) from being marked
      // "active" purely because a buffer clips their far edge.
      // Scheduled (planned) additionally requires a viable highway corridor
      // shared between the nearest field anchor and the county — thin ring
      // overlap alone is not enough.
      const fieldFtesAll = fteCapacityData.filter(f => f.hubLocation);
      let nearestFieldFte: typeof fieldFtesAll[number] | null = null;
      let nearestFieldDistMi = Infinity;
      fieldFtesAll.forEach(f => {
        const d = distanceMi(
          county.center[0], county.center[1],
          f.hubLocation!.lat, f.hubLocation!.lng,
        );
        if (d < nearestFieldDistMi) { nearestFieldDistMi = d; nearestFieldFte = f; }
      });
      const ACTIVE_RADIUS_MI = radiusKm * 0.621371;
      const centroidWithinActive = nearestFieldDistMi <= ACTIVE_RADIUS_MI;

      let primaryType: 'active' | 'scheduled' | 'remote';
      const fieldResponseAvailable = !FIELD_RESPONSE_UNAVAILABLE_COUNTIES.has(county.name);

      // Hard anchor gate: a county can only be classified as active or scheduled
      // when at least one real, non-planned FTE hub anchors it (its active
      // drive-time buffer actually touches the county). Geometric overlap
      // from the outer scheduled ring alone is not enough.
      const hasAnchoringFte = anchoringFtes.length > 0;

      if (
        fieldResponseAvailable &&
        hasAnchoringFte &&
        activePercent >= 60 &&
        centroidWithinActive
      ) {
        primaryType = 'active';
      } else if (
        fieldResponseAvailable &&
        hasAnchoringFte &&
        activePercent + scheduledPercent >= MIN_COMBINED_AREA_PERCENT &&
        scheduledPercent >= MIN_SCHEDULED_AREA_PERCENT
      ) {
        // Find nearest field FTE to this county centroid
        const fieldFtes = fteCapacityData.filter(f => f.hubLocation);
        let nearest: typeof fieldFtes[number] | null = null;
        let nearestDistMi = Infinity;
        fieldFtes.forEach(f => {
          const d = distanceMi(
            county.center[0], county.center[1],
            f.hubLocation!.lat, f.hubLocation!.lng,
          );
          if (d < nearestDistMi) { nearestDistMi = d; nearest = f; }
        });

        if (
          nearest &&
          nearestDistMi <= MAX_SCHEDULED_DISTANCE_MI &&
          hasViableScheduledCorridor(
            nearest.label,
            nearest.hubLocation!.lat,
            nearest.hubLocation!.lng,
            county.center[0],
            county.center[1],
          )
        ) {
          primaryType = 'scheduled';
        } else {
          primaryType = 'remote';
        }
      } else {
        primaryType = 'remote';
      }

      result.set(county.name, {
        activePercent,
        scheduledPercent,
        remotePercent,
        anchoringFtes,
        primaryType,
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
