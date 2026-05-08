/**
 * FTE Field Coverage Status — single source of truth for whether a county
 * has any meaningful in-person field FTE reach.
 *
 * Derived from the same FTE drive-time geometry as Response Capability
 * (see coverageZones.ts). A county is treated as having field coverage only
 * when a non-trivial portion of its area falls inside an active FTE buffer —
 * not merely because an FTE has it listed in `counties[]`. This prevents
 * partial-county over-promising (e.g. far-NW Washoe, far-N/NE Nye).
 *
 * Display-language gate only. Does not change scoring, layers, filters,
 * routing tiers, or assignment logic.
 */

import { fteCapacityData } from '@/data/fte-capacity';
import { countyHasFieldResponseUnavailable, getCountyCoverageBreakdown } from '@/utils/coverageZones';
import { ACTIVE_COVERAGE_RADIUS_KM } from '@/data/operational-coverage';

/** Minimum % of county area inside the active FTE drive-time zone for the
 *  county to be treated as field-covered for display purposes. */
const FIELD_COVERAGE_MIN_ACTIVE_PERCENT = 25;

export interface FieldCoverageStatus {
  /** A meaningful portion of the county is within an active field FTE
   *  drive-time zone (≥ FIELD_COVERAGE_MIN_ACTIVE_PERCENT). */
  hasFieldCoverage: boolean;
  /** At least one remote-only FTE is assigned to this county. */
  hasRemoteCoverage: boolean;
}

const _cache = new Map<string, FieldCoverageStatus>();

export function getFieldCoverageStatus(county: string): FieldCoverageStatus {
  const cached = _cache.get(county);
  if (cached) return cached;
  const serving = fteCapacityData.filter(f => f.counties.includes(county));
  const breakdown = getCountyCoverageBreakdown(county, ACTIVE_COVERAGE_RADIUS_KM);
  const status: FieldCoverageStatus = {
    hasFieldCoverage: !countyHasFieldResponseUnavailable(county) && breakdown.activePercent >= FIELD_COVERAGE_MIN_ACTIVE_PERCENT,
    hasRemoteCoverage: serving.some(f => f.hubLocation === null),
  };
  _cache.set(county, status);
  return status;
}

/** Convenience: does this county have any meaningful in-person FTE field coverage? */
export function countyHasFieldCoverage(county: string | null | undefined): boolean {
  if (!county) return false;
  return getFieldCoverageStatus(county).hasFieldCoverage;
}

/**
 * Point-based field coverage — true when the given lat/lng is within the
 * active drive-time reach of at least one field FTE (matches the merged-buffer
 * geometry used to render the active coverage zone). This is the operational
 * source of truth for whether a *specific member point* is inside same-day
 * in-person field coverage, independent of any county-level rollup.
 */
const haversineKm = (aLat: number, aLng: number, bLat: number, bLng: number): number => {
  const R = 6371;
  const dLat = (bLat - aLat) * Math.PI / 180;
  const dLng = (bLng - aLng) * Math.PI / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * Math.PI / 180) * Math.cos(bLat * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
};

export function isPointInActiveFieldCoverage(
  lat: number,
  lng: number,
  radiusKm: number = ACTIVE_COVERAGE_RADIUS_KM,
): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  for (const f of fteCapacityData) {
    if (!f.hubLocation) continue;
    if (haversineKm(lat, lng, f.hubLocation.lat, f.hubLocation.lng) <= radiusKm) {
      return true;
    }
  }
  return false;
}
