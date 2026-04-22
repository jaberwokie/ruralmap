/**
 * Field Response Strain — shared operational visibility helper.
 *
 * Single source of truth for "which anchored field FTE is the likely responder
 * to this point, what's the travel burden, and is coverage strained / single-
 * threaded / outside same-day reach?"
 *
 * Reuses the existing anchored FTE model (hubLocation + anchorSite),
 * the existing coverage radius, and the existing distance helpers.
 * No new entity types, no new map layers, no routing API.
 */
import { fteCapacityData, type FTECapacity } from '@/data/fte-capacity';
import { kmToMiles, kmToDriveMinutes, getCountyCoverageBreakdown } from '@/utils/coverageZones';

export type StrainCoverageState =
  | 'shared'        // 2+ field FTEs cover this point
  | 'single'        // exactly 1 field FTE covers
  | 'strained'      // outside active radius, within 1.5×
  | 'noSameDay';    // beyond 1.5× radius, no realistic same-day field

export interface FieldResponseStrain {
  /** Nearest anchored field FTE — the likely responder. */
  responder: FTECapacity;
  /** Straight-line km from anchor site to target. */
  km: number;
  oneWayMi: number;
  oneWayMin: number;
  roundTripMi: number;
  roundTripMin: number;
  /** True when target is within the configured active drive-time radius. */
  withinActive: boolean;
  /** Coverage condition for the target point. */
  coverage: StrainCoverageState;
  /** Friendly label for the coverage condition. */
  coverageLabel: string;
  /** Names of every field FTE whose drive-time zone contains this point.
   *  When `county` is supplied, derived from anchoringFtes (existing logic).
   *  Otherwise derived from per-FTE radius proximity. */
  anchoringFtes: string[];
}

const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/**
 * Compute strain for an arbitrary lat/lng (e.g. member pin) or, when `county`
 * is supplied, leverage the existing county anchoringFtes geometry.
 */
export function computeFieldResponseStrain(
  target: { lat: number; lng: number },
  coverageRadiusKm: number,
  options?: { county?: string },
): FieldResponseStrain | null {
  const fieldFtes = fteCapacityData.filter(f => f.hubLocation);
  if (fieldFtes.length === 0) return null;

  const ranked = fieldFtes
    .map(f => ({
      fte: f,
      km: haversineKm(target.lat, target.lng, f.hubLocation!.lat, f.hubLocation!.lng),
    }))
    .sort((a, b) => a.km - b.km);

  const primary = ranked[0];
  if (!primary) return null;

  const oneWayMi = Math.round(kmToMiles(primary.km));
  const oneWayMin = kmToDriveMinutes(primary.km);

  const withinActive = primary.km <= coverageRadiusKm;
  const beyondSameDay = primary.km > coverageRadiusKm * 1.5;

  // Anchoring FTEs: prefer existing county breakdown when available, else
  // derive from per-FTE radius proximity using the same coverageRadiusKm.
  let anchoringFtes: string[];
  if (options?.county) {
    anchoringFtes = getCountyCoverageBreakdown(options.county, coverageRadiusKm).anchoringFtes;
  } else {
    anchoringFtes = ranked.filter(r => r.km <= coverageRadiusKm).map(r => r.fte.label);
  }

  let coverage: StrainCoverageState;
  let coverageLabel: string;
  if (anchoringFtes.length >= 2) {
    coverage = 'shared';
    coverageLabel = `Shared field coverage — ${anchoringFtes.join(', ')}`;
  } else if (anchoringFtes.length === 1) {
    coverage = 'single';
    coverageLabel = `Single FTE coverage — ${anchoringFtes[0]}`;
  } else if (!beyondSameDay) {
    coverage = 'strained';
    coverageLabel = 'Strained — beyond active radius, scheduled outreach';
  } else {
    coverage = 'noSameDay';
    coverageLabel = 'Outside realistic same-day field response';
  }

  return {
    responder: primary.fte,
    km: primary.km,
    oneWayMi,
    oneWayMin,
    roundTripMi: oneWayMi * 2,
    roundTripMin: oneWayMin * 2,
    withinActive,
    coverage,
    coverageLabel,
    anchoringFtes,
  };
}

export const STRAIN_TONE: Record<StrainCoverageState, string> = {
  shared: 'text-emerald-700',
  single: 'text-amber-700',
  strained: 'text-amber-700',
  noSameDay: 'text-red-600',
};

/**
 * Plain-language operational recommendation derived from a strain result.
 * No new logic — purely a string view of the existing classification.
 * Remote FTEs are never assigned as a geographic responder; "no same-day"
 * surfaces remote coordination as the realistic path instead.
 */
export function getStrainRecommendation(strain: FieldResponseStrain): string {
  const anchor = strain.responder.anchorSite?.name ?? strain.responder.label;
  switch (strain.coverage) {
    case 'shared':
      return `Field response feasible from ${anchor}`;
    case 'single':
      return `Single-threaded field response from ${anchor}`;
    case 'strained':
      return `Strained field response from ${anchor}`;
    case 'noSameDay':
      return 'No realistic same-day field response — remote coordination support likely required';
  }
}
