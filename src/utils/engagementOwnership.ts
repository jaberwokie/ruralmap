/**
 * Engagement Ownership — single source of truth for in-person vs remote
 * engagement availability for a county.
 *
 * Both the Engagement Ownership card and the Member Access recommendation
 * card MUST resolve their availability state through this helper so the two
 * surfaces cannot disagree (e.g. card says "In-Person: Not Available" while
 * the recommendation says "Local in-person engagement viable").
 *
 * Display-layer only. Does not change scoring, layers, filters, routing tiers,
 * field strain, geocoding, clustering, or coverage geometry.
 */

import { countyHasFieldCoverage, isPointInActiveFieldCoverage } from '@/utils/fieldCoverageStatus';
import { ACTIVE_COVERAGE_RADIUS_KM } from '@/data/operational-coverage';

export type EngagementOwnershipType = 'primary' | 'remote' | 'none';

export interface EngagementOwnership {
  /** Resolved county name (or null if not resolved). */
  county: string | null;
  /** True only when in-person field FTE coverage actually reaches the relevant
   *  context (member point if provided, otherwise the county rollup). */
  inPersonAvailable: boolean;
  /** Telehealth/remote engagement availability (Primary or Remote CHW). */
  telehealthAvailable: boolean;
  /** Ownership type: primary CHW (field), remote CHW, or none. */
  ownershipType: EngagementOwnershipType;
  /** Header label as displayed by the Engagement Ownership card. */
  ownershipLabel: 'Primary CHW Coverage' | 'Remote CHW Coverage' | 'No Engagement Ownership';
}

/** Optional member-point context. When provided, the operational source of
 *  truth becomes the member point's position inside the same active FTE
 *  fixed-distance polygon rendered by the teal coverage layer — not the county rollup. This prevents the Details
 *  pane from claiming "Primary CHW Coverage / Local in-person engagement
 *  viable" for a member point that sits outside the rendered active
 *  coverage circle (e.g. Hawthorne in Mineral County). */
export interface MemberPointContext {
  lat: number;
  lng: number;
  /** Active fixed-distance coverage radius in km. Defaults to ACTIVE_COVERAGE_RADIUS_KM. */
  radiusKm?: number;
}

export function getEngagementOwnership(
  county: string | null | undefined,
  memberPoint?: MemberPointContext | null,
): EngagementOwnership {
  if (!county) {
    return {
      county: null,
      inPersonAvailable: false,
      telehealthAvailable: false,
      ownershipType: 'none',
      ownershipLabel: 'No Engagement Ownership',
    };
  }
  // When a member point is supplied, it is the operational source of truth:
  // in-person availability must match the rendered active coverage geometry.
  // Otherwise fall back to the county rollup.
  const isPrimary = memberPoint
    ? isPointInActiveFieldCoverage(
        memberPoint.lat,
        memberPoint.lng,
        memberPoint.radiusKm ?? ACTIVE_COVERAGE_RADIUS_KM,
      )
    : countyHasFieldCoverage(county);
  return {
    county,
    inPersonAvailable: isPrimary,
    // Mirrors EngagementOwnershipBlock: telehealth is always available when a
    // county is resolved (Remote CHW is the fallback ownership state).
    telehealthAvailable: true,
    ownershipType: isPrimary ? 'primary' : 'remote',
    ownershipLabel: isPrimary ? 'Primary CHW Coverage' : 'Remote CHW Coverage',
  };
}
